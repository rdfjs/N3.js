// N3.js implementations of the RDF/JS core data types
// See https://github.com/rdfjs/representation-task-force/blob/master/interface-spec.md

var namespaces = require('./IRIs');
var rdf = namespaces.rdf,
    xsd = namespaces.xsd;

var DataFactory, DEFAULTGRAPH;

var _blankNodeCounter = 0;

// ## Term constructor
function Term(id) {
  if (!(this instanceof Term))
    return new Term(id);
  this.id = id;
}
// ### Makes this class a subclass of the given type
Term.subclass = function subclass(Type, name) {
  Type.prototype = Object.create(this.prototype, {
    constructor: { value: Type },
    termType:    { value: name || Type.name },
  });
  Type.subclass = subclass;
};

// ### Returns whether this object represents the same term as the other
Term.prototype.equals = function (other) {
  // If both terms were created by this library,
  // equality can be computed through ids
  if (other instanceof Term)
    return this.id === other.id;
  // Otherwise, compare term type and value
  return !!other && this.termType === other.termType &&
                    this.value    === other.value;
};

// ### Returns a plain object representation of this term
Term.prototype.toJSON = function () {
  return {
    termType: this.termType,
    value:    this.value,
  };
};

// ### Constructs a term from the given internal string ID
function fromId(id, factory) {
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
  default:  return factory.namedNode(id);
  }
}

// ### Constructs an internal string ID from the given term or ID string
function toId(term) {
  if (typeof term === 'string')
    return term;
  if (term instanceof Term)
    return term.id;
  if (!term)
    return DEFAULTGRAPH.value;

  // Term instantiated with another library
  switch (term.termType) {
  case 'NamedNode':    return term.value;
  case 'BlankNode':    return '_:' + term.value;
  case 'Variable':     return '?' + term.value;
  case 'DefaultGraph': return '';
  case 'Literal':      return '"' + term.value + '"' +
    (term.language ? '@' + term.language :
      (term.datatype && term.datatype.value !== xsd.string ? '^^' + term.datatype.value : ''));
  default: throw new Error('Unexpected termType: ' + term.termType);
  }
}

// ## NamedNode constructor
function NamedNode(iri) {
  if (!(this instanceof NamedNode))
    return new NamedNode(iri);
  this.id = iri;
}
Term.subclass(NamedNode, 'NamedNode');

// ### The IRI of this named node
Object.defineProperty(NamedNode.prototype, 'value', {
  get: function () { return this.id; },
});


// ## BlankNode constructor
function BlankNode(name) {
  if (!(this instanceof BlankNode))
    return new BlankNode(name);
  this.id = '_:' + name;
}
Term.subclass(BlankNode, 'BlankNode');

// ### The name of this blank node
Object.defineProperty(BlankNode.prototype, 'value', {
  get: function () { return this.id.substr(2); },
});


// ## Variable constructor
function Variable(name) {
  if (!(this instanceof Variable))
    return new Variable(name);
  this.id = '?' + name;
}
Term.subclass(Variable, 'Variable');

// ### The name of this variable
Object.defineProperty(Variable.prototype, 'value', {
  get: function () { return this.id.substr(1); },
});


// ## Literal constructor
function Literal(id) {
  if (!(this instanceof Literal))
    return new Literal(id);
  this.id = id;
}
Term.subclass(Literal, 'Literal');

// ### The text value of this literal
Object.defineProperty(Literal.prototype, 'value', {
  get: function () {
    return this.id.substring(1, this.id.lastIndexOf('"'));
  },
});

// ### The language of this literal
Object.defineProperty(Literal.prototype, 'language', {
  get: function () {
    // Find the last quotation mark (e.g., '"abc"@en-us')
    var id = this.id, atPos = id.lastIndexOf('"') + 1;
    // If "@" it follows, return the remaining substring; empty otherwise
    return atPos < id.length && id[atPos++] === '@' ? id.substr(atPos).toLowerCase() : '';
  },
});

// ### The datatype IRI of this literal
Object.defineProperty(Literal.prototype, 'datatype', {
  get: function () {
    return new NamedNode(this.datatypeString);
  },
});

