// **N3Lexer** tokenizes N3 documents.
// ## Regular expressions
var patterns = {
  // These token expressions were taken from the [context-free grammar in N3](http://www.w3.org/2000/10/swap/grammar/n3.n3).
  _explicituri: /^<([^>]*)>/,
  _string: /^"[^"\\]*(?:\\.[^"\\]*)*"(?=[^"\\])/,
  _tripleQuotedString: /^""("[^"\\]*(?:(?:\\.|"(?!""))[^"\\]*)*")""/,
  _langcode: /^@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9\-])/i,
  _prefix: /^([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]*)?:(?=\s)/,
  _qname:  /^([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]*)?:((?:[A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]*)?)(?=[\s\.;,])/,
  _number: /^(?:(-)|\+)?(\d+\.\d*|\.\d+|\d+)([eE](?:[\-\+])?\d+)?(?=\s*[,\.])/,
  _boolean: /^(?:true|false)(?=\s+)/,
  // The lexer needs these other token expressions as well.
  _punctuation: /^\.(?!\d)|^;|^,|^\[|^\]|^\(|^\)/, // If a digit follows a dot, it is a number, not punctuation.
  _fastString: /^"[^"\\]+"(?=[^"\\])/,
  _keyword: /^@[a-z]+(?=\s)/,
  _type: /^\^\^(?:<([^>]*)>|([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]*)?:([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]*)(?=[\s\.:,]))/,
  _shortPredicates: /^a(?=\s+|<)/,
  // Whitespace, newlines, and comments are actually not specified yet in the current N3 grammar.
  _newline: /^[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/,
  _whitespace: /^[ \t]+|^#[^\n\r]*/,
  _nonwhitespace: /^\S*/,
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
  // Local copies of the patterns perform slightly better.
  for (var name in patterns)
    n3Lexer[name] = patterns[name];

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
    while (match = this._newline.exec(this._input)) {
      this._line++;
      this._input = this._input.substr(match[0].length);
    }

    // Skip whitespace.
    if (match = this._whitespace.exec(this._input)) {
      this._input = this._input.substr(match[0].length);
    }

    // Create token skeleton.
    // We initialize all possible properties as strings, so the engine uses one runtime type for all tokens.
    var token = { line: this._line,
                  type: '',
                  value: '',
                  prefix: '',
                };

    // Emit the EOF token if we're at the end and reading is complete.
    if (!this._input.length) {
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
    if (match = this._explicituri.exec(this._input)) {
      token.type = 'explicituri';
      token.value = this._unescape(match[1]);
    }
    // Try to find a dot.
    else if (match = this._punctuation.exec(this._input)) {
      token.type = punctuationTypes[match[0]];
    }
    // Try to find a language code.
    else if (this._prevTokenType === 'literal' && (match = this._langcode.exec(this._input))) {
      token.type = 'langcode';
      token.value = match[1];
    }
    // Try to find a string literal the fast way.
    // This only includes non-empty simple quoted literals without escapes.
    // If streaming, make sure the input is long enough so we don't miss language codes or string types.
    else if (match = this._fastString.exec(this._input)) {
      token.type = 'literal';
      token.value = match[0];
    }
    // Try to find any other string literal wrapped in a pair of quotes.
    else if (match = this._string.exec(this._input)) {
      token.type = 'literal';
      token.value = this._unescape(match[0]);
    }
    // Try to find a string literal wrapped in a pair of triple quotes.
    else if (match = this._tripleQuotedString.exec(this._input)) {
      token.type = 'literal';
      // Count the newlines and advance line counter.
      this._line += match[1].split(/\r\n|\r|\n/).length - 1;
      token.value = this._unescape(match[1]);
    }
    // Try to find a number.
    else if (match = this._number.exec(this._input)) {
      token.type = 'literal';
      var value = (match[1] === '-' ? '-' + match[2] : match[2]);
      if (match[3]) {
        token.value = '"' + value + match[3].replace('+', '').replace('E', 'e') +
                      '"^^<http://www.w3.org/2001/XMLSchema#double>';
      }
      else {
        if (value.match(/^-?\d+$/))
          token.value = '"' + parseInt(value, 10) + '"^^<http://www.w3.org/2001/XMLSchema#integer>';
        else
          token.value = '"' + value + '"^^<http://www.w3.org/2001/XMLSchema#decimal>';
      }
    }
    // Try to match a boolean.
    else if (match = this._boolean.exec(this._input)) {
      token.type = 'literal';
      token.value = '"' + match[0] + '"^^<http://www.w3.org/2001/XMLSchema#boolean>';
    }
    // Try to find a type.
    else if (this._prevTokenType === 'literal' && (match = this._type.exec(this._input))) {
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
    else if (match = this._keyword.exec(this._input)) {
      token.type = match[0];
    }
    // Try to find a prefix.
    else if (this._prevTokenType === '@prefix' && (match = this._prefix.exec(this._input))) {
      token.type = 'prefix';
      token.value = match[1] || '';
    }
    // Try to find a qname.
    else if (match = this._qname.exec(this._input)) {
      token.type = 'qname';
      token.prefix = match[1] || '';
      token.value = match[2];
    }
    // Try to find an abbreviated predicate.
    else if (match = this._shortPredicates.exec(this._input)) {
      token.type = 'abbreviation';
      token.value = fullPredicates[match[0]];
    }
    // What if nothing of the above was found?
    else {
      // We could be in streaming mode, and then we just wait for more input to arrive.
      // Otherwise, a syntax error has occurred in the input.
      if (this._inputComplete) {
        match = this._nonwhitespace.exec(this._input);
        delete this._input;
        callback('Syntax error: unexpected "' + match[0] + '" on line ' + this._line + '.');
      }
      return false;
    }

    // Save the token type for the next iteration.
    this._prevTokenType = token.type;

    // Advance to next part to tokenize.
    this._input = this._input.substr(match[0].length);

    // Emit the parsed token.
    callback(null, token);
    return true;
  },

  // ### `unescape` replaces N3 escape codes by their corresponding characters.
  _unescape: function (item) {
    return item.replace(escapeSequence, function (sequence, code, hexCode) {
      return hexCode ? String.fromCharCode(parseInt(hexCode, 16)) : escapeReplacements[code];
    });
  },

  // ## Public methods

  // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
  // The input can be a string or a stream.
  tokenize: function (input, callback) {
    var self = this;
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
        // …add the new data to the buffer
        self._input += data;
        // …and parse as far as we can.
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

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
