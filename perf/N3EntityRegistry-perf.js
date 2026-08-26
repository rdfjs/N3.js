#!/usr/bin/env node
const { performance } = require('perf_hooks');
const { isMainThread, parentPort, Worker, workerData } = require('worker_threads');
const N3 = require('..');
const LegacyEntityIndex = require('./LegacyEntityIndex');

// Arguments: operation size, rounds, and garbage-collection comparison size.
const size = Number.parseInt(process.argv[2], 10) || 50_000;
const rounds = Number.parseInt(process.argv[3], 10) || 11;
const cleanupSize = Number.parseInt(process.argv[4], 10) || size;

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

function collect() {
  if (global.gc) {
    for (let attempt = 0; attempt < 3; attempt++)
      global.gc();
  }
}

function immediate() {
  return new Promise(resolve => setImmediate(resolve));
}

function createOptions(shared) {
  if (shared)
    return [{}, {}];
  return [
    { entityIndex: new LegacyEntityIndex() },
    { entityIndex: new LegacyEntityIndex() },
  ];
}

function fill(store, cardinality, offset = 0, count = size) {
  for (let index = 0; index < count; index++) {
    const entity = index + offset;
    const subject = cardinality === 'low' ? entity % 1_000 : entity;
    const predicate = cardinality === 'low' ? Math.floor(entity / 1_000) : entity % 31;
    const object = cardinality === 'low' ? entity % 100 : entity % 10_000;
    store.addQuad(`s${subject}`, `p${predicate}`, `o${object}`);
  }
  return store;
}

function add(shared, cardinality) {
  collect();
  const [options] = createOptions(shared);
  const store = new N3.Store([], options);
  const start = performance.now();
  fill(store, cardinality);
  const duration = performance.now() - start;
  if (store.size !== size)
    throw new Error(`Unexpected store size ${store.size}`);
  return duration;
}

function intersection(shared, rightSize = size) {
  const [leftOptions, rightOptions] = createOptions(shared);
  const left = fill(new N3.Store([], leftOptions), 'high');
  const right = fill(new N3.Store([], rightOptions), 'high', size / 2, rightSize);
  collect();
  const start = performance.now();
  // Force the pre-registry per-quad path for the benchmark-only isolated indices.
  const result = shared ? left.intersection(right) : left.intersection({ has: right.has.bind(right) });
  const duration = performance.now() - start;
  const expectedSize = Math.min(size / 2, rightSize);
  if (result.size !== expectedSize)
    throw new Error(`Unexpected intersection size ${result.size}`);
  return duration;
}

function scopeSelection() {
  const source = fill(new N3.Store(), 'high');
  const sparseSource = fill(new N3.Store(), 'high', size / 2, Math.max(1, Math.floor(size / 100)));
  const dense = source.intersection(source);
  const sparse = source.intersection(sparseSource);
  const empty = source.difference(source);
  return {
    sourceIdentifiers: source._entityScope._ownership.length,
    denseIdentifiers: dense._entityScope._ownership.length,
    denseSharesScope: dense._entityScope === source._entityScope,
    sparseIdentifiers: sparse._entityScope._ownership.length,
    sparseSharesScope: sparse._entityScope === source._entityScope,
    emptyIdentifiers: empty._entityScope._ownership.length,
    emptySharesScope: empty._entityScope === source._entityScope,
  };
}

function compare(callback) {
  callback(false);
  callback(true);
  const isolated = [], shared = [];
  for (let round = 0; round < rounds; round++) {
    const order = round % 2 ? [true, false] : [false, true];
    for (const useRegistry of order)
      (useRegistry ? shared : isolated).push(callback(useRegistry));
  }
  const isolatedMedian = median(isolated), sharedMedian = median(shared);
  return {
    isolated: isolatedMedian,
    registry: sharedMedian,
    ratio: sharedMedian / isolatedMedian,
  };
}

function createCollectableStore(count, useRegistry) {
  const options = useRegistry ? {} : { entityIndex: new LegacyEntityIndex() };
  const store = new N3.Store([], options);
  for (let index = 0; index < count; index++)
    store.addQuad(`subject${index}`, 'predicate', 'object');
  if (store.size !== count)
    throw new Error(`Unexpected store size ${store.size}`);
  if (!useRegistry)
    return {};

  const registry = store._entityIndex._registry;
  return {
    registry,
    expectedFreeIds: registry._freeIds.length + count + 2,
  };
}

