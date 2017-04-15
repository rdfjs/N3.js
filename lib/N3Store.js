// **N3Store** objects store N3 triples by graph in memory.

var expandPrefixedName = require('./N3Util').expandPrefixedName;

// ## Constructor
function N3Store(triples, options) {
  if (!(this instanceof N3Store))
    return new N3Store(triples, options);

  // The number of triples is initially zero
  this._size = 0;
  // `_graphs` contains subject, predicate, and object indexes per graph
  this._graphs = Object.create(null);
  // `_ids` maps entities such as `http://xmlns.com/foaf/0.1/name` to numbers,
  // saving memory by using only numbers as keys in `_graphs`
  this._id = 0;
  this._ids = Object.create(null);
  this._ids['><'] = 0; // dummy entry, so the first actual key is non-zero
  this._entities = Object.create(null); // inverse of `_ids`
  // `_blankNodeIndex` is the index of the last automatically named blank node
  this._blankNodeIndex = 0;

  // Shift parameters if `triples` is not given
  if (!options && triples && !triples[0])
    options = triples, triples = null;
  options = options || {};

  // Add triples and prefixes if passed
  this._prefixes = Object.create(null);
  if (options.prefixes)
    this.addPrefixes(options.prefixes);
  if (triples)
    this.addTriples(triples);
}

