// **N3Store** objects store N3 quads by graph in memory.
import { Readable } from 'readable-stream';
import { default as N3DataFactory, termToId, termFromId } from './N3DataFactory';
import namespaces from './IRIs';
import { isDefaultGraph } from './N3Util';
import N3Writer from './N3Writer';

const ITERATOR = Symbol('iter');

function merge(target, source, depth = 4) {
  if (depth === 0)
    return Object.assign(target, source);

  for (const key in source)
    target[key] = merge(target[key] || Object.create(null), source[key], depth - 1);

  return target;
}

/**
 * Determines the intersection of the `_graphs` index s1 and s2.
 * s1 and s2 *must* belong to Stores that share an `_entityIndex`.
 *
 * False is returned when there is no intersection; this should
 * *not* be set as the value for an index.
 */
function intersect(s1, s2, depth = 4) {
  let target = false;

  for (const key in s1) {
    if (key in s2) {
      const intersection = depth === 0 ? null : intersect(s1[key], s2[key], depth - 1);
      if (intersection !== false) {
        target = target || Object.create(null);
        target[key] = intersection;
      }
      // Depth 3 is the 'subjects', 'predicates' and 'objects' keys.
      // If the 'subjects' index is empty, so will the 'predicates' and 'objects' index.
      else if (depth === 3) {
        return false;
      }
    }
  }

  return target;
}

/**
 * Determines the difference of the `_graphs` index s1 and s2.
 * s1 and s2 *must* belong to Stores that share an `_entityIndex`.
 *
 * False is returned when there is no difference; this should
 * *not* be set as the value for an index.
 */
function difference(s1, s2, depth = 4) {
  let target = false;

  for (const key in s1) {
    // When the key is not in the index, then none of the triples defined by s1[key] are
    // in s2 and so we want to copy them over to the resultant store.
    if (!(key in s2)) {
      target = target || Object.create(null);
      target[key] = depth === 0 ? null : merge({}, s1[key], depth - 1);
    }
    else if (depth !== 0) {
      const diff = difference(s1[key], s2[key], depth - 1);
      if (diff !== false) {
        target = target || Object.create(null);
        target[key] = diff;
      }
      // Depth 3 is the 'subjects', 'predicates' and 'objects' keys.
      // If the 'subjects' index is empty, so will the 'predicates' and 'objects' index.
      else if (depth === 3) {
        return false;
      }
    }
  }

  return target;
}

// ## Constructor
export class N3EntityIndex {
  constructor(options = {}) {
    this._id = 1;
    // `_ids` maps entities such as `http://xmlns.com/foaf/0.1/name` to numbers,
    // saving memory by using only numbers as keys in `_graphs`
    this._ids = Object.create(null);
    this._ids[''] = 1;
     // inverse of `_ids`
    this._entities = Object.create(null);
    this._entities[1] = '';
    // `_blankNodeIndex` is the index of the last automatically named blank node
    this._blankNodeIndex = 0;
    this._factory = options.factory || N3DataFactory;
  }

  _termFromId(id) {
    if (id[0] === '.') {
      const entities = this._entities;
      const terms = id.split('.');
      const q = this._factory.quad(
        this._termFromId(entities[terms[1]]),
        this._termFromId(entities[terms[2]]),
        this._termFromId(entities[terms[3]]),
        terms[4] && this._termFromId(entities[terms[4]]),
      );
      return q;
    }
    return termFromId(id, this._factory);
  }

  _termToNumericId(term) {
    if (term.termType === 'Quad') {
      const s = this._termToNumericId(term.subject),
          p = this._termToNumericId(term.predicate),
          o = this._termToNumericId(term.object);
      let g;

      return s && p && o && (isDefaultGraph(term.graph) || (g = this._termToNumericId(term.graph))) &&
        this._ids[g ? `.${s}.${p}.${o}.${g}` : `.${s}.${p}.${o}`];
    }
    return this._ids[termToId(term)];
  }

