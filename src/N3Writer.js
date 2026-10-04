// **N3Writer** writes N3 documents.
import namespaces from './IRIs';
import { default as N3DataFactory, Term } from './N3DataFactory';
import { isDefaultGraph } from './N3Util';
import BaseIRI from './BaseIRI';
import { escapeRegex } from './Util';

const DEFAULTGRAPH = N3DataFactory.defaultGraph();

const { rdf, xsd } = namespaces;
const { hasOwnProperty } = Object.prototype;

// Characters that require escaping in Turtle, TriG, and N3,
// where characters outside the Basic Multilingual Plane are escaped as well
const escape    = /["\\\t\n\r\b\f\u0000-\u0019\ud800-\udbff]/,
    escapeAll = /["\\\t\n\r\b\f\u0000-\u0019]|[\ud800-\udbff][\udc00-\udfff]/g,
    // Characters that require escaping in canonical N-Triples and N-Quads:
    // U+0000–U+001F, `"`, `\`, U+007F, U+FFFE, and U+FFFF.
    // A negated class is as fast to test as a shorter class listing characters.
    canonicalEscape    = /[^ !#-\[\]-~\u0080-\uFFFD]/,
    canonicalEscapeAll = /[^ !#-\[\]-~\u0080-\uFFFD]/g,
    escapedCharacters = {
      '\\': '\\\\', '"': '\\"', '\t': '\\t',
      '\n': '\\n', '\r': '\\r', '\b': '\\b', '\f': '\\f',
    };

// ## Placeholder class to represent already pretty-printed terms
class SerializedTerm extends Term {
  // Pretty-printed nodes are not equal to any other node
  // (e.g., [] does not equal [])
  equals(other) {
    return other === this;
  }
}

// Identifies named terms by value, and other terms such as pretty-printed nodes by identity
function termKey(term) {
  return term.termType === 'NamedNode' || term.termType === 'BlankNode' || term.termType === 'Variable' ?
         `${term.termType} ${term.value}` : term;
}

// ## Constructor
export default class N3Writer {
  constructor(outputStream, options) {
    // ### `_prefixRegex` matches a prefixed name or IRI that begins with one of the added prefixes
    this._prefixRegex = /$0^/;
    this._hasPrefixes = false;

    // Shift arguments if the first argument is not a stream
    if (outputStream && typeof outputStream.write !== 'function')
      options = outputStream, outputStream = null;
    options = options || {};
    this._lists = options.lists;
    this._formulas = options.formulas;
    this._openFormulas = new Set();
    this._formulaCache = null;
    // Statements with formulas are held back until the end, to group them by formula
    this._formulaStatements = this._formulas ? [] : null;

    // If no output stream given, send the output as string through the end callback
    if (!outputStream) {
      let output = '';
      this._outputStream = {
        write(chunk, encoding, done) { output += chunk; done && done(); },
        end: done => { done && done(null, output); },
      };
      this._endStream = true;
    }
    else {
      this._outputStream = outputStream;
      this._endStream = options.end === undefined ? true : !!options.end;
    }

    // Initialize writer, depending on the format
    this._subject = null;
    if (!(/triple|quad/i).test(options.format)) {
      this._lineMode = false;
      this._escape = escape, this._escapeAll = escapeAll, this._characterReplacer = characterReplacer;
      this._graph = DEFAULTGRAPH;
      this._prefixIRIs = Object.create(null);
      // Escaped prefix IRIs and names for the prefix matcher, computed once per prefix
      this._prefixPatterns = Object.create(null);
      if (options.baseIRI) {
        this._baseIri = new BaseIRI(options.baseIRI);
        if (options.writeBase)
          this._write(`@base <${options.baseIRI}>.\n`);
      }
      options.prefixes && this.addPrefixes(options.prefixes);
    }
    else {
      this._lineMode = true;
      this._writeQuad = this._writeQuadLine;
      // N-Triples and N-Quads are written in their canonical form
      this._escape = canonicalEscape, this._escapeAll = canonicalEscapeAll;
      this._characterReplacer = canonicalCharacterReplacer;
    }
  }

  // ## Private methods

  // ### Whether the current graph is the default graph
  get _inDefaultGraph() {
    return DEFAULTGRAPH.equals(this._graph);
  }

  // ### `_write` writes the argument to the output stream
  _write(string, callback) {
    this._outputStream.write(string, 'utf8', callback);
  }

  // ### `_writeQuad` writes the quad to the output stream
  _writeQuad(subject, predicate, object, graph, done) {
    if (this._formulaStatements && DEFAULTGRAPH.equals(graph) &&
        (this._isFormula(subject) || this._isFormula(predicate) || this._isFormula(object))) {
      this._formulaStatements.push({ subject, predicate, object });
      done && done();
      return;
    }
    try {
      // Write the graph's label if it has changed
      // (the id-based fast path of `equals` would conflate
      // the empty named node `<>` with the default graph)
      if (graph !== this._graph &&
          (!graph.equals(this._graph) || graph.termType !== this._graph.termType)) {
        // Close the previous graph and start the new one
        this._write((this._subject === null ? '' : (this._inDefaultGraph ? '.\n' : '\n}\n')) +
                    (DEFAULTGRAPH.equals(graph) ? '' : `${this._encodeIriOrBlank(graph)} {\n`));
        this._graph = graph;
        this._subject = null;
      }
      // Don't repeat the subject if it's the same
      if (subject === this._subject || subject.equals(this._subject)) {
        // Don't repeat the predicate if it's the same
        if (predicate === this._predicate || predicate.equals(this._predicate))
          this._write(`, ${this._encodeObject(object)}`, done);
        // Same subject, different predicate
        else
          this._write(`;\n    ${
                      this._encodePredicate(this._predicate = predicate)} ${
                      this._encodeObject(object)}`, done);
      }
      // Different subject; write the whole quad
      else
        this._write(`${(this._subject === null ? '' : '.\n') +
                    this._encodeSubject(this._subject = subject)} ${
                    this._encodePredicate(this._predicate = predicate)} ${
                    this._encodeObject(object)}`, done);
    }
    catch (error) { done && done(error); }
  }

  // ### `_writeQuadLine` writes the quad to the output stream as a single line
  _writeQuadLine(subject, predicate, object, graph, done) {
    // Write the quad without prefixes
    delete this._prefixMatch;
    this._write(this.quadToString(subject, predicate, object, graph), done);
  }

  // ### `quadToString` serializes a quad as a string
  quadToString(subject, predicate, object, graph) {
    return  `${this._encodeSubject(subject)} ${
            predicate.termType === 'Literal' ?
              this._encodeLiteral(predicate) : this._encodeIriOrBlank(predicate)} ${
            this._encodeObject(object)
            }${graph && !isDefaultGraph(graph) ? ` ${this._encodeIriOrBlank(graph)} .\n` : ' .\n'}`;
  }

  // ### `quadsToString` serializes an array of quads as a string
  quadsToString(quads) {
    let quadsString = '';
    for (const quad of quads)
      quadsString += this.quadToString(quad.subject, quad.predicate, quad.object, quad.graph);
    return quadsString;
  }

  // ### `_isFormula` checks whether the term is a blank node labelling a given formula
  _isFormula(term) {
    return !!this._formulas && term.termType === 'BlankNode' && hasOwnProperty.call(this._formulas, term.value);
  }

  // ### `_findFormulas` lists the labels of the formulas in the quads, including inside lists
  _findFormulas(quads) {
    const formulas = [], terms = [];
    for (const quad of quads)
      terms.push(quad.object, quad.predicate, quad.subject);
    while (terms.length) {
      const term = terms.pop();
      if (this._lists && term.termType !== 'NamedNode' && (term.value in this._lists))
        terms.push(...this._lists[term.value].slice().reverse());
      else if (this._isFormula(term))
        formulas.push(term.value);
    }
    return formulas;
  }

  // ### `_encodeFormula` serializes the formula with the given label.
  // Nested formulas are serialized first, depth-first with an explicit stack,
  // so deeply nested formulas do not exhaust the call stack.
  _encodeFormula(label) {
    const owner = !this._formulaCache, frames = [{ label, position: 0 }];
    const cache = this._formulaCache || (this._formulaCache = new Map());
    this._openFormulas.add(label);
    try {
      while (frames.length) {
        const frame = frames[frames.length - 1], quads = this._formulas[frame.label];
        // Find the next nested formula that is not serialized yet
        frame.nested = frame.nested || this._findFormulas(quads);
        let nested = null;
        while (!nested && frame.position < frame.nested.length) {
          const candidate = frame.nested[frame.position++];
          if (!this._openFormulas.has(candidate) && !cache.has(candidate))
            nested = candidate;
        }
        if (nested) {
          this._openFormulas.add(nested);
          frames.push({ label: nested, position: 0 });
        }
        else {
          cache.set(frame.label, this.formula(quads));
          this._openFormulas.delete(frame.label);
          frames.pop();
        }
      }
      return cache.get(label);
    }
    finally {
      if (owner) {
        this._formulaCache = null;
        this._openFormulas.clear();
      }
    }
  }

  // ### `_encodeSubject` represents a subject
  _encodeSubject(entity) {
    switch (entity.termType) {
    case 'Quad':
      return this._encodeQuad(entity);
    // Literal subjects are only valid in N3
    case 'Literal':
      return this._encodeLiteral(entity);
    default:
      return this._encodeIriOrBlank(entity);
    }
  }

  // ### `_encodeIriOrBlank` represents an IRI or blank node
  _encodeIriOrBlank(entity) {
    // A blank node or list is represented as-is
    if (entity.termType !== 'NamedNode') {
      // If it is a list head, pretty-print it
      if (this._lists && (entity.value in this._lists))
        entity = this.list(this._lists[entity.value]);
      // If it labels an N3 formula, write the formula's contents,
      // unless that formula is already being written, which would never end
      else if (this._isFormula(entity) && !this._openFormulas.has(entity.value))
        entity = this._formulaCache && this._formulaCache.get(entity.value) || this._encodeFormula(entity.value);
      // Terms from this library already hold their serialization as id
      if (entity instanceof Term)
        return entity.id;
      return entity.termType === 'Variable' ? `?${entity.value}` : `_:${entity.value}`;
    }
    let iri = entity.value;
    // Use relative IRIs if requested and possible
    if (this._baseIri) {
      iri = this._baseIri.toRelative(iri);
    }
    // Escape special characters
    if (this._escape.test(iri))
      iri = iri.replace(this._escapeAll, this._characterReplacer);
    // Try to represent the IRI as prefixed name, unless no prefixes were added
    const prefixMatch = this._hasPrefixes ? (this._prefixRegex || this._createPrefixRegex()).exec(iri) : null;
    return !prefixMatch ? `<${iri}>` :
           (!prefixMatch[1] ? iri : this._prefixIRIs[prefixMatch[1]] + prefixMatch[2]);
  }

  // ### `_encodeLiteral` represents a literal
  _encodeLiteral(literal) {
    // Escape special characters
    let value = literal.value;
    if (this._escape.test(value))
      value = value.replace(this._escapeAll, this._characterReplacer);

    // Write a language-tagged literal
    const language = literal.language;
    if (language) {
      const literalDirection = literal.direction;
      const direction = literalDirection ? `--${literalDirection}` : '';
      return `"${value}"@${language}${direction}`;
    }

    // Write dedicated literals per data type
    if (this._lineMode) {
      // Only abbreviate strings in N-Triples or N-Quads
      if (literal.datatype.value === xsd.string)
        return `"${value}"`;
    }
    else {
      // Use common datatype abbreviations in Turtle or TriG
      switch (literal.datatype.value) {
      case xsd.string:
        return `"${value}"`;
      case xsd.boolean:
        if (value === 'true' || value === 'false')
          return value;
        break;
      case xsd.integer:
        if (/^[+-]?\d+$/.test(value))
          return value;
        break;
      case xsd.decimal:
        if (/^[+-]?\d*\.\d+$/.test(value))
          return value;
        break;
      case xsd.double:
        if (/^[+-]?(?:\d+\.\d*|\.?\d+)[eE][+-]?\d+$/.test(value))
          return value;
        break;
      }
    }

    // Write a regular datatyped literal
    return `"${value}"^^${this._encodeIriOrBlank(literal.datatype)}`;
  }

  // ### `_encodePredicate` represents a predicate
  _encodePredicate(predicate) {
    switch (predicate.termType) {
    case 'NamedNode':
      return predicate.value === rdf.type ? 'a' : this._encodeIriOrBlank(predicate);
    // Literal predicates are only valid in N3
    case 'Literal':
      return this._encodeLiteral(predicate);
    default:
      return this._encodeIriOrBlank(predicate);
    }
  }

  // ### `_encodeObject` represents an object
  _encodeObject(object) {
    switch (object.termType) {
    case 'Quad':
      return this._encodeQuad(object);
    case 'Literal':
      return this._encodeLiteral(object);
    default:
      return this._encodeIriOrBlank(object);
    }
  }

  // ### `_encodeQuad` encodes an RDF-star quad
  _encodeQuad({ subject, predicate, object, graph }) {
    // Canonical N-Triples and N-Quads put spaces inside the delimiters
    const space = this._lineMode ? ' ' : '';
    return `<<(${space}${
      this._encodeSubject(subject)} ${
      this._encodePredicate(predicate)} ${
      this._encodeObject(object)}${
      isDefaultGraph(graph) ? '' : ` ${this._encodeIriOrBlank(graph)}`}${space})>>`;
  }

  // ### `_blockedWrite` replaces `_write` after the writer has been closed
  _blockedWrite() {
    throw new Error('Cannot write because the writer has been closed.');
  }

  // ### `addQuad` adds the quad to the output stream
  addQuad(subject, predicate, object, graph, done) {
    // The quad was given as an object, so shift parameters
    if (object === undefined)
      this._writeQuad(subject.subject, subject.predicate, subject.object, subject.graph, predicate);
    // The optional `graph` parameter was not provided
    else if (typeof graph === 'function')
      this._writeQuad(subject, predicate, object, DEFAULTGRAPH, graph);
    // The `graph` parameter was provided
    else
      this._writeQuad(subject, predicate, object, graph || DEFAULTGRAPH, done);
  }

  // ### `addQuads` adds the quads to the output stream
  addQuads(quads) {
    for (let i = 0; i < quads.length; i++)
      this.addQuad(quads[i]);
  }

  // ### `addPrefix` adds the prefix to the output stream
  addPrefix(prefix, iri, done) {
    const prefixes = {};
    prefixes[prefix] = iri;
    this.addPrefixes(prefixes, done);
  }

  // ### `addPrefixes` adds the prefixes to the output stream
  addPrefixes(prefixes, done) {
    // Ignore prefixes if not supported by the serialization
    if (!this._prefixIRIs)
      return done && done();

    // Write all new prefixes
    let hasPrefixes = false;
    for (let prefix in prefixes) {
      let iri = prefixes[prefix];
      if (typeof iri !== 'string')
        iri = iri.value;
      hasPrefixes = true;
      // Finish a possible pending quad
      if (this._subject !== null) {
        this._write(this._inDefaultGraph ? '.\n' : '\n}\n');
        this._subject = null, this._graph = '';
      }
      // Store and write the prefix
      this._prefixIRIs[iri] = (prefix += ':');
      this._prefixPatterns[iri] = [escapeRegex(iri), escapeRegex(prefix)];
      this._write(`@prefix ${prefix} <${iri}>.\n`);
    }
    // Recreate the prefix matcher when it is next needed, so that adding
    // prefixes one by one does not rebuild it for every prefix
    if (hasPrefixes) {
      this._hasPrefixes = true;
      this._prefixRegex = null;
    }
    // End a prefix block with a newline
    this._write(hasPrefixes ? '\n' : '', done);
  }

  // ### `_createPrefixRegex` creates the matcher for the current prefixes
  _createPrefixRegex() {
    let IRIlist = '', prefixList = '';
    for (const prefixIRI in this._prefixPatterns) {
      const [IRIpattern, prefixPattern] = this._prefixPatterns[prefixIRI];
      IRIlist += IRIlist ? `|${IRIpattern}` : IRIpattern;
      prefixList += prefixList ? `|${prefixPattern}` : prefixPattern;
    }
    return this._prefixRegex = new RegExp(`^(?:${prefixList})[^/]*$|` +
                                          `^(${IRIlist})([_a-zA-Z0-9](?:\\.?[\\-_a-zA-Z0-9])*)$`);
  }

  // ### `blank` creates a blank node with the given content
  blank(predicate, object) {
    let children = predicate, child, length;
    // Empty blank node
    if (predicate === undefined)
      children = [];
    // Blank node passed as blank(Term("predicate"), Term("object"))
    else if (predicate.termType)
      children = [{ predicate: predicate, object: object }];
    // Blank node passed as blank({ predicate: predicate, object: object })
    else if (!('length' in predicate))
      children = [predicate];

    switch (length = children.length) {
    // Generate an empty blank node
    case 0:
      return new SerializedTerm('[]');
    // Generate a non-nested one-triple blank node
    case 1:
      child = children[0];
      if (!(child.object instanceof SerializedTerm))
        return new SerializedTerm(`[ ${this._encodePredicate(child.predicate)} ${
                                  this._encodeObject(child.object)} ]`);
    // Generate a multi-triple or nested blank node
    default:
      let contents = '[';
      // Write all triples in order
      for (let i = 0; i < length; i++) {
        child = children[i];
        // Write only the object is the predicate is the same as the previous
        if (child.predicate.equals(predicate))
          contents += `, ${this._encodeObject(child.object)}`;
        // Otherwise, write the predicate and the object
        else {
          contents += `${(i ? ';\n  ' : '\n  ') +
                      this._encodePredicate(child.predicate)} ${
                      this._encodeObject(child.object)}`;
          predicate = child.predicate;
        }
      }
      return new SerializedTerm(`${contents}\n]`);
    }
  }

  // ### `list` creates a list node with the given content
  list(elements) {
    const length = elements && elements.length || 0, contents = new Array(length);
    for (let i = 0; i < length; i++)
      contents[i] = this._encodeObject(elements[i]);
    return new SerializedTerm(`(${contents.join(' ')})`);
  }

  // ### `formula` creates an N3 formula with the given quads
  formula(quads) {
    const statements = this._encodeStatements(quads || []);
    return new SerializedTerm(statements.length ? `{ ${statements.join('. ')} }` : '{}');
  }

  // ### `_encodeStatements` serializes N3 statements, so that every formula is written once.
  // A formula that occurs more than once becomes the subject of its statements,
  // using inverse `is … of` verbs where it is their object,
  // or the verb shared by a list of objects (or of subjects, with an inverse verb).
  _encodeStatements(quads) {
    const occurrences = new Map(), formulaVerbSubjects = new Map(), statements = new Map();
    for (const label of this._findFormulas(quads))
      occurrences.set(label, occurrences.has(label));
    const isShared = term => this._isFormula(term) && occurrences.get(term.value);
    for (const { subject, predicate } of quads) {
      if (isShared(predicate)) {
        const subjects = formulaVerbSubjects.get(predicate.value);
        formulaVerbSubjects.set(predicate.value, subjects === undefined ? termKey(subject) :
                                                 subjects === termKey(subject) && subjects);
      }
    }
    for (const { subject, predicate, object } of quads) {
      const inverse = !isShared(subject) && (isShared(object) ||
                      isShared(predicate) && formulaVerbSubjects.get(predicate.value) === false);
      const head = inverse ? object : subject, headKey = termKey(head);
      let statement = statements.get(headKey);
      if (!statement)
        statements.set(headKey, statement = { head: this._encodeSubject(head), verbs: [new Map(), new Map()] });
      const verbs = statement.verbs[inverse ? 1 : 0], verbKey = termKey(predicate);
      let verb = verbs.get(verbKey);
      if (!verb) {
        verb = this._encodePredicate(predicate);
        if (inverse)
          verb = `is ${verb === 'a' ? this._encodeIriOrBlank(predicate) : verb} of`;
        verbs.set(verbKey, verb = { verb, terms: [] });
      }
      verb.terms.push(inverse ? this._encodeSubject(subject) : this._encodeObject(object));
    }
    const result = [];
    for (const { head, verbs } of statements.values()) {
      const parts = [];
      for (const { verb, terms } of [...verbs[0].values(), ...verbs[1].values()])
        parts.push(`${verb} ${terms.join(', ')}`);
      result.push(`${head} ${parts.join('; ')}`);
    }
    return result;
  }

  // ### `end` signals the end of the output stream
  end(done) {
    // Finish a possible pending quad
    if (this._subject !== null) {
      this._write(this._inDefaultGraph ? '.\n' : '\n}\n');
      this._subject = null;
    }
    // Write the statements with formulas, which were held back
    const formulaStatements = this._formulaStatements;
    this._formulaStatements = null;
    if (formulaStatements && formulaStatements.length)
      this._write(`${this._encodeStatements(formulaStatements).join('.\n')}.\n`);
    // Disallow further writing
    this._write = this._blockedWrite;

    // Try to end the underlying stream, ensuring done is called exactly one time
    let singleDone = done && ((error, result) => { singleDone = null, done(error, result); });
    if (this._endStream) {
      try { return this._outputStream.end(singleDone); }
      catch (error) { /* error closing stream */ }
    }
    singleDone && singleDone();
  }
}

// Replaces a character by its escaped version
function characterReplacer(character) {
  // Replace a single character by its escaped version
  let result = escapedCharacters[character];
  if (result === undefined) {
    // Replace a single character with its 4-bit unicode escape sequence
    if (character.length === 1) {
      result = character.charCodeAt(0).toString(16);
      result = '\\u0000'.substr(0, 6 - result.length) + result;
    }
    // Replace a surrogate pair with its 8-bit unicode escape sequence
    else {
      result = ((character.charCodeAt(0) - 0xD800) * 0x400 +
                 character.charCodeAt(1) + 0x2400).toString(16);
      result = '\\U00000000'.substr(0, 10 - result.length) + result;
    }
  }
  return result;
}

// Replaces a character by its canonical N-Triples escape:
// a short escape where one exists, and an upper-case `\uXXXX` escape otherwise
function canonicalCharacterReplacer(character) {
  let result = escapedCharacters[character];
  if (result === undefined) {
    result = character.charCodeAt(0).toString(16).toUpperCase();
    result = '\\u0000'.substr(0, 6 - result.length) + result;
  }
  return result;
}
