// **N3StreamWriter** serializes a quad stream into a text stream.
import { Transform } from 'readable-stream';
import N3Writer from './N3Writer';

const MIN_CHUNK_SIZE = 16 * 1024;
const DEFAULT_FLUSH_DELAY_MS = 20;

// ## Constructor
export default class N3StreamWriter extends Transform {
  constructor(options) {
    super({ encoding: 'utf8', writableObjectMode: true });

    // Coalesce serialized fragments into larger stream chunks
    this._buffer = '';

    // Flush partial chunks after a bounded delay
    this._flushTimer = null;
    this._flushDelay = options && options.flushDelay !== undefined ?
      options.flushDelay : DEFAULT_FLUSH_DELAY_MS;

    // Set up writer with a dummy stream object
    const writer = this._writer = new N3Writer({
      write: (chunk, encoding, callback) => {
        this._buffer += chunk;
        if (this._buffer.length >= MIN_CHUNK_SIZE)
          this._pushBuffer();
        else if (this._flushTimer === null)
          this._armFlushTimer();
        callback && callback();
      },
      end: callback => { this._pushBuffer(); this.push(null); callback && callback(); },
    }, options);

    // Flush buffered output before serialization errors
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

  // ### `_pushBuffer` flushes coalesced output to the stream queue
  _pushBuffer() {
    this._clearFlushTimer();
    if (this._buffer !== '') {
      this.push(this._buffer);
      this._buffer = '';
    }
  }

  // ### `_armFlushTimer` schedules a partial-chunk flush
  _armFlushTimer() {
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._pushBuffer();
    }, this._flushDelay);
    // Browser timers do not implement `unref`
    this._flushTimer.unref && this._flushTimer.unref();
  }

  // ### `_clearFlushTimer` cancels a scheduled flush
  _clearFlushTimer() {
    if (this._flushTimer !== null) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
  }

  // ### `_destroy` cancels a scheduled flush, so it cannot fire afterwards
  _destroy(error, callback) {
    this._clearFlushTimer();
    super._destroy(error, callback);
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
