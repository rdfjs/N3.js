#!/usr/bin/env node
var N3 = require('../N3');
var fs = require('fs'),
    assert = require('assert');

if (process.argv.length !== 3)
  return console.error('Usage: N3Parser-perf.js filename');

var filename = process.argv[2];

var TEST = '- Parsing file ' + filename;
console.time(TEST);

var count = 0;
new N3.Parser().parse(fs.createReadStream(filename), function (error, triple) {
  assert(!error, error);
  if (triple) {
    count++;
  }
  else {
    console.timeEnd(TEST);
    console.log('* Triples parsed: ' + count);
    console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');
  }
});
