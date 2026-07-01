import { exec } from 'child_process';
import { access } from 'fs/promises';
import { resolve } from 'path';
import { promisify } from 'util';

// The ESM bundle is a build artifact (browser/n3.esm.min.js). CI builds it via
// the `prepare` script; when running tests in isolation we build it on demand.
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'browser/n3.esm.min.js');

// Node < 18 cannot import a `.js` ES module from a CommonJS package (ES-module
// syntax detection for `.js` files only exists on Node >= 18), so dynamically
// importing the bundle throws there. The bundle targets browsers/CDNs, so the
// import is only exercised on Node >= 18.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const describeEsm = nodeMajor >= 18 ? describe : describe.skip;

const expectedExports = [
  'Lexer', 'Parser', 'Writer', 'Store', 'StoreFactory', 'EntityIndex',
  'StreamParser', 'StreamWriter', 'Util', 'Reasoner', 'BaseIRI',
  'DataFactory', 'Term', 'NamedNode', 'Literal', 'BlankNode', 'Variable',
  'DefaultGraph', 'Quad', 'Triple', 'termFromId', 'termToId',
  'getRulesFromDataset',
];

describeEsm('The ESM browser bundle', () => {
  let N3;

  beforeAll(async () => {
    const exists = await access(bundlePath).then(() => true, () => false);
    if (!exists)
      await promisify(exec)('npm run build:browser:esm', { cwd: root });
    // eslint-disable-next-line import-x/dynamic-import-chunkname
    N3 = await import(bundlePath);
  }, 60000);

  it('exposes all named exports', () => {
    for (const name of expectedExports)
      expect(N3[name]).toBeDefined();
  });

  it('exposes a default export with the same members', () => {
    expect(N3.default).toBeDefined();
    expect(N3.default.Store).toBe(N3.Store);
    expect(N3.default.Parser).toBe(N3.Parser);
  });

  it('parses Turtle into a populated Store', () => {
    const quads = new N3.Parser().parse(
      '<http://ex.org/s> <http://ex.org/p> <http://ex.org/o> .');
    const store = new N3.Store(quads);
    expect(quads).toHaveLength(1);
    expect(store.size).toBe(1);
    expect(quads[0].subject.value).toBe('http://ex.org/s');
  });

  it('round-trips a quad through the Writer', async () => {
    const { DataFactory, Writer } = N3;
    const writer = new Writer();
    writer.addQuad(DataFactory.quad(
      DataFactory.namedNode('http://ex.org/s'),
      DataFactory.namedNode('http://ex.org/p'),
      DataFactory.literal('o')));
    const result = await promisify(writer.end.bind(writer))();
    expect(result).toContain('<http://ex.org/s>');
  });
});
