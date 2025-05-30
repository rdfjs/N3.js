import { Util, DataFactory } from '../src';

const { namedNode, blankNode, literal, variable, defaultGraph, quad } = DataFactory;

describe('Util', () => {
  describe('isNamedNode', () => {
    it('matches an IRI', () => {
      expect(Util.isNamedNode(namedNode('http://example.org/'))).toBe(true);
    });

    it('matches an empty IRI', () => {
      expect(Util.isNamedNode(namedNode(''))).toBe(true);
    });

    it('does not match a literal', () => {
      expect(Util.isNamedNode(literal('http://example.org/'))).toBe(false);
    });

    it('does not match a blank node', () => {
      expect(Util.isNamedNode(blankNode('x'))).toBe(false);
    });

    it('does not match a variable', () => {
      expect(Util.isNamedNode(variable('x'))).toBe(false);
    });

    it('does not match null', () => {
      expect(Util.isNamedNode(null)).toBe(false);
    });

    it('does not match undefined', () => {
      expect(Util.isNamedNode(undefined)).toBe(false);
    });
  });

  describe('isLiteral', () => {
    it('matches a literal', () => {
      expect(Util.isLiteral(literal('http://example.org/'))).toBe(true);
    });

    it('matches a literal with a language', () => {
      expect(Util.isLiteral(literal('English', 'en'))).toBe(true);
    });

    it('matches a literal with a language that contains a number', () => {
      expect(Util.isLiteral(literal('English', '@es-419'))).toBe(true);
    });

    it('matches a literal with a type', () => {
      expect(Util.isLiteral(literal('3', 'http://www.w3.org/2001/XMLSchema#integer'))).toBe(true);
    });

    it('matches a literal with a newline', () => {
      expect(Util.isLiteral(literal('a\nb'))).toBe(true);
    });

    it('matches a literal with a cariage return', () => {
      expect(Util.isLiteral(literal('a\rb'))).toBe(true);
    });

    it('does not match an IRI', () => {
      expect(Util.isLiteral(namedNode('http://example.org/'))).toBe(false);
    });

    it('does not match a blank node', () => {
      expect(Util.isLiteral(blankNode('_:x'))).toBe(false);
    });

    it('does not match a variable', () => {
      expect(Util.isLiteral(variable('x'))).toBe(false);
    });

    it('does not match null', () => {
      expect(Util.isLiteral(null)).toBe(false);
    });

    it('does not match undefined', () => {
      expect(Util.isLiteral(undefined)).toBe(false);
    });
  });

  describe('isBlankNode', () => {
    it('matches a blank node', () => {
      expect(Util.isBlankNode(blankNode('x'))).toBe(true);
    });

    it('does not match an IRI', () => {
      expect(Util.isBlankNode(namedNode('http://example.org/'))).toBe(false);
    });

    it('does not match a literal', () => {
      expect(Util.isBlankNode(literal('http://example.org/'))).toBe(false);
    });

    it('does not match a variable', () => {
      expect(Util.isBlankNode(variable('x'))).toBe(false);
    });

    it('does not match null', () => {
      expect(Util.isBlankNode(null)).toBe(false);
    });

    it('does not match undefined', () => {
      expect(Util.isBlankNode(undefined)).toBe(false);
    });
  });

  describe('isVariable', () => {
    it('matches a variable', () => {
      expect(Util.isVariable(variable('x'))).toBe(true);
    });

    it('does not match an IRI', () => {
      expect(Util.isVariable(namedNode('http://example.org/'))).toBe(false);
    });

    it('does not match a literal', () => {
      expect(Util.isVariable(literal('http://example.org/'))).toBe(false);
    });

    it('does not match a blank node', () => {
      expect(Util.isVariable(blankNode('x'))).toBe(false);
    });

    it('does not match null', () => {
      expect(Util.isVariable(null)).toBe(false);
    });

    it('does not match undefined', () => {
      expect(Util.isVariable(undefined)).toBe(false);
    });
  });

  describe('isQuad', () => {
    it('matches a quad', () => {
      expect(Util.isQuad(quad(null, null, null, null))).toBe(true);
    });

    it('does not match an IRI', () => {
      expect(Util.isQuad(namedNode('http://example.org/'))).toBe(false);
    });

    it('does not match a literal', () => {
      expect(Util.isQuad(literal('http://example.org/'))).toBe(false);
    });

    it('does not match a blank node', () => {
      expect(Util.isQuad(blankNode('x'))).toBe(false);
    });

    it('does not match a variable', () => {
      expect(Util.isQuad(variable('x'))).toBe(false);
    });

    it('does not match null', () => {
      expect(Util.isQuad(null)).toBe(false);
    });

    it('does not match undefined', () => {
      expect(Util.isQuad(undefined)).toBe(false);
    });
  });

  describe('isDefaultGraph', () => {
    it('does not match a blank node', () => {
      expect(Util.isDefaultGraph(blankNode('x'))).toBe(false);
    });

    it('does not match an IRI', () => {
      expect(Util.isDefaultGraph(namedNode('http://example.org/'))).toBe(false);
    });

    it('does not match a literal', () => {
      expect(Util.isDefaultGraph(literal('http://example.org/'))).toBe(false);
    });

    it('does not match null', () => {
      expect(Util.isDefaultGraph(null)).toBe(false);
    });

    it('does not match undefined', () => {
      expect(Util.isDefaultGraph(undefined)).toBe(false);
    });
  });

  describe('inDefaultGraph', () => {
    it('does not match a blank node', () => {
      expect(Util.inDefaultGraph(quad(null, null, null, blankNode('x')))).toBe(false);
    });

    it('does not match an IRI', () => {
      expect(
        Util.inDefaultGraph(quad(null, null, null, namedNode('http://example.org/'))),
      ).toBe(false);
    });

    it('does not match a literal', () => {
      expect(
        Util.inDefaultGraph(quad(null, null, null, literal('http://example.org/'))),
      ).toBe(false);
    });

    it('matches null', () => {
      expect(Util.inDefaultGraph(quad(null, null, null, null))).toBe(true);
    });

    it('matches undefined', () => {
      expect(Util.inDefaultGraph(quad(null, null, null, undefined))).toBe(true);
    });

    it('matches the default graph', () => {
      expect(Util.inDefaultGraph(quad(null, null, null, defaultGraph()))).toBe(true);
    });
  });

  describe('prefix', () => {
    const rdfs = Util.prefix('http://www.w3.org/2000/01/rdf-schema#');
    it('should return a function', () => {
      expect(rdfs).toBeInstanceOf(Function);
    });

    describe('the function', () => {
      it('should expand the prefix', () => {
        expect(rdfs('label')).toEqual(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
      });

      it('should expand a NamedNode prefix', () => {
        const rdfs = Util.prefix(namedNode('http://www.w3.org/2000/01/rdf-schema#'));
        expect(rdfs('label')).toEqual(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
      });

      it('should expand a Literal prefix', () => {
        const rdfs = Util.prefix(literal('http://www.w3.org/2000/01/rdf-schema#'));
        expect(rdfs('label')).toEqual(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
      });

      it('should use a custom factory when specified', () => {
        const factory = { namedNode: function (s) { return `n-${s}`; } };
        const rdfs = Util.prefix('http://www.w3.org/2000/01/rdf-schema#', factory);
        expect(rdfs('label')).toBe('n-http://www.w3.org/2000/01/rdf-schema#label');
      });
    });
  });

  describe('prefixes', () => {
    describe('called without arguments', () => {
      const prefixes = Util.prefixes();
      it('should return a function', () => {
        expect(prefixes).toBeInstanceOf(Function);
      });

      describe('the function', () => {
        it('should not expand non-registered prefixes', () => {
          expect(() => { prefixes('foo'); }).toThrow('Unknown prefix: foo');
        });

        it('should allow registering prefixes', () => {
          const p = prefixes('rdfs', 'http://www.w3.org/2000/01/rdf-schema#');
          const rdfs = prefixes('rdfs');
          expect(p).toBeDefined();
          expect(p).toBe(rdfs);
        });

        it('should expand the newly registered prefix', () => {
          const rdfs = prefixes('rdfs');
          expect(rdfs('label')).toEqual(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
        });
      });
    });

    describe('called with a hash of prefixes', () => {
      const prefixes = Util.prefixes({
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
      });
      it('should return a function', () => {
        expect(prefixes).toBeInstanceOf(Function);
      });

      describe('the function', () => {
        it('should expand registered prefixes', () => {
          expect(prefixes('rdfs')('label')).toEqual(namedNode('http://www.w3.org/2000/01/rdf-schema#label'));
          expect(prefixes('owl')('sameAs')).toEqual(namedNode('http://www.w3.org/2002/07/owl#sameAs'));
        });

        it('should not expand non-registered prefixes', () => {
          expect(() => { prefixes('foo'); }).toThrow('Unknown prefix: foo');
        });

        it('should allow registering prefixes', () => {
          const p = prefixes('my', 'http://example.org/#');
          const my = prefixes('my');
          expect(p).toBeDefined();
          expect(p).toBe(my);
        });

        it('should expand the newly registered prefix', () => {
          const my = prefixes('my');
          expect(my('me')).toEqual(namedNode('http://example.org/#me'));
        });
      });
    });

    describe('called with a custom factory', () => {
      const factory = { namedNode: function (s) { return `n-${s}`; } };
      const prefixes = Util.prefixes({ my: 'http://example.org/#' }, factory);

      it('should use the custom factory', () => {
        expect(prefixes('my')('foo')).toBe('n-http://example.org/#foo');
      });
    });
  });
});
