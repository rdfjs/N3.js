import { StreamParser, NamedNode } from '../src/';
import { Readable, Writable } from 'readable-stream';

describe('StreamParser', function () {
  describe('The StreamParser export', function () {
    it('should be a function', function () {
      StreamParser.should.be.a('function');
    });

    it('should be a StreamParser constructor', function () {
      new StreamParser().should.be.an.instanceof(StreamParser);
    });
  });

  describe('A StreamParser instance', function () {
    it('parses the empty stream', shouldParse([], 0));

    it('parses the zero-length stream', shouldParse([''], 0));

    it('parses one triple', shouldParse(['<a> <b> <c>.'], 1));

    it('parses two triples', shouldParse(['<a> <b>', ' <c>. <d> <e> ', '<f>.'], 2));

    it('should parse decimals that are split across chunks in the stream',
      shouldParse('<sub> <pred> 11.2 .'.match(/.{1,2}/g), 1));

    it('should parse non-breaking spaces that are split across chunks in the stream correctly', function (done) {
      var buffer = Buffer.from('<sub> <pred> " " .'),
          chunks = [buffer, buffer.slice(0, 15), buffer.slice(15, buffer.length)];
      shouldParse(chunks, 2, function (triples) {
        triples[0].should.deep.equal(triples[1]);
      })(done);
    });

    it("doesn't parse an invalid stream",
      shouldNotParse(['z.'], 'Unexpected "z." on line 1.'), { token: undefined, line: 1, previousToken: undefined });

    it('emits "prefix" events',
      shouldEmitPrefixes(['@prefix a: <http://a.org/#>. a:a a:b a:c. @prefix b: <http://b.org/#>.'],
                         { a: new NamedNode('http://a.org/#'), b: new NamedNode('http://b.org/#') }));

    it('passes an error', function () {
      var input = new Readable(),
          parser = new StreamParser(),
          error = null;
      input._read = function () {};
      parser.on('error', function (e) { error = e; });
      parser.import(input);
      input.emit('error', new Error());
      expect(error).to.be.an.instanceof(Error);
    });
  });
});


function shouldParse(chunks, expectedLength, validateTriples) {
  return function (done) {
    var triples = [],
        inputStream = new ArrayReader(chunks),
        parser = new StreamParser(),
        outputStream = new ArrayWriter(triples);
    parser.import(inputStream).should.equal(parser);
    parser.pipe(outputStream);
    parser.on('error', done);
    parser.on('end', function () {
      triples.should.have.length(expectedLength);
      if (validateTriples) validateTriples(triples);
      done();
    });
  };
}

function shouldNotParse(chunks, expectedMessage, expectedContext) {
  return function (done) {
    var inputStream = new ArrayReader(chunks),
        parser = new StreamParser(),
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
        parser = new StreamParser(),
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
