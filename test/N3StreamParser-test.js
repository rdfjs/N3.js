var N3StreamParser = require('../N3').StreamParser;
var vows = require('vows'),
    chai = require('chai'),
    expect = chai.expect,
    Readable = require('stream').Readable,
    Writable = require('stream').Writable,
    util = require('util');
chai.should();
chai.use(require('chai-things'));

util.inherits(ArrayReader, Readable);
util.inherits(ArrayWriter, Writable);

vows.describe('N3StreamParser').addBatch({
  'The N3StreamParser module': {
    topic: function () { return N3StreamParser; },

    'should be a function': function (N3StreamParser) {
      N3StreamParser.should.be.a('function');
    },

    'should make N3Lexer objects': function (N3StreamParser) {
      N3StreamParser().should.be.an.instanceof(N3StreamParser);
    },

    'should be an N3Lexer constructor': function (N3StreamParser) {
      new N3StreamParser().should.be.an.instanceof(N3StreamParser);
    },
  },

  'An N3StreamParser instance': {
    topic: function () { return function () { return new N3StreamParser(); }; },

    'parses the empty stream': shouldParse([], 0),

    'parses the zero-length stream': shouldParse([''], 0),

    'parses one triple': shouldParse(['<a> <b> <c>.'], 1),

    'parses two triples': shouldParse(['<a> <b>', ' <c>. <d> <e> ', '<f>.'], 2),

    "doesn't parse an invalid stream": shouldNotParse(['z.'], 'Syntax error: unexpected "z." on line 1.'),

    'emits "prefix" events':
      shouldEmitPrefixes(['@prefix a: <URIa>. a:a a:b a:c. @prefix b: <URIb>.'],
                         { a: 'URIa', b: 'URIb' }),
  },
}).export(module);


function shouldParse(chunks, expectedLength) {
  return {
    topic: function (n3streamparserFactory) {
      var output = [],
          inputStream = new ArrayReader(chunks),
          outputStream = new ArrayWriter(output),
          transform = n3streamparserFactory(),
          callback = this.callback;
      inputStream.pipe(transform);
      transform.pipe(outputStream);
      transform.on('error', callback);
      transform.on('end', function () { callback(null, output); });
    },
    'yields the expected number of triples': function (triples) {
      triples.should.have.length(expectedLength);
    },
  };
}

function shouldNotParse(chunks, expectedMessage) {
  return {
    topic: function (n3streamparserFactory) {
      var output = [],
          inputStream = new ArrayReader(chunks),
          outputStream = new ArrayWriter(output),
          transform = n3streamparserFactory(),
          callback = this.callback;
      inputStream.pipe(transform);
      transform.pipe(outputStream);
      transform.on('error', function (error) { callback(null, error); callback = null; });
      transform.on('end', function () { callback && callback('no error raised'); });
    },
    'should produce the right error message': function (error) {
      error.message.should.equal(expectedMessage);
    },
  };
}

function shouldEmitPrefixes(chunks, expectedPrefixes) {
  return {
    topic: function (n3streamparserFactory) {
      var prefixes = {},
          inputStream = new ArrayReader(chunks),
          transform = n3streamparserFactory(),
          callback = this.callback;
      inputStream.pipe(transform);
      transform.on('data', function () {});
      transform.on('prefix', function (prefix, uri) { prefixes[prefix] = uri; });
      transform.on('error', callback);
      transform.on('end', function () { callback(null, prefixes); });
    },
    'should emit the correct prefixes': function (prefixes) {
      prefixes.should.deep.equal(expectedPrefixes);
    },
  };
}

function ArrayReader(items) {
  Readable.call(this);
  this._read = function () {
    if (items.length)
      this.push(new Buffer(items.shift(), 'utf8'));
    else
      this.push(null);
  };
}

function ArrayWriter(items) {
  Writable.call(this, { objectMode: true });
  this._write = function (chunk, encoding, done) {
    items.push(chunk);
    done();
  };
}
