// **N3Parser** parses N3 documents.
import N3Lexer from './N3Lexer';
import N3DataFactory from './N3DataFactory';
import namespaces from './IRIs';

let blankNodePrefix = 0;

// ## Constructor
export default class N3Parser {
  constructor(options) {
    this._contextStack = [];
    this._graph = null;

    // Set the document IRI
    options = options || {};
    this._setBase(options.baseIRI);
    options.factory && initDataFactory(this, options.factory);

    // Set supported features depending on the format
    const format = (typeof options.format === 'string') ?
                 options.format.match(/\w*$/)[0].toLowerCase() : '',
        isTurtle = /turtle/.test(format), isTriG = /trig/.test(format),
        isNTriples = /triple/.test(format), isNQuads = /quad/.test(format),
        isN3 = this._n3Mode = /n3/.test(format),
        isLineMode = isNTriples || isNQuads;
    // Keep inverse handling off the non-N3 emission path
    this._emitCurrent = this._emit;
    if (isN3) {
      this._createQuad = this._createQuadInDirection;
      this._emit = this._emitInDirection;
      this._emitCurrent = this._emitCurrentInDirection;
    }
    if (!(this._supportsNamedGraphs = !(isTurtle || isN3)))
      this._readPredicateOrNamedGraph = this._readPredicate;
    // Support triples in other graphs
    this._supportsQuads = !(isTurtle || isTriG || isNTriples || isN3);
    // Whether the log:isImpliedBy predicate is supported
    this._isImpliedBy = options.isImpliedBy;
    // Whether an undeclared empty prefix resolves against the document IRI
    this._implicitEmptyPrefix = !!options.implicitEmptyPrefix;
    // Whether an empty formula is read as the boolean literal true,
    // as in the N3 spec tests (opt-in until the next major version)
    this._emptyFormulaAsTrue = !!options.emptyFormulaAsTrue;
    // Disable relative IRIs in N-Triples or N-Quads mode
    if (isLineMode)
      this._resolveRelativeIRI = iri => { return null; };
    this._blankNodePrefix = typeof options.blankNodePrefix !== 'string' ? '' :
                              options.blankNodePrefix.replace(/^(?!_:)/, '_:');
    this._lexer = options.lexer || new N3Lexer({ lineMode: isLineMode, n3: isN3, isImpliedBy: this._isImpliedBy });
    // Disable explicit quantifiers by default
    this._explicitQuantifiers = !!options.explicitQuantifiers;
    // Disable parsing of unsupported versions by default
    this._parseUnsupportedVersions = !!options.parseUnsupportedVersions;
    this._version = options.version;
  }

  // ## Static class methods

  // ### `_resetBlankNodePrefix` restarts blank node prefix identification
  static _resetBlankNodePrefix() {
    blankNodePrefix = 0;
  }

  // ## Private methods

  // ### `_setBase` sets the base IRI to resolve relative IRIs
  _setBase(baseIRI) {
    if (!baseIRI) {
      this._base = '';
      this._basePath = '';
    }
    else {
      // Remove fragment if present
      const fragmentPos = baseIRI.indexOf('#');
      if (fragmentPos >= 0)
        baseIRI = baseIRI.substr(0, fragmentPos);
      // Set base IRI and its components
      this._base = baseIRI;
      this._basePath   = baseIRI.indexOf('/') < 0 ? baseIRI :
                         baseIRI.replace(/[^\/?]*(?:\?.*)?$/, '');
      baseIRI = baseIRI.match(/^(?:([a-z][a-z0-9+.-]*:))?(?:\/\/[^\/]*)?/i);
      this._baseRoot   = baseIRI[0];
      this._baseScheme = baseIRI[1];
    }
  }

  // ### `_saveContext` stores the current parsing context
  // when entering a new scope (list, blank node, formula)
  _saveContext(type, graph, subject, predicate, object) {
    // Only N3 contexts need the extra parser state.
    if (!this._n3Mode) {
      this._contextStack.push({ type, subject, predicate, object, graph });
      return;
    }
    const context = {
      type,
      subject, predicate, object, graph,
      inverse: this._inversePredicate,
      expectOf: this._expectOf,
      blankPrefix: this._prefixes._,
      quantified: this._quantified,
      emptyFormula: this._emptyFormula,
    };
    // Prefix and base declarations are scoped to their formula
    if (type === 'formula') {
      context.prefixes = this._prefixes;
      context.base = [this._base, this._basePath, this._baseRoot, this._baseScheme];
      this._prefixes = Object.create(this._prefixes);
    }
    this._contextStack.push(context);
    // Every new scope resets the predicate direction
    this._inversePredicate = false;
    this._expectOf = false;
    // In N3, blank nodes are scoped to a formula
    // (using a dot as separator, as a blank node label cannot start with it)
    this._prefixes._ = (this._graph ? `${this._graph.value}.` : '.');
    // Quantifiers are scoped to a formula
    this._quantified = Object.create(this._quantified);
    // A formula starts empty and must not inherit its parent's subject
    if (type === 'formula') {
      this._subject = null;
      this._emptyFormula = true;
    }
  }

  // ### `_restoreContext` restores the parent context
  // when leaving a scope (list, blank node, formula)
  _restoreContext(type, token) {
    // Obtain the previous context
    const context = this._contextStack.pop();
    if (!context || context.type !== type)
      return this._error(`Unexpected ${token.type}`, token);

    // Restore the quad of the previous context
    this._subject   = context.subject;
    this._predicate = context.predicate;
    this._object    = context.object;
    this._graph     = context.graph;

    // Restore N3 context settings
    if (this._n3Mode) {
      this._inversePredicate = context.inverse;
      this._expectOf = context.expectOf;
      if (type === 'formula') {
        this._prefixes = context.prefixes;
        [this._base, this._basePath, this._baseRoot, this._baseScheme] = context.base;
      }
      else
        this._prefixes._ = context.blankPrefix;
      this._quantified = context.quantified;
      this._emptyFormula = context.emptyFormula;
    }
  }

  // ### `_readBeforeTopContext` is called once only at the start of parsing.
  _readBeforeTopContext(token) {
    if (this._version && !this._isValidVersion(this._version))
      return this._error(`Detected unsupported version as media type parameter: "${this._version}"`, token);
    return this._readInTopContext(token);
  }

  // ### `_readInTopContext` reads a token when in the top context
  _readInTopContext(token) {
    switch (token.type) {
    // If an EOF token arrives in the top context, signal that we're done
    case 'eof':
      if (this._graph !== null)
        return this._error('Unclosed graph', token);
      delete this._prefixes._;
      return this._callback(null, null, this._prefixes);
    // It could be a prefix declaration
    case 'PREFIX':
      this._sparqlStyle = true;
    case '@prefix':
      return this._readPrefix;
    // It could be a base declaration
    case 'BASE':
      this._sparqlStyle = true;
    case '@base':
      return this._readBaseIRI;
    // It could be a version declaration
    case 'VERSION':
      this._sparqlStyle = true;
    case '@version':
      return this._readVersion;
    // It could be a graph
    case '{':
      if (this._supportsNamedGraphs) {
        this._graph = '';
        this._subject = null;
        return this._readSubject;
      }
    case 'GRAPH':
      if (this._supportsNamedGraphs)
        return this._readNamedGraphLabel;
    // Otherwise, the next token must be a subject
    default:
      return this._readSubject(token);
    }
  }

