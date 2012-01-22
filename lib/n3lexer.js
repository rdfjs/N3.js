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
  
  // ### `tokenize` tranforms an N3 document into an array of tokens.
  tokenize: function (input) {
    var tokens = [],
        part = input,
        pos = 0,
        line = 1,
        match;
    while (part.length > 0) {
      // Count newlines.
      if (match = newline.exec(part)) {
        line++;
      }
      // Ignore whitespace.
      else if (match = whitespace.exec(part)) {
        /* do nothing */
      }
      // Try to find an `explicituri`.
      else if (match = explicituri.exec(part)) {
        tokens.push({ type: "explicituri", uri: match[1] });
      }
      // Try to find a dot.
      else if (match = dot.exec(part)) {
        tokens.push({ type: "dot" });
      }
      // Throw an error in other cases.
      else {
        match = nonwhitespace.exec(part);
        throw new Error('Unexpected "' + match[0] + '" on line ' + line + '.');
      }
      // Find next part to parse.
      pos += match[0].length;
      part = input.substring(pos);
    }
    return tokens;
  }
};

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
