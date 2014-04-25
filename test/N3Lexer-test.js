var N3Lexer = require('../N3').Lexer;
var chai = require('chai'),
    expect = chai.expect,
    events = require('events');
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

    it('should tokenize an explicituri',
      shouldTokenize('<http://ex.org/?bla#foo>',
                     { type: 'explicituri', value: 'http://ex.org/?bla#foo', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize an IRI with invalid characters',
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

    it('should tokenize an explicituri with four-digit unicode escapes',
      shouldTokenize('<http://a.example/\\u0073>',
                     { type: 'explicituri', value: 'http://a.example/s', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize an explicituri with eight-digit unicode escapes',
      shouldTokenize('<http://a.example/\\U00000073>',
                     { type: 'explicituri', value: 'http://a.example/s', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize two explicituris separated by whitespace',
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t',
                     { type: 'explicituri', value: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'explicituri', value: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'eof', line: 4 }));

    it('should tokenize a statement with explicituris',
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> .',
                     { type: 'explicituri', value: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'explicituri', value: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'explicituri', value: 'http://ex.org/?bla#boo', line: 4 },
                     { type: 'dot', line: 4 },
                     { type: 'eof', line: 4 }));

    it('should correctly recognize different types of newlines',
      shouldTokenize('<a>\r<b>\n<c>\r\n.',
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'explicituri', value: 'b', line: 2 },
                     { type: 'explicituri', value: 'c', line: 3 },
                     { type: 'dot', line: 4 },
                     { type: 'eof', line: 4 }));

    it('should tokenize a single comment',
      shouldTokenize(streamOf('#comment'),
                     { type: 'eof', line: 1 }));

    it('should ignore comments',
      shouldTokenize('<#foo> #comment\n <#foo>  #comment \r# comment\n\n<#bla>#',
                     { type: 'explicituri', value: '#foo', line: 1 },
                     { type: 'explicituri', value: '#foo', line: 2 },
                     { type: 'explicituri', value: '#bla', line: 5 },
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
                     { type: 'literal', value: '"10"^^<http://www.w3.org/2001/XMLSchema#integer>', line: 1 },
                     { type: 'comma', line: 1 },
                     { type: 'literal', value: '"+20"^^<http://www.w3.org/2001/XMLSchema#integer>', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'literal', value: '"-30"^^<http://www.w3.org/2001/XMLSchema#integer>', line: 1 },
                     { type: 'comma', line: 1 },
                     { type: 'literal', value: '"40"^^<http://www.w3.org/2001/XMLSchema#integer>', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a decimal literal',
      shouldTokenize('1. 2.0, .3. -0.4, -.5. ',
                     { type: 'literal', value: '"1"^^<http://www.w3.org/2001/XMLSchema#integer>', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'literal', value: '"2.0"^^<http://www.w3.org/2001/XMLSchema#decimal>', line: 1 },
                     { type: 'comma', line: 1 },
                     { type: 'literal', value: '".3"^^<http://www.w3.org/2001/XMLSchema#decimal>', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'literal', value: '"-0.4"^^<http://www.w3.org/2001/XMLSchema#decimal>', line: 1 },
                     { type: 'comma', line: 1 },
                     { type: 'literal', value: '"-.5"^^<http://www.w3.org/2001/XMLSchema#decimal>', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a double literal',
      shouldTokenize('10e20, +30.40E+50. -60.70e-80. ',
                     { type: 'literal', value: '"10e20"^^<http://www.w3.org/2001/XMLSchema#double>', line: 1 },
                     { type: 'comma', line: 1},
                     { type: 'literal', value: '"+30.40E+50"^^<http://www.w3.org/2001/XMLSchema#double>', line: 1 },
                     { type: 'dot', line: 1},
                     { type: 'literal', value: '"-60.70e-80"^^<http://www.w3.org/2001/XMLSchema#double>', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should not tokenize an invalid number',
      shouldNotTokenize('10-10 ',
                        'Syntax error: unexpected "10-10" on line 1.'));

    it('should tokenize booleans',
      shouldTokenize('true false ',
                     { type: 'literal', value: '"true"^^<http://www.w3.org/2001/XMLSchema#boolean>', line: 1 },
                     { type: 'literal', value: '"false"^^<http://www.w3.org/2001/XMLSchema#boolean>', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize statements with shared subjects',
      shouldTokenize('<a> <b> <c>;\n<d> <e>.',
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'explicituri', value: 'b', line: 1 },
                     { type: 'explicituri', value: 'c', line: 1 },
                     { type: 'semicolon', line: 1 },
                     { type: 'explicituri', value: 'd', line: 2 },
                     { type: 'explicituri', value: 'e', line: 2 },
                     { type: 'dot', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize statements with shared subjects and predicates',
      shouldTokenize('<a> <b> <c>,\n<d>.',
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'explicituri', value: 'b', line: 1 },
                     { type: 'explicituri', value: 'c', line: 1 },
                     { type: 'comma', line: 1 },
                     { type: 'explicituri', value: 'd', line: 2 },
                     { type: 'dot', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize statements with shared subjects and predicates and qnames',
      shouldTokenize('a:a b:b c:c;d:d e:e,f:f.',
                     { type: 'qname', prefix: 'a', value: 'a', line: 1 },
                     { type: 'qname', prefix: 'b', value: 'b', line: 1 },
                     { type: 'qname', prefix: 'c', value: 'c', line: 1 },
                     { type: 'semicolon', line: 1 },
                     { type: 'qname', prefix: 'd', value: 'd', line: 1 },
                     { type: 'qname', prefix: 'e', value: 'e', line: 1 },
                     { type: 'comma', line: 1 },
                     { type: 'qname', prefix: 'f', value: 'f', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize the colon qname',
      shouldTokenize(': : :.',
                     { type: 'qname', prefix: '', value: '', line: 1 },
                     { type: 'qname', prefix: '', value: '', line: 1 },
                     { type: 'qname', prefix: '', value: '', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a qname with a dot, split in half while streaming',
      shouldTokenize(streamOf('dbpedia:Anthony_J._Batt', 'aglia '),
                     { type: 'qname', prefix: 'dbpedia', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a qname with a dot, split after the dot while streaming',
      shouldTokenize(streamOf('dbpedia:Anthony_J.', '_Battaglia '),
                     { type: 'qname', prefix: 'dbpedia', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize a stream',
      shouldTokenize(streamOf('<a>\n<b', '> ', '"""', 'c\n', '"""', '.',
                              '<d> <e', '> ', '""', '.',
                              '<g> <h> "i"', '@e', 'n.'),
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'explicituri', value: 'b', line: 2 },
                     { type: 'literal', value: '"c\n"', line: 2 },
                     { type: 'dot', line: 3 },
                     { type: 'explicituri', value: 'd', line: 3 },
                     { type: 'explicituri', value: 'e', line: 3 },
                     { type: 'literal', value: '""', line: 3 },
                     { type: 'dot', line: 3 },
                     { type: 'explicituri', value: 'g', line: 3 },
                     { type: 'explicituri', value: 'h', line: 3 },
                     { type: 'literal', value: '"i"', line: 3 },
                     { type: 'langcode', value: 'en', line: 3 },
                     { type: 'dot', line: 3 },
                     { type: 'eof', line: 3 }));

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
      shouldTokenize('@prefix : <http://uri.org/#>.\n@prefix abc:<http://uri.org/#>.',
                     { type: '@prefix', line: 1 },
                     { type: 'prefix', value: '', line: 1 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: '@prefix', line: 2 },
                     { type: 'prefix', value: 'abc', line: 2 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 2 },
                     { type: 'dot', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize @base declarations',
      shouldTokenize('@base <http://uri.org/#>.\n@base <http://uri.org/#>.',
                     { type: '@base', line: 1 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: '@base', line: 2 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 2 },
                     { type: 'dot', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize PREFIX declarations',
      shouldTokenize('PREFIX : <http://uri.org/#>\npreFiX abc: <http://uri.org/#>',
                     { type: 'PREFIX', line: 1 },
                     { type: 'prefix', value: '', line: 1 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 1 },
                     { type: 'PREFIX', line: 2 },
                     { type: 'prefix', value: 'abc', line: 2 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize BASE declarations',
      shouldTokenize('BASE <http://uri.org/#>\nbAsE <http://uri.org/#>',
                     { type: 'BASE', line: 1 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 1 },
                     { type: 'BASE', line: 2 },
                     { type: 'explicituri', value: 'http://uri.org/#', line: 2 },
                     { type: 'eof', line: 2 }));

    it('should tokenize qnames',
      shouldTokenize(':a b:c d-dd:e-ee.',
                     { type: 'qname', prefix: '',      value: 'a',    line: 1 },
                     { type: 'qname', prefix: 'b',     value: 'c',    line: 1 },
                     { type: 'qname', prefix: 'd-dd',  value: 'e-ee', line: 1 },
                     { type: 'dot', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize blank nodes',
      shouldTokenize('[] [<a> <b>]',
                     { type: 'bracketopen', line: 1 },
                     { type: 'bracketclose', line: 1 },
                     { type: 'bracketopen', line: 1 },
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'explicituri', value: 'b', line: 1 },
                     { type: 'bracketclose', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize lists',
      shouldTokenize('() (<a>) (<a> <b>)',
                     { type: 'liststart', line: 1 },
                     { type: 'listend', line: 1 },
                     { type: 'liststart', line: 1 },
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'listend', line: 1 },
                     { type: 'liststart', line: 1 },
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'explicituri', value: 'b', line: 1 },
                     { type: 'listend', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize mixed lists',
      shouldTokenize('<a> <b> (1 "2" :o)',
                     { type: 'explicituri', value: 'a', line: 1 },
                     { type: 'explicituri', value: 'b', line: 1 },
                     { type: 'liststart', line: 1 },
                     { type: 'literal', value: '"1"^^<http://www.w3.org/2001/XMLSchema#integer>', line: 1 },
                     { type: 'literal', value: '"2"', line: 1 },
                     { type: 'qname', value: 'o', line: 1 },
                     { type: 'listend', line: 1 },
                     { type: 'eof', line: 1 }));

    it('should tokenize the "a" predicate',
      shouldTokenize('<x> a <y>.',
                     { type: 'explicituri', value: 'x', line: 1 },
                     { type: 'abbreviation', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', line: 1 },
                     { type: 'explicituri', value: 'y', line: 1 },
                     { type: 'dot', line: 1 },
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
        throw new Error("Expected error " + expectedError);
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
