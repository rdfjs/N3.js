import DF from './N3DataFactory';

/**
 * Gets rules from a dataset. This will only collect horn rules declared using log:implies.
 */
export function getRulesFromDataset(dataset) {
  const rules = [];
  for (const { subject, object } of dataset.match(null, DF.namedNode('http://www.w3.org/2000/10/swap/log#implies'), null, DF.defaultGraph())) {
    const premise = [...dataset.match(null, null, null, subject)];
    const conclusion = [...dataset.match(null, null, null, object)];
    rules.push({ premise, conclusion });
  }
  return rules;
}

export default class N3Reasoner {
  constructor(store, options = {}) {
    this._store = store;
    // Optional safety budgets for reasoning over untrusted rules or data
    this._maxDerivations = options.maxDerivations === undefined ? Infinity : options.maxDerivations;
    // Caps a rule's premise count, as `_evaluatePremise` recurses once per premise
    this._maxPremiseDepth = options.maxPremiseDepth === undefined ? Infinity : options.maxPremiseDepth;
  }

  _add(subject, predicate, object, graphItem, c, cb) {
    // Only add to the remaining indexes if there is not already a value in the index
    if (!this._store._addToIndex(graphItem.subjects,   subject,   predicate, object)) return;
    this._store._addToIndex(graphItem.predicates, predicate, object,    subject);
    this._store._addToIndex(graphItem.objects,    object,    subject,   predicate);
    // Count genuinely new derivations and fail past the budget. The check comes
    // after all three indexes are updated, so a caught error leaves the store
    // in a consistent state (the reasoning result is merely incomplete).
    if (++this._derivations > this._maxDerivations)
      throw new Error(`Reasoning exceeded the maximum of ${this._maxDerivations} derivations`);
    cb(c);
  }

  // Emit conclusions without allocating per-match callbacks
  _emit(rule, content, cb) {
    const conclusion = rule.conclusion;
    for (let k = 0; k < conclusion.length; k++) {
      const c = conclusion[k];
      this._add(c.subject.value, c.predicate.value, c.object.value, content, c, cb);
    }
  }

  // Bound values use direct lookups; unbound values scan the index
  _evaluatePremise(rule, content, cb, i = 0) {
    let value, index1;
    const [val0, val1, val2] = rule.premise[i].value, index = content[rule.premise[i].content];
    const last = i === rule.premise.length - 1;
    const v0 = !(value = val0.value);
    if (v0) {
      // Intermediate index entries are always non-empty
      for (value in index) {
        index1 = index[value];
        val0.value = Number(value);
        this._evaluateLevel1(rule, content, cb, i, last, val1, val2, index1);
      }
      val0.value = null;
    }
    else if (index1 = index[value]) {
      this._evaluateLevel1(rule, content, cb, i, last, val1, val2, index1);
    }
  }

  _evaluateLevel1(rule, content, cb, i, last, val1, val2, index1) {
    let value, index2;
    const v1 = !(value = val1.value);
    if (v1) {
      for (value in index1) {
        index2 = index1[value];
        val1.value = Number(value);
        this._evaluateLevel2(rule, content, cb, i, last, val2, index2);
      }
      val1.value = null;
    }
    else if (index2 = index1[value]) {
      this._evaluateLevel2(rule, content, cb, i, last, val2, index2);
    }
  }

  _evaluateLevel2(rule, content, cb, i, last, val2, index2) {
    let value;
    const v2 = !(value = val2.value);
    if (v2) {
      for (value in index2) {
        val2.value = Number(value);
        if (last) this._emit(rule, content, cb);
        else this._evaluatePremise(rule, content, cb, i + 1);
      }
      val2.value = null;
    }
    // Bound leaves run once even when the key is absent
    else if (last) this._emit(rule, content, cb);
    else this._evaluatePremise(rule, content, cb, i + 1);
  }

  _evaluateRules(rules, content, cb) {
    for (let i = 0; i < rules.length; i++) {
      this._evaluatePremise(rules[i], content, cb);
    }
  }

