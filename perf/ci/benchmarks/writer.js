// Writer and StreamWriter
const { Readable } = require('stream');
const data = require('../data');
const { lazy, check, drain } = require('../helpers');

const { EX } = data;

function parsedQuads(N3, format, text) {
  return new N3.Parser({ format }).parse(text);
}

function endWriter(writer) {
  writer.end((error, result) => {
    if (error) throw error;
    check(result.length, 'nothing written');
  });
}

function writeBench(format, makeText, inputFormat, options = {}) {
  return N3 => {
    const quads = parsedQuads(N3, inputFormat, makeText());
    return () => {
      const writer = new N3.Writer({ format, ...options });
      writer.addQuads(quads);
      endWriter(writer);
    };
  };
}

function streamWriteBench(text, inputFormat, options) {
  return N3 => {
    const quads = parsedQuads(N3, inputFormat, text());
    return async () => {
      const writer = new N3.StreamWriter(options);
      check(await drain(Readable.from(quads).pipe(writer)), 'nothing written');
    };
  };
}

const ntriples = lazy(() => data.ntriples(20000));
const nquads = lazy(() => data.nquads(20000));
const turtle = lazy(() => data.turtle(4000));
const trig = lazy(() => data.trig(4000));
const n3 = lazy(() => data.n3(1500));
const turtleStar = lazy(() => data.turtleStar(3000));

module.exports = {
  'writer: N-Triples': writeBench('N-Triples', ntriples, 'N-Triples'),
  'writer: N-Quads': writeBench('N-Quads', nquads, 'N-Quads'),
  'writer: Turtle with prefixes': writeBench('Turtle', turtle, 'Turtle',
    { prefixes: { ex: EX, xsd: 'http://www.w3.org/2001/XMLSchema#' } }),
  'writer: TriG': writeBench('TriG', trig, 'TriG', { prefixes: { ex: EX } }),
  'writer: Turtle 1.2': writeBench('Turtle', turtleStar, 'Turtle', { prefixes: { ex: EX } }),
  'writer: N3 formulas and variables': writeBench('text/n3', n3, 'text/n3', { prefixes: { ex: EX } }),
  'writer: relative IRIs against baseIRI': writeBench('Turtle', ntriples, 'N-Triples',
    { baseIRI: `${EX.slice(0, -3)}/` }),
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
      endWriter(writer);
    };
  },
  'writer: escaped literals': N3 => {
    const { namedNode, literal } = N3.DataFactory;
    const quads = [];
    for (let i = 0; i < 10000; i++)
      quads.push(N3.DataFactory.quad(namedNode(`${EX}s${i}`), namedNode(`${EX}p`),
        literal(`tab\tnewline\nquote" backslash\\ é \u0001 ${'x'.repeat(i % 50)}`, i % 2 ? 'en' : undefined)));
    return () => {
      const writer = new N3.Writer({ format: 'N-Triples' });
      writer.addQuads(quads);
      endWriter(writer);
    };
  },
  'writer: addPrefix and addPrefixes': N3 => {
    const { namedNode, quad } = N3.DataFactory;
    const quads = [];
    for (let i = 0; i < 2000; i++)
      quads.push(quad(namedNode(`${EX}ns${i % 300}/s${i}`), namedNode(`${EX}other${i % 50}#p`), namedNode(`${EX}o${i}`)));
    return () => {
      // One by one, as a StreamWriter receives them from a StreamParser
      const writer = new N3.Writer();
      for (let i = 0; i < 300; i++) writer.addPrefix(`p${i}`, `${EX}ns${i}/`);
      const prefixes = {};
      for (let i = 0; i < 50; i++) prefixes[`q${i}`] = namedNode(`${EX}other${i}#`);
      writer.addPrefixes(prefixes);
      writer.addQuads(quads);
      endWriter(writer);
    };
  },
  'writer: quadToString and quadsToString': N3 => {
    const quads = parsedQuads(N3, 'N-Quads', nquads());
    return () => {
      const writer = new N3.Writer({ format: 'N-Quads' });
      let n = 0;
      for (const q of quads) n += writer.quadToString(q.subject, q.predicate, q.object, q.graph).length;
      n += writer.quadsToString(quads).length;
      check(n, 'nothing written');
    };
  },

  'streamwriter: N-Triples': streamWriteBench(ntriples, 'N-Triples', { format: 'N-Triples' }),
  'streamwriter: Turtle with prefixes': streamWriteBench(turtle, 'Turtle', { prefixes: { ex: EX } }),
  'streamwriter: import()': N3 => {
    const quads = parsedQuads(N3, 'N-Quads', nquads());
    return async () => {
      const writer = new N3.StreamWriter({ format: 'N-Quads' });
      check(await drain(writer.import(Readable.from(quads))), 'nothing written');
    };
  },
};
