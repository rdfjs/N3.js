# Performance

## Regression check on pull requests

The [Performance workflow](../.github/workflows/perf.yml) builds the pull
request merged into its base branch, and the base branch commit it was merged
onto, in the same job and runs every benchmark in
[`ci/benchmarks.js`](ci/benchmarks.js) against both. Each measurement runs in
a fresh process; base and head are interleaved over 5 rounds so drift on the
shared runner hits both equally. A benchmark is flagged when head is more
than 10% slower in the median and in at least 4 of 5 rounds. The results
appear in the job summary and as a comment on the pull request, and the job
fails on a regression or when a benchmark fails to run on either build.

Run it locally against any other build of N3.js:

```sh
git worktree add ../n3-main main && (cd ../n3-main && npm ci && npm run build:node)
npm run build:node
node perf/ci/compare.js --base ../n3-main/lib --head lib
```

`--filter <text>` runs only the benchmarks whose name contains that text,
and `--rounds`, `--iterations` and `--threshold` tune the comparison.

### Covered

- **Parser** (and Lexer): N-Triples, N-Quads, Turtle (array and callback
  APIs), TriG, N3 (formulas, rules, quick variables, blank node property
  lists, lists), and Turtle 1.2 triple terms and reifiers.
- **Writer**: N-Triples, N-Quads, Turtle with prefixes, TriG, Turtle 1.2,
  and `blank()`/`list()` output.
- **Store**: `addQuad` with terms and with strings, `getQuads` by each
  position, `countQuads` and `has`, `match` and iteration, `removeQuad`.
- **DataFactory**: creating terms and quads, `literal()` from numbers,
  booleans and dates, term getters and `equals`,
  `termToId`/`termFromId`.
- **Reasoner**: the deep taxonomy benchmark at depth 1000.

### Not covered

Check these by hand (the scripts below help), or add a benchmark to
`ci/benchmarks.js`:

- `StreamParser` and `StreamWriter` on Node.js streams, and Web Streams.
- Parser options such as `blankNodePrefix`, `baseIRI` resolution of many
  relative IRIs, and very large documents (memory use is not measured).
- Store features: snapshots and views, `match()` semantics options,
  RDF 1.2 triple term indexing, `deleteGraph`, `removeMatches`, `getSubjects`
  and the other entity accessors, `EntityIndex` sharing between stores.
- `N3Util` helpers and `BaseIRI`.
- The browser bundles.

## Manual benchmarks

The other scripts in this directory measure specific components on larger
inputs, for example `node perf/N3Parser-perf.js file.ttl`,
`node perf/N3Store-perf.js` or `node perf/N3Reasoner-perf.js`. They require
a build (`npm run build`).
