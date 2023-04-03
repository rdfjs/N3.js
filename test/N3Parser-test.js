import rdfDataModel from '@rdfjs/data-model';
import { Parser, termFromId } from '../src/';
import { NamedNode, BlankNode, Quad } from '../src/N3DataFactory';

const BASE_IRI = 'http://example.org/';

// Reset blank node identifiers between tests
let blankId;
beforeEach(() => {
  blankId = 0; // reset per-node ID
  Parser._resetBlankNodePrefix(); // reset per-parser ID
});
Parser.prototype._blankNode = name => new BlankNode(name || `b${blankId++}`);

describe('Parser', () => {
  describe('The Parser export', () => {
    it('should be a function', () => {
      Parser.should.be.a('function');
    });

    it('should be a Parser constructor', () => {
      new Parser().should.be.an.instanceof(Parser);
    });
  });

  describe('A Parser instance', () => {
    describe('should parse the empty string',
      shouldParse(''
                  /* no triples */));

    describe('should parse a whitespace string',
      shouldParse(' \t \n  '
                  /* no triples */));

    describe('should parse a single triple',
      shouldParse('<a> <b> <c>.',
                  ['a', 'b', 'c']));

    describe('should parse three triples',
      shouldParse('<a> <b> <c>.\n<d> <e> <f>.\n<g> <h> <i>.',
                  ['a', 'b', 'c'],
                  ['d', 'e', 'f'],
                  ['g', 'h', 'i']));

    describe('should parse a triple with a literal',
      shouldParse('<a> <b> "string".',
                  ['a', 'b', '"string"']));

    describe('should parse a triple with a numeric literal',
      shouldParse('<a> <b> 3.0.',
                  ['a', 'b', '"3.0"^^http://www.w3.org/2001/XMLSchema#decimal']));

    describe('should parse a triple with an integer literal',
      shouldParse('<a> <b> 3.',
                  ['a', 'b', '"3"^^http://www.w3.org/2001/XMLSchema#integer']));

    describe('should parse a triple with a floating point literal',
      shouldParse('<a> <b> 1.3e2.',
                  ['a', 'b', '"1.3e2"^^http://www.w3.org/2001/XMLSchema#double']));

    describe('should parse a triple with a boolean literal',
      shouldParse('<a> <b> true.',
                  ['a', 'b', '"true"^^http://www.w3.org/2001/XMLSchema#boolean']));

    describe('should parse a triple with a literal and a language code',
      shouldParse('<a> <b> "string"@en.',
                  ['a', 'b', '"string"@en']));

    describe('should normalize language codes to lowercase',
      shouldParse('<a> <b> "string"@EN.',
                  ['a', 'b', '"string"@en']));

    describe('should parse a triple with a literal and an IRI type',
      shouldParse('<a> <b> "string"^^<type>.',
                  ['a', 'b', '"string"^^http://example.org/type']));

    describe('should parse a triple with a literal and a prefixed name type',
      shouldParse('@prefix x: <urn:x:y#>. <a> <b> "string"^^x:z.',
                  ['a', 'b', '"string"^^urn:x:y#z']));

    describe('should differentiate between IRI and prefixed name types',
      shouldParse('@prefix : <noturn:>. :a :b "x"^^<urn:foo>. :a :b "x"^^:urn:foo.',
                  ['noturn:a', 'noturn:b', '"x"^^urn:foo'],
                  ['noturn:a', 'noturn:b', '"x"^^noturn:urn:foo']));

    it('should not parse literals with datatype as predicate',
      shouldNotParse('<greaterThan> "a"^^<c> "b"^^<c>.', 'Unexpected literal on line 1.'));

    it('should not parse literals without datatype as predicate',
        shouldNotParse('<greaterThan> "a" "b".', 'Unexpected literal on line 1.'));

    it('should not parse a triple with a literal and a prefixed name type with an inexistent prefix',
      shouldNotParse('<a> <b> "string"^^x:z.',
                     'Undefined prefix "x:" on line 1.', {
                       token: {
                         line: 1,
                         type: 'type',
                         value: 'z',
                         prefix: 'x',
                         start: 18,
                         end: 21,
                       },
                       line: 1,
                       previousToken: {
                         line: 1,
                         type: 'literal',
                         value: 'string',
                         prefix: '',
                         start: 8,
                         end: 16,
                       },
                     }));

    describe('should parse a triple with the "a" shorthand predicate',
      shouldParse('<a> a <t>.',
                  ['a', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 't']));

    describe('should parse abbreviations inside blank Nodes within lists',
      shouldParse('@prefix : <http://example.org/#> . :a :b ([ a :mother ]).',
                  ['http://example.org/#a', 'http://example.org/#b', '_:b0'],
                  ...list(['_:b0', '_:b1']),
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/#mother']));

    describe('should parse triples with prefixes',
      shouldParse('@prefix : <#>.\n' +
                  '@prefix a: <a#>.\n' +
                  ':x a:a a:b.',
                  ['#x', 'a#a', 'a#b']));

    describe('should parse triples with the prefix "prefix"',
      shouldParse('@prefix prefix: <http://prefix.cc/>.' +
                  'prefix:a prefix:b prefix:c.',
                  ['http://prefix.cc/a', 'http://prefix.cc/b', 'http://prefix.cc/c']));

    describe('should parse triples with the prefix "base"',
      shouldParse('PREFIX base: <http://prefix.cc/>' +
                  'base:a base:b base:c.',
                  ['http://prefix.cc/a', 'http://prefix.cc/b', 'http://prefix.cc/c']));

    describe('should parse triples with the prefix "graph"',
      shouldParse('PREFIX graph: <http://prefix.cc/>' +
                  'graph:a graph:b graph:c.',
                  ['http://prefix.cc/a', 'http://prefix.cc/b', 'http://prefix.cc/c']));

    it('should not parse @PREFIX',
      shouldNotParse('@PREFIX : <#>.',
                     'Expected entity but got @PREFIX on line 1.', {
                       token: {
                         line: 1,
                         type: '@PREFIX',
                         value: '',
                         prefix: '',
                         start: 0,
                         end: 7,
                       },
                       previousToken: undefined,
                       line: 1,
                     }));

    describe('should parse triples with prefixes and different punctuation',
      shouldParse('@prefix : <#>.\n' +
                  '@prefix a: <a#>.\n' +
                  ':x a:a a:b;a:c a:d,a:e.',
                  ['#x', 'a#a', 'a#b'],
                  ['#x', 'a#c', 'a#d'],
                  ['#x', 'a#c', 'a#e']));

    it('should error on undefined \':\' prefix',
      shouldNotParse(':a :b :c .',
        'Undefined prefix ":" on line 1.'));

    describe('should used explicit definition for : if provided',
      shouldParse('@prefix : <http://myCustomPrefix/> . :a :b :c .',
        ['http://myCustomPrefix/a', 'http://myCustomPrefix/b', 'http://myCustomPrefix/c']));

    it('should not parse undefined empty prefix in subject',
      shouldNotParse(':a ',
                     'Undefined prefix ":" on line 1.'));

    it('should not parse undefined prefix in subject',
      shouldNotParse('a:a ',
                     'Undefined prefix "a:" on line 1.'));

    it('should not parse undefined prefix in predicate',
      shouldNotParse('<a> b:c ',
                     'Undefined prefix "b:" on line 1.'));

    it('should not parse undefined prefix in object',
      shouldNotParse('<a> <b> c:d ',
                     'Undefined prefix "c:" on line 1.'));

    it('should not parse undefined prefix in datatype',
      shouldNotParse('<a> <b> "c"^^d:e ',
                     'Undefined prefix "d:" on line 1.'));

    describe('should parse triples with SPARQL prefixes',
      shouldParse('PREFIX : <#>\n' +
                  'PrEfIX a: <a#> ' +
                  ':x a:a a:b.',
                  ['#x', 'a#a', 'a#b']));

    it('should not parse prefix declarations without prefix',
      shouldNotParse('@prefix <a> ',
                     'Expected prefix to follow @prefix on line 1.'));

    it('should not parse prefix declarations without IRI',
      shouldNotParse('@prefix : .',
                     'Expected IRI to follow prefix ":" on line 1.'));

    it('should not parse prefix declarations without a dot',
      shouldNotParse('@prefix : <a> ;',
                     'Expected declaration to end with a dot on line 1.'));

    describe('should parse statements with shared subjects',
      shouldParse('<a> <b> <c>;\n<d> <e>.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']));

    describe('should parse statements with shared subjects and trailing semicolon',
      shouldParse('<a> <b> <c>;\n<d> <e>;\n.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']));

    describe('should parse statements with shared subjects and multiple semicolons',
      shouldParse('<a> <b> <c>;;\n<d> <e>.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']));

    describe('should parse statements with shared subjects and predicates',
      shouldParse('<a> <b> <c>, <d>.',
                  ['a', 'b', 'c'],
                  ['a', 'b', 'd']));

    it('should not accept ; without preceding predicate',
      shouldNotParse('<a> <b> <c>. <x>; <y> <z>.',
                     'Expected predicate but got ; on line 1.'));

    it('should not accept , without preceding object',
      shouldNotParse('<a> <b> <c>. <x> <y>, <z>.',
                     'Expected entity but got , on line 1.'));

    describe('should parse diamonds',
      shouldParse('<> <> <> <>.\n(<>) <> (<>) <>.',
                  [BASE_IRI, BASE_IRI, BASE_IRI, BASE_IRI],
                  ['_:b0', BASE_IRI, '_:b1', BASE_IRI],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', BASE_IRI],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', BASE_IRI],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with named blank nodes',
      shouldParse('_:a <b> _:c.',
                  ['_:b0_a', 'b', '_:b0_c']));

    it('should not parse statements with a blank node as predicate',
      shouldNotParse('PREFIX : <#>\n<a> [] <c>.',
                     'Disallowed blank node as predicate on line 2.', {
                       token: {
                         line: 2,
                         type: '[',
                         value: '',
                         prefix: '',
                         start: 4,
                         end: 5,
                       },
                       line: 2,
                       previousToken: {
                         line: 2,
                         type: 'IRI',
                         value: 'a',
                         prefix: '',
                         start: 0,
                         end: 4,
                       },
                     }));

    it('should not parse statements with a blank node label as predicate',
      shouldNotParse('PREFIX : <#>\n<a> _:b <c>.',
                     'Disallowed blank node as predicate on line 2.', {
                       token: {
                         line: 2,
                         type: 'blank',
                         value: 'b',
                         prefix: '_',
                         start: 4,
                         end: 8,
                       },
                       line: 2,
                       previousToken: {
                         line: 2,
                         type: 'IRI',
                         value: 'a',
                         prefix: '',
                         start: 0,
                         end: 4,
                       },
                     }));

    describe('should parse statements with empty blank nodes',
      shouldParse('[] <b> [].',
                  ['_:b0', 'b', '_:b1']));

    describe('should parse statements with unnamed blank nodes in the subject',
      shouldParse('[<a> <b>] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', 'b']));

    describe('should parse statements with unnamed blank nodes in the object',
      shouldParse('<a> <b> [<c> <d>].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', 'd']));

    describe('should parse statements with unnamed blank nodes with a string object',
      shouldParse('<a> <b> [<c> "x"].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '"x"']));

    it('should not parse a blank node with missing subject',
      shouldNotParse('<a> <b> [<c>].',
                     'Expected entity but got ] on line 1.'));

    it('should not parse a blank node with only a semicolon',
      shouldNotParse('<a> <b> [;].',
                     'Expected predicate but got ; on line 1.'));

    it('should not parse a dangling blank node closing brace',
      shouldNotParse('<a:a> <b:b> <c:c> ; ]',
                     'Unexpected ] on line 1.'));

    describe('should parse a blank node with a trailing semicolon',
      shouldParse('<a> <b> [ <u> <v>; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v']));

    describe('should parse a blank node with multiple trailing semicolons',
      shouldParse('<a> <b> [ <u> <v>;;; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v']));

    describe('should parse a multi-predicate blank node',
      shouldParse('<a> <b> [ <u> <v>; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']));

    describe('should parse a multi-predicate blank node with multiple semicolons',
      shouldParse('<a> <b> [ <u> <v>;;; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']));

    describe('should parse a multi-object blank node',
      shouldParse('<a> <b> [ <u> <v>, <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'u', 'z']));

    describe('should parse a multi-statement blank node ending with a literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z" ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"']));

    describe('should parse a multi-statement blank node ending with a typed literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^http://example.org/t']));

    describe('should parse a multi-statement blank node ending with a string with language',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^http://example.org/t']));

    describe('should parse a multi-statement blank node with trailing semicolon',
      shouldParse('<a> <b> [ <u> <v>; <w> <z>; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']));

    describe('should parse statements with nested blank nodes in the subject',
      shouldParse('[<a> [<x> <y>]] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'x', 'y']));

    describe('should parse statements with nested blank nodes in the object',
      shouldParse('<a> <b> [<c> [<d> <e>]].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '_:b1'],
                  ['_:b1', 'd', 'e']));

    describe('should reuse identifiers of blank nodes within and outside of graphs',
      shouldParse('_:a <b> _:c. <g> { _:a <b> _:c }',
                  ['_:b0_a', 'b', '_:b0_c'],
                  ['_:b0_a', 'b', '_:b0_c', 'g']));

    it('should not parse an invalid blank node',
      shouldNotParse('[ <a> <b> .',
                     'Expected punctuation to follow "http://example.org/b" on line 1.'));

    describe('should parse a statements with only an anonymous node',
      shouldParse('[<p> <o>].',
                  ['_:b0', 'p', 'o']));

    it('should not parse a statement with only a blank anonymous node',
      shouldNotParse('[].',
                     'Unexpected . on line 1.'));

    it('should not parse an anonymous node with only an anonymous node inside',
      shouldNotParse('[[<p> <o>]].',
                     'Disallowed blank node as predicate on line 1.'));

    describe('should parse statements with an empty list in the subject',
      shouldParse('() <a> <b>.',
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'a', 'b']));

    describe('should parse statements with an empty list in the object',
      shouldParse('<a> <b> ().',
                  ['a', 'b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a single-element list in the subject',
      shouldParse('(<x>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a single-element list in the object',
      shouldParse('<a> <b> (<x>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse a list with a literal',
      shouldParse('<a> <b> ("x").',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse a list with a typed literal',
      shouldParse('<a> <b> ("x"^^<y>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"^^http://example.org/y'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse a list with a language-tagged literal',
      shouldParse('<a> <b> ("x"@en-GB).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"@en-gb'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a multi-element list in the subject',
      shouldParse('(<x> <y>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a multi-element list in the object',
      shouldParse('<a> <b> (<x> <y>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a multi-element literal list in the object',
      shouldParse('<a> <b> ("x" "y"@en-GB 1 "z"^^<t>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"y"@en-gb'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"1"^^http://www.w3.org/2001/XMLSchema#integer'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"z"^^http://example.org/t'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with prefixed names in lists',
      shouldParse('@prefix a: <a#>. <a> <b> (a:x a:y).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a#x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a#y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should not parse statements with undefined prefixes in lists',
      shouldNotParse('<a> <b> (a:x a:y).',
                     'Undefined prefix "a:" on line 1.'));

    describe('should parse statements with blank nodes in lists',
      shouldParse('<a> <b> (_:x _:y).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b0_x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b0_y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse a nested list',
      shouldParse('<a> <b> ( ( <c> ) ).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'c'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a nested empty list',
      shouldParse('<a> <b> (<x> ()).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with non-empty nested lists',
      shouldParse('<a> <b> (<x> (<y>)).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a quoted triple',
      shouldParse('<a> <b> ( << <c> <d> <e> >> ) .',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a quoted triple and iri after',
      shouldParse('<a> <b> ( << <c> <d> <e> >> <f> ) .',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'f'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a quoted triple and iri before',
      shouldParse('<a> <b> ( <f> << <c> <d> <e> >> ) .',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'f'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a 2 quoted triples',
      shouldParse('<a> <b> ( << <c> <d> <e> >> << <c1> <d1> <e1> >> ) .',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c1', 'd1', 'e1']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));


    describe('should parse statements with a list containing a 3 quoted triples',
      shouldParse('<a> <b> ( << <c> <d> <e> >> << <c1> <d1> <e1> >> << <c2> <d2> <e2> >> ) .',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c1', 'd1', 'e1']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c2', 'd2', 'e2']],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a 1 quoted triple and 2 iris',
      shouldParse('<a> <b> ( << <c> <d> <e> >> <h> <i> ) .',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'h'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'i'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a 1 quoted triple between 2 iris',
      shouldParse('<a> <b> ( <h> << <c> <d> <e> >> <i> ) .',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'h'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'i'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));


    describe('should parse a nested list containing 1 quoted triple',
      shouldParse('<a> <b> ( ( << <c> <d> <e> >> ) ).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a quoted triple with list as subject',
      shouldParse('( << <c> <d> <e> >> ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a quoted triple and iri after with list as subject',
      shouldParse('( << <c> <d> <e> >> <f> ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'f'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a quoted triple and iri before with list as subject',
      shouldParse('( <f> << <c> <d> <e> >> ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'f'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a 2 quoted triples with list as subject',
      shouldParse('( << <c> <d> <e> >> << <c1> <d1> <e1> >> ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c1', 'd1', 'e1']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));


    describe('should parse statements with a list containing a 3 quoted triples with list as subject',
      shouldParse('( << <c> <d> <e> >> << <c1> <d1> <e1> >> << <c2> <d2> <e2> >> ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c1', 'd1', 'e1']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c2', 'd2', 'e2']],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a 1 quoted triple and 2 iris with list as subject',
      shouldParse('( << <c> <d> <e> >> <h> <i> ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'h'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'i'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a 1 quoted triple between 2 iris with list as subject',
      shouldParse('( <h> << <c> <d> <e> >> <i> ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'h'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'i'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse a nested list containing 1 quoted triple with list as subject',
      shouldParse('( ( << <c> <d> <e> >> ) ) <a> <b> .',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', ['c', 'd', 'e']],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing a blank node with list as subject',
      shouldParse('([]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    describe('should parse statements with a list containing multiple blank nodes with list as subject',
      shouldParse('([] [<x> <y>]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b3', 'x', 'y']));

    describe('should parse statements with a blank node containing a list with list as subject',
      shouldParse('[<a> (<b>)] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it('should not parse an invalid list',
      shouldNotParse('<a> <b> (]).',
                     'Expected entity but got ] on line 1.'));

    describe('should resolve IRIs against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> <c>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    it('should not resolve IRIs against @BASE',
      shouldNotParse('@BASE <http://ex.org/>.',
                     'Expected entity but got @BASE on line 1.'));

    describe('should resolve IRIs against SPARQL base',
      shouldParse('BASE <http://ex.org/>\n' +
                  '<a> <b> <c>. ' +
                  'BASE <d/> ' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    describe('should resolve IRIs against a @base with query string',
      shouldParse('@base <http://ex.org/?foo>.\n' +
                  '<> <b> <c>.\n' +
                  '@base <d/?bar>.\n' +
                  '<> <f> <g>.',
                  ['http://ex.org/?foo', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/?bar', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    describe('should resolve IRIs with query string against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<?> <?a> <?a=b>.\n' +
                  '@base <d>.\n' +
                  '<?> <?a> <?a=b>.' +
                  '@base <?e>.\n' +
                  '<> <?a> <?a=b>.',
                  ['http://ex.org/?', 'http://ex.org/?a', 'http://ex.org/?a=b'],
                  ['http://ex.org/d?', 'http://ex.org/d?a', 'http://ex.org/d?a=b'],
                  ['http://ex.org/d?e', 'http://ex.org/d?a', 'http://ex.org/d?a=b']));

    describe('should not resolve IRIs with colons',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a>   <b>   <c>.\n' +
                  '<A:>  <b:>  <c:>.\n' +
                  '<a:a> <b:B> <C-D:c>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['A:',  'b:',  'c:'],
                  ['a:a', 'b:B', 'C-D:c']));

    it('should not allow relative URIs with a colon in the first path segment',
      shouldNotParse('<entity.beeldbank_leiden_person:A.E._Stuur.> <x:x> <x:x> .',
                     'Invalid IRI on line 1.'));

    it('should not allow relative URIs with a colon in the first path segment as base',
      shouldNotParse('@base <entity.beeldbank_leiden_person:A.E._Stuur.> .',
                     'Expected valid IRI to follow base declaration on line 1.'));

    describe('should resolve datatype IRIs against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> "c"^^<d>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> "g"^^<h>.',
                  ['http://ex.org/a', 'http://ex.org/b', '"c"^^http://ex.org/d'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', '"g"^^http://ex.org/d/h']));

    describe('should resolve IRIs against a base with a fragment',
      shouldParse('@base <http://ex.org/foo#bar>.\n' +
                  '<a> <b> <#c>.\n',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/foo#c']));

    describe('should resolve IRIs with an empty fragment',
      shouldParse('@base <http://ex.org/foo>.\n' +
                  '<#> <b#> <#c>.\n',
                  ['http://ex.org/foo#', 'http://ex.org/b#', 'http://ex.org/foo#c']));

    describe('should not resolve prefixed names',
      shouldParse('PREFIX ex: <http://ex.org/a/bb/ccc/../>\n' +
                  'ex:a ex:b ex:c .',
                  ['http://ex.org/a/bb/ccc/../a', 'http://ex.org/a/bb/ccc/../b', 'http://ex.org/a/bb/ccc/../c']));

    describe('should parse an empty default graph',
      shouldParse('{}'));

    describe('should parse a one-triple default graph ending without a dot',
      shouldParse('{<a> <b> <c>}',
                  ['a', 'b', 'c']));

    describe('should parse a one-triple default graph ending with a dot',
      shouldParse('{<a> <b> <c>.}',
                  ['a', 'b', 'c']));

    describe('should parse a three-triple default graph ending without a dot',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']));

    describe('should parse a three-triple default graph ending with a dot',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']));

    describe('should parse a three-triple default graph ending with a semicolon',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>;}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']));

    describe('should parse a default graph with a blank node ending with a dot',
      shouldParse('{ [<p> <o>]. }',
                  ['_:b0', 'p', 'o']));

    describe('should parse a default graph with a blank node ending without a dot',
      shouldParse('{ [<p> <o>] }',
                  ['_:b0', 'p', 'o']));

    describe('should parse an empty named graph with an IRI',
      shouldParse('<g>{}'));

    describe('should parse a one-triple named graph with an IRI ending without a dot',
      shouldParse('<g> {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g']));

    describe('should parse a one-triple named graph with an IRI ending with a dot',
      shouldParse('<g>{<a> <b> <c>.}',
                  ['a', 'b', 'c', 'g']));

    describe('should parse a three-triple named graph with an IRI ending without a dot',
      shouldParse('<g> {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', 'g'],
                  ['a', 'd', 'e', 'g'],
                  ['a', 'd', 'f', 'g']));

    describe('should parse a three-triple named graph with an IRI ending with a dot',
      shouldParse('<g>{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', 'g'],
                  ['a', 'd', 'e', 'g'],
                  ['a', 'd', 'f', 'g']));

    describe('should parse an empty named graph with a prefixed name',
      shouldParse('@prefix g: <g#>.\ng:h {}'));

    describe('should parse a one-triple named graph with a prefixed name ending without a dot',
      shouldParse('@prefix g: <g#>.\ng:h {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g#h']));

    describe('should parse a one-triple named graph with a prefixed name ending with a dot',
      shouldParse('@prefix g: <g#>.\ng:h{<a> <b> <c>.}',
                  ['a', 'b', 'c', 'g#h']));

    describe('should parse a three-triple named graph with a prefixed name ending without a dot',
      shouldParse('@prefix g: <g#>.\ng:h {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', 'g#h'],
                  ['a', 'd', 'e', 'g#h'],
                  ['a', 'd', 'f', 'g#h']));

    describe('should parse a three-triple named graph with a prefixed name ending with a dot',
      shouldParse('@prefix g: <g#>.\ng:h{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', 'g#h'],
                  ['a', 'd', 'e', 'g#h'],
                  ['a', 'd', 'f', 'g#h']));

    describe('should parse a named graph with a blank node ending with a dot',
      shouldParse('<g> { [<p> <o>]. }',
                  ['_:b0', 'p', 'o', 'g']));

    describe('should parse a named graph with a blank node ending without a dot',
      shouldParse('<g> { [<p> <o>] }',
                  ['_:b0', 'p', 'o', 'g']));

    describe('should parse an empty anonymous graph',
      shouldParse('[] {}'));

    describe('should parse a one-triple anonymous graph ending without a dot',
      shouldParse('[] {<a> <b> <c>}',
                  ['a', 'b', 'c', '_:b0']));

    describe('should parse a one-triple anonymous graph ending with a dot',
      shouldParse('[]{<a> <b> <c>.}',
                  ['a', 'b', 'c', '_:b0']));

    describe('should parse a three-triple anonymous graph ending without a dot',
      shouldParse('[] {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', '_:b0'],
                  ['a', 'd', 'e', '_:b0'],
                  ['a', 'd', 'f', '_:b0']));

    describe('should parse a three-triple anonymous graph ending with a dot',
      shouldParse('[]{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', '_:b0'],
                  ['a', 'd', 'e', '_:b0'],
                  ['a', 'd', 'f', '_:b0']));

    describe('should parse an empty named graph with an IRI and the GRAPH keyword',
      shouldParse('GRAPH <g> {}'));

    describe('should parse an empty named graph with a prefixed name and the GRAPH keyword',
      shouldParse('@prefix g: <g#>.\nGRAPH g:h {}'));

    describe('should parse an empty anonymous graph and the GRAPH keyword',
      shouldParse('GRAPH [] {}'));

    describe('should parse a one-triple named graph with an IRI and the GRAPH keyword',
      shouldParse('GRAPH <g> {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g']));

    describe('should parse a one-triple named graph with a prefixed name and the GRAPH keyword',
      shouldParse('@prefix g: <g#>.\nGRAPH g:h {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g#h']));

    describe('should parse a one-triple anonymous graph and the GRAPH keyword',
      shouldParse('GRAPH [] {<a> <b> <c>}',
                  ['a', 'b', 'c', '_:b0']));

    describe('should parse a graph with 8-bit unicode escape sequences',
      shouldParse('<\\U0001d400> {\n<\\U0001d400> <\\U0001d400> "\\U0001d400"^^<\\U0001d400>\n}\n',
                  ['\ud835\udC00', '\ud835\udc00', '"\ud835\udc00"^^http://example.org/\ud835\udc00', '\ud835\udc00']));

    it('should not parse a single closing brace',
      shouldNotParse('}',
                     'Unexpected graph closing on line 1.'));

    it('should not parse a single opening brace',
      shouldNotParse('{',
                     'Unexpected "{" on line 1.'));

    it('should not parse a superfluous closing brace ',
      shouldNotParse('{}}',
                     'Unexpected graph closing on line 1.'));

    it('should not parse a graph with only a dot',
      shouldNotParse('{.}',
                     'Expected entity but got . on line 1.'));

    it('should not parse a graph with only a semicolon',
      shouldNotParse('{;}',
                     'Expected entity but got ; on line 1.'));

    it('should not parse an unclosed graph',
      shouldNotParse('{<a> <b> <c>.',
                     'Unclosed graph on line 1.'));

    it('should not parse a named graph with a list node as label',
      shouldNotParse('() {}',
                     'Expected entity but got { on line 1.'));

    it('should not parse a named graph with a non-empty blank node as label',
      shouldNotParse('[<a> <b>] {}',
                     'Expected entity but got { on line 1.'));

    it('should not parse a named graph with the GRAPH keyword and a non-empty blank node as label',
      shouldNotParse('GRAPH [<a> <b>] {}',
                     'Invalid graph label on line 1.'));

    it('should not parse a triple after the GRAPH keyword',
      shouldNotParse('GRAPH <a> <b> <c>.',
                     'Expected graph but got IRI on line 1.'));

    it('should not parse repeated GRAPH keywords',
      shouldNotParse('GRAPH GRAPH <g> {}',
                     'Invalid graph label on line 1.'));

    describe('should parse a quad with 4 IRIs',
      shouldParse('<a> <b> <c> <g>.',
                  ['a', 'b', 'c', 'g']));

    it('should not parse a quad in a quoted triple',
      shouldNotParse('<< <a> <b> <c> <g> >> <c> <d> .',
                     'Expected >> to follow "http://example.org/c" but got IRI on line 1.'));

    describe('should parse a quad with 4 prefixed names',
      shouldParse('@prefix p: <p#>.\np:a p:b p:c p:g.',
                  ['p#a', 'p#b', 'p#c', 'p#g']));

    it('should not parse a quad with an undefined prefix',
      shouldNotParse('<a> <b> <c> p:g.',
                     'Undefined prefix "p:" on line 1.'));

    describe('should parse a quad with 3 IRIs and a literal',
      shouldParse('<a> <b> "c"^^<d> <g>.',
                  ['a', 'b', '"c"^^http://example.org/d', 'g']));

    describe('should parse a quad with 2 blank nodes and a literal',
      shouldParse('_:a <b> "c"^^<d> _:g.',
                  ['_:b0_a', 'b', '"c"^^http://example.org/d', '_:b0_g']));

    it('should not parse a quad in a graph',
      shouldNotParse('{<a> <b> <c> <g>.}',
                     'Expected punctuation to follow "http://example.org/c" on line 1.'));

    it('should not parse a quad with different punctuation',
      shouldNotParse('<a> <b> <c> <g>;',
                     'Expected dot to follow quad on line 1.'));

    it('should not parse base declarations without IRI',
      shouldNotParse('@base a: ',
                     'Expected valid IRI to follow base declaration on line 1.'));

    it('should not parse improperly nested parentheses and brackets',
      shouldNotParse('<a> <b> [<c> (<d>]).',
                     'Expected entity but got ] on line 1.'));

    it('should not parse improperly nested square brackets',
      shouldNotParse('<a> <b> [<c> <d>]].',
                     'Expected entity but got ] on line 1.'));

    it('should error when an object is not there',
      shouldNotParse('<a> <b>.',
                     'Expected entity but got . on line 1.'));

    it('should error when a dot is not there',
      shouldNotParse('<a> <b> <c>',
                     'Expected entity but got eof on line 1.'));

    it('should error with an abbreviation in the subject',
      shouldNotParse('a <a> <a>.',
                     'Expected entity but got abbreviation on line 1.'));

    it('should error with an abbreviation in the object',
      shouldNotParse('<a> <a> a .',
                     'Expected entity but got abbreviation on line 1.'));

    it('should error if punctuation follows a subject',
      shouldNotParse('<a> .',
                     'Unexpected . on line 1.'));

    it('should error if an unexpected token follows a subject',
      shouldNotParse('<a> @',
                     'Unexpected "@" on line 1.'), {
                       token: {
                         line: 1,
                         type: '@PREFIX',
                         value: '',
                         prefix: '',
                       },
                       previousToken: undefined,
                       line: 1,
                     });

    it('should not error if there is no triple callback', () => {
      new Parser().parse('');
    });

    it('should return prefixes through a callback', done => {
      const prefixes = {};
      new Parser().parse('@prefix a: <http://a.org/#>. a:a a:b a:c. @prefix b: <http://b.org/#>.',
                           tripleCallback, prefixCallback);

      function tripleCallback(error, triple) {
        expect(error).not.to.exist;
        if (!triple) {
          Object.keys(prefixes).should.have.length(2);
          expect(prefixes).to.have.property('a');
          expect(prefixes.a).to.deep.equal(new NamedNode('http://a.org/#'));
          expect(prefixes).to.have.property('b');
          expect(prefixes.b).to.deep.equal(new NamedNode('http://b.org/#'));
          done();
        }
      }

      function prefixCallback(prefix, iri) {
        expect(prefix).to.exist;
        expect(iri).to.exist;
        prefixes[prefix] = iri;
      }
    });

    it('should return prefixes through a callback without triple callback', done => {
      const prefixes = {};
      new Parser().parse('@prefix a: <IRIa>. a:a a:b a:c. @prefix b: <IRIb>.',
                           null, prefixCallback);

      function prefixCallback(prefix, iri) {
        expect(prefix).to.exist;
        expect(iri).to.exist;
        prefixes[prefix] = iri;
        if (Object.keys(prefixes).length === 2)
          done();
      }
    });

    it('should return prefixes at the last triple callback', done => {
      new Parser({ baseIRI: BASE_IRI })
        .parse('@prefix a: <IRIa>. a:a a:b a:c. @prefix b: <IRIb>.', tripleCallback);

      function tripleCallback(error, triple, prefixes) {
        expect(error).not.to.exist;
        if (triple)
          expect(prefixes).not.to.exist;
        else {
          expect(prefixes).to.exist;
          Object.keys(prefixes).should.have.length(2);
          expect(prefixes).to.have.property('a', 'http://example.org/IRIa');
          expect(prefixes).to.have.property('b', 'http://example.org/IRIb');
          done();
        }
      }
    });

    describe('should parse a string synchronously if no callback is given', () => {
      const triples = new Parser().parse('@prefix a: <urn:a:>. a:a a:b a:c.');
      triples.should.deep.equal([
        new Quad(termFromId('urn:a:a'), termFromId('urn:a:b'),
                 termFromId('urn:a:c'), termFromId('')),
      ]);
    });

    it('should throw on syntax errors if no callback is given', () => {
      (function () { new Parser().parse('<a> bar <c>'); })
      .should.throw('Unexpected "bar" on line 1.').with.property('context').with.property('line', 1);
    });

    it('should throw on grammar errors if no callback is given', () => {
      (function () { new Parser().parse('<a> <b> <c>'); })
      .should.throw('Expected entity but got eof on line 1');
    });

    describe('should parse an RDF-star triple with a triple with iris as subject correctly', () => {
      shouldParse('<<<a> <b> <c>>> <b> <c>.',
        [['a', 'b', 'c'], 'b', 'c']);
    });

    it('should not parse an RDF-star triple with a triple as predicate',
      shouldNotParse('<a> <<<b> <c> <d>>> <e>',
        'Expected entity but got << on line 1.'));

    describe('should parse an RDF-star triple with a triple with blanknodes as subject correctly',
      shouldParse('<<_:a <b> _:c>> <b> <c>.',
        [['_:b0_a', 'b', '_:b0_c'], 'b', 'c']));

    describe('should parse an RDF-star triple with a triple with blanknodes and literals as subject correctly',
      shouldParse('<<_:a <b> "c"^^<d>>> <b> <c>.',
        [['_:b0_a', 'b', '"c"^^http://example.org/d'], 'b', 'c']));

    describe('should parse an RDF-star triple with a triple as object correctly',
      shouldParse('<a> <b> <<<a> <b> <c>>>.',
        ['a', 'b', ['a', 'b', 'c']]));

    describe('should parse an RDF-star triple with a triple as object correctly',
      shouldParse('<a> <b> <<_:a <b> _:c>>.',
        ['a', 'b', ['_:b0_a', 'b', '_:b0_c']]));

    describe('should parse an RDF-star triple with a triple as object correctly',
      shouldParse('<a> <b> <<_:a <b> "c"^^<d>>>.',
        ['a', 'b', ['_:b0_a', 'b', '"c"^^http://example.org/d']]));

    describe('should parse nested triples correctly',
      shouldParse('<<<<<a> <b> <c>>> <f> <g>>> <d> <e>.',
        [[['a', 'b', 'c'], 'f', 'g'], 'd', 'e']));
    describe('should parse nested triples correctly',
      shouldParse('<d> <e> <<<f> <g> <<<a> <b> <c>>>>>.',
        ['d', 'e', ['f', 'g', ['a', 'b', 'c']]]));
    describe('should parse nested triples correctly',
      shouldParse('<<<f> <g> <<<a> <b> <c>>>>> <d> <e>.',
        [['f', 'g', ['a', 'b', 'c']], 'd', 'e']));
    describe('should parse nested triples correctly',
      shouldParse('<d> <e> <<<<<a> <b> <c>>> <f> <g>>>.',
        ['d', 'e', [['a', 'b', 'c'], 'f', 'g']]));

    it('should not parse compound blank node inside quoted triple subject',
      shouldNotParse('<< [ <x> <y> ] <a> <b> >> <c> <d>.',
        'Compound blank node expressions not permitted within quoted triple on line 1.'
    ));

    it('should not parse compound blank node inside quoted triple predicate',
      shouldNotParse('<< <a> [ <x> <y> ] <b> >> <c> <d>.',
        'Disallowed blank node as predicate on line 1.'
    ));

    it('should not parse compound blank node inside quoted triple object',
      shouldNotParse('<< <a> <b> [ <x> <y> ] >> <c> <d>.',
        'Compound blank node expressions not permitted within quoted triple on line 1.'
    ));

    it('should not parse empty list inside quoted triple subject',
      shouldNotParse('<< () <a> <b> >> <c> <d>.',
        'Unexpected list inside quoted triple on line 1.'
      ));

    it('should not parse non-empty list inside quoted triple subject',
      shouldNotParse('<< ( <f> ) <a> <b> >> <c> <d>.',
        'Unexpected list inside quoted triple on line 1.'
      ));

    it('should not parse empty list inside quoted triple predicate',
      shouldNotParse('<< <a> () <b> >> <c> <d>.',
        'Expected entity but got ( on line 1.'
      ));

    it('should not parse non-empty list inside quoted triple predicate',
      shouldNotParse('<< <a> ( <f> ) <b> >> <c> <d>.',
        'Expected entity but got ( on line 1.'
    ));

    it('should not parse empty list inside quoted triple object',
      shouldNotParse('<< <a> <b> () >> <c> <d>.',
        'Unexpected list inside quoted triple on line 1.'
    ));

    it('should not parse non-empty list inside quoted triple object',
      shouldNotParse('<< <a> <b> ( <f> ) >> <c> <d>.',
        'Unexpected list inside quoted triple on line 1.'
    ));

    it('should not parse nested RDF-star statements that are partially closed',
      shouldNotParse('<d> <e> <<<<<a> <b> <c>>> <f> <g>.',
        'Expected >> to follow "http://example.org/g" but got . on line 1.'
      ));

    it('should not parse partially closed nested RDF-star statements',
      shouldNotParse('<d> <e> <<<<<a> <b> <c> <f> <g>>>.',
        'Expected >> to follow "http://example.org/c" but got IRI on line 1.'
      ));

    it('should not parse nested RDF-star statements with too many closing tags',
      shouldNotParse('<d> <e> <<<<<a> <b> <c>>>>> <f> <g>>>.',
        'Expected entity but got >> on line 1.'
      ));

    it('should not parse nested RDF-star statements with too many closing tags',
      shouldNotParse('<d> <e> <<<<<a> <b> <c>>> <f> <g>>>>>.',
        'Expected entity but got >> on line 1.'
      ));

    it('should not parse RDF-star statements with too many closing tags',
      shouldNotParse('<a> <b> <c>>>.',
        'Expected entity but got >> on line 1.'
      ));

    it('should not parse incomplete RDF-star statements',
      shouldNotParse('<d> <e> <<<a> <b>>>.',
        'Expected entity but got >> on line 1.'
      ));

    it('should not parse incomplete RDF-star statements',
      shouldNotParse('<<<a> <b>>> <d> <e>.',
        'Expected entity but got >> on line 1.'
      ));

    it('should not parse incorrectly nested RDF-star statements',
      shouldNotParse('>> <<',
        'Expected entity but got >> on line 1.'
      ));

    it('should not parse a nested triple on its own',
      shouldNotParse('<<<a> <b> <c>>>.',
        'Unexpected . on line 1.'
      ));

    it('should not parse a malformed RDF-star quad',
      shouldNotParse('<<<a> <b> <c> <d> <e>>> <a> <b> .',
        'Expected >> to follow "http://example.org/c" but got IRI on line 1.'));

    describe('should parse statements with a shared RDF-star subject',
      shouldParse('<<<a> <b> <c>>> <b> <c>;\n<d> <c>.',
        [['a', 'b', 'c'], 'b', 'c'],
        [['a', 'b', 'c'], 'd', 'c']));

    // it('should parse no chunks (i.e. onEnd called immediately)',
    //     shouldParseChunks([]));

    it('should parse statements with a shared RDF-star subject that is chunked at double quotes',
        shouldParseChunks(['<', '<<a> <b> <c>>> <b> <c>;\n<d> <c>.'],
        [['a', 'b', 'c'], 'b', 'c'],
        [['a', 'b', 'c'], 'd', 'c']));

    it('should parse statements with a shared RDF-star subject that is chunked at every character',
        shouldParseChunks('<<<a> <b> <c>>> <b> <c>;\n<d> <c>.'.split(''),
        [['a', 'b', 'c'], 'b', 'c'],
        [['a', 'b', 'c'], 'd', 'c']));

    describe('should parse statements with a shared RDF-star subject',
      shouldParse('<<<a> <b> <c>>> <b> <c>;\n<d> <<<a> <b> <c>>>.',
        [['a', 'b', 'c'], 'b', 'c'],
        [['a', 'b', 'c'], 'd', ['a', 'b', 'c']]));

    describe('should put nested triples in the default graph',
      shouldParse('<a> <b> <c> <g>.\n<<<a> <b> <c>>> <d> <e>.',
          ['a', 'b', 'c', 'g'],
          [['a', 'b', 'c'], 'd', 'e']));

    describe('should parse an explicit triple with reified annotation',
      shouldParse('<a> <b> <c> {| <d> <e> |} .',
          ['a', 'b', 'c'],
          [['a', 'b', 'c'], 'd', 'e']));

    it('should not parse }|',
        shouldNotParse('<a> <b> <c> }| <d> <e> |} .', 'Unexpected graph closing on line 1.'));

    it('should not parse |{',
        shouldNotParse('<a> <b> <c> {| <d> <e> |{ .', 'Unexpected "|{" on line 1.'));

    it('should parse an explicit triple with reified annotation that is chunked at the pipe',
      shouldParseChunks(['<a> <b> <c> {| <d> <e> |', '} .'],
          ['a', 'b', 'c'],
          [['a', 'b', 'c'], 'd', 'e']));

    it('should parse an explicit triple with reified annotation that is chunked at the pipe and each character after',
      shouldParseChunks(['<a> <b> <c> {| <d> <e> |', '}', ' ', '.', ''],
          ['a', 'b', 'c'],
          [['a', 'b', 'c'], 'd', 'e']));

    it('should parse an explicit triple with reified annotation that is chunked at each annotation',
      shouldParseChunks(['<a> <b> <c> {', '| <d> <e> |', '} .'],
          ['a', 'b', 'c'],
          [['a', 'b', 'c'], 'd', 'e']));

    it('should parse an quoted triple that is chunked on first quote',
      shouldParseChunks(['<', '<<a> <b> <c>>> <d> <e> .'],
          [['a', 'b', 'c'], 'd', 'e']));

    it('should parse an quoted triple that is chunked on ending quote',
      shouldParseChunks(['<<<a> <b> <c>>', '> <d> <e> .'],
          [['a', 'b', 'c'], 'd', 'e']));

    it('should parse an explicit triple with reified annotation that is chunked before annotation',
      shouldParseChunks(['<a> <b> <c> ', '{| <d> <e> |} .'],
          ['a', 'b', 'c'],
          [['a', 'b', 'c'], 'd', 'e']));

    describe('should parse an explicit triple with nested reified annotation',
      shouldParse('<a> <b> <c> {| <d> <e> {| <f> <g> |} |} .',
          ['a', 'b', 'c'],
          [['a', 'b', 'c'], 'd', 'e'],
          [[['a', 'b', 'c'], 'd', 'e'], 'f', 'g']));

    const q = ['http://example.com/ns#s', 'http://example.com/ns#p',
      ['http://example.com/ns#a', 'http://example.com/ns#b', 'http://example.com/ns#c']];

    describe('should parse an explicit triple with reified annotation containing prefixed iris',
      shouldParse('PREFIX : <http://example.com/ns#> \n :s :p <<:a :b :c>> {| :q :z |} .',
        q, [q, 'http://example.com/ns#q', 'http://example.com/ns#z']));

    describe('should parse an explicit triple with 2 reified annotations',
      shouldParse('<a> <b> <c> {| <d> <e>; <f> <g> |} .',
          ['a', 'b', 'c'],
          [['a', 'b', 'c'], 'd', 'e'],
          [['a', 'b', 'c'], 'f', 'g']));

    describe('should parse an explicit triple with reified annotation in a named graph',
      shouldParse('<G> { <a> <b> <c> {| <d> <e> |} . }',
          ['a', 'b', 'c', 'G'],
          [['a', 'b', 'c'], 'd', 'e', 'G']));

    describe('should parse an explicit triple with 2 reified annotations in a named graph',
      shouldParse('<G> { <a> <b> <c> {| <d> <e>; <f> <g> |} . }',
          ['a', 'b', 'c', 'G'],
          [['a', 'b', 'c'], 'd', 'e', 'G'],
          [['a', 'b', 'c'], 'f', 'g', 'G']));

    it('should not parse an annotated object in list',
      shouldNotParse('<a> <b> ( <c> {| <d> <e> |} )',
          'Expected entity but got {| on line 1.'));

    it('should not parse an annotated statement in list',
        shouldNotParse('<a> <b> ( <c> <d> <e> {| <d> <e> |} )',
          'Expected entity but got {| on line 1.'));

    it('should not parse fourth term in quoted triple',
        shouldNotParse('<< <a> <b> <c> <g> >> <p> <q>',
          'Expected >> to follow "http://example.org/c" but got IRI on line 1.'));

    it('should not parse fourth term in quoted triple object',
      shouldNotParse('<p> <q> << <a> <b> <c> <g> >>',
          'Expected >> to follow "http://example.org/c" but got IRI on line 1.'));

    it('should not parse quoted triple as predicate',
      shouldNotParse('<p> << <a> <b> <c> >> <q>',
          'Expected entity but got << on line 1.'));

    it('should not parse quoted quad as predicate',
      shouldNotParse('<p> << <a> <b> <c> <d> >> <q>',
          'Expected entity but got << on line 1.'));
  });

  describe('An Parser instance without document IRI', () => {
    function parser() { return new Parser(); }

    describe('should keep relative IRIs',
      shouldParse(parser,
        '@prefix : <#>.\n' +
        '<a> <b> <c> <g>.\n' +
        ':d :e :f :g.',
        [termFromId('a'), termFromId('b'), termFromId('c'), termFromId('g')],
        [termFromId('#d'), termFromId('#e'), termFromId('#f'), termFromId('#g')]));

    describe('should keep empty IRIs',
      shouldParse(parser,
        '@prefix : <>.\n' +
        '<> <> <> <>.\n' +
        ': : : :.',
        [new NamedNode(''), new NamedNode(''), new NamedNode(''), new NamedNode('')],
        [new NamedNode(''), new NamedNode(''), new NamedNode(''), new NamedNode('')]));
  });

  describe('An Parser instance with a document IRI', () => {
    function parser() { return new Parser({ baseIRI: 'http://ex.org/x/yy/zzz/f.ttl' }); }

    describe('should resolve IRIs against the document IRI',
      shouldParse(parser,
                  '@prefix : <#>.\n' +
                  '<a> <b> <c> <g>.\n' +
                  ':d :e :f :g.',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/b', 'http://ex.org/x/yy/zzz/c', 'http://ex.org/x/yy/zzz/g'],
                  ['http://ex.org/x/yy/zzz/f.ttl#d', 'http://ex.org/x/yy/zzz/f.ttl#e', 'http://ex.org/x/yy/zzz/f.ttl#f', 'http://ex.org/x/yy/zzz/f.ttl#g']));

    describe('should resolve IRIs with a trailing slash against the document IRI',
      shouldParse(parser,
                  '</a> </a/b> </a/b/c>.\n',
                  ['http://ex.org/a', 'http://ex.org/a/b', 'http://ex.org/a/b/c']));

    describe('should resolve IRIs starting with ./ against the document IRI',
      shouldParse(parser,
                  '<./a> <./a/b> <./a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/a/b', 'http://ex.org/x/yy/zzz/a/b/c']));

    describe('should resolve IRIs starting with multiple ./ sequences against the document IRI',
      shouldParse(parser,
                  '<./././a> <./././././a/b> <././././././a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/a/b', 'http://ex.org/x/yy/zzz/a/b/c']));

    describe('should resolve IRIs starting with ../ against the document IRI',
      shouldParse(parser,
                  '<../a> <../a/b> <../a/b/c>.\n',
                  ['http://ex.org/x/yy/a', 'http://ex.org/x/yy/a/b', 'http://ex.org/x/yy/a/b/c']));

    describe('should resolve IRIs starting multiple ../ sequences against the document IRI',
      shouldParse(parser,
                  '<../../a> <../../../a/b> <../../../../../../../../a/b/c>.\n',
                  ['http://ex.org/x/a', 'http://ex.org/a/b', 'http://ex.org/a/b/c']));

    describe('should resolve IRIs starting with mixes of ./ and ../ sequences against the document IRI',
      shouldParse(parser,
                  '<.././a> <./.././a/b> <./.././.././a/b/c>.\n',
                  ['http://ex.org/x/yy/a', 'http://ex.org/x/yy/a/b', 'http://ex.org/x/a/b/c']));

    describe('should resolve IRIs starting with .x, ..x, or .../ against the document IRI',
      shouldParse(parser,
                  '<.x/a> <..x/a/b> <.../a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/.x/a', 'http://ex.org/x/yy/zzz/..x/a/b', 'http://ex.org/x/yy/zzz/.../a/b/c']));

    describe('should resolve datatype IRIs against the document IRI',
      shouldParse(parser,
                  '<a> <b> "c"^^<d>.',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/b', '"c"^^http://ex.org/x/yy/zzz/d']));

    describe('should resolve IRIs in lists against the document IRI',
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

    describe('should respect @base statements',
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

  describe('A Parser instance with a blank node prefix', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, blankNodePrefix: '_:blank' }); }

    describe('should use the given prefix for blank nodes',
      shouldParse(parser,
                  '_:a <b> _:c.\n',
                  ['_:blanka', 'b', '_:blankc']));
  });

  describe('A Parser instance with an empty blank node prefix', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, blankNodePrefix: '' }); }

    describe('should not use a prefix for blank nodes',
      shouldParse(parser,
                  '_:a <b> _:c.\n',
                  ['_:a', 'b', '_:c']));
  });

  describe('A Parser instance with a non-string format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 1 }); }

    describe('should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']));

    describe('should parse a graph',
      shouldParse(parser, '{<a> <b> <c>}', ['a', 'b', 'c']));
  });

  describe('A Parser instance for the Turtle format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'Turtle', rdfStar: false }); }

    describe('should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']));

    it('should not parse a default graph',
      shouldNotParse(parser, '{}', 'Unexpected graph on line 1.'));

    it('should not parse a named graph',
      shouldNotParse(parser, '<g> {}', 'Expected entity but got { on line 1.'));

    it('should not parse a named graph with the GRAPH keyword',
      shouldNotParse(parser, 'GRAPH <g> {}', 'Expected entity but got GRAPH on line 1.'));

    it('should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "http://example.org/c" on line 1.'));

    it('should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'));

    it('should not parse an equality statement',
      shouldNotParse(parser, '<a> = <b>.', 'Unexpected "=" on line 1.'));

    it('should not parse a right implication statement',
      shouldNotParse(parser, '<a> => <b>.', 'Unexpected "=>" on line 1.'));

    it('should not parse a left implication statement',
      shouldNotParse(parser, '<a> <= <b>.', 'Unexpected "<=" on line 1.'));

    it('should not parse a formula as object',
      shouldNotParse(parser, '<a> <b> {}.', 'Unexpected graph on line 1.'));

    it('should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'));

    it('should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'));

    it('should not parse a formula as list item',
      shouldNotParse(parser, '( <a> { <b> <c> <d> } <e> ).',
        'Unexpected graph on line 1.'));

    it('should not parse a literal as subject',
      shouldNotParse(parser, '1 <a> <b>.',
        'Unexpected literal on line 1.'));

    it('should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'));

    it('should not parse annotated statement',
      shouldNotParse(parser, '<a> <b> <c> {| <a> <b> |} .',
        'Unexpected RDF-star syntax on line 1.'));

    it('should not parse RDF-star in the object position',
      shouldNotParse(parser, '<a> <b> <<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'));

    it('should not parse RDF-star in the object list',
      shouldNotParse(parser, '<a> <b> ( <<a> <b> <c>>> ).',
        'Unexpected RDF-star syntax on line 1.'));

    it('should not parse RDF-star in the subject list',
      shouldNotParse(parser, '( <<a> <b> <c>>> ) <a> <b>.',
        'Unexpected RDF-star syntax on line 1.'));
  });

  describe('A Parser instance for the TurtleStar format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'TurtleStar' }); }

    describe('should parse RDF-star',
      shouldParse(parser,
        '<<<a> <b> <c>>> <b> <c> .',
        [['a', 'b', 'c'], 'b', 'c']));

    it('should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:b0_b" but got IRI on line 1.'));
  });

  describe('A Parser instance for the TriG format with rdfStar support disabled', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'TriG', rdfStar: false }); }

    it('should parse a single triple chunked before a closing bracket',
      shouldParseChunks(parser, ['<a> <b', '> <c>.'], ['a', 'b', 'c']));

    it('should parse a single triple chunked after an opening bracket',
      shouldParseChunks(parser, ['<a> <', 'b> <c>.'], ['a', 'b', 'c']));

    describe('should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']));

    describe('should parse a default graph',
      shouldParse(parser, '{}'));

    describe('should parse a named graph',
      shouldParse(parser, '<g> {}'));

    describe('should parse a named graph with the GRAPH keyword',
      shouldParse(parser, 'GRAPH <g> {}'));

    it('should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "http://example.org/c" on line 1.'));

    it('should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'));

    it('should not parse an equality statement',
      shouldNotParse(parser, '<a> = <b>.', 'Unexpected "=" on line 1.'));

    it('should not parse a right implication statement',
      shouldNotParse(parser, '<a> => <b>.', 'Unexpected "=>" on line 1.'));

    it('should not parse a left implication statement',
      shouldNotParse(parser, '<a> <= <b>.', 'Unexpected "<=" on line 1.'));

    it('should not parse a formula as object',
      shouldNotParse(parser, '<a> <b> {}.', 'Unexpected graph on line 1.'));

    it('should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'));

    it('should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'));

    it('should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'));

    it('should not parse RDF-star in the object position',
      shouldNotParse(parser, '<a> <b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'));
  });

  describe('A Parser instance for the TriGS format testing rdfStar support', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'TriG' }); }

    describe('should parse RDF-star',
      shouldParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        [['a', 'b', 'c'], 'a', 'b']));

    it('should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:b0_b" but got IRI on line 1.'));
  });

  describe('A Parser instance for the N-Triples format with rdfStar support disabled', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-Triples', rdfStar: false }); }

    describe('should parse a single triple',
      shouldParse(parser, '_:a <http://ex.org/b> "c".',
                          ['_:b0_a', 'http://ex.org/b', '"c"']));

    describe('should parse a single triple starting with Bom',
        shouldParse(parser, '\ufeff_:a <http://ex.org/b> "c".',
            ['_:b0_a', 'http://ex.org/b', '"c"']));

    it('should not parse a single quad',
      shouldNotParse(parser, '_:a <http://ex.org/b> "c" <http://ex.org/g>.',
                             'Expected punctuation to follow ""c"" on line 1.'));

    it('should not parse relative IRIs',
      shouldNotParse(parser, '<a> <b> <c>.', 'Invalid IRI on line 1.'));

    it('should not parse a prefix declaration',
      shouldNotParse(parser, '@prefix : <p#>.', 'Unexpected "@prefix" on line 1.'));

    it('should not parse apostrophe literals',
      shouldNotParse(parser, "_:a <http://ex.org/b> 'c'.",
                             "Unexpected \"'c'.\" on line 1."));

    it('should not parse triple-quoted literals',
      shouldNotParse(parser, '_:a <http://ex.org/b> """c""".',
                             'Unexpected """"c"""." on line 1.'));

    it('should not parse triple-apostrophe literals',
      shouldNotParse(parser, "_:a <http://ex.org/b> '''c'''.",
                             "Unexpected \"'''c'''.\" on line 1."));

    it('should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'));

    it('should not parse an equality statement',
      shouldNotParse(parser, '<urn:a:a> = <urn:b:b>.', 'Unexpected "=" on line 1.'));

    it('should not parse a right implication statement',
      shouldNotParse(parser, '<urn:a:a> => <urn:b:b>.', 'Unexpected "=>" on line 1.'));

    it('should not parse a left implication statement',
      shouldNotParse(parser, '<urn:a:a> <= <urn:b:b>.', 'Unexpected "<=" on line 1.'));

    it('should not parse a formula as object',
      shouldNotParse(parser, '<urn:a:a> <urn:b:b> {}.', 'Unexpected "{}." on line 1.'));

    it('should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'));

    it('should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'));

    it('should not parse an object list',
      shouldNotParse(parser, '<a> <b> <c>, <d> .', 'Invalid IRI on line 1.'));

    it('should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'));

    it('should not parse RDF-star in the object position',
      shouldNotParse(parser, '<http://ex.org/a> <http://ex.org/b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'));
  });

  describe('A Parser instance for the N-Triples format to test rdfStar support', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-Triples' }); }

    describe('should parse RDF-star',
      shouldParse(parser, '<<_:a <http://example.org/b> _:c>> <http://example.org/a> _:b .',
        [['_:b0_a', 'b', '_:b0_c'], 'a', '_:b0_b']));

    it('should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:b0_b" but got IRI on line 1.'));
  });

  describe('A Parser instance for the N-Quads format with rdfStar support disabled', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-Quads', rdfStar: false }); }

    describe('should parse a single triple',
      shouldParse(parser, '_:a <http://ex.org/b> "c".',
                          ['_:b0_a', 'http://ex.org/b', '"c"']));

    describe('should parse a single quad',
      shouldParse(parser, '_:a <http://ex.org/b> "c" <http://ex.org/g>.',
                          ['_:b0_a', 'http://ex.org/b', '"c"', 'http://ex.org/g']));

    it('should not parse relative IRIs',
      shouldNotParse(parser, '<a> <b> <c>.', 'Invalid IRI on line 1.'));

    it('should not parse a prefix declaration',
      shouldNotParse(parser, '@prefix : <p#>.', 'Unexpected "@prefix" on line 1.'));

    it('should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'));

    it('should not parse an equality statement',
      shouldNotParse(parser, '<urn:a:a> = <urn:b:b>.', 'Unexpected "=" on line 1.'));

    it('should not parse a right implication statement',
      shouldNotParse(parser, '<urn:a:a> => <urn:b:b>.', 'Unexpected "=>" on line 1.'));

    it('should not parse a left implication statement',
      shouldNotParse(parser, '<urn:a:a> <= <urn:b:b>.', 'Unexpected "<=" on line 1.'));

    it('should not parse a formula as object',
      shouldNotParse(parser, '<urn:a:a> <urn:b:b> {}.', 'Unexpected "{}." on line 1.'));

    it('should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'));

    it('should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'));

    it('should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'));

    it('should not parse RDF-star in the object position',
      shouldNotParse(parser, '_:a <http://ex.org/b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'));
  });

  describe('A Parser instance for the N-QuadsStar format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-QuadsStar' }); }

    describe('should parse RDF-star',
      shouldParse(parser, '<<_:a <http://example.org/b> _:c>> <http://example.org/a> _:c .',
        [['_:b0_a', 'b', '_:b0_c'], 'a', '_:b0_c']));
  });

  for (const isImpliedBy of [true, false]) {
    // eslint-disable-next-line no-inner-declarations
    function implies(from, to) {
      return isImpliedBy ? [to, 'http://www.w3.org/2000/10/swap/log#isImpliedBy', from] : [from, 'http://www.w3.org/2000/10/swap/log#implies', to];
    }

    describe(`A Parser instance for the N3 format with rdfStar support disabled and with isImpliedBy ${isImpliedBy ? 'enabled' : 'disabled'} and n3Quantifiers enabled`, () => {
      function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3', rdfStar: false, isImpliedBy, n3Quantifiers: true }); }

      describe('should parse a @forSome statement',
        shouldParse(parser, '@forSome <x>. <x> <x> <x>.',
                ['_:b0', '_:b0', '_:b0']));

      describe('should parse a @forSome statement with multiple entities',
        shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forSome a:x, <y>, a:z. a:x <y> a:z.',
                    ['_:b0', '_:b1', '_:b2']));

      it('should not parse a @forSome statement with an invalid prefix',
        shouldNotParse(parser, '@forSome a:b.',
                       'Undefined prefix "a:" on line 1.'));

      it('should not parse a @forSome statement with a blank node',
        shouldNotParse(parser, '@forSome _:a.',
                       'Unexpected blank on line 1.'));

      it('should not parse a @forSome statement with a variable',
        shouldNotParse(parser, '@forSome ?a.',
                       'Unexpected var on line 1.'));

      describe('should correctly scope @forSome statements',
        shouldParse(parser, '@forSome <x>. <x> <x> { @forSome <x>. <x> <x> <x>. }. <x> <x> <x>.',
                    ['_:b0', '_:b0', '_:b1'],
                    ['_:b2', '_:b2', '_:b2', '_:b1'],
                    ['_:b0', '_:b0', '_:b0']));

      describe('should parse a @forAll statement',
        shouldParse(parser, '@forAll  <x>. <x> <x> <x>.',
                    ['?b0', '?b0', '?b0']));

      describe('should parse a @forAll statement with multiple entities',
        shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forAll  a:x, <y>, a:z. a:x <y> a:z.',
                    ['?b0', '?b1', '?b2']));

      it('should not parse a @forAll statement with an invalid prefix',
        shouldNotParse(parser, '@forAll a:b.',
                       'Undefined prefix "a:" on line 1.'));

      it('should not parse a @forAll statement with a blank node',
        shouldNotParse(parser, '@forAll _:a.',
                       'Unexpected blank on line 1.'));

      it('should not parse a @forAll statement with a variable',
        shouldNotParse(parser, '@forAll ?a.',
                       'Unexpected var on line 1.'));
    });

    describe(`A Parser instance for the N3 format with rdfStar support disabled and with ${isImpliedBy ? 'enabled' : 'disabled'}`, () => {
      function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3', rdfStar: false, isImpliedBy }); }

      describe('should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']));

      it('should not parse a default graph',
      shouldNotParse(parser, '{}', 'Expected entity but got eof on line 1.'));

      it('should not parse a named graph',
      shouldNotParse(parser, '<g> {}', 'Expected entity but got { on line 1.'));

      it('should not parse a named graph with the GRAPH keyword',
      shouldNotParse(parser, 'GRAPH <g> {}', 'Expected entity but got GRAPH on line 1.'));

      it('should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "http://example.org/c" on line 1.'));

      describe('allows a blank node in predicate position',
      shouldParse(parser, '<a> [] <c>.', ['a', '_:b0', 'c']));

      describe('allows a blank node label in predicate position',
      shouldParse(parser, '<a> _:b <c>.', ['a', '_:b0_b', 'c']));

      describe('allows a blank node with properties in predicate position',
      shouldParse(parser, '<a> [<p> <o>] <c>.',
                  ['a', '_:b0', 'c'],
                  ['_:b0', 'p', 'o']));

      describe('should parse a variable',
      shouldParse(parser, '?a ?b ?c.', ['?a', '?b', '?c']));

      describe('should parse a simple equality',
      shouldParse(parser, '<a> = <b>.',
                  ['a', 'http://www.w3.org/2002/07/owl#sameAs', 'b']));

      describe('should parse a list equality',
        shouldParse(parser, '() = ().',
                    ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'http://www.w3.org/2002/07/owl#sameAs', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

      describe('should parse a list equality with IRI',
        shouldParse(parser, ':e = ().',
                    ['http://example.org/#e', 'http://www.w3.org/2002/07/owl#sameAs', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

      describe('should parse abbreviations inside blank Nodes within lists with explicit prefix definition',
        shouldParse('@prefix : <http://example.org/#> . :a :b ([ a :mother ]).',
                    ['http://example.org/#a', 'http://example.org/#b', '_:b0'],
                    ...list(['_:b0', '_:b1']),
                    ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/#mother']));

      describe('should parse abbreviations inside blank Nodes within lists',
        shouldParse(parser, ':a :b ([ a :mother ]).',
                    ['http://example.org/#a', 'http://example.org/#b', '_:b0'],
                    ...list(['_:b0', '_:b1']),
                    ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/#mother']));

      describe('should parse a simple right implication',
      shouldParse(parser, '<a> => <b>.',
                  ['a', 'http://www.w3.org/2000/10/swap/log#implies', 'b']));

      describe('should parse a simple left implication',
      shouldParse(parser, '<a> <= <b>.',
                  implies('b', 'a')));

      describe('should parse a right implication between one-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. } => { <d> <e> ?a }.',
                  ['_:b0', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1']));

      it('should parse a right implication between one-triple graphs with chunk at first bracket',
      shouldParseChunks(parser, ['{', ' ?a ?b <c>. } => { <d> <e> ?a }.'],
                  ['_:b0', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1']));

      describe('should parse a right implication between two-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. <d> <e> <f>. } => { <d> <e> ?a, <f> }.',
                  ['_:b0', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  'f',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1'],
                  ['d',  'e',  'f',  '_:b1']));

      describe('should parse a left implication between one-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. } <= { <d> <e> ?a }.',
                  implies('_:b1', '_:b0'),
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1']));

      describe('should parse a left implication between two-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. <d> <e> <f>. } <= { <d> <e> ?a, <f> }.',
                  implies('_:b1', '_:b0'),
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  'f',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1'],
                  ['d',  'e',  'f',  '_:b1']));

      describe('should parse an equality of one-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. } = { <d> <e> ?a }.',
                  ['_:b0', 'http://www.w3.org/2002/07/owl#sameAs', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1']));

      describe('should parse an equality of two-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. <d> <e> <f>. } = { <d> <e> ?a, <f> }.',
                  ['_:b0', 'http://www.w3.org/2002/07/owl#sameAs', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  'f',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1'],
                  ['d',  'e',  'f',  '_:b1']));

      describe('should parse nested implication graphs',
      shouldParse(parser, '{ { ?a ?b ?c }<={ ?d ?e ?f }. } <= { { ?g ?h ?i } => { ?j ?k ?l } }.',
                  implies('_:b3', '_:b0'),
                  [...implies('_:b2', '_:b1'), '_:b0'],
                  ['?a', '?b', '?c', '_:b1'],
                  ['?d', '?e', '?f', '_:b2'],
                  ['_:b4', 'http://www.w3.org/2000/10/swap/log#implies', '_:b5', '_:b3'],
                  ['?g', '?h', '?i', '_:b4'],
                  ['?j', '?k', '?l', '_:b5']));

      describe('should not reuse identifiers of blank nodes within and outside of formulas',
      shouldParse(parser, '_:a _:b _:c. { _:a _:b _:c } => { { _:a _:b _:c } => { _:a _:b _:c } }.',
                  ['_:b0_a', '_:b0_b', '_:b0_c'],
                  ['_:b0', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1', ''],
                  ['_:b0.a', '_:b0.b', '_:b0.c', '_:b0'],
                  ['_:b2', 'http://www.w3.org/2000/10/swap/log#implies', '_:b3', '_:b1'],
                  ['_:b2.a', '_:b2.b', '_:b2.c', '_:b2'],
                  ['_:b3.a', '_:b3.b', '_:b3.c', '_:b3']));

      it('should parse a @forSome statement',
      shouldNotParse(parser, '@forSome <x>. <x> <x> <x>.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      describe('should parse a named graph in a list',
      shouldParse(parser, '<s> <p> ({<a> <b> <c>}) .',
                  ['s', 'p', '_:b1'],
                  ...list(['_:b1', '_:b0']),
                  ['a', 'b', 'c', '_:b0']
                  ));

      describe('should parse a named graph as the second element in a list',
      shouldParse(parser, '<s> <p> (<x> {<a> <b> <c>}) .',
                  ['s', 'p', '_:b0'],
                  ...list(['_:b0', 'x'], ['_:b2', '_:b1']),
                  ['a', 'b', 'c', '_:b1']
                  ));

      describe('should parse a named graph as the second element in a list of 3 elements',
      shouldParse(parser, '<s> <p> (<x> {<a> <b> <c>} <y>) .',
                  ['s', 'p', '_:b0'],
                  ...list(['_:b0', 'x'], ['_:b2', '_:b1'], ['_:b3', 'y']),
                  ['a', 'b', 'c', '_:b1']
                  ));

      describe('should parse a named graph in a subject list',
      shouldParse(parser, '({<a> <b> <c>}) <p> <o> .',
                  ['_:b1', 'p', 'o'],
                  ...list(['_:b1', '_:b0']),
                  ['a', 'b', 'c', '_:b0']
                  ));

      describe('should parse a named graph as the second element in a subject list',
      shouldParse(parser, '(<x> {<a> <b> <c>}) <p> <o> .',
                  ['_:b0', 'p', 'o'],
                  ...list(['_:b0', 'x'], ['_:b2', '_:b1']),
                  ['a', 'b', 'c', '_:b1']
                  ));

      describe('should parse a named graph as the second element in a subject list with 3 elements',
      shouldParse(parser, '(<x> {<a> <b> <c>} <y>) <p> <o> .',
                  ['_:b0', 'p', 'o'],
                  ...list(['_:b0', 'x'], ['_:b2', '_:b1'], ['_:b3', 'y']),
                  ['a', 'b', 'c', '_:b1']
                  ));

      it('should parse a @forSome statement with multiple entities',
      shouldNotParse(parser, '@prefix a: <a:>. @base <b:>. @forSome a:x, <y>, a:z. a:x <y> a:z.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should not parse a @forSome statement with an invalid prefix',
      shouldNotParse(parser, '@forSome a:b.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should not parse a @forSome statement with a blank node',
      shouldNotParse(parser, '@forSome _:a.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should not parse a @forSome statement with a variable',
      shouldNotParse(parser, '@forSome ?a.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should correctly scope @forSome statements',
      shouldNotParse(parser, '@forSome <x>. <x> <x> { @forSome <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should parse a @forAll statement',
      shouldNotParse(parser, '@forAll  <x>. <x> <x> <x>.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should parse a @forAll statement with multiple entities',
      shouldNotParse(parser, '@prefix a: <a:>. @base <b:>. @forAll  a:x, <y>, a:z. a:x <y> a:z.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should not parse a @forAll statement with an invalid prefix',
      shouldNotParse(parser, '@forAll a:b.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should not parse a @forAll statement with a blank node',
      shouldNotParse(parser, '@forAll _:a.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should not parse a @forAll statement with a variable',
      shouldNotParse(parser, '@forAll ?a.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      it('should correctly scope @forAll statements',
      shouldNotParse(parser, '@forAll <x>. <x> <x> { @forAll <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

      describe('should parse a ! path of length 2 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe!fam:mother a fam:Person.',
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ! path of length 4 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>. @prefix loc: <l:>.' +
                          ':joe!fam:mother!loc:office!loc:zip loc:code 1234.',
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b0',   'l:office', '_:b1'],
                  ['_:b1',   'l:zip',    '_:b2'],
                  ['_:b2',   'l:code',   '"1234"^^http://www.w3.org/2001/XMLSchema#integer']));

      describe('should parse a ! path of length 2 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe!fam:mother.',
                  ['x', 'is', '_:b0'],
                  ['ex:joe', 'f:mother', '_:b0']));

      describe('should parse a ! path of length 4 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>. @prefix loc: <l:>.' +
                          '<x> <is> :joe!fam:mother!loc:office!loc:zip.',
                  ['x',      'is',       '_:b2'],
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b0',   'l:office', '_:b1'],
                  ['_:b1',   'l:zip',    '_:b2']));

      describe('should parse a ^ path of length 2 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe^fam:son a fam:Person.',
                  ['_:b0', 'f:son', 'ex:joe'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ^ path of length 4 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe^fam:son^fam:sister^fam:mother a fam:Person.',
                  ['_:b0', 'f:son',    'ex:joe'],
                  ['_:b1', 'f:sister', '_:b0'],
                  ['_:b2', 'f:mother', '_:b1'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ^ path of length 2 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe^fam:son.',
                  ['x',    'is',    '_:b0'],
                  ['_:b0', 'f:son', 'ex:joe']));

      describe('should parse a ^ path of length 4 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe^fam:son^fam:sister^fam:mother.',
                  ['x',    'is',       '_:b2'],
                  ['_:b0', 'f:son',    'ex:joe'],
                  ['_:b1', 'f:sister', '_:b0'],
                  ['_:b2', 'f:mother', '_:b1']));

      describe('should parse mixed !/^ paths as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe!fam:mother^fam:mother a fam:Person.',
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b1',   'f:mother', '_:b0'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse mixed !/^ paths as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe!fam:mother^fam:mother.',
                  ['x', 'is', '_:b1'],
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b1',   'f:mother', '_:b0']));

      describe('should parse a ! path in a blank node as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '[fam:knows :joe!fam:mother] a fam:Person.',
                  ['_:b0', 'f:knows', '_:b1'],
                  ['ex:joe', 'f:mother', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ! path in a blank node as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> [fam:knows :joe!fam:mother].',
                  ['x', 'is', '_:b0'],
                  ['_:b0', 'f:knows', '_:b1'],
                  ['ex:joe', 'f:mother', '_:b1']));

      describe('should parse a ^ path in a blank node as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '[fam:knows :joe^fam:son] a fam:Person.',
                  ['_:b0', 'f:knows', '_:b1'],
                  ['_:b1', 'f:son', 'ex:joe'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ^ path in a blank node as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> [fam:knows :joe^fam:son].',
                  ['x', 'is', '_:b0'],
                  ['_:b0', 'f:knows', '_:b1'],
                  ['_:b1', 'f:son', 'ex:joe']));

      describe('should parse an empty list in the subject position',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '() <p> <o> .',
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'p',  'o']
                  ));

      describe('should parse an empty list in the predicate position',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<s> () <o> .',
                  ['s', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil',  'o']
                  ));

      describe('should parse an empty list in the object position',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<s> <p> () .',
                  ['s', 'p', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']
                  ));

      describe('should parse a single element list in the subject position',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '( <s> ) <p> <o> .',
                  ...list(['_:b0', 's']),
                  ['_:b0', 'p',  'o']
                  ));


      describe('should parse a single element list in the predicate position',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<s> ( <p> ) <o> .',
                  ...list(['_:b0', 'p']),
                  ['s', '_:b0',  'o']
                  ));

      describe('should parse a single element list in the object position',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<s> <p> ( <o> ) .',
                  ...list(['_:b0', 'o']),
                  ['s', 'p',  '_:b0']
                  ));

      describe('should parse a ! path in a list as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(<x> :joe!fam:mother <y>) a :List.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',  'ex:List'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['ex:joe', 'f:mother', '_:b2']));

      describe('should parse a ! path in a list as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<l> <is> (<x> :joe!fam:mother <y>).',
                  ['l', 'is', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['ex:joe', 'f:mother', '_:b2']));

      describe('should parse a ^ path in a list as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(<x> :joe^fam:son <y>) a :List.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',  'ex:List'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'f:son', 'ex:joe']));

      describe('should parse a ^ path in a list as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<l> <is> (<x> :joe^fam:son <y>).',
                  ['l', 'is', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'f:son', 'ex:joe']));

      describe('should parse a ! path of length 2 as subject in a list',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(:joe!fam:mother) a fam:Person.',
                  ['ex:joe', 'f:mother', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a !^ path of length 3 as subject in a list',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(:joe!fam:mother^fam:father) a fam:Person.',
                  ['ex:joe', 'f:mother', '_:b1'],
                  ['_:b2', 'f:father', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ! path of length 2 starting with an empty list',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '()!fam:mother a fam:Person.',
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'f:mother', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ! path of length 2 starting with a non-empty list',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '( :a )!fam:mother a fam:Person.',
                  ...list(['_:b0', 'ex:a']),
                  ['_:b0', 'f:mother', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ! path of length 2 starting with a non-empty list in another list',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(( :a )!fam:mother 1) a fam:Person.',
                  ...list(['_:b0', '_:b2'], ['_:b3', '"1"^^http://www.w3.org/2001/XMLSchema#integer']),
                  ...list(['_:b1', 'ex:a']),
                  ['_:b1', 'f:mother', '_:b2'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']));

      describe('should parse a ! path of length 2 starting with an empty list in another list',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(()!fam:mother 1) a fam:Person.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person'],
                  ...list(['_:b0', '_:b1'], ['_:b2', '"1"^^http://www.w3.org/2001/XMLSchema#integer']),
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'f:mother', '_:b1']
                  ));

      describe('should parse a ! path of length 2 starting with an empty list in another list as second element',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(1 ()!fam:mother) a fam:Person.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person'],
                  ...list(['_:b0', '"1"^^http://www.w3.org/2001/XMLSchema#integer'], ['_:b1', '_:b2']),
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'f:mother', '_:b2']
                  ));

      describe('should parse a ! path of length 2 starting with an empty list in another list of one element',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(()!fam:mother) a fam:Person.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person'],
                  ...list(['_:b0', '_:b1']),
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'f:mother', '_:b1']));

      describe('should parse a ! path of length 2 as nested subject in a list',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '((:joe!fam:mother) 1) a fam:Person.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person'],
                  ...list(['_:b0', '_:b1'], ['_:b3', '"1"^^http://www.w3.org/2001/XMLSchema#integer']),
                  ...list(['_:b1', '_:b2']),
                  ['ex:joe', 'f:mother', '_:b2']));

      describe('should parse a birthday rule',
      shouldParse(parser,
        '@prefix foaf: <http://xmlns.com/foaf/0.1/> .' +
        '@prefix math: <http://www.w3.org/2000/10/swap/math#> .' +
        '@prefix : <http://example.org/> .' +
        '' +
        '{' +
        '  ?x :trueOnDate ?date.' +
        '} <= {' +
        '  ((?date ?s!foaf:birthday)!math:difference 31622400) math:integerQuotient ?age .' +
        '} .',
          ['?x', 'http://example.org/trueOnDate', '?date', '_:b0'],
          implies('_:b1', '_:b0'),
          ...[
            ...list(['_:b2', '_:b6'], ['_:b7', '"31622400"^^http://www.w3.org/2001/XMLSchema#integer']),
            ['_:b2', 'http://www.w3.org/2000/10/swap/math#integerQuotient', '?age'],
            ...list(['_:b3', '?date'], ['_:b4', '_:b5']),
            ['?s', 'http://xmlns.com/foaf/0.1/birthday', '_:b5'],
            ['_:b3', 'http://www.w3.org/2000/10/swap/math#difference', '_:b6'],
          ].map(elem => [...elem, '_:b1'])
        ));

      describe('should parse a formula as list item',
        shouldParse(parser, '<a> <findAll> ( <b> { <b> a <type>. <b> <something> <foo> } <o> ).',
        ['a', 'findAll', '_:b0'],
        ...list(['_:b0', 'b'], ['_:b2', '_:b1'], ['_:b3', 'o']),
        ['b', 'something', 'foo', '_:b1'],
        ['b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'type', '_:b1']
    ));

      it('should not parse an invalid ! path',
      shouldNotParse(parser, '<a>!"invalid" ', 'Expected entity but got literal on line 1.'));

      it('should not parse an invalid ^ path',
      shouldNotParse(parser, '<a>^"invalid" ', 'Expected entity but got literal on line 1.'));

      describe('should parse literal as subject',
        shouldParse(parser, '<a> <b> {1 <greaterThan> 0}.',
            ['a', 'b', '_:b0'],
            ['"1"^^http://www.w3.org/2001/XMLSchema#integer', 'greaterThan', '"0"^^http://www.w3.org/2001/XMLSchema#integer', '_:b0']
        ));

      describe('should parse literals with datatype as subject',
        shouldParse(parser, '"a"^^<c> <greaterThan> <d>.',
            ['"a"^^http://example.org/c', 'greaterThan', 'd']
        ));


      describe('should parse literals with datatype as subject and object',
        shouldParse(parser, '"a"^^<c> <greaterThan> "b"^^<c>.',
            ['"a"^^http://example.org/c', 'greaterThan', '"b"^^http://example.org/c']
        ));

      describe('should parse literals without datatype as subject and object',
        shouldParse(parser, '"a" <greaterThan> "b".',
            ['"a"', 'greaterThan', '"b"']
        ));

      describe('should parse literals without datatype as subject',
        shouldParse(parser, '"a" <greaterThan> <b>.',
            ['"a"', 'greaterThan', 'b']
        ));

      describe('should parse literals with datatype as predicate',
        shouldParse(parser, '<greaterThan> "a"^^<c> "b"^^<c>.',
            ['greaterThan', '"a"^^http://example.org/c', '"b"^^http://example.org/c']
        ));

      describe('should parse literals without datatype as predicate',
        shouldParse(parser, '<greaterThan> "a" "b".',
            ['greaterThan', '"a"', '"b"']
        ));

      describe('should parse subject, predicate, and object as integer',
        shouldParse(parser, '1 1 1.',
            ['"1"^^http://www.w3.org/2001/XMLSchema#integer', '"1"^^http://www.w3.org/2001/XMLSchema#integer', '"1"^^http://www.w3.org/2001/XMLSchema#integer']
        ));

      describe('should parse literals with integer as predicate',
        shouldParse(parser, '<greaterThan> 1 "b".',
            ['greaterThan', '"1"^^http://www.w3.org/2001/XMLSchema#integer', '"b"']
        ));

      describe('should parse literals with datatype as predicate in graph',
        shouldParse(parser, '<x> <y> {<greaterThan> "a"^^<c> "b"^^<c>}.',
            ['x', 'y', '_:b0'],
            ['greaterThan', '"a"^^http://example.org/c', '"b"^^http://example.org/c', '_:b0']
        ));

      describe('should parse literals without datatype as predicate in graph',
        shouldParse(parser, '<x> <y> {<greaterThan> "a" "b"}.',
            ['x', 'y', '_:b0'],
            ['greaterThan', '"a"', '"b"', '_:b0']
        ));

      describe('should parse literals with datatype as subject in graph',
        shouldParse(parser, '<a> <b> {"a"^^<c> <greaterThan> "b"^^<c>}.',
            ['a', 'b', '_:b0'],
            ['"a"^^http://example.org/c', 'greaterThan', '"b"^^http://example.org/c', '_:b0']
        ));

      describe('should parse literals with language as subject',
        shouldParse(parser, '<a> <b> {"bonjour"@fr <sameAs> "hello"@en}.',
            ['a', 'b', '_:b0'],
            ['"bonjour"@fr', 'sameAs', '"hello"@en', '_:b0']
        ));

      it('should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'));

      it('should not parse RDF-star in the object position',
      shouldNotParse(parser, '<a> <b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'));
    });
  }

  describe('A Parser instance for the N3 format testing rdfStar support', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3' }); }

    describe('should parse RDF-star path',
      shouldParse(parser, '<<<a> <b> <c>>>!<p1> <p2> <o> .',
        [['a', 'b', 'c'], 'p1', '_:b0'], ['_:b0', 'p2', 'o']));

    describe('should parse RDF-star path',
      shouldParse(parser, '<<<a> <b> <c>>>!<p1>^<p2> <p3> <o> .',
        [['a', 'b', 'c'], 'p1', '_:b0'], ['_:b1', 'p2', '_:b0'], ['_:b1', 'p3', 'o']));

    describe('should parse RDF-star',
      shouldParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        [['a', 'b', 'c'], 'a', 'b']));

    describe('should treat : as base IRI prefix if not defined otherwise',
      shouldParse(parser, ':a :b :c .',
        ['http://example.org/#a', 'http://example.org/#b', 'http://example.org/#c']));

    describe('should used explicit definition for : if provided',
      shouldParse(parser, '@prefix : <http://myCustomPrefix/> . :a :b :c .',
        ['http://myCustomPrefix/a', 'http://myCustomPrefix/b', 'http://myCustomPrefix/c']));

    describe('should ignore empty statements',
      shouldParse(parser, `:a .
        {:b} .
        [:c :d] .`, ['_:b1', 'http://example.org/#c', 'http://example.org/#d']));

    describe('should ignore empty statements and produce no triples if no actual statements exist',
      shouldParse(parser, ':a .'));

    it('should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:.b" but got IRI on line 1.'));

    describe('should not require . after last triple in a formula',
      shouldParse(parser, '<a><b>{<c><d><e>} .',
        ['a', 'b', '_:b0'],
        ['c', 'd', 'e', '_:b0']));

    describe('should parse path with literal start as object',
      shouldParse(parser, '<a> <b> "c"!<c> .', ['a', 'b', '_:b0'], ['"c"', 'c', '_:b0']));
  
    describe('should parse path with literal start in list',
      shouldParse(parser, '<a> <b> ( "c"!<c> ) .',
        ['a', 'b', '_:b0'],
        ...list(['_:b0', '_:b1']),
        ['"c"', 'c', '_:b1']
        ));

    for (const [elem, value] of [
      ['()', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
      ['( )', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
      ['(  )', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
      ['<http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
      [':joe', 'ex:joe'],
      ['<<:joe a :Person>>', ['ex:joe', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'ex:Person']],
      // ['"d"', "'d'"],
      ['<d>', 'd'],
      // ['?d', '?d'],
      // ['_:bnd', '_:bnd']
    ]) {
      for (const pathType of ['!', '^']) {
        // eslint-disable-next-line no-inner-declarations
        function son(bnode) {
          return pathType === '!' ? [value, 'f:son', `_:b${bnode}`] : [`_:b${bnode}`, 'f:son', value];
        }

        // function checkPlain(content, ...triples) {
        //   describe(`should parse [${content}]`,
        //     shouldParse(parser, `@prefix : <ex:>. @prefix fam: <f:>.${content}`,
        //       ...triples));
        // }

        // checkPlain(`${elem}${pathType}fam:son <x> <y>`, ['_:b0', 'x', 'y'], son('0'));
        // checkPlain(`<x> ${elem}${pathType}fam:son <y>`, ['x', '_:b0', 'y'], son('0'));
        // checkPlain(`<x> <y> ${elem}${pathType}fam:son`, ['x', 'y', '_:b0'], son('0'));

        for (const [pathElem, pathValue] of [
          ['fam:son', 'f:son'],
          // ['()', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']
        ]) {
        // eslint-disable-next-line no-inner-declarations
          function son(bnode) {
            return pathType === '!' ? [value, pathValue, `_:b${bnode}`] : [`_:b${bnode}`, pathValue, value];
          }

          for (const [f, triple] of [
          [x => `(${x}) a :List .`, ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',  'ex:List']],
          [x => `<l> (${x}) <m> .`, ['l', '_:b0', 'm']],
          [x => `<l> <is> (${x}) .`, ['l', 'is', '_:b0']],
          ]) {
          // eslint-disable-next-line no-inner-declarations
            function check(content, ...triples) {
              describe(`should parse [${f(content)}]`,
              shouldParse(parser, `@prefix : <ex:>. @prefix fam: <f:>.${f(content)}`,
                triple, ...triples));
            }

            check(`${elem}${pathType}${pathElem}`, ...list(['_:b0', '_:b1']), son('1'));
            check(`(${elem}${pathType}${pathElem})`, ...list(['_:b0', '_:b1']), ...list(['_:b1', '_:b2']), son('2'));

            check(`${elem}${pathType}${pathElem} <x> <y>`, ...list(['_:b0', '_:b1'], ['_:b2', 'x'], ['_:b3', 'y']), son('1'));
            check(`<x> ${elem}${pathType}${pathElem} <y>`, ...list(['_:b0', 'x'], ['_:b1', '_:b2'], ['_:b3', 'y']), son('2'));
            check(`<x> <y> ${elem}${pathType}${pathElem}`, ...list(['_:b0', 'x'], ['_:b1', 'y'], ['_:b2', '_:b3']), son('3'));

            check(`(${elem}${pathType}${pathElem}) <x> <y>`,
            ...list(['_:b0', '_:b1'], ['_:b3', 'x'], ['_:b4', 'y']),
            ...list(['_:b1', '_:b2']),
            son('2'));
            check(`<x> (${elem}${pathType}${pathElem}) <y>`,
            ...list(['_:b0', 'x'], ['_:b1', '_:b2'], ['_:b4', 'y']),
            ...list(['_:b2', '_:b3']),
            son('3'));
            check(`<x> <y> (${elem}${pathType}${pathElem})`,
            ...list(['_:b0', 'x'], ['_:b1', 'y'], ['_:b2', '_:b3']),
            ...list(['_:b3', '_:b4']),
            son('4'));
          }
        }
      }
    }
  });

  describe('A Parser instance for the N3 format with the explicitQuantifiers and n3Quantifiers option', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3', explicitQuantifiers: true, n3Quantifiers: true }); }

    describe('should parse a @forSome statement',
      shouldParse(parser, '@forSome <x>. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b0', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x']));

    describe('should parse a @forSome statement with multiple entities',
      shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forSome a:x, <y>, a:z. a:x <y> a:z.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b0',        'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b:y', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:z', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['a:x', 'b:y', 'a:z']));

    describe('should correctly scope @forSome statements',
      shouldParse(parser, '@forSome <x>. <x> <x> { @forSome <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b0',      'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', '_:b1'],
                  ['_:b1', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b2',  'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x', '_:b1'],
                  ['x', 'x', 'x']));

    describe('should parse a @forAll statement',
      shouldParse(parser, '@forAll <x>. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b0',       'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x']));

    describe('should parse a @forAll statement with multiple entities',
      shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forAll a:x, <y>, a:z. a:x <y> a:z.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b0',         'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b:y', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:z', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['a:x', 'b:y', 'a:z']));

    it('should correctly scope @forAll statements',
      shouldParse(parser, '@forAll <x>. <x> <x> { @forAll <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b0',       'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', '_:b1'],
                  ['_:b1', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b2',   'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x', '_:b1'],
                  ['x', 'x', 'x']));
  });

  describe('A Parser instance for the N3 format with the explicitQuantifiers without n3Quantifiers option', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3', explicitQuantifiers: true }); }

    it('should parse a @forSome statement',
      shouldNotParse(parser, '@forSome <x>. <x> <x> <x>.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

    it('should parse a @forSome statement with multiple entities',
      shouldNotParse(parser, '@prefix a: <a:>. @base <b:>. @forSome a:x, <y>, a:z. a:x <y> a:z.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

    it('should correctly scope @forSome statements',
      shouldNotParse(parser, '@forSome <x>. <x> <x> { @forSome <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  'The "@forSome" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

    it('should parse a @forAll statement',
      shouldNotParse(parser, '@forAll <x>. <x> <x> <x>.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

    it('should parse a @forAll statement with multiple entities',
      shouldNotParse(parser, '@prefix a: <a:>. @base <b:>. @forAll a:x, <y>, a:z. a:x <y> a:z.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));

    it('should correctly scope @forAll statements',
      shouldNotParse(parser, '@forAll <x>. <x> <x> { @forAll <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  'The "@forAll" quantifier has been deprecated in the Notion3 specification.Enable the n3Quantifiers option to parse the deprecated quantifier. Encountered on line 1.'));
  });

  describe('A Parser instance with a custom DataFactory', () => {
    const factory = {};
    let parser;
    before(() => {
      factory.quad = function (s, p, o, g) { return { s: s, p: p, o: o, g: g }; };
      ['namedNode', 'blankNode', 'literal', 'variable', 'defaultGraph'].forEach(f => {
        factory[f] = function (n) { return n ? `${f[0]}-${n}` : f; };
      });
      parser = new Parser({ baseIRI: BASE_IRI, format: 'n3', factory: factory });
    });

    it('should use the custom factory', () => {
      parser.parse('<a> ?b 1, _:d.').should.deep.equal([
        { s: 'n-http://example.org/a', p: 'v-b', o: 'l-1',    g: 'defaultGraph' },
        { s: 'n-http://example.org/a', p: 'v-b', o: 'b-b0_d', g: 'defaultGraph' },
      ]);
    });
  });

  describe('A parser instance with external data factory', () => {
    it('should parse', () => {
      const parser = new Parser({
        baseIRI: BASE_IRI,
        format: 'n3',
        factory: rdfDataModel,
      });
      const quads = parser.parse(`
        @prefix : <http://example.com/> .
        { :weather a :Raining } => { :weather a :Cloudy } .
      `);

      quads.length.should.be.gt(0);
    });
  });

  describe('IRI resolution', () => {
    describe('RFC3986 normal examples', () => {
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

    describe('RFC3986 abnormal examples', () => {
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

    describe('RFC3986 normal examples with trailing slash in base IRI', () => {
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

    describe('RFC3986 abnormal examples with trailing slash in base IRI', () => {
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

    describe('RFC3986 normal examples with /. in the base IRI', () => {
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

    describe('RFC3986 abnormal examples with /. in the base IRI', () => {
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

    describe('RFC3986 normal examples with /.. in the base IRI', () => {
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

    describe('RFC3986 abnormal examples with /.. in the base IRI', () => {
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

    describe('RFC3986 normal examples with trailing /. in the base IRI', () => {
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

    describe('RFC3986 abnormal examples with trailing /. in the base IRI', () => {
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

    describe('RFC3986 normal examples with trailing /.. in the base IRI', () => {
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

    describe('RFC3986 abnormal examples with trailing /.. in the base IRI', () => {
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

    describe('RFC3986 normal examples with fragment in base IRI', () => {
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g:h',     'g:h');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g',       'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', './g',     'http://a/bb/ccc/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g/',      'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '/g',      'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '//g',     'http://g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '?y',      'http://a/bb/ccc/d;p?y');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g?y',     'http://a/bb/ccc/g?y');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '#s',      'http://a/bb/ccc/d;p?q#s');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g#s',     'http://a/bb/ccc/g#s');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g?y#s',   'http://a/bb/ccc/g?y#s');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', ';x',      'http://a/bb/ccc/;x');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g;x',     'http://a/bb/ccc/g;x');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g;x?y#s', 'http://a/bb/ccc/g;x?y#s');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '',        'http://a/bb/ccc/d;p?q');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '.',       'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', './',      'http://a/bb/ccc/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '..',      'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '../',     'http://a/bb/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '../g',    'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '../..',   'http://a/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '../../',  'http://a/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '../../g', 'http://a/g');
    });

    describe('RFC3986 abnormal examples with fragment in base IRI', () => {
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '../../../g',    'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '../../../../g', 'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '/./g',          'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '/../g',         'http://a/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g.',            'http://a/bb/ccc/g.');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '.g',            'http://a/bb/ccc/.g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g..',           'http://a/bb/ccc/g..');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', '..g',           'http://a/bb/ccc/..g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', './../g',        'http://a/bb/g');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', './g/.',         'http://a/bb/ccc/g/');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g/./h',         'http://a/bb/ccc/g/h');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g/../h',        'http://a/bb/ccc/h');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g;x=1/./y',     'http://a/bb/ccc/g;x=1/y');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g;x=1/../y',    'http://a/bb/ccc/y');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g?y/./x',       'http://a/bb/ccc/g?y/./x');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g?y/../x',      'http://a/bb/ccc/g?y/../x');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g#s/./x',       'http://a/bb/ccc/g#s/./x');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'g#s/../x',      'http://a/bb/ccc/g#s/../x');
      itShouldResolve('http://a/bb/ccc/d;p?q#f', 'http:g',        'http:g');
    });

    describe('RFC3986 normal examples with file path', () => {
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

    describe('RFC3986 abnormal examples with file path', () => {
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

    describe('additional cases', () => {
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

// Split string into all combinations possible
function splitAllWays(result, left, right, chunkSize) {
  // Push current left + right to the result list
  result.push(left.concat(right));

  // If we still have chars to work with in the right side then keep splitting
  if (right.length > 1) {
    // For each combination left/right split call splitAllWays()
    for (let i = chunkSize; i < right.length; i += chunkSize) {
      splitAllWays(result, left.concat(right.substring(0, i)), right.substring(i), chunkSize);
    }
  }

  // Return result
  return result;
}

// Return a large number of combinations for splitting the string to test chunking - anything with 5 or fewer
// characters will test every permutation of splits possible on the string
function getSplits(str) {
  return splitAllWays([], [], str, Math.max(Math.floor(str.length / 6), 1));
}

function shouldParseChunks(parser, input) {
  const expected = Array.prototype.slice.call(arguments, 1);
  // Shift parameters as necessary
  if (parser.call)
    expected.shift();
  else
    input = parser, parser = Parser;

  const items = expected.map(mapToQuad);

  return _shouldParseChunks(parser, input, items);
}

function _shouldParseChunks(parser, input, items) {
  return function (done) {
    const results2 = [];

    let onData, onEnd;
    new parser({ baseIRI: BASE_IRI }).parse({
      baseIRI: BASE_IRI,
      on: (event, callback) => {
        switch (event) {
        case 'data': onData = callback; break;
        case 'end':   onEnd = callback; break;
        }
      },
    },
  (error, triple) => {
    expect(error).not.to.exist;
    if (triple)
      results2.push(triple);
    else
      toSortedJSON(results2).should.equal(toSortedJSON(items)), done();
  }
  );

    for (const chunk of input) {
      onData(chunk);
    }

    onEnd();
  };
}

function shouldParse(parser, input) {
  return () => {
    const expected = Array.prototype.slice.call(arguments, 1);
    // Shift parameters as necessary
    if (parser.call)
      expected.shift();
    else
    input = parser, parser = Parser;

    const items = expected.map(mapToQuad);

    for (const chunk of [
      // Split at every character
      input.split(''),
      // Random splits
      ...getSplits(input),
      // Exactly one split in each position
      ...input.split('').map((_, i) => [input.slice(0, i), input.slice(i)]),
    ]
    // Ignore degenerate cases (for now)
    .filter(arr => arr.length > 0 && (arr.length !== 1 || arr[0] !== ''))
    ) {
      // it(`should run on chunking ${JSON.stringify(chunk)}`, _shouldParseChunks(parser, chunk, items));
    }

    it('should run on full string', done => {
    // Test parsing of whole string
      const results = [];
      new parser({ baseIRI: BASE_IRI }).parse(input, (error, triple) => {
        expect(error).not.to.exist;
        if (triple)
          results.push(triple);
        else
        toSortedJSON(results).should.equal(toSortedJSON(items)), done();
      });
    });
  };
}

function mapToQuad(item) {
  item = item.map(t => {
    // don't touch if it's already an object
    if (typeof t === 'object')
      // recursively map content if it's an array
      return (t instanceof Array) ? mapToQuad(t) : t;
    // Append base to relative IRIs
    else if (!/^$|^["?]|:/.test(t))
      t = BASE_IRI + t;
    return termFromId(t);
  });
  return new Quad(item[0], item[1], item[2], item[3]);
}

function toSortedJSON(triples) {
  triples = triples.map(t => {
    return JSON.stringify([
      t.subject && t.subject.toJSON(), t.predicate && t.predicate.toJSON(), t.object && t.object.toJSON(), t.graph && t.graph.toJSON(),
    ]);
  });
  triples.sort();
  return `[\n  ${triples.join('\n  ')}\n]`;
}

function shouldNotParse(parser, input, expectedError, expectedContext) {
  // Shift parameters if necessary
  if (!parser.call)
    expectedContext = expectedError, expectedError = input, input = parser, parser = Parser;

  return function (done) {
    new parser({ baseIRI: BASE_IRI }).parse(input, (error, triple) => {
      if (error) {
        expect(triple).not.to.exist;
        error.should.be.an.instanceof(Error);
        error.message.should.eql(expectedError);
        if (expectedContext) error.context.should.deep.equal(expectedContext);
        done();
      }
      else if (!triple)
        done(new Error(`Expected error ${expectedError}`));
    });
  };
}

function itShouldResolve(baseIRI, relativeIri, expected) {
  let result;
  describe(`resolving <${relativeIri}> against <${baseIRI}>`, () => {
    before(done => {
      try {
        const doc = `<urn:ex:s> <urn:ex:p> <${relativeIri}>.`;
        new Parser({ baseIRI }).parse(doc, (error, triple) => {
          if (done)
            result = triple, done(error);
          done = null;
        });
      }
      catch (error) { done(error); }
    });
    it(`should result in ${expected}`, () => {
      expect(result.object.value).to.equal(expected);
    });
  });
}

// creates an RDF list from the input
function list(...elems) {
  const arr = [];
  for (let i = 0; i < elems.length; i++) {
    arr.push(
      [elems[i][0], 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', elems[i][1]],
      [elems[i][0], 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', i + 1 === elems.length ? 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil' : elems[i + 1][0]]
    );
  }
  return arr;
}
