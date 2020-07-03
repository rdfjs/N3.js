import {
  Term,
  NamedNode,
  BlankNode,
  Literal,
  Variable,
  DefaultGraph,
  termToId,
  termFromId,
} from '../src/';

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

    it('should throw on an unknown type', function () {
      (function () { termToId({ termType: 'unknown' }); })
        .should.throw('Unexpected termType: unknown');
    });
  });
});