  // ### `_readInFormulaContext` reads a token at the statement level of a formula
  _readInFormulaContext(token) {
    switch (token.type) {
    case 'PREFIX':
      this._sparqlStyle = true;
    case '@prefix':
      return this._readPrefix;
    case 'BASE':
      this._sparqlStyle = true;
    case '@base':
      return this._readBaseIRI;
    default:
      return this._readSubject(token);
    }
  }

  // ### `_getStatementReader` returns the reader for the current statement scope
  _getStatementReader() {
    const context = this._contextStack[this._contextStack.length - 1];
    return context && context.type === 'formula' ? this._readInFormulaContext : this._readInTopContext;
  }

  // ### `_readEntity` reads an IRI, prefixed name, blank node, or variable
  _readEntity(token, quantifier) {
    let value;
    switch (token.type) {
    // Read a relative or absolute IRI
    case 'IRI':
    case 'typeIRI':
      const iri = this._resolveIRI(token.value);
      if (iri === null)
        return this._error('Invalid IRI', token);
      value = this._factory.namedNode(iri);
      break;
    // Read a prefixed name
    case 'type':
    case 'prefixed':
      const prefix = this._prefixes[token.prefix];
      if (prefix === undefined)
        return this._error(`Undefined prefix "${token.prefix}:"`, token);
      value = this._factory.namedNode(prefix + token.value);
      break;
    // Read a blank node
    case 'blank':
      value = this._factory.blankNode(this._prefixes[token.prefix] + token.value);
      break;
    // Read a variable
    case 'var':
      value = this._factory.variable(token.value.substr(1));
      break;
    // Everything else is not an entity
    default:
      return this._error(`Expected entity but got ${token.type}`, token);
    }
    // In N3 mode, replace the entity if it is quantified
    if (!quantifier && this._n3Mode && (value.id in this._quantified))
      value = this._quantified[value.id];
    return value;
  }

  // ### `_readList` starts reading a list in the subject, predicate, or object position
  _readList(token, subject, predicate, object) {
    const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
    if (parent.type === '<<') {
      return this._error('Unexpected list in reified triple', token);
    }
    // Start a new list
    this._saveContext('list', this._graph, subject, predicate, object);
    this._subject = null;
    return this._readListItem;
  }

  // ### `_readSubject` reads a quad's subject
  _readSubject(token) {
    this._predicate = null;
    // Any statement token means the enclosing formula is not empty
    if (token.type !== '}')
      this._emptyFormula = false;
    switch (token.type) {
    case '[':
      // Start a new quad with a new blank node as subject
      this._saveContext('blank', this._graph,
                        this._subject = this._factory.blankNode(), null, null);
      return this._readBlankNodeHead;
    case '(':
      return this._readList(token, this.RDF_NIL, null, null);
    case '{':
      // Start a new formula
      if (!this._n3Mode)
        return this._error('Unexpected graph', token);
      this._saveContext('formula', this._graph,
                        this._graph = this._factory.blankNode(), null, null);
      return this._readInFormulaContext;
    case '}':
       // No subject; the graph in which we are reading is closed instead
      return this._readPunctuation(token);
    case '@forSome':
      if (!this._n3Mode)
        return this._error('Unexpected "@forSome"', token);
      this._subject = null;
      this._predicate = this.N3_FORSOME;
      this._quantifier = 'blankNode';
      return this._readQuantifierList;
    case '@forAll':
      if (!this._n3Mode)
        return this._error('Unexpected "@forAll"', token);
      this._subject = null;
      this._predicate = this.N3_FORALL;
      this._quantifier = 'variable';
      return this._readQuantifierList;
    case 'literal':
      if (!this._n3Mode)
        return this._error('Unexpected literal', token);

      if (token.prefix.length === 0) {
        this._literalValue = token.value;
        return this._completeSubjectLiteral;
      }
      else {
        this._subject = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
        // This branch is N3-only, so the literal subject might start a path
        return this._getPathReader(this._readPredicateOrNamedGraph);
      }
    case '<<(':
      if (!this._n3Mode)
        return this._error('Disallowed triple term as subject', token);
      this._saveContext('<<(', this._graph, null, null, null);
      this._graph = null;
      return this._readSubject;
    case '<<':
      this._saveContext('<<', this._graph, null, null, null);
      this._graph = null;
      return this._readSubject;
    default:
      // Read the subject entity
      if ((this._subject = this._readEntity(token)) === undefined)
        return;
      // In N3 mode, the subject might be a path
      if (this._n3Mode)
        return this._getPathReader(this._readPredicateOrNamedGraph);
    }

    // The next token must be a predicate,
    // or, if the subject was actually a graph IRI, a named graph
    return this._readPredicateOrNamedGraph;
  }

  // ### `_readPredicate` reads a quad's predicate
  _readPredicate(token) {
    const type = token.type;
    let pathable = false;
    switch (type) {
    case 'inverse':
      this._inversePredicate = true;
    case 'abbreviation':
      this._predicate = this.ABBREVIATIONS[token.value];
      break;
    case 'has':
      return this._readPredicateAfterVerb;
    case 'is':
      this._inversePredicate = true;
      this._expectOf = true;
      return this._readPredicateAfterVerb;
    case 'inversePredicate':
      this._inversePredicate = true;
      return this._readPredicateAfterVerb;
    case '.':
    case ']':
    case '}':
    case '|}':
      // Expected predicate didn't come, must have been trailing semicolon.
      // In N3 mode, a subject (such as a path) can be a statement by itself.
      if (this._predicate === null && !this._n3Mode)
        return this._error(`Unexpected ${type}`, token);
      this._subject = null;
      return type === ']' ? this._readBlankNodeTail(token) : this._readPunctuation(token);
    case ';':
      // Additional semicolons can be safely ignored
      return this._predicate !== null ? this._readPredicate :
             this._error('Expected predicate but got ;', token);
    case 'literal':
      if (!this._n3Mode)
        return this._error('Unexpected literal', token);

      if (token.prefix.length === 0) {
        this._literalValue = token.value;
        return this._completePredicateLiteral;
      }
      else
        this._predicate = this._factory.literal(token.value, this._factory.namedNode(token.prefix));

      pathable = true;
      break;
    case '(':
      // In N3, a list can be a predicate
      return this._n3Mode ?
        this._readList(token, this._subject, this.RDF_NIL, null) :
        this._error(`Expected entity but got ${type}`, token);
    case '[':
      if (this._n3Mode) {
        // Start a new quad with a new blank node as subject
        this._saveContext('blank', this._graph, this._subject,
                          this._subject = this._factory.blankNode(), null);
        return this._readBlankNodeHead;
      }
      return this._error('Disallowed blank node as predicate', token);
    case '{':
      // In N3, a formula can be a predicate
      if (this._n3Mode) {
        this._saveContext('formula', this._graph, this._subject,
                          this._graph = this._factory.blankNode(), null);
        return this._readSubject;
      }
      return this._readEntity(token);
    case 'blank':
      if (!this._n3Mode)
        return this._error('Disallowed blank node as predicate', token);
    default:
      if ((this._predicate = this._readEntity(token)) === undefined)
        return;
      pathable = this._n3Mode;
    }
    this._validAnnotation = true;
    // The next token must be an object
    return pathable ? this._getPathReader(this._readObject, 'predicate') : this._readObject;
  }

