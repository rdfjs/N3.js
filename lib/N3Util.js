// **N3Util** provides N3 utility functions.

var Xsd = 'http://www.w3.org/2001/XMLSchema#';
var XsdInteger = Xsd + 'integer';
var XsdDouble = Xsd + 'double';
var XsdBoolean = Xsd + 'boolean';

var Datatype = require('./Datatypes');
var Term = Datatype.Term,
    NamedNode = Datatype.NamedNode,
    BlankNode = Datatype.BlankNode,
    Literal = Datatype.Literal,
    Variable = Datatype.Variable,
    DefaultGraph = Datatype.DefaultGraph,
    Quad = Datatype.Quad;

var N3Util = {
  // An internal counter for creating anonymous blank node labels
  _blankNodeCounter: 0,

  // Tests whether the given entity (triple object) represents an IRI
  isNamedNode: function (entity) {
    return !!entity && entity.termType === 'NamedNode';
  },

  // Tests whether the given entity (triple object) represents a blank node
  isBlank: function (entity) {
    return !!entity && entity.termType === 'BlankNode';
  },

  // Tests whether the given entity (triple object) represents a literal
  isLiteral: function (entity) {
    return !!entity && entity.termType === 'Literal';
  },

  // Tests whether the given entity represents a variable
  isVariable: function (entity) {
    return !!entity && entity.termType === 'Variable';
  },

  // Tests whether the given entity represents the default graph
  isDefaultGraph: function (entity) {
    return !entity || entity.termType === 'DefaultGraph';
  },

  // Tests whether the given triple is in the default graph
  inDefaultGraph: function (triple) {
    return N3Util.isDefaultGraph(triple.graph);
  },

  // Gets the string value of a literal in the N3 library
  getLiteralValue: function (literal) {
    if (!N3Util.isLiteral(literal))
      throw new Error((literal && literal.value ? literal.value : literal) + ' is not a literal.');
    return literal.value;
  },

  // Gets the type of a literal in the N3 library
  getLiteralType: function (literal) {
    if (!N3Util.isLiteral(literal))
      throw new Error((literal && literal.value ? literal.value : literal) + ' is not a literal.');
    return literal.datatype;
  },

  // Gets the language of a literal in the N3 library
  getLiteralLanguage: function (literal) {
    if (!N3Util.isLiteral(literal))
      throw new Error((literal && literal.value ? literal.value : literal) + ' is not a literal.');
    return literal.language;
  },

  // Tests whether the given entity (triple object) represents a prefixed name
  isPrefixedName: function (entity) {
    return typeof entity === 'string' && /^[^:\/"']*:[^:\/"']+$/.test(entity);
  },

  // Expands the prefixed name to a full IRI (also when it occurs as a literal's type)
  expandPrefixedName: function (prefixedName, prefixes) {
    var match = /(?:^|"\^\^)([^:\/#"'\^_]*):[^\/]*$/.exec(prefixedName), prefix, base, index;
    if (match)
      prefix = match[1], base = prefixes[prefix], index = match.index;
    if (base === undefined)
      return prefixedName;

    // The match index is non-zero when expanding a literal's type
    return Term.fromId(index === 0 ? base + prefixedName.substr(prefix.length + 1)
                                     : prefixedName.substr(0, index + 3) +
                                       base + prefixedName.substr(index + prefix.length + 4));
  },

  // Creates an IRI
  namedNode: function (iri) {
    return iri && new NamedNode(iri[0] === '"' ? Term.fromId(iri).value : iri);
  },

  // Creates a blank node
  blankNode: function (name) {
    if (!name)
      name = 'n3' + N3Util._blankNodeCounter++;
    return new BlankNode(name);
  },

  // Creates a literal
  literal: function (value, languageOrDataType) {
    var modifier = languageOrDataType && languageOrDataType.termType ? languageOrDataType.value : languageOrDataType;
    if (!modifier) {
      switch (typeof value) {
      case 'boolean':
        modifier = XsdBoolean;
        break;
      case 'number':
        if (isFinite(value))
          modifier = value % 1 === 0 ? XsdInteger : XsdDouble;
        else {
          modifier = XsdDouble;
          if (!isNaN(value))
            value = value > 0 ? 'INF' : '-INF';
        }
        break;
      default:
        return new Literal('"' + value + '"');
      }
    }
    return new Literal('"' + value +
           (/^[a-z]+(-[a-z0-9]+)*$/i.test(modifier) ? '"@'  + modifier.toLowerCase()
                                                    : '"^^' + modifier));
  },

  // Creates a variable
  variable: function (name) {
    return new Variable(name);
  },

  // Returns the default graph
  defaultGraph: function () {
    return new DefaultGraph();
  },

  // Creates a triple
  triple: function (subject, predicate, object) {
    return N3Util.quad(subject, predicate, object);
  },

  // Creates a quad
  quad: function (subject, predicate, object, graph) {
    return new Quad(subject, predicate, object, graph);
  },

  // Creates a function that prepends the given IRI to a local name
  prefix: function (iri) {
    return N3Util.prefixes({ '': iri })('');
  },

  // Creates a function that allows registering and expanding prefixes
  prefixes: function (defaultPrefixes) {
    // Add all of the default prefixes
    var prefixes = Object.create(null);
    for (var prefix in defaultPrefixes)
      processPrefix(prefix, defaultPrefixes[prefix]);

    // Registers a new prefix (if an IRI was specified)
    // or retrieves a function that expands an existing prefix (if no IRI was specified)
    function processPrefix(prefix, iri) {
      // Create a new prefix if an IRI is specified or the prefix doesn't exist
      if (iri || !(prefix in prefixes)) {
        var cache = Object.create(null);
        iri = iri || '';
        // Create a function that expands the prefix
        prefixes[prefix] = function (localName) {
          return cache[localName] || (cache[localName] = iri + localName);
        };
      }
      return prefixes[prefix];
    }
    return processPrefix;
  },
};

// ## Exports
module.exports = N3Util;
