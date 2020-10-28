import { StreamWriter, Quad, NamedNode, termFromId } from '../src/';
import { Readable, Writable } from 'readable-stream';

describe('StreamWriter', () => {
  describe('The StreamWriter export', () => {
    it('should be a function', () => {
      StreamWriter.should.be.a('function');
    });

    it('should be a StreamWriter constructor', () => {
      new StreamWriter().should.be.an.instanceof(StreamWriter);
    });
  });

  describe('A StreamWriter instance', () => {
    it('should serialize 0 triples',
      shouldSerialize(''));

    it('should serialize 1 triple',
      shouldSerialize(['abc', 'def', 'ghi'],
                      '<abc> <def> <ghi>.\n'));

    it('should serialize 2 triples',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['jkl', 'mno', 'pqr'],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n'));

    it('should serialize 3 triples',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['jkl', 'mno', 'pqr'],
                      ['stu', 'vwx', 'yz'],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'));

    it('should use prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: new NamedNode('http://a.org/b#'), c: 'http://a.org/b' } },
                      ['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                      ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                      ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n' +
                      '@prefix c: <http://a.org/b>.\n\n' +
                      'a:bc b:ef a:bhi.\n' +
                      '<http://a.org/bc/de> <http://a.org/b#e#f> <http://a.org/b#x/t>.\n' +
                      '<http://a.org/3a> <http://a.org/b#3a> b:a3.\n'));

    it('should take over prefixes from the input stream', done => {
      const inputStream = new Readable(),
          writer = new StreamWriter(),
          outputStream = new StringWriter();
      writer.import(inputStream);
      writer.pipe(outputStream);

      // emit prefixes and close
      inputStream.emit('prefix', 'a', new NamedNode('http://a.org/'));
      inputStream.emit('prefix', 'b', new NamedNode('http://b.org/'));
      inputStream.push(null);

      writer.on('error', done);
      writer.on('end', () => {
        outputStream.result.should.equal('@prefix a: <http://a.org/>.\n\n' +
                                         '@prefix b: <http://b.org/>.\n\n');
        done();
      });
    });
  });

  it('passes an error', () => {
    const input = new Readable(), writer = new StreamWriter();
    let error = null;
    input._read = function () {};
    writer.on('error', e => { error = e; });
    writer.import(input);
    input.emit('error', new Error());
    expect(error).to.be.an.instanceof(Error);
  });
});


function shouldSerialize(/* options?, tripleArrays..., expectedResult */) {
  let tripleArrays = Array.prototype.slice.call(arguments);
  const expectedResult = tripleArrays.pop(),
      options = tripleArrays[0] instanceof Array ? null : tripleArrays.shift();

  tripleArrays = tripleArrays.map(i => {
    return new Quad(termFromId(i[0]), termFromId(i[1]), termFromId(i[2]));
  });

  return function (done) {
    const inputStream = new ArrayReader(tripleArrays),
        writer = new StreamWriter(options),
        outputStream = new StringWriter();
    writer.import(inputStream).should.equal(writer);
    writer.pipe(outputStream);
    writer.on('error', done);
    writer.on('end', () => {
      outputStream.result.should.equal(expectedResult);
      done();
    });
  };
}

function ArrayReader(items) {
  const reader = new Readable({ objectMode: true });
  reader._read = function () { this.push(items.shift() || null); };
  return reader;
}

function StringWriter() {
  const writer = new Writable({ encoding: 'utf-8', decodeStrings: false });
  writer.result = '';
  writer._write = function (chunk, encoding, done) { this.result += chunk; done(); };
  return writer;
}
