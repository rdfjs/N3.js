var N3Parser = require('../lib/n3parser.js');
var vows = require('vows'),
    should = require('should'),
    util = require('util');

vows.describe('N3Parser').addBatch({
  'The N3Parser module': {
    topic: function () { return N3Parser; },
    
    'should be a function': function (N3Parser) {
      N3Parser.should.be.a('function');
    },
    
    'should make N3Parser objects': function (N3Parser) {
      N3Parser().constructor.should.eql(N3Parser);
      N3Parser().should.be.an.instanceof(N3Parser);
    },
    
    'should be an N3Parser constructor': function (N3Parser) {
      new N3Parser().constructor.should.eql(N3Parser);
      new N3Parser().should.be.an.instanceof(N3Parser);
    },
  },
  
  'An N3Parser instance': {
    topic: new N3Parser(),
    
    'should parse the empty string':
      shouldParse('',
                  []),
    
    'should parse a whitespace string':
      shouldParse(' \t \n  ',
                  []),
  },
}).export(module);

function shouldParse(input, expected) {
  return function (n3parser) {
    var store = n3parser.parse(input);
    store.size.should.eql(expected.length);
    expected.forEach(function (triple) {
      store.find(triple.subject, triple.predicate, triple.object, triple.context).should.have.length(1);
    });
  };
}
