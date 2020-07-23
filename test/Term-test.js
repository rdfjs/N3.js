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

describe('Term', function () {
  describe('The Term module', function () {
    it('should be a function', function () {
      Term.should.be.a('function');
    });

    it('should be a Term constructor', function () {
      new Term().should.be.an.instanceof(Term);
    });
  });

  describe('termFromId', function () {
    it('should create a DefaultGraph from a falsy value', function () {
      termFromId(null).toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a DefaultGraph from the empty string', function () {
      termFromId('').toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a NamedNode from an IRI', function () {
      termFromId('http://example.org/foo#bar').toJSON().should.deep.equal({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });

    it('should create a BlankNode from a string that starts with an underscore', function () {
      termFromId('_:b1').toJSON().should.deep.equal({
        termType: 'BlankNode',
        value: 'b1',
      });
    });

    it('should create a Variable from a string that starts with a question mark', function () {
      termFromId('?v1').toJSON().should.deep.equal({
        termType: 'Variable',
        value: 'v1',
      });
    });

    it('should create a Literal from a string that starts with a quotation mark', function () {
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

    it('should create a Quad with the default graph if the id doesnt specify the graph', function () {
      termFromId('<<http://ex.org/a http://ex.org/b "abc"@en-us>>').should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new DefaultGraph()
      ));
    });

    it('should create a Quad with the correct graph if the id specifies a graph', function () {
      const id = '<<http://ex.org/a http://ex.org/b "abc"@en-us http://ex.org/d>>';
      termFromId(id).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should create a Quad correctly', function () {
      const id = '<<http://ex.org/a http://ex.org/b http://ex.org/c>>';
      termFromId(id).should.deep.equal(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new NamedNode('http://ex.org/c'),
        new DefaultGraph()
      ));
    });

    it('should create a Quad correctly', function () {
      const id = '<<_:n3-123 ?var-a ?var-b _:n3-000>>';
      termFromId(id).should.deep.equal(new Quad(
        new BlankNode('n3-123'),
        new Variable('var-a'),
        new Variable('var-b'),
        new BlankNode('n3-000')
      ));
    });

    it('should create a Quad correctly', function () {
      const id = '<<?var-a ?var-b "abc"@en-us ?var-d>>';
      termFromId(id).should.deep.equal(new Quad(
        new Variable('var-a'),
        new Variable('var-b'),
        new Literal('"abc"@en-us'),
        new Variable('var-d')
      ));
    });

    it('should create a Quad correctly', function () {
      const id = '<<_:n3-000 ?var-b _:n3-123 http://ex.org/d>>';
      termFromId(id).should.deep.equal(new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new BlankNode('n3-123'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should create a Quad correctly from literal containing escaped quotes', function () {
      const id = '<<_:n3-000 ?var-b "Hello ""W""orl""d!"@en-us http://ex.org/d>>';
      termFromId(id).should.deep.equal(new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"Hello "W"orl"d!"@en-us'),
        new NamedNode('http://ex.org/d')
      ));
    });

    it('should create a Quad correctly from literal containing escaped quotes', function () {
      const id = '<<"Hello ""W""orl""d!"@en-us http://ex.org/b http://ex.org/c>>';
      termFromId(id).should.deep.equal(new Quad(
        new Literal('"Hello "W"orl"d!"@en-us'),
        new NamedNode('http://ex.org/b'),
        new NamedNode('http://ex.org/c'),
        new DefaultGraph()
      ));
    });

    describe('with a custom factory', function () {
      var factory = {
        defaultGraph: function ()     { return ['d'];       },
        namedNode:    function (n)    { return ['n', n];    },
        blankNode:    function (b)    { return ['b', b];    },
        variable:     function (v)    { return ['v', v];    },
        literal:      function (l, m) { return ['l', l, m]; },
      };

      it('should create a DefaultGraph from a falsy value', function () {
        termFromId(null, factory).should.deep.equal(['d']);
      });

      it('should create a DefaultGraph from the empty string', function () {
        termFromId('', factory).should.deep.equal(['d']);
      });

      it('should create a NamedNode from an IRI', function () {
        termFromId('http://example.org/foo#bar', factory).should.deep.equal(['n', 'http://example.org/foo#bar']);
      });

      it('should create a BlankNode from a string that starts with an underscore', function () {
        termFromId('_:b1', factory).should.deep.equal(['b', 'b1']);
      });

      it('should create a Variable from a string that starts with a question mark', function () {
        termFromId('?v1', factory).should.deep.equal(['v', 'v1']);
      });

      it('should create a Literal without language or datatype', function () {
        termFromId('"abc"', factory).should.deep.equal(['l', 'abc', undefined]);
      });

      it('should create a Literal with a language', function () {
        termFromId('"abc"@en-us', factory).should.deep.equal(['l', 'abc', 'en-us']);
      });

      it('should create a Literal with a datatype', function () {
        termFromId('"abc"^^https://ex.org/type', factory).should.deep.equal(['l', 'abc', ['n', 'https://ex.org/type']]);
      });
    });
  });

  describe('termToId', function () {
    it('should create the empty string a falsy value', function () {
      termToId(null).should.equal('');
      termToId(false).should.equal('');
      termToId('').should.equal('');
    });

    it('should create the empty string from the DefaultGraph', function () {
      termToId(new DefaultGraph()).should.equal('');
      termToId(new DefaultGraph().toJSON()).should.equal('');
    });

    it('should create an id that starts with a question mark from a Variable', function () {
      termToId(new Variable('abc')).should.equal('?abc');
      termToId(new Variable('abc').toJSON()).should.equal('?abc');
    });

    it('should create an id that starts with a question mark from a Variable string', function () {
      termToId('?abc').should.equal('?abc');
    });

    it('should create an id that starts with a quotation mark from a Literal', function () {
      termToId(new Literal('"abc"')).should.equal('"abc"');
      termToId(new Literal('"abc"').toJSON()).should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark from a Literal string', function () {
      termToId('"abc"').should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal with a datatype', function () {
      termToId(new Literal('"abc"^^http://example.org')).should.equal('"abc"^^http://example.org');
      termToId(new Literal('"abc"^^http://example.org').toJSON()).should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal string with a datatype', function () {
      termToId('"abc"^^http://example.org').should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal with a language', function () {
      termToId(new Literal('"abc"@en-us')).should.equal('"abc"@en-us');
      termToId(new Literal('"abc"@en-us').toJSON()).should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal string with a language', function () {
      termToId('"abc"@en-us').should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal with a datatype and language', function () {
      termToId(new Literal('"abc"^^http://example.org@en-us')).should.equal('"abc"^^http://example.org@en-us');
      termToId(new Literal('"abc"^^http://example.org@en-us').toJSON()).should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal string with a datatype and language', function () {
      termToId('"abc"^^http://example.org@en-us').should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with an underscore from a BlankNode', function () {
      termToId(new BlankNode('abc')).should.equal('_:abc');
      termToId(new BlankNode('abc').toJSON()).should.equal('_:abc');
    });

    it('should create an id that starts with an underscore from a BlankNode string', function () {
      termToId('_:abc').should.equal('_:abc');
    });

    it('should create an IRI from a NamedNode', function () {
      termToId(new NamedNode('http://example.org/')).should.equal('http://example.org/');
      termToId(new NamedNode('http://example.org/').toJSON()).should.equal('http://example.org/');
    });

    it('should create an IRI from a NamedNode string', function () {
      termToId('http://example.org/').should.equal('http://example.org/');
    });

    it('should create an id without graph if default graph is used', function () {
      termToId(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new DefaultGraph()
      )).should.equal('<<http://ex.org/a http://ex.org/b "abc"@en-us>>');
    });

    it('should create an id from a Quad', function () {
      termToId(new Quad(
        new NamedNode('http://ex.org/a'),
        new NamedNode('http://ex.org/b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d')
      )).should.equal('<<http://ex.org/a http://ex.org/b "abc"@en-us http://ex.org/d>>');
    });

    it('should create an id from a manually created Quad', function () {
      termToId({
        subject: new NamedNode('http://ex.org/a'),
        predicate: new NamedNode('http://ex.org/b'),
        object: new Literal('"abc"@en-us'),
        graph: new NamedNode('http://ex.org/d'),
        termType: 'Quad',
        value: '',
      }).should.equal('<<http://ex.org/a http://ex.org/b "abc"@en-us http://ex.org/d>>');
    });

    it('should create an id with escaped literals from a Quad', function () {
      termToId(new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"Hello "W"orl"d!"@en-us'),
        new NamedNode('http://ex.org/d')
      )).should.equal('<<_:n3-000 ?var-b "Hello ""W""orl""d!"@en-us http://ex.org/d>>');
    });

    it('should create an id without graph from a Quad with default graph and Quad as subject', function () {
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

    it('should create an id without graph from a Quad with default graph and Quad as object', function () {
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

    it('should create an id without graph from a Quad with default graph and Quad as subject and object', function () {
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

    it('should create an id without graph from a Quad with Quad as subject', function () {
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

    it('should create an id without graph from a Quad with Quad as object', function () {
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

    it('should create an id from a Quad with Quad as subject and object', function () {
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

    it('should escape literals in nested Quads', function () {
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

    it('should correctly handle deeply nested quads', function () {
      termToId(new Quad(
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
      )).should.equal('<<<<<<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> ?var-b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>> ?var-b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>> http://ex.org/b <<<<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> ?var-b <<_:n3-000 ?var-b "abc"@en-us http://ex.org/d>> http://ex.org/d>> http://ex.org/d>>');
    });

    it('should throw on an unknown type', function () {
      (function () { termToId({ termType: 'unknown' }); })
        .should.throw('Unexpected termType: unknown');
    });
  });

  describe('escaping', function () {
    it('should unescape an escaped string correctly', function () {
      let id = '"Hello ""World"""@en-us';
      unescapeQuotes(id).should.equal('"Hello "World""@en-us');
    });

    it('should escape an unescaped string correctly', function () {
      let id = '"Hello "World""@en-us';
      escapeQuotes(id).should.equal('"Hello ""World"""@en-us');
    });

    it('should not change an unescaped string', function () {
      let id = '"Hello "World""@en-us';
      unescapeQuotes(id).should.equal(id);
    });

    it('should not change a string without quotes', function () {
      let id = '"Hello World"@en-us';
      escapeQuotes(id).should.equal(id);
    });

    it('should not change a blank node', function () {
      let id = '_:b1';
      escapeQuotes(id).should.equal(id);
    });

    it('should not change a variable', function () {
      let id = '?v1';
      escapeQuotes(id).should.equal(id);
    });

    it('should not change the empty string', function () {
      let id = '';
      escapeQuotes(id).should.equal(id);
    });
  });
});
