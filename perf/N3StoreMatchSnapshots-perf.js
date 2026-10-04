#!/usr/bin/env node
// Compare two esbuild Node bundles in fresh processes, alternating ABBA order.
// node --expose-gc perf/N3StoreMatchSnapshots-perf.js /tmp/before.cjs /tmp/after.cjs [rounds]
const assert = require('assert');
const { execFileSync } = require('child_process');
const { resolve } = require('path');

const scenarios = [
  'lazy-iterate', 'snapshot-iterate', 'forwarded-iterate',
  'plain-mutations', 'observer-fanout',
  'snapshot-freeze', 'forwarded-freeze', 'forwarded-materialized-freeze',
  'forwarded-drain', 'forwarded-star-freeze',
];

function fixture(N3, star = false, size = 8192) {
  const { namedNode, quad } = N3.DataFactory;
  const quads = Array.from({ length: size }, (_, i) => quad(
    namedNode(`s${i >> 6}`), namedNode(`p${i % 4}`), star ?
      quad(namedNode(`a${i % 64}`), namedNode('b'), namedNode('c')) : namedNode(`o${i % 64}`),
  ));
  return { store: new N3.Store(quads), quads, extra: quad(namedNode('extra'), namedNode('p'), namedNode('o')) };
}

function elapsed(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function measure(N3, scenario) {
  const { store, quads, extra } = fixture(N3, scenario.includes('star'));
  const matchSemantics = scenario.split('-')[0];
  let milliseconds = 0;
  if (scenario.endsWith('iterate')) {
    const view = store.match(null, null, null, null, { matchSemantics });
    let count = 0;
    const start = process.hrtime.bigint();
    for (let i = 0; i < 32; i++)
      for (const quad of view) // eslint-disable-line no-unused-vars
        count++;
    milliseconds = elapsed(start);
    assert.equal(count, 32 * quads.length);
  }
  else if (scenario === 'plain-mutations' || scenario === 'observer-fanout') {
    const views = scenario === 'observer-fanout' ? Array.from({ length: 64 }, (_, i) =>
      store.match(N3.DataFactory.namedNode(`absent${i}`), null, null, null, { matchSemantics: 'forwarded' })) : [];
    const start = process.hrtime.bigint();
    for (const quad of quads) {
      store.delete(quad);
      store.add(quad);
    }
    milliseconds = elapsed(start);
    assert.equal(store.size, quads.length);
    for (const view of views)
      assert.equal(view.size, 0);
  }
  else {
    for (let i = 0; i < 16; i++) {
      const view = store.match(null, null, null, null, { matchSemantics });
      if (scenario.includes('materialized'))
        assert.equal(view.size, quads.length);
      const iterator = view[Symbol.iterator]();
      assert.equal(iterator.next().done, false);
      const start = process.hrtime.bigint();
      store.add(extra);
      let count = 1;
      if (scenario.endsWith('drain'))
        for (const quad of iterator) // eslint-disable-line no-unused-vars
          count++;
      milliseconds += elapsed(start);
      assert.equal(count, scenario.endsWith('drain') ? quads.length : 1);
      iterator.return();
      // Isolate the next sample without timing the unrelated cost of detachment.
      view._detachObserver();
      store.delete(extra);
    }
  }
  return milliseconds;
}

function retainedHeap(N3) {
  const { store, extra } = fixture(N3, false, 32768);
  const view = store.match(null, null, null, null, { matchSemantics: 'forwarded' });
  const iterator = view[Symbol.iterator]();
  iterator.next();
  global.gc();
  const before = process.memoryUsage().heapUsed;
  store.add(extra);
  global.gc();
  const bytes = process.memoryUsage().heapUsed - before;
  // Keep the suspended reader reachable until after the heap measurement.
  assert.equal(iterator.next().done, false);
  iterator.return();
  return bytes;
}

async function sample(modulePath) {
  const N3 = require(modulePath); // eslint-disable-line import-x/no-dynamic-require
  const result = {};
  for (const scenario of scenarios) {
    for (let warmup = 0; warmup < 3; warmup++) {
      measure(N3, scenario);
      // WeakRef targets stay alive until the current job ends, even after detach.
      await new Promise(resolve => setImmediate(resolve));
      global.gc();
    }
    global.gc();
    result[scenario] = measure(N3, scenario);
    await new Promise(resolve => setImmediate(resolve));
    global.gc();
  }
  result['retained-heap-bytes'] = retainedHeap(N3);
  return result;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

if (process.argv[2] === '--sample')
  sample(process.argv[3]).then(result => process.stdout.write(JSON.stringify(result)));
else {
  const [before, after] = process.argv.slice(2, 4).map(path => resolve(path));
  assert.ok(before && after, 'Pass paths to the before and after Node bundles');
  const rounds = Number.parseInt(process.argv[4], 10) || 7;
  const ratios = {}, beforeSamples = {}, afterSamples = {};
  for (let round = 0; round < rounds; round++) {
    const samples = [before, after, after, before].map(modulePath =>
      JSON.parse(execFileSync(process.execPath, ['--expose-gc', __filename, '--sample', modulePath], { encoding: 'utf8' })));
    for (const key of Object.keys(samples[0])) {
      const a = (samples[0][key] + samples[3][key]) / 2;
      const b = (samples[1][key] + samples[2][key]) / 2;
      (beforeSamples[key] || (beforeSamples[key] = [])).push(a);
      (afterSamples[key] || (afterSamples[key] = [])).push(b);
      (ratios[key] || (ratios[key] = [])).push(b / a);
    }
    console.log(`Completed ABBA round ${round + 1}/${rounds}`);
  }
  for (const key of Object.keys(ratios))
    console.log(JSON.stringify({
      scenario: key, before: median(beforeSamples[key]), after: median(afterSamples[key]),
      ratio: median(ratios[key]), range: [Math.min(...ratios[key]), Math.max(...ratios[key])],
    }));
}
