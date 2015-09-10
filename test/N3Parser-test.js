var N3Parser = require('../N3').Parser;
var chai = require('chai');
var expect = chai.expect;
chai.should();
chai.use(require('chai-things'));

describe('N3Parser', function () {
  describe('The N3Parser module', function () {
    it('should be a function', function () {
      N3Parser.should.be.a('function');
    });

    it('should make N3Parser objects', function () {
      N3Parser().should.be.an.instanceof(N3Parser);
    });

    it('should be an N3Parser constructor', function () {
      new N3Parser().should.be.an.instanceof(N3Parser);
    });
  });

  describe('An N3Parser instance', function () {
    beforeEach(N3Parser._resetBlankNodeIds);

    it('should parse the empty string',
      shouldParse(''
                  /* no triples */));

    it('should parse a whitespace string',
      shouldParse(' \t \n  '
                  /* no triples */));

    it('should parse a single triple',
      shouldParse('<a> <b> <c>.',
                  ['a', 'b', 'c']));

    it('should parse three triples',
      shouldParse('<a> <b> <c>.\n<d> <e> <f>.\n<g> <h> <i>.',
                  ['a', 'b', 'c'],
                  ['d', 'e', 'f'],
                  ['g', 'h', 'i']));

    it('should parse a triple with a literal',
      shouldParse('<a> <b> "string".',
                  ['a', 'b', '"string"']));

    it('should parse a triple with a numeric literal',
      shouldParse('<a> <b> 3.0.',
                  ['a', 'b', '"3.0"^^http://www.w3.org/2001/XMLSchema#decimal']));

    it('should parse a triple with an integer literal',
      shouldParse('<a> <b> 3.',
                  ['a', 'b', '"3"^^http://www.w3.org/2001/XMLSchema#integer']));

    it('should parse a triple with a floating point literal',
      shouldParse('<a> <b> 1.3e2.',
                  ['a', 'b', '"1.3e2"^^http://www.w3.org/2001/XMLSchema#double']));

    it('should parse a triple with a boolean literal',
      shouldParse('<a> <b> true.',
                  ['a', 'b', '"true"^^http://www.w3.org/2001/XMLSchema#boolean']));

    it('should parse a triple with a literal and a language code',
      shouldParse('<a> <b> "string"@en.',
                  ['a', 'b', '"string"@en']));

    it('should normalize language codes to lowercase',
      shouldParse('<a> <b> "string"@EN.',
                  ['a', 'b', '"string"@en']));

    it('should parse a triple with a literal and an IRI type',
      shouldParse('<a> <b> "string"^^<type>.',
                  ['a', 'b', '"string"^^type']));

    it('should parse a triple with a literal and a prefixed name type',
      shouldParse('@prefix x: <y#>. <a> <b> "string"^^x:z.',
                  ['a', 'b', '"string"^^y#z']));

    it('should not parse a triple with a literal and a prefixed name type with an inexistent prefix',
      shouldNotParse('<a> <b> "string"^^x:z.',
                     'Undefined prefix "x:" at line 1.'));

    it('should parse triples with prefixes',
      shouldParse('@prefix : <#>.\n' +
                  '@prefix a: <a#>.\n' +
                  ':x a:a a:b.',
                  ['#x', 'a#a', 'a#b']));

    it('should parse triples with prefixes and different punctuation',
      shouldParse('@prefix : <#>.\n' +
                  '@prefix a: <a#>.\n' +
                  ':x a:a a:b;a:c a:d,a:e.',
                  ['#x', 'a#a', 'a#b'],
                  ['#x', 'a#c', 'a#d'],
                  ['#x', 'a#c', 'a#e']));

    it('should not parse undefined empty prefix in subject',
      shouldNotParse(':a ',
                     'Undefined prefix ":" at line 1.'));

    it('should not parse undefined prefix in subject',
      shouldNotParse('a:a ',
                     'Undefined prefix "a:" at line 1.'));

    it('should not parse undefined prefix in predicate',
      shouldNotParse('<a> b:c ',
                     'Undefined prefix "b:" at line 1.'));

    it('should not parse undefined prefix in object',
      shouldNotParse('<a> <b> c:d ',
                     'Undefined prefix "c:" at line 1.'));

    it('should not parse undefined prefix in datatype',
      shouldNotParse('<a> <b> "c"^^d:e ',
                     'Undefined prefix "d:" at line 1.'));

    it('should parse triples with SPARQL prefixes',
      shouldParse('PREFIX : <#>\n' +
                  'PrEfIX a: <a#> ' +
                  ':x a:a a:b.',
                  ['#x', 'a#a', 'a#b']));

    it('should not parse prefix declarations without prefix',
      shouldNotParse('@prefix <a> ',
                     'Expected prefix to follow @prefix at line 1.'));

    it('should not parse prefix declarations without IRI',
      shouldNotParse('@prefix : .',
                     'Expected IRI to follow prefix ":" at line 1.'));

    it('should not parse prefix declarations without a dot',
      shouldNotParse('@prefix : <a> ;',
                     'Expected declaration to end with a dot at line 1.'));

    it('should parse statements with shared subjects',
      shouldParse('<a> <b> <c>;\n<d> <e>.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']));

    it('should parse statements with shared subjects and trailing semicolon',
      shouldParse('<a> <b> <c>;\n<d> <e>;\n.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']));

    it('should parse statements with shared subjects and multiple semicolons',
      shouldParse('<a> <b> <c>;;\n<d> <e>.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']));

    it('should parse statements with shared subjects and predicates',
      shouldParse('<a> <b> <c>, <d>.',
                  ['a', 'b', 'c'],
                  ['a', 'b', 'd']));

    it('should parse statements with named blank nodes',
      shouldParse('_:a <b> _:c.',
                  ['_:b0_a', 'b', '_:b0_c']));

    it('should not parse statements with blank predicates',
      shouldNotParse('<a> _:b <c>.',
                     'Disallowed blank node as predicate at line 1.'));

    it('should parse statements with empty blank nodes',
      shouldParse('[] <b> [].',
                  ['_:b0', 'b', '_:b1']));

    it('should parse statements with unnamed blank nodes in the subject',
      shouldParse('[<a> <b>] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', 'b']));

    it('should parse statements with unnamed blank nodes in the object',
      shouldParse('<a> <b> [<c> <d>].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', 'd']));

    it('should parse statements with unnamed blank nodes with a string object',
      shouldParse('<a> <b> [<c> "x"].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '"x"']));

    it('should not parse a blank node with missing subject',
      shouldNotParse('<a> <b> [<c>].',
                     'Expected object to follow "c" at line 1.'));

    it('should not parse a blank node with only a semicolon',
      shouldNotParse('<a> <b> [;].',
                     'Unexpected ] at line 1.'));

    it('should parse a blank node with a trailing semicolon',
      shouldParse('<a> <b> [ <u> <v>; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v']));

    it('should parse a blank node with multiple trailing semicolons',
      shouldParse('<a> <b> [ <u> <v>;;; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v']));

    it('should parse a multi-predicate blank node',
      shouldParse('<a> <b> [ <u> <v>; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']));

    it('should parse a multi-predicate blank node with multiple semicolons',
      shouldParse('<a> <b> [ <u> <v>;;; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']));

    it('should parse a multi-object blank node',
      shouldParse('<a> <b> [ <u> <v>, <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'u', 'z']));

    it('should parse a multi-statement blank node ending with a literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z" ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"']));

    it('should parse a multi-statement blank node ending with a typed literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^t']));

    it('should parse a multi-statement blank node ending with a string with language',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^t']));

    it('should parse a multi-statement blank node with trailing semicolon',
      shouldParse('<a> <b> [ <u> <v>; <w> <z>; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']));

    it('should parse statements with nested blank nodes in the subject',
      shouldParse('[<a> [<x> <y>]] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'x', 'y']));

    it('should parse statements with nested blank nodes in the object',
      shouldParse('<a> <b> [<c> [<d> <e>]].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '_:b1'],
                  ['_:b1', 'd', 'e']));

    it('should not parse an invalid blank node',
      shouldNotParse('[ <a> <b> .',
                     'Expected punctuation to follow "b" at line 1.'));

    it('should parse statements with an empty list in the subject',
      shouldParse('() <a> <b>.',
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'a', 'b']));

    it('should parse statements with an empty list in the object',
      shouldParse('<a> <b> ().',
                  ['a', 'b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a single-element list in the subject',
      shouldParse('(<x>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a single-element list in the object',
      shouldParse('<a> <b> (<x>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a multi-element list in the subject',
      shouldParse('(<x> <y>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a multi-element list in the object',
      shouldParse('<a> <b> (<x> <y>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with prefixed names in lists',
      shouldParse('@prefix a: <a#>. <a> <b> (a:x a:y).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a#x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a#y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should not parse statements with undefined prefixes in lists',
      shouldNotParse('<a> <b> (a:x a:y).',
                     'Undefined prefix "a:" at line 1.'));

    it('should parse statements with blank nodes in lists',
      shouldParse('<a> <b> (_:x _:y).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b0_x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'  ],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b0_y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a list containing strings',
      shouldParse('("y") <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"y"'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a nested empty list',
      shouldParse('<a> <b> (<x> ()).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with non-empty nested lists',
      shouldParse('<a> <b> (<x> (<y>)).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a list containing a blank node',
      shouldParse('([]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should parse statements with a list containing multiple blank nodes',
      shouldParse('([] [<x> <y>]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b3', 'x', 'y']));

    it('should parse statements with a blank node containing a list',
      shouldParse('[<a> (<b>)] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
                           'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should not parse an invalid list',
      shouldNotParse('<a> <b> (]).',
                     'Expected list item instead of "]" at line 1.'));

    it('should resolve IRIs against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> <c>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    it('should resolve IRIs against SPARQL base',
      shouldParse('BASE <http://ex.org/>\n' +
                  '<a> <b> <c>. ' +
                  'BASE <d/> ' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    it('should resolve IRIs against a @base with query string',
      shouldParse('@base <http://ex.org/?foo>.\n' +
                  '<> <b> <c>.\n' +
                  '@base <d/?bar>.\n' +
                  '<> <f> <g>.',
                  ['http://ex.org/?foo', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/?bar', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    it('should resolve IRIs with query string against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<?> <?a> <?a=b>.\n' +
                  '@base <d>.\n' +
                  '<?> <?a> <?a=b>.' +
                  '@base <?e>.\n' +
                  '<> <?a> <?a=b>.',
                  ['http://ex.org/?', 'http://ex.org/?a', 'http://ex.org/?a=b'],
                  ['http://ex.org/d?', 'http://ex.org/d?a', 'http://ex.org/d?a=b'],
                  ['http://ex.org/d?e', 'http://ex.org/d?a', 'http://ex.org/d?a=b']));

    it('should not resolve IRIs with colons',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a>   <b>   <c>.\n' +
                  '<A:>  <b:>  <c:>.\n' +
                  '<a:a> <b:B> <C-D:c>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['A:',  'b:',  'c:'],
                  ['a:a', 'b:B', 'C-D:c']));

    it('should resolve datatype IRIs against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> "c"^^<d>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> "g"^^<h>.',
                  ['http://ex.org/a', 'http://ex.org/b', '"c"^^http://ex.org/d'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', '"g"^^http://ex.org/d/h']));

    it('should not resolve prefixed names',
      shouldParse('PREFIX ex: <http://ex.org/a/bb/ccc/../>\n' +
                  'ex:a ex:b ex:c .',
                  ['http://ex.org/a/bb/ccc/../a',
                   'http://ex.org/a/bb/ccc/../b',
                   'http://ex.org/a/bb/ccc/../c']));

    it('should parse an empty default graph',
      shouldParse('{}'));

    it('should parse a one-triple default graph ending without a dot',
      shouldParse('{<a> <b> <c>}',
                  ['a', 'b', 'c']));

    it('should parse a one-triple default graph ending with a dot',
      shouldParse('{<a> <b> <c>.}',
                  ['a', 'b', 'c']));

    it('should parse a three-triple default graph ending without a dot',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']));

    it('should parse a three-triple default graph ending with a dot',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']));

    it('should parse a three-triple default graph ending with a semicolon',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>;}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']));

    it('should parse an empty named graph with an IRI',
      shouldParse('<g>{}'));

    it('should parse a one-triple named graph with an IRI ending without a dot',
      shouldParse('<g> {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g']));

    it('should parse a one-triple named graph with an IRI ending with a dot',
      shouldParse('<g>{<a> <b> <c>.}',
                  ['a', 'b', 'c', 'g']));

    it('should parse a three-triple named graph with an IRI ending without a dot',
      shouldParse('<g> {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', 'g'],
                  ['a', 'd', 'e', 'g'],
                  ['a', 'd', 'f', 'g']));

    it('should parse a three-triple named graph with an IRI ending with a dot',
      shouldParse('<g>{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', 'g'],
                  ['a', 'd', 'e', 'g'],
                  ['a', 'd', 'f', 'g']));

    it('should parse an empty named graph with a prefixed name',
      shouldParse('@prefix g: <g#>.\ng:h {}'));

    it('should parse a one-triple named graph with a prefixed name ending without a dot',
      shouldParse('@prefix g: <g#>.\ng:h {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g#h']));

    it('should parse a one-triple named graph with a prefixed name ending with a dot',
      shouldParse('@prefix g: <g#>.\ng:h{<a> <b> <c>.}',
                  ['a', 'b', 'c', 'g#h']));

    it('should parse a three-triple named graph with a prefixed name ending without a dot',
      shouldParse('@prefix g: <g#>.\ng:h {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', 'g#h'],
                  ['a', 'd', 'e', 'g#h'],
                  ['a', 'd', 'f', 'g#h']));

    it('should parse a three-triple named graph with a prefixed name ending with a dot',
      shouldParse('@prefix g: <g#>.\ng:h{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', 'g#h'],
                  ['a', 'd', 'e', 'g#h'],
                  ['a', 'd', 'f', 'g#h']));

    it('should parse an empty anonymous graph',
      shouldParse('[] {}'));

    it('should parse a one-triple anonymous graph ending without a dot',
      shouldParse('[] {<a> <b> <c>}',
                  ['a', 'b', 'c', '_:b0']));

    it('should parse a one-triple anonymous graph ending with a dot',
      shouldParse('[]{<a> <b> <c>.}',
                  ['a', 'b', 'c', '_:b0']));

    it('should parse a three-triple anonymous graph ending without a dot',
      shouldParse('[] {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', '_:b0'],
                  ['a', 'd', 'e', '_:b0'],
                  ['a', 'd', 'f', '_:b0']));

    it('should parse a three-triple anonymous graph ending with a dot',
      shouldParse('[]{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', '_:b0'],
                  ['a', 'd', 'e', '_:b0'],
                  ['a', 'd', 'f', '_:b0']));

    it('should parse an empty named graph with an IRI and the GRAPH keyword',
      shouldParse('GRAPH <g> {}'));

    it('should parse an empty named graph with a prefixed name and the GRAPH keyword',
      shouldParse('@prefix g: <g#>.\nGRAPH g:h {}'));

    it('should parse an empty anonymous graph and the GRAPH keyword',
      shouldParse('GRAPH [] {}'));

    it('should parse a one-triple named graph with an IRI and the GRAPH keyword',
      shouldParse('GRAPH <g> {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g']));

    it('should parse a one-triple named graph with a prefixed name and the GRAPH keyword',
      shouldParse('@prefix g: <g#>.\nGRAPH g:h {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g#h']));

    it('should parse a one-triple anonymous graph and the GRAPH keyword',
      shouldParse('GRAPH [] {<a> <b> <c>}',
                  ['a', 'b', 'c', '_:b0']));

    it('should parse a graph with 8-bit unicode escape sequences',
      shouldParse('<\\U0001d400> {\n<\\U0001d400> <\\U0001d400> "\\U0001d400"^^<\\U0001d400>\n}\n',
                  ['\ud835\udC00', '\ud835\udc00', '"\ud835\udc00"^^\ud835\udc00', '\ud835\udc00']));

    it('should not parse a single closing brace',
      shouldNotParse('}',
                     'Unexpected graph closing at line 1.'));

    it('should not parse a single opening brace',
      shouldNotParse('{',
                     'Expected subject but got eof at line 1.'));

    it('should not parse a superfluous closing brace ',
      shouldNotParse('{}}',
                     'Unexpected graph closing at line 1.'));

    it('should not parse a graph with only a dot',
      shouldNotParse('{.}',
                     'Expected subject but got . at line 1.'));

    it('should not parse a graph with only a semicolon',
      shouldNotParse('{;}',
                     'Expected subject but got ; at line 1.'));

    it('should not parse an unclosed graph',
      shouldNotParse('{<a> <b> <c>.',
                     'Unclosed graph at line 1.'));

    it('should not parse a named graph with a list node as label',
      shouldNotParse('() {}',
                     'Expected predicate to follow "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" at line 1.'));

    it('should not parse a named graph with a non-empty blank node as label',
      shouldNotParse('[<a> <b>] {}',
                     'Expected predicate to follow "_:b0" at line 1.'));

    it('should not parse a named graph with the GRAPH keyword and a non-empty blank node as label',
      shouldNotParse('GRAPH [<a> <b>] {}',
                     'Invalid graph label at line 1.'));

    it('should not parse a triple after the GRAPH keyword',
      shouldNotParse('GRAPH <a> <b> <c>.',
                     'Expected graph but got IRI at line 1.'));

    it('should not parse repeated GRAPH keywords',
      shouldNotParse('GRAPH GRAPH <g> {}',
                     'Invalid graph label at line 1.'));

    it('should parse a quad with 4 IRIs',
      shouldParse('<a> <b> <c> <g>.',
                  ['a', 'b', 'c', 'g']));

    it('should parse a quad with 4 prefixed names',
      shouldParse('@prefix p: <p#>.\np:a p:b p:c p:g.',
                  ['p#a', 'p#b', 'p#c', 'p#g']));

    it('should not parse a quad with an undefined prefix',
      shouldNotParse('<a> <b> <c> p:g.',
                     'Undefined prefix "p:" at line 1.'));

    it('should parse a quad with 3 IRIs and a literal',
      shouldParse('<a> <b> "c"^^<d> <g>.',
                  ['a', 'b', '"c"^^d', 'g']));

    it('should parse a quad with 2 blank nodes and a literal',
      shouldParse('_:a <b> "c"^^<d> _:g.',
                  ['_:b0_a', 'b', '"c"^^d', '_:b0_g']));

    it('should not parse a quad in a graph',
      shouldNotParse('{<a> <b> <c> <g>.}',
                     'Expected punctuation to follow "c" at line 1.'));

    it('should not parse a quad with different punctuation',
      shouldNotParse('<a> <b> <c> <g>;',
                     'Expected dot to follow quad at line 1.'));

    it('should not parse base declarations without IRI',
      shouldNotParse('@base a: ',
                     'Expected IRI to follow base declaration at line 1.'));

    it('should not parse invalid @base statements',
      shouldNotParse('@base <http://ex.org/foo#bar>.\n' +
                     '<a> <b> <c>.\n',
                     'Invalid base IRI http://ex.org/foo#bar at line 1.'));

    it('should not parse improperly nested parentheses and brackets',
      shouldNotParse('<a> <b> [<c> (<d>]).',
                     'Expected list item instead of "]" at line 1.'));

    it('should not parse improperly nested square brackets',
      shouldNotParse('<a> <b> [<c> <d>]].',
                     'Expected punctuation to follow "_:b0" at line 1.'));

    it('should error when an object is not there',
      shouldNotParse('<a> <b>.',
                     'Expected object to follow "b" at line 1.'));

    it('should error when a dot is not there',
      shouldNotParse('<a> <b> <c>',
                     'Expected punctuation to follow "c" at line 1.'));

    it('should error with an abbreviation in the subject',
      shouldNotParse('a <a> <a>.',
                     'Expected subject but got abbreviation at line 1.'));

    it('should error with an abbreviation in the object',
      shouldNotParse('<a> <a> a .',
                     'Expected object to follow "a" at line 1.'));

    it('should error if punctuation follows a subject',
      shouldNotParse('<a> .',
                     'Unexpected . at line 1.'));

    it('should error if an unexpected token follows a subject',
      shouldNotParse('<a> [',
                     'Expected predicate to follow "a" at line 1.'));

    it('should not error if there is no triple callback', function () {
      new N3Parser().parse('');
    });

    it('should return prefixes through a callback', function (done) {
      var prefixes = {};
      new N3Parser().parse('@prefix a: <IRIa>. a:a a:b a:c. @prefix b: <IRIb>.',
                           tripleCallback, prefixCallback);

      function tripleCallback(error, triple) {
        expect(error).not.to.exist;
        if (!triple) {
          Object.keys(prefixes).should.have.length(2);
          expect(prefixes).to.have.property('a', 'IRIa');
          expect(prefixes).to.have.property('b', 'IRIb');
          done();
        }
      }

      function prefixCallback(prefix, iri) {
        expect(prefix).to.exist;
        expect(iri).to.exist;
        prefixes[prefix] = iri;
      }
    });

    it('should return prefixes at the last triple callback', function (done) {
      new N3Parser().parse('@prefix a: <IRIa>. a:a a:b a:c. @prefix b: <IRIb>.', tripleCallback);

      function tripleCallback(error, triple, prefixes) {
        expect(error).not.to.exist;
        if (triple)
          expect(prefixes).not.to.exist;
        else {
          expect(prefixes).to.exist;
          Object.keys(prefixes).should.have.length(2);
          expect(prefixes).to.have.property('a', 'IRIa');
          expect(prefixes).to.have.property('b', 'IRIb');
          done();
        }
      }
    });

    describe('when the addChunk/end interface is used', function () {
      it('should return the parsed triples', function () {
        var triples = [], parser = new N3Parser();
        parser.parse(function (error, triple) { triple && triples.push(triple); });
        parser.addChunk('<a> <b> <c>,');
        triples.should.have.length(1);
        parser.addChunk('<d>.');
        parser.end();
        triples.should.have.length(2);
      });
    });
  });

  describe('An N3Parser instance with a document IRI', function () {
    var parser = new N3Parser({ documentIRI: 'http://ex.org/x/yy/zzz/f.ttl' });

    it('should resolve IRIs against the document IRI',
      shouldParse(parser,
                  '@prefix : <#>.\n' +
                  '<a> <b> <c> <g>.\n' +
                  ':d :e :f :g.',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/b', 'http://ex.org/x/yy/zzz/c', 'http://ex.org/x/yy/zzz/g'],
                  ['http://ex.org/x/yy/zzz/f.ttl#d', 'http://ex.org/x/yy/zzz/f.ttl#e', 'http://ex.org/x/yy/zzz/f.ttl#f', 'http://ex.org/x/yy/zzz/f.ttl#g']));

    it('should resolve IRIs with a trailing slash against the document IRI',
      shouldParse(parser,
                  '</a> </a/b> </a/b/c>.\n',
                  ['http://ex.org/a', 'http://ex.org/a/b', 'http://ex.org/a/b/c']));

    it('should resolve IRIs starting with ./ against the document IRI',
      shouldParse(parser,
                  '<./a> <./a/b> <./a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/a/b', 'http://ex.org/x/yy/zzz/a/b/c']));

    it('should resolve IRIs starting with multiple ./ sequences against the document IRI',
      shouldParse(parser,
                  '<./././a> <./././././a/b> <././././././a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/a/b', 'http://ex.org/x/yy/zzz/a/b/c']));

    it('should resolve IRIs starting with ../ against the document IRI',
      shouldParse(parser,
                  '<../a> <../a/b> <../a/b/c>.\n',
                  ['http://ex.org/x/yy/a', 'http://ex.org/x/yy/a/b', 'http://ex.org/x/yy/a/b/c']));

    it('should resolve IRIs starting multiple ../ sequences against the document IRI',
      shouldParse(parser,
                  '<../../a> <../../../a/b> <../../../../../../../../a/b/c>.\n',
                  ['http://ex.org/x/a', 'http://ex.org/a/b', 'http://ex.org/a/b/c']));

    it('should resolve IRIs starting with mixes of ./ and ../ sequences against the document IRI',
      shouldParse(parser,
                  '<.././a> <./.././a/b> <./.././.././a/b/c>.\n',
                  ['http://ex.org/x/yy/a', 'http://ex.org/x/yy/a/b', 'http://ex.org/x/a/b/c']));

    it('should resolve IRIs starting with .x, ..x, or .../ against the document IRI',
      shouldParse(parser,
                  '<.x/a> <..x/a/b> <.../a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/.x/a', 'http://ex.org/x/yy/zzz/..x/a/b', 'http://ex.org/x/yy/zzz/.../a/b/c']));

    it('should resolve datatype IRIs against the document IRI',
      shouldParse(parser,
                  '<a> <b> "c"^^<d>.',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/b', '"c"^^http://ex.org/x/yy/zzz/d']));

    it('should resolve IRIs in lists against the document IRI',
      shouldParse(parser,
          '(<a> <b>) <p> (<c> <d>).',
          ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://ex.org/x/yy/zzz/a'],
          ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
          ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://ex.org/x/yy/zzz/b'],
          ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
          ['_:b0', 'http://ex.org/x/yy/zzz/p', '_:b2'],
          ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://ex.org/x/yy/zzz/c'],
          ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b3'],
          ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://ex.org/x/yy/zzz/d'],
          ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should respect @base statements',
      shouldParse(parser,
                  '<a> <b> <c>.\n' +
                  '@base <http://ex.org/x/>.\n' +
                  '<e> <f> <g>.\n' +
                  '@base <d/>.\n' +
                  '<h> <i> <j>.\n' +
                  '@base </e/>.\n' +
                  '<k> <l> <m>.',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/b', 'http://ex.org/x/yy/zzz/c'],
                  ['http://ex.org/x/e', 'http://ex.org/x/f', 'http://ex.org/x/g'],
                  ['http://ex.org/x/d/h', 'http://ex.org/x/d/i', 'http://ex.org/x/d/j'],
                  ['http://ex.org/e/k', 'http://ex.org/e/l', 'http://ex.org/e/m']));
  });

  describe('An N3Parser instance with a blank node prefix', function () {
    var parser = new N3Parser({ blankNodePrefix: '_:blank' });

    it('should use the given prefix for blank nodes',
      shouldParse(parser,
                  '_:a <b> _:c.\n',
                  ['_:blanka', 'b', '_:blankc']));
  });

  describe('An N3Parser instance with an empty blank node prefix', function () {
    var parser = new N3Parser({ blankNodePrefix: '' });

    it('should not use a prefix for blank nodes',
      shouldParse(parser,
                  '_:a <b> _:c.\n',
                  ['_:a', 'b', '_:c']));
  });

  describe('An N3Parser instance with an invalid document IRI', function () {
    it('cannot be created', function (done) {
      try {
        var parser = new N3Parser({ documentIRI: 'http://ex.org/x/yy/zzz/f#' });
      }
      catch (error) {
        error.message.should.equal('Invalid base IRI http://ex.org/x/yy/zzz/f#');
        done();
      }
    });
  });

  describe('An N3Parser instance with a non-string format', function () {
    var parser = new N3Parser({ format: 1 });

    it('should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']));

    it('should parse a graph',
      shouldParse(parser, '{<a> <b> <c>}', ['a', 'b', 'c']));
  });

  describe('An N3Parser instance for the Turtle format', function () {
    var parser = new N3Parser({ format: 'Turtle' });

    it('should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']));

    it('should not parse a default graph',
      shouldNotParse(parser, '{}', 'Expected subject but got { at line 1.'));

    it('should not parse a named graph',
      shouldNotParse(parser, '<g> {}', 'Expected predicate to follow "g" at line 1.'));

    it('should not parse a named graph with the GRAPH keyword',
      shouldNotParse(parser, 'GRAPH <g> {}', 'Expected subject but got GRAPH at line 1.'));

    it('should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "c" at line 1.'));
  });

  describe('An N3Parser instance for the TriG format', function () {
    var parser = new N3Parser({ format: 'TriG' });

    it('should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']));

    it('should parse a default graph',
      shouldParse(parser, '{}'));

    it('should parse a named graph',
      shouldParse(parser, '<g> {}'));

    it('should parse a named graph with the GRAPH keyword',
      shouldParse(parser, 'GRAPH <g> {}'));

    it('should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "c" at line 1.'));
  });

  describe('An N3Parser instance for the N-Triples format', function () {
    var parser = new N3Parser({ format: 'N-Triples' });

    it('should parse a single triple',
      shouldParse(parser, '<http://ex.org/a> <http://ex.org/b> "c".',
                          ['http://ex.org/a', 'http://ex.org/b', '"c"']));

    it('should not parse a single quad',
      shouldNotParse(parser, '<http://ex.org/a> <http://ex.org/b> "c" <http://ex.org/g>.',
                             'Expected punctuation to follow ""c"" at line 1.'));

    it('should not parse relative IRIs',
      shouldNotParse(parser, '<a> <b> <c>.', 'Disallowed relative IRI at line 1.'));

    it('should not parse a prefix declaration',
      shouldNotParse(parser, '@prefix : <p#>.', 'Syntax error: unexpected "@prefix" on line 1.'));
  });

  describe('An N3Parser instance for the N-Quads format', function () {
    var parser = new N3Parser({ format: 'N-Quads' });

    it('should parse a single triple',
      shouldParse(parser, '<http://ex.org/a> <http://ex.org/b> <http://ex.org/c>.',
                          ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c']));

    it('should parse a single quad',
      shouldParse(parser, '<http://ex.org/a> <http://ex.org/b> "c" <http://ex.org/g>.',
                          ['http://ex.org/a', 'http://ex.org/b', '"c"', 'http://ex.org/g']));

    it('should not parse relative IRIs',
      shouldNotParse(parser, '<a> <b> <c>.', 'Disallowed relative IRI at line 1.'));

    it('should not parse a prefix declaration',
      shouldNotParse(parser, '@prefix : <p#>.', 'Syntax error: unexpected "@prefix" on line 1.'));
  });

  describe('IRI resolution', function () {
    describe('RFC3986 normal examples', function () {
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g:h',     'g:h');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g',       'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', './g',     'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g/',      'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/d;p?q', '/g',      'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', '//g',     'http://g');
      itShouldResolve('http://a/bb/ccc/d;p?q', '?y',      'http://a/bb/ccc/d;p?y');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g?y',     'http://a/bb/ccc/g?y');
      itShouldResolve('http://a/bb/ccc/d;p?q', '#s',      'http://a/bb/ccc/d;p?q#s');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g#s',     'http://a/bb/ccc/g#s');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g?y#s',   'http://a/bb/ccc/g?y#s');
      itShouldResolve('http://a/bb/ccc/d;p?q', ';x',      'http://a/bb/ccc/;x');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g;x',     'http://a/bb/ccc/g;x');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g;x?y#s', 'http://a/bb/ccc/g;x?y#s');
      itShouldResolve('http://a/bb/ccc/d;p?q', '',        'http://a/bb/ccc/d;p?q');
      itShouldResolve('http://a/bb/ccc/d;p?q', '.',       'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/d;p?q', './',      'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/d;p?q', '..',      'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/d;p?q', '../',     'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/d;p?q', '../g',    'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', '../..',   'http://a/');
      itShouldResolve('http://a/bb/ccc/d;p?q', '../../',  'http://a/');
      itShouldResolve('http://a/bb/ccc/d;p?q', '../../g', 'http://a/g');
    });

    describe('RFC3986 abnormal examples', function () {
      itShouldResolve('http://a/bb/ccc/d;p?q', '../../../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', '../../../../g', 'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', '/./g',          'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', '/../g',         'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g.',            'http://a/bb/ccc/g.');
      itShouldResolve('http://a/bb/ccc/d;p?q', '.g',            'http://a/bb/ccc/.g');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g..',           'http://a/bb/ccc/g..');
      itShouldResolve('http://a/bb/ccc/d;p?q', '..g',           'http://a/bb/ccc/..g');
      itShouldResolve('http://a/bb/ccc/d;p?q', './../g',        'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/d;p?q', './g/.',         'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g/./h',         'http://a/bb/ccc/g/h');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g/../h',        'http://a/bb/ccc/h');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g;x=1/./y',     'http://a/bb/ccc/g;x=1/y');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g;x=1/../y',    'http://a/bb/ccc/y');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g?y/./x',       'http://a/bb/ccc/g?y/./x');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g?y/../x',      'http://a/bb/ccc/g?y/../x');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g#s/./x',       'http://a/bb/ccc/g#s/./x');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'g#s/../x',      'http://a/bb/ccc/g#s/../x');
      itShouldResolve('http://a/bb/ccc/d;p?q', 'http:g',        'http:g');
    });

    describe('RFC3986 normal examples with trailing slash in base IRI', function () {
      itShouldResolve('http://a/bb/ccc/d/', 'g:h',     'g:h');
      itShouldResolve('http://a/bb/ccc/d/', 'g',       'http://a/bb/ccc/d/g');
      itShouldResolve('http://a/bb/ccc/d/', './g',     'http://a/bb/ccc/d/g');
      itShouldResolve('http://a/bb/ccc/d/', 'g/',      'http://a/bb/ccc/d/g/');
      itShouldResolve('http://a/bb/ccc/d/', '/g',      'http://a/g');
      itShouldResolve('http://a/bb/ccc/d/', '//g',     'http://g');
      itShouldResolve('http://a/bb/ccc/d/', '?y',      'http://a/bb/ccc/d/?y');
      itShouldResolve('http://a/bb/ccc/d/', 'g?y',     'http://a/bb/ccc/d/g?y');
      itShouldResolve('http://a/bb/ccc/d/', '#s',      'http://a/bb/ccc/d/#s');
      itShouldResolve('http://a/bb/ccc/d/', 'g#s',     'http://a/bb/ccc/d/g#s');
      itShouldResolve('http://a/bb/ccc/d/', 'g?y#s',   'http://a/bb/ccc/d/g?y#s');
      itShouldResolve('http://a/bb/ccc/d/', ';x',      'http://a/bb/ccc/d/;x');
      itShouldResolve('http://a/bb/ccc/d/', 'g;x',     'http://a/bb/ccc/d/g;x');
      itShouldResolve('http://a/bb/ccc/d/', 'g;x?y#s', 'http://a/bb/ccc/d/g;x?y#s');
      itShouldResolve('http://a/bb/ccc/d/', '',        'http://a/bb/ccc/d/');
      itShouldResolve('http://a/bb/ccc/d/', '.',       'http://a/bb/ccc/d/');
      itShouldResolve('http://a/bb/ccc/d/', './',      'http://a/bb/ccc/d/');
      itShouldResolve('http://a/bb/ccc/d/', '..',      'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/d/', '../',     'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/d/', '../g',    'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/d/', '../..',   'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/d/', '../../',  'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/d/', '../../g', 'http://a/bb/g');
    });

    describe('RFC3986 abnormal examples with trailing slash in base IRI', function () {
      itShouldResolve('http://a/bb/ccc/d/', '../../../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/d/', '../../../../g', 'http://a/g');
      itShouldResolve('http://a/bb/ccc/d/', '/./g',          'http://a/g');
      itShouldResolve('http://a/bb/ccc/d/', '/../g',         'http://a/g');
      itShouldResolve('http://a/bb/ccc/d/', 'g.',            'http://a/bb/ccc/d/g.');
      itShouldResolve('http://a/bb/ccc/d/', '.g',            'http://a/bb/ccc/d/.g');
      itShouldResolve('http://a/bb/ccc/d/', 'g..',           'http://a/bb/ccc/d/g..');
      itShouldResolve('http://a/bb/ccc/d/', '..g',           'http://a/bb/ccc/d/..g');
      itShouldResolve('http://a/bb/ccc/d/', './../g',        'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/d/', './g/.',         'http://a/bb/ccc/d/g/');
      itShouldResolve('http://a/bb/ccc/d/', 'g/./h',         'http://a/bb/ccc/d/g/h');
      itShouldResolve('http://a/bb/ccc/d/', 'g/../h',        'http://a/bb/ccc/d/h');
      itShouldResolve('http://a/bb/ccc/d/', 'g;x=1/./y',     'http://a/bb/ccc/d/g;x=1/y');
      itShouldResolve('http://a/bb/ccc/d/', 'g;x=1/../y',    'http://a/bb/ccc/d/y');
      itShouldResolve('http://a/bb/ccc/d/', 'g?y/./x',       'http://a/bb/ccc/d/g?y/./x');
      itShouldResolve('http://a/bb/ccc/d/', 'g?y/../x',      'http://a/bb/ccc/d/g?y/../x');
      itShouldResolve('http://a/bb/ccc/d/', 'g#s/./x',       'http://a/bb/ccc/d/g#s/./x');
      itShouldResolve('http://a/bb/ccc/d/', 'g#s/../x',      'http://a/bb/ccc/d/g#s/../x');
      itShouldResolve('http://a/bb/ccc/d/', 'http:g',        'http:g');
    });

    describe('RFC3986 normal examples with /. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g:h',     'g:h');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g',       'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', './g',     'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g/',      'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '/g',      'http://a/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '//g',     'http://g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '?y',      'http://a/bb/ccc/./d;p?y');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g?y',     'http://a/bb/ccc/g?y');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '#s',      'http://a/bb/ccc/./d;p?q#s');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g#s',     'http://a/bb/ccc/g#s');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g?y#s',   'http://a/bb/ccc/g?y#s');
      itShouldResolve('http://a/bb/ccc/./d;p?q', ';x',      'http://a/bb/ccc/;x');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g;x',     'http://a/bb/ccc/g;x');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g;x?y#s', 'http://a/bb/ccc/g;x?y#s');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '',        'http://a/bb/ccc/./d;p?q');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '.',       'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', './',      'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '..',      'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '../',     'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '../g',    'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '../..',   'http://a/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '../../',  'http://a/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '../../g', 'http://a/g');
    });

    describe('RFC3986 abnormal examples with /. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/./d;p?q', '../../../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '../../../../g', 'http://a/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '/./g',          'http://a/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '/../g',         'http://a/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g.',            'http://a/bb/ccc/g.');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '.g',            'http://a/bb/ccc/.g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g..',           'http://a/bb/ccc/g..');
      itShouldResolve('http://a/bb/ccc/./d;p?q', '..g',           'http://a/bb/ccc/..g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', './../g',        'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/./d;p?q', './g/.',         'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g/./h',         'http://a/bb/ccc/g/h');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g/../h',        'http://a/bb/ccc/h');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g;x=1/./y',     'http://a/bb/ccc/g;x=1/y');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g;x=1/../y',    'http://a/bb/ccc/y');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g?y/./x',       'http://a/bb/ccc/g?y/./x');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g?y/../x',      'http://a/bb/ccc/g?y/../x');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g#s/./x',       'http://a/bb/ccc/g#s/./x');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'g#s/../x',      'http://a/bb/ccc/g#s/../x');
      itShouldResolve('http://a/bb/ccc/./d;p?q', 'http:g',        'http:g');
    });

    describe('RFC3986 normal examples with /.. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g:h',     'g:h');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g',       'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', './g',     'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g/',      'http://a/bb/g/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '/g',      'http://a/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '//g',     'http://g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '?y',      'http://a/bb/ccc/../d;p?y');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g?y',     'http://a/bb/g?y');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '#s',      'http://a/bb/ccc/../d;p?q#s');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g#s',     'http://a/bb/g#s');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g?y#s',   'http://a/bb/g?y#s');
      itShouldResolve('http://a/bb/ccc/../d;p?q', ';x',      'http://a/bb/;x');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g;x',     'http://a/bb/g;x');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g;x?y#s', 'http://a/bb/g;x?y#s');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '',        'http://a/bb/ccc/../d;p?q');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '.',       'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', './',      'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '..',      'http://a/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '../',     'http://a/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '../..',   'http://a/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '../../',  'http://a/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '../../g', 'http://a/g');
    });

    describe('RFC3986 abnormal examples with /.. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/../d;p?q', '../../../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '../../../../g', 'http://a/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '/./g',          'http://a/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '/../g',         'http://a/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g.',            'http://a/bb/g.');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '.g',            'http://a/bb/.g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g..',           'http://a/bb/g..');
      itShouldResolve('http://a/bb/ccc/../d;p?q', '..g',           'http://a/bb/..g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', './../g',        'http://a/g');
      itShouldResolve('http://a/bb/ccc/../d;p?q', './g/.',         'http://a/bb/g/');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g/./h',         'http://a/bb/g/h');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g/../h',        'http://a/bb/h');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g;x=1/./y',     'http://a/bb/g;x=1/y');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g;x=1/../y',    'http://a/bb/y');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g?y/./x',       'http://a/bb/g?y/./x');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g?y/../x',      'http://a/bb/g?y/../x');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g#s/./x',       'http://a/bb/g#s/./x');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'g#s/../x',      'http://a/bb/g#s/../x');
      itShouldResolve('http://a/bb/ccc/../d;p?q', 'http:g',        'http:g');
    });

    describe('RFC3986 normal examples with trailing /. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/.', 'g:h',     'g:h');
      itShouldResolve('http://a/bb/ccc/.', 'g',       'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/.', './g',     'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/.', 'g/',      'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/.', '/g',      'http://a/g');
      itShouldResolve('http://a/bb/ccc/.', '//g',     'http://g');
      itShouldResolve('http://a/bb/ccc/.', '?y',      'http://a/bb/ccc/.?y');
      itShouldResolve('http://a/bb/ccc/.', 'g?y',     'http://a/bb/ccc/g?y');
      itShouldResolve('http://a/bb/ccc/.', '#s',      'http://a/bb/ccc/.#s');
      itShouldResolve('http://a/bb/ccc/.', 'g#s',     'http://a/bb/ccc/g#s');
      itShouldResolve('http://a/bb/ccc/.', 'g?y#s',   'http://a/bb/ccc/g?y#s');
      itShouldResolve('http://a/bb/ccc/.', ';x',      'http://a/bb/ccc/;x');
      itShouldResolve('http://a/bb/ccc/.', 'g;x',     'http://a/bb/ccc/g;x');
      itShouldResolve('http://a/bb/ccc/.', 'g;x?y#s', 'http://a/bb/ccc/g;x?y#s');
      itShouldResolve('http://a/bb/ccc/.', '',        'http://a/bb/ccc/.');
      itShouldResolve('http://a/bb/ccc/.', '.',       'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/.', './',      'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/.', '..',      'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/.', '../',     'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/.', '../g',    'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/.', '../..',   'http://a/');
      itShouldResolve('http://a/bb/ccc/.', '../../',  'http://a/');
      itShouldResolve('http://a/bb/ccc/.', '../../g', 'http://a/g');
    });

    describe('RFC3986 abnormal examples with trailing /. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/.', '../../../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/.', '../../../../g', 'http://a/g');
      itShouldResolve('http://a/bb/ccc/.', '/./g',          'http://a/g');
      itShouldResolve('http://a/bb/ccc/.', '/../g',         'http://a/g');
      itShouldResolve('http://a/bb/ccc/.', 'g.',            'http://a/bb/ccc/g.');
      itShouldResolve('http://a/bb/ccc/.', '.g',            'http://a/bb/ccc/.g');
      itShouldResolve('http://a/bb/ccc/.', 'g..',           'http://a/bb/ccc/g..');
      itShouldResolve('http://a/bb/ccc/.', '..g',           'http://a/bb/ccc/..g');
      itShouldResolve('http://a/bb/ccc/.', './../g',        'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/.', './g/.',         'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/.', 'g/./h',         'http://a/bb/ccc/g/h');
      itShouldResolve('http://a/bb/ccc/.', 'g/../h',        'http://a/bb/ccc/h');
      itShouldResolve('http://a/bb/ccc/.', 'g;x=1/./y',     'http://a/bb/ccc/g;x=1/y');
      itShouldResolve('http://a/bb/ccc/.', 'g;x=1/../y',    'http://a/bb/ccc/y');
      itShouldResolve('http://a/bb/ccc/.', 'g?y/./x',       'http://a/bb/ccc/g?y/./x');
      itShouldResolve('http://a/bb/ccc/.', 'g?y/../x',      'http://a/bb/ccc/g?y/../x');
      itShouldResolve('http://a/bb/ccc/.', 'g#s/./x',       'http://a/bb/ccc/g#s/./x');
      itShouldResolve('http://a/bb/ccc/.', 'g#s/../x',      'http://a/bb/ccc/g#s/../x');
      itShouldResolve('http://a/bb/ccc/.', 'http:g',        'http:g');
    });

    describe('RFC3986 normal examples with trailing /.. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/..', 'g:h',     'g:h');
      itShouldResolve('http://a/bb/ccc/..', 'g',       'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/..', './g',     'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/..', 'g/',      'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/..', '/g',      'http://a/g');
      itShouldResolve('http://a/bb/ccc/..', '//g',     'http://g');
      itShouldResolve('http://a/bb/ccc/..', '?y',      'http://a/bb/ccc/..?y');
      itShouldResolve('http://a/bb/ccc/..', 'g?y',     'http://a/bb/ccc/g?y');
      itShouldResolve('http://a/bb/ccc/..', '#s',      'http://a/bb/ccc/..#s');
      itShouldResolve('http://a/bb/ccc/..', 'g#s',     'http://a/bb/ccc/g#s');
      itShouldResolve('http://a/bb/ccc/..', 'g?y#s',   'http://a/bb/ccc/g?y#s');
      itShouldResolve('http://a/bb/ccc/..', ';x',      'http://a/bb/ccc/;x');
      itShouldResolve('http://a/bb/ccc/..', 'g;x',     'http://a/bb/ccc/g;x');
      itShouldResolve('http://a/bb/ccc/..', 'g;x?y#s', 'http://a/bb/ccc/g;x?y#s');
      itShouldResolve('http://a/bb/ccc/..', '',        'http://a/bb/ccc/..');
      itShouldResolve('http://a/bb/ccc/..', '.',       'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/..', './',      'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/..', '..',      'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/..', '../',     'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/..', '../g',    'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/..', '../..',   'http://a/');
      itShouldResolve('http://a/bb/ccc/..', '../../',  'http://a/');
      itShouldResolve('http://a/bb/ccc/..', '../../g', 'http://a/g');
    });

    describe('RFC3986 abnormal examples with trailing /.. in the base IRI', function () {
      itShouldResolve('http://a/bb/ccc/..', '../../../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/..', '../../../../g', 'http://a/g');
      itShouldResolve('http://a/bb/ccc/..', '/./g',          'http://a/g');
      itShouldResolve('http://a/bb/ccc/..', '/../g',         'http://a/g');
      itShouldResolve('http://a/bb/ccc/..', 'g.',            'http://a/bb/ccc/g.');
      itShouldResolve('http://a/bb/ccc/..', '.g',            'http://a/bb/ccc/.g');
      itShouldResolve('http://a/bb/ccc/..', 'g..',           'http://a/bb/ccc/g..');
      itShouldResolve('http://a/bb/ccc/..', '..g',           'http://a/bb/ccc/..g');
      itShouldResolve('http://a/bb/ccc/..', './../g',        'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/..', './g/.',         'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/..', 'g/./h',         'http://a/bb/ccc/g/h');
      itShouldResolve('http://a/bb/ccc/..', 'g/../h',        'http://a/bb/ccc/h');
      itShouldResolve('http://a/bb/ccc/..', 'g;x=1/./y',     'http://a/bb/ccc/g;x=1/y');
      itShouldResolve('http://a/bb/ccc/..', 'g;x=1/../y',    'http://a/bb/ccc/y');
      itShouldResolve('http://a/bb/ccc/..', 'g?y/./x',       'http://a/bb/ccc/g?y/./x');
      itShouldResolve('http://a/bb/ccc/..', 'g?y/../x',      'http://a/bb/ccc/g?y/../x');
      itShouldResolve('http://a/bb/ccc/..', 'g#s/./x',       'http://a/bb/ccc/g#s/./x');
      itShouldResolve('http://a/bb/ccc/..', 'g#s/../x',      'http://a/bb/ccc/g#s/../x');
      itShouldResolve('http://a/bb/ccc/..', 'http:g',        'http:g');
    });

    describe('RFC3986 normal examples with file path', function () {
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g:h',     'g:h');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g',       'file:///a/bb/ccc/g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', './g',     'file:///a/bb/ccc/g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g/',      'file:///a/bb/ccc/g/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '/g',      'file:///g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '//g',     'file://g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '?y',      'file:///a/bb/ccc/d;p?y');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g?y',     'file:///a/bb/ccc/g?y');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '#s',      'file:///a/bb/ccc/d;p?q#s');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g#s',     'file:///a/bb/ccc/g#s');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g?y#s',   'file:///a/bb/ccc/g?y#s');
      itShouldResolve('file:///a/bb/ccc/d;p?q', ';x',      'file:///a/bb/ccc/;x');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g;x',     'file:///a/bb/ccc/g;x');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g;x?y#s', 'file:///a/bb/ccc/g;x?y#s');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '',        'file:///a/bb/ccc/d;p?q');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '.',       'file:///a/bb/ccc/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', './',      'file:///a/bb/ccc/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '..',      'file:///a/bb/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '../',     'file:///a/bb/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '../g',    'file:///a/bb/g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '../..',   'file:///a/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '../../',  'file:///a/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '../../g', 'file:///a/g');
    });

    describe('RFC3986 abnormal examples with file path', function () {
      itShouldResolve('file:///a/bb/ccc/d;p?q', '../../../g',    'file:///g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '../../../../g', 'file:///g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '/./g',          'file:///g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '/../g',         'file:///g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g.',            'file:///a/bb/ccc/g.');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '.g',            'file:///a/bb/ccc/.g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g..',           'file:///a/bb/ccc/g..');
      itShouldResolve('file:///a/bb/ccc/d;p?q', '..g',           'file:///a/bb/ccc/..g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', './../g',        'file:///a/bb/g');
      itShouldResolve('file:///a/bb/ccc/d;p?q', './g/.',         'file:///a/bb/ccc/g/');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g/./h',         'file:///a/bb/ccc/g/h');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g/../h',        'file:///a/bb/ccc/h');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g;x=1/./y',     'file:///a/bb/ccc/g;x=1/y');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g;x=1/../y',    'file:///a/bb/ccc/y');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g?y/./x',       'file:///a/bb/ccc/g?y/./x');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g?y/../x',      'file:///a/bb/ccc/g?y/../x');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g#s/./x',       'file:///a/bb/ccc/g#s/./x');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'g#s/../x',      'file:///a/bb/ccc/g#s/../x');
      itShouldResolve('file:///a/bb/ccc/d;p?q', 'http:g',        'http:g');
    });

    describe('additional cases', function () {
      // relative paths ending with '.'
      itShouldResolve('http://abc/',        '.',      'http://abc/');
      itShouldResolve('http://abc/def/ghi', '.',      'http://abc/def/');
      itShouldResolve('http://abc/def/ghi', '.?a=b',  'http://abc/def/?a=b');
      itShouldResolve('http://abc/def/ghi', '.#a=b',  'http://abc/def/#a=b');

      // relative paths ending with '..'
      itShouldResolve('http://abc/',        '..',     'http://abc/');
      itShouldResolve('http://abc/def/ghi', '..',     'http://abc/');
      itShouldResolve('http://abc/def/ghi', '..?a=b', 'http://abc/?a=b');
      itShouldResolve('http://abc/def/ghi', '..#a=b', 'http://abc/#a=b');

      // base path with empty subpaths (double slashes)
      itShouldResolve('http://ab//de//ghi', 'xyz',    'http://ab//de//xyz');
      itShouldResolve('http://ab//de//ghi', './xyz',  'http://ab//de//xyz');
      itShouldResolve('http://ab//de//ghi', '../xyz', 'http://ab//de/xyz');

      // base path with colon (possible confusion with scheme)
      itShouldResolve('http://abc/d:f/ghi', 'xyz',    'http://abc/d:f/xyz');
      itShouldResolve('http://abc/d:f/ghi', './xyz',  'http://abc/d:f/xyz');
      itShouldResolve('http://abc/d:f/ghi', '../xyz', 'http://abc/xyz');

      // base path consisting of '..' and/or '../' sequences
      itShouldResolve('./',        'abc',       '/abc');
      itShouldResolve('../',       'abc',       '/abc');
      itShouldResolve('./././',    '././abc',   '/abc');
      itShouldResolve('../../../', '../../abc', '/abc');
      itShouldResolve('.../././',  '././abc',   '.../abc');

      // base path without authority
      itShouldResolve('a:b:c/',    'def/../',   'a:b:c/');
      itShouldResolve('a:b:c',     '/def',      'a:/def');
      itShouldResolve('a:b/c',     '/def',      'a:/def');
      itShouldResolve('a:',        '/.',        'a:/');
      itShouldResolve('a:',        '/..',       'a:/');

      // base path with slashes in query string
      itShouldResolve('http://abc/def/ghi?q=xx/yyy/z', 'jjj', 'http://abc/def/jjj');
      itShouldResolve('http://abc/def/ghi?q=xx/y?y/z', 'jjj', 'http://abc/def/jjj');
    });
  });
});

