// **N3Lexer** tokenizes N3 documents.
// ## Constructor
function N3Lexer() {
  // We use a dummy constructor to enable construction without `new`.
  function Constructor() {}
  Constructor.prototype = N3Lexer.prototype;
  
  // Initialize the new `N3Lexer`.
  n3Lexer = new Constructor();
  
  // Return the new `N3Lexer`.
  return n3Lexer;
}

N3Lexer.prototype = {
  constructor: N3Lexer,
  
  // ## Public functions
  
  // ### `tokenize` tranforms an N3 document into an array of tokens.
  tokenize: function (input) {
    var tokens = [];
    return tokens;
  }
};

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
