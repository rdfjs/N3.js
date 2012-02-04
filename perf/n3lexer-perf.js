#!/usr/bin/env node
var n3 = require('../n3');
var fs = require('fs');

if (process.argv.length !== 3)
  return console.error('Usage: n3lexer-perf.js filename');

var filename = process.argv[2];

fs.readFile(filename, 'utf-8', function (err, data) {
  if (err)
    throw err;
  
  var TEST = '- Lexing file ' + filename;
  console.time(TEST);
  var lexer = new n3.Lexer().tokenize(data),
      count = 0;
  while (lexer.next())
    count++;
  console.timeEnd(TEST);
  
  console.log('* Tokens lexed: ' + count);
});