  _termToNewNumericId(term) {
    // This assumes that no graph term is present - we may wish to error if there is one
    const str = term && term.termType === 'Quad' ?
      `.${this._termToNewNumericId(term.subject)}.${this._termToNewNumericId(term.predicate)}.${this._termToNewNumericId(term.object)}${
        isDefaultGraph(term.graph) ? '' : `.${this._termToNewNumericId(term.graph)}`
      }`
      : termToId(term);

    return this._ids[str] || (this._ids[this._entities[++this._id] = str] = this._id);
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
}

// ## Constructor
export default class N3Store {
  constructor(quads, options) {
    // The number of quads is initially zero
    this._size = 0;
    // `_graphs` contains subject, predicate, and object indexes per graph
    this._graphs = Object.create(null);

    // Shift parameters if `quads` is not given
    if (!options && quads && !quads[0] && !(typeof quads.match === 'function'))
      options = quads, quads = null;
    options = options || {};
    this._factory = options.factory || N3DataFactory;
    this._entityIndex = options.entityIndex || new N3EntityIndex({ factory: this._factory });
    this._entities = this._entityIndex._entities;
    this._termFromId = this._entityIndex._termFromId.bind(this._entityIndex);
    this._termToNumericId = this._entityIndex._termToNumericId.bind(this._entityIndex);
    this._termToNewNumericId = this._entityIndex._termToNewNumericId.bind(this._entityIndex);

    // Add quads if passed
    if (quads)
      this.addAll(quads);
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

  // ## Private methods

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

  // ### `_findInIndex` finds a set of quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // Any of these keys can be undefined, which is interpreted as a wildcard.
  // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // used when reconstructing the resulting quad
  // (for instance: _subject_, _predicate_, and _object_).
  // Finally, `graphId` will be the graph of the created quads.
  *_findInIndex(index0, key0, key1, key2, name0, name1, name2, graphId) {
    let tmp, index1, index2;
    const entityKeys = this._entities;
    const graph = this._termFromId(entityKeys[graphId]);
    const parts = { subject: null, predicate: null, object: null };

    // If a key is specified, use only that part of index 0.
    if (key0) (tmp = index0, index0 = {})[key0] = tmp[key0];
    for (const value0 in index0) {
      if (index1 = index0[value0]) {
        parts[name0] = this._termFromId(entityKeys[value0]);
        // If a key is specified, use only that part of index 1.
        if (key1) (tmp = index1, index1 = {})[key1] = tmp[key1];
        for (const value1 in index1) {
          if (index2 = index1[value1]) {
            parts[name1] = this._termFromId(entityKeys[value1]);
            // If a key is specified, use only that part of index 2, if it exists.
            const values = key2 ? (key2 in index2 ? [key2] : []) : Object.keys(index2);
            // Create quads for all items found in index 2.
            for (let l = 0; l < values.length; l++) {
              parts[name2] = this._termFromId(entityKeys[values[l]]);
              yield this._factory.quad(parts.subject, parts.predicate, parts.object, graph);
            }
          }
        }
      }
    }
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

  // ### `_getGraphs` returns an array with the given graph,
  // or all graphs if the argument is null or undefined.
  _getGraphs(graph) {
    graph = graph === '' ? 1 : (graph && (this._termToNumericId(graph) || -1));
    return typeof graph !== 'number' ? this._graphs : { [graph]: this._graphs[graph] };
  }

  // ### `_uniqueEntities` returns a function that accepts an entity ID
  // and passes the corresponding entity to callback if it hasn't occurred before.
  _uniqueEntities(callback) {
    const uniqueIds = Object.create(null);
    return id => {
      if (!(id in uniqueIds)) {
        uniqueIds[id] = true;
        callback(this._termFromId(this._entities[id], this._factory));
      }
    };
  }

  // ## Public methods

  // ### `add` adds the specified quad to the dataset.
  // Returns the dataset instance it was called on.
  // Existing quads, as defined in Quad.equals, will be ignored.
  add(quad) {
    this.addQuad(quad);
    return this;
  }

  // ### `addQuad` adds a new quad to the store.
  // Returns if the quad index has changed, if the quad did not already exist.
  addQuad(subject, predicate, object, graph) {
    // Shift arguments if a quad object is given instead of components
    if (!predicate)
      graph = subject.graph, object = subject.object,
        predicate = subject.predicate, subject = subject.subject;

    // Convert terms to internal string representation
    graph = graph ? this._termToNewNumericId(graph) : 1;

    // Find the graph that will contain the triple
    let graphItem = this._graphs[graph];
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
    subject   = this._termToNewNumericId(subject);
    predicate = this._termToNewNumericId(predicate);
    object    = this._termToNewNumericId(object);

    if (!this._addToIndex(graphItem.subjects,   subject,   predicate, object))
      return false;
    this._addToIndex(graphItem.predicates, predicate, object,    subject);
    this._addToIndex(graphItem.objects,    object,    subject,   predicate);

    // The cached quad count is now invalid
    this._size = null;
    return true;
  }

  // ### `addQuads` adds multiple quads to the store
  addQuads(quads) {
    for (let i = 0; i < quads.length; i++)
      this.addQuad(quads[i]);
  }

  // ### `delete` removes the specified quad from the dataset.
  // Returns the dataset instance it was called on.
  delete(quad) {
    this.removeQuad(quad);
    return this;
  }

  // ### `has` determines whether a dataset includes a certain quad or quad pattern.
  has(subjectOrQuad, predicate, object, graph) {
    if (subjectOrQuad && subjectOrQuad.subject)
      ({ subject: subjectOrQuad, predicate, object, graph } = subjectOrQuad);
    return !this.readQuads(subjectOrQuad, predicate, object, graph).next().done;
  }

  // ### `import` adds a stream of quads to the store
  import(stream) {
    stream.on('data', quad => { this.addQuad(quad); });
    return stream;
  }

  // ### `removeQuad` removes a quad from the store if it exists
  removeQuad(subject, predicate, object, graph) {
    // Shift arguments if a quad object is given instead of components
    if (!predicate)
      ({ subject, predicate, object, graph } = subject);
    // Convert terms to internal string representation
    graph = graph ? this._termToNumericId(graph) : 1;

    // Find internal identifiers for all components
    // and verify the quad exists.
    const graphs = this._graphs;
    let graphItem, subjects, predicates;
    if (!(subject    = subject && this._termToNumericId(subject)) || !(predicate = predicate && this._termToNumericId(predicate)) ||
        !(object     = object && this._termToNumericId(object))  || !(graphItem = graphs[graph])  ||
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

  // ### `removeQuads` removes multiple quads from the store
  removeQuads(quads) {
    for (let i = 0; i < quads.length; i++)
      this.removeQuad(quads[i]);
  }

  // ### `remove` removes a stream of quads from the store
  remove(stream) {
    stream.on('data', quad => { this.removeQuad(quad); });
    return stream;
  }

  // ### `removeMatches` removes all matching quads from the store
  // Setting any field to `undefined` or `null` indicates a wildcard.
  removeMatches(subject, predicate, object, graph) {
    const stream = new Readable({ objectMode: true });

    const iterable = this.readQuads(subject, predicate, object, graph);
    stream._read = size => {
      while (--size >= 0) {
        const { done, value } = iterable.next();
        if (done) {
          stream.push(null);
          return;
        }
        stream.push(value);
      }
    };

    return this.remove(stream);
  }

  // ### `deleteGraph` removes all triples with the given graph from the store
  deleteGraph(graph) {
    return this.removeMatches(null, null, null, graph);
  }

  // ### `getQuads` returns an array of quads matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getQuads(subject, predicate, object, graph) {
    return [...this.readQuads(subject, predicate, object, graph)];
  }

  /**
   * `readQuads` returns a generator of quads matching a pattern.
   * Setting any field to `undefined` or `null` indicates a wildcard.
   * @deprecated Use `match` instead.
   */
  *readQuads(subject, predicate, object, graph) {
    const graphs = this._getGraphs(graph);
    let content, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (subject   && !(subjectId   = this._termToNumericId(subject))   ||
        predicate && !(predicateId = this._termToNumericId(predicate)) ||
        object    && !(objectId    = this._termToNumericId(object)))
      return;

    for (const graphId in graphs) {
      // Only if the specified graph contains triples, there can be results
      if (content = graphs[graphId]) {
        // Choose the optimal index, based on what fields are present
        if (subjectId) {
          if (objectId)
            // If subject and object are given, the object index will be the fastest
            yield* this._findInIndex(content.objects, objectId, subjectId, predicateId,
                              'object', 'subject', 'predicate', graphId);
          else
            // If only subject and possibly predicate are given, the subject index will be the fastest
            yield* this._findInIndex(content.subjects, subjectId, predicateId, null,
                              'subject', 'predicate', 'object', graphId);
        }
        else if (predicateId)
          // If only predicate and possibly object are given, the predicate index will be the fastest
          yield* this._findInIndex(content.predicates, predicateId, objectId, null,
                            'predicate', 'object', 'subject', graphId);
        else if (objectId)
          // If only object is given, the object index will be the fastest
          yield* this._findInIndex(content.objects, objectId, null, null,
                            'object', 'subject', 'predicate', graphId);
        else
          // If nothing is given, iterate subjects and predicates first
          yield* this._findInIndex(content.subjects, null, null, null,
                            'subject', 'predicate', 'object', graphId);
      }
    }
  }

  // ### `match` returns a new dataset that is comprised of all quads in the current instance matching the given arguments.
  // The logic described in Quad Matching is applied for each quad in this dataset to check if it should be included in the output dataset.
  // Note: This method always returns a new DatasetCore, even if that dataset contains no quads.
  // Note: Since a DatasetCore is an unordered set, the order of the quads within the returned sequence is arbitrary.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  // For backwards compatibility, the object return also implements the Readable stream interface.
  match(subject, predicate, object, graph) {
    return new DatasetCoreAndReadableStream(this, subject, predicate, object, graph, { entityIndex: this._entityIndex });
  }

  // ### `countQuads` returns the number of quads matching a pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  countQuads(subject, predicate, object, graph) {
    const graphs = this._getGraphs(graph);
    let count = 0, content, subjectId, predicateId, objectId;

    // Translate IRIs to internal index keys.
    if (subject   && !(subjectId   = this._termToNumericId(subject))   ||
        predicate && !(predicateId = this._termToNumericId(predicate)) ||
        object    && !(objectId    = this._termToNumericId(object)))
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

  // ### `forEach` executes the callback on all quads.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forEach(callback, subject, predicate, object, graph) {
    this.some(quad => {
      callback(quad, this);
      return false;
    }, subject, predicate, object, graph);
  }

  // ### `every` executes the callback on all quads,
  // and returns `true` if it returns truthy for all them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  every(callback, subject, predicate, object, graph) {
    return !this.some(quad => !callback(quad, this), subject, predicate, object, graph);
  }

  // ### `some` executes the callback on all quads,
  // and returns `true` if it returns truthy for any of them.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  some(callback, subject, predicate, object, graph) {
    for (const quad of this.readQuads(subject, predicate, object, graph))
      if (callback(quad, this))
        return true;
    return false;
  }