function shouldParse(parser, input) {
  var hasParser = parser instanceof N3Parser,
      expected = Array.prototype.slice.call(arguments, hasParser ? 2 : 1),
      items = expected.map(function (item) {
        return { subject: item[0], predicate: item[1], object: item[2], graph: item[3] || '' };
      });
  N3Parser._resetBlankNodeIds();
  // Shift parameters if necessary
  if (!hasParser)
    input = parser, parser = new N3Parser();

  return function (done) {
    var results = [];
    parser.parse(input, function (error, triple) {
      expect(error).not.to.exist;
      if (triple)
        results.push(triple);
      else {
        results.should.have.lengthOf(expected.length);
        for (var i = 0; i < items.length; i++)
          results.should.contain.something.that.deep.equals(items[i]);
        done();
      }
    });
  };
}

function shouldNotParse(parser, input, expectedError) {
  // Shift parameters if necessary
  if (!(parser instanceof N3Parser))
    expectedError = input, input = parser, parser = new N3Parser();

  return function (done) {
    parser.parse(input, function (error, triple) {
      if (error) {
        expect(triple).not.to.exist;
        error.should.be.an.instanceof(Error);
        error.message.should.eql(expectedError);
        done();
      }
      else if (!triple)
        throw new Error('Expected error ' + expectedError);
    });
  };
}

function itShouldResolve(baseIri, relativeIri, expected) {
  var result;
  describe('resolving <' + relativeIri + '> against <' + baseIri + '>', function () {
    before(function (done) {
      try {
        var doc = '<urn:ex:s> <urn:ex:p> <' + relativeIri + '>.';
        new N3Parser({ documentIRI: baseIri }).parse(doc, function (error, triple) {
          if (done)
            result = triple, done(error);
          done = null;
        });
      }
      catch (error) { done(error); }
    });
    it('should result in ' + expected, function () {
      expect(result.object).to.equal(expected);
    });
  });
}
