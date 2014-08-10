var N3Store = require('../N3').Store;
var chai = require('chai'),
    expect = chai.expect;
chai.should();
chai.use(require('chai-things'));

describe('N3Store', function () {
  describe('The N3Store module', function () {
    it('should be a function', function () {
      N3Store.should.be.a('function');
    });

    it('should make N3Store objects', function () {
      N3Store().should.be.an.instanceof(N3Store);
    });

    it('should be an N3Store constructor', function () {
      new N3Store().should.be.an.instanceof(N3Store);
    });
  });

  describe('An empty N3Store', function () {
    var n3Store = new N3Store();

    it('should have size 0', function () {
      expect(n3Store.size).to.eql(0); // special test format for IE9
    });

    it('should be empty', function () {
      n3Store.find().should.be.empty;
    });

    it('should have a default context', function () {
      n3Store.defaultContext.should.eql('n3/contexts#default');
    });

    it('should be able to create unnamed blank nodes', function () {
      n3Store.createBlankNode().should.eql('_:b0');
      n3Store.createBlankNode().should.eql('_:b1');

      n3Store.addTriple('_:b0', '_:b1', '_:b2');
      n3Store.createBlankNode().should.eql('_:b3');
    });

    it('should be able to create named blank nodes', function () {
      n3Store.createBlankNode('blank').should.eql('_:blank');
      n3Store.createBlankNode('blank').should.eql('_:blank1');
      n3Store.createBlankNode('blank').should.eql('_:blank2');
    });
  });

  describe('An N3Store with initialized with 3 elements', function () {
    var n3Store = new N3Store([
      { subject: 's1', predicate: 'p1', object: 'o1'},
      { subject: 's1', predicate: 'p1', object: 'o2'},
      { subject: 's1', predicate: 'p1', object: 'o3'},
    ]);

    it('should have size 3', function () {
      n3Store.size.should.eql(3);
    });
  });

  describe('An N3Store with 5 elements', function () {
    var n3Store = new N3Store();
    n3Store.addTriple('s1', 'p1', 'o1');
    n3Store.addTriple({ subject: 's1', predicate: 'p1', object: 'o2'});
    n3Store.addTriples([
      { subject: 's1', predicate: 'p2', object: 'o2'},
      { subject: 's2', predicate: 'p1', object: 'o1'},
    ]);
    n3Store.addTriple('s1', 'p2', 'o3', 'c4');

    it('should have size 5', function () {
      n3Store.size.should.eql(5);
    });

    describe('when searched without parameters', function () {
      it('should return all items in the default context',
        shouldIncludeAll(n3Store.find(),
                         ['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2'], ['s2', 'p1', 'o1']));
    });

    describe('when searched with an existing subject parameter', function () {
      it('should return all items with this subject in the default context',
        shouldIncludeAll(n3Store.find('s1', null, null),
                         ['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2']));
    });

    describe('when searched with a non-existing subject parameter', function () {
      itShouldBeEmpty(n3Store.find('s3', null, null));
    });

    describe('when searched with a non-existing subject parameter that exists elsewhere', function () {
      itShouldBeEmpty(n3Store.find('p1', null, null));
    });

    describe('when searched with an existing predicate parameter', function () {
      it('should return all items with this predicate in the default context',
        shouldIncludeAll(n3Store.find(null, 'p1', null),
                         ['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s2', 'p1', 'o1']));
    });

    describe('when searched with a non-existing predicate parameter', function () {
      itShouldBeEmpty(n3Store.find(null, 'p3', null));
    });

    describe('when searched with an existing object parameter', function () {
      it('should return all items with this object in the default context',
        shouldIncludeAll(n3Store.find(null, null, 'o1'), ['s1', 'p1', 'o1'], ['s2', 'p1', 'o1']));
    });

    describe('when searched with a non-existing object parameter', function () {
      itShouldBeEmpty(n3Store.find(null, null, 'o4'));
    });

    describe('when searched with existing subject and predicate parameters', function () {
      it('should return all items with this subject and predicate in the default context',
        shouldIncludeAll(n3Store.find('s1', 'p1', null), ['s1', 'p1', 'o1'], ['s1', 'p1', 'o2']));
    });

    describe('when searched with non-existing subject and predicate parameters', function () {
      itShouldBeEmpty(n3Store.find('s2', 'p2', null));
    });

    describe('when searched with existing subject and object parameters', function () {
      it('should return all items with this subject and object in the default context',
        shouldIncludeAll(n3Store.find('s1', null, 'o2'), ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2']));
    });

    describe('when searched with non-existing subject and object parameters', function () {
      itShouldBeEmpty(n3Store.find('s2', 'p2', null));
    });

    describe('when searched with existing predicate and object parameters', function () {
      it('should return all items with this predicate and object in the default context',
        shouldIncludeAll(n3Store.find(null, 'p1', 'o1'), ['s1', 'p1', 'o1'], ['s2', 'p1', 'o1']));
    });

    describe('when searched with non-existing predicate and object parameters', function () {
      itShouldBeEmpty(n3Store.find(null, 'p2', 'o3'));
    });

    describe('when searched with existing subject, predicate, and object parameters', function () {
      it('should return all items with this subject, predicate, and object in the default context',
        shouldIncludeAll(n3Store.find('s1', 'p1', 'o1'), ['s1', 'p1', 'o1']));
    });

    describe('when searched with a non-existing triple', function () {
      itShouldBeEmpty(n3Store.find('s2', 'p2', 'o1'));
    });

    describe('when searched with the default context parameter', function () {
      it('should return all items in the default context',
        shouldIncludeAll(n3Store.find(),
                         ['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2'], ['s2', 'p1', 'o1']));
    });

    describe('when searched with an existing non-default context parameter', function () {
      it('should return all items in that context',
        shouldIncludeAll(n3Store.find(null, null, null, 'c4'), ['s1', 'p2', 'o3', 'c4']));
    });

    describe('when searched with a non-existing non-default context parameter', function () {
      itShouldBeEmpty(n3Store.find(null, null, null, 'c5'));
    });

    describe('when counted without parameters', function () {
      it('should count all items in the default context', function () {
        n3Store.count().should.equal(4);
      });
    });

    describe('when counted with an existing subject parameter', function () {
      it('should count all items with this subject in the default context', function () {
        n3Store.count('s1', null, null).should.equal(3);
      });
    });

    describe('when counted with a non-existing subject parameter', function () {
      it('should be empty', function () {
        n3Store.count('s3', null, null).should.equal(0);
      });
    });

    describe('when counted with a non-existing subject parameter that exists elsewhere', function () {
      it('should be empty', function () {
        n3Store.count('p1', null, null).should.equal(0);
      });
    });

    describe('when counted with an existing predicate parameter', function () {
      it('should count all items with this predicate in the default context', function () {
        n3Store.count(null, 'p1', null).should.equal(3);
      });
    });

    describe('when counted with a non-existing predicate parameter', function () {
      it('should be empty', function () {
        n3Store.count(null, 'p3', null).should.equal(0);
      });
    });

    describe('when counted with an existing object parameter', function () {
      it('should count all items with this object in the default context', function () {
        n3Store.count(null, null, 'o1').should.equal(2);
      });
    });

    describe('when counted with a non-existing object parameter', function () {
      it('should be empty', function () {
        n3Store.count(null, null, 'o4').should.equal(0);
      });
    });

    describe('when counted with existing subject and predicate parameters', function () {
      it('should count all items with this subject and predicate in the default context', function () {
        n3Store.count('s1', 'p1', null).should.equal(2);
      });
    });

    describe('when counted with non-existing subject and predicate parameters', function () {
      it('should be empty', function () {
        n3Store.count('s2', 'p2', null).should.equal(0);
      });
    });

    describe('when counted with existing subject and object parameters', function () {
      it('should count all items with this subject and object in the default context', function () {
        n3Store.count('s1', null, 'o2').should.equal(2);
      });
    });

    describe('when counted with non-existing subject and object parameters', function () {
      it('should be empty', function () {
        n3Store.count('s2', 'p2', null).should.equal(0);
      });
    });

    describe('when counted with existing predicate and object parameters', function () {
      it('should count all items with this predicate and object in the default context', function () {
        n3Store.count(null, 'p1', 'o1').should.equal(2);
      });
    });

    describe('when counted with non-existing predicate and object parameters', function () {
      it('should be empty', function () {
        n3Store.count(null, 'p2', 'o3').should.equal(0);
      });
    });

    describe('when counted with existing subject, predicate, and object parameters', function () {
      it('should count all items with this subject, predicate, and object in the default context', function () {
        n3Store.count('s1', 'p1', 'o1').should.equal(1);
      });
    });

    describe('when counted with a non-existing triple', function () {
      it('should be empty', function () {
        n3Store.count('s2', 'p2', 'o1').should.equal(0);
      });
    });

    describe('when counted with the default context parameter', function () {
      it('should count all items in the default context', function () {
        n3Store.count().should.equal(4);
      });
    });

    describe('when counted with an existing non-default context parameter', function () {
      it('should count all items in that context', function () {
        n3Store.count(null, null, null, 'c4').should.equal(1);
      });
    });

    describe('when counted with a non-existing non-default context parameter', function () {
      it('should be empty', function () {
        n3Store.count(null, null, null, 'c5').should.equal(0);
      });
    });

    describe('when trying to remove a triple with a non-existing subject', function () {
      before(function () { n3Store.removeTriple('s0', 'p1', 'o1'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove a triple with a non-existing predicate', function () {
      before(function () { n3Store.removeTriple('s1', 'p0', 'o1'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove a triple with a non-existing object', function () {
      before(function () { n3Store.removeTriple('s1', 'p1', 'o0'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove a triple for which no subjects exist', function () {
      before(function () { n3Store.removeTriple('o1', 'p1', 'o1'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove a triple for which no predicates exist', function () {
      before(function () { n3Store.removeTriple('s1', 's1', 'o1'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove a triple for which no objects exist', function () {
      before(function () { n3Store.removeTriple('s1', 'p1', 's1'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove a triple that does not exist', function () {
      before(function () { n3Store.removeTriple('s1', 'p2', 'o1'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove an incomplete triple', function () {
      before(function () { n3Store.removeTriple('s1', null, null); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when trying to remove a triple with a non-existing context', function () {
      before(function () { n3Store.removeTriple('s1', 'p1', 'o1', 'c0'); });
      it('should still have size 5', function () { n3Store.size.should.eql(5); });
    });

    describe('when removing an existing triple', function () {
      before(function () { n3Store.removeTriple('s1', 'p1', 'o1'); });

      it('should have size 4', function () { n3Store.size.should.eql(4); });

      it('should not contain that triple anymore',
        shouldIncludeAll(function () { return n3Store.find(); },
                         ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2'], ['s2', 'p1', 'o1']));
    });

    describe('when removing an existing triple from a non-default context', function () {
      before(function () { n3Store.removeTriple('s1', 'p2', 'o3', 'c4'); });

      it('should have size 3', function () { n3Store.size.should.eql(3); });

      itShouldBeEmpty(function () { return n3Store.find(null, null, null, 'c4'); });
    });

    describe('when removing multiple triples', function () {
      before(function () {
        n3Store.removeTriples([
          { subject: 's1', predicate: 'p2', object: 'o2'},
          { subject: 's2', predicate: 'p1', object: 'o1'},
        ]);
      });

      it('should have size 1', function () { n3Store.size.should.eql(1); });

      it('should not contain those triples anymore',
        shouldIncludeAll(function () { return n3Store.find(); },
                         ['s1', 'p1', 'o2']));
    });

    describe('when adding and removing a triple', function () {
      before(function () {
        n3Store.addTriple('a', 'b', 'c');
        n3Store.removeTriple('a', 'b', 'c');
      });

      it('should have an unchanged size', function () { n3Store.size.should.eql(1); });
    });
  });

  describe('An N3Store initialized with prefixes', function () {
    var n3Store = new N3Store([
      { subject: 'http://foo.org/#s1', predicate: 'http://bar.org/p1', object: 'http://foo.org/#o1' },
      { subject: 'http://foo.org/#s1', predicate: 'http://bar.org/p2', object: 'http://foo.org/#o1' },
      { subject: 'http://foo.org/#s2', predicate: 'http://bar.org/p1', object: 'http://foo.org/#o2' },
      { subject: 'http://foo.org/#s3', predicate: 'http://bar.org/p3', object: '"a"^^http://foo.org/#t1' },
    ],
    {
      'a': 'http://foo.org/#',
      'b': 'http://bar.org/',
      'ctx': 'n3/contexts#',
    });

    describe('should allow to query subjects with prefixes', function () {
      it('should return all triples with that subject',
        shouldIncludeAll(n3Store.find('a:s1', null, null),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s1', 'http://bar.org/p2', 'http://foo.org/#o1']));
    });

    describe('should allow to query predicates with prefixes', function () {
      it('should return all triples with that predicate',
        shouldIncludeAll(n3Store.find(null, 'b:p1', null),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s2', 'http://bar.org/p1', 'http://foo.org/#o2']));
    });

    describe('should allow to query objects with prefixes', function () {
      it('should return all triples with that object',
        shouldIncludeAll(n3Store.find(null, null, 'a:o1'),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s1', 'http://bar.org/p2', 'http://foo.org/#o1']));
    });

    describe('should allow to query contexts with prefixes', function () {
      it('should return all triples with that context',
        shouldIncludeAll(n3Store.find(null, null, null, 'ctx:default'),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s1', 'http://bar.org/p2', 'http://foo.org/#o1'],
                         ['http://foo.org/#s2', 'http://bar.org/p1', 'http://foo.org/#o2'],
                         ['http://foo.org/#s3', 'http://bar.org/p3', '"a"^^http://foo.org/#t1']));
    });
  });

  describe('An N3Store with prefixes added later on', function () {
    var n3Store = new N3Store([
      { subject: 'http://foo.org/#s1', predicate: 'http://bar.org/p1', object: 'http://foo.org/#o1' },
      { subject: 'http://foo.org/#s1', predicate: 'http://bar.org/p2', object: 'http://foo.org/#o1' },
      { subject: 'http://foo.org/#s2', predicate: 'http://bar.org/p1', object: 'http://foo.org/#o2' },
    ]);

    n3Store.addPrefix('a', 'http://foo.org/#');
    n3Store.addPrefixes({ 'b': 'http://bar.org/', 'ctx': 'n3/contexts#'});

    describe('should allow to query subjects with prefixes', function () {
      it('should return all triples with that subject',
        shouldIncludeAll(n3Store.find('a:s1', null, null),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s1', 'http://bar.org/p2', 'http://foo.org/#o1']));
    });

    describe('should allow to query predicates with prefixes', function () {
      it('should return all triples with that predicate',
        shouldIncludeAll(n3Store.find(null, 'b:p1', null),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s2', 'http://bar.org/p1', 'http://foo.org/#o2']));
    });

    describe('should allow to query objects with prefixes', function () {
      it('should return all triples with that object',
        shouldIncludeAll(n3Store.find(null, null, 'a:o1'),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s1', 'http://bar.org/p2', 'http://foo.org/#o1']));
    });

    describe('should allow to query contexts with prefixes', function () {
      it('should return all triples with that context',
        shouldIncludeAll(n3Store.find(null, null, null, 'ctx:default'),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s1', 'http://bar.org/p2', 'http://foo.org/#o1'],
                         ['http://foo.org/#s2', 'http://bar.org/p1', 'http://foo.org/#o2']));
    });
  });

  describe('An N3Store with the http prefix', function () {
    var n3Store = new N3Store([
      { subject: 'http://foo.org/#s1', predicate: 'http://bar.org/p1', object: 'http://foo.org/#o1' },
      { subject: 'http://foo.org/#s1', predicate: 'http://bar.org/p2', object: 'http://foo.org/#o1' },
      { subject: 'http://foo.org/#s2', predicate: 'http://bar.org/p1', object: 'http://foo.org/#o2' },
    ],
    {
      'http': 'http://www.w3.org/2006/http#'
    });

    describe('should allow to query subjects without prefixes', function () {
      it('should return all triples with that subject',
        shouldIncludeAll(n3Store.find('http://foo.org/#s1', null, null),
                         ['http://foo.org/#s1', 'http://bar.org/p1', 'http://foo.org/#o1'],
                         ['http://foo.org/#s1', 'http://bar.org/p2', 'http://foo.org/#o1']));
    });
  });

  describe('An N3Store created without triples but with prefixes', function () {
    var n3Store = new N3Store({ 'http': 'http://www.w3.org/2006/http#' });
    n3Store.addTriple('a', 'http://www.w3.org/2006/http#b', 'c');

    describe('should allow to query predicates with prefixes', function () {
      it('should return all triples with that predicate',
        shouldIncludeAll(n3Store.find(null, 'http:b', null),
                         ['a', 'http://www.w3.org/2006/http#b', 'c']));
    });
  });

  describe('An N3Store', function () {
    var n3Store = new N3Store();

    // Test inspired by http://www.devthought.com/2012/01/18/an-object-is-not-a-hash/.
    // The value `__proto__` is not supported however – fixing it introduces too much overhead.
    it('should be able to contain entities with JavaScript object property names', function () {
      n3Store.addTriple('toString', 'valueOf', 'toLocaleString', 'hasOwnProperty');
      shouldIncludeAll(n3Store.find(null, null, null, 'hasOwnProperty'),
                       ['toString', 'valueOf', 'toLocaleString', 'hasOwnProperty'])();
    });

    it('should be able to contain entities named "null"', function () {
      n3Store.addTriple('null', 'null', 'null', 'null');
      shouldIncludeAll(n3Store.find(null, null, null, 'null'), ['null', 'null', 'null', 'null'])();
    });
  });
});

function itShouldBeEmpty(result) {
  it('should be empty', function () {
    if (typeof result === 'function') result = result();
    result.should.be.empty;
  });
}

function shouldIncludeAll(result) {
  var items = Array.prototype.slice.call(arguments, 1).map(function (arg) {
    return { subject: arg[0], predicate: arg[1], object: arg[2],
             context: arg[3] || 'n3/contexts#default' };
  });
  return function () {
    if (typeof result === 'function') result = result();
    result.should.have.length(items.length);
    for (var i = 0; i < items.length; i++)
      result.should.include.something.that.deep.equals(items[i]);
  };
}
