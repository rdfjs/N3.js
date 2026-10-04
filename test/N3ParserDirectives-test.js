import { Parser, Lexer, StreamParser } from '../src';
import { Readable } from 'readable-stream';
import { EventEmitter } from 'events';

// Parses the input, recording quads and directives in the order they are emitted
function parseEvents(input, options) {
  const events = [], stream = new EventEmitter();
  new Parser({ directives: ['message'], ...options }).parse(stream, {
    onQuad: (error, quad) => {
      if (error) throw error;
      if (quad) events.push(`quad ${quad.object.value}`);
    },
    onDirective: name => events.push(`${name}()`),
  });
  stream.emit('data', input);
  stream.emit('end');
  return events;
}

// Parses the input from a stream with the given chunks
function parseChunks(chunks, options) {
  return new Promise((resolve, reject) => {
    const events = [], input = new EventEmitter();
    new Parser({ directives: ['message'], ...options }).parse(input, {
      onQuad: (error, quad) => {
        if (error) return reject(error);
        if (quad) events.push(`quad ${quad.object.value}`);
        else resolve(events);
      },
      onDirective: name => events.push(name),
    });
    for (const chunk of chunks) input.emit('data', chunk);
    input.emit('end');
  });
}

// Parses the input and returns the error message
function parseError(input, options) {
  try {
    new Parser({ directives: ['message'], ...options }).parse(input);
  }
  catch (error) {
    return error.message;
  }
  throw new Error('Expected a parse error');
}

