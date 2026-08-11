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

// Each scenario gets its own store: `snapshot` and `forwarded` views keep observing
// the parent store, so views left behind by one scenario would contaminate the next.
function freshStore() {
  const store = new N3.Store();
  for (let i = 0; i < dim; i++)
    for (let j = 0; j < dim; j++)
      store.addQuad(namedNode(prefix + i), namedNode('p'), namedNode(prefix + j));
  return store;
}

// Warm up all three semantics so JIT effects do not skew the first measurement.
function warmUp() {
  const store = new N3.Store();
  for (let i = 0; i < 4; i++)
    store.addQuad(namedNode(prefix + i), namedNode('p'), namedNode('o'));
  [undefined, { matchSemantics: 'snapshot' }, { matchSemantics: 'forwarded' }].forEach((options, k) => {
    const view = store.match(namedNode(prefix + 0), null, null, null, options);
    assert.equal([...view].length, k + 1);
    store.addQuad(namedNode(prefix + 0), namedNode('p'), namedNode(`warm${k}`));
  });
}
warmUp();

let TEST = `- Adding ${total} triples`;
console.time(TEST);
const initial = freshStore();
console.timeEnd(TEST);
assert.equal(initial.size, total);

console.log(`* Memory usage after load: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

function runMatchIterate(label, options) {
  const store = freshStore();
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
  const store = freshStore();
  const views = [];
  for (let i = 0; i < dim; i++)
    views.push(store.match(namedNode(prefix + i), null, null, null, options));
  TEST = `- ${label}: ${total} non-matching parent mutations with ${dim} open views`;
  console.time(TEST);
  // Mutate a separate subject space so none of the open views match
  for (let j = 0; j < total; j++)
    store.addQuad(namedNode(`http://other/#${j}`), namedNode('p'), namedNode('o'));
  console.timeEnd(TEST);
  assert.equal(views.length, dim);
  assert.equal(store.size, total * 2);
}

runOpenViewsWithMutations('lazy (default)', undefined);
runOpenViewsWithMutations('snapshot', { matchSemantics: 'snapshot' });
runOpenViewsWithMutations('forwarded', { matchSemantics: 'forwarded' });

// Iteration with a matching parent mutation landing mid-stream.
function runMidStreamSwitch(label, options) {
  const store = freshStore();
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
    // Both snapshot and forwarded stay stable for the in-progress pass (dim)
    assert.equal(count, dim);
  }
  console.timeEnd(TEST);
  // Untimed removal of the mid-stream quads; the `forwarded` views stay unmaterialized
  // (iteration alone does not materialize), so this exercises the observers' no-op path
  for (let i = 0; i < dim; i++)
    store.removeQuad(namedNode(prefix + i), namedNode('p'), namedNode('mid'));
  assert.equal(store.size, total);
}

runMidStreamSwitch('snapshot', { matchSemantics: 'snapshot' });
runMidStreamSwitch('forwarded', { matchSemantics: 'forwarded' });

console.log(`* Memory usage at end: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
