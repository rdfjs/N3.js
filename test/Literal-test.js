var Literal = require('../N3').Literal;

var Term = require('../N3').Term;
var NamedNode = require('../N3').NamedNode;

describe('Literal', function () {
  describe('The Literal module', function () {
    it('should be a function', function () {
      Literal.should.be.a('function');
    });

    it('should make Literal objects', function () {
      Literal().should.be.an.instanceof(Literal);
    });

    it('should make Term objects', function () {
      Literal().should.be.an.instanceof(Term);
    });

    it('should be a Literal constructor', function () {
      new Literal().should.be.an.instanceof(Literal);
    });

    it('should be a Term constructor', function () {
      new Literal().should.be.an.instanceof(Term);
    });
  });

  describe('A Literal instance created from the empty string without language or datatype', function () {
    var literal;
    before(function () { literal = new Literal('""'); });

    it('should be a Literal', function () {
      literal.should.be.an.instanceof(Literal);
    });

    it('should be a Term', function () {
      literal.should.be.an.instanceof(Term);
    });

    it('should have term type "Literal"', function () {
      literal.termType.should.equal('Literal');
    });

    it('should have the empty string as value', function () {
      literal.should.have.property('value', '');
    });

    it('should have the empty string as language', function () {
      literal.should.have.property('language', '');
    });

    it('should have xsd:string as datatype', function () {
      literal.should.have.property('datatype');
      literal.datatype.should.be.an.instanceof(NamedNode);
      literal.datatype.value.should.equal('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should have the quoted empty string as id', function () {
      literal.should.have.property('id', '""');
    });

    it('should equal a Literal instance with the same value', function () {
      literal.equals(new Literal('""')).should.be.true;
    });

    it('should equal an object with the same term type, value, language, and datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      literal.equals(null).should.be.false;
    });

    it('should not equal a Literal instance with a non-empty value', function () {
      literal.equals(new Literal('"x"')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      literal.equals({
        termType: 'Literal',
        value: 'x',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different language', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: 'en',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: '',
        datatype: { value: 'other', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with a different term type', function () {
      literal.equals({
        termType: 'NamedNode',
        value: '',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      literal.toJSON().should.deep.equal({
        termType: 'Literal',
        value: '',
        language: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/2001/XMLSchema#string',
        },
      });
    });
  });

  describe('A Literal instance created from a string without language or datatype', function () {
    var literal;
    before(function () { literal = new Literal('"my @^^ string"'); });

    it('should be a Literal', function () {
      literal.should.be.an.instanceof(Literal);
    });

    it('should be a Term', function () {
      literal.should.be.an.instanceof(Term);
    });

    it('should have term type "Literal"', function () {
      literal.termType.should.equal('Literal');
    });

    it('should have the text value as value', function () {
      literal.should.have.property('value', 'my @^^ string');
    });

    it('should have the empty string as language', function () {
      literal.should.have.property('language', '');
    });

    it('should have xsd:string as datatype', function () {
      literal.should.have.property('datatype');
      literal.datatype.should.be.an.instanceof(NamedNode);
      literal.datatype.value.should.equal('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should have the quoted string as id', function () {
      literal.should.have.property('id', '"my @^^ string"');
    });

    it('should equal a Literal instance with the same value', function () {
      literal.equals(new Literal('"my @^^ string"')).should.be.true;
    });

    it('should equal an object with the same term type, value, language, and datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      literal.equals(null).should.be.false;
    });

    it('should not equal a Literal instance with another value', function () {
      literal.equals(new Literal('"other string"')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      literal.equals({
        termType: 'Literal',
        value: 'other string',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different language', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: 'en',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'other', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with a different term type', function () {
      literal.equals({
        termType: 'NamedNode',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      literal.toJSON().should.deep.equal({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/2001/XMLSchema#string',
        },
      });
    });
  });

  describe('A Literal instance created from the empty string with a language', function () {
    var literal;
    before(function () { literal = new Literal('""@en-us'); });

    it('should be a Literal', function () {
      literal.should.be.an.instanceof(Literal);
    });

    it('should be a Term', function () {
      literal.should.be.an.instanceof(Term);
    });

    it('should have term type "Literal"', function () {
      literal.termType.should.equal('Literal');
    });

    it('should have the empty string as value', function () {
      literal.should.have.property('value', '');
    });

    it('should have the language tag as language', function () {
      literal.should.have.property('language', 'en-us');
    });

    it('should have rdf:langString as datatype', function () {
      literal.should.have.property('datatype');
      literal.datatype.should.be.an.instanceof(NamedNode);
      literal.datatype.value.should.equal('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    });

    it('should have the quoted empty string as id', function () {
      literal.should.have.property('id', '""@en-us');
    });

    it('should equal a Literal instance with the same value', function () {
      literal.equals(new Literal('""@en-us')).should.be.true;
    });

    it('should equal an object with the same term type, value, language, and datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      literal.equals(null).should.be.false;
    });

    it('should not equal a Literal instance with a non-empty value', function () {
      literal.equals(new Literal('"x"')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      literal.equals({
        termType: 'Literal',
        value: 'x',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different language', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: '',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: 'en-us',
        datatype: { value: 'other', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with a different term type', function () {
      literal.equals({
        termType: 'NamedNode',
        value: '',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      literal.toJSON().should.deep.equal({
        termType: 'Literal',
        value: '',
        language: 'en-us',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
        },
      });
    });
  });

  describe('A Literal instance created from a string without language or datatype', function () {
    var literal;
    before(function () { literal = new Literal('"my @^^ string"@en-us'); });

    it('should be a Literal', function () {
      literal.should.be.an.instanceof(Literal);
    });

    it('should be a Term', function () {
      literal.should.be.an.instanceof(Term);
    });

    it('should have term type "Literal"', function () {
      literal.termType.should.equal('Literal');
    });

    it('should have the text value as value', function () {
      literal.should.have.property('value', 'my @^^ string');
    });

    it('should have the language tag as language', function () {
      literal.should.have.property('language', 'en-us');
    });

    it('should have rdf:langString as datatype', function () {
      literal.should.have.property('datatype');
      literal.datatype.should.be.an.instanceof(NamedNode);
      literal.datatype.value.should.equal('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    });

    it('should have the quoted string as id', function () {
      literal.should.have.property('id', '"my @^^ string"@en-us');
    });

    it('should equal a Literal instance with the same value', function () {
      literal.equals(new Literal('"my @^^ string"@en-us')).should.be.true;
    });

    it('should equal an object with the same term type, value, language, and datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      literal.equals(null).should.be.false;
    });

    it('should not equal a Literal instance with another value', function () {
      literal.equals(new Literal('"other string"')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      literal.equals({
        termType: 'Literal',
        value: 'other string',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different language', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: 'fr',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: 'en-us',
        datatype: { value: 'other', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with a different term type', function () {
      literal.equals({
        termType: 'NamedNode',
        value: 'my @^^ string',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      literal.toJSON().should.deep.equal({
        termType: 'Literal',
        value: 'my @^^ string',
        language: 'en-us',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
        },
      });
    });
  });

  describe('A Literal instance created from the empty string with a datatype', function () {
    var literal;
    before(function () { literal = new Literal('""^^http://example.org/types#type'); });

    it('should be a Literal', function () {
      literal.should.be.an.instanceof(Literal);
    });

    it('should be a Term', function () {
      literal.should.be.an.instanceof(Term);
    });

    it('should have term type "Literal"', function () {
      literal.termType.should.equal('Literal');
    });

    it('should have the empty string as value', function () {
      literal.should.have.property('value', '');
    });

    it('should have the empty string as language', function () {
      literal.should.have.property('language', '');
    });

    it('should have the datatype', function () {
      literal.should.have.property('datatype');
      literal.datatype.should.be.an.instanceof(NamedNode);
      literal.datatype.value.should.equal('http://example.org/types#type');
    });

    it('should have the quoted empty string as id', function () {
      literal.should.have.property('id', '""^^http://example.org/types#type');
    });

    it('should equal a Literal instance with the same value', function () {
      literal.equals(new Literal('""^^http://example.org/types#type')).should.be.true;
    });

    it('should equal an object with the same term type, value, language, and datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      literal.equals(null).should.be.false;
    });

    it('should not equal a Literal instance with a non-empty value', function () {
      literal.equals(new Literal('"x"^^http://example.org/types#type')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      literal.equals({
        termType: 'Literal',
        value: 'x',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different language', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: 'en',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: '',
        language: '',
        datatype: { value: 'other', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with a different term type', function () {
      literal.equals({
        termType: 'NamedNode',
        value: '',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      literal.toJSON().should.deep.equal({
        termType: 'Literal',
        value: '',
        language: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://example.org/types#type',
        },
      });
    });
  });

  describe('A Literal instance created from a string with a datatype', function () {
    var literal;
    before(function () { literal = new Literal('"my @^^ string"^^http://example.org/types#type'); });

    it('should be a Literal', function () {
      literal.should.be.an.instanceof(Literal);
    });

    it('should be a Term', function () {
      literal.should.be.an.instanceof(Term);
    });

    it('should have term type "Literal"', function () {
      literal.termType.should.equal('Literal');
    });

    it('should have the text value as value', function () {
      literal.should.have.property('value', 'my @^^ string');
    });

    it('should have the empty string as language', function () {
      literal.should.have.property('language', '');
    });

    it('should have the datatype', function () {
      literal.should.have.property('datatype');
      literal.datatype.should.be.an.instanceof(NamedNode);
      literal.datatype.value.should.equal('http://example.org/types#type');
    });

    it('should have the quoted string as id', function () {
      literal.should.have.property('id', '"my @^^ string"^^http://example.org/types#type');
    });

    it('should equal a Literal instance with the same value', function () {
      literal.equals(new Literal('"my @^^ string"^^http://example.org/types#type')).should.be.true;
    });

    it('should equal an object with the same term type, value, language, and datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      literal.equals(null).should.be.false;
    });

    it('should not equal a Literal instance with another value', function () {
      literal.equals(new Literal('"other string"^^http://example.org/types#type')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      literal.equals({
        termType: 'Literal',
        value: 'other string',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different language', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: 'en',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with the same term type but a different datatype', function () {
      literal.equals({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'other', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should not equal an object with a different term type', function () {
      literal.equals({
        termType: 'NamedNode',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      literal.toJSON().should.deep.equal({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://example.org/types#type',
        },
      });
    });
  });
});
