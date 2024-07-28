import { Quad, NamedNode, Variable, Store, Reasoner } from '../src/';
import { getTimblAndFoaf } from 'deep-taxonomy-benchmark';
import { SUBCLASS_RULE, RDFS_RULE, generateDeepTaxonomy } from '../test/util';

describe('Reasoner', () => {
  describe('Testing Reasoning', () => {
    let store;
    beforeEach(() => {
      store = new Store([
        new Quad(
          new NamedNode('http://example.org/s'),
          new NamedNode('a'),
          new NamedNode('http://example.org/o')
        ),
        new Quad(
          new NamedNode('http://example.org/o'),
          new NamedNode('subClassOf'),
          new NamedNode('http://example.org/o2')
        ),
      ]);
    });

    it('Should apply rules', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new Variable('?s'),
          new NamedNode('a'),
          new Variable('?o')
        ), new Quad(
          new Variable('?o'),
          new NamedNode('subClassOf'),
          new Variable('?o2')
        )],
        conclusion: [
          new Quad(
            new Variable('?s'),
            new NamedNode('a'),
            new Variable('?o2')
          ),
        ],
      }]);
      expect(store.size).toEqual(3);
      expect(store.has(
        new Quad(
          new NamedNode('http://example.org/s'),
          new NamedNode('a'),
          new NamedNode('http://example.org/o2')
        )
      )).toEqual(true);
    });

    it('Should apply rules containing variables only (flip subject and predicate)', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new Variable('?s'),
          new Variable('?a'),
          new Variable('?o')
        )],
        conclusion: [
          new Quad(
            new Variable('?o'),
            new Variable('?a'),
            new Variable('?s')
          ),
        ],
      }]);
      expect(store.size).toEqual(4);
    });

    it('Same subject and flipping predicate and object', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new NamedNode('http://example.org/s'),
          new Variable('?a'),
          new Variable('?s')
        )],
        conclusion: [
          new Quad(
            new NamedNode('http://example.org/s'),
            new Variable('?s'),
            new Variable('?a')
          ),
        ],
      }]);
      expect(store.size).toEqual(3);
    });

    it('Same object and flipping predicate and subject', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new Variable('?s'),
          new Variable('?a'),
          new NamedNode('http://example.org/o')
        )],
        conclusion: [
          new Quad(
            new Variable('?a'),
            new Variable('?s'),
            new NamedNode('http://example.org/o')
          ),
        ],
      }]);
      expect(store.size).toEqual(3);
    });

    it('Rule with no variables', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new NamedNode('http://example.org/s'),
          new NamedNode('a'),
          new NamedNode('http://example.org/o')
        )],
        conclusion: [
          new Quad(
            new NamedNode('http://example.org/s'),
            new NamedNode('has'),
            new NamedNode('oProp')
          ),
        ],
      }]);
      expect(store.has(new Quad(
        new NamedNode('http://example.org/s'),
        new NamedNode('has'),
        new NamedNode('oProp')
      ))).toEqual(true);
      expect(store.size).toEqual(3);
    });

    it('Should apply rules containing variables only (circular and flipped)', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new Variable('?s'),
          new Variable('?a'),
          new Variable('?o')
        )],
        conclusion: [
          new Quad(
            new Variable('?o'),
            new Variable('?s'),
            new Variable('?a')
          ),
        ],
      }, {
        premise: [new Quad(
          new Variable('?s'),
          new Variable('?a'),
          new Variable('?o')
        )],
        conclusion: [
          new Quad(
            new Variable('?o'),
            new Variable('?a'),
            new Variable('?s')
          ),
        ],
      }]);
      expect(store.size).toEqual(12);
    });

    it('Should apply rules with only predicate as variable', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new NamedNode('http://example.org/s'),
          new Variable('?a'),
          new NamedNode('http://example.org/o')
        )],
        conclusion: [
          new Quad(
            new NamedNode('http://example.org/sm'),
            new Variable('?a'),
            new NamedNode('http://example.org/om')
          ),
        ],
      }]);
      expect(store.size).toEqual(3);
    });
  });


  it('Should apply to URLS', () => {
    const store = new Store([
      new Quad(
        new NamedNode('http://example.org#me'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#other'),
        new NamedNode('http://xmlns.com/foaf/0.1/Person')
      ),
      new Quad(
        new NamedNode('http://example.org#me'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://xmlns.com/foaf/0.1/Person')
      ),
      new Quad(
        new NamedNode('http://xmlns.com/foaf/0.1/Person'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing')
      ),
    ]);
    expect(store.size).toEqual(3);
    new Reasoner(store).reason([{
      premise: [new Quad(
        new Variable('?s'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?o')
      ), new Quad(
        new Variable('?o'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new Variable('?o2')
      )],
      conclusion: [
        new Quad(
          new Variable('?s'),
          new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          new Variable('?o2')
        ),
      ],
    }]);
    expect(store.has(
      new Quad(
        new NamedNode('http://example.org#me'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing')
      )
    )).toEqual(true);
    expect(store.size).toEqual(4);
  });

  it('Should apply the range property correctly', () => {
    const store = new Store(
      [
        new Quad(
        new NamedNode('j'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('o')
      ),
        new Quad(
        new NamedNode('o'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new NamedNode('o2')
      ),
        new Quad(
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#Class')
      )]
    );

    new Reasoner(store).reason([
      {
        premise: [
          new Quad(
          new Variable('?s'),
          new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          new Variable('?o')
        ), new Quad(
          new Variable('?o'),
          new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
          new Variable('?o2')
        )],
        conclusion: [
          new Quad(
            new Variable('?s'),
            new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            new Variable('?o2')
          ),
        ],
      },
      {
        premise: [new Quad(
          new Variable('?a'),
          new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
          new Variable('?x')
        ), new Quad(
          new Variable('?u'), // With rules like this we *do not* need to iterate over the subject index so we should avoid doing so
          new Variable('?a'),
          new Variable('?v')
        )],
        conclusion: [
          new Quad(
            new Variable('?v'),
            new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            new Variable('?x')
          ),
        ],
      },
    ]);

    expect(store.size).toEqual(7);
  });

  it('Should correctly apply the deep taxonomy benchmark', async () => {
    for (let i = 0; i < 5; i++) {
      const store = generateDeepTaxonomy(10 ** i);

      new Reasoner(store).reason(SUBCLASS_RULE);

      return expect(store.has(
        new Quad(
          new NamedNode('http://eulersharp.sourceforge.net/2009/12dtb/test#ind'),
          new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          new NamedNode('http://eulersharp.sourceforge.net/2009/12dtb/test#A2')
        ),
      )).toEqual(true);
    }
  });

  it('Should correctly apply RDFS to TimBL profile and FOAF', async function () {
    const store = new Store([...await getTimblAndFoaf()]);
  
    new Reasoner(store).reason(RDFS_RULE);
    return expect(store.size).toEqual(1712);
  });
});
