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
  if (!(await available(N3))) {
    process.stdout.write(JSON.stringify({ name, skipped: true }));
    return;
  }
  // setup returns the measured function, or { before, run } when each run
  // needs fresh untimed input (such as a store that the run mutates)
  const prepared = await setup(N3);
  const { before = () => undefined, run } = typeof prepared === 'function' ? { run: prepared } : prepared;

  // Warm up so the JIT has settled before anything is measured
  for (let i = 0; i < 3; i++) await run(await before());

  const times = [];
  for (let i = 0; i < Number(iterations); i++) {
    const input = await before();
    gc();
    const start = process.hrtime.bigint();
    await run(input);
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  process.stdout.write(JSON.stringify({ name, times }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
