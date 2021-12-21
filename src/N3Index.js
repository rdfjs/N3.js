/* eslint-disable no-warning-comments */
// TODO: Remove the above eslint-disable comment before making a PR.
import { termToId, termFromId } from './N3DataFactory';

// Determines whether the argument is a string
function isString(s) {
  return typeof s === 'string' || s instanceof String;
}

/**
 * A three-layered index.
 */
export default class N3Index {
  constructor(config) {
    // The number of quads is initially zero
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

    this._factory = config.factory;
  }

  // ## Public properties

  // ### `size` returns the number of quads in the store
  get size() {
    // Return the quad count if if was cached
    let size = this._size;
    if (size !== null)
      return size;

    // Calculate the number of quads by counting to the deepest level
    size = 0;
    const graphs = this._graphs;
    let subjects, subject;
    for (const graphKey in graphs)
      for (const subjectKey in (subjects = graphs[graphKey].subjects))
        for (const predicateKey in (subject = subjects[subjectKey]))
          size += Object.keys(subject[predicateKey]).length;
    return this._size = size;
  }

  // ## Public methods

  // ### `addQuad` adds a new quad to the store.
  // Returns if the quad index has changed, if the quad did not already exist.
  addQuad(subject, predicate, object, graph) {
    // TODO: Move this shift into N3Store.
    // Shift arguments if a quad object is given instead of components
    if (!predicate)
      graph = subject.graph, object = subject.object,
        predicate = subject.predicate, subject = subject.subject;

    // Convert terms to internal string representation
    subject = termToId(subject);
    predicate = termToId(predicate);
    object = termToId(object);
    graph = termToId(graph);

    // Find the graph that will contain the triple
    let graphItem = this._graphs[graph];
    // Create the graph if it doesn't exist yet
    if (!graphItem) {
      // TODO: See if converting the following object literal to a TermsIndex class has
      // any benefit.
      graphItem = this._graphs[graph] = { subjects: {}, predicates: {}, objects: {} };
      // Freezing a graph helps subsequent `add` performance,
      // and properties will never be modified anyway
      Object.freeze(graphItem);
    }

    // Since entities can often be long IRIs, we avoid storing them in every index.
    // Instead, we have a separate index that maps entities to numbers,
    // which are then used as keys in the other indexes.
    const ids = this._ids;
    const entities = this._entities;
    subject   = ids[subject]   || (ids[entities[++this._id] = subject]   = this._id);
    predicate = ids[predicate] || (ids[entities[++this._id] = predicate] = this._id);
    object    = ids[object]    || (ids[entities[++this._id] = object]    = this._id);

    const changed = this._addToIndex(graphItem.subjects, subject, predicate, object);
    this._addToIndex(graphItem.predicates, predicate, object, subject);
    this._addToIndex(graphItem.objects, object, subject, predicate);

    // The cached quad count is now invalid
    this._size = null;
    return changed;
  }

  // ### `countQuads` returns the number of quads matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  countQuads(subject, predicate, object, graph) {
    // Convert terms to internal string representation
    subject = subject && termToId(subject);
    predicate = predicate && termToId(predicate);
    object = object && termToId(object);
    graph = graph && termToId(graph);

    const graphs = this._getGraphs(graph), ids = this._ids;
    let count = 0, content, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (isString(subject)   && !(subjectId   = ids[subject])   ||
        isString(predicate) && !(predicateId = ids[predicate]) ||
        isString(object)    && !(objectId    = ids[object]))
      return 0;

    for (const graphId in graphs) {
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
  }

  createBlankNode(suggestedName) {
    let name, index;
    // Generate a name based on the suggested name
    if (suggestedName) {
      name = suggestedName = `_:${suggestedName}`, index = 1;
      while (this._ids[name])
        name = suggestedName + index++;
    }
    // Generate a generic blank node name
    else {
      do { name = `_:b${this._blankNodeIndex++}`; }
      while (this._ids[name]);
    }
    // Add the blank node to the entities, avoiding the generation of duplicates
    this._ids[name] = ++this._id;
    this._entities[this._id] = name;
    return this._factory.blankNode(name.substr(2));
  }

  // ### `forSubjects` executes the callback on all subjects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forSubjects(callback, predicate, object, graph) {
    // Convert terms to internal string representation
    predicate = predicate && termToId(predicate);
    object = object && termToId(object);
    graph = graph && termToId(graph);

