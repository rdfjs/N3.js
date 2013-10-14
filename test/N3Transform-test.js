var N3Transform = require('../N3').Transform;
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

vows.describe('N3Transform').addBatch({
  'The N3Transform module': {
    topic: function () { return N3Transform; },

    'should be a function': function (N3Transform) {
      N3Transform.should.be.a('function');
    },

    'should make N3Lexer objects': function (N3Transform) {
      N3Transform().should.be.an.instanceof(N3Transform);
    },

    'should be an N3Lexer constructor': function (N3Transform) {
      new N3Transform().should.be.an.instanceof(N3Transform);
    },
  },

  'An N3Transform instance': {
    topic: function () { return function () { return new N3Transform(); }; },

    'parses the empty stream': shouldParse([], 0),

    'parses the zero-length stream': shouldParse([''], 0),

    'parses one triple': shouldParse(['<a> <b> <c>.'], 1),

    'parses two triples': shouldParse(['<a> <b>', ' <c>. <d> <e> ', '<f>.'], 2),
  },
}).export(module);


function shouldParse(chunks, expectedLength) {
  return {
    topic: function (n3TransformFactory) {
      var output = [],
          inputStream = new ArrayReader(chunks),
          outputStream = new ArrayWriter(output),
          transform = n3TransformFactory(),
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
