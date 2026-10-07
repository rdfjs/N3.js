import { Store, Reasoner, getRulesFromDataset, Parser } from '../src';
import { Quad, NamedNode, Variable } from '../src/N3DataFactory';
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

  it('Should treat variables named like built-in object members as ordinary variables', () => {
    const store = new Store(new Parser({ format: 'text/n3' }).parse(
      '@prefix : <http://example.org/>. :a :p :b. :c :p :d.'));
    const rules = getRulesFromDataset(new Store(new Parser({ format: 'text/n3' }).parse(
      '@prefix : <http://example.org/>. { ?toString :p ?constructor } => { ?constructor :q ?toString }.')));
    new Reasoner(store).reason(rules);
    expect(store.has(new Quad(new NamedNode('http://example.org/b'), new NamedNode('http://example.org/q'), new NamedNode('http://example.org/a')))).toBe(true);
    expect(store.has(new Quad(new NamedNode('http://example.org/d'), new NamedNode('http://example.org/q'), new NamedNode('http://example.org/c')))).toBe(true);
    expect(store.size).toBe(4);

    const [rule] = rules.map(r => new Reasoner(store)._createRule(r));
    expect(rule.variables).toHaveLength(2);
    for (const variable of rule.variables)
      expect(typeof variable).toBe('object');
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

    it('Should keep the size of a store from another copy of N3', () => {
      let OtherStore;
      jest.isolateModules(() => { OtherStore = require('../src').Store; });
      const store = new OtherStore(chainStore(10).getQuads());
      expect(store).not.toBeInstanceOf(Store);
      new Reasoner(store).reason([]);
      expect(store.size).toBe(10);
      new Reasoner(store).reason(transitiveRule());
      expect(store.size).toBe(55);
      expect(store.getQuads()).toHaveLength(55);
    });

    it('Should keep the size of a store whose size an earlier version of N3 marked as stale', () => {
      const store = chainStore(10);
      // Earlier versions set `_size` to null after changes, and count again when it is read
      store._size = null;
      new Reasoner(store).reason(transitiveRule());
      expect(store._size).toBe(null);
      expect(store.size).toBe(55);
      expect(store.getQuads()).toHaveLength(55);
    });

    it('Should keep the size of a store used by a reasoner from an earlier version of N3', () => {
      const store = chainStore(10);
      // Earlier reasoners add to the indexes directly, then set `_size` to null
      const graph = store._graphs[Object.keys(store._graphs)[0]];
      const [s, p, o] = [0, 1, 2].map(i => store._termToNewNumericId(new NamedNode(`http://example.org/new${i}`)));
      store._addToIndex(graph.subjects, s, p, o);
      store._addToIndex(graph.predicates, p, o, s);
      store._addToIndex(graph.objects, o, s, p);
      store._size = null;
      store.addQuad(new NamedNode('http://example.org/a'), new NamedNode('http://example.org/b'), new NamedNode('http://example.org/c'));
      expect(store.size).toBe(12);
      store.addQuad(new NamedNode('http://example.org/a'), new NamedNode('http://example.org/b'), new NamedNode('http://example.org/d'));
      expect(store.size).toBe(13);
      expect(store.getQuads()).toHaveLength(13);
    });

    it('Should count a store marked as stale by an earlier version of N3 after merging into it', () => {
      const [a, p, b, c] = ['a', 'p', 'b', 'c'].map(name => new NamedNode(`http://example.org/${name}`));
      const store = new Store([new Quad(a, p, b)]);
      store._size = null;
      store.addAll(new Store([new Quad(b, p, c)], { entityIndex: store._entityIndex }));
      expect(store._size).toBe(null);
      expect(store.size).toBe(2);
    });

    it('Should keep quads from a reasoner from an earlier version of N3 when merging stores', () => {
      const [a, p, b, c] = ['a', 'p', 'b', 'c'].map(name => new NamedNode(`http://example.org/${name}`));
      const store = new Store([new Quad(a, p, b), new Quad(b, p, c)]);
      // An earlier reasoner derives a p c through the indexes, then sets `_size` to null
      const graph = store._graphs[Object.keys(store._graphs)[0]];
      const [aId, pId, cId] = [a, p, c].map(term => store._termToNewNumericId(term));
      store._addToIndex(graph.subjects, aId, pId, cId);
      store._addToIndex(graph.predicates, pId, cId, aId);
      store._addToIndex(graph.objects, cId, aId, pId);
      store._size = null;
      store.removeQuad(new Quad(a, p, b));
      store.removeQuad(new Quad(b, p, c));
      const other = new Store({ entityIndex: store._entityIndex });
      other.addAll(store);
      expect(other.has(new Quad(a, p, c))).toBe(true);
      expect(other.size).toBe(1);
      expect(store.union(other).size).toBe(1);
    });

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

    it('Should leave observing views consistent after a caught maxDerivations error', () => {
      const store = chainStore(400);
      const original = store.getQuads();
      const options = { matchSemantics: 'forwarded' };
      const materialized = store.match(null, null, null, null, options);
      expect(materialized.size).toBe(400);
      const unread = store.match(null, null, null, null, options);
      const snapshot = store.match(null, null, null, null, { matchSemantics: 'snapshot' });
      const iterator = store.match(null, null, null, null, options)[Symbol.iterator]();
      const first = iterator.next().value;

      expect(() => new Reasoner(store, { maxDerivations: 1000 }).reason(transitiveRule()))
        .toThrow('Reasoning exceeded the maximum of 1000 derivations');
      // The derivation that exceeded the budget remains indexed and observed
      expect(store.size).toBe(1401);
      expect(store.equals(materialized)).toBe(true);
      expect(store.equals(unread)).toBe(true);
      expect(snapshot.size).toBe(400);
      expect([first, ...iterator]).toEqual(original);
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

  it.each(['snapshot', 'forwarded'])('Should notify observing %s views of derived quads', matchSemantics => {
    function ex(name) {
      return new NamedNode(`http://example.org/${name}`);
    }
    const rules = [{
      premise: [new Quad(new Variable('x'), ex('p'), ex('o'))],
      conclusion: [new Quad(new Variable('x'), ex('q'), ex('o'))],
    }];
    const original = [
      new Quad(ex('a'), ex('p'), ex('o')),
      new Quad(ex('b'), ex('p'), ex('o'), ex('g')),
    ];
    const store = new Store(original);
    const options = { matchSemantics };
    const unread = store.match(null, ex('q'), null, null, options);
    const read = store.match(null, ex('q'), null, null, options);
    const namedGraph = store.match(null, ex('q'), null, ex('g'), options);
    expect(read.size).toBe(0);
    expect(namedGraph.size).toBe(0);
    const iterator = store.match(null, null, null, null, options)[Symbol.iterator]();
    const first = iterator.next().value;

    new Reasoner(store).reason(rules);

    const derived = matchSemantics === 'forwarded';
    expect(store.size).toBe(4);
    expect([first, ...iterator]).toEqual(original);
    expect(unread.size).toBe(derived ? 2 : 0);
    expect(read.size).toBe(derived ? 2 : 0);
    expect(namedGraph.has(new Quad(ex('b'), ex('q'), ex('o'), ex('g')))).toBe(derived);

    // Repeated derivations are not new quads
    const observer = store.match(null, ex('q'), null, null, options);
    new Reasoner(store).reason(rules);
    expect(store.size).toBe(4);
    expect(observer.size).toBe(2);
  });
});
