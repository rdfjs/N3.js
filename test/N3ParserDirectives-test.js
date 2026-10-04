import { Parser, Lexer, StreamParser } from '../src';
import { Readable } from 'readable-stream';
import { EventEmitter } from 'events';

// Parses the input, recording quads and directives in the order they are emitted
function parseEvents(input, options) {
  const events = [], stream = new EventEmitter();
  new Parser({ directives: { message: 0 }, ...options }).parse(stream, {
    onQuad: (error, quad) => {
      if (error) throw error;
      if (quad) events.push(`quad ${quad.object.value}`);
    },
    onDirective: (name, args) => events.push(`${name}(${args.map(arg => arg.value).join(', ')})`),
  });
  stream.emit('data', input);
  stream.emit('end');
  return events;
}

// Parses the input from a stream with the given chunks
function parseChunks(chunks, options) {
  return new Promise((resolve, reject) => {
    const events = [], input = new EventEmitter();
    new Parser({ directives: { message: 0 }, ...options }).parse(input, {
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
    new Parser({ directives: { message: 0 }, ...options }).parse(input);
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
      expect(parseError('@message .', { directives: {} })).toBe('Expected entity but got @message on line 1.');
      expect(parseError('@message .', { directives: undefined })).toBe('Expected entity but got @message on line 1.');
    });

    it('does not confuse a prefixed name with a directive', () => {
      expect(parseEvents('@prefix message: <a:>.\nmessage:s message:p message:o.')).toEqual(['quad a:o']);
    });

    it('keeps the built-in directives', () => {
      const versions = [];
      const quads = new Parser({ directives: { message: 0 } }).parse(
        '@prefix ex: <a:>.\nVERSION "1.2"\nex:s ex:p ex:o.\n@message .',
        { onVersion: version => versions.push(version) });
      expect(versions).toEqual(['1.2']);
      expect(quads).toHaveLength(1);
    });
  });

  describe('with arguments', () => {
    const options = { directives: { source: 2 } };

    it('passes IRIs, prefixed names, blank nodes and literals as terms', () => {
      const directives = [];
      new Parser(options).parse(
        '@prefix ex: <http://ex.org/>.\n@source ex:a <http://ex.org/b> .\nSOURCE _:b "c"\n',
        { onDirective: (name, args) => directives.push([name, args.map(arg => `${arg.termType} ${arg.value}`)]) });
      expect(directives).toEqual([
        ['source', ['NamedNode http://ex.org/a', 'NamedNode http://ex.org/b']],
        ['source', [expect.stringMatching(/^BlankNode .*b$/), 'Literal c']],
      ]);
    });

    it('passes numbers and booleans as typed literals', () => {
      const directives = [];
      new Parser(options).parse('@source 42 true .\nSOURCE 1.5 "x"\n',
        { onDirective: (name, args) => directives.push(args.map(arg => `${arg.value} ${arg.datatype.value}`)) });
      const xsd = 'http://www.w3.org/2001/XMLSchema#';
      expect(directives).toEqual([
        [`42 ${xsd}integer`, `true ${xsd}boolean`],
        [`1.5 ${xsd}decimal`, `x ${xsd}string`],
      ]);
    });

    it('resolves relative IRIs against the base IRI', () => {
      const directives = [];
      new Parser({ ...options, baseIRI: 'http://ex.org/' }).parse('@source <a> <b> .',
        { onDirective: (name, args) => directives.push(args.map(arg => arg.value)) });
      expect(directives).toEqual([['http://ex.org/a', 'http://ex.org/b']]);
    });

    it('reports invalid arguments', () => {
      expect(parseError('@source <a:a> .', options)).toBe('Expected entity but got . on line 1.');
      expect(parseError('@source ex:a <a:b> .', options)).toBe('Undefined prefix "ex:" on line 1.');
    });
  });

  describe('in TriG', () => {
    it('reads directives between graphs', () => {
      expect(parseEvents('<a:g> { <a:s> <a:p> <a:1> }\n@message .\nGRAPH <a:g> { <a:s> <a:p> <a:2> }\nMESSAGE\n'))
        .toEqual(['quad a:1', 'message()', 'quad a:2', 'message()']);
    });

    it('does not accept directives inside a graph', () => {
      expect(parseError('<a:g> { <a:s> <a:p> <a:1>. MESSAGE }'))
        .toBe('Unexpected MESSAGE directive inside a graph on line 1.');
      expect(parseError('<a:g> { <a:s> <a:p> <a:1>. @message . }'))
        .toBe('Unexpected @message directive inside a graph on line 1.');
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
      expect(parseEvents('<a:s> <a:p> <a:1> .\nMESSAGE\n<a:s> <a:p> <a:2> .\nMessage\n', { format }))
        .toEqual(['quad a:1', 'message()', 'quad a:2', 'message()']);
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

    it('reads a directive at the end of the stream', async () => {
      expect(await parseChunks(['<a:s> <a:p> <a:1>.\nMESSAGE']))
        .toEqual(['quad a:1', 'message']);
    });

    it('emits directives from a StreamParser', async () => {
      const events = await new Promise((resolve, reject) => {
        const parsed = [];
        const parser = new StreamParser({ directives: { message: 0 } });
        parser.on('data', quad => parsed.push(`quad ${quad.object.value}`));
        parser.on('directive', (name, args) => parsed.push(`${name}(${args.length})`));
        parser.on('error', reject);
        parser.on('end', () => resolve(parsed));
        Readable.from(['<a:s> <a:p> <a:1>.\nMESSAGE\n<a:s> <a:p> <a:2>.\n']).pipe(parser);
      });
      expect(events).toEqual(['quad a:1', 'message(0)', 'quad a:2']);
    });
  });

  describe('names', () => {
    it.each(['prefix', 'BASE', 'version', 'graph', 'forSome', 'forAll', 'IRI', 'a', 'True', 'false',
      'has', 'is', 'of', 'id', 'mes-sage', 'm1', ''])(
      'rejects the name "%s"', name => {
        expect(() => new Parser({ directives: { [name]: 0 } })).toThrow(`Invalid directive name: "${name}"`);
      });

    it.each(['a|b', 'a', 'TRUE'])('rejects the name "%s" in the lexer', name => {
      expect(() => new Lexer({ directives: [name] })).toThrow(`Invalid directive name: "${name}"`);
    });

    it.each([-1, 1.5, '1', null, undefined, NaN])('rejects %p as a number of arguments', count => {
      expect(() => new Parser({ directives: { message: count } }))
        .toThrow(`Invalid number of arguments for directive "message": ${count}`);
    });

    it('lexes registered names as keywords', () => {
      const tokens = new Lexer({ directives: ['message', 'other'] }).tokenize('MESSAGE other\n@message .');
      expect(tokens.map(token => token.type)).toEqual(['MESSAGE', 'OTHER', '@message', '.', 'eof']);
    });

    it('lexes no additional keywords by default', () => {
      expect(() => new Lexer({ directives: [] }).tokenize('MESSAGE ')).toThrow('Unexpected "MESSAGE" on line 1.');
    });
  });
});
