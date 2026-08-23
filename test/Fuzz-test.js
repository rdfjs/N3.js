// Deterministic fuzz / round-trip property tests.
//
// These assert library-wide invariants rather than specific outputs:
//  1. Parsing ARBITRARY input never crashes uncatchably — it either returns
//     structurally well-formed quads or throws a catchable Error.
//  2. Valid quads round-trip: parse(write(quads)) is isomorphic to the input,
//     including adversarial literal values exercising the writer's escaping.
//
// A seeded PRNG keeps runs reproducible (no flaky CI). Each iteration is
// reduced to a boolean by a helper so assertions stay unconditional.
import { makeRng, pick } from './util';
import { Parser, Writer, Store, DataFactory } from '../src';
import { isomorphic } from 'rdf-isomorphic';

const { namedNode, blankNode, literal, quad, defaultGraph } = DataFactory;

// Characters that historically broke lexers and writers (delimiters, quotes,
// escapes, controls, astral). Used raw in fuzzed documents and literal values.
const LITERAL_CHARS = [
  'a', 'Z', '0', '-', '_', '.', ' ', ':', '/', '#', '?', '@', '%',
  '<', '>', '{', '}', '|', '^', '`', '"', "'", '\\', '\n', '\t', '\r',
  ' ', '', 'é', '中', '🂡', ';', ',', '(', ')', '[', ']',
];
// Characters legal inside an IRIREF (no space, angle brackets, quotes,
// braces, pipe, caret, backtick, backslash or controls).
const IRI_CHARS = [
  'a', 'Z', '0', '-', '_', '.', ':', '/', '#', '?', '@', '%', '~',
  '!', '$', '&', "'", '(', ')', '*', '+', ',', ';', '=', 'é', '中', '🂡',
];
function randString(rng, chars, maxLen) {
  let s = '';
  const n = Math.floor(rng() * maxLen);
  for (let i = 0; i < n; i++) s += pick(rng, chars);
  return s;
}

function randTerm(rng) {
  const r = rng();
  if (r < 0.35) return namedNode(`http://example.org/${randString(rng, IRI_CHARS, 8)}`);
  if (r < 0.5) return blankNode(`b${Math.floor(rng() * 1000)}`);
  if (r < 0.75) return literal(randString(rng, LITERAL_CHARS, 12));
  if (r < 0.85) return literal(randString(rng, LITERAL_CHARS, 6), pick(rng, ['en', 'en-gb', 'fr', 'de-at']));
  return literal(randString(rng, LITERAL_CHARS, 6), namedNode(`http://example.org/dt${Math.floor(rng() * 5)}`));
}

function simpleTerm(rng) {
  return rng() < 0.5 ?
    namedNode(`http://example.org/n${Math.floor(rng() * 6)}`) : literal(`v${Math.floor(rng() * 6)}`);
}

// Structural invariant: every term a parse yields is one of the RDF/JS term
// types with a string value (and literals carry a NamedNode datatype).
function termIsWellFormed(term) {
  switch (term.termType) {
  case 'NamedNode':
  case 'BlankNode':
  case 'Variable':
    return typeof term.value === 'string';
  case 'Literal':
    return typeof term.value === 'string' && term.datatype.termType === 'NamedNode';
  case 'DefaultGraph':
    return term.value === '';
  case 'Quad':
    return quadIsWellFormed(term);
  default:
    return false;
  }
}
function quadIsWellFormed(q) {
  return termIsWellFormed(q.subject) && termIsWellFormed(q.predicate) &&
    termIsWellFormed(q.object) && termIsWellFormed(q.graph);
}

// True iff parsing `input` is "safe": returns well-formed quads, or throws an Error.
function parseIsSafe(input, options) {
  let quads;
  try {
    quads = new Parser(options).parse(input);
  }
  catch (error) {
    return error instanceof Error;
  }
  try {
    return quads.every(quadIsWellFormed);
  }
  catch {
    return false;
  }
}

// True iff `quads` round-trip through write -> parse isomorphically.
function roundTrips(quads) {
  try {
    const serialized = new Writer().quadsToString(quads);
    return isomorphic(new Parser().parse(serialized), quads);
  }
  catch {
    return false;
  }
}

describe('Fuzz / property tests', () => {
  it('parsing arbitrary input never crashes uncatchably (1000 Turtle + 500 N3 cases)', () => {
    const rng = makeRng(0xC0FFEE);
    let unsafe = 0;
    for (let i = 0; i < 1000; i++)
      unsafe += parseIsSafe(randString(rng, LITERAL_CHARS, 200)) ? 0 : 1;
    for (let i = 0; i < 500; i++)
      unsafe += parseIsSafe(randString(rng, LITERAL_CHARS, 120), { format: 'text/n3' }) ? 0 : 1;
    expect(unsafe).toBe(0);
  });

  it('valid flat quads (with adversarial literal values) round-trip isomorphically (300 graphs)', () => {
    // Flat graphs only: this exercises the writer's literal / language-tag
    // escaping on adversarial values. (Quoted triples are covered separately
    // below — the rdf-isomorphic comparator itself cannot stringify a quoted
    // triple whose literal contains '>', so it is unsuitable here.)
    const rng = makeRng(0x5EED);
    let failures = 0;
    for (let i = 0; i < 300; i++) {
      const store = new Store();
      const count = 1 + Math.floor(rng() * 8);
      for (let j = 0; j < count; j++) {
        const subject = rng() < 0.3 ? blankNode(`s${j}`) : namedNode(`http://example.org/s${Math.floor(rng() * 5)}`);
        const predicate = namedNode(`http://example.org/p${Math.floor(rng() * 4)}`);
        store.addQuad(quad(subject, predicate, randTerm(rng), defaultGraph()));
      }
      failures += roundTrips([...store]) ? 0 : 1;
    }
    expect(failures).toBe(0);
  });

  it('quoted-triple graphs round-trip isomorphically (150 graphs, simple values)', () => {
    // Simple (escaping-free) terms so the rdf-isomorphic comparator can stringify
    // the quoted triples; this checks the nested write -> parse structure itself.
    const rng = makeRng(0xB0BA);
    let failures = 0;
    for (let i = 0; i < 150; i++) {
      const store = new Store();
      const count = 1 + Math.floor(rng() * 5);
      for (let j = 0; j < count; j++) {
        const object = rng() < 0.5 ?
          // A quoted triple's subject must be an IRI/blank node (not a literal).
          quad(namedNode(`http://example.org/n${Math.floor(rng() * 6)}`),
            namedNode(`http://example.org/p${Math.floor(rng() * 3)}`), simpleTerm(rng)) :
          simpleTerm(rng);
        store.addQuad(quad(namedNode(`http://example.org/s${Math.floor(rng() * 4)}`),
          namedNode(`http://example.org/p${Math.floor(rng() * 3)}`), object, defaultGraph()));
      }
      failures += roundTrips([...store]) ? 0 : 1;
    }
    expect(failures).toBe(0);
  });
});