  // ### `_readPredicateAfterVerb` reads the predicate following `has` or `is`
  _readPredicateAfterVerb(token) {
    if (token.type === 'has' || token.type === 'is' || token.type === 'of' ||
        token.type === 'inversePredicate')
      return this._error(`Expected expression but got ${token.type}`, token);
    return this._readPredicate(token);
  }

  // ### `_readObject` reads a quad's object
  _readObject(token) {
    if (this._expectOf) {
      if (token.type !== 'of')
        return this._error(`Expected of but got ${token.type}`, token);
      this._expectOf = false;
      return this._readObject;
    }
    switch (token.type) {
    case 'literal':
      // Regular literal, can still get a datatype or language
      if (token.prefix.length === 0) {
        this._literalValue = token.value;
        return this._readDataTypeOrLang;
      }
      // Pre-datatyped string literal (prefix stores the datatype)
      else {
        this._object = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
        // In N3 mode, the literal object might start a path
        if (this._n3Mode)
          return this._getPathReader(this._getContextEndReader());
      }
      break;
    case '[':
      // Start a new quad with a new blank node as subject
      this._saveContext('blank', this._graph, this._subject, this._predicate,
                        this._subject = this._factory.blankNode());
      return this._readBlankNodeHead;
    case '(':
      return this._readList(token, this._subject, this._predicate, this.RDF_NIL);
    case '{':
      // Start a new formula
      if (!this._n3Mode)
        return this._error('Unexpected graph', token);
      this._saveContext('formula', this._graph, this._subject, this._predicate,
                        this._graph = this._factory.blankNode());
      return this._readInFormulaContext;
    case '<<(':
      this._saveContext('<<(', this._graph, this._subject, this._predicate, null);
      this._graph = null;
      return this._readSubject;
    case '<<':
      this._saveContext('<<', this._graph, this._subject, this._predicate, null);
      this._graph = null;
      return this._readSubject;
    default:
      // Read the object entity
      if ((this._object = this._readEntity(token)) === undefined)
        return;
      // In N3 mode, the object might be a path
      if (this._n3Mode)
        return this._getPathReader(this._getContextEndReader());
    }
    return this._getContextEndReader();
  }

  // ### `_readPredicateOrNamedGraph` reads a quad's predicate, or a named graph
  _readPredicateOrNamedGraph(token) {
    return token.type === '{' ? this._readGraph(token) : this._readPredicate(token);
  }

  // ### `_readGraph` reads a graph
  _readGraph(token) {
    if (token.type !== '{')
      return this._error(`Expected graph but got ${token.type}`, token);
    // The "subject" we read is actually the GRAPH's label
    this._graph = this._subject, this._subject = null;
    return this._readSubject;
  }

  // ### `_readBlankNodeHead` reads the head of a blank node
  _readBlankNodeHead(token) {
    if (token.type === ']') {
      this._subject = null;
      return this._readBlankNodeTail(token);
    }
    else {
      const stack = this._contextStack, parentParent = stack.length > 1 && stack[stack.length - 2];
      if (parentParent.type === '<<') {
        return this._error('Unexpected compound blank node expression in reified triple', token);
      }
      if (token.type === 'id')
        return this._readIriPropertyListId;
      this._predicate = null;
      return this._readPredicate(token);
    }
  }

  // ### `_readIriPropertyListId` replaces a property list's blank node with its IRI
  _readIriPropertyListId(token) {
    const iri = this._readEntity(token);
    if (iri === undefined)
      return;
    if (iri.termType !== 'NamedNode')
      return this._error(`Expected IRI after id but got ${token.type}`, token);

    const placeholder = this._subject;
    this._subject = iri;
    const context = this._contextStack[this._contextStack.length - 1];
    if (context.subject === placeholder)
      context.subject = iri;
    if (context.predicate === placeholder)
      context.predicate = iri;
    if (context.object === placeholder)
      context.object = iri;
    this._predicate = null;
    return this._readIriPropertyListPredicate;
  }

  // ### `_readIriPropertyListPredicate` requires properties after an IRI property list ID
  _readIriPropertyListPredicate(token) {
    if (token.type === ';' || token.type === ']' || token.type === '.' || token.type === '}')
      return this._error(`Expected predicate but got ${token.type}`, token);
    return this._readPredicate(token);
  }

  // ### `_readBlankNodeTail` reads the end of a blank node
  _readBlankNodeTail(token) {
    if (token.type !== ']')
      return this._readBlankNodePunctuation(token);

    // Store blank node quad
    if (this._subject !== null)
      this._emitCurrent(this._subject, this._predicate, this._object, this._graph);

    // Restore the parent context containing this blank node
    const empty = this._predicate === null;
    this._restoreContext('blank', token);
    // If the blank node was the object, restore previous context and read punctuation
    if (this._object !== null)
      return this._getContextEndReader();
    // If the blank node was the predicate, continue reading the object
    else if (this._predicate !== null)
      return this._getPathReader(this._readObject, 'predicate');
    // If the blank node was the subject, continue reading the predicate
    else
      // If the blank node was empty, it could be a named graph label
      return empty ? this._readPredicateOrNamedGraph : this._readPredicateAfterBlank;
  }

  // ### `_readPredicateAfterBlank` reads a predicate after an anonymous blank node
  _readPredicateAfterBlank(token) {
    switch (token.type) {
    case '.':
    case '}':
      // No predicate is coming if the triple is terminated here
      this._subject = null;
      return this._readPunctuation(token);
    default:
      return this._readPredicate(token);
    }
  }

