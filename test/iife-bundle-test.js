import {
  expectBrowserBundleMembers,
  expectBrowserBundleParser,
  expectBrowserBundleWriter,
} from './browser-bundle-support';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { runInThisContext } from 'vm';

// The IIFE bundle exposes `N3` to classic browser scripts.
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'browser/n3.min.js');

// esbuild (which builds the bundle) requires Node >= 18; on older Node the build
// script skips the bundle, so only assert it on Node >= 18.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const describeIife = nodeMajor >= 18 ? describe : describe.skip;

describeIife('The IIFE browser bundle', () => {
  let N3;

  beforeAll(() => {
    if (!existsSync(bundlePath))
      execSync('npm run build:browser:iife', { cwd: root });
    // The bundle is `var N3=(()=>{...})();`; evaluating it in this realm (which
    // has the standard globals the bundle relies on) and appending `;N3` returns
    // the global object a browser would expose as `window.N3`.
    N3 = runInThisContext(`${readFileSync(bundlePath, 'utf8')}\n;N3`);
  }, 60000);

  it('exposes all named members', () => {
    expect.hasAssertions();
    expectBrowserBundleMembers(N3);
  });

  it('parses Turtle into a populated Store', () => {
    expect.hasAssertions();
    expectBrowserBundleParser(N3);
  });

  it('round-trips a quad through the Writer', () => {
    expect.hasAssertions();
    return expectBrowserBundleWriter(N3);
  });
});
