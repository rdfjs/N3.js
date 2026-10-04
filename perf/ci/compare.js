#!/usr/bin/env node
// Compares the performance of two N3.js builds on the benchmarks in
// benchmarks.js and reports regressions.
//
// Usage:
//   node perf/ci/compare.js --base <base lib dir> --head <head lib dir>
//     [--rounds 5] [--iterations 7] [--threshold 0.1] [--filter <text>]
//     [--shard <i>/<n>] [--markdown <file>] [--json <file>]
//
// Every measurement runs in a fresh Node.js process. Base and head are
// interleaved within each round (alternating which goes first) so that
// drift in the machine's speed affects both equally, and each round yields
// a paired head/base ratio. A benchmark counts as a regression when the
// median ratio and the ratio of the medians exceed 1 + threshold, or as an
// improvement when both are below 1 - threshold, and 80% of the rounds
// agree; a benchmark flagged that way runs as many rounds again and must
// stay flagged over all of them.
// --shard i/n runs every n-th benchmark starting at the i-th, so CI can
// spread them over parallel jobs; report.js merges the shards' JSON output.
// Exits with status 1 when there is a regression or a benchmark fails.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const benchmarks = require('./benchmarks');
const { render, median } = require('./report');

function usage(message) {
  console.error(`${message}\nUsage: compare.js --base <lib dir> --head <lib dir> [--rounds n] [--iterations n] ` +
    '[--threshold fraction] [--filter text] [--shard i/n] [--markdown file] [--json file]');
  process.exit(2);
}

const options = ['base', 'head', 'rounds', 'iterations', 'threshold', 'filter', 'shard', 'markdown', 'json'];
const args = { rounds: '5', iterations: '7', threshold: '0.1' };
for (let i = 2; i < process.argv.length; i += 2) {
  const option = process.argv[i].replace(/^--/, '');
  if (!options.includes(option) || process.argv[i + 1] === undefined)
    usage(`Invalid argument: ${process.argv[i]}`);
  args[option] = process.argv[i + 1];
}
if (!args.base || !args.head)
  usage('Both --base and --head are required.');
// Reject values that would make the comparison pass without measuring anything
for (const option of ['rounds', 'iterations']) {
  if (!/^[1-9]\d*$/.test(args[option]))
    usage(`--${option} must be a positive integer.`);
}
const rounds = Number(args.rounds), threshold = Number(args.threshold);
if (!(threshold > 0 && threshold < 1))
  usage('--threshold must be a number between 0 and 1, such as 0.1 for 10%.');
// A plain substring match, so command-line input never becomes a regular expression
const filter = args.filter ? args.filter.toLowerCase() : null;
let names = Object.keys(benchmarks).filter(name => !filter || name.toLowerCase().includes(filter));
if (!names.length)
  usage(`No benchmark name contains "${args.filter}".`);
if (args.shard) {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(args.shard);
  if (!match || Number(match[1]) > Number(match[2]))
    usage('--shard must look like 2/4.');
  const [shard, shards] = [Number(match[1]), Number(match[2])];
  names = names.filter((name, index) => index % shards === shard - 1);
}

function measure(lib, name) {
  try {
    const output = execFileSync(process.execPath,
      ['--expose-gc', path.join(__dirname, 'run-one.js'), path.resolve(lib), name, String(args.iterations)],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const { skipped, times } = JSON.parse(output);
    if (skipped)
      return { skipped: true };
    if (!Array.isArray(times) || !times.length || !times.every(t => Number.isFinite(t) && t > 0))
      return { error: `Malformed benchmark output: ${output.slice(0, 200)}` };
    return median(times);
  }
  catch (error) {
    return { error: (error.stderr || error.message).trim().split('\n').slice(0, 5).join('\n') };
  }
}

function runRound(round, list) {
  list.forEach((result, index) => {
    if (result.baseError || result.headError || result.skipped || result.unavailable) return;
    const order = (round + index) % 2 ? ['head', 'base'] : ['base', 'head'];
    const times = {};
    for (const side of order) times[side] = measure(args[side], result.name);
    if (times.base.error) result.baseError = times.base.error;
    if (times.head.error) result.headError = times.head.error;
    // Only a benchmark whose available() check says the base lacks the
    // feature is skipped; any other base failure fails the comparison
    if (times.head.skipped && times.base.skipped) result.unavailable = true;
    else if (times.head.skipped) result.headError = 'available() returned false on head';
    else if (times.base.skipped) result.skipped = true;
    if (result.baseError || result.headError || result.skipped || result.unavailable) return;
    result.base.push(times.base);
    result.head.push(times.head);
    result.ratios.push(times.head / times.base);
  });
}

// A change counts when the median of the paired per-round ratios and the
// ratio of the overall medians both exceed the threshold, and at least 80%
// of the rounds agree on its direction
function classify(result) {
  if (result.headError || result.baseError) return 'error';
  if (result.skipped) return 'new';
  if (result.unavailable) return 'unavailable';
  result.ratio = median(result.ratios);
  const overall = median(result.head) / median(result.base);
  const required = Math.max(1, Math.ceil(result.ratios.length * 0.8));
  const slower = result.ratios.filter(r => r > 1).length;
  const faster = result.ratios.filter(r => r < 1).length;
  if (result.ratio > 1 + threshold && overall > 1 + threshold && slower >= required)
    return 'regression';
  if (result.ratio < 1 - threshold && overall < 1 - threshold && faster >= required)
    return 'improvement';
  return 'ok';
}

const results = names.map(name => ({ name, unit: benchmarks[name].memory ? 'MB' : 'ms', base: [], head: [], ratios: [] }));
for (let round = 0; round < rounds; round++) {
  runRound(round, results);
  console.error(`Round ${round + 1}/${rounds} done`);
}
for (const result of results) result.status = classify(result);

// Noise on a shared runner occasionally pushes an unchanged benchmark past the
// threshold, so every flagged benchmark runs as many rounds again and has to
// stay flagged over all of them
const flagged = results.filter(r => r.status === 'regression' || r.status === 'improvement');
for (let round = 0; round < rounds && flagged.length; round++) {
  runRound(rounds + round, flagged);
  console.error(`Confirmation round ${round + 1}/${rounds} done (${flagged.length} benchmarks)`);
}
for (const result of flagged) result.status = classify(result);

const settings = { rounds, iterations: Number(args.iterations), threshold };
const { markdown, failed } = render([{ settings, results }]);

process.stdout.write(markdown);
// eslint-disable-next-line no-sync
if (args.markdown) fs.writeFileSync(args.markdown, markdown);
// eslint-disable-next-line no-sync
if (args.json) fs.writeFileSync(args.json, JSON.stringify({ settings, results }, null, 2));
process.exit(failed ? 1 : 0);
