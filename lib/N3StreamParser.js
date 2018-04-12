// **N3StreamParser** parses a text stream into a quad stream.
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
  function (prefix, uri) { self.emit('prefix', prefix, uri); });

  // Implement Transform methods through parser callbacks
  this._transform = function (chunk, encoding, done) { onData(chunk); done(); };
  this._flush = function (done) { onEnd(); done(); };
}
util.inherits(N3StreamParser, Transform);

// ### Parses a stream of strings
N3StreamParser.prototype.import = function (stream) {
  var self = this;
  stream.on('data',  function (chunk) { self.write(chunk); });
  stream.on('end',   function ()      { self.end(); });
  stream.on('error', function (error) { self.emit('error', error); });
  return this;
};

// ## Exports
module.exports = N3StreamParser;
