// DataFactory, terms, and the term id helpers
const rdfDataModel = require('@rdfjs/data-model');
const data = require('../data');
const { lazy, check } = require('../helpers');

const { EX } = data;
const nquads = lazy(() => data.nquads(20000));

module.exports = {
  'datafactory: create terms and quads': N3 => () => {
    const { namedNode, literal, blankNode, quad } = N3.DataFactory;
    const lang = 'en', dt = namedNode('http://www.w3.org/2001/XMLSchema#integer');
    let n = 0;
    for (let i = 0; i < 100000; i++) {
      const q = quad(namedNode(`${EX}s${i}`), namedNode(`${EX}p`),
        i % 3 === 0 ? literal(`${i}`, dt) : i % 3 === 1 ? literal(`l${i}`, lang) : blankNode(`b${i}`));
      if (q.object.value) n++;
    }
    check(n, 'nothing created');
  },
  'datafactory: variable, defaultGraph, triple and blankNode()': N3 => () => {
    const { namedNode, variable, defaultGraph, triple, blankNode } = N3.DataFactory;
    let n = 0;
    for (let i = 0; i < 100000; i++) {
      const t = triple(variable(`v${i}`), namedNode(`${EX}p`), blankNode());
      if (t.graph.equals(defaultGraph())) n += t.subject.value.length;
    }
    check(n, 'nothing created');
  },
  'datafactory: literals from numbers, booleans and dates': N3 => {
    const values = [];
    for (let i = 0; i < 1000; i++)
      values.push(i, -i * 7919, i / 7, i * 1e19, i * 1e22, i % 2 === 0, new Date(Date.UTC(2020, 0, 1 + i)));
    values.push(Infinity, -Infinity, NaN);
    return () => {
      const { literal } = N3.DataFactory;
      let n = 0;
      for (let r = 0; r < 30; r++)
        for (const value of values) n += literal(value).datatype.value.length;
      check(n, 'nothing created');
    };
  },
  'datafactory: term getters and equals': N3 => {
    const { namedNode, literal, quad } = N3.DataFactory;
    const dt = namedNode('http://www.w3.org/2001/XMLSchema#integer');
    const quads = [];
    for (let i = 0; i < 50000; i++)
      quads.push(quad(namedNode(`${EX}s${i}`), namedNode(`${EX}p`), i % 2 ? literal(`${i}`, dt) : literal(`l${i}`, 'en')));
    return () => {
      let n = 0;
      for (let i = 0; i < quads.length; i++) {
        const o = quads[i].object;
        n += o.value.length + o.language.length + o.datatype.value.length;
        if (quads[i].equals(quads[(i + 1) % quads.length])) n++;
      }
      check(n, 'nothing read');
    };
  },
  'datafactory: equals with terms from another library': N3 => {
    const ours = new N3.Parser({ format: 'N-Quads' }).parse(nquads());
    const theirs = ours.map(q => rdfDataModel.fromQuad ? rdfDataModel.fromQuad(q) : q);
    return () => {
      let n = 0;
      for (let r = 0; r < 4; r++) for (let i = 0; i < ours.length; i++) {
        if (ours[i].equals(theirs[i])) n++;
        if (ours[i].object.equals(theirs[(i + 1) % ours.length].object)) n++;
      }
      check(n, 'nothing equal');
    };
  },
  'datafactory: fromTerm and fromQuad': N3 => {
    const { quad, namedNode, literal, blankNode, variable, defaultGraph } = rdfDataModel;
    const foreign = [];
    for (let i = 0; i < 20000; i++) {
      foreign.push(quad(namedNode(`${EX}s${i}`), namedNode(`${EX}p`),
        i % 3 === 0 ? literal(`${i}`, namedNode('http://www.w3.org/2001/XMLSchema#integer')) :
        i % 3 === 1 ? literal(`l${i}`, 'en') : blankNode(`b${i}`),
        i % 2 ? defaultGraph() : namedNode(`${EX}g`)));
      foreign.push(quad(variable(`v${i}`), namedNode(`${EX}p`), namedNode(`${EX}o`)));
    }
    const native = foreign.map(q => N3.DataFactory.fromQuad(q));
    return () => {
      let n = 0;
      for (const q of foreign) n += N3.DataFactory.fromQuad(q).subject.value.length;
      for (const q of foreign) n += N3.DataFactory.fromQuad(q).object.value.length;
      for (const q of foreign) n += N3.DataFactory.fromTerm(q.subject).value.length;
      // Terms that already belong to N3.js are returned as they are
      for (const q of native) if (N3.DataFactory.fromTerm(q) === q) n++;
      check(n, 'nothing converted');
    };
  },
  'datafactory: toJSON': N3 => {
    const quads = new N3.Parser({ format: 'N-Quads' }).parse(nquads());
    return () => {
      check(JSON.stringify(quads).length, 'nothing serialized');
    };
  },
  'datafactory: termToId / termFromId': N3 => {
    const quads = new N3.Parser({ format: 'N-Quads' }).parse(nquads());
    return () => {
      let n = 0;
      for (let i = 0; i < 20; i++) {
        for (const q of quads) {
          if (N3.termFromId(N3.termToId(q.subject))) n++;
          if (N3.termFromId(N3.termToId(q.object))) n++;
        }
      }
      check(n, 'nothing converted');
    };
  },
};
