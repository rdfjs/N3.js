// Lexer, Parser and StreamParser
const data = require('../data');
const { check, chunksOf, bufferStream, drain } = require('../helpers');

const { EX } = data;

function parseBench(format, text, options = {}) {
  return N3 => () => {
    const quads = new N3.Parser({ format, baseIRI: 'http://example.org/doc', ...options }).parse(text);
    check(quads.length, 'nothing parsed');
  };
}

function callbackParseBench(format, text, callbacks = {}) {
  // The callback API is what N3.StreamParser and most consumers sit on
  return N3 => () => new Promise((resolve, reject) => {
    let count = 0;
    new N3.Parser({ format }).parse(text, {
      ...callbacks,
      onQuad: (error, quad) => {
        if (error) reject(error);
        else if (quad) count++;
        else if (count) resolve();
        else reject(new Error('nothing parsed'));
      },
    });
  });
}

function streamParseBench(format, text, chunkSize) {
  return N3 => {
    const chunks = chunksOf(text, chunkSize);
    return async () => {
      const parser = new N3.StreamParser({ format });
      check(await drain(bufferStream(chunks).pipe(parser)), 'nothing parsed');
    };
  };
}

function tokenizeBench(text, options) {
  return N3 => () => {
    check(new N3.Lexer(options).tokenize(text).length, 'nothing lexed');
  };
}

const ntriples = data.ntriples(20000);
const nquads = data.nquads(20000);
const turtle = data.turtle(4000);
const trig = data.trig(4000);
const n3 = data.n3(1500);
const turtleStar = data.turtleStar(3000);

// Relative IRIs of each shape that resolution handles
function relativeTurtle(count) {
  const forms = ['a', './b/c', '../d', '../../e/f?q', '#frag', '?query', '/abs/path', 'g/./h/../i', '//host/x'];
  const lines = [];
  for (let i = 0; i < count; i++)
    lines.push(`<${forms[i % forms.length]}${i}> <p${i % 7}> <${forms[(i + 4) % forms.length]}${i}> .`);
  return `${lines.join('\n')}\n`;
}

// Literals with escapes, long strings and many prefix declarations
function escapedTurtle(count) {
  const lines = [];
  for (let i = 0; i < 200; i++) lines.push(`@prefix p${i}: <${EX}ns${i}/> .`);
  for (let i = 0; i < count; i++) {
    lines.push(`p${i % 200}:s${i} p${(i + 1) % 200}:p "tab\\tquote\\"\\u00e9\\U0001F600 ${'x'.repeat(i % 300)}" ;`);
    lines.push(`  p${i % 200}:q """long\n${'line '.repeat(40)}\n${i}""" ; p${i % 200}:r 'single \\'q\\'' .`);
  }
  return `${lines.join('\n')}\n`;
}

function commentedTurtle(count) {
  const lines = [`@prefix ex: <${EX}> .`];
  for (let i = 0; i < count; i++)
    lines.push(`# comment ${i}\nex:s${i} ex:p ex:o${i} . # trailing ${i}`);
  return `${lines.join('\n')}\n`;
}

const relative = relativeTurtle(15000);
const escaped = escapedTurtle(2500);
const commented = commentedTurtle(15000);
const bigTurtle = data.turtle(12000);
const bigNTriples = data.ntriples(50000);

module.exports = {
  'parser: N-Triples': parseBench('N-Triples', ntriples),
  'parser: N-Quads': parseBench('N-Quads', nquads),
  'parser: Turtle': parseBench('Turtle', turtle),
  'parser: Turtle (callback)': callbackParseBench('Turtle', turtle),
  'parser: TriG': parseBench('TriG', trig),
  'parser: N3': parseBench('text/n3', n3),
  'parser: Turtle 1.2 (triple terms, reifiers)': parseBench('Turtle', turtleStar),
  'parser: relative IRIs against baseIRI': parseBench('Turtle', relative),
  'parser: escapes, long literals and many prefixes': parseBench('Turtle', escaped),
  'parser: blankNodePrefix': parseBench('N-Triples', ntriples, { blankNodePrefix: 'x' }),
  'parser: N3 with explicitQuantifiers': parseBench('text/n3', n3, { explicitQuantifiers: true }),
  'parser: onComment callback': callbackParseBench('Turtle', commented, { onComment: () => {} }),
  'parser: onToken and onTokenEnd callbacks': {
    // Token callbacks are newer than the parser itself
    available: N3 => {
      let seen = false;
      new N3.Parser().parse('<a> <b> <c>.', { onToken: () => { seen = true; } });
      return seen;
    },
    setup: callbackParseBench('Turtle', turtle, { onToken: () => {}, onTokenEnd: () => {} }),
  },

  'lexer: tokenize Turtle': tokenizeBench(turtle),
  'lexer: tokenize N-Triples (lineMode)': tokenizeBench(ntriples, { lineMode: true }),
  'lexer: tokenize N3': tokenizeBench(n3, { n3: true }),

  'streamparser: Turtle (64 KB chunks)': streamParseBench('Turtle', bigTurtle, 65536),
  'streamparser: N-Triples (64 KB chunks)': streamParseBench('N-Triples', bigNTriples, 65536),
  'streamparser: Turtle (256-byte chunks)': streamParseBench('Turtle', turtle, 256),
  'streamparser: TriG (4 KB chunks)': streamParseBench('TriG', trig, 4096),
  'streamparser: N3 (4 KB chunks)': streamParseBench('text/n3', n3, 4096),
  'streamparser: import()': N3 => {
    const chunks = chunksOf(ntriples, 16384);
    return async () => {
      const parser = new N3.StreamParser({ format: 'N-Triples' });
      check(await drain(parser.import(bufferStream(chunks))), 'nothing parsed');
    };
  },
};
