var N3Util = require('../N3').Util;
var vows = require('vows'),
    chai = require('chai'),
    expect = chai.expect;
chai.should();
chai.use(require('chai-things'));

vows.describe('N3Util').addBatch({
  'The N3Util module': {
    topic: function () { return N3Util; },

    'is a function': function (N3Util) {
      N3Util.should.be.a('function');
    },

    'can attach functions to an object': function (N3Util) {
      var host = {};
      N3Util(host).should.equal(host);
      host.isUri.should.be.a('function');
      host.isLiteral.should.be.a('function');
      host.isQName('a:b').should.be.true;
    },

    "can attach functions to an object's prototype": function (N3Util) {
      function Constructor() {}
      Constructor.prototype = { toString: function () { return 'a:b'; } };
      N3Util(Constructor, true).should.equal(Constructor);
      Constructor.prototype.isUri.should.be.a('function');
      Constructor.prototype.isLiteral.should.be.a('function');

      var host = new Constructor();
      host.isQName().should.be.true;
    },

    'isUri': {
      topic: function (N3Util) { return N3Util.isUri; },

      'matches a URI': function (isUri) {
        isUri('http://example.org/').should.be.true;
      },

      'does not match a literal': function (isUri) {
        isUri('"http://example.org/"').should.be.false;
      },

      'does not match a blank node': function (isUri) {
        isUri('_:x').should.be.false;
      },

      'does not match null': function (isUri) {
        expect(isUri(null)).to.be.null;
      },

      'does not match undefined': function (isUri) {
        expect(isUri(undefined)).to.be.undefined;
      },
    },

    'isLiteral': {
      topic: function (N3Util) { return N3Util.isLiteral; },

      'matches a literal': function (isLiteral) {
        isLiteral('"http://example.org/"').should.be.true;
      },

      'matches a literal with a language': function (isLiteral) {
        isLiteral('"English"@en').should.be.true;
      },

      'matches a literal with a type': function (isLiteral) {
        isLiteral('"3"^^<http://www.w3.org/2001/XMLSchema#integer>').should.be.true;
      },

      'does not match a URI': function (isLiteral) {
        isLiteral('http://example.org/').should.be.false;
      },

      'does not match a blank node': function (isLiteral) {
        isLiteral('_:x').should.be.false;
      },

      'does not match null': function (isLiteral) {
        expect(isLiteral(null)).to.be.null;
      },

      'does not match undefined': function (isLiteral) {
        expect(isLiteral(undefined)).to.be.undefined;
      },
    },

    'isBlank': {
      topic: function (N3Util) { return N3Util.isBlank; },

      'matches a blank node': function (isBlank) {
        isBlank('_:x').should.be.true;
      },

      'does not match a URI': function (isBlank) {
        isBlank('http://example.org/').should.be.false;
      },

      'does not match a literal': function (isBlank) {
        isBlank('"http://example.org/"').should.be.false;
      },

      'does not match null': function (isBlank) {
        expect(isBlank(null)).to.be.null;
      },

      'does not match undefined': function (isBlank) {
        expect(isBlank(undefined)).to.be.undefined;
      },
    },

    'getLiteralValue': {
      topic: function (N3Util) { return N3Util.getLiteralValue; },

      'gets the value of a literal': function (getLiteralValue) {
        getLiteralValue('"Mickey"').should.equal('Mickey');
      },

      'gets the value of a literal with a language': function (getLiteralValue) {
        getLiteralValue('"English"@en').should.equal('English');
      },

      'gets the value of a literal with a type': function (getLiteralValue) {
        getLiteralValue('"3"^^<http://www.w3.org/2001/XMLSchema#integer>').should.equal('3');
      },

      'does not work with non-literals': function (getLiteralValue) {
        getLiteralValue.bind(null, 'http://example.org/').should.throw('http://example.org/ is not a literal');
      },

      'does not work with null': function (getLiteralValue) {
        getLiteralValue.bind(null, null).should.throw('null is not a literal');
      },

      'does not work with undefined': function (getLiteralValue) {
        getLiteralValue.bind(null, undefined).should.throw('undefined is not a literal');
      },
    },

    'getLiteralType': {
      topic: function (N3Util) { return N3Util.getLiteralType; },

      'gets the type of a literal': function (getLiteralType) {
        getLiteralType('"Mickey"').should.equal('http://www.w3.org/2001/XMLSchema#string');
      },

      'gets the type of a literal with a language': function (getLiteralType) {
        getLiteralType('"English"@en').should.equal('http://www.w3.org/2001/XMLSchema#string');
      },

      'gets the type of a literal with a type': function (getLiteralType) {
        getLiteralType('"3"^^<http://www.w3.org/2001/XMLSchema#integer>').should.equal('http://www.w3.org/2001/XMLSchema#integer');
      },

      'does not work with non-literals': function (getLiteralType) {
        getLiteralType.bind(null, 'http://example.org/').should.throw('http://example.org/ is not a literal');
      },

      'does not work with null': function (getLiteralType) {
        getLiteralType.bind(null, null).should.throw('null is not a literal');
      },

      'does not work with undefined': function (getLiteralType) {
        getLiteralType.bind(null, undefined).should.throw('undefined is not a literal');
      },
    },

    'getLiteralLanguage': {
      topic: function (N3Util) { return N3Util.getLiteralLanguage; },

      'gets the language of a literal': function (getLiteralLanguage) {
        getLiteralLanguage('"Mickey"').should.equal('');
      },

      'gets the language of a literal with a language': function (getLiteralLanguage) {
        getLiteralLanguage('"English"@en').should.equal('en');
      },

      'normalizes the language to lowercase': function (getLiteralLanguage) {
        getLiteralLanguage('"English"@en-GB').should.equal('en-gb');
      },

      'gets the language of a literal with a type': function (getLiteralLanguage) {
        getLiteralLanguage('"3"^^<http://www.w3.org/2001/XMLSchema#integer>').should.equal('');
      },

      'does not work with non-literals': function (getLiteralLanguage) {
        getLiteralLanguage.bind(null, 'http://example.org/').should.throw('http://example.org/ is not a literal');
      },

      'does not work with null': function (getLiteralLanguage) {
        getLiteralLanguage.bind(null, null).should.throw('null is not a literal');
      },

      'does not work with undefined': function (getLiteralLanguage) {
        getLiteralLanguage.bind(null, undefined).should.throw('undefined is not a literal');
      },
    },

    'isQName': {
      topic: function (N3Util) { return N3Util.isQName; },

      'matches a QName': function (isQName) {
        isQName('ex:Test').should.be.true;
      },

      'does not match a URI': function (isQName) {
        isQName('http://example.org/').should.be.false;
      },

      'does not match a literal': function (isQName) {
        isQName('"http://example.org/"').should.be.false;
      },

      'does not match null': function (isQName) {
        expect(isQName(null)).to.be.null;
      },

      'does not match undefined': function (isQName) {
        expect(isQName(undefined)).to.be.undefined;
      },
    },

    'expandQName': {
      topic: function (N3Util) { return N3Util.expandQName; },

      'expands a QName': function (expandQName) {
        expandQName('ex:Test', { 'ex': 'http://ex.org/#' }).should.equal('http://ex.org/#Test');
      },

      'expands a QName with the empty prefix': function (expandQName) {
        expandQName(':Test', { '': 'http://ex.org/#' }).should.equal('http://ex.org/#Test');
      },

      'does not expand a QName if the prefix is missing': function (expandQName) {
        expandQName.bind(null, 'a:Test', { 'b': 'http://ex.org/#' }).should.throw('Unknown prefix: a');
      },

      'does not work with null': function (expandQName) {
        expandQName.bind(null, null).should.throw('null is not a QName');
      },

      'does not work with undefined': function (expandQName) {
        expandQName.bind(null, undefined).should.throw('undefined is not a QName');
      },
    },
  },
}).export(module);
