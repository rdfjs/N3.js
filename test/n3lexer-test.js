var N3Lexer = require('../lib/n3lexer.js');
var vows = require('vows'),
    should = require('should'),
    events = require('events');

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
                     { type: 'eof', line: 1 }),
    
    'should tokenize a whitespace string':
      shouldTokenize(' \t \n  ',
                     { type: 'eof', line: 2 }),
    
    'should tokenize an explicituri':
      shouldTokenize('<http://ex.org/?bla#foo>',
                     { type: 'explicituri', uri: 'http://ex.org/?bla#foo', line: 1 },
                     { type: 'eof', line: 1 }),
    
    'should tokenize two explicituris separated by whitespace':
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t',
                     { type: 'explicituri', uri: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'explicituri', uri: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'eof', line: 4 }),
    
    'should tokenize a statement with explicituris':
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> .',
                     { type: 'explicituri', uri: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'explicituri', uri: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'explicituri', uri: 'http://ex.org/?bla#boo', line: 4 },
                     { type: 'dot', line: 4 },
                     { type: 'eof', line: 4 }),
    
    'should correctly recognize different types of newlines':
      shouldTokenize('<a>\r<b>\n<c>\r\n.',
                     { type: 'explicituri', uri: 'a', line: 1 },
                     { type: 'explicituri', uri: 'b', line: 2 },
                     { type: 'explicituri', uri: 'c', line: 3 },
                     { type: 'dot', line: 4 },
                     { type: 'eof', line: 4 }),
    
    'should ignore comments':
      shouldTokenize('<#foo> #comment\n <#foo>  #comment \r# comment\n\n<#bla>#',
                     { type: 'explicituri', uri: '#foo', line: 1 },
                     { type: 'explicituri', uri: '#foo', line: 2 },
                     { type: 'explicituri', uri: '#bla', line: 5 },
                     { type: 'eof', line: 5 }),
    
    'should tokenize a quoted string literal':
      shouldTokenize('"string" ',
                     { type: 'literal', quotedValue: '"string"', line: 1 },
                     { type: 'eof', line: 1 }),
    
    'should tokenize a triple quoted string literal':
      shouldTokenize('"""string"""',
                     { type: 'literal', quotedValue: '"string"', line: 1 },
                     { type: 'eof', line: 1 }),
    
    'should tokenize a triple quoted string literal with quotes newlines inside':
      shouldTokenize('"""st"r\ni""ng"""',
                     { type: 'literal', quotedValue: '"st"r\ni""ng"', line: 1 },
                     { type: 'eof', line: 2 }),
    
    'should tokenize a string with escape characters':
      shouldTokenize('"\\\\ \\\' \\" \\n \\r \\t \\ua1b2" \n """\\\\ \\\' \\" \\n \\r \\t \\ua1b2"""',
                     { type: 'literal', quotedValue: '"\\ \' " \n \r \t \ua1b2"', line: 1 },
                     { type: 'literal', quotedValue: '"\\ \' " \n \r \t \ua1b2"', line: 2 },
                     { type: 'eof', line: 2 }),
    
    'should tokenize a quoted string literal with language code':
      shouldTokenize('"string"@en "string"@nl-be ',
                     { type: 'literal', quotedValue: '"string"', line: 1 },
                     { type: 'langcode', language: 'en', line: 1 },
                     { type: 'literal', quotedValue: '"string"', line: 1 },
                     { type: 'langcode', language: 'nl-be', line: 1 },
                     { type: 'eof', line: 1 }),
    
    'should tokenize a stream':
      shouldTokenize(streamOf('<a>\n<b', '> ', '"""', 'c\n', '"""', '.',
                              '<d> <e', '> ', '""', '.',
                              '<g> <h> "i"', '@e', 'n.'),
                     { type: 'explicituri', uri: 'a', line: 1 },
                     { type: 'explicituri', uri: 'b', line: 2 },
                     { type: 'literal', quotedValue: '"c\n"', line: 2 },
                     { type: 'dot', line: 3 },
                     { type: 'explicituri', uri: 'd', line: 3 },
                     { type: 'explicituri', uri: 'e', line: 3 },
                     { type: 'literal', quotedValue: '""', line: 3 },
                     { type: 'dot', line: 3 },
                     { type: 'explicituri', uri: 'g', line: 3 },
                     { type: 'explicituri', uri: 'h', line: 3 },
                     { type: 'literal', quotedValue: '"i"', line: 3 },
                     { type: 'langcode', language: 'en', line: 3 },
                     { type: 'dot', line: 3 },
                     { type: 'eof', line: 3 }),
    
    'should tokenize prefix declarations':
      shouldTokenize('@prefix abc: <http://uri.org/#>.',
                     { type: '@prefix', line: 1 },
                     { type: 'prefix', prefix: 'abc', line: 1 },
                     { type: 'explicituri', uri: 'http://uri.org/#', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'eof', line: 1 }),
    
    'should not tokenize an invalid document':
      shouldNotTokenize(' \n @!', 'Syntax error: unexpected "@!" on line 2.')
  }
}).export(module);

function shouldTokenize(input, expected) {
  var result = [],
      endCallback;
  expected = Array.prototype.slice.call(arguments, 1);
  
  function tokenCallback(error, token) {
    should.not.exist(error);
    should.exist(token);
    result.push(token);
    if (token.type === 'eof')
      endCallback(null, result);
  }
  
  return {
    topic: function () {
      endCallback = this.callback;
      new N3Lexer().tokenize(input, tokenCallback);
    },
    
    'should equal the expected value': function (result) {
      result.should.eql(expected);
    }
  };
}

function shouldNotTokenize(input, expectedError) {
  var endCallback;
  
  function tokenCallback(error, token) {
    if (error)
      endCallback(error, token);
    else if (token.type === 'eof')
      throw "Expected error " + expectedError;
  }
  
  return {
    topic: function () {
      endCallback = this.callback;
      new N3Lexer().tokenize(input, tokenCallback);
    },
    
    'should equal the expected message': function (error, token) {
      should.not.exist(token);
      error.should.eql(expectedError);
    }
  };
}

function streamOf() {
  var elements = Array.prototype.slice.call(arguments),
      stream = new events.EventEmitter();
  
  stream.setEncoding = function (encoding) {
    if (encoding === 'utf8')
      process.nextTick(next);
  };
  
  function next() {
    if (elements.length) {
      stream.emit('data', elements.shift());
      process.nextTick(next);
    }
    else {
      stream.emit('end');
    }
  }
  
  return stream;
}
