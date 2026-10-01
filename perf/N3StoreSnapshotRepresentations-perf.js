#!/usr/bin/env node
// node perf/N3StoreSnapshotRepresentations-perf.js array.cjs index.cjs [rounds] [size]
// Both bundles must expose the same Store API; only the snapshot helpers differ.
// The copied-index candidate patch is no longer in the working tree; recover it from Git history:
// git show 2bdd69a8934b3cc6aa5b47ced4db3893f932a2ab:perf/fixtures/N3Store-index-snapshot.patch
const assert = require('assert');
const { execFileSync } = require('child_process');
const { resolve } = require('path');
const os = require('os');

const cases = [
  { name: 'dense/early', shape: 'dense' },
  { name: 'dense/late', shape: 'dense', offset: 0.99 },
  { name: 'balanced/early', shape: 'balanced' },
  { name: 'balanced/late', shape: 'balanced', offset: 0.99 },
  { name: 'sparse/early', shape: 'sparse' },
  { name: 'sparse/late', shape: 'sparse', offset: 0.99 },
  { name: 'many-graphs', shape: 'graphs' },
  { name: 'bound-graph', shape: 'graphs', graph: 'g0' },
  { name: 'predicate-index', shape: 'pos', predicate: 'p' },
  { name: 'object-index', shape: 'osp', object: 'o' },
  { name: 'selective-subject', shape: 'balanced', subject: 's0' },
  { name: 'materialized', shape: 'balanced', materialized: true },
  { name: 'snapshot-mode', shape: 'balanced', semantics: 'snapshot' },
  { name: 'three-readers', shape: 'balanced', offsets: [0, 0.5, 0.99] },
  { name: 'embedded-quads', shape: 'balanced', star: true },
];

function tick() {
  return new Promise(resolve => setImmediate(resolve));
}

function fixture(N3, config, size) {
  const { namedNode, quad } = N3.DataFactory;
  const store = new N3.Store();
  for (let i = 0; i < size; i++) {
    let s, p, o, g;
    switch (config.shape) {
    case 'dense': s = 's'; p = 'p'; o = `o${i}`; break;
    case 'sparse': s = `s${i}`; p = 'p'; o = 'o'; break;
    case 'graphs': s = `s${i % 16}`; p = 'p'; o = `o${(i >> 4) % 16}`; g = `g${i >> 8}`; break;
    case 'pos': s = `s${i >> 6}`; p = 'p'; o = `o${i % 64}`; break;
    case 'osp': s = `s${i >> 6}`; p = `p${i % 64}`; o = 'o'; break;
    default: s = `s${i >> 6}`; p = `p${i % 4}`; o = `o${i % 64}`;
    }
    let object = namedNode(o);
    if (config.star)
      object = quad(quad(namedNode('a'), namedNode('b'), object), namedNode('c'), object);
    store.add(quad(namedNode(s), namedNode(p), object, g && namedNode(g)));
  }
  assert.equal(store.size, size);
  const pattern = ['subject', 'predicate', 'object', 'graph'].map(key =>
    config[key] === undefined ? null : namedNode(config[key]));
  const expected = store.getQuads(...pattern);
  return { store, pattern, expected, victim: expected[expected.length - 1] };
}

function openReaders(data, config) {
  const view = data.store.match(...data.pattern, { matchSemantics: config.semantics || 'forwarded' });
  if (config.materialized)
    assert.equal(view.size, data.expected.length);
  const offsets = (config.offsets || [config.offset || 0]).map(fraction =>
    Math.max(1, Math.floor(data.expected.length * fraction)));
  const readers = offsets.map(offset => {
    const iterator = view[Symbol.iterator]();
    for (let i = 0; i < offset; i++)
      assert.equal(iterator.next().done, false);
    return iterator;
  });
  return { view, offsets, readers };
}

function closeReaders(data, { view, readers }) {
  for (const reader of readers)
    reader.return();
  view._detachObserver();
  data.store.add(data.victim);
}

