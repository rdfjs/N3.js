// **N3Writer** writes N3 documents.

// Matches a literal as represented in memory by the N3 library
var N3LiteralMatcher = /^"((?:.|\n|\r)*)"(?:\^\^<(.+)>|@([\-a-z]+))?$/i;

// Characters in literals that require escaping
var literalEscape = /["\\\t\n\r\b\f]/g;
var literalReplacements = {
  '\\': '\\\\',
  '"' : '\\"',
  '\t': '\\t',
  '\n': '\\n',
  '\r': '\\r',
  '\b': '\\b',
  '\f': '\\f',
};

// ## Constructor
function N3Writer(outputStream, prefixes) {
  if (!(this instanceof N3Writer))
    return new N3Writer(outputStream);

  this._outputStream = outputStream;
  this._prefixURIs = Object.create(null);
  if (prefixes)
    this.addPrefixes(prefixes);
}

N3Writer.prototype = {
  // ## Private methods

  // ### `_write` writes the arguments to the output stream (last argument is callback)
  _write: function () {
    for (var i = 0, l = arguments.length - 2; i <= l; i++)
      this._outputStream.write(arguments[i], 'utf8', i === l ? arguments[l + 1] : null);
  },

  // ### `_writeEntity` writes a URI or literal to the output stream
  _writeEntity: function (entity, done) {
    var literalMatch = N3LiteralMatcher.exec(entity);
    // write a literal
    if (literalMatch)
      this._writeLiteral(literalMatch[1], literalMatch[2], literalMatch[3], done);
    // write a URI
    else
      this._writeURI(entity, done);
  },

  // ### `_writeURI` writes a URI to the output stream
  _writeURI: function (uri, done) {
    var prefixMatch = uri.match(/^(.*[#\/])([a-z][\-_a-z0-9]*)$/i), prefix;
    if (!prefixMatch || !(prefix = this._prefixURIs[prefixMatch[1]]))
      this._write('<', uri, '>', done);
    else
      this._write(prefix, prefixMatch[2], done);
  },

  // ### `_writeLiteral` writes a literal to the output stream
  _writeLiteral: function (value, type, language, done) {
    if (literalEscape.test(value)) {
      value = value.replace(literalEscape, function (match) {
        return literalReplacements[match];
      });
    }

    this._write('"', value, '"', type || language ? null : done);
    if (type) {
      this._write('^^', null);
      this._writeURI(type, done);
    }
    else if (language) {
      this._write('@', language, done);
    }
  },

  // ### `_writeSubject` writes a subject to the output stream
  _writeSubject: function (subject, done) {
    if (subject[0] === '"')
      throw new Error('A literal as subject is not allowed: ' + subject);
    this._writeURI(subject, done);
  },

  // ### `_writePredicate` writes a predicate to the output stream
  _writePredicate: function (predicate, done) {
    if (predicate[0] === '"')
      throw new Error('A literal as predicate is not allowed: ' + predicate);
    this._writeURI(predicate, done);
  },

  // ### `_writeObject` writes an object to the output stream
  _writeObject: function (object, done) {
    this._writeEntity(object, done);
  },

  // ### `addTriple` adds the triple to the output stream
  addTriple: function (triple, done) {
    try {
      // Don't repeat the subject if it's the same
      if (this._prevSubject === triple.subject) {
        // Don't repeat the predicate if it's the same
        if (this._prevPredicate === triple.predicate) {
          this._write(', ', null);
        }
        // Same subject, different predicate
        else {
          this._write(';\n    ', null);
          this._writePredicate(triple.predicate);
          this._write(' ', null);

          this._prevPredicate = triple.predicate;
        }
      }
      // Different subject; write the whole triple
      else {
        // End a possible previous triple
        if (this._prevSubject)
          this._write('.\n', null);
        this._writeSubject(triple.subject);
        this._write(' ', null);
        this._writePredicate(triple.predicate);
        this._write(' ', null);

        this._prevSubject = triple.subject;
        this._prevPredicate = triple.predicate;
      }
      // In all cases, write the object
      this._writeObject(triple.object, done);
    }
    catch (error) {
      done && done(error);
    }
  },

  // ### `addTriples` adds the triples to the output stream
  addTriples: function (triples) {
    for (var i = 0; i < triples.length; i++)
      this.addTriple(triples[i]);
  },

  // ### `addPrefixes` adds the prefixes to the output stream
  addPrefix: function (prefix, uri, done) {
    if (/[#\/]$/.test(uri)) {
      this._prefixURIs[uri] = prefix + ':';
      this._write('@prefix ', prefix, ': <', uri, '>.\n', done);
    }
  },

  // ### `addPrefixes` adds the prefixes to the output stream
  addPrefixes: function (prefixes, done) {
    for (var prefix in prefixes)
      this.addPrefix(prefix, prefixes[prefix]);
    this._write('\n', done);
  },

  // ### `end` signals the end of the output stream
  end: function (done) {
    if (this._prevSubject)
      this._write('.\n', null);
    this._outputStream.end(done);
  },
};

// ## Exports

// Export the `N3Writer` class as a whole.
module.exports = N3Writer;
