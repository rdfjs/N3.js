var DataFactory = require('../lib/N3DataFactory');

var NamedNode = DataFactory.internal.NamedNode,
    Literal = DataFactory.internal.Literal,
    BlankNode = DataFactory.internal.BlankNode,
    Variable = DataFactory.internal.Variable,
    DefaultGraph = DataFactory.internal.DefaultGraph,
    Quad = DataFactory.internal.Quad;

describe('DataFactory', function () {
  describe('namedNode', function () {
    it('converts a plain IRI', function () {
      DataFactory.namedNode('http://ex.org/foo#bar').should.deep.equal(new NamedNode('http://ex.org/foo#bar'));
    });
  });

  describe('blankNode', function () {
    it('converts a label', function () {
      DataFactory.blankNode('abc').should.deep.equal(new BlankNode('abc'));
    });

    it('creates an anonymous blank node', function () {
      DataFactory.blankNode().should.deep.equal(new BlankNode('n3-0'));
      DataFactory.blankNode().should.deep.equal(new BlankNode('n3-1'));
    });

    it('does not create two equal anonymous blank nodes', function () {
      DataFactory.blankNode().should.not.deep.equal(DataFactory.blankNode());
    });
  });

  describe('literal', function () {
    it('converts the empty string', function () {
      DataFactory.literal('').should.deep.equal(new Literal('""'));
    });

    it('converts the empty string with a language', function () {
      DataFactory.literal('', 'en-GB').should.deep.equal(new Literal('""@en-gb'));
    });

    it('converts the empty string with a named node type', function () {
      DataFactory.literal('', new NamedNode('http://ex.org/type')).should.deep.equal(new Literal('""^^http://ex.org/type'));
    });

    it('converts a non-empty string', function () {
      DataFactory.literal('abc').should.deep.equal(new Literal('"abc"'));
    });

    it('converts a non-empty string with a language', function () {
      DataFactory.literal('abc', 'en-GB').should.deep.equal(new Literal('"abc"@en-gb'));
    });

    it('converts a non-empty string with a named node type', function () {
      DataFactory.literal('abc', new NamedNode('http://ex.org/type')).should.deep.equal(new Literal('"abc"^^http://ex.org/type'));
    });

    it('converts an integer', function () {
      DataFactory.literal(123).should.deep.equal(new Literal('"123"^^http://www.w3.org/2001/XMLSchema#integer'));
    });

    it('converts a double', function () {
      DataFactory.literal(2.3).should.deep.equal(new Literal('"2.3"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts Infinity', function () {
      DataFactory.literal(Infinity).should.deep.equal(new Literal('"INF"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts -Infinity', function () {
      DataFactory.literal(-Infinity).should.deep.equal(new Literal('"-INF"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts NaN', function () {
      DataFactory.literal(NaN).should.deep.equal(new Literal('"NaN"^^http://www.w3.org/2001/XMLSchema#double'));
    });

    it('converts false', function () {
      DataFactory.literal(false).should.deep.equal(new Literal('"false"^^http://www.w3.org/2001/XMLSchema#boolean'));
    });

    it('converts true', function () {
      DataFactory.literal(true).should.deep.equal(new Literal('"true"^^http://www.w3.org/2001/XMLSchema#boolean'));
    });
  });

  describe('variable', function () {
    it('converts a label', function () {
      DataFactory.variable('abc').should.deep.equal(new Variable('abc'));
    });
  });

  describe('defaultGraph', function () {
    it('returns the default graph', function () {
      DataFactory.defaultGraph().should.deep.equal(DefaultGraph);
    });
  });

  describe('triple', function () {
    it('returns a quad in the default graph', function () {
      DataFactory.triple(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc')
      ).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        DefaultGraph
      ));
    });
  });

  describe('quad', function () {
    it('returns a quad', function () {
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

    it('without graph parameter returns a quad in the default graph', function () {
      DataFactory.quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc')
      ).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('abc'),
        DefaultGraph
      ));
    });
  });
});
