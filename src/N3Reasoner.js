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
  constructor(store) {
    this._store = store;
  }

  _add(subject, predicate, object, graphItem, c, cb) {
    // Only add to the remaining indexes if there is not already a value in the index
    if (!this._store._addToIndex(graphItem.subjects,   subject,   predicate, object)) return;
    this._store._addToIndex(graphItem.predicates, predicate, object,    subject);
    this._store._addToIndex(graphItem.objects,    object,    subject,   predicate);
    cb(c);
  }

  // Invoked once per fully-bound match; pulled out of _evaluatePremise so the
  // hot loop no longer allocates a fresh callback closure per match.
  _emit(rule, content, cb) {
    const conclusion = rule.conclusion;
    for (let k = 0; k < conclusion.length; k++) {
      const c = conclusion[k];
      this._add(c.subject.value, c.predicate.value, c.object.value, content, c, cb);
    }
  }

  // At each of the three premise levels, when the variable is bound we do a
  // direct index lookup instead of allocating a single-key `{ [value]: index[value] }`
  // object purely to drive a for-in that only ever runs once. The unbound case still
  // iterates every key of the index. for-in yields string keys and `index[value]`
  // coerces a numeric `value` to string, so the lookups are identical; the
  // `val.value = Number(value)` reconstruction (unbound only) and the truthiness guards
  // are preserved exactly.
  // Conclusion emission is delegated to _emit (a method, not a fresh closure per
  // match), preserving the cb(c) signalling protocol that drives the fixpoint loop.
  _evaluatePremise(rule, content, cb, i = 0) {
    let value, index1;
    const [val0, val1, val2] = rule.premise[i].value, index = content[rule.premise[i].content];
    const last = i === rule.premise.length - 1;
    const v0 = !(value = val0.value);
    if (v0) {
      // Level 0 unbound: iterate every key. Every key of an intermediate index node maps
      // to a non-empty `{}` (the store creates them on insert and prunes empty ones on
      // remove), so `index[value]` is always truthy here — no guard needed (the original
      // guard was only meaningful on the bound path below).
      for (value in index) {
        index1 = index[value];
        val0.value = Number(value);
        this._evaluateLevel1(rule, content, cb, i, last, val1, val2, index1);
      }
      val0.value = null;
    }
    // Level 0 bound: single guarded lookup (the guard the original applied at this level).
    else if (index1 = index[value]) {
      this._evaluateLevel1(rule, content, cb, i, last, val1, val2, index1);
    }
  }

  _evaluateLevel1(rule, content, cb, i, last, val1, val2, index1) {
    let value, index2;
    const v1 = !(value = val1.value);
    if (v1) {
      // Level 1 unbound: iterate every key. As at level 0, an intermediate index node's
      // keys always map to a non-empty `{}`, so `index1[value]` is always truthy here.
      for (value in index1) {
        index2 = index1[value];
        val1.value = Number(value);
        this._evaluateLevel2(rule, content, cb, i, last, val2, index2);
      }
      val1.value = null;
    }
    // Level 1 bound: single guarded lookup (the guard the original applied at this level).
    else if (index2 = index1[value]) {
      this._evaluateLevel2(rule, content, cb, i, last, val2, index2);
    }
  }

  _evaluateLevel2(rule, content, cb, i, last, val2, index2) {
    let value;
    const v2 = !(value = val2.value);
    if (v2) {
      // Level 2 unbound: iterate every key, binding val2 to each.
      for (value in index2) {
        val2.value = Number(value);
        if (last) this._emit(rule, content, cb);
        else this._evaluatePremise(rule, content, cb, i + 1);
      }
      val2.value = null;
    }
    // Level 2 bound: the original iterated a single-key object with NO presence guard,
    // so the body ran exactly once regardless of whether the key exists. Preserve that.
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

    // Indexed loop + pass (c, addRule) through _add instead of allocating a fresh
    // `() => addRule(c)` closure per conclusion. _add invokes cb(c) on a confirmed insert,
    // preserving the original addRule(c) signalling.
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
    if (!Array.isArray(rules)) {
      rules = getRulesFromDataset(rules);
    }
    rules = rules.map(rule => this._createRule(rule));

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
            // Indexed loop instead of a fresh forEach callback per (r1, r2, i, c).
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
    for (const graphId in graphs) {
      this._reasonGraphNaive(rules, graphs[graphId]);
    }

    this._store._size = null;
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