  // ### `getSubjects` returns all subjects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getSubjects(predicate, object, graph) {
    const results = [];
    this.forSubjects(s => { results.push(s); }, predicate, object, graph);
    return results;
  }

  // ### `forSubjects` executes the callback on all subjects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forSubjects(callback, predicate, object, graph) {
    const graphs = this._getGraphs(graph);
    let content, predicateId, objectId;
    callback = this._uniqueEntities(callback);

    // Translate IRIs to internal index keys.
    if (predicate && !(predicateId = this._termToNumericId(predicate)) ||
        object    && !(objectId    = this._termToNumericId(object)))
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

  // ### `getPredicates` returns all predicates that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getPredicates(subject, object, graph) {
    const results = [];
    this.forPredicates(p => { results.push(p); }, subject, object, graph);
    return results;
  }

  // ### `forPredicates` executes the callback on all predicates that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forPredicates(callback, subject, object, graph) {
    const graphs = this._getGraphs(graph);
    let content, subjectId, objectId;
    callback = this._uniqueEntities(callback);

    // Translate IRIs to internal index keys.
    if (subject   && !(subjectId   = this._termToNumericId(subject))   ||
        object    && !(objectId    = this._termToNumericId(object)))
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

  // ### `getObjects` returns all objects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getObjects(subject, predicate, graph) {
    const results = [];
    this.forObjects(o => { results.push(o); }, subject, predicate, graph);
    return results;
  }

  // ### `forObjects` executes the callback on all objects that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forObjects(callback, subject, predicate, graph) {
    const graphs = this._getGraphs(graph);
    let content, subjectId, predicateId;
    callback = this._uniqueEntities(callback);

    // Translate IRIs to internal index keys.
    if (subject   && !(subjectId   = this._termToNumericId(subject))   ||
        predicate && !(predicateId = this._termToNumericId(predicate)))
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

  // ### `getGraphs` returns all graphs that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  getGraphs(subject, predicate, object) {
    const results = [];
    this.forGraphs(g => { results.push(g); }, subject, predicate, object);
    return results;
  }

  // ### `forGraphs` executes the callback on all graphs that match the pattern.
  // Setting any field to `undefined` or `null` indicates a wildcard.
  forGraphs(callback, subject, predicate, object) {
    for (const graph in this._graphs) {
      this.some(quad => {
        callback(quad.graph);
        return true; // Halt iteration of some()
      }, subject, predicate, object, this._termFromId(this._entities[graph]));
    }
  }

  // ### `createBlankNode` creates a new blank node, returning its name
  createBlankNode(suggestedName) {
    return this._entityIndex.createBlankNode(suggestedName);
  }

  // ### `extractLists` finds and removes all list triples
  // and returns the items per list.
  extractLists({ remove = false, ignoreErrors = false } = {}) {
    const lists = {}; // has scalar keys so could be a simple Object
    const onError = ignoreErrors ? (() => true) :
                  ((node, message) => { throw new Error(`${node.value} ${message}`); });

    // Traverse each list from its tail
    const tails = this.getQuads(null, namespaces.rdf.rest, namespaces.rdf.nil, null);
    const toRemove = remove ? [...tails] : [];
    tails.forEach(tailQuad => {
      const items = [];             // the members found as objects of rdf:first quads
      let malformed = false;      // signals whether the current list is malformed
      let head;                   // the head of the list (_:b1 in above example)
      let headPos;                // set to subject or object when head is set
      const graph = tailQuad.graph; // make sure list is in exactly one graph

      // Traverse the list from tail to end
      let current = tailQuad.subject;
      while (current && !malformed) {
        const objectQuads = this.getQuads(null, null, current, null);
        const subjectQuads = this.getQuads(current, null, null, null);
        let quad, first = null, rest = null, parent = null;

        // Find the first and rest of this list node
        for (let i = 0; i < subjectQuads.length && !malformed; i++) {
          quad = subjectQuads[i];
          if (!quad.graph.equals(graph))
            malformed = onError(current, 'not confined to single graph');
          else if (head)
            malformed = onError(current, 'has non-list arcs out');

          // one rdf:first
          else if (quad.predicate.value === namespaces.rdf.first) {
            if (first)
              malformed = onError(current, 'has multiple rdf:first arcs');
            else
              toRemove.push(first = quad);
          }

          // one rdf:rest
          else if (quad.predicate.value === namespaces.rdf.rest) {
            if (rest)
              malformed = onError(current, 'has multiple rdf:rest arcs');
            else
              toRemove.push(rest = quad);
          }

          // alien triple
          else if (objectQuads.length)
            malformed = onError(current, 'can\'t be subject and object');
          else {
            head = quad; // e.g. { (1 2 3) :p :o }
            headPos = 'subject';
          }
        }

        // { :s :p (1 2) } arrives here with no head
        // { (1 2) :p :o } arrives here with head set to the list.
        for (let i = 0; i < objectQuads.length && !malformed; ++i) {
          quad = objectQuads[i];
          if (head)
            malformed = onError(current, 'can\'t have coreferences');
          // one rdf:rest
          else if (quad.predicate.value === namespaces.rdf.rest) {
            if (parent)
              malformed = onError(current, 'has incoming rdf:rest arcs');
            else
              parent = quad;
          }
          else {
            head = quad; // e.g. { :s :p (1 2) }
            headPos = 'object';
          }
        }

        // Store the list item and continue with parent
        if (!first)
          malformed = onError(current, 'has no list head');
        else
          items.unshift(first.object);
        current = parent && parent.subject;
      }

      // Don't remove any quads if the list is malformed
      if (malformed)
        remove = false;
      // Store the list under the value of its head
      else if (head)
        lists[head[headPos].value] = items;
    });

    // Remove list quads if requested
    if (remove)
      this.removeQuads(toRemove);
    return lists;
  }

  /**
   * Returns `true` if the current dataset is a superset of the given dataset; in other words, returns `true` if
   * the given dataset is a subset of, i.e., is contained within, the current dataset.
   *
   * Blank Nodes will be normalized.
   */
  addAll(quads) {
    if (quads instanceof DatasetCoreAndReadableStream)
      quads = quads.filtered;

    if (Array.isArray(quads))
      this.addQuads(quads);
    else if (quads instanceof N3Store && quads._entityIndex === this._entityIndex) {
      if (quads._size !== 0) {
        this._graphs = merge(this._graphs, quads._graphs);
        this._size = null; // Invalidate the cached size
      }
    }
    else {
      for (const quad of quads)
        this.add(quad);
    }
    return this;
  }

  /**
   * Returns `true` if the current dataset is a superset of the given dataset; in other words, returns `true` if
   * the given dataset is a subset of, i.e., is contained within, the current dataset.
   *
   * Blank Nodes will be normalized.
   */
  contains(other) {
    if (other instanceof DatasetCoreAndReadableStream)
      other = other.filtered;

    if (other === this)
      return true;

    if (!(other instanceof N3Store) || this._entityIndex !== other._entityIndex)
      return other.every(quad => this.has(quad));

    const g1 = this._graphs, g2 = other._graphs;
    let s1, s2, p1, p2, o1;
    for (const graph in g2) {
      if (!(s1 = g1[graph])) return false;
      s1 = s1.subjects;
      for (const subject in (s2 = g2[graph].subjects)) {
        if (!(p1 = s1[subject])) return false;
        for (const predicate in (p2 = s2[subject])) {
          if (!(o1 = p1[predicate])) return false;
          for (const object in p2[predicate])
            if (!(object in o1)) return false;
        }
      }
    }
    return true;
  }

  /**
   * This method removes the quads in the current dataset that match the given arguments.
   *
   * The logic described in {@link https://rdf.js.org/dataset-spec/#quad-matching|Quad Matching} is applied for each
   * quad in this dataset, to select the quads which will be deleted.
   *
   * @param subject   The optional exact subject to match.
   * @param predicate The optional exact predicate to match.
   * @param object    The optional exact object to match.
   * @param graph     The optional exact graph to match.
   */
  deleteMatches(subject, predicate, object, graph) {
    for (const quad of this.match(subject, predicate, object, graph))
      this.removeQuad(quad);
    return this;
  }

  /**
   * Returns a new dataset that contains all quads from the current dataset that are not included in the given dataset.
   */
  difference(other) {
    if (other && other instanceof DatasetCoreAndReadableStream)
      other = other.filtered;

    if (other === this)
      return new N3Store({ entityIndex: this._entityIndex });

    if ((other instanceof N3Store) && other._entityIndex === this._entityIndex) {
      const store = new N3Store({ entityIndex: this._entityIndex });
      const graphs = difference(this._graphs, other._graphs);
      if (graphs) {
        store._graphs = graphs;
        store._size = null;
      }
      return store;
    }

    return this.filter(quad => !other.has(quad));
  }

  /**
   * Returns true if the current dataset contains the same graph structure as the given dataset.
   *
   * Blank Nodes will be normalized.
   */
  equals(other) {
    if (other instanceof DatasetCoreAndReadableStream)
      other = other.filtered;

    return other === this || (this.size === other.size && this.contains(other));
  }

  /**
   * Creates a new dataset with all the quads that pass the test implemented by the provided `iteratee`.
   *
   * This method is aligned with Array.prototype.filter() in ECMAScript-262.
   */
  filter(iteratee) {
    const store = new N3Store({ entityIndex: this._entityIndex });
    for (const quad of this)
      if (iteratee(quad, this))
        store.add(quad);
    return store;
  }

  /**
   * Returns a new dataset containing all quads from the current dataset that are also included in the given dataset.
   */
  intersection(other) {
    if (other instanceof DatasetCoreAndReadableStream)
      other = other.filtered;

    if (other === this) {
      const store = new N3Store({ entityIndex: this._entityIndex });
      store._graphs = merge(Object.create(null), this._graphs);
      store._size = this._size;
      return store;
    }
    else if ((other instanceof N3Store) && this._entityIndex === other._entityIndex) {
      const store = new N3Store({ entityIndex: this._entityIndex });
      const graphs = intersect(other._graphs, this._graphs);
      if (graphs) {
        store._graphs = graphs;
        store._size = null;
      }
      return store;
    }

    return this.filter(quad => other.has(quad));
  }

  /**
   * Returns a new dataset containing all quads returned by applying `iteratee` to each quad in the current dataset.
   */
  map(iteratee) {
    const store = new N3Store({ entityIndex: this._entityIndex });
    for (const quad of this)
      store.add(iteratee(quad, this));
    return store;
  }

  /**
   * This method calls the `iteratee` method on each `quad` of the `Dataset`. The first time the `iteratee` method
   * is called, the `accumulator` value is the `initialValue`, or, if not given, equals the first quad of the `Dataset`.
   * The return value of each call to the `iteratee` method is used as the `accumulator` value for the next call.
   *
   * This method returns the return value of the last `iteratee` call.
   *
   * This method is aligned with `Array.prototype.reduce()` in ECMAScript-262.
   */
  reduce(callback, initialValue) {
    const iter = this.readQuads();
    let accumulator = initialValue === undefined ? iter.next().value : initialValue;
    for (const quad of iter)
      accumulator = callback(accumulator, quad, this);
    return accumulator;
  }

  /**
   * Returns the set of quads within the dataset as a host-language-native sequence, for example an `Array` in
   * ECMAScript-262.
   *
   * Since a `Dataset` is an unordered set, the order of the quads within the returned sequence is arbitrary.
   */
  toArray() {
    return this.getQuads();
  }

  /**
   * Returns an N-Quads string representation of the dataset, preprocessed with the
   * {@link https://json-ld.github.io/normalization/spec/|RDF Dataset Normalization} algorithm.
   */
  toCanonical() {
    throw new Error('not implemented');
  }

  /**
   * Returns a stream that contains all quads of the dataset.
   */
  toStream() {
    return this.match();
  }

  /**
   * Returns an N-Quads string representation of the dataset.
   *
   * No prior normalization is required, therefore the results for the same quads may vary depending on the `Dataset`
   * implementation.
   */
  toString() {
    return (new N3Writer()).quadsToString(this);
  }

  /**
   * Returns a new `Dataset` that is a concatenation of this dataset and the quads given as an argument.
   */
  union(quads) {
    const store = new N3Store({ entityIndex: this._entityIndex });
    store._graphs = merge(Object.create(null), this._graphs);
    store._size = this._size;

    store.addAll(quads);
    return store;
  }

  // ### Store is an iterable.
  // Can be used where iterables are expected: for...of loops, array spread operator,
  // `yield*`, and destructuring assignment (order is not guaranteed).
  *[Symbol.iterator]() {
    yield* this.readQuads();
  }
}

