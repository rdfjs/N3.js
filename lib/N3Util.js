// **N3Util** provides N3 utility functions
var N3Util = {
  // Tests whether the given entity (triple object) represents a URI in the N3 library
  isUri: function (entity) {
    return entity && /^[^"]/.test(entity);
  },

  // Tests whether the given entity (triple object) represents a literal in the N3 library
  isLiteral: function (entity) {
    return entity && /^"/.test(entity);
  },

  // Tests whether the given entity (triple object) represents a QName
  isQName: function (entity) {
    return entity && /^[^:\/]*:[^:\/]+$/.test(entity);
  },

  // Expands the QName to a full URI
  expandQName: function (qname, prefixes) {
    var parts = /^([^:\/]*):([^:\/]+)$/.exec(qname);
    if (!parts)
      throw new Error(qname + ' is not a QName');
    var prefix = parts[1];
    if (!(prefix in prefixes))
      throw new Error('Unknown prefix: ' + prefix);
    return prefixes[prefix] + parts[2];
  },
};

// Add the N3Util functions to the given object or its prototype
function AddN3Util(parent, toPrototype) {
  for (var name in N3Util)
    if (!toPrototype)
      parent[name] = N3Util[name];
    else
      parent.prototype[name] = ApplyToThis(N3Util[name]);

  return parent;
}

// Returns a function that applies `f` to the `this` object
function ApplyToThis(f) {
  return function (a) { return f(this, a); };
}

// Expose N3Util, attaching all functions to it
module.exports = AddN3Util(AddN3Util);