describe('Parser directives', () => {
  describe('in Turtle', () => {
    it('reads @-style directives in order with the quads', () => {
      expect(parseEvents('<a:s> <a:p> <a:1>.\n@message .\n<a:s> <a:p> <a:2>.\n@message .\n'))
        .toEqual(['quad a:1', 'message()', 'quad a:2', 'message()']);
    });

    it('reads SPARQL-style directives, case-insensitively', () => {
      expect(parseEvents('<a:s> <a:p> <a:1>.\nMESSAGE\n<a:s> <a:p> <a:2>.\nmessage <a:s> <a:p> <a:3>.'))
        .toEqual(['quad a:1', 'message()', 'quad a:2', 'message()', 'quad a:3']);
    });

    it('reads a SPARQL-style directive at the end of the input', () => {
      expect(parseEvents('<a:s> <a:p> <a:1>.\nMESSAGE')).toEqual(['quad a:1', 'message()']);
    });

    it('reads a directive before a comment', () => {
      expect(parseEvents('MESSAGE# a comment\n@message .# another\n')).toEqual(['message()', 'message()']);
    });

    it('reads an @-style directive directly followed by its dot', () => {
      expect(parseEvents('<a:s> <a:p> <a:1>.\n@message.\n<a:s> <a:p> <a:2>.@message.'))
        .toEqual(['quad a:1', 'message()', 'quad a:2', 'message()']);
    });

    it('reads built-in @-keywords directly followed by a dot as keywords', () => {
      expect(parseError('@prefix.')).toBe('Expected prefix to follow @prefix on line 1.');
      expect(parseError('@base.')).toBe('Expected valid IRI to follow base declaration on line 1.');
      expect(parseError('@version.')).toBe('Expected literal to follow version declaration on line 1.');
      expect(parseError('@forAll.', { format: 'N3' })).toBe('Unexpected . on line 1.');
      expect(parseError('@forSome.', { format: 'N3' })).toBe('Unexpected . on line 1.');
    });

    it('requires a dot after an @-style directive', () => {
      expect(parseError('@message <a:s> <a:p> <a:o>.'))
        .toBe('Expected declaration to end with a dot on line 1.');
    });

    it('does not accept @-style directives in another case', () => {
      expect(parseError('@MESSAGE .')).toBe('Expected entity but got @MESSAGE on line 1.');
    });

    it('does not accept a directive inside a statement', () => {
      expect(parseError('<a:s> MESSAGE <a:o>.')).toBe('Expected entity but got MESSAGE on line 1.');
    });

    it('does not accept directives that were not registered', () => {
      expect(parseError('@other .')).toBe('Expected entity but got @other on line 1.');
      expect(parseError('@message .', { directives: [] })).toBe('Expected entity but got @message on line 1.');
      expect(parseError('@message .', { directives: undefined })).toBe('Expected entity but got @message on line 1.');
    });

    it('does not confuse a prefixed name with a directive', () => {
      expect(parseEvents('@prefix message: <a:>.\nmessage:s message:p message:o.')).toEqual(['quad a:o']);
    });

    it('keeps the built-in directives', () => {
      const versions = [];
      const quads = new Parser({ directives: ['message'] }).parse(
        '@prefix ex: <a:>.\nVERSION "1.2"\nex:s ex:p ex:o.\n@message .',
        { onVersion: version => versions.push(version) });
      expect(versions).toEqual(['1.2']);
      expect(quads).toHaveLength(1);
    });
    it('reads an @-style directive after a SPARQL-style version declaration', () => {
      expect(parseEvents('VERSION "1.2"\n@message .\n<a:s> <a:p> "o" @message .'))
        .toEqual(['message()', 'quad o']);
    });
  });

  describe('in TriG', () => {
    it('reads directives between graphs', () => {
      expect(parseEvents('<a:g> { <a:s> <a:p> <a:1> }\n@message .\nGRAPH <a:g> { <a:s> <a:p> <a:2> }\nMESSAGE\n'))
        .toEqual(['quad a:1', 'message()', 'quad a:2', 'message()']);
    });

    it('does not accept directives inside a graph', () => {
      expect(parseError('<a:g> { <a:s> <a:p> <a:1>. MESSAGE }'))
        .toBe('Expected entity but got MESSAGE on line 1.');
      expect(parseError('<a:g> { <a:s> <a:p> <a:1>. @message . }'))
        .toBe('Expected entity but got @message on line 1.');
    });
  });

  describe('in N3', () => {
    it('does not accept directives inside a formula', () => {
      expect(parseError('{ MESSAGE } <a:p> <a:o>.', { format: 'N3' }))
        .toBe('Expected entity but got MESSAGE on line 1.');
    });
  });

  describe.each(['N-Triples', 'N-Quads'])('in %s', format => {
    it('reads SPARQL-style directives in order with the quads', () => {
      expect(parseEvents('<a:s> <a:p> <a:1> .\nMESSAGE\n<a:s> <a:p> <a:2> .\nMESSAGE\n', { format }))
        .toEqual(['quad a:1', 'message()', 'quad a:2', 'message()']);
    });

    it('reads a directive at the end of the input', () => {
      expect(parseEvents('<a:s> <a:p> <a:1> .\nMESSAGE', { format })).toEqual(['quad a:1', 'message()']);
    });

    it('does not accept directives in another case, like VERSION', () => {
      expect(parseError('Message\n', { format })).toBe('Unexpected "Message" on line 1.');
      expect(parseError('message', { format })).toBe('Unexpected "message" on line 1.');
    });

    it('does not accept @-style directives', () => {
      expect(parseError('@message .', { format })).toBe('Unexpected "@message" on line 1.');
    });
  });

  describe('when streaming', () => {
    it('reads a directive split across chunks', async () => {
      expect(await parseChunks(['<a:s> <a:p> <a:1>.\nMES', 'SAGE', '\n<a:s> <a:p> <a:2>.\n@mess', 'age .']))
        .toEqual(['quad a:1', 'message', 'quad a:2', 'message']);
    });

    it('reads a directive after a version declaration split across chunks', async () => {
      expect(await parseChunks(['VERSION "1.2"', '\n@mess', 'age .\nVERSION "1.2"\n', '@message .']))
        .toEqual(['message', 'message']);
    });

    it('reads an @-style directive split before its dot', async () => {
      expect(await parseChunks(['<a:s> <a:p> <a:1>.\n@message', '.\n<a:s> <a:p> <a:2>.']))
        .toEqual(['quad a:1', 'message', 'quad a:2']);
    });

    it('reads a directive at the end of the stream', async () => {
      expect(await parseChunks(['<a:s> <a:p> <a:1>.\nMESSAGE']))
        .toEqual(['quad a:1', 'message']);
    });

    it('emits directives from a StreamParser', async () => {
      const events = await new Promise((resolve, reject) => {
        const parsed = [];
        const parser = new StreamParser({ directives: ['message'] });
        parser.on('data', quad => parsed.push(`quad ${quad.object.value}`));
        parser.on('directive', name => parsed.push(`${name}()`));
        parser.on('error', reject);
        parser.on('end', () => resolve(parsed));
        Readable.from(['<a:s> <a:p> <a:1>.\nMESSAGE\n<a:s> <a:p> <a:2>.\n']).pipe(parser);
      });
      expect(events).toEqual(['quad a:1', 'message()', 'quad a:2']);
    });
  });

  describe('names', () => {
    it.each(['prefix', 'BASE', 'version', 'graph', 'forSome', 'forAll', 'IRI', 'a', 'True', 'false',
      'has', 'is', 'of', 'id', 'mes-sage', 'm1', ''])(
      'rejects the name "%s"', name => {
        expect(() => new Parser({ directives: [name] })).toThrow(`Invalid directive name: "${name}"`);
      });

    it.each(['a|b', 'a', 'TRUE'])('rejects the name "%s" in the lexer', name => {
      expect(() => new Lexer({ directives: [name] })).toThrow(`Invalid directive name: "${name}"`);
    });

    it('lexes registered names as keywords', () => {
      const tokens = new Lexer({ directives: ['message', 'other'] }).tokenize('MESSAGE other\n@message .');
      expect(tokens.map(token => token.type)).toEqual(['MESSAGE', 'OTHER', '@message', '.', 'eof']);
    });

    it('lexes no additional keywords by default', () => {
      expect(() => new Lexer({ directives: [] }).tokenize('MESSAGE ')).toThrow('Unexpected "MESSAGE" on line 1.');
    });
  });

  it('calls no directive callback when lexing fails later', () => {
    const onDirective = jest.fn();
    expect(() => new Parser({ directives: ['message'] }).parse('MESSAGE "unterminated', { onDirective }))
      .toThrow('Unexpected ""unterminated" on line 1.');
    expect(onDirective).not.toHaveBeenCalled();
  });
});
