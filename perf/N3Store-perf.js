#!/usr/bin/env node
const N3 = require('..');
const assert = require('assert');

console.log('N3Store performance test');

const prefix = 'http://example.org/#';

/* Test triples */
let dim = Number.parseInt(process.argv[2], 10) || 256;
let dimSquared = dim * dim;
let dimCubed = dimSquared * dim;

let store = new N3.Store();
let TEST = `- Adding ${dimCubed} triples to the default graph`;
console.time(TEST);
let i, j, k, l;
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      store.addQuad(prefix + i, prefix + j, prefix + k);
console.timeEnd(TEST);

console.log(`* Memory usage for triples: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

TEST = `- Finding all ${dimCubed} triples in the default graph ${dimSquared * 1} times (0 variables)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      assert.equal(store.getQuads(prefix + i, prefix + j, prefix + k, '').length, 1);
console.timeEnd(TEST);

TEST = `- Finding all ${dimCubed} triples in the default graph ${dimSquared * 2} times (1 variable)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.getQuads(prefix + i, prefix + j, null, '').length, dim);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.getQuads(prefix + i, null, prefix + j, '').length, dim);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.getQuads(null, prefix + i, prefix + j, '').length, dim);
console.timeEnd(TEST);

TEST = `- Finding all ${dimCubed} triples in the default graph ${dimSquared * 3} times (2 variables)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  assert.equal(store.getQuads(prefix + i, null, null, '').length, dimSquared);
for (j = 0; j < dim; j++)
  assert.equal(store.getQuads(null, prefix + j, null, '').length, dimSquared);
for (k = 0; k < dim; k++)
  assert.equal(store.getQuads(null, null, prefix + k, '').length, dimSquared);
console.timeEnd(TEST);

console.log();

/* Test quads */
dim /= 4;
dimSquared = dim * dim;
dimCubed = dimSquared * dim;
const dimQuads = dimCubed * dim;

store = new N3.Store();
TEST = `- Adding ${dimQuads} quads`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      for (l = 0; l < dim; l++)
        store.addQuad(prefix + i, prefix + j, prefix + k, prefix + l);
console.timeEnd(TEST);

console.log(`* Memory usage for quads: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

TEST = `- Finding all ${dimQuads} quads ${dimCubed * 4} times`;
console.time(TEST);
for (i = 0; i < dim; i++)
  assert.equal(store.getQuads(prefix + i, null, null, null).length, dimCubed);
for (j = 0; j < dim; j++)
  assert.equal(store.getQuads(null, prefix + j, null, null).length, dimCubed);
for (k = 0; k < dim; k++)
  assert.equal(store.getQuads(null, null, prefix + k, null).length, dimCubed);
for (l = 0; l < dim; l++)
  assert.equal(store.getQuads(null, null, null, prefix + l).length, dimCubed);
console.timeEnd(TEST);

console.log('N3 Store tests for sparsely connected entities');

store = new N3.Store();
TEST = `- Adding ${dimQuads} with all different IRIs`;
console.time(TEST);
for (let i = 0; i < dimQuads; i++) {
  store.addQuad(
    prefix + i,
    prefix + i,
    prefix + i
  );
}
console.timeEnd(TEST);


TEST = `* Retrieving all ${dimQuads} quads`;
console.time(TEST);
for (const quad of store.match(undefined, undefined, undefined)) {
  assert(quad);
}
console.timeEnd(TEST);

TEST = '* Retrieving single by subject';
console.time(TEST);
for (const quad of store.match(prefix + 1, undefined, undefined)) {
  assert(quad);
}
console.timeEnd(TEST);


TEST = '* Retrieving single by predicate';
console.time(TEST);
for (const quad of store.match(undefined, prefix + 1, undefined)) {
  assert(quad);
}
console.timeEnd(TEST);

TEST = '* Retrieving single by object';
console.time(TEST);
for (const quad of store.match(undefined, undefined, prefix + 1)) {
  assert(quad);
}
console.timeEnd(TEST);


TEST = '* Retrieving single by subject-predicate';
console.time(TEST);
for (const quad of store.match(prefix + 1, prefix + 1, undefined)) {
  assert(quad);
}
console.timeEnd(TEST);


TEST = '* Retrieving single by subject-object';
console.time(TEST);
for (const quad of store.match(prefix + 1, undefined, prefix + 1)) {
  assert(quad);
}
console.timeEnd(TEST);

TEST = '* Retrieving single by predicate-object';
console.time(TEST);
for (const quad of store.match(undefined, prefix + 1, prefix + 1)) {
  assert(quad);
}
console.timeEnd(TEST);


TEST = '* Retrieving single by subject-predicate-object';
console.time(TEST);
for (const quad of store.match(prefix + 1, prefix + 1, prefix + 1)) {
  assert(quad);
}
console.timeEnd(TEST);
