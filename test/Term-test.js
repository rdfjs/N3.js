var DataFactory = require('../N3').DataFactory;

var Term      = DataFactory.internal.Term,
    NamedNode = DataFactory.internal.NamedNode,
    BlankNode = DataFactory.internal.BlankNode,
    Literal   = DataFactory.internal.Literal,
    Variable  = DataFactory.internal.Variable,
    DefaultGraph = DataFactory.internal.DefaultGraph,
    toId = DataFactory.internal.toId,
    fromId = DataFactory.internal.fromId;

describe('Term', function () {
  describe('The Term module', function () {
    it('should be a function', function () {
      Term.should.be.a('function');
    });

    it('should make Term objects', function () {
      Term().should.be.an.instanceof(Term);
    });

    it('should be a Term constructor', function () {
      new Term().should.be.an.instanceof(Term);
    });
  });

  describe('fromId', function () {
    it('should create a DefaultGraph from a falsy value', function () {
      fromId(null).toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a DefaultGraph from the empty string', function () {
      fromId('').toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a NamedNode from an IRI', function () {
      fromId('http://example.org/foo#bar').toJSON().should.deep.equal({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });

    it('should create a BlankNode from a string that starts with an underscore', function () {
      fromId('_:b1').toJSON().should.deep.equal({
        termType: 'BlankNode',
        value: 'b1',
      });
    });

    it('should create a Variable from a string that starts with a question mark', function () {
      fromId('?v1').toJSON().should.deep.equal({
        termType: 'Variable',
        value: 'v1',
      });
    });

    it('should create a Literal from a string that starts with a quotation mark', function () {
      fromId('"abc"@en-us').toJSON().should.deep.equal({
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
        fromId(null, factory).should.deep.equal(['d']);
      });

      it('should create a DefaultGraph from the empty string', function () {
        fromId('', factory).should.deep.equal(['d']);
      });

      it('should create a NamedNode from an IRI', function () {
        fromId('http://example.org/foo#bar', factory).should.deep.equal(['n', 'http://example.org/foo#bar']);
      });

      it('should create a BlankNode from a string that starts with an underscore', function () {
        fromId('_:b1', factory).should.deep.equal(['b', 'b1']);
      });

      it('should create a Variable from a string that starts with a question mark', function () {
        fromId('?v1', factory).should.deep.equal(['v', 'v1']);
      });

      it('should create a Literal without language or datatype', function () {
        fromId('"abc"', factory).should.deep.equal(['l', 'abc', undefined]);
      });

      it('should create a Literal with a language', function () {
        fromId('"abc"@en-us', factory).should.deep.equal(['l', 'abc', 'en-us']);
      });

      it('should create a Literal with a datatype', function () {
        fromId('"abc"^^https://ex.org/type', factory).should.deep.equal(['l', 'abc', ['n', 'https://ex.org/type']]);
      });
    });
  });

  describe('toId', function () {
    it('should create the empty string a falsy value', function () {
      toId(null).should.equal('');
      toId(false).should.equal('');
      toId('').should.equal('');
    });

    it('should create the empty string from the DefaultGraph', function () {
      toId(new DefaultGraph()).should.equal('');
      toId(new DefaultGraph().toJSON()).should.equal('');
    });

    it('should create an id that starts with a question mark from a Variable', function () {
      toId(new Variable('abc')).should.equal('?abc');
      toId(new Variable('abc').toJSON()).should.equal('?abc');
    });

    it('should create an id that starts with a question mark from a Variable string', function () {
      toId('?abc').should.equal('?abc');
    });

    it('should create an id that starts with a quotation mark from a Literal', function () {
      toId(new Literal('"abc"')).should.equal('"abc"');
      toId(new Literal('"abc"').toJSON()).should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark from a Literal string', function () {
      toId('"abc"').should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal with a datatype', function () {
      toId(new Literal('"abc"^^http://example.org')).should.equal('"abc"^^http://example.org');
      toId(new Literal('"abc"^^http://example.org').toJSON()).should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal string with a datatype', function () {
      toId('"abc"^^http://example.org').should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal with a language', function () {
      toId(new Literal('"abc"@en-us')).should.equal('"abc"@en-us');
      toId(new Literal('"abc"@en-us').toJSON()).should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal string with a language', function () {
      toId('"abc"@en-us').should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal with a datatype and language', function () {
      toId(new Literal('"abc"^^http://example.org@en-us')).should.equal('"abc"^^http://example.org@en-us');
      toId(new Literal('"abc"^^http://example.org@en-us').toJSON()).should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal string with a datatype and language', function () {
      toId('"abc"^^http://example.org@en-us').should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with an underscore from a BlankNode', function () {
      toId(new BlankNode('abc')).should.equal('_:abc');
      toId(new BlankNode('abc').toJSON()).should.equal('_:abc');
    });

    it('should create an id that starts with an underscore from a BlankNode string', function () {
      toId('_:abc').should.equal('_:abc');
    });

    it('should create an IRI from a NamedNode', function () {
      toId(new NamedNode('http://example.org/')).should.equal('http://example.org/');
      toId(new NamedNode('http://example.org/').toJSON()).should.equal('http://example.org/');
    });

    it('should create an IRI from a NamedNode string', function () {
      toId('http://example.org/').should.equal('http://example.org/');
    });

    it('should throw on an unknown type', function () {
      (function () { toId({ termType: 'unknown' }); })
        .should.throw('Unexpected termType: unknown');
    });
  });
});
