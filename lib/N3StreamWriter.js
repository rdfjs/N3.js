// **N3StreamWriter** serializes a triple stream into an N3 stream
var Transform = require('stream').Transform,
    util = require('util'),
    N3Writer = require('./N3Writer.js');

// ## Constructor
function N3StreamWriter(config) {
  if (!(this instanceof N3StreamWriter))
    return new N3StreamWriter(config);

  // Initialize Transform base class
  Transform.call(this, { encoding: 'utf8' });
  this._writableState.objectMode = true;

  // Set up writer with a dummy stream object
  var push = this.push.bind(this);
  this._writer = new N3Writer({
    write: function (chunk, encoding, callback) { push(chunk); callback && callback(); },
    end: function (callback) { push(null); callback && callback(); },
  });
}
util.inherits(N3StreamWriter, Transform);

// ## Private methods
// ### `_transform` writes the triple to the output stream
N3StreamWriter.prototype._transform = function (triple, encoding, done) {
  this._writer.addTriple(triple, done);
};
// ### `_flush` handles the end of a triple stream
N3StreamWriter.prototype._flush = function (done) {
  this._writer.end(done);
};

// ## Exports

// Export the `N3StreamWriter` class as a whole.
module.exports = N3StreamWriter;
