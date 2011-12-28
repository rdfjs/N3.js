/*
  Class for objects that store N3 triples with a context.
*/
function N3Store() {
  // dummy constructor to enable construction without new
  function F() {};
  F.prototype = N3Store.prototype;
  
  // initialize new store
  n3Store = new F();
  n3Store._contexts = {};
  n3Store._entities = {};
  n3Store._entityCount = 0;
  
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
  _addToIndex: function(index0, key0, key1, key2, triple) {
    var index1 = index0[key0] || (index0[key0] = {});
    var index2 = index1[key1] || (index1[key1] = {});
    index2[key2] = triple;
  },

  /*
    Finds a set of triples in a three-layered index
  */
  _findInIndex: function(index0, key0, key1, key2) {
    var results = [];
    
    // if a key is specified, use only that part of index 0
    if (key0)
      index0 = key0 in index0 && [index0[key0]];

    for(var index0Item in index0) {
      var index1 = index0[index0Item] || {};
      // if a key is specified, use only that part of index 1
      if (key1)
        index1 = key1 in index1 && [index1[key1]];

      for (var index1Item in index1) {
        var index2 = index1[index1Item] || {};
        // if a key is specified, use only that part of index 2
        if (key2)
          index2 = key2 in index2 && [index2[key2]];
        
        // index 2 contains the requested triples
        for (var index2Item in index2)
          results.push(index2[index2Item]);
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
    if (!contextItem)
      contextItem = this._contexts[context] = {
        subjects: {},
        predicates: {},
        objects: {}
      }
    
    // add triple to all indexes
    var triple = (context === this.defaultContext) ? [subject, predicate, object]
                                                   : [subject, predicate, object, context];
    // Since keys can often be long URIs, we avoid storing them in every index.
    // Instead, we have a separate index that maps keys to numbers,
    // which are then used as keys in the other indexes.
    // One might expect that it would be better to convert these numbers to a string,
    // since JavaScript stores objects keys as strings anyway.
    // However, tests show that retrieval is not faster, but adding does become slower.
    var entities = this._entities;
    subject   = entities[subject]   || (entities[subject]   = ++this._entityCount);
    predicate = entities[predicate] || (entities[predicate] = ++this._entityCount);
    object    = entities[object]    || (entities[object]    = ++this._entityCount);

    this._addToIndex(contextItem.subjects, subject, predicate, object, triple);
    this._addToIndex(contextItem.predicates, predicate, object, subject, triple);
    this._addToIndex(contextItem.objects, object, subject, predicate, triple);
    
    // enable method chaining
    return this;
  },
  
  /*
    Find a set of triples matching a pattern.
    Setting subject, predicate, or object to `null` means an 'anything' wildcard.
    Setting context to `null` means the default context.
  */
  find: function (subject, predicate, object, context) {
    var contextItem = this._contexts[context || this.defaultContext],
        entities = this._entities;
    
    // Translate URIs to internal index keys.
    // If not found, use invalid key '_'.
    if(subject)   subject   = entities[subject]   || '_';
    if(predicate) predicate = entities[predicate] || '_';
    if(object)    object    = entities[object]    || '_';
    
    // does the specified context contain triples?
    if (contextItem) {
      // choose optimal index, based on what fields are present
      
      if (subject) {
        if (object)
          // subject and object given => object index will be fastest
          return this._findInIndex(contextItem.objects, object, subject, predicate);
        else
          // only subject and possibly predicate given => subject index will be fastest
          return this._findInIndex(contextItem.subjects, subject, predicate, object);
      }
      else if (predicate) {
        // only predicate and possbily object given => predicate index will be fastest
        return this._findInIndex(contextItem.predicates, predicate, object, subject);
      }
      else {
        // only object possibly given => object index will be fastests
        return this._findInIndex(contextItem.objects, object, subject, predicate);
      }
    }
    // no triples in context means no results
    else {
      return [];
    }
  }
}

module.exports = N3Store;
