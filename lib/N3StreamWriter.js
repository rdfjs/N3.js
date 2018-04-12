// **N3StreamWriter** serializes a quad stream into a text stream.
var Transform = require('stream').Transform,
    util = require('util'),
    N3Writer = require('./N3Writer.js');

// ## Constructor
function N3StreamWriter(options) {
  if (!(this instanceof N3StreamWriter))
    return new N3StreamWriter(options);

  // Initialize Transform base class
  Transform.call(this, { encoding: 'utf8' });
  this._writableState.objectMode = true;

  // Set up writer with a dummy stream object
  var self = this;
  var writer = this._writer = new N3Writer({
    write: function (quad, encoding, callback) { self.push(quad); callback && callback(); },
    end: function (callback) { self.push(null); callback && callback(); },
  }, options);

  // Implement Transform methods on top of writer
  this._transform = function (quad, encoding, done) { writer.addQuad(quad, done); };
  this._flush = function (done) { writer.end(done); };
}
util.inherits(N3StreamWriter, Transform);

// ### Serializes a stream of quads
N3StreamWriter.prototype.import = function (stream) {
  var self = this;
  stream.on('data',   function (quad)  { self.write(quad); });
  stream.on('end',    function ()      { self.end(); });
  stream.on('error',  function (error) { self.emit('error', error); });
  stream.on('prefix', function (prefix, iri) { self._writer.addPrefix(prefix, iri); });
  return this;
};

// ## Exports
module.exports = N3StreamWriter;
