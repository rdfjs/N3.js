#!/usr/bin/env node
const N3 = require('..');
const fs = require('fs'),
    assert = require('assert');

if (process.argv.length !== 3) {
  console.error('Usage: N3Lexer-perf.js filename');
  process.exit(1);
}

const filename = process.argv[2];

const TEST = '- Lexing file ' + filename;
console.time(TEST);

let count = 0;
new N3.Lexer().tokenize(fs.createReadStream(filename), (error, token) => {
  assert(!error, error);
  count++;
  if (token.type === 'eof') {
    console.timeEnd(TEST);
    console.log('* Tokens lexed: ' + count);
    console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');
  }
});
