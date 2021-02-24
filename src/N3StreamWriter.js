// **N3StreamWriter** serializes a quad stream into a text stream.
import { Transform } from 'readable-stream';
import N3Writer from './N3Writer';

// ## Constructor
export default class N3StreamWriter extends Transform {
  constructor(options) {
    super({ encoding: 'utf8', writableObjectMode: true });

    // Set up writer with a dummy stream object
    const writer = this._writer = new N3Writer({
      write: (quad, encoding, callback) => { this.push(quad); callback && callback(); },
      end: callback => { this.push(null); callback && callback(); },
    }, options);

    // Implement Transform methods on top of writer
    this._transform = (quad, encoding, done) => { writer.addQuad(quad, done); };
    this._flush = done => { writer.end(done); };
  }

// ### Serializes a stream of quads
  import(stream) {
    stream.on('data',   quad => { this.write(quad); });
    stream.on('end',    () => { this.end(); });
    stream.on('error',  error => { this.emit('error', error); });
    stream.on('prefix', (prefix, iri) => { this._writer.addPrefix(prefix, iri); });
    return this;
  }
}
