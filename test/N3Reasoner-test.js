import { Quad, NamedNode, Variable, Store, Reasoner, getRulesFromDataset, Parser } from '../src';
import { getTimblAndFoaf, generateDeepTaxonomy, getRdfs, TARGET_RESULT } from 'deep-taxonomy-benchmark';

describe('Reasoner', () => {
  let RDFS_RULE, SUBCLASS_RULE;

  beforeEach(async () => {
    RDFS_RULE = await getRdfs();
    SUBCLASS_RULE = getRulesFromDataset(new Store((new Parser({ format: 'text/n3' })).parse('{ ?s a ?o . ?o <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o2 . } => { ?s a ?o2 . } .')));
  });

  describe('Testing Reasoning', () => {
    let store;
    beforeEach(() => {
      store = new Store([
        new Quad(
          new NamedNode('http://example.org/s'),
          new NamedNode('a'),
          new NamedNode('http://example.org/o'),
        ),
        new Quad(
          new NamedNode('http://example.org/o'),
          new NamedNode('subClassOf'),
          new NamedNode('http://example.org/o2'),
        ),
      ]);
    });

    it('Should apply rules', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new Variable('?s'),
          new NamedNode('a'),
          new Variable('?o'),
        ), new Quad(
          new Variable('?o'),
          new NamedNode('subClassOf'),
          new Variable('?o2'),
        )],
        conclusion: [
          new Quad(
            new Variable('?s'),
            new NamedNode('a'),
            new Variable('?o2'),
          ),
        ],
      }]);
      expect(store.size).toEqual(3);
      expect(store.has(
        new Quad(
          new NamedNode('http://example.org/s'),
          new NamedNode('a'),
          new NamedNode('http://example.org/o2'),
        ),
      )).toEqual(true);
    });

    it('Should apply rules containing variables only (flip subject and predicate)', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new Variable('?s'),
          new Variable('?a'),
          new Variable('?o'),
        )],
        conclusion: [
          new Quad(
            new Variable('?o'),
            new Variable('?a'),
            new Variable('?s'),
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
          new Variable('?s'),
        )],
        conclusion: [
          new Quad(
            new NamedNode('http://example.org/s'),
            new Variable('?s'),
            new Variable('?a'),
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
          new NamedNode('http://example.org/o'),
        )],
        conclusion: [
          new Quad(
            new Variable('?a'),
            new Variable('?s'),
            new NamedNode('http://example.org/o'),
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
          new NamedNode('http://example.org/o'),
        )],
        conclusion: [
          new Quad(
            new NamedNode('http://example.org/s'),
            new NamedNode('has'),
            new NamedNode('oProp'),
          ),
        ],
      }]);
      expect(store.has(new Quad(
        new NamedNode('http://example.org/s'),
        new NamedNode('has'),
        new NamedNode('oProp'),
      ))).toEqual(true);
      expect(store.size).toEqual(3);
    });

    it('Should apply rules containing variables only (circular and flipped)', () => {
      expect(store.size).toEqual(2);
      new Reasoner(store).reason([{
        premise: [new Quad(
          new Variable('?s'),
          new Variable('?a'),
          new Variable('?o'),
        )],
        conclusion: [
          new Quad(
            new Variable('?o'),
            new Variable('?s'),
            new Variable('?a'),
          ),
        ],
      }, {
        premise: [new Quad(
          new Variable('?s'),
          new Variable('?a'),
          new Variable('?o'),
        )],
        conclusion: [
          new Quad(
            new Variable('?o'),
            new Variable('?a'),
            new Variable('?s'),
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
          new NamedNode('http://example.org/o'),
        )],
        conclusion: [
          new Quad(
            new NamedNode('http://example.org/sm'),
            new Variable('?a'),
            new NamedNode('http://example.org/om'),
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
        new NamedNode('http://xmlns.com/foaf/0.1/Person'),
      ),
      new Quad(
        new NamedNode('http://example.org#me'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://xmlns.com/foaf/0.1/Person'),
      ),
      new Quad(
        new NamedNode('http://xmlns.com/foaf/0.1/Person'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing'),
      ),
    ]);
    expect(store.size).toEqual(3);
    new Reasoner(store).reason([{
      premise: [new Quad(
        new Variable('?s'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?o'),
      ), new Quad(
        new Variable('?o'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new Variable('?o2'),
      )],
      conclusion: [
        new Quad(
          new Variable('?s'),
          new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          new Variable('?o2'),
        ),
      ],
    }]);
    expect(store.has(
      new Quad(
        new NamedNode('http://example.org#me'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing'),
      ),
    )).toEqual(true);
    expect(store.size).toEqual(4);
  });

  it('Should apply the range property correctly', () => {
    const store = new Store(
      [
        new Quad(
        new NamedNode('j'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('o'),
      ),
        new Quad(
        new NamedNode('o'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new NamedNode('o2'),
      ),
        new Quad(
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#Class'),
      )],
    );

    new Reasoner(store).reason([
      {
        premise: [
          new Quad(
          new Variable('?s'),
          new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          new Variable('?o'),
        ), new Quad(
          new Variable('?o'),
          new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
          new Variable('?o2'),
        )],
        conclusion: [
          new Quad(
            new Variable('?s'),
            new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            new Variable('?o2'),
          ),
        ],
      },
      {
        premise: [new Quad(
          new Variable('?a'),
          new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
          new Variable('?x'),
        ), new Quad(
          new Variable('?u'), // With rules like this, we *do not* need to iterate over the subject index, so we should avoid doing so
          new Variable('?a'),
          new Variable('?v'),
        )],
        conclusion: [
          new Quad(
            new Variable('?v'),
            new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            new Variable('?x'),
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

      return expect(store.has(TARGET_RESULT)).toEqual(true);
    }
  });

  it('Should correctly apply RDFS to TimBL profile and FOAF', async () => {
    const store = new Store([...await getTimblAndFoaf()]);

    new Reasoner(store).reason(RDFS_RULE);
    return expect(store.size).toEqual(1830);
  });

  describe('Reasoning budgets', () => {
    // A transitive-closure rule over a chain of n edges derives O(n^2) quads
    function chainStore(n) {
      let doc = '@prefix : <http://example.org/>.\n';
      for (let i = 0; i < n; i++) doc += `:x${i} :r :x${i + 1}.\n`;
      return new Store(new Parser({ format: 'text/n3' }).parse(doc));
    }
    function transitiveRule() {
      return getRulesFromDataset(new Store(new Parser({ format: 'text/n3' }).parse(
        '@prefix : <http://example.org/>. { ?x :r ?y. ?y :r ?z } => { ?x :r ?z }.')));
    }

    it('Should fail when reasoning exceeds maxDerivations', () => {
      const store = chainStore(400);
      expect(() => new Reasoner(store, { maxDerivations: 1000 }).reason(transitiveRule()))
        .toThrow('Reasoning exceeded the maximum of 1000 derivations');
    });

    it('Should leave the store consistent after a caught maxDerivations error', () => {
      const store = chainStore(400);
      expect(() => new Reasoner(store, { maxDerivations: 1000 }).reason(transitiveRule()))
        .toThrow('Reasoning exceeded the maximum of 1000 derivations');
      // Every quad reachable through the subject index must also be reachable
      // through the predicate and object indexes, and the size must match
      const quads = store.getQuads(null, null, null);
      expect(store.size).toBe(quads.length);
      for (const quad of quads) {
        expect(store.getQuads(null, quad.predicate, null).some(q => q.equals(quad))).toBe(true);
        expect(store.getQuads(null, null, quad.object).some(q => q.equals(quad))).toBe(true);
      }
    });

    it('Should reason normally within a generous maxDerivations budget', () => {
      const store = chainStore(50);
      new Reasoner(store, { maxDerivations: 100000 }).reason(transitiveRule());
      expect(store.size).toBe(1275);
    });

    it('Should reason normally with the default unbounded budgets', () => {
      const store = chainStore(50);
      new Reasoner(store).reason(transitiveRule());
      expect(store.size).toBe(1275);
    });

    it('Should reject a rule whose premise count exceeds maxPremiseDepth', () => {
      let body = '';
      for (let i = 0; i < 20; i++) body += `?x :r${i} ?y${i}. `;
      const rules = getRulesFromDataset(new Store(new Parser({ format: 'text/n3' }).parse(
        `@prefix : <http://example.org/>. { ${body}} => { ?x :big :thing }.`)));
      expect(() => new Reasoner(chainStore(2), { maxPremiseDepth: 5 }).reason(rules))
        .toThrow('Reasoning rule exceeds the maximum premise depth of 5');
    });

    it('Should accept a rule whose premise count equals maxPremiseDepth', () => {
      const store = chainStore(50);
      new Reasoner(store, { maxPremiseDepth: 2 }).reason(transitiveRule());
      expect(store.size).toBe(1275);
    });
  });

  it('Should apply a multi-premise rule whose middle premise has a bound third position', () => {
    const store = new Store([
      new Quad(new NamedNode('http://example.org/m'), new NamedNode('http://example.org/rel'), new NamedNode('http://example.org/n')),
      new Quad(new NamedNode('http://example.org/n'), new NamedNode('http://example.org/rel'), new NamedNode('http://example.org/m')),
      new Quad(new NamedNode('http://example.org/m'), new NamedNode('http://example.org/tail'), new NamedNode('http://example.org/z')),
    ]);
    expect(store.size).toEqual(3);
    new Reasoner(store).reason([{
      premise: [
        new Quad(new Variable('?a'), new Variable('?p'), new Variable('?b')),
        new Quad(new Variable('?b'), new Variable('?p'), new Variable('?a')),
        new Quad(new Variable('?a'), new NamedNode('http://example.org/tail'), new Variable('?z')),
      ],
      conclusion: [
        new Quad(new Variable('?a'), new NamedNode('http://example.org/out'), new Variable('?z')),
      ],
    }]);
    expect(store.size).toEqual(4);
    expect(store.has(new Quad(
      new NamedNode('http://example.org/m'),
      new NamedNode('http://example.org/out'),
      new NamedNode('http://example.org/z'),
    ))).toEqual(true);
  });
});