  // ### `_readListItem` reads items from a list
  _readListItem(token) {
    let item = null,                      // The item of the list
        list = null,                      // The list itself
        next = this._readListItem;        // The next function to execute
    const previousList = this._subject,   // The previous list that contains this list
        stack = this._contextStack,       // The stack of parent contexts
        parent = stack[stack.length - 1]; // The parent containing the current list

    switch (token.type) {
    case '[':
      // Stack the current list quad and start a new quad with a blank node as subject
      this._saveContext('blank', this._graph,
                        list = this._factory.blankNode(), this.RDF_FIRST,
                        this._subject = item = this._factory.blankNode());
      next = this._readBlankNodeHead;
      break;
    case '(':
      // Stack the current list quad and start a new list
      this._saveContext('list', this._graph,
                        list = this._factory.blankNode(), this.RDF_FIRST, this.RDF_NIL);
      this._subject = null;
      break;
    case ')':
      // Closing the list; restore the parent context
      this._restoreContext('list', token);
      // If this list is contained within a parent list, return the membership quad here.
      // This will be `<parent list element> rdf:first <this list>.`.
      if (stack.length !== 0 && stack[stack.length - 1].type === 'list') {
        // In N3 mode, this list might be the start of a path
        if (this._n3Mode) {
          // Close this list's tail, as a path would alter the membership quad only
          if (previousList !== null)
            this._emit(previousList, this.RDF_REST, this.RDF_NIL, this._graph);
          // Create a new context to read the path;
          // _readPath will restore the context and output the membership quad
          this._saveContext('item', this._graph, this._subject, this._predicate, this._object);
          this._subject = this._object, this._predicate = null;
          return this._getPathReader(this._readListItem);
        }
        this._emit(this._subject, this._predicate, this._object, this._graph);
      }
      // Was this list the parent's subject?
      if (this._predicate === null) {
        // The next token is the predicate
        next = this._n3Mode ? this._getPathReader(this._readPredicate) : this._readPredicate;
        // No list tail if this was an empty list
        if (this._subject === this.RDF_NIL)
          return next;
      }
      // Was this list the parent's predicate?
      else if (this._object === null) {
        // The next token is the object
        next = this._getPathReader(this._readObject, 'predicate');
        // No list tail if this was an empty list
        if (this._predicate === this.RDF_NIL)
          return next;
      }
      // The list was in the parent context's object
      else {
        next = this._getContextEndReader();
        // In N3 mode, the list object might be the start of a path
        if (this._n3Mode)
          next = this._getPathReader(next);
        // No list tail if this was an empty list
        if (this._object === this.RDF_NIL)
          return next;
      }
      // Close the list by making the head nil
      list = this.RDF_NIL;
      break;
    case 'literal':
      // Regular literal, can still get a datatype or language
      if (token.prefix.length === 0) {
        this._literalValue = token.value;
        next = this._readListItemDataTypeOrLang;
      }
      // Pre-datatyped string literal (prefix stores the datatype)
      else {
        item = this._factory.literal(token.value, this._factory.namedNode(token.prefix));
        next = this._getContextEndReader();
      }
      break;
    case '{':
      // Start a new formula
      if (!this._n3Mode)
        return this._error('Unexpected graph', token);
      // The formula is an item of the list,
      // so it must be linked in the list's graph before the graph changes
      list = this._factory.blankNode();
      item = this._factory.blankNode();
      // Is this the first element of the list?
      if (previousList === null) {
        // This list is either the subject or the object of its parent
        if (parent.predicate === null)
          parent.subject = list;
        else
          parent.object = list;
      }
      else {
        // Continue the previous list with the current list
        this._emit(previousList, this.RDF_REST, list, this._graph);
      }
      // Output the item
      this._emit(list, this.RDF_FIRST, item, this._graph);
      // Stack the current list quad and start the formula
      this._saveContext('formula', this._graph, list, this.RDF_FIRST,
                        this._graph = item);
      this._subject = null;
      return this._readInFormulaContext;
    case '<<(':
      this._saveContext('<<(', this._graph, null, null, null);
      this._graph = null;
      next = this._readSubject;
      break;
    case '<<':
      this._saveContext('<<', this._graph, null, null, null);
      this._graph = null;
      next = this._readSubject;
      break;
    default:
      if ((item = this._readEntity(token)) === undefined)
        return;
    }

     // Create a new blank node if no item head was assigned yet
    if (list === null)
      this._subject = list = this._factory.blankNode();

    // When reading a reified triple or triple term, store the list as subject in the stack, as this will be overridden when reading the triple.
    if (token.type === '<<' || token.type === '<<(')
      stack[stack.length - 1].subject = this._subject;

    // Is this the first element of the list?
    if (previousList === null) {
      // The list is the subject of the parent
      if (parent.predicate === null)
        parent.subject = list;
      // The list is the predicate of the parent
      else if (parent.object === null)
        parent.predicate = list;
      // The list is the object of the parent
      else
        parent.object = list;
    }
    else {
      // Continue the previous list with the current list
      this._emit(previousList, this.RDF_REST, list, this._graph);
    }
    // If an item was read, add it to the list
    if (item !== null) {
      // In N3 mode, the item might be a path
      if (this._n3Mode && (token.type === 'IRI' || token.type === 'prefixed' ||
                           token.type === 'var' || token.type === 'blank' ||
                           token.type === 'literal')) {
        // Create a new context to add the item's path
        this._saveContext('item', this._graph, list, this.RDF_FIRST, item);
        this._subject = item, this._predicate = null;
        // _readPath will restore the context and output the item
        return this._getPathReader(this._readListItem);
      }
      // Output the item
      this._emit(list, this.RDF_FIRST, item, this._graph);
    }
    return next;
  }

  // ### `_readDataTypeOrLang` reads an _optional_ datatype or language
  _readDataTypeOrLang(token) {
    return this._completeObjectLiteral(token, false);
  }


  // ### `_readListItemDataTypeOrLang` reads an _optional_ datatype or language in a list
  _readListItemDataTypeOrLang(token) {
    return this._completeObjectLiteral(token, true);
  }

  // ### `_completeLiteral` completes a literal with an optional datatype or language
  // Defers possible direction tags without allocating bound callbacks.
  _completeLiteral(token, component) {
    let literal, readCb = false;

    switch (token.type) {
    // Create a datatyped literal
    case 'type':
    case 'typeIRI':
      const datatype = this._readEntity(token);
      if (datatype === undefined) return; // No datatype means an error occurred
      if (datatype.value === namespaces.rdf.langString || datatype.value === namespaces.rdf.dirLangString) {
        return this._error('Detected illegal (directional) languaged-tagged string with explicit datatype', token);
      }
      literal = this._factory.literal(this._literalValue, datatype);
      token = null;
      break;
    // Create a language-tagged string
    case 'langcode':
      if (token.value.split('-').some(t => t.length > 8))
        return this._error('Detected language tag with subtag longer than 8 characters', token);
      literal = this._factory.literal(this._literalValue, token.value);
      this._literalLanguage = token.value;
      token = null;
      // Save state for a possible direction tag
      this._literalComponent = component;
      readCb = true;
      break;
    // Create a simple string literal by default
    default:
      literal = this._factory.literal(this._literalValue);
    }

    return { token, literal, readCb };
  }

  // ### `_readDirCode` reads an optional directional language tag
  _readDirCode(token) {
    const component = this._literalComponent, listItem = this._literalListItem;
    // Attempt to read a dircode
    if (token.type === 'dircode') {
      const term = this._factory.literal(this._literalValue, { language: this._literalLanguage, direction: token.value });
      if (component === 'subject')
        this._subject = term;
      else if (component === 'predicate')
        this._predicate = term;
      else
        this._object = term;
      this._literalLanguage = undefined;
      token = null;
    }

    if (component === 'subject' || component === 'predicate') {
      // A subject or predicate literal implies N3 mode, so it might start a path
      const next = component === 'subject' ? this._readPredicateOrNamedGraph : this._readObject;
      const reader = this._getPathEndReader(token, next, component);
      return reader || next.call(this, token);
    }
    return this._completeObjectLiteralPost(token, listItem);
  }

  // Completes a literal in subject or predicate position
  _completeTermLiteral(token, component) {
    const completed = this._completeLiteral(token, component);
    if (!completed)
      return;

    let next;
    if (component === 'subject') {
      this._subject = completed.literal;
      next = this._readPredicateOrNamedGraph;
    }
    else {
      this._predicate = completed.literal;
      this._validAnnotation = true;
      next = this._readObject;
    }

    // Postpone completion if the literal is only partially completed (such as lang+dir).
    if (completed.readCb) {
      this._literalListItem = false;
      return this._readDirCode;
    }

    // A subject or predicate literal implies N3 mode, so it might start a path.
    const reader = this._getPathEndReader(completed.token, next, component);
    if (reader)
      return reader;

    // Consume the non-path token now
    return next.call(this, completed.token);
  }

  // Completes a literal in subject position
  _completeSubjectLiteral(token) {
    return this._completeTermLiteral(token, 'subject');
  }