/**
 * Returns a subset of the `index` with that part of the index
 * matching the `ids` array. `ids` contains 3 elements that are
 * either numerical ids; or `null`.
 *
 * `false` is returned when there are no matching indices; this should
 * *not* be set as the value for an index.
 */
function indexMatch(index, ids, depth = 0) {
  const ind = ids[depth];
  if (ind && !(ind in index))
    return false;

  let target = false;
  for (const key in (ind ? { [ind]: index[ind] } : index)) {
    const result = depth === 2 ? null : indexMatch(index[key], ids, depth + 1);

    if (result !== false) {
      target = target || Object.create(null);
      target[key] = result;
    }
  }
  return target;
}

/**
 * A class that implements both DatasetCore and Readable.
 */
class DatasetCoreAndReadableStream extends Readable {
  constructor(n3Store, subject, predicate, object, graph, options) {
    super({ objectMode: true });
    Object.assign(this, { n3Store, subject, predicate, object, graph, options });
  }

  get filtered() {
    if (!this._filtered) {
      const { n3Store, graph, object, predicate, subject } = this;
      const newStore = this._filtered = new N3Store({ factory: n3Store._factory, entityIndex: this.options.entityIndex });

      let subjectId, predicateId, objectId;

      // Translate IRIs to internal index keys.
      if (subject   && !(subjectId   = newStore._termToNumericId(subject))   ||
          predicate && !(predicateId = newStore._termToNumericId(predicate)) ||
          object    && !(objectId    = newStore._termToNumericId(object)))
        return newStore;

      const graphs = n3Store._getGraphs(graph);
      for (const graphKey in graphs) {
        let subjects, predicates, objects, content;
        if (content = graphs[graphKey]) {
          if (!subjectId && predicateId) {
            if (predicates = indexMatch(content.predicates, [predicateId, objectId, subjectId])) {
              subjects = indexMatch(content.subjects, [subjectId, predicateId, objectId]);
              objects = indexMatch(content.objects, [objectId, subjectId, predicateId]);
            }
          }
          else if (objectId) {
            if (objects = indexMatch(content.objects, [objectId, subjectId, predicateId])) {
              subjects = indexMatch(content.subjects, [subjectId, predicateId, objectId]);
              predicates = indexMatch(content.predicates, [predicateId, objectId, subjectId]);
            }
          }
          else if (subjects = indexMatch(content.subjects, [subjectId, predicateId, objectId])) {
            predicates = indexMatch(content.predicates, [predicateId, objectId, subjectId]);
            objects = indexMatch(content.objects, [objectId, subjectId, predicateId]);
          }

          if (subjects)
            newStore._graphs[graphKey] = { subjects, predicates, objects };
        }
      }
      newStore._size = null;
    }
    return this._filtered;
  }

