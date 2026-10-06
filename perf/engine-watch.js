#!/usr/bin/env node
// Checks whether the newest JavaScript engine has caught up with the issues
// below, by timing the pattern each one works around on an index-sized object
// against the same pattern on a small one. Prints `<issue> <message>` for
// each issue whose pattern no longer slows down with the object's size.
// Used by the Engine watch workflow; usage: node perf/engine-watch.js
const LARGE = 100000, SMALL = 100, CAUGHT_UP = 10;

// Builds a Store index node, keyed by numeric entity ids, that has seen a removal
function index(size) {
  const node = { [Symbol('size')]: 0 };
  for (let id = 1; id <= size + 1; id++) node[id] = null;
  delete node[size + 1];
  return node;
}

// Median over 5 rounds of the time per call of `probe(node, calls)`,
// with fewer calls on the large index so that today's engines finish quickly
function perCall(probe, size) {
  const node = index(size), calls = 1e6 / size, times = [];
  for (let round = 0; round < 5; round++) {
    const start = process.hrtime.bigint();
    probe(node, calls);
    times.push(Number(process.hrtime.bigint() - start) / calls);
  }
  return times.sort((a, b) => a - b)[2];
}

const probes = {
  // #717: `for...in` should yield an index's first key without preparing all of them
  717: (node, calls) => {
    for (let i = 0; i < calls; i++)
      for (const key in node) break; // eslint-disable-line no-unused-vars
  },
  // #684: removal should detect a non-empty index without enumerating it
  684: (node, calls) => {
    for (let i = 0; i < calls; i++) {
      const removed = 1 + i % SMALL;
      delete node[removed];
      for (const key in node) break; // eslint-disable-line no-unused-vars
      node[removed] = null;
    }
  },
};

const engine = `Node ${process.version} (V8 ${process.versions.v8})`;
for (const issue in probes) {
  const ratio = perCall(probes[issue], LARGE) / perCall(probes[issue], SMALL);
  console.error(`#${issue}: ${LARGE}-key index is ${ratio.toFixed(1)}x slower than ${SMALL}-key on ${engine}`);
  if (ratio < CAUGHT_UP)
    console.log(`${issue} On ${engine}, the pattern this issue works around costs ${ratio.toFixed(1)}x as much on a ${LARGE}-key index as on a ${SMALL}-key one (threshold ${CAUGHT_UP}x), so the engine may have caught up.`);
}
