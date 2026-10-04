// Shared helpers for the CI benchmarks in perf/ci/benchmarks
const { Readable } = require('stream');
const { EX } = require('./data');

// Wraps the generation of benchmark input so that it only runs in the
// processes that measure a benchmark using it
function lazy(create) {
  let value;
  return () => value === undefined ? (value = create()) : value;
}

// Throws when a benchmark did no work, so a broken build can't look fast
function check(condition, message) {
  if (!condition) throw new Error(message);
}

// Generated quads spread over 1000 subjects, 20 predicates and 4 graphs
function storeOf(N3, size, offset = 0) {
  const { namedNode, literal, quad } = N3.DataFactory;
  const quads = [];
  for (let i = offset; i < offset + size; i++) {
    quads.push(quad(
      namedNode(`${EX}s${i % 1000}`),
      namedNode(`${EX}p${i % 20}`),
      i % 3 ? namedNode(`${EX}o${i}`) : literal(`v${i}`),
      namedNode(`${EX}g${i % 4}`),
    ));
  }
  return quads;
}

// Splits text into Buffer chunks, as a file stream would deliver it
function chunksOf(text, size) {
  const buffer = Buffer.from(text), chunks = [];
  for (let i = 0; i < buffer.length; i += size)
    chunks.push(buffer.subarray(i, i + size));
  return chunks;
}

function bufferStream(chunks) {
  return Readable.from(chunks, { objectMode: false });
}

// Resolves when a readable stream has ended, counting its data events
function drain(stream) {
  return new Promise((resolve, reject) => {
    let count = 0;
    stream.on('data', () => { count++; });
    stream.on('error', reject);
    stream.on('end', () => resolve(count));
  });
}

function quadKey({ subject, predicate, object, graph }) {
  return `${termKey(subject)} ${termKey(predicate)} ${termKey(object)} ${termKey(graph)}`;
}

function termKey(term) {
  switch (term.termType) {
  case 'Literal':
    return `"${term.value}"@${term.language}^^${term.datatype.value}`;
  case 'Quad':
    return `<<${quadKey(term)}>>`;
  default:
    return `${term.termType[0]}${term.value}`;
  }
}

// A minimal RDF/JS Dataset that is not an N3.Store, for the code paths that
// handle other dataset implementations
class OtherDataset {
  constructor(quads = []) {
    this._quads = new Map();
    for (const quad of quads) this.add(quad);
  }

  get size() { return this._quads.size; }

  add(quad) { this._quads.set(quadKey(quad), quad); return this; }

  delete(quad) { this._quads.delete(quadKey(quad)); return this; }

  has(quad) { return this._quads.has(quadKey(quad)); }

  match(subject, predicate, object, graph) {
    const matches = new OtherDataset();
    for (const quad of this)
      if ((!subject || subject.equals(quad.subject)) && (!predicate || predicate.equals(quad.predicate)) &&
          (!object || object.equals(quad.object)) && (!graph || graph.equals(quad.graph)))
        matches.add(quad);
    return matches;
  }

  every(iteratee) {
    for (const quad of this)
      if (!iteratee(quad, this)) return false;
    return true;
  }

  some(iteratee) {
    for (const quad of this)
      if (iteratee(quad, this)) return true;
    return false;
  }

  forEach(callback) {
    for (const quad of this) callback(quad, this);
  }

  toArray() { return [...this]; }

  [Symbol.iterator]() { return this._quads.values(); }
}

module.exports = { lazy, check, storeOf, chunksOf, bufferStream, drain, OtherDataset };
