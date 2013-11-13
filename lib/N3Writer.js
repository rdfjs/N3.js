// **N3Writer** writes N3 documents.

// Matches a literal as represented in memory by the N3 library
var N3LiteralMatcher = /^"(.*)"(?:\^\^<(.+)>|@([\-a-z]+))?$/i;

// ## Constructor
function N3Writer(outputStream) {
  if (!(this instanceof N3Writer))
    return new N3Writer(outputStream);

  this._outputStream = outputStream;
}

N3Writer.prototype = {
  // ## Private methods

  // ### `_write` writes the arguments to the output stream
  _write: function () {
    for (var i = 0, l = arguments.length; i < l; i++)
      this._outputStream.write(arguments[i]);
  },

  // ### `_writeEntity` writes a URI or literal to the output stream
  _writeEntity: function (entity) {
    var literalMatch = N3LiteralMatcher.exec(entity);
    // write a literal
    if (literalMatch)
      this._writeLiteral(literalMatch[1], literalMatch[2], literalMatch[3]);
    // write a URI
    else
      this._writeURI(entity);
  },

  // ### `_writeURI` writes a URI to the output stream
  _writeURI: function (uri) {
    this._write('<', uri, '>');
  },

  // ### `_writeLiteral` writes a literal to the output stream
  _writeLiteral: function (value, type, language) {
    this._write('"', value, '"');
    if (type) {
      this._write('^^');
      this._writeURI(type);
    }
    else if (language) {
      this._write('@', language);
    }
  },

  // ### `_writeSubject` writes a subject to the output stream
  _writeSubject: function (subject) {
    if (subject[0] === '"')
      throw new Error('A literal as subject is not allowed: ' + subject);
    this._writeURI(subject);
  },

  // ### `_writePredicate` writes a predicate to the output stream
  _writePredicate: function (predicate) {
    if (predicate[0] === '"')
      throw new Error('A literal as predicate is not allowed: ' + predicate);
    this._writeURI(predicate);
  },

  // ### `_writeObject` writes an object to the output stream
  _writeObject: function (object) {
    this._writeEntity(object);
  },

  // ### `addTriple` adds a triple to the output stream
  addTriple: function (triple) {
    this._writeSubject(triple.subject);
    this._write(' ');
    this._writePredicate(triple.predicate);
    this._write(' ');
    this._writeObject(triple.object);
    this._write('.\n');
  },

  // ### `end` signals the end of the output stream
  end: function () {
    this._outputStream.end();
  },
};

// ## Exports

// Export the `N3Writer` class as a whole.
module.exports = N3Writer;
