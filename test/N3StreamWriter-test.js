var N3StreamWriter = require('../N3').StreamWriter;
var vows = require('vows'),
    chai = require('chai'),
    expect = chai.expect,
    Readable = require('stream').Readable,
    Writable = require('stream').Writable,
    util = require('util');
chai.should();
chai.use(require('chai-things'));

vows.describe('N3StreamWriter').addBatch({
  'The N3StreamWriter module': {
    topic: function () { return N3StreamWriter; },

    'should be a function': function (N3StreamWriter) {
      N3StreamWriter.should.be.a('function');
    },

    'should make N3Lexer objects': function (N3StreamWriter) {
      N3StreamWriter().should.be.an.instanceof(N3StreamWriter);
    },

    'should be an N3Lexer constructor': function (N3StreamWriter) {
      new N3StreamWriter().should.be.an.instanceof(N3StreamWriter);
    },
  },

  'An N3StreamWriter instance': {
    topic: function () { return function (prefixes) { return new N3StreamWriter(prefixes); }; },

    'should serialize 0 triples':
      shouldSerialize([], ''),

    'should serialize 1 triple':
      shouldSerialize([['abc', 'def', 'ghi']],
                      '<abc> <def> <ghi>.\n'),

    'should serialize 2 triples':
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['jkl', 'mno', 'pqr']],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n'),

    'should serialize 3 triples':
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['jkl', 'mno', 'pqr'],
                       ['stu', 'vwx', 'yz']],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'),

    'should not serialize a literal in the subject':
      shouldNotSerialize([['"a"', 'b', '"c']],
                          'A literal as subject is not allowed: "a"'),

    'should not serialize a literal in the predicate':
      shouldNotSerialize([['a', '"b"', '"c']],
                          'A literal as predicate is not allowed: "b"'),

    'should use prefixes when possible':
      shouldSerialize({ a: 'http://a.org/',
                        b: 'http://a.org/b#',
                        c: 'http://a.org/b' },
                      [['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                       ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                       ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3']],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n' +
                      'a:bc b:ef a:bhi.\n' +
                      '<http://a.org/bc/de> <http://a.org/b#e#f> <http://a.org/b#x/t>.\n' +
                      '<http://a.org/3a> <http://a.org/b#3a> b:a3.\n'),
  },
}).export(module, { reporter: require('vows/lib/vows/reporters/tap') });


function shouldSerialize(prefixes, tripleArrays, expectedResult) {
  if (!expectedResult)
    expectedResult = tripleArrays, tripleArrays = prefixes, prefixes = null;
  return {
    topic: function (n3streamwriterFactory) {
      var callback = this.callback,
          inputStream = new ArrayReader(tripleArrays),
          transform = n3streamwriterFactory(prefixes),
          outputStream = new StringWriter();
      inputStream.pipe(transform);
      transform.pipe(outputStream);
      transform.on('error', callback);
      transform.on('end', function () { callback(null, outputStream.result); });
    },
    'should equal the expected result': function (actual) {
      actual.should.equal(expectedResult);
    },
  };
}

function shouldNotSerialize(tripleArrays, expectedMessage) {
  return {
    topic: function (n3streamwriterFactory) {
      var callback = this.callback,
          inputStream = new ArrayReader(tripleArrays),
          transform = n3streamwriterFactory(),
          outputStream = new StringWriter();
      inputStream.pipe(transform);
      transform.pipe(outputStream);
      transform.on('error', function (error) { callback(null, error); callback = null; });
      transform.on('end', function () { callback && callback('no error raised'); });
    },
    'should equal the right error message': function (actual) {
      actual.message.should.equal(expectedMessage);
    },
  };
}

function ArrayReader(items) {
  var reader = new Readable({ objectMode: true });
  reader._read = function () {
    var item = items.shift();
    if (item)
      this.push({ subject: item[0], predicate: item[1], object: item[2] });
    else
      this.push(null);
  };
  return reader;
}

function StringWriter() {
  var writer = new Writable({ encoding: 'utf-8', decodeStrings: false });
  writer.result = '';
  writer._write = function (chunk, encoding, done) {
    encoding.should.equal('utf8');
    this.result += chunk;
    done();
  };
  return writer;
}
