// Benchmark-only copy of the isolated entity index used before the global registry.
const N3 = require('..');

const { DataFactory, termFromId, termToId } = N3;
const { isDefaultGraph } = N3.Util;

class LegacyEntityIndex extends N3.EntityIndex {
  constructor(options = {}) {
    super(options);
    this._legacyId = 1;
    this._ids = Object.create(null);
    this._ids[''] = 1;
    this._entities = Object.create(null);
    this._entities[1] = '';
    this._blankNodeIndex = 0;
    this._factory = options.factory || DataFactory;
  }

  _termFromId(id) {
    if (id[0] === '.') {
      const entities = this._entities;
      const terms = id.split('.');
      return this._factory.quad(
        this._termFromId(entities[terms[1]]),
        this._termFromId(entities[terms[2]]),
        this._termFromId(entities[terms[3]]),
        terms[4] && this._termFromId(entities[terms[4]]),
      );
    }
    return termFromId(id, this._factory);
  }

  _termToNumericId(term) {
    if (term.termType === 'Quad') {
      const s = this._termToNumericId(term.subject),
          p = this._termToNumericId(term.predicate),
          o = this._termToNumericId(term.object);
      let g;

      return s && p && o && (isDefaultGraph(term.graph) || (g = this._termToNumericId(term.graph))) &&
        this._ids[g ? `.${s}.${p}.${o}.${g}` : `.${s}.${p}.${o}`];
    }
    return this._ids[termToId(term)];
  }

  _termToNewNumericId(term) {
    const value = term && term.termType === 'Quad' ?
      `.${this._termToNewNumericId(term.subject)}.${this._termToNewNumericId(term.predicate)}.${
        this._termToNewNumericId(term.object)}${
        isDefaultGraph(term.graph) ? '' : `.${this._termToNewNumericId(term.graph)}`
      }`
      : termToId(term);

    return this._ids[value] ||
      (this._ids[this._entities[++this._legacyId] = value] = this._legacyId);
  }

  createBlankNode(suggestedName) {
    let name, index;
    if (suggestedName) {
      name = suggestedName = `_:${suggestedName}`, index = 1;
      while (this._ids[name])
        name = suggestedName + index++;
    }
    else {
      do { name = `_:b${this._blankNodeIndex++}`; }
      while (this._ids[name]);
    }
    this._ids[name] = ++this._legacyId;
    this._entities[this._legacyId] = name;
    return this._factory.blankNode(name.substr(2));
  }
}

module.exports = LegacyEntityIndex;
