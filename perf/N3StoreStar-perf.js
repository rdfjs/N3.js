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
              N3.DataFactory.namedNode(prefix + k),
            ),
            N3.DataFactory.namedNode(prefix + l),
            N3.DataFactory.namedNode(prefix + m),
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
              N3.DataFactory.namedNode(prefix + k),
            ),
            N3.DataFactory.namedNode(prefix + l),
            N3.DataFactory.namedNode(prefix + m),
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
          N3.DataFactory.namedNode(prefix + k),
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
          N3.DataFactory.namedNode(prefix + k),
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
          N3.DataFactory.namedNode(prefix + k),
        ),
        null,
        null,
      ).length,
      dimSquared);
console.timeEnd(TEST);

// ## Matching patterns inside triple terms (issue #633)
// Workload: `ex:r{i} ex:reifies <<( ex:s{i%K} ex:p{i%16} ex:o{i} )>>`,
// with K = N/100 (100 quads per inner subject)
const { namedNode, variable, quad } = N3.DataFactory;
const N = Number.parseInt(process.argv[3], 10) || 100000;
const K = Math.max(N / 100, 1);
const reifies = namedNode(`${prefix}reifies`);

const starStore = new N3.Store();
TEST = `- Adding ${N} quads with triple terms`;
console.time(TEST);
for (i = 0; i < N; i++)
  starStore.addQuad(
    namedNode(`${prefix}r${i}`),
    reifies,
    quad(namedNode(`${prefix}s${i % K}`), namedNode(`${prefix}p${i % 16}`), namedNode(`${prefix}o${i}`)));
console.timeEnd(TEST);

const plainStore = new N3.Store();
TEST = `- Adding ${N} plain control quads`;
console.time(TEST);
for (i = 0; i < N; i++)
  plainStore.addQuad(
    namedNode(`${prefix}s${i}`),
    namedNode(`${prefix}p${i % 16}`),
    namedNode(`${prefix}o${i}`));
console.timeEnd(TEST);

TEST = `- Exact triple-term match, ${K} times`;
console.time(TEST);
for (i = 0; i < K; i++)
  assert.equal(starStore.getQuads(null, null,
    quad(namedNode(`${prefix}s${i % K}`), namedNode(`${prefix}p${i % 16}`), namedNode(`${prefix}o${i}`))).length, 1);
console.timeEnd(TEST);

TEST = `- Wildcard match <<( s0 ?p ?o )>>, ${N / K} results`;
console.time(TEST);
assert.equal(starStore.getQuads(null, null,
  quad(namedNode(`${prefix}s0`), variable('p'), variable('o'))).length, N / K);
console.timeEnd(TEST);

TEST = `- Hard wildcard match <<( ?s p3 ?o )>>, ${Math.ceil((N - 3) / 16)} results`;
console.time(TEST);
assert.equal(starStore.getQuads(null, null,
  quad(variable('s'), namedNode(`${prefix}p3`), variable('o'))).length, Math.ceil((N - 3) / 16));
console.timeEnd(TEST);

TEST = `- Scan workaround for <<( s0 ?p ?o )>>, ${N / K} results`;
console.time(TEST);
let found = 0;
for (const starQuad of starStore) {
  if (starQuad.object.termType === 'Quad' && starQuad.object.subject.value === `${prefix}s0`)
    found++;
}
assert.equal(found, N / K);
console.timeEnd(TEST);
