// N3Util and BaseIRI
const { EX } = require('../data');
const { check } = require('../helpers');

module.exports = {
  'util: term type checks': N3 => {
    const quads = new N3.Parser({ format: 'N-Quads' }).parse(require('../data').nquads(20000));
    const { isNamedNode, isBlankNode, isLiteral, isVariable, isQuad, isDefaultGraph, inDefaultGraph } = N3.Util;
    return () => {
      let n = 0;
      for (let r = 0; r < 120; r++) {
        for (const q of quads) {
          if (isNamedNode(q.subject) || isBlankNode(q.subject)) n++;
          if (isLiteral(q.object) || isVariable(q.object) || isQuad(q.object)) n++;
          if (isDefaultGraph(q.graph) || inDefaultGraph(q)) n++;
        }
      }
      check(n, 'nothing checked');
    };
  },
  'util: prefix and prefixes': N3 => () => {
    let n = 0;
    const ns = N3.Util.prefixes({ ex: EX, xsd: 'http://www.w3.org/2001/XMLSchema#' });
    const ex = ns('ex'), xsd = ns('xsd');
    for (let i = 0; i < 6000; i++) {
      ns(`p${i}`, `${EX}p${i}/`);
      const local = N3.Util.prefix(`${EX}n${i % 50}/`);
      for (let j = 0; j < 20; j++)
        n += ex(`t${j}`).value.length + xsd('integer').value.length + local(`x${j}`).value.length;
    }
    check(n, 'nothing expanded');
  },
  'baseiri: toRelative': N3 => {
    const bases = ['http://example.org/a/b/c', 'http://example.org/a/b/', 'https://example.org/x?y#z'];
    const iris = [];
    for (let i = 0; i < 5000; i++) {
      iris.push(`http://example.org/a/b/c${i}`, `http://example.org/a/d/${i}`, `http://example.org/${i}#f`,
        `http://example.org/a/b/c?q=${i}`, `http://other.example/${i}`, `https://example.org/x?y#z${i}`);
    }
    return () => {
      let n = 0;
      for (let r = 0; r < 2; r++) for (const base of bases) {
        const baseIRI = new N3.BaseIRI(base);
        for (const iri of iris) n += baseIRI.toRelative(iri).length;
      }
      check(n, 'nothing relativized');
    };
  },
  'baseiri: supports': N3 => () => {
    let n = 0;
    for (let i = 0; i < 50000; i++) {
      if (N3.BaseIRI.supports(`http://example.org/${i}/path/`)) n++;
      if (N3.BaseIRI.supports(`file:///tmp/${i}`)) n++;
      if (N3.BaseIRI.supports(`http://example.org/a/../${i}`)) n++;
    }
    check(n, 'nothing supported');
  },
};
