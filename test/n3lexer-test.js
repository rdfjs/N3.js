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
    
    'should tokenize the empty string':
      shouldTokenize('',
                     [{ type: 'eof' }]),
    
    'should tokenize a whitespace string':
      shouldTokenize(' \t \n  ',
                     [{ type: 'eof' }]),
    
    'should tokenize an explicituri':
      shouldTokenize('<http://ex.org/?bla#foo>',
                     [{ type: 'explicituri', uri: 'http://ex.org/?bla#foo'},
                      { type: 'eof' }]),
    
    'should tokenize two explicituris separated by whitespace':
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t',
                     [{ type: 'explicituri', uri: 'http://ex.org/?bla#foo'},
                      { type: 'explicituri', uri: 'http://ex.org/?bla#bar'},
                      { type: 'eof' }]),
    
    'should tokenize a statement with explicituris':
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> .',
                     [{ type: 'explicituri', uri: 'http://ex.org/?bla#foo'},
                      { type: 'explicituri', uri: 'http://ex.org/?bla#bar'},
                      { type: 'explicituri', uri: 'http://ex.org/?bla#boo'},
                      { type: 'dot' },
                      { type: 'eof' }]),
    
    'should not tokenize an invalid document':
      shouldNotTokenize(' \n @!', 'Unexpected "@!" on line 2.')
  }
}).export(module);

function shouldTokenize(input, expected) {
  return function (n3lexer) {
    n3lexer.tokenize(input).all().should.eql(expected);
  };
}

function shouldNotTokenize(input, expectedError) {
  return function (n3lexer) {
    (function () {
      n3lexer.tokenize(input).all();
    }).should.throw(expectedError);
  };
}
