#!/usr/bin/env node
var n3 = require('../n3');
var fs = require('fs');

if (process.argv.length !== 3)
  return console.error('Usage: n3parser-perf.js filename');

var filename = process.argv[2];

fs.readFile(filename, 'utf-8', function (err, data) {
  if (err)
    throw err;
  
  var TEST = '- Parsing file ' + filename;
  console.time(TEST);
  var store = new n3.Parser().parse(data);
  console.timeEnd(TEST);
  
  console.log('* Triples stored: ' + store.size);
});
