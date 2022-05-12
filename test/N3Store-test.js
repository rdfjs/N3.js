import {
  Store,
  NamedNode,
  Literal,
  DefaultGraph,
  Quad,
  termFromId, termToId,
  Variable,
  Parser
} from '../src/';
import namespaces from '../src/IRIs';
import chai, { expect } from 'chai';
import { Readable } from 'readable-stream';
import arrayifyStream from 'arrayify-stream';
import * as fs from 'fs';
import * as path from 'path';

const should = chai.should();

describe('Store', () => {
  describe('The Store export', () => {
    it('should be a function', () => {
      Store.should.be.a('function');
    });

    it('should be an Store constructor', () => {
      new Store().should.be.an.instanceof(Store);
    });
  });

  describe('An empty Store', () => {
    const store = new Store({});

    it('should have size 0', () => {
      expect(store.size).to.eql(0);
    });

    it('should be empty', () => {
      store.getQuads().should.be.empty;
    });

    describe('when importing a stream of 2 quads', () => {
      before(done => {
        const stream = new ArrayReader([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
        const events = store.import(stream);
        events.on('end', done);
      });

      it('should have size 2', () => { store.size.should.eql(2); });
    });

    describe('when removing a stream of 2 quads', () => {
      before(done => {
        const stream = new ArrayReader([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
        const events = store.remove(stream);
        events.on('end', done);
      });

      it('should have size 0', () => { store.size.should.eql(0); });
    });

    describe('when importing a stream of 2 nested quads', () => {
      before(done => {
        const stream = new ArrayReader([
          new Quad(new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2'))),
        ]);
        const events = store.import(stream);
        events.on('end', done);
      });

      it('should have size 2', () => { store.size.should.eql(2); });
    });

    describe('when removing a stream of 2 nested quads', () => {
      before(done => {
        const stream = new ArrayReader([
          new Quad(new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2'))),
        ]);
        const events = store.remove(stream);
        events.on('end', done);
      });

      it('should have size 0', () => { store.size.should.eql(0); });
    });

    describe('every', () => {
      describe('with no parameters and a callback always returning true', () => {
        it('should return false', () => {
          store.every(alwaysTrue, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return false', () => {
          store.every(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
    });

    describe('some', () => {
      describe('with no parameters and a callback always returning true', () => {
        it('should return false', () => {
          store.some(alwaysTrue, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return false', () => {
          store.some(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
    });

    it('should still have size 0 (instead of null) after adding and removing a triple', () => {
      expect(store.size).to.eql(0);
      store.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
      store.removeQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
      expect(store.size).to.eql(0);
    });

    it('should be able to generate unnamed blank nodes', () => {
      store.createBlankNode().value.should.eql('b0');
      store.createBlankNode().value.should.eql('b1');

      store.addQuad('_:b0', '_:b1', '_:b2').should.be.true;
      store.createBlankNode().value.should.eql('b3');
      store.removeQuads(store.getQuads());
    });

    it('should be able to generate named blank nodes', () => {
      store.createBlankNode('blank').value.should.eql('blank');
      store.createBlankNode('blank').value.should.eql('blank1');
      store.createBlankNode('blank').value.should.eql('blank2');
    });

    it('should be able to store triples with generated blank nodes', () => {
      store.addQuad(store.createBlankNode('x'), new NamedNode('b'), new NamedNode('c')).should.be.true;
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
      store.size.should.eql(5);
    });

    describe('adding a triple that already exists', () => {
      it('should return false', () => {
        store.addQuad('s1', 'p1', 'o1').should.be.false;
      });

      it('should not increase the size', () => {
        store.size.should.eql(5);
      });

      it('should return false', () => {
        store.addQuad(new Quad('s1', 'p1', 'o1'), 'p1', 'o1').should.be.false;
      });

      it('should not increase the size', () => {
        store.size.should.eql(5);
      });
    });

    describe('adding a triple that did not exist yet', () => {
      it('should return true', () => {
        store.has(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'))).should.be.false;
        store.has(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4')).should.be.false;
        store.has(null, null, new NamedNode('o4')).should.be.false;

        store.addQuad('s1', 'p1', 'o4').should.be.true;

        store.has(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'))).should.be.true;
        store.has(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4')).should.be.true;
        store.has(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4'), new DefaultGraph()).should.be.true;
        store.has(null, null, new NamedNode('o4')).should.be.true;
      });

      it('should increase the size', () => {
        store.size.should.eql(6);
      });

      it('should return true', () => {
        store.addQuad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), 'p1', 'o4').should.be.true;
      });

      it('should increase the size', () => {
        store.size.should.eql(7);
      });

      it('should return self', () => {
        should.equal(store.add(new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))), store);
      });

      it('should increase the size', () => {
        store.size.should.eql(8);
      });
    });

    describe('removing an existing triple', () => {
      it('should return true', () => {
        store.removeQuad('s1', 'p1', 'o4').should.be.true;
      });

      it('should decrease the size', () => {
        store.size.should.eql(7);
      });

      it('should return true', () => {
        store.removeQuad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), 'p1', 'o4').should.be.true;
      });

      it('should decrease the size', () => {
        store.size.should.eql(6);
      });

      it('should return self', () => {
        should.equal(store.delete(new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))), store);
      });

      it('should increase the size', () => {
        store.size.should.eql(5);
      });
    });

    describe('removing a non-existing triple', () => {
      it('should return false', () => {
        store.removeQuad('s1', 'p1', 'o5').should.be.false;
      });

      it('should not decrease the size', () => {
        store.size.should.eql(5);
      });

      it('should return false', () => {
        store.removeQuad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o4')), 'p1', 'o1').should.be.false;
      });

      it('should not decrease the size', () => {
        store.size.should.eql(5);
      });
    });

    describe('removing matching quads', () => {
      it('should return the removed quads',
        forResultStream(shouldIncludeAll, () => { return store.removeMatches('s1', 'p1'); },
          ['s1', 'p1', 'o1'],
          ['s1', 'p1', 'o2'],
          ['s1', 'p1', 'o3']));

      it('should decrease the size', () => {
        store.size.should.eql(2);
      });
    });

    describe('removing a graph', () => {
      it('should return the removed quads',
        forResultStream(shouldIncludeAll, () => { return store.deleteGraph('g1'); },
          ['s2', 'p2', 'o2', 'g1']));

      it('should decrease the size', () => {
        store.size.should.eql(1);
      });
    });
  });

  describe('removing matching quads for RDF*', () => {
    let store;
    beforeEach(() => {
      store = new Store([
        new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p2'), new NamedNode('o1')),
        new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p1'), new NamedNode('o1')),
        new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p2'), new NamedNode('o2')),
        new Quad(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')), new NamedNode('p1'), new NamedNode('o2')),
        new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
      ]);
    });

    it('should return the removed quads',
      forResultStream(shouldIncludeAll, () => { return store.removeMatches(null, 'p2', 'o2'); },
        [termToId(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'))), 'p2', 'o2']));

    it('should decrease the size', () => {
      store.size.should.eql(5);
    });

    it('should match RDF* and normal quads at the same time', done => {
      const stream = store.removeMatches(null, 'p1', 'o2');
      stream.on('end', () => {
        store.size.should.eql(3);
        done();
      });
    });

    it('should allow matching using a quad', done => {
      const stream = store.removeMatches(termToId(new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'))));
      stream.on('end', () => {
        store.size.should.eql(1);
        done();
      });
    });
  });

  describe('A Store with 7 elements', () => {
    const store = new Store();
    store.addQuad('s1', 'p1', 'o1').should.be.true;
    store.addQuad({ subject: 's1', predicate: 'p1', object: 'o2' }).should.be.true;
    store.addQuads([
      { subject: 's1', predicate: 'p2', object: 'o2' },
      { subject: 's2', predicate: 'p1', object: 'o1' },
    ]);
    store.addQuad('s1', 'p1', 'o1', 'c4').should.be.true;
    store.addQuad(new Quad('s2', 'p2', 'o2'), 'p1', 'o3');
    should.equal(store.add(new Quad('s2', 'p2', 'o2')), store);

    it('should have size 7', () => {
      store.size.should.eql(7);
    });

    describe('when searched without parameters', () => {
      it('should return all items',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3'],
                         ['s2', 'p2', 'o2']));
    });

    describe('when searched with an existing subject parameter', () => {
      it('should return all items with this subject in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), null, null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing subject parameter', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s3'), null, null));
    });

    describe('when searched with a non-existing subject parameter that exists elsewhere', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('p1'), null, null));
    });

    describe('when searched with an existing predicate parameter', () => {
      it('should return all items with this predicate in all graphs',
        shouldIncludeAll(store.getQuads(null, new NamedNode('p1'), null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3']));
    });

    describe('when searched with a non-existing predicate parameter', () => {
      itShouldBeEmpty(store.getQuads(null, new NamedNode('p3'), null));
    });

    describe('when searched with an existing object parameter', () => {
      it('should return all items with this object in all graphs',
        shouldIncludeAll(store.getQuads(null, null, new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing object parameter', () => {
      itShouldBeEmpty(store.getQuads(null, null, new NamedNode('o4')));
    });

    describe('when searched with existing subject and predicate parameters', () => {
      it('should return all items with this subject and predicate in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), new NamedNode('p1'), null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with non-existing subject and predicate parameters', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), new NamedNode('p3'), null));
    });

    describe('when searched with existing subject and object parameters', () => {
      it('should return all items with this subject and object in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), null, new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with non-existing subject and object parameters', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), null, new NamedNode('o3')));
    });

    describe('when searched with existing predicate and object parameters', () => {
      it('should return all items with this predicate and object in all graphs',
        shouldIncludeAll(store.getQuads(null, new NamedNode('p1'), new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with non-existing predicate and object parameters in the default graph', () => {
      itShouldBeEmpty(store.getQuads(null, new NamedNode('p2'), new NamedNode('o3'), new DefaultGraph()));
    });

    describe('when searched with existing subject, predicate, and object parameters', () => {
      it('should return all items with this subject, predicate, and object in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing triple', () => {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o1')));
    });

    describe('when searched with the default graph parameter', () => {
      it('should return all items in the default graph',
        shouldIncludeAll(store.getQuads(null, null, null, new DefaultGraph()),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3'],
                         ['s2', 'p2', 'o2']));
    });

    describe('when searched with an existing named graph parameter', () => {
      it('should return all items in that graph',
        shouldIncludeAll(store.getQuads(null, null, null, new NamedNode('c4')),
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing named graph parameter', () => {
      itShouldBeEmpty(store.getQuads(null, null, null, new NamedNode('c5')));
    });

    describe('match', () => {
      describe('without parameters', () => {
        it('should return an object implementing the DatasetCore interface', () => {
          const dataset = store.match();

          dataset.add.should.be.a('function');
          dataset.delete.should.be.a('function');
          dataset.has.should.be.a('function');
          dataset.match.should.be.a('function');
          dataset[Symbol.iterator].should.be.a('function');
        });

        it('should return an object implementing the Readable stream interface', () => {
          const stream = store.match();

          stream.addListener.should.be.a('function');
          stream.emit.should.be.a('function');
          should.equal(stream.propertyIsEnumerable('destroyed'), false);
          stream.destroyed.should.equal(false);
          stream.destroy.should.be.a('function');
          stream.eventNames.should.be.a('function');
          stream.getMaxListeners.should.be.a('function');
          stream.listenerCount.should.be.a('function');
          stream.listeners.should.be.a('function');
          stream.isPaused.should.be.a('function');
          should.equal(stream.isPaused(), false);
          stream.off.should.be.a('function');
          stream.on.should.be.a('function');
          stream.once.should.be.a('function');
          stream.pause.should.be.a('function');
          stream.pipe.should.be.a('function');
          stream.prependListener.should.be.a('function');
          stream.prependOnceListener.should.be.a('function');
          stream.rawListeners.should.be.a('function');
          stream.read.should.be.a('function');
          stream.readable.should.equal(true);
          should.equal(stream.propertyIsEnumerable('readableBuffer'), false);
          should.exist(stream.readableBuffer);
          // Readable from 'readable-stream' does not implement the `readableEncoding` property.
          // stream.readableEncoding.should.equal(???);
          // Readable from 'readable-stream' does not implement the `readableEnded` property.
          // stream.readableEnded.should.equal(false);
          should.equal(stream.propertyIsEnumerable('readableFlowing'), false);
          should.equal(stream.readableFlowing, null);
          should.equal(stream.propertyIsEnumerable('readableHighWaterMark'), false);
          stream.readableHighWaterMark.should.equal(16);
          should.equal(stream.propertyIsEnumerable('readableLength'), false);
          stream.readableLength.should.equal(0);
          // Readable from 'readable-stream' does not implement the `readableObjectMode` property.
          // stream.readableObjectMode.should.equal(true);
          stream.removeAllListeners.should.be.a('function');
          stream.removeListener.should.be.a('function');
          stream.resume.should.be.a('function');
          stream.setEncoding.should.be.a('function');
          stream.setMaxListeners.should.be.a('function');
          stream.unpipe.should.be.a('function');
          stream.unshift.should.be.a('function');
          stream.wrap.should.be.a('function');
          stream[Symbol.asyncIterator].should.be.a('function');
        });

        it('should return all items',
          forResultStream(shouldIncludeAll, store.match(),
            ['s1', 'p1', 'o1'],
            ['s1', 'p1', 'o2'],
            ['s1', 'p2', 'o2'],
            ['s2', 'p1', 'o1'],
            ['s1', 'p1', 'o1', 'c4'],
            [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3'],
            ['s2', 'p2', 'o2']));
      });

      describe('with an existing subject parameter', () => {
        it('should return all items with this subject in all graphs',
          forResultStream(shouldIncludeAll, store.match(new NamedNode('s1'), null, null),
            ['s1', 'p1', 'o1'],
            ['s1', 'p1', 'o2'],
            ['s1', 'p2', 'o2'],
            ['s1', 'p1', 'o1', 'c4']));

        it('should return an object implementing the DatasetCore interface', () => {
          const subject = new NamedNode('s1');
          const dataset = store.match(subject, null, null);

          let count = 0;
          for (const quad of dataset) {
            count += 1;
            should.equal(quad.subject.equals(subject), true);
          }

          should.equal(count, 4);
          should.equal(dataset.size, count);

          should.equal(dataset.has(new Quad('s2', 'p1', 'o1')), false);
          dataset.add(new Quad('s2', 'p1', 'o1'));

          count = 0;
          // eslint-disable-next-line no-unused-vars
          for (const _quad of dataset) {
            count += 1;
          }
          should.equal(count, 5);

          should.equal(dataset.has(new Quad('s2', 'p1', 'o1')), true);

          const nextDataset = dataset.match(new NamedNode('s2'));
          nextDataset.add(new Quad('s2', 'p2', 'o2'));

          count = 0;
          // eslint-disable-next-line no-unused-vars
          for (const _quad of nextDataset) {
            count += 1;
          }
          should.equal(count, 2);

          should.equal(nextDataset.has(new Quad('s2', 'p1', 'o1')), true);
          should.equal(nextDataset.has(new Quad('s2', 'p2', 'o2')), true);

          nextDataset.delete(new Quad('s2', 'p1', 'o1'));
          nextDataset.delete(new Quad('s2', 'p2', 'o2'));
          should.equal(nextDataset.has(new Quad('s2', 'p1', 'o1')), false);
          should.equal(nextDataset.has(new Quad('s2', 'p2', 'o2')), false);
        });
      });

      describe('with non-existing predicate and object parameters in the default graph', () => {
        forResultStream(itShouldBeEmpty, store.match(null, new NamedNode('p2'), new NamedNode('o3'), new DefaultGraph()));
      });
    });

    describe('getSubjects', () => {
      describe('with existing predicate, object and graph parameters', () => {
        it('should return all subjects with this predicate, object and graph', () => {
          store.getSubjects(new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c4')).should.have.deep.members([new NamedNode('s1')]);
        });
      });

      describe('with existing predicate and object parameters', () => {
        it('should return all subjects with this predicate and object', () => {
          store.getSubjects(new NamedNode('p2'), new NamedNode('o2'), null).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });

      describe('with existing predicate and graph parameters', () => {
        it('should return all subjects with this predicate and graph', () => {
          store.getSubjects(new NamedNode('p1'), null, new DefaultGraph()).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2'), new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))]);
        });
      });

      describe('with existing object and graph parameters', () => {
        it('should return all subjects with this object and graph', () => {
          store.getSubjects(null, new NamedNode('o1'), new DefaultGraph()).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });

      describe('with an existing predicate parameter', () => {
        it('should return all subjects with this predicate', () => {
          store.getSubjects(new NamedNode('p1'), null, null).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2'),  new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))]);
        });
      });

      describe('with an existing object parameter', () => {
        it('should return all subjects with this object', () => {
          store.getSubjects(null, new NamedNode('o1'), null).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });

      describe('with an existing graph parameter', () => {
        it('should return all subjects in the graph', () => {
          store.getSubjects(null, null, new NamedNode('c4')).should.have.deep.members([new NamedNode('s1')]);
        });
      });

      describe('with no parameters', () => {
        it('should return all subjects', () => {
          store.getSubjects(null, null, null).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2'),  new Quad(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o2'))]);
        });
      });
    });

    describe('getPredicates', () => {
      describe('with existing subject, object and graph parameters', () => {
        it('should return all predicates with this subject, object and graph', () => {
          store.getPredicates(new NamedNode('s1'), new NamedNode('o1'), new NamedNode('c4')).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with existing subject and object parameters', () => {
        it('should return all predicates with this subject and object', () => {
          store.getPredicates(new NamedNode('s1'), new NamedNode('o2'), null).should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });

      describe('with existing subject and graph parameters', () => {
        it('should return all predicates with this subject and graph', () => {
          store.getPredicates(new NamedNode('s1'), null, new DefaultGraph()).should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });

      describe('with existing object and graph parameters', () => {
        it('should return all predicates with this object and graph', () => {
          store.getPredicates(null, new NamedNode('o1'), new DefaultGraph()).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with an existing subject parameter', () => {
        it('should return all predicates with this subject', () => {
          store.getPredicates(new NamedNode('s2'), null, null).should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });

      describe('with an existing object parameter', () => {
        it('should return all predicates with this object', () => {
          store.getPredicates(null, new NamedNode('o1'), null).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with an existing graph parameter', () => {
        it('should return all predicates in the graph', () => {
          store.getPredicates(null, null, new NamedNode('c4')).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with no parameters', () => {
        it('should return all predicates', () => {
          store.getPredicates(null, null, null).should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });
    });

    describe('getObjects', () => {
      describe('with existing subject, predicate and graph parameters', () => {
        it('should return all objects with this subject, predicate and graph', () => {
          store.getObjects(new NamedNode('s1'), new NamedNode('p1'), new DefaultGraph()).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with existing subject and predicate parameters', () => {
        it('should return all objects with this subject and predicate', () => {
          store.getObjects(new NamedNode('s1'), new NamedNode('p1'), null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with existing subject and graph parameters', () => {
        it('should return all objects with this subject and graph', () => {
          store.getObjects(new NamedNode('s1'), null, new DefaultGraph()).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with existing predicate and graph parameters', () => {
        it('should return all objects with this predicate and graph', () => {
          store.getObjects(null, new NamedNode('p1'), new DefaultGraph()).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2'), new NamedNode('o3')]);
        });
      });

      describe('with an existing subject parameter', () => {
        it('should return all objects with this subject', () => {
          store.getObjects(new NamedNode('s1'), null, null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with an existing predicate parameter', () => {
        it('should return all objects with this predicate', () => {
          store.getObjects(null, new NamedNode('p1'), null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2'),  new NamedNode('o3')]);
        });
      });

      describe('with an existing graph parameter', () => {
        it('should return all objects in the graph', () => {
          store.getObjects(null, null, new NamedNode('c4')).should.have.deep.members([new NamedNode('o1')]);
        });
      });

      describe('with no parameters', () => {
        it('should return all objects', () => {
          store.getObjects(null, null, null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2'), new NamedNode('o3')]);
        });
      });
    });

    describe('getGraphs', () => {
      describe('with existing subject, predicate and object parameters', () => {
        it('should return all graphs with this subject, predicate and object', () => {
          store.getGraphs(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });

      describe('with existing subject and predicate parameters', () => {
        it('should return all graphs with this subject and predicate', () => {
          store.getGraphs(new NamedNode('s1'), new NamedNode('p1'), null).should.have.deep.members([new NamedNode('c4'),  new DefaultGraph()]);
        });
      });

      describe('with existing subject and object parameters', () => {
        it('should return all graphs with this subject and object', () => {
          store.getGraphs(new NamedNode('s1'), null, new NamedNode('o2')).should.have.deep.members([new DefaultGraph()]);
        });
      });

      describe('with existing predicate and object parameters', () => {
        it('should return all graphs with this predicate and object', () => {
          store.getGraphs(null, new NamedNode('p1'), new NamedNode('o1')).should.have.deep.members([new DefaultGraph(), new NamedNode('c4')]);
        });
      });

      describe('with an existing subject parameter', () => {
        it('should return all graphs with this subject', () => {
          store.getGraphs(new NamedNode('s1'), null, null).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });

      describe('with an existing predicate parameter', () => {
        it('should return all graphs with this predicate', () => {
          store.getGraphs(null, new NamedNode('p1'), null).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });

      describe('with an existing object parameter', () => {
        it('should return all graphs with this object', () => {
          store.getGraphs(null, null, new NamedNode('o2')).should.have.deep.members([new DefaultGraph()]);
        });
      });

      describe('with no parameters', () => {
        it('should return all graphs', () => {
          store.getGraphs(null, null, null).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });
    });

    describe('forEach', () => {
      describe('with existing subject, predicate, object and graph parameters', () => {
        it('should have iterated all items with this subject, predicate, object and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', 'o2', ''),
                           ['s1', 'p1', 'o2', '']));
      });

      describe('with existing subject, predicate and object parameters', () => {
        it('should have iterated all items with this subject, predicate and object',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p2', 'o2', null),
                           ['s1', 'p2', 'o2', '']));
      });

      describe('with existing subject, predicate and graph parameters', () => {
        it('should have iterated all items with this subject, predicate and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', null, ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', '']));
      });

      describe('with existing subject, object and graph parameters', () => {
        it('should have iterated all items with this subject, object and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, 'o2', ''),
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p2', 'o2', '']));
      });

      describe('with existing predicate, object and graph parameters', () => {
        it('should have iterated all items with this predicate, object and graph',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', 'o1', ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', '']));
      });

      describe('with existing subject and predicate parameters', () => {
        it('should iterate all items with this subject and predicate',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', null, null),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with existing subject and object parameters', () => {
        it('should iterate all items with this subject and predicate',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, 'o2', null),
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p2', 'o2', '']));
      });

      describe('with existing subject and graph parameters', () => {
        it('should iterate all items with this subject and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, null, 'c4'),
                         ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with existing predicate and object parameters', () => {
        it('should iterate all items with this predicate and object',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', 'o1', null),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with existing predicate and graph parameters', () => {
        it('should iterate all items with this predicate and graph',
        shouldIncludeAll(collect(store, 'forEach', null, 'p1', null, ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s2', 'p1', 'o1', ''],
                           [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']));
      });

      describe('with existing object and graph parameters', () => {
        it('should iterate all items with this object and graph',
          shouldIncludeAll(collect(store, 'forEach', null, null, 'o1', ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', '']));
      });

      describe('with an existing subject parameter', () => {
        it('should iterate all items with this subject',
          shouldIncludeAll(collect(store, 'forEach', 's2', null, null, null),
                         ['s2', 'p1', 'o1', ''],
                         ['s2', 'p2', 'o2', '']));
      });

      describe('with an existing predicate parameter', () => {
        it('should iterate all items with this predicate',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', null, null),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4'],
                           [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']));
      });

      describe('with an existing object parameter', () => {
        it('should iterate all items with this object',
          shouldIncludeAll(collect(store, 'forEach', null, null, 'o1', null),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with an existing graph parameter', () => {
        it('should iterate all items with this graph',
          shouldIncludeAll(collect(store, 'forEach', null, null, null, ''),
                           ['s1', 'p1', 'o1'],
                           ['s1', 'p1', 'o2'],
                           ['s1', 'p2', 'o2'],
                           ['s2', 'p1', 'o1'],
                           ['s2', 'p2', 'o2'],
                           [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']));
      });

      describe('with no parameters', () => {
        it('should iterate all items',
          shouldIncludeAll(collect(store, 'forEach', null, null, null, null),
                           ['s1', 'p1', 'o1'],
                           ['s1', 'p1', 'o2'],
                           ['s1', 'p2', 'o2'],
                           ['s2', 'p1', 'o1'],
                           ['s2', 'p2', 'o2'],
                           ['s1', 'p1', 'o1', 'c4'],
                           [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']));
      });
    });

    describe('forSubjects', () => {
      describe('with existing predicate, object and graph parameters', () => {
        it('should iterate all subjects with this predicate, object and graph', () => {
          collect(store, 'forSubjects', 'p1', 'o1', '').should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });
      describe('with a non-existing predicate', () => {
        it('should be empty', () => {
          collect(store, 'forSubjects', 'p3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing object', () => {
        it('should be empty', () => {
          collect(store, 'forSubjects', null, 'o4', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          collect(store, 'forSubjects', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('forPredicates', () => {
      describe('with existing subject, object and graph parameters', () => {
        it('should iterate all predicates with this subject, object and graph', () => {
          collect(store, 'forPredicates', 's1', 'o2', '').should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });
      describe('with a non-existing subject', () => {
        it('should be empty', () => {
          collect(store, 'forPredicates', 's3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing object', () => {
        it('should be empty', () => {
          collect(store, 'forPredicates', null, 'o4', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          collect(store, 'forPredicates', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('forObjects', () => {
      describe('with existing subject, predicate and graph parameters', () => {
        it('should iterate all objects with this subject, predicate and graph', () => {
          collect(store, 'forObjects', 's1', 'p1', '').should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });
      describe('with a non-existing subject', () => {
        it('should be empty', () => {
          collect(store, 'forObjects', 's3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing predicate', () => {
        it('should be empty', () => {
          collect(store, 'forObjects', null, 'p3', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          collect(store, 'forObjects', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('forGraphs', () => {
      describe('with existing subject, predicate and object parameters', () => {
        it('should iterate all graphs with this subject, predicate and object', () => {
          collect(store, 'forGraphs', 's1', 'p1', 'o1').should.have.deep.members([new DefaultGraph(), new NamedNode('c4')]);
        });
      });
      describe('with a non-existing subject', () => {
        it('should be empty', () => {
          collect(store, 'forObjects', 's3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing predicate', () => {
        it('should be empty', () => {
          collect(store, 'forObjects', null, 'p3', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', () => {
        it('should be empty', () => {
          collect(store, 'forPredicates', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('every', () => {
      let count = 3;
      function thirdTimeFalse() { return count-- === 0; }

      describe('with no parameters and a callback always returning true', () => {
        it('should return true', () => {
          store.every(alwaysTrue, null, null, null, null).should.be.true;
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return false', () => {
          store.every(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback that returns false after 3 calls', () => {
        it('should return false', () => {
          store.every(thirdTimeFalse, null, null, null, null).should.be.false;
        });
      });
    });

    describe('some', () => {
      let count = 3;
      function thirdTimeFalse() { return count-- !== 0; }

      describe('with no parameters and a callback always returning true', () => {
        it('should return true', () => {
          store.some(alwaysTrue, null, null, null, null).should.be.true;
        });
      });
      describe('with no parameters and a callback always returning false', () => {
        it('should return false', () => {
          store.some(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback that returns true after 3 calls', () => {
        it('should return false', () => {
          store.some(thirdTimeFalse, null, null, null, null).should.be.true;
        });
      });
      describe('with a non-existing subject', () => {
        it('should return true', () => {
          store.some(null, new NamedNode('s3'), null, null, null).should.be.false;
        });
      });
      describe('with a non-existing predicate', () => {
        it('should return false', () => {
          store.some(null, null, new NamedNode('p3'), null, null).should.be.false;
        });
      });
      describe('with a non-existing object', () => {
        it('should return false', () => {
          store.some(null, null, null, new NamedNode('o4'), null).should.be.false;
        });
      });
      describe('with a non-existing graph', () => {
        it('should return false', () => {
          store.some(null, null, null, null, new NamedNode('g2')).should.be.false;
        });
      });
    });

    describe('when destructured', () => {
      it('should destructure all quads',
        shouldIncludeAll(
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
        should.equal(count, 7);
      });
    });

    describe('when spread', () => {
      it('should spread all quads',
        shouldIncludeAll(
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
      it('should yield all quads',
        shouldIncludeAll(
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
        store.countQuads().should.equal(7);
      });
    });

    describe('when counted with an existing subject parameter', () => {
      it('should count all items with this subject in all graphs', () => {
        store.countQuads(new NamedNode('s1'), null, null).should.equal(4);
      });
    });

    describe('when counted with a non-existing subject parameter', () => {
      it('should be empty', () => {
        store.countQuads(new NamedNode('s3'), null, null).should.equal(0);
      });
    });

    describe('when counted with a non-existing subject parameter that exists elsewhere', () => {
      it('should be empty', () => {
        store.countQuads(new NamedNode('p1'), null, null).should.equal(0);
      });
    });

    describe('when counted with an existing predicate parameter', () => {
      it('should count all items with this predicate in all graphs', () => {
        store.countQuads(null, new NamedNode('p1'), null).should.equal(5);
      });
    });

    describe('when counted with a non-existing predicate parameter', () => {
      it('should be empty', () => {
        store.countQuads(null, new NamedNode('p3'), null).should.equal(0);
      });
    });

    describe('when counted with an existing object parameter', () => {
      it('should count all items with this object in all graphs', () => {
        store.countQuads(null, null, 'o1').should.equal(3);
      });
    });

    describe('when counted with a non-existing object parameter', () => {
      it('should be empty', () => {
        store.countQuads(null, null, 'o4').should.equal(0);
      });
    });

    describe('when counted with existing subject and predicate parameters', () => {
      it('should count all items with this subject and predicate in all graphs', () => {
        store.countQuads('s1', 'p1', null).should.equal(3);
      });
    });

    describe('when counted with non-existing subject and predicate parameters', () => {
      it('should be empty', () => {
        store.countQuads('s2', 'p3', null).should.equal(0);
      });
    });

    describe('when counted with existing subject and object parameters', () => {
      it('should count all items with this subject and object in all graphs', () => {
        store.countQuads('s1', null, 'o1').should.equal(2);
      });
    });

    describe('when counted with non-existing subject and object parameters', () => {
      it('should be empty', () => {
        store.countQuads('s2', null, 'o3').should.equal(0);
      });
    });

    describe('when counted with existing predicate and object parameters', () => {
      it('should count all items with this predicate and object in all graphs', () => {
        store.countQuads(null, 'p1', 'o1').should.equal(3);
      });
    });

    describe('when counted with non-existing predicate and object parameters', () => {
      it('should be empty', () => {
        store.countQuads(null, 'p2', 'o3').should.equal(0);
      });
    });

    describe('when counted with existing subject, predicate, and object parameters', () => {
      it('should count all items with this subject, predicate, and object in all graphs', () => {
        store.countQuads('s1', 'p1', 'o1').should.equal(2);
      });
    });

    describe('when counted with a non-existing triple', () => {
      it('should be empty', () => {
        store.countQuads('s2', 'p2', 'o1').should.equal(0);
      });
    });

    describe('when counted with the default graph parameter', () => {
      it('should count all items in the default graph', () => {
        store.countQuads(null, null, null, new DefaultGraph()).should.equal(6);
      });
    });

    describe('when counted with an existing named graph parameter', () => {
      it('should count all items in that graph', () => {
        store.countQuads(null, null, null, 'c4').should.equal(1);
      });
    });

    describe('when counted with a non-existing named graph parameter', () => {
      it('should be empty', () => {
        store.countQuads(null, null, null, 'c5').should.equal(0);
      });
    });

    describe('when trying to remove a triple with a non-existing subject', () => {
      before(() => { store.removeQuad(new NamedNode('s0'), new NamedNode('p1'), new NamedNode('o1')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove a triple with a non-existing predicate', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('p0'), new NamedNode('o1')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove a triple with a non-existing object', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o0')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove a triple for which no subjects exist', () => {
      before(() => { store.removeQuad(new NamedNode('o1'), new NamedNode('p1'), new NamedNode('o1')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove a triple for which no predicates exist', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('s1'), new NamedNode('o1')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove a triple for which no objects exist', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('s1')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove a triple that does not exist', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o1')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove an incomplete triple', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), null, null).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when trying to remove a triple with a non-existing graph', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c0')).should.be.false; });
      it('should still have size 7', () => { store.size.should.eql(7); });
    });

    describe('when removing an existing triple', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')).should.be.true; });

      it('should have size 6', () => { store.size.should.eql(6); });

      it('should not contain that triple anymore',
        shouldIncludeAll(() => { return store.getQuads(); },
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s2', 'p2', 'o2'],
                         ['s1', 'p1', 'o1', 'c4'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']));
    });

    describe('when removing an existing triple from a named graph', () => {
      before(() => { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c4')).should.be.true; });

      it('should have size 5', () => { store.size.should.eql(5); });

      itShouldBeEmpty(() => { return store.getQuads(null, null, null, 'c4'); });
    });

    describe('when removing multiple triples', () => {
      before(() => {
        store.removeQuads([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s2'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
      });

      it('should have size 3', () => { store.size.should.eql(3); });

      it('should not contain those triples anymore',
        shouldIncludeAll(() => { return store.getQuads(); },
                         ['s1', 'p1', 'o2'],
                         ['s2', 'p2', 'o2'],
                         [termToId(new Quad('s2', 'p2', 'o2')), 'p1', 'o3', '']));
    });

    describe('when adding and removing a triple', () => {
      before(() => {
        store.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
        store.removeQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
      });

      it('should have an unchanged size', () => { store.size.should.eql(3); });
    });
  });

  describe('A Store containing a blank node', () => {
    const store = new Store();
    const b1 = store.createBlankNode();
    store.addQuad(new NamedNode('s1'), new NamedNode('p1'), b1).should.be.true;

    describe('when searched with more than one variable', () => {
      it('should return a triple with the blank node as an object',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', `_:${b1.value}`]));
    });

    describe('when searched with one variable', () => {
      it('should return a triple with the blank node as an object',
        shouldIncludeAll(store.getQuads('s1', 'p1'),
                         ['s1', 'p1', `_:${b1.value}`]));
    });
  });

  describe('A Store with a custom DataFactory', () => {
    const factory = {};
    let store;
    before(() => {
      factory.quad = function (s, p, o, g) { return { s: s, p: p, o: o, g: g }; };
      ['namedNode', 'blankNode', 'literal', 'variable', 'defaultGraph'].forEach(f => {
        factory[f] = function (n) { return n ? `${f[0]}-${n}` : f; };
      });

      store = new Store({ factory: factory });
      store.addQuad('s1', 'p1', 'o1').should.be.true;
      store.addQuad({ subject: 's1', predicate: 'p1', object: 'o2' }).should.be.true;
      store.addQuads([
        { subject: 's1', predicate: 'p2', object: 'o2' },
        { subject: 's2', predicate: 'p1', object: 'o1' },
      ]);
      store.addQuad('s1', 'p1', 'o1', 'c4').should.be.true;
    });

    it('should use the factory when returning quads', () => {
      store.getQuads().should.deep.equal([
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
      store.add.should.be.a('function');
      store.delete.should.be.a('function');
      store.has.should.be.a('function');
      store.match.should.be.a('function');
      store[Symbol.iterator].should.be.a('function');
    });

    // Test inspired by http://www.devthought.com/2012/01/18/an-object-is-not-a-hash/.
    // The value `__proto__` is not supported however – fixing it introduces too much overhead.
    it('should be able to contain entities with JavaScript object property names', () => {
      store.addQuad('toString', 'valueOf', 'toLocaleString', 'hasOwnProperty').should.be.true;
      shouldIncludeAll(store.getQuads(null, null, null, 'hasOwnProperty'),
                       ['toString', 'valueOf', 'toLocaleString', 'hasOwnProperty'])();
    });

    it('should be able to contain entities named "null"', () => {
      store.addQuad('null', 'null', 'null', 'null').should.be.true;
      shouldIncludeAll(store.getQuads(null, null, null, 'null'), ['null', 'null', 'null', 'null'])();
    });
  });

  describe('A Store containing a well-formed rdf:Collection as subject', () => {
    const store = new Store();
    const listElements = addList(store, new NamedNode('element1'), new Literal('"element2"'));
    store.addQuad(listElements[0], new NamedNode('p1'), new NamedNode('o1')).should.be.true;
    const listItemsJSON = {
      b0: [
        { termType: 'NamedNode', value: 'element1' },
        { termType: 'Literal', value: 'element2',
          language: '', datatype: { termType: 'NamedNode', value: namespaces.xsd.string } },
      ],
    };

    describe('extractLists without remove', () => {
      const lists = store.extractLists();
      it('should not delete triples',
        shouldIncludeAll(store.getQuads(),
          [`_:${listElements[0].value}`, 'p1', 'o1'],
          [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
          [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`],
          [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
          [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil]
        ));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).to.deep.equal(listItemsJSON);
      });
    });

    describe('extractLists with remove', () => {
      const lists = store.extractLists({ remove: true });
      it('should remove the first/rest triples and return the list members',
        shouldIncludeAll(store.getQuads(),
                         [`_:${listElements[0].value}`, 'p1', 'o1']));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).to.deep.equal(listItemsJSON);
      });
    });
  });

  describe('A Store containing a well-formed rdf:Collection as object', () => {
    const store = new Store();
    const listElements = addList(store, new NamedNode('element1'), new Literal('"element2"'));
    store.addQuad(new NamedNode('s1'), new NamedNode('p1'), listElements[0]).should.be.true;
    const listItemsJSON = {
      b0: [
        { termType: 'NamedNode', value: 'element1' },
        { termType: 'Literal', value: 'element2',
          language: '', datatype: { termType: 'NamedNode', value: namespaces.xsd.string } },
      ],
    };

    describe('extractLists without remove', () => {
      const lists = store.extractLists();
      it('should not delete triples',
        shouldIncludeAll(store.getQuads(),
          ['s1', 'p1', `_:${listElements[0].value}`],
          [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
          [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`],
          [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
          [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil]
        ));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).to.deep.equal(listItemsJSON);
      });
    });

    describe('extractLists with remove', () => {
      const lists = store.extractLists({ remove: true });
      it('should remove the first/rest triples and return the list members',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', `_:${listElements[0].value}`]));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).to.deep.equal(listItemsJSON);
      });
    });
  });

  describe('A Store containing a well-formed rdf:Collection that is not attached', () => {
    const store = new Store();
    const listElements = addList(store, new NamedNode('element1'), new Literal('"element2"'));
    store.addQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'));

    describe('extractLists without remove', () => {
      const lists = store.extractLists();
      it('should not delete triples',
        shouldIncludeAll(store.getQuads(),
          ['s1', 'p1', 'o1'],
          [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
          [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`],
          [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
          [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil]
        ));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).to.deep.equal({});
      });
    });

    describe('extractLists with remove', () => {
      const lists = store.extractLists({ remove: true });
      it('should remove the first/rest triples and return the list members',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', 'o1']));
      it('should generate a list of Collections', () => {
        expect(listsToJSON(lists)).to.deep.equal({});
      });
    });
  });

  describe('A Store containing a rdf:Collection without first', () => {
    const store = new Store();
    store.addQuad(store.createBlankNode(), new NamedNode(namespaces.rdf.rest), namespaces.rdf.nil).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b0 has no list head');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:first arcs on head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    store.addQuad(listElements[0], new NamedNode(namespaces.rdf.first), store.createBlankNode()).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b2 has multiple rdf:first arcs');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:first arcs on tail', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    store.addQuad(listElements[1], new NamedNode(namespaces.rdf.first), store.createBlankNode()).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b3 has multiple rdf:first arcs');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:rest arcs on head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    store.addQuad(listElements[0], new NamedNode(namespaces.rdf.rest), store.createBlankNode()).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b2 has multiple rdf:rest arcs');
    });
  });

  describe('A Store containing an rdf:Collection with multiple rdf:rest arcs on tail', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode());
    store.addQuad(listElements[1], new NamedNode(namespaces.rdf.rest), store.createBlankNode()).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b3 has multiple rdf:rest arcs');
    });
  });

  describe('A Store containing an rdf:Collection with non-list arcs out', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    store.addQuad(listElements[1], new NamedNode('http://a.example/foo'), store.createBlankNode()).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b4 can\'t be subject and object');
    });
  });

  describe('A Store containing an rdf:Collection with multiple incoming rdf:rest arcs', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    store.addQuad(store.createBlankNode(), new NamedNode(namespaces.rdf.rest), listElements[1]).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b4 has incoming rdf:rest arcs');
    });
  });

  describe('A Store containing an rdf:Collection with co-references out of head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    store.addQuad(listElements[0], new NamedNode('p1'), new NamedNode('o1')).should.be.true;
    store.addQuad(listElements[0], new NamedNode('p1'), new NamedNode('o2')).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b3 has non-list arcs out');
    });
  });

  describe('A Store containing an rdf:Collection with co-references into head', () => {
    const store = new Store();
    const listElements = addList(store, store.createBlankNode(), store.createBlankNode(), store.createBlankNode());
    store.addQuad(new NamedNode('s1'), new NamedNode('p1'), listElements[0]).should.be.true;
    store.addQuad(new NamedNode('s2'), new NamedNode(namespaces.rdf.rest), listElements[0]).should.be.true;
    store.addQuad(new NamedNode('s2'), new NamedNode('p1'), listElements[0]).should.be.true;

    it('extractLists throws an error', () => {
      expect(() => store.extractLists()).throws('b3 can\'t have coreferences');
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
    store.addQuad(listElements[0], new NamedNode(namespaces.rdf.first), member0).should.be.true;
    store.addQuad(listElements[0], new NamedNode(namespaces.rdf.rest), listElements[1], new NamedNode('g1')).should.be.true;
    store.addQuad(listElements[1], new NamedNode(namespaces.rdf.first), member1).should.be.true;
    store.addQuad(listElements[1], new NamedNode(namespaces.rdf.rest), new NamedNode(namespaces.rdf.nil)).should.be.true;
    store.addQuad(new NamedNode('s1'), new NamedNode('p1'), listElements[0]).should.be.true;

    describe('extractLists without ignoreErrors', () => {
      it('extractLists throws an error', () => {
        expect(() => store.extractLists()).throws('b0 not confined to single graph');
      });
    });

    describe('extractLists with ignoreErrors', () => {
      const lists = store.extractLists({ ignoreErrors: true });
      it('should not delete triples',
        shouldIncludeAll(store.getQuads(),
          ['s1', 'p1', `_:${listElements[0].value}`],
          [`_:${listElements[0].value}`, namespaces.rdf.first, 'element1'],
          [`_:${listElements[0].value}`, namespaces.rdf.rest, `_:${listElements[1].value}`, 'g1'],
          [`_:${listElements[1].value}`, namespaces.rdf.first, '"element2"'],
          [`_:${listElements[1].value}`, namespaces.rdf.rest, namespaces.rdf.nil]
        ));
      it('should generate an empty list of Collections', () => {
        expect(listsToJSON(lists)).to.deep.equal({});
      });
    });
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
        )
      ]);
    });

    it('Should apply rules', () => {
      expect(store.size).equal(2);
      store.reason([{
        premise: [new Quad(
          new Variable('?s'),
          new NamedNode('a'),
          new Variable('?o'),
        ),new Quad(
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
        ]
      }]);
      expect(store.size).equal(3);
      expect(store.has(
        new Quad(
          new NamedNode('http://example.org/s'),
          new NamedNode('a'),
          new NamedNode('http://example.org/o2'),
        )
      )).equal(true)
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
    ])
    expect(store.size).equal(3);
    store.reason([{
      premise: [new Quad(
        new Variable('?s'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?o'),
      ),new Quad(
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
      ]
    }]);
    expect(store.has(
      new Quad(
        new NamedNode('http://example.org#me'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing'),
      )
    )).equal(true)
    console.log(store.getQuads())
    expect(store.size).equal(4);
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
      )]
    );

    store.reason([
      {
        premise: [
          new Quad(
          new Variable('?s'),
          new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          new Variable('?o'),
        ),new Quad(
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
        ]
      },
      {
        premise: [new Quad(
          new Variable('?a'),
          new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
          new Variable('?x'),
        ),new Quad(
          new Variable('?u'), // With rules like this we *do not* need to iterate over the subject index so we should avoid doing so
          new Variable('?a'),
          new Variable('?v'), 
        )],
        conclusion: [
          new Quad(
            new Variable('?v'),
            new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            new Variable('?x'),
          ),
        ]
      },
    ]);

    expect(store.size).equal(7)
  });

  it('Should correctly apply the deep taxonomy benchmark', async () => {
    const store = new Store();
    await load(`../perf/data/deep-taxonomy/test-dl-100.n3`, store);

    store.reason([{
      premise: [new Quad(
        new Variable('?s'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?o'),
      ),new Quad(
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
      ]
    }])

    return expect(store.has(
      new Quad(
        new NamedNode('http://eulersharp.sourceforge.net/2009/12dtb/test#ind'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://eulersharp.sourceforge.net/2009/12dtb/test#A2'),
      ),
    )).equal(true)
  });

  it('Should correctly apply RDFS to TimBL profile and FOAF', async () => {

  const store = new Store();
  await load('../perf/data/foaf.ttl', store);
  await load('../perf/data/timbl.ttl', store);

  store.reason([{
    premise: [new Quad(
      new Variable('?s'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new Variable('?o'),
    ),new Quad(
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
    ]
  },
  {
    premise: [new Quad(
      new Variable('?s'),
      new Variable('?p'),
      new Variable('?o'),
    )],
    conclusion: [
      new Quad(
        new Variable('?p'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#Property'),
      ),
    ]
  },
  {
    premise: [new Quad(
      new Variable('?a'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#domain'),
      new Variable('?x'),
    ),new Quad(
      new Variable('?u'),
      new Variable('?a'),
      new Variable('?y'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?x'),
      ),
    ]
  },
  {
    premise: [new Quad(
      new Variable('?a'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
      new Variable('?x'),
    ),new Quad(
      new Variable('?u'), // With rules like this we *do not* need to iterate over the subject index so we should avoid doing so
      new Variable('?a'),
      new Variable('?v'),
    )],
    conclusion: [
      new Quad(
        new Variable('?v'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?x'),
      ),
    ]
  },
  {
    premise: [new Quad(
      new Variable('?u'),
      new Variable('?a'),
      new Variable('?x'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#Resource'),
      ),
      new Quad(
        new Variable('?x'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#Resource'),
      ),
    ]
  },
  {
    premise: [new Quad(
      new Variable('?u'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
      new Variable('?v'),
    ),new Quad(
      new Variable('?v'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
      new Variable('?x'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
        new Variable('?x'),
      )
    ]
  },
  {
    premise: [new Quad(
      new Variable('?u'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#Class'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#Resource'),
      )
    ]
  },
  {
    premise: [new Quad(
      new Variable('?u'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      new Variable('?x'),
    ), new Quad(
      new Variable('?v'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new Variable('?u'),
    )],
    conclusion: [
      new Quad(
        new Variable('?v'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?x'),
      )
    ]
  },{
    premise: [new Quad(
      new Variable('?u'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#Class'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new Variable('?u'),
      )
    ]
  },
  {
    premise: [new Quad(
      new Variable('?u'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      new Variable('?v'),
    ),new Quad(
      new Variable('?v'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      new Variable('?x'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new Variable('?x'),
      )
    ]
  },{
    premise: [new Quad(
      new Variable('?u'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#ContainerMembershipProperty'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#member'),
      )
    ]
  },
  {
    premise: [new Quad(
      new Variable('?u'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#Datatype'),
    )],
    conclusion: [
      new Quad(
        new Variable('?u'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        new NamedNode('http://www.w3.org/2000/01/rdf-schema#Literal'),
      )
    ]
  },
  ]);
  expect(store.size).equal(1712)
})
});

function load(filename, store) {
  return new Promise((res) => {
    new Parser({ baseIRI: 'http://example.org' }).parse(fs.createReadStream(path.join(__dirname, filename)), (error, quad) => {
      if (quad)
        store.add(quad);
      else {
        res();
      }
    });
    
  })
}

function alwaysTrue()  { return true;  }
function alwaysFalse() { return false; }

function collect(store, method, arg1, arg2, arg3, arg4) {
  const results = [];
  store[method](r => results.push(r),
    arg1 && termFromId(arg1),
    arg2 && termFromId(arg2),
    arg3 && termFromId(arg3),
    arg4 && termFromId(arg4)
  );
  return results;
}

function itShouldBeEmpty(result) {
  it('should be empty', () => {
    if (typeof result === 'function') result = result();
    result.should.be.empty;
  });
}

function shouldIncludeAll(result) {
  const items = Array.prototype.slice.call(arguments, 1).map(arg => {
    return new Quad(termFromId(arg[0]), termFromId(arg[1]), termFromId(arg[2]), termFromId(arg[3] || ''));
  });
  return function () {
    if (typeof result === 'function') result = result();
    result = result.map(r => { return r.toJSON(); });
    result.should.have.length(items.length);
    for (let i = 0; i < items.length; i++)
      result.should.include.something.that.deep.equals(items[i].toJSON());
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
