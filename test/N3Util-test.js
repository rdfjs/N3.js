var N3Util = require('../N3').Util;

var DataFactory = require('../N3').DataFactory;
var NamedNode = DataFactory.NamedNode,
    Literal = DataFactory.Literal,
    BlankNode = DataFactory.BlankNode,
    Variable = DataFactory.Variable,
    DefaultGraph = DataFactory.DefaultGraph,
    Quad = DataFactory.Quad;

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

  describe('isBlank', function () {
    it('matches a blank node', function () {
      N3Util.isBlank(new BlankNode('x')).should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isBlank(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.isBlank(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a variable', function () {
      N3Util.isBlank(new Variable('x')).should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isBlank(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(N3Util.isBlank(undefined)).to.be.false;
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

    it('matches null', function () {
      expect(N3Util.isDefaultGraph(null)).to.be.true;
    });

    it('matches undefined', function () {
      expect(N3Util.isDefaultGraph(undefined)).to.be.true;
    });

    it('matches the empty string', function () {
      expect(N3Util.isDefaultGraph('')).to.be.true;
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

  describe('getLiteralValue', function () {
    it('gets the value of a literal', function () {
      N3Util.getLiteralValue(new Literal('"Mickey"')).should.equal('Mickey');
    });

    it('gets the value of a literal with a language', function () {
      N3Util.getLiteralValue(new Literal('"English"@en')).should.equal('English');
    });

    it('gets the value of a literal with a language that contains a number', function () {
      N3Util.getLiteralValue(new Literal('"English"@es-419')).should.equal('English');
    });

    it('gets the value of a literal with a type', function () {
      N3Util.getLiteralValue(new Literal('"3"^^http://www.w3.org/2001/XMLSchema#integer')).should.equal('3');
    });

    it('gets the value of a literal with a newline', function () {
      N3Util.getLiteralValue(new Literal('"Mickey\nMouse"')).should.equal('Mickey\nMouse');
    });

    it('gets the value of a literal with a cariage return', function () {
      N3Util.getLiteralValue(new Literal('"Mickey\rMouse"')).should.equal('Mickey\rMouse');
    });

    it('does not work with non-literals', function () {
      N3Util.getLiteralValue.bind(null, new NamedNode('http://ex.org/')).should.throw('http://ex.org/ is not a literal');
    });

    it('does not work with null', function () {
      N3Util.getLiteralValue.bind(null, null).should.throw('null is not a literal');
    });

    it('does not work with undefined', function () {
      N3Util.getLiteralValue.bind(null, undefined).should.throw('undefined is not a literal');
    });
  });

  describe('getLiteralType', function () {
    it('gets the type of a literal', function () {
      N3Util.getLiteralType(new Literal('"Mickey"')).should.deep.equal(new NamedNode('http://www.w3.org/2001/XMLSchema#string'));
    });

    it('gets the type of a literal with a language', function () {
      N3Util.getLiteralType(new Literal('"English"@en')).should.deep.equal(new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'));
    });

    it('gets the type of a literal with a language that contains a number', function () {
      N3Util.getLiteralType(new Literal('"English"@es-419')).should.deep.equal(new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'));
    });

    it('gets the type of a literal with a type', function () {
      N3Util.getLiteralType(new Literal('"3"^^http://www.w3.org/2001/XMLSchema#integer')).should.deep.equal(new NamedNode('http://www.w3.org/2001/XMLSchema#integer'));
    });

    it('gets the type of a literal with a newline', function () {
      N3Util.getLiteralType(new Literal('"Mickey\nMouse"^^abc')).should.deep.equal(new NamedNode('abc'));
    });

    it('gets the type of a literal with a cariage return', function () {
      N3Util.getLiteralType(new Literal('"Mickey\rMouse"^^abc')).should.deep.equal(new NamedNode('abc'));
    });

    it('does not work with non-literals', function () {
      N3Util.getLiteralType.bind(null, new NamedNode('http://example.org/')).should.throw('http://example.org/ is not a literal');
    });

    it('does not work with null', function () {
      N3Util.getLiteralType.bind(null, null).should.throw('null is not a literal');
    });

    it('does not work with undefined', function () {
      N3Util.getLiteralType.bind(null, undefined).should.throw('undefined is not a literal');
    });
  });

  describe('getLiteralLanguage', function () {
    it('gets the language of a literal', function () {
      N3Util.getLiteralLanguage(new Literal('"Mickey"')).should.equal('');
    });

    it('gets the language of a literal with a language', function () {
      N3Util.getLiteralLanguage(new Literal('"English"@en')).should.equal('en');
    });

    it('gets the language of a literal with a language that contains a number', function () {
      N3Util.getLiteralLanguage(new Literal('"English"@es-419')).should.equal('es-419');
    });

    it('normalizes the language to lowercase', function () {
      N3Util.getLiteralLanguage(new Literal('"English"@en-GB')).should.equal('en-gb');
    });

    it('gets the language of a literal with a type', function () {
      N3Util.getLiteralLanguage(new Literal('"3"^^http://www.w3.org/2001/XMLSchema#integer')).should.equal('');
    });

    it('gets the language of a literal with a newline', function () {
      N3Util.getLiteralLanguage(new Literal('"Mickey\nMouse"@en')).should.equal('en');
    });

    it('gets the language of a literal with a cariage return', function () {
      N3Util.getLiteralLanguage(new Literal('"Mickey\rMouse"@en')).should.equal('en');
    });

    it('does not work with non-literals', function () {
      N3Util.getLiteralLanguage.bind(null, new NamedNode('http://example.org/')).should.throw('http://example.org/ is not a literal');
    });

    it('does not work with null', function () {
      N3Util.getLiteralLanguage.bind(null, null).should.throw('null is not a literal');
    });

    it('does not work with undefined', function () {
      N3Util.getLiteralLanguage.bind(null, undefined).should.throw('undefined is not a literal');
    });
  });

  describe('isPrefixedName', function () {
    it('matches a prefixed name', function () {
      N3Util.isPrefixedName('ex:Test').should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isPrefixedName('http://example.org/').should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.isPrefixedName('"http://example.org/"').should.be.false;
    });

    it('does not match a literal with a colon', function () {
      N3Util.isPrefixedName('"a:b"').should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isPrefixedName(null)).to.be.false;
    });

    it('does not match undefined', function () {
      expect(N3Util.isPrefixedName(undefined)).to.be.false;
    });
  });

  describe('expandPrefixedName', function () {
    it('expands a prefixed name', function () {
      N3Util.expandPrefixedName('ex:Test', { ex: 'http://ex.org/#' }).should.deep.equal(new NamedNode('http://ex.org/#Test'));
    });

    it('expands a type with a prefixed name', function () {
      N3Util.expandPrefixedName('"a"^^ex:type', { ex: 'http://ex.org/#' }).should.deep.equal(new Literal('"a"^^http://ex.org/#type'));
    });

    it('expands a prefixed name with the empty prefix', function () {
      N3Util.expandPrefixedName(':Test', { '': 'http://ex.org/#' }).should.deep.equal(new NamedNode('http://ex.org/#Test'));
    });

    it('does not expand a prefixed name if the prefix is unknown', function () {
      N3Util.expandPrefixedName('a:Test', { b: 'http://ex.org/#' }).should.deep.equal('a:Test');
    });

    it('returns the input if it is not a prefixed name', function () {
      N3Util.expandPrefixedName('abc', null).should.deep.equal('abc');
    });
  });

  describe('prefix', function () {
    var baz = N3Util.prefix('http://ex.org/baz#');
    it('should return a function', function () {
      expect(baz).to.be.an.instanceof(Function);
    });

    describe('the function', function () {
      it('should expand the prefix', function () {
        expect(baz('bar')).to.equal('http://ex.org/baz#bar');
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
          expect(prefixes('baz')('bar')).to.equal('bar');
        });

        it('should allow registering prefixes', function () {
          var p = prefixes('baz', 'http://ex.org/baz#');
          expect(p).to.exist;
          expect(p).to.equal(prefixes('baz'));
        });

        it('should expand the newly registered prefix', function () {
          expect(prefixes('baz')('bar')).to.equal('http://ex.org/baz#bar');
        });
      });
    });

    describe('called with a hash of prefixes', function () {
      var prefixes = N3Util.prefixes({ foo: 'http://ex.org/foo#', bar: 'http://ex.org/bar#' });
      it('should return a function', function () {
        expect(prefixes).to.be.an.instanceof(Function);
      });

      describe('the function', function () {
        it('should expand registered prefixes', function () {
          expect(prefixes('foo')('bar')).to.equal('http://ex.org/foo#bar');
          expect(prefixes('bar')('bar')).to.equal('http://ex.org/bar#bar');
        });

        it('should not expand non-registered prefixes', function () {
          expect(prefixes('baz')('bar')).to.equal('bar');
        });

        it('should allow registering prefixes', function () {
          var p = prefixes('baz', 'http://ex.org/baz#');
          expect(p).to.exist;
          expect(p).to.equal(prefixes('baz'));
        });

        it('should expand the newly registered prefix', function () {
          expect(prefixes('baz')('bar')).to.equal('http://ex.org/baz#bar');
        });
      });
    });
  });
});
