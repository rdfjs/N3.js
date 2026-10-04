// Benchmarks run by perf/ci/compare.js against a base and a head build.
// Each entry's setup(N3) does untimed preparation and returns the function
// whose run time is measured (it may return a promise). Size each one so a
// single call takes roughly 20–150ms on a CI runner.
//
// A benchmark for a feature the base branch does not have yet can be written
// as { available: N3 => <does this build have the feature>, setup }; it is
// then reported as new instead of failing. Any other failure on either build
// fails the comparison.
const data = require('./data');

const { EX } = data;

function parseBench(format, text) {
  return N3 => () => {
    const quads = new N3.Parser({ format, baseIRI: 'http://example.org/doc' }).parse(text);
    if (!quads.length) throw new Error('nothing parsed');
  };
}

function callbackParseBench(format, text) {
  // The callback API is what N3.StreamParser and most consumers sit on
  return N3 => () => new Promise((resolve, reject) => {
    let count = 0;
    new N3.Parser({ format }).parse(text, (error, quad) => {
      if (error) reject(error);
      else if (quad) count++;
      else if (count) resolve();
      else reject(new Error('nothing parsed'));
    });
  });
}

function parsedQuads(N3, format, text) {
  return new N3.Parser({ format }).parse(text);
}

function writeBench(format, makeText, inputFormat, options = {}) {
  return N3 => {
    const quads = parsedQuads(N3, inputFormat, makeText());
    return () => {
      const writer = new N3.Writer({ format, ...options });
      writer.addQuads(quads);
      writer.end((error, result) => {
        if (error) throw error;
        if (!result.length) throw new Error('nothing written');
      });
    };
  };
}

function storeOf(N3, size) {
  const { namedNode, literal, quad } = N3.DataFactory;
  const quads = [];
  for (let i = 0; i < size; i++) {
    quads.push(quad(
      namedNode(`${EX}s${i % 1000}`),
      namedNode(`${EX}p${i % 20}`),
      i % 3 ? namedNode(`${EX}o${i}`) : literal(`v${i}`),
      namedNode(`${EX}g${i % 4}`),
    ));
  }
  return quads;
}

const ntriples = data.ntriples(20000);
const nquads = data.nquads(20000);
const turtle = data.turtle(4000);
const trig = data.trig(4000);
const n3 = data.n3(1500);
const turtleStar = data.turtleStar(3000);

