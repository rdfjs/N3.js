var N3Store = require('../lib/n3store.js');
var vows = require('vows'),
    should = require('should'),
    eql = require('../node_modules/should/lib/eql.js'),
    util = require('util');

vows.describe('N3Store').addBatch({
  'The N3Store module': {
    topic: function () { return N3Store; },
    
    'should be a function': function (N3Store) {
      N3Store.should.be.a('function');
    },
    
    'should make n3store objects': function (N3Store) {
      N3Store().constructor.should.eql(N3Store);
      N3Store().should.be.an.instanceof(N3Store);
    },
    
    'should be an n3store constructor': function (N3Store) {
      new N3Store().constructor.should.eql(N3Store);
      new N3Store().should.be.an.instanceof(N3Store);
    },
  },
  
  'An empty N3Store': {
    topic: new N3Store(),
    
    'should be empty': function (n3Store) {
      n3Store.find().should.be.empty;
    },
    
    'should have a default context': function (N3Store) {
      N3Store.defaultContext.should.eql('n3store/contexts#default');
    },
  },
  
  'An N3Store with 4 elements': {
    topic: function () {
      var n3Store = new N3Store();
      n3Store.add('s1', 'p1', 'o1');
      n3Store.add('s1', 'p1', 'o2');
      n3Store.add('s1', 'p2', 'o2');
      n3Store.add('s2', 'p1', 'o1');
      n3Store.add('s1', 'p2', 'o3', 'c4');
      return n3Store;
    },
    
    'when searched without parameters': {
      topic: function (n3Store) { return n3Store.find(); },
      
      'should return all items in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2'], ['s2', 'p1', 'o1'])
    },
    
    'when searched with an existing subject parameter': {
      topic: function (n3Store) { return n3Store.find('s1', null, null); },
      
      'should return all items with this subject in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2'])
    },
    
    'when searched with a non-existing subject parameter': {
      topic: function (n3Store) { return n3Store.find('s3', null, null); },
      
      'should return no items': shouldBeEmpty()
    },
    
    'when searched with an existing predicate parameter': {
      topic: function (n3Store) { return n3Store.find(null, 'p1', null); },
      
      'should return all items with this predicate in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s2', 'p1', 'o1'])
    },
    
    'when searched with a non-existing predicate parameter': {
      topic: function (n3Store) { return n3Store.find(null, 'p3', null); },
      
      'should return no items': shouldBeEmpty()
    },
    
    'when searched with an existing object parameter': {
      topic: function (n3Store) { return n3Store.find(null, null, 'o1'); },
      
      'should return all items with this object in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'], ['s2', 'p1', 'o1'])
    },
    
    'when searched with a non-existing object parameter': {
      topic: function (n3Store) { return n3Store.find(null, null, 'o4'); },
      
      'should return no items': shouldBeEmpty()
    },
    
    'when searched with existing subject and predicate parameters': {
      topic: function (n3Store) { return n3Store.find('s1', 'p1', null); },
      
      'should return all items with this subject and predicate in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'])
    },
    
    'when searched with non-existing subject and predicate parameters': {
      topic: function (n3Store) { return n3Store.find('s2', 'p2', null); },
      
      'should return no items': shouldBeEmpty()
    },
    
    'when searched with existing subject and object parameters': {
      topic: function (n3Store) { return n3Store.find('s1', null, 'o2'); },
      
      'should return all items with this subject and object in the default context':
        shouldIncludeAll(['s1', 'p1', 'o2'], ['s1', 'p2', 'o2'])
    },
    
    'when searched with non-existing subject and object parameters': {
      topic: function (n3Store) { return n3Store.find('s2', 'p2', null); },
      
      'should return no items': shouldBeEmpty()
    },
    
    'when searched with existing predicate and object parameters': {
      topic: function (n3Store) { return n3Store.find(null, 'p1', 'o1'); },
      
      'should return all items with this predicate and object in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'], ['s2', 'p1', 'o1'])
    },
    
    'when searched with non-existing predicate and object parameters': {
      topic: function (n3Store) { return n3Store.find(null, 'p2', 'o3'); },
      
      'should return no items': shouldBeEmpty()
    },
    
    'when searched with existing subject, predicate, and object parameters': {
      topic: function (n3Store) { return n3Store.find('s1', 'p1', 'o1'); },
      
      'should return all items with this subject, predicate, and object in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'])
    },
    
    'when searched with non-existing subject, predicate, and object parameters': {
      topic: function (n3Store) { return n3Store.find('s2', 'p2', 'o2'); },
      
      'should return no items': shouldBeEmpty()
    },
    
    'when searched with the default context parameter': {
      topic: function (n3Store) { return n3Store.find(); },
      
      'should return all items in the default context':
        shouldIncludeAll(['s1', 'p1', 'o1'], ['s1', 'p1', 'o2'], ['s1', 'p2', 'o2'], ['s2', 'p1', 'o1'])
    },
    
    'when searched with an existing non-default context parameter': {
      topic: function (n3Store) { return n3Store.find(null, null, null, 'c4'); },
      
      'should return all items in that context':
        shouldIncludeAll(['s1', 'p2', 'o3', 'c4'])
    },
    
    'when searched with a non-existing non-default context parameter': {
      topic: function (n3Store) { return n3Store.find(null, null, null, 'c5'); },
      
      'should return no items': shouldBeEmpty()
    },
  },
}).export(module);

function shouldBeEmpty() {
  return function (result) {
    result.should.be.empty;
  };
}

function shouldIncludeAll() {
  var items = Array.prototype.map.call(arguments, function (arg) {
    return { subject: arg[0], predicate: arg[1], object: arg[2],
             context: arg[3] || 'n3store/contexts#default' };
  });
  return function (result) {
    result.should.have.length(items.length);
    for (var i = 0; i < items.length; i++)
      should(result.some(function (x) { return eql(items[i], x); }),
             util.inspect(result) + ' should contain ' + util.inspect(items[i]));
  };
}
