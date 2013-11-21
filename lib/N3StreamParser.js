// **N3StreamParser** parses an N3 stream into a triple stream
var Transform = require('stream').Transform,
    util = require('util'),
    N3Parser = require('./N3Parser.js');

// ## Constructor
function N3StreamParser(config) {
  if (!(this instanceof N3StreamParser))
    return new N3StreamParser(config);

  // Initialize Transform base class
  Transform.call(this, { decodeStrings: true });
  this._readableState.objectMode = true;

  // Set up parser with a dummy stream object, storing the callbacks
  var self = this;
  new N3Parser(config).parse({
      setEncoding: function () {},
      on: function (event, callback) {
        if (event === 'data')
          self._processChunk = callback;
        else if (event === 'end')
          self._processEnd = callback;
      },
    },
    // Handle triples by pushing them down the pipeline
    function (error, triple) {
      if (error)
        self.emit('error', new Error(error));
      else if (triple)
        self.push(triple);
    },
    // Emit prefixes through the `prefix` event
    this.emit.bind(this, 'prefix')
  );
}
util.inherits(N3StreamParser, Transform);

// ## Private methods
// ### `_transform` parses the N3 fragment to triples
N3StreamParser.prototype._transform = function (chunk, encoding, done) {
  this._processChunk(chunk);
  done();
};
// ### `_flush` handles the end of an N3 stream
N3StreamParser.prototype._flush = function (done) {
  this._processEnd();
  done();
};

// ## Exports
// Export the `N3StreamParser` class as a whole.
module.exports = N3StreamParser;