  // A naive reasoning algorithm where rules are just applied by repeatedly applying rules
  // until no more evaluations are made
  _reasonGraphNaive(rules, content) {
    const newRules = [];

    function addRule(conclusion) {
      if (conclusion.next)
        conclusion.next.forEach(rule => {
          newRules.push([conclusion.subject.value, conclusion.predicate.value, conclusion.object.value, rule]);
        });
    }

    // Reuse addRule instead of allocating a callback per conclusion
    const addConclusions = conclusion => {
      for (let k = 0; k < conclusion.length; k++) {
        const c = conclusion[k];
        this._add(c.subject.value, c.predicate.value, c.object.value, content, c, addRule);
      }
    };

    this._evaluateRules(rules, content, addRule);

    let r;
    while ((r = newRules.pop()) !== undefined) {
      const [subject, predicate, object, rule] = r;
      const v1 = rule.basePremise.subject.value;
      if (!v1) rule.basePremise.subject.value = subject;
      const v2 = rule.basePremise.predicate.value;
      if (!v2) rule.basePremise.predicate.value = predicate;
      const v3 = rule.basePremise.object.value;
      if (!v3) rule.basePremise.object.value = object;

      if (rule.premise.length === 0) {
        addConclusions(rule.conclusion);
      }
      else {
        this._evaluatePremise(rule, content, addRule);
      }

      if (!v1) rule.basePremise.subject.value = null;
      if (!v2) rule.basePremise.predicate.value = null;
      if (!v3) rule.basePremise.object.value = null;
    }
  }

  _createRule({ premise, conclusion }) {
    const varMapping = {};

    const toId = value => value.termType === 'Variable' ?
      // If the term is a variable, then create an empty object that values can be placed into
      (varMapping[value.value] = varMapping[value.value] || {}) :
      // If the term is not a variable, then set the ID value
      { value: this._store._termToNewNumericId(value) };

    // eslint-disable-next-line func-style
    const t = term => ({ subject: toId(term.subject), predicate: toId(term.predicate), object: toId(term.object) });

    return {
      premise: premise.map(p => t(p)),
      conclusion: conclusion.map(p => t(p)),
      variables: Object.values(varMapping),
    };
  }

  reason(rules) {
    this._derivations = 0;
    if (!Array.isArray(rules)) {
      rules = getRulesFromDataset(rules);
    }
    rules = rules.map(rule => this._createRule(rule));

    // Reject rules with more body triples than the configured premise depth:
    // `_evaluatePremise` recurses once per premise, so an over-long rule would
    // otherwise overflow the stack with an uncatchable RangeError.
    for (const rule of rules) {
      if (rule.premise.length > this._maxPremiseDepth)
        throw new Error(`Reasoning rule exceeds the maximum premise depth of ${this._maxPremiseDepth}`);
    }

    for (const r1 of rules) {
      for (const r2 of rules) {
        for (let i = 0; i < r2.premise.length; i++) {
          const p = r2.premise[i];
          for (const c of r1.conclusion) {
            if (termEq(p.subject, c.subject) && termEq(p.predicate, c.predicate) && termEq(p.object, c.object)) {
              const set = new Set();

              const premise = [];

              // Since these *will* be substituted when we apply the rule,
              // we need to do this, so that we index correctly in the subsequent section
              p.subject.value = p.subject.value || 1;
              p.object.value = p.object.value || 1;
              p.predicate.value = p.predicate.value || 1;

              for (let j = 0; j < r2.premise.length; j++) {
                if (j !== i) {
                  premise.push(getIndex(r2.premise[j], set));
                }
              }

              // eslint-disable-next-line no-warning-comments
              // TODO: Create new rule, with new indexing
              //       Future, 'collapse' the next statements when they share a premise/base-premise
              (c.next = c.next || []).push({
                premise,
                conclusion: r2.conclusion,
                // This is a single premise of the form { subject, predicate, object },
                // which we can use to instantiate the rule using the new data that was emitted
                basePremise: p,
              });
            }
            for (let k = 0; k < r2.variables.length; k++) r2.variables[k].value = null;
          }
        }
      }
    }

    for (const rule of rules) {
      const set = new Set();
      rule.premise = rule.premise.map(p => getIndex(p, set));
    }

    const graphs = this._store._getGraphs();
    try {
      for (const graphId in graphs) {
        this._reasonGraphNaive(rules, graphs[graphId]);
      }
    }
    finally {
      // Invalidate the cached size even if a derivation budget was exceeded,
      // so a caught budget error leaves the store fully consistent.
      this._store._size = null;
    }
  }
}

function getIndex({ subject, predicate, object }, set) {
  const s = subject.value   || set.has(subject)   || (set.add(subject), false);
  const p = predicate.value || set.has(predicate) || (set.add(predicate), false);
  const o = object.value    || set.has(object)    || (set.add(object), false);

  return (!s && p) ? { content: 'predicates', value: [predicate, object, subject] } :
    o ? { content: 'objects', value: [object, subject, predicate] } :
        { content: 'subjects', value: [subject, predicate, object] };
}

function termEq(t1, t2) {
  if (t1.value === null) {
    t1.value = t2.value;
  }
  return t1.value === t2.value;
}
