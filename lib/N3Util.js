// **N3Util** provides N3 utility functions.

var DataFactory = require('./N3DataFactory');

var N3Util = {
  // Tests whether the given term represents an IRI
  isNamedNode: function (term) {
    return !!term && term.termType === 'NamedNode';
  },

  // Tests whether the given term represents a blank node
  isBlankNode: function (term) {
    return !!term && term.termType === 'BlankNode';
  },

  // Tests whether the given term represents a literal
  isLiteral: function (term) {
    return !!term && term.termType === 'Literal';
  },

  // Tests whether the given term represents a variable
  isVariable: function (term) {
    return !!term && term.termType === 'Variable';
  },

  // Tests whether the given term represents the default graph
  isDefaultGraph: function (term) {
    return !!term && term.termType === 'DefaultGraph';
  },

  // Tests whether the given quad is in the default graph
  inDefaultGraph: function (quad) {
    return N3Util.isDefaultGraph(quad.graph);
  },

  // Creates a function that prepends the given IRI to a local name
  prefix: function (iri, factory) {
    return N3Util.prefixes({ '': iri }, factory)('');
  },

  // Creates a function that allows registering and expanding prefixes
  prefixes: function (defaultPrefixes, factory) {
    // Add all of the default prefixes
    var prefixes = Object.create(null);
    for (var prefix in defaultPrefixes)
      processPrefix(prefix, defaultPrefixes[prefix]);
    // Set the default factory if none was specified
    factory = factory || DataFactory;

    // Registers a new prefix (if an IRI was specified)
    // or retrieves a function that expands an existing prefix (if no IRI was specified)
    function processPrefix(prefix, iri) {
      // Create a new prefix if an IRI is specified or the prefix doesn't exist
      if (typeof iri === 'string') {
        // Create a function that expands the prefix
        var cache = Object.create(null);
        prefixes[prefix] = function (local) {
          return cache[local] || (cache[local] = factory.namedNode(iri + local));
        };
      }
      else if (!(prefix in prefixes)) {
        throw new Error('Unknown prefix: ' + prefix);
      }
      return prefixes[prefix];
    }
    return processPrefix;
  },
};

// ## Exports
module.exports = N3Util;
