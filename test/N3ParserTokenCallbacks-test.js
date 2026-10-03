import { Parser, Lexer } from '../src';
import { EventEmitter } from 'events';

const document = '<s> <p> "hello"@en .';

function record(events) {
  return {
    onToken: token => events.push(['before', token]),
    onTokenEnd: token => events.push(['after', token]),
  };
}

describe('Parser token callbacks', () => {
  it('observes each token once before and after processing, including EOF', () => {
    const events = [];
    const quads = new Parser().parse(document, record(events));
    const tokens = new Lexer().tokenize(document);
    expect(quads).toHaveLength(1);
    expect(events).toEqual(tokens.flatMap(token => [['before', token], ['after', token]]));
    expect(events[0][1]).toBe(events[1][1]);
  });

  it.each(['onToken', 'onTokenEnd'])('accepts %s alone without changing synchronous return values', name => {
    const tokens = [];
    const quads = new Parser().parse(document, { [name]: token => tokens.push(token) });
    expect(quads).toEqual(new Parser().parse(document));
    expect(tokens).toEqual(new Lexer().tokenize(document));
  });

  it('ignores observer return values', () => {
    const quads = new Parser().parse(document, { onToken: () => false, onTokenEnd: () => false });
    expect(quads).toHaveLength(1);
  });

  it('brackets quad and completion callbacks with the corresponding token callbacks', async () => {
    const events = [];
    await new Promise((resolve, reject) => {
      new Parser().parse('<s> <p> <o>.', {
        onToken: token => events.push(`before:${token.type}`),
        onTokenEnd: token => events.push(`after:${token.type}`),
        onQuad: (error, quad) => {
          if (error) return reject(error);
          events.push(quad ? 'quad' : 'complete');
          if (!quad) resolve();
        },
      });
    });
    expect(events.slice(-6)).toEqual(['before:.', 'quad', 'after:.', 'before:eof', 'complete', 'after:eof']);
  });

  it('has identical token events for a string and one-character stream chunks', () => {
    const expected = [], actual = [], quads = [], input = new EventEmitter();
    new Parser().parse(document, record(expected));
    new Parser().parse(input, {
      ...record(actual),
      onQuad: (error, quad) => { if (error) throw error; if (quad) quads.push(quad); },
    });
    for (const char of document) input.emit('data', char);
    input.emit('end');
    expect(actual).toEqual(expected);
    expect(quads).toHaveLength(1);
  });

  it('observes enabled comments around onComment without sending them to the grammar', () => {
    const events = [];
    const quads = new Parser().parse('# note\n<s> <p> <o>.', {
      onToken: token => events.push(`before:${token.type}`),
      onTokenEnd: token => events.push(`after:${token.type}`),
      onComment: comment => events.push(comment),
    });
    expect(events.slice(0, 3)).toEqual(['before:comment', ' note', 'after:comment']);
    expect(quads).toHaveLength(1);
  });

  it('supports comment-enabled custom lexers without requiring onComment', () => {
    const events = [];
    new Parser({ lexer: new Lexer({ comments: true }) }).parse('# note\n', record(events));
    expect(events.map(([phase, token]) => `${phase}:${token.type}`))
      .toEqual(['before:comment', 'after:comment', 'before:eof', 'after:eof']);
  });

  it('does not enable comment tokens just by registering token observers', () => {
    const events = [];
    new Parser().parse('# note\n', record(events));
    expect(events.map(([, token]) => token.type)).toEqual(['eof', 'eof']);
  });

  it('does not retain callbacks on reuse, including after enabling comments', () => {
    const parser = new Parser(), events = [], comments = [];
    parser.parse('# first\n', { ...record(events), onComment: text => comments.push(text) });
    const previous = events.slice();
    expect(parser.parse('# second\n<s> <p> <o>.')).toHaveLength(1);
    expect(events).toEqual(previous);
    expect(comments).toEqual([' first']);
  });

  it('ends the offending token and stops at a grammar error', () => {
    const events = [];
    expect(() => new Parser().parse('<s> . <p> <o>.', record(events))).toThrow('Unexpected .');
    expect(events.map(([phase, token]) => `${phase}:${token.type}`))
      .toEqual(['before:IRI', 'after:IRI', 'before:.', 'after:.']);
  });

  it('does not emit synchronous token events when lexing fails before parsing', () => {
    const events = [];
    expect(() => new Parser().parse('<s> <p> <o>. "unterminated', record(events))).toThrow();
    expect(events).toEqual([]);
  });

  it.each(['onToken', 'onTokenEnd', 'onQuad'])('aborts later stream chunks when %s throws', name => {
    const error = new Error('consumer failed'), events = [], input = new EventEmitter();
    const callbacks = {
      ...record(events),
      onQuad: (error, quad) => { if (error) throw error; },
    };
    callbacks[name] = () => { throw error; };
    new Parser().parse(input, callbacks);
    expect(() => input.emit('data', '<s> <p> <o>. ')).toThrow(error);
    const stopped = events.slice();
    input.emit('data', '<a> <b> <c>. ');
    input.emit('end');
    expect(events).toEqual(stopped);
  });

  it('runs onTokenEnd for cleanup when onToken throws', () => {
    const error = new Error('stop'), ended = [];
    expect(() => new Parser().parse(document, {
      onToken: () => { throw error; },
      onTokenEnd: token => ended.push(token),
    })).toThrow(error);
    expect(ended).toEqual([new Lexer().tokenize(document)[0]]);
  });

  it('does not synthesize token events for input stream errors', () => {
    const events = [], errors = [], input = new EventEmitter(), error = new Error('input failed');
    new Parser().parse(input, {
      ...record(events), onQuad: error => errors.push(error),
    });
    input.emit('error', error);
    expect(events).toEqual([]);
    expect(errors).toEqual([error]);
  });
});
