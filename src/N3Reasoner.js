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

  _add(subject, predicate, object, graphItem, cb) {
    // Only add to the remaining indexes if there is not already a value in the index
    if (!this._store._addToIndex(graphItem.subjects,   subject,   predicate, object)) return;
    this._store._addToIndex(graphItem.predicates, predicate, object,    subject);
    this._store._addToIndex(graphItem.objects,    object,    subject,   predicate);
    cb();
  }

  // eslint-disable-next-line no-warning-comments
  _evaluatePremise(rule, content, cb, i = 0) {
    let v1, v2, value, index1, index2;
    const [val0, val1, val2] = rule.premise[i].value, index = content[rule.premise[i].content];
    const v0 = !(value = val0.value);
    for (value in v0 ? index : { [value]: index[value] }) {
      if (index1 = index[value]) {
        if (v0) val0.value = Number(value);
        v1 = !(value = val1.value);
        for (value in v1 ? index1 : { [value]: index1[value] }) {
          if (index2 = index1[value]) {
            if (v1) val1.value = Number(value);
            v2 = !(value = val2.value);
            for (value in v2 ? index2 : { [value]: index2[value] }) {
              if (v2) val2.value = Number(value);

              if (i === rule.premise.length - 1)
                rule.conclusion.forEach(c => {
                  // eslint-disable-next-line max-nested-callbacks
                  this._add(c.subject.value, c.predicate.value, c.object.value, content, () => { cb(c); });
                });
              else
                this._evaluatePremise(rule, content, cb, i + 1);
            }
            if (v2) val2.value = null;
          }
        }
        if (v1) val1.value = null;
      }
    }
    if (v0) val0.value = null;
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

    // eslint-disable-next-line func-style
    const addConclusions = conclusion => {
      conclusion.forEach(c => {
        // eslint-disable-next-line max-nested-callbacks
        this._add(c.subject.value, c.predicate.value, c.object.value, content, () => { addRule(c); });
      });
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
            r2.variables.forEach(v => { v.value = null; });
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
