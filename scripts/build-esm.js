#!/usr/bin/env node
// Builds the ESM browser bundle (browser/n3.esm.min.js) with esbuild.
//
// esbuild requires Node >= 18, and Node < 18 cannot import the resulting `.js`
// ES module from this CommonJS package anyway (see test/esm-bundle-test.js), so
// on older Node we skip the bundle rather than fail the build. This also sidesteps
// the npm < 9 optional-dependency bug (e.g. Node 16 / npm 8) that omits esbuild's
// platform binary on a different-OS `npm ci`, which otherwise breaks the build.
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.log(`Skipping ESM bundle: Node ${process.versions.node} (< 18).`);
  process.exit(0);
}

require('esbuild').buildSync({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  platform: 'browser',
  outfile: 'browser/n3.esm.min.js',
});
