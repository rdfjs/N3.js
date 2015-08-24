var N3Lexer = require('../N3').Lexer;
var chai = require('chai'),
    events = require('events');
var expect = chai.expect;
chai.should();

describe('N3Lexer', function () {
  describe('The N3Lexer module', function () {
    it('should be a function', function () {
      N3Lexer.should.be.a('function');
    });

    it('should make N3Lexer objects', function () {
      N3Lexer().should.be.an.instanceof(N3Lexer);
    });

    it('should be an N3Lexer constructor', function () {
      new N3Lexer().should.be.an.instanceof(N3Lexer);
    });

    it('should provide a shim for setImmediate', function (done) {
      // Delete global setImmediate
      var setImmediate = global.setImmediate;
      global.setImmediate = null;
      // Clear require cache
      for (var key in require.cache)
        delete require.cache[key];
      // N3Lexer must now fall back to shim
      var N3LexerWithShim = require('../N3').Lexer;
      new N3LexerWithShim().tokenize('', done);
      // Restore global setImmediate
      global.setImmediate = setImmediate;
    });
  });

  describe('An N3Lexer instance', function () {
    it('should tokenize the empty string',
      shouldTokenize('',
                     { type: 'eof', line: 1 }));

    it('should tokenize a whitespace string',
      shouldTokenize(' \t \n  ',
                     { type: 'eof', line: 2 }));

    it('should tokenize an IRI',
      shouldTokenize('<http://ex.org/?bla#foo>',
                     { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize an IRI with disallowed characters',
      shouldNotTokenize('<http://ex.org/bla"foo>',
                        'Syntax error: unexpected "<http://ex.org/bla"foo>" on line 1.'));

    it('should not tokenize an IRI with escaped characters',
      shouldNotTokenize('<http://ex.org/bla\\"foo>',
                        'Syntax error: unexpected "<http://ex.org/bla\\"foo>" on line 1.'));

    it('should not tokenize an IRI with disallowed escaped characters',
      shouldNotTokenize('<http://ex.org/bla\\u0020foo>',
                        'Syntax error: unexpected "<http://ex.org/bla\\u0020foo>" on line 1.'));

    it('should not tokenize an IRI with invalid 4-digit unicode escapes',
      shouldNotTokenize('<http://ex.org/bla\\uXYZZfoo>',
                        'Syntax error: unexpected "<http://ex.org/bla\\uXYZZfoo>" on line 1.'));

    it('should not tokenize an IRI with invalid 8-digit unicode escapes',
      shouldNotTokenize('<http://ex.org/bla\\uXYZZxyzzfoo>',
                        'Syntax error: unexpected "<http://ex.org/bla\\uXYZZxyzzfoo>" on line 1.'));

    it('should not tokenize an IRI with a non-numeric 4-digit unicode escapes', function (done) {
      // Replace global isNaN
      var isNaN = global.isNaN;
      global.isNaN = function () { return true; };
      // Try parsing
      var lexer = new N3Lexer();
      lexer.tokenize(function (error, token) {
        error.should.be.an.instanceof(Error);
        error.message.should.equal('Syntax error: unexpected "<\\u1234>" on line 1.');
        done(token);
      });
      lexer.addChunk('<\\u1234>');
      // Restore global isNaN
      global.isNaN = isNaN;
    });

    it('should not tokenize an IRI with a non-numeric 8-digit unicode escapes', function (done) {
      // Replace global isNaN
      var isNaN = global.isNaN;
      global.isNaN = function () { return true; };
      // Try parsing
      var lexer = new N3Lexer();
      lexer.tokenize(function (error, token) {
        error.should.be.an.instanceof(Error);
        error.message.should.equal('Syntax error: unexpected "<\\U12345678>" on line 1.');
        done(token);
      });
      lexer.addChunk('<\\U12345678>');
      // Restore global isNaN
      global.isNaN = isNaN;
    });

    it('should tokenize an IRI with four-digit unicode escapes',
      shouldTokenize('<http://a.example/\\u0073>',
                     { type: 'IRI', value: 'http://a.example/s', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize an IRI with eight-digit unicode escapes',
      shouldTokenize('<http://a.example/\\U00000073\\U00A00073>',
                     { type: 'IRI', value: 'http://a.example/s\uffc0\udc73', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not decode an IRI',
      shouldTokenize('<http://a.example/%66oo-bar>',
                     { type: 'IRI', value: 'http://a.example/%66oo-bar', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize two IRIs separated by whitespace',
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t',
                     { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'eof', line: 4 }));

    it('should tokenize a statement with IRIs',
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> .',
                     { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 4 },
                     { type: '.', line: 4 },
                     { type: 'eof', line: 4 }));

    it('should tokenize prefixed names',
      shouldTokenize(':a b:c d-dd:e-ee.',
                     { type: 'prefixed', prefix: '',      value: 'a',    line: 1 },
                     { type: 'prefixed', prefix: 'b',     value: 'c',    line: 1 },
                     { type: 'prefixed', prefix: 'd-dd',  value: 'e-ee', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize prefixed names with leading digits',
      shouldTokenize('leg:3032571 isbn13:9780136019701 ',
                     { type: 'prefixed', prefix: 'leg',    value: '3032571',       line: 1 },
                     { type: 'prefixed', prefix: 'isbn13', value: '9780136019701', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize prefixed names with non-leading colons',
      shouldTokenize('og:video:height ',
                     { type: 'prefixed', prefix: 'og', value: 'video:height', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize prefixed names with reserved escape sequences',
      shouldTokenize('wgs:lat\\-long ',
                     { type: 'prefixed', prefix: 'wgs', value: 'lat-long', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize the colon prefixed name',
      shouldTokenize(': : :.',
                     { type: 'prefixed', prefix: '', value: '', line: 1 },
                     { type: 'prefixed', prefix: '', value: '', line: 1 },
                     { type: 'prefixed', prefix: '', value: '', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a prefixed name with a dot, split in half while streaming',
      shouldTokenize(streamOf('dbpedia:Anthony_J._Batt', 'aglia '),
                     { type: 'prefixed', prefix: 'dbpedia', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a prefixed name with a dot, split after the dot while streaming',
      shouldTokenize(streamOf('dbpedia:Anthony_J.', '_Battaglia '),
                     { type: 'prefixed', prefix: 'dbpedia', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not decode a prefixed name',
      shouldTokenize('ex:%66oo-bar ',
                     { type: 'prefixed', prefix: 'ex', value: '%66oo-bar', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize a prefixed name with disallowed characters',
      shouldNotTokenize('ex:bla"foo',
                        'Syntax error: unexpected ""foo" on line 1.'));

    it('should not tokenize a prefixed name with escaped characters',
      shouldNotTokenize('ex:bla\\"foo',
                        'Syntax error: unexpected "ex:bla\\"foo" on line 1.'));

    it('should not tokenize a prefixed name with disallowed escaped characters',
      shouldNotTokenize('ex:bla\\u0020foo',
                        'Syntax error: unexpected "ex:bla\\u0020foo" on line 1.'));

    it('should not tokenize a prefixed name with invalid 4-digit unicode escapes',
      shouldNotTokenize('ex:bla\\uXYZZfoo',
                        'Syntax error: unexpected "ex:bla\\uXYZZfoo" on line 1.'));

    it('should not tokenize a prefixed name with invalid 8-digit unicode escapes',
      shouldNotTokenize('ex:bla\\uXYZZxyzzfoo',
                        'Syntax error: unexpected "ex:bla\\uXYZZxyzzfoo" on line 1.'));

    it('should not tokenize a prefixed name with four-digit unicode escapes',
      shouldNotTokenize('ex:foo\\u0073bar',
                        'Syntax error: unexpected "ex:foo\\u0073bar" on line 1.'));

    it('should not tokenize a prefixed name with eight-digit unicode escapes',
      shouldNotTokenize('ex:foo\\U00000073\\U00A00073bar',
                        'Syntax error: unexpected "ex:foo\\U00000073\\U00A00073bar" on line 1.'));

    it('should tokenize two prefixed names separated by whitespace',
      shouldTokenize(' \n\tex:foo \n\tex:bar \n\t',
                     { type: 'prefixed', prefix: 'ex', value: 'foo', line: 2 },
                     { type: 'prefixed', prefix: 'ex', value: 'bar', line: 3 },
                     { type: 'eof', line: 4 }));

    it('should tokenize a statement with prefixed names',
      shouldTokenize(' \n\tex:foo \n\tex:bar \n\tex:baz .',
                     { type: 'prefixed', prefix: 'ex', value: 'foo', line: 2 },
                     { type: 'prefixed', prefix: 'ex', value: 'bar', line: 3 },
                     { type: 'prefixed', prefix: 'ex', value: 'baz', line: 4 },
                     { type: '.', line: 4 },
                     { type: 'eof', line: 4 }));

    it('should correctly recognize different types of newlines',
      shouldTokenize('<a>\r<b>\n<c>\r\n.',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 2 },
                     { type: 'IRI', value: 'c', line: 3 },
                     { type: '.', line: 4 },
                     { type: 'eof', line: 4 }));

    it('should tokenize a single comment',
      shouldTokenize(streamOf('#comment'),
                     { type: 'eof', line: 1 }));

    it('should ignore comments',
      shouldTokenize('<#foo> #comment\n <#foo>  #comment \r# comment\n\n<#bla>#',
                     { type: 'IRI', value: '#foo', line: 1 },
                     { type: 'IRI', value: '#foo', line: 2 },
                     { type: 'IRI', value: '#bla', line: 5 },
                     { type: 'eof', line: 5 }));

    it('should tokenize a quoted string literal',
      shouldTokenize('"string" ',
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a triple quoted string literal',
      shouldTokenize('"""string"""',
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a triple quoted string literal with quotes newlines inside',
      shouldTokenize('"""st"r\ni""ng"""',
                     { type: 'literal', value: '"st"r\ni""ng"', line: 1 },
                     { type: 'eof', line: 2 }));

    it('should tokenize a string with escape characters',
      shouldTokenize('"\\\\ \\\' \\" \\n \\r \\t \\ua1b2" \n """\\\\ \\\' \\" \\n \\r \\t \\U0000a1b2"""',
                     { type: 'literal', value: '"\\ \' " \n \r \t \ua1b2"', line: 1 },
                     { type: 'literal', value: '"\\ \' " \n \r \t \ua1b2"', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should not tokenize a string with invalid characters',
      shouldNotTokenize('"\\uXYZX" ',
                        'Syntax error: unexpected ""\\uXYZX"" on line 1.'));

    it('should not tokenize a triple-quoted string with invalid characters',
      shouldNotTokenize('"""\\uXYZX""" ',
                        'Syntax error: unexpected """"\\uXYZX"""" on line 1.'));

    it('should tokenize a quoted string literal with language code',
      shouldTokenize('"string"@en "string"@nl-be "string"@EN ',
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'langcode', value: 'en', line: 1 },
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'langcode', value: 'nl-be', line: 1 },
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'langcode', value: 'EN', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a quoted string literal with type',
      shouldTokenize('"stringA"^^<type> "stringB"^^ns:mytype ',
                     { type: 'literal', value: '"stringA"', line: 1 },
                     { type: 'type', value: 'type', line: 1 },
                     { type: 'literal', value: '"stringB"', line: 1 },
                     { type: 'type', value: 'mytype', prefix: 'ns', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize a quoted string literal with incorrect type',
      shouldNotTokenize('"stringA"^<type> "stringB"^^ns:mytype ',
                        'Syntax error: unexpected "^<type>" on line 1.'));

    it('should not tokenize a single hat',
      shouldNotTokenize('^',
                        'Syntax error: unexpected "^" on line 1.'));

    it('should not tokenize a double hat followed by a non-IRI',
      shouldNotTokenize('^^1',
                        'Syntax error: unexpected "1" on line 1.'));

    it('should tokenize a single-quoted string literal',
      shouldTokenize("'string' ",
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a triple single-quoted string literal',
      shouldTokenize("'''string'''",
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a triple single-quoted string literal with quotes newlines inside',
      shouldTokenize("'''st'r\ni''ng'''",
                     { type: 'literal', value: '"st\'r\ni\'\'ng"', line: 1 },
                     { type: 'eof', line: 2 }));

    it('should tokenize a single-quoted string with escape characters',
      shouldTokenize("'\\\\ \\\" \\' \\n \\r \\t \\ua1b2' \n '''\\\\ \\\" \\' \\n \\r \\t \\U0020a1b2'''",
                     { type: 'literal', value: '"\\ " \' \n \r \t \ua1b2"', line: 1 },
                     { type: 'literal', value: '"\\ " \' \n \r \t \udfe8\uddb2"', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize a single-quoted string literal with language code',
      shouldTokenize("'string'@en 'string'@nl-be 'string'@EN ",
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'langcode', value: 'en', line: 1 },
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'langcode', value: 'nl-be', line: 1 },
                     { type: 'literal', value: '"string"', line: 1 },
                     { type: 'langcode', value: 'EN', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a single-quoted string literal with type',
      shouldTokenize("'stringA'^^<type> 'stringB'^^ns:mytype ",
                     { type: 'literal', value: '"stringA"', line: 1 },
                     { type: 'type', value: 'type', line: 1 },
                     { type: 'literal', value: '"stringB"', line: 1 },
                     { type: 'type', value: 'mytype', prefix: 'ns', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize an integer literal',
      shouldTokenize('10, +20. -30, 40. ',
                     { type: 'literal', value: '"10"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value: '"+20"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: '"-30"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value: '"40"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a decimal literal',
      shouldTokenize('1. 2.0, .3. -0.4, -.5. ',
                     { type: 'literal', value: '"1"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: '"2.0"^^http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value: '".3"^^http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: '"-0.4"^^http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value: '"-.5"^^http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a double literal',
      shouldTokenize('10e20, +30.40E+50. -60.70e-80. ',
                     { type: 'literal', value: '"10e20"^^http://www.w3.org/2001/XMLSchema#double', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value: '"+30.40E+50"^^http://www.w3.org/2001/XMLSchema#double', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: '"-60.70e-80"^^http://www.w3.org/2001/XMLSchema#double', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize an invalid number',
      shouldNotTokenize('10-10 ',
                        'Syntax error: unexpected "10-10" on line 1.'));

    it('should tokenize booleans',
      shouldTokenize('true false ',
                     { type: 'literal', value: '"true"^^http://www.w3.org/2001/XMLSchema#boolean', line: 1 },
                     { type: 'literal', value: '"false"^^http://www.w3.org/2001/XMLSchema#boolean', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize statements with shared subjects',
      shouldTokenize('<a> <b> <c>;\n<d> <e>.',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'IRI', value: 'c', line: 1 },
                     { type: ';', line: 1 },
                     { type: 'IRI', value: 'd', line: 2 },
                     { type: 'IRI', value: 'e', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize statements with shared subjects and predicates',
      shouldTokenize('<a> <b> <c>,\n<d>.',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'IRI', value: 'c', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'IRI', value: 'd', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize statements with shared subjects and predicates and prefixed names',
      shouldTokenize('a:a b:b c:c;d:d e:e,f:f.',
                     { type: 'prefixed', prefix: 'a', value: 'a', line: 1 },
                     { type: 'prefixed', prefix: 'b', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'c', line: 1 },
                     { type: ';', line: 1 },
                     { type: 'prefixed', prefix: 'd', value: 'd', line: 1 },
                     { type: 'prefixed', prefix: 'e', value: 'e', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'prefixed', prefix: 'f', value: 'f', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a stream',
      shouldTokenize(streamOf('<a>\n<b', '> ', '"""', 'c\n', '"""', '.',
                              '<d> <e', '> ', '""', '.',
                              '<g> <h> "i"', '@e', 'n.'),
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 2 },
                     { type: 'literal', value: '"c\n"', line: 2 },
                     { type: '.', line: 3 },
                     { type: 'IRI', value: 'd', line: 3 },
                     { type: 'IRI', value: 'e', line: 3 },
                     { type: 'literal', value: '""', line: 3 },
                     { type: '.', line: 3 },
                     { type: 'IRI', value: 'g', line: 3 },
                     { type: 'IRI', value: 'h', line: 3 },
                     { type: 'literal', value: '"i"', line: 3 },
                     { type: 'langcode', value: 'en', line: 3 },
                     { type: '.', line: 3 },
                     { type: 'eof', line: 3 }));

    it('should tokenize a stream with split number',
      shouldTokenize(streamOf('.', '1 '),
                     { type: 'literal', value: '".1"^^http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a stream with split comment',
      shouldTokenize(streamOf('#com', 'ment'),
                     { type: 'eof', line: 1 }));

    it('should immediately signal an error if a linebreak occurs anywhere outside a triple-quoted literal',
      shouldNotTokenize(streamOf('abc\n', null), 'Syntax error: unexpected "abc" on line 1.'));

    it('should immediately signal an error if a linebreak occurs inside a single-quoted literal',
      shouldNotTokenize(streamOf('"abc\n', null), 'Syntax error: unexpected ""abc" on line 1.'));

    it('should immediately signal an error if a carriage return occurs anywhere outside a triple-quoted literal',
      shouldNotTokenize(streamOf('abc\r', null), 'Syntax error: unexpected "abc" on line 1.'));

    it('should immediately signal an error if a carriage return occurs inside a single-quoted literal',
      shouldNotTokenize(streamOf('"abc\r', null), 'Syntax error: unexpected ""abc" on line 1.'));

    it('should tokenize a split triple-quoted string',
      shouldTokenize(streamOf('"""abc\n', 'def"""'),
                     { type: 'literal', value: '"abc\ndef"', line: 1 },
                     { type: 'eof', line: 2 }));

    it('should tokenize @prefix declarations',
      shouldTokenize('@prefix : <http://iri.org/#>.\n@prefix abc:<http://iri.org/#>.',
                     { type: '@prefix', line: 1 },
                     { type: 'prefix', value: '', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: '.', line: 1 },
                     { type: '@prefix', line: 2 },
                     { type: 'prefix', value: 'abc', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should not tokenize prefixes that end with a dot',
      shouldNotTokenize('@prefix abc.: <def>.',
                        'Syntax error: unexpected "abc.:" on line 1.'));

    it('should tokenize @base declarations',
      shouldTokenize('@base <http://iri.org/#>.\n@base <http://iri.org/#>.',
                     { type: '@base', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: '.', line: 1 },
                     { type: '@base', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize PREFIX declarations',
      shouldTokenize('PREFIX : <http://iri.org/#>\npreFiX abc: <http://iri.org/#>',
                     { type: 'PREFIX', line: 1 },
                     { type: 'prefix', value: '', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: 'PREFIX', line: 2 },
                     { type: 'prefix', value: 'abc', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize BASE declarations',
      shouldTokenize('BASE <http://iri.org/#>\nbAsE <http://iri.org/#>',
                     { type: 'BASE', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: 'BASE', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize blank nodes',
      shouldTokenize('[] [<a> <b>] [a:b "c"^^d:e][a:b[]] _:a:b.',
                     { type: '[', line: 1 },
                     { type: ']', line: 1 },
                     { type: '[', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: ']', line: 1 },
                     { type: '[', line: 1 },
                     { type: 'prefixed', prefix: 'a', value: 'b', line: 1 },
                     { type: 'literal', value: '"c"', line: 1 },
                     { type: 'type', prefix: 'd', value: 'e', line: 1 },
                     { type: ']', line: 1 },
                     { type: '[', line: 1 },
                     { type: 'prefixed', prefix: 'a', value: 'b', line: 1 },
                     { type: '[', line: 1 },
                     { type: ']', line: 1 },
                     { type: ']', line: 1 },
                     { type: 'prefixed', prefix: '_', value: 'a', line: 1 },
                     { type: 'prefixed', prefix: '',  value: 'b', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize invalid blank nodes',
      shouldNotTokenize('_::',
                        'Syntax error: unexpected "_::" on line 1.'));

    it('should tokenize lists',
      shouldTokenize('() (<a>) (<a> <b>)',
                     { type: '(', line: 1 },
                     { type: ')', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: ')', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: ')', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize mixed lists',
      shouldTokenize('<a> <b> (1 "2" :o)(1()(1))',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'literal', value: '"1"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: 'literal', value: '"2"', line: 1 },
                     { type: 'prefixed', value: 'o', line: 1 },
                     { type: ')', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'literal', value: '"1"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: '(', line: 1 },
                     { type: ')', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'literal', value: '"1"^^http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: ')', line: 1 },
                     { type: ')', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize the "a" predicate',
      shouldTokenize('<x> a <y>.',
                     { type: 'IRI', value: 'x', line: 1 },
                     { type: 'abbreviation', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', line: 1 },
                     { type: 'IRI', value: 'y', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize an empty default graph',
      shouldTokenize('{}',
                     { type: '{', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a non-empty default graph',
      shouldTokenize('{<a> <b> c:d}',
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize an empty graph identified by an IRI',
      shouldTokenize('<g>{}',
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a non-empty graph identified by an IRI',
      shouldTokenize('<g> {<a> <b> c:d}',
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize an empty graph identified by a blank node',
      shouldTokenize('_:g{}',
                     { type: 'prefixed', prefix: '_', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a non-empty graph identified by a blank node',
      shouldTokenize('_:g {<a> <b> c:d}',
                     { type: 'prefixed', prefix: '_', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize an empty graph with the GRAPH keyword',
      shouldTokenize('GRAPH<g>{}',
                     { type: 'GRAPH', line: 1 },
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a non-empty graph with the GRAPH keyword',
      shouldTokenize('graph <g> {<a> <b> c:d}',
                     { type: 'GRAPH', line: 1 },
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize an invalid document',
      shouldNotTokenize(' \n @!', 'Syntax error: unexpected "@!" on line 2.'));

    it('does not call setEncoding if not available', function () {
      new N3Lexer().tokenize({ on: function () {} });
    });

    describe('using the addChunk/end interface', function () {
      var tokens = [], lexer = new N3Lexer();
      lexer.tokenize(function (error, token) { !error && tokens.push(token); });
      lexer.addChunk('<a> ');
      lexer.addChunk('<b> ');
      lexer.addChunk('<c>.');
      lexer.end();

      it('parses all chunks', function () {
        tokens.should.have.length(5);
      });
    });

    describe('passing data after the stream has been finished', function () {
      var tokens = [], lexer = new N3Lexer();
      lexer.tokenize(function (error, token) { !error && tokens.push(token); });
      lexer.addChunk('<a> ');
      lexer.end();
      lexer.addChunk('<b> ');
      lexer.end();

      it('parses only the first chunk (plus EOF)', function () {
        tokens.should.have.length(2);
      });
    });

    describe('passing data after an error has occured', function () {
      var tokens = [], lexer = new N3Lexer();
      lexer.tokenize(function (error, token) { !error && tokens.push(token); });
      lexer.addChunk('<a> ');
      lexer.addChunk('error ');
      lexer.end();
      lexer.addChunk('<b> ');

      it('parses only the first chunk', function () {
        tokens.should.have.length(1);
      });
    });
  });
});

function shouldTokenize(input) {
  var expected = Array.prototype.slice.call(arguments, 1);
  return function (done) {
    var result = [];
    new N3Lexer().tokenize(input, tokenCallback);

    function tokenCallback(error, token) {
      expect(error).not.to.exist;
      expect(token).to.exist;
      var expectedItem = expected[result.length];
      if (expectedItem)
        for (var attribute in token)
          if (token[attribute] === '' && expectedItem[attribute] !== '')
            delete token[attribute];
      result.push(token);
      if (token.type === 'eof') {
        result.should.eql(expected);
        done(null, result);
      }
    }
  };
}

function shouldNotTokenize(input, expectedError) {
  return function (done) {
    new N3Lexer().tokenize(input, tokenCallback);
    function tokenCallback(error, token) {
      if (error) {
        expect(token).not.to.exist;
        error.should.be.an.instanceof(Error);
        error.message.should.eql(expectedError);
        error.should.be.an.instanceof(Error);
        done();
      }
      else if (token.type === 'eof')
        throw new Error('Expected error ' + expectedError);
    }
  };
}

var immediately = typeof setImmediate === 'function' ? setImmediate :
                  function setImmediate(func) { setTimeout(func, 0); };

function streamOf() {
  var elements = Array.prototype.slice.call(arguments),
      stream = new events.EventEmitter();

  stream.setEncoding = function (encoding) {
    if (encoding === 'utf8')
      immediately(next, 0);
  };

  function next() {
    if (elements.length) {
      var element = elements.shift();
      // use "null" to stall the stream
      if (element !== null) {
        stream.emit('data', element);
        immediately(next, 0);
      }
    }
    else {
      stream.emit('end');
    }
  }
  return stream;
}
