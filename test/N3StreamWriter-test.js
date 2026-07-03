import { StreamWriter, Quad, NamedNode, termFromId } from '../src';
import { Readable, Writable } from 'readable-stream';

describe('StreamWriter', () => {
  describe('The StreamWriter export', () => {
    it('should be a function', () => {
      expect(typeof StreamWriter).toEqual('function');
    });

    it('should be a StreamWriter constructor', () => {
      expect(new StreamWriter()).toBeInstanceOf(StreamWriter);
    });
  });

  describe('A StreamWriter instance', () => {
    it('should serialize 0 triples', shouldSerialize(''));

    it('should serialize 1 triple', shouldSerialize(['abc', 'def', 'ghi'],
                    '<abc> <def> <ghi>.\n'));

    it('should serialize 2 triples', shouldSerialize(['abc', 'def', 'ghi'],
                    ['jkl', 'mno', 'pqr'],
                    '<abc> <def> <ghi>.\n' +
                    '<jkl> <mno> <pqr>.\n'));

    it('should serialize 3 triples', shouldSerialize(['abc', 'def', 'ghi'],
                    ['jkl', 'mno', 'pqr'],
                    ['stu', 'vwx', 'yz'],
                    '<abc> <def> <ghi>.\n' +
                    '<jkl> <mno> <pqr>.\n' +
                    '<stu> <vwx> <yz>.\n'));

    it(
      'should use prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: new NamedNode('http://a.org/b#'), c: 'http://a.org/b' } },
                      ['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                      ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                      ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n' +
                      '@prefix c: <http://a.org/b>.\n\n' +
                      'a:bc b:ef a:bhi.\n' +
                      '<http://a.org/bc/de> <http://a.org/b#e#f> <http://a.org/b#x/t>.\n' +
                      'a:3a b:3a b:a3.\n'),
    );

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
        expect(outputStream.result).toBe('@prefix a: <http://a.org/>.\n\n' +
                                         '@prefix b: <http://b.org/>.\n\n');
        done();
      });
    });
  });

  describe('output chunking', () => {
    it('should serialize a small document as a single chunk', done => {
      const inputStream = new ArrayReader([
        new Quad(termFromId('abc'), termFromId('def'), termFromId('ghi')),
        new Quad(termFromId('jkl'), termFromId('mno'), termFromId('pqr')),
      ]);
      const writer = new StreamWriter().import(inputStream);
      const chunks = [];
      writer.on('data', chunk => { chunks.push(chunk); });
      writer.on('error', done);
      writer.on('end', () => {
        expect(chunks).toEqual(['<abc> <def> <ghi>.\n<jkl> <mno> <pqr>.\n']);
        done();
      });
    });

    it('should coalesce a large document into chunks of at least 64 KB', done => {
      const quads = [];
      let expected = '';
      for (let i = 0; i < 4000; i++) {
        quads.push(new Quad(termFromId(`http://example.org/subject${i}`),
          termFromId('http://example.org/predicate'),
          termFromId(`http://example.org/object${i}`)));
        expected += `<http://example.org/subject${i}> <http://example.org/predicate> <http://example.org/object${i}>.\n`;
      }
      const writer = new StreamWriter().import(new ArrayReader(quads));
      const chunks = [];
      writer.on('data', chunk => { chunks.push(chunk); });
      writer.on('error', done);
      writer.on('end', () => {
        expect(chunks.join('')).toBe(expected);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.length).toBeLessThan(40);
        for (const chunk of chunks.slice(0, chunks.length - 1))
          expect(chunk.length).toBeGreaterThanOrEqual(65536);
        done();
      });
    });

    it('should emit buffered output before a serialization error', done => {
      const writer = new StreamWriter();
      let data = '';
      writer.on('data', chunk => { data += chunk; });
      writer.on('error', error => {
        expect(error).toBeInstanceOf(TypeError);
        expect(data).toBe('<a> <b> <c>');
        done();
      });
      writer.write(new Quad(termFromId('a'), termFromId('b'), termFromId('c')));
      writer.write(new Quad(termFromId('d'), termFromId('e'), null));
    });

    it('should emit buffered output before an input stream error', done => {
      const input = new Readable({ objectMode: true, read() {} });
      const writer = new StreamWriter().import(input);
      let data = '';
      writer.on('data', chunk => { data += chunk; });
      writer.on('error', error => {
        expect(error.message).toBe('boom');
        expect(data).toBe('<a> <b> <c>');
        done();
      });
      writer.write(new Quad(termFromId('a'), termFromId('b'), termFromId('c')),
        () => { input.emit('error', new Error('boom')); });
    });
  });

  it('passes an error', () => {
    const input = new Readable(), writer = new StreamWriter();
    let error = null;
    input._read = function () {};
    writer.on('error', e => { error = e; });
    writer.import(input);
    input.emit('error', new Error());
    expect(error).toBeInstanceOf(Error);
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
    expect(writer.import(inputStream)).toBe(writer);
    writer.pipe(outputStream);
    writer.on('error', done);
    writer.on('end', () => {
      expect(outputStream.result).toBe(expectedResult);
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
