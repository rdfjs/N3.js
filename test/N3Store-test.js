var N3Store = require('../N3').Store;

var Readable = require('stream').Readable,
    DataFactory = require('../N3').DataFactory,
    arrayifyStream = require('arrayify-stream');
var NamedNode = DataFactory.internal.NamedNode,
    DefaultGraph = DataFactory.internal.DefaultGraph,
    Quad = DataFactory.internal.Quad,
    fromId = DataFactory.internal.fromId;

describe('N3Store', function () {
  describe('The N3Store module', function () {
    it('should be a function', function () {
      N3Store.should.be.a('function');
    });

    it('should be an N3Store constructor', function () {
      new N3Store().should.be.an.instanceof(N3Store);
    });
  });

  describe('An empty N3Store', function () {
    var store = new N3Store({});

    it('should have size 0', function () {
      expect(store.size).to.eql(0);
    });

    it('should be empty', function () {
      store.getQuads().should.be.empty;
    });

    describe('when importing a stream of 2 quads', function () {
      before(function (done) {
        var stream = new ArrayReader([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
        var events = store.import(stream);
        events.on('end', done);
      });

      it('should have size 2', function () { store.size.should.eql(2); });
    });

    describe('when removing a stream of 2 quads', function () {
      before(function (done) {
        var stream = new ArrayReader([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
        var events = store.remove(stream);
        events.on('end', done);
      });

      it('should have size 0', function () { store.size.should.eql(0); });
    });

    describe('every', function () {
      describe('with no parameters and a callback always returning true', function () {
        it('should return false', function () {
          store.every(alwaysTrue, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback always returning false', function () {
        it('should return false', function () {
          store.every(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
    });

    describe('some', function () {
      describe('with no parameters and a callback always returning true', function () {
        it('should return false', function () {
          store.some(alwaysTrue, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback always returning false', function () {
        it('should return false', function () {
          store.some(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
    });

    it('should still have size 0 (instead of null) after adding and removing a triple', function () {
      expect(store.size).to.eql(0);
      store.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
      store.removeQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
      expect(store.size).to.eql(0);
    });

    it('should be able to generate unnamed blank nodes', function () {
      store.createBlankNode().value.should.eql('b0');
      store.createBlankNode().value.should.eql('b1');

      store.addQuad('_:b0', '_:b1', '_:b2').should.be.true;
      store.createBlankNode().value.should.eql('b3');
      store.removeQuads(store.getQuads());
    });

    it('should be able to generate named blank nodes', function () {
      store.createBlankNode('blank').value.should.eql('blank');
      store.createBlankNode('blank').value.should.eql('blank1');
      store.createBlankNode('blank').value.should.eql('blank2');
    });

    it('should be able to store triples with generated blank nodes', function () {
      store.addQuad(store.createBlankNode('x'), new NamedNode('b'), new NamedNode('c')).should.be.true;
      shouldIncludeAll(store.getQuads(null, new NamedNode('b')), ['_:x', 'b', 'c'])();
      store.removeQuads(store.getQuads());
    });
  });

  describe('An N3Store with initialized with 3 elements', function () {
    var store = new N3Store([
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o2')),
      new Quad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o3')),
    ]);

    it('should have size 3', function () {
      store.size.should.eql(3);
    });

    describe('adding a triple that already exists', function () {
      it('should return false', function () {
        store.addQuad('s1', 'p1', 'o1').should.be.false;
      });

      it('should not increase the size', function () {
        store.size.should.eql(3);
      });
    });

    describe('adding a triple that did not exist yet', function () {
      it('should return true', function () {
        store.addQuad('s1', 'p1', 'o4').should.be.true;
      });

      it('should increase the size', function () {
        store.size.should.eql(4);
      });
    });

    describe('removing an existing triple', function () {
      it('should return true', function () {
        store.removeQuad('s1', 'p1', 'o4').should.be.true;
      });

      it('should decrease the size', function () {
        store.size.should.eql(3);
      });
    });

    describe('removing a non-existing triple', function () {
      it('should return false', function () {
        store.removeQuad('s1', 'p1', 'o5').should.be.false;
      });

      it('should not decrease the size', function () {
        store.size.should.eql(3);
      });
    });

    describe('removing matching quads', function () {
      it('should return the removed quads',
        forResultStream(shouldIncludeAll, function () { return store.removeMatches('s1', 'p1'); },
          ['s1', 'p1', 'o1'],
          ['s1', 'p1', 'o2'],
          ['s1', 'p1', 'o3']));

      it('should decrease the size', function () {
        store.size.should.eql(0);
      });
    });
  });

  describe('An N3Store with 5 elements', function () {
    var store = new N3Store();
    store.addQuad('s1', 'p1', 'o1').should.be.true;
    store.addQuad({ subject: 's1', predicate: 'p1', object: 'o2' }).should.be.true;
    store.addQuads([
      { subject: 's1', predicate: 'p2', object: 'o2' },
      { subject: 's2', predicate: 'p1', object: 'o1' },
    ]);
    store.addQuad('s1', 'p1', 'o1', 'c4').should.be.true;

    it('should have size 5', function () {
      store.size.should.eql(5);
    });

    describe('when searched without parameters', function () {
      it('should return all items',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with an existing subject parameter', function () {
      it('should return all items with this subject in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), null, null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing subject parameter', function () {
      itShouldBeEmpty(store.getQuads(new NamedNode('s3'), null, null));
    });

    describe('when searched with a non-existing subject parameter that exists elsewhere', function () {
      itShouldBeEmpty(store.getQuads(new NamedNode('p1'), null, null));
    });

    describe('when searched with an existing predicate parameter', function () {
      it('should return all items with this predicate in all graphs',
        shouldIncludeAll(store.getQuads(null, new NamedNode('p1'), null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing predicate parameter', function () {
      itShouldBeEmpty(store.getQuads(null, new NamedNode('p3'), null));
    });

    describe('when searched with an existing object parameter', function () {
      it('should return all items with this object in all graphs',
        shouldIncludeAll(store.getQuads(null, null, new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing object parameter', function () {
      itShouldBeEmpty(store.getQuads(null, null, new NamedNode('o4')));
    });

    describe('when searched with existing subject and predicate parameters', function () {
      it('should return all items with this subject and predicate in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), new NamedNode('p1'), null),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with non-existing subject and predicate parameters', function () {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), new NamedNode('p2'), null));
    });

    describe('when searched with existing subject and object parameters', function () {
      it('should return all items with this subject and object in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), null, new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with non-existing subject and object parameters', function () {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), new NamedNode('p2'), null));
    });

    describe('when searched with existing predicate and object parameters', function () {
      it('should return all items with this predicate and object in all graphs',
        shouldIncludeAll(store.getQuads(null, new NamedNode('p1'), new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with non-existing predicate and object parameters in the default graph', function () {
      itShouldBeEmpty(store.getQuads(null, new NamedNode('p2'), new NamedNode('o3'), new DefaultGraph()));
    });

    describe('when searched with existing subject, predicate, and object parameters', function () {
      it('should return all items with this subject, predicate, and object in all graphs',
        shouldIncludeAll(store.getQuads(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing triple', function () {
      itShouldBeEmpty(store.getQuads(new NamedNode('s2'), new NamedNode('p2'), new NamedNode('o1')));
    });

    describe('when searched with the default graph parameter', function () {
      it('should return all items in the default graph',
        shouldIncludeAll(store.getQuads(null, null, null, new DefaultGraph()),
                         ['s1', 'p1', 'o1'],
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1']));
    });

    describe('when searched with an existing named graph parameter', function () {
      it('should return all items in that graph',
        shouldIncludeAll(store.getQuads(null, null, null, new NamedNode('c4')),
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when searched with a non-existing named graph parameter', function () {
      itShouldBeEmpty(store.getQuads(null, null, null, new NamedNode('c5')));
    });

    describe('match', function () {
      describe('without parameters', function () {
        it('should return all items',
          forResultStream(shouldIncludeAll, store.match(),
            ['s1', 'p1', 'o1'],
            ['s1', 'p1', 'o2'],
            ['s1', 'p2', 'o2'],
            ['s2', 'p1', 'o1'],
            ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with an existing subject parameter', function () {
        it('should return all items with this subject in all graphs',
          forResultStream(shouldIncludeAll, store.match(new NamedNode('s1'), null, null),
            ['s1', 'p1', 'o1'],
            ['s1', 'p1', 'o2'],
            ['s1', 'p2', 'o2'],
            ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with non-existing predicate and object parameters in the default graph', function () {
        forResultStream(itShouldBeEmpty, store.match(null, new NamedNode('p2'), new NamedNode('o3'), new DefaultGraph()));
      });
    });

    describe('getSubjects', function () {
      describe('with existing predicate, object and graph parameters', function () {
        it('should return all subjects with this predicate, object and graph', function () {
          store.getSubjects(new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c4')).should.have.deep.members([new NamedNode('s1')]);
        });
      });

      describe('with existing predicate and object parameters', function () {
        it('should return all subjects with this predicate and object', function () {
          store.getSubjects(new NamedNode('p2'), new NamedNode('o2'), null).should.have.deep.members([new NamedNode('s1')]);
        });
      });

      describe('with existing predicate and graph parameters', function () {
        it('should return all subjects with this predicate and graph', function () {
          store.getSubjects(new NamedNode('p1'), null, new DefaultGraph()).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });

      describe('with existing object and graph parameters', function () {
        it('should return all subjects with this object and graph', function () {
          store.getSubjects(null, new NamedNode('o1'), new DefaultGraph()).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });

      describe('with an existing predicate parameter', function () {
        it('should return all subjects with this predicate', function () {
          store.getSubjects(new NamedNode('p1'), null, null).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });

      describe('with an existing object parameter', function () {
        it('should return all subjects with this object', function () {
          store.getSubjects(null, new NamedNode('o1'), null).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });

      describe('with an existing graph parameter', function () {
        it('should return all subjects in the graph', function () {
          store.getSubjects(null, null, new NamedNode('c4')).should.have.deep.members([new NamedNode('s1')]);
        });
      });

      describe('with no parameters', function () {
        it('should return all subjects', function () {
          store.getSubjects(null, null, null).should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });
    });

    describe('getPredicates', function () {
      describe('with existing subject, object and graph parameters', function () {
        it('should return all predicates with this subject, object and graph', function () {
          store.getPredicates(new NamedNode('s1'), new NamedNode('o1'), new NamedNode('c4')).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with existing subject and object parameters', function () {
        it('should return all predicates with this subject and object', function () {
          store.getPredicates(new NamedNode('s1'), new NamedNode('o2'), null).should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });

      describe('with existing subject and graph parameters', function () {
        it('should return all predicates with this subject and graph', function () {
          store.getPredicates(new NamedNode('s1'), null, new DefaultGraph()).should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });

      describe('with existing object and graph parameters', function () {
        it('should return all predicates with this object and graph', function () {
          store.getPredicates(null, new NamedNode('o1'), new DefaultGraph()).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with an existing subject parameter', function () {
        it('should return all predicates with this subject', function () {
          store.getPredicates(new NamedNode('s2'), null, null).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with an existing object parameter', function () {
        it('should return all predicates with this object', function () {
          store.getPredicates(null, new NamedNode('o1'), null).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with an existing graph parameter', function () {
        it('should return all predicates in the graph', function () {
          store.getPredicates(null, null, new NamedNode('c4')).should.have.deep.members([new NamedNode('p1')]);
        });
      });

      describe('with no parameters', function () {
        it('should return all predicates', function () {
          store.getPredicates(null, null, null).should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });
    });

    describe('getObjects', function () {
      describe('with existing subject, predicate and graph parameters', function () {
        it('should return all objects with this subject, predicate and graph', function () {
          store.getObjects(new NamedNode('s1'), new NamedNode('p1'), new DefaultGraph()).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with existing subject and predicate parameters', function () {
        it('should return all objects with this subject and predicate', function () {
          store.getObjects(new NamedNode('s1'), new NamedNode('p1'), null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with existing subject and graph parameters', function () {
        it('should return all objects with this subject and graph', function () {
          store.getObjects(new NamedNode('s1'), null, new DefaultGraph()).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with existing predicate and graph parameters', function () {
        it('should return all objects with this predicate and graph', function () {
          store.getObjects(null, new NamedNode('p1'), new DefaultGraph()).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with an existing subject parameter', function () {
        it('should return all objects with this subject', function () {
          store.getObjects(new NamedNode('s1'), null, null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with an existing predicate parameter', function () {
        it('should return all objects with this predicate', function () {
          store.getObjects(null, new NamedNode('p1'), null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });

      describe('with an existing graph parameter', function () {
        it('should return all objects in the graph', function () {
          store.getObjects(null, null, new NamedNode('c4')).should.have.deep.members([new NamedNode('o1')]);
        });
      });

      describe('with no parameters', function () {
        it('should return all objects', function () {
          store.getObjects(null, null, null).should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });
    });

    describe('getGraphs', function () {
      describe('with existing subject, predicate and object parameters', function () {
        it('should return all graphs with this subject, predicate and object', function () {
          store.getGraphs(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });

      describe('with existing subject and predicate parameters', function () {
        it('should return all graphs with this subject and predicate', function () {
          store.getGraphs(new NamedNode('s1'), new NamedNode('p1'), null).should.have.deep.members([new NamedNode('c4'),  new DefaultGraph()]);
        });
      });

      describe('with existing subject and object parameters', function () {
        it('should return all graphs with this subject and object', function () {
          store.getGraphs(new NamedNode('s1'), null, new NamedNode('o2')).should.have.deep.members([new DefaultGraph()]);
        });
      });

      describe('with existing predicate and object parameters', function () {
        it('should return all graphs with this predicate and object', function () {
          store.getGraphs(null, new NamedNode('p1'), new NamedNode('o1')).should.have.deep.members([new DefaultGraph(), new NamedNode('c4')]);
        });
      });

      describe('with an existing subject parameter', function () {
        it('should return all graphs with this subject', function () {
          store.getGraphs(new NamedNode('s1'), null, null).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });

      describe('with an existing predicate parameter', function () {
        it('should return all graphs with this predicate', function () {
          store.getGraphs(null, new NamedNode('p1'), null).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });

      describe('with an existing object parameter', function () {
        it('should return all graphs with this object', function () {
          store.getGraphs(null, null, new NamedNode('o2')).should.have.deep.members([new DefaultGraph()]);
        });
      });

      describe('with no parameters', function () {
        it('should return all graphs', function () {
          store.getGraphs(null, null, null).should.have.deep.members([new NamedNode('c4'), new DefaultGraph()]);
        });
      });
    });

    describe('forEach', function () {
      describe('with existing subject, predicate, object and graph parameters', function () {
        it('should have iterated all items with this subject, predicate, object and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', 'o2', ''),
                           ['s1', 'p1', 'o2', '']));
      });

      describe('with existing subject, predicate and object parameters', function () {
        it('should have iterated all items with this subject, predicate and object',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p2', 'o2', null),
                           ['s1', 'p2', 'o2', '']));
      });

      describe('with existing subject, predicate and graph parameters', function () {
        it('should have iterated all items with this subject, predicate and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', null, ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', '']));
      });

      describe('with existing subject, object and graph parameters', function () {
        it('should have iterated all items with this subject, object and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, 'o2', ''),
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p2', 'o2', '']));
      });

      describe('with existing predicate, object and graph parameters', function () {
        it('should have iterated all items with this predicate, object and graph',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', 'o1', ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', '']));
      });

      describe('with existing subject and predicate parameters', function () {
        it('should iterate all items with this subject and predicate',
          shouldIncludeAll(collect(store, 'forEach', 's1', 'p1', null, null),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with existing subject and object parameters', function () {
        it('should iterate all items with this subject and predicate',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, 'o2', null),
                           ['s1', 'p1', 'o2', ''],
                           ['s1', 'p2', 'o2', '']));
      });

      describe('with existing subject and graph parameters', function () {
        it('should iterate all items with this subject and graph',
          shouldIncludeAll(collect(store, 'forEach', 's1', null, null, 'c4'),
                         ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with existing predicate and object parameters', function () {
        it('should iterate all items with this predicate and object',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', 'o1', null),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with existing predicate and graph parameters', function () {
        it('should iterate all items with this predicate and graph',
        shouldIncludeAll(collect(store, 'forEach', null, 'p1', null, ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s2', 'p1', 'o1', '']));
      });

      describe('with existing object and graph parameters', function () {
        it('should iterate all items with this object and graph',
          shouldIncludeAll(collect(store, 'forEach', null, null, 'o1', ''),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', '']));
      });

      describe('with an existing subject parameter', function () {
        it('should iterate all items with this subject',
          shouldIncludeAll(collect(store, 'forEach', 's2', null, null, null),
                         ['s2', 'p1', 'o1', '']));
      });

      describe('with an existing predicate parameter', function () {
        it('should iterate all items with this predicate',
          shouldIncludeAll(collect(store, 'forEach', null, 'p1', null, null),
                           ['s1', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o2', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with an existing object parameter', function () {
        it('should iterate all items with this object',
          shouldIncludeAll(collect(store, 'forEach', null, null, 'o1', null),
                           ['s1', 'p1', 'o1', ''],
                           ['s2', 'p1', 'o1', ''],
                           ['s1', 'p1', 'o1', 'c4']));
      });

      describe('with an existing graph parameter', function () {
        it('should iterate all items with this graph',
          shouldIncludeAll(collect(store, 'forEach', null, null, null, ''),
                           ['s1', 'p1', 'o1'],
                           ['s1', 'p1', 'o2'],
                           ['s1', 'p2', 'o2'],
                           ['s2', 'p1', 'o1']));
      });

      describe('with no parameters', function () {
        it('should iterate all items',
          shouldIncludeAll(collect(store, 'forEach', null, null, null, null),
                           ['s1', 'p1', 'o1'],
                           ['s1', 'p1', 'o2'],
                           ['s1', 'p2', 'o2'],
                           ['s2', 'p1', 'o1'],
                           ['s1', 'p1', 'o1', 'c4']));
      });
    });

    describe('forSubjects', function () {
      describe('with existing predicate, object and graph parameters', function () {
        it('should iterate all subjects with this predicate, object and graph', function () {
          collect(store, 'forSubjects', 'p1', 'o1', '').should.have.deep.members([new NamedNode('s1'), new NamedNode('s2')]);
        });
      });
      describe('with a non-existing predicate', function () {
        it('should be empty', function () {
          collect(store, 'forSubjects', 'p3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing object', function () {
        it('should be empty', function () {
          collect(store, 'forSubjects', null, 'o4', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', function () {
        it('should be empty', function () {
          collect(store, 'forSubjects', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('forPredicates', function () {
      describe('with existing subject, object and graph parameters', function () {
        it('should iterate all predicates with this subject, object and graph', function () {
          collect(store, 'forPredicates', 's1', 'o2', '').should.have.deep.members([new NamedNode('p1'), new NamedNode('p2')]);
        });
      });
      describe('with a non-existing subject', function () {
        it('should be empty', function () {
          collect(store, 'forPredicates', 's3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing object', function () {
        it('should be empty', function () {
          collect(store, 'forPredicates', null, 'o4', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', function () {
        it('should be empty', function () {
          collect(store, 'forPredicates', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('forObjects', function () {
      describe('with existing subject, predicate and graph parameters', function () {
        it('should iterate all objects with this subject, predicate and graph', function () {
          collect(store, 'forObjects', 's1', 'p1', '').should.have.deep.members([new NamedNode('o1'), new NamedNode('o2')]);
        });
      });
      describe('with a non-existing subject', function () {
        it('should be empty', function () {
          collect(store, 'forObjects', 's3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing predicate', function () {
        it('should be empty', function () {
          collect(store, 'forObjects', null, 'p3', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', function () {
        it('should be empty', function () {
          collect(store, 'forObjects', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('forGraphs', function () {
      describe('with existing subject, predicate and object parameters', function () {
        it('should iterate all graphs with this subject, predicate and object', function () {
          collect(store, 'forGraphs', 's1', 'p1', 'o1').should.have.deep.members([new DefaultGraph(), new NamedNode('c4')]);
        });
      });
      describe('with a non-existing subject', function () {
        it('should be empty', function () {
          collect(store, 'forObjects', 's3', null, null).should.be.empty;
        });
      });
      describe('with a non-existing predicate', function () {
        it('should be empty', function () {
          collect(store, 'forObjects', null, 'p3', null).should.be.empty;
        });
      });
      describe('with a non-existing graph', function () {
        it('should be empty', function () {
          collect(store, 'forPredicates', null, null, 'g2').should.be.empty;
        });
      });
    });

    describe('every', function () {
      var count = 3;
      function thirdTimeFalse() { return count-- === 0; }

      describe('with no parameters and a callback always returning true', function () {
        it('should return true', function () {
          store.every(alwaysTrue, null, null, null, null).should.be.true;
        });
      });
      describe('with no parameters and a callback always returning false', function () {
        it('should return false', function () {
          store.every(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback that returns false after 3 calls', function () {
        it('should return false', function () {
          store.every(thirdTimeFalse, null, null, null, null).should.be.false;
        });
      });
    });

    describe('some', function () {
      var count = 3;
      function thirdTimeFalse() { return count-- !== 0; }

      describe('with no parameters and a callback always returning true', function () {
        it('should return true', function () {
          store.some(alwaysTrue, null, null, null, null).should.be.true;
        });
      });
      describe('with no parameters and a callback always returning false', function () {
        it('should return false', function () {
          store.some(alwaysFalse, null, null, null, null).should.be.false;
        });
      });
      describe('with no parameters and a callback that returns true after 3 calls', function () {
        it('should return false', function () {
          store.some(thirdTimeFalse, null, null, null, null).should.be.true;
        });
      });
      describe('with a non-existing subject', function () {
        it('should return true', function () {
          store.some(null, new NamedNode('s3'), null, null, null).should.be.false;
        });
      });
      describe('with a non-existing predicate', function () {
        it('should return false', function () {
          store.some(null, null, new NamedNode('p3'), null, null).should.be.false;
        });
      });
      describe('with a non-existing object', function () {
        it('should return false', function () {
          store.some(null, null, null, new NamedNode('o4'), null).should.be.false;
        });
      });
      describe('with a non-existing graph', function () {
        it('should return false', function () {
          store.some(null, null, null, null, new NamedNode('g2')).should.be.false;
        });
      });
    });

    describe('when counted without parameters', function () {
      it('should count all items in all graphs', function () {
        store.countQuads().should.equal(5);
      });
    });

    describe('when counted with an existing subject parameter', function () {
      it('should count all items with this subject in all graphs', function () {
        store.countQuads(new NamedNode('s1'), null, null).should.equal(4);
      });
    });

    describe('when counted with a non-existing subject parameter', function () {
      it('should be empty', function () {
        store.countQuads(new NamedNode('s3'), null, null).should.equal(0);
      });
    });

    describe('when counted with a non-existing subject parameter that exists elsewhere', function () {
      it('should be empty', function () {
        store.countQuads(new NamedNode('p1'), null, null).should.equal(0);
      });
    });

    describe('when counted with an existing predicate parameter', function () {
      it('should count all items with this predicate in all graphs', function () {
        store.countQuads(null, new NamedNode('p1'), null).should.equal(4);
      });
    });

    describe('when counted with a non-existing predicate parameter', function () {
      it('should be empty', function () {
        store.countQuads(null, new NamedNode('p3'), null).should.equal(0);
      });
    });

    describe('when counted with an existing object parameter', function () {
      it('should count all items with this object in all graphs', function () {
        store.countQuads(null, null, 'o1').should.equal(3);
      });
    });

    describe('when counted with a non-existing object parameter', function () {
      it('should be empty', function () {
        store.countQuads(null, null, 'o4').should.equal(0);
      });
    });

    describe('when counted with existing subject and predicate parameters', function () {
      it('should count all items with this subject and predicate in all graphs', function () {
        store.countQuads('s1', 'p1', null).should.equal(3);
      });
    });

    describe('when counted with non-existing subject and predicate parameters', function () {
      it('should be empty', function () {
        store.countQuads('s2', 'p2', null).should.equal(0);
      });
    });

    describe('when counted with existing subject and object parameters', function () {
      it('should count all items with this subject and object in all graphs', function () {
        store.countQuads('s1', null, 'o1').should.equal(2);
      });
    });

    describe('when counted with non-existing subject and object parameters', function () {
      it('should be empty', function () {
        store.countQuads('s2', 'p2', null).should.equal(0);
      });
    });

    describe('when counted with existing predicate and object parameters', function () {
      it('should count all items with this predicate and object in all graphs', function () {
        store.countQuads(null, 'p1', 'o1').should.equal(3);
      });
    });

    describe('when counted with non-existing predicate and object parameters', function () {
      it('should be empty', function () {
        store.countQuads(null, 'p2', 'o3').should.equal(0);
      });
    });

    describe('when counted with existing subject, predicate, and object parameters', function () {
      it('should count all items with this subject, predicate, and object in all graphs', function () {
        store.countQuads('s1', 'p1', 'o1').should.equal(2);
      });
    });

    describe('when counted with a non-existing triple', function () {
      it('should be empty', function () {
        store.countQuads('s2', 'p2', 'o1').should.equal(0);
      });
    });

    describe('when counted with the default graph parameter', function () {
      it('should count all items in the default graph', function () {
        store.countQuads(null, null, null, new DefaultGraph()).should.equal(4);
      });
    });

    describe('when counted with an existing named graph parameter', function () {
      it('should count all items in that graph', function () {
        store.countQuads(null, null, null, 'c4').should.equal(1);
      });
    });

    describe('when counted with a non-existing named graph parameter', function () {
      it('should be empty', function () {
        store.countQuads(null, null, null, 'c5').should.equal(0);
      });
    });

    describe('when trying to remove a triple with a non-existing subject', function () {
      before(function () { store.removeQuad(new NamedNode('s0'), new NamedNode('p1'), new NamedNode('o1')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove a triple with a non-existing predicate', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('p0'), new NamedNode('o1')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove a triple with a non-existing object', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o0')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove a triple for which no subjects exist', function () {
      before(function () { store.removeQuad(new NamedNode('o1'), new NamedNode('p1'), new NamedNode('o1')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove a triple for which no predicates exist', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('s1'), new NamedNode('o1')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove a triple for which no objects exist', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('s1')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove a triple that does not exist', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o1')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove an incomplete triple', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), null, null).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when trying to remove a triple with a non-existing graph', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c0')).should.be.false; });
      it('should still have size 5', function () { store.size.should.eql(5); });
    });

    describe('when removing an existing triple', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1')).should.be.true; });

      it('should have size 4', function () { store.size.should.eql(4); });

      it('should not contain that triple anymore',
        shouldIncludeAll(function () { return store.getQuads(); },
                         ['s1', 'p1', 'o2'],
                         ['s1', 'p2', 'o2'],
                         ['s2', 'p1', 'o1'],
                         ['s1', 'p1', 'o1', 'c4']));
    });

    describe('when removing an existing triple from a named graph', function () {
      before(function () { store.removeQuad(new NamedNode('s1'), new NamedNode('p1'), new NamedNode('o1'), new NamedNode('c4')).should.be.true; });

      it('should have size 3', function () { store.size.should.eql(3); });

      itShouldBeEmpty(function () { return store.getQuads(null, null, null, 'c4'); });
    });

    describe('when removing multiple triples', function () {
      before(function () {
        store.removeQuads([
          new Quad(new NamedNode('s1'), new NamedNode('p2'), new NamedNode('o2')),
          new Quad(new NamedNode('s2'), new NamedNode('p1'), new NamedNode('o1')),
        ]);
      });

      it('should have size 1', function () { store.size.should.eql(1); });

      it('should not contain those triples anymore',
        shouldIncludeAll(function () { return store.getQuads(); },
                         ['s1', 'p1', 'o2']));
    });

    describe('when adding and removing a triple', function () {
      before(function () {
        store.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
        store.removeQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.be.true;
      });

      it('should have an unchanged size', function () { store.size.should.eql(1); });
    });
  });

  describe('An N3Store containing a blank node', function () {
    var store = new N3Store();
    var b1 = store.createBlankNode();
    store.addQuad(new NamedNode('s1'), new NamedNode('p1'), b1).should.be.true;

    describe('when searched with more than one variable', function () {
      it('should return a triple with the blank node as an object',
        shouldIncludeAll(store.getQuads(),
                         ['s1', 'p1', '_:' + b1.value]));
    });

    describe('when searched with one variable', function () {
      it('should return a triple with the blank node as an object',
        shouldIncludeAll(store.getQuads('s1', 'p1'),
                         ['s1', 'p1', '_:' + b1.value]));
    });
  });

  describe('An N3Store with a custom DataFactory', function () {
    var store, factory = {};
    before(function () {
      factory.quad = function (s, p, o, g) { return { s: s, p: p, o: o, g: g }; };
      ['namedNode', 'blankNode', 'literal', 'variable', 'defaultGraph'].forEach(function (f) {
        factory[f] = function (n) { return n ? f[0] + '-' + n : f; };
      });

      store = new N3Store({ factory: factory });
      store.addQuad('s1', 'p1', 'o1').should.be.true;
      store.addQuad({ subject: 's1', predicate: 'p1', object: 'o2' }).should.be.true;
      store.addQuads([
        { subject: 's1', predicate: 'p2', object: 'o2' },
        { subject: 's2', predicate: 'p1', object: 'o1' },
      ]);
      store.addQuad('s1', 'p1', 'o1', 'c4').should.be.true;
    });

    it('should use the factory when returning quads', function () {
      store.getQuads().should.deep.equal([
        { s: 'n-s1', p: 'n-p1', o: 'n-o1', g: 'defaultGraph' },
        { s: 'n-s1', p: 'n-p1', o: 'n-o2', g: 'defaultGraph' },
        { s: 'n-s1', p: 'n-p2', o: 'n-o2', g: 'defaultGraph' },
        { s: 'n-s2', p: 'n-p1', o: 'n-o1', g: 'defaultGraph' },
        { s: 'n-s1', p: 'n-p1', o: 'n-o1', g: 'n-c4'         },
      ]);
    });
  });

  describe('An N3Store', function () {
    var store = new N3Store();

    // Test inspired by http://www.devthought.com/2012/01/18/an-object-is-not-a-hash/.
    // The value `__proto__` is not supported however – fixing it introduces too much overhead.
    it('should be able to contain entities with JavaScript object property names', function () {
      store.addQuad('toString', 'valueOf', 'toLocaleString', 'hasOwnProperty').should.be.true;
      shouldIncludeAll(store.getQuads(null, null, null, 'hasOwnProperty'),
                       ['toString', 'valueOf', 'toLocaleString', 'hasOwnProperty'])();
    });

    it('should be able to contain entities named "null"', function () {
      store.addQuad('null', 'null', 'null', 'null').should.be.true;
      shouldIncludeAll(store.getQuads(null, null, null, 'null'), ['null', 'null', 'null', 'null'])();
    });
  });
});

function alwaysTrue()  { return true;  }
function alwaysFalse() { return false; }

function collect(store, method, arg1, arg2, arg3, arg4) {
  var results = [];
  store[method](function (r) { results.push(r); }, arg1 && fromId(arg1), arg2 && fromId(arg2), arg3 && fromId(arg3), arg4 && fromId(arg4));
  return results;
}

function itShouldBeEmpty(result) {
  it('should be empty', function () {
    if (typeof result === 'function') result = result();
    result.should.be.empty;
  });
}

function shouldIncludeAll(result) {
  var items = Array.prototype.slice.call(arguments, 1).map(function (arg) {
    return new Quad(fromId(arg[0]), fromId(arg[1]), fromId(arg[2]), fromId(arg[3] || ''));
  });
  return function () {
    if (typeof result === 'function') result = result();
    result = result.map(function (r) { return r.toJSON(); });
    result.should.have.length(items.length);
    for (var i = 0; i < items.length; i++)
      result.should.include.something.that.deep.equals(items[i].toJSON());
  };
}

function forResultStream(testFunction, result) {
  var items = Array.prototype.slice.call(arguments, 2);
  return function (done) {
    if (typeof result === 'function') result = result();
    arrayifyStream(result)
      .then(function (array) {
        items.unshift(array);
        testFunction.apply(this, items)();
      })
      .then(done, done);
  };
}

function ArrayReader(items) {
  var reader = new Readable({ objectMode: true });
  reader._read = function () { this.push(items.shift() || null); };
  return reader;
}
