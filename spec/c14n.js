const fs = require('fs');
const crypto = require('crypto');
const { Util } = require('rdf-test-suite');
const { Parser, Store, Writer } = require('..');

// Runs the RDF 1.2 canonical N-Triples and N-Quads suites and the RDF Dataset Canonicalization suite,
// which rdf-test-suite does not support: each document is parsed and written again, or canonicalized,
// and the output must equal the canonical form exactly.
// Accepts rdf-test-suite's `-m "url~path"` option to read the suites from a local checkout.
const MANIFESTS = {
  'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-triples/c14n/manifest.ttl': 'N-Triples',
  'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-quads/c14n/manifest.ttl': 'N-Quads',
  'https://w3c.github.io/rdf-canon/tests/manifest.ttl': 'RDFC-1.0',
};
const MF = 'http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#';
const RDFT = 'http://www.w3.org/ns/rdftest#';
const RDFC = 'https://w3c.github.io/rdf-canon/tests/vocab#';

// Documents are read through rdf-test-suite's own cached fetch, so they share the fixture cache
// of the other suites, which rotates with spec/cache-key.txt.
const mappingIndex = process.argv.indexOf('-m');
const [mappedUrl, mappedPath] = mappingIndex < 0 ? [] : process.argv[mappingIndex + 1].split('~');
const FETCH_OPTIONS = {
  cachePath: '.rdf-test-suite-cache/',
  urlToFileMappings: mappedUrl ? [{ url: mappedUrl, path: mappedPath }] : [],
};

async function load(url) {
  const { body } = await Util.fetchCached(url, FETCH_OPTIONS);
  // Decode as one stream, so characters split across chunks stay intact
  body.setEncoding('utf8');
  let text = '';
  for await (const chunk of body)
    text += chunk;
  return text;
}

function objectOf(manifest, subject, predicate) {
  return manifest.find(q => q.subject.equals(subject) && q.predicate.value === predicate).object.value;
}

function write(quads, format) {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ format });
    writer.addQuads(quads);
    writer.end((error, result) => error ? reject(error) : resolve(result));
  });
}

// Writes the document again in its canonical form
async function canonicalForm(document, format, hashAlgorithm) {
  if (format === 'RDFC-1.0') {
    // Other hash algorithms than the built-in SHA-256 come from Node's crypto module
    const hash = hashAlgorithm && (string => crypto.createHash(hashAlgorithm.replace('-', '')).update(string).digest('hex'));
    // The suite's computable poison graphs need more work than the default allows
    return new Store(new Parser({ format: 'N-Quads' }).parse(document)).toCanonical({ hashAlgorithm, hash, maxWorkFactor: 3 });
  }
  // Blank node labels are kept, so the output can match the canonical labels
  return write(new Parser({ format, blankNodePrefix: '' }).parse(document), format);
}

// Returns the error of the test, or false if it passes
async function runTest(manifest, subject, format, negative) {
  try {
    const algorithm = manifest.find(q => q.subject.equals(subject) && q.predicate.value === `${RDFC}hashAlgorithm`);
    const actual = await canonicalForm(await load(objectOf(manifest, subject, `${MF}action`)), format,
      algorithm && algorithm.object.value);
    const expected = negative ? null : await load(objectOf(manifest, subject, `${MF}result`));
    if (actual !== expected)
      return new Error(negative ? 'Expected an error' : `Expected:\n${expected}Actual:\n${actual}`);
  }
  catch (error) {
    if (!negative)
      return error;
  }
  return false;
}

async function run() {
  fs.mkdirSync(FETCH_OPTIONS.cachePath, { recursive: true });
  let passed = 0, failed = 0;
  for (const [manifestUrl, format] of Object.entries(MANIFESTS)) {
    const manifest = new Parser({ baseIRI: manifestUrl }).parse(await load(manifestUrl));
    const types = format === 'RDFC-1.0' ? [`${RDFC}RDFC10EvalTest`, `${RDFC}RDFC10NegativeEvalTest`] :
      [`${RDFT}Test${format.replace('-', '')}PositiveC14N`];
    for (const { subject, object } of manifest.filter(q => types.includes(q.object.value))) {
      const id = subject.value.slice(subject.value.indexOf('#') + 1);
      const negative = object.value === types[1];
      const error = await runTest(manifest, subject, format, negative);
      if (error) {
        failed++;
        console.log(`✖ ${id} (${subject.value})\n  ${error.message.replace(/\n/g, '\n  ')}`);
      }
      else
        passed++;
    }
  }
  console.log(`${failed ? '✖' : '✔'} ${passed} / ${passed + failed} tests succeeded!`);
  process.exitCode = failed ? 1 : 0;
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
