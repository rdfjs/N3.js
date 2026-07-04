// **N3StreamWriter** serializes a quad stream into a text stream.
import { Transform } from 'readable-stream';
import N3Writer from './N3Writer';

// Minimum size of coalesced output chunks
const MIN_CHUNK_SIZE = 65536;

// Default maximum time (in milliseconds) that output stays coalesced
const DEFAULT_FLUSH_DELAY = 100;

// ## Constructor
export default class N3StreamWriter extends Transform {
  constructor(options) {
    super({ encoding: 'utf8', writableObjectMode: true });

    // Serialized output is coalesced into larger chunks before being pushed,
    // such that the stream machinery and the downstream string-to-Buffer
    // conversion run once per chunk rather than once per serialized fragment
    this._buffer = '';

    // Slow quad sources (e.g., remote query results arriving in real time)
    // could otherwise leave output stuck below the minimum chunk size,
    // so a timer bounds how long output stays buffered.
    // It is armed when the buffer becomes non-empty and cleared on flush,
    // keeping it out of the per-fragment hot path.
    this._flushTimer = null;
    this._flushDelay = options && options.flushDelay !== undefined ?
      options.flushDelay : DEFAULT_FLUSH_DELAY;

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

  // ### `_pushBuffer` pushes coalesced output downstream.
  // It pushes even when downstream applied backpressure:
  // that only moves the bytes from this buffer to the stream's
  // internal queue, leaving total buffered memory unchanged,
  // whereas withholding them could delay delivery indefinitely
  _pushBuffer() {
    this._clearFlushTimer();
    if (this._buffer !== '') {
      this.push(this._buffer);
      this._buffer = '';
    }
  }

  // ### `_armFlushTimer` schedules a flush of output
  // that stays below the minimum chunk size for too long
  _armFlushTimer() {
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._pushBuffer();
    }, this._flushDelay);
    // Do not let the timer keep the Node.js event loop alive
    // (browser timers are plain numbers without `unref`)
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
