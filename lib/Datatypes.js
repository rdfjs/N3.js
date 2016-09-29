// N3.js implementations of the RDF/JS core data types
// See https://github.com/rdfjs/representation-task-force/blob/master/interface-spec.md

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


// ## Module exports
module.exports = {
  Term: Term,
  NamedNode: NamedNode,
};