  // Completes a literal in predicate position
  _completePredicateLiteral(token) {
    return this._completeTermLiteral(token, 'predicate');
  }

  // Completes a literal in object position
  _completeObjectLiteral(token, listItem) {
    const completed = this._completeLiteral(token, 'object');
    if (!completed)
      return;

    this._object = completed.literal;

    // Postpone completion if the literal is only partially completed (such as lang+dir).
    if (completed.readCb) {
      this._literalListItem = listItem;
      return this._readDirCode;
    }

    return this._completeObjectLiteralPost(completed.token, listItem);
  }

  _completeObjectLiteralPost(token, listItem) {
    // In N3 mode, the literal object might start a path
    if (this._n3Mode && (token === null || token.type === '!' || token.type === '^')) {
      // If this literal was part of a list, defer writing the item;
      // _readPath will then restore the context and output it
      if (listItem) {
        this._saveContext('item', this._graph, this._subject, this.RDF_FIRST, this._object);
        this._subject = this._object, this._predicate = null;
        return this._getPathEndReader(token, this._readListItem);
      }
      return this._getPathEndReader(token, this._getContextEndReader());
    }
    // If this literal was part of a list, write the item
    // (we could also check the context stack, but passing in a flag is faster)
    if (listItem)
      this._emit(this._subject, this.RDF_FIRST, this._object, this._graph);
    // If the token was consumed, continue with the rest of the input
    if (token === null)
      return this._getContextEndReader();
    // Otherwise, consume the token now
    else {
      this._readCallback = this._getContextEndReader();
      return this._readCallback(token);
    }
  }

  // ### `_readFormulaTail` reads the end of a formula
  _readFormulaTail(token) {
    if (token.type !== '}')
      return this._readPunctuation(token);

    // Store the last quad of the formula
    if (this._subject !== null)
      this._emitCurrent(this._subject, this._predicate, this._object, this._graph);

    const formula = this._graph, empty = this._emptyFormula;
    // Restore the parent context containing this formula
    this._restoreContext('formula', token);

    // When the emptyFormulaAsTrue option is set, an empty formula
    // is read as the boolean literal true, following the N3 spec tests
    // and the direction discussed in https://github.com/w3c-cg/N3/issues/185
    if (empty && this._emptyFormulaAsTrue) {
      if (this._subject === formula)
        this._subject = this.N3_TRUE;
      else if (this._predicate === formula)
        this._predicate = this.N3_TRUE;
      else
        this._object = this.N3_TRUE;
    }

    // Continue according to the formula's position in the enclosing statement
    if (this._object !== null)
      return this._getPathReader(this._getContextEndReader(), 'object');
    if (this._predicate !== null)
      return this._getPathReader(this._readObject, 'predicate');
    return this._getPathReader(this._readPredicate, 'subject');
  }

  // ### `_readPunctuation` reads punctuation between quads or quad parts
  _readPunctuation(token) {
    let next, graph = this._graph, startingAnnotation = false;
    const subject = this._subject, inversePredicate = this._inversePredicate;
    switch (token.type) {
    // A closing brace ends a graph
    case '}':
      if (this._graph === null)
        return this._error('Unexpected graph closing', token);
      if (this._n3Mode)
        return this._readFormulaTail(token);
      this._graph = null;
    // A dot just ends the statement, without sharing anything with the next
    case '.':
      this._subject = null;
      this._tripleTerm = null;
      next = this._getStatementReader();
      if (inversePredicate) this._inversePredicate = false;
      break;
    // Semicolon means the subject is shared; predicate and object are different
    case ';':
      if (inversePredicate) this._inversePredicate = false;
      next = this._readPredicate;
      break;
    // Comma means both the subject and predicate are shared; the object is different
    case ',':
      next = this._readObject;
      break;
    // ~ is allowed in the annotation syntax
    case '~':
      // Only invalidate the cache for a genuinely new triple - chained annotation blocks on the
      // same triple (subject already null from a preceding annotation) must keep reusing it.
      if (subject !== null)
        this._tripleTerm = null;
      next = this._readReifierInAnnotation;
      startingAnnotation = true;
      break;
    // {| means that the current triple is annotated with predicate-object pairs.
    case '{|':
      // Continue using the last triple as reified triple subject for the predicate-object pairs.
      // Same staleness rule as ~ above.
      if (subject !== null)
        this._tripleTerm = null;
      this._subject = this._readTripleTerm();
      this._inversePredicate = false;
      this._validAnnotation = false;
      startingAnnotation = true;
      next = this._readPredicate;
      break;
    // |} means that the current reified triple in annotation syntax is finalized.
    case '|}':
      if (!this._annotation)
        return this._error('Unexpected annotation syntax closing', token);
      if (!this._validAnnotation)
        return this._error('Annotation block can not be empty', token);
      this._subject = null;
      this._annotation = false;
      this._inversePredicate = false;
      next = this._getContextEndReader();
      break;
    default:
      // An entity means this is a quad (only allowed if not already inside a graph)
      if (this._supportsQuads && this._graph === null && (graph = this._readEntity(token)) !== undefined) {
        next = this._readQuadPunctuation;
        break;
      }
      return this._error(`Expected punctuation to follow "${this._object.id}"`, token);
    }
    // A quad has been completed now, so return it
    if (subject !== null && (!startingAnnotation || (startingAnnotation && !this._annotation))) {
      const predicate = this._predicate, object = this._object;
      this._emit(subject, predicate, object, graph, inversePredicate);
    }
    if (startingAnnotation) {
      this._annotation = true;
    }
    return next;
  }

    // ### `_readBlankNodePunctuation` reads punctuation in a blank node
  _readBlankNodePunctuation(token) {
    let next, resetInversePredicate = false;
    switch (token.type) {
    // Semicolon means the subject is shared; predicate and object are different
    case ';':
      resetInversePredicate = this._inversePredicate;
      next = this._readPredicate;
      break;
    // Comma means both the subject and predicate are shared; the object is different
    case ',':
      next = this._readObject;
      break;
    // Annotation syntax applies to the quad just read, exactly as it does
    // outside of a blank node property list.  `|}` arrives here too, because
    // the objects inside the annotation block are themselves read within the
    // enclosing blank node context.
    case '~':
    case '{|':
    case '|}':
      return this._readPunctuation(token);
    default:
      return this._error(`Expected punctuation to follow "${this._object.id}"`, token);
    }
    // An annotation block consumes the subject it annotates, so there is
    // nothing left to share with a following predicate-object pair
    if (this._subject === null)
      return this._error('Expected ] to follow annotation', token);
    // A quad has been completed now, so return it
    this._emitCurrent(this._subject, this._predicate, this._object, this._graph);
    if (resetInversePredicate)
      this._inversePredicate = false;
    return next;
  }

  // ### `_readQuadPunctuation` reads punctuation after a quad
  _readQuadPunctuation(token) {
    if (token.type !== '.')
      return this._error('Expected dot to follow quad', token);
    return this._readInTopContext;
  }

  // ### `_readPrefix` reads the prefix of a prefix declaration
  _readPrefix(token) {
    if (token.type !== 'prefix')
      return this._error('Expected prefix to follow @prefix', token);
    this._prefix = token.value;
    return this._readPrefixIRI;
  }

