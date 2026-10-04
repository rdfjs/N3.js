const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Parser, Writer } = require('..');

// Runs the RDF 1.2 canonical N-Triples and N-Quads suites, which rdf-test-suite does not support:
// each document is parsed and written again, and the output must equal the canonical form exactly.
// Accepts rdf-test-suite's `-m "url~path"` option to read the suites from a local checkout.
const MANIFESTS = {
  'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-triples/c14n/manifest.ttl': 'N-Triples',
  'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-quads/c14n/manifest.ttl': 'N-Quads',
};
// Known gaps, each to be removed by the fix that closes it, with the only failure they may show:
// the Writer does not yet produce canonical escapes or triple-term spacing (`output`),
// and the lexer rejects whitespace after `^^` (`syntax`). Any other failure still fails the run.
const KNOWN_FAILURES = new Map([
  ...[
    'literal_all_controls', 'literal_ascii_boundaries', 'literal_with_UTF8_boundaries',
    'literal_needing_uchar_escaping-01', 'literal_needing_uchar_escaping-02',
    'triple-term-01', 'triple-term-02', 'triple-term-03', 'triple-term-04',
  ].flatMap(id => [[`N-Triples#${id}`, 'output'], [`N-Quads#${id}`, 'output']]),
  ['N-Triples#extra_whitespace-04', 'syntax'], ['N-Quads#extra_whitespace-04', 'syntax'],
  ['N-Triples#literal_with_numeric_escape4', 'output'], ['N-Triples#literal_with_numeric_escape8', 'output'],
]);
// Fetched documents live in the CI fixture cache, which rotates with spec/cache-key.txt.
const CACHE = path.join('.rdf-test-suite-cache', 'c14n');
const MF = 'http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#';
const RDFT = 'http://www.w3.org/ns/rdftest#';

const mappingIndex = process.argv.indexOf('-m');
const [mappedUrl, mappedPath] = mappingIndex < 0 ? [] : process.argv[mappingIndex + 1].split('~');

async function load(url) {
  if (mappedUrl && url.startsWith(mappedUrl))
    return fs.readFileSync(mappedPath + url.slice(mappedUrl.length), 'utf8');
  const cached = path.join(CACHE, crypto.createHash('sha256').update(url).digest('hex'));
  if (fs.existsSync(cached))
    return fs.readFileSync(cached, 'utf8');
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Could not fetch ${url}: ${response.status}`);
  const text = await response.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, text);
  return text;
}

// Classifies a failure, so a known gap only hides the failure it is known for
function kindOf(error) {
  return error.kind || (error.context ? 'syntax' : 'other');
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
  let passed = 0, failed = 0, skipped = 0;
  for (const [manifestUrl, format] of Object.entries(MANIFESTS)) {
    const manifest = new Parser({ baseIRI: manifestUrl }).parse(await load(manifestUrl));
    const tests = manifest.filter(q => q.object.value === `${RDFT}Test${format.replace('-', '')}PositiveC14N`);
    for (const { subject } of tests) {
      const id = subject.value.slice(subject.value.indexOf('#') + 1), known = KNOWN_FAILURES.get(`${format}#${id}`);
      let error = null;
      try {
        // Blank node labels are kept, so the output can match the canonical labels
        const quads = new Parser({ format, blankNodePrefix: '' }).parse(await load(objectOf(manifest, subject, `${MF}action`)));
        const [actual, expected] = await Promise.all([write(quads, format), load(objectOf(manifest, subject, `${MF}result`))]);
        if (actual !== expected)
          error = Object.assign(new Error(`Expected:\n${expected}Actual:\n${actual}`), { kind: 'output' });
      }
      catch (parseError) {
        error = parseError;
      }
      if (known) {
        if (!error)
          error = new Error('Passes now, so remove it from KNOWN_FAILURES');
        else if (kindOf(error) === known)
          error = null;
        else
          error.message = `Known ${known} failure failed differently (${kindOf(error)}): ${error.message}`;
      }
      if (error) {
        failed++;
        console.log(`✖ ${id} (${subject.value})\n  ${error.message.replace(/\n/g, '\n  ')}`);
      }
      else if (known)
        skipped++;
      else
        passed++;
    }
  }
  console.log(`${failed ? '✖' : '✔'} ${passed} / ${passed + failed} tests succeeded! (${skipped} known failures skipped)`);
  process.exitCode = failed ? 1 : 0;
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
