#!/usr/bin/env node
const assert = require('assert');
const N3 = require('..');

console.log('N3Store performance test');

const prefix = 'http://example.org/#';

/* Test triples */
const dim = Number.parseInt(process.argv[2], 10) || 22;
const dimSquared = dim * dim;
const dimCubed = dimSquared * dim;
const dimToTheFour = dimCubed * dim;
const dimToTheFive = dimToTheFour * dim;

const store = new N3.Store();
let TEST = `- Adding ${dimToTheFive} triples to the default graph`;
console.time(TEST);
let i, j, k, l, m;
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      for (l = 0; l < dim; l++)
        for (m = 0; m < dim; m++)
          store.addQuad(
            N3.DataFactory.quad(
              N3.DataFactory.namedNode(prefix + i),
              N3.DataFactory.namedNode(prefix + j),
              N3.DataFactory.namedNode(prefix + k)
            ),
            N3.DataFactory.namedNode(prefix + l),
            N3.DataFactory.namedNode(prefix + m)
          );
console.timeEnd(TEST);

console.log(`* Memory usage for triples: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

TEST = `- Finding all ${dimToTheFive} triples in the default graph ${dimSquared * 1} times (0 variables)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      for (l = 0; l < dim; l++)
        for (m = 0; m < dim; m++)
          assert.equal(store.getQuads(
            N3.DataFactory.quad(
              N3.DataFactory.namedNode(prefix + i),
              N3.DataFactory.namedNode(prefix + j),
              N3.DataFactory.namedNode(prefix + k)
            ),
            N3.DataFactory.namedNode(prefix + l),
            N3.DataFactory.namedNode(prefix + m)
          ).length, 1);
console.timeEnd(TEST);

TEST = `- Finding all ${dimCubed} triples in the default graph ${dimSquared * 2} times (1 variable subject)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.getQuads(null, N3.DataFactory.namedNode(prefix + i), N3.DataFactory.namedNode(prefix + j)).length, dimCubed);
console.timeEnd(TEST);

TEST = `- Finding all ${0} triples in the default graph ${dimSquared * 2} times (1 variable predicate)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.getQuads(N3.DataFactory.namedNode(prefix + i), null, N3.DataFactory.namedNode(prefix + j)).length, 0);
console.timeEnd(TEST);

TEST = `- Finding all ${dim} triples in the default graph ${dimSquared * 4} times (1 variable predicate)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      for (l = 0; l < dim; l++)
        assert.equal(store.getQuads(N3.DataFactory.quad(
          N3.DataFactory.namedNode(prefix + i),
          N3.DataFactory.namedNode(prefix + j),
          N3.DataFactory.namedNode(prefix + k)
        ), null, N3.DataFactory.namedNode(prefix + l)).length, dim);
console.timeEnd(TEST);

TEST = `- Finding all ${0} triples in the default graph ${dimSquared * 2} times (1 variable object)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    assert.equal(store.getQuads(N3.DataFactory.namedNode(prefix + i), N3.DataFactory.namedNode(prefix + j), null).length, 0);
console.timeEnd(TEST);

TEST = `- Finding all ${dim} triples in the default graph ${dimSquared * 4} times (1 variable objects)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      for (l = 0; l < dim; l++)
        assert.equal(store.getQuads(N3.DataFactory.quad(
          N3.DataFactory.namedNode(prefix + i),
          N3.DataFactory.namedNode(prefix + j),
          N3.DataFactory.namedNode(prefix + k)
        ), N3.DataFactory.namedNode(prefix + l), null).length, dim);
console.timeEnd(TEST);

TEST = `- Finding all ${dimSquared} triples in the default graph ${dimSquared * 1} times (2 variables)`;
console.time(TEST);
for (i = 0; i < dim; i++)
  for (j = 0; j < dim; j++)
    for (k = 0; k < dim; k++)
      assert.equal(store.getQuads(
        N3.DataFactory.quad(
          N3.DataFactory.namedNode(prefix + i),
          N3.DataFactory.namedNode(prefix + j),
          N3.DataFactory.namedNode(prefix + k)
        ),
        null,
        null
      ).length,
      dimSquared);
console.timeEnd(TEST);
