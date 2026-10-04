// Benchmarks run by perf/ci/compare.js against a base and a head build.
// Each entry's setup(N3) does untimed preparation and returns the function
// whose run time is measured (it may return a promise), or { before, run }
// when every run needs fresh input: before() is untimed and its result is
// passed to run(). Size each one so a single run takes roughly 10–100ms on
// a CI runner.
//
// A benchmark for a feature the base branch does not have yet can be written
// as { available: N3 => <does this build have the feature>, setup }; it is
// then reported as new instead of failing. Any other failure on either build
// fails the comparison.
//
// A benchmark object can also set warmup and iterations (the number of runs
// measured), and memory: 'retained' to measure the heap its run's result
// still uses, or 'peak' to measure how much it raised the peak memory use.
// A memory benchmark is measured once per process and reports MB.
//
// Benchmark names start with the component they cover, which the comparison
// report groups by and --filter matches on.
module.exports = {
  ...require('./parser'),
  ...require('./writer'),
  ...require('./store'),
  ...require('./store-sets'),
  ...require('./datafactory'),
  ...require('./util'),
  ...require('./reasoner'),
  ...require('./large'),
};
