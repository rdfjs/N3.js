var N3Util = require('../N3').Util;

var DataFactory = require('../N3').DataFactory;
var NamedNode = DataFactory.internal.NamedNode,
    Literal = DataFactory.internal.Literal,
    BlankNode = DataFactory.internal.BlankNode,
    Variable = DataFactory.internal.Variable,
    DefaultGraph = DataFactory.internal.DefaultGraph,
    Quad = DataFactory.internal.Quad;

describe('N3Util', function () {
  describe('isNamedNode', function () {
    it('matches an IRI', function () {
      N3Util.isNamedNode(new NamedNode('http://example.org/')).should.be.true;
    });

    it('matches an empty IRI', function () {
      N3Util.isNamedNode(new NamedNode('')).should.be.true;
    });

    it('does not match a literal', function () {
      N3Util.isNamedNode(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a blank node', function () {
      N3Util.isNamedNode(new BlankNode('x')).should.be.false;
    });

    it('does not match a variable', function () {
      N3Util.isNamedNode(new Variable('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isNamedNode(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(N3Util.isNamedNode(undefined)).to.be.false;
    });
  });

  describe('isLiteral', function () {
    it('matches a literal', function () {
      N3Util.isLiteral(new Literal('"http://example.org/"')).should.be.true;
    });

    it('matches a literal with a language', function () {
      N3Util.isLiteral(new Literal('"English"@en')).should.be.true;
    });

    it('matches a literal with a language that contains a number', function () {
      N3Util.isLiteral(new Literal('"English"@es-419')).should.be.true;
    });

    it('matches a literal with a type', function () {
      N3Util.isLiteral(new Literal('"3"^^http://www.w3.org/2001/XMLSchema#integer')).should.be.true;
    });

    it('matches a literal with a newline', function () {
      N3Util.isLiteral(new Literal('"a\nb"')).should.be.true;
    });

    it('matches a literal with a cariage return', function () {
      N3Util.isLiteral(new Literal('"a\rb"')).should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isLiteral(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a blank node', function () {
      N3Util.isLiteral(new BlankNode('_:x')).should.be.false;
    });

    it('does not match a variable', function () {
      N3Util.isLiteral(new Variable('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isLiteral(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(N3Util.isLiteral(undefined)).to.be.false;
    });
  });

  describe('isBlankNode', function () {
    it('matches a blank node', function () {
      N3Util.isBlankNode(new BlankNode('x')).should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isBlankNode(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.isBlankNode(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a variable', function () {
      N3Util.isBlankNode(new Variable('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isBlankNode(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(N3Util.isBlankNode(undefined)).to.be.false;
    });
  });

  describe('isVariable', function () {
    it('matches a variable', function () {
      N3Util.isVariable(new Variable('x')).should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isVariable(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.isVariable(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a blank node', function () {
      N3Util.isNamedNode(new BlankNode('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isVariable(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(N3Util.isVariable(undefined)).to.be.false;
    });
  });

  describe('isDefaultGraph', function () {
    it('does not match a blank node', function () {
      N3Util.isDefaultGraph(new BlankNode('x')).should.be.false;
    });

    it('does not match an IRI', function () {
      N3Util.isDefaultGraph(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.isDefaultGraph(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isVariable(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(N3Util.isVariable(undefined)).to.be.false;
    });
  });

  describe('inDefaultGraph', function () {
    it('does not match a blank node', function () {
      N3Util.inDefaultGraph(new Quad(null, null, null, new BlankNode('x'))).should.be.false;
    });

    it('does not match an IRI', function () {
      N3Util.inDefaultGraph(new Quad(null, null, null, new NamedNode('http://example.org/'))).should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.inDefaultGraph(new Quad(null, null, null, new Literal('"http://example.org/"'))).should.be.false;
    });

    it('matches null', function () {
      N3Util.inDefaultGraph(new Quad(null, null, null, null)).should.be.true;
    });

    it('matches undefined', function () {
      N3Util.inDefaultGraph(new Quad(null, null, null, undefined)).should.be.true;
    });

    it('matches the default graph', function () {
      N3Util.inDefaultGraph(new Quad(null, null, null, new DefaultGraph())).should.be.true;
    });
  });

  describe('prefix', function () {
    var rdfs = N3Util.prefix('http://www.w3.org/2000/01/rdf-schema#');
    it('should return a function', function () {
      expect(rdfs).to.be.an.instanceof(Function);
    });

    describe('the function', function () {
      it('should expand the prefix', function () {
        expect(rdfs('label')).to.deep.equal(new NamedNode('http://www.w3.org/2000/01/rdf-schema#label'));
      });
    });
  });

  describe('prefixes', function () {
    describe('called without arguments', function () {
      var prefixes = N3Util.prefixes();
      it('should return a function', function () {
        expect(prefixes).to.be.an.instanceof(Function);
      });

      describe('the function', function () {
        it('should not expand non-registered prefixes', function () {
          expect(function () { prefixes('foo'); }).to.throw('Unknown prefix: foo');
        });

        it('should allow registering prefixes', function () {
          var p = prefixes('rdfs', 'http://www.w3.org/2000/01/rdf-schema#');
          var rdfs = prefixes('rdfs');
          expect(p).to.exist;
          expect(p).to.equal(rdfs);
        });

        it('should expand the newly registered prefix', function () {
          var rdfs = prefixes('rdfs');
          expect(rdfs('label')).to.deep.equal(new NamedNode('http://www.w3.org/2000/01/rdf-schema#label'));
        });
      });
    });

    describe('called with a hash of prefixes', function () {
      var prefixes = N3Util.prefixes({
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
      });
      it('should return a function', function () {
        expect(prefixes).to.be.an.instanceof(Function);
      });

      describe('the function', function () {
        it('should expand registered prefixes', function () {
          expect(prefixes('rdfs')('label')).to.deep.equal(new NamedNode('http://www.w3.org/2000/01/rdf-schema#label'));
          expect(prefixes('owl')('sameAs')).to.deep.equal(new NamedNode('http://www.w3.org/2002/07/owl#sameAs'));
        });

        it('should not expand non-registered prefixes', function () {
          expect(function () { prefixes('foo'); }).to.throw('Unknown prefix: foo');
        });

        it('should allow registering prefixes', function () {
          var p = prefixes('my', 'http://example.org/#');
          var my = prefixes('my');
          expect(p).to.exist;
          expect(p).to.equal(my);
        });

        it('should expand the newly registered prefix', function () {
          var my = prefixes('my');
          expect(my('me')).to.deep.equal(new NamedNode('http://example.org/#me'));
        });
      });
    });
  });
});
