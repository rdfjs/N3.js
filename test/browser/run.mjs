#!/usr/bin/env node
// Runs the browser bundles in real browser engines (issue #516).
//
// Serves the repository over local HTTP (file:// URLs cannot load ES modules),
// opens test-page.html in Chromium, Firefox and WebKit via Playwright, and
// checks that both bundles (browser/n3.min.js via <script>, and
// browser/n3.esm.min.js via import()) survive a parse -> write -> parse round
// trip. Standalone on purpose: jest's coverage gate measures src/, whereas
// this exercises the built artifacts.
//
// Usage: node test/browser/run.mjs [chromium|firefox|webkit ...]
import { chromium, firefox, webkit } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const browsers = { chromium, firefox, webkit };
const root = resolve(fileURLToPath(import.meta.url), '../../..');
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const files = new Map([
  ['/test/browser/test-page.html', join(root, 'test/browser/test-page.html')],
  ['/browser/n3.min.js', join(root, 'browser/n3.min.js')],
  ['/browser/n3.esm.min.js', join(root, 'browser/n3.esm.min.js')],
]);

async function main() {
  // The bundles are build artifacts; CI downloads them, local runs may not have them yet
  if (!existsSync(join(root, 'browser/n3.min.js')) ||
      !existsSync(join(root, 'browser/n3.esm.min.js')))
    execSync('npm run build:browser', { cwd: root, stdio: 'inherit' });

  // Serve files from the repository root on an OS-assigned port
  const server = createServer((request, response) => {
    const filePath = files.get(new URL(request.url || '/', 'http://localhost').pathname);
    try {
      const contents = readFileSync(filePath);
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
      response.end(contents);
    }
    catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise(listening => server.listen(0, '127.0.0.1', listening));
  const pageUrl = `http://127.0.0.1:${server.address().port}/test/browser/test-page.html`;

  let failures = 0;
  try {
    const engines = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(browsers);
    for (const engine of engines) {
      if (!browsers[engine])
        throw new Error(`Unknown browser engine: ${engine}`);
      const browser = await browsers[engine].launch();
      try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(String(error)));
        await page.goto(pageUrl);
        // The test page reports its results through this global
        const results = await page.waitForFunction('window.__bundleTestResults',
          null, { timeout: 30_000 }).then(handle => handle.jsonValue())
          .catch(() => [{ name: 'test page', passed: false,
            error: `never reported results; page errors: ${pageErrors.join('; ') || 'none'}` }]);
        for (const { name, passed, error } of results) {
          failures += passed ? 0 : 1;
          console.log(`${passed ? 'ok     ' : 'FAILED '} ${engine.padEnd(8)} ${name}${passed ? '' : `\n${error}`}`);
        }
      }
      finally {
        await browser.close();
      }
    }
  }
  finally {
    await new Promise((closed, reject) => server.close(error => error ? reject(error) : closed()));
  }
  if (failures > 0) {
    console.error(`\n${failures} browser bundle test(s) failed`);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
