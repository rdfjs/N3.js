import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);
const root = resolve(__dirname, '..');
const fixture = resolve(__dirname, 'fixtures/store-memory.js');

describe.each(['snapshot', 'forwarded'])('Store %s view memory', matchSemantics => {
  it.each(['transient', 'nested', 'parent', 'reasoner', 'iterator', 'stream', 'abandoned'])(
    'reclaims discarded objects and registrations in the %s scenario',
    async scenario => {
      // Test real collection outside Jest's module registry and without requiring
      // --expose-gc on the main test runner. Load source, never a stale lib build.
      const { stdout } = await run(process.execPath, [
        '--expose-gc', '--require', '@babel/register', fixture, scenario, matchSemantics,
      ], { cwd: root, timeout: 25000 });
      expect(JSON.parse(stdout)).toMatchObject({ scenario, matchSemantics });
      expect(JSON.parse(stdout).collected).toBeGreaterThan(0);
    }, 30000,
  );
});
