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

  // // ### `_findInIndex` finds a set of triples in a three-layered index.
  // // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // // Any of these keys can be undefined, which is interpreted as a wildcard.
  // // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // // used when reconstructing the resulting triple
  // // (for instance: _subject_, _predicate_, and _object_).
  // // Finally, `graph` will be the graph of the created triples.
  // _findInIndex: function (index0, key0, key1, key2, name0, name1, name2, graph) {
  //   var results = [], tmp, index1, index2, varCount = !key0 + !key1 + !key2,
  //       // depending on the number of variables, keys or reverse index are faster
  //       entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

  //   // If a key is specified, use only that part of index 0
  //   if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
  //   for (var value0 in index0) {
  //     var entity0 = entityKeys[value0];

  //     if (index1 = index0[value0]) {
  //       // If a key is specified, use only that part of index 1
  //       if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
  //       for (var value1 in index1) {
  //         var entity1 = entityKeys[value1];

  //         if (index2 = index1[value1]) {
  //           // If a key is specified, use only that part of index 2, if it exists
  //           var values = key2 ? (key2 in index2 ? [key2] : []) : Object.keys(index2);
  //           // Create triples for all items found in index 2
  //           for (var l = values.length - 1; l >= 0; l--) {
  //             var result = { subject: '', predicate: '', object: '', graph: graph };
  //             result[name0] = entity0;
  //             result[name1] = entity1;
  //             result[name2] = entityKeys[values[l]];
  //             results.push(result);
  //           }
  //         }
  //       }
  //     }
  //   }
  //   return results;
  // },

  // _someInIndex: function (index0, key0, key1, key2, name0, name1, name2, graph, fn) {
  //   var tmp, index1, index2, varCount = !key0 + !key1 + !key2,
  //       // depending on the number of variables, keys or reverse index are faster
  //       entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

  //   // If a key is specified, use only that part of index 0.
  //   if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
  //   for (var value0 in index0) {
  //     var entity0 = entityKeys[value0];

  //     if (index1 = index0[value0]) {
  //       // If a key is specified, use only that part of index 1.
  //       if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
  //       for (var value1 in index1) {
  //         var entity1 = entityKeys[value1];

  //         if (index2 = index1[value1]) {
  //           // If a key is specified, use only that part of index 2, if it exists.
  //           var values = key2 ? (key2 in index2 ? [key2] : []) : Object.keys(index2);
  //           // Create triples for all items found in index 2.
  //           for (var l = values.length - 1; l >= 0; l--) {
  //             var result = { subject: '', predicate: '', object: '', graph: graph };
  //             result[name0] = entity0;
  //             result[name1] = entity1;
  //             result[name2] = entityKeys[values[l]];
  //             if (fn(result)) {
  //               return true;
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }
  //   return false;
  // },

  _index2KeysGivenKey0And1: function (index0, key0, key1, fn) {
    var index1, index2, key2;
    if (!(index1 = index0[key0])) return;
    if (!(index2 = index1[key1])) return;
    for (key2 in index2)
      fn(key2);
  },

  _index1KeysGivenKey0: function (index0, key0, fn) {
    var index1, key1;
    if (!(index1 = index0[key0])) return;
    for (key1 in index1)
      fn(key1);
  },

  _index0KeysGivenKey1: function (index0, key1, fn) {
    var key0, index1;
    for (key0 in index0) {
      index1 = index0[key0];
      if (index1[key1])
        fn(key0);
    }
  },

  _index0Keys: function (index0, fn) {
    for (var key0 in index0)
      fn(key0);
  },

  // Lookup, lookup, lookup
  _indexSomeGivenAllKeys: function (index0, key0, key1, key2, name0, name1, name2, graph, fn) {
    var varCount = !key0 + !key1 + !key2,
        // depending on the number of variables, keys or reverse index are faster
        entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

    // It turns out that varCount is actually a count of null parameters.
    // We always have a null parameter count of 0.
    var entityKeys = this._entities;

    // console.log('given all keys, varCount ', varCount);

    // Lookup
    if (key0 in index0) {
      var index1 = index0[key0];
      // Lookup
      if (key1 in index1) {
        var index2 = index1[key1];
        // Lookup
        if (key2 in index2) {
          var entity0 = entityKeys[key0];
          var entity1 = entityKeys[key1];
          var entity2 = entityKeys[key2];
          var result = { subject: '', predicate: '', object: '', graph: graph };
          result[name0] = entity0;
          result[name1] = entity1;
          result[name2] = entity2;
          // We can just return the fn result - we're not looping
          return fn(result);
        }
      }
    }
    return false;
  },

  // Lookup, lookup, loop
  _indexSomeGivenKey0And1: function (index0, key0, key1, name0, name1, name2, graph, fn) {
    // var varCount = !key0 + !key1 + !key2,
    //     // depending on the number of variables, keys or reverse index are faster
    //     entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

    // It turns out that varCount is actually a count of null parameters.
    // We always have a null parameter count of 1.
    var entityKeys = this._entities;

    // console.log('given key0and1, varCount ', varCount);

    // Lookup
    if (key0 in index0) {
      var index1 = index0[key0];
      // Lookup
      if (key1 in index1) {
        var index2 = index1[key1];
        var entity0 = entityKeys[key0];
        var entity1 = entityKeys[key1];
        var values = Object.keys(index2);
        // Loop
        for (var l = values.length - 1; l >= 0; l--) {
          var result = { subject: '', predicate: '', object: '', graph: graph };
          result[name0] = entity0;
          result[name1] = entity1;
          result[name2] = entityKeys[values[l]];
          if (fn(result)) {
            return true;
          }
        }
      }
    }
    return false;
  },

  // Lookup, loop, loop
  _indexSomeGivenKey0: function (index0, key0, name0, name1, name2, graph, fn) {
    // var varCount = !key0 + !key1 + !key2,
    //     // depending on the number of variables, keys or reverse index are faster
    //     entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

    // It turns out that varCount is actually a count of null parameters.
    // We always have a null parameter count of 2.
    var entityKeys = Object.keys(this._ids); // Fastest - according to above rule

    // var entityKeys = this._entities; // But I'm actually not seeing much difference at all?

    // console.log('given key0, varCount ', varCount);

    // TODO(js) This is the method that /appears/ to be performing more slowly than before.

    // Lookup
    if (key0 in index0) {
      var index1 = index0[key0];
      var entity0 = entityKeys[key0];
      // Loop
      for (var key1 in index1) {
        var index2 = index1[key1];
        var entity1 = entityKeys[key1];
        var values = Object.keys(index2);
        // Loop
        for (var l = values.length - 1; l >= 0; l--) {
          var result = { subject: '', predicate: '', object: '', graph: graph };
          result[name0] = entity0;
          result[name1] = entity1;
          result[name2] = entityKeys[values[l]];
          if (fn(result)) {
            return true;
          }
        }
      }
    }
    return false;
  },

  // Loop, loop, loop
  _indexSomeGivenNoKeys: function (index0, name0, name1, name2, graph, fn) {
    // var varCount = !key0 + !key1 + !key2,
    //     // depending on the number of variables, keys or reverse index are faster
    //     entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

    // It turns out that varCount is actually a count of null parameters.
    // We always have a null parameter count of 3.
    var entityKeys = Object.keys(this._ids);

    // console.log('no keys, varCount ', varCount);

    // Loop
    for (var key0 in index0) {
      var index1 = index0[key0];
      var entity0 = entityKeys[key0];
      // Loop
      for (var key1 in index1) {
        var index2 = index1[key1];
        var entity1 = entityKeys[key1];
        var values = Object.keys(index2);
        // Loop
        for (var l = values.length - 1; l >= 0; l--) {
          var result = { subject: '', predicate: '', object: '', graph: graph };
          result[name0] = entity0;
          result[name1] = entity1;
          result[name2] = entityKeys[values[l]];
          if (fn(result)) {
            return true;
          }
        }
      }
    }
    return false;
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
    var graphItem, ids = this._ids, graphs = this._graphs;
    if (!(subject   = ids[subject]))   return false;
    if (!(predicate = ids[predicate])) return false;
    if (!(object    = ids[object]))    return false;
    if (!(graphItem = graphs[graph]))  return false;

    // Verify that the triple exists
    var subjects, predicates;
    if (!(subjects   = graphItem.subjects[subject])) return false;
    if (!(predicates = subjects[predicate])) return false;
    if (!(object in predicates)) return false;

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

  // ### `find` finds a set of triples matching a pattern, expanding prefixes as necessary.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  find: function (subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.findByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // // ### `findByIRI` finds a set of triples matching a pattern.
  // // Setting any field to `undefined` or `null` indicates a wildcard.
  // findByIRI: function (subject, predicate, object, graph) {
  //   var quads = [], graphs = {}, graphContents,
  //       ids = this._ids, subjectId, predicateId, objectId;
  //   // Either loop over all graphs, or over just one selected graph
  //   if (!isString(graph))
  //     graphs = this._graphs;
  //   else
  //     graphs[graph] = this._graphs[graph];

  //   // Translate IRIs to internal index keys.
  //   // Optimization: if the entity doesn't exist, no triples with it exist.
  //   if (isString(subject)   && !(subjectId   = ids[subject]))   return quads;
  //   if (isString(predicate) && !(predicateId = ids[predicate])) return quads;
  //   if (isString(object)    && !(objectId    = ids[object]))    return quads;

  //   for (var graphId in graphs) {
  //     // Only if the specified graph contains triples, there can be results
  //     if (graphContents = graphs[graphId]) {
  //       // Choose the optimal index, based on what fields are present
  //       if (subjectId) {
  //         if (objectId)
  //         // If subject and object are given, the object index will be the fastest
  //           quads.push(this._findInIndex(graphContents.objects, objectId, subjectId, predicateId,
  //                                        'object', 'subject', 'predicate', graphId));
  //         else
  //         // If only subject and possibly predicate are given, the subject index will be the fastest
  //           quads.push(this._findInIndex(graphContents.subjects, subjectId, predicateId, null,
  //                                        'subject', 'predicate', 'object', graphId));
  //       }
  //       else if (predicateId)
  //       // If only predicate and possibly object are given, the predicate index will be the fastest
  //         quads.push(this._findInIndex(graphContents.predicates, predicateId, objectId, null,
  //                                      'predicate', 'object', 'subject', graphId));
  //       else if (objectId)
  //       // If only object is given, the object index will be the fastest
  //         quads.push(this._findInIndex(graphContents.objects, objectId, null, null,
  //                                      'object', 'subject', 'predicate', graphId));
  //       else
  //       // If nothing is given, iterate subjects and predicates first
  //         quads.push(this._findInIndex(graphContents.subjects, null, null, null,
  //                                      'subject', 'predicate', 'object', graphId));
  //     }
  //   }
  //   return quads.length === 1 ? quads[0] : quads.concat.apply([], quads);
  // },

  findByIRI: function (subject, predicate, object, graph) {
    var out = [];
    this.someByIRI(function (q) {
      out.push(q);
      return false;
    }, subject, predicate, object, graph);
    return out;
  },

  // ### `count` returns the number of triples matching a pattern, expanding prefixes as necessary.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  count: function (subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.countByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  // ### `countByIRI` returns the number of triples matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  countByIRI: function (subject, predicate, object, graph) {
    var count = 0, graphs = {}, graphContents,
        ids = this._ids, subjectId, predicateId, objectId;
    // Either loop over all graphs, or over just one selected graph
    if (!isString(graph))
      graphs = this._graphs;
    else
      graphs[graph] = this._graphs[graph];

    // Translate IRIs to internal index keys.
    // Optimization: if the entity doesn't exist, no triples with it exist.
    if (isString(subject)   && !(subjectId   = ids[subject]))   return 0;
    if (isString(predicate) && !(predicateId = ids[predicate])) return 0;
    if (isString(object)    && !(objectId    = ids[object]))    return 0;

    for (var graphId in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (graphContents = graphs[graphId]) {
        // Choose the optimal index, based on what fields are present
        if (subject) {
          if (object)
            // If subject and object are given, the object index will be the fastest
            count += this._countInIndex(graphContents.objects, objectId, subjectId, predicateId);
          else
            // If only subject and possibly predicate are given, the subject index will be the fastest
            count += this._countInIndex(graphContents.subjects, subjectId, predicateId, objectId);
        }
        else if (predicate) {
          // If only predicate and possibly object are given, the predicate index will be the fastest
          count += this._countInIndex(graphContents.predicates, predicateId, objectId, subjectId);
        }
        else {
          // If only object is possibly given, the object index will be the fastest
          count += this._countInIndex(graphContents.objects, objectId, subjectId, predicateId);
        }
      }
    }
    return count;
  },

  forEach: function (fn, subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    this.forEachByIRI(
      fn,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  forEachByIRI: function (fn, subject, predicate, object, graph) {
    this.someByIRI(function (quad) {
      fn(quad);
      return false;
    }, subject, predicate, object, graph);
  },

  every: function (fn, subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.everyByIRI(
      fn,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  everyByIRI: function (fn, subject, predicate, object, graph) {
    var some = false;
    var every = !this.someByIRI(function (quad) {
      some = true;
      return !fn(quad);
    }, subject, predicate, object, graph);
    if (!some) {
      return false;
    }
    return every;
  },

  some: function (fn, subject, predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.someByIRI(
      fn,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },


  someByIRI: function (fn, subject, predicate, object, graph) {
    var graphs = {}, graphContents,
        ids = this._ids, sid, pid, oid;
    // Either loop over all graphs, or over just one selected graph
    if (!isString(graph))
      graphs = this._graphs;
    else
      graphs[graph] = this._graphs[graph];

    // Translate IRIs to internal index keys.
    // Optimization: if the entity doesn't exist, no triples with it exist.
    if (isString(subject)   && !(sid = ids[subject]))   return false;
    if (isString(predicate) && !(pid = ids[predicate])) return false;
    if (isString(object)    && !(oid = ids[object]))    return false;

    for (var graphId in graphs) {
      // Only if the specified graph contains triples, there can be result
      if (graphContents = graphs[graphId]) {
        // // Do not emit the default graph explicitly
        // if (graphId === DEFAULT_GRAPH)
        //   graphId = '';

        // Choose the optimal index, based on what fields are present
        // if (subjectId) {
        //   if (objectId) {
        //   // If subject and object are given, the object index will be the fastest
        //     if (this._someInIndex(graphContents.objects, objectId, subjectId, predicateId,
        //                           'object', 'subject', 'predicate', graphId, fn))
        //       return true;
        //   }
        //   else
        //     // If only subject and possibly predicate are given, the subject index will be the fastest
        //     if (this._someInIndex(graphContents.subjects, subjectId, predicateId, null,
        //                           'subject', 'predicate', 'object', graphId, fn))
        //       return true;
        // }
        // else if (predicateId) {
        //   // If only predicate and possibly object are given, the predicate index will be the fastest
        //   if (this._someInIndex(graphContents.predicates, predicateId, objectId, null,
        //                         'predicate', 'object', 'subject', graphId, fn)) {
        //     return true;
        //   }
        // }
        // else if (objectId) {
        //   // If only object is given, the object index will be the fastest
        //   if (this._someInIndex(graphContents.objects, objectId, null, null,
        //                         'object', 'subject', 'predicate', graphId, fn)) {
        //     return true;
        //   }
        // }
        // else
        // // If nothing is given, iterate subjects and predicates first
        // if (this._someInIndex(graphContents.subjects, null, null, null,
        //                       'subject', 'predicate', 'object', graphId, fn)) {
        //   return true;
        // }

        if (sid) {
          if (pid) {
            if (oid) {
              // s = nz : p = nz : o = nz
              if (this._indexSomeGivenAllKeys(graphContents.subjects, sid, pid, oid, 'subject', 'predicate', 'object', graphId, fn)) return true;
            } else {
              // s = nz : p = nz : o = z
              if (this._indexSomeGivenKey0And1(graphContents.subjects, sid, pid, 'subject', 'predicate', 'object', graphId, fn)) return true;
            }
          } else {
            if (oid) {
              // s = nz : p = z : o = nz
              if (this._indexSomeGivenKey0And1(graphContents.objects, oid, sid, 'object', 'subject', 'predicate', graphId, fn)) return true;
            } else {
              // s = nz : p = z : o = z
              if (this._indexSomeGivenKey0(graphContents.subjects, sid, 'subject', 'predicate', 'object', graphId, fn)) return true;
            }
          }
        } else {
          if (pid) {
            if (oid) {
              // s = z : p = nz : o = nz
              if (this._indexSomeGivenKey0And1(graphContents.predicates, pid, oid, 'predicate', 'object', 'subject', graphId, fn)) return true;
            } else {
              // s = z : p = nz : o = z
              if (this._indexSomeGivenKey0(graphContents.predicates, pid, 'predicate', 'object', 'subject', graphId, fn)) return true;
            }
          } else {
            if (oid) {
              // s = z : p = z : o = nz
              if (this._indexSomeGivenKey0(graphContents.objects, oid, 'object', 'subject', 'predicate', graphId, fn)) return true;
            } else {
              // s = z : p = z : o = z
              if (this._indexSomeGivenNoKeys(graphContents.subjects, 'subject', 'predicate', 'object', graphId, fn)) return true;
            }
          }
        }
      }
    }
    return false;
  },

  findGraphs: function (subject, predicate, object) {
    var prefixes = this._prefixes;
    return this.findGraphsByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes)
    );
  },

  findGraphsByIRI: function (subject, predicate, object) {
    var out = [];
    this.forGraphsByIRI(function (g) {
      out.push(g);
    }, subject, predicate, object);
    return out;
  },

  forGraphs: function (fn, subject, predicate, object) {
    var prefixes = this._prefixes;
    this.forGraphsByIRI(
      fn,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes)
    );
  },

  forGraphsByIRI: function (fn, subject, predicate, object) {
    for (var graph in this._graphs) {
      this.someByIRI(function (quad) {
        fn(quad.graph);
        return true; // Halt iteration of some()
      }, subject, predicate, object, graph);
    }
  },

  findSubjects: function (predicate, object, graph) {
    var prefixes = this._prefixes;
    return this.findSubjectsByIRI(
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  findSubjectsByIRI: function (predicate, object, graph) {
    var out = [];
    this.forSubjectsByIRI(function (s) {
      out.push(s);
    }, predicate, object, graph);
    return out;
  },

  forSubjects: function (fn, predicate, object, graph) {
    var prefixes = this._prefixes;
    this.forSubjectsByIRI(
      fn,
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(object,    prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  forSubjectsByIRI: function (fn, predicate, object, graph) {
    var seen = {}, ids = this._ids, graphs = {}, graphContents,
        entityKeys = this._entities, predicateId, objectId;

    // Either loop over all graphs, or over just one selected graph
    if (!isString(graph))
      graphs = this._graphs;
    else
      graphs[graph] = this._graphs[graph];

    // Translate IRIs to internal index keys.
    // Optimization: if the entity doesn't exist, no triples with it exist.
    if (isString(predicate) && !(predicateId = ids[predicate])) return;
    if (isString(object)    && !(objectId    = ids[object]))    return;

    function handleResultsFn(id) {
      if (!(id in seen)) {
        seen[id] = null;
        fn(entityKeys[id]);
      }
    }

    for (graph in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (graphContents = graphs[graph]) {
        // We want to list all subjects.
        // The three index choices are: SPO POS OSP.

        // Choose optimal index based on which fields are wildcards
        if (predicateId) {
          if (objectId)
            // If predicate and object are given, the POS index is best.
            // Lookup p, lookup o, loop s.
            this._index2KeysGivenKey0And1(graphContents.predicates, predicateId, objectId, handleResultsFn);
          else
            // If only predicate is given, the SPO index is best.
            // Loop s, lookup p.
            this._index0KeysGivenKey1(graphContents.subjects, predicateId, handleResultsFn);
        }
        else if (objectId)
          // If only object is given, the OSP index is best.
          // Lookup o, loop s.
          this._index1KeysGivenKey0(graphContents.objects, objectId, handleResultsFn);
        else
          // If no params given, iterate all the subjects
          this._index0Keys(graphContents.subjects, handleResultsFn);
      }
    }
  },

  findPredicates: function (subject, object, graph) {
    var prefixes = this._prefixes;
    return this.findPredicatesByIRI(
      expandPrefixedName(subject, prefixes),
      expandPrefixedName(object,  prefixes),
      expandPrefixedName(graph,   prefixes)
    );
  },

  findPredicatesByIRI: function (subject, object, graph) {
    var out = [];
    this.forPredicatesByIRI(function (p) {
      out.push(p);
    }, subject, object, graph);
    return out;
  },

  forPredicates: function (fn, subject, object, graph) {
    var prefixes = this._prefixes;
    this.forPredicatesByIRI(
      fn,
      expandPrefixedName(subject, prefixes),
      expandPrefixedName(object,  prefixes),
      expandPrefixedName(graph,   prefixes)
    );
  },

  forPredicatesByIRI: function (fn, subject, object, graph) {
    var seen = {}, ids = this._ids, graphs = {}, graphContents,
        entityKeys = this._entities, subjectId, objectId;

    // Either loop over all graphs, or over just one selected graph
    if (!isString(graph))
      graphs = this._graphs;
    else
      graphs[graph] = this._graphs[graph];

    // Translate IRIs to internal index keys.
    // Optimization: if the entity doesn't exist, no triples with it exist.
    if (isString(subject) && !(subjectId = ids[subject])) return;
    if (isString(object)  && !(objectId  = ids[object]))  return;

    function handleResultsFn(id) {
      if (!(id in seen)) {
        seen[id] = null;
        fn(entityKeys[id]);
      }
    }

    for (graph in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (graphContents = graphs[graph]) {
        // We want to list all predicates.
        // The three index choices are: SPO POS OSP.

        // Choose optimal index based on which fields are wildcards
        if (subjectId) {
          if (objectId)
            // If subject and object are given, the OSP index is best.
            // Lookup o, lookup s, loop p.
            this._index2KeysGivenKey0And1(graphContents.objects, objectId, subjectId, handleResultsFn);
          else
            // If only subject is given, the SPO index is best.
            // lookup s, loop p.
            this._index1KeysGivenKey0(graphContents.subjects, subjectId, handleResultsFn);
        }
        else if (objectId)
          // If only object is given, the POS index is best.
          // Loop p, lookup o.
          this._index0KeysGivenKey1(graphContents.predicates, objectId, handleResultsFn);
        else
          // If no params given, iterate all the predicates.
          this._index0Keys(graphContents.predicates, handleResultsFn);
      }
    }
  },

  findObjects: function (subject, predicate, graph) {
    var prefixes = this._prefixes;
    return this.findObjectsByIRI(
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  findObjectsByIRI: function (subject, predicate, graph) {
    var out = [];
    this.forObjectsByIRI(function (o) {
      out.push(o);
    }, subject, predicate, graph);
    return out;
  },

  forObjects: function (fn, subject, predicate, graph) {
    var prefixes = this._prefixes;
    this.forObjectsByIRI(
      fn,
      expandPrefixedName(subject,   prefixes),
      expandPrefixedName(predicate, prefixes),
      expandPrefixedName(graph,     prefixes)
    );
  },

  forObjectsByIRI: function (fn, subject, predicate, graph) {
    var seen = {}, ids = this._ids, graphs = {}, graphContents,
        entityKeys = this._entities, subjectId, predicateId;

    // Either loop over all graphs, or over just one selected graph
    if (!isString(graph))
      graphs = this._graphs;
    else
      graphs[graph] = this._graphs[graph];

    // Translate IRIs to internal index keys.
    // Optimization: if the entity doesn't exist, no triples with it exist.
    if (isString(subject)   && !(subjectId   = ids[subject]))   return;
    if (isString(predicate) && !(predicateId = ids[predicate])) return;

    function handleResultsFn(id) {
      if (!(id in seen)) {
        seen[id] = null;
        fn(entityKeys[id]);
      }
    }

    for (graph in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (graphContents = graphs[graph]) {
        // We want to list all predicates.
        // The three index choices are: SPO POS OSP.

        // Choose optimal index based on which fields are wildcards
        if (subjectId) {
          if (predicateId)
            // If subject and predicate are given, the SPO index is best.
            // Lookup s, lookup p, loop o.
            this._index2KeysGivenKey0And1(graphContents.subjects, subjectId, predicateId, handleResultsFn);
          else
            // If only subject is given, the OSP index is best.
            // loop o, lookup s.
            this._index0KeysGivenKey1(graphContents.objects, subjectId, handleResultsFn);
        }
        else if (predicateId)
          // If only predicate is given, the POS index is best.
          // Looukp p, loop o.
          this._index1KeysGivenKey0(graphContents.predicates, predicateId, handleResultsFn);
        else
          // If no params given, iterate all the objects.
          this._index0Keys(graphContents.objects, handleResultsFn);
      }
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