    const ids = this._ids, graphs = this._getGraphs(graph);
    let content, predicateId, objectId;
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
  }

  // ### `forPredicates` executes the callback on all predicates that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forPredicates(callback, subject, object, graph) {
    // Convert terms to internal string representation
    subject = subject && termToId(subject);
    object = object && termToId(object);
    graph = graph && termToId(graph);

    const ids = this._ids, graphs = this._getGraphs(graph);
    let content, subjectId, objectId;
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
  }

  // ### `forObjects` executes the callback on all objects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forObjects(callback, subject, predicate, graph) {
    // Convert terms to internal string representation
    subject = subject && termToId(subject);
    predicate = predicate && termToId(predicate);
    graph = graph && termToId(graph);

    const ids = this._ids, graphs = this._getGraphs(graph);
    let content, subjectId, predicateId;
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
  }

  // ### `forGraphs` executes the callback on all graphs that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forGraphs(callback, subject, predicate, object) {
    for (const graph in this._graphs) {
      this.some(quad => {
        callback(quad.graph);
        return true; // Halt iteration of some()
      }, subject, predicate, object, graph);
    }
  }

  // ### `getQuads` returns an array of quads matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getQuads(subject, predicate, object, graph) {
    // Convert terms to internal string representation
    subject = subject && termToId(subject);
    predicate = predicate && termToId(predicate);
    object = object && termToId(object);
    graph = graph && termToId(graph);

    const quads = [], graphs = this._getGraphs(graph), ids = this._ids;
    let content, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (isString(subject)   && !(subjectId   = ids[subject])   ||
        isString(predicate) && !(predicateId = ids[predicate]) ||
        isString(object)    && !(objectId    = ids[object]))
      return quads;

    for (const graphId in graphs) {
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
  }

  // ### `removeQuad` removes a quad from the store if it exists
  removeQuad(subject, predicate, object, graph) {
    // TODO: Move this shift into N3Store.
    // Shift arguments if a quad object is given instead of components
    if (!predicate)
      graph = subject.graph, object = subject.object,
        predicate = subject.predicate, subject = subject.subject;

    // Convert terms to internal string representation
    subject = termToId(subject);
    predicate = termToId(predicate);
    object = termToId(object);
    graph = termToId(graph);

    // Find internal identifiers for all components
    // and verify the quad exists.
    const ids = this._ids, graphs = this._graphs;
    let graphItem, subjects, predicates;
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
  }

  // ### `some` executes the callback on all quads,
  // and returns `true` if it returns truthy for any of them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  some(callback, subject, predicate, object, graph) {
    // Convert terms to internal string representation
    subject = subject && termToId(subject);
    predicate = predicate && termToId(predicate);
    object = object && termToId(object);
    graph = graph && termToId(graph);

    const graphs = this._getGraphs(graph), ids = this._ids;
    let content, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (isString(subject)   && !(subjectId   = ids[subject])   ||
        isString(predicate) && !(predicateId = ids[predicate]) ||
        isString(object)    && !(objectId    = ids[object]))
      return false;

    for (const graphId in graphs) {
      // Only if the specified graph contains triples, there can be results
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
  }

  // ## Protected methods

  // ### `_addToIndex` adds a quad to a three-layered index.
  // Returns if the index has changed, if the entry did not already exist.
  _addToIndex(index0, key0, key1, key2) {
    // Create layers as necessary
    const index1 = index0[key0] || (index0[key0] = {});
    const index2 = index1[key1] || (index1[key1] = {});
    // Setting the key to _any_ value signals the presence of the quad
    const existed = key2 in index2;
    if (!existed)
      index2[key2] = null;
    return !existed;
  }

  // ### `_countInIndex` counts matching quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  _countInIndex(index0, key0, key1, key2) {
    let count = 0, tmp, index1, index2;

    // If a key is specified, count only that part of index 0
    if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
    for (const value0 in index0) {
      if (index1 = index0[value0]) {
        // If a key is specified, count only that part of index 1
        if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
        for (const value1 in index1) {
          if (index2 = index1[value1]) {
            // If a key is specified, count the quad if it exists
            if (key2) (key2 in index2) && count++;
            // Otherwise, count all quads
            else count += Object.keys(index2).length;
          }
        }
      }
    }
    return count;
  }

  // ### `_findInIndex` finds a set of quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // used when reconstructing the resulting quad
  // (for instance: _subject_, _predicate_, and _object_).
  // Finally, `graph` will be the graph of the created quads.
  // If `callback` is given, each result is passed through it
  // and iteration halts when it returns truthy for any quad.
  // If instead `array` is given, each result is added to the array.
  _findInIndex(index0, key0, key1, key2, name0, name1, name2, graph, callback, array) {
    let tmp, index1, index2;
    // TODO: See if Object.keys(this._ids) should be optimized. this._ids only changes
    // in addQuad and removeQuad. What are the performance implications if a Map is
    // used instead of JS objects? Will difference between get, set, remove outweigh
    // perf improvement of Map#size compared to Object.keys(obj)#length?
    // Depending on the number of variables, keys or reverse index are faster
    const varCount = !key0 + !key1 + !key2,
        entityKeys = varCount > 1 ? Object.keys(this._ids) : this._entities;

    // If a key is specified, use only that part of index 0.
    if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
    for (const value0 in index0) {
      // TODO: Move entity0 into the next if.
      const entity0 = entityKeys[value0];

      if (index1 = index0[value0]) {
        // If a key is specified, use only that part of index 1.
        if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
        for (const value1 in index1) {
          // TODO: Move entity1 into the next if.
          const entity1 = entityKeys[value1];

          if (index2 = index1[value1]) {
            // If a key is specified, use only that part of index 2, if it exists.
            const values = key2 ? (key2 in index2 ? [key2] : []) : Object.keys(index2);
            // Create quads for all items found in index 2.
            for (let l = 0; l < values.length; l++) {
              const parts = { subject: null, predicate: null, object: null };
              // TODO: Only call termFromId once for each term if it can be done efficiently.
              parts[name0] = termFromId(entity0, this._factory);
              parts[name1] = termFromId(entity1, this._factory);
              parts[name2] = termFromId(entityKeys[values[l]], this._factory);

              // TODO: Convert this to a generator function and yield each quad, but yield
              // quad tuples if that is more efficient.
              const quad = this._factory.quad(
                // TODO: Only call termFromId once for each graph.
                parts.subject, parts.predicate, parts.object, termFromId(graph, this._factory));
              if (array)
                array.push(quad);
              else if (callback(quad))
                return true;
            }
          }
        }
      }
    }
    return array;
  }

  // ### `_getGraphs` returns an array with the given graph,
  // or all graphs if the argument is null or undefined.
  _getGraphs(graph) {
    if (!isString(graph))
      return this._graphs;
    const graphs = {};
    graphs[graph] = this._graphs[graph];
    return graphs;
  }

  // ### `_loop` executes the callback on all keys of index 0
  _loop(index0, callback) {
    for (const key0 in index0)
      callback(key0);
  }

  // ### `_loopByKey0` executes the callback on all keys of a certain entry in index 0
  _loopByKey0(index0, key0, callback) {
    let index1, key1;
    if (index1 = index0[key0]) {
      for (key1 in index1)
        callback(key1);
    }
  }

  // ### `_loopByKey1` executes the callback on given keys of all entries in index 0
  _loopByKey1(index0, key1, callback) {
    let key0, index1;
    for (key0 in index0) {
      index1 = index0[key0];
      if (index1[key1])
        callback(key0);
    }
  }

  // ### `_loopBy2Keys` executes the callback on given keys of certain entries in index 2
  _loopBy2Keys(index0, key0, key1, callback) {
    let index1, index2, key2;
    if ((index1 = index0[key0]) && (index2 = index1[key1])) {
      for (key2 in index2)
        callback(key2);
    }
  }

  // ### `_removeFromIndex` removes a quad from a three-layered index
  _removeFromIndex(index0, key0, key1, key2) {
    // Remove the quad from the index
    const index1 = index0[key0], index2 = index1[key1];
    delete index2[key2];

    // Remove intermediary index layers if they are empty
    for (const key in index2) return;
    delete index1[key1];
    for (const key in index1) return;
    delete index0[key0];
  }

  // ### `_uniqueEntities` returns a function that accepts an entity ID
  // and passes the corresponding entity to callback if it hasn't occurred before.
  _uniqueEntities(callback) {
    const uniqueIds = Object.create(null);
    return id => {
      if (!(id in uniqueIds)) {
        uniqueIds[id] = true;
        callback(termFromId(this._entities[id], this._factory));
      }
    };
  }
}