  // ### `_readPrefixIRI` reads the IRI of a prefix declaration
  _readPrefixIRI(token) {
    if (token.type !== 'IRI')
      return this._error(`Expected IRI to follow prefix "${this._prefix}:"`, token);
    const prefixNode = this._readEntity(token);
    this._prefixes[this._prefix] = prefixNode.value;
    this._prefixCallback(this._prefix, prefixNode);
    return this._readDeclarationPunctuation;
  }

  // ### `_readBaseIRI` reads the IRI of a base declaration
  _readBaseIRI(token) {
    const iri = token.type === 'IRI' && this._resolveIRI(token.value);
    if (!iri)
      return this._error('Expected valid IRI to follow base declaration', token);
    this._setBase(iri);
    return this._readDeclarationPunctuation;
  }

  // ### `_isValidVersion` checks if the given version is valid for this parser to handle.
  _isValidVersion(version) {
    return this._parseUnsupportedVersions || N3Parser.SUPPORTED_VERSIONS.includes(version);
  }

  // ### `_readVersion` reads version string declaration
  _readVersion(token) {
    if (token.type !== 'literal')
      return this._error('Expected literal to follow version declaration', token);
    if ((token.end - token.start) !== token.value.length + 2)
      return this._error('Version declarations must use single quotes', token);
    this._versionCallback(token.value);
    if (!this._isValidVersion(token.value))
      return this._error(`Detected unsupported version: "${token.value}"`, token);
    return this._readDeclarationPunctuation;
  }

  // ### `_readNamedGraphLabel` reads the label of a named graph
  _readNamedGraphLabel(token) {
    switch (token.type) {
    case 'IRI':
    case 'blank':
    case 'prefixed':
      return this._readSubject(token), this._readGraph;
    case '[':
      return this._readNamedGraphBlankLabel;
    default:
      return this._error('Invalid graph label', token);
    }
  }

  // ### `_readNamedGraphLabel` reads a blank node label of a named graph
  _readNamedGraphBlankLabel(token) {
    if (token.type !== ']')
      return this._error('Invalid graph label', token);
    this._subject = this._factory.blankNode();
    return this._readGraph;
  }

  // ### `_readDeclarationPunctuation` reads the punctuation of a declaration
  _readDeclarationPunctuation(token) {
    // SPARQL-style declarations don't have punctuation
    if (this._sparqlStyle) {
      this._sparqlStyle = false;
      return this._getStatementReader().call(this, token);
    }

    if (token.type !== '.')
      return this._error('Expected declaration to end with a dot', token);
    return this._getStatementReader();
  }

  // Reads a list of quantified symbols from a @forSome or @forAll statement
  _readQuantifierList(token) {
    let entity;
    switch (token.type) {
    case 'IRI':
    case 'prefixed':
      if ((entity = this._readEntity(token, true)) !== undefined)
        break;
    default:
      return this._error(`Unexpected ${token.type}`, token);
    }
    // Without explicit quantifiers, map entities to a quantified entity
    if (!this._explicitQuantifiers)
      this._quantified[entity.id] = this._factory[this._quantifier](this._factory.blankNode().value);
    // With explicit quantifiers, output the reified quantifier
    else {
      // If this is the first item, start a new quantifier list
      if (this._subject === null)
        this._emit(this._graph || this.DEFAULTGRAPH, this._predicate,
                   this._subject = this._factory.blankNode(), this.QUANTIFIERS_GRAPH);
      // Otherwise, continue the previous list
      else
        this._emit(this._subject, this.RDF_REST,
                   this._subject = this._factory.blankNode(), this.QUANTIFIERS_GRAPH);
      // Output the list item
      this._emit(this._subject, this.RDF_FIRST, entity, this.QUANTIFIERS_GRAPH);
    }
    return this._readQuantifierPunctuation;
  }

  // Reads punctuation from a @forSome or @forAll statement
  _readQuantifierPunctuation(token) {
    // Read more quantifiers
    if (token.type === ',')
      return this._readQuantifierList;
    // End of the quantifier list
    else {
      // With explicit quantifiers, close the quantifier list
      if (this._explicitQuantifiers) {
        this._emit(this._subject, this.RDF_REST, this.RDF_NIL, this.QUANTIFIERS_GRAPH);
        this._subject = null;
      }
      // Read a dot
      this._readCallback = this._getContextEndReader();
      return this._readCallback(token);
    }
  }

  // ### `_getPathReader` reads a potential path and then resumes with the given function
  _getPathReader(afterPath, position) {
    this._afterPath = afterPath;
    this._pathPosition = position || (this._predicate === null ? 'subject' : 'object');
    return this._readPath;
  }

  // ### `_getPathEndReader` continues reading after a term that might start a path,
  // given the pending token that follows the term (or `null` if it was consumed)
  _getPathEndReader(token, afterPath, position) {
    // Other pending tokens are not handled here
    if (token !== null && token.type !== '!' && token.type !== '^')
      return null;
    const reader = this._getPathReader(afterPath, position);
    // If no token is pending, wait for the next one; otherwise, consume it now
    return token === null ? reader : reader.call(this, token);
  }

  // ### `_readPath` reads a potential path
  _readPath(token) {
    switch (token.type) {
    // Forward path
    case '!': return this._readForwardPath;
    // Backward path
    case '^': return this._readBackwardPath;
    // Not a path; resume reading where we left off
    default:
      const afterPath = this._afterPath;
      const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
      // If we were reading a list item, we still need to output it
      if (parent && parent.type === 'item') {
        // The list item is the remaining subejct after reading the path
        const item = this._subject;
        // Switch back to the context of the list
        this._restoreContext('item', token);
        // Output the list item
        this._emit(this._subject, this.RDF_FIRST, item, this._graph);
      }
      this._afterPath = null;
      this._pathPosition = null;
      return afterPath.call(this, token);
    }
  }

  // ### `_readForwardPath` reads a '!' path
  _readForwardPath(token) {
    let subject, predicate;
    const object = this._factory.blankNode();
    // The next token is the predicate
    if ((predicate = this._readEntity(token)) === undefined)
      return;
    // Replace the path expression with the generated object in its current position
    if (this._pathPosition === 'subject')
      subject = this._subject, this._subject = object;
    else if (this._pathPosition === 'predicate')
      subject = this._predicate, this._predicate = object;
    else
      subject = this._object,  this._object  = object;
    // Emit the path's current quad and read its next section
    this._emit(subject, predicate, object, this._graph);
    return this._readPath;
  }

  // ### `_readBackwardPath` reads a '^' path
  _readBackwardPath(token) {
    const subject = this._factory.blankNode();
    let predicate, object;
    // The next token is the predicate
    if ((predicate = this._readEntity(token)) === undefined)
      return;
    // Replace the path expression with the generated subject in its current position
    if (this._pathPosition === 'subject')
      object = this._subject, this._subject = subject;
    else if (this._pathPosition === 'predicate')
      object = this._predicate, this._predicate = subject;
    else
      object = this._object,  this._object  = subject;
    // Emit the path's current quad and read its next section
    this._emit(subject, predicate, object, this._graph);
    return this._readPath;
  }

// ### `_readTripleTermTail` reads the end of a triple term
  _readTripleTermTail(token) {
    if (token.type !== ')>>')
      return this._error(`Expected )>> but got ${token.type}`, token);
    // Read the quad and restore the previous context
    const quad = this._createQuad(this._subject, this._predicate, this._object,
        this._graph, this._inversePredicate);
    this._restoreContext('<<(', token);

    // If we're in a list, continue processing that list
    const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
    if (parent && parent.type === 'list') {
      this._emit(this._subject, this.RDF_FIRST, quad, this._graph);
      return this._getContextEndReader();
    }
    // If the triple was the subject, continue by reading the predicate.
    if (this._subject === null) {
      this._subject = quad;
      return this._readPredicate;
    }
    // If the triple was the object, read context end.
    else {
      this._object = quad;
      return this._getContextEndReader();
    }
  }