async function garbageCollection(count, useRegistry) {
  collect();
  const before = process.memoryUsage().heapUsed;
  const { registry, expectedFreeIds } = createCollectableStore(count, useRegistry);
  const allocated = process.memoryUsage().heapUsed;
  let maxBatch = 0;
  let drainReleases;
  if (registry) {
    drainReleases = registry._drainReleases;
    registry._drainReleases = () => {
      const start = performance.now();
      drainReleases.call(registry);
      maxBatch = Math.max(maxBatch, performance.now() - start);
    };
  }
  const totalStart = performance.now();
  let start = performance.now();
  global.gc();
  const firstGc = performance.now() - start;

  start = performance.now();
  if (registry) {
    for (let turn = 0; registry._freeIds.length !== expectedFreeIds && turn < 10_000; turn++)
      await immediate();
    if (registry._freeIds.length !== expectedFreeIds)
      throw new Error(`Freed ${registry._freeIds.length} of ${expectedFreeIds} identifiers`);
    registry._drainReleases = drainReleases;
  }
  else
    await immediate();
  const cleanup = performance.now() - start;
  const afterCleanup = process.memoryUsage().heapUsed;

  start = performance.now();
  global.gc();
  const secondGc = performance.now() - start;
  await immediate();
  const afterSecondGc = process.memoryUsage().heapUsed;

  return {
    allocationHeapDeltaMegabytes: (allocated - before) / 1024 / 1024,
    cleanupHeapDeltaMegabytes: (afterCleanup - before) / 1024 / 1024,
    retainedHeapDeltaMegabytes: (afterSecondGc - before) / 1024 / 1024,
    firstGcMilliseconds: firstGc,
    cleanupMilliseconds: cleanup,
    secondGcMilliseconds: secondGc,
    maxBatchMilliseconds: maxBatch,
    totalMilliseconds: performance.now() - totalStart,
  };
}

function garbageCollectionInWorker(count, useRegistry) {
  return new Promise((resolve, reject) => {
    let completed = false;
    const worker = new Worker(__filename, { workerData: { count, useRegistry } });
    worker.once('message', message => {
      completed = true;
      if (message.error)
        reject(Object.assign(new Error(message.error.message), { stack: message.error.stack }));
      else
        resolve(message.result);
    });
    worker.once('error', reject);
    worker.once('exit', code => {
      if (!completed)
        reject(new Error(`Garbage-collection worker exited before returning a result (code ${code})`));
    });
  });
}

async function compareGarbageCollection(count) {
  if (!global.gc)
    return { skipped: 'Run with --expose-gc to compare garbage collection' };

  await garbageCollectionInWorker(Math.min(count, 10_000), false);
  await garbageCollectionInWorker(Math.min(count, 10_000), true);
  const measurements = { isolated: [], registry: [] };
  const measurementRounds = Math.min(rounds, 7);
  for (let round = 0; round < measurementRounds; round++) {
    const order = round % 2 ? [true, false] : [false, true];
    for (const useRegistry of order)
      measurements[useRegistry ? 'registry' : 'isolated'].push(
        await garbageCollectionInWorker(count, useRegistry),
      );
  }

  const result = { identifiers: count + 2 };
  for (const scenario of ['isolated', 'registry']) {
    result[scenario] = {};
    for (const field of [
      'allocationHeapDeltaMegabytes', 'cleanupHeapDeltaMegabytes', 'retainedHeapDeltaMegabytes',
      'firstGcMilliseconds', 'cleanupMilliseconds', 'secondGcMilliseconds',
      'maxBatchMilliseconds', 'totalMilliseconds',
    ])
      result[scenario][field] = median(measurements[scenario].map(value => value[field]));
  }
  result.ratio = result.registry.totalMilliseconds / result.isolated.totalMilliseconds;
  return result;
}

async function main() {
  const gc = await compareGarbageCollection(cleanupSize);
  console.log(JSON.stringify({
    addLowCardinality: compare(shared => add(shared, 'low')),
    addHighCardinality: compare(shared => add(shared, 'high')),
    intersection: compare(shared => intersection(shared)),
    asymmetricIntersection: compare(shared => intersection(shared, Math.max(1, Math.floor(size / 100)))),
    scopeSelection: scopeSelection(),
    garbageCollection: gc,
  }, null, 2));
}

if (isMainThread) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
else {
  garbageCollection(workerData.count, workerData.useRegistry)
    .then(
      result => parentPort.postMessage({ result }),
      error => parentPort.postMessage({ error: { message: error.message, stack: error.stack } }),
    );
}
