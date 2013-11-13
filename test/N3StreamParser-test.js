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
      transform.on('end', function () { callback(null, output); });
    },
    'yields the expected number of triples': function (triples) {
      triples.should.have.length(expectedLength);
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
