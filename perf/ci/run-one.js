#!/usr/bin/env node
// Runs one benchmark against one build and prints its timings as JSON.
// Usage: node --expose-gc run-one.js <path to built N3.js lib> <benchmark name> <iterations>
const path = require('path');
const benchmarks = require('./benchmarks');

const [libPath, name, iterations = '7'] = process.argv.slice(2);
// eslint-disable-next-line import-x/no-dynamic-require
const N3 = require(path.resolve(libPath));
const benchmark = benchmarks[name];
if (!benchmark) throw new Error(`Unknown benchmark: ${name}`);
const { setup, available = () => true } = typeof benchmark === 'function' ? { setup: benchmark } : benchmark;

const gc = global.gc || (() => {});

(async () => {
  // A benchmark for a feature this build does not have yet
  if (!available(N3)) {
    process.stdout.write(JSON.stringify({ name, skipped: true }));
    return;
  }
  const run = await setup(N3);

  // Warm up so the JIT has settled before anything is measured
  for (let i = 0; i < 3; i++) await run();

  const times = [];
  for (let i = 0; i < Number(iterations); i++) {
    gc();
    const start = process.hrtime.bigint();
    await run();
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  process.stdout.write(JSON.stringify({ name, times }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
