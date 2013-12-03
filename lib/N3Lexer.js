// **N3Lexer** tokenizes N3 documents.
// ## Regular expressions
var patterns = {
  _explicituri: /^<((?:[^\x00-\x20<>\\"\{\}\|\^\`]|\\[uU])*)>/,
  _string: /^"[^"\\]*(?:\\.[^"\\]*)*"(?=[^"\\])|^'[^'\\]*(?:\\.[^'\\]*)*'(?=[^'\\])/,
  _tripleQuotedString: /^""("[^"\\]*(?:(?:\\.|"(?!""))[^"\\]*)*")""|^''('[^'\\]*(?:(?:\\.|'(?!''))[^'\\]*)*')''/,
  _langcode: /^@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9\-])/i,
  _prefix: /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:[\.\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:(?=\s)/,
  _qname:  /^((?:[A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:[\.\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:((?:(?:[0-:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])(?:(?:[\.\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])*(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~]))?)?)(?=[\s\.;,)#])/,
  _number: /^[\-+]?(?:\d+\.?\d*([eE](?:[\-\+])?\d+)|\d+\.\d+|\.\d+|\d+)(?=\s*[\s\.;,)#])/,
  _boolean: /^(?:true|false)(?=[\s#,;.])/,
  _dot: /^\.(?!\d)/, // If a digit follows a dot, it is a number, not punctuation.
  _punctuation: /^[;,\[\]\(\)]/,
  _fastString: /^"[^"\\]+"(?=[^"\\])/,
  _keyword: /^@[a-z]+(?=\s)/,
  _sparqlKeyword: /^(?:PREFIX|BASE)(?=\s)/i,
  _type: /^\^\^(?:<([^>]*)>|([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]*)?:([A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd][\-0-9A-Z_a-z\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]*)(?=[\s\.;,)#]))/,
  _shortPredicates: /^a(?=\s+|<)/,
  _newline: /^[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/,
  _whitespace: /^[ \t]+/,
  _nonwhitespace: /^\S*/,
  _endOfFile: /^(?:#[^\n\r]*)?$/,
};

// Regular expression and replacement string to escape N3 strings.
// Note how we catch invalid unicode sequences separately (they will trigger an error).
var escapeSequence = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\[uU]|\\(.)/g;
var escapeReplacements = { '\\': '\\', "'": "'", '"': '"',
                           'n': '\n', 'r': '\r', 't': '\t', 'f': '\f', 'b': '\b',
                           '_': '_', '~': '~', '.': '.', '-': '-', '!': '!', '$': '$', '&': '&',
                           '(': '(', ')': ')', '*': '*', '+': '+', ',': ',', ';': ';', '=': '=',
                           '/': '/', '?': '?', '#': '#', '@': '@', '%': '%' };
var illegalUrlChars = /[\x00-\x20<>\\"\{\}\|\^\`]/;

// Different punctuation types.
var punctuationTypes = { '.': 'dot', ';': 'semicolon', ',': 'comma',
                         '[': 'bracketopen', ']': 'bracketclose',
                         '(': 'liststart', ')': 'listend' };

// ## Constructor
function N3Lexer() {
  if (!(this instanceof N3Lexer))
    return new N3Lexer();

  // Local copies of the patterns perform slightly better.
  for (var name in patterns)
    this[name] = patterns[name];
}

N3Lexer.prototype = {
  // ## Private methods

  // ### `_next` fires the callback with the next token.
  // Returns a boolean indicating whether a token has been emitted.
  _next: function (callback) {
    // Only emit tokens if there's still input left.
    var input = this._input;
    if (input === undefined)
      return false;

    // Count and skip whitespace lines.
    var whiteSpaceMatch;
    while (whiteSpaceMatch = this._newline.exec(input))
      input = input.substr(whiteSpaceMatch[0].length, input.length), this._line++;
    // Skip whitespace on current line.
    if (whiteSpaceMatch = this._whitespace.exec(input))
      input = input.substr(whiteSpaceMatch[0].length, input.length);

    // Create token skeleton.
    // We initialize all possible properties as strings, so the engine uses one runtime type for all tokens.
    var token = { line: this._line, type: '', value: '', prefix: '' };

    // Emit the EOF token if we're at the end and reading is complete.
    if (this._endOfFile.test(input)) {
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

    // Look for specific token types based on the first character
    var firstChar = input[0], match = null, unescaped, inconclusive = false;
    switch (firstChar) {
    case '<':
      // Try to find a full URI.
      if (match = this._explicituri.exec(input)) {
        unescaped = this._unescape(match[1]);
        if (unescaped === null || illegalUrlChars.test(unescaped))
          return reportSyntaxError(this);
        token.type = 'explicituri';
        token.value = unescaped;
      }
      break;

    case '"':
    case "'":
      // Try to find a string literal the fast way.
      // This only includes non-empty simple quoted literals without escapes.
      // If streaming, make sure the input is long enough so we don't miss language codes or string types.
      if (match = this._fastString.exec(input)) {
        token.type = 'literal';
        token.value = match[0];
      }
      // Try to find any other string literal wrapped in a pair of quotes.
      else if (match = this._string.exec(input)) {
        unescaped = this._unescape(match[0]);
        if (unescaped === null)
          return reportSyntaxError(this);
        token.type = 'literal';
        token.value = unescaped.replace(/^'|'$/g, '"');
      }
      // Try to find a string literal wrapped in a pair of triple quotes.
      else if (match = this._tripleQuotedString.exec(input)) {
        unescaped = match[1] || match[2];
        // Count the newlines and advance line counter.
        this._line += unescaped.split(/\r\n|\r|\n/).length - 1;
        unescaped = this._unescape(unescaped);
        if (unescaped === null)
          return reportSyntaxError(this);
        token.type = 'literal';
        token.value = unescaped.replace(/^'|'$/g, '"');
      }
      break;

    case '@':
      // Try to find a language code.
      if (this._prevTokenType === 'literal' && (match = this._langcode.exec(input))) {
        token.type = 'langcode';
        token.value = match[1];
      }
      // Try to find a keyword.
      else if (match = this._keyword.exec(input)) {
        token.type = match[0];
      }
      break;

    case '^':
      // Try to find a type.
      if (this._prevTokenType === 'literal' && (match = this._type.exec(input))) {
        token.type = 'type';
        if (!match[2]) {
          token.value = match[1];
        }
        else {
          token.prefix = match[2];
          token.value = match[3];
        }
      }
      break;

    case '.':
      // Try to find any kind of punctuation.
      if (match = this._dot.test(input)) {
        token.type = 'dot';
        match = ['.'];
        break;
      }

    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
    case '+':
    case '-':
      // Try to find a number.
      if (match = this._number.exec(input)) {
        token.type = 'literal';
        token.value = '"' + match[0] + '"^^<http://www.w3.org/2001/XMLSchema#' +
                      (match[1] ? 'double>' : (/^[+\-]?\d+$/.test(match[0]) ? 'integer>' : 'decimal>'));
      }
      break;

    case 'B':
    case 'b':
    case 'p':
    case 'P':
      // Try to find a SPARQL-style keyword.
      if (match = this._sparqlKeyword.exec(input))
        token.type = match[0].toUpperCase();
      else
        inconclusive = true;
      break;

    case 'f':
    case 't':
      // Try to match a boolean.
      if (match = this._boolean.exec(input)) {
        token.type = 'literal';
        token.value = '"' + match[0] + '"^^<http://www.w3.org/2001/XMLSchema#boolean>';
      }
      else
        inconclusive = true;
      break;

    case 'a':
      // Try to find an abbreviated predicate.
      if (match = this._shortPredicates.exec(input)) {
        token.type = 'abbreviation';
        token.value = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
      }
      else
        inconclusive = true;
      break;

    case ',':
    case ';':
    case '[':
    case ']':
    case '(':
    case ')':
      match = this._punctuation.exec(firstChar);
      token.type = punctuationTypes[firstChar];
      break;

    default:
      inconclusive = true;
    }

    // Some first characters do not allow an immediate decision, so inspect more
    if (inconclusive) {
      // Try to find a prefix.
      if ((this._prevTokenType === '@prefix' || this._prevTokenType === 'PREFIX') &&
          (match = this._prefix.exec(input))) {
        token.type = 'prefix';
        token.value = match[1] || '';
      }
      // Try to find a qname.
      else if (match = this._qname.exec(input)) {
        unescaped = this._unescape(match[2]);
        if (unescaped === null)
          return reportSyntaxError(this);
        token.type = 'qname';
        token.prefix = match[1] || '';
        token.value = unescaped;
      }
    }

    // What if nothing of the above was found?
    if (match === null) {
      // We could be in streaming mode, and then we just wait for more input to arrive.
      // Otherwise, a syntax error has occurred in the input.
      // One exception: error on an unaccounted linebreak (= not inside a triple-quoted literal).
      if (this._inputComplete || (!/^'''|^"""/.test(input) && /\n|\r/.test(input)))
        return reportSyntaxError(this);
      this._input = input;
      return false;
    }

    // Save the token type for the next iteration.
    this._prevTokenType = token.type;

    // Advance to next part to tokenize.
    this._input = input.substr(match[0].length, input.length);

    // Emit the parsed token.
    callback(null, token);
    return true;

    function reportSyntaxError(self) {
      match = self._nonwhitespace.exec(input);
      delete self._input;
      callback('Syntax error: unexpected "' + match[0] + '" on line ' + self._line + '.');
      return false;
    }
  },

  // ### `unescape` replaces N3 escape codes by their corresponding characters.
  _unescape: function (item) {
    try {
      return item.replace(escapeSequence, function (sequence, unicode4, unicode8, escapedChar) {
        var charCode;
        if (unicode4) {
          charCode = parseInt(unicode4, 16);
          if (isNaN(charCode))
            throw "invalid character code";
          return String.fromCharCode(charCode);
        }
        else if (unicode8) {
          charCode = parseInt(unicode8, 16);
          if (isNaN(charCode))
            throw "invalid character code";
          if (charCode < 0xFFFF)
            return String.fromCharCode(charCode);
          return String.fromCharCode(Math.floor((charCode - 0x10000) / 0x400) + 0xD800) +
                 String.fromCharCode((charCode - 0x10000) % 0x400 + 0xDC00);
        }
        else {
          var replacement = escapeReplacements[escapedChar];
          if (!replacement)
            throw "invalid escape sequence";
          return replacement;
        }
      });
    }
    catch (error) {
      return null;
    }
  },

  // ## Public methods

  // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
  // The input can be a string or a stream.
  tokenize: function (input, callback) {
    var self = this;
    this._line = 1;

    // If the input is a string, continuously emit tokens through callback until the end.
    if (typeof input === 'string') {
      this._input = input;
      this._inputComplete = true;
      setImmediate(function () {
        while (self._next(callback)) ;
      });
    }
    // Otherwise, the input will be streamed.
    else {
      this._input = '';
      this._inputComplete = false;

      // If no input was given, it will be streamed through `addChunk` and ended with `end`
      if (!input || typeof input === 'function') {
        this.addChunk = addChunk;
        this.end = end;
        if (!callback)
          callback = input;
      }
      // Otherwise, the input itself must be a stream
      else {
        if (typeof input.setEncoding === 'function')
          input.setEncoding('utf8');
        input.on('data', addChunk);
        input.on('end', end);
      }
    }

    // Adds the data chunk to the buffer and parses as far as possible
    function addChunk(data) {
      self._input += data;
      while (self._next(callback)) ;
    }

    // Parses until the end
    function end() {
      delete self.addChunk;
      self._inputComplete = true;
      while (self._next(callback)) ;
    }
  },
};

// ## Exports

// Export the `N3Lexer` class as a whole.
module.exports = N3Lexer;