  get size() {
    return this.filtered.size;
  }

  _read(size) {
    if (size > 0 && !this[ITERATOR])
      this[ITERATOR] = this[Symbol.iterator]();
    const iterable = this[ITERATOR];
    while (--size >= 0) {
      const { done, value } = iterable.next();
      if (done) {
        this.push(null);
        return;
      }
      this.push(value);
    }
  }

  addAll(quads) {
    return this.filtered.addAll(quads);
  }

  contains(other) {
    return this.filtered.contains(other);
  }

  deleteMatches(subject, predicate, object, graph) {
    return this.filtered.deleteMatches(subject, predicate, object, graph);
  }

  difference(other) {
    return this.filtered.difference(other);
  }

  equals(other) {
    return this.filtered.equals(other);
  }

  every(callback, subject, predicate, object, graph) {
    return this.filtered.every(callback, subject, predicate, object, graph);
  }

  filter(iteratee) {
    return this.filtered.filter(iteratee);
  }

  forEach(callback, subject, predicate, object, graph) {
    return this.filtered.forEach(callback, subject, predicate, object, graph);
  }

  import(stream) {
    return this.filtered.import(stream);
  }

  intersection(other) {
    return this.filtered.intersection(other);
  }

  map(iteratee) {
    return this.filtered.map(iteratee);
  }

