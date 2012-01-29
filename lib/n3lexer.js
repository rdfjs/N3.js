// **N3Lexer** tokenizes N3 documents.

// ## Regular expressions
// The expressions below were taken from the [context-free grammar in N3](http://www.w3.org/2000/10/swap/grammar/n3.n3).
var explicituri = /^<([^>]*)>/;
// Other tokens.
var dot = /^\./;
// Whitespace and newlines are actually not defined yet in N3.
var newline = /^[ \t\r]*\n[ \t\r]*/;
var whitespace = /^[ \t\r]+/;
var nonwhitespace = /^\S*/;

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
  
  // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
  // The next token can be retrieved with `next`, all tokens with `all`.
  tokenize: function (input) {
    var line = 1,
        eof = false,
        match;
    
    this.next = function () {
      // Count and skip newlines.
      while (match = newline.exec(input)) {
        line++;
        input = input.substring(match[0].length);
      }
        
      // Skip whitespace.
      if (match = whitespace.exec(input)) {
        input = input.substring(match[0].length);
      }
      
      // Create token skeleton.
      var token = { line: line };
      
      // Return the EOF token if we're at the end.
      if (!input.length) {
        token.type = "eof";
        return eof ? null : eof = token;
      }

      // Try to find an `explicituri`.
      if (match = explicituri.exec(input)) {
        token.type = "explicituri";
        token.uri = match[1];
      }
      // Try to find a dot.
      else if (match = dot.exec(input)) {
        token.type = "dot";
      }
      // Throw an error in other cases.
      else {
        match = nonwhitespace.exec(input);
        throw new Error('Unexpected "' + match[0] + '" on line ' + line + '.');
      }
      
      // Advance to next part to tokenize.
      input = input.substring(match[0].length);
      
      return token;
    };
    
    return this;
  },
  
  // ### `all` returns an array of all remaning tokens.
  all: function (input) {
    var next = this.next,
        tokens = [],
        token;
    
    while (token = next())
      tokens.push(token);
    
    return tokens;
  }
};

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
