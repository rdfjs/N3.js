import {
  DataFactory,
  NamedNode,
  Literal,
  BlankNode,
  Variable,
  DefaultGraph,
  Quad,
} from '../src';

describe('DataFactory', () => {
  describe('namedNode', () => {
    it('converts a plain IRI', () => {
      expect(DataFactory.namedNode('http://ex.org/foo#bar')).toEqual(new NamedNode('http://ex.org/foo#bar'));
    });
  });

  describe('blankNode', () => {
    it('converts a label', () => {
      expect(DataFactory.blankNode('abc')).toEqual(new BlankNode('abc'));
    });

    it('creates an anonymous blank node', () => {
      expect(DataFactory.blankNode()).toEqual(new BlankNode('n3-0'));
      expect(DataFactory.blankNode()).toEqual(new BlankNode('n3-1'));
    });

    it('does not create two equal anonymous blank nodes', () => {
      expect(DataFactory.blankNode()).not.toEqual(DataFactory.blankNode());
    });
  });

  describe('literal', () => {
    it('converts the empty string', () => {
      expect(DataFactory.literal('')).toEqual(new Literal('""'));
    });

    it('converts the empty string with a language', () => {
      expect(DataFactory.literal('', 'en-GB')).toEqual(new Literal('""@en-gb'));
    });

    it('converts the empty string with a named node type', () => {
      expect(DataFactory.literal('', new NamedNode('http://ex.org/type'))).toEqual(new Literal('""^^http://ex.org/type'));
    });

    it('converts a non-empty string', () => {
      expect(DataFactory.literal('abc')).toEqual(new Literal('"abc"'));
    });

    it('converts a non-empty string with a language', () => {
      expect(DataFactory.literal('abc', 'en-GB')).toEqual(new Literal('"abc"@en-gb'));
    });

    it('converts a non-empty string with a named node type', () => {
      expect(DataFactory.literal('abc', new NamedNode('http://ex.org/type'))).toEqual(new Literal('"abc"^^http://ex.org/type'));
    });

    it('converts a non-empty string with an xsd:string type', () => {
      expect(
        DataFactory.literal('abc', new NamedNode('http://www.w3.org/2001/XMLSchema#string')),
      ).toEqual(new Literal('"abc"'));
    });

    it('converts an integer', () => {
      expect(DataFactory.literal(123)).toEqual(new Literal('"123"^^http://www.w3.org/2001/XMLSchema#integer'));
    });

    it('converts a double', () => {
      expect(DataFactory.literal(2.3)).toEqual(new Literal('"2.3"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts Infinity', () => {
      expect(DataFactory.literal(Infinity)).toEqual(new Literal('"INF"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts -Infinity', () => {
      expect(DataFactory.literal(-Infinity)).toEqual(new Literal('"-INF"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts NaN', () => {
      expect(DataFactory.literal(NaN)).toEqual(new Literal('"NaN"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts false', () => {
      expect(DataFactory.literal(false)).toEqual(new Literal('"false"^^http://www.w3.org/2001/XMLSchema#boolean'));
    });

    it('converts true', () => {
      expect(DataFactory.literal(true)).toEqual(new Literal('"true"^^http://www.w3.org/2001/XMLSchema#boolean'));
    });
  });

  describe('variable', () => {
    it('converts a label', () => {
      expect(DataFactory.variable('abc')).toEqual(new Variable('abc'));
    });
  });

  describe('defaultGraph', () => {
    it('returns the default graph', () => {
      expect(DataFactory.defaultGraph()).toEqual(new DefaultGraph());
    });
  });

  describe('triple', () => {
    it('returns a quad in the default graph', () => {
      expect(DataFactory.triple(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
      )).toEqual(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new DefaultGraph(),
      ));
    });
  });

  describe('quad', () => {
    it('returns a quad', () => {
      expect(DataFactory.quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d'),
      )).toEqual(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d'),
      ));
    });

    it('should return a nested quad', () => {
      expect(DataFactory.quad(
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d'),
        ),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d'),
      )).toEqual(new Quad(
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d'),
        ),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d'),
      ));
    });

    it('should return a nested quad', () => {
      expect(DataFactory.quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d'),
        ),
      )).toEqual(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d'),
        ),
      ));
    });

    it('without graph parameter returns a quad in the default graph', () => {
      expect(DataFactory.quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
      )).toEqual(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new DefaultGraph(),
      ));
    });
  });
});
