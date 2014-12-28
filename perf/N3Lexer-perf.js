#!/usr/bin/env node
var N3 = require('../N3');
var fs = require('fs'),
    assert = require('assert');

if (process.argv.length !== 3)
  return console.error('Usage: N3Lexer-perf.js filename');

var filename = process.argv[2];

var TEST = '- Lexing file ' + filename;
console.time(TEST);

var count = 0;
new N3.Lexer().tokenize(fs.createReadStream(filename), function (error, token) {
  assert(!error, error);
  count++;
  if (token.type === 'eof') {
    console.timeEnd(TEST);
    console.log('* Tokens lexed: ' + count);
    console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');
  }
});
