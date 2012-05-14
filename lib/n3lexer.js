// **N3Lexer** tokenizes N3 documents.
// ## Regular expressions
var patterns = {
  // These token expressions were taken from the [context-free grammar in N3](http://www.w3.org/2000/10/swap/grammar/n3.n3).
  _explicituri: /<([^>]*)>/g,
  _string: /"[^"\\]*(?:\\.[^"\\]*)*"(?=[^"\\])/g,
  _tripleQuotedString: /""("[^"\\]*(?:(?:\\.|"(?!""))[^"\\]*)*")""/g,
  _langcode: /@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9\-])/g,
  _prefix: /([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff]*)?:(?=\s)/g,
  _qname:  /([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff]*)?:([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff]*)(?=[\s\.:,])/g,
  _number: /(?:(-)|\+)?(\d+\.\d*|\.\d+|\d+)([eE](?:[\-\+])?\d+)?(?=\s*[,\.])/g,
  _boolean: /(?:true|false)(?=\s+)/g,
  // The lexer needs these other token expressions as well.
  _punctuation: /\.(?!\d)|;|,|\[|\]|\(|\)/g, // If a digit follows a dot, it is a number, not punctuation.
  _fastString: /"[^"\\]+"(?=[^"\\])/g,
  _keyword: /@[a-z]+(?=\s)/g,
  _type: /\^\^(?:<([^>]*)>|([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff]*)?:([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\U00010000-\U000effff]*)(?=[\s\.:,]))/g,
  _shortPredicates: /a(?=\s+|<)/g,
  // Whitespace, newlines, and comments are actually not specified yet in the current N3 grammar.
  _newline: /[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/g,
  _whitespace: /[ \t]+|#[^\n\r]*/g,
  _nonwhitespace: /\S*/g,
};

// Regular expression and replacement string to escape N3 strings.
var escapeSequence = /\\(\\|'|"|n|r|t|u([0-9abcdefABCDEF]{4}))/g;
var escapeReplacements = { '\\': '\\', "'": "'", '"': '"', 'n': '\n', 'r': '\r', 't': '\t' };

// Different punctuation types.
var punctuationTypes = { '.': 'dot', ';': 'semicolon', ',': 'comma',
                         '[': 'bracketopen', ']': 'bracketclose',
                         '(': 'liststart', ')': 'listend' };
var fullPredicates = { 'a': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' };

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
  
  // ## Private methods
  
  // ### `_next` fires the callback with the next token.
  // Returns a boolean indicating whether a token has been emitted.
  _next: function (callback) {
    // Only emit tokens if there's still input left.
    if (this._input === undefined)
      return false;
    
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
    // We initialize all possible properties as strings, so the engine uses one runtime type for all tokens.
    var token = { line: this._line,
                  type: '',
                  value: '',
                  prefix: '',
                };
    
    // Emit the EOF token if we're at the end and reading is complete.
    if (this._pos >= this._input.length) {
      // If we're streaming, don't emit EOF yet.
      if (!this._inputComplete)
        return false;
      // Free the input.
      delete this._input;
      // Emit EOF.
      token.type = 'eof';
      callback(null, token);
      return true;
    }

    // Try to find an `explicituri`.
    if (match = this._explicituri.execAtIndex(this._input, this._pos)) {
      token.type = 'explicituri';
      token.value = match[1];
    }
    // Try to find a dot.
    else if (match = this._punctuation.execAtIndex(this._input, this._pos)) {
      token.type = punctuationTypes[match[0]];
    }
    // Try to find a language code.
    else if (this._prevTokenType === 'literal' && (match = this._langcode.execAtIndex(this._input, this._pos))) {
      token.type = 'langcode';
      token.value = match[1];
    }
    // Try to find a string literal the fast way.
    // This only includes non-empty simple quoted literals without escapes.
    // If streaming, make sure the input is long enough so we don't miss language codes or string types.
    else if (match = this._fastString.execAtIndex(this._input, this._pos)) {
      token.type = 'literal';
      token.value = match[0];
    }
    // Try to find any other string literal wrapped in a pair of quotes.
    else if (match = this._string.execAtIndex(this._input, this._pos)) {
      token.type = 'literal';
      token.value = this._unescapeString(match[0]);
    }
    // Try to find a string literal wrapped in a pair of triple quotes.
    else if (match = this._tripleQuotedString.execAtIndex(this._input, this._pos)) {
      token.type = 'literal';
      // Count the newlines and advance line counter.
      this._line += match[1].split(/\r\n|\r|\n/).length - 1;
      token.value = this._unescapeString(match[1]);
    }
    // Try to find a number.
    else if (match = this._number.execAtIndex(this._input, this._pos)) {
      token.type = 'literal';
      token.value = '"' + (match[1] === '-' ? '-' + match[2] : match[2]);
      if (match[3])
        token.value += match[3].replace('+', '').replace('E', 'e');
      token.value += '"';
    }
    // Try to match a boolean.
    else if (match = this._boolean.execAtIndex(this._input, this._pos)) {
      token.type = 'literal';
      token.value = '"' + match[0] + '"';
    }
    // Try to find a type.
    else if (this._prevTokenType === 'literal' && (match = this._type.execAtIndex(this._input, this._pos))) {
      token.type = 'type';
      if (!match[2]) {
        token.value = match[1];
      }
      else {
        token.prefix = match[2];
        token.value = match[3];
      }
    }
    // Try to find a keyword.
    else if (match = this._keyword.execAtIndex(this._input, this._pos)) {
      token.type = match[0];
    }
    // Try to find a prefix.
    else if (this._prevTokenType === '@prefix' && (match = this._prefix.execAtIndex(this._input, this._pos))) {
      token.type = 'prefix';
      token.value = match[1] || '';
    }
    // Try to find a qname.
    else if (match = this._qname.execAtIndex(this._input, this._pos)) {
      token.type = 'qname';
      token.prefix = match[1] || '';
      token.value = match[2];
    }
    // Try to find an abbreviated predicate.
    else if (match = this._shortPredicates.execAtIndex(this._input, this._pos)) {
      token.type = 'explicituri';
      token.value = fullPredicates[match[0]];
    }
    // What if nothing of the above was found?
    else {
      // We could be in streaming mode, and then we just wait for more input to arrive.
      // Otherwise, a syntax error has occurred in the input.
      if (this._inputComplete) {
        this._nonwhitespace.lastIndex = this._pos;
        match = this._nonwhitespace.exec(this._input);
        delete this._input;
        callback('Syntax error: unexpected "' + match[0] + '" on line ' + this._line + '.');
      }
      return false;
    }
    
    // Save the token type for the next iteration.
    this._prevTokenType = token.type;
    
    // Advance to next part to tokenize.
    this._pos += match[0].length;
    
    // Emit the parsed token.
    callback(null, token);
    return true;
  },
  
  // ### `unescapeString` replaces escape codes in N3 strings by the corresponding characters.
  _unescapeString: function (string) {
    return string.replace(escapeSequence, function (sequence, code, hexCode) {
      return hexCode ? String.fromCharCode(parseInt(hexCode, 16)) : escapeReplacements[code];
    });
  },
  
  // ## Public methods
  
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
        while (self._next(callback)) ;
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
        
        // Parse as far as we can.
        while (self._next(callback)) ;
      });
      // If we're at the end of the stream…
      input.on('end', function () {
        // …signal completeness…
        self._inputComplete = true;
        // …and parse until the end.
        while (self._next(callback)) ;
      });
    }
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
