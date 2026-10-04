#!/usr/bin/env node
// Renders the results of perf/ci/compare.js as Markdown, showing regressions,
// failures and speedups and folding the unchanged benchmarks away.
//
// Usage: node perf/ci/report.js [--markdown <file>] <results.json>...
// Several result files (one per shard) are merged into one report.
// Exits with status 1 when there is a regression or a failed benchmark.
const fs = require('fs');

const icon = { ok: '', regression: '🔴 slower', improvement: '🟢 faster', new: 'new (not on base)',
  unavailable: 'not available on either build', error: '❌ failed' };
// Memory benchmarks use more or less memory rather than being slower or faster
const memoryIcon = { regression: '🔴 more memory', improvement: '🟢 less memory' };
const order = ['regression', 'error', 'improvement', 'new', 'unavailable', 'ok'];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function format(values, unit = 'ms') {
  return `${median(values).toFixed(1)} ${unit}`;
}

function table(results) {
  const lines = [
    '| Benchmark | Base | Head | Change | Rounds slower | |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const r of results) {
    if (r.status === 'error' || r.status === 'new' || r.status === 'unavailable')
      lines.push(`| ${r.name} | | | | | ${icon[r.status]} |`);
    else {
      const change = `${r.ratio >= 1 ? '+' : ''}${((r.ratio - 1) * 100).toFixed(1)}%`;
      const slower = r.ratios.filter(x => x > 1).length;
      lines.push(`| ${r.name} | ${format(r.base, r.unit)} | ${format(r.head, r.unit)} | ${change} | ${slower}/${r.ratios.length} | ${(r.unit === 'MB' && memoryIcon[r.status]) || icon[r.status]} |`);
    }
  }
  return lines.join('\n');
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// Renders one or more compare.js result sets ({ settings, results }) as Markdown
function render(runs) {
  const { rounds, iterations, threshold } = runs[0].settings;
  if (runs.some(run => JSON.stringify(run.settings) !== JSON.stringify(runs[0].settings)))
    throw new Error('The result files were produced with different settings.');
  const results = runs.flatMap(run => run.results);
  const percent = Math.round(threshold * 100);
  function byStatus(status) {
    return results.filter(r => r.status === status);
  }
  const regressions = byStatus('regression'), errors = byStatus('error');
  const improvements = byStatus('improvement'), added = byStatus('new'), unchanged = byStatus('ok');
  const unavailable = byStatus('unavailable');

  const summary = [
    regressions.length ? `**${plural(regressions.length, 'regression')} above ${percent}%**` :
      `No regressions above ${percent}%`,
  ];
  if (errors.length) summary.push(`**${plural(errors.length, 'benchmark')} failed to run**`);
  if (improvements.length) summary.push(`${improvements.length} faster`);
  if (added.length) summary.push(`${added.length} new`);
  if (unavailable.length) summary.push(`${unavailable.length} not available`);
  summary.push(`${unchanged.length} unchanged`);

  const lines = [
    '## Performance comparison',
    '',
    `${summary.join(', ')} (${plural(results.length, 'benchmark')}).`,
    '',
  ];
  const notable = order.slice(0, -1).flatMap(byStatus);
  if (notable.length)
    lines.push(table(notable), '');
  if (unchanged.length) {
    lines.push(`<details><summary>${plural(unchanged.length, 'benchmark')} within ${percent}%</summary>`, '',
      table(unchanged), '', '</details>', '');
  }
  lines.push(`Head vs base over ${rounds} interleaved rounds, each the median of ${iterations} runs after ` +
    'warm-up in a fresh process. Flagged when the median per-round change and the change in median time both ' +
    `exceed ${percent}% and at least 80% of the rounds agree; a benchmark that looks flagged runs ${rounds} ` +
    'more rounds and has to stay flagged over all of them. Memory benchmarks are measured once per process, ' +
    'on the first run, and report MB instead of ms.');
  for (const r of errors) {
    for (const side of ['base', 'head']) {
      const error = r[`${side}Error`];
      if (error)
        lines.push('', `<details><summary>${r.name} failed on ${side}</summary>\n\n\`\`\`\n${error}\n\`\`\`\n</details>`);
    }
  }
  return { markdown: `${lines.join('\n')}\n`, failed: regressions.length > 0 || errors.length > 0 };
}

module.exports = { render, median };

if (require.main === module) {
  const files = [];
  let markdownFile;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--markdown') markdownFile = process.argv[++i];
    else files.push(process.argv[i]);
  }
  if (!files.length) {
    console.error('Usage: report.js [--markdown file] <results.json>...');
    process.exit(2);
  }
  // eslint-disable-next-line no-sync
  const { markdown, failed } = render(files.map(file => JSON.parse(fs.readFileSync(file, 'utf8'))));
  process.stdout.write(markdown);
  // eslint-disable-next-line no-sync
  if (markdownFile) fs.writeFileSync(markdownFile, markdown);
  process.exit(failed ? 1 : 0);
}
