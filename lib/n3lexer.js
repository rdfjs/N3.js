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
  // The input can be a string or a stream.
  tokenize: function (input, callback) {
    var self = this;
    this._pos = 0;
    this._line = 1;
    
    // If the input is a string, continuously emit tokens through callback until the end.
    if (typeof(input) === 'string') {
      this._input = input;
      this._inputComplete = true;
      process.nextTick(function () {
        while (self._input !== undefined)
          self.next(callback);
      });
    }
    // Otherwise, the input must be a stream.
    else {
      this._input = '';
      this._inputComplete = false;
      
      // Read strings, not buffers.
      input.setEncoding('utf8');
      
      // If new data arrives…
      input.on('data', function (data) {
        // …discard old data, add new data to the buffer, and adjust the read position.
        if (self._pos === self._input.length)
          self._input = data;
        else
          self._input = self._input.substr(self._pos) + data;
        self._pos = 0;
        
        // Parse as far as we can, i.e., until the read position no longer advances.
        var lastPos = -1;
        while (lastPos < self._pos) {
          lastPos = self._pos;
          self.next(callback);
        }
      });
      // If we're at the end of the stream…
      input.on('end', function () {
        // …parse until the end.
        self._inputComplete = true;
        while (self._input !== undefined)
          self.next(callback);
      });
    }
  },
  
  // ### `next` fires the callback with the next token.
  next: function (callback) {
    // Only emit tokens if there's still input left.
    if (this._input === undefined)
      return;
    
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
    
    // Emit the EOF token if we're at the end and reading is complete.
    if (this._pos >= this._input.length) {
      if (!this._inputComplete)
        return;
      token.type = "eof";
      delete this._input;
      return callback(null, token);
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
      
      // If the input is streaming, require at least 1024 characters after the string,
      // to make sure we recognize multiline strings, language codes, and string types.
      if (!this._inputComplete && this._input.length < string.lastIndex + 1024)
        return;
      
      // Is this a triple quoted string? (They can contain newlines.)
      if (match[1]) {
        // Count the newlines and advance line counter.
        this._line += match[1].split(/\r\n|\r|\n/).length - 1;
        token.quotedValue = match[1];
      }
      // It is a regular quoted string.
      else {
        token.quotedValue = match[2];
        // If we're streaming, the string might be part of a triple quoted string and, as a result,
        // be falsely recognized as an empty string, in which case the next character will be a quote.
        if (token.quotedValue === '""' && this._input[string.lastIndex] === '"')
          // Don't return the token then.
          return;
      }
      
      // Try to find language code.
      langcode.lastIndex = string.lastIndex;
      if ((match = langcode.exec(this._input)) && (match.index === string.lastIndex) && match[1])
        token.language = match[1];
      this._pos = string.lastIndex;
    }
    // Try to find a dot.
    else if ((match = dot.exec(this._input)) && (match.index === this._pos)) {
      token.type = "dot";
    }
    // What if nothing of the above was found?
    else {
      // We could be in streaming mode, and then we just wait for more input to arrive.
      if (!this._inputComplete)
        return;
      
      // Otherwise, a syntax error has occurred in the input.
      nonwhitespace.lastIndex = this._pos;
      match = nonwhitespace.exec(this._input);
      delete this._input;
      return callback('Unexpected "' + match[0] + '" on line ' + this._line + '.');
    }
    
    // Advance to next part to tokenize.
    this._pos += match[0].length;
    
    // Emit the parsed token.
    return callback(null,  token);
  },
};

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
