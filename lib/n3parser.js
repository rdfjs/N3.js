// **N3Parser** parses N3 documents.
var N3Lexer = require('./n3lexer.js'),
    N3Store = require('./n3store.js');

// ## Constructor
function N3Parser(config) {
  config = config || {};
  
  // We use a dummy constructor to enable construction without `new`.
  function Constructor() {}
  Constructor.prototype = N3Parser.prototype;
  
  // Initialize the new `N3Parser`.
  var n3Parser = new Constructor();
  n3Parser._lexer = config.lexer || new N3Lexer();
  
  // Return the new `N3Parser`.
  return n3Parser;
}

N3Parser.prototype = {
  constructor: N3Parser,
  
  // ## Private methods
  
  // ### `_readInTopContext` reads a token when in the top context.
  _readInTopContext: function (token) {
    switch (token.type) {
    // Signal that we're done if an EOF token arrives in the top context.
    case 'eof':
      return this._callback(null, null);
    // Otherwise, the next token must be a subject.
    default:
      return this._readSubject(token);
    }
  },
  
  // ### `_readSubject` reads a triple's subject.
  _readSubject: function (token) {
    switch (token.type) {
    case 'explicituri':
      this._subject = token.uri;
      break;
    default:
      return this._error('Unexpected token type "' + token.type, token);
    }
    // The next token must be a predicate.
    return this._readPredicate;
  },
  
  // ### `_readPredicate` reads a triple's predicate.
  _readPredicate: function (token) {
    switch (token.type) {
    case 'explicituri':
      this._predicate = token.uri;
      break;
    default:
      return this._error('Expected predicate to follow "' + this._subject + '"', token);
    }
    // The next token must be an object.
    return this._readObject;
  },
  
  // ### `_readObject` reads a triple's object.
  _readObject: function (token) {
    switch (token.type) {
    case 'explicituri':
      this._object = token.uri;
      break;
    case 'literal':
      this._object = token.quotedValue;
      if (token.language)
        this._object += '@' + token.language;
      break;
    default:
      return this._error('Expected object to follow "' + this._predicate + '"', token);
    }
    // The next token must be punctuation.
    return this._readPunctuation;
  },
  
  // ### `_readSubject` reads punctuation between triples or triple parts.
  _readPunctuation: function (token) {
    switch (token.type) {
    case 'dot':
      // The triple has been completed now, so return it.
      this._callback(null, { subject: this._subject,
                             predicate: this._predicate,
                             object: this._object,
                             context: 'n3/contexts#default' });
      // The triple is now finished and we get back to the top context.
      return this._readInTopContext;
    default:
      return this._error('Expected punctuation to follow "' + this._object + '"', token);
    }
  },
  
  // ### `_error` emits an error message through the callback.
  _error: function (message, token) {
    this._callback(message + ' at line ' + token.line + '.');
  },
  
  // ## Public methods
  
  // ### `parse` parses the N3 input and emits each parsed triple through the callback.
  parse: function (input, callback) {
    var self = this;
    this._callback = callback;
    // The read callback is the next function to be executed when a token arrives.
    // We start reading in the top context.
    this._readCallback = this._readInTopContext;
    // Execute the read callback when a token arrives.
    this._lexer.tokenize(input, function (error, token) {
      if (error)
        self._callback(error);
      else if (self._readCallback)
        self._readCallback = self._readCallback(token);
    });
  }
};

// ## Exports

// Export the `N3Parser` class as a whole.
module.exports = N3Parser;