  // ### `_readReifiedTripleTailOrReifier` reads a reifier or the end of a nested reified triple
  _readReifiedTripleTailOrReifier(token) {
    if (token.type === '~') {
      return this._readReifier;
    }
    return this._readReifiedTripleTail(token);
  }

  // ### `_readReifiedTripleTail` reads the end of a nested reified triple
  _readReifiedTripleTail(token) {
    if (token.type !== '>>')
      return this._error(`Expected >> but got ${token.type}`, token);
    // Read the triple term and restore the previous context
    this._tripleTerm = null;
    const reifier = this._readTripleTerm();
    this._restoreContext('<<', token);

    // // If we're in a list, continue processing that list
    const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
    if (parent && parent.type === 'list') {
      this._emit(this._subject, this.RDF_FIRST, reifier, this._graph);
      return this._getContextEndReader();
    }
    // If the triple was the subject, continue by reading the predicate.
    else if (this._subject === null) {
      this._subject = reifier;
      return this._readPredicateOrReifierTripleEnd;
    }
    // If the triple was the object, read context end.
    else {
      this._object = reifier;
      return this._getContextEndReader();
    }
  }

  _readPredicateOrReifierTripleEnd(token) {
    if (token.type === '.') {
      this._subject = null;
      return this._readPunctuation(token);
    }
    return this._readPredicate(token);
  }

  // ### `_readReifier` reads the triple term identifier after a tilde when in a reifying triple.
  _readReifier(token) {
    this._reifier = this._readEntity(token);
    return this._readReifiedTripleTail;
  }

  // ### `_readReifier` reads the optional triple term identifier after a tilde when in annotation syntax.
  _readReifierInAnnotation(token) {
    // If next token is a reifier, read it as such.
    if (token.type === 'IRI' || token.type === 'typeIRI' || token.type === 'type' || token.type === 'prefixed' || token.type === 'blank' || token.type === 'var') {
      this._reifier = this._readEntity(token);
      return this._readAnnotationBlockOrPunctuation;
    }
    // Otherwise, emit and assert triple term.
    this._readTripleTerm();
    this._subject = null;
    return this._getContextEndReader().call(this, token);
  }

  // ### `_readAnnotationBlockOrPunctuation` reads what follows an explicit reifier:
  // either an annotation block, which reuses the reifier as its subject,
  // or punctuation, in which case the reifier stands alone and its triple
  // term still needs to be asserted here.
  _readAnnotationBlockOrPunctuation(token) {
    if (token.type === '{|')
      return this._readPunctuation(token);

    this._readTripleTerm();
    this._annotation = false;
    // A shared subject or predicate goes on to reify a *different* triple,
    // so the term just asserted must not be reused for the next one.
    this._tripleTerm = null;
    // The annotated triple was already emitted when the tilde was read,
    // so continue without letting `_readPunctuation` emit it a second time.
    switch (token.type) {
    // The subject stays shared with the next predicate-object pair
    case ';':
      this._inversePredicate = false;
      return this._readPredicate;
    // The subject and predicate stay shared with the next object
    case ',':
      return this._readObject;
    default:
      this._subject = null;
      // Resume in the enclosing context, which is top-level punctuation
      // unless the reified triple sits inside a blank node property list
      return this._getContextEndReader().call(this, token);
    }
  }

  _readTripleTerm() {
    const stack = this._contextStack, parent = stack.length && stack[stack.length - 1];
    const parentGraph = parent ? parent.graph : undefined;
    const reifier = this._reifier || this._factory.blankNode();
    this._reifier = null;
    this._tripleTerm = this._tripleTerm || this._createQuad(
      this._subject, this._predicate, this._object, null, this._inversePredicate,
    );
    this._emit(reifier, this.RDF_REIFIES, this._tripleTerm, parentGraph || this._graph || this.DEFAULTGRAPH);
    return reifier;
  }

  // ### `_getContextEndReader` gets the next reader function at the end of a context
  _getContextEndReader() {
    const contextStack = this._contextStack;
    if (!contextStack.length)
      return this._readPunctuation;

    switch (contextStack[contextStack.length - 1].type) {
    case 'blank':
      return this._readBlankNodeTail;
    case 'list':
      return this._readListItem;
    case 'formula':
      return this._readFormulaTail;
    case '<<(':
      return this._readTripleTermTail;
    case '<<':
      return this._readReifiedTripleTailOrReifier;
    }
  }

  // ### `_createQuad` creates a quad
  _createQuad(subject, predicate, object, graph) {
    return this._factory.quad(subject, predicate, object, graph || this.DEFAULTGRAPH);
  }

  // ### `_createQuadInDirection` creates a quad in the active predicate direction
  _createQuadInDirection(subject, predicate, object, graph, inversePredicate) {
    return inversePredicate ?
      this._factory.quad(object, predicate, subject, graph || this.DEFAULTGRAPH) :
      this._factory.quad(subject, predicate, object, graph || this.DEFAULTGRAPH);
  }

  // ### `_emitInDirection` sends a quad in the active predicate direction
  _emitInDirection(subject, predicate, object, graph, inversePredicate) {
    this._callback(null, this._createQuad(subject, predicate, object, graph, inversePredicate));
  }

  // ### `_emitCurrentInDirection` sends a quad in the current predicate direction
  _emitCurrentInDirection(subject, predicate, object, graph) {
    this._callback(null, this._createQuad(subject, predicate, object, graph, this._inversePredicate));
  }

  // ### `_emit` sends a quad through the callback
  _emit(subject, predicate, object, graph) {
    this._callback(null, this._factory.quad(subject, predicate, object, graph || this.DEFAULTGRAPH));
  }

  // ### `_error` emits an error message through the callback
  _error(message, token) {
    // Bound input-derived content while preserving the line suffix and full token context.
    const suffix = ` on line ${token.line}.`;
    if (message.length + suffix.length > 200)
      message = `${message.slice(0, 199 - suffix.length)}…`;
    const err = new Error(`${message}${suffix}`);
    err.context = {
      token: token,
      line: token.line,
      previousToken: this._lexer.previousToken,
    };
    this._callback(err);
    this._callback = noop;
  }

  // ### `_resolveIRI` resolves an IRI against the base path
  _resolveIRI(iri) {
    return /^[a-z][a-z0-9+.-]*:/i.test(iri) ? iri : this._resolveRelativeIRI(iri);
  }

