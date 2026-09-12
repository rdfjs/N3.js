#!/usr/bin/env node
// Run each checkout in a fresh process, alternating their order between rounds:
// node --expose-gc perf/N3LexerUnescape-perf.js /path/to/built/checkout unicode8 parser
const assert = require('assert'),
    crypto = require('crypto'),
    path = require('path'),
    { EventEmitter } = require('events'),
    { performance } = require('perf_hooks');

const [directory, fixture, mode] = process.argv.slice(2);
const fixtures = ['fixed', 'unicode4', 'unicode8', 'iri', 'local', 'denseEscapes',
  'sparseLong', 'plainPrefixed', 'plainMultiline', 'dense'];
if (!directory || !fixtures.includes(fixture) || !['lexer', 'parser', 'stream'].includes(mode)) {
  console.error(`Usage: N3LexerUnescape-perf.js built-checkout [${fixtures.join('|')}] [lexer|parser|stream]`);
  process.exit(1);
}
// The same benchmark loads either checkout's production build.
// eslint-disable-next-line import-x/no-dynamic-require
const { Lexer, Parser } = require(path.resolve(directory));

const size = fixture === 'sparseLong' ? 256 : fixture === 'denseEscapes' ? 1000 : 8000;
const prefix = fixture === 'local' || fixture === 'plainPrefixed' ? '@prefix ex: <http://example.org/>.\n' : '';
const input = prefix + Array.from({ length: size }, (_, i) => {
  const subject = `<http://example.org/s${i}>`, predicate = '<http://example.org/p>';
  let raw;
  switch (fixture) {
  case 'fixed': raw = String.raw`a\tb\nc\r\f\b\\\"tail`; break;
  case 'unicode4': raw = String.raw`a\u0041\u00e9\uFfFD\u03B2tail`; break;
  case 'unicode8': raw = String.raw`a\U00000041\U0001f600\U0010FFFFtail`; break;
  case 'denseEscapes': raw = String.raw`\n\t\r\u0061\U0001F600`.repeat(32); break;
  case 'sparseLong': raw = `${'x'.repeat(4096)}\\u0061${'y'.repeat(4096)}`; break;
  case 'iri': return `<http://example.org/\\u0073${i}> <http://example.org/\\U00000070> <http://example.org/\\U0001f600>.\n`;
  case 'local': return `ex:item\\~\\-${i} ex:p ex:v\\#\\%${i}.\n`;
  case 'plainPrefixed': return `ex:s${i} ex:p ex:o${i}.\n`;
  case 'plainMultiline': return `${subject} ${predicate} """first\n${'x'.repeat(100)}\nlast""".\n`;
  case 'dense': return `${subject}${predicate}<http://example.org/o${i}>.\n`;
  }
  return `${subject} ${predicate} "${raw} ${i}".\n`;
}).join('');
const chunks = [];
for (let i = 0; i < input.length; i += 65536)
  chunks.push(input.slice(i, i + 65536));
const parserOptions = { format: fixture === 'dense' ? 'N-Triples' : 'Turtle' };
const lexerOptions = { lineMode: fixture === 'dense' };
let consumed = 0;

function run(collect) {
  if (mode !== 'stream') {
    const result = mode === 'lexer' ? new Lexer(lexerOptions).tokenize(input) : new Parser(parserOptions).parse(input);
    consumed += result.length;
    return collect ? result : undefined;
  }
  const source = new EventEmitter(), result = collect ? [] : undefined;
  new Parser(parserOptions).parse(source, (error, quad) => {
    if (error)
      throw error;
    if (quad) {
      consumed++;
      if (collect)
        result.push(quad);
    }
  });
  for (const chunk of chunks)
    source.emit('data', chunk);
  source.emit('end');
  return result;
}

// Validate and hash outside the timed loop; do not retain the result array.
function validate() {
  const result = run(true);
  if (mode !== 'lexer')
    assert.strictEqual(result.length, size);
  return { count: result.length, digest: crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex') };
}
const validation = validate();
let start = performance.now(), warm = 0;
while (warm < 8 || performance.now() - start < 350) {
  run(false);
  warm++;
}
if (typeof global.gc === 'function')
  global.gc();
const cpuStart = process.cpuUsage();
start = performance.now();
let iterations = 0;
while (iterations < 16 || performance.now() - start < 600) {
  run(false);
  iterations++;
}
const wall = performance.now() - start, cpu = process.cpuUsage(cpuStart);
console.log(JSON.stringify({
  node: process.version, fixture, mode, bytes: Buffer.byteLength(input), ...validation,
  warm, iterations, consumed, wallMs: wall / iterations, cpuMs: (cpu.user + cpu.system) / 1000 / iterations,
}));
