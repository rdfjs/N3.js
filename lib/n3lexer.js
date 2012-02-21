// **N3Lexer** tokenizes N3 documents.
// ## Regular expressions
var patterns = {
  // These token expressions were taken from the [context-free grammar in N3](http://www.w3.org/2000/10/swap/grammar/n3.n3).
  _explicituri: /<([^>]*)>/g,
  _string: /""("[^"\\]*(?:(?:\\.|"(?!""))[^"\\]*)*")""|("[^"\\]*(?:\\.[^"\\]*)*")/g,
  _langcode: /(?:@([a-z]+(?:-[a-z0-9]+)*))?/g,
  // The lexer needs these other token expressions as well.
  _dot: /\./g,
  // Whitespace, newlines, and comments are actually not specified yet in the current N3 grammar.
  _newline: /[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/g,
  _whitespace: /[ \t]+|#[^\n\r]*/g,
  _nonwhitespace: /\S*/g,
};

// ## Constructor
function N3Lexer() {
  // We use a dummy constructor to enable construction without `new`.
  function Constructor() {}
  Constructor.prototype = N3Lexer.prototype;
  
  // Initialize the new `N3Lexer`.
  var n3Lexer = new Constructor();
  // Create local instances of the regular expressions.
  for (var name in patterns)
    n3Lexer[name] = new CachedRegExp(patterns[name].source, 'g');
  
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
        // …discard already parsed data and add the new data to the buffer.
        if (self._pos === self._input.length)
          self._input = data;
        else
          self._input = self._input.substr(self._pos) + data;
        
        // Reset the position to the beginning of the new input buffer.
        self._pos = 0;
        // Clear the RegExp caches, as they were created with the old position.
        for (var name in patterns)
          self[name].clearMatchCache();
        
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
    while (match = this._newline.execAtIndex(this._input, this._pos)) {
      this._line++;
      this._pos = this._newline.lastIndex;
    }
      
    // Skip whitespace.
    if (match = this._whitespace.execAtIndex(this._input, this._pos)) {
      this._pos = this._whitespace.lastIndex;
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

    // Try to find an `explicituri`.
    if (match = this._explicituri.execAtIndex(this._input, this._pos)) {
      token.type = "explicituri";
      token.uri = match[1];
    }
    // Try to find a string literal.
    else if (match = this._string.execAtIndex(this._input, this._pos)) {
      token.type = "literal";
      
      // If the input is streaming, require at least 1024 characters after the string,
      // to make sure we recognize multiline strings, language codes, and string types.
      if (!this._inputComplete && this._input.length < this._string.lastIndex + 1024)
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
        if (token.quotedValue === '""' && this._input[this._string.lastIndex] === '"')
          // Don't return the token then.
          return;
      }
      
      // Try to find language code.
      if ((match = this._langcode.execAtIndex(this._input, this._string.lastIndex)) && match[1])
        token.language = match[1];
      this._pos = this._string.lastIndex;
    }
    // Try to find a dot.
    else if (match = this._dot.execAtIndex(this._input, this._pos)) {
      token.type = "dot";
    }
    // What if nothing of the above was found?
    else {
      // We could be in streaming mode, and then we just wait for more input to arrive.
      if (!this._inputComplete)
        return;
      
      // Otherwise, a syntax error has occurred in the input.
      this._nonwhitespace.lastIndex = this._pos;
      match = this._nonwhitespace.exec(this._input);
      delete this._input;
      return callback('Unexpected "' + match[0] + '" on line ' + this._line + '.');
    }
    
    // Advance to next part to tokenize.
    this._pos += match[0].length;
    
    // Emit the parsed token.
    return callback(null,  token);
  },
};

// ## CachedRegExp
// `CachedRegExp` is a cached regular expression that allows exact position matching,
// providing an alternative to Mozilla's RegExp sticky flag.
function CachedRegExp(pattern, flags) {
  var regExp = new RegExp(pattern, flags);
  for (var name in CachedRegExp.prototype)
    regExp[name] = CachedRegExp.prototype[name];
  return regExp;
}

CachedRegExp.prototype = {
  // ### `execAtIndex` executes a position-bound regular expression
  // It executes the regular expression against `input`
  // and returns a match only if it occurs at position `index`.
  // If a match occurs at a higher position, this match is cached in `lastMatch`
  // for reuse in subsequent calls; clearing this cache is possible with `clearMatchCache`.
  execAtIndex: function (input, index) {
    // If there is no cache, or if the position has advanced past the cached match…
    if (!this.lastMatch || index > this.lastMatch.index) {
      // …invalidate the match…
      this.lastMatch = null;
      // …and execute the regex at the specified position.
      this.lastIndex = index;
      this.lastMatch = this.exec(input);
      // Return the match if it is successful and starts at the specified position.
      if (this.lastMatch && this.lastMatch.index === index)
        return this.lastMatch;
    }
    // Return the cached match if it starts at the specified position.
    else if (this.lastMatch.index === index) {
      return this.lastMatch;
    }
  },
  
  // ### `clearMatchCache` removes a possibly cached match.
  clearMatchCache: function () {
    this.lastMatch = null;
  }
};

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
