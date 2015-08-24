var N3Util = require('../N3').Util;
var chai = require('chai');
var expect = chai.expect;
chai.should();

describe('N3Util', function () {
  describe('The N3Util module', function () {
    it('is a function', function () {
      N3Util.should.be.a('function');
    });

    it('can attach functions to an object', function () {
      var host = {};
      N3Util(host).should.equal(host);
      host.isIRI.should.be.a('function');
      host.isLiteral.should.be.a('function');
      host.isPrefixedName('a:b').should.be.true;
    });

    it("can attach functions to an object's prototype", function () {
      function Constructor() {}
      Constructor.prototype = { toString: function () { return 'a:b'; } };
      N3Util(Constructor, true).should.equal(Constructor);
      Constructor.prototype.isIRI.should.be.a('function');
      Constructor.prototype.isLiteral.should.be.a('function');

      var host = new Constructor();
      host.isPrefixedName().should.be.true;
    });
  });

  describe('isIRI', function () {
    it('matches an IRI', function () {
      N3Util.isIRI('http://example.org/').should.be.true;
    });

    it('does not match a literal', function () {
      N3Util.isIRI('"http://example.org/"').should.be.false;
    });

    it('does not match a blank node', function () {
      N3Util.isIRI('_:x').should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isIRI(null)).to.be.null;
    });

    it('does not match undefined', function () {
      expect(N3Util.isIRI(undefined)).to.be.undefined;
    });
  });

  describe('isLiteral', function () {
    it('matches a literal', function () {
      N3Util.isLiteral('"http://example.org/"').should.be.true;
    });

    it('matches a literal with a language', function () {
      N3Util.isLiteral('"English"@en').should.be.true;
    });

    it('matches a literal with a language that contains a number', function () {
      N3Util.isLiteral('"English"@es-419').should.be.true;
    });

    it('matches a literal with a type', function () {
      N3Util.isLiteral('"3"^^http://www.w3.org/2001/XMLSchema#integer').should.be.true;
    });

    it('matches a literal with a newline', function () {
      N3Util.isLiteral('"a\nb"').should.be.true;
    });

    it('matches a literal with a cariage return', function () {
      N3Util.isLiteral('"a\rb"').should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isLiteral('http://example.org/').should.be.false;
    });

    it('does not match a blank node', function () {
      N3Util.isLiteral('_:x').should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isLiteral(null)).to.be.null;
    });

    it('does not match undefined', function () {
      expect(N3Util.isLiteral(undefined)).to.be.undefined;
    });
  });

  describe('isBlank', function () {
    it('matches a blank node', function () {
      N3Util.isBlank('_:x').should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isBlank('http://example.org/').should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.isBlank('"http://example.org/"').should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isBlank(null)).to.be.null;
    });

    it('does not match undefined', function () {
      expect(N3Util.isBlank(undefined)).to.be.undefined;
    });
  });

  describe('getLiteralValue', function () {
    it('gets the value of a literal', function () {
      N3Util.getLiteralValue('"Mickey"').should.equal('Mickey');
    });

    it('gets the value of a literal with a language', function () {
      N3Util.getLiteralValue('"English"@en').should.equal('English');
    });

    it('gets the value of a literal with a language that contains a number', function () {
      N3Util.getLiteralValue('"English"@es-419').should.equal('English');
    });

    it('gets the value of a literal with a type', function () {
      N3Util.getLiteralValue('"3"^^http://www.w3.org/2001/XMLSchema#integer').should.equal('3');
    });

    it('gets the value of a literal with a newline', function () {
      N3Util.getLiteralValue('"Mickey\nMouse"').should.equal('Mickey\nMouse');
    });

    it('gets the value of a literal with a cariage return', function () {
      N3Util.getLiteralValue('"Mickey\rMouse"').should.equal('Mickey\rMouse');
    });

    it('does not work with non-literals', function () {
      N3Util.getLiteralValue.bind(null, 'http://ex.org/').should.throw('http://ex.org/ is not a literal');
    });

    it('does not work with null', function () {
      N3Util.getLiteralValue.bind(null, null).should.throw('null is not a literal');
    });

    it('does not work with undefined', function () {
      N3Util.getLiteralValue.bind(null, undefined).should.throw('undefined is not a literal');
    });
  });

  describe('getLiteralType', function () {
    it('gets the type of a literal', function () {
      N3Util.getLiteralType('"Mickey"').should.equal('http://www.w3.org/2001/XMLSchema#string');
    });

    it('gets the type of a literal with a language', function () {
      N3Util.getLiteralType('"English"@en').should.equal('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    });

    it('gets the type of a literal with a language that contains a number', function () {
      N3Util.getLiteralType('"English"@es-419').should.equal('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    });

    it('gets the type of a literal with a type', function () {
      N3Util.getLiteralType('"3"^^http://www.w3.org/2001/XMLSchema#integer').should.equal('http://www.w3.org/2001/XMLSchema#integer');
    });

    it('gets the type of a literal with a newline', function () {
      N3Util.getLiteralType('"Mickey\nMouse"^^abc').should.equal('abc');
    });

    it('gets the type of a literal with a cariage return', function () {
      N3Util.getLiteralType('"Mickey\rMouse"^^abc').should.equal('abc');
    });

    it('does not work with non-literals', function () {
      N3Util.getLiteralType.bind(null, 'http://example.org/').should.throw('http://example.org/ is not a literal');
    });

    it('does not work with null', function () {
      N3Util.getLiteralType.bind(null, null).should.throw('null is not a literal');
    });

    it('does not work with undefined', function () {
      N3Util.getLiteralType.bind(null, undefined).should.throw('undefined is not a literal');
    });
  });

  describe('getLiteralLanguage', function () {
    it('gets the language of a literal', function () {
      N3Util.getLiteralLanguage('"Mickey"').should.equal('');
    });

    it('gets the language of a literal with a language', function () {
      N3Util.getLiteralLanguage('"English"@en').should.equal('en');
    });

    it('gets the language of a literal with a language that contains a number', function () {
      N3Util.getLiteralLanguage('"English"@es-419').should.equal('es-419');
    });

    it('normalizes the language to lowercase', function () {
      N3Util.getLiteralLanguage('"English"@en-GB').should.equal('en-gb');
    });

    it('gets the language of a literal with a type', function () {
      N3Util.getLiteralLanguage('"3"^^http://www.w3.org/2001/XMLSchema#integer').should.equal('');
    });

    it('gets the language of a literal with a newline', function () {
      N3Util.getLiteralLanguage('"Mickey\nMouse"@en').should.equal('en');
    });

    it('gets the language of a literal with a cariage return', function () {
      N3Util.getLiteralLanguage('"Mickey\rMouse"@en').should.equal('en');
    });

    it('does not work with non-literals', function () {
      N3Util.getLiteralLanguage.bind(null, 'http://example.org/').should.throw('http://example.org/ is not a literal');
    });

    it('does not work with null', function () {
      N3Util.getLiteralLanguage.bind(null, null).should.throw('null is not a literal');
    });

    it('does not work with undefined', function () {
      N3Util.getLiteralLanguage.bind(null, undefined).should.throw('undefined is not a literal');
    });
  });

  describe('isPrefixedName', function () {
    it('matches a prefixed name', function () {
      N3Util.isPrefixedName('ex:Test').should.be.true;
    });

    it('does not match an IRI', function () {
      N3Util.isPrefixedName('http://example.org/').should.be.false;
    });

    it('does not match a literal', function () {
      N3Util.isPrefixedName('"http://example.org/"').should.be.false;
    });

    it('does not match a literal with a colon', function () {
      N3Util.isPrefixedName('"a:b"').should.be.false;
    });

    it('does not match null', function () {
      expect(N3Util.isPrefixedName(null)).to.be.null;
    });

    it('does not match undefined', function () {
      expect(N3Util.isPrefixedName(undefined)).to.be.undefined;
    });
  });

  describe('expandPrefixedName', function () {
    it('expands a prefixed name', function () {
      N3Util.expandPrefixedName('ex:Test', { ex: 'http://ex.org/#' }).should.equal('http://ex.org/#Test');
    });

    it('expands a type with a prefixed name', function () {
      N3Util.expandPrefixedName('"a"^^ex:type', { ex: 'http://ex.org/#' }).should.equal('"a"^^http://ex.org/#type');
    });

    it('expands a prefixed name with the empty prefix', function () {
      N3Util.expandPrefixedName(':Test', { '': 'http://ex.org/#' }).should.equal('http://ex.org/#Test');
    });

    it('does not expand a prefixed name if the prefix is unknown', function () {
      N3Util.expandPrefixedName('a:Test', { b: 'http://ex.org/#' }).should.equal('a:Test');
    });

    it('returns the input if it is not a prefixed name', function () {
      N3Util.expandPrefixedName('abc', null).should.equal('abc');
    });
  });

  describe('createIRI', function () {
    it('converts a plain IRI', function () {
      N3Util.createIRI('http://ex.org/foo#bar').should.equal('http://ex.org/foo#bar');
    });

    it('converts a literal', function () {
      N3Util.createIRI('"http://ex.org/foo#bar"^^uri:type').should.equal('http://ex.org/foo#bar');
    });

    it('converts null', function () {
      expect(N3Util.createIRI(null)).to.be.null;
    });
  });

  describe('createLiteral', function () {
    it('converts the empty string', function () {
      N3Util.createLiteral('').should.equal('""');
    });

    it('converts the empty string with a language', function () {
      N3Util.createLiteral('', 'en-GB').should.equal('""@en-gb');
    });

    it('converts the empty string with a type', function () {
      N3Util.createLiteral('', 'http://ex.org/type').should.equal('""^^http://ex.org/type');
    });

    it('converts a non-empty string', function () {
      N3Util.createLiteral('abc').should.equal('"abc"');
    });

    it('converts a non-empty string with a language', function () {
      N3Util.createLiteral('abc', 'en-GB').should.equal('"abc"@en-gb');
    });

    it('converts a non-empty string with a type', function () {
      N3Util.createLiteral('abc', 'http://ex.org/type').should.equal('"abc"^^http://ex.org/type');
    });

    it('converts an integer', function () {
      N3Util.createLiteral(123).should.equal('"123"^^http://www.w3.org/2001/XMLSchema#integer');
    });

    it('converts a decimal', function () {
      N3Util.createLiteral(2.3).should.equal('"2.3"^^http://www.w3.org/2001/XMLSchema#decimal');
    });

    it('converts infinity', function () {
      N3Util.createLiteral(Infinity).should.equal('"Infinity"');
    });

    it('converts false', function () {
      N3Util.createLiteral(false).should.equal('"false"^^http://www.w3.org/2001/XMLSchema#boolean');
    });

    it('converts true', function () {
      N3Util.createLiteral(true).should.equal('"true"^^http://www.w3.org/2001/XMLSchema#boolean');
    });
  });
});
