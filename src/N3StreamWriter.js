// **N3StreamWriter** serializes a quad stream into a text stream.
import { Transform } from 'readable-stream';
import N3Writer from './N3Writer';

// Minimum size of coalesced output chunks
const MIN_CHUNK_SIZE = 65536;

// ## Constructor
export default class N3StreamWriter extends Transform {
  constructor(options) {
    super({ encoding: 'utf8', writableObjectMode: true });

    // Serialized output is coalesced into larger chunks before being pushed,
    // such that the stream machinery and the downstream string-to-Buffer
    // conversion run once per chunk rather than once per serialized fragment
    this._buffer = '';

    // Set up writer with a dummy stream object
    const writer = this._writer = new N3Writer({
      write: (chunk, encoding, callback) => {
        this._buffer += chunk;
        if (this._buffer.length >= MIN_CHUNK_SIZE)
          this._pushBuffer();
        callback && callback();
      },
      end: callback => { this._pushBuffer(); this.push(null); callback && callback(); },
    }, options);

    // Implement Transform methods on top of writer;
    // a quad that fails to serialize first flushes the output buffered before it
    let pendingDone = null;
    const quadDone = error => {
      const done = pendingDone;
      pendingDone = null;
      if (error)
        this._pushBuffer();
      done(error);
    };
    this._transform = (quad, encoding, done) => {
      pendingDone = done;
      writer.addQuad(quad, quadDone);
    };
    this._flush = done => { writer.end(done); };
  }

  // ### `_pushBuffer` pushes coalesced output downstream
  _pushBuffer() {
    if (this._buffer !== '') {
      this.push(this._buffer);
      this._buffer = '';
    }
  }

// ### Serializes a stream of quads
  import(stream) {
    stream.on('data',   quad => { this.write(quad); });
    stream.on('end',    () => { this.end(); });
    stream.on('error',  error => { this._pushBuffer(); this.emit('error', error); });
    stream.on('prefix', (prefix, iri) => { this._writer.addPrefix(prefix, iri); });
    return this;
  }
}