function elapsed(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function sampleCase(N3, config, size) {
  const data = fixture(N3, config, size);
  // Verify the full ordered tail outside the timed section.
  const check = openReaders(data, config);
  data.store.delete(data.victim);
  check.readers.forEach((reader, i) => {
    assert.deepStrictEqual([...reader], data.expected.slice(check.offsets[i]));
  });
  closeReaders(data, check);
  await tick();

  const captures = [], resumes = [], resumesFirst = [];
  for (let cycle = 0; cycle < 12; cycle++) {
    const state = openReaders(data, config);
    global.gc();
    let start = process.hrtime.bigint();
    data.store.delete(data.victim);
    const capture = elapsed(start);
    let count = 0;
    start = process.hrtime.bigint();
    for (const reader of state.readers)
      count += reader.next().done ? 0 : 1;
    const first = elapsed(start);
    start = process.hrtime.bigint();
    for (const reader of state.readers)
      for (const quad of reader) // eslint-disable-line no-unused-vars
        count++;
    const resume = first + elapsed(start);
    assert.equal(count, state.offsets.reduce((sum, offset) => sum + data.expected.length - offset, 0));
    closeReaders(data, state);
    if (cycle >= 4) {
      captures.push(capture);
      resumes.push(resume);
      resumesFirst.push(first);
    }
    // A dereferenced view stays alive for the current job, even after detach.
    await tick();
  }

  const state = openReaders(data, config);
  global.gc();
  const before = process.memoryUsage().heapUsed;
  data.store.delete(data.victim);
  global.gc();
  const heap = process.memoryUsage().heapUsed - before;
  // Keep all readers reachable through the measurement, then release their baseline.
  for (const reader of state.readers)
    assert.equal(reader.next().done, false);
  closeReaders(data, state);
  return {
    matches: data.expected.length, readers: state.readers.length,
    captureMs: mean(captures), resumeMs: mean(resumes), firstResumeMs: mean(resumesFirst),
    totalMs: mean(captures) + mean(resumes), retainedBytes: heap,
  };
}

async function worker(modulePath, size) {
  const N3 = require(modulePath); // eslint-disable-line import-x/no-dynamic-require
  const result = {};
  for (const config of cases) {
    result[config.name] = await sampleCase(N3, config, size);
    await tick();
    global.gc();
  }
  return result;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

if (process.argv[2] === '--worker') {
  worker(process.argv[3], Number(process.argv[4])).then(result => {
    process.stdout.write(JSON.stringify(result));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
else {
  const [arrayPath, indexPath] = process.argv.slice(2, 4).map(path => resolve(path));
  assert.ok(arrayPath && indexPath, 'Pass array and copied-index Node bundles');
  const rounds = Number.parseInt(process.argv[4], 10) || 7;
  const size = Number.parseInt(process.argv[5], 10) || 8192;
  const raw = [];
  for (let round = 0; round < rounds; round++) {
    const samples = [arrayPath, indexPath, indexPath, arrayPath].map((modulePath, position) => {
      const sample = JSON.parse(execFileSync(process.execPath,
        ['--expose-gc', __filename, '--worker', modulePath, String(size)], { encoding: 'utf8' }));
      process.stderr.write(`Completed round ${round + 1}/${rounds}, sample ${position + 1}/4\n`);
      return sample;
    });
    raw.push(samples);
  }
  const summary = {};
  for (const { name } of cases) {
    const metrics = summary[name] = { matches: raw[0][0][name].matches, readers: raw[0][0][name].readers };
    for (const metric of ['captureMs', 'resumeMs', 'firstResumeMs', 'totalMs', 'retainedBytes']) {
      const array = raw.map(r => (r[0][name][metric] + r[3][name][metric]) / 2);
      const index = raw.map(r => (r[1][name][metric] + r[2][name][metric]) / 2);
      const ratios = array.map((value, i) => index[i] / value);
      metrics[metric] = {
        array: median(array), index: median(index), ratio: median(ratios),
        range: [Math.min(...ratios), Math.max(...ratios)],
      };
    }
  }
  process.stdout.write(`${JSON.stringify({
    metadata: { node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(), rounds, size },
    summary, raw,
  }, null, 2)}\n`);
}
