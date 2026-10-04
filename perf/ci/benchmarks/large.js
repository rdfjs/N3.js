// Large documents, ten times the size of the other benchmarks, and the
// memory that parsing, storing and writing them uses
const { Readable } = require('stream');
const data = require('../data');
const { lazy, check, chunksOf, bufferStream, drain } = require('../helpers');

const TRIPLES = 200000;
const ntriples = lazy(() => data.ntriples(TRIPLES));
// About 190,000 triples
const turtle = lazy(() => data.turtle(20000));

// A run of a large document takes up to a few seconds,
// so fewer runs are measured than for the other benchmarks
function large(setup) {
  return { warmup: 1, iterations: 3, setup };
}

function endWriter(error, result) {
  check(!error && result.length, 'nothing written');
}

function parsedQuads(N3) {
  return new N3.Parser({ format: 'N-Triples' }).parse(ntriples());
}

// A document streamed in as it is generated, so that the stream's input
// does not count towards the memory the parser uses
function generatedStream() {
  return Readable.from(data.ntriplesChunks(TRIPLES), { objectMode: false });
}

module.exports = {
  'large: parser N-Triples (200,000 triples)': large(N3 => {
    const input = ntriples();
    return () => check(new N3.Parser({ format: 'N-Triples' }).parse(input).length === TRIPLES, 'wrong count');
  }),
  'large: streamparser N-Triples (200,000 triples, 64 KB chunks)': large(N3 => {
    const chunks = chunksOf(ntriples(), 65536);
    return async () => {
      check(await drain(bufferStream(chunks).pipe(new N3.StreamParser({ format: 'N-Triples' }))) === TRIPLES,
        'wrong count');
    };
  }),
  'large: streamparser Turtle (190,000 triples, 64 KB chunks)': large(N3 => {
    const chunks = chunksOf(turtle(), 65536);
    return async () => {
      check(await drain(bufferStream(chunks).pipe(new N3.StreamParser({ format: 'Turtle' }))), 'nothing parsed');
    };
  }),
  'large: writer N-Triples (200,000 quads)': large(N3 => {
    const quads = parsedQuads(N3);
    return () => {
      const writer = new N3.Writer({ format: 'N-Triples' });
      writer.addQuads(quads);
      writer.end(endWriter);
    };
  }),
  'large: store load and match (200,000 quads)': large(N3 => {
    const quads = parsedQuads(N3), predicate = N3.DataFactory.namedNode(`${data.EX}p3`);
    return () => {
      const store = new N3.Store(quads);
      check(store.size > 0 && store.countQuads(null, predicate, null, null) > 0, 'nothing matched');
    };
  }),

  'memory: parser N-Triples, 200,000 triples (peak)': {
    memory: 'peak',
    setup: N3 => {
      const input = ntriples();
      return () => check(new N3.Parser({ format: 'N-Triples' }).parse(input).length === TRIPLES, 'wrong count');
    },
  },
  'memory: streamparser N-Triples, 200,000 triples (peak)': {
    memory: 'peak',
    setup: N3 => async () => {
      check(await drain(generatedStream().pipe(new N3.StreamParser({ format: 'N-Triples' }))) === TRIPLES,
        'wrong count');
    },
  },
  'memory: parsed quads, 200,000 triples (retained)': {
    memory: 'retained',
    setup: N3 => {
      const input = ntriples();
      return () => new N3.Parser({ format: 'N-Triples' }).parse(input);
    },
  },
  'memory: store with 200,000 quads (retained)': {
    memory: 'retained',
    setup: N3 => {
      const quads = parsedQuads(N3);
      return () => new N3.Store(quads);
    },
  },
  'memory: streamparser to streamwriter, 200,000 triples (peak)': {
    memory: 'peak',
    setup: N3 => async () => {
      const parser = new N3.StreamParser({ format: 'N-Triples' });
      const writer = new N3.StreamWriter({ format: 'N-Triples' });
      check(await drain(generatedStream().pipe(parser).pipe(writer)), 'nothing written');
    },
  },
};
