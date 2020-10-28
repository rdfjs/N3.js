#!/usr/bin/env node
const N3 = require('..');
const fs = require('fs'),
    path = require('path'),
    assert = require('assert');

if (process.argv.length !== 3) {
  console.error('Usage: N3Parser-perf.js filename');
  process.exit(1);
}

const filename = path.resolve(process.cwd(), process.argv[2]),
    base = `file://${filename}`;

const TEST = `- Parsing file ${filename}`;
console.time(TEST);

let count = 0;
new N3.Parser({ baseIRI: base }).parse(fs.createReadStream(filename), (error, quad) => {
  assert(!error, error);
  if (quad)
    count++;
  else {
    console.timeEnd(TEST);
    console.log(`* Quads parsed: ${count}`);
    console.log(`* Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  }
});
