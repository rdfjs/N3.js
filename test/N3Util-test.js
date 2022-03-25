import { Util, DataFactory } from '../src/';

const { namedNode, blankNode, literal, variable, defaultGraph, quad } = DataFactory;

describe('Util', () => {
  describe('isNamedNode', () => {
    it('matches an IRI', () => {
      Util.isNamedNode(namedNode('http://example.org/')).should.be.true;
    });

    it('matches an empty IRI', () => {
      Util.isNamedNode(namedNode('')).should.be.true;
    });

    it('does not match a literal', () => {
      Util.isNamedNode(literal('http://example.org/')).should.be.false;
    });

    it('does not match a blank node', () => {
      Util.isNamedNode(blankNode('x')).should.be.false;
    });

    it('does not match a variable', () => {
      Util.isNamedNode(variable('x')).should.be.false;
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
      Util.isLiteral(literal('http://example.org/')).should.be.true;
    });

    it('matches a literal with a language', () => {
      Util.isLiteral(literal('English', 'en')).should.be.true;
    });

    it('matches a literal with a language that contains a number', () => {
      Util.isLiteral(literal('English', '@es-419')).should.be.true;
    });

    it('matches a literal with a type', () => {
      Util.isLiteral(literal('3', 'http://www.w3.org/2001/XMLSchema#integer')).should.be.true;
    });

    it('matches a literal with a newline', () => {
      Util.isLiteral(literal('a\nb')).should.be.true;
    });

    it('matches a literal with a cariage return', () => {
      Util.isLiteral(literal('a\rb')).should.be.true;
    });

    it('does not match an IRI', () => {
      Util.isLiteral(namedNode('http://example.org/')).should.be.false;
    });

    it('does not match a blank node', () => {
      Util.isLiteral(blankNode('_:x')).should.be.false;
    });

    it('does not match a variable', () => {
      Util.isLiteral(variable('x')).should.be.false;
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
      Util.isBlankNode(blankNode('x')).should.be.true;
    });

    it('does not match an IRI', () => {
      Util.isBlankNode(namedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', () => {
      Util.isBlankNode(literal('http://example.org/')).should.be.false;
    });

    it('does not match a variable', () => {
      Util.isBlankNode(variable('x')).should.be.false;
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
      Util.isVariable(variable('x')).should.be.true;
    });

    it('does not match an IRI', () => {
      Util.isVariable(namedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', () => {
      Util.isVariable(literal('http://example.org/')).should.be.false;
    });

    it('does not match a blank node', () => {
      Util.isNamedNode(blankNode('x')).should.be.false;
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
      Util.isDefaultGraph(blankNode('x')).should.be.false;
    });

    it('does not match an IRI', () => {
      Util.isDefaultGraph(namedNode('http://example.org/')).should.be.false;
    });

    it('does not match a literal', () => {
      Util.isDefaultGraph(literal('http://example.org/')).should.be.false;
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
      Util.inDefaultGraph(quad(null, null, null, blankNode('x'))).should.be.false;
    });

    it('does not match an IRI', () => {
      Util.inDefaultGraph(quad(null, null, null, namedNode('http://example.org/'))).should.be.false;
    });

    it('does not match a literal', () => {
      Util.inDefaultGraph(quad(null, null, null, literal('http://example.org/'))).should.be.false;
    });

    it('matches null', () => {
      Util.inDefaultGraph(quad(null, null, null, null)).should.be.true;
    });

    it('matches undefined', () => {
      Util.inDefaultGraph(quad(null, null, null, undefined)).should.be.true;
    });

    it('matches the default graph', () => {
      Util.inDefaultGraph(quad(null, null, null, defaultGraph())).should.be.true;
    });
  });

  describe('prefix', () => {
    const rdfs = Util.prefix('http://www.w3.org/2000/01/rdf-schema#');
    it('should return a function', () => {
      expect(rdfs).to.be.an.instanceof(Function);
    });

    describe('the function', () => {
      it('should expand the prefix', () => {
        expect(rdfs('label')).to.deep.equal(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
      });

      it('should use a custom factory when specified', () => {
        const factory = { namedNode: function (s) { return `n-${s}`; } };
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
          expect(rdfs('label')).to.deep.equal(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
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
          expect(prefixes('rdfs')('label')).to.deep.equal(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
          expect(prefixes('owl')('sameAs')).to.deep.equal(namedNode('http://www.w3.org/2002/07/owl#sameAs'));
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
          expect(my('me')).to.deep.equal(namedNode('http://example.org/#me'));
        });
      });
    });

    describe('called with a custom factory', () => {
      const factory = { namedNode: function (s) { return `n-${s}`; } };
      const prefixes = Util.prefixes({ my: 'http://example.org/#' }, factory);

      it('should use the custom factory', () => {
        expect(prefixes('my')('foo')).to.equal('n-http://example.org/#foo');
      });
    });
  });
});
