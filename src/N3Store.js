// **N3Store** objects store N3 quads by graph in memory.
import { Readable, finished } from 'readable-stream';
import { default as N3DataFactory, termToId, termFromId } from './N3DataFactory';
import namespaces from './IRIs';
import { isDefaultGraph } from './N3Util';
import N3Writer from './N3Writer';

const ITERATOR = Symbol('iter');
const SIZE = Symbol('size');

// Neither a registration nor its cleanup record may keep a view or store alive.
// Initialize lazily so importing N3 and using lazy views needs no weak-reference APIs.
let observerRegistry;
function finalizeObserver({ store, observer }) {
  const target = store.deref();
  if (target)
    target._removeObserver(observer);
}

function hasInIndex(index0, key0, key1, key2) {
  const index1 = index0 && index0[key0];
  const index2 = index1 && index1[key1];
  return !!index2 && key2 in index2;
}

// Returns the key of a term in the entity index.
// Keys mark the term type by their first character, so the IRI of a named node
// that starts with such a marker (as relative IRIs can) is wrapped in < and >.
const markedIRI = /^[?_"[.<]/;
function entityKey(term) {
  // Strings are term ids, which only need wrapping when they are IRIs starting with < or .
  if (typeof term === 'string') {
    const first = term.charCodeAt(0);
    return first !== 0x3C && first !== 0x2E || term === '<>' ? term : `<${term}>`;
  }
  // IDs of IRIs usually start with a lowercase scheme letter, which never marks a term type
  const id = termToId(term);
  if (id.charCodeAt(0) >= 0x61 || !term)
    return id;
  return term.termType !== 'NamedNode' || !markedIRI.test(term.value) ? id : `<${term.value}>`;
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
    // A key in < and > is a named node
    if (id[0] === '<')
      return this._factory.namedNode(id.substring(1, id.length - 1));
    // A key starting with . is a quoted triple
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
    return typeof term === 'string' ? this._stringToNumericId(term) : this._ids[entityKey(term)];
  }

  // Returns the numeric id of a term given as a string id
  _stringToNumericId(term) {
    // The string is the key unless it is an IRI starting with < (which starts the keys of
    // wrapped IRIs) or . (which starts the keys of quoted triples). Read the first character
    // from the stored key after a match, which is cheaper than from a concatenated string.
    const id = this._ids[term];
    const first = id ? this._entities[id].charCodeAt(0) : term.charCodeAt(0);
    if (first !== 0x3C && first !== 0x2E)
      return id;
    return term === '<>' ? id : this._ids[`<${term}>`];
  }

  _termToNewNumericId(term) {
    if (typeof term === 'string')
      return this._stringToNumericId(term) || this._addEntity(entityKey(term));
    // This assumes that no graph term is present - we may wish to error if there is one
    const str = term && term.termType === 'Quad' ?
      `.${this._termToNewNumericId(term.subject)}.${this._termToNewNumericId(term.predicate)}.${this._termToNewNumericId(term.object)}${
        isDefaultGraph(term.graph) ? '' : `.${this._termToNewNumericId(term.graph)}`
      }`
      : entityKey(term);

    return this._ids[str] || this._addEntity(str);
  }

  _addEntity(key) {
    return this._ids[this._entities[++this._id] = key] = this._id;
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

// Returns the size of a store from this copy of N3 if it is known without counting,
// or null otherwise
function knownSize(dataset) {
  return dataset instanceof N3Store ? dataset._size : null;
}

// ## Constructor
export default class N3Store {
  constructor(quads, options) {
    // The number of quads is initially zero
    this._size = 0;
    // `_graphs` contains subject, predicate, and object indexes per graph
    this._graphs = Object.create(null);
    this._graphCount = 0;
    // `_observers` contains weak references to views notified before every mutation
    this._observers = null;

    // Shift parameters if `quads` is not given
    if (!options && quads && !quads[0] && !(typeof quads.match === 'function'))
      options = quads, quads = null;
    options = options || {};
    this._factory = options.factory || N3DataFactory;
    this._matchSemantics = validateMatchSemantics(options.matchSemantics);
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
    // The quad count is kept up to date by every change,
    // except by reasoners from earlier versions of N3, which set it to null
    if (this._size === null)
      this._size = this.countQuads();
    return this._size;
  }

  // ## Private methods

  // ### `_addToIndex` adds a quad to a three-layered index.
  // Returns if the index has changed, if the entry did not already exist.
  _addToIndex(index0, key0, key1, key2) {
    // Create layers as necessary, maintaining their entry counters
    let index1 = index0[key0];
    if (!index1) {
      index0[key0] = index1 = { [SIZE]: 0 };
      index0[SIZE]++;
    }
    let index2 = index1[key1];
    if (!index2) {
      index1[key1] = index2 = { [SIZE]: 0 };
      index1[SIZE]++;
    }
    // Setting the key to _any_ value signals the presence of the quad
    const existed = key2 in index2;
    if (!existed) {
      index2[key2] = null;
      index2[SIZE]++;
    }
    return !existed;
  }

  // ### `_removeFromIndex` removes a quad from a three-layered index
  _removeFromIndex(index0, key0, key1, key2) {
    // Remove the quad from the index
    const index1 = index0[key0], index2 = index1[key1];
    delete index2[key2];

    // Remove intermediary index layers if they are empty,
    // which the entry counters detect in constant time
    if (--index2[SIZE] !== 0) return;
    delete index1[key1];
    if (--index1[SIZE] !== 0) return;
    delete index0[key0];
    index0[SIZE]--;
  }

  // ### `_findInIndex` finds a set of quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // A key and any keys after it can be null or undefined, which is interpreted as a wildcard.
  // `name0`, `name1`, and `name2` are the names of the keys at each level,
  // used when reconstructing the resulting quad
  // (for instance: _subject_, _predicate_, and _object_).
  // Finally, `graphId` will be the graph of the created quads.
  *_findInIndex(index0, key0, key1, key2, name0, name1, name2, graphId) {
    const entityKeys = this._entities;
    const graph = this._termFromId(entityKeys[graphId]);
    const parts = { subject: null, predicate: null, object: null };

    // Exact matches avoid allocating key arrays or entering generic loops.
    if (key2) {
      const index1 = index0[key0];
      const index2 = index1 && index1[key1];
      if (!index2 || !(key2 in index2))
        return;
      parts[name0] = this._termFromId(entityKeys[key0]);
      parts[name1] = this._termFromId(entityKeys[key1]);
      parts[name2] = this._termFromId(entityKeys[key2]);
      yield this._factory.quad(parts.subject, parts.predicate, parts.object, graph);
      return;
    }

    if (key0 && !(key0 in index0))
      return;
    // A null key list stops after visiting a bound key, avoiding a one-item array.
    const keys0 = key0 ? null : Object.keys(index0);
    for (let i0 = 0, value0 = key0 || keys0[0]; value0;
         value0 = keys0 && keys0[++i0]) {
      // Mutations can remove keys captured before an earlier yield.
      const index1 = index0[value0];
      if (!index1) continue; // eslint-disable-line no-continue
      parts[name0] = this._termFromId(entityKeys[value0]);

      if (key1 && !(key1 in index1))
        return;
      const keys1 = key1 ? null : Object.keys(index1);
      for (let i1 = 0, value1 = key1 || keys1[0]; value1;
           value1 = keys1 && keys1[++i1]) {
        const index2 = index1[value1];
        if (!index2) continue; // eslint-disable-line no-continue
        parts[name1] = this._termFromId(entityKeys[value1]);
        const values = Object.keys(index2);
        for (let l = 0; l < values.length; l++) {
          parts[name2] = this._termFromId(entityKeys[values[l]]);
          yield this._factory.quad(parts.subject, parts.predicate, parts.object, graph);
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

  // ### `_loopByKey0Deep` executes the callback on all keys of index 2
  // for a certain entry in index 0, possibly repeating keys
  _loopByKey0Deep(index0, key0, callback) {
    let index1, index2, key1, key2;
    if (index1 = index0[key0]) {
      for (key1 in index1) {
        index2 = index1[key1];
        for (key2 in index2)
          callback(key2);
      }
    }
  }

  // ### `_countInIndex` counts matching quads in a three-layered index.
  // The index base is `index0` and the keys at each level are `key0`, `key1`, and `key2`.
  // A key and any keys after it can be null or undefined, which is interpreted as a wildcard.
  _countInIndex(index0, key0, key1, key2) {
    let count = 0, index1, index2;

    // Bound outer keys can be looked up directly.
    if (key0) {
      if (!(index1 = index0[key0]))
        return 0;
      if (key1) {
        if (!(index2 = index1[key1]))
          return 0;
        return key2 ? (key2 in index2 ? 1 : 0) : index2[SIZE];
      }

      const keys1 = Object.keys(index1);
      for (let i1 = 0; i1 < keys1.length; i1++)
        count += index1[keys1[i1]][SIZE];
      return count;
    }

    const keys0 = Object.keys(index0);
    for (let i0 = 0; i0 < keys0.length; i0++) {
      index1 = index0[keys0[i0]];
      const keys1 = Object.keys(index1);
      for (let i1 = 0; i1 < keys1.length; i1++)
        count += index1[keys1[i1]][SIZE];
    }
    return count;
  }

  // ### `_getGraphs` returns an array with the given graph,
  // or all graphs if the argument is null or undefined.
  _getGraphs(graph) {
    graph = graph === '' ? 1 : (graph && (this._termToNumericId(graph) || -1));
    return typeof graph !== 'number' ? this._graphs : { [graph]: this._graphs[graph] };
  }

  // ### `_addObserver` registers a mutation observer.
  _addObserver(view) {
    const observer = new WeakRef(view);
    const registry = observerRegistry || (observerRegistry = new FinalizationRegistry(finalizeObserver));
    registry.register(view, { store: new WeakRef(this), observer }, observer);
    (this._observers || (this._observers = new Set())).add(observer);
    return observer;
  }

  // ### `_removeObserver` unregisters a mutation observer.
  _removeObserver(observer) {
    observerRegistry.unregister(observer);
    if (this._observers) {
      this._observers.delete(observer);
      if (this._observers.size === 0)
        this._observers = null;
    }
  }

  // ### `_notifyObservers` notifies observers of a mutation.
  _notifyObservers(subjectId, predicateId, objectId, graphId, added) {
    // Observers can remove themselves during Set iteration
    for (const observer of this._observers) {
      const view = observer.deref();
      if (view)
        view._onParentMutation(subjectId, predicateId, objectId, graphId, added);
      else
        // Finalization may be delayed; also prune collected views during notification.
        this._removeObserver(observer);
    }
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

    // Map long IRIs to shared numeric identifiers before updating the indexes.
    subject   = this._termToNewNumericId(subject);
    predicate = this._termToNewNumericId(predicate);
    object    = this._termToNewNumericId(object);
    return this._addQuad(subject, predicate, object, graph);
  }

  // ### `_addQuad` adds a quad using identifiers from this store's entity index.
  _addQuad(subject, predicate, object, graph) {
    // Find the graph that will contain the triple
    let graphItem = this._graphs[graph];
    // Create the graph if it doesn't exist yet
    if (!graphItem) {
      graphItem = this._graphs[graph] = {
        subjects: { [SIZE]: 0 },
        predicates: { [SIZE]: 0 },
        objects: { [SIZE]: 0 },
      };
      // Freezing a graph helps subsequent `add` performance,
      // and properties will never be modified anyway
      Object.freeze(graphItem);
      this._graphCount++;
    }

    // Notify observers before inserting a new quad so snapshots retain their prior contents
    if (this._observers !== null) {
      if (hasInIndex(graphItem.subjects, subject, predicate, object))
        return false;
      this._notifyObservers(subject, predicate, object, graph, true);
    }

    if (!this._addToIndex(graphItem.subjects,   subject,   predicate, object))
      return false;
    this._addToIndex(graphItem.predicates, predicate, object,    subject);
    this._addToIndex(graphItem.objects,    object,    subject,   predicate);

    if (this._size !== null) this._size++;
    return true;
  }

  // ### `_addFromIndex` adds the quads in the given graph indexes of a store
  // that shares this store's entity index, so no terms need to be converted.
  // With `otherGraphs`, it only adds the quads that are not in those indexes.
  // Index keys are strings, so the ids are converted back to the numbers that
  // `addQuad` uses: forwarded views compare the ids they are notified with to
  // their own numeric ids.
  _addFromIndex(graphs, otherGraphs = null) {
    for (const graphKey in graphs) {
      const subjects = graphs[graphKey].subjects, other = otherGraphs && otherGraphs[graphKey];
      const otherSubjects = other ? other.subjects : null;
      for (const subjectKey in subjects) {
        const subject = Number(subjectKey), predicates = subjects[subjectKey];
        const otherPredicates = otherSubjects && otherSubjects[subjectKey];
        for (const predicateKey in predicates) {
          const predicate = Number(predicateKey), objects = predicates[predicateKey];
          const otherObjects = otherPredicates && otherPredicates[predicateKey];
          for (const objectKey in objects) {
            if (!otherObjects || !(objectKey in otherObjects))
              this._addQuad(subject, predicate, Number(objectKey), Number(graphKey));
          }
        }
      }
    }
  }

  // ### `_addIntersectionFromIndex` adds the quads that are in both of the
  // given graph indexes, walking the graphs of the first and, below them,
  // whichever index has fewer keys
  _addIntersectionFromIndex(graphs, otherGraphs) {
    for (const graphKey in graphs) {
      const other = otherGraphs[graphKey];
      if (other) {
        let subjects = graphs[graphKey].subjects, otherSubjects = other.subjects;
        if (otherSubjects[SIZE] < subjects[SIZE])
          [subjects, otherSubjects] = [otherSubjects, subjects];
        for (const subjectKey in subjects) {
          let predicates = subjects[subjectKey], otherPredicates = otherSubjects[subjectKey];
          if (otherPredicates) {
            if (otherPredicates[SIZE] < predicates[SIZE])
              [predicates, otherPredicates] = [otherPredicates, predicates];
            for (const predicateKey in predicates) {
              let objects = predicates[predicateKey], otherObjects = otherPredicates[predicateKey];
              if (otherObjects) {
                if (otherObjects[SIZE] < objects[SIZE])
                  [objects, otherObjects] = [otherObjects, objects];
                for (const objectKey in objects) {
                  if (objectKey in otherObjects)
                    this._addQuad(Number(subjectKey), Number(predicateKey), Number(objectKey), Number(graphKey));
                }
              }
            }
          }
        }
      }
    }
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
    // A quad with no other bound terms is the whole quad; otherwise it is a quoted subject
    if (subjectOrQuad && subjectOrQuad.subject &&
        (predicate === undefined || predicate === null) &&
        (object === undefined || object === null) &&
        (graph === undefined || graph === null))
      ({ subject: subjectOrQuad, predicate, object, graph } = subjectOrQuad);
    // Fully bound quads can bypass the generator machinery of `readQuads`.
    if (subjectOrQuad && predicate && object && graph !== undefined && graph !== null) {
      const subjectId = this._termToNumericId(subjectOrQuad);
      const predicateId = this._termToNumericId(predicate);
      const objectId = this._termToNumericId(object);
      const graphId = graph === '' || isDefaultGraph(graph) ? 1 : this._termToNumericId(graph);
      const graphItem = graphId && this._graphs[graphId];
      return !!subjectId && !!predicateId && !!objectId && !!graphItem &&
        hasInIndex(graphItem.subjects, subjectId, predicateId, objectId);
    }
    return !this.readQuads(subjectOrQuad, predicate, object, graph).next().done;
  }

  // ### `import` adds a stream of quads to the store.
  // It returns the stream, wrapped such that it can also be awaited
  // as a promise of the store (per the RDF/JS `Dataset.import` signature).
  import(stream) {
    stream.on('data', quad => { this.addQuad(quad); });

    // Only track completion once awaited, so unawaited imports keep the stream's behavior
    const store = this;
    let promise = null;
    function completion() {
      return promise || (promise = new Promise((resolve, reject) => {
        let stopListening = null;
        function settle(error) {
          stopListening();
          error ? reject(error) : resolve(store);
        }
        try {
          stopListening = finished(stream, { readable: true, writable: false }, settle);
        }
        // RDF/JS streams that are not Node.js streams only signal their end and errors
        // and must be awaited before they finish
        catch {
          stopListening = () => {
            if (stream.removeListener) {
              stream.removeListener('end', onFinish);
              stream.removeListener('error', settle);
            }
          };
          function onFinish() { settle(); }
          stream.on('end', onFinish);
          stream.on('error', settle);
        }
      }));
    }
    const thenable = {
      then(onFulfilled, onRejected) { return completion().then(onFulfilled, onRejected); },
      catch(onRejected) { return completion().catch(onRejected); },
      finally(onFinally) { return completion().finally(onFinally); },
    };
    // Return a wrapper that behaves as the stream, but is also awaitable
    return new Proxy(stream, {
      get(target, property) {
        if (property === 'then' || property === 'catch' || property === 'finally')
          return thenable[property];
        const value = target[property];
        // Methods run on the stream itself, which may rely on private fields
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  // ### `removeQuad` removes a quad from the store if it exists
  removeQuad(subject, predicate, object, graph) {
    // Shift arguments if a quad object is given instead of components
    if (!predicate)
      ({ subject, predicate, object, graph } = subject);
    // Convert terms to internal string representation
    graph = graph ? this._termToNumericId(graph) : 1;

    if (!(subject   = subject && this._termToNumericId(subject)) ||
        !(predicate = predicate && this._termToNumericId(predicate)) ||
        !(object    = object && this._termToNumericId(object)))
      return false;
    return this._removeQuad(subject, predicate, object, graph);
  }

  // ### `_removeQuad` removes a quad using identifiers from this store's entity index.
  _removeQuad(subject, predicate, object, graph) {
    // Verify the quad exists before notifying observers or changing any indexes.
    const graphs = this._graphs;
    const graphItem = graphs[graph];
    if (!graphItem || !hasInIndex(graphItem.subjects, subject, predicate, object))
      return false;

    // Notify observers before the mutation
    if (this._observers !== null)
      this._notifyObservers(subject, predicate, object, graph, false);

    // Remove it from all indexes
    this._removeFromIndex(graphItem.subjects,   subject,   predicate, object);
    this._removeFromIndex(graphItem.predicates, predicate, object,    subject);
    this._removeFromIndex(graphItem.objects,    object,    subject,   predicate);
    if (this._size !== null) this._size--;

    // Remove the graph if it is empty
    if (graphItem.subjects[SIZE] === 0) {
      delete graphs[graph];
      this._graphCount--;
    }
    return true;
  }

  // ### `removeQuads` removes multiple quads from the store
  // returns `true` if all quads were removed, `false` if some were not found
  removeQuads(quads) {
    let removed = true;
    for (let i = 0; i < quads.length; i++)
      removed = this.removeQuad(quads[i]) && removed;
    return removed;
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
  // `options.matchSemantics` controls how the view reacts to later mutations.
  match(subject, predicate, object, graph, options = null) {
    return new DatasetCoreAndReadableStream(this, subject, predicate, object, graph, {
      entityIndex: this._entityIndex,
      matchSemantics: options && options.matchSemantics !== undefined ?
        options.matchSemantics : this._matchSemantics,
    });
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
        else if (object) {
          // If only object is given, the object index will be the fastest
          count += this._countInIndex(content.objects, objectId, subjectId, predicateId);
        }
        else {
          // Without a pattern, the subject index sums the fewest leaf counts
          count += this._countInIndex(content.subjects);
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
            // If only subject is given, descending the SPO index
            // visits only the subject's own quads.
            this._loopByKey0Deep(content.subjects, subjectId, callback);
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
  // With `allowExtraArcs`, lists whose nodes carry arcs other than
  // rdf:first/rdf:rest are returned as well,
  // but left intact when `remove` is set. Ambiguous unreferenced list heads
  // with multiple non-list arcs remain errors.
  extractLists({ remove = false, ignoreErrors = false, allowExtraArcs = false } = {}) {
    // Keys are the list heads' term values, so a null-prototype map keeps
    // them from colliding with inherited Object members such as `toString`
    const lists = Object.create(null);
    const onError = ignoreErrors ? (() => true) :
                  ((node, message) => { throw new Error(`${node.value} ${message}`); });

    // Traverse each list from its tail
    const tails = this.getQuads(null, namespaces.rdf.rest, namespaces.rdf.nil, null);
    const toRemove = [];
    tails.forEach(tailQuad => {
      const items = [];             // the members found as objects of rdf:first quads
      let malformed = false;      // signals whether the current list is malformed
      let extraArcs = false;      // signals whether the current list has extra arcs
      let head;                   // the head of the list (_:b1 in above example)
      let headPos;                // set to subject or object when head is set
      const graph = tailQuad.graph; // make sure list is in exactly one graph
      const listQuads = [];       // rdf:first/rdf:rest quads of this list

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
              first = quad;
            if (remove && first === quad)
              listQuads.push(quad);
          }

          // one rdf:rest
          else if (quad.predicate.value === namespaces.rdf.rest) {
            if (rest)
              malformed = onError(current, 'has multiple rdf:rest arcs');
            else
              rest = quad;
            if (remove && rest === quad)
              listQuads.push(quad);
          }

          // alien triple
          else if (objectQuads.length) {
            if (allowExtraArcs)
              extraArcs = true;
            else
              malformed = onError(current, `has non-list arc ${quad.predicate.value}`);
          }
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
          items.push(first.object);
        current = parent && parent.subject;
      }

      // Don't remove any quads if the list is malformed
      if (malformed)
        remove = false;
      else {
        // Items were collected from the tail to the head
        items.reverse();
        // Store the list under the value of its head
        if (head)
          lists[head[headPos].value] = items;
        // Leave lists with extra arcs fully intact; otherwise queue this list once.
        if (remove && !extraArcs) {
          for (let i = 0; i < listQuads.length; i++)
            toRemove.push(listQuads[i]);
        }
      }
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
    // A store with the same entity index can be copied by identifier
    else if (quads instanceof N3Store && quads._entityIndex === this._entityIndex)
      this._addFromIndex(quads._graphs);
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

    if (!(other instanceof N3Store) || this._entityIndex !== other._entityIndex) {
      // A larger set cannot be a subset, but only compare sizes that are known without counting
      const otherSize = knownSize(other), thisSize = this._size;
      if (otherSize !== null && thisSize !== null && otherSize > thisSize)
        return false;
      return other.every(quad => this.has(quad));
    }

    // At every level, the index of the subset cannot have more entries
    const g1 = this._graphs, g2 = other._graphs;
    let s1, s2, p1, p2, o1, o2;
    for (const graph in g2) {
      if (!(s1 = g1[graph])) return false;
      s1 = s1.subjects;
      if ((s2 = g2[graph].subjects)[SIZE] > s1[SIZE]) return false;
      for (const subject in s2) {
        if (!(p1 = s1[subject]) || (p2 = s2[subject])[SIZE] > p1[SIZE]) return false;
        for (const predicate in p2) {
          if (!(o1 = p1[predicate]) || (o2 = p2[predicate])[SIZE] > o1[SIZE]) return false;
          for (const object in o2)
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
    for (const quad of this.match(subject, predicate, object, graph, { matchSemantics: 'lazy' }))
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
      store._addFromIndex(this._graphs, other._graphs);
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
      store._addFromIndex(this._graphs);
      return store;
    }
    else if ((other instanceof N3Store) && this._entityIndex === other._entityIndex) {
      const store = new N3Store({ entityIndex: this._entityIndex });
      // Starting a loop over no graphs costs more than checking for an empty store
      if (this._size !== 0 && other._size !== 0) {
        if (other._graphCount < this._graphCount)
          store._addIntersectionFromIndex(other._graphs, this._graphs);
        else
          store._addIntersectionFromIndex(this._graphs, other._graphs);
      }
      return store;
    }

    // Test the quads of the smaller dataset against the larger one
    // when both sizes are known without counting
    const otherSize = knownSize(other), thisSize = this._size;
    if (otherSize !== null && thisSize !== null && otherSize < thisSize && typeof other[Symbol.iterator] === 'function' &&
        // unless it is a store whose custom factories may not create RDF/JS quads,
        // either for its quads or, through its entity index, for their terms
        other._factory === N3DataFactory && other._entityIndex._factory === N3DataFactory) {
      const store = new N3Store({ entityIndex: this._entityIndex });
      for (const quad of other)
        if (this.has(quad))
          store.add(quad);
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
    return this.match(null, null, null, null, { matchSemantics: 'lazy' });
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
    store._addFromIndex(this._graphs);
    store.addAll(quads);
    return store;
  }

  // ### Store is an iterable.
  // Returns the quad iterator directly; order is not guaranteed.
  [Symbol.iterator]() {
    return this.readQuads();
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

  let target = false, size = 0;
  for (const key in (ind ? { [ind]: index[ind] } : index)) {
    const result = depth === 2 ? null : indexMatch(index[key], ids, depth + 1);

    if (result !== false) {
      target = target || Object.create(null);
      target[key] = result;
      size++;
    }
  }
  if (target)
    target[SIZE] = size;
  return target;
}

// Capture a read in the same index order as readQuads, without constructing RDF terms.
// A flat list avoids allocating a Quad (and its terms) for every unread result.
function snapshotMatch(store, subject, predicate, object, graph) {
  const snapshot = { store, ids: [] };
  const subjectId = subject && store._termToNumericId(subject);
  const predicateId = predicate && store._termToNumericId(predicate);
  const objectId = object && store._termToNumericId(object);
  // Only active reads are frozen: bound terms and graphs have already resolved,
  // and notifications run before deletion. Entity IDs are never removed.

  // Keep this choice aligned with readQuads: changing order would repeat or skip
  // results when an iterator resumes partway through its snapshot.
  let indexName, key0, key1, key2, positions;
  if (objectId && (subjectId || !predicateId)) {
    indexName = 'objects';
    [key0, key1, key2] = [objectId, subjectId, predicateId];
    positions = [2, 0, 1];
  }
  else if (!subjectId && predicateId) {
    indexName = 'predicates';
    [key0, key1, key2] = [predicateId, objectId, subjectId];
    positions = [1, 2, 0];
  }
  else {
    indexName = 'subjects';
    [key0, key1, key2] = [subjectId, predicateId, objectId];
    positions = [0, 1, 2];
  }

  const graphs = store._getGraphs(graph), parts = [];
  for (const graphId in graphs) {
    const index = graphs[graphId][indexName];
    const graphKey = Number(graphId);
    for (const value0 in (key0 ? { [key0]: index[key0] } : index)) {
      const index1 = index[value0];
      if (!index1) continue; // eslint-disable-line no-continue
      parts[positions[0]] = Number(value0);
      for (const value1 in (key1 ? { [key1]: index1[key1] } : index1)) {
        const index2 = index1[value1];
        if (!index2) continue; // eslint-disable-line no-continue
        parts[positions[1]] = Number(value1);
        for (const value2 in (key2 ? (key2 in index2 ? { [key2]: null } : {}) : index2)) {
          parts[positions[2]] = Number(value2);
          snapshot.ids.push(parts[0], parts[1], parts[2], graphKey);
        }
      }
    }
  }
  return snapshot;
}

// Skip already-yielded IDs in constant time; only materialize the requested tail.
function* iterateSnapshot({ store, ids }, offset) {
  const entities = store._entities;
  let subject, predicate, object, graph;
  let subjectId, predicateId, objectId, graphId;
  for (let i = offset * 4; i < ids.length; i += 4) {
    if (subjectId !== ids[i])
      subject = store._termFromId(entities[subjectId = ids[i]]);
    if (predicateId !== ids[i + 1])
      predicate = store._termFromId(entities[predicateId = ids[i + 1]]);
    if (objectId !== ids[i + 2])
      object = store._termFromId(entities[objectId = ids[i + 2]]);
    if (graphId !== ids[i + 3])
      graph = store._termFromId(entities[graphId = ids[i + 3]]);
    yield store._factory.quad(subject, predicate, object, graph);
  }
}

function validateMatchSemantics(semantics = 'lazy') {
  if (semantics !== 'lazy' && semantics !== 'snapshot' && semantics !== 'forwarded')
    throw new Error(`Unknown matchSemantics: ${semantics}`);
  if (semantics !== 'lazy' && (typeof WeakRef !== 'function' || typeof FinalizationRegistry !== 'function'))
    throw new Error('Non-lazy matchSemantics requires WeakRef and FinalizationRegistry support');
  return semantics;
}

// Returns the term of a pattern component given as a string term ID,
// where '' is a wildcard, or the default graph in the graph position
function toTerm(term, isGraph) {
  return typeof term !== 'string' ? term : term || isGraph ? termFromId(term) : null;
}

// Returns the intersection of two quad patterns, or false if they conflict.
function intersectMatchPatterns(left, right) {
  const result = new Array(4);
  for (let i = 0; i < 4; i++) {
    const leftTerm = left[i], rightTerm = toTerm(right[i], i === 3);
    if (leftTerm === null || leftTerm === undefined)
      result[i] = rightTerm;
    else if (rightTerm === null || rightTerm === undefined || leftTerm.equals(rightTerm))
      result[i] = leftTerm;
    else
      return false;
  }
  return result;
}

/**
 * A class that implements both DatasetCore and Readable.
 */
class DatasetCoreAndReadableStream extends Readable {
  constructor(n3Store, subject, predicate, object, graph, options) {
    super({ objectMode: true });
    Object.assign(this, { n3Store, subject: toTerm(subject), predicate: toTerm(predicate), object: toTerm(object), graph: toTerm(graph, true), options });
    const semantics = this._semantics = validateMatchSemantics(options.matchSemantics);

    if (options.matchesNothing) {
      this._matchesNothing = true;
      this._filtered = new N3Store({ factory: n3Store._factory, entityIndex: options.entityIndex });
    }

    if (semantics !== 'lazy') {
      // Active reads share a snapshot only when their source changes.
      this._readers = null;
      // Cache pattern ids on first use
      this._subjectId = this._predicateId = this._objectId = this._graphId = undefined;
      if (!this._matchesNothing) {
        this._observer = n3Store._addObserver(this);
      }
    }
  }

  // ### `_matchesPattern` tests quad ids against this view.
  _matchesPattern(subjectId, predicateId, objectId, graphId) {
    const { subject, predicate, object, graph, n3Store } = this;
    if (subject && subjectId !== (this._subjectId || (this._subjectId = n3Store._termToNumericId(subject))))
      return false;
    if (predicate && predicateId !== (this._predicateId || (this._predicateId = n3Store._termToNumericId(predicate))))
      return false;
    if (object && objectId !== (this._objectId || (this._objectId = n3Store._termToNumericId(object))))
      return false;
    return graph === null || graph === undefined ||
      graphId === (this._graphId || (this._graphId = n3Store._termToNumericId(graph)));
  }

  // ### `_matchesQuad` tests a Quad against this view.
  _matchesQuad(quad) {
    const { subject, predicate, object, graph } = this;
    return !this._matchesNothing &&
      (subject === null || subject === undefined || subject.equals(quad.subject)) &&
      (predicate === null || predicate === undefined || predicate.equals(quad.predicate)) &&
      (object === null || object === undefined || object.equals(quad.object)) &&
      (graph === null || graph === undefined || graph.equals(quad.graph));
  }

  // ### `_assertMatchesPattern` rejects a Quad outside this view.
  _assertMatchesPattern(quad) {
    if (!this._matchesQuad(quad))
      throw new Error('Quad does not match the forwarded view pattern');
  }

  // ### `_sourceIterator` returns an iterator over the current backing store.
  _sourceIterator() {
    return this._filtered ? this._filtered[Symbol.iterator]() :
      this.n3Store.readQuads(this.subject, this.predicate, this.object, this.graph);
  }

  // ### `_freezeCurrentIterators` freezes only readers still using the live source.
  _freezeCurrentIterators() {
    if (this._readers) {
      this._readers.snapshot = this._filtered ? snapshotMatch(this._filtered) :
        snapshotMatch(this.n3Store, this.subject, this.predicate, this.object, this.graph);
      // Each iterator retains its own group. New reads must see the new source;
      // the view must not retain snapshots belonging to suspended or abandoned reads.
      this._readers = null;
    }
  }

  // ### `_onParentMutation` applies a parent mutation to this view.
  _onParentMutation(subjectId, predicateId, objectId, graphId, added) {
    if (!this._matchesPattern(subjectId, predicateId, objectId, graphId))
      return;

    this._freezeCurrentIterators();

    // Keep using the parent until materialization
    if (this._semantics === 'forwarded') {
      if (this._filtered) {
        if (added)
          this._filtered._addQuad(subjectId, predicateId, objectId, graphId);
        else
          this._filtered._removeQuad(subjectId, predicateId, objectId, graphId);
      }
      return;
    }

    // Capture the pre-mutation snapshot
    this._filtered = this.filtered;
  }

  get filtered() {
    if (!this._filtered) {
      const { n3Store, graph, object, predicate, subject } = this;
      if (this._semantics !== 'lazy')
        this._freezeCurrentIterators();
      const newStore = this._filtered = new N3Store({ factory: n3Store._factory, entityIndex: this.options.entityIndex });

      if (this._semantics === 'snapshot')
        this._detachObserver();

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

          if (subjects) {
            newStore._graphs[graphKey] = { subjects, predicates, objects };
            newStore._graphCount++;
          }
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

  // ### `_destroy` closes the cached iterator.
  _destroy(error, callback) {
    if (this[ITERATOR]) {
      this[ITERATOR].return();
      this[ITERATOR] = null;
    }
    callback(error);
  }

  // ### `_detachObserver` stops observing the parent store.
  _detachObserver() {
    if (this._observer) {
      this.n3Store._removeObserver(this._observer);
      this._observer = null;
    }
  }

  // ### `_detach` freezes the view and stops observing the parent.
  _detach() {
    this._filtered = this.filtered;
    this._detachObserver();
    // Lazy views deferred this state
    if (this._semantics === 'lazy')
      this._readers = null;
    this._semantics = 'snapshot';
    return this;
  }

  addAll(quads) {
    if (this._semantics === 'forwarded') {
      for (const quad of quads) {
        this._assertMatchesPattern(quad);
        this.n3Store.addQuad(quad);
      }
      return this;
    }
    return this.filtered.addAll(quads);
  }

  contains(other) {
    return this.filtered.contains(other);
  }

  deleteMatches(subject, predicate, object, graph) {
    if (this._semantics === 'forwarded') {
      // No deletion pattern can match a view with conflicting ancestor patterns.
      if (this._matchesNothing)
        throw new Error('Cannot delete from a conflicting forwarded view pattern');
      const pattern = intersectMatchPatterns(
        [this.subject, this.predicate, this.object, this.graph],
        [subject, predicate, object, graph],
      );
      if (!pattern)
        throw new Error('Deletion pattern does not match the forwarded view pattern');
      this.n3Store.deleteMatches(...pattern);
      return this;
    }
    return this.filtered.deleteMatches(subject, predicate, object, graph);
  }

  difference(other) {
    return this.filtered.difference(other);
  }

  equals(other) {
    return this.filtered.equals(other);
  }

  every(callback, subject, predicate, object, graph) {
    return this.filtered.every(this._semantics === 'forwarded' ?
      quad => callback(quad, this) : callback, subject, predicate, object, graph);
  }

  filter(iteratee) {
    return this.filtered.filter(this._semantics === 'forwarded' ?
      quad => iteratee(quad, this) : iteratee);
  }

  forEach(callback, subject, predicate, object, graph) {
    return this.filtered.forEach(this._semantics === 'forwarded' ?
      quad => callback(quad, this) : callback, subject, predicate, object, graph);
  }

  import(stream) {
    if (this._semantics !== 'forwarded')
      return this.filtered.import(stream);

    const view = this;
    function onData(quad) {
      try {
        view._assertMatchesPattern(quad);
        view.n3Store.addQuad(quad);
      }
      catch (error) {
        // Stop this import; RDF/JS streams need not implement destroy()
        stream.removeListener('data', onData);
        if (typeof stream.destroy === 'function')
          stream.destroy(error);
        else
          stream.emit('error', error);
      }
    }
    stream.on('data', onData);
    return stream;
  }

  intersection(other) {
    return this.filtered.intersection(other);
  }

  map(iteratee) {
    return this.filtered.map(this._semantics === 'forwarded' ?
      quad => iteratee(quad, this) : iteratee);
  }

  some(callback, subject, predicate, object, graph) {
    return this.filtered.some(this._semantics === 'forwarded' ?
      quad => callback(quad, this) : callback, subject, predicate, object, graph);
  }

  toCanonical() {
    return this.filtered.toCanonical();
  }

  toStream() {
    if (this._semantics !== 'lazy')
      // Use a fresh sync iterator instead of consuming this view's own readable stream.
      return Readable.from(this[Symbol.iterator]());
    return this._filtered ?
      this._filtered.toStream()
      : this.n3Store.match(this.subject, this.predicate, this.object, this.graph, { matchSemantics: 'lazy' });
  }

  union(quads) {
    return this._filtered ?
      this._filtered.union(quads)
      : this.n3Store.match(this.subject, this.predicate, this.object, this.graph, { matchSemantics: 'lazy' }).addAll(quads);
  }

  toArray() {
    if (this._semantics !== 'lazy')
      return [...this];
    return this._filtered ? this._filtered.toArray() : this.n3Store.getQuads(this.subject, this.predicate, this.object, this.graph);
  }

  reduce(callback, initialValue) {
    return this.filtered.reduce(this._semantics === 'forwarded' ?
      (accumulator, quad) => callback(accumulator, quad, this) : callback, initialValue);
  }

  toString() {
    return (new N3Writer()).quadsToString(this);
  }

  add(quad) {
    if (this._semantics === 'forwarded') {
      this._assertMatchesPattern(quad);
      this.n3Store.addQuad(quad);
      return this;
    }
    return this.filtered.add(quad);
  }

  delete(quad) {
    if (this._semantics === 'forwarded') {
      this._assertMatchesPattern(quad);
      this.n3Store.removeQuad(quad);
      return this;
    }
    return this.filtered.delete(quad);
  }

  has(quad) {
    return this.filtered.has(quad);
  }

  match(subject, predicate, object, graph, options = null) {
    const requestedSemantics = options && options.matchSemantics;
    if (options && requestedSemantics !== undefined) {
      validateMatchSemantics(requestedSemantics);
      if (requestedSemantics !== this._semantics)
        throw new Error(`Cannot override matchSemantics on a view: inherited "${this._semantics}", received "${requestedSemantics}"`);
    }

    if (this._semantics !== 'forwarded')
      return new DatasetCoreAndReadableStream(this.filtered, subject, predicate, object, graph, {
        entityIndex: this.options.entityIndex,
        matchSemantics: this._semantics,
      });

    const pattern = !this._matchesNothing && intersectMatchPatterns(
      [this.subject, this.predicate, this.object, this.graph],
      [subject, predicate, object, graph],
    );
    const [matchedSubject, matchedPredicate, matchedObject, matchedGraph] = pattern || [null, null, null, null];
    return new DatasetCoreAndReadableStream(
      this.n3Store, matchedSubject, matchedPredicate, matchedObject, matchedGraph, {
        entityIndex: this.options.entityIndex,
        matchSemantics: 'forwarded',
        matchesNothing: !pattern,
      });
  }

  [Symbol.iterator]() {
    return this._semantics === 'lazy' ? this._sourceIterator() : this._iterateStable();
  }

  *_iterateStable() {
    const readers = this._readers || (this._readers = { count: 0, snapshot: null });
    const source = this._sourceIterator();
    let yielded = 0;
    readers.count++;
    try {
      while (!readers.snapshot) {
        const { value, done } = source.next();
        // A custom factory can mutate the store inside next(), even on its first call.
        if (readers.snapshot || done)
          break;
        yielded++;
        yield value;
      }
      if (readers.snapshot)
        yield* iterateSnapshot(readers.snapshot, yielded);
    }
    finally {
      source.return();
      if (--readers.count === 0) {
        readers.snapshot = null;
        if (this._readers === readers)
          this._readers = null;
      }
    }
  }
}
