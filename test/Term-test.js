import {
  Term,
  NamedNode,
  BlankNode,
  Literal,
  Variable,
  DefaultGraph,
  Quad,
  termToId,
  termFromId,
} from '../src/';

import {
  escapeQuotes,
  unescapeQuotes,
} from '../src/N3DataFactory';

const DEEP_TRIPLE = new Quad(
  new Quad(
    new Quad(
      new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d')
      ),
      new Variable('var-b'),
      new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d')
      ),
      new NamedNode('http://ex.org/d')
    ),
    new Variable('var-b'),
    new Quad(
      new BlankNode('n3-000'),
      new Variable('var-b'),
      new Literal('"abc"@en-us'),
      new NamedNode('http://ex.org/d')
    ),
    new NamedNode('http://ex.org/d')
  ),
  new NamedNode('http://ex.org/b'),
  new Quad(
    new Quad(
      new BlankNode('n3-000'),
      new Variable('var-b'),
      new Literal('"abc"@en-us'),
      new NamedNode('http://ex.org/d')
    ),
    new Variable('var-b'),
    new Quad(
      new BlankNode('n3-000'),
      new Variable('var-b'),
      new Literal('"abc"@en-us'),
      new NamedNode('http://ex.org/d')
    ),
    new NamedNode('http://ex.org/d')
  ),
  new NamedNode('http://ex.org/d')
)

const DEEP_TRIPLE_STRING = '<<<<<<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> ?var-b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>> ?var-b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>> http://ex.org/b <<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> ?var-b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>> http://ex.org/d>>'

