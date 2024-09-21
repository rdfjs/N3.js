import {
  DataFactory,
  NamedNode,
  Literal,
  BlankNode,
  Variable,
  DefaultGraph,
  Quad,
} from '../src';
import * as DM from '@rdfjs/data-model';

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

  describe('fromTerm and fromQuad', () => {
    it('with a named node', () => {
      const named = new NamedNode('http://ex.org/a');
      expect(DataFactory.fromTerm(new NamedNode('http://ex.org/a'))).toEqual(new NamedNode('http://ex.org/a'));
      expect(DataFactory.fromTerm(new NamedNode('http://ex.org/a')).equals(new NamedNode('http://ex.org/a'))).toEqual(true);
      expect(DataFactory.fromTerm(named)).toBe(named);
      expect(DataFactory.fromTerm(DM.namedNode('http://ex.org/a'))).toEqual(new NamedNode('http://ex.org/a'));
      expect(DataFactory.fromTerm(DM.namedNode('http://ex.org/a')).equals(new NamedNode('http://ex.org/a'))).toEqual(true);
      expect(DataFactory.fromTerm(DM.namedNode('http://ex.org/a'))).not.toBe(DM.namedNode('http://ex.org/a'));
      expect(DataFactory.fromTerm(DM.namedNode('http://ex.org/a')).equals(DM.namedNode('http://ex.org/a'))).toBe(true);
    });

    it('with a blank node', () => {
      const blank = new BlankNode('abc');
      expect(DataFactory.fromTerm(new BlankNode('abc'))).toEqual(new BlankNode('abc'));
      expect(DataFactory.fromTerm(new BlankNode('abc')).equals(new BlankNode('abc'))).toEqual(true);
      expect(DataFactory.fromTerm(blank)).toBe(blank);
      expect(DataFactory.fromTerm(DM.blankNode('abc'))).toEqual(new BlankNode('abc'));
      expect(DataFactory.fromTerm(DM.blankNode('abc')).equals(new BlankNode('abc'))).toEqual(true);
      expect(DataFactory.fromTerm(DM.blankNode('abc'))).not.toBe(DM.blankNode('abc'));
      expect(DataFactory.fromTerm(DM.blankNode('abc')).equals(DM.blankNode('abc'))).toBe(true);
    });

    it('with a literal', () => {
      const literal = new Literal('"abc"');
      expect(DataFactory.fromTerm(new Literal('"abc"'))).toEqual(new Literal('"abc"'));
      expect(DataFactory.fromTerm(new Literal('"abc"')).equals(new Literal('"abc"'))).toEqual(true);
      expect(DataFactory.fromTerm(literal)).toBe(literal);
      expect(DataFactory.fromTerm(DM.literal('abc'))).toEqual(new Literal('"abc"'));
      expect(DataFactory.fromTerm(DM.literal('abc')).equals(new Literal('"abc"'))).toEqual(true);
      expect(DataFactory.fromTerm(DM.literal('abc'))).not.toBe(DM.literal('abc'));
      expect(DataFactory.fromTerm(DM.literal('abc')).equals(DM.literal('abc'))).toBe(true);
    });

    it('with a variable', () => {
      const variable = new Variable('abc');
      expect(DataFactory.fromTerm(new Variable('abc'))).toEqual(new Variable('abc'));
      expect(DataFactory.fromTerm(new Variable('abc')).equals(new Variable('abc'))).toEqual(true);
      expect(DataFactory.fromTerm(variable)).toBe(variable);
      expect(DataFactory.fromTerm(DM.variable('abc'))).toEqual(new Variable('abc'));
      expect(DataFactory.fromTerm(DM.variable('abc')).equals(new Variable('abc'))).toEqual(true);
      expect(DataFactory.fromTerm(DM.variable('abc'))).not.toBe(DM.variable('abc'));
      expect(DataFactory.fromTerm(DM.variable('abc')).equals(DM.variable('abc'))).toBe(true);
    });

    it('with a default graph', () => {
      const defaultGraph = new DefaultGraph();
      expect(DataFactory.fromTerm(new DefaultGraph())).toEqual(new DefaultGraph());
      expect(DataFactory.fromTerm(new DefaultGraph()).equals(new DefaultGraph())).toEqual(true);
      expect(DataFactory.fromTerm(defaultGraph)).toBe(defaultGraph);
      expect(DataFactory.fromTerm(DM.defaultGraph())).toEqual(new DefaultGraph());
      expect(DataFactory.fromTerm(DM.defaultGraph()).equals(new DefaultGraph())).toEqual(true);
      expect(DataFactory.fromTerm(DM.defaultGraph())).not.toBe(DM.defaultGraph());
      expect(DataFactory.fromTerm(DM.defaultGraph()).equals(DM.defaultGraph())).toBe(true);
    });

    it('with an unknown term', () => {
      expect(() => DataFactory.fromTerm({})).toThrow();
      expect(() => DataFactory.fromQuad({})).toThrow();
      expect(() => DataFactory.fromQuad(DM.namedNode('http://ex.org/a'))).toThrow();
    });

    it('with a quad', () => {
      const quad = new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"'),
        new NamedNode('http://ex.org/d'),
      );
      const quad2 = DM.quad(
        DM.namedNode('http://ex.org/a'),
        DM.namedNode('http://ex.org/b'),
        DM.literal('abc'),
        DM.namedNode('http://ex.org/d'),
      );
      expect(DataFactory.fromTerm(quad)).toBe(quad);
      expect(DataFactory.fromTerm(quad).equals(quad)).toEqual(true);
      expect(DataFactory.fromTerm(quad2)).toEqual(quad);
      expect(DataFactory.fromTerm(quad2).equals(quad)).toEqual(true);
      expect(DataFactory.fromTerm(quad2).equals(quad2)).toEqual(true);

      expect(DataFactory.fromQuad(quad)).toBe(quad);
      expect(DataFactory.fromQuad(quad).equals(quad)).toEqual(true);
      expect(DataFactory.fromQuad(quad2)).toEqual(quad);
      expect(DataFactory.fromQuad(quad2).equals(quad)).toEqual(true);
      expect(DataFactory.fromQuad(quad2).equals(quad2)).toEqual(true);
    });
  });
});
