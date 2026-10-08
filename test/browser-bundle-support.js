import { promisify } from 'util';

const browserBundleMembers = [
  'Lexer', 'Parser', 'Writer', 'Store', 'StoreFactory', 'EntityIndex',
  'StreamParser', 'StreamWriter', 'Util', 'Reasoner', 'BaseIRI',
  'DataFactory', 'termFromId', 'termToId',
  'getRulesFromDataset',
];

// The term classes are internal: their constructors take N3.js's own id strings
const internalMembers = [
  'Term', 'NamedNode', 'Literal', 'BlankNode', 'Variable',
  'DefaultGraph', 'Quad', 'Triple',
];

export function expectBrowserBundleMembers(N3) {
  expect(N3).toBeDefined();
  for (const name of browserBundleMembers)
    expect(N3[name]).toBeDefined();
  expectNoInternalMembers(N3);
}

export function expectNoInternalMembers(N3) {
  for (const exports of [N3, N3.default]) {
    expect(exports).toBeDefined();
    for (const name of internalMembers)
      expect(exports).not.toHaveProperty(name);
  }
}

export function expectBrowserBundleParser(N3) {
  const quads = new N3.Parser().parse(
    '<http://ex.org/s> <http://ex.org/p> <http://ex.org/o> .');
  const store = new N3.Store(quads);
  expect(quads).toHaveLength(1);
  expect(store.size).toBe(1);
  expect(quads[0].subject.value).toBe('http://ex.org/s');
}

export async function expectBrowserBundleWriter(N3) {
  const { DataFactory, Writer } = N3;
  const writer = new Writer();
  writer.addQuad(DataFactory.quad(
    DataFactory.namedNode('http://ex.org/s'),
    DataFactory.namedNode('http://ex.org/p'),
    DataFactory.literal('o')));
  const result = await promisify(writer.end.bind(writer))();
  expect(result).toContain('<http://ex.org/s>');
}
