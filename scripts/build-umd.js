#!/usr/bin/env node
// Builds the UMD/global browser bundle (browser/n3.min.js) with esbuild.
//
// This replaces the former browserify + uglify-js pipeline (which pulled in the
// vulnerable crypto-browserify chain). The bundle is an IIFE exposing a global
// `N3`, so it keeps working when loaded via <script> as `window.N3`.
//
// esbuild requires Node >= 18. On older Node we skip the bundle rather than fail
// the build (mirrors scripts/build-esm.js): this sidesteps the npm < 9 optional-
// dependency bug that omits esbuild's platform binary on a different-OS `npm ci`.
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.log(`Skipping UMD bundle: Node ${process.versions.node} (< 18).`);
  process.exit(0);
}

require('esbuild').buildSync({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'N3',
  minify: true,
  platform: 'browser',
  outfile: 'browser/n3.min.js',
});
