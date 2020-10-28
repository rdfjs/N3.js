import {
  DataFactory,
  NamedNode,
  Literal,
  BlankNode,
  Variable,
  DefaultGraph,
  Quad,
} from '../src/';

describe('DataFactory', () => {
  describe('namedNode', () => {
    it('converts a plain IRI', () => {
      DataFactory.namedNode('http://ex.org/foo#bar').should.deep.equal(new NamedNode('http://ex.org/foo#bar'));
    });
  });

  describe('blankNode', () => {
    it('converts a label', () => {
      DataFactory.blankNode('abc').should.deep.equal(new BlankNode('abc'));
    });

    it('creates an anonymous blank node', () => {
      DataFactory.blankNode().should.deep.equal(new BlankNode('n3-0'));
      DataFactory.blankNode().should.deep.equal(new BlankNode('n3-1'));
    });

    it('does not create two equal anonymous blank nodes', () => {
      DataFactory.blankNode().should.not.deep.equal(DataFactory.blankNode());
    });
  });

  describe('literal', () => {
    it('converts the empty string', () => {
      DataFactory.literal('').should.deep.equal(new Literal('""'));
    });

    it('converts the empty string with a language', () => {
      DataFactory.literal('', 'en-GB').should.deep.equal(new Literal('""@en-gb'));
    });

    it('converts the empty string with a named node type', () => {
      DataFactory.literal('', new NamedNode('http://ex.org/type')).should.deep.equal(new Literal('""^^http://ex.org/type'));
    });

    it('converts a non-empty string', () => {
      DataFactory.literal('abc').should.deep.equal(new Literal('"abc"'));
    });

    it('converts a non-empty string with a language', () => {
      DataFactory.literal('abc', 'en-GB').should.deep.equal(new Literal('"abc"@en-gb'));
    });

    it('converts a non-empty string with a named node type', () => {
      DataFactory.literal('abc', new NamedNode('http://ex.org/type')).should.deep.equal(new Literal('"abc"^^http://ex.org/type'));
    });

    it('converts a non-empty string with an xsd:string type', () => {
      DataFactory.literal('abc', new NamedNode('http://www.w3.org/2001/XMLSchema#string')).should.deep.equal(new Literal('"abc"'));
    });

    it('converts an integer', () => {
      DataFactory.literal(123).should.deep.equal(new Literal('"123"^^http://www.w3.org/2001/XMLSchema#integer'));
    });

    it('converts a double', () => {
      DataFactory.literal(2.3).should.deep.equal(new Literal('"2.3"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts Infinity', () => {
      DataFactory.literal(Infinity).should.deep.equal(new Literal('"INF"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts -Infinity', () => {
      DataFactory.literal(-Infinity).should.deep.equal(new Literal('"-INF"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts NaN', () => {
      DataFactory.literal(NaN).should.deep.equal(new Literal('"NaN"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts false', () => {
      DataFactory.literal(false).should.deep.equal(new Literal('"false"^^http://www.w3.org/2001/XMLSchema#boolean'));
    });

    it('converts true', () => {
      DataFactory.literal(true).should.deep.equal(new Literal('"true"^^http://www.w3.org/2001/XMLSchema#boolean'));
    });
  });

  describe('variable', () => {
    it('converts a label', () => {
      DataFactory.variable('abc').should.deep.equal(new Variable('abc'));
    });
  });

  describe('defaultGraph', () => {
    it('returns the default graph', () => {
      DataFactory.defaultGraph().should.deep.equal(new DefaultGraph());
    });
  });

  describe('triple', () => {
    it('returns a quad in the default graph', () => {
      DataFactory.triple(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc')
      ).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new DefaultGraph()
      ));
    });
  });

  describe('quad', () => {
    it('returns a quad', () => {
      DataFactory.quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d')
      ).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should return a nested quad', () => {
      DataFactory.quad(
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d')
      ).should.deep.equal(new Quad(
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should return a nested quad', () => {
      DataFactory.quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d')
        )
      ).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new Quad(
          new NamedNode('http://ex.org/a'),
          new NamedNode('http://ex.org/b'),
          new Literal('abc'),
          new NamedNode('http://ex.org/d')
        )
      ));
    });

    it('without graph parameter returns a quad in the default graph', () => {
      DataFactory.quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc')
      ).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        new DefaultGraph()
      ));
    });
  });
});
