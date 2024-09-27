import {
  Store,
  termFromId, termToId,
  EntityIndex,
  DataFactory,
} from '../src';
import {
  NamedNode,
  Literal,
  DefaultGraph,
  Quad,
} from '../src/N3DataFactory';
import namespaces from '../src/IRIs';
import { Readable } from 'readable-stream';
import { arrayifyStream } from 'arrayify-stream';

const { namedNode } = DataFactory;

describe('Store', () => {
  describe('The Store export', () => {
    it('should be a function', () => {
      expect(Store).toBeInstanceOf(Function);
    });

    it('should be an Store constructor', () => {
      expect(new Store()).toBeInstanceOf(Store);
    });
  });

  describe('An empty Store', () => {
    const store = new Store({});

    it('should have size 0', () => {
      expect(store.size).toEqual(0);
    });

    it('should be empty', () => {
      expect(store.getQuads()).toHaveLength(0);
    });

    describe('when removing a stream of 2 quads', () => {
      beforeAll(done => {
        const stream = new ArrayReader([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
        const events = store.remove(stream);
        events.on('end', done);
      });

      it('should have size 0', () => { expect(store.size).toEqual(0); });
    });

    describe('when importing a stream of 2 nested quads', () => {
      beforeAll(done => {
        const stream = new ArrayReader([
          new Quad(new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2'))),
        ]);
        const events = store.import(stream);
        events.on('end', done);
      });

      it('should have size 2', () => { expect(store.size).toEqual(2); });
    });

    describe('when removing a stream of 2 nested quads', () => {
      beforeAll(done => {
        const stream = new ArrayReader([
          new Quad(new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2'))),
        ]);
        const events = store.remove(stream);
        events.on('end', done);
      });

      it('should have size 0', () => { expect(store.size).toEqual(0); });
    });

    describe('every', () => {
      describe('with no parameters and a callback always returning true', () => {
        it('should return true on empty set', () => {
          expect(store.every(alwaysTrue, null, null, null, null)).toBe(true);
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return true on empty set', () => {
          expect(store.every(alwaysFalse, null, null, null, null)).toBe(true);
        });
      });
    });

    describe('some', () => {
      describe('with no parameters and a callback always returning true', () => {
        it('should return false', () => {
          expect(store.some(alwaysTrue, null, null, null, null)).toBe(false);
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return false', () => {
          expect(store.some(alwaysFalse, null, null, null, null)).toBe(false);
        });
      });
    });

    it(
      'should still have size 0 (instead of null) after adding and removing a triple',
      () => {
        expect(store.size).toEqual(0);
        expect(store.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'))).toBe(true);
        expect(
          store.removeQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        ).toBe(true);
        expect(store.size).toEqual(0);
      },
    );

    it('should be able to generate unnamed blank nodes', () => {
      expect(store.createBlankNode().value).toEqual('b0');
      expect(store.createBlankNode().value).toEqual('b1');

      expect(store.addQuad('_:b0', '_:b1', '_:b2')).toBe(true);
      expect(store.createBlankNode().value).toEqual('b3');
      store.removeQuads(store.getQuads());
    });

    it('should be able to generate named blank nodes', () => {
      expect(store.createBlankNode('blank').value).toEqual('blank');
      expect(store.createBlankNode('blank').value).toEqual('blank1');
      expect(store.createBlankNode('blank').value).toEqual('blank2');
    });

    it('should be able to store triples with generated blank nodes', () => {
      expect(
        store.addQuad(store.createBlankNode('x'), new NamedNode('b'), new NamedNode('c')),
      ).toBe(true);
      shouldIncludeAll(store.getQuads(null, new NamedNode('b')), ['_:x', 'b', 'c'])();
      store.removeQuads(store.getQuads());
    });
  });

  describe('A Store with initialized with 5 elements', () => {
    const store = new Store([
      new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p1'), new NamedNode('o1')),
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o3')),
      new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'), new NamedNode('g1')),
    ]);

    it('should have size 5', () => {
      expect(store.size).toEqual(5);
    });

    describe('adding a triple that already exists', () => {
      it('should return false', () => {
        expect(store.addQuad('s1', 'p1', 'o1')).toBe(false);
      });

      it('should not increase the size', () => {
        expect(store.size).toEqual(5);
      });

      it('should return false', () => {
        expect(store.addQuad(new Quad('s1', 'p1', 'o1'), 'p1', 'o1')).toBe(false);
      });

      it('should not increase the size', () => {
        expect(store.size).toEqual(5);
      });
    });

    describe('adding a triple that did not exist yet', () => {
      it('should return true', () => {
        expect(
          store.has(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'))),
        ).toBe(false);
        expect(store.has(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'))).toBe(false);
        expect(store.has(null, null, new NamedNode('o4'))).toBe(false);

        expect(store.addQuad('s1', 'p1', 'o4')).toBe(true);

        expect(
          store.has(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'))),
        ).toBe(true);
        expect(store.has(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'))).toBe(true);
        expect(
          store.has(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'), new DefaultGraph()),
        ).toBe(true);
        expect(store.has(null, null, new NamedNode('o4'))).toBe(true);
      });

      it('should increase the size', () => {
        expect(store.size).toEqual(6);
      });

      it('should return true', () => {
        expect(
          store.addQuad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), 'p1', 'o4'),
        ).toBe(true);
      });

      it('should increase the size', () => {
        expect(store.size).toEqual(7);
      });

      it('should return self', () => {
        expect(
          store.add(new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))),
        ).toBe(store);
      });

      it('should increase the size', () => {
        expect(store.size).toEqual(8);
      });
    });

    describe('removing an existing triple', () => {
      it('should return true', () => {
        expect(store.removeQuad('s1', 'p1', 'o4')).toBe(true);
      });

      it('should decrease the size', () => {
        expect(store.size).toEqual(7);
      });

      it('should return true', () => {
        expect(
          store.removeQuad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), 'p1', 'o4'),
        ).toBe(true);
      });

      it('should decrease the size', () => {
        expect(store.size).toEqual(6);
      });

      it('should return self', () => {
        expect(
          store.delete(new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))),
        ).toBe(store);
      });

      it('should increase the size', () => {
        expect(store.size).toEqual(5);
      });
    });

    describe('removing a non-existing triple', () => {
      it('should return false', () => {
        expect(store.removeQuad('s1', 'p1', 'o5')).toBe(false);
      });

      it('should not decrease the size', () => {
        expect(store.size).toEqual(5);
      });

      it('should return false', () => {
        expect(
          store.removeQuad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4')), 'p1', 'o1'),
        ).toBe(false);
      });

      it('should not decrease the size', () => {
        expect(store.size).toEqual(5);
      });
    });

    describe('removing matching quads', () => {
      it(
        'should return the removed quads',
        forResultStream(shouldIncludeAll, () => { return store.removeMatches('s1', 'p1'); },
          ['s1', 'p1', 'o1'],
          ['s1', 'p1', 'o2'],
          ['s1', 'p1', 'o3']),
      );

      it('should decrease the size', () => {
        expect(store.size).toEqual(2);
      });
    });

    describe('removing a graph', () => {
      it(
        'should return the removed quads',
        forResultStream(shouldIncludeAll, () => { return store.deleteGraph('g1'); },
          ['s2', 'p2', 'o2', 'g1']),
      );

      it('should decrease the size', () => {
        expect(store.size).toEqual(1);
      });
    });
  });

  describe('removing matching quads for RDF-star', () => {
    let store;
    const allQuads = [
      new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p2'), new NamedNode('o1')),
      new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p1'), new NamedNode('o1')),
      new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p2'), new NamedNode('o2')),
      new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p1'), new NamedNode('o2')),
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
    ];
    beforeAll(() => {
      store = new Store(allQuads);
    });

    it('should start with the correct size', () => {
      expect(store.size).toEqual(5);
    });

    it(
      'should return the removed quads',
      () => arrayifyStream(store.removeMatches(null, 'p2', 'o2')).then(quads => {
        expect(quads.length).toBe(1);
        expect(quads[0].equals(
          new Quad(
            new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
            new NamedNode('p2'),
            new NamedNode('o2'),
            ),
          )).toBe(true);
      }),
    );

    it('should decrease the size', () => {
      expect(store.size).toEqual(4);
    });

    it('should match RDF-star and normal quads at the same time', done => {
      const stream = store.removeMatches(null, 'p1', 'o2');
      stream.on('end', () => {
        expect(store.size).toEqual(2);
        done();
      });
    });

    it('should allow matching using a quad', done => {
      const stream = store.removeMatches(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')));
      stream.on('end', () => {
        expect(store.size).toEqual(0);
        done();
      });
    });

    it(
      'should allow matching using a quad and only match against relevant quads',
      done => {
        const s2 = new Store([
          ...allQuads,
          new Quad(
            new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
            new NamedNode('p1'),
            new NamedNode('o2')),
        ]);

        const stream = s2.removeMatches(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')));
        stream.on('end', () => {
          expect(s2.size).toEqual(2);
          done();
        });
      },
    );
  });

  describe('A store with quoted quads', () => {
    let store;
    beforeEach(() => {
      store = new Store([
        new Quad(
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
          new NamedNode('p1'),
          new NamedNode('o2')),
        new Quad(
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2'), new NamedNode('g')),
        new NamedNode('p1'),
        new NamedNode('o2')),
      ]);
    });

    it('should have the correct size', () => {
      expect(store.size).toBe(2);
    });

    it('should get all quads with shared predicate', () => {
      expect(store.getQuads(null, new NamedNode('p1'), null).length).toBe(2);
    });

    it('should get all quads with shared predicate 2', () => {
      expect(store.getQuads(
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
        new NamedNode('p1'),
        null,
        ).length).toBe(1);
      expect(store.getQuads(
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2'), new NamedNode('g')),
        new NamedNode('p1'),
        null,
        ).length).toBe(1);
      expect(store.getQuads(
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2'), new NamedNode('g2')),
        new NamedNode('p1'),
        null,
        ).length).toBe(0);
    });
  });

  describe('A Store with 7 elements', () => {
    const store = new Store();
    expect(store.addQuad('s1', 'p1', 'o1')).toBe(true);
    expect(store.addQuad({ subject: 's1', predicate: 'p1', object: 'o2' })).toBe(true);
    store.addQuads([
      { subject: 's1', predicate: 'p2', object: 'o2' },
      { subject: 's2', predicate: 'p1', object: 'o1' },
    ]);
    expect(store.addQuad('s1', 'p1', 'o1', 'c4')).toBe(true);
    store.addQuad(new Quad('s2', 'p2', 'o2'), 'p1', 'o3');
    expect(store.add(new Quad('s2', 'p2', 'o2'))).toBe(store);

    it('should have size 7', () => {
      expect(store.size).toEqual(7);
    });

    describe('when searched without parameters', () => {
      it('should return all items', shouldIncludeAll(store.getQuads(),
                       ['s1', 'p1', 'o1'],
                       ['s1', 'p1', 'o2'],
                       ['s1', 'p2', 'o2'],
                       ['s2', 'p1', 'o1'],
                       ['s1', 'p1', 'o1', 'c4'],
                       [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3'],
                       ['s2', 'p2', 'o2']));
    });

    describe('when searched with an existing subject parameter', () => {
      it(
        'should return all items with this subject in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), null, null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s1', 'p1', 'o1', 'c4']),
      );
    });

    describe('when searched with a non-existing subject parameter', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s3'), null, null));
    });

    describe('when searched with a non-existing subject parameter that exists elsewhere', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('p1'), null, null));
    });

    describe('when searched with an existing predicate parameter', () => {
      it(
        'should return all items with this predicate in all graphs',
        shouldIncludeAll(store.getQuads(null, new NamedNode('p1'), null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3']),
      );
    });

    describe('when searched with a non-existing predicate parameter', () => {
      itShouldBeEmpty(store.getQuads(null, new NamedNode('p3'), null));
    });

    describe('when searched with an existing object parameter', () => {
      it(
        'should return all items with this object in all graphs',
        shouldIncludeAll(store.getQuads(null, null, new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']),
      );
    });

    describe('when searched with a non-existing object parameter', () => {
      itShouldBeEmpty(store.getQuads(null, null, new NamedNode('o4')));
    });

    describe('when searched with existing subject and predicate parameters', () => {
      it(
        'should return all items with this subject and predicate in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), new NamedNode('p1'), null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p1', 'o1', 'c4']),
      );
    });

    describe('when searched with non-existing subject and predicate parameters', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), new NamedNode('p3'), null));
    });

    describe('when searched with existing subject and object parameters', () => {
      it(
        'should return all items with this subject and object in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), null, new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']),
      );
    });

    describe('when searched with non-existing subject and object parameters', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), null, new NamedNode('o3')));
    });

    describe('when searched with existing predicate and object parameters', () => {
      it(
        'should return all items with this predicate and object in all graphs',
        shouldIncludeAll(store.getQuads(null, new NamedNode('p1'), new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']),
      );
    });

    describe('when searched with non-existing predicate and object parameters in the default graph', () => {
      itShouldBeEmpty(store.getQuads(null, new NamedNode('p2'), new NamedNode('o3'), new DefaultGraph()));
    });

    describe('when searched with existing subject, predicate, and object parameters', () => {
      it(
        'should return all items with this subject, predicate, and object in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']),
      );
    });

    describe('when searched with a non-existing triple', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o1')));
    });

    describe('when searched with the default graph parameter', () => {
      it(
        'should return all items in the default graph',
        shouldIncludeAll(store.getQuads(null, null, null, new DefaultGraph()),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3'],
                         ['s2', 'p2', 'o2']),
      );
    });

    describe('when searched with an existing named graph parameter', () => {
      it(
        'should return all items in that graph',
        shouldIncludeAll(store.getQuads(null, null, null, new NamedNode('c4')),
                         ['s1', 'p1', 'o1', 'c4']),
      );
    });

    describe('when searched with a non-existing named graph parameter', () => {
      itShouldBeEmpty(store.getQuads(null, null, null, new NamedNode('c5')));
    });

    describe('match', () => {
      describe('without parameters', () => {
        it('should return an object implementing the DatasetCore interface', () => {
          const dataset = store.match();

          expect(dataset.add).toBeInstanceOf(Function);
          expect(dataset.delete).toBeInstanceOf(Function);
          expect(dataset.has).toBeInstanceOf(Function);
          expect(dataset.match).toBeInstanceOf(Function);
          expect(dataset[Symbol.iterator]).toBeInstanceOf(Function);
        });

        it(
          'should return an object implementing the Readable stream interface',
          () => {
            const stream = store.match();

            expect(typeof stream.addListener).toEqual('function');
            expect(typeof stream.emit).toEqual('function');
            expect(stream.propertyIsEnumerable('destroyed')).toBe(false);
            expect(stream.destroyed).toBe(false);
            expect(typeof stream.destroy).toEqual('function');
            expect(typeof stream.eventNames).toEqual('function');
            expect(typeof stream.getMaxListeners).toEqual('function');
            expect(typeof stream.listenerCount).toEqual('function');
            expect(typeof stream.listeners).toEqual('function');
            expect(typeof stream.isPaused).toEqual('function');
            expect(stream.isPaused()).toBe(false);
            expect(typeof stream.off).toEqual('function');
            expect(typeof stream.on).toEqual('function');
            expect(typeof stream.once).toEqual('function');
            expect(typeof stream.pause).toEqual('function');
            expect(typeof stream.pipe).toEqual('function');
            expect(typeof stream.prependListener).toEqual('function');
            expect(typeof stream.prependOnceListener).toEqual('function');
            expect(typeof stream.rawListeners).toEqual('function');
            expect(typeof stream.read).toEqual('function');
            expect(stream.readable).toBe(true);
            expect(stream.propertyIsEnumerable('readableBuffer')).toBe(false);
            expect(stream.readableBuffer).toBeDefined();
            // Readable from 'readable-stream' does not implement the `readableEncoding` property.
            // stream.readableEncoding.should.equal(???);
            // Readable from 'readable-stream' does not implement the `readableEnded` property.
            // stream.readableEnded.should.equal(false);
            expect(stream.propertyIsEnumerable('readableFlowing')).toBe(false);
            expect(stream.readableFlowing).toBeNull();
            expect(stream.propertyIsEnumerable('readableHighWaterMark')).toBe(false);
            expect(stream.readableHighWaterMark).toBe(16);
            expect(stream.propertyIsEnumerable('readableLength')).toBe(false);
            expect(stream.readableLength).toBe(0);
            // Readable from 'readable-stream' does not implement the `readableObjectMode` property.
            // stream.readableObjectMode.should.equal(true);
            expect(typeof stream.removeAllListeners).toEqual('function');
            expect(typeof stream.removeListener).toEqual('function');
            expect(typeof stream.resume).toEqual('function');
            expect(typeof stream.setEncoding).toEqual('function');
            expect(typeof stream.setMaxListeners).toEqual('function');
            expect(typeof stream.unpipe).toEqual('function');
            expect(typeof stream.unshift).toEqual('function');
            expect(typeof stream.wrap).toEqual('function');
            expect(typeof stream[Symbol.asyncIterator]).toEqual('function');
          },
        );

        it(
          'should return all items',
          forResultStream(shouldIncludeAll, store.match(),
            ['s1', 'p1', 'o1'],
            ['s1', 'p1', 'o2'],
            ['s1', 'p2', 'o2'],
            ['s2', 'p1', 'o1'],
            ['s1', 'p1', 'o1', 'c4'],
            [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3'],
            ['s2', 'p2', 'o2']),
        );
      });

      describe('with an existing subject parameter', () => {
        const largeStore = new Store([]);
        const results = [];
        for (let i = 0; i < 100; i += 1) {
          largeStore.add(new Quad(`s${i}`, 'p1', 'o1'));
          largeStore.add(new Quad(`s${i}`, 'p2', 'o1'));
          results.push([`s${i}`, 'p2', 'o1']);
        }

        it(
          'should return all items with this subject in all graphs',
          forResultStream(shouldIncludeAll, store.match(new NamedNode('s1'), null, null),
            ['s1', 'p1', 'o1'],
            ['s1', 'p1', 'o2'],
            ['s1', 'p2', 'o2'],
            ['s1', 'p1', 'o1', 'c4']),
        );

        it(
          'should return all items with this subject in all graphs in a large store',
          forResultStream(shouldIncludeAll, largeStore.match(null, new NamedNode('p2'), null),
            ...results),
        );

        it('should return an object implementing the DatasetCore interface', () => {
          const subject = new NamedNode('s1');
          const dataset = store.match(subject, null, null);

          let count = 0;
          for (const quad of dataset) {
            count += 1;
            expect(quad.subject.equals(subject)).toBe(true);
          }

          expect(count).toBe(4);
          expect(dataset.size).toBe(count);

          expect(dataset.has(new Quad('s2', 'p1', 'o1'))).toBe(false);
          dataset.add(new Quad('s2', 'p1', 'o1'));

          count = 0;
          // eslint-disable-next-line no-unused-vars
          for (const _quad of dataset) {
            count += 1;
          }
          expect(count).toBe(5);

          expect(dataset.has(new Quad('s2', 'p1', 'o1'))).toBe(true);

          const nextDataset = dataset.match(new NamedNode('s2'));
          nextDataset.add(new Quad('s2', 'p2', 'o2'));

          count = 0;
          // eslint-disable-next-line no-unused-vars
          for (const _quad of nextDataset) {
            count += 1;
          }
          expect(count).toBe(2);

          expect(nextDataset.has(new Quad('s2', 'p1', 'o1'))).toBe(true);
          expect(nextDataset.has(new Quad('s2', 'p2', 'o2'))).toBe(true);
          expect(nextDataset.match(namedNode('s2'), null, null).has(new Quad('s2', 'p2', 'o2'))).toBe(true);
          expect(nextDataset.match(null, namedNode('p2'), null).has(new Quad('s2', 'p2', 'o2'))).toBe(true);
          expect(nextDataset.match(null, null, namedNode('o2')).has(new Quad('s2', 'p2', 'o2'))).toBe(true);
          expect(nextDataset.size).toBe(2);
          nextDataset.add(new Quad('s2', 'p1', 'onew'));
          expect(nextDataset.size).toBe(3);
          nextDataset.add(new Quad('s2', 'p1', 'onew'));
          expect(nextDataset.size).toBe(3);

          nextDataset.delete(new Quad('s2', 'p1', 'o1'));
          nextDataset.delete(new Quad('s2', 'p2', 'o2'));
          expect(nextDataset.has(new Quad('s2', 'p1', 'o1'))).toBe(false);
          expect(nextDataset.has(new Quad('s2', 'p2', 'o2'))).toBe(false);
        });
      });

      describe('with non-existing predicate and object parameters in the default graph', () => {
        forResultStream(itShouldBeEmpty, store.match(null, new NamedNode('p2'), new NamedNode('o3'), new DefaultGraph()));
      });
    });

    describe('getSubjects', () => {
      describe('with existing predicate, object and graph parameters', () => {
        it(
          'should return all subjects with this predicate, object and graph',
          () => {
            expect(
              store.getSubjects(new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c4')),
            ).toEqual(expect.arrayContaining([new NamedNode('s1')]));
          },
        );
      });

      describe('with existing predicate and object parameters', () => {
        it('should return all subjects with this predicate and object', () => {
          expect(store.getSubjects(new NamedNode('p2'), new NamedNode('o2'), null)).toEqual(expect.arrayContaining([new NamedNode('s1'), new NamedNode('s2')]));
        });
      });

      describe('with existing predicate and graph parameters', () => {
        it('should return all subjects with this predicate and graph', () => {
          expect(store.getSubjects(new NamedNode('p1'), null, new DefaultGraph())).toEqual(expect.arrayContaining(
            [new NamedNode('s1'), new NamedNode('s2'), new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))],
          ));
        });
      });

      describe('with existing object and graph parameters', () => {
        it('should return all subjects with this object and graph', () => {
          expect(store.getSubjects(null, new NamedNode('o1'), new DefaultGraph())).toEqual(expect.arrayContaining([new NamedNode('s1'), new NamedNode('s2')]));
        });
      });

      describe('with an existing predicate parameter', () => {
        it('should return all subjects with this predicate', () => {
          expect(store.getSubjects(new NamedNode('p1'), null, null)).toEqual(expect.arrayContaining(
            [new NamedNode('s1'), new NamedNode('s2'),  new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))],
          ));
        });
      });

      describe('with an existing object parameter', () => {
        it('should return all subjects with this object', () => {
          expect(store.getSubjects(null, new NamedNode('o1'), null)).toEqual(expect.arrayContaining([new NamedNode('s1'), new NamedNode('s2')]));
        });
      });

      describe('with an existing graph parameter', () => {
        it('should return all subjects in the graph', () => {
          expect(store.getSubjects(null, null, new NamedNode('c4'))).toEqual(expect.arrayContaining([new NamedNode('s1')]));
        });
      });

      describe('with no parameters', () => {
        it('should return all subjects', () => {
          expect(store.getSubjects(null, null, null)).toEqual(expect.arrayContaining(
            [new NamedNode('s1'), new NamedNode('s2'),  new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))],
          ));
        });
      });
    });

    describe('getPredicates', () => {
      describe('with existing subject, object and graph parameters', () => {
        it(
          'should return all predicates with this subject, object and graph',
          () => {
            expect(
              store.getPredicates(new NamedNode('s1'), new NamedNode('o1'), new NamedNode('c4')),
            ).toEqual(expect.arrayContaining([new NamedNode('p1')]));
          },
        );
      });

      describe('with existing subject and object parameters', () => {
        it('should return all predicates with this subject and object', () => {
          expect(store.getPredicates(new NamedNode('s1'), new NamedNode('o2'), null)).toEqual(expect.arrayContaining([new NamedNode('p1'), new NamedNode('p2')]));
        });
      });

      describe('with existing subject and graph parameters', () => {
        it('should return all predicates with this subject and graph', () => {
          expect(store.getPredicates(new NamedNode('s1'), null, new DefaultGraph())).toEqual(expect.arrayContaining([new NamedNode('p1'), new NamedNode('p2')]));
        });
      });

      describe('with existing object and graph parameters', () => {
        it('should return all predicates with this object and graph', () => {
          expect(store.getPredicates(null, new NamedNode('o1'), new DefaultGraph())).toEqual(expect.arrayContaining([new NamedNode('p1')]));
        });
      });

      describe('with an existing subject parameter', () => {
        it('should return all predicates with this subject', () => {
          expect(store.getPredicates(new NamedNode('s2'), null, null)).toEqual(expect.arrayContaining([new NamedNode('p1'), new NamedNode('p2')]));
        });
      });

      describe('with an existing object parameter', () => {
        it('should return all predicates with this object', () => {
          expect(store.getPredicates(null, new NamedNode('o1'), null)).toEqual(expect.arrayContaining([new NamedNode('p1')]));
        });
      });

      describe('with an existing graph parameter', () => {
        it('should return all predicates in the graph', () => {
          expect(store.getPredicates(null, null, new NamedNode('c4'))).toEqual(expect.arrayContaining([new NamedNode('p1')]));
        });
      });

      describe('with no parameters', () => {
        it('should return all predicates', () => {
          expect(store.getPredicates(null, null, null)).toEqual(expect.arrayContaining([new NamedNode('p1'), new NamedNode('p2')]));
        });
      });
    });

    describe('getObjects', () => {
      describe('with existing subject, predicate and graph parameters', () => {
        it(
          'should return all objects with this subject, predicate and graph',
          () => {
            expect(
              store.getObjects(new NamedNode('s1'), new NamedNode('p1'), new DefaultGraph()),
            ).toEqual(expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2')]));
          },
        );
      });

      describe('with existing subject and predicate parameters', () => {
        it('should return all objects with this subject and predicate', () => {
          expect(store.getObjects(new NamedNode('s1'), new NamedNode('p1'), null)).toEqual(expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2')]));
        });
      });

      describe('with existing subject and graph parameters', () => {
        it('should return all objects with this subject and graph', () => {
          expect(store.getObjects(new NamedNode('s1'), null, new DefaultGraph())).toEqual(expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2')]));
        });
      });

      describe('with existing predicate and graph parameters', () => {
        it('should return all objects with this predicate and graph', () => {
          expect(store.getObjects(null, new NamedNode('p1'), new DefaultGraph())).toEqual(
            expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2'), new NamedNode('o3')]),
          );
        });
      });

      describe('with an existing subject parameter', () => {
        it('should return all objects with this subject', () => {
          expect(store.getObjects(new NamedNode('s1'), null, null)).toEqual(expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2')]));
        });
      });

      describe('with an existing predicate parameter', () => {
        it('should return all objects with this predicate', () => {
          expect(store.getObjects(null, new NamedNode('p1'), null)).toEqual(
            expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2'),  new NamedNode('o3')]),
          );
        });
      });

      describe('with an existing graph parameter', () => {
        it('should return all objects in the graph', () => {
          expect(store.getObjects(null, null, new NamedNode('c4'))).toEqual(expect.arrayContaining([new NamedNode('o1')]));
        });
      });

      describe('with no parameters', () => {
        it('should return all objects', () => {
          expect(store.getObjects(null, null, null)).toEqual(
            expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2'), new NamedNode('o3')]),
          );
        });
      });
    });

    describe('getGraphs', () => {
      describe('with existing subject, predicate and object parameters', () => {
        it(
          'should return all graphs with this subject, predicate and object',
          () => {
            expect(
              store.getGraphs(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
            ).toEqual(expect.arrayContaining([new NamedNode('c4'), new DefaultGraph()]));
          },
        );
      });

      describe('with existing subject and predicate parameters', () => {
        it('should return all graphs with this subject and predicate', () => {
          expect(store.getGraphs(new NamedNode('s1'), new NamedNode('p1'), null)).toEqual(expect.arrayContaining([new NamedNode('c4'),  new DefaultGraph()]));
        });
      });

      describe('with existing subject and object parameters', () => {
        it('should return all graphs with this subject and object', () => {
          expect(store.getGraphs(new NamedNode('s1'), null, new NamedNode('o2'))).toEqual(expect.arrayContaining([new DefaultGraph()]));
        });
      });

      describe('with existing predicate and object parameters', () => {
        it('should return all graphs with this predicate and object', () => {
          expect(store.getGraphs(null, new NamedNode('p1'), new NamedNode('o1'))).toEqual(expect.arrayContaining([new DefaultGraph(), new NamedNode('c4')]));
        });
      });

      describe('with an existing subject parameter', () => {
        it('should return all graphs with this subject', () => {
          expect(store.getGraphs(new NamedNode('s1'), null, null)).toEqual(expect.arrayContaining([new NamedNode('c4'), new DefaultGraph()]));
        });
      });

      describe('with an existing predicate parameter', () => {
        it('should return all graphs with this predicate', () => {
          expect(store.getGraphs(null, new NamedNode('p1'), null)).toEqual(expect.arrayContaining([new NamedNode('c4'), new DefaultGraph()]));
        });
      });

      describe('with an existing object parameter', () => {
        it('should return all graphs with this object', () => {
          expect(store.getGraphs(null, null, new NamedNode('o2'))).toEqual(expect.arrayContaining([new DefaultGraph()]));
        });
      });

      describe('with no parameters', () => {
        it('should return all graphs', () => {
          expect(store.getGraphs(null, null, null)).toEqual(expect.arrayContaining([new NamedNode('c4'), new DefaultGraph()]));
        });
      });
    });

    describe('forEach', () => {
      describe('with existing subject, predicate, object and graph parameters', () => {
        it(
          'should have iterated all items with this subject, predicate, object and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', 'o2', ''),
                           ['s1', 'p1', 'o2', '']),
        );
      });

      describe('with existing subject, predicate and object parameters', () => {
        it(
          'should have iterated all items with this subject, predicate and object',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p2', 'o2', null),
                           ['s1', 'p2', 'o2', '']),
        );
      });

      describe('with existing subject, predicate and graph parameters', () => {
        it(
          'should have iterated all items with this subject, predicate and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', null, ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', '']),
        );
      });

      describe('with existing subject, object and graph parameters', () => {
        it(
          'should have iterated all items with this subject, object and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, 'o2', ''),
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p2', 'o2', '']),
        );
      });

      describe('with existing predicate, object and graph parameters', () => {
        it(
          'should have iterated all items with this predicate, object and graph',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', 'o1', ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', '']),
        );
      });

      describe('with existing subject and predicate parameters', () => {
        it(
          'should iterate all items with this subject and predicate',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', null, null),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p1', 'o1', 'c4']),
        );
      });

      describe('with existing subject and object parameters', () => {
        it(
          'should iterate all items with this subject and predicate',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, 'o2', null),
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p2', 'o2', '']),
        );
      });

      describe('with existing subject and graph parameters', () => {
        it(
          'should iterate all items with this subject and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, null, 'c4'),
                         ['s1', 'p1', 'o1', 'c4']),
        );
      });

      describe('with existing predicate and object parameters', () => {
        it(
          'should iterate all items with this predicate and object',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', 'o1', null),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4']),
        );
      });

      describe('with existing predicate and graph parameters', () => {
        it(
          'should iterate all items with this predicate and graph',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', null, ''),
                             ['s1', 'p1', 'o1', ''],
                             ['s1', 'p1', 'o2', ''],
                             ['s2', 'p1', 'o1', ''],
                             [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']),
        );
      });

      describe('with existing object and graph parameters', () => {
        it(
          'should iterate all items with this object and graph',
          shouldIncludeAll(collect(store, 'forEach', null, null, 'o1', ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', '']),
        );
      });

      describe('with an existing subject parameter', () => {
        it(
          'should iterate all items with this subject',
          shouldIncludeAll(collect(store, 'forEach', 's2', null, null, null),
                         ['s2', 'p1', 'o1', ''],
                         ['s2', 'p2', 'o2', '']),
        );
      });

      describe('with an existing predicate parameter', () => {
        it(
          'should iterate all items with this predicate',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', null, null),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4'],
                           [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']),
        );
      });

      describe('with an existing object parameter', () => {
        it(
          'should iterate all items with this object',
          shouldIncludeAll(collect(store, 'forEach', null, null, 'o1', null),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4']),
        );
      });

      describe('with an existing graph parameter', () => {
        it(
          'should iterate all items with this graph',
          shouldIncludeAll(collect(store, 'forEach', null, null, null, ''),
                           ['s1', 'p1', 'o1'],
                           ['s1', 'p1', 'o2'],
                           ['s1', 'p2', 'o2'],
                           ['s2', 'p1', 'o1'],
                           ['s2', 'p2', 'o2'],
                           [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']),
        );
      });

      describe('with no parameters', () => {
        it(
          'should iterate all items',
          shouldIncludeAll(collect(store, 'forEach', null, null, null, null),
                           ['s1', 'p1', 'o1'],
                           ['s1', 'p1', 'o2'],
                           ['s1', 'p2', 'o2'],
                           ['s2', 'p1', 'o1'],
                           ['s2', 'p2', 'o2'],
                           ['s1', 'p1', 'o1', 'c4'],
                           [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']),
        );
      });
    });

    describe('forSubjects', () => {
      describe('with existing predicate, object and graph parameters', () => {
        it(
          'should iterate all subjects with this predicate, object and graph',
          () => {
            expect(collect(store, 'forSubjects', 'p1', 'o1', '')).toEqual(expect.arrayContaining([new NamedNode('s1'), new NamedNode('s2')]));
          },
        );
      });
      describe('with a non-existing predicate', () => {
        it('should be empty', () => {
          expect(collect(store, 'forSubjects', 'p3', null, null)).toHaveLength(0);
        });
      });
      describe('with a non-existing object', () => {
        it('should be empty', () => {
          expect(collect(store, 'forSubjects', null, 'o4', null)).toHaveLength(0);
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          expect(collect(store, 'forSubjects', null, null, 'g2')).toHaveLength(0);
        });
      });
    });

    describe('forPredicates', () => {
      describe('with existing subject, object and graph parameters', () => {
        it(
          'should iterate all predicates with this subject, object and graph',
          () => {
            expect(collect(store, 'forPredicates', 's1', 'o2', '')).toEqual(expect.arrayContaining([new NamedNode('p1'), new NamedNode('p2')]));
          },
        );
      });
      describe('with a non-existing subject', () => {
        it('should be empty', () => {
          expect(collect(store, 'forPredicates', 's3', null, null)).toHaveLength(0);
        });
      });
      describe('with a non-existing object', () => {
        it('should be empty', () => {
          expect(collect(store, 'forPredicates', null, 'o4', null)).toHaveLength(0);
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          expect(collect(store, 'forPredicates', null, null, 'g2')).toHaveLength(0);
        });
      });
    });

    describe('forObjects', () => {
      describe('with existing subject, predicate and graph parameters', () => {
        it(
          'should iterate all objects with this subject, predicate and graph',
          () => {
            expect(collect(store, 'forObjects', 's1', 'p1', '')).toEqual(expect.arrayContaining([new NamedNode('o1'), new NamedNode('o2')]));
          },
        );
      });
      describe('with a non-existing subject', () => {
        it('should be empty', () => {
          expect(collect(store, 'forObjects', 's3', null, null)).toHaveLength(0);
        });
      });
      describe('with a non-existing predicate', () => {
        it('should be empty', () => {
          expect(collect(store, 'forObjects', null, 'p3', null)).toHaveLength(0);
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          expect(collect(store, 'forObjects', null, null, 'g2')).toHaveLength(0);
        });
      });
    });

    describe('forGraphs', () => {
      describe('with existing subject, predicate and object parameters', () => {
        it(
          'should iterate all graphs with this subject, predicate and object',
          () => {
            expect(collect(store, 'forGraphs', 's1', 'p1', 'o1')).toEqual(expect.arrayContaining([new DefaultGraph(), new NamedNode('c4')]));
          },
        );
      });
      describe('with a non-existing subject', () => {
        it('should be empty', () => {
          expect(collect(store, 'forObjects', 's3', null, null)).toHaveLength(0);
        });
      });
      describe('with a non-existing predicate', () => {
        it('should be empty', () => {
          expect(collect(store, 'forObjects', null, 'p3', null)).toHaveLength(0);
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          expect(collect(store, 'forPredicates', null, null, 'g2')).toHaveLength(0);
        });
      });
    });

    describe('every', () => {
      let count = 3;
      function thirdTimeFalse() { return count-- === 0; }

      describe('with no parameters and a callback always returning true', () => {
        it('should return true', () => {
          expect(store.every(alwaysTrue, null, null, null, null)).toBe(true);
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return false', () => {
          expect(store.every(alwaysFalse, null, null, null, null)).toBe(false);
        });
      });
      describe('with no parameters and a callback that returns false after 3 calls', () => {
        it('should return false', () => {
          expect(store.every(thirdTimeFalse, null, null, null, null)).toBe(false);
        });
      });
    });

    describe('some', () => {
      let count = 3;
      function thirdTimeFalse() { return count-- !== 0; }

      describe('empty store always returns false', () => {
        const emptyStore = new Store();
        it('should return false', () => {
          expect(emptyStore.some(alwaysTrue, null, null, null, null)).toBe(false);
          expect(emptyStore.some(alwaysFalse, null, null, null, null)).toBe(false);
          expect(emptyStore.some(alwaysTrue, new NamedNode('s3'), null, null, null)).toBe(false);
          expect(emptyStore.some(alwaysFalse, new NamedNode('s3'), null, null, null)).toBe(false);

          expect(emptyStore.some(null, null, null, null, null)).toBe(false);
          expect(emptyStore.some(null, new NamedNode('s3'), null, null, null)).toBe(false);
          expect(emptyStore.some(null, new NamedNode('s3'), null, null, null)).toBe(false);
        });
      });
      describe('with no parameters and a callback always returning true', () => {
        it('should return true', () => {
          expect(store.some(alwaysTrue, null, null, null, null)).toBe(true);
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return false', () => {
          expect(store.some(alwaysFalse, null, null, null, null)).toBe(false);
        });
      });
      describe('with no parameters and a callback that returns true after 3 calls', () => {
        it('should return false', () => {
          expect(store.some(thirdTimeFalse, null, null, null, null)).toBe(true);
        });
      });
      describe('with a non-existing subject', () => {
        it('should return true', () => {
          expect(store.some(null, new NamedNode('s3'), null, null, null)).toBe(false);
        });
      });
      describe('with a non-existing predicate', () => {
        it('should return false', () => {
          expect(store.some(null, null, new NamedNode('p3'), null, null)).toBe(false);
        });
      });
      describe('with a non-existing object', () => {
        it('should return false', () => {
          expect(store.some(null, null, null, new NamedNode('o4'), null)).toBe(false);
        });
      });
      describe('with a non-existing graph', () => {
        it('should return false', () => {
          expect(store.some(null, null, null, null, new NamedNode('g2'))).toBe(false);
        });
      });
    });

    describe('when destructured', () => {
      it('should destructure all quads', shouldIncludeAll(
        () => {
          const [a, b, c, d, e, f, g] = store;
          return [a, b, c, d, e, f, g];
        },
        ['s1', 'p1', 'o1'],
        ['s1', 'p1', 'o2'],
        ['s1', 'p2', 'o2'],
        ['s2', 'p1', 'o1'],
        ['s2', 'p2', 'o2'],
        ['s1', 'p1', 'o1', 'c4'],
        [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3']));
    });

    describe('when iterated with for...of', () => {
      it('should iterate over all quads', () => {
        let count = 0;
        // eslint-disable-next-line no-unused-vars
        for (const quad of store) {
          count += 1;
        }
        expect(count).toBe(7);
      });
    });

    describe('when spread', () => {
      it('should spread all quads', shouldIncludeAll(
        [...store],
        ['s1', 'p1', 'o1'],
        ['s1', 'p1', 'o2'],
        ['s1', 'p2', 'o2'],
        ['s2', 'p1', 'o1'],
        ['s1', 'p1', 'o1', 'c4'],
        [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3'],
        ['s2', 'p2', 'o2']));
    });

    describe('when yield starred', () => {
      it('should yield all quads', shouldIncludeAll(
        () => {
          function* yieldAll() {
            yield* store;
          }
          return Array.from(yieldAll());
        },
        ['s1', 'p1', 'o1'],
        ['s1', 'p1', 'o2'],
        ['s1', 'p2', 'o2'],
        ['s2', 'p1', 'o1'],
        ['s2', 'p2', 'o2'],
        ['s1', 'p1', 'o1', 'c4'],
        [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3']));
    });

    describe('when counted without parameters', () => {
      it('should count all items in all graphs', () => {
        expect(store.countQuads()).toBe(7);
      });
    });

    describe('when counted with an existing subject parameter', () => {
      it('should count all items with this subject in all graphs', () => {
        expect(store.countQuads(new NamedNode('s1'), null, null)).toBe(4);
      });
    });

    describe('when counted with a non-existing subject parameter', () => {
      it('should be empty', () => {
        expect(store.countQuads(new NamedNode('s3'), null, null)).toBe(0);
      });
    });

    describe('when counted with a non-existing subject parameter that exists elsewhere', () => {
      it('should be empty', () => {
        expect(store.countQuads(new NamedNode('p1'), null, null)).toBe(0);
      });
    });

    describe('when counted with an existing predicate parameter', () => {
      it('should count all items with this predicate in all graphs', () => {
        expect(store.countQuads(null, new NamedNode('p1'), null)).toBe(5);
      });
    });

    describe('when counted with a non-existing predicate parameter', () => {
      it('should be empty', () => {
        expect(store.countQuads(null, new NamedNode('p3'), null)).toBe(0);
      });
    });

    describe('when counted with an existing object parameter', () => {
      it('should count all items with this object in all graphs', () => {
        expect(store.countQuads(null, null, 'o1')).toBe(3);
      });
    });

    describe('when counted with a non-existing object parameter', () => {
      it('should be empty', () => {
        expect(store.countQuads(null, null, 'o4')).toBe(0);
      });
    });

    describe('when counted with existing subject and predicate parameters', () => {
      it(
        'should count all items with this subject and predicate in all graphs',
        () => {
          expect(store.countQuads('s1', 'p1', null)).toBe(3);
        },
      );
    });

    describe('when counted with non-existing subject and predicate parameters', () => {
      it('should be empty', () => {
        expect(store.countQuads('s2', 'p3', null)).toBe(0);
      });
    });

    describe('when counted with existing subject and object parameters', () => {
      it(
        'should count all items with this subject and object in all graphs',
        () => {
          expect(store.countQuads('s1', null, 'o1')).toBe(2);
        },
      );
    });

    describe('when counted with non-existing subject and object parameters', () => {
      it('should be empty', () => {
        expect(store.countQuads('s2', null, 'o3')).toBe(0);
      });
    });

    describe('when counted with existing predicate and object parameters', () => {
      it(
        'should count all items with this predicate and object in all graphs',
        () => {
          expect(store.countQuads(null, 'p1', 'o1')).toBe(3);
        },
      );
    });

    describe('when counted with non-existing predicate and object parameters', () => {
      it('should be empty', () => {
        expect(store.countQuads(null, 'p2', 'o3')).toBe(0);
      });
    });

    describe('when counted with existing subject, predicate, and object parameters', () => {
      it(
        'should count all items with this subject, predicate, and object in all graphs',
        () => {
          expect(store.countQuads('s1', 'p1', 'o1')).toBe(2);
        },
      );
    });

    describe('when counted with a non-existing triple', () => {
      it('should be empty', () => {
        expect(store.countQuads('s2', 'p2', 'o1')).toBe(0);
      });
    });

    describe('when counted with the default graph parameter', () => {
      it('should count all items in the default graph', () => {
        expect(store.countQuads(null, null, null, new DefaultGraph())).toBe(6);
      });
    });

    describe('when counted with an existing named graph parameter', () => {
      it('should count all items in that graph', () => {
        expect(store.countQuads(null, null, null, 'c4')).toBe(1);
      });
    });

    describe('when counted with a non-existing named graph parameter', () => {
      it('should be empty', () => {
        expect(store.countQuads(null, null, null, 'c5')).toBe(0);
      });
    });

    describe('when trying to remove a triple with a non-existing subject', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s0'), new NamedNode('p1'), new NamedNode('o1')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove a triple with a non-existing predicate', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('p0'), new NamedNode('o1')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove a triple with a non-existing object', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o0')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove a triple for which no subjects exist', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('o1'), new NamedNode('p1'), new NamedNode('o1')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove a triple for which no predicates exist', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('s1'), new NamedNode('o1')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove a triple for which no objects exist', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('s1')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove a triple that does not exist', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o1')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove an incomplete triple', () => {
      beforeAll(
        () => { expect(store.removeQuad(new NamedNode('s1'), null, null)).toBe(false); },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when trying to remove a triple with a non-existing graph', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c0')),
        ).toBe(false);
        },
      );
      it('should still have size 7', () => { expect(store.size).toEqual(7); });
    });

    describe('when removing an existing triple', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        ).toBe(true);
        },
      );

      it('should have size 6', () => { expect(store.size).toEqual(6); });

      it(
        'should not contain that triple anymore',
        shouldIncludeAll(() => { return store.getQuads(); },
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s2', 'p2', 'o2'],
                         ['s1', 'p1', 'o1', 'c4'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']),
      );
    });

    describe('when removing an existing triple from a named graph', () => {
      beforeAll(
        () => {
          expect(
          store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c4')),
        ).toBe(true);
        },
      );

      it('should have size 5', () => { expect(store.size).toEqual(5); });

      itShouldBeEmpty(() => { return store.getQuads(null, null, null, 'c4'); });
    });

    describe('when removing multiple triples', () => {
      beforeAll(() => {
        store.removeQuads([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s2'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
      });

      it('should have size 3', () => { expect(store.size).toEqual(3); });

      it(
        'should not contain those triples anymore',
        shouldIncludeAll(() => { return store.getQuads(); },
                         ['s1', 'p1', 'o2'],
                         ['s2', 'p2', 'o2'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']),
      );
    });

    describe('when adding and removing a triple', () => {
      beforeAll(() => {
        expect(store.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'))).toBe(true);
        expect(
          store.removeQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        ).toBe(true);
      });

      it('should have an unchanged size', () => { expect(store.size).toEqual(3); });
    });
  });

  describe('A Store containing a blank node', () => {
    const store = new Store();
    const b1 = store.createBlankNode();
    expect(store.addQuad(new NamedNode('s1'), new NamedNode('p1'), b1)).toBe(true);

    describe('when searched with more than one variable', () => {
      it(
        'should return a triple with the blank node as an object',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', `_:${b1.value}`]),
      );
    });

    describe('when searched with one variable', () => {
      it(
        'should return a triple with the blank node as an object',
        shouldIncludeAll(store.getQuads('s1', 'p1'),
                         ['s1', 'p1', `_:${b1.value}`]),
      );
    });
  });

  describe('A Store with a custom DataFactory', () => {
    const factory = {};
    let store;
    beforeAll(() => {
      factory.quad = function (s, p, o, g) { return { s: s, p: p, o: o, g: g }; };
      ['namedNode', 'blankNode', 'literal', 'variable', 'defaultGraph'].forEach(f => {
        factory[f] = function (n) { return n ? `${f[0]}-${n}` : f; };
      });

      store = new Store({ factory: factory });
      expect(store.addQuad('s1', 'p1', 'o1')).toBe(true);
      expect(store.addQuad({ subject: 's1', predicate: 'p1', object: 'o2' })).toBe(true);
      store.addQuads([
        { subject: 's1', predicate: 'p2', object: 'o2' },
        { subject: 's2', predicate: 'p1', object: 'o1' },
      ]);
      expect(store.addQuad('s1', 'p1', 'o1', 'c4')).toBe(true);
    });

    it('should use the factory when returning quads', () => {
      expect(store.getQuads()).toEqual([
        { s: 'n-s1', p: 'n-p1', o: 'n-o1', g: 'defaultGraph' },
        { s: 'n-s1', p: 'n-p1', o: 'n-o2', g: 'defaultGraph' },
        { s: 'n-s1', p: 'n-p2', o: 'n-o2', g: 'defaultGraph' },
        { s: 'n-s2', p: 'n-p1', o: 'n-o1', g: 'defaultGraph' },
        { s: 'n-s1', p: 'n-p1', o: 'n-o1', g: 'n-c4'         },
      ]);
    });
  });

  describe('A Store', () => {
    const store = new Store();

    it('should implement the DatasetCore interface', () => {
      expect(store.add).toBeInstanceOf(Function);
      expect(store.delete).toBeInstanceOf(Function);
      expect(store.has).toBeInstanceOf(Function);
      expect(store.match).toBeInstanceOf(Function);
      expect(store[Symbol.iterator]).toBeInstanceOf(Function);
    });

    // Test inspired by http://www.devthought.com/2012/01/18/an-object-is-not-a-hash/.
    // The value `__proto__` is not supported however – fixing it introduces too much overhead.
    it(
      'should be able to contain entities with JavaScript object property names',
      () => {
        expect(store.addQuad('toString', 'valueOf', 'toLocaleString', 'hasOwnProperty')).toBe(true);
        shouldIncludeAll(store.getQuads(null, null, null, 'hasOwnProperty'),
                         ['toString', 'valueOf', 'toLocaleString', 'hasOwnProperty'])();
      },
    );

    it('should be able to contain entities named "null"', () => {
      expect(store.addQuad('null', 'null', 'null', 'null')).toBe(true);
      shouldIncludeAll(store.getQuads(null, null, null, 'null'), ['null', 'null', 'null', 'null'])();
    });
  });

  describe('A Store containing a well-formed rdf:Collection as subject', () => {
    const store = new Store();
    const listElements = addList(store, new NamedNode('element1'), new Literal('"element2"'));
    expect(store.addQuad(listElements[0], new NamedNode('p1'), new NamedNode('o1'))).toBe(true);
    const listItemsJSON = {
      b0: [
        { termType: 'NamedNode', value: 'element1' },
        { termType: 'Literal', value: 'element2',
          language: '', datatype: { termType: 'NamedNode', value: namespaces.xsd.string } },
      ],
    };

    describe('extractLists without remove', () => {
      const lists = store.extractLists();
      it('should not delete triples', shouldIncludeAll(store.getQuads(),
        [`_:${listElements[0].value}`, 'p1', 'o1'],
        [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
        [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`],
        [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
        [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil],
      ));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).toEqual(listItemsJSON);
      });
    });

    describe('extractLists with remove', () => {
      const lists = store.extractLists({ remove: true });
      it(
        'should remove the first/rest triples and return the list members',
        shouldIncludeAll(store.getQuads(),
                         [`_:${listElements[0].value}`, 'p1', 'o1']),
      );
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).toEqual(listItemsJSON);
      });
    });
  });

  describe('A Store containing a well-formed rdf:Collection as object', () => {
    const store = new Store();
    const listElements = addList(store, new NamedNode('element1'), new Literal('"element2"'));
    expect(store.addQuad(new NamedNode('s1'), new NamedNode('p1'), listElements[0])).toBe(true);
    const listItemsJSON = {
      b0: [
        { termType: 'NamedNode', value: 'element1' },
        { termType: 'Literal', value: 'element2',
          language: '', datatype: { termType: 'NamedNode', value: namespaces.xsd.string } },
      ],
    };

    describe('extractLists without remove', () => {
      const lists = store.extractLists();
      it('should not delete triples', shouldIncludeAll(store.getQuads(),
        ['s1', 'p1', `_:${listElements[0].value}`],
        [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
        [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`],
        [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
        [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil],
      ));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).toEqual(listItemsJSON);
      });
    });

    describe('extractLists with remove', () => {
      const lists = store.extractLists({ remove: true });
      it(
        'should remove the first/rest triples and return the list members',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', `_:${listElements[0].value}`]),
      );
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).toEqual(listItemsJSON);
      });
    });
  });

  describe('A Store containing a well-formed rdf:Collection that is not attached', () => {
    const store = new Store();
    const listElements = addList(store, new NamedNode('element1'), new Literal('"element2"'));
    store.addQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'));

    describe('extractLists without remove', () => {
      const lists = store.extractLists();
      it('should not delete triples', shouldIncludeAll(store.getQuads(),
        ['s1', 'p1', 'o1'],
        [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
        [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`],
        [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
        [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil],
      ));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).toEqual({});
      });
    });

    describe('extractLists with remove', () => {
      const lists = store.extractLists({ remove: true });
      it(
        'should remove the first/rest triples and return the list members',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', 'o1']),
      );
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).toEqual({});
      });
    });
  });

  describe('A Store containing a rdf:Collection without first', () => {
    const store = new Store();
    expect(
      store.addQuad(store.createBlankNode(), new NamedNode(namespaces.rdf.rest), namespaces.rdf.nil),
    ).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b0 has no list head');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:first arcs on head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    expect(
      store.addQuad(listElements[0], new NamedNode(namespaces.rdf.first), store.createBlankNode()),
    ).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b2 has multiple rdf:first arcs');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:first arcs on tail', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    expect(
      store.addQuad(listElements[1], new NamedNode(namespaces.rdf.first), store.createBlankNode()),
    ).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b3 has multiple rdf:first arcs');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:rest arcs on head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    expect(
      store.addQuad(listElements[0], new NamedNode(namespaces.rdf.rest), store.createBlankNode()),
    ).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b2 has multiple rdf:rest arcs');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:rest arcs on tail', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    expect(
      store.addQuad(listElements[1], new NamedNode(namespaces.rdf.rest), store.createBlankNode()),
    ).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b3 has multiple rdf:rest arcs');
    });
  });

  describe('A Store containing an rdf:Collection with non-list arcs out', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    expect(
      store.addQuad(listElements[1], new NamedNode('http://a.example/foo'), store.createBlankNode()),
    ).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b4 can\'t be subject and object');
    });
  });

  describe('A Store containing an rdf:Collection with multiple incoming rdf:rest arcs', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    expect(
      store.addQuad(store.createBlankNode(), new NamedNode(namespaces.rdf.rest), listElements[1]),
    ).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b4 has incoming rdf:rest arcs');
    });
  });

  describe('A Store containing an rdf:Collection with co-references out of head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    expect(store.addQuad(listElements[0], new NamedNode('p1'), new NamedNode('o1'))).toBe(true);
    expect(store.addQuad(listElements[0], new NamedNode('p1'), new NamedNode('o2'))).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b3 has non-list arcs out');
    });
  });

  describe('A Store containing an rdf:Collection with co-references into head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    expect(store.addQuad(new NamedNode('s1'), new NamedNode('p1'), listElements[0])).toBe(true);
    expect(
      store.addQuad(new NamedNode('s2'), new NamedNode(namespaces.rdf.rest), listElements[0]),
    ).toBe(true);
    expect(store.addQuad(new NamedNode('s2'), new NamedNode('p1'), listElements[0])).toBe(true);

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).toThrow('b3 can\'t have coreferences');
    });
  });

  describe('A Store containing an rdf:Collection spread across graphs', () => {
    const member0 = new NamedNode('element1');
    const member1 = new Literal('"element2"');
    const store = new Store();
    const listElements = [
      store.createBlankNode(),
      store.createBlankNode(),
    ];
    expect(
      store.addQuad(listElements[0], new NamedNode(namespaces.rdf.first), member0),
    ).toBe(true);
    expect(
      store.addQuad(listElements[0], new NamedNode(namespaces.rdf.rest), listElements[1], new NamedNode('g1')),
    ).toBe(true);
    expect(
      store.addQuad(listElements[1], new NamedNode(namespaces.rdf.first), member1),
    ).toBe(true);
    expect(
      store.addQuad(listElements[1], new NamedNode(namespaces.rdf.rest), new NamedNode(namespaces.rdf.nil)),
    ).toBe(true);
    expect(store.addQuad(new NamedNode('s1'), new NamedNode('p1'), listElements[0])).toBe(true);

    describe('extractLists without ignoreErrors', () => {
      it('extractLists throws an error', () => {
        expect(() => store.extractLists()).toThrow('b0 not confined to single graph');
      });
    });

    describe('extractLists with ignoreErrors', () => {
      const lists = store.extractLists({ ignoreErrors: true });
      it('should not delete triples', shouldIncludeAll(store.getQuads(),
        ['s1', 'p1', `_:${listElements[0].value}`],
        [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
        [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`, 'g1'],
        [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
        [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil],
      ));
      it('should generate an empty list of Collections', () => {
        expect(listsToJSON(lists)).toEqual({});
      });
    });
  });

  describe('handles concurrent read/write', () => {
    let store;
    beforeEach(() => {
      store = new Store([
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o3')),
      ]);
    });

    it(
      'should include added elements in match if iteration has not yet started',
      () => {
        const m = store.match(null, null, null, null);
        store.add(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')));
        expect([...m]).toHaveLength(3);
        expect([...store.match(null, null, null, null)]).toHaveLength(3);
      },
    );

    it(
      'should include added elements in match if iteration has not yet started (deeply nested)',
      () => {
        const m = store.match(null, null, null, null);
        store.add(new Quad(
          new NamedNode('s1'),
          new NamedNode('p1'),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o3')),
          ),
        );
        store.add(new Quad(
          new NamedNode('s1'),
          new NamedNode('p1'),
          new Quad(
            new NamedNode('s1'),
            new NamedNode('p1'),
            new Quad(
              new NamedNode('s1'),
              new NamedNode('p1'),
              new NamedNode('o3'),
              ),
            ),
          ),
        );
        expect([...m]).toHaveLength(4);
        expect([...store.match(null, null, null, null)]).toHaveLength(4);
      },
    );

    it(
      'should still include results of original match after iterating while adding new data',
      () => {
        const m = store.match(null, null, null, null)[Symbol.iterator]();
        expect(m.next().value).toEqual(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')));
        store.add(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o0')));
        store.add(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')));
        store.add(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4')));
        expect(m.next().value).toEqual(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o3')));
        expect(m.next().done).toBe(true);
        expect([...store.match(null, null, null, null)]).toHaveLength(5);
      },
    );
  });

  const matrix = [true, false, 'instantiated'].flatMap(match => [true, false].map(share => [match, share]));

  describe.each(matrix)('RDF/JS Dataset Methods [DatasetCoreAndReadableStream: %s] [sharedIndex: %s]', (match, shareIndex) => {
    let q, store, store1, store2, store3, store4, storeg, storeb, empty, options;

    beforeEach(() => {
      options = shareIndex ? { entityIndex: new EntityIndex() } : {};
      q = [new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
        new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o3')),
        new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o3'))];
      q = [...q, ...q.map(quad => new Quad(quad.subject, quad.predicate, quad.object, new NamedNode('c4')))];
      empty = new Store([], options);
      store = new Store([q[0]], options);
      storeg = new Store([q[4]], options);
      storeb = new Store([q[0], q[4]], options);
      store1 = new Store([q[0], q[1]], options);
      store2 = new Store([q[0], q[2]], options);
      store3 = new Store([q[0], q[3]], options);
      store4 = new Store([new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'))], options);

      if (match) {
        empty = store2.match(new NamedNode('sn'));
        store = store2.match(new NamedNode('s1'));
        store1 = store1.match();
        store2 = store2.match();
      }

      if (match === 'instantiated') {
        empty.size;
        store.size;
        store1.size;
        store2.size;
      }
    });

    describe('#contains', () => {
      it('empty set is contained in all sets', () => {
        expect(empty.contains(empty)).toBe(true);
        expect(store.contains(empty)).toBe(true);
        expect(store1.contains(empty)).toBe(true);
        expect(store2.contains(empty)).toBe(true);
        expect(storeg.contains(empty)).toBe(true);
        expect(storeb.contains(empty)).toBe(true);
      });

      it('store is contained in store, store1 and store2', () => {
        expect(store.contains(store)).toBe(true);
        expect(store1.contains(store)).toBe(true);
        expect(store2.contains(store)).toBe(true);
        expect(store3.contains(store)).toBe(true);
        expect(storeb.contains(store)).toBe(true);
        expect(storeb.contains(storeg)).toBe(true);
      });

      it('stores should contain themsevles', () => {
        expect(store1.contains(store1)).toBe(true);
        expect(store2.contains(store2)).toBe(true);
        expect(store3.contains(store3)).toBe(true);
        expect(storeb.contains(storeb)).toBe(true);
      });

      it('should return false for a non-existing quad', () => {
        expect(storeg.contains(store)).toBe(false);
        expect(store.contains(storeg)).toBe(false);
        expect(storeg.contains(storeb)).toBe(false);
        expect(store.contains(storeb)).toBe(false);
        expect(store.contains(store1)).toBe(false);
        expect(store.contains(store3)).toBe(false);
        expect(store.contains(store2)).toBe(false);
        expect(empty.contains(store1)).toBe(false);
        expect(empty.contains(store2)).toBe(false);
        expect(store2.contains(store1)).toBe(false);
        expect(store1.contains(store2)).toBe(false);
        expect(store1.contains(storeb)).toBe(false);
        expect(storeb.contains(store1)).toBe(false);
      });
    });

    describe('#union', () => {
      it('should return a new store with the union of the quads', () => {
        const store = store1.union(store2);
        expect(store1.size).toEqual(2);
        expect(store2.size).toEqual(2);
        expect(store.size).toEqual(3);

        expect(store.union(store).size).toEqual(3);
        expect(store.union(empty).size).toEqual(3);
        expect(store1.union(empty).size).toEqual(2);
      });
    });

    describe('#difference', () => {
      it('should return a new store with the difference of the quads', () => {
        const store = store1.difference(store2);
        expect(store1.size).toEqual(2);
        expect(store2.size).toEqual(2);
        expect(store.size).toEqual(1);

        expect(store.difference(store).size).toEqual(0);
        expect(store2.difference(store2).size).toEqual(0);
        expect(store.difference(new Store([...store])).size).toEqual(0);
        expect(store2.difference(new Store([...store2])).size).toEqual(0);

        const stores = [store, store1, store2, store3, store4, storeb, storeg, empty];
        for (const s1 of stores) {
          for (const s2 of stores) {
            expect(s1.difference(s2).size).toBeLessThanOrEqual(s1.size);
            expect(s1.difference(s2)._graphs).toBeTruthy();
            expect(s1.union(s2).difference(s1).equals(s2.difference(s1))).toBe(true);
            expect(s1.difference(s2).union(s1).equals(s1)).toBe(true);
            expect(new Store([...s1.union(s2).difference(s1)]).equals(new Store([...s2.difference(s1)]))).toBe(true);
            expect(new Store([...s1.difference(s2).union(s1)]).equals(new Store([...s1]))).toBe(true);

            const newStore = s1.difference(s2);
            const size = newStore.size;
            newStore.add(new Quad(new NamedNode('mys1'), new NamedNode('myp1'), new NamedNode('myo1')));
            expect(newStore.size).toBe(size + 1);
          }
        }
      });
    });

    describe('#intersection', () => {
      it('should return a new store with the intersection of the quads', () => {
        const store = store1.intersection(store2);
        expect(store1.size).toEqual(2);
        expect(store2.size).toEqual(2);
        expect(store.size).toEqual(1);

        const stores = [store, store1, store2, store3, store4, storeb, storeg, empty];
        for (const s1 of stores) {
          for (const s2 of stores) {
            expect(s1.intersection(s2).size).toBeLessThanOrEqual(s1.size);
            expect(s1.intersection(s2).size).toBeLessThanOrEqual(s2.size);
            expect(s1.intersection(s2)._graphs).toBeTruthy();
            expect(s1.intersection(s2).equals(s2.intersection(s1))).toBe(true);
            expect(s1.union(s2).intersection(s1).equals(s1)).toBe(true);
            expect(s1.intersection(s2).union(s1).equals(s1)).toBe(true);
            expect(new Store([...s1.union(s2).intersection(s1)]).equals(new Store([...s1]))).toBe(true);
            expect(new Store([...s1.intersection(s2).union(s1)]).equals(new Store([...s1]))).toBe(true);

            const newStore = s1.intersection(s2);
            const size = newStore.size;
            newStore.add(new Quad(new NamedNode('mys1'), new NamedNode('myp1'), new NamedNode('myo1')));
            expect(newStore.size).toBe(size + 1);
          }
        }

        expect(store.intersection(store).size).toEqual(1);
        expect(store2.intersection(store2).size).toEqual(2);
        expect(storeg.intersection(store).size).toBe(0);
        expect(store.intersection(storeg).size).toBe(0);
        expect(storeg.intersection(storeb).size).toBe(1);
        expect(store.intersection(storeb).size).toBe(1);
        expect(store.intersection(store1).size).toBe(1);
        expect(store.intersection(store3).size).toBe(1);
        expect(store.intersection(store2).size).toBe(1);
        expect(empty.intersection(store1).size).toBe(0);
        expect(empty.intersection(store2).size).toBe(0);
        expect(store2.intersection(store1).size).toBe(1);
        expect(store1.intersection(store2).size).toBe(1);
        expect(store1.intersection(storeb).size).toBe(1);
        expect(storeb.intersection(store1).size).toBe(1);
      });
    });

    describe('#deleteMatches', () => {
      it('should delete all quads if pattern is null', () => {
        store1.deleteMatches(null, null, null);
        expect(store1.size).toEqual(0);
      });

      it('should delete matching quads', () => {
        store1.deleteMatches(q[0].subject, q[0].predicate, q[0].object);
        expect(store1.size).toEqual(1);
      });
    });

    describe('#addAll', () => {
      it('should add quads to the store', () => {
        store1.addAll([q[2]]);
        expect(store1.size).toEqual(3);
        store1.addAll([q[2]]);
        expect(store1.size).toEqual(3);
      });
    });

    describe('#deleteMatches', () => {
      it('should delete matching quads', () => {
        store1.deleteMatches(q[0].subject, q[0].predicate, q[0].object);
        expect(store1.size).toEqual(1);
      });
    });

    describe('#map', () => {
      it('should map over quads', () => {
        const quads = store1.map(quad => quad);
        expect(quads.size).toEqual(2);
        expect(quads.contains(store1)).toBe(true);
        expect(store1.contains(quads)).toBe(true);
      });
    });

    describe('#reduce', () => {
      it('should reduce over quads', () => {
        expect(store1.reduce((acc, _) => acc + 1, 0)).toEqual(2);
        expect(store1.reduce((acc, quad) => acc + quad.subject.value.length, 0)).toEqual(4);
        expect(store1.reduce((acc, _) => acc, 0)).toEqual(0);
        expect(store.reduce((acc, _) => acc)).toEqual(q[0]);
      });
    });

    describe('#toArray', () => {
      it('should convert to an array', () => {
        const quads = store1.toArray();
        expect(quads).toHaveLength(2);
        expect(quads[0]).toEqual(q[0]);
        expect(quads[1]).toEqual(q[1]);
      });
    });

    describe('#toStream', () => {
      it('should convert to a stream', async () => {
        await expect(arrayifyStream(store2.toStream())).resolves.toEqual([q[0], q[2]]);
        await expect(arrayifyStream(store1.toStream())).resolves.toEqual([q[0], q[1]]);
        await expect(arrayifyStream(store.toStream())).resolves.toEqual([q[0]]);
        await expect(arrayifyStream(empty.toStream())).resolves.toEqual([]);
      });
    });

    describe('#toString', () => {
      it('should convert to a string', () => {
        expect(store1.toString()).toEqual('<s1> <p1> <o1> .\n<s1> <p1> <o2> .\n');
      });
    });

    describe('#toCanonical', () => {
      it('should convert to a canonical string', () => {
        expect(() => store1.toCanonical()).toThrow('not implemented');
      });
    });

    describe('#filter', () => {
      it('should filter quads by subject', () => {
        const quads = store1.filter(quad => quad.subject.value === 's1');
        expect(quads.size).toEqual(2);
        expect(quads.contains(store1)).toEqual(true);
        expect(store1.contains(quads)).toEqual(true);
      });

      it('should filter quads by object', () => {
        const quads = store1.filter(quad => quad.object.value === 'o1');
        expect(quads.size).toEqual(1);
        expect(store1.contains(quads)).toEqual(true);
        expect(quads.has(q[0])).toEqual(true);
      });
    });

    describe('#import', () => {
      beforeEach(done => {
        const stream = new ArrayReader([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
        const events = empty.import(stream);
        events.on('end', done);
      });

      it('should have size 2', () => { expect(empty.size).toEqual(2); });
    });

    describe('#forEach', () => {
      it('should iterate over quads', () => {
        let count = 0;
        store1.forEach(quad => {
          count++;
          expect(quad).toEqual(count === 1 ? q[0] : q[1]);
        });
        expect(count).toEqual(2);
      });
    });

    describe('#equals', () => {
      it('should be equal to itself', () => {
        expect(empty.equals(empty)).toBe(true);
        expect(store.equals(store)).toBe(true);
        expect(store1.equals(store1)).toBe(true);
        expect(store2.equals(store2)).toBe(true);
      });

      it('should be equal to a new store containing the same elements', () => {
        expect(store.equals(new Store([q[0]]))).toBe(true);
        expect(store1.equals(new Store([q[0], q[1]]))).toBe(true);
        expect(empty.equals(new Store())).toBe(true);
        expect(store2.equals(new Store([q[0], q[2]]))).toBe(true);
      });

      it('should not be equal to a store with different elements', () => {
        expect(empty.equals(store)).toBe(false);
        expect(store.equals(new Store([q[1]]))).toBe(false);
        expect(store1.equals(new Store([q[0]]))).toBe(false);
        expect(store2.equals(new Store([q[0]]))).toBe(false);
      });
    });

    describe('#some', () => {
      it('should return true if any quad passes the test', () => {
        expect(store1.some(quad => quad.subject.value === 's1')).toBe(true);
        expect(store1.some(quad => quad.subject.value === 's2')).toBe(false);
      });

      it('should return false if no quad passes the test', () => {
        expect(store1.some(quad => quad.subject.value === 's2')).toBe(false);
      });

      it('should return false on the empty set', () => {
        expect(empty.some(quad => true)).toBe(false);
      });
    });

    describe('#every', () => {
      it('should return true if every quad passes the test', () => {
        expect(store1.every(quad => quad.subject.value === 's1')).toBe(true);
        expect(store1.every(quad => quad.subject.value === 's2')).toBe(false);
        expect(store1.every(quad => quad.object.value === 'o1')).toBe(false);
        expect(store1.every(quad => quad.subject.termType === 'NamedNode')).toBe(true);
      });

      it('should return false if no quad passes the test', () => {
        expect(store1.every(quad => quad.subject.value === 's2')).toBe(false);
      });

      it('should return true on the empty set', () => {
        expect(empty.every(quad => true)).toBe(true);
      });
    });
  });
});

describe('EntityIndex', () => {
  let entityIndex;
  beforeEach(() => {
    entityIndex = new EntityIndex();
  });

  it('should be a constructor', () => {
    expect(entityIndex).toBeInstanceOf(EntityIndex);
  });

  it('custom index should be used when instantiated with store', () => {
    const index = {
      '': 1,
      's1': 2,
      'p1': 3,
      'o0': 4,
      's2': 5,
      'p2': 6,
      'o2': 7,
    };

    const store = new Store([
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o0')),
    ], { entityIndex });
    expect(store.size).toBe(1);
    expect(entityIndex._id).toEqual(4);

    const substore = store.match();
    substore.add(new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2')));
    expect(store.size).toBe(1);
    expect(substore.size).toBe(2);
    expect(entityIndex._id).toEqual(7);
    expect(entityIndex._ids).toEqual(index);

    const store2 = new Store([
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o5')),
    ], { entityIndex });
    expect(store2.size).toBe(1);
    expect(entityIndex._id).toEqual(8);
    expect(entityIndex._ids).toEqual({
      ...index,
      o5: 8,
    });
  });
});

function alwaysTrue()  { return true;  }
function alwaysFalse() { return false; }

function collect(store, method, arg1, arg2, arg3, arg4) {
  const results = [];
  store[method](r => results.push(r),
    arg1 && termFromId(arg1),
    arg2 && termFromId(arg2),
    arg3 && termFromId(arg3),
    arg4 && termFromId(arg4),
  );
  return results;
}

function itShouldBeEmpty(result) {
  it('should be empty', () => {
    if (typeof result === 'function') result = result();
    expect(Object.keys(result)).toHaveLength(0);
  });
}

function shouldIncludeAll(result) {
  const items = Array.prototype.slice.call(arguments, 1).map(arg => {
    return new Quad(termFromId(arg[0]), termFromId(arg[1]), termFromId(arg[2]), termFromId(arg[3] || ''));
  });
  return function () {
    if (typeof result === 'function') result = result();
    result = result.map(r => { return r.toJSON(); });
    expect(result).toHaveLength(items.length);
    for (let i = 0; i < items.length; i++)
      expect(result).toContainEqual(items[i].toJSON());
  };
}

function forResultStream(testFunction, result) {
  const items = Array.prototype.slice.call(arguments, 2);
  return function (done) {
    if (typeof result === 'function') result = result();
    arrayifyStream(result)
      .then(array => {
        items.unshift(array);
        testFunction.apply({}, items)();
      })
      .then(done, done);
  };
}

function ArrayReader(items) {
  const reader = new Readable({ objectMode: true });
  reader._read = function () { this.push(items.shift() || null); };
  return reader;
}

function addList(store, ...items) {
  if (!items.length)
    return new NamedNode(namespaces.rdf.nil);

  const listElements = [store.createBlankNode()];
  items.forEach((item, i) => {
    store.addQuad(listElements[i], new NamedNode(namespaces.rdf.first), item);
    if (i === items.length - 1)
      store.addQuad(listElements[i], new NamedNode(namespaces.rdf.rest), new NamedNode(namespaces.rdf.nil));
    else {
      listElements.push(store.createBlankNode());
      store.addQuad(listElements[i], new NamedNode(namespaces.rdf.rest), listElements[i + 1]);
    }
  });
  return listElements;
}

function listsToJSON(lists) {
  for (const list in lists)
    lists[list] = lists[list].map(i => i.toJSON());
  return lists;
}