N3Store.prototype = {
  // ## Public properties

  // ### `size` returns the number of triples in the store
  get size() {
    // Return the triple count if if was cached
    var size = this._size;
    if (size !== null)
      return size;

    // Calculate the number of triples by counting to the deepest level
    size = 0;
    var graphs = this._graphs, subjects, subject;
    for (var graphKey in graphs)
      for (var subjectKey in (subjects = graphs[graphKey].subjects))
        for (var predicateKey in (subject = subjects[subjectKey]))
          size += Object.keys(subject[predicateKey]).length;
    return this._size = size;
  },

  // ## Private methods

  // ### `_addToIndex` adds a triple to a three-layered index.
  // Returns if the index has changed, if the entry did not already exist.
  _addToIndex: function (index0, key0, key1, key2) {
    // Create layers as necessary
    var index1 = index0[key0] || (index0[key0] = {});
    var index2 = index1[key1] || (index1[key1] = {});
    // Setting the key to _any_ value signals the presence of the triple
    var existed = key2 in index2;
    if (!existed)
      index2[key2] = null;
    return !existed;
  },

  // ### `_removeFromIndex` removes a triple from a three-layered index
  _removeFromIndex: function (index0, key0, key1, key2) {
    // Remove the triple from the index
    var index1 = index0[key0], index2 = index1[key1], key;
    delete index2[key2];

    // Remove intermediary index layers if they are empty
    for (key in index2) return;
    delete index1[key1];
    for (key in index1) return;
    delete index0[key0];
  },

  // ### `_findInIndex` finds a set of triples in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // used when reconstructing the resulting triple
  // (for instance: _subject_, _predicate_, and _object_).
  // Finally, `graph` will be the graph of the created triples.
  // If `callback` is given, each result is passed through it
  // and iteration halts when it returns truthy for any triple.
  // If instead `array` is given, each result is added to the array.
  _findInIndex: function (index0, key0, key1, key2, name0, name1, name2, graph, callback, array) {
    var tmp, index1, index2, varCount = !key0 + !key1 + !key2,
        // depending on the number of variables, keys or reverse index are faster
        entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

    // If a key is specified, use only that part of index 0.
    if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
    for (var value0 in index0) {
      var entity0 = entityKeys[value0];

      if (index1 = index0[value0]) {
        // If a key is specified, use only that part of index 1.
        if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
        for (var value1 in index1) {
          var entity1 = entityKeys[value1];

          if (index2 = index1[value1]) {
            // If a key is specified, use only that part of index 2, if it exists.
            var values = key2 ? (key2 in index2 ? [key2] : []) : Object.keys(index2);
            // Create triples for all items found in index 2.
            for (var l = values.length - 1; l >= 0; l--) {
              var result = { subject: '', predicate: '', object: '', graph: graph };
              result[name0] = entity0;
              result[name1] = entity1;
              result[name2] = entityKeys[values[l]];
              if (array)
                array.push(result);
              else if (callback(result))
                return true;
            }
          }
        }
      }
    }
    return array;
  },

  // ### `_loop` executes the callback on all keys of index 0
  _loop: function (index0, callback) {
    for (var key0 in index0)
      callback(key0);
  },

  // ### `_loopByKey0` executes the callback on all keys of a certain entry in index 0
  _loopByKey0: function (index0, key0, callback) {
    var index1, key1;
    if (index1 = index0[key0]) {
      for (key1 in index1)
        callback(key1);
    }
  },

  // ### `_loopByKey1` executes the callback on given keys of all entries in index 0
  _loopByKey1: function (index0, key1, callback) {
    var key0, index1;
    for (key0 in index0) {
      index1 = index0[key0];
      if (index1[key1])
        callback(key0);
    }
  },

  // ### `_loopBy2Keys` executes the callback on given keys of certain entries in index 2
  _loopBy2Keys: function (index0, key0, key1, callback) {
    var index1, index2, key2;
    if ((index1 = index0[key0]) && (index2 = index1[key1])) {
      for (key2 in index2)
        callback(key2);
    }
  },

  // ### `_countInIndex` counts matching triples in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  _countInIndex: function (index0, key0, key1, key2) {
    var count = 0, tmp, index1, index2;

    // If a key is specified, count only that part of index 0
    if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
    for (var value0 in index0) {
      if (index1 = index0[value0]) {
        // If a key is specified, count only that part of index 1
        if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
        for (var value1 in index1) {
          if (index2 = index1[value1]) {
            // If a key is specified, count the triple if it exists
            if (key2) (key2 in index2) && count++;
            // Otherwise, count all triples
            else count += Object.keys(index2).length;
          }
        }
      }
    }
    return count;
  },

  // ### `_getGraphs` returns an array with the given graph,
  // or all graphs if the argument is null or undefined.
  _getGraphs: function (graph) {
    if (!isString(graph))
      return this._graphs;
    var graphs = {};
    graphs[graph] = this._graphs[graph];
    return graphs;
  },

  // ### `_uniqueEntities` returns a function that accepts an entity ID
  // and passes the corresponding entity to callback if it hasn't occurred before.
  _uniqueEntities: function (callback) {
    var uniqueIds = Object.create(null), entities = this._entities;
    return function (id) {
      if (!(id in uniqueIds)) {
        uniqueIds[id] = true;
        callback(entities[id]);
      }
    };
  },

  // ## Public methods

  // ### `addTriple` adds a new N3 triple to the store.
  // Returns if the triple index has changed, if the triple did not already exist.
  addTriple: function (subject, predicate, object, graph) {
    // Shift arguments if a triple object is given instead of components
    if (!predicate)
      graph = subject.graph, object = subject.object,
        predicate = subject.predicate, subject = subject.subject;

    // Find the graph that will contain the triple
    graph = graph || '';
    var graphItem = this._graphs[graph];
    // Create the graph if it doesn't exist yet
    if (!graphItem) {
      graphItem = this._graphs[graph] = { subjects: {}, predicates: {}, objects: {} };
      // Freezing a graph helps subsequent `add` performance,
      // and properties will never be modified anyway
      Object.freeze(graphItem);
    }

    // Since entities can often be long IRIs, we avoid storing them in every index.
    // Instead, we have a separate index that maps entities to numbers,
    // which are then used as keys in the other indexes.
    var ids = this._ids;
    var entities = this._entities;
    subject   = ids[subject]   || (ids[entities[++this._id] = subject]   = this._id);
    predicate = ids[predicate] || (ids[entities[++this._id] = predicate] = this._id);
    object    = ids[object]    || (ids[entities[++this._id] = object]    = this._id);

    var changed = this._addToIndex(graphItem.subjects,   subject,   predicate, object);
    this._addToIndex(graphItem.predicates, predicate, object,    subject);
    this._addToIndex(graphItem.objects,    object,    subject,   predicate);

    // The cached triple count is now invalid
    this._size = null;
    return changed;
  },

  // ### `addTriples` adds multiple N3 triples to the store
  addTriples: function (triples) {
    for (var i = triples.length - 1; i >= 0; i--)
      this.addTriple(triples[i]);
  },

  // ### `addPrefix` adds support for querying with the given prefix
  addPrefix: function (prefix, iri) {
    this._prefixes[prefix] = iri;
  },

  // ### `addPrefixes` adds support for querying with the given prefixes
  addPrefixes: function (prefixes) {
    for (var prefix in prefixes)
      this.addPrefix(prefix, prefixes[prefix]);
  },

  // ### `removeTriple` removes an N3 triple from the store if it exists
  removeTriple: function (subject, predicate, object, graph) {
    // Shift arguments if a triple object is given instead of components
    if (!predicate)
      graph = subject.graph, object = subject.object,
        predicate = subject.predicate, subject = subject.subject;
    graph = graph || '';

    // Find internal identifiers for all components
    // and verify the triple exists.
    var graphItem, ids = this._ids, graphs = this._graphs, subjects, predicates;
    if (!(subject    = ids[subject]) || !(predicate = ids[predicate]) ||
        !(object     = ids[object])  || !(graphItem = graphs[graph])  ||
        !(subjects   = graphItem.subjects[subject]) ||
        !(predicates = subjects[predicate]) ||
        !(object in predicates))
      return false;

    // Remove it from all indexes
    this._removeFromIndex(graphItem.subjects,   subject,   predicate, object);
    this._removeFromIndex(graphItem.predicates, predicate, object,    subject);
    this._removeFromIndex(graphItem.objects,    object,    subject,   predicate);
    if (this._size !== null) this._size--;

    // Remove the graph if it is empty
    for (subject in graphItem.subjects) return true;
    delete graphs[graph];
    return true;
  },

  // ### `removeTriples` removes multiple N3 triples from the store
  removeTriples: function (triples) {
    for (var i = triples.length - 1; i >= 0; i--)
      this.removeTriple(triples[i]);
  },

  // ### `getTriples` returns an array of triples matching a pattern, expanding prefixes as necessary.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getTriples: function (subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.getTriplesByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `getTriplesByIRI` returns an array of triples matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getTriplesByIRI: function (subject, predicate, object, graph) {
    var quads = [], graphs = this._getGraphs(graph), content,
        ids = this._ids, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (isString(subject)   && !(subjectId   = ids[subject])   ||
        isString(predicate) && !(predicateId = ids[predicate]) ||
        isString(object)    && !(objectId    = ids[object]))
      return quads;

    for (var graphId in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (content = graphs[graphId]) {
        // Choose the optimal index, based on what fields are present
        if (subjectId) {
          if (objectId)
            // If subject and object are given, the object index will be the fastest
            this._findInIndex(content.objects, objectId, subjectId, predicateId,
                              'object', 'subject', 'predicate', graphId, null, quads);
          else
            // If only subject and possibly predicate are given, the subject index will be the fastest
            this._findInIndex(content.subjects, subjectId, predicateId, null,
                              'subject', 'predicate', 'object', graphId, null, quads);
        }
        else if (predicateId)
          // If only predicate and possibly object are given, the predicate index will be the fastest
          this._findInIndex(content.predicates, predicateId, objectId, null,
                            'predicate', 'object', 'subject', graphId, null, quads);
        else if (objectId)
          // If only object is given, the object index will be the fastest
          this._findInIndex(content.objects, objectId, null, null,
                            'object', 'subject', 'predicate', graphId, null, quads);
        else
          // If nothing is given, iterate subjects and predicates first
          this._findInIndex(content.subjects, null, null, null,
                            'subject', 'predicate', 'object', graphId, null, quads);
      }
    }
    return quads;
  },

  // ### `countTriples` returns the number of triples matching a pattern, expanding prefixes as necessary.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  countTriples: function (subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.countTriplesByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `countTriplesByIRI` returns the number of triples matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  countTriplesByIRI: function (subject, predicate, object, graph) {
    var count = 0, graphs = this._getGraphs(graph), content,
        ids = this._ids, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (isString(subject)   && !(subjectId   = ids[subject])   ||
        isString(predicate) && !(predicateId = ids[predicate]) ||
        isString(object)    && !(objectId    = ids[object]))
      return 0;

    for (var graphId in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (content = graphs[graphId]) {
        // Choose the optimal index, based on what fields are present
        if (subject) {
          if (object)
            // If subject and object are given, the object index will be the fastest
            count += this._countInIndex(content.objects, objectId, subjectId, predicateId);
          else
            // If only subject and possibly predicate are given, the subject index will be the fastest
            count += this._countInIndex(content.subjects, subjectId, predicateId, objectId);
        }
        else if (predicate) {
          // If only predicate and possibly object are given, the predicate index will be the fastest
          count += this._countInIndex(content.predicates, predicateId, objectId, subjectId);
        }
        else {
          // If only object is possibly given, the object index will be the fastest
          count += this._countInIndex(content.objects, objectId, subjectId, predicateId);
        }
      }
    }
    return count;
  },

  // ### `forEach` executes the callback on all triples.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forEach: function (callback, subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    this.forEachByIRI(
      callback,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `forEachByIRI` executes the callback on all triples.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forEachByIRI: function (callback, subject, predicate, object, graph) {
    this.someByIRI(function (quad) {
      callback(quad);
      return false;
    }, subject, predicate, object, graph);
  },

  // ### `every` executes the callback on all triples,
  // and returns `true` if it returns truthy for all them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  every: function (callback, subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.everyByIRI(
      callback,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `everyByIRI` executes the callback on all triples,
  // and returns `true` if it returns truthy for all them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  everyByIRI: function (callback, subject, predicate, object, graph) {
    var some = false;
    var every = !this.someByIRI(function (quad) {
      some = true;
      return !callback(quad);
    }, subject, predicate, object, graph);
    return some && every;
  },

  // ### `some` executes the callback on all triples,
  // and returns `true` if it returns truthy for any of them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  some: function (callback, subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.someByIRI(
      callback,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `someByIRI` executes the callback on all triples,
  // and returns `true` if it returns truthy for any of them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  someByIRI: function (callback, subject, predicate, object, graph) {
    var graphs = this._getGraphs(graph), content,
        ids = this._ids, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (isString(subject)   && !(subjectId   = ids[subject])   ||
        isString(predicate) && !(predicateId = ids[predicate]) ||
        isString(object)    && !(objectId    = ids[object]))
      return false;

    for (var graphId in graphs) {
      // Only if the specified graph contains triples, there can be result
      if (content = graphs[graphId]) {
        // Choose the optimal index, based on what fields are present
        if (subjectId) {
          if (objectId) {
          // If subject and object are given, the object index will be the fastest
            if (this._findInIndex(content.objects, objectId, subjectId, predicateId,
                                  'object', 'subject', 'predicate', graphId, callback, null))
              return true;
          }
          else
            // If only subject and possibly predicate are given, the subject index will be the fastest
            if (this._findInIndex(content.subjects, subjectId, predicateId, null,
                                  'subject', 'predicate', 'object', graphId, callback, null))
              return true;
        }
        else if (predicateId) {
          // If only predicate and possibly object are given, the predicate index will be the fastest
          if (this._findInIndex(content.predicates, predicateId, objectId, null,
                                'predicate', 'object', 'subject', graphId, callback, null)) {
            return true;
          }
        }
        else if (objectId) {
          // If only object is given, the object index will be the fastest
          if (this._findInIndex(content.objects, objectId, null, null,
                                'object', 'subject', 'predicate', graphId, callback, null)) {
            return true;
          }
        }
        else
        // If nothing is given, iterate subjects and predicates first
        if (this._findInIndex(content.subjects, null, null, null,
                              'subject', 'predicate', 'object', graphId, callback, null)) {
          return true;
        }
      }
    }
    return false;
  },

  // ### `getSubjects` returns all subjects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getSubjects: function (predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.getSubjectsByIRI(
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `getSubjectsByIRI` returns all subjects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getSubjectsByIRI: function (predicate, object, graph) {
    var results = [];
    this.forSubjectsByIRI(function (s) { results.push(s); }, predicate, object, graph);
    return results;
  },

  // ### `forSubjects` executes the callback on all subjects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forSubjects: function (callback, predicate, object, graph) {
    var prefixes = this._prefixes;
    this.forSubjectsByIRI(
      callback,
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `forSubjectsByIRI` executes the callback on all subjects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forSubjectsByIRI: function (callback, predicate, object, graph) {
    var ids = this._ids, graphs = this._getGraphs(graph), content, predicateId, objectId;
    callback = this._uniqueEntities(callback);

    // Translate IRIs to internal index keys.
    if (isString(predicate) && !(predicateId = ids[predicate]) ||
        isString(object)    && !(objectId    = ids[object]))
      return;

    for (graph in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (content = graphs[graph]) {
        // Choose optimal index based on which fields are wildcards
        if (predicateId) {
          if (objectId)
            // If predicate and object are given, the POS index is best.
            this._loopBy2Keys(content.predicates, predicateId, objectId, callback);
          else
            // If only predicate is given, the SPO index is best.
            this._loopByKey1(content.subjects, predicateId, callback);
        }
        else if (objectId)
          // If only object is given, the OSP index is best.
          this._loopByKey0(content.objects, objectId, callback);
        else
          // If no params given, iterate all the subjects
          this._loop(content.subjects, callback);
      }
    }
  },

  // ### `getPredicates` returns all predicates that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getPredicates: function (subject, object, graph) {
    var prefixes = this._prefixes;
    return this.getPredicatesByIRI(
      expandPrefixedName(subject, prefixes),
      expandPrefixedName(object,  prefixes),
      expandPrefixedName(graph,   prefixes)
    );
  },

  // ### `getPredicatesByIRI` returns all predicates that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getPredicatesByIRI: function (subject, object, graph) {
    var results = [];
    this.forPredicatesByIRI(function (p) { results.push(p); }, subject, object, graph);
    return results;
  },

  // ### `forPredicates` executes the callback on all predicates that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forPredicates: function (callback, subject, object, graph) {
    var prefixes = this._prefixes;
    this.forPredicatesByIRI(
      callback,
      expandPrefixedName(subject, prefixes),
      expandPrefixedName(object,  prefixes),
      expandPrefixedName(graph,   prefixes)
    );
  },

  // ### `forPredicatesByIRI` executes the callback on all predicates that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forPredicatesByIRI: function (callback, subject, object, graph) {
    var ids = this._ids, graphs = this._getGraphs(graph), content, subjectId, objectId;
    callback = this._uniqueEntities(callback);

    // Translate IRIs to internal index keys.
    if (isString(subject) && !(subjectId = ids[subject]) ||
        isString(object)  && !(objectId  = ids[object]))
      return;

    for (graph in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (content = graphs[graph]) {
        // Choose optimal index based on which fields are wildcards
        if (subjectId) {
          if (objectId)
            // If subject and object are given, the OSP index is best.
            this._loopBy2Keys(content.objects, objectId, subjectId, callback);
          else
            // If only subject is given, the SPO index is best.
            this._loopByKey0(content.subjects, subjectId, callback);
        }
        else if (objectId)
          // If only object is given, the POS index is best.
          this._loopByKey1(content.predicates, objectId, callback);
        else
          // If no params given, iterate all the predicates.
          this._loop(content.predicates, callback);
      }
    }
  },

  // ### `getObjects` returns all objects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getObjects: function (subject, predicate, graph) {
    var prefixes = this._prefixes;
    return this.getObjectsByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `getObjectsByIRI` returns all objects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getObjectsByIRI: function (subject, predicate, graph) {
    var results = [];
    this.forObjectsByIRI(function (o) { results.push(o); }, subject, predicate, graph);
    return results;
  },

  // ### `forObjects` executes the callback on all objects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forObjects: function (callback, subject, predicate, graph) {
    var prefixes = this._prefixes;
    this.forObjectsByIRI(
      callback,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `forObjectsByIRI` executes the callback on all objects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forObjectsByIRI: function (callback, subject, predicate, graph) {
    var ids = this._ids, graphs = this._getGraphs(graph), content, subjectId, predicateId;
    callback = this._uniqueEntities(callback);

    // Translate IRIs to internal index keys.
    if (isString(subject)   && !(subjectId   = ids[subject]) ||
        isString(predicate) && !(predicateId = ids[predicate]))
      return;

    for (graph in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (content = graphs[graph]) {
        // Choose optimal index based on which fields are wildcards
        if (subjectId) {
          if (predicateId)
            // If subject and predicate are given, the SPO index is best.
            this._loopBy2Keys(content.subjects, subjectId, predicateId, callback);
          else
            // If only subject is given, the OSP index is best.
            this._loopByKey1(content.objects, subjectId, callback);
        }
        else if (predicateId)
          // If only predicate is given, the POS index is best.
          this._loopByKey0(content.predicates, predicateId, callback);
        else
          // If no params given, iterate all the objects.
          this._loop(content.objects, callback);
      }
    }
  },

  // ### `getGraphs` returns all graphs that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getGraphs: function (subject, predicate, object) {
    var prefixes = this._prefixes;
    return this.getGraphsByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes)
    );
  },

  // ### `getGraphsByIRI` returns all graphs that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getGraphsByIRI: function (subject, predicate, object) {
    var results = [];
    this.forGraphsByIRI(function (g) { results.push(g); }, subject, predicate, object);
    return results;
  },

  // ### `forGraphs` executes the callback on all graphs that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forGraphs: function (callback, subject, predicate, object) {
    var prefixes = this._prefixes;
    this.forGraphsByIRI(
      callback,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes)
    );
  },

  // ### `forGraphsByIRI` executes the callback on all graphs that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forGraphsByIRI: function (callback, subject, predicate, object) {
    for (var graph in this._graphs) {
      this.someByIRI(function (quad) {
        callback(quad.graph);
        return true; // Halt iteration of some()
      }, subject, predicate, object, graph);
    }
  },

  // ### `createBlankNode` creates a new blank node, returning its name
  createBlankNode: function (suggestedName) {
    var name, index;
    // Generate a name based on the suggested name
    if (suggestedName) {
      name = suggestedName = '_:' + suggestedName, index = 1;
      while (this._ids[name])
        name = suggestedName + index++;
    }
    // Generate a generic blank node name
    else {
      do { name = '_:b' + this._blankNodeIndex++; }
      while (this._ids[name]);
    }
    // Add the blank node to the entities, avoiding the generation of duplicates
    this._ids[name] = ++this._id;
    this._entities[this._id] = name;
    return name;
  },
};

// Determines whether the argument is a string
function isString(s) {
  return typeof s === 'string' || s instanceof String;
}

// ## Exports
module.exports = N3Store;
