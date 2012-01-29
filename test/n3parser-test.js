var N3Parser = require('../lib/n3parser.js');
var vows = require('vows'),
    should = require('should'),
    eql = require('../node_modules/should/lib/eql.js'),
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
      shouldParse(''
                  /* no triples */),
    
    'should parse a whitespace string':
      shouldParse(' \t \n  '
                  /* no triples */),
    
    'should parse a single triple':
      shouldParse('<a> <b> <c>.',
                  ['a', 'b', 'c']),
    
    'should parse three triples':
      shouldParse('<a> <b> <c>.\n<d> <e> <f>.\n<g> <h> <i>.',
                  ['a', 'b', 'c'],
                  ['d', 'e', 'f'],
                  ['g', 'h', 'i']),
    
    'should error when a predicate is not there':
      shouldNotParse('<a>.',
                     'Expected predicate to follow "a" at line 1.'),
    
    'should error when an object is not there':
      shouldNotParse('<a> <b>.',
                     'Expected object to follow "b" at line 1.'),
    
    'should error when a dot is not there':
      shouldNotParse('<a> <b> <c>',
                     'Unexpected eof at line 1.'),
  },
}).export(module);

function shouldParse(input, expected) {
  expected = Array.prototype.slice.call(arguments, 1);
  var items = expected.map(function (item) {
    return { subject: item[0], predicate: item[1], object: item[2],
             context: item[3] || 'n3store/contexts#default' };
  });
  return function (n3parser) {
    var store = n3parser.parse(input);
    store.size.should.eql(expected.length);
    var result = store.find();
    for (var i = 0; i < items.length; i++)
      should(result.some(function (x) { return eql(items[i], x); }),
             util.inspect(result) + ' should contain ' + util.inspect(items[i]));
  };
}

function shouldNotParse(input, expectedError) {
  return function (n3parser) {
    (function () {
      n3parser.parse(input);
    }).should.throw(expectedError);
  };
}
