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
    // If an EOF token arrives in the top context, signal that we're done.
    case 'eof':
      return this._callback(null, null);
    // It could be a prefix declaration.
    case '@prefix':
      return this._readPrefix;
    // Otherwise, the next token must be a subject.
    default:
      return this._readSubject(token);
    }
  },
  
  // ### `_readSubject` reads a triple's subject.
  _readSubject: function (token) {
    switch (token.type) {
    case 'explicituri':
      this._subject = token.value;
      break;
    case 'qname':
      var prefix = this._prefixes[token.prefix];
      if (!prefix)
        return this._error('Undefined prefix "' + token.prefix + ':"', token);
      this._subject = prefix + token.value;
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
      this._predicate = token.value;
      break;
    case 'qname':
      var prefix = this._prefixes[token.prefix];
      if (!prefix)
        return this._error('Undefined prefix "' + token.prefix + ':"', token);
      this._predicate = prefix + token.value;
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
      this._object = token.value;
      break;
    case 'qname':
      var prefix = this._prefixes[token.prefix];
      if (!prefix)
        return this._error('Undefined prefix "' + token.prefix + ':"', token);
      this._object = prefix + token.value;
      break;
    case 'literal':
      this._object = token.value;
      return this._readDataTypeOrLang;
    default:
      return this._error('Expected object to follow "' + this._predicate + '"', token);
    }
    // The next token must be punctuation.
    return this._readPunctuation;
  },
  
  // ### `_readDataTypeOrLang` reads an _optional_ data type or language.
  _readDataTypeOrLang: function (token) {
    switch (token.type) {
    case 'langcode':
      this._object += '@' + token.language;
      return this._readPunctuation;
    default:
      return this._readPunctuation(token);
    }
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
  
  // ### `_readPrefix` reads the prefix of a prefix declaration.
  _readPrefix: function (token) {
    if (token.type !== 'prefix')
      return this._error('Expected prefix to follow @prefix', token);
    this._prefix = token.value;
    return this._readPrefixURI;
  },
  
  // ### `_readPrefixURI` reads the URI of a prefix declaration.
  _readPrefixURI: function (token) {
    if (token.type !== 'explicituri')
      return this._error('Expected explicituri to follow prefix "' + this.prefix + '"', token);
    this._prefixURI = token.value;
    return this._readPrefixPunctuation;
  },
  
  // ### `_readPrefixPunctuation` reads the punctiation of a prefix declaration.
  _readPrefixPunctuation: function (token) {
    if (token.type !== 'dot')
      return this._error('Expected prefix declaration of "' + this.prefix + '" to end with a dot', token);
    this._prefixes[this._prefix] = this._prefixURI;
    return this._readInTopContext;
  },

  // ### `_error` emits an error message through the callback.
  _error: function (message, token) {
    this._callback(message + ' at line ' + token.line + '.');
  },
  
  // ## Public methods
  
  // ### `parse` parses the N3 input and emits each parsed triple through the callback.
  parse: function (input, callback) {
    var self = this;
    // Initialize prefix declarations.
    this._prefixes = Object.create(null);
    // Set the triple callback.
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
