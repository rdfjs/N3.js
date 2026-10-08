// Store: toCanonical, with the built-in SHA-256 and with Node's
const { createHash } = require('crypto');
const data = require('../data');
const { check, lazy } = require('../helpers');

const { EX } = data;
const nquads = lazy(() => data.nquads(10000));

function nodeHash(string) {
  return createHash('sha256').update(string).digest('hex');
}

// 6000 quads in which most subjects are blank nodes, each with a distinct first-degree hash
function blankNodeQuads(N3) {
  const { namedNode, blankNode, literal, quad } = N3.DataFactory, quads = [];
  for (let i = 0; i < 1500; i++) {
    const person = blankNode(`a${i}`), friend = blankNode(`b${i}`);
    quads.push(quad(namedNode(`${EX}s${i % 100}`), namedNode(`${EX}p`), person),
      quad(person, namedNode(`${EX}name`), literal(`n${i}`)),
      quad(person, namedNode(`${EX}knows`), friend),
      quad(friend, namedNode(`${EX}v`), literal(`${i % 50}`)));
  }
  return quads;
}

// Builds that throw on toCanonical, or ignore its hash option, report the benchmark as not available
function canonicalBench(quadsOf, hash) {
  return {
    available: N3 => {
      const { quad, blankNode, namedNode, literal } = N3.DataFactory;
      let hashed = false;
      try {
        new N3.Store([quad(blankNode(), namedNode(EX), literal(''))])
          .toCanonical({ hash: string => (hashed = true, nodeHash(string)) });
      }
      catch (error) {
        return false;
      }
      return !hash || hashed;
    },
    setup: N3 => {
      const store = new N3.Store(quadsOf(N3));
      return () => check(store.toCanonical({ hash }).length, 'nothing written');
    },
  };
}

function parsed(N3) {
  return new N3.Parser({ format: 'N-Quads' }).parse(nquads());
}

module.exports = {
  'store: toCanonical, few blank nodes': canonicalBench(parsed),
  'store: toCanonical, many blank nodes': canonicalBench(blankNodeQuads),
  'store: toCanonical, many blank nodes, Node crypto hash': canonicalBench(blankNodeQuads, nodeHash),
};
