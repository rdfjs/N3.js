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
    addToIndex(contextItem.subjects, subject, predicate, object, triple);
    addToIndex(contextItem.predicates, predicate, object, subject, triple);
    addToIndex(contextItem.objects, object, subject, predicate, triple);
    
    function addToIndex(index0, uri1, uri2, uri3, triple) {
      var index1 = index0[uri1] || (index0[uri1] = {});
      var index2 = index1[uri2] || (index1[uri2] = {});
      index2[uri3] = triple;
    }
    
    // enable method chaining
    return this;
  },
  
  /*
    Find a set of triples matching a pattern.
    Setting subject, predicate, or object to `null` means an 'anything' wildcard.
    Setting context to `null` means the default context.
  */
  find: function (subject, predicate, object, context) {
    var results = [],
        contextItem = this._contexts[context || this.defaultContext];
    
    if (contextItem) {
      // in the specified context, loop through all subjects or pick a single subject if desired
      var subjects = contextItem.subjects;
      if (subject)
        subjects = subject in subjects && [subjects[subject]];
      
      for(var subjectKey in subjects) {
        // for this subject, loop through all predicates or pick a single predicate if desired
        var predicates = subjects[subjectKey] || {};
        if (predicate)
          predicates = predicate in predicates && [predicates[predicate]];
        
        for (var predicateKey in predicates) {
          // for this predicate, loop through all objects or pick a single object if desired
          var objects = predicates[predicateKey] || {};
          if (object)
            objects = object in objects && [objects[object]];
          
          for (var objectKey in objects)
            results.push(objects[objectKey]);
        }
      }
    }
    
    return results;
  }
}

module.exports = N3Store;
