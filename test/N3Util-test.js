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
        isLiteral('"3"^^xsd:integer').should.be.true;
      },

      'does not match a URI': function (isLiteral) {
        isLiteral('http://example.org/').should.be.false;
      },

      'does not match null': function (isLiteral) {
        expect(isLiteral(null)).to.be.null;
      },

      'does not match undefined': function (isLiteral) {
        expect(isLiteral(undefined)).to.be.undefined;
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
