// N3.js implementations of the RDF/JS core data types
// See https://github.com/rdfjs/representation-task-force/blob/master/interface-spec.md

var DEFAULTGRAPH;

// ## Term constructor
function Term(id) {
  if (!(this instanceof Term))
    return new Term(id);
  this.id = id;
}
// ### Makes this class a subclass of the given type
Term.subclass = function subclass(Type) {
  Type.prototype = Object.create(this.prototype, {
    constructor: { value: Type },
    termType:    { value: Type.name },
  });
  Type.subclass = subclass;
};

// ### Constructs a term from the given ID
Term.fromId = function (id) {
  // Falsy value or empty string indicate the default graph
  if (!id)
    return DEFAULTGRAPH;

  // Identify the term type based on the first character
  switch (id[0]) {
  case '_': return new BlankNode(id.substr(2));
  case '?': return new Variable(id.substr(1));
  case '"': return new Literal(id);
  default:  return new NamedNode(id);
  }
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


// ## NamedNode constructor
function NamedNode(iri) {
  if (!(this instanceof NamedNode))
    return new NamedNode(iri);
  this.id = iri;
}
Term.subclass(NamedNode);

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
Term.subclass(BlankNode);

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
Term.subclass(Variable);

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
Term.subclass(Literal);

// ### The text value of this literal
Object.defineProperty(Literal.prototype, 'value', {
  get: function () {
    return this.id.substring(1, this.id.indexOf('"', 1));
  },
});

// ### The language of this literal
Object.defineProperty(Literal.prototype, 'language', {
  get: function () {
    // Find the last quotation mark (e.g., '"abc"@en-us')
    var id = this.id, atPos = id.lastIndexOf('"') + 1;
    // If "@" it follows, return the remaining substring; empty otherwise
    return atPos < id.length && id[atPos++] === '@' ? id.substr(atPos) : '';
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
           (ch === '@' ? 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
                       : 'http://www.w3.org/2001/XMLSchema#string');
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
  if (!(this instanceof DefaultGraph))
    return new DefaultGraph();
  return DEFAULTGRAPH || this;
}
Term.subclass(DefaultGraph);

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


// ## Module exports
module.exports = {
  Term:      Term,
  NamedNode: NamedNode,
  BlankNode: BlankNode,
  Variable:  Variable,
  Literal:   Literal,
  DefaultGraph: DefaultGraph,
};
