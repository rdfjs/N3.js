// **N3StreamParser** parses a text stream into a quad stream.
var Transform = require('stream').Transform,
    util = require('util'),
    N3Parser = require('./N3Parser.js');

// ## Constructor
class N3StreamParser {
  constructor(options) {
// Initialize Transform base class
    Transform.call(this, { decodeStrings: true });
    this._readableState.objectMode = true;

// Set up parser
    var self = this, parser = new N3Parser(options), onData, onEnd;
// Pass dummy stream to obtain `data` and `end` callbacks
    parser.parse({
      on: function (event, callback) {
        switch (event) {
        case 'data': onData = callback; break;
        case 'end':   onEnd = callback; break;
        }
      },
    },
      // Handle quads by pushing them down the pipeline
      function (error, quad) { error && self.emit('error', error) || quad && self.push(quad); },
      // Emit prefixes through the `prefix` event
      function (prefix, uri) { self.emit('prefix', prefix, uri); }
    );

// Implement Transform methods through parser callbacks
    this._transform = function (chunk, encoding, done) { onData(chunk); done(); };
    this._flush = function (done) { onEnd(); done(); };
  }

  // ### Parses a stream of strings
  import(stream) {
    var self = this;
    stream.on('data',  function (chunk) { self.write(chunk); });
    stream.on('end',   function ()      { self.end(); });
    stream.on('error', function (error) { self.emit('error', error); });
    return this;
  }
}
util.inherits(N3StreamParser, Transform);

// ## Exports
module.exports = N3StreamParser;
