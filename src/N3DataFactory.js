// N3.js implementations of the RDF/JS core data types
// See https://github.com/rdfjs/representation-task-force/blob/master/interface-spec.md

import namespaces from './IRIs';
import { isDefaultGraph } from './N3Util';
const { rdf, xsd } = namespaces;

let DEFAULTGRAPH;
let _blankNodeCounter = 0;

// ## DataFactory singleton
const DataFactory = {
  namedNode,
  blankNode,
  variable,
  literal,
  defaultGraph,
  quad,
  triple: quad,
  quadTerm: quadTerm,
};
export default DataFactory;

// ## Term constructor
export class Term {
  constructor(id) {
    this.id = id;
  }

  // ### The value of this term
  get value() {
    return this.id;
  }

  // ### Returns whether this object represents the same term as the other
  equals(other) {
    // If both terms were created by this library,
    // equality can be computed through ids
    if (other instanceof Term)
      return this.id === other.id;
    // Otherwise, compare term type and value
    return !!other && this.termType === other.termType &&
                      this.value    === other.value;
  }

  // ### Returns a plain object representation of this term
  toJSON() {
    return {
      termType: this.termType,
      value:    this.value,
    };
  }
}


// ## NamedNode constructor
export class NamedNode extends Term {
  // ### The term type of this term
  get termType() {
    return 'NamedNode';
  }
}

// ## Literal constructor
export class Literal extends Term {
  // ### The term type of this term
  get termType() {
    return 'Literal';
  }

  // ### The text value of this literal
  get value() {
    return this.id.substring(1, this.id.lastIndexOf('"'));
  }

  // ### The language of this literal
  get language() {
    // Find the last quotation mark (e.g., '"abc"@en-us')
    var id = this.id, atPos = id.lastIndexOf('"') + 1;
    // If "@" it follows, return the remaining substring; empty otherwise
    return atPos < id.length && id[atPos++] === '@' ? id.substr(atPos).toLowerCase() : '';
  }

  // ### The datatype IRI of this literal
  get datatype() {
    return new NamedNode(this.datatypeString);
  }

  // ### The datatype string of this literal
  get datatypeString() {
    // Find the last quotation mark (e.g., '"abc"^^http://ex.org/types#t')
    var id = this.id, dtPos = id.lastIndexOf('"') + 1, ch;
    // If "^" it follows, return the remaining substring
    return dtPos < id.length && (ch = id[dtPos]) === '^' ? id.substr(dtPos + 2) :
           // If "@" follows, return rdf:langString; xsd:string otherwise
           (ch !== '@' ? xsd.string : rdf.langString);
  }

  // ### Returns whether this object represents the same term as the other
  equals(other) {
    // If both literals were created by this library,
    // equality can be computed through ids
    if (other instanceof Literal)
      return this.id === other.id;
    // Otherwise, compare term type, value, language, and datatype
    return !!other && !!other.datatype &&
                      this.termType === other.termType &&
                      this.value    === other.value    &&
                      this.language === other.language &&
                      this.datatype.value === other.datatype.value;
  }

  toJSON() {
    return {
      termType: this.termType,
      value:    this.value,
      language: this.language,
      datatype: { termType: 'NamedNode', value: this.datatypeString },
    };
  }
}

// ## BlankNode constructor
export class BlankNode extends Term {
  constructor(name) {
    super('_:' + name);
  }

  // ### The term type of this term
  get termType() {
    return 'BlankNode';
  }

  // ### The name of this blank node
  get value() {
    return this.id.substr(2);
  }
}

export class Variable extends Term {
  constructor(name) {
    super('?' + name);
  }

  // ### The term type of this term
  get termType() {
    return 'Variable';
  }

  // ### The name of this variable
  get value() {
    return this.id.substr(1);
  }
}

// ## DefaultGraph constructor
export class DefaultGraph extends Term {
  constructor() {
    super('');
    return DEFAULTGRAPH || this;
  }

  // ### The term type of this term
  get termType() {
    return 'DefaultGraph';
  }

  // ### Returns whether this object represents the same term as the other
  equals(other) {
    // If both terms were created by this library,
    // equality can be computed through strict equality;
    // otherwise, compare term types.
    return (this === other) || (!!other && (this.termType === other.termType));
  }
}

// ## DefaultGraph singleton
DEFAULTGRAPH = new DefaultGraph();


// ### Constructs a term from the given internal string ID
export function termFromId(id, factory) {
  factory = factory || DataFactory;

  // Falsy value or empty string indicate the default graph
  if (!id)
    return factory.defaultGraph();

  // Identify the term type based on the first character
  switch (id[0]) {
  case '_': return factory.blankNode(id.substr(2));
  case '?': return factory.variable(id.substr(1));
  case '"':
    // Shortcut for internal literals
    if (factory === DataFactory)
      return new Literal(id);
    // Literal without datatype or language
    if (id[id.length - 1] === '"')
      return factory.literal(id.substr(1, id.length - 2));
    // Literal with datatype or language
    var endPos = id.lastIndexOf('"', id.length - 1);
    return factory.literal(id.substr(1, endPos - 1),
            id[endPos + 1] === '@' ? id.substr(endPos + 2)
                                   : factory.namedNode(id.substr(endPos + 3)));
  case '<':
    // Parse quad
    let result = id.match(/^<<("(?:""|[^"])*"[^ ]*|[^ ]+) ("(?:""|[^"])*"[^ ]*|[^ ]+) ("(?:""|[^"])*"[^ ]*|[^ ]+) ?("(?:""|[^"])*"[^ ]*|[^ ]+)?>>$/);
    result = result.splice(1).filter((x) => x !== undefined).map((id) => termFromId(unEscape(id), factory));

    return factory.quadTerm(factory.quad(...result));
  default:  return factory.namedNode(id);
  }
}

