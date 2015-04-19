var N3StreamParser = require('../N3').StreamParser;
var chai = require('chai'),
    Readable = require('stream').Readable,
    Writable = require('stream').Writable;
chai.should();

describe('N3StreamParser', function () {
  describe('The N3StreamParser module', function () {
    it('should be a function', function () {
      N3StreamParser.should.be.a('function');
    });

    it('should make N3Lexer objects', function () {
      N3StreamParser().should.be.an.instanceof(N3StreamParser);
    });

    it('should be an N3Lexer constructor', function () {
      new N3StreamParser().should.be.an.instanceof(N3StreamParser);
    });
  });

  describe('An N3StreamParser instance', function () {
    it('parses the empty stream', shouldParse([], 0));

    it('parses the zero-length stream', shouldParse([''], 0));

    it('parses one triple', shouldParse(['<a> <b> <c>.'], 1));

    it('parses two triples', shouldParse(['<a> <b>', ' <c>. <d> <e> ', '<f>.'], 2));

    it("doesn't parse an invalid stream",
      shouldNotParse(['z.'], 'Syntax error: unexpected "z." on line 1.'));

    it('emits "prefix" events',
      shouldEmitPrefixes(['@prefix a: <IRIa>. a:a a:b a:c. @prefix b: <IRIb>.'],
                         { a: 'IRIa', b: 'IRIb' }));
  });
});


function shouldParse(chunks, expectedLength) {
  return function (done) {
    var triples = [],
        inputStream = new ArrayReader(chunks),
        outputStream = new ArrayWriter(triples),
        transform = new N3StreamParser();
    inputStream.pipe(transform);
    transform.pipe(outputStream);
    transform.on('error', done);
    transform.on('end', function () {
      triples.should.have.length(expectedLength);
      done();
    });
  };
}

function shouldNotParse(chunks, expectedMessage) {
  return function (done) {
    var inputStream = new ArrayReader(chunks),
        outputStream = new ArrayWriter([]),
        transform = N3StreamParser();
    inputStream.pipe(transform);
    transform.pipe(outputStream);
    transform.on('error', function (error) {
      error.should.be.an.instanceof(Error);
      error.message.should.equal(expectedMessage);
      done();
    });
  };
}

function shouldEmitPrefixes(chunks, expectedPrefixes) {
  return function (done) {
    var prefixes = {},
        inputStream = new ArrayReader(chunks),
        transform = N3StreamParser();
    inputStream.pipe(transform);
    transform.on('data', function () {});
    transform.on('prefix', function (prefix, iri) { prefixes[prefix] = iri; });
    transform.on('error', done);
    transform.on('end', function (error) {
      prefixes.should.deep.equal(expectedPrefixes);
      done(error);
    });
  };
}

function ArrayReader(items) {
  var reader = new Readable();
  reader._read = function () { this.push(items.shift() || null); };
  return reader;
}

function ArrayWriter(items) {
  var writer = new Writable({ objectMode: true });
  writer._write = function (chunk, encoding, done) { items.push(chunk); done(); };
  return writer;
}
