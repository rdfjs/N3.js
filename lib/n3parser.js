// **N3Parser** parses N3 documents.
var N3Lexer = require('./n3store.js'),
    N3Store = require('./n3store.js');

// ## Constructor
function N3Parser(config) {
  config = config || {};
  
  // We use a dummy constructor to enable construction without `new`.
  function Constructor() {}
  Constructor.prototype = N3Parser.prototype;
  
  // Initialize the new `N3Parser`.
  n3Parser = new Constructor();
  n3Parser._lexer = config.lexer || new N3Lexer();
  
  // Return the new `N3Parser`.
  return n3Parser;
}

N3Parser.prototype = {
  constructor: N3Parser,
  
  // ## Public methods
  
  // ### `parse` returns an `N3Store` containing the parsed triples from the N3 input.
  parse: function (input) {
    var store = new N3Store();
    return store;
  }
};

// ## Exports

// Export the `N3Parser` class as a whole.
module.exports = N3Parser;
