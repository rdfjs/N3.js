// **N3StreamParser** parses a text stream into a quad stream.
import { Transform } from 'readable-stream';
import N3Parser from './N3Parser';

// ## Constructor
export default class N3StreamParser extends Transform {
  constructor(options) {
    super({ decodeStrings: true });
    this._readableState.objectMode = true;

    // Set up parser with dummy stream to obtain `data` and `end` callbacks
    const parser = new N3Parser(options);
    let onData, onEnd;

    const callbacks = {
        // Handle quads by pushing them down the pipeline
      onQuad: (error, quad) => { error && this.emit('error', error) || quad && this.push(quad); },
        // Emit prefixes through the `prefix` event
      onPrefix: (prefix, uri) => { this.emit('prefix', prefix, uri); },
    };

    if (options && options.comments)
      callbacks.onComment = comment => { this.emit('comment', comment); };

    parser.parse({
      on: (event, callback) => {
        switch (event) {
        case 'data': onData = callback; break;
        case 'end':   onEnd = callback; break;
        }
      },
    }, callbacks);

    // Implement Transform methods through parser callbacks
    this._transform = (chunk, encoding, done) => { onData(chunk); done(); };
    this._flush = done => { onEnd(); done(); };
  }

  // ### Parses a stream of strings
  import(stream) {
    stream.on('data',  chunk => { this.write(chunk); });
    stream.on('end',   ()      => { this.end(); });
    stream.on('error', error => { this.emit('error', error); });
    return this;
  }
}
