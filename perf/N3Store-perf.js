#!/usr/bin/env node
var N3 = require('../N3');
var assert = require('assert');

console.log('N3Store performance test');

var TEST;
var dim = parseInt(process.argv[2], 10) || 75; // Consumes about 1GB for the quad case
var dimSquared = dim * dim;
var dimCubed = dimSquared * dim;
var dimTesseracted = dimCubed * dim;
var prefix = 'http://example.org/#';

/* Test triples in default graph */
var store = new N3.Store();
TEST = '- Adding ' + dimCubed + ' triples in the default graph';
console.time(TEST);
var i, j, k, l;
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      store.addTriple(prefix + i, prefix + j, prefix + k);
console.timeEnd(TEST);

console.log('* Memory usage for triples: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');

TEST = '- Finding all ' + dimCubed + ' triples in the default graph ' + dimSquared * 3 + ' times';
console.time(TEST);
for (i = 0; i < dim; i++)
  assert.equal(store.find(prefix + i, null, null).length, dimSquared);
for (j = 0; j < dim; j++)
  assert.equal(store.find(null, prefix + j, null).length, dimSquared);
for (k = 0; k < dim; k++)
  assert.equal(store.find(null, null, prefix + k).length, dimSquared);
console.timeEnd(TEST);

console.log('');

/* Test quads */
store = new N3.Store();
TEST = '- Adding ' + dimTesseracted + ' quads';
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      for (l = 0; l < dim; l++)
        store.addTriple(prefix + i, prefix + j, prefix + k, prefix + l);
console.timeEnd(TEST);

console.log('* Memory usage for quads: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');

TEST = '- Finding all ' + dimTesseracted + ' quads ' + dimCubed * 4 + ' times';
console.time(TEST);
for (i = 0; i < dim; i++)
  assert.equal(store.find(prefix + i, null, null, null).length, dimCubed);
for (j = 0; j < dim; j++)
  assert.equal(store.find(null, prefix + j, null, null).length, dimCubed);
for (k = 0; k < dim; k++)
  assert.equal(store.find(null, null, prefix + k, null).length, dimCubed);
for (l = 0; l < dim; l++)
  assert.equal(store.find(null, null, null, prefix + l).length, dimCubed);
console.timeEnd(TEST);
