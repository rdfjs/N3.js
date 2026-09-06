import { Lexer } from '../src';

import { EventEmitter } from 'events';

describe('Lexer', () => {
  describe('The Lexer export', () => {
    it('should be a function', () => {
      expect(Lexer).toBeInstanceOf(Function);
    });

    it('should be an Lexer constructor', () => {
      expect(new Lexer()).toBeInstanceOf(Lexer);
    });
  });

  describe('A Lexer instance', () => {
    it.each([
      ['a', 'abbreviation', 'a', ''],
      ['true', 'literal', 'true', 'http://www.w3.org/2001/XMLSchema#boolean'],
      ['false', 'literal', 'false', 'http://www.w3.org/2001/XMLSchema#boolean'],
      ['id', 'id', '', ''],
    ])('recognizes fixed token %s at every stream split', (word, type, value, prefix) => {
      const input = `${word} <s>`;
      expect(new Lexer().tokenize(input)[0]).toEqual({
        type, value, prefix, line: 1, start: 0, end: word.length,
      });
      for (let split = 0; split <= input.length; split++) {
        const stream = new EventEmitter(), tokens = [];
        new Lexer().tokenize(stream, (error, token) => {
          expect(error).toBeNull();
          tokens.push({ type: token.type, value: token.value, prefix: token.prefix });
        });
        stream.emit('data', input.slice(0, split));
        stream.emit('data', input.slice(split));
        stream.emit('end');
        expect(tokens).toEqual([
          { type, value, prefix },
          { type: 'IRI', value: 's', prefix: '' },
          { type: 'eof', value: '', prefix: '' },
        ]);
      }
    });

    it.each(['a', 'true', 'false', 'id'])('keeps %s as a prefix when a stream continues with a colon', word => {
      const stream = new EventEmitter(), tokens = [];
      new Lexer().tokenize(stream, (error, token) => {
        expect(error).toBeNull();
        tokens.push({ type: token.type, value: token.value, prefix: token.prefix });
      });
      stream.emit('data', word);
      expect(tokens).toEqual([]);
      stream.emit('data', ':local ');
      stream.emit('end');
      expect(tokens).toEqual([
        { type: 'prefixed', value: 'local', prefix: word },
        { type: 'eof', value: '', prefix: '' },
      ]);
    });

    it.each(['a', 'true', 'false', 'id'])('requires a boundary after %s at EOF', word => {
      expect(() => new Lexer().tokenize(word)).toThrow(`Unexpected "${word}" on line 1.`);
    });

    it.each(['a', 'true', 'false', 'id'])('rejects fixed token %s in line mode', word => {
      expect(() => new Lexer({ lineMode: true }).tokenize(`${word} `))
        .toThrow(`Unexpected "${word}" on line 1.`);
    });

    it.each([
      ['a', 'abbreviation'], ['true', 'literal'], ['false', 'literal'],
    ])('recognizes fixed token %s with N3 features disabled', (word, type) => {
      expect(new Lexer({ n3: false }).tokenize(`${word} `)[0]).toMatchObject({ type, value: word });
    });

    it('should tokenize the empty string', shouldTokenize('',
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize byte order mark at beginning as empty string',
      shouldTokenize('\ufeff', { type: 'eof', line: 1 }),
    );

    it('should tokenize a whitespace string', shouldTokenize(' \t \n  ',
                   { type: 'eof', line: 2 }));

    it('should tokenize an IRI', shouldTokenize('<http://ex.org/?bla#foo>',
                   { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize a split IRI',
      shouldTokenize(streamOf('<', 'http://ex.org/?bla#foo>'),
        { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize an IRI with disallowed characters',
      shouldNotTokenize('<http://ex.org/bla"foo>',
                        'Unexpected "<http://ex.org/bla"foo>" on line 1.'),
    );

    it(
      'should not tokenize an IRI with escaped characters',
      shouldNotTokenize('<http://ex.org/bla\\"foo>',
                        'Unexpected "<http://ex.org/bla\\"foo>" on line 1.'),
    );

    it(
      'should not tokenize an IRI with disallowed escaped characters',
      shouldNotTokenize('<http://ex.org/bla\\u0020foo>',
                        'Unexpected "<http://ex.org/bla\\u0020foo>" on line 1.'),
    );

    it(
      'should not tokenize an IRI with invalid 4-digit unicode escapes',
      shouldNotTokenize('<http://ex.org/bla\\uXYZZfoo>',
                        'Unexpected "<http://ex.org/bla\\uXYZZfoo>" on line 1.'),
    );

    it(
      'should not tokenize an IRI with invalid 8-digit unicode escapes',
      shouldNotTokenize('<http://ex.org/bla\\uXYZZxyzzfoo>',
                        'Unexpected "<http://ex.org/bla\\uXYZZxyzzfoo>" on line 1.'),
    );

    it(
      'should not tokenize an IRI with a non-numeric 4-digit unicode escapes',
      done => {
        const stream = new EventEmitter(), lexer = new Lexer();
        lexer.tokenize(stream, (error, token) => {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBe('Unexpected "<\\uz234>" on line 1.');
          done(token);
        });
        stream.emit('data', '<\\uz234>');
      },
    );

    it(
      'should not tokenize an IRI with a non-numeric 8-digit unicode escapes',
      done => {
        const stream = new EventEmitter(), lexer = new Lexer();
        lexer.tokenize(stream, (error, token) => {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBe('Unexpected "<\\Uz2345678>" on line 1.');
          done(token);
        });
        stream.emit('data', '<\\Uz2345678>');
      },
    );

    it(
      'should tokenize an IRI with four-digit unicode escapes',
      shouldTokenize('<http://a.example/\\u0073>',
                     { type: 'IRI', value: 'http://a.example/s', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an IRI with eight-digit unicode escapes',
      shouldTokenize('<http://a.example/\\U00000073\\U0001F0A1>',
                     { type: 'IRI', value: 'http://a.example/s\ud83c\udca1', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should not decode an IRI', shouldTokenize('<http://a.example/%66oo-bar>',
                   { type: 'IRI', value: 'http://a.example/%66oo-bar', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize two IRIs separated by whitespace',
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t',
                     { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'eof', line: 4 }),
    );

    it(
      'should tokenize a statement with IRIs',
      shouldTokenize(' \n\t<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> .',
                     { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 2 },
                     { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 3 },
                     { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 4 },
                     { type: '.', line: 4 },
                     { type: 'eof', line: 4 }),
    );

    it('should tokenize prefixed names', shouldTokenize(':a b:c d-dd:e-ee.',
                   { type: 'prefixed', prefix: '',      value: 'a',    line: 1 },
                   { type: 'prefixed', prefix: 'b',     value: 'c',    line: 1 },
                   { type: 'prefixed', prefix: 'd-dd',  value: 'e-ee', line: 1 },
                   { type: '.', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize prefixed names with leading digits',
      shouldTokenize('leg:3032571 isbn13:9780136019701 ',
                     { type: 'prefixed', prefix: 'leg',    value: '3032571',       line: 1 },
                     { type: 'prefixed', prefix: 'isbn13', value: '9780136019701', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize prefixed names starting with true',
      shouldTokenize('true:a  truer:b ',
                     { type: 'prefixed', prefix: 'true',   value: 'a', line: 1 },
                     { type: 'prefixed', prefix: 'truer',  value: 'b', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize prefixed names starting with false',
      shouldTokenize('false:a falser:b ',
                     { type: 'prefixed', prefix: 'false',  value: 'a', line: 1 },
                     { type: 'prefixed', prefix: 'falser', value: 'b', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize prefixed names with non-leading colons',
      shouldTokenize('og:video:height ',
                     { type: 'prefixed', prefix: 'og', value: 'video:height', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize prefixed names with reserved escape sequences',
      shouldTokenize('wgs:lat\\-long ',
                     { type: 'prefixed', prefix: 'wgs', value: 'lat-long', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize prefixed names with all reserved escape sequences',
      shouldTokenize("ex:a\\_\\~\\.\\-\\!\\$\\&\\'\\(\\)\\*\\+\\,\\;\\=\\/\\?\\#\\@\\%b ",
                     { type: 'prefixed', prefix: 'ex', value: "a_~.-!$&'()*+,;=/?#@%b", line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should tokenize the colon prefixed name', shouldTokenize(': : :.',
                   { type: 'prefixed', prefix: '', value: '', line: 1 },
                   { type: 'prefixed', prefix: '', value: '', line: 1 },
                   { type: 'prefixed', prefix: '', value: '', line: 1 },
                   { type: '.', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize a prefixed name with a dot, split in half while streaming',
      shouldTokenize(streamOf('dbpedia:Anthony_J._Batt', 'aglia '),
                     { type: 'prefixed', prefix: 'dbpedia', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a prefixed name with a dot, split after the dot while streaming',
      shouldTokenize(streamOf('dbpedia:Anthony_J.', '_Battaglia '),
                     { type: 'prefixed', prefix: 'dbpedia', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a blank node with a dot, split in half while streaming',
      shouldTokenize(streamOf('_:Anthony_J._Batt', 'aglia '),
                     { type: 'blank', prefix: '_', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a blank node with a dot, split after the dot while streaming',
      shouldTokenize(streamOf('_:Anthony_J.', '_Battaglia '),
                     { type: 'blank', prefix: '_', value: 'Anthony_J._Battaglia', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should not decode a prefixed name', shouldTokenize('ex:%66oo-bar ',
                   { type: 'prefixed', prefix: 'ex', value: '%66oo-bar', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should not tokenize a prefixed name with disallowed characters',
      shouldNotTokenize('ex:bla"foo',
                        'Unexpected ""foo" on line 1.'),
    );

    it(
      'should not tokenize a prefixed name with escaped characters',
      shouldNotTokenize('ex:bla\\"foo',
                        'Unexpected "ex:bla\\"foo" on line 1.'),
    );

    it(
      'should not tokenize a prefixed name with disallowed escaped characters',
      shouldNotTokenize('ex:bla\\u0020foo',
                        'Unexpected "ex:bla\\u0020foo" on line 1.'),
    );

    it(
      'should not tokenize a prefixed name with invalid 4-digit unicode escapes',
      shouldNotTokenize('ex:bla\\uXYZZfoo',
                        'Unexpected "ex:bla\\uXYZZfoo" on line 1.'),
    );

    it(
      'should not tokenize a prefixed name with invalid 8-digit unicode escapes',
      shouldNotTokenize('ex:bla\\uXYZZxyzzfoo',
                        'Unexpected "ex:bla\\uXYZZxyzzfoo" on line 1.'),
    );

    it(
      'should not tokenize a prefixed name with four-digit unicode escapes',
      shouldNotTokenize('ex:foo\\u0073bar',
                        'Unexpected "ex:foo\\u0073bar" on line 1.'),
    );

    it(
      'should not tokenize a prefixed name with eight-digit unicode escapes',
      shouldNotTokenize('ex:foo\\U00000073\\U00A00073bar',
                        'Unexpected "ex:foo\\U00000073\\U00A00073bar" on line 1.'),
    );

    it(
      'should tokenize two prefixed names separated by whitespace',
      shouldTokenize(' \n\tex:foo \n\tex:bar \n\t',
                     { type: 'prefixed', prefix: 'ex', value: 'foo', line: 2 },
                     { type: 'prefixed', prefix: 'ex', value: 'bar', line: 3 },
                     { type: 'eof', line: 4 }),
    );

    it(
      'should tokenize a statement with prefixed names',
      shouldTokenize(' \n\tex:foo \n\tex:bar \n\tex:baz .',
                     { type: 'prefixed', prefix: 'ex', value: 'foo', line: 2 },
                     { type: 'prefixed', prefix: 'ex', value: 'bar', line: 3 },
                     { type: 'prefixed', prefix: 'ex', value: 'baz', line: 4 },
                     { type: '.', line: 4 },
                     { type: 'eof', line: 4 }),
    );

    it(
      'should correctly recognize different types of newlines',
      shouldTokenize('<a>\r<b>\n<c>\r\n.',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 2 },
                     { type: 'IRI', value: 'c', line: 3 },
                     { type: '.', line: 4 },
                     { type: 'eof', line: 4 }),
    );

    it('should tokenize a single comment', shouldTokenize('#mycomment',
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize a stream with split comment',
      shouldTokenize(streamOf('#mycom', 'ment'),
                     { type: 'eof', line: 1 }),
    );

    it(
      'should ignore comments',
      shouldTokenize('<#foo> #mycomment\n <#foo>  #mycomment \r# mycomment\n\n<#bla>#',
                     { type: 'IRI', value: '#foo', line: 1 },
                     { type: 'IRI', value: '#foo', line: 2 },
                     { type: 'IRI', value: '#bla', line: 5 },
                     { type: 'eof', line: 5 }),
    );

    it(
      'should tokenize comments after abbreviations and local names',
      shouldTokenize('[a#\na:a#\n].',
                     { type: '[', line: 1 },
                     { type: 'abbreviation', value: 'a', line: 1 },
                     { type: 'prefixed', prefix: 'a', value: 'a', line: 2 },
                     { type: ']', line: 3 },
                     { type: '.', line: 3 },
                     { type: 'eof', line: 3 }),
    );

    it('should tokenize a quoted string literal', shouldTokenize('"string" ',
                   { type: 'literal', value: 'string', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should not tokenize a quoted string literal with a newline',
      shouldNotTokenize('"abc\ndef" ',
                        'Unexpected ""abc" on line 1.'),
    );

    it(
      'should not tokenize a quoted string literal with a carriage return',
      shouldNotTokenize('"abc\rdef" ',
                        'Unexpected ""abc" on line 1.'),
    );

    it(
      'should tokenize a triple quoted string literal',
      shouldTokenize('"""string"""',
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a triple quoted string literal with quoted newlines inside',
      shouldTokenize('"""st"r\r\ni""\n\rng"""',
                     { type: 'literal', value: 'st"r\r\ni""\n\rng', line: 1 },
                     { type: 'eof', line: 4 }),
    );

    it(
      'should tokenize a string with escape characters',
      shouldTokenize('"\\\\ \\\' \\" \\n \\r \\t \\ua1b2" \n """\\\\ \\\' \\" \\n \\r \\t \\U0000a1b2"""',
                     { type: 'literal', value: '\\ \' " \n \r \t \ua1b2', line: 1 },
                     { type: 'literal', value: '\\ \' " \n \r \t \ua1b2', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize a string with all ECHAR escape sequences',
      shouldTokenize('"\\t \\b \\n \\r \\f \\\\ \\" \\\'" ',
                     { type: 'literal', value: '\t \b \n \r \f \\ " \'', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize a string with invalid characters',
      shouldNotTokenize('"\\uXYZX" ',
                        'Unexpected ""\\uXYZX"" on line 1.'),
    );

    // Escapes for these characters are only allowed in local names of prefixed names
    for (const char of '_~.-!$&()*+,;=/?#@%') {
      it(
        `should not tokenize a double-quoted string with the escape sequence \\${char}`,
        shouldNotTokenize(`"a\\${char}b" `,
                          `Unexpected ""a\\${char}b"" on line 1.`),
      );

      it(
        `should not tokenize a single-quoted string with the escape sequence \\${char}`,
        shouldNotTokenize(`'a\\${char}b' `,
                          `Unexpected "'a\\${char}b'" on line 1.`),
      );

      it(
        `should not tokenize a triple-quoted string with the escape sequence \\${char}`,
        shouldNotTokenize(`"""a\\${char}b""" `,
                          `Unexpected """"a\\${char}b"""" on line 1.`),
      );
    }

    it(
      'should not tokenize a literal with a surrogate pair via unicode escapes',
      shouldNotTokenize('"\\uD83C\\uDF00" ',
                        'Unexpected ""\\uD83C\\uDF00"" on line 1.'),
    );

    it(
      'should not tokenize a literal with a lone high surrogate unicode escape',
      shouldNotTokenize('"\\uD800" ',
                        'Unexpected ""\\uD800"" on line 1.'),
    );

    it(
      'should not tokenize a literal with a lone low surrogate unicode escape',
      shouldNotTokenize('"\\uDFFF" ',
                        'Unexpected ""\\uDFFF"" on line 1.'),
    );

    it(
      'should not tokenize a literal with a high surrogate 8-digit unicode escape',
      shouldNotTokenize('"\\U0000D800" ',
                        'Unexpected ""\\U0000D800"" on line 1.'),
    );

    it(
      'should not tokenize a literal with a low surrogate 8-digit unicode escape',
      shouldNotTokenize('"\\U0000DFFF" ',
                        'Unexpected ""\\U0000DFFF"" on line 1.'),
    );

    it(
      'should not tokenize a literal with an 8-digit unicode escape beyond U+10FFFF',
      shouldNotTokenize('"\\U00110000" ',
                        'Unexpected ""\\U00110000"" on line 1.'),
    );

    it(
      'should not tokenize an IRI with an 8-digit unicode escape beyond U+10FFFF',
      shouldNotTokenize('<urn:\\U00110000>',
                        'Unexpected "<urn:\\U00110000>" on line 1.'),
    );

    it(
      'should tokenize a literal with the highest valid 8-digit unicode escape',
      shouldTokenize('"\\U0010FFFF" ',
                     { type: 'literal', value: '\u{10FFFF}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize a double-quoted string ending with an escaped quote',
      shouldNotTokenize('"abc\\"',
                        'Unexpected ""abc\\"" on line 1.'),
    );

    it(
      'should not tokenize a single-quoted string ending with an escaped quote',
      shouldNotTokenize("'abc\\'",
                        'Unexpected "\'abc\\\'" on line 1.'),
    );

    it(
      'should not tokenize a double-quoted string ending with a backslash and escaped quote',
      shouldNotTokenize('"abc\\\\\\"',
                        'Unexpected ""abc\\\\\\"" on line 1.'),
    );

    it(
      'should not tokenize a single-quoted string ending with a backslash and escaped quote',
      shouldNotTokenize("'abc\\\\\\'",
                        'Unexpected "\'abc\\\\\\\'" on line 1.'),
    );

    it(
      'should tokenize a double-quoted string ending in backslashes',
      shouldTokenize('"abc\\\\" "abc\\\\\\\\"',
                     { type: 'literal', value: 'abc\\', line: 1 },
                     { type: 'literal', value: 'abc\\\\', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a single-quoted string ending in backslashes',
      shouldTokenize("'abc\\\\' 'abc\\\\\\\\'",
                     { type: 'literal', value: 'abc\\', line: 1 },
                     { type: 'literal', value: 'abc\\\\', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize a triple-quoted string with invalid characters',
      shouldNotTokenize("'''\\uXYZX''' ",
                        "Unexpected \"'''\\uXYZX'''\" on line 1."),
    );

    it(
      'should tokenize a quoted string literal with language code',
      shouldTokenize('"string"@en "string"@nl-be "string"@EN ',
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'en', line: 1 },
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'nl-be', line: 1 },
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'EN', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a language code with a subtag split across chunks',
      shouldTokenize(streamOf('"string"@nl-', 'nl '),
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'nl-nl', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a language code whose subtag boundary aligns with a chunk boundary',
      shouldTokenize(streamOf('"string"@nl-nl', ' '),
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'nl-nl', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a language code with a chunk boundary inside a subtag',
      shouldTokenize(streamOf('"string"@nl-n', 'l '),
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'nl-nl', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a directional language code followed by a newline in an unfinished chunk',
      shouldTokenize(streamOf('"x"@en--rtl .\n"y"@en .', ' '),
                     { type: 'literal', value: 'x', line: 1 },
                     { type: 'langcode', value: 'en', line: 1 },
                     { type: 'dircode', value: 'rtl', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: 'y', line: 2 },
                     { type: 'langcode', value: 'en', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize a direction code split from its language code across chunks',
      shouldTokenize(streamOf('"string"@en-', '-rtl '),
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'en', line: 1 },
                     { type: 'dircode', value: 'rtl', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
        'should tokenize a quoted string literal with directional language code',
        shouldTokenize('"string"@en--rtl "string"@nl-be--ltr "string"@EN--rtl ',
            { type: 'literal', value: 'string', line: 1 },
            { type: 'langcode', value: 'en', line: 1 },
            { type: 'dircode', value: 'rtl', line: 1 },
            { type: 'literal', value: 'string', line: 1 },
            { type: 'langcode', value: 'nl-be', line: 1 },
            { type: 'dircode', value: 'ltr', line: 1 },
            { type: 'literal', value: 'string', line: 1 },
            { type: 'langcode', value: 'EN', line: 1 },
            { type: 'dircode', value: 'rtl', line: 1 },
            { type: 'eof', line: 1 }),
    );

    it('should not tokenize an invalid direction', shouldNotTokenize('"string"@en--unk',
        'Unexpected "--unk" on line 1.'));

    it('should not tokenize a direction in uppercase', shouldNotTokenize('"string"@en--LTR',
        'Unexpected "--LTR" on line 1.'));

    it('should not tokenize an invalid direction when "rtl" occurs later in the input', shouldNotTokenize('"string"@en--unk # rtl\n',
        'Unexpected "--unk" on line 1.'));

    it(
      'should tokenize a quoted string literal with type',
      shouldTokenize('"stringA"^^<type> "stringB"^^ns:mytype ',
                     { type: 'literal', value: 'stringA', line: 1 },
                     { type: 'typeIRI', value: 'type', line: 1 },
                     { type: 'literal', value: 'stringB', line: 1 },
                     { type: 'type', value: 'mytype', prefix: 'ns', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should not tokenize a single hat', shouldNotTokenize('^',
                      'Unexpected "^" on line 1.'));

    it(
      'should not tokenize a double hat followed by a non-IRI',
      shouldNotTokenize('^^1',
                        'Unexpected "1" on line 1.'),
    );

    it(
      'should tokenize a single-quoted string literal',
      shouldTokenize("'string' ",
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a triple single-quoted string literal',
      shouldTokenize("'''string'''",
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize a single-quoted string literal with a newline',
      shouldNotTokenize("'abc\ndef' ",
                        'Unexpected "\'abc" on line 1.'),
    );

    it(
      'should not tokenize a single-quoted string literal with a carriage return',
      shouldNotTokenize("'abc\rdef' ",
                        'Unexpected "\'abc" on line 1.'),
    );

    it(
      'should tokenize a triple single-quoted string literal with quotes newlines inside',
      shouldTokenize("'''st'r\ni''ng'''",
                     { type: 'literal', value: 'st\'r\ni\'\'ng', line: 1 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize a single-quoted string with escape characters',
      shouldTokenize("'\\\\ \\\" \\' \\n \\r \\t \\ua1b2' \n '''\\\\ \\\" \\' \\n \\r \\t \\U0001F0A1'''",
                     { type: 'literal', value: '\\ " \' \n \r \t \ua1b2', line: 1 },
                     { type: 'literal', value: '\\ " \' \n \r \t \ud83c\udca1', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize a single-quoted string literal with language code',
      shouldTokenize("'string'@en 'string'@nl-be 'string'@EN ",
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'en', line: 1 },
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'nl-be', line: 1 },
                     { type: 'literal', value: 'string', line: 1 },
                     { type: 'langcode', value: 'EN', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a single-quoted string literal with type',
      shouldTokenize("'stringA'^^<type> 'stringB'^^ns:mytype ",
                     { type: 'literal', value: 'stringA', line: 1 },
                     { type: 'typeIRI', value: 'type', line: 1 },
                     { type: 'literal', value: 'stringB', line: 1 },
                     { type: 'type', value: 'mytype', prefix: 'ns', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should tokenize an integer literal', shouldTokenize('10, +20. -30, 40. ',
                   { type: 'literal', value:  '10', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                   { type: ',', line: 1 },
                   { type: 'literal', value: '+20', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                   { type: '.', line: 1 },
                   { type: 'literal', value: '-30', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                   { type: ',', line: 1 },
                   { type: 'literal', value:  '40', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                   { type: '.', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize a decimal literal',
      shouldTokenize('1. 2.0, .3. -0.4, -.5. ',
                     { type: 'literal', value:    '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value:  '2.0', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value:   '.3', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: '-0.4', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value:  '-.5', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a double literal',
      shouldTokenize('10e20, +30.40E+50. -60.70e-80. .171e-11.',
                     { type: 'literal', value:      '10e20', prefix: 'http://www.w3.org/2001/XMLSchema#double', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'literal', value: '+30.40E+50', prefix: 'http://www.w3.org/2001/XMLSchema#double', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: '-60.70e-80', prefix: 'http://www.w3.org/2001/XMLSchema#double', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'literal', value: '.171e-11', prefix: 'http://www.w3.org/2001/XMLSchema#double', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should not tokenize an invalid number', shouldNotTokenize('10-10 ',
                      'Unexpected "10-10" on line 1.'));

    it('should tokenize booleans', shouldTokenize('true false ',
                   { type: 'literal', value:  'true', prefix: 'http://www.w3.org/2001/XMLSchema#boolean', line: 1 },
                   { type: 'literal', value: 'false', prefix: 'http://www.w3.org/2001/XMLSchema#boolean', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize statements with shared subjects',
      shouldTokenize('<a> <b> <c>;\n<d> <e>.',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'IRI', value: 'c', line: 1 },
                     { type: ';', line: 1 },
                     { type: 'IRI', value: 'd', line: 2 },
                     { type: 'IRI', value: 'e', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize statements with shared subjects and predicates',
      shouldTokenize('<a> <b> <c>,\n<d>.',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'IRI', value: 'c', line: 1 },
                     { type: ',', line: 1 },
                     { type: 'IRI', value: 'd', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize statements with shared subjects and predicates and prefixed names',
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
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a stream',
      shouldTokenize(streamOf('<a>\n<b', '> ', '"""', 'c\n', '"""', '.',
                              '<d> <e', '> ', '""', '.',
                              '<g> <h> "i"', '@e', 'n.'),
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 2 },
                     { type: 'literal', value: 'c\n', line: 2 },
                     { type: '.', line: 3 },
                     { type: 'IRI', value: 'd', line: 3 },
                     { type: 'IRI', value: 'e', line: 3 },
                     { type: 'literal', value: '', line: 3 },
                     { type: '.', line: 3 },
                     { type: 'IRI', value: 'g', line: 3 },
                     { type: 'IRI', value: 'h', line: 3 },
                     { type: 'literal', value: 'i', line: 3 },
                     { type: 'langcode', value: 'en', line: 3 },
                     { type: '.', line: 3 },
                     { type: 'eof', line: 3 }),
    );

    it(
      'should tokenize a stream ending with a digit and a dot',
      shouldTokenize(streamOf('1', '.'),
                     { type: 'literal', value: '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a stream containing a decimal without leading digit',
      shouldTokenize(streamOf('.', '1 '),
                     { type: 'literal', value: '.1', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a stream containing a decimal with leading digit',
      shouldTokenize(streamOf('1.', '1 '),
                     { type: 'literal', value: '1.1', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should immediately signal an error if a linebreak occurs anywhere outside a triple-quoted literal',
      shouldNotTokenize(streamOf('abc\n', null), 'Unexpected "abc" on line 1.'),
    );

    it(
      'should immediately signal an error if a linebreak occurs inside a single-quoted literal',
      shouldNotTokenize(streamOf('"abc\n', null), 'Unexpected ""abc" on line 1.'),
    );

    it(
      'should immediately signal an error if a carriage return occurs anywhere outside a triple-quoted literal',
      shouldNotTokenize(streamOf('abc\r', null), 'Unexpected "abc" on line 1.'),
    );

    it(
      'should immediately signal an error if a carriage return occurs inside a single-quoted literal',
      shouldNotTokenize(streamOf('"abc\r', null), 'Unexpected ""abc" on line 1.'),
    );

    it(
      'should tokenize a split single-quoted string',
      shouldTokenize(streamOf("'abc", "def' "),
                     { type: 'literal', value: 'abcdef', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a split single-quoted string followed by a triple-quoted string',
      // Checks whether _literalClosingPos is properly reset
      shouldTokenize(streamOf("'abcdef", "' '''a'''"),
                     { type: 'literal', value: 'abcdef', line: 1 },
                     { type: 'literal', value: 'a', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize split triple-quoted strings',
      shouldTokenize(streamOf('"', '""abc""" ',
                              '""', '"def""" ',
                              '"""', 'ghi""" ',
                              '"""jkl', '""" ',
                              '"""mno"', '"" ',
                              '"""pqr""', '" '),
                     { type: 'literal', value: 'abc', line: 1 },
                     { type: 'literal', value: 'def', line: 1 },
                     { type: 'literal', value: 'ghi', line: 1 },
                     { type: 'literal', value: 'jkl', line: 1 },
                     { type: 'literal', value: 'mno', line: 1 },
                     { type: 'literal', value: 'pqr', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a triple-quoted string split after a newline',
      shouldTokenize(streamOf('"""abc\n', 'def"""'),
                     { type: 'literal', value: 'abc\ndef', line: 1 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize @ keywords',
      shouldTokenize('@prefix @base @forSome @forAll @version ',
                     { type: '@prefix',  line: 1 },
                     { type: '@base',    line: 1 },
                     { type: '@forSome', line: 1 },
                     { type: '@forAll',  line: 1 },
                     { type: '@version',  line: 1 },
                     { type: 'eof',      line: 1 }),
    );

    it(
      'should tokenize @prefix declarations',
      shouldTokenize('@prefix : <http://iri.org/#>.\n@prefix abc:<http://iri.org/#>.\n@prefix:<http://example/c/>.',
                     { type: '@prefix', line: 1 },
                     { type: 'prefix', value: '', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: '.', line: 1 },
                     { type: '@prefix', line: 2 },
                     { type: 'prefix', value: 'abc', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: '.', line: 2 },
                     { type: '@prefix', line: 3 },
                     { type: 'prefix', value: '', line: 3 },
                     { type: 'IRI', value: 'http://example/c/', line: 3 },
                     { type: '.', line: 3 },
                     { type: 'eof', line: 3 }),
    );

    it(
      'should not tokenize prefixes that end with a dot',
      shouldNotTokenize('@prefix abc.: <def>.',
                        'Unexpected "abc.:" on line 1.'),
    );

    it(
      'should tokenize @base declarations',
      shouldTokenize('@base <http://iri.org/#>.\n@base <http://iri.org/#>.',
                     { type: '@base', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: '.', line: 1 },
                     { type: '@base', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: '.', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
        'should tokenize @version declarations',
        shouldTokenize('@version "1.2".\n@version \'1.2-basic\'.',
            { type: '@version', line: 1 },
            { type: 'literal', value: '1.2', line: 1 },
            { type: '.', line: 1 },
            { type: '@version', line: 2 },
            { type: 'literal', value: '1.2-basic', line: 2 },
            { type: '.', line: 2 },
            { type: 'eof', line: 2 }),
    );

    it(
        'should tokenize mixed VERSION @version declarations',
        shouldTokenize('VERSION "1.2"\nversion "1.2"\n@version "1.2" .',
            { type: 'VERSION', line: 1 },
            { type: 'literal', value: '1.2', line: 1 },
            { type: 'VERSION', line: 2 },
            { type: 'literal', value: '1.2', line: 2 },
            { type: '@version', line: 3 },
            { type: 'literal', value: '1.2', line: 3 },
            { type: '.', line: 3 },
            { type: 'eof', line: 3 }),
    );

    it(
      'should tokenize PREFIX declarations',
      shouldTokenize('PREFIX : <http://iri.org/#>\npreFiX abc: <http://iri.org/#>',
                     { type: 'PREFIX', line: 1 },
                     { type: 'prefix', value: '', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: 'PREFIX', line: 2 },
                     { type: 'prefix', value: 'abc', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize BASE declarations',
      shouldTokenize('BASE <http://iri.org/#>\nbAsE <http://iri.org/#>',
                     { type: 'BASE', line: 1 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 1 },
                     { type: 'BASE', line: 2 },
                     { type: 'IRI', value: 'http://iri.org/#', line: 2 },
                     { type: 'eof', line: 2 }),
    );

    it(
        'should tokenize VERSION declarations',
        shouldTokenize('VERSION "1.2"\nVERSION \'1.2-basic\'',
            { type: 'VERSION', line: 1 },
            { type: 'literal', value: '1.2', line: 1 },
            { type: 'VERSION', line: 2 },
            { type: 'literal', value: '1.2-basic', line: 2 },
            { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize blank nodes',
      shouldTokenize('[] [<a> <b>] [a:b "c"^^d:e][a:b[]] _:a:b.',
                     { type: '[', line: 1 },
                     { type: ']', line: 1 },
                     { type: '[', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: ']', line: 1 },
                     { type: '[', line: 1 },
                     { type: 'prefixed', prefix: 'a', value: 'b', line: 1 },
                     { type: 'literal', value: 'c', line: 1 },
                     { type: 'type', prefix: 'd', value: 'e', line: 1 },
                     { type: ']', line: 1 },
                     { type: '[', line: 1 },
                     { type: 'prefixed', prefix: 'a', value: 'b', line: 1 },
                     { type: '[', line: 1 },
                     { type: ']', line: 1 },
                     { type: ']', line: 1 },
                     { type: 'blank', prefix: '_', value: 'a', line: 1 },
                     { type: 'prefixed', prefix: '',  value: 'b', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should not tokenize invalid blank nodes', shouldNotTokenize('_::',
                      'Unexpected "_::" on line 1.'));

    it('should tokenize lists', shouldTokenize('() (<a>) (<a> <b>)',
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

    it(
      'should tokenize mixed lists',
      shouldTokenize('<a> <b> (1 "2" :o)(1()(1))',
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'literal', value: '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: 'literal', value: '2', line: 1 },
                     { type: 'prefixed', value: 'o', line: 1 },
                     { type: ')', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'literal', value: '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: '(', line: 1 },
                     { type: ')', line: 1 },
                     { type: '(', line: 1 },
                     { type: 'literal', value: '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: ')', line: 1 },
                     { type: ')', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should tokenize the "a" predicate', shouldTokenize('<x> a <y>.',
                   { type: 'IRI', value: 'x', line: 1 },
                   { type: 'abbreviation', value: 'a', line: 1 },
                   { type: 'IRI', value: 'y', line: 1 },
                   { type: '.', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize N3 verb keywords',
      shouldTokenize('<s> has <p> <o>. <s> is <p> of <o>.',
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'has', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'is', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'of', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize IRI property list identifiers',
      shouldTokenize('[ id <s> <p> <o> ] [id<s> <p> <o>]',
                     { type: '[', line: 1 },
                     { type: 'id', line: 1 },
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: ']', line: 1 },
                     { type: '[', line: 1 },
                     { type: 'id', line: 1 },
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: ']', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize N3 verb keywords split across chunks',
      shouldTokenize(streamOf('<s> h', 'as <p> <o>. <s> i', 's <p> o', 'f <o>.'),
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'has', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'is', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'of', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should keep numeric characters as N3 verb boundaries when no prefix follows',
      shouldTokenize(streamOf('has1', ' of-1'),
                     { type: 'has', line: 1 },
                     { type: 'literal', value: '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: 'of', line: 1 },
                     { type: 'literal', value: '-1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an IRI property list identifier split across chunks',
      shouldTokenize(streamOf('[ i', 'd <s> <p> <o> ]'),
                     { type: '[', line: 1 },
                     { type: 'id', line: 1 },
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: ']', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should keep keyword-like prefixes as prefixed names',
      shouldTokenize('has:p is:p of:p has1:p has_:p has-foo:p is1:p is_:p is-foo:p of1:p of_:p of-foo:p',
                     { type: 'prefixed', prefix: 'has', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'is', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'of', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'has1', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'has_', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'has-foo', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'is1', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'is_', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'is-foo', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'of1', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'of_', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'of-foo', value: 'p', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should keep keyword-like prefixes split across chunks as prefixed names',
      shouldTokenize(streamOf('has', '1:p is', '_:p of-', 'foo:p'),
                     { type: 'prefixed', prefix: 'has1', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'is_', value: 'p', line: 1 },
                     { type: 'prefixed', prefix: 'of-foo', value: 'p', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should keep an id prefix as a prefixed name',
      shouldTokenize('id:p',
                     { type: 'prefixed', prefix: 'id', value: 'p', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize N3 verb keywords outside N3 mode',
      shouldNotTokenize(new Lexer({ n3: false }), 'has ', 'Unexpected "has" on line 1.'),
    );

    it(
      'should not tokenize IRI property list identifiers outside N3 mode',
      shouldNotTokenize(new Lexer({ n3: false }), 'id ', 'Unexpected "id" on line 1.'),
    );

    it(
      'should tokenize the "a" predicate without spacing',
      shouldTokenize('[a<>].\n[a[]].\n[a()].\n<>a<>.\n<>a[].\n<>a().\n',
                     { type: '[', line: 1 },
                     { type: 'abbreviation', value: 'a', line: 1 },
                     { type: 'IRI', line: 1 },
                     { type: ']', line: 1 },
                     { type: '.', line: 1 },
                     { type: '[', line: 2 },
                     { type: 'abbreviation', value: 'a', line: 2 },
                     { type: '[', line: 2 },
                     { type: ']', line: 2 },
                     { type: ']', line: 2 },
                     { type: '.', line: 2 },
                     { type: '[', line: 3 },
                     { type: 'abbreviation', value: 'a', line: 3 },
                     { type: '(', line: 3 },
                     { type: ')', line: 3 },
                     { type: ']', line: 3 },
                     { type: '.', line: 3 },
                     { type: 'IRI', line: 4 },
                     { type: 'abbreviation', value: 'a', line: 4 },
                     { type: 'IRI', line: 4 },
                     { type: '.', line: 4 },
                     { type: 'IRI', line: 5 },
                     { type: 'abbreviation', value: 'a', line: 5 },
                     { type: '[', line: 5 },
                     { type: ']', line: 5 },
                     { type: '.', line: 5 },
                     { type: 'IRI', line: 6 },
                     { type: 'abbreviation', value: 'a', line: 6 },
                     { type: '(', line: 6 },
                     { type: ')', line: 6 },
                     { type: '.', line: 6 },
                     { type: 'eof', line: 7 }),
    );

    it('should tokenize an empty default graph', shouldTokenize('{}',
                   { type: '{', line: 1 },
                   { type: '}', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize a non-empty default graph',
      shouldTokenize('{<a> <b> c:d}',
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an empty graph identified by an IRI',
      shouldTokenize('<g>{}',
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a non-empty graph identified by an IRI',
      shouldTokenize('<g> {<a> <b> c:d}',
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an empty graph identified by a blank node',
      shouldTokenize('_:g{}',
                     { type: 'blank', prefix: '_', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a non-empty graph identified by a blank node',
      shouldTokenize('_:g {<a> <b> c:d}',
                     { type: 'blank', prefix: '_', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an empty graph with the GRAPH keyword',
      shouldTokenize('GRAPH<g>{}',
                     { type: 'GRAPH', line: 1 },
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a non-empty graph with the GRAPH keyword',
      shouldTokenize('graph <g> {<a> <b> c:d}',
                     { type: 'GRAPH', line: 1 },
                     { type: 'IRI', value: 'g', line: 1 },
                     { type: '{', line: 1 },
                     { type: 'IRI', value: 'a', line: 1 },
                     { type: 'IRI', value: 'b', line: 1 },
                     { type: 'prefixed', prefix: 'c', value: 'd', line: 1 },
                     { type: '}', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it('should tokenize variables', shouldTokenize('?a ?abc ?a_B_c.',
                   { type: 'var', value: '?a',     line: 1 },
                   { type: 'var', value: '?abc',   line: 1 },
                   { type: 'var', value: '?a_B_c', line: 1 },
                   { type: '.',   value: '',       line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should not tokenize invalid variables',
      shouldNotTokenize('?0a ', 'Unexpected "?0a" on line 1.'),
    );

    it('should tokenize the equality sign', shouldTokenize('<a> = <b> ',
                   { type: 'IRI', value: 'a', line: 1 },
                   { type: 'abbreviation', value: '=', line: 1 },
                   { type: 'IRI', value: 'b', line: 1 },
                   { type: 'eof', line: 1 }));

    it('should tokenize the right implication', shouldTokenize('<a> => <b> ',
                   { type: 'IRI', value: 'a', line: 1 },
                   { type: 'abbreviation', value: '>', line: 1 },
                   { type: 'IRI', value: 'b', line: 1 },
                   { type: 'eof', line: 1 }));

    it('should tokenize the left implication', shouldTokenize('<a> <= <b> ',
                   { type: 'IRI', value: 'a', line: 1 },
                   { type: 'inverse', value: '>', line: 1 },
                   { type: 'IRI', value: 'b', line: 1 },
                   { type: 'eof', line: 1 }));

    it(
      'should tokenize an inverted predicate marker',
      shouldTokenize('<s> <- <p> <o>. <-s> <-<-p> <-o>.',
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'inversePredicate', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'IRI', value: '-s', line: 1 },
                     { type: 'inversePredicate', line: 1 },
                     { type: 'IRI', value: '-p', line: 1 },
                     { type: 'IRI', value: '-o', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an inverted predicate marker split across chunks',
      shouldTokenize(streamOf('<s> <', '- <p> <o>.'),
                     { type: 'IRI', value: 's', line: 1 },
                     { type: 'inversePredicate', line: 1 },
                     { type: 'IRI', value: 'p', line: 1 },
                     { type: 'IRI', value: 'o', line: 1 },
                     { type: '.', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize an inverted predicate marker outside N3 mode',
      shouldNotTokenize(new Lexer({ n3: false }), '<- ', 'Unexpected "<-" on line 1.'),
    );

    it(
      'should tokenize a split left implication',
      shouldTokenize(streamOf('<a> <', '= <b> '),
        { type: 'IRI', value: 'a', line: 1 },
        { type: 'inverse', value: '>', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it('should tokenize a split left implication as inverse of [=>] when isImpliedBy is disabled',
    shouldTokenize(new Lexer({ isImpliedBy: false }), streamOf('<a> <', '= <b> '),
        { type: 'IRI', value: 'a', line: 1 },
        { type: 'inverse', value: '>', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'eof', line: 1 }));

    it('should tokenize a left implication as inverse of [=>] when isImpliedBy is disabled',
    shouldTokenize(new Lexer({ isImpliedBy: false }), streamOf('<a> <= <b> '),
        { type: 'IRI', value: 'a', line: 1 },
        { type: 'inverse', value: '>', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'eof', line: 1 }));

    it(
      'should tokenize paths',
      shouldTokenize(':joe!fam:mother!loc:office!loc:zip :joe!fam:mother^fam:mother',
                     { type: 'prefixed', prefix: '', value: 'joe', line: 1 },
                     { type: '!', line: 1 },
                     { type: 'prefixed', prefix: 'fam', value: 'mother', line: 1 },
                     { type: '!', line: 1 },
                     { type: 'prefixed', prefix: 'loc', value: 'office', line: 1 },
                     { type: '!', line: 1 },
                     { type: 'prefixed', prefix: 'loc', value: 'zip', line: 1 },

                     { type: 'prefixed', prefix: '', value: 'joe', line: 1 },
                     { type: '!', line: 1 },
                     { type: 'prefixed', prefix: 'fam', value: 'mother', line: 1 },
                     { type: '^', line: 1 },
                     { type: 'prefixed', prefix: 'fam', value: 'mother', line: 1 },
                     { type: 'eof', line: 1 }),
    );

    it(
      'should not tokenize an invalid document',
      shouldNotTokenize(' \n @!', 'Unexpected "@!" on line 2.'),
    );

    it('does not call setEncoding if not available', () => {
      expect(() => new Lexer().tokenize({ on: function () {} })).not.toThrow();
    });

    it('should tokenize an TripleTerm start', shouldTokenize('<<(',
        { type: '<<(', line: 1 }, { type: 'eof', line: 1 }));

    it(
        'should tokenize a split TripleTerm start',
        shouldTokenize(streamOf('<', '<', '('),
            { type: '<<(', line: 1 }, { type: 'eof', line: 1 }),
    );

    it('should tokenize an TripleTerm end', shouldTokenize(')>>',
        { type: ')>>', line: 1 }, { type: 'eof', line: 1 }));

    it(
        'should tokenize a split TripleTerm end',
        shouldTokenize(streamOf(')', '>', '>'),
            { type: ')>>', line: 1 }, { type: 'eof', line: 1 }),
    );

    it('should tokenize an empty TripleTerm', shouldTokenize('<<( )>>',
        { type: '<<(', line: 1 },
        { type: ')>>', line: 1 },
        { type: 'eof', line: 1 }));

    it('should tokenize an ReifiedTriple start', shouldTokenize('<<',
      { type: '<<', line: 1 }, { type: 'eof', line: 1 }));

    it('should not tokenize an ReifiedTriple start in line mode',
        shouldNotTokenize(new Lexer({ lineMode: true }), '<<',
            'Unexpected "<<" on line 1.'));

    it(
      'should tokenize a split ReifiedTriple start',
      shouldTokenize(streamOf('<', '<'),
        { type: '<<', line: 1 }, { type: 'eof', line: 1 }),
    );

    it('should tokenize an ReifiedTriple end', shouldTokenize('>>',
      { type: '>>', line: 1 }, { type: 'eof', line: 1 }));

    it(
        'should tokenize a split ReifiedTriple end',
        shouldTokenize(streamOf('>', '>'),
            { type: '>>', line: 1 }, { type: 'eof', line: 1 }),
    );

    it('should tokenize an empty ReifiedTriple', shouldTokenize('<< >>',
      { type: '<<', line: 1 },
      { type: '>>', line: 1 },
      { type: 'eof', line: 1 }));

    it('should tokenize tilde', shouldTokenize('~',
        { type: '~', line: 1 }, { type: 'eof', line: 1 }));

    it(
        'should tokenize an reified triple with simplified IRIs and variable',
        shouldTokenize('<<<a> <b> <c> ~ ?reifier>> <b> <c>.',
            { type: '<<', line: 1 },
            { type: 'IRI', value: 'a', line: 1 },
            { type: 'IRI', value: 'b', line: 1 },
            { type: 'IRI', value: 'c', line: 1 },
            { type: '~', line: 1 },
            { type: 'var', value: '?reifier', line: 1 },
            { type: '>>', line: 1 },
            { type: 'IRI', value: 'b', line: 1 },
            { type: 'IRI', value: 'c', line: 1 },
            { type: '.', line: 1 },
            { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an reified triple with IRIs',
      shouldTokenize('<<<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo>>> .',
        { type: '<<', line: 1 },
        { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
        { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 2 },
        { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 3 },
        { type: '>>', line: 3 },
        { type: '.', line: 3 },
        { type: 'eof', line: 3 }),
    );

    it(
        'should tokenize an reified triple with IRIs and IRI reifier',
        shouldTokenize('<<<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> ~ <http://ex.org/?bla#ba>>> .',
            { type: '<<', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 2 },
            { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 3 },
            { type: '~', line: 3 },
            { type: 'IRI', value: 'http://ex.org/?bla#ba', line: 3 },
            { type: '>>', line: 3 },
            { type: '.', line: 3 },
            { type: 'eof', line: 3 }),
    );

    it(
        'should tokenize an reified triple with IRIs and blank node reifier',
        shouldTokenize('<<<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> ~ _:ba>> .',
            { type: '<<', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 2 },
            { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 3 },
            { type: '~', line: 3 },
            { type: 'blank', prefix: '_', value: 'ba', line: 3 },
            { type: '>>', line: 3 },
            { type: '.', line: 3 },
            { type: 'eof', line: 3 }),
    );

    it(
        'should tokenize an triple term with IRIs',
        shouldTokenize('<<(<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo>)>> .',
            { type: '<<(', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 2 },
            { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 3 },
            { type: ')>>', line: 3 },
            { type: '.', line: 3 },
            { type: 'eof', line: 3 }),
    );

    it('should tokenize an reified annotated statement',
    shouldTokenize('<a> <b> <c> {| <d> <e> |}',
      { type: 'IRI', value: 'a', line: 1 },
      { type: 'IRI', value: 'b', line: 1 },
      { type: 'IRI', value: 'c', line: 1 },
      { type: '{|', line: 1 },
      { type: 'IRI', value: 'd', line: 1 },
      { type: 'IRI', value: 'e', line: 1 },
      { type: '|}', line: 1 },
      { type: 'eof', line: 1 }));

    it('should tokenize an reified annotated statement with multiple annotations',
    shouldTokenize('<a> <b> <c> {| <d> <e>; <f> <g> |}',
      { type: 'IRI', value: 'a', line: 1 },
      { type: 'IRI', value: 'b', line: 1 },
      { type: 'IRI', value: 'c', line: 1 },
      { type: '{|', line: 1 },
      { type: 'IRI', value: 'd', line: 1 },
      { type: 'IRI', value: 'e', line: 1 },
      { type: ';', line: 1 },
      { type: 'IRI', value: 'f', line: 1 },
      { type: 'IRI', value: 'g', line: 1 },
      { type: '|}', line: 1 },
      { type: 'eof', line: 1 }));

    it('should tokenize an reified annotated statement with multiple annotations, one containing a blank node',
    shouldTokenize('<a> <b> <c> {| <d> [ <e> "f" ]; <f> <g> |}',
      { type: 'IRI', value: 'a', line: 1 },
      { type: 'IRI', value: 'b', line: 1 },
      { type: 'IRI', value: 'c', line: 1 },
      { type: '{|', line: 1 },
      { type: 'IRI', value: 'd', line: 1 },
      { type: '[',   value: '', line: 1 },
      { type: 'IRI', value: 'e', line: 1 },
      { type: 'literal', value: 'f', line: 1 },
      { type: ']',   value: '', line: 1 },
      { type: ';', line: 1 },
      { type: 'IRI', value: 'f', line: 1 },
      { type: 'IRI', value: 'g', line: 1 },
      { type: '|}', line: 1 },
      { type: 'eof', line: 1 }));

    it('should not tokenize an annotated statement that is not closed',
    shouldNotTokenize('<a> <b> <c> {| <d> [ <e> "f" ]; <f> <g> |',
      'Unexpected "|" on line 1.'));

    it(
      'should not tokenize a wrongly closed reified triple with IRIs',
      shouldNotTokenize('<<<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo>> .',
        'Unexpected ">" on line 3.'),
    );

    it(
        'should not tokenize a wrongly closed triple term with IRIs',
        shouldNotTokenize('<<(<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo>)> .',
            'Unexpected ">" on line 3.'),
    );

    it(
        'should tokenize a split reified triple with IRIs',
        shouldTokenize(streamOf('<', '<(<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo>)>> .'),
            { type: '<<(', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
            { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 2 },
            { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 3 },
            { type: ')>>', line: 3 },
            { type: '.', line: 3 },
            { type: 'eof', line: 3 }),
    );

    it(
      'should tokenize a split triple term with IRIs',
      shouldTokenize(streamOf('<', '<<http://ex.org/?bla#foo> \n\t<http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo>>> .'),
        { type: '<<', line: 1 },
        { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
        { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 2 },
        { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 3 },
        { type: '>>', line: 3 },
        { type: '.', line: 3 },
        { type: 'eof', line: 3 }),
    );

    it(
      'should tokenize an reified triple with string literals',
      shouldTokenize('<<"string"@en "string"@nl-be "string"@EN>> .',
        { type: '<<', line: 1 },
        { type: 'literal', value: 'string', line: 1 },
        { type: 'langcode', value: 'en', line: 1 },
        { type: 'literal', value: 'string', line: 1 },
        { type: 'langcode', value: 'nl-be', line: 1 },
        { type: 'literal', value: 'string', line: 1 },
        { type: 'langcode', value: 'EN', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
        'should tokenize an triple term with string literals',
        shouldTokenize('<<("string"@en "string"@nl-be "string"@EN)>> .',
            { type: '<<(', line: 1 },
            { type: 'literal', value: 'string', line: 1 },
            { type: 'langcode', value: 'en', line: 1 },
            { type: 'literal', value: 'string', line: 1 },
            { type: 'langcode', value: 'nl-be', line: 1 },
            { type: 'literal', value: 'string', line: 1 },
            { type: 'langcode', value: 'EN', line: 1 },
            { type: ')>>', line: 1 },
            { type: '.', line: 1 },
            { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an reified triple with integers',
      shouldTokenize('<<1 2 3>>.',
        { type: '<<', line: 1 },
        { type: 'literal', value: '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
        { type: 'literal', value: '2', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
        { type: 'literal', value: '3', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
        'should tokenize an triple term with integers',
        shouldTokenize('<<(1 2 3)>>.',
            { type: '<<(', line: 1 },
            { type: 'literal', value: '1', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
            { type: 'literal', value: '2', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
            { type: 'literal', value: '3', prefix: 'http://www.w3.org/2001/XMLSchema#integer', line: 1 },
            { type: ')>>', line: 1 },
            { type: '.', line: 1 },
            { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an reified triple with decimals',
      shouldTokenize('<<1.2 3.4 5.6>>.',
        { type: '<<', line: 1 },
        { type: 'literal', value: '1.2', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
        { type: 'literal', value: '3.4', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
        { type: 'literal', value: '5.6', prefix: 'http://www.w3.org/2001/XMLSchema#decimal', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an reified triple with booleans',
      shouldTokenize('<<true false true>>.',
        { type: '<<', line: 1 },
        { type: 'literal', value: 'true',  prefix: 'http://www.w3.org/2001/XMLSchema#boolean', line: 1 },
        { type: 'literal', value: 'false', prefix: 'http://www.w3.org/2001/XMLSchema#boolean', line: 1 },
        { type: 'literal', value: 'true',  prefix: 'http://www.w3.org/2001/XMLSchema#boolean', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a prefixed iri followed by the end of a ReifiedTriple',
      shouldTokenize('c:c>> .',
        { type: 'prefixed', prefix: 'c', value: 'c', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a reified triple with prefixed names',
      shouldTokenize('<<a:a b:b c:c>> .',
        { type: '<<', line: 1 },
        { type: 'prefixed', prefix: 'a', value: 'a', line: 1 },
        { type: 'prefixed', prefix: 'b', value: 'b', line: 1 },
        { type: 'prefixed', prefix: 'c', value: 'c', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a reified triple with blank nodes',
      shouldTokenize('<<_:a _:b _:c>> .',
        { type: '<<', line: 1 },
        { type: 'blank', prefix: '_', value: 'a', line: 1 },
        { type: 'blank', prefix: '_', value: 'b', line: 1 },
        { type: 'blank', prefix: '_', value: 'c', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a reified triple with variables',
      shouldTokenize('<<?a ?b ?c>> .',
        { type: '<<', line: 1 },
        { type: 'var', value: '?a', line: 1 },
        { type: 'var', value: '?b', line: 1 },
        { type: 'var', value: '?c', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a reified triple of an IRI, a language-tagged literal, and a prefixed name',
      shouldTokenize('<<<http://ex.org/?bla#foo> "string"@nl-be c:c>> .',
        { type: '<<', line: 1 },
        { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
        { type: 'literal', value: 'string', line: 1 },
        { type: 'langcode', value: 'nl-be', line: 1 },
        { type: 'prefixed', prefix: 'c', value: 'c', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a reified triple of a blank node, a prefixed name, and a language-tagged literal',
      shouldTokenize('<<_:a a:a "string"@EN>> .',
        { type: '<<', line: 1 },
        { type: 'blank', prefix: '_', value: 'a', line: 1 },
        { type: 'prefixed', prefix: 'a', value: 'a', line: 1 },
        { type: 'literal', value: 'string', line: 1 },
        { type: 'langcode', value: 'EN', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a reified triple of a language-tagged literal, an IRI, and a blank node',
      shouldTokenize('<<"literal"@AU <http://ex.org/?bla#foo> _:a>> .',
        { type: '<<', line: 1 },
        { type: 'literal', value: 'literal', line: 1 },
        { type: 'langcode', value: 'AU', line: 1 },
        { type: 'IRI', value: 'http://ex.org/?bla#foo', line: 1 },
        { type: 'blank', prefix: '_', value: 'a', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize reified triples with shared subjects',
      shouldTokenize('<<<a> <b> <c>;\n<d> <e>>>.',
        { type: '<<', line: 1 },
        { type: 'IRI', value: 'a', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'IRI', value: 'c', line: 1 },
        { type: ';', line: 1 },
        { type: 'IRI', value: 'd', line: 2 },
        { type: 'IRI', value: 'e', line: 2 },
        { type: '>>', line: 2 },
        { type: '.', line: 2 },
        { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize reified triples with shared subjects and predicates',
      shouldTokenize('<<<a> <b> <c>,\n<d>>>.',
        { type: '<<', line: 1 },
        { type: 'IRI', value: 'a', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'IRI', value: 'c', line: 1 },
        { type: ',', line: 1 },
        { type: 'IRI', value: 'd', line: 2 },
        { type: '>>', line: 2 },
        { type: '.', line: 2 },
        { type: 'eof', line: 2 }),
    );

    it(
      'should tokenize an reified triples with shared subjects and predicates and prefixed names',
      shouldTokenize('<<a:a b:b c:c;d:d e:e,f:f>> .',
        { type: '<<', line: 1 },
        { type: 'prefixed', prefix: 'a', value: 'a', line: 1 },
        { type: 'prefixed', prefix: 'b', value: 'b', line: 1 },
        { type: 'prefixed', prefix: 'c', value: 'c', line: 1 },
        { type: ';', line: 1 },
        { type: 'prefixed', prefix: 'd', value: 'd', line: 1 },
        { type: 'prefixed', prefix: 'e', value: 'e', line: 1 },
        { type: ',', line: 1 },
        { type: 'prefixed', prefix: 'f', value: 'f', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a ReifiedTriple followed by other tokens',
      shouldTokenize('<<_:a <b> "lit"@EN>> _:a b:b.',
        { type: '<<', line: 1 },
        { type: 'blank', prefix: '_', value: 'a', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'literal', value: 'lit', line: 1 },
        { type: 'langcode', value: 'EN', line: 1 },
        { type: '>>', line: 1 },
        { type: 'blank', prefix: '_', value: 'a', line: 1 },
        { type: 'prefixed', prefix: 'b', value: 'b', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a ReifiedTriple preceded by other tokens',
      shouldTokenize('"lit"@DE _:b <<_:a b:b "lit"@EN>>.',
        { type: 'literal', value: 'lit', line: 1 },
        { type: 'langcode', value: 'DE', line: 1 },
        { type: 'blank', prefix: '_', value: 'b', line: 1 },
        { type: '<<', line: 1 },
        { type: 'blank', prefix: '_', value: 'a', line: 1 },
        { type: 'prefixed', prefix: 'b', value: 'b', line: 1 },
        { type: 'literal', value: 'lit', line: 1 },
        { type: 'langcode', value: 'EN', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a nested ReifiedTriple as subject in a statement',
      shouldTokenize('<<<<_:b <b> "lit"@DE>> <a> "lit"@EN>>.',
        { type: '<<', line: 1 },
        { type: '<<', line: 1 },
        { type: 'blank', prefix: '_', value: 'b', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'literal', value: 'lit', line: 1 },
        { type: 'langcode', value: 'DE', line: 1 },
        { type: '>>', line: 1 },
        { type: 'IRI', value: 'a', line: 1 },
        { type: 'literal', value: 'lit', line: 1 },
        { type: 'langcode', value: 'EN', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a nested ReifiedTriple as object in a statement',
      shouldTokenize('<<a:a _:a <<_:b <b> "lit"@DE>>>>.',
        { type: '<<', line: 1 },
        { type: 'prefixed', prefix: 'a', value: 'a', line: 1 },
        { type: 'blank', prefix: '_', value: 'a', line: 1 },
        { type: '<<', line: 1 },
        { type: 'blank', prefix: '_', value: 'b', line: 1 },
        { type: 'IRI', value: 'b', line: 1 },
        { type: 'literal', value: 'lit', line: 1 },
        { type: 'langcode', value: 'DE', line: 1 },
        { type: '>>', line: 1 },
        { type: '>>', line: 1 },
        { type: '.', line: 1 },
        { type: 'eof', line: 1 }),
    );

    it('should tokenize a quoted triple annotation start', shouldTokenize('{|',
        { type: '{|', line: 1 },
        { type: 'eof', line: 1 }));

    it(
      'should tokenize a split quoted triple annotation start',
      shouldTokenize(streamOf('{', '|'),
          { type: '{|', line: 1 },
          { type: 'eof', line: 1 }),
    );

    it('should tokenize a quoted triple annotation end', shouldTokenize('|}',
        { type: '|}', line: 1 },
        { type: 'eof', line: 1 }));

    it(
      'should tokenize a split quoted triple annotation end',
      shouldTokenize(streamOf('|', '}'),
          { type: '|}', line: 1 },
          { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize an empty quoted triple annotation',
      shouldTokenize('{| |}',
          { type: '{|', line: 1 },
          { type: '|}', line: 1 },
          { type: 'eof', line: 1 }),
    );

    it(
      'should tokenize a non-empty quoted triple annotation',
      shouldTokenize('{| <http://ex.org/?bla#bar> \n\t<http://ex.org/?bla#boo> |}.',
          { type: '{|', line: 1 },
          { type: 'IRI', value: 'http://ex.org/?bla#bar', line: 1 },
          { type: 'IRI', value: 'http://ex.org/?bla#boo', line: 2 },
          { type: '|}', line: 2 },
          { type: '.', line: 2 },
          { type: 'eof', line: 2 }),
    );

    it(
      'should not tokenize an incomplete closing triple annotation',
      shouldNotTokenize('{| |',
          'Unexpected "|" on line 1.'),
    );

    it(
      'should not tokenize an invalid closing triple annotation',
      shouldNotTokenize('{| ||',
          'Unexpected "||" on line 1.'),
    );

    it('returns start and end index for every token', () => {
      const tokens = new Lexer().tokenize('<a:a> <b:c> "lit"@EN.');
      expect(tokens).toEqual([
        { line: 1, prefix: '', type: 'IRI', value: 'a:a', start: 0, end: 5 },
        { line: 1, prefix: '', type: 'IRI', value: 'b:c', start: 6, end: 11 },
        { line: 1, prefix: '', type: 'literal', value: 'lit', start: 12, end: 17 },
        { line: 1, prefix: '', type: 'langcode', value: 'EN', start: 17, end: 20 },
        { line: 1, prefix: '', type: '.', value: '', start: 20, end: 21 },
        { line: 1, prefix: '', type: 'eof', value: '', start: 21, end: 21 },
      ]);
    });

    it('returns start and end index relative to the physical line', () => {
      const tokens = new Lexer().tokenize('<a:a> <b:c> "lit"@EN ; \n <b:d> <d:e> .');
      expect(tokens).toEqual([
        { line: 1, prefix: '', type: 'IRI', value: 'a:a', start: 0, end: 5 },
        { line: 1, prefix: '', type: 'IRI', value: 'b:c', start: 6, end: 11 },
        { line: 1, prefix: '', type: 'literal', value: 'lit', start: 12, end: 17 },
        { line: 1, prefix: '', type: 'langcode', value: 'EN', start: 17, end: 20 },
        { line: 1, prefix: '', type: ';', value: '', start: 21, end: 22 },
        { line: 2, prefix: '', type: 'IRI', value: 'b:d', start: 1, end: 6 },
        { line: 2, prefix: '', type: 'IRI', value: 'd:e', start: 7, end: 12 },
        { line: 2, prefix: '', type: '.', value: '', start: 13, end: 14 },
        { line: 2, prefix: '', type: 'eof', value: '', start: 14, end: 14 },
      ]);
    });

    it('counts a byte-order mark in physical source columns', () => {
      const tokens = new Lexer().tokenize('\ufeff<a>\n  <b>')
        .filter(token => token.type === 'IRI');
      expect(tokens).toEqual([
        { line: 1, prefix: '', type: 'IRI', value: 'a', start: 1, end: 4 },
        { line: 2, prefix: '', type: 'IRI', value: 'b', start: 2, end: 5 },
      ]);
    });

    it.each([
      ['LF', '<s> <p> """a\nb""" .', 'a\nb'],
      ['CRLF', '<s> <p> """a\r\nb""" .', 'a\r\nb'],
      ['CR', '<s> <p> """a\rb""" .', 'a\rb'],
    ])('returns line-relative indexes after a multiline literal with %s', (_, input, value) => {
      const tokens = new Lexer().tokenize(input);
      expect(tokens.filter(token => token.type === 'literal' || token.type === '.' || token.type === 'eof')).toEqual([
        { line: 1, endLine: 2, prefix: '', type: 'literal', value, start: 8, end: 4 },
        { line: 2, prefix: '', type: '.', value: '', start: 5, end: 6 },
        { line: 2, prefix: '', type: 'eof', value: '', start: 6, end: 6 },
      ]);
    });

    it('keeps line-relative indexes when a stream splits after a multiline literal', () => {
      const stream = new EventEmitter(), tokens = [];
      new Lexer().tokenize(stream, (error, token) => {
        expect(error).toBeNull();
        tokens.push(token);
      });
      stream.emit('data', '<s> <p> """a\nb"""');
      stream.emit('data', ' .');
      stream.emit('end');
      expect(tokens.filter(token => token.type === '.' || token.type === 'eof')).toEqual([
        { line: 2, prefix: '', type: '.', value: '', start: 5, end: 6 },
        { line: 2, prefix: '', type: 'eof', value: '', start: 6, end: 6 },
      ]);
    });

    it('counts CRLF split across stream chunks as one line ending', () => {
      const stream = new EventEmitter(), tokens = [];
      new Lexer().tokenize(stream, (error, token) => {
        expect(error).toBeNull();
        tokens.push(token);
      });
      stream.emit('data', '<s> <p> <o> .\r');
      stream.emit('data', '\n  <s2> <p2> <o2> .');
      stream.emit('end');
      expect(tokens.find(token => token.value === 's2')).toMatchObject({
        line: 2,
        start: 2,
        end: 6,
      });
    });

    it('keeps comment coordinates stable across CRLF stream boundaries', () => {
      const input = '# hi\r\n\t<s> <p> <o> .',
          expected = new Lexer({ comments: true }).tokenize(input);
      for (const split of [input.indexOf('\r'), input.indexOf('\r') + 1, input.indexOf('\n') + 1]) {
        const stream = new EventEmitter(), tokens = [];
        new Lexer({ comments: true }).tokenize(stream, (error, token) => {
          expect(error).toBeNull();
          tokens.push(token);
        });
        stream.emit('data', input.slice(0, split));
        stream.emit('data', input.slice(split));
        stream.emit('end');
        expect(tokens).toEqual(expected);
      }
    });

    it('does not include synthetic EOF lookahead in token ranges', () => {
      expect(new Lexer().tokenize('_:x')[0]).toMatchObject({ start: 0, end: 3 });
      expect(new Lexer().tokenize('ex:x')[0]).toMatchObject({ start: 0, end: 4 });
    });

    it('returns lexical indexes around whitespace', () => {
      const tokens = new Lexer().tokenize('<a:a>   <b:c>    <d:e>  .');
      expect(tokens).toEqual([
        { line: 1, prefix: '', type: 'IRI', value: 'a:a', start: 0, end: 5 },
        { line: 1, prefix: '', type: 'IRI', value: 'b:c', start: 8, end: 13 },
        { line: 1, prefix: '', type: 'IRI', value: 'd:e', start: 17, end: 22 },
        { line: 1, prefix: '', type: '.', value: '', start: 24, end: 25 },
        { line: 1, prefix: '', type: 'eof', value: '', start: 25, end: 25 },
      ]);
    });

    it.each(['<abc>', '<a\\u0062>', '<😀>', '_:blank', 'ex:a\\~b', ':'])(
      'counts separators after %s towards the next token start across stream boundaries', raw => {
        for (const [separator, nextLine, nextStart] of [
          [' \t  ', 1, raw.length + 6],
          [' \t\n \t ', 2, 3],
          [' \t\r \t ', 2, 3],
          [' \t\r\n \t ', 2, 3],
        ]) {
          const input = `  ${raw}${separator}<next>`,
              expected = new Lexer().tokenize(input);
          expect(expected[0]).toMatchObject({ line: 1, start: 2, end: raw.length + 2 });
          expect(input.slice(expected[0].start, expected[0].end)).toBe(raw);
          expect(expected[1]).toMatchObject({ line: nextLine, start: nextStart, end: nextStart + 6 });
          expect(expected[2]).toMatchObject({ type: 'eof', line: nextLine, start: nextStart + 6, end: nextStart + 6 });

          for (let split = 0; split <= input.length; split++) {
            const stream = new EventEmitter(), tokens = [];
            new Lexer().tokenize(stream, (error, token) => {
              expect(error).toBeNull();
              tokens.push(token);
            });
            stream.emit('data', input.slice(0, split));
            stream.emit('data', input.slice(split));
            stream.emit('end');
            expect(tokens).toEqual(expected);
          }
        }
      },
    );

    it('returns index for comments and eof', () => {
      const tokens = new Lexer({ comments: true }).tokenize('# some\n<a:a> <b:b> <c:c> . # trailing comment\n# thing');
      expect(tokens).toEqual([
        { line: 1, prefix: '', type: 'comment', value: ' some', start: 0, end: 6 },
        { line: 2, prefix: '', type: 'IRI', value: 'a:a', start: 0, end: 5 },
        { line: 2, prefix: '', type: 'IRI', value: 'b:b', start: 6, end: 11 },
        { line: 2, prefix: '', type: 'IRI', value: 'c:c', start: 12, end: 17 },
        { line: 2, prefix: '', type: '.', value: '', start: 18, end: 19 },
        { line: 2, prefix: '', type: 'comment', value: ' trailing comment', start: 20, end: 38 },
        { line: 3, prefix: '', type: 'comment', value: ' thing', start: 0, end: 7 },
        { line: 3, prefix: '', type: 'eof', value: '', start: 7, end: 7 },
      ]);
    });

    it.each([
      ['"a\\"b"', 'a"b'],
      ["'a\\'b'", "a'b"],
      ['"""a""b\nc"""', 'a""b\nc'],
      ["'''a''b\nc'''", "a''b\nc"],
      ['""""""', ''],
      ["''''''", ''],
    ])('recognizes the literal delimiter across every split of %s', (input, value) => {
      for (let split = 0; split <= input.length; split++) {
        const stream = new EventEmitter(), tokens = [];
        new Lexer().tokenize(stream, (error, token) => {
          expect(error).toBeNull();
          tokens.push({ type: token.type, value: token.value });
        });
        stream.emit('data', input.slice(0, split));
        stream.emit('data', input.slice(split));
        stream.emit('end');
        expect(tokens).toEqual([
          { type: 'literal', value },
          { type: 'eof', value: '' },
        ]);
      }
    });

    it.each([
      [false, 'ltr'], [false, 'rtl'], [true, 'ltr'], [true, 'rtl'],
    ])('recognizes direction %s / %s across stream splits', (lineMode, direction) => {
      const input = `"hello"@en--${direction}`;
      for (let split = 0; split <= input.length; split++) {
        const stream = new EventEmitter(), tokens = [];
        new Lexer({ lineMode }).tokenize(stream, (error, token) => {
          expect(error).toBeNull();
          tokens.push({ type: token.type, value: token.value });
        });
        stream.emit('data', input.slice(0, split));
        stream.emit('data', input.slice(split));
        stream.emit('end');
        expect(tokens).toEqual([
          { type: 'literal', value: 'hello' },
          { type: 'langcode', value: 'en' },
          { type: 'dircode', value: direction },
          { type: 'eof', value: '' },
        ]);
      }
    });

    it.each([false, true])('keeps separator tokens across stream splits with comments=%s', comments => {
      const input = '\t# first\n \t#\r  <s>\n\t# final';
      const expected = [
        { type: 'comment', value: ' first', prefix: '', line: 1 },
        { type: 'comment', value: '', prefix: '', line: 2 },
        { type: 'IRI', value: 's', prefix: '', line: 3 },
        { type: 'comment', value: ' final', prefix: '', line: 4 },
        { type: 'eof', value: '', prefix: '', line: 4 },
      ].filter(token => comments || token.type !== 'comment');
      for (let split = 0; split <= input.length; split++) {
        const stream = new EventEmitter(), tokens = [];
        new Lexer({ comments }).tokenize(stream, (error, token) => {
          expect(error).toBeNull();
          const { type, value, prefix, line } = token;
          tokens.push({ type, value, prefix, line });
        });
        stream.emit('data', input.slice(0, split));
        stream.emit('data', input.slice(split));
        stream.emit('end');
        expect(tokens).toEqual(expected);
      }
    });

    it.each([false, true])('keeps separator ranges across every split with comments=%s', comments => {
      const input = '\t# first\r\n \t#\r  <s>\n\t# final';
      const expected = [
        { type: 'comment', value: ' first', prefix: '', line: 1, start: 1, end: 8 },
        { type: 'comment', value: '', prefix: '', line: 2, start: 2, end: 3 },
        { type: 'IRI', value: 's', prefix: '', line: 3, start: 2, end: 5 },
        { type: 'comment', value: ' final', prefix: '', line: 4, start: 1, end: 8 },
        { type: 'eof', value: '', prefix: '', line: 4, start: 8, end: 8 },
      ].filter(token => comments || token.type !== 'comment');
      expect(new Lexer({ comments }).tokenize(input)).toEqual(expected);
      for (let split = 0; split <= input.length; split++) {
        const stream = new EventEmitter(), tokens = [];
        new Lexer({ comments }).tokenize(stream, (error, token) => {
          expect(error).toBeNull();
          tokens.push(token);
        });
        stream.emit('data', input.slice(0, split));
        stream.emit('data', input.slice(split));
        stream.emit('end');
        expect(tokens).toEqual(expected);
      }
    });

    it('retains columns across consecutive whitespace-only chunks', () => {
      const stream = new EventEmitter(), tokens = [];
      new Lexer().tokenize(stream, (error, token) => {
        expect(error).toBeNull();
        tokens.push(token);
      });
      for (const chunk of [' ', '\t', ' ', '<s>', '\r', '\n', ' ', '\t', ' ', '<t>'])
        stream.emit('data', chunk);
      stream.emit('end');
      expect(tokens).toEqual([
        { type: 'IRI', value: 's', prefix: '', line: 1, start: 3, end: 6 },
        { type: 'IRI', value: 't', prefix: '', line: 2, start: 3, end: 6 },
        { type: 'eof', value: '', prefix: '', line: 2, start: 6, end: 6 },
      ]);
    });

    it('waits for a potentially split CRLF before emitting a comment', () => {
      const stream = new EventEmitter(), tokens = [];
      new Lexer({ comments: true }).tokenize(stream, (error, token) => {
        expect(error).toBeNull();
        tokens.push(token);
      });
      stream.emit('data', '# a\r');
      expect(tokens).toEqual([]);
      stream.emit('data', '\n');
      expect(tokens).toEqual([
        { type: 'comment', value: ' a', prefix: '', line: 1, start: 0, end: 3 },
      ]);
      stream.emit('end');
      expect(tokens[1]).toEqual({ type: 'eof', value: '', prefix: '', line: 2, start: 0, end: 0 });
    });

    describe('passing data after the stream has been finished', () => {
      const tokens = [];
      let error;
      beforeAll(() => {
        const stream = new EventEmitter(), lexer = new Lexer();
        lexer.tokenize(stream, (err, token) => {
          if (err)
            error = err;
          else
            tokens.push(token);
        });
        stream.emit('data', '<a> ');
        stream.emit('end');
        stream.emit('data', '<b> ');
        stream.emit('end');
      });

      it('parses only the first chunk (plus EOF)', () => {
        expect(tokens).toHaveLength(2);
      });

      it('does not emit an error', () => {
        expect(error).toBeFalsy();
      });
    });

    describe('passing data after a syntax error', () => {
      const tokens = [];
      let error;
      beforeAll(() => {
        const stream = new EventEmitter(), lexer = new Lexer();
        lexer.tokenize(stream, (err, token) => {
          if (err)
            error = err;
          else
            tokens.push(token);
        });
        stream.emit('data', '<a> ');
        stream.emit('data', ' error ');
        stream.emit('end');
        stream.emit('data', '<b> ');
        stream.emit('end');
      });

      it('parses only the first chunk', () => {
        expect(tokens).toHaveLength(1);
      });

      it('emits the error', () => {
        expect(error).toBeDefined();
        expect(error).toHaveProperty('message', 'Unexpected "error" on line 1.');
      });
    });

    describe('when the stream errors', () => {
      const tokens = [];
      let error;
      beforeAll(() => {
        const stream = new EventEmitter(), lexer = new Lexer();
        lexer.tokenize(stream, (err, token) => {
          if (err)
            error = err;
          else
            tokens.push(token);
        });
        stream.emit('error', new Error('my error'));
      });

      it('passes the error', () => {
        expect(error).toBeDefined();
        expect(error).toHaveProperty('message', 'my error');
      });
    });

    describe('called with a string and without callback', () => {
      const lexer = new Lexer(),
          tokens = lexer.tokenize('<a> <b> <c>.');

      it('returns all tokens synchronously', () => {
        expect(tokens).toEqual([
          { line: 1, type: 'IRI', value: 'a', prefix: '', start: 0,  end:  3 },
          { line: 1, type: 'IRI', value: 'b', prefix: '', start: 4,  end:  7 },
          { line: 1, type: 'IRI', value: 'c', prefix: '', start: 8,  end: 11 },
          { line: 1, type: '.',   value: '',  prefix: '', start: 11, end: 12 },
          { line: 1, type: 'eof', value: '',  prefix: '', start: 12, end: 12 },
        ]);
      });
    });

    describe('called with an erroneous string and without callback', () => {
      const lexer = new Lexer();

      it('throws an error', () => {
        expect((() => { lexer.tokenize('<a> bar'); })).toThrow('Unexpected "bar" on line 1.');
      });
    });

    it.each(['asynchronous', 'synchronous'])('ignores a queued tokenizer superseded by %s string input', mode => {
      jest.useFakeTimers();
      try {
        const lexer = new Lexer(), previousCallback = jest.fn(), nextCallback = jest.fn(),
            expected = new Lexer().tokenize('<new>');
        lexer.tokenize('<old>', previousCallback);
        const result = lexer.tokenize('<new>', mode === 'asynchronous' ? nextCallback : undefined);

        expect(() => jest.runAllTicks()).not.toThrow();
        expect(previousCallback).not.toHaveBeenCalled();
        expect(result).toEqual(mode === 'asynchronous' ? undefined : expected);
        expect(nextCallback.mock.calls).toEqual(mode === 'asynchronous' ? expected.map(token => [null, token]) : []);
      }
      finally {
        jest.useRealTimers();
      }
    });

    describe.each(['syntax error', 'stream error', 'end'])('reusing a lexer after %s', outcome => {
      it.each(['data', 'end', 'error'])('ignores later %s events from the previous stream', event => {
        jest.useFakeTimers();
        try {
          const lexer = new Lexer(), stream = new EventEmitter(),
              previousCallback = jest.fn(), nextCallback = jest.fn();
          lexer.tokenize(stream, previousCallback);
          if (outcome === 'syntax error')
            stream.emit('data', '@\n');
          else if (outcome === 'stream error')
            stream.emit('error', new Error('source failed'));
          else {
            stream.emit('data', '<old>');
            stream.emit('end');
          }
          const previousCalls = previousCallback.mock.calls.slice();
          expect(previousCalls.length).toBeGreaterThan(0);

          // String tokenization is deferred, so the old source can still emit
          // events while the lexer holds the new input.
          lexer.tokenize('<new>', nextCallback);
          stream.emit(event, event === 'error' ? new Error('late error') : '<stale>');
          expect(() => jest.runAllTicks()).not.toThrow();

          expect(nextCallback.mock.calls).toEqual(new Lexer().tokenize('<new>')
            .map(token => [null, token]));
          expect(previousCallback.mock.calls).toEqual(previousCalls);
        }
        finally {
          jest.useRealTimers();
        }
      });
    });

    it('can tokenize another string after a syntax error', () => {
      const lexer = new Lexer();
      expect(() => lexer.tokenize('^^?')).toThrow();
      expect(lexer.tokenize('<a>')[0]).toMatchObject({
        type: 'IRI', value: 'a', line: 1, start: 0, end: 3,
      });
    });

    it('can tokenize a stream after an unterminated literal error', () => {
      const lexer = new Lexer(), stream = new EventEmitter(), tokens = [];
      expect(() => lexer.tokenize('"""this literal never closes')).toThrow();

      lexer.tokenize(stream, (error, token) => {
        expect(error).toBeNull();
        tokens.push(token);
      });
      stream.emit('data', '"""ok"""');
      stream.emit('end');

      expect(tokens).toEqual([
        { type: 'literal', value: 'ok', prefix: '', line: 1, start: 0, end: 8 },
        { type: 'eof', value: '', prefix: '', line: 1, start: 8, end: 8 },
      ]);
    });

    it('does not retain the previous token in a later error', () => {
      const lexer = new Lexer();
      let laterError;
      expect(() => lexer.tokenize('<old> @')).toThrow();
      try {
        lexer.tokenize('@');
      }
      catch (error) {
        laterError = error;
      }
      expect(laterError.context.previousToken).toBeUndefined();
    });
  });
});

describe('A Lexer instance with the n3 option set to false', () => {
  function createLexer() { return new Lexer({ n3: false }); }

  it(
    'should not tokenize a variable',
    shouldNotTokenize(createLexer(), '?a', 'Unexpected "?a" on line 1.'),
  );

  it(
    'should not tokenize a right implication',
    shouldNotTokenize(createLexer(), '<a> => <c>.', 'Unexpected "=>" on line 1.'),
  );

  it(
    'should not tokenize a left implication',
    shouldNotTokenize(createLexer(), '<a> <= <c>.', 'Unexpected "<=" on line 1.'),
  );

  it(
    'should not tokenize an equality',
    shouldNotTokenize(createLexer(), '<a> = <c>.', 'Unexpected "=" on line 1.'),
  );

  it(
    'should not tokenize a ! path',
    shouldNotTokenize(createLexer(), ':joe!fam:mother', 'Unexpected "!fam:mother" on line 1.'),
  );

  it(
    'should not tokenize a ^ path',
    shouldNotTokenize(createLexer(), ':joe^fam:father', 'Unexpected "^fam:father" on line 1.'),
  );
});

describe('A Lexer instance with the comment option set to true', () => {
  function createLexer() { return new Lexer({ comments: true }); }

  it(
    'should tokenize a single comment',
    shouldTokenize(createLexer(), '#mycomment',
                   { type: 'comment', value: 'mycomment', line: 1 },
                   { type: 'eof', line: 1 }),
  );

  it(
    'should tokenize a stream with split comment',
    shouldTokenize(createLexer(), streamOf('#mycom', 'ment'),
                   { type: 'comment', value: 'mycomment', line: 1 },
                   { type: 'eof', line: 1 }),
  );

  it(
    'should tokenize comments',
    shouldTokenize(createLexer(), '<#foo> #mycomment\n <#foo>  #mycomment \r# mycomment\n\n<#bla>#',
                   { type: 'IRI', value: '#foo', line: 1 },
                   { type: 'comment', value: 'mycomment', line: 1 },
                   { type: 'IRI', value: '#foo', line: 2 },
                   { type: 'comment', value: 'mycomment ', line: 2 },
                   { type: 'comment', value: ' mycomment', line: 3 },
                   { type: 'IRI', value: '#bla', line: 5 },
                   { type: 'comment', value: '', line: 5 },
                   { type: 'eof', line: 5 }),
  );
});

function shouldTokenize(lexer, input) {
  const expected = Array.prototype.slice.call(arguments, 1);
  const ignoredAttributes = { start: true, end: true, endLine: true };

  // Shift parameters as necessary
  if (lexer instanceof Lexer)
    expected.shift();
  else
    input = lexer, lexer = new Lexer();

  return function (done) {
    const result = [];
    lexer.tokenize(input, tokenCallback);

    function tokenCallback(error, token) {
      expect(error).toBeFalsy();
      expect(token).toBeDefined();
      const expectedItem = expected[result.length];
      if (expectedItem)
        for (const attribute in token)
          if (typeof expectedItem[attribute] === 'undefined' &&
              (token[attribute] === '' || (ignoredAttributes[attribute])))
            delete token[attribute];
      result.push(token);
      if (token.type === 'eof') {
        expect(result).toEqual(expected);
        done(null, result);
      }
    }
  };
}

function shouldNotTokenize(lexer, input, expectedError) {
  // Shift parameters if necessary
  if (!(lexer instanceof Lexer))
    expectedError = input, input = lexer, lexer = new Lexer();

  return function (done) {
    lexer.tokenize(input, tokenCallback);
    function tokenCallback(error, token) {
      if (error) {
        expect(token).toBeFalsy();
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toEqual(expectedError);
        done();
      }
      else if (token.type === 'eof')
        throw new Error(`Expected error ${expectedError}`);
    }
  };
}

function streamOf() {
  const elements = Array.prototype.slice.call(arguments),
      stream = new EventEmitter();

  stream.setEncoding = function (encoding) {
    if (encoding === 'utf8')
      queueMicrotask(next);
  };

  function next() {
    if (elements.length) {
      const element = elements.shift();
      // use "null" to stall the stream
      if (element !== null) {
        stream.emit('data', element);
        queueMicrotask(next);
      }
    }
    else {
      stream.emit('end');
    }
  }
  return stream;
}
