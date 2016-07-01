#!/usr/bin/env node
var N3 = require('../N3');
var assert = require('assert');

console.log('N3Store performance test');

var prefix = 'http://example.org/#';
var TEST, dim, dimSquared, dimCubed, dimQuads, store;

/* Test triples */
dim = parseInt(process.argv[2], 10) || 256;
dimSquared = dim * dim;
dimCubed = dimSquared * dim;

store = new N3.Store();
TEST = '- Adding ' + dimCubed + ' triples in the default graph';
console.time(TEST);
var i, j, k, l;
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      store.addTriple(prefix + i, prefix + j, prefix + k);
console.timeEnd(TEST);

console.log('* Memory usage for triples: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');

TEST = '- Finding all ' + dimCubed + ' triples to the default graph ' + dimSquared * 1 + ' times (0 variables)';
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      assert.equal(store.find(prefix + i, prefix + j, prefix + k).length, 1);
console.timeEnd(TEST);

TEST = '- Finding all ' + dimCubed + ' triples to the default graph ' + dimSquared * 2 + ' times (1 variable)';
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.find(prefix + i, prefix + j, null).length, dim);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.find(prefix + i, null, prefix + j).length, dim);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.find(null, prefix + i, prefix + j).length, dim);
console.timeEnd(TEST);

TEST = '- Finding all ' + dimCubed + ' triples to the default graph ' + dimSquared * 3 + ' times (2 variables)';
console.time(TEST);
for (i = 0; i < dim; i++)
  assert.equal(store.find(prefix + i, null, null).length, dimSquared);
for (j = 0; j < dim; j++)
  assert.equal(store.find(null, prefix + j, null).length, dimSquared);
for (k = 0; k < dim; k++)
  assert.equal(store.find(null, null, prefix + k).length, dimSquared);
console.timeEnd(TEST);

console.log();

/* Test quads */
dim /= 4,
dimSquared = dim * dim;
dimCubed = dimSquared * dim;
dimQuads = dimCubed * dim;

store = new N3.Store();
TEST = '- Adding ' + dimQuads + ' quads';
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      for (l = 0; l < dim; l++)
        store.addTriple(prefix + i, prefix + j, prefix + k, prefix + l);
console.timeEnd(TEST);

console.log('* Memory usage for quads: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');

TEST = '- Finding all ' + dimQuads + ' quads ' + dimCubed * 4 + ' times';
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