  // ### `_resolveRelativeIRI` resolves an IRI against the base path,
  // assuming that a base path has been set and that the IRI is indeed relative
  _resolveRelativeIRI(iri) {
    // An empty relative IRI indicates the base IRI
    if (!iri.length)
      return this._base;
    // Decide resolving strategy based in the first character
    switch (iri[0]) {
    // Resolve relative fragment IRIs against the base IRI
    case '#': return this._base + iri;
    // Resolve relative query string IRIs by replacing the query string
    case '?': return this._base.replace(/(?:\?.*)?$/, iri);
    // Resolve root-relative IRIs at the root of the base IRI
    case '/':
      // Resolve scheme-relative IRIs to the scheme
      return (iri[1] === '/' ? this._baseScheme : this._baseRoot) + this._removeDotSegments(iri);
    // Resolve all other IRIs at the base IRI's path
    default:
      // Relative IRIs cannot contain a colon in the first path segment
      return (/^[^/:]*:/.test(iri)) ? null : this._removeDotSegments(this._basePath + iri);
    }
  }

  // ### `_removeDotSegments` resolves './' and '../' path segments in an IRI as per RFC3986
  _removeDotSegments(iri) {
    // Don't modify the IRI if it does not contain any dot segments
    if (!/(^|\/)\.\.?($|[/#?])/.test(iri))
      return iri;

    // Start with an imaginary slash before the IRI in order to resolve trailing './' and '../'
    const length = iri.length;
    let result = '', i = -1, pathStart = -1, segmentStart = 0, next = '/';

    while (i < length) {
      switch (next) {
      // The path starts with the first slash after the authority
      case ':':
        if (pathStart < 0) {
          // Skip two slashes before the authority
          if (iri[++i] === '/' && iri[++i] === '/')
            // Skip to slash after the authority
            while ((pathStart = i + 1) < length && iri[pathStart] !== '/')
              i = pathStart;
        }
        break;
      // Don't modify a query string or fragment
      case '?':
      case '#':
        i = length;
        break;
      // Handle '/.' or '/..' path segments
      case '/':
        if (iri[i + 1] === '.') {
          next = iri[++i + 1];
          switch (next) {
          // Remove a '/.' segment
          case '/':
            result += iri.substring(segmentStart, i - 1);
            segmentStart = i + 1;
            break;
          // Remove a trailing '/.' segment
          case undefined:
          case '?':
          case '#':
            return result + iri.substring(segmentStart, i) + iri.substr(i + 1);
          // Remove a '/..' segment
          case '.':
            next = iri[++i + 1];
            if (next === undefined || next === '/' || next === '?' || next === '#') {
              result += iri.substring(segmentStart, i - 2);
              // Try to remove the parent path from result
              if ((segmentStart = result.lastIndexOf('/')) >= pathStart)
                result = result.substr(0, segmentStart);
              // Remove a trailing '/..' segment
              if (next !== '/')
                return `${result}/${iri.substr(i + 1)}`;
              segmentStart = i + 1;
            }
          }
        }
      }
      next = iri[++i];
    }
    return result + iri.substring(segmentStart);
  }

  // ## Public methods

  // ### `parse` parses the N3 input and emits each parsed quad through the onQuad callback.
  parse(input, quadCallback, prefixCallback, versionCallback) {
    // The second parameter also accepts an object of named callbacks.
    // As a second and third parameter it still accepts a separate quadCallback and prefixCallback for backward compatibility as well
    let onQuad, onPrefix, onComment, onVersion, onToken, onTokenEnd;
    if (quadCallback && (quadCallback.onQuad || quadCallback.onPrefix || quadCallback.onComment || quadCallback.onVersion ||
                         quadCallback.onToken || quadCallback.onTokenEnd)) {
      onQuad = quadCallback.onQuad;
      onPrefix = quadCallback.onPrefix;
      onComment = quadCallback.onComment;
      onVersion = quadCallback.onVersion;
      onToken = quadCallback.onToken;
      onTokenEnd = quadCallback.onTokenEnd;
    }
    else {
      onQuad = quadCallback;
      onPrefix = prefixCallback;
      onVersion = versionCallback;
    }
    // The read callback is the next function to be executed when a token arrives.
    // We start reading in the top context.
    this._readCallback = this._readBeforeTopContext;
    this._sparqlStyle = false;
    this._prefixes = Object.create(null);
    this._prefixes._ = this._blankNodePrefix ? this._blankNodePrefix.substr(2)
                                             : `b${blankNodePrefix++}_`;
    // Optionally bind the N3 empty prefix to the document's local namespace
    if (this._n3Mode && this._implicitEmptyPrefix && this._base)
      this._prefixes[''] = this._resolveIRI('#');
    this._prefixCallback = onPrefix || noop;
    this._versionCallback = onVersion || noop;
    this._inversePredicate = false;
    this._expectOf = false;
    this._quantified = Object.create(null);
    this._emptyFormula = false;

    let readToken = token => {
      return this._readCallback = this._readCallback(token);
    };

    // Comments bypass the grammar, but participate in the token lifecycle.
    if (onComment || this._lexer.comments) {
      this._lexer.comments = true;
      const readGrammarToken = readToken;
      readToken = token => {
        if (token.type !== 'comment')
          return readGrammarToken(token);
        if (onComment) onComment(token.value);
        return this._readCallback;
      };
    }

    // Install observers once per parse, leaving the ordinary token path intact.
    if (onToken || onTokenEnd) {
      const consumeToken = readToken;
      readToken = token => {
        try {
          try {
            if (onToken) onToken(token);
            return consumeToken(token);
          }
          finally {
            if (onTokenEnd) onTokenEnd(token);
          }
        }
        catch (error) {
          // A consumer exception aborts this parse, including later chunks.
          this._readCallback = null;
          throw error;
        }
      };
    }

    // Parse synchronously if no quad callback is given.
    if (!onQuad) {
      const quads = [];
      let error;
      this._callback = (e, t) => { e ? (error = e) : t && quads.push(t); };
      this._lexer.tokenize(input).every(readToken);
      if (error) throw error;
      return quads;
    }

    const processNextToken = (error, token) => {
      if (error !== null)
        this._callback(error), this._callback = noop;
      else if (this._readCallback)
        readToken(token);
    };

    // Parse asynchronously otherwise, executing the read callback when a token arrives
    this._callback = onQuad;
    this._lexer.tokenize(input, processNextToken);
  }
}

// The empty function
function noop() {}

// Initializes the parser with the given data factory
function initDataFactory(parser, factory) {
  parser._factory = factory;

  parser.DEFAULTGRAPH = factory.defaultGraph();

  // Set common named nodes
  parser.RDF_FIRST   = factory.namedNode(namespaces.rdf.first);
  parser.RDF_REST    = factory.namedNode(namespaces.rdf.rest);
  parser.RDF_NIL     = factory.namedNode(namespaces.rdf.nil);
  parser.RDF_REIFIES = factory.namedNode(namespaces.rdf.reifies);
  parser.N3_FORALL   = factory.namedNode(namespaces.r.forAll);
  parser.N3_FORSOME  = factory.namedNode(namespaces.r.forSome);
  parser.N3_TRUE     = factory.literal('true', factory.namedNode(namespaces.xsd.boolean));
  parser.ABBREVIATIONS = {
    'a': factory.namedNode(namespaces.rdf.type),
    '=': factory.namedNode(namespaces.owl.sameAs),
    '>': factory.namedNode(namespaces.log.implies),
    '<': factory.namedNode(namespaces.log.isImpliedBy),
  };
  parser.QUANTIFIERS_GRAPH = factory.namedNode('urn:n3:quantifiers');
}
N3Parser.SUPPORTED_VERSIONS = [
  '1.2',
  '1.2-basic',
  '1.1',
];
initDataFactory(N3Parser.prototype, N3DataFactory);