  some(callback, subject, predicate, object, graph) {
    return this.filtered.some(callback, subject, predicate, object, graph);
  }

  toCanonical() {
    return this.filtered.toCanonical();
  }

  toStream() {
    return this._filtered ?
      this._filtered.toStream()
      : this.n3Store.match(this.subject, this.predicate, this.object, this.graph);
  }

  union(quads) {
    return this._filtered ?
      this._filtered.union(quads)
      : this.n3Store.match(this.subject, this.predicate, this.object, this.graph).addAll(quads);
  }

  toArray() {
    return this._filtered ? this._filtered.toArray() : this.n3Store.getQuads(this.subject, this.predicate, this.object, this.graph);
  }

  reduce(callback, initialValue) {
    return this.filtered.reduce(callback, initialValue);
  }

  toString() {
    return (new N3Writer()).quadsToString(this);
  }

  add(quad) {
    return this.filtered.add(quad);
  }

  delete(quad) {
    return this.filtered.delete(quad);
  }

  has(quad) {
    return this.filtered.has(quad);
  }

  match(subject, predicate, object, graph) {
    return new DatasetCoreAndReadableStream(this.filtered, subject, predicate, object, graph, this.options);
  }

  *[Symbol.iterator]() {
    yield* this._filtered || this.n3Store.readQuads(this.subject, this.predicate, this.object, this.graph);
  }
}
