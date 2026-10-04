const { spawnSync } = require('child_process');
const path = require('path');

// Runs every W3C RDF 1.1 and RDF 1.2 syntax and evaluation suite through the parser
// and through a write round trip, the canonical N-Triples and N-Quads suites through the Writer,
// and the N3 suites through the parser. Extra arguments, such as `-m "url~path"`
// to read the RDF suites from a local checkout, are passed to every RDF run.
// The RDF 1.2 XML and semantics suites are out of scope: N3.js has no RDF/XML parser or entailment.
const RDF_TESTS = 'https://w3c.github.io/rdf-tests/rdf/';
const RDF_MANIFESTS = [
  'rdf11/rdf-n-triples', 'rdf11/rdf-n-quads', 'rdf11/rdf-turtle', 'rdf11/rdf-trig',
  'rdf12/rdf-n-triples/syntax', 'rdf12/rdf-n-quads/syntax',
  'rdf12/rdf-turtle/syntax', 'rdf12/rdf-turtle/eval',
  'rdf12/rdf-trig/syntax', 'rdf12/rdf-trig/eval',
].map(suite => `${RDF_TESTS}${suite}/manifest.ttl`);
const N3_TESTS = 'https://w3c-cg.github.io/N3/tests/';
const N3_MANIFESTS = ['manifest-parser', 'manifest-extended'].map(name => `${N3_TESTS}N3Tests/${name}.ttl`);
const RDF_TEST_SUITE = path.join(path.dirname(require.resolve('rdf-test-suite/package.json')), 'bin/Runner.js');

const extraArgs = process.argv.slice(2);
const runs = [];
for (const harness of ['spec/parser.js', 'spec/writer.js'])
  for (const manifest of RDF_MANIFESTS)
    runs.push([RDF_TEST_SUITE, harness, manifest, '-c', '.rdf-test-suite-cache/', ...extraArgs]);
runs.push(['spec/c14n.js', ...extraArgs]);
for (const manifest of N3_MANIFESTS)
  runs.push([RDF_TEST_SUITE, 'spec/parser.js', manifest, '-i', '{ "format": "text/n3" }',
    '-m', `${N3_TESTS}~.n3-tests/tests/`]);

const failures = [];
if (spawnSync('sh', ['scripts/fetch-n3-tests.sh'], { stdio: 'inherit' }).status !== 0)
  failures.push('fetching the N3 suites');
for (const args of runs) {
  const label = args.slice(args[0] === RDF_TEST_SUITE ? 1 : 0, 3).join(' ');
  console.log(`\n# ${label}`);
  if (spawnSync(process.execPath, args, { stdio: 'inherit' }).status !== 0)
    failures.push(label);
}
console.log(failures.length ? `\nFailed:\n${failures.join('\n')}` : '\nAll suites passed.');
process.exitCode = failures.length ? 1 : 0;
