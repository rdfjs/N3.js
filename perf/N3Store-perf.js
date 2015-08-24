#!/usr/bin/env node
var N3 = require('../N3');
var assert = require('assert');

console.log('N3Store performance test');

var TEST;
var dim = parseInt(process.argv[2], 10) || 256;
var dimSquared = dim * dim;
var dimCubed = dimSquared * dim;
var prefix = 'http://example.org/#';

var store = new N3.Store();

TEST = '- Adding ' + dimCubed + ' triples';
console.time(TEST);
var i, j, k;
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      store.addTriple(prefix + i, prefix + j, prefix + k);
console.timeEnd(TEST);

console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');

TEST = '- Finding all ' + dimCubed + ' triples ' + dimSquared * 3 + ' times';
console.time(TEST);
for (i = 0; i < dim; i++)
  assert.equal(store.find(prefix + i, null, null).length, dimSquared);
for (j = 0; j < dim; j++)
  assert.equal(store.find(null, prefix + j, null).length, dimSquared);
for (k = 0; k < dim; k++)
  assert.equal(store.find(null, null, prefix + k).length, dimSquared);
console.timeEnd(TEST);
