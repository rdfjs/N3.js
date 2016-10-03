var Term = require('../N3').Term;

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
});
