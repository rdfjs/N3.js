import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { runInThisContext } from 'vm';

// The UMD bundle is a build artifact (browser/n3.min.js): an IIFE that exposes a
// global `N3`, consumed in browsers via <script> as `window.N3`. CI builds it via
// the `prepare` script; when running tests in isolation we build it on demand.
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'browser/n3.min.js');

// esbuild (which builds the bundle) requires Node >= 18; on older Node the build
// script skips the bundle, so only assert it on Node >= 18.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const describeUmd = nodeMajor >= 18 ? describe : describe.skip;

const expectedMembers = [
  'Lexer', 'Parser', 'Writer', 'Store', 'StoreFactory', 'EntityIndex',
  'StreamParser', 'StreamWriter', 'Util', 'Reasoner', 'BaseIRI',
  'DataFactory', 'Term', 'NamedNode', 'Literal', 'BlankNode', 'Variable',
  'DefaultGraph', 'Quad', 'Triple', 'termFromId', 'termToId',
  'getRulesFromDataset',
];

describeUmd('The UMD browser bundle', () => {
  let N3;

  beforeAll(() => {
    if (!existsSync(bundlePath))
      execSync('npm run build:browser:umd', { cwd: root });
    // The bundle is `var N3=(()=>{...})();`; evaluating it in this realm (which
    // has the standard globals the bundle relies on) and appending `;N3` returns
    // the global object a browser would expose as `window.N3`.
    N3 = runInThisContext(`${readFileSync(bundlePath, 'utf8')}\n;N3`);
  }, 60000);

  it('exposes a global object with all named members', () => {
    expect(N3).toBeDefined();
    for (const name of expectedMembers)
      expect(N3[name]).toBeDefined();
  });

  it('parses Turtle into a populated Store', () => {
    const quads = new N3.Parser().parse(
      '<http://ex.org/s> <http://ex.org/p> <http://ex.org/o> .');
    const store = new N3.Store(quads);
    expect(quads).toHaveLength(1);
    expect(store.size).toBe(1);
    expect(quads[0].subject.value).toBe('http://ex.org/s');
  });

  it('round-trips a quad through the Writer', done => {
    const { DataFactory, Writer } = N3;
    const writer = new Writer();
    writer.addQuad(DataFactory.quad(
      DataFactory.namedNode('http://ex.org/s'),
      DataFactory.namedNode('http://ex.org/p'),
      DataFactory.literal('o')));
    writer.end((error, result) => {
      expect(error).toBeFalsy();
      expect(result).toContain('<http://ex.org/s>');
      done();
    });
  });
});
