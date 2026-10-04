#!/usr/bin/env node
// Compares the performance of two N3.js builds on the benchmarks in
// benchmarks.js and reports regressions.
//
// Usage:
//   node perf/ci/compare.js --base <base lib dir> --head <head lib dir>
//     [--rounds 5] [--iterations 7] [--threshold 0.1] [--filter <text>]
//     [--markdown <file>] [--json <file>]
//
// Every measurement runs in a fresh Node.js process. Base and head are
// interleaved within each round (alternating which goes first) so that
// drift in the machine's speed affects both equally, and each round yields
// a paired head/base ratio. A benchmark counts as a regression when the
// median ratio exceeds 1 + threshold and nearly every round agrees.
// Exits with status 1 when there is a regression or a head run fails.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const benchmarks = require('./benchmarks');

function usage(message) {
  console.error(`${message}\nUsage: compare.js --base <lib dir> --head <lib dir> [--rounds n] [--iterations n] ` +
    '[--threshold fraction] [--filter text] [--markdown file] [--json file]');
  process.exit(2);
}

const options = ['base', 'head', 'rounds', 'iterations', 'threshold', 'filter', 'markdown', 'json'];
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
if (!(threshold > 0 && threshold < 10))
  usage('--threshold must be a number above 0, such as 0.1 for 10%.');
// A plain substring match, so command-line input never becomes a regular expression
const filter = args.filter ? args.filter.toLowerCase() : null;
const names = Object.keys(benchmarks).filter(name => !filter || name.toLowerCase().includes(filter));
if (!names.length)
  usage(`No benchmark name contains "${args.filter}".`);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

const results = names.map(name => ({ name, base: [], head: [], ratios: [] }));
for (let round = 0; round < rounds; round++) {
  results.forEach((result, index) => {
    if (result.baseError || result.headError || result.skipped) return;
    const order = (round + index) % 2 ? ['head', 'base'] : ['base', 'head'];
    const times = {};
    for (const side of order) times[side] = measure(args[side], result.name);
    if (times.base.error) result.baseError = times.base.error;
    if (times.head.error) result.headError = times.head.error;
    // Only a benchmark whose available() check says the base lacks the
    // feature is skipped; any other base failure fails the comparison
    if (times.head.skipped) result.headError = 'available() returned false on head';
    else if (times.base.skipped) result.skipped = true;
    if (result.baseError || result.headError || result.skipped) return;
    result.base.push(times.base);
    result.head.push(times.head);
    result.ratios.push(times.head / times.base);
  });
  console.error(`Round ${round + 1}/${rounds} done`);
}

const required = Math.max(1, Math.ceil(rounds * 0.8));
for (const result of results) {
  if (result.headError || result.baseError) result.status = 'error';
  else if (result.skipped) result.status = 'new';
  else {
    result.ratio = median(result.ratios);
    const slower = result.ratios.filter(r => r > 1).length;
    const faster = result.ratios.filter(r => r < 1).length;
    if (result.ratio > 1 + threshold && slower >= required) result.status = 'regression';
    else if (result.ratio < 1 / (1 + threshold) && faster >= required) result.status = 'improvement';
    else result.status = 'ok';
  }
}

const icon = { ok: '', regression: '🔴 slower', improvement: '🟢 faster', new: 'new (not on base)', error: '❌ failed' };
function ms(values) {
  return `${median(values).toFixed(1)} ms`;
}
const lines = [
  '## Performance comparison',
  '',
  `Head vs base, median of ${rounds} interleaved rounds (each the median of ${args.iterations} runs after warm-up). ` +
  `Flagged when the change exceeds ${Math.round(threshold * 100)}% in at least ${required} of ${rounds} rounds.`,
  '',
  '| Benchmark | Base | Head | Change | Rounds slower | |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
];
for (const r of results) {
  if (r.status === 'error' || r.status === 'new')
    lines.push(`| ${r.name} | | | | | ${icon[r.status]} |`);
  else {
    const change = `${r.ratio >= 1 ? '+' : ''}${((r.ratio - 1) * 100).toFixed(1)}%`;
    const slower = r.ratios.filter(x => x > 1).length;
    lines.push(`| ${r.name} | ${ms(r.base)} | ${ms(r.head)} | ${change} | ${slower}/${r.ratios.length} | ${icon[r.status]} |`);
  }
}
const regressions = results.filter(r => r.status === 'regression');
const errors = results.filter(r => r.status === 'error');
lines.push('');
lines.push(regressions.length ?
  `**${regressions.length} regression(s) above ${Math.round(threshold * 100)}%.**` :
  `No regressions above ${Math.round(threshold * 100)}%.`);
if (errors.length)
  lines.push('', `**${errors.length} benchmark(s) failed to run, so they were not compared.**`);
for (const r of results) {
  for (const side of ['base', 'head']) {
    const error = r[`${side}Error`];
    if (error)
      lines.push('', `<details><summary>${r.name} failed on ${side}</summary>\n\n\`\`\`\n${error}\n\`\`\`\n</details>`);
  }
}
const markdown = `${lines.join('\n')}\n`;

process.stdout.write(markdown);
// eslint-disable-next-line no-sync
if (args.markdown) fs.writeFileSync(args.markdown, markdown);
// eslint-disable-next-line no-sync
if (args.json) fs.writeFileSync(args.json, JSON.stringify(results, null, 2));
process.exit(regressions.length || errors.length ? 1 : 0);
