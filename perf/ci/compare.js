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

const args = { rounds: 5, iterations: 7, threshold: 0.1 };
for (let i = 2; i < process.argv.length; i += 2)
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.base || !args.head) {
  console.error('Usage: compare.js --base <lib dir> --head <lib dir> [options]');
  process.exit(2);
}
const rounds = Number(args.rounds), threshold = Number(args.threshold);
// A plain substring match, so command-line input never becomes a regular expression
const filter = args.filter ? args.filter.toLowerCase() : null;
const names = Object.keys(benchmarks).filter(name => !filter || name.toLowerCase().includes(filter));

function median(values) {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function measure(lib, name) {
  try {
    const output = execFileSync(process.execPath,
      ['--expose-gc', path.join(__dirname, 'run-one.js'), path.resolve(lib), name, String(args.iterations)],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return median(JSON.parse(output).times);
  }
  catch (error) {
    return { error: (error.stderr || error.message).trim().split('\n').slice(0, 5).join('\n') };
  }
}

const results = names.map(name => ({ name, base: [], head: [], ratios: [] }));
for (let round = 0; round < rounds; round++) {
  results.forEach((result, index) => {
    if (result.baseError || result.headError) return;
    const order = (round + index) % 2 ? ['head', 'base'] : ['base', 'head'];
    const times = {};
    for (const side of order) times[side] = measure(args[side], result.name);
    if (times.base.error) result.baseError = times.base.error;
    if (times.head.error) result.headError = times.head.error;
    if (result.baseError || result.headError) return;
    result.base.push(times.base);
    result.head.push(times.head);
    result.ratios.push(times.head / times.base);
  });
  console.error(`Round ${round + 1}/${rounds} done`);
}

const required = Math.max(1, Math.ceil(rounds * 0.8));
for (const result of results) {
  if (result.headError) result.status = 'error';
  else if (result.baseError) result.status = 'new';
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
