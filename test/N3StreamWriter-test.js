var N3StreamWriter = require('../N3').StreamWriter;
var chai = require('chai'),
    Readable = require('stream').Readable,
    Writable = require('stream').Writable;
chai.should();

describe('N3StreamWriter', function () {
  describe('The N3StreamWriter module', function () {
    it('should be a function', function () {
      N3StreamWriter.should.be.a('function');
    });

    it('should make N3Lexer objects', function () {
      N3StreamWriter().should.be.an.instanceof(N3StreamWriter);
    });

    it('should be an N3Lexer constructor', function () {
      new N3StreamWriter().should.be.an.instanceof(N3StreamWriter);
    });
  });

  describe('An N3StreamWriter instance', function () {
    it('should serialize 0 triples',
      shouldSerialize([], ''));

    it('should serialize 1 triple',
      shouldSerialize([['abc', 'def', 'ghi']],
                      '<abc> <def> <ghi>.\n'));

    it('should serialize 2 triples',
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['jkl', 'mno', 'pqr']],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n'));

    it('should serialize 3 triples',
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['jkl', 'mno', 'pqr'],
                       ['stu', 'vwx', 'yz']],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'));

    it('should not serialize a literal in the subject',
      shouldNotSerialize([['"a"', 'b', '"c']],
                          'A literal as subject is not allowed: "a"'));

    it('should not serialize a literal in the predicate',
      shouldNotSerialize([['a', '"b"', '"c']],
                          'A literal as predicate is not allowed: "b"'));

    it('should use prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#', c: 'http://a.org/b' } },
                      [['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                       ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                       ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3']],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n' +
                      'a:bc b:ef a:bhi.\n' +
                      '<http://a.org/bc/de> <http://a.org/b#e#f> <http://a.org/b#x/t>.\n' +
                      '<http://a.org/3a> <http://a.org/b#3a> b:a3.\n'));
  });
});


function shouldSerialize(options, tripleArrays, expectedResult) {
  if (!expectedResult)
    expectedResult = tripleArrays, tripleArrays = options, options = null;
  return function (done) {
    var inputStream = new ArrayReader(tripleArrays),
        transform = new N3StreamWriter(options),
        outputStream = new StringWriter();
    inputStream.pipe(transform);
    transform.pipe(outputStream);
    transform.on('error', done);
    transform.on('end', function () {
      outputStream.result.should.equal(expectedResult);
      done();
    });
  };
}

function shouldNotSerialize(tripleArrays, expectedMessage) {
  return function (done) {
    var inputStream = new ArrayReader(tripleArrays),
        transform = new N3StreamWriter(),
        outputStream = new StringWriter();
    inputStream.pipe(transform);
    transform.pipe(outputStream);
    transform.on('error', function (error) {
      error.should.be.an.instanceof(Error);
      error.message.should.equal(expectedMessage);
      done();
    });
  };
}

function ArrayReader(items) {
  var reader = new Readable({ objectMode: true });
  items = items.map(function (i) { return { subject: i[0], predicate: i[1], object: i[2] }; });
  reader._read = function () { this.push(items.shift() || null); };
  return reader;
}

function StringWriter() {
  var writer = new Writable({ encoding: 'utf-8', decodeStrings: false });
  writer.result = '';
  writer._write = function (chunk, encoding, done) { this.result += chunk; done(); };
  return writer;
}
