import N3Store from '../src/N3Store';
import N3DatasetCoreFactory from '../src/N3StoreFactory';
import DF from '../src/N3DataFactory';

const { quad, namedNode } = DF;

describe('N3DatasetCoreFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new N3DatasetCoreFactory();
  });

  it('should create a new dataset with given quads', () => {
    const quads = [
      quad(namedNode('http://example.org/subject1'), namedNode('http://example.org/predicate1'), namedNode('http://example.org/object1')),
      quad(namedNode('http://example.org/subject2'), namedNode('http://example.org/predicate2'), namedNode('http://example.org/object2')),
    ];

    const dataset = factory.dataset(quads);

    expect(dataset).toBeInstanceOf(N3Store);
    expect([...dataset.match(namedNode('http://example.org/subject1'))]).toEqual([quads[0]]);
  });
});
