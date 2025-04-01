// **N3Lexer** tokenizes N3 documents.
import { Buffer } from 'buffer';
import namespaces from './IRIs';

const { xsd } = namespaces;

// Regular expression and replacement string to escape N3 strings
const escapeSequence = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\([^])/g;
const escapeReplacements = {
  '\\': '\\', "'": "'", '"': '"',
  'n': '\n', 'r': '\r', 't': '\t', 'f': '\f', 'b': '\b',
  '_': '_', '~': '~', '.': '.', '-': '-', '!': '!', '$': '$', '&': '&',
  '(': '(', ')': ')', '*': '*', '+': '+', ',': ',', ';': ';', '=': '=',
  '/': '/', '?': '?', '#': '#', '@': '@', '%': '%',
};
const illegalIriChars = /[\x00-\x20<>\\"\{\}\|\^\`]/;

const lineModeRegExps = {
  _iri: true,
  _unescapedIri: true,
  _simpleQuotedString: true,
  _langcode: true,
  _blank: true,
  _newline: true,
  _comment: true,
  _whitespace: true,
  _endOfFile: true,
};
const invalidRegExp = /$0^/;

// ## Constructor
export default class N3Lexer {
  constructor(options) {
    // ## Regular expressions
    // It's slightly faster to have these as properties than as in-scope variables
    this._iri = /^<((?:[^ <>{}\\]|\\[uU])+)>[ \t]*/; // IRI with escape sequences; needs sanity check after unescaping
    this._unescapedIri = /^<([^\x00-\x20<>\\"\{\}\|\^\`]*)>[ \t]*/; // IRI without escape sequences; no unescaping
    this._simpleQuotedString = /^"([^"\\\r\n]*)"(?=[^"])/; // string without escape sequences
    this._simpleApostropheString = /^'([^'\\\r\n]*)'(?=[^'])/;
    this._langcode = /^@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9\-])/i;
    this._prefix = /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:(?=[#\s<])/;
    this._prefixed = /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:((?:(?:[0-:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])(?:(?:[\.\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])*(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~]))?)?)(?:[ \t]+|(?=\.?[,;!\^\s#()\[\]\{\}"'<>]))/;
    this._variable = /^\?(?:(?:[A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?=[.,;!\^\s#()\[\]\{\}"'<>])/;
    this._blank = /^_:((?:[0-9A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?:[ \t]+|(?=\.?[,;:\s#()\[\]\{\}"'<>]))/;
    this._number = /^[\-+]?(?:(\d+\.\d*|\.?\d+)[eE][\-+]?|\d*(\.)?)\d+(?=\.?[,;:\s#()\[\]\{\}"'<>])/;
    this._boolean = /^(?:true|false)(?=[.,;\s#()\[\]\{\}"'<>])/;
    this._keyword = /^@[a-z]+(?=[\s#<:])/i;
    this._sparqlKeyword = /^(?:PREFIX|BASE|GRAPH)(?=[\s#<])/i;
    this._shortPredicates = /^a(?=[\s#()\[\]\{\}"'<>])/;
    this._newline = /^[ \t]*(?:#[^\n\r]*)?(?:\r\n|\n|\r)[ \t]*/;
    this._comment = /#([^\n\r]*)/;
    this._whitespace = /^[ \t]+/;
    this._endOfFile = /^(?:#[^\n\r]*)?$/;
    options = options || {};

    // Whether the log:isImpliedBy predicate is supported
    this._isImpliedBy = options.isImpliedBy;

    // In line mode (N-Triples or N-Quads), only simple features may be parsed
    if (this._lineMode = !!options.lineMode) {
      this._n3Mode = false;
      // Don't tokenize special literals
      for (const key in this) {
        if (!(key in lineModeRegExps) && this[key] instanceof RegExp)
          this[key] = invalidRegExp;
      }
    }
    // When not in line mode, enable N3 functionality by default
    else {
      this._n3Mode = options.n3 !== false;
    }
    // Don't output comment tokens by default
    this.comments = !!options.comments;
    // Cache the last tested closing position of long literals
    this._literalClosingPos = 0;
  }

  // ## Private methods

  // ### `_tokenizeToEnd` tokenizes as for as possible, emitting tokens through the callback
  _tokenizeToEnd(callback, inputFinished) {
    // Continue parsing as far as possible; the loop will return eventually
    let input = this._input;
    let currentLineLength = input.length;
    while (true) {
      // Count and skip whitespace lines
      let whiteSpaceMatch, comment;
      while (whiteSpaceMatch = this._newline.exec(input)) {
        // Try to find a comment
        if (this.comments && (comment = this._comment.exec(whiteSpaceMatch[0])))
          emitToken('comment', comment[1], '', this._line, whiteSpaceMatch[0].length);
        // Advance the input
        input = input.substr(whiteSpaceMatch[0].length, input.length);
        currentLineLength = input.length;
        this._line++;
      }
      // Skip whitespace on current line
      if (!whiteSpaceMatch && (whiteSpaceMatch = this._whitespace.exec(input)))
        input = input.substr(whiteSpaceMatch[0].length, input.length);

      // Stop for now if we're at the end
      if (this._endOfFile.test(input)) {
        // If the input is finished, emit EOF
        if (inputFinished) {
          // Try to find a final comment
          if (this.comments && (comment = this._comment.exec(input)))
            emitToken('comment', comment[1], '', this._line, input.length);
          input = null;
          emitToken('eof', '', '', this._line, 0);
        }
        return this._input = input;
      }

      // Look for specific token types based on the first character
      const line = this._line, firstChar = input[0];
      let type = '', value = '', prefix = '',
          match = null, matchLength = 0, inconclusive = false;
      switch (firstChar) {
      case '^':
        // We need at least 3 tokens lookahead to distinguish ^^<IRI> and ^^pre:fixed
        if (input.length < 3)
          break;
        // Try to match a type
        else if (input[1] === '^') {
          this._previousMarker = '^^';
          // Move to type IRI or prefixed name
          input = input.substr(2);
          if (input[0] !== '<') {
            inconclusive = true;
            break;
          }
        }
        // If no type, it must be a path expression
        else {
          if (this._n3Mode) {
            matchLength = 1;
            type = '^';
          }
          break;
        }
        // Fall through in case the type is an IRI
      case '<':
        // Try to find a full IRI without escape sequences
        if (match = this._unescapedIri.exec(input))
          type = 'IRI', value = match[1];
        // Try to find a full IRI with escape sequences
        else if (match = this._iri.exec(input)) {
          value = this._unescape(match[1]);
          if (value === null || illegalIriChars.test(value))
            return reportSyntaxError(this);
          type = 'IRI';
        }
        // Try to find a nested triple
        else if (input.length > 1 && input[1] === '<')
          type = '<<', matchLength = 2;
        // Try to find a backwards implication arrow
        else if (this._n3Mode && input.length > 1 && input[1] === '=') {
          matchLength = 2;
          if (this._isImpliedBy) type = 'abbreviation', value = '<';
          else type = 'inverse', value = '>';
        }
        break;

      case '>':
        if (input.length > 1 && input[1] === '>')
          type = '>>', matchLength = 2;
        break;

      case '_':
        // Try to find a blank node. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a blank node.
        // Therefore, try inserting a space if we're at the end of the input.
        if ((match = this._blank.exec(input)) ||
            inputFinished && (match = this._blank.exec(`${input} `)))
          type = 'blank', prefix = '_', value = match[1];
        break;

      case '"':
        // Try to find a literal without escape sequences
        if (match = this._simpleQuotedString.exec(input))
          value = match[1];
        // Try to find a literal wrapped in three pairs of quotes
        else {
          ({ value, matchLength } = this._parseLiteral(input));
          if (value === null)
            return reportSyntaxError(this);
        }
        if (match !== null || matchLength !== 0) {
          type = 'literal';
          this._literalClosingPos = 0;
        }
        break;

      case "'":
        if (!this._lineMode) {
          // Try to find a literal without escape sequences
          if (match = this._simpleApostropheString.exec(input))
            value = match[1];
          // Try to find a literal wrapped in three pairs of quotes
          else {
            ({ value, matchLength } = this._parseLiteral(input));
            if (value === null)
              return reportSyntaxError(this);
          }
          if (match !== null || matchLength !== 0) {
            type = 'literal';
            this._literalClosingPos = 0;
          }
        }
        break;

      case '?':
        // Try to find a variable
        if (this._n3Mode && (match = this._variable.exec(input)))
          type = 'var', value = match[0];
        break;

      case '@':
        // Try to find a language code
        if (this._previousMarker === 'literal' && (match = this._langcode.exec(input)))
          type = 'langcode', value = match[1];
        // Try to find a keyword
        else if (match = this._keyword.exec(input))
          type = match[0];
        break;

      case '.':
        // Try to find a dot as punctuation
        if (input.length === 1 ? inputFinished : (input[1] < '0' || input[1] > '9')) {
          type = '.';
          matchLength = 1;
          break;
        }
        // Fall through to numerical case (could be a decimal dot)

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
        // Try to find a number. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a number.
        // Therefore, try inserting a space if we're at the end of the input.
        if (match = this._number.exec(input) ||
            inputFinished && (match = this._number.exec(`${input} `))) {
          type = 'literal', value = match[0];
          prefix = (typeof match[1] === 'string' ? xsd.double :
                    (typeof match[2] === 'string' ? xsd.decimal : xsd.integer));
        }
        break;

      case 'B':
      case 'b':
      case 'p':
      case 'P':
      case 'G':
      case 'g':
        // Try to find a SPARQL-style keyword
        if (match = this._sparqlKeyword.exec(input))
          type = match[0].toUpperCase();
        else
          inconclusive = true;
        break;

      case 'f':
      case 't':
        // Try to match a boolean
        if (match = this._boolean.exec(input))
          type = 'literal', value = match[0], prefix = xsd.boolean;
        else
          inconclusive = true;
        break;

      case 'a':
        // Try to find an abbreviated predicate
        if (match = this._shortPredicates.exec(input))
          type = 'abbreviation', value = 'a';
        else
          inconclusive = true;
        break;

      case '=':
        // Try to find an implication arrow or equals sign
        if (this._n3Mode && input.length > 1) {
          type = 'abbreviation';
          if (input[1] !== '>')
            matchLength = 1, value = '=';
          else
            matchLength = 2, value = '>';
        }
        break;

      case '!':
        if (!this._n3Mode)
          break;
      case ',':
      case ';':
      case '[':
      case ']':
      case '(':
      case ')':
      case '}':
        if (!this._lineMode) {
          matchLength = 1;
          type = firstChar;
        }
        break;
      case '{':
        // We need at least 2 tokens lookahead to distinguish "{|" and "{ "
        if (!this._lineMode && input.length >= 2) {
          // Try to find a quoted triple annotation start
          if (input[1] === '|')
            type = '{|', matchLength = 2;
          else
            type = firstChar, matchLength = 1;
        }
        break;
      case '|':
        // We need 2 tokens lookahead to parse "|}"
        // Try to find a quoted triple annotation end
        if (input.length >= 2 && input[1] === '}')
          type = '|}', matchLength = 2;
        break;

      default:
        inconclusive = true;
      }

      // Some first characters do not allow an immediate decision, so inspect more
      if (inconclusive) {
        // Try to find a prefix
        if ((this._previousMarker === '@prefix' || this._previousMarker === 'PREFIX') &&
            (match = this._prefix.exec(input)))
          type = 'prefix', value = match[1] || '';
        // Try to find a prefixed name. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a prefixed name.
        // Therefore, try inserting a space if we're at the end of the input.
        else if ((match = this._prefixed.exec(input)) ||
                 inputFinished && (match = this._prefixed.exec(`${input} `)))
          type = 'prefixed', prefix = match[1] || '', value = this._unescape(match[2]);
      }

      // A type token is special: it can only be emitted after an IRI or prefixed name is read
      if (this._previousMarker === '^^') {
        switch (type) {
        case 'prefixed': type = 'type';    break;
        case 'IRI':      type = 'typeIRI'; break;
        default:         type = '';
        }
      }

      // What if nothing of the above was found?
      if (!type) {
        // We could be in streaming mode, and then we just wait for more input to arrive.
        // Otherwise, a syntax error has occurred in the input.
        // One exception: error on an unaccounted linebreak (= not inside a triple-quoted literal).
        if (inputFinished || (!/^'''|^"""/.test(input) && /\n|\r/.test(input)))
          return reportSyntaxError(this);
        else
          return this._input = input;
      }

      // Emit the parsed token
      const length = matchLength || match[0].length;
      const token = emitToken(type, value, prefix, line, length);
      this.previousToken = token;
      this._previousMarker = type;

      // Advance to next part to tokenize
      input = input.substr(length, input.length);
    }

    // Emits the token through the callback
    function emitToken(type, value, prefix, line, length) {
      const start = input ? currentLineLength - input.length : currentLineLength;
      const end = start + length;
      const token = { type, value, prefix, line, start, end };
      callback(null, token);
      return token;
    }
    // Signals the syntax error through the callback
    function reportSyntaxError(self) { callback(self._syntaxError(/^\S*/.exec(input)[0])); }
  }

  // ### `_unescape` replaces N3 escape codes by their corresponding characters
  _unescape(item) {
    let invalid = false;
    const replaced = item.replace(escapeSequence, (sequence, unicode4, unicode8, escapedChar) => {
      // 4-digit unicode character
      if (typeof unicode4 === 'string')
        return String.fromCharCode(Number.parseInt(unicode4, 16));
      // 8-digit unicode character
      if (typeof unicode8 === 'string') {
        let charCode = Number.parseInt(unicode8, 16);
        return charCode <= 0xFFFF ? String.fromCharCode(Number.parseInt(unicode8, 16)) :
          String.fromCharCode(0xD800 + ((charCode -= 0x10000) >> 10), 0xDC00 + (charCode & 0x3FF));
      }
      // fixed escape sequence
      if (escapedChar in escapeReplacements)
        return escapeReplacements[escapedChar];
      // invalid escape sequence
      invalid = true;
      return '';
    });
    return invalid ? null : replaced;
  }

  // ### `_parseLiteral` parses a literal into an unescaped value
  _parseLiteral(input) {
    // Ensure we have enough lookahead to identify triple-quoted strings
    if (input.length >= 3) {
      // Identify the opening quote(s)
      const opening = input.match(/^(?:"""|"|'''|'|)/)[0];
      const openingLength = opening.length;

      // Find the next candidate closing quotes
      let closingPos = Math.max(this._literalClosingPos, openingLength);
      while ((closingPos = input.indexOf(opening, closingPos)) > 0) {
        // Count backslashes right before the closing quotes
        let backslashCount = 0;
        while (input[closingPos - backslashCount - 1] === '\\')
          backslashCount++;

        // An even number of backslashes (in particular 0)
        // means these are actual, non-escaped closing quotes
        if (backslashCount % 2 === 0) {
          // Extract and unescape the value
          const raw = input.substring(openingLength, closingPos);
          const lines = raw.split(/\r\n|\r|\n/).length - 1;
          const matchLength = closingPos + openingLength;
          // Only triple-quoted strings can be multi-line
          if (openingLength === 1 && lines !== 0 ||
              openingLength === 3 && this._lineMode)
            break;
          this._line += lines;
          return { value: this._unescape(raw), matchLength };
        }
        closingPos++;
      }
      this._literalClosingPos = input.length - openingLength + 1;
    }
    return { value: '', matchLength: 0 };
  }

  // ### `_syntaxError` creates a syntax error for the given issue
  _syntaxError(issue) {
    this._input = null;
    const err = new Error(`Unexpected "${issue}" on line ${this._line}.`);
    err.context = {
      token: undefined,
      line: this._line,
      previousToken: this.previousToken,
    };
    return err;
  }

  // ### Strips off any starting UTF BOM mark.
  _readStartingBom(input) {
    return input.startsWith('\ufeff') ? input.substr(1) : input;
  }

  // ## Public methods

  // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
  // The input can be a string or a stream.
  tokenize(input, callback) {
    this._line = 1;

    // If the input is a string, continuously emit tokens through the callback until the end
    if (typeof input === 'string') {
      this._input = this._readStartingBom(input);
      // If a callback was passed, asynchronously call it
      if (typeof callback === 'function')
        queueMicrotask(() => this._tokenizeToEnd(callback, true));
      // If no callback was passed, tokenize synchronously and return
      else {
        const tokens = [];
        let error;
        this._tokenizeToEnd((e, t) => e ? (error = e) : tokens.push(t), true);
        if (error) throw error;
        return tokens;
      }
    }
    // Otherwise, the input must be a stream
    else {
      this._pendingBuffer = null;
      if (typeof input.setEncoding === 'function')
        input.setEncoding('utf8');
      // Adds the data chunk to the buffer and parses as far as possible
      input.on('data', data => {
        if (this._input !== null && data.length !== 0) {
          // Prepend any previous pending writes
          if (this._pendingBuffer) {
            data = Buffer.concat([this._pendingBuffer, data]);
            this._pendingBuffer = null;
          }
          // Hold if the buffer ends in an incomplete unicode sequence
          if (data[data.length - 1] & 0x80) {
            this._pendingBuffer = data;
          }
          // Otherwise, tokenize as far as possible
          else {
            // Only read a BOM at the start
            if (typeof this._input === 'undefined')
              this._input = this._readStartingBom(typeof data === 'string' ? data : data.toString());
            else
              this._input += data;
            this._tokenizeToEnd(callback, false);
          }
        }
      });
      // Parses until the end
      input.on('end', () => {
        if (typeof this._input === 'string')
          this._tokenizeToEnd(callback, true);
      });
      input.on('error', callback);
    }
  }
}
