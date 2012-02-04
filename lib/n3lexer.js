// **N3Lexer** tokenizes N3 documents.
// ## Regular expressions
// The expressions below were taken from the [context-free grammar in N3](http://www.w3.org/2000/10/swap/grammar/n3.n3).
var explicituri = /<([^>]*)>/g;
var string = /""("[^"\\]*(?:(?:\\.|"(?!""))[^"\\]*)*")""|("[^"\\]*(?:\\.[^"\\]*)*")/g;
var langcode = /(?:@([a-z]+(?:-[a-z0-9]+)*))?/g;
// Other tokens.
var dot = /\./g;
// Whitespace, newlines, and comments are actually not specified yet in the current N3 grammar.
var newline = /[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/g;
var whitespace = /[ \t]+|#[^\n\r]*/g;
var nonwhitespace = /\S*/g;

// ## Constructor
function N3Lexer() {
  // We use a dummy constructor to enable construction without `new`.
  function Constructor() {}
  Constructor.prototype = N3Lexer.prototype;
  
  // Initialize the new `N3Lexer`.
  var n3Lexer = new Constructor();
  
  // Return the new `N3Lexer`.
  return n3Lexer;
}

N3Lexer.prototype = {
  constructor: N3Lexer,
  
  // ## Public functions
  
  // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
  // The next token can be retrieved with `next`, all tokens with `all`.
  tokenize: function (input) {
    this._input = input;
    this._pos = 0;
    this._line = 1;
    return this;
  },
  
  // ### `next` returns the next token.
  next: function () {
    // Only return tokens if there's still input left.
    if (this._input === undefined)
      return null;
    
    // Count and skip newlines.
    var match;
    newline.lastIndex = this._pos;
    while ((match = newline.exec(this._input)) && match.index === this._pos) {
      this._line++;
      this._pos = newline.lastIndex;
    }
      
    // Skip whitespace.
    whitespace.lastIndex = this._pos;
    if ((match = whitespace.exec(this._input)) && match.index === this._pos) {
      this._pos = whitespace.lastIndex;
    }
    
    // Create token skeleton.
    var token = { line: this._line };
    
    // Return the EOF token if we're at the end.
    if (this._pos >= this._input.length) {
      token.type = "eof";
      delete this._input;
      return token;
    }
    
    // Set matching regular expressions at right position.
    explicituri.lastIndex = string.lastIndex = dot.lastIndex = this._pos;

    // Try to find an `explicituri`.
    if ((match = explicituri.exec(this._input)) && (match.index === this._pos)) {
      token.type = "explicituri";
      token.uri = match[1];
    }
    // Try to find a string literal.
    else if ((match = string.exec(this._input)) && (match.index === this._pos)) {
      token.type = "literal";
      // Is this a triple quoted string? (They can contain newlines.)
      if (match[1]) {
        // Count the newlines and advance line counter.
        this._line += match[1].split(/\r\n|\r|\n/).length - 1;
        token.quotedValue = match[1];
      }
      // It is a regular quoted string.
      else {
        token.quotedValue = match[2];
      }
      // Advance input.
      this._pos = string.lastIndex;
      langcode.lastIndex = this._pos;
      // Try to find language code.
      if ((match = langcode.exec(this._input)) && (match.index === this._pos) && match[1])
        token.language = match[1];
    }
    // Try to find a dot.
    else if ((match = dot.exec(this._input)) && (match.index === this._pos)) {
      token.type = "dot";
    }
    // Throw an error in other cases.
    else {
      nonwhitespace.lastIndex = this._pos;
      match = nonwhitespace.exec(this._input);
      throw new Error('Unexpected "' + match[0] + '" on line ' + this._line + '.');
    }
    
    // Advance to next part to tokenize.
    this._pos += match[0].length;
    
    return token;
  },
  
  // ### `all` returns an array of all remaning tokens.
  all: function (input) {
    var tokens = [],
        token;
    
    while (token = this.next())
      tokens.push(token);
    
    return tokens;
  }
};

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
