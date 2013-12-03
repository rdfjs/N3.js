// **N3Store** objects store N3 triples with an associated context in memory.

var prefixMatcher = /^([^:\/#"']*):[^\/]/;

// ## Constructor
function N3Store(triples, prefixes) {
  if (!(this instanceof N3Store))
    return new N3Store(triples, prefixes);

  // The number of triples is initially zero.
  this._size = 0;
  // `_contexts` contains subject, predicate, and object indexes per context.
  this._contexts = Object.create(null);
  // `_entities` maps entities such as `http://xmlns.com/foaf/0.1/name` to numbers.
  // This saves memory, since only the numbers have to be stored in `_contexts`.
  this._entities = Object.create(null);
  this._entities['>>____unused_item_to_make_first_entity_key_non-falsy____<<'] = 0;
  this._entityCount = 0;
  // `_blankNodeIndex` is the index of the last created blank node that was automatically named
  this._blankNodeIndex = 0;

  // Shift parameters if `triples` is not given
  if (!prefixes && triples && !triples[0])
    prefixes = triples, triples = null;

  // Add triples and prefixes if passed
  this._prefixes = Object.create(null);
  triples && this.addTriples(triples);
  prefixes && this.addPrefixes(prefixes);
}

N3Store.prototype = {
  // ## Public properties

  // `defaultContext` is the default context wherein triples are stored.
  get defaultContext() {
    return 'n3/contexts#default';
  },

  // ### `size` returns the number of triples in the store.
  get size() {
    // Return the triple count if if was cached.
    var size = this._size;
    if (size !== null)
      return size;

    // Calculate the number of triples by counting to the deepest level.
    var contexts = this._contexts, subjects, subject;
    for (var contextKey in contexts)
      for (var subjectKey in (subjects = contexts[contextKey].subjects))
        for (var predicateKey in (subject = subjects[subjectKey]))
          size += Object.keys(subject[predicateKey]).length;
    return this._size = size;
  },

  // ## Private methods

  // ### `_addToIndex` adds a triple to a three-layered index.
  _addToIndex: function (index0, key0, key1, key2) {
    // Create layers as necessary.
    var index1 = index0[key0] || (index0[key0] = {});
    var index2 = index1[key1] || (index1[key1] = {});
    // Setting the key to _any_ value signalizes the presence of the triple.
    index2[key2] = null;
  },

  // ### `_findInIndex` finds a set of triples in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be `null`, which is interpreted as a wildcard.
  // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // used when reconstructing the resulting triple
  // (for instance: _subject_, _predicate_, and _object_).
  // Finally, `context` will be the context of the created triples.
  _findInIndex: function (index0, key0, key1, key2, name0, name1, name2, context) {
    var results = [],
        entityKeys = Object.keys(this._entities),
        tmp;
    // If a key is specified, use only that part of index 0.
    if (key0 && (tmp = index0))
      (index0 = {})[key0] = tmp[key0];

    for (var value0 in index0) {
      var index1 = index0[value0] || {},
          entity0 = entityKeys[value0];
      // If a key is specified, use only that part of index 1.
      if (key1 && (tmp = index1))
        (index1 = {})[key1] = tmp[key1];

      for (var value1 in index1) {
        var index2 = index1[value1] || {},
            entity1 = entityKeys[value1];
        // If a key is specified, use only that part of index 2, if it exists.
        if (key2 && (tmp = index2))
          key2 in index2 ? (index2 = {})[key2] = tmp[key2] : index2 = {};

        // Create triples for all items found in index 2.
        results.push.apply(results, Object.keys(index2).map(function (value2) {
          var result = { context: context };
          result[name0] = entity0;
          result[name1] = entity1;
          result[name2] = entityKeys[value2];
          return result;
        }));
      }
    }
    return results;
  },

  // ## Public methods

  // ### `addTriple` adds a new N3 triple to the store.
  addTriple: function (subject, predicate, object, context) {
    // Shift arguments if a triple object is given instead of components
    if (!predicate)
      context = subject.context, object = subject.object,
        predicate = subject.predicate, subject = subject.subject;

    // Find the context that will contain the triple.
    context = context || this.defaultContext;
    var contextItem = this._contexts[context];
    // Create the context if it doesn't exist yet.
    if (!contextItem) {
      contextItem = this._contexts[context] = {
        subjects: {},
        predicates: {},
        objects: {}
      };
      // Freezing a context helps subsequent `add` performance,
      // and properties will never be modified anyway.
      Object.freeze(contextItem);
    }

    // Since entities can often be long URIs, we avoid storing them in every index.
    // Instead, we have a separate index that maps entities to numbers,
    // which are then used as keys in the other indexes.
    var entities = this._entities;

    subject   = entities[subject]   || (entities[subject]   = ++this._entityCount);
    predicate = entities[predicate] || (entities[predicate] = ++this._entityCount);
    object    = entities[object]    || (entities[object]    = ++this._entityCount);

    this._addToIndex(contextItem.subjects, subject, predicate, object);
    this._addToIndex(contextItem.predicates, predicate, object, subject);
    this._addToIndex(contextItem.objects, object, subject, predicate);

    // The cached triple count is now invalid.
    this._size = null;

    // Enable method chaining.
    return this;
  },

  // ### `addTriples` adds multiple N3 triples to the store.
  addTriples: function (triples) {
    for (var i = triples.length - 1; i >= 0; i--)
      this.addTriple(triples[i]);
    return this;
  },

  // ### `addPrefix` adds support for querying with the given prefix
  addPrefix: function (prefix, uri) {
    this._prefixes[prefix] = uri;
  },

  // ### `addPrefixex` adds support for querying with the given prefixes
  addPrefixes: function (prefixes) {
    for (var prefix in prefixes)
      this.addPrefix(prefix, prefixes[prefix]);
  },

  // ### `find` finds a set of triples matching a pattern, expanding prefixes as necessary.
  // Setting `subject`, `predicate`, or `object` to `null` means an _anything_ wildcard.
  // Setting `context` to `null` means the default context.
  find: function (subject, predicate, object, context) {
    // Expand prefixes if necessary
    var match, prefix, base, prefixes = this._prefixes;
    if ((match = prefixMatcher.exec(subject))   !== null && (base = prefixes[prefix = match[1]]))
      subject   = base +   subject.substr(prefix.length + 1);
    if ((match = prefixMatcher.exec(predicate)) !== null && (base = prefixes[prefix = match[1]]))
      predicate = base + predicate.substr(prefix.length + 1);
    if ((match = prefixMatcher.exec(object))    !== null && (base = prefixes[prefix = match[1]]))
      object    = base +    object.substr(prefix.length + 1);
    if (context && (match = prefixMatcher.exec(context)) !== null && (base = prefixes[prefix = match[1]]))
      context = base + context.substr(prefix.length + 1);

    return this.findByUri(subject, predicate, object, context);
  },

  // ### `findByUri` finds a set of triples matching a pattern.
  // Setting `subject`, `predicate`, or `object` to `null` means an _anything_ wildcard.
  // Setting `context` to `null` means the default context.
  findByUri: function (subject, predicate, object, context) {
    context = context || this.defaultContext;
    var contextItem = this._contexts[context],
        entities = this._entities;

    // Translate URIs to internal index keys.
    // Optimization: if the entity doesn't exist, no triples with it exist.
    if (subject   && !(subject   = entities[subject]))   return [];
    if (predicate && !(predicate = entities[predicate])) return [];
    if (object    && !(object    = entities[object]))    return [];

    // If the specified context contain no triples, there are no results.
    if (!contextItem)
      return [];

    // Choose the optimal index, based on what fields are present
    if (subject) {
      if (object)
        // If subject and object are given, the object index will be the fastest.
        return this._findInIndex(contextItem.objects, object, subject, predicate,
                                 'object', 'subject', 'predicate', context);
      else
        // If only subject and possibly predicate are given, the subject index will be the fastest.
        return this._findInIndex(contextItem.subjects, subject, predicate, object,
                                 'subject', 'predicate', 'object', context);
    }
    else if (predicate) {
      // If only predicate and possibly object are given, the predicate index will be the fastest.
      return this._findInIndex(contextItem.predicates, predicate, object, subject,
                               'predicate', 'object', 'subject', context);
    }
    else {
      // If only object is possibly given, the object index will be the fastest.
      return this._findInIndex(contextItem.objects, object, subject, predicate,
                               'object', 'subject', 'predicate', context);
    }
  },

  // ### `createBlankNode` creates a new blank node, returning its name.
  createBlankNode: function (suggestedName) {
    var name;
    if (suggestedName) {
      name = suggestedName = '_:' + suggestedName;
      var index = 1;
      while (this._entities[name])
        name = suggestedName + index++;
    }
    else {
      do {
        name = '_:b' + this._blankNodeIndex++;
      }
      while (this._entities[name]);
    }
    this._entities[name] = this._entityCount++;
    return name;
  },
};

// ## Exports

// Export the `N3Store` class as a whole.
module.exports = N3Store;
