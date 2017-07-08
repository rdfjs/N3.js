// **N3StreamParser** parses an N3 stream into a triple stream.
var Transform = require('stream').Transform,
    util = require('util'),
    N3Parser = require('./N3Parser.js');

// ## Constructor
function N3StreamParser(options) {
  if (!(this instanceof N3StreamParser))
    return new N3StreamParser(options);

  // Initialize Transform base class
  Transform.call(this, { decodeStrings: true });
  this._readableState.objectMode = true;

  // Set up parser
  var self = this, parser = new N3Parser(options), onData, onEnd;
  // Pass dummy stream to obtain `data` and `end` callbacks
  parser.parse({
    on: function (event, cb) {
      switch (event) {
      case 'data': onData = cb; break;
      case 'end':   onEnd = cb; break;
      }
    },
  },
  // Handle triples by pushing them down the pipeline
  function (error, t) { error && self.emit('error', error) || t && self.push(t); },
  // Emit prefixes through the `prefix` event
  function (prefix, uri) { self.emit('prefix', prefix, uri); });

  // Implement Transform methods through parser callbacks
  this._transform = function (chunk, encoding, done) { onData(chunk); done(); };
  this._flush = function (done) { onEnd(); done(); };
}
util.inherits(N3StreamParser, Transform);

// ## Exports
module.exports = N3StreamParser;
