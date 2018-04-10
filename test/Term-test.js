var DataFactory = require('../N3').DataFactory;

var Term = DataFactory.Term,
    NamedNode = DataFactory.NamedNode,
    BlankNode = DataFactory.BlankNode,
    Literal   = DataFactory.Literal,
    Variable  = DataFactory.Variable,
    DefaultGraph = DataFactory.DefaultGraph;

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

  describe('Term.fromId', function () {
    it('should create a DefaultGraph from a falsy value', function () {
      Term.fromId(null).toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a DefaultGraph from the empty string', function () {
      Term.fromId('').toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a NamedNode from an IRI', function () {
      Term.fromId('http://example.org/foo#bar').toJSON().should.deep.equal({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });

    it('should create a BlankNode from a string that starts with an underscore', function () {
      Term.fromId('_:b1').toJSON().should.deep.equal({
        termType: 'BlankNode',
        value: 'b1',
      });
    });

    it('should create a Variable from a string that starts with a question mark', function () {
      Term.fromId('?v1').toJSON().should.deep.equal({
        termType: 'Variable',
        value: 'v1',
      });
    });

    it('should create a Literal from a string that starts with a quotation mark', function () {
      Term.fromId('"abc"@en-us').toJSON().should.deep.equal({
        termType: 'Literal',
        value: 'abc',
        language: 'en-us',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
        },
      });
    });
  });

  describe('Term.toId', function () {
    it('should create the empty string a falsy value', function () {
      Term.toId(null).should.equal('');
      Term.toId(false).should.equal('');
      Term.toId('').should.equal('');
    });

    it('should create the empty string from the DefaultGraph', function () {
      Term.toId(new DefaultGraph()).should.equal('');
      Term.toId(new DefaultGraph().toJSON()).should.equal('');
    });

    it('should create an id that starts with a question mark from a Variable', function () {
      Term.toId(new Variable('abc')).should.equal('?abc');
      Term.toId(new Variable('abc').toJSON()).should.equal('?abc');
    });

    it('should create an id that starts with a question mark from a Variable string', function () {
      Term.toId('?abc').should.equal('?abc');
    });

    it('should create an id that starts with a quotation mark from a Literal', function () {
      Term.toId(new Literal('"abc"')).should.equal('"abc"');
      Term.toId(new Literal('"abc"').toJSON()).should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark from a Literal string', function () {
      Term.toId('"abc"').should.equal('"abc"');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal with a datatype', function () {
      Term.toId(new Literal('"abc"^^http://example.org')).should.equal('"abc"^^http://example.org');
      Term.toId(new Literal('"abc"^^http://example.org').toJSON()).should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and datatype from a Literal string with a datatype', function () {
      Term.toId('"abc"^^http://example.org').should.equal('"abc"^^http://example.org');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal with a language', function () {
      Term.toId(new Literal('"abc"@en-us')).should.equal('"abc"@en-us');
      Term.toId(new Literal('"abc"@en-us').toJSON()).should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark and language tag from a Literal string with a language', function () {
      Term.toId('"abc"@en-us').should.equal('"abc"@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal with a datatype and language', function () {
      Term.toId(new Literal('"abc"^^http://example.org@en-us')).should.equal('"abc"^^http://example.org@en-us');
      Term.toId(new Literal('"abc"^^http://example.org@en-us').toJSON()).should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with a quotation mark, datatype and language tag from a Literal string with a datatype and language', function () {
      Term.toId('"abc"^^http://example.org@en-us').should.equal('"abc"^^http://example.org@en-us');
    });

    it('should create an id that starts with an underscore from a BlankNode', function () {
      Term.toId(new BlankNode('abc')).should.equal('_:abc');
      Term.toId(new BlankNode('abc').toJSON()).should.equal('_:abc');
    });

    it('should create an id that starts with an underscore from a BlankNode string', function () {
      Term.toId('_:abc').should.equal('_:abc');
    });

    it('should create an IRI from a NamedNode', function () {
      Term.toId(new NamedNode('http://example.org/')).should.equal('http://example.org/');
      Term.toId(new NamedNode('http://example.org/').toJSON()).should.equal('http://example.org/');
    });

    it('should create an IRI from a NamedNode string', function () {
      Term.toId('http://example.org/').should.equal('http://example.org/');
    });

    it('should throw on an unknown type', function () {
      (function () { Term.toId({ termType: 'unknown' }); })
        .should.throw('Unexpected termType: unknown');
    });
  });
});
