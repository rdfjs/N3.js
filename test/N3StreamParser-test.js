var N3StreamParser = require('../N3').StreamParser;

var Readable = require('stream').Readable,
    Writable = require('stream').Writable,
    NamedNode = require('../N3').DataFactory.NamedNode;

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

    it('should parse decimals that are split across chunks in the stream',
      shouldParse('<sub> <pred> 11.2 .'.match(/.{1,2}/g), 1));

    it("doesn't parse an invalid stream",
      shouldNotParse(['z.'], 'Unexpected "z." on line 1.'), { token: undefined, line: 1, previousToken: undefined });

    it('emits "prefix" events',
      shouldEmitPrefixes(['@prefix a: <http://a.org/#>. a:a a:b a:c. @prefix b: <http://b.org/#>.'],
                         { a: new NamedNode('http://a.org/#'), b: new NamedNode('http://b.org/#') }));

    it('passes an error', function () {
      var input = new Readable(),
          parser = new N3StreamParser(),
          error = null;
      parser.on('error', function (e) { error = e; });
      parser.import(input);
      input.emit('error', new Error());
      expect(error).to.be.an.instanceof(Error);
    });
  });
});


function shouldParse(chunks, expectedLength) {
  return function (done) {
    var triples = [],
        inputStream = new ArrayReader(chunks),
        parser = new N3StreamParser(),
        outputStream = new ArrayWriter(triples);
    parser.import(inputStream);
    parser.pipe(outputStream);
    parser.on('error', done);
    parser.on('end', function () {
      triples.should.have.length(expectedLength);
      done();
    });
  };
}

function shouldNotParse(chunks, expectedMessage, expectedContext) {
  return function (done) {
    var inputStream = new ArrayReader(chunks),
        parser = N3StreamParser(),
        outputStream = new ArrayWriter([]);
    inputStream.pipe(parser);
    parser.pipe(outputStream);
    parser.on('error', function (error) {
      error.should.be.an.instanceof(Error);
      error.message.should.equal(expectedMessage);
      if (expectedContext) error.context.should.deep.equal(expectedContext);
      done();
    });
  };
}

function shouldEmitPrefixes(chunks, expectedPrefixes) {
  return function (done) {
    var prefixes = {},
        parser = N3StreamParser(),
        inputStream = new ArrayReader(chunks);
    inputStream.pipe(parser);
    parser.on('data', function () {});
    parser.on('prefix', function (prefix, iri) { prefixes[prefix] = iri; });
    parser.on('error', done);
    parser.on('end', function (error) {
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
