import {
  Util,
  NamedNode,
  Literal,
  BlankNode,
  Variable,
  DefaultGraph,
  Quad,
} from '../src/';

describe('Util', () => {
  describe('isNamedNode', () => {
    it('matches an IRI', () => {
      Util.isNamedNode(new NamedNode('http://example.org/')).should.be.true;
    });

    it('matches an empty IRI', () => {
      Util.isNamedNode(new NamedNode('')).should.be.true;
    });

    it('does not match a literal', () => {
      Util.isNamedNode(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a blank node', () => {
      Util.isNamedNode(new BlankNode('x')).should.be.false;
    });

    it('does not match a variable', () => {
      Util.isNamedNode(new Variable('x')).should.be.false;
    });

    it('does not match null', () => {
      expect(Util.isNamedNode(null)).to.be.false;
    });

    it('does not match undefined', () => {
      expect(Util.isNamedNode(undefined)).to.be.false;
    });
  });

  describe('isLiteral', () => {
    it('matches a literal', () => {
      Util.isLiteral(new Literal('"http://example.org/"')).should.be.true;
    });

    it('matches a literal with a language', () => {
      Util.isLiteral(new Literal('"English"@en')).should.be.true;
    });

    it('matches a literal with a language that contains a number', () => {
      Util.isLiteral(new Literal('"English"@es-419')).should.be.true;
    });

    it('matches a literal with a type', () => {
      Util.isLiteral(new Literal('"3"^^http://www.w3.org/2001/XMLSchema#integer')).should.be.true;
    });

    it('matches a literal with a newline', () => {
      Util.isLiteral(new Literal('"a\nb"')).should.be.true;
    });

    it('matches a literal with a cariage return', () => {
      Util.isLiteral(new Literal('"a\rb"')).should.be.true;
    });

    it('does not match an IRI', () => {
      Util.isLiteral(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a blank node', () => {
      Util.isLiteral(new BlankNode('_:x')).should.be.false;
    });

    it('does not match a variable', () => {
      Util.isLiteral(new Variable('x')).should.be.false;
    });

    it('does not match null', () => {
      expect(Util.isLiteral(null)).to.be.false;
    });

    it('does not match undefined', () => {
      expect(Util.isLiteral(undefined)).to.be.false;
    });
  });

  describe('isBlankNode', () => {
    it('matches a blank node', () => {
      Util.isBlankNode(new BlankNode('x')).should.be.true;
    });

    it('does not match an IRI', () => {
      Util.isBlankNode(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', () => {
      Util.isBlankNode(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a variable', () => {
      Util.isBlankNode(new Variable('x')).should.be.false;
    });

    it('does not match null', () => {
      expect(Util.isBlankNode(null)).to.be.false;
    });

    it('does not match undefined', () => {
      expect(Util.isBlankNode(undefined)).to.be.false;
    });
  });

  describe('isVariable', () => {
    it('matches a variable', () => {
      Util.isVariable(new Variable('x')).should.be.true;
    });

    it('does not match an IRI', () => {
      Util.isVariable(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', () => {
      Util.isVariable(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match a blank node', () => {
      Util.isNamedNode(new BlankNode('x')).should.be.false;
    });

    it('does not match null', () => {
      expect(Util.isVariable(null)).to.be.false;
    });

    it('does not match undefined', () => {
      expect(Util.isVariable(undefined)).to.be.false;
    });
  });

  describe('isDefaultGraph', () => {
    it('does not match a blank node', () => {
      Util.isDefaultGraph(new BlankNode('x')).should.be.false;
    });

    it('does not match an IRI', () => {
      Util.isDefaultGraph(new NamedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', () => {
      Util.isDefaultGraph(new Literal('"http://example.org/"')).should.be.false;
    });

    it('does not match null', () => {
      expect(Util.isVariable(null)).to.be.false;
    });

    it('does not match undefined', () => {
      expect(Util.isVariable(undefined)).to.be.false;
    });
  });

  describe('inDefaultGraph', () => {
    it('does not match a blank node', () => {
      Util.inDefaultGraph(new Quad(null, null, null, new BlankNode('x'))).should.be.false;
    });

    it('does not match an IRI', () => {
      Util.inDefaultGraph(new Quad(null, null, null, new NamedNode('http://example.org/'))).should.be.false;
    });

    it('does not match a literal', () => {
      Util.inDefaultGraph(new Quad(null, null, null, new Literal('"http://example.org/"'))).should.be.false;
    });

    it('matches null', () => {
      Util.inDefaultGraph(new Quad(null, null, null, null)).should.be.true;
    });

    it('matches undefined', () => {
      Util.inDefaultGraph(new Quad(null, null, null, undefined)).should.be.true;
    });

    it('matches the default graph', () => {
      Util.inDefaultGraph(new Quad(null, null, null, new DefaultGraph())).should.be.true;
    });
  });

  describe('prefix', () => {
    const rdfs = Util.prefix('http://www.w3.org/2000/01/rdf-schema#');
    it('should return a function', () => {
      expect(rdfs).to.be.an.instanceof(Function);
    });

    describe('the function', () => {
      it('should expand the prefix', () => {
        expect(rdfs('label')).to.deep.equal(new NamedNode('http://www.w3.org/2000/01/rdf-schema#label'));
      });

      it('should use a custom factory when specified', () => {
        const factory = { namedNode: function (s) { return 'n-' + s; } };
        const rdfs = Util.prefix('http://www.w3.org/2000/01/rdf-schema#', factory);
        expect(rdfs('label')).to.equal('n-http://www.w3.org/2000/01/rdf-schema#label');
      });
    });
  });

  describe('prefixes', () => {
    describe('called without arguments', () => {
      const prefixes = Util.prefixes();
      it('should return a function', () => {
        expect(prefixes).to.be.an.instanceof(Function);
      });

      describe('the function', () => {
        it('should not expand non-registered prefixes', () => {
          expect(() => { prefixes('foo'); }).to.throw('Unknown prefix: foo');
        });

        it('should allow registering prefixes', () => {
          const p = prefixes('rdfs', 'http://www.w3.org/2000/01/rdf-schema#');
          const rdfs = prefixes('rdfs');
          expect(p).to.exist;
          expect(p).to.equal(rdfs);
        });

        it('should expand the newly registered prefix', () => {
          const rdfs = prefixes('rdfs');
          expect(rdfs('label')).to.deep.equal(new NamedNode('http://www.w3.org/2000/01/rdf-schema#label'));
        });
      });
    });

    describe('called with a hash of prefixes', () => {
      const prefixes = Util.prefixes({
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
      });
      it('should return a function', () => {
        expect(prefixes).to.be.an.instanceof(Function);
      });

      describe('the function', () => {
        it('should expand registered prefixes', () => {
          expect(prefixes('rdfs')('label')).to.deep.equal(new NamedNode('http://www.w3.org/2000/01/rdf-schema#label'));
          expect(prefixes('owl')('sameAs')).to.deep.equal(new NamedNode('http://www.w3.org/2002/07/owl#sameAs'));
        });

        it('should not expand non-registered prefixes', () => {
          expect(() => { prefixes('foo'); }).to.throw('Unknown prefix: foo');
        });

        it('should allow registering prefixes', () => {
          const p = prefixes('my', 'http://example.org/#');
          const my = prefixes('my');
          expect(p).to.exist;
          expect(p).to.equal(my);
        });

        it('should expand the newly registered prefix', () => {
          const my = prefixes('my');
          expect(my('me')).to.deep.equal(new NamedNode('http://example.org/#me'));
        });
      });
    });

    describe('called with a custom factory', () => {
      const factory = { namedNode: function (s) { return 'n-' + s; } };
      const prefixes = Util.prefixes({ my: 'http://example.org/#' }, factory);

      it('should use the custom factory', () => {
        expect(prefixes('my')('foo')).to.equal('n-http://example.org/#foo');
      });
    });
  });
});
