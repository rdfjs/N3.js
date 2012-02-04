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
  
  // ### `_readTriples` adds triples with the given subject from the lexer to the store.
  _readTriples: function (store, subject) {
    // Parse the predicate.
    var predicateToken = this._lexer.next();
    switch (predicateToken.type) {
    case 'explicituri':
      var predicate = predicateToken.uri;
      break;
    default:
      throw new Error('Expected predicate to follow "' + subject + '" at line ' + predicateToken.line + '.');
    }
    
    // Parse the object.
    var objectToken = this._lexer.next(), object;
    switch (objectToken.type) {
    case 'explicituri':
      object = objectToken.uri;
      break;
    case 'literal':
      object = objectToken.quotedValue;
      break;
    default:
      throw new Error('Expected object to follow "' + predicate + '" at line ' + predicateToken.line + '.');
    }
    
    // Parse the punctuation.
    var punctuation = this._lexer.next();
    switch (punctuation.type) {
    case 'dot':
      break;
    default:
      throw new Error('Unexpected ' + punctuation.type + ' at line ' + punctuation.line + '.');
    }
    
    // Add the triple to the store.
    store.add(subject, predicate, object);
  },
  
  // ## Public methods
  
  // ### `parse` returns an `N3Store` containing the parsed triples from the N3 input.
  parse: function (input) {
    var lexer = this._lexer.tokenize(input),
        store = new N3Store(),
        token;
    
    while (token = lexer.next()) {
      switch (token.type) {
      case 'eof':
        return store;
      case 'explicituri':
        this._readTriples(store, token.uri);
        break;
      default:
        throw new Error('Unknown token type ' + token.type + '.');
      }
    }
  }
};

// ## Exports

// Export the `N3Parser` class as a whole.
module.exports = N3Parser;
