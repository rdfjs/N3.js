#!/usr/bin/env node
const assert = require('assert');
const N3 = require('..');

console.log('N3Store set-operation performance test');

const prefix = 'http://example.org/#';

// Number of quads per store (default 200_000, override with first CLI arg).
const size = Number.parseInt(process.argv[2], 10) || 200000;
// Number of repetitions; the best (fastest) run is reported.
const reps = Number.parseInt(process.argv[3], 10) || 5;

// Build a store of `count` quads, offset to control overlap between two stores.
// Quads are spread across subjects, predicates and graphs for realistic index depth.
function buildStore(count, offset, entityIndex) {
  const store = new N3.Store(null, entityIndex ? { entityIndex } : undefined);
  for (let i = 0; i < count; i++) {
    const g = i % 4;
    store.addQuad(
      `${prefix}s${(i + offset) % 5000}`,
      `${prefix}p${(i + offset) % 50}`,
      `${prefix}o${i + offset}`,
      g ? `${prefix}g${g}` : undefined,
    );
  }
  return store;
}

function bestOf(label, fn) {
  let best = Infinity;
  for (let r = 0; r < reps; r++) {
    const start = process.hrtime.bigint();
    const result = fn();
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    assert(result.size >= 0);
    if (elapsed < best)
      best = elapsed;
    if (global.gc)
      global.gc();
  }
  console.log(`  ${label}: ${best.toFixed(2)}ms`);
}

// 50% overlap between the two stores.
const overlap = Math.floor(size / 2);

console.log(`\nShared entity index (fast path), ${size} quads/store, ${overlap} overlapping:`);
{
  const index = new N3.EntityIndex();
  const a = buildStore(size, 0, index);
  const b = buildStore(size, size - overlap, index);
  bestOf('union (shared index)', () => a.union(b));
  bestOf('intersection (shared index)', () => a.intersection(b));
  bestOf('difference (shared index)', () => a.difference(b));
}

console.log(`\nDistinct entity index (fall-back path), ${size} quads/store, ${overlap} overlapping:`);
{
  const a = buildStore(size, 0);
  const b = buildStore(size, size - overlap);
  bestOf('union (distinct index)', () => a.union(b));
  bestOf('intersection (distinct index)', () => a.intersection(b));
  bestOf('difference (distinct index)', () => a.difference(b));
}
