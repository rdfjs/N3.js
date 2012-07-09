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
    
    'should parse a triple with a literal':
      shouldParse('<a> <b> "string".',
                  ['a', 'b', '"string"']),
    
    'should parse a triple with a numeric literal':
      shouldParse('<a> <b> 3.0.',
                  ['a', 'b', '"3.0"']),
    
    'should parse a triple with a literal and a language code':
      shouldParse('<a> <b> "string"@en.',
                  ['a', 'b', '"string"@en']),
    
    'should parse a triple with a literal and a URI type':
      shouldParse('<a> <b> "string"^^<type>.',
                  ['a', 'b', '"string"^^type']),
    
    'should parse a triple with a literal and a qname type':
      shouldParse('@prefix x: <y#>. <a> <b> "string"^^x:z.',
                  ['a', 'b', '"string"^^y#z']),
    
    'should not parse a triple with a literal and a qname type with an inexistent prefix':
      shouldNotParse('<a> <b> "string"^^x:z.',
                     'Undefined prefix "x:" at line 1.'),
    
    'should parse triples with prefixes':
      shouldParse('@prefix : <#>.\n' +
                  '@prefix a: <a#>.\n' +
                  ':x a:a a:b.',
                  ['#x', 'a#a', 'a#b']),
    
    'should parse triples with prefixes and different punctuation':
      shouldParse('@prefix : <#>.\n' +
                  '@prefix a: <a#>.\n' +
                  ':x a:a a:b;a:c a:d,a:e.',
                  ['#x', 'a#a', 'a#b'],
                  ['#x', 'a#c', 'a#d'],
                  ['#x', 'a#c', 'a#e']),
    
    'should not parse undefined prefix in subject':
      shouldNotParse(':a ',
                     'Undefined prefix ":" at line 1.'),
    
    'should not parse undefined prefix in predicate':
      shouldNotParse('<a> b:c ',
                     'Undefined prefix "b:" at line 1.'),
    
    'should not parse undefined prefix in object':
      shouldNotParse('<a> <b> c:d ',
                     'Undefined prefix "c:" at line 1.'),
    
    'should parse statements with shared subjects':
      shouldParse('<a> <b> <c>;\n<d> <e>.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']),
    
    'should parse statements with shared subjects and predicates':
      shouldParse('<a> <b> <c>, <d>.',
                  ['a', 'b', 'c'],
                  ['a', 'b', 'd']),
    
    'should parse statements with named blank nodes':
      shouldParse('_:a _:b _:c.',
                  ['_:b0', '_:b1', '_:b2']),
    
    'should parse statements with empty blank nodes':
      shouldParse('[] _:b [].',
                  ['_:b0', '_:b1', '_:b2']),
    
    'should parse statements with unnamed blank nodes in the subject':
      shouldParse('[<a> <b>] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', 'b']),
    
    'should parse statements with unnamed blank nodes in the object':
      shouldParse('<a> <b> [<c> <d>].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', 'd']),
    
    'should parse statements with unnamed blank nodes with a string object':
      shouldParse('<a> <b> [<c> "x"].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '"x"']),
    
    'should not parse a blank node with missing subject':
      shouldNotParse('<a> <b> [<c>].',
                     'Expected object to follow "c" at line 1.'),
    
    'should parse a multi-statement blank node':
      shouldParse('<a> <b> [ <u> <v>; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']),
    
    'should parse statements with nested blank nodes in the subject':
      shouldParse('[<a> [<x> <y>]] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'x', 'y']),
    
    'should parse statements with nested blank nodes in the object':
      shouldParse('<a> <b> [<c> [<d> <e>]].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '_:b1'],
                  ['_:b1', 'd', 'e']),
    
    'should parse statements with an empty list in the subject':
      shouldParse('() <a> <b>.',
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'a', 'b']),
    
    'should parse statements with an empty list in the object':
      shouldParse('<a> <b> ().',
                  ['a', 'b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a single-element list in the subject':
      shouldParse('(<x>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a single-element list in the object':
      shouldParse('<a> <b> (<x>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a multi-element list in the subject':
      shouldParse('(<x> <y>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a multi-element list in the object':
      shouldParse('<a> <b> (<x> <y>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a list containing strings':
      shouldParse('("y") <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"y"'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a nested empty list':
      shouldParse('<a> <b> (<x> ()).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with non-empty nested lists':
      shouldParse('<a> <b> (<x> (<y>)).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a list containing a blank node':
      shouldParse('([]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should parse statements with a list containing multiple blank nodes':
      shouldParse('([] [<x> <y>]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b3', 'x', 'y']),
    
    'should parse statements with a blank node containing a list':
      shouldParse('[<a> (<b>)] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    
    'should resolve URIs against @base':
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> <c>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']),
    
    'should not parse improperly nested square brackets':
      shouldNotParse('<a> <b> [<c> <d>]].',
                     'Expected punctuation to follow "_:b0" at line 1.'),
    
    'should error when a predicate is not there':
      shouldNotParse('<a>.',
                     'Expected predicate to follow "a" at line 1.'),
    
    'should error when an object is not there':
      shouldNotParse('<a> <b>.',
                     'Expected object to follow "b" at line 1.'),
    
    'should error when a dot is not there':
      shouldNotParse('<a> <b> <c>',
                     'Expected punctuation to follow "c" at line 1.'),
  },
}).export(module);

function shouldParse(input, expected) {
  var result = [],
      endCallback;
  expected = Array.prototype.slice.call(arguments, 1);
  var items = expected.map(function (item) {
    return { subject: item[0], predicate: item[1], object: item[2],
             context: item[3] || 'n3/contexts#default' };
  });
  
  function tripleCallback(error, triple) {
    should.not.exist(error);
    if (triple)
      result.push(triple);
    else
      endCallback(null, result);
  }
  
  return {
    topic: function (n3parser) {
      endCallback = this.callback;
      new N3Parser().parse(input, tripleCallback);
    },
    
    'should equal the expected value': function (result) {
      result.should.have.lengthOf(expected.length);
      for (var i = 0; i < items.length; i++)
        should(result.some(function (x) { return eql(items[i], x); }),
               util.inspect(result) + ' should contain ' + util.inspect(items[i]));
    }
  };
}

function shouldNotParse(input, expectedError) {
  var endCallback;
  
  function tripleCallback(error, triple) {
    if (error)
      endCallback(error, triple);
    else if (!triple)
      throw "Expected error " + expectedError;
  }
  
  return {
    topic: function () {
      endCallback = this.callback;
      new N3Parser().parse(input, tripleCallback);
    },
    
    'should equal the expected message': function (error, triple) {
      should.not.exist(triple);
      error.should.eql(expectedError);
    }
  };
}
