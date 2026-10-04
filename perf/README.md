# Performance

## Regression check on pull requests

The [Performance workflow](../.github/workflows/perf.yml) builds the pull
request merged into its base branch, and the base branch commit it was merged
onto, and runs every benchmark in [`ci/benchmarks`](ci/benchmarks) against
both. The benchmarks are spread over 6 parallel jobs (shards); each shard
builds both sides and compares them on its own runner. Each measurement runs
in a fresh process; base and head are interleaved over 5 rounds so drift on
the shared runner hits both equally. A benchmark is flagged when head is more
than 10% slower (or faster) both in the median of the per-round ratios and in
median time, and at least 4 of 5 rounds agree. Noise on shared runners occasionally
gets an unchanged benchmark past that bar, so a flagged benchmark runs 5 more
rounds and has to stay flagged over all 10.

A report job merges the shards into the job summary and a comment on the pull
request. The comment lists regressions, failures and speedups, and folds the
benchmarks that stayed within 10% into a collapsed section. The job fails on a
regression or when a benchmark fails to run on either build. Run one after
the other, the shards would take about 15 minutes; in parallel the whole run
takes about 5 minutes.

Run it locally against any other build of N3.js:

```sh
git worktree add ../n3-main main && (cd ../n3-main && npm ci && npm run build:node)
npm run build:node
node perf/ci/compare.js --base ../n3-main/lib --head lib
```

`--filter <text>` runs only the benchmarks whose name contains that text
(for example `--filter "store union"`), `--shard 2/6` runs one shard, and
`--rounds`, `--iterations` and `--threshold` tune the comparison. A full local
run takes about 15–20 minutes. `--json <file>` saves the results, and
`node perf/ci/report.js <file>...` renders one or more saved results.

### Writing a benchmark

Benchmarks live in `ci/benchmarks/<component>.js`, keyed by a name that
starts with the component. `setup(N3)` does untimed preparation and returns
the function to time, or `{ before, run }` when each run needs fresh input
(`before()` is untimed). Size each run to take 10–100ms; a larger benchmark
can measure fewer runs by also setting `warmup` and `iterations`. Setting
`memory: 'retained'` measures the heap that the run's result still uses after
garbage collection instead of time, and `memory: 'peak'` how far the run
raised the process's peak memory use; memory is measured once per process
and reported in MB. A benchmark for a
feature the base branch lacks declares `available(N3)`; it is reported as new
until the base has the feature, or as not available while neither build has
it. Inputs come from `ci/data.js` and `ci/helpers.js`, which generate them
without N3.js so both builds see identical data. Wrap generated input in
`lazy()` so that only the processes measuring a benchmark generate it.

### Covered

Every public class, function and method of the package, including:

- **Parser** and **Lexer**: N-Triples, N-Quads, Turtle (array and callback
  APIs), TriG, N3, Turtle 1.2; relative IRI resolution against `baseIRI`,
  escapes and long literals, many prefixes, `blankNodePrefix`,
  `explicitQuantifiers`, and the `onComment`, `onToken` and `onTokenEnd`
  callbacks; `Lexer.tokenize` in each mode.
- **StreamParser**: Turtle, N-Triples, TriG and N3 in Buffer chunks from 256
  bytes to 64 KB, input from a WHATWG `ReadableStream` (as `fetch()` returns)
  converted with `Readable.fromWeb`, and `import()`.
- **Writer** and **StreamWriter**: every format, prefixes, `baseIRI`,
  escaped literals, `blank()`/`list()`, `addPrefix`/`addPrefixes`,
  `quadToString`/`quadsToString`, N3 formulas, and `import()`.
- **Store**: adding, removing and querying quads, every pattern accessor
  (`getQuads`, `readQuads`, `countQuads`, `match`, `forEach`, `every`, `some`,
  `getSubjects` and `forSubjects` and their siblings), `removeMatches`,
  `deleteMatches`, `deleteGraph`, `import`/`remove` streams, `size`,
  `filter`/`map`/`reduce`, `toArray`/`toString`/`toStream`,
  `createBlankNode`, `extractLists`, RDF 1.2 triple terms, stores sharing an
  `EntityIndex`, `StoreFactory`, and `match()` views with each
  `matchSemantics`.
- **Store set operations**: `addAll`, `union`, `intersection`, `difference`,
  `contains`, `equals` and the constructor, each with the same store, an
  `N3.Store` sharing the `EntityIndex`, an `N3.Store` with its own index, a
  `match()` view, a dataset that is not an `N3.Store`, and an array where
  accepted; and the same operations called on a `match()` view.
- **DataFactory**: every factory method, literals from numbers, booleans and
  dates, term getters, `equals` with terms from another library,
  `fromTerm`/`fromQuad`, `toJSON`, `termToId`/`termFromId`.
- **Util** and **BaseIRI**: the term type checks, `prefix`/`prefixes`,
  `toRelative` and `supports`.
- **Reasoner**: the deep taxonomy benchmark at depth 1000, RDFS-style rules,
  and `getRulesFromDataset`.
- **Large documents** of about 200,000 triples: parsing N-Triples, streaming
  N-Triples and Turtle, writing N-Triples, and loading and querying a Store.
- **Memory use**: the peak while parsing 200,000 triples synchronously, while
  streaming them, and while streaming them through a StreamWriter; and the
  memory retained by 200,000 parsed quads and by a Store holding them.

### Not covered

- The browser bundles, which would need a headless browser in CI.

## Manual benchmarks

The other scripts in this directory measure specific components on larger
inputs, for example `node perf/N3Parser-perf.js file.ttl`,
`node perf/N3Store-perf.js` or `node perf/N3Reasoner-perf.js`. They require
a build (`npm run build`).
