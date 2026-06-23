#!/usr/bin/env node
// Benchmark for configurable `#match()` semantics, comparing `lazy`, `snapshot`, and `forwarded`.
const assert = require('assert');
const N3 = require('..');

const { DataFactory: { namedNode } } = N3;

console.log('N3Store #match() semantics performance test');

// `dim` x `dim` subjects/objects in the default graph.
const dim = Number.parseInt(process.argv[2], 10) || 256;
const total = dim * dim;

const prefix = 'http://example.org/#';
const store = new N3.Store();

let TEST = `- Adding ${total} triples`;
console.time(TEST);
for (let i = 0; i < dim; i++)
  for (let j = 0; j < dim; j++)
    store.addQuad(namedNode(prefix + i), namedNode('p'), namedNode(prefix + j));
console.timeEnd(TEST);

console.log(`* Memory usage after load: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

function runMatchIterate(label, options) {
  TEST = `- ${label}: match() + full iteration over ${dim} subjects`;
  console.time(TEST);
  for (let i = 0; i < dim; i++) {
    const view = store.match(namedNode(prefix + i), null, null, null, options);
    let count = 0;
    for (const _ of view) // eslint-disable-line no-unused-vars
      count++;
    assert.equal(count, dim);
  }
  console.timeEnd(TEST);
}

runMatchIterate('lazy (default)', undefined);
runMatchIterate('snapshot', { matchSemantics: 'snapshot' });
runMatchIterate('forwarded', { matchSemantics: 'forwarded' });

// Many open views during non-matching parent mutations: exercises observer fan-out.
function runOpenViewsWithMutations(label, options) {
  TEST = `- ${label}: ${dim} open views, ${dim} non-matching parent mutations`;
  console.time(TEST);
  const views = [];
  for (let i = 0; i < dim; i++)
    views.push(store.match(namedNode(prefix + i), null, null, null, options));
  // Mutate a separate subject space so none of the open views match
  for (let j = 0; j < dim; j++)
    store.addQuad(namedNode(`http://other/#${j}`), namedNode('p'), namedNode('o'));
  // Clean up to keep the dataset stable across runs
  for (let j = 0; j < dim; j++)
    store.removeQuad(namedNode(`http://other/#${j}`), namedNode('p'), namedNode('o'));
  assert.equal(views.length, dim);
  console.timeEnd(TEST);
}

runOpenViewsWithMutations('lazy (default)', undefined);
runOpenViewsWithMutations('snapshot', { matchSemantics: 'snapshot' });
runOpenViewsWithMutations('forwarded', { matchSemantics: 'forwarded' });

// Iteration with a matching parent mutation landing mid-stream.
function runMidStreamSwitch(label, options) {
  TEST = `- ${label}: ${dim} iterations each with a mid-stream matching mutation`;
  console.time(TEST);
  for (let i = 0; i < dim; i++) {
    const view = store.match(namedNode(prefix + i), null, null, null, options);
    let count = 0, mutated = false;
    for (const _ of view) { // eslint-disable-line no-unused-vars
      count++;
      if (!mutated) {
        mutated = true;
        store.addQuad(namedNode(prefix + i), namedNode('p'), namedNode('mid'));
      }
    }
    store.removeQuad(namedNode(prefix + i), namedNode('p'), namedNode('mid'));
    // Both snapshot and forwarded stay stable for the in-progress pass (dim)
    assert.equal(count, dim);
  }
  console.timeEnd(TEST);
}

runMidStreamSwitch('snapshot', { matchSemantics: 'snapshot' });
runMidStreamSwitch('forwarded', { matchSemantics: 'forwarded' });

console.log(`* Memory usage at end: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