describe('Term', () => {
  describe('The Term module', () => {
    it('should be a function', () => {
      Term.should.be.a('function');
    });

    it('should be a Term constructor', () => {
      new Term().should.be.an.instanceof(Term);
    });
  });

  describe('A Term instance', () => {
    it('has an integer hashCode', () => {
      new Term().hashCode().should.equal(0);
    });
  });

  describe('termFromId', () => {
    it('should create a DefaultGraph from a falsy value', () => {
      termFromId(null).toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a DefaultGraph from the empty string', () => {
      termFromId('').toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a NamedNode from an IRI', () => {
      termFromId('http://example.org/foo#bar').toJSON().should.deep.equal({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });

    it('should create a BlankNode from a string that starts with an underscore', () => {
      termFromId('_:b1').toJSON().should.deep.equal({
        termType: 'BlankNode',
        value: 'b1',
      });
    });

    it('should create a Variable from a string that starts with a question mark', () => {
      termFromId('?v1').toJSON().should.deep.equal({
        termType: 'Variable',
        value: 'v1',
      });
    });

    it('should create a Literal from a string that starts with a quotation mark', () => {
      termFromId('"abc"@en-us').toJSON().should.deep.equal({
        termType: 'Literal',
        value: 'abc',
        language: 'en-us',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
        },
      });
    });

    it('should create a Quad with the default graph if the id doesnt specify the graph', () => {
      termFromId('<<http://ex.org/a http://ex.org/b "abc"@en-us>>').should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new DefaultGraph()
      ));
    });

    it('should create a Quad with the correct graph if the id specifies a graph', () => {
      const id = '<<http://ex.org/a http://ex.org/b "abc"@en-us http://ex.org/d>>';
      termFromId(id).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should create a Quad correctly', () => {
      const id = '<<http://ex.org/a http://ex.org/b http://ex.org/c>>';
      termFromId(id).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new NamedNode('http://ex.org/c'),
        new DefaultGraph()
      ));
    });

    it('should create a Quad correctly', () => {
      const id = '<<_:n3-123 ?var-a ?var-b _:n3-000>>';
      termFromId(id).should.deep.equal(new Quad(
        new BlankNode('n3-123'),
        new Variable('var-a'),
        new Variable('var-b'),
        new BlankNode('n3-000')
      ));
    });

    it('should create a Quad correctly', () => {
      const id = '<<?var-a ?var-b "abc"@en-us ?var-d>>';
      termFromId(id).should.deep.equal(new Quad(
        new Variable('var-a'),
        new Variable('var-b'),
        new Literal('"abc"@en-us'),
        new Variable('var-d')
      ));
    });

    it('should create a Quad correctly', () => {
      const id = '<<_:n3-000 ?var-b _:n3-123 http://ex.org/d>>';
      termFromId(id).should.deep.equal(new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new BlankNode('n3-123'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should create a Quad correctly from literal containing escaped quotes', () => {
      const id = '<<_:n3-000 ?var-b "Hello ""W""orl""d!"@en-us http://ex.org/d>>';
      termFromId(id).should.deep.equal(new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"Hello "W"orl"d!"@en-us'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should create a Quad correctly from literal containing escaped quotes', () => {
      const id = '<<"Hello ""W""orl""d!"@en-us http://ex.org/b http://ex.org/c>>';
      termFromId(id).should.deep.equal(new Quad(
        new Literal('"Hello "W"orl"d!"@en-us'),
        new NamedNode('http://ex.org/b'),
        new NamedNode('http://ex.org/c'),
        new DefaultGraph()
      ));
    });

    it('should correctly handle deeply nested quads', () => {
      termFromId(DEEP_TRIPLE_STRING).should.equal(DEEP_TRIPLE);
    });

    describe('with a custom factory', () => {
      const factory = {
        defaultGraph: function ()     { return ['d'];       },
        namedNode:    function (n)    { return ['n', n];    },
        blankNode:    function (b)    { return ['b', b];    },
        variable:     function (v)    { return ['v', v];    },
        literal:      function (l, m) { return ['l', l, m]; },
      };

      it('should create a DefaultGraph from a falsy value', () => {
        termFromId(null, factory).should.deep.equal(['d']);
      });

      it('should create a DefaultGraph from the empty string', () => {
        termFromId('', factory).should.deep.equal(['d']);
      });

      it('should create a NamedNode from an IRI', () => {
        termFromId('http://example.org/foo#bar', factory).should.deep.equal(['n', 'http://example.org/foo#bar']);
      });

      it('should create a BlankNode from a string that starts with an underscore', () => {
        termFromId('_:b1', factory).should.deep.equal(['b', 'b1']);
      });

      it('should create a Variable from a string that starts with a question mark', () => {
        termFromId('?v1', factory).should.deep.equal(['v', 'v1']);
      });

      it('should create a Literal without language or datatype', () => {
        termFromId('"abc"', factory).should.deep.equal(['l', 'abc', undefined]);
      });

      it('should create a Literal with a language', () => {
        termFromId('"abc"@en-us', factory).should.deep.equal(['l', 'abc', 'en-us']);
      });

      it('should create a Literal with a datatype', () => {
        termFromId('"abc"^^https://ex.org/type', factory).should.deep.equal(['l', 'abc', ['n', 'https://ex.org/type']]);
      });
    });
  });

  describe('termToId', () => {
    it('should create the empty string a falsy value', () => {
      termToId(null).should.equal('');
      termToId(false).should.equal('');
      termToId('').should.equal('');
    });

    it('should create the empty string from the DefaultGraph', () => {
      termToId(new DefaultGraph()).should.equal('');
      termToId(new DefaultGraph().toJSON()).should.equal('');
    });

    it('should create an id that starts with a question mark from a Variable', () => {
      termToId(new Variable('abc')).should.equal('?abc');
      termToId(new Variable('abc').toJSON()).should.equal('?abc');
    });

    it('should create an id that starts with a question mark from a Variable string', () => {
      termToId('?abc').should.equal('?abc');
    });

    it('should create an id that starts with a quotation mark from a Literal', () => {
      termToId(new Literal('"abc"')).should.equal('"abc"');
      termToId(new Literal('"abc"').toJSON()).should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark from a Literal string', () => {
      termToId('"abc"').should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal with a datatype', () => {
      termToId(new Literal('"abc"^^http://example.org')).should.equal('"abc"^^http://example.org');
      termToId(new Literal('"abc"^^http://example.org').toJSON()).should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal string with a datatype', () => {
      termToId('"abc"^^http://example.org').should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal with a language', () => {
      termToId(new Literal('"abc"@en-us')).should.equal('"abc"@en-us');
      termToId(new Literal('"abc"@en-us').toJSON()).should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal string with a language', () => {
      termToId('"abc"@en-us').should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal with a datatype and language', () => {
      termToId(new Literal('"abc"^^http://example.org@en-us')).should.equal('"abc"^^http://example.org@en-us');
      termToId(new Literal('"abc"^^http://example.org@en-us').toJSON()).should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal string with a datatype and language', () => {
      termToId('"abc"^^http://example.org@en-us').should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with an underscore from a BlankNode', () => {
      termToId(new BlankNode('abc')).should.equal('_:abc');
      termToId(new BlankNode('abc').toJSON()).should.equal('_:abc');
    });

    it('should create an id that starts with an underscore from a BlankNode string', () => {
      termToId('_:abc').should.equal('_:abc');
    });

    it('should create an IRI from a NamedNode', () => {
      termToId(new NamedNode('http://example.org/')).should.equal('http://example.org/');
      termToId(new NamedNode('http://example.org/').toJSON()).should.equal('http://example.org/');
    });

    it('should create an IRI from a NamedNode string', () => {
      termToId('http://example.org/').should.equal('http://example.org/');
    });

    it('should create an id without graph if default graph is used', () => {
      termToId(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new DefaultGraph()
      )).should.equal('<<http://ex.org/a http://ex.org/b "abc"@en-us>>');
    });

    it('should create an id from a Quad', () => {
      termToId(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d')
      )).should.equal('<<http://ex.org/a http://ex.org/b "abc"@en-us http://ex.org/d>>');
    });

    it('should create an id from a manually created Quad', () => {
      termToId({
        subject: new NamedNode('http://ex.org/a'),
        predicate: new NamedNode('http://ex.org/b'),
        object: new Literal('"abc"@en-us'),
        graph: new NamedNode('http://ex.org/d'),
        termType: 'Quad',
        value: '',
      }).should.equal('<<http://ex.org/a http://ex.org/b "abc"@en-us http://ex.org/d>>');
    });

    it('should create an id with escaped literals from a Quad', () => {
      termToId(new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"Hello "W"orl"d!"@en-us'),
        new NamedNode('http://ex.org/d')
      )).should.equal('<<_:n3-000 ?var-b "Hello ""W""orl""d!"@en-us http://ex.org/d>>');
    });

    it('should create an id without graph from a Quad with default graph and Quad as subject', () => {
      termToId(new Quad(
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new DefaultGraph()
      )).should.equal('<<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/b "abc"@en-us>>');
    });

    it('should create an id without graph from a Quad with default graph and Quad as object', () => {
      termToId(new Quad(
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/b'),
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new DefaultGraph()
      )).should.equal('<<"abc"@en-us http://ex.org/b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>>>>');
    });

    it('should create an id without graph from a Quad with default graph and Quad as subject and object', () => {
      termToId(new Quad(
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/b'),
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new DefaultGraph()
      )).should.equal('<<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>>>>');
    });

    it('should create an id without graph from a Quad with Quad as subject', () => {
      termToId(new Quad(
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d')
      )).should.equal('<<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/b "abc"@en-us http://ex.org/d>>');
    });

    it('should create an id without graph from a Quad with Quad as object', () => {
      termToId(new Quad(
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/b'),
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/d')
      )).should.equal('<<"abc"@en-us http://ex.org/b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>>');
    });

    it('should create an id from a Quad with Quad as subject and object', () => {
      termToId(new Quad(
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/b'),
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"abc"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/d')
      )).should.equal('<<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>>');
    });

    it('should escape literals in nested Quads', () => {
      termToId(new Quad(
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"Hello "W"orl"d!"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new NamedNode('http://ex.org/b'),
        new Quad(
          new BlankNode('n3-000'),
          new Variable('var-b'),
          new Literal('"Hello "W"orl"d!"@en-us'),
          new NamedNode('http://ex.org/d')
        ),
        new DefaultGraph()
      )).should.equal('<<<<_:n3-000 ?var-b "Hello ""W""orl""d!"@en-us http://ex.org/d>> http://ex.org/b <<_:n3-000 ?var-b "Hello ""W""orl""d!"@en-us http://ex.org/d>>>>');
    });

    it('should correctly handle deeply nested quads', () => {
      termToId(DEEP_TRIPLE).should.equal(DEEP_TRIPLE_STRING);
    });

    it('should throw on an unknown type', () => {
      (function () { termToId({ termType: 'unknown' }); })
        .should.throw('Unexpected termType: unknown');
    });
  });

  describe('escaping', () => {
    it('should unescape an escaped string correctly', () => {
      const id = '"Hello ""World"""@en-us';
      unescapeQuotes(id).should.equal('"Hello "World""@en-us');
    });

    it('should escape an unescaped string correctly', () => {
      const id = '"Hello "World""@en-us';
      escapeQuotes(id).should.equal('"Hello ""World"""@en-us');
    });

    it('should not change an unescaped string', () => {
      const id = '"Hello "World""@en-us';
      unescapeQuotes(id).should.equal(id);
    });

    it('should not change a string without quotes', () => {
      const id = '"Hello World"@en-us';
      escapeQuotes(id).should.equal(id);
    });

    it('should not change a blank node', () => {
      const id = '_:b1';
      escapeQuotes(id).should.equal(id);
    });

    it('should not change a variable', () => {
      const id = '?v1';
      escapeQuotes(id).should.equal(id);
    });

    it('should not change the empty string', () => {
      const id = '';
      escapeQuotes(id).should.equal(id);
    });
  });
});
