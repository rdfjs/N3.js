// **N3Util** provides N3 utility functions

var Xsd = 'http://www.w3.org/2001/XMLSchema#';
var XsdString  = Xsd + 'string';
var XsdInteger = Xsd + 'integer';
var XsdDecimal = Xsd + 'decimal';
var XsdBoolean = Xsd + 'boolean';
var RdfLangString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

var N3Util = {
  // Tests whether the given entity (triple object) represents an IRI in the N3 library
  isIRI: function (entity) {
    if (!entity)
      return entity;
    var firstChar = entity[0];
    return firstChar !== '"' && firstChar !== '_';
  },

  // Tests whether the given entity (triple object) represents a literal in the N3 library
  isLiteral: function (entity) {
    return entity && entity[0] === '"';
  },

  // Tests whether the given entity (triple object) represents a blank node in the N3 library
  isBlank: function (entity) {
    return entity && entity.substr(0, 2) === '_:';
  },

  // Gets the string value of a literal in the N3 library
  getLiteralValue: function (literal) {
    var match = /^"([^]*)"/.exec(literal);
    if (!match)
      throw new Error(literal + ' is not a literal');
    return match[1];
  },

  // Gets the type of a literal in the N3 library
  getLiteralType: function (literal) {
    var match = /^"[^]*"(?:\^\^([^"]+)|(@)[^@"]+)?$/.exec(literal);
    if (!match)
      throw new Error(literal + ' is not a literal');
    return match[1] || (match[2] ? RdfLangString : XsdString);
  },

  // Gets the language of a literal in the N3 library
  getLiteralLanguage: function (literal) {
    var match = /^"[^]*"(?:@([^@"]+)|\^\^[^"]+)?$/.exec(literal);
    if (!match)
      throw new Error(literal + ' is not a literal');
    return match[1] ? match[1].toLowerCase() : '';
  },

  // Tests whether the given entity (triple object) represents a prefixed name
  isPrefixedName: function (entity) {
    return entity && /^[^:\/"']*:[^:\/"']+$/.test(entity);
  },

  // Expands the prefixed name to a full IRI (also when it occurs as a literal's type)
  expandPrefixedName: function (prefixedName, prefixes) {
    var match = /(?:^|"\^\^)([^:\/#"'\^_]*):[^\/]*$/.exec(prefixedName), prefix, base, index;
    if (match)
      prefix = match[1], base = prefixes[prefix], index = match.index;
    if (base === undefined)
      return prefixedName;

    // The match index is non-zero when expanding a literal's type.
    return index === 0 ? base + prefixedName.substr(prefix.length + 1)
                       : prefixedName.substr(0, index + 3) +
                         base + prefixedName.substr(index + prefix.length + 4);
  },

  // Creates an IRI in N3.js representation
  createIRI: function (iri) {
    return iri && iri[0] === '"' ? N3Util.getLiteralValue(iri) : iri;
  },

  // Creates a literal in N3.js representation
  createLiteral: function (value, modifier) {
    if (!modifier) {
      switch (typeof value) {
      case 'boolean':
        modifier = XsdBoolean;
        break;
      case 'number':
        if (isFinite(value)) {
          modifier = value % 1 === 0 ? XsdInteger : XsdDecimal;
          break;
        }
      default:
        return '"' + value + '"';
      }
    }
    return '"' + value +
           (/^[a-z]+(-[a-z0-9]+)*$/i.test(modifier) ? '"@'  + modifier.toLowerCase()
                                                    : '"^^' + modifier);
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

// Add the N3Util functions to the given object or its prototype
function addN3Util(parent, toPrototype) {
  for (var name in N3Util)
    if (!toPrototype)
      parent[name] = N3Util[name];
    else
      parent.prototype[name] = applyToThis(N3Util[name]);

  return parent;
}

// Returns a function that applies `f` to the `this` object
function applyToThis(f) {
  return function (a) { return f(this, a); };
}

// Expose N3Util, attaching all functions to it
module.exports = addN3Util(addN3Util);
