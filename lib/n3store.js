/*
  Class for objects that store N3 triples with a context.
*/
function N3Store() {
  // dummy constructor to enable construction without new
  function F() {}
  F.prototype = N3Store.prototype;
  
  // initialize new store
  n3Store = new F();
  n3Store._contexts = {};
  n3Store._entities = { 0: null };
  
  return n3Store;
}

N3Store.prototype = {
  constructor: N3Store,
  
  /*
    The default context wherein triples are stored.
  */
  get defaultContext() {
    return 'n3store/contexts#default';
  },
  
  /*
    Adds a triple to a three-layered index
  */
  _addToIndex: function (index0, key0, key1, key2) {
    var index1 = index0[key0] || (index0[key0] = {});
    var index2 = index1[key1] || (index1[key1] = {});
    index2[key2] = null;
  },

  /*
    Finds a set of triples in a three-layered index
  */
  _findInIndex: function (index0, key0, key1, key2, name0, name1, name2, context) {
    var results = [],
        entityKeys = Object.keys(this._entities),
        tmp;
    // if a key is specified, use only that part of index 0
    if (key0)
      index0 = [tmp = {}, tmp[key0] = index0[key0]][0];

    for (var value0 in index0) {
      var index1 = index0[value0] || {},
          entity0 = entityKeys[value0];
      // if a key is specified, use only that part of index 1
      if (key1)
        index1 = [tmp = {}, tmp[key1] = index1[key1]][0];

      for (var value1 in index1) {
        var index2 = index1[value1] || {},
            entity1 = entityKeys[value1];
        // if a key is specified, use only that part of index 2, if it exists
        if (key2)
          index2 = key2 in index2 ? [tmp = {}, tmp[key2] = index2[key2]][0] : {};
        
        // create triples for all items found in index 2
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
  
  /*
    Add a new N3 triple to the store.
  */
  add: function (subject, predicate, object, context) {
    // find the context that should contain this triple
    context = context || this.defaultContext;
    var contextItem = this._contexts[context];
    // create context if it doesn't exist yet
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
    
    // Since keys can often be long URIs, we avoid storing them in every index.
    // Instead, we have a separate index that maps keys to numbers,
    // which are then used as keys in the other indexes.
    var entities = this._entities;
    
    subject   = entities[subject]   || (entities[subject]   = Object.keys(entities).length);
    predicate = entities[predicate] || (entities[predicate] = Object.keys(entities).length);
    object    = entities[object]    || (entities[object]    = Object.keys(entities).length);

    this._addToIndex(contextItem.subjects, subject, predicate, object);
    this._addToIndex(contextItem.predicates, predicate, object, subject);
    this._addToIndex(contextItem.objects, object, subject, predicate);
    
    // enable method chaining
    return this;
  },
  
  /*
    Find a set of triples matching a pattern.
    Setting subject, predicate, or object to `null` means an 'anything' wildcard.
    Setting context to `null` means the default context.
  */
  find: function (subject, predicate, object, context) {
    context = context || this.defaultContext;
    var contextItem = this._contexts[context],
        entities = this._entities;
    
    // Translate URIs to internal index keys.
    // Optimization: if the entity doesn't exist, no triples with it exist.
    if (subject   && !(subject   = entities[subject]))   return [];
    if (predicate && !(predicate = entities[predicate])) return [];
    if (object    && !(object    = entities[object]))    return [];
    
    // does the specified context contain triples?
    if (contextItem) {
      // choose optimal index, based on what fields are present
      
      if (subject) {
        if (object)
          // subject and object given => object index will be fastest
          return this._findInIndex(contextItem.objects, object, subject, predicate,
                                   'object', 'subject', 'predicate', context);
        else
          // only subject and possibly predicate given => subject index will be fastest
          return this._findInIndex(contextItem.subjects, subject, predicate, object,
                                   'subject', 'predicate', 'object', context);
      }
      else if (predicate) {
        // only predicate and possibly object given => predicate index will be fastest
        return this._findInIndex(contextItem.predicates, predicate, object, subject,
                                 'predicate', 'object', 'subject', context);
      }
      else {
        // only object possibly given => object index will be fastest
        return this._findInIndex(contextItem.objects, object, subject, predicate,
                                 'object', 'subject', 'predicate', context);
      }
    }
    // no triples in context means no results
    else {
      return [];
    }
  }
};

module.exports = N3Store;
