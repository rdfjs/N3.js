// **N3Lexer** tokenizes N3 documents.
import { Buffer } from 'buffer';
import namespaces from './IRIs';

const { xsd } = namespaces;
const SPACE = 0x20, TAB = 0x09, LF = 0x0A, CR = 0x0D, HASH = 0x23;

// Fixed escape sequences allowed in string literals (ECHAR)
const stringEscapeReplacements = {
  '\\': '\\', "'": "'", '"': '"',
  'n': '\n', 'r': '\r', 't': '\t', 'f': '\f', 'b': '\b',
};
// Fixed escape sequences allowed in local names of prefixed names (PN_LOCAL_ESC)
const localNameEscapeReplacements = {
  '_': '_', '~': '~', '.': '.', '-': '-', '!': '!', '$': '$', '&': '&',
  "'": "'", '(': '(', ')': ')', '*': '*', '+': '+', ',': ',', ';': ';',
  '=': '=', '/': '/', '?': '?', '#': '#', '@': '@', '%': '%',
};
const illegalIriChars = /[\x00-\x20<>\\"\{\}\|\^\`]/;
// Characters that cannot occur in a prefixed name, not even escaped
// (global, so that testAt searches the rest of the input from a position)
const nonPrefixedNameChar = /[\s<>"{}|^`]/g;

// A valid code point is a Unicode scalar value: at most U+10FFFF and not a surrogate
function isValidCodePoint(charCode) {
  return charCode <= 0x10FFFF && (charCode < 0xD800 || charCode > 0xDFFF);
}

const lineModeRegExps = {
  _iri: true,
  _unescapedIri: true,
  _simpleQuotedString: true,
  _langcode: true,
  _blank: true,
  _commentLine: true,
  _whitespace: true,
};
const invalidRegExp = /$0^/;
const nonWhitespace = /\S*/y;

// Matches a sticky regular expression at the given position of the input
function execAt(regExp, input, pos) {
  regExp.lastIndex = pos;
  return regExp.exec(input);
}
function testAt(regExp, input, pos) {
  regExp.lastIndex = pos;
  return regExp.test(input);
}
// Matches the rest of the input followed by a space, as at the end of the input,
// a token that can contain (but not end with) a dot needs a non-dot character after it
function execAtEnd(regExp, input, pos) {
  regExp.lastIndex = 0;
  return regExp.exec(`${input.slice(pos)} `);
}

// Whitespace or the start of a comment
function isSeparatorCode(code) {
  return code === SPACE || code === TAB || code === LF || code === CR || code === HASH;
}

// ## Constructor
export default class N3Lexer {
  constructor(options) {
    // ## Regular expressions
    // It's slightly faster to have these as properties than as in-scope variables.
    // They are sticky, so they only match at the `lastIndex` set by `execAt`.
    this._iri = /<((?:[^ <>{}\\]|\\[uU])+)>[ \t]*/y; // IRI with escape sequences; needs sanity check after unescaping
    this._unescapedIri = /<([^\x00-\x20<>\\"\{\}\|\^\`]*)>[ \t]*/y; // IRI without escape sequences; no unescaping
    this._simpleQuotedString = /"([^"\\\r\n]*)"(?=[^"])/y; // string without escape sequences
    this._simpleApostropheString = /'([^'\\\r\n]*)'(?=[^'])/y;
    this._langcode = /@([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9])/iy;
    this._prefix = /((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:(?=[#\s<])/y;
    this._prefixed = /((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:((?:(?:[0-9:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])(?:(?:[\.\-0-9:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])*(?:[\-0-9:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~]))?)?)(?:[ \t]+|(?=\.?[,;!\^\s#()\[\]\{\}"'<>]))/y;
    this._variable = /\?(?:(?:[A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:[\-0-9:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?=[.,;!\^\s#()\[\]\{\}"'<>])/y;
    this._blank = /_:((?:[0-9A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)(?:[ \t]+|(?=\.?[,;:!\^\s#()\[\]\{\}"'<>]))/y;
    this._number = /[\-+]?(?:(\d+\.\d*|\.?\d+)[eE][\-+]?\d+|(?=\.?\d)\d*(?:(\.)\d+)?)(?=\.?[,;:!\^\s#()\[\]\{\}"'<>])/y;
    this._boolean = /(?:true|false)(?=[.,;!\^\s#()\[\]\{\}"'<>])/y;
    this._atKeyword = /@[a-z]+(?=[\s#<:])/iy;
    this._keyword = /(?:PREFIX|BASE|VERSION|GRAPH)(?=[\s#<])/iy;
    this._n3Verb = /(?:has|is|of)(?=[\s#()\[\]\{\}"'<>?_+\-0-9])/y;
    this._n3Id = /id(?=[\s#<])/y;
    this._shortPredicates = /a(?=[\s#()\[\]\{\}"'<>])/y;
    this._commentLine = /[ \t]*#([^\n\r]*)(?:\r\n|\n|\r)([ \t]*)/y;
    this._whitespace = /[ \t]+/y;
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
    // Continue parsing as far as possible; the loop will return eventually.
    // Rather than slicing off every token, track the position of the remaining input;
    // the regular expressions are sticky, so they match at that position.
    const input = this._input;
    let pos = 0;
    let currentLineLength = this._linePosition + input.length;
    while (true) {
      // Consume one separator line at a time, including its following indentation.
      while (true) {
        let charCode = input.charCodeAt(pos), separatorLength = 0;
        if (charCode === SPACE || charCode === TAB) {
          const next = input.charCodeAt(pos + 1);
          separatorLength = next === SPACE || next === TAB ?
            execAt(this._whitespace, input, pos)[0].length : 1;
          charCode = input.charCodeAt(pos + separatorLength);
        }
        if (charCode === HASH) {
          const comment = execAt(this._commentLine, input, pos);
          if (comment) {
            const commentLength = comment[0].length;
            // Keep a trailing CR buffered in case the next chunk starts with LF.
            if (!inputFinished && pos + commentLength === input.length &&
                input.charCodeAt(input.length - 1) === CR)
              return this._suspend(input, pos, currentLineLength);
            if (this.comments)
              emitComment(comment[1], this._line, currentLineLength - (input.length - pos) + separatorLength);
            pos += commentLength;
            currentLineLength = input.length - pos + comment[2].length;
            this._line++;
          }
          else {
            // A comment without a line ending stays buffered until EOF.
            pos += separatorLength;
            if (!inputFinished)
              return this._suspend(input, pos, currentLineLength);
            if (this.comments)
              emitComment(input.slice(pos + 1), this._line, currentLineLength - (input.length - pos));
            pos = input.length;
            break;
          }
        }
        else if (charCode === LF || charCode === CR) {
          // A CR at the end of a chunk may still be followed by LF.
          if (!inputFinished && charCode === CR && pos + separatorLength + 1 === input.length)
            return this._suspend(input, pos, currentLineLength);
          separatorLength += charCode === CR && input.charCodeAt(pos + separatorLength + 1) === LF ? 2 : 1;
          // Indentation is consumed with the newline, but belongs to the next line's columns.
          let indentationLength = 0;
          const next = input.charCodeAt(pos + separatorLength);
          if (next === SPACE || next === TAB) {
            const following = input.charCodeAt(pos + separatorLength + 1);
            indentationLength = following === SPACE || following === TAB ?
              execAt(this._whitespace, input, pos + separatorLength)[0].length : 1;
          }
          pos += separatorLength + indentationLength;
          currentLineLength = input.length - pos + indentationLength;
          this._line++;
        }
        else {
          pos += separatorLength;
          break;
        }
      }
      if (pos >= input.length) {
        // A datatype marker needs a type
        if (inputFinished && this._previousMarker === '^^')
          return reportSyntaxError(this, input, pos);
        this._linePosition = currentLineLength;
        if (inputFinished) {
          emitToken('eof', '', '', this._line, currentLineLength, 0);
          return this._input = null;
        }
        return this._input = '';
      }

      // Look for specific token types based on the first character
      const line = this._line, firstChar = input[pos];
      let type = '', value = '', prefix = '',
          match = null, matchLength = 0, lexicalLength = 0,
          finalLineLength = 0, inconclusive = false;
      switch (firstChar) {
      case '^':
        // A datatype marker separated from its type cannot be followed by another marker
        if (this._previousMarker === '^^')
          return reportSyntaxError(this, input, pos);
        // We need at least 3 tokens lookahead to distinguish ^^<IRI> and ^^pre:fixed
        if (input.length - pos < 3)
          break;
        // Try to match a type
        else if (input[pos + 1] === '^') {
          this._previousMarker = '^^';
          // Move to type IRI or prefixed name
          pos += 2;
          if (input[pos] !== '<') {
            // Whitespace and comments may separate the marker from the type
            if (isSeparatorCode(input.charCodeAt(pos)))
              continue; // eslint-disable-line no-continue
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
        if (match = execAt(this._unescapedIri, input, pos)) {
          type = 'IRI', value = match[1];
          lexicalLength = match[1].length + 2;
        }
        // Try to find a full IRI with escape sequences
        else if (match = execAt(this._iri, input, pos)) {
          value = this._unescape(match[1], stringEscapeReplacements);
          if (value === null || illegalIriChars.test(value))
            return reportSyntaxError(this, input, pos);
          type = 'IRI';
          lexicalLength = match[1].length + 2;
        }
        // Try to find a triple term
        else if (input.length - pos > 2 && input[pos + 1] === '<' && input[pos + 2] === '(')
          type = '<<(', matchLength = 3;
        // Try to find a reified triple
        else if (!this._lineMode && input.length - pos > (inputFinished ? 1 : 2) && input[pos + 1] === '<')
          type = '<<', matchLength = 2;
        // Try to find a backwards implication arrow
        else if (this._n3Mode && input.length - pos > 1 && input[pos + 1] === '=') {
          matchLength = 2;
          if (this._isImpliedBy) type = 'abbreviation', value = '<';
          else type = 'inverse', value = '>';
        }
        // Try to find an inverted predicate marker
        else if (this._n3Mode && input.length - pos > 1 && input[pos + 1] === '-')
          type = 'inversePredicate', matchLength = 2;
        break;

      case '>':
        // Try to find a reified triple
        if (input.length - pos > 1 && input[pos + 1] === '>')
          type = '>>', matchLength = 2;
        break;

      case '_':
        // Try to find a blank node. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a blank node.
        // Therefore, try inserting a space if we're at the end of the input.
        if ((match = execAt(this._blank, input, pos)) ||
            inputFinished && (match = execAtEnd(this._blank, input, pos))) {
          type = 'blank', prefix = '_', value = match[1];
          lexicalLength = match[1].length + 2;
        }
        break;

      case '"':
        // Try to find a literal without escape sequences
        if (match = execAt(this._simpleQuotedString, input, pos))
          value = match[1];
        // Try to find a literal wrapped in three pairs of quotes
        else {
          ({ value, matchLength, finalLineLength } = this._parseLiteral(input, pos));
          if (value === null)
            return reportSyntaxError(this, input, pos);
        }
        if (match !== null || matchLength !== 0) {
          type = 'literal';
          this._literalClosingPos = 0;
        }
        break;

      case "'":
        if (!this._lineMode) {
          // Try to find a literal without escape sequences
          if (match = execAt(this._simpleApostropheString, input, pos))
            value = match[1];
          // Try to find a literal wrapped in three pairs of quotes
          else {
            ({ value, matchLength, finalLineLength } = this._parseLiteral(input, pos));
            if (value === null)
              return reportSyntaxError(this, input, pos);
          }
          if (match !== null || matchLength !== 0) {
            type = 'literal';
            this._literalClosingPos = 0;
          }
        }
        break;

      case '?':
        // Try to find a variable
        if (this._n3Mode && (match = execAt(this._variable, input, pos)))
          type = 'var', value = match[0];
        break;

      case '@':
        // Try to find a language code. A language code can contain dash-separated
        // subtags, so if the match is immediately followed by a single dash and the
        // input is not finished, another subtag may still arrive in a later chunk and
        // the match would be premature; wait for more input in that case.
        // A double dash starts a direction code, which cannot extend the language code.
        if (this._previousMarker === 'literal' && (match = execAt(this._langcode, input, pos)) && match[1] !== 'version') {
          const end = pos + match[0].length;
          if (!inputFinished && input[end] === '-' && input[end + 1] !== '-')
            match = null;
          else
            type = 'langcode', value = match[1];
        }
        // Try to find a keyword
        else if (match = execAt(this._atKeyword, input, pos))
          type = match[0];
        break;

      case '.':
        // Try to find a dot as punctuation
        if (input.length - pos === 1 ? inputFinished : (input[pos + 1] < '0' || input[pos + 1] > '9')) {
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
        if (input[pos + 1] === '-') {
          // Try to find a direction code
          if (this._previousMarker === 'langcode') {
            if (input.startsWith('--ltr', pos))
              type = 'dircode', value = 'ltr', matchLength = 5;
            else if (input.startsWith('--rtl', pos))
              type = 'dircode', value = 'rtl', matchLength = 5;
          }
          break;
        }

        // Try to find a number. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a number.
        // Therefore, try inserting a space if we're at the end of the input.
        if (match = execAt(this._number, input, pos) ||
            inputFinished && (match = execAtEnd(this._number, input, pos))) {
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
      case 'V':
      case 'v':
        // Try to find a SPARQL-style keyword
        if (match = execAt(this._keyword, input, pos))
          type = match[0].toUpperCase();
        else
          inconclusive = true;
        break;

      case 'f':
      case 't':
        // Try to match a boolean
        if (testAt(this._boolean, input, pos))
          type = 'literal', value = firstChar === 't' ? 'true' : 'false', prefix = xsd.boolean, matchLength = value.length;
        else
          inconclusive = true;
        break;

      case 'a':
        // Try to find an abbreviated predicate
        if (testAt(this._shortPredicates, input, pos))
          type = 'abbreviation', value = 'a', matchLength = 1;
        else
          inconclusive = true;
        break;

      case 'h':
      case 'o':
        // Try to find an N3 verb keyword
        if (this._n3Mode && (match = this._matchN3Verb(input, pos, inputFinished)))
          type = match[0];
        else
          inconclusive = true;
        break;

      case 'i':
        // Try to find an IRI property list identifier or N3 verb keyword
        if (this._n3Mode && testAt(this._n3Id, input, pos))
          type = 'id', matchLength = 2;
        else if (this._n3Mode && (match = this._matchN3Verb(input, pos, inputFinished)))
          type = match[0];
        else
          inconclusive = true;
        break;

      case '=':
        // Try to find an implication arrow or equals sign
        if (this._n3Mode && input.length - pos > 1) {
          type = 'abbreviation';
          if (input[pos + 1] !== '>')
            matchLength = 1, value = '=';
          else
            matchLength = 2, value = '>';
        }
        break;

      case '!':
        if (!this._n3Mode)
          break;
      case ')':
        if (!inputFinished && (input.length - pos === 1 || (input.length - pos === 2 && input[pos + 1] === '>'))) {
          // Don't consume yet, as it *could* become a triple term end.
          break;
        }
        // Try to find a triple term
        if (input.length - pos > 2 && input[pos + 1] === '>' && input[pos + 2] === '>') {
          type = ')>>', matchLength = 3;
          break;
        }
      case ',':
      case ';':
      case '[':
      case ']':
      case '(':
      case '}':
      case '~':
        if (!this._lineMode) {
          matchLength = 1;
          type = firstChar;
        }
        break;
      case '{':
        // We need at least 2 tokens lookahead to distinguish "{|" and "{ "
        if (!this._lineMode && input.length - pos >= 2) {
          // Try to find a quoted triple annotation start
          if (input[pos + 1] === '|')
            type = '{|', matchLength = 2;
          else
            type = firstChar, matchLength = 1;
        }
        break;
      case '|':
        // We need 2 tokens lookahead to parse "|}"
        // Try to find a quoted triple annotation end
        if (input.length - pos >= 2 && input[pos + 1] === '}')
          type = '|}', matchLength = 2;
        break;

      default:
        inconclusive = true;
      }

      // Some first characters do not allow an immediate decision, so inspect more
      if (inconclusive) {
        // Try to find a prefix
        if ((this._previousMarker === '@prefix' || this._previousMarker === 'PREFIX') &&
            (match = execAt(this._prefix, input, pos)))
          type = 'prefix', value = match[1] || '';
        // Try to find a prefixed name. Since it can contain (but not end with) a dot,
        // we always need a non-dot character before deciding it is a prefixed name.
        // Therefore, try inserting a space if we're at the end of the input.
        else if ((match = execAt(this._prefixed, input, pos)) ||
                 inputFinished && (match = execAtEnd(this._prefixed, input, pos))) {
          type = 'prefixed', prefix = match[1] || '';
          value = this._unescape(match[2], localNameEscapeReplacements);
          lexicalLength = prefix.length + match[2].length + 1;
        }
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
        if (inputFinished || (!input.startsWith("'''", pos) && !input.startsWith('"""', pos) &&
                              /\n|\r/.test(input.slice(pos))))
          return reportSyntaxError(this, input, pos);
        else
          return this._suspend(input, pos, currentLineLength);
      }

      // Emit the parsed token
      // Consumption includes separator whitespace; lexicalLength excludes it
      // and any synthetic EOF space. Consumption is clamped to the input below.
      const length = matchLength || match[0].length;
      const start = currentLineLength - (input.length - pos);
      let token;
      if (finalLineLength) {
        token = {
          type, value, prefix, line, start,
          end: finalLineLength, endLine: this._line,
        };
        callback(null, token);
      }
      else
        token = emitToken(type, value, prefix, line, start, lexicalLength || length);
      this.previousToken = token;
      this._previousMarker = type;

      // Advance to next part to tokenize
      pos = Math.min(pos + length, input.length);
      if (finalLineLength)
        currentLineLength = input.length - pos + finalLineLength;
    }

    // Emits a comment at its exact position within matched whitespace.
    function emitComment(value, line, start) {
      callback(null, {
        type: 'comment', value, prefix: '', line,
        start, end: start + value.length + 1,
      });
    }
    // Emits the token through the callback
    function emitToken(type, value, prefix, line, start, length) {
      const token = { type, value, prefix, line, start, end: start + length };
      callback(null, token);
      return token;
    }
    // Signals the syntax error through the callback
    function reportSyntaxError(self, input, pos) {
      callback(self._syntaxError(execAt(nonWhitespace, input, pos)[0]));
    }
  }

  // ### `_suspend` keeps the unconsumed input until more input arrives
  _suspend(input, pos, currentLineLength) {
    this._linePosition = currentLineLength - (input.length - pos);
    return this._input = input.slice(pos);
  }

  // ### `_matchN3Verb` matches an N3 verb unless the input is a longer prefixed name
  _matchN3Verb(input, pos, inputFinished) {
    const verb = execAt(this._n3Verb, input, pos);
    if (!verb)
      return null;

    // Most verb boundaries cannot be part of a prefix, so keep the common path fast.
    const next = input[pos + verb[0].length];
    if (next !== '-' && next !== '_' && (next < '0' || next > '9'))
      return verb;

    // A prefix can start with a verb and continue with characters that are also
    // valid verb boundaries. Prefer the longer prefixed name when it is complete.
    if (execAt(this._prefixed, input, pos))
      return null;
    // Appending to the input only matters when a prefixed name could run up to
    // its end, which a character that cannot occur in prefixed names rules out.
    // This avoids copying the rest of the document for every such verb.
    if (testAt(nonPrefixedNameChar, input, pos))
      return verb;
    if (execAtEnd(this._prefixed, input, pos))
      return null;

    // If a stream chunk ends partway through such a prefix, wait for the colon
    // instead of prematurely emitting the verb. Appending ": " lets the prefix
    // grammar determine whether all input seen so far can be a complete prefix.
    if (!inputFinished) {
      const prefix = execAt(this._prefix, `${input.slice(pos)}: `, 0);
      if (prefix)
        return null;
    }
    return verb;
  }

  // ### `_unescape` replaces N3 escape codes by their corresponding characters,
  // allowing only the fixed escape sequences from the given replacement table
  _unescape(item, replacements) {
    let backslash = item.indexOf('\\');
    if (backslash < 0)
      return item;

    let result = '', start = 0;
    // A trailing lone backslash is not an escape sequence.
    while (backslash >= 0 && backslash + 1 < item.length) {
      const escapedChar = item[backslash + 1];
      let end = backslash + 2, replacement;
      if (escapedChar === 'u' || escapedChar === 'U') {
        end += escapedChar === 'u' ? 4 : 8;
        if (end > item.length)
          return null;

        let charCode = 0;
        for (let i = backslash + 2; i < end; i++) {
          let digit = item.charCodeAt(i);
          if (digit >= 0x30 && digit <= 0x39) // 0–9
            digit -= 0x30;
          else if (digit >= 0x41 && digit <= 0x46) // A–F
            digit -= 0x41 - 10;
          else if (digit >= 0x61 && digit <= 0x66) // a–f
            digit -= 0x61 - 10;
          else
            return null;
          // Eight digits can exceed a signed 32-bit integer; avoid bitwise shifts.
          charCode = charCode * 16 + digit;
        }
        if (!isValidCodePoint(charCode))
          return null;
        replacement = String.fromCodePoint(charCode);
      }
      else {
        if (!(escapedChar in replacements))
          return null;
        replacement = replacements[escapedChar];
      }
      result += item.slice(start, backslash) + replacement;
      start = end;
      backslash = item.indexOf('\\', start);
    }
    return result + item.slice(start);
  }

  // ### `_parseLiteral` parses a literal at the given position into an unescaped value
  _parseLiteral(input, pos) {
    // Ensure we have enough lookahead to identify triple-quoted strings
    if (input.length - pos >= 3) {
      // The caller has already identified a single or double quote.
      const quote = input[pos];
      const openingLength = input[pos + 1] === quote && input[pos + 2] === quote ? 3 : 1;
      let opening = quote;
      if (openingLength === 3)
        opening = quote === '"' ? '"""' : "'''";

      // Find the next candidate closing quotes
      let closingPos = pos + Math.max(this._literalClosingPos, openingLength);
      while ((closingPos = input.indexOf(opening, closingPos)) > pos) {
        // Count backslashes right before the closing quotes
        let backslashCount = 0;
        while (input[closingPos - backslashCount - 1] === '\\')
          backslashCount++;

        // An even number of backslashes (in particular 0)
        // means these are actual, non-escaped closing quotes
        if (backslashCount % 2 === 0) {
          // Extract and unescape the value
          const raw = input.substring(pos + openingLength, closingPos),
              lines = raw.split(/\r\n|\r|\n/),
              lineCount = lines.length - 1;
          const matchLength = closingPos - pos + openingLength;
          // Only triple-quoted strings can be multi-line
          if (openingLength === 1 && lineCount !== 0 ||
              openingLength === 3 && this._lineMode)
            break;
          this._line += lineCount;
          const finalLineLength = lineCount === 0 ? 0 : lines[lines.length - 1].length + openingLength;
          return { value: this._unescape(raw, stringEscapeReplacements), matchLength, finalLineLength };
        }
        closingPos++;
      }
      this._literalClosingPos = input.length - pos - openingLength + 1;
    }
    return { value: '', matchLength: 0, finalLineLength: 0 };
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
    if (input.startsWith('\ufeff')) {
      this._linePosition = 1;
      return input.slice(1);
    }
    return input;
  }

  // ## Public methods

  // ### `tokenize` starts the transformation of an N3 document into an array of tokens.
  // The input can be a string or a stream.
  // Token ranges use one-based lines and zero-based, end-exclusive UTF-16 columns.
  // Separator whitespace counts towards the next token's start, outside either range.
  // Multiline tokens also have endLine; their end column is relative to that line.
  tokenize(input, callback) {
    // Deferred tokenization and stream events can outlive their invocation.
    // Ignore them once a later call takes ownership of the lexer state.
    const tokenization = this._tokenization = {};
    this._line = 1;
    this._linePosition = 0;
    this._previousMarker = undefined;
    this.previousToken = undefined;
    this._literalClosingPos = 0;
    this._input = undefined;

    // If the input is a string, continuously emit tokens through the callback until the end
    if (typeof input === 'string') {
      this._input = this._readStartingBom(input);
      // If a callback was passed, asynchronously call it
      if (typeof callback === 'function')
        queueMicrotask(() => {
          if (this._tokenization === tokenization)
            this._tokenizeToEnd(callback, true);
        });
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
        if (this._tokenization === tokenization && this._input !== null && data.length !== 0) {
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
        if (this._tokenization === tokenization && typeof this._input === 'string')
          this._tokenizeToEnd(callback, true);
      });
      input.on('error', error => {
        if (this._tokenization === tokenization)
          callback(error);
      });
    }
  }
}
