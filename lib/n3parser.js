// **N3Parser** parses N3 documents.
var N3Lexer = require('./n3lexer.js'),
    N3Store = require('./n3store.js');

var RDF_PREFIX = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    RDF_NIL    = RDF_PREFIX + 'nil',
    RDF_FIRST  = RDF_PREFIX + 'first',
    RDF_REST   = RDF_PREFIX + 'rest';

var absoluteURI = /^[a-z]+:/;

var undefined;

// ## Constructor
function N3Parser(config) {
  config = config || {};
  
  // We use a dummy constructor to enable construction without `new`.
  function Constructor() {}
  Constructor.prototype = N3Parser.prototype;
  
  // Initialize the new `N3Parser`.
  var n3Parser = new Constructor();
  n3Parser._lexer = config.lexer || new N3Lexer();
  n3Parser._blankNodes = Object.create(null);
  n3Parser._blankNodeCount = 0;
  n3Parser._tripleStack = [];
  n3Parser._baseURI = n3Parser._documentURI = config.documentURI || null;
  
  // Return the new `N3Parser`.
  return n3Parser;
}

N3Parser.prototype = {
  constructor: N3Parser,
  
  // ## Private methods
  
  // ### `_readInTopContext` reads a token when in the top context.
  _readInTopContext: function (token) {
    switch (token.type) {
    // If an EOF token arrives in the top context, signal that we're done.
    case 'eof':
      return this._callback(null, null);
    // It could be a prefix declaration.
    case '@prefix':
      return this._readPrefix;
    // It could be a base declaration.
    case '@base':
      return this._readBaseURI;
    // Otherwise, the next token must be a subject.
    default:
      return this._readSubject(token);
    }
  },
  
  // ### `_readSubject` reads a triple's subject.
  _readSubject: function (token) {
    switch (token.type) {
    case 'explicituri':
      if (this._baseURI === null || absoluteURI.test(token.value))
        this._subject = token.value;
      else
        this._subject = this._baseURI + token.value;
      break;
    case 'qname':
      if (token.prefix === '_') {
        this._subject = this._blankNodes[token.value] ||
                        (this._blankNodes[token.value] = '_:b' + this._blankNodeCount++);
      }
      else {
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        this._subject = prefix + token.value;
      }
      break;
    case 'bracketopen':
      // Start a new triple with a new blank node as subject.
      this._subject = '_:b' + this._blankNodeCount++;
      this._tripleStack.push({ subject: this._subject, predicate: null, object: null, type: 'blank' });
      return this._readBlankNodeHead;
    case 'liststart':
      // Start a new list
      this._tripleStack.push({ subject: RDF_NIL, predicate: null, object: null, type: 'list' });
      this._subject = null;
      return this._readListItem;
    default:
      return this._error('Unexpected token type "' + token.type, token);
    }
    // The next token must be a predicate.
    return this._readPredicate;
  },
  
  // ### `_readPredicate` reads a triple's predicate.
  _readPredicate: function (token) {
    switch (token.type) {
    case 'explicituri':
      if (this._baseURI === null || absoluteURI.test(token.value))
        this._predicate = token.value;
      else
        this._predicate = this._baseURI + token.value;
      break;
    case 'qname':
      if (token.prefix === '_') {
        this._predicate = this._blankNodes[token.value] ||
                          (this._blankNodes[token.value] = '_:b' + this._blankNodeCount++);
      }
      else {
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        this._predicate = prefix + token.value;
      }
      break;
    default:
      return this._error('Expected predicate to follow "' + this._subject + '"', token);
    }
    // The next token must be an object.
    return this._readObject;
  },
  
  // ### `_readObject` reads a triple's object.
  _readObject: function (token) {
    switch (token.type) {
    case 'explicituri':
      if (this._baseURI === null || absoluteURI.test(token.value))
        this._object = token.value;
      else
        this._object = this._baseURI + token.value;
      break;
    case 'qname':
      if (token.prefix === '_') {
        this._object = this._blankNodes[token.value] ||
                       (this._blankNodes[token.value] = '_:b' + this._blankNodeCount++);
      }
      else {
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        this._object = prefix + token.value;
      }
      break;
    case 'literal':
      this._object = token.value;
      return this._readDataTypeOrLang;
    case 'bracketopen':
      // Start a new triple with a new blank node as subject.
      var blank = '_:b' + this._blankNodeCount++;
      this._tripleStack.push({ subject: this._subject, predicate: this._predicate, object: blank, type: 'blank' });
      this._subject = blank;
      return this._readBlankNodeHead;
    case 'liststart':
      // Start a new list
      this._tripleStack.push({ subject: this._subject, predicate: this._predicate, object: RDF_NIL, type: 'list' });
      this._subject = null;
      return this._readListItem;
    default:
      return this._error('Expected object to follow "' + this._predicate + '"', token);
    }
    return this._getNextReader();
  },

  // ### `_readBlankNodeHead` reads the head of a blank node.
  _readBlankNodeHead: function (token) {
    if (token.type === 'bracketclose')
      return this._readBlankNodeTail(token, true);
    else
      return this._readPredicate(token);
  },

  // ### `_readBlankNodeTail` reads the end of a blank node.
  _readBlankNodeTail: function (token, empty) {
    if (token.type !== 'bracketclose')
      return this._readPunctuation(token);
    
    // Store blank node triple.
    if (empty !== true)
      this._callback(null, { subject: this._subject,
                             predicate: this._predicate,
                             object: this._object,
                             context: 'n3/contexts#default' });
    
    // Restore parent triple that contains the blank node.
    var triple = this._tripleStack.pop();
    this._subject = triple.subject;
    // Was the blank node the object?
    if (triple.object !== null) {
      // Restore predicate and object as well, and continue by reading punctuation.
      this._predicate = triple.predicate;
      this._object = triple.object;
      return this._getNextReader();
    }
    // The blank node was the subject, so continue reading the predicate.
    return this._readPredicate;
  },

  // ### `_readDataTypeOrLang` reads an _optional_ data type or language.
  _readDataTypeOrLang: function (token) {
    switch (token.type) {
    case 'type':
      var value;
      if (token.prefix === '') {
        value = token.value;
      }
      else {
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        value = prefix + token.value;
      }
      this._object += '^^' + value;
      return this._readPunctuation;
    case 'langcode':
      this._object += '@' + token.value;
      return this._getNextReader();
    default:
      return this._getNextReader().call(this, token);
    }
  },

  // ### `_readListItem` reads items from a list.
  _readListItem: function (token) {
    var item = null,                  // The actual list item.
        itemHead = null,              // The head of the rdf:first predicate.
        prevItemHead = this._subject, // The head of the previous rdf:first predicate.
        stack = this._tripleStack,    // The stack of triples part of recursion (lists, blanks, etc.).
        parentTriple = stack[stack.length - 1], // The triple containing the current list.
        next = this._readListItem;    // The next function to execute.
    
    switch (token.type) {
    case 'explicituri':
      item = token.value;
      break;
    case 'qname':
      if (token.prefix === '_') {
        item = this._blankNodes[token.value] ||
                       (this._blankNodes[token.value] = '_:b' + this._blankNodeCount++);
      }
      else {
        var prefix = this._prefixes[token.prefix];
        if (prefix === undefined)
          return this._error('Undefined prefix "' + token.prefix + ':"', token);
        item = prefix + token.value;
      }
      break;
    case 'literal':
      item = token.value;
      next = this._readDataTypeOrLang;
      break;
    case 'bracketopen':
      // Stack the current list triple and start a new triple with a blank node as subject.
      itemHead = '_:b' + this._blankNodeCount++;
      item     = '_:b' + this._blankNodeCount++;
      stack.push({ subject: itemHead, predicate: RDF_FIRST, object: item, type: 'blank' });
      this._subject = item;
      next = this._readBlankNodeHead;
      break;
    case 'liststart':
      // Stack the current list triple and start a new list
      itemHead = '_:b' + this._blankNodeCount++;
      stack.push({ subject: itemHead, predicate: RDF_FIRST, object: RDF_NIL, type: 'list' });
      this._subject = null;
      next = this._readListItem;
      break;
    case 'listend':
      // Restore the parent triple.
      stack.pop();
      // If this list is contained within a parent list, return the membership triple here.
      // This will be `<parent list elemen>t rdf:first <this list>.`.
      if (stack.length !== 0 && stack[stack.length - 1].type === 'list')
        this._callback(null, { subject: parentTriple.subject,
                               predicate: parentTriple.predicate,
                               object: parentTriple.object,
                               context: 'n3/contexts#default' });
      // Restore the parent triple's subject.
      this._subject = parentTriple.subject;
      // Was this list in the parent triple's subject?
      if (parentTriple.predicate === null) {
        // The next token is the predicate.
        next = this._readPredicate;
        // Skip writing the list tail if this was an empty list.
        if (parentTriple.subject === RDF_NIL)
          return next;
      }
      // The list was in the parent triple's object.
      else {
        // Restore the parent triple's predicate and object as well.
        this._predicate = parentTriple.predicate;
        this._object = parentTriple.object;
        next = this._getNextReader();
        // Skip writing the list tail if this was an empty list.
        if (parentTriple.object === RDF_NIL)
          return next;
      }
      // Close the list by making the item head nil.
      itemHead = RDF_NIL;
      break;
    default:
      return this._error('Expected list item instead of "' + token.type + '"', token);
    }

     // Create a new blank node if no item head was assigned yet.
    if (itemHead === null)
      this._subject = itemHead = '_:b' + this._blankNodeCount++;

    // Is this the first element of the list?
    if (prevItemHead === null) {
      // This list is either the object or the subject.
      if (parentTriple.object === RDF_NIL)
        parentTriple.object = itemHead;
      else
        parentTriple.subject = itemHead;
    }
    else {
      // The rest of the list is in the current head.
      this._callback(null, { subject: prevItemHead,
                             predicate: RDF_REST,
                             object: itemHead,
                             context: 'n3/contexts#default' });
    }
    // Add the item's value.
    if (item !== null)
      this._callback(null, { subject: itemHead,
                             predicate: RDF_FIRST,
                             object: item,
                             context: 'n3/contexts#default' });
    return next;
  },
  
  // ### `_readPunctuation` reads punctuation between triples or triple parts.
  _readPunctuation: function (token) {
    var next;
    switch (token.type) {
    // A dot just ends the statement, without sharing anything with the next.
    case 'dot':
      next = this._readInTopContext;
      break;
    // Semicolon means the subject is shared; predicate and object are different.
    case 'semicolon':
      next = this._readPredicate;
      break;
    // Comma means both the subject and predicate are shared; the object is different.
    case 'comma':
      next = this._readObject;
      break;
    default:
      return this._error('Expected punctuation to follow "' + this._object + '"', token);
    }
    // A triple has been completed now, so return it.
    this._callback(null, { subject: this._subject,
                           predicate: this._predicate,
                           object: this._object,
                           context: 'n3/contexts#default' });
    return next;
  },
  
  // ### `_readPrefix` reads the prefix of a prefix declaration.
  _readPrefix: function (token) {
    if (token.type !== 'prefix')
      return this._error('Expected prefix to follow @prefix', token);
    this._prefix = token.value;
    return this._readPrefixURI;
  },
  
  // ### `_readPrefixURI` reads the URI of a prefix declaration.
  _readPrefixURI: function (token) {
    if (token.type !== 'explicituri')
      return this._error('Expected explicituri to follow prefix "' + this.prefix + '"', token);
    if (this._baseURI === null || absoluteURI.test(token.value))
      this._prefixes[this._prefix] = token.value;
    else
      this._prefixes[this._prefix] = this._baseURI + token.value;
    return this._readDeclarationPunctuation;
  },
   
  // ### `_readBaseURI` reads the URI of a base declaration.
  _readBaseURI: function (token) {
    if (token.type !== 'explicituri')
      return this._error('Expected explicituri to follow base declaration', token);
    if (this._baseURI === null || absoluteURI.test(token.value))
      this._baseURI = token.value;
    else
      this._baseURI += token.value;
    return this._readDeclarationPunctuation;
  },
   
  // ### `_readDeclarationPunctuation` reads the punctiation of a declaration.
  _readDeclarationPunctuation: function (token) {
    if (token.type !== 'dot')
      return this._error('Expected declaration of to end with a dot', token);
    return this._readInTopContext;
  },
  
  // ### `_getNextReader` gets the next reader function at the end of a triple.
  _getNextReader: function () {
    var stack = this._tripleStack;
    if (stack.length === 0)
      return this._readPunctuation;
    
    switch (stack[stack.length - 1].type) {
    case 'blank':
      return this._readBlankNodeTail;
    case 'list':
      return this._readListItem;
    }
  },
  
  // ### `_error` emits an error message through the callback.
  _error: function (message, token) {
    this._callback(message + ' at line ' + token.line + '.');
  },
  
  // ## Public methods
  
  // ### `parse` parses the N3 input and emits each parsed triple through the callback.
  parse: function (input, callback) {
    var self = this;
    // Initialize prefix declarations.
    this._prefixes = Object.create(null);
    this._prefixes[''] = this._documentURI ? this._documentURI + '#' : '#';
    // Set the triple callback.
    this._callback = callback;
    // The read callback is the next function to be executed when a token arrives.
    // We start reading in the top context.
    this._readCallback = this._readInTopContext;
    // Execute the read callback when a token arrives.
    this._lexer.tokenize(input, function (error, token) {
      if (error !== null)
        self._callback(error);
      else if (self._readCallback !== undefined)
        self._readCallback = self._readCallback(token);
    });
  }
};

// ## Exports

// Export the `N3Parser` class as a whole.
module.exports = N3Parser;