// ### Constructs an internal string ID from the given term or ID string
export function termToId(term) {
  if (typeof term === 'string')
    return term;
  if (term instanceof Term)
    return term.id;
  if (!term)
    return DEFAULTGRAPH.id;

  // Term instantiated with another library
  switch (term.termType) {
  case 'NamedNode':    return term.value;
  case 'BlankNode':    return '_:' + term.value;
  case 'Variable':     return '?' + term.value;
  case 'DefaultGraph': return '';
  case 'Literal':      return '"' + term.value + '"' +
    (term.language ? '@' + term.language :
      (term.datatype && term.datatype.value !== xsd.string ? '^^' + term.datatype.value : ''));
  case 'QuadTerm':     return `<<${quadToId(term.value)}>>`;
  default: throw new Error('Unexpected termType: ' + term.termType);
  }
}


// ## Quad constructor
export class Quad {
  constructor(subject, predicate, object, graph) {
    this.subject   = subject;
    this.predicate = predicate;
    this.object    = object;
    this.graph     = graph || DEFAULTGRAPH;
  }

  // ### Returns a plain object representation of this quad
  toJSON() {
    return {
      subject:   this.subject.toJSON(),
      predicate: this.predicate.toJSON(),
      object:    this.object.toJSON(),
      graph:     this.graph.toJSON(),
    };
  }

  // ### Returns whether this object represents the same quad as the other
  equals(other) {
    return !!other && this.subject.equals(other.subject)     &&
                      this.predicate.equals(other.predicate) &&
                      this.object.equals(other.object)       &&
                      this.graph.equals(other.graph);
  }
}
export { Quad as Triple };

// QuadTerm constructor
export class QuadTerm extends Term {
  constructor(quad) {
    super(`<<${quadToId(quad)}>>`);
    this.quad = quad;
  }

  // ### The term type of this term
  get termType() {
    return 'QuadTerm';
  }

  // ### The text value of this literal
  get value() {
    return this.quad;
  }
}

// ### Creates a string from a Quad
function quadToId(quad) {
  let result = [quad.subject, quad.predicate, quad.object].map(termToId).map(escape).join(' ');

  // Omit default graph
  if (!isDefaultGraph(quad.graph)) {
    result += ` ${termToId(quad.graph)}`;
  }
  return result;
}

// ### Escapes the quotes within the given literal
function escape(id) {
  return escapeHelper(id, /"/g, '""');
}

// ### Unescapes the quotes within the given literal
function unEscape(id) {
  return escapeHelper(id, /""/g, '"');
}

function escapeHelper(id, regex, replacement) {
  let result = id;
  let m = id.match(/^"(.*)"([^"]*)$/);
  if (m) {
    result = `"${m[1].replace(regex, replacement)}"${m[2]}`;
  }
  return result;
}

// ### Creates an IRI
function namedNode(iri) {
  return new NamedNode(iri);
}

// ### Creates a blank node
function blankNode(name) {
  return new BlankNode(name || `n3-${_blankNodeCounter++}`);
}

// ### Creates a literal
function literal(value, languageOrDataType) {
  // Create a language-tagged string
  if (typeof languageOrDataType === 'string')
    return new Literal('"' + value + '"@' + languageOrDataType.toLowerCase());

  // Automatically determine datatype for booleans and numbers
  let datatype = languageOrDataType ? languageOrDataType.value : '';
  if (datatype === '') {
    // Convert a boolean
    if (typeof value === 'boolean')
      datatype = xsd.boolean;
    // Convert an integer or double
    else if (typeof value === 'number') {
      if (Number.isFinite(value))
        datatype = Number.isInteger(value) ? xsd.integer : xsd.double;
      else {
        datatype = xsd.double;
        if (!Number.isNaN(value))
          value = value > 0 ? 'INF' : '-INF';
      }
    }
  }

  // Create a datatyped literal
  return (datatype === '' || datatype === xsd.string) ?
    new Literal('"' + value + '"') :
    new Literal('"' + value + '"^^' + datatype);
}

// ### Creates a variable
function variable(name) {
  return new Variable(name);
}

// ### Returns the default graph
function defaultGraph() {
  return DEFAULTGRAPH;
}

// ### Creates a quad
function quad(subject, predicate, object, graph) {
  return new Quad(subject, predicate, object, graph);
}

// ### Creates a quadTerm
function quadTerm(quad) {
  return new QuadTerm(quad);
}
