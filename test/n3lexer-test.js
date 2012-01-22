var N3Lexer = require('../lib/n3lexer.js');
var vows = require('vows'),
    should = require('should'),
    util = require('util');

vows.describe('N3Lexer').addBatch({
  'The N3Lexer module': {
    topic: function () { return N3Lexer; },
    
    'should be a function': function (N3Lexer) {
      N3Lexer.should.be.a('function');
    },
    
    'should make N3Lexer objects': function (N3Lexer) {
      N3Lexer().constructor.should.eql(N3Lexer);
      N3Lexer().should.be.an.instanceof(N3Lexer);
    },
    
    'should be an N3Lexer constructor': function (N3Lexer) {
      new N3Lexer().constructor.should.eql(N3Lexer);
      new N3Lexer().should.be.an.instanceof(N3Lexer);
    },
  },
  
  'An N3Lexer instance': {
    topic: new N3Lexer(),
    
    'should tokenize the empty string': shouldTokenize('', []),
    
    'should tokenize a whitespace string': shouldTokenize(' \t \n  ', []),
  }
}).export(module);

function shouldTokenize(input, expected) {
  return function (n3lexer) {
    n3lexer.tokenize(input).should.eql(expected);
  };
}
