const fs = require('fs');
const { Util } = require('rdf-test-suite');
const { Parser, Writer } = require('..');

// Runs the RDF 1.2 canonical N-Triples and N-Quads suites, which rdf-test-suite does not support:
// each document is parsed and written again, and the output must equal the canonical form exactly.
// Accepts rdf-test-suite's `-m "url~path"` option to read the suites from a local checkout.
const MANIFESTS = {
  'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-triples/c14n/manifest.ttl': 'N-Triples',
  'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-quads/c14n/manifest.ttl': 'N-Quads',
};
const MF = 'http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#';
const RDFT = 'http://www.w3.org/ns/rdftest#';

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

async function run() {
  fs.mkdirSync(FETCH_OPTIONS.cachePath, { recursive: true });
  let passed = 0, failed = 0;
  for (const [manifestUrl, format] of Object.entries(MANIFESTS)) {
    const manifest = new Parser({ baseIRI: manifestUrl }).parse(await load(manifestUrl));
    const tests = manifest.filter(q => q.object.value === `${RDFT}Test${format.replace('-', '')}PositiveC14N`);
    for (const { subject } of tests) {
      const id = subject.value.slice(subject.value.indexOf('#') + 1);
      let error = null;
      try {
        // Blank node labels are kept, so the output can match the canonical labels
        const quads = new Parser({ format, blankNodePrefix: '' }).parse(await load(objectOf(manifest, subject, `${MF}action`)));
        const [actual, expected] = await Promise.all([write(quads, format), load(objectOf(manifest, subject, `${MF}result`))]);
        if (actual !== expected)
          error = new Error(`Expected:\n${expected}Actual:\n${actual}`);
      }
      catch (parseError) {
        error = parseError;
      }
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
