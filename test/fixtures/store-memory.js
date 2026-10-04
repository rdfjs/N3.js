// Run only in a child process with --expose-gc and @babel/register.
const { Store, Parser, DataFactory, getRulesFromDataset } = require('../../src');
const assert = require('assert');

const { namedNode, quad } = DataFactory;
const [scenario, matchSemantics] = process.argv.slice(2);
const original = quad(namedNode('s'), namedNode('p'), namedNode('o'));
const extra = quad(namedNode('s'), namedNode('p'), namedNode('extra'));
// More than a readable's buffer can hold, so reading one quad leaves it active.
const manyQuads = [original, ...Array.from({ length: 39 }, (_, i) =>
  quad(original.subject, original.predicate, namedNode(`tail${i}`)))];
function tick() {
  return new Promise(resolve => setImmediate(resolve));
}

async function collectUntil(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    // A WeakRef target stays alive until the end of the job that dereferenced it.
    await tick();
    global.gc();
    await tick();
    if (predicate())
      return;
  }
  assert.fail('Objects or observer registrations remained retained after 100 GC turns');
}

function collected(refs) {
  return refs.every(ref => ref.deref() === undefined);
}

function makeStore(quads = [original]) {
  return new Store(quads, { matchSemantics });
}

// Separate scopes prevent the async test frame from retaining its last view.
function transientViews(store, operation) {
  const refs = [];
  for (let i = 0; i < 128; i++) {
    const view = store.match();
    refs.push(new WeakRef(view), new WeakRef(view._observer));
    if (operation === 'iterated')
      assert.deepStrictEqual([...view], [original]);
    if (operation === 'materialized') {
      assert.strictEqual(view.size, 1);
      refs.push(new WeakRef(view.filtered));
    }
    if (operation === 'iterator' || operation === 'stream') {
      if (operation === 'iterator') {
        const iterator = view[Symbol.iterator]();
        iterator.next();
        refs.push(new WeakRef(iterator));
      }
      else
        view.read(1);
      const readers = view._readers;
      store.add(extra);
      refs.push(new WeakRef(readers), new WeakRef(readers.snapshot));
      store.delete(extra);
    }
  }
  return refs;
}

function nestedView(store) {
  const parent = store.match(namedNode('s'));
  const refs = [new WeakRef(parent), new WeakRef(parent._observer)];
  return {
    child: parent.match(null, namedNode('p')),
    refs,
  };
}

function discardedStore() {
  const store = makeStore();
  const view = store.match();
  const refs = [new WeakRef(store), new WeakRef(view), new WeakRef(view._observer)];
  // A materialized forwarded view retains a substantial second object graph.
  if (matchSemantics === 'forwarded') {
    view.size;
    refs.push(new WeakRef(view.filtered));
  }
  return refs;
}

function activeReader(store) {
  const view = store.match();
  const reader = scenario === 'stream' ? view.toStream() : view[Symbol.iterator]();
  const first = scenario === 'stream' ? reader.read(1) : reader.next().value;
  assert.deepStrictEqual(first, original);
  return { reader, refs: [new WeakRef(view), new WeakRef(view._observer)] };
}

function abandonedReader(store) {
  const view = store.match();
  const reader = view[Symbol.iterator]();
  reader.next();
  const readers = view._readers;
  store.add(extra);
  return { view, refs: [new WeakRef(reader), new WeakRef(readers.snapshot)] };
}

function readRules(store) {
  for (let i = 0; i < 128; i++) {
    const rules = getRulesFromDataset(store);
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(rules[0].premise.length, 1);
    assert.strictEqual(rules[0].conclusion.length, 1);
  }
  assert.strictEqual(store._observers.size, 128 * 3);
  return [...store._observers].map(observer => new WeakRef(observer.deref()));
}

// for-await retains its iterator in its async frame; release that frame before GC.
async function finishReader(reader) {
  const remaining = [];
  if (scenario === 'stream') {
    for await (const value of reader)
      remaining.push(value);
  }
  else
    remaining.push(...reader);
  return remaining;
}

async function run() {
  if (scenario === 'transient') {
    let count = 0;
    for (const operation of ['unread', 'iterated', 'materialized', 'iterator', 'stream']) {
      const quads = operation === 'stream' ? manyQuads : [original];
      const store = makeStore(quads);
      for (let batch = 0; batch < 3; batch++) {
        const refs = transientViews(store, operation);
        await collectUntil(() => collected(refs) && store._observers === null);
        assert.strictEqual(store.size, quads.length);
        count += 128;
      }
    }
    return count;
  }
  if (scenario === 'nested') {
    const store = makeStore();
    const { child, refs } = nestedView(store);
    await collectUntil(() => collected(refs));
    assert.strictEqual(store._observers && store._observers.size, matchSemantics === 'forwarded' ? 1 : null);
    store.add(extra);
    assert.strictEqual(child.has(extra), matchSemantics === 'forwarded');
    assert.strictEqual(child.has(original), true);
    return 1;
  }
  if (scenario === 'parent') {
    const refs = discardedStore();
    await collectUntil(() => collected(refs));
    return refs.length;
  }
  if (scenario === 'reasoner') {
    const quads = new Parser({ format: 'text/n3' }).parse('{ <s> <p> <o> } => { <s> <p> <result> }.');
    const store = new Store(quads, { matchSemantics });
    const refs = readRules(store);
    await collectUntil(() => collected(refs) && store._observers === null);
    assert.strictEqual(store.size, quads.length);
    return refs.length;
  }
  if (scenario === 'abandoned') {
    const store = makeStore(manyQuads);
    const { view, refs } = abandonedReader(store);
    // Keeping the view alive must not retain a discarded iterator's snapshot.
    await collectUntil(() => collected(refs));
    assert.strictEqual(view.has(extra), matchSemantics === 'forwarded');
    assert.strictEqual(view.has(original), true);
    return refs.length;
  }
  assert.ok(scenario === 'iterator' || scenario === 'stream');
  const store = makeStore(manyQuads);
  let active = activeReader(store);
  const refs = active.refs;
  for (let i = 0; i < 3; i++) {
    await tick();
    global.gc();
  }
  assert.ok(refs[0].deref(), 'An active reader must retain its view');
  store.add(extra);
  const remaining = await finishReader(active.reader);
  assert.deepStrictEqual(remaining, manyQuads.slice(1), 'The active read must preserve its pre-mutation contents');
  assert.strictEqual(refs[0].deref().has(extra), matchSemantics === 'forwarded');
  active = null;
  await collectUntil(() => collected(refs) && store._observers === null);
  return 1;
}

run().then(count => {
  process.stdout.write(JSON.stringify({ scenario, matchSemantics, collected: count }));
}, error => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
