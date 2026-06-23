// Smoke test for the built CommonJS artifact (lib/).
// Plain CommonJS, kept Node 14 compatible (no top-level await, no ??=, simple syntax)
// so it can validate that the downleveled published artifact runs on every
// supported Node version. Only depends on the built lib + its runtime deps;
// jest never runs it (testMatch is **/test/*-test.js) and the flat eslint
// config only matches **/*.js, so .cjs is neither tested nor linted by them.
var N3 = require('..');

var subjectIRI = 'http://example.org/s';
var input = '<' + subjectIRI + '> <http://example.org/p> <http://example.org/o> .';

// 1. Parse a Turtle triple into a Store and assert it holds exactly one quad.
var parser = new N3.Parser();
var quads = parser.parse(input);
var store = new N3.Store(quads);
if (store.size !== 1) {
  throw new Error('Expected store.size === 1, got ' + store.size);
}

// 2. Round-trip a quad through the Writer and assert the output contains the subject IRI.
var quad = quads[0];
var writer = new N3.Writer();
var output = writer.quadToString(quad.subject, quad.predicate, quad.object, quad.graph);
if (output.indexOf(subjectIRI) === -1) {
  throw new Error('Expected Writer output to contain subject IRI ' + subjectIRI + ', got: ' + output);
}

console.log('smoke.cjs OK on Node ' + process.version);
process.exit(0);
