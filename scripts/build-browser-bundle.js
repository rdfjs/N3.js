#!/usr/bin/env node
// Builds a minified browser bundle of src/index.js with esbuild:
//   node scripts/build-browser-bundle.js iife  ->  browser/n3.min.js
//     an IIFE exposing a global `N3`, so it keeps working when loaded
//     via <script> as `window.N3` (replaces the former browserify +
//     uglify-js pipeline, which pulled in the vulnerable crypto-browserify chain)
//   node scripts/build-browser-bundle.js esm   ->  browser/n3.esm.min.js
//     an ES module for `import` / <script type="module">
//
// esbuild requires Node >= 18, and Node < 18 cannot import the resulting `.js`
// ES module from this CommonJS package anyway (see test/esm-bundle-test.js), so
// on older Node we skip the bundle rather than fail the build. This also sidesteps
// the npm < 9 optional-dependency bug (e.g. Node 16 / npm 8) that omits esbuild's
// platform binary on a different-OS `npm ci`, which otherwise breaks the build.
const bundles = {
  iife: { format: 'iife', globalName: 'N3', outfile: 'browser/n3.min.js' },
  esm: { format: 'esm', outfile: 'browser/n3.esm.min.js' },
};

const bundle = bundles[process.argv[2]];
if (!bundle)
  throw new Error(`Usage: build-browser-bundle.js <${Object.keys(bundles).join('|')}>`);

const [major] = process.versions.node.split('.').map(Number);
if (major < 18)
  console.log(`Skipping browser bundle: Node ${process.versions.node} (< 18).`);
else {
  require('esbuild').buildSync({
    entryPoints: ['src/index.js'],
    bundle: true,
    minify: true,
    platform: 'browser',
    // Deliberate syntax floor for both bundles. The former browserify pipeline
    // bundled dependencies untranspiled, so the shipped bundle effectively
    // required ES2019 already; es2017 is more conservative than that.
    target: 'es2017',
    ...bundle,
  });
}
