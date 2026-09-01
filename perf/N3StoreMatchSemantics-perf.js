#!/usr/bin/env node
const assert = require('assert');
const N3 = require('..');

const { DataFactory: { namedNode } } = N3;

console.log('N3Store #match() semantics performance test');

const dim = Number.parseInt(process.argv[2], 10) || 256;
const total = dim * dim;

const prefix = 'http://example.org/#';
const predicate = namedNode('p');
const object = namedNode('o');
const mid = namedNode('mid');

// Keep observers created by one scenario out of the next
function freshStore() {
  const store = new N3.Store();
  for (let i = 0; i < dim; i++)
    for (let j = 0; j < dim; j++)
      store.addQuad(namedNode(prefix + i), predicate, namedNode(prefix + j));
  return store;
}

function warmUp() {
  const store = new N3.Store();
  for (let i = 0; i < 4; i++)
    store.addQuad(namedNode(prefix + i), predicate, object);
  [undefined, { matchSemantics: 'snapshot' }, { matchSemantics: 'forwarded' }].forEach((options, k) => {
    const view = store.match(namedNode(prefix + 0), null, null, null, options);
    assert.equal([...view].length, k + 1);
    store.addQuad(namedNode(prefix + 0), predicate, namedNode(`warm${k}`));
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

/* Observer fan-out */
function runOpenViewsWithMutations(label, options) {
  const store = freshStore();
  const views = [];
  for (let i = 0; i < dim; i++)
    views.push(store.match(namedNode(prefix + i), null, null, null, options));
  TEST = `- ${label}: ${total} non-matching parent mutations with ${dim} open views`;
  console.time(TEST);
  for (let j = 0; j < total; j++)
    store.addQuad(namedNode(`http://other/#${j}`), predicate, object);
  console.timeEnd(TEST);
  assert.equal(views.length, dim);
  assert.equal(store.size, total * 2);
}

runOpenViewsWithMutations('lazy (default)', undefined);
runOpenViewsWithMutations('snapshot', { matchSemantics: 'snapshot' });
runOpenViewsWithMutations('forwarded', { matchSemantics: 'forwarded' });

/* Mid-iteration mutation */
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
        store.addQuad(namedNode(prefix + i), predicate, mid);
      }
    }
    assert.equal(count, dim);
  }
  console.timeEnd(TEST);
  for (let i = 0; i < dim; i++)
    store.removeQuad(namedNode(prefix + i), predicate, mid);
  assert.equal(store.size, total);
}

runMidStreamSwitch('snapshot', { matchSemantics: 'snapshot' });
runMidStreamSwitch('forwarded', { matchSemantics: 'forwarded' });

/* Repeated mutations with a suspended iterator */
function runSuspendedIteration() {
  const store = freshStore();
  const subject = namedNode(prefix + 0);
  const view = store.match(subject, null, null, null, { matchSemantics: 'forwarded' });
  const iterator = view[Symbol.iterator]();
  assert.equal(iterator.next().done, false);

  TEST = `- forwarded: ${dim} matching mutations with a suspended iteration`;
  console.time(TEST);
  for (let i = 0; i < dim; i++)
    store.addQuad(subject, predicate, namedNode(`suspended${i}`));
  console.timeEnd(TEST);

  iterator.return();
  assert.equal(view.size, dim * 2);
}

runSuspendedIteration();

console.log(`* Memory usage at end: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