// ### The datatype string of this literal
Object.defineProperty(Literal.prototype, 'datatypeString', {
  get: function () {
    // Find the last quotation mark (e.g., '"abc"^^http://ex.org/types#t')
    var id = this.id, dtPos = id.lastIndexOf('"') + 1, ch;
    // If "^" it follows, return the remaining substring
    return dtPos < id.length && (ch = id[dtPos]) === '^' ? id.substr(dtPos + 2) :
           // If "@" follows, return rdf:langString; xsd:string otherwise
           (ch !== '@' ? xsd.string : rdf.langString);
  },
});

// ### Returns whether this object represents the same term as the other
Literal.prototype.equals = function (other) {
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
};

// ### Returns a plain object representation of this term
Literal.prototype.toJSON = function () {
  return {
    termType: this.termType,
    value:    this.value,
    language: this.language,
    datatype: { termType: 'NamedNode', value: this.datatypeString },
  };
};


// ## DefaultGraph singleton
function DefaultGraph() {
  return DEFAULTGRAPH || this;
}
Term.subclass(DefaultGraph, 'DefaultGraph');

// Initialize singleton
DEFAULTGRAPH = new DefaultGraph();
DEFAULTGRAPH.id = '';

// ### The empty string
Object.defineProperty(DefaultGraph.prototype, 'value', { value: '' });

// ### Returns whether this object represents the same term as the other
DefaultGraph.prototype.equals = function (other) {
  // If both terms were created by this library,
  // equality can be computed through strict equality;
  // otherwise, compare term types.
  return (this === other) || (!!other && (this.termType === other.termType));
};


// ## Quad constructor
function Quad(subject, predicate, object, graph) {
  if (!(this instanceof Quad))
    return new Quad(subject, predicate, object, graph);
  this.subject   = subject;
  this.predicate = predicate;
  this.object    = object;
  this.graph     = graph || DEFAULTGRAPH;
}

// ### Returns a plain object representation of this quad
Quad.prototype.toJSON = function () {
  return {
    subject:   this.subject.toJSON(),
    predicate: this.predicate.toJSON(),
    object:    this.object.toJSON(),
    graph:     this.graph.toJSON(),
  };
};

// ### Returns whether this object represents the same quad as the other
Quad.prototype.equals = function (other) {
  return !!other && this.subject.equals(other.subject)     &&
                    this.predicate.equals(other.predicate) &&
                    this.object.equals(other.object)       &&
                    this.graph.equals(other.graph);
};


// ## DataFactory functions

// ### Creates an IRI
function namedNode(iri) {
  return new NamedNode(iri);
}

// ### Creates a blank node
function blankNode(name) {
  if (!name)
    name = 'n3-' + _blankNodeCounter++;
  return new BlankNode(name);
}

// ### Creates a literal
function literal(value, languageOrDataType) {
  // Create a language-tagged string
  if (typeof languageOrDataType === 'string')
    return new Literal('"' + value + '"@' + languageOrDataType.toLowerCase());

  // Create a datatyped literal
  var datatype = languageOrDataType && languageOrDataType.value || '';
  if (!datatype) {
    switch (typeof value) {
    // Convert a boolean
    case 'boolean':
      datatype = xsd.boolean;
      break;
    // Convert an integer or double
    case 'number':
      if (Number.isFinite(value))
        datatype = Number.isInteger(value) ? xsd.integer : xsd.double;
      else {
        datatype = xsd.double;
        if (!Number.isNaN(value))
          value = value > 0 ? 'INF' : '-INF';
      }
      break;
    // No datatype, so convert a plain string
    default:
      return new Literal('"' + value + '"');
    }
  }
  return new Literal('"' + value + '"^^' + datatype);
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


// ## Module exports
module.exports = DataFactory = {
  // ### Public factory functions
  namedNode: namedNode,
  blankNode: blankNode,
  variable:  variable,
  literal:   literal,
  defaultGraph: defaultGraph,
  quad:      quad,
  triple:    quad,

  // ### Internal datatype constructors
  internal: {
    Term:      Term,
    NamedNode: NamedNode,
    BlankNode: BlankNode,
    Variable:  Variable,
    Literal:   Literal,
    DefaultGraph: DefaultGraph,
    Quad:      Quad,
    Triple:    Quad,
    fromId:    fromId,
    toId:      toId,
  },
};