module.exports = {
  // Parser (and Lexer)
  'parser: N-Triples': parseBench('N-Triples', ntriples),
  'parser: N-Quads': parseBench('N-Quads', nquads),
  'parser: Turtle': parseBench('Turtle', turtle),
  'parser: Turtle (callback)': callbackParseBench('Turtle', turtle),
  'parser: TriG': parseBench('TriG', trig),
  'parser: N3': parseBench('text/n3', n3),
  'parser: Turtle 1.2 (triple terms, reifiers)': parseBench('Turtle', turtleStar),

  // Writer
  'writer: N-Triples': writeBench('N-Triples', () => ntriples, 'N-Triples'),
  'writer: N-Quads': writeBench('N-Quads', () => nquads, 'N-Quads'),
  'writer: Turtle with prefixes': writeBench('Turtle', () => turtle, 'Turtle',
    { prefixes: { ex: EX, xsd: 'http://www.w3.org/2001/XMLSchema#' } }),
  'writer: TriG': writeBench('TriG', () => trig, 'TriG', { prefixes: { ex: EX } }),
  'writer: Turtle 1.2': writeBench('Turtle', () => turtleStar, 'Turtle', { prefixes: { ex: EX } }),
  'writer: blank nodes and lists': N3 => {
    const { namedNode, literal } = N3.DataFactory;
    return () => {
      const writer = new N3.Writer({ prefixes: { ex: EX } });
      for (let i = 0; i < 5000; i++) {
        writer.addQuad(namedNode(`${EX}s${i}`), namedNode(`${EX}p`), writer.blank([
          { predicate: namedNode(`${EX}name`), object: literal(`n${i}`) },
          { predicate: namedNode(`${EX}items`), object: writer.list([literal('a'), literal('b'), namedNode(`${EX}c${i}`)]) },
        ]));
      }
      writer.end((error, result) => {
        if (error) throw error;
        if (!result.length) throw new Error('nothing written');
      });
    };
  },

  // Store
  'store: addQuad': N3 => {
    const quads = storeOf(N3, 15000);
    return () => {
      const store = new N3.Store();
      for (const q of quads) store.addQuad(q);
      if (store.size !== quads.length) throw new Error('wrong size');
    };
  },
  'store: addQuad (strings)': N3 => () => {
    const store = new N3.Store();
    for (let i = 0; i < 40; i++)
      for (let j = 0; j < 40; j++)
        for (let k = 0; k < 40; k++)
          store.addQuad(`${EX}${i}`, `${EX}${j}`, `${EX}${k}`);
    if (store.size !== 64000) throw new Error('wrong size');
  },
  'store: getQuads by subject/predicate/object': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { namedNode } = N3.DataFactory;
    const s = [], p = [], o = [];
    for (let i = 0; i < 1000; i++) s.push(namedNode(`${EX}s${i}`));
    for (let i = 0; i < 20; i++) p.push(namedNode(`${EX}p${i}`));
    for (let i = 0; i < 15000; i += 3) o.push(namedNode(`${EX}o${i + 1}`));
    return () => {
      let n = 0;
      for (const x of s) n += store.getQuads(x, null, null, null).length;
      for (const x of p) n += store.getQuads(null, x, null, null).length;
      for (const x of o) n += store.getQuads(null, null, x, null).length;
      for (let i = 0; i < 1000; i++) n += store.getQuads(s[i], p[i % 20], null, null).length;
      if (!n) throw new Error('nothing found');
    };
  },
  'store: countQuads and has': N3 => {
    const quads = storeOf(N3, 15000);
    const store = new N3.Store(quads);
    return () => {
      let n = 0;
      for (let i = 0; i < quads.length; i++) if (store.has(quads[i])) n++;
      for (let i = 0; i < 5000; i++) n += store.countQuads(quads[i].subject, null, null, null);
      for (let i = 0; i < 5000; i++) n += store.countQuads(null, null, quads[i].object, null);
      if (!n) throw new Error('nothing found');
    };
  },
  'store: match and iterate': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { namedNode } = N3.DataFactory;
    return () => {
      let n = 0;
      for (const q of store) if (q) n++;
      for (let i = 0; i < 20; i++)
        for (const q of store.match(null, namedNode(`${EX}p${i}`), null, null)) if (q) n++;
      if (!n) throw new Error('nothing found');
    };
  },
  'store: removeQuad': N3 => {
    const quads = storeOf(N3, 10000);
    return () => {
      const store = new N3.Store(quads);
      for (const q of quads) store.removeQuad(q);
      if (store.size !== 0) throw new Error('not empty');
    };
  },

  // DataFactory
  'datafactory: create terms and quads': N3 => () => {
    const { namedNode, literal, blankNode, quad } = N3.DataFactory;
    const lang = 'en', dt = namedNode('http://www.w3.org/2001/XMLSchema#integer');
    let n = 0;
    for (let i = 0; i < 100000; i++) {
      const q = quad(namedNode(`${EX}s${i}`), namedNode(`${EX}p`),
        i % 3 === 0 ? literal(`${i}`, dt) : i % 3 === 1 ? literal(`l${i}`, lang) : blankNode(`b${i}`));
      if (q.object.value) n++;
    }
    if (!n) throw new Error('nothing created');
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
      if (!n) throw new Error('nothing created');
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
      if (!n) throw new Error('nothing read');
    };
  },
  'datafactory: termToId / termFromId': N3 => {
    const quads = parsedQuads(N3, 'N-Quads', nquads);
    return () => {
      let n = 0;
      for (let i = 0; i < 10; i++) {
        for (const q of quads) {
          if (N3.termFromId(N3.termToId(q.subject))) n++;
          if (N3.termFromId(N3.termToId(q.object))) n++;
        }
      }
      if (!n) throw new Error('nothing converted');
    };
  },

  // Reasoner
  'reasoner: deep taxonomy (1000)': N3 => {
    const { generateDeepTaxonomy } = require('deep-taxonomy-benchmark');
    const rules = new N3.Store(new N3.Parser({ format: 'text/n3' }).parse(
      '{ ?s a ?o . ?o <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o2 . } => { ?s a ?o2 . } .'));
    return () => {
      const store = generateDeepTaxonomy(1000, false);
      new N3.Reasoner(store).reason(rules);
    };
  },
};
