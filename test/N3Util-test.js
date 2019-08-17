import { Util, DataFactory } from '../src/';

const { NamedNode, Literal, BlankNode, Variable, DefaultGraph, Quad } = DataFactory.internal;

describe('Util', function () {
  describe('isNamedNode', function () {
    it('matches an IRI', function () {
      Util.isNamedNode(new NamedNode('http://example.org/')).should.be.true;
    });

    it('matches an empty IRI', function () {
      Util.isNamedNode(new NamedNode('')).should.be.true;
    });

    it('does not match a literal', function () {
      Util.isNamedNode(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a blank node', function () {
      Util.isNamedNode(new BlankNode('x')).should.be.false;
    });

    it('does not match a variable', function () {
      Util.isNamedNode(new Variable('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(Util.isNamedNode(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(Util.isNamedNode(undefined)).to.be.false;
    });
  });

  describe('isLiteral', function () {
    it('matches a literal', function () {
      Util.isLiteral(new Literal('"http://example.org/"')).should.be.true;
    });

    it('matches a literal with a language', function () {
      Util.isLiteral(new Literal('"English"@en')).should.be.true;
    });

    it('matches a literal with a language that contains a number', function () {
      Util.isLiteral(new Literal('"English"@es-419')).should.be.true;
    });

    it('matches a literal with a type', function () {
      Util.isLiteral(new Literal('"3"^^http://www.w3.org/2001/XMLSchema#integer')).should.be.true;
    });

    it('matches a literal with a newline', function () {
      Util.isLiteral(new Literal('"a\nb"')).should.be.true;
    });

    it('matches a literal with a cariage return', function () {
      Util.isLiteral(new Literal('"a\rb"')).should.be.true;
    });

    it('does not match an IRI', function () {
      Util.isLiteral(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a blank node', function () {
      Util.isLiteral(new BlankNode('_:x')).should.be.false;
    });

    it('does not match a variable', function () {
      Util.isLiteral(new Variable('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(Util.isLiteral(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(Util.isLiteral(undefined)).to.be.false;
    });
  });

  describe('isBlankNode', function () {
    it('matches a blank node', function () {
      Util.isBlankNode(new BlankNode('x')).should.be.true;
    });

    it('does not match an IRI', function () {
      Util.isBlankNode(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', function () {
      Util.isBlankNode(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a variable', function () {
      Util.isBlankNode(new Variable('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(Util.isBlankNode(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(Util.isBlankNode(undefined)).to.be.false;
    });
  });

  describe('isVariable', function () {
    it('matches a variable', function () {
      Util.isVariable(new Variable('x')).should.be.true;
    });

    it('does not match an IRI', function () {
      Util.isVariable(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', function () {
      Util.isVariable(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a blank node', function () {
      Util.isNamedNode(new BlankNode('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(Util.isVariable(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(Util.isVariable(undefined)).to.be.false;
    });
  });

  describe('isDefaultGraph', function () {
    it('does not match a blank node', function () {
      Util.isDefaultGraph(new BlankNode('x')).should.be.false;
    });

    it('does not match an IRI', function () {
      Util.isDefaultGraph(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', function () {
      Util.isDefaultGraph(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match null', function () {
      expect(Util.isVariable(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(Util.isVariable(undefined)).to.be.false;
    });
  });

  describe('inDefaultGraph', function () {
    it('does not match a blank node', function () {
      Util.inDefaultGraph(new Quad(null, null, null, new BlankNode('x'))).should.be.false;
    });

    it('does not match an IRI', function () {
      Util.inDefaultGraph(new Quad(null, null, null, new NamedNode('http://example.org/'))).should.be.false;
    });

    it('does not match a literal', function () {
      Util.inDefaultGraph(new Quad(null, null, null, new Literal('"http://example.org/"'))).should.be.false;
    });

    it('matches null', function () {
      Util.inDefaultGraph(new Quad(null, null, null, null)).should.be.true;
    });

    it('matches undefined', function () {
      Util.inDefaultGraph(new Quad(null, null, null, undefined)).should.be.true;
    });

    it('matches the default graph', function () {
      Util.inDefaultGraph(new Quad(null, null, null, new DefaultGraph())).should.be.true;
    });
  });

  describe('prefix', function () {
    var rdfs = Util.prefix('http://www.w3.org/2000/01/rdf-schema#');
    it('should return a function', function () {
      expect(rdfs).to.be.an.instanceof(Function);
    });

    describe('the function', function () {
      it('should expand the prefix', function () {
        expect(rdfs('label')).to.deep.equal(new NamedNode('http://www.w3.org/2000/01/rdf-schema#label'));
      });

      it('should use a custom factory when specified', function () {
        var factory = { namedNode: function (s) { return 'n-' + s; } };
        var rdfs = Util.prefix('http://www.w3.org/2000/01/rdf-schema#', factory);
        expect(rdfs('label')).to.equal('n-http://www.w3.org/2000/01/rdf-schema#label');
      });
    });
  });

  describe('prefixes', function () {
    describe('called without arguments', function () {
      var prefixes = Util.prefixes();
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
      var prefixes = Util.prefixes({
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

    describe('called with a custom factory', function () {
      var factory = { namedNode: function (s) { return 'n-' + s; } };
      var prefixes = Util.prefixes({ my: 'http://example.org/#' }, factory);

      it('should use the custom factory', function () {
        expect(prefixes('my')('foo')).to.equal('n-http://example.org/#foo');
      });
    });
  });
});
