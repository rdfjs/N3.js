import { Parser, NamedNode, BlankNode, Quad, termFromId, DataFactory as DF } from '../src';
import rdfDataModel from '@rdfjs/data-model';
import { isomorphic } from 'rdf-isomorphic';

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
      expect(Parser).toBeInstanceOf(Function);
    });

    it('should be a Parser constructor', () => {
      expect(new Parser()).toBeInstanceOf(Parser);
    });
  });

  describe('A Parser instance', () => {
    it('should parse the empty string', shouldParse('',
                /* no triples */));

    it('should parse a whitespace string', shouldParse(' \t \n  ',
                /* no triples */));

    it('should parse a single triple', shouldParse('<a> <b> <c>.',
                ['a', 'b', 'c']));

    it(
      'should parse three triples',
      shouldParse('<a> <b> <c>.\n<d> <e> <f>.\n<g> <h> <i>.',
                  ['a', 'b', 'c'],
                  ['d', 'e', 'f'],
                  ['g', 'h', 'i']),
    );

    it(
      'should parse three triples with comments if no comment callback is set',
      shouldParse('<a> <b> #comment2\n <c> . \n<d> <e> <f>.\n<g> <h> <i>.',
                  ['a', 'b', 'c'],
                  ['d', 'e', 'f'],
                  ['g', 'h', 'i']),
    );

    it(
      'should callback comments when a comment allback is set',
      shouldCallbackComments('#comment1\n<a> <b> #comment2\n <c> . \n<d> <e> <f>.\n<g> <h> <i>.',
                  'comment1', 'comment2'),
    );

    it('should parse a triple with a literal', shouldParse('<a> <b> "string".',
                ['a', 'b', '"string"']));

    it(
      'should parse a triple with a numeric literal',
      shouldParse('<a> <b> 3.0.',
                  ['a', 'b', '"3.0"^^http://www.w3.org/2001/XMLSchema#decimal']),
    );

    it('should parse a triple with an integer literal', shouldParse('<a> <b> 3.',
                ['a', 'b', '"3"^^http://www.w3.org/2001/XMLSchema#integer']));

    it(
      'should parse a triple with a floating point literal',
      shouldParse('<a> <b> 1.3e2.',
                  ['a', 'b', '"1.3e2"^^http://www.w3.org/2001/XMLSchema#double']),
    );

    it(
      'should parse a triple with a boolean literal',
      shouldParse('<a> <b> true.',
                  ['a', 'b', '"true"^^http://www.w3.org/2001/XMLSchema#boolean']),
    );

    it(
      'should parse a triple with a literal and a language code',
      shouldParse('<a> <b> "string"@en.',
                  ['a', 'b', '"string"@en']),
    );

    it(
      'should normalize language codes to lowercase',
      shouldParse('<a> <b> "string"@EN.',
                  ['a', 'b', '"string"@en']),
    );

    it(
      'should parse a triple with a literal and an IRI type',
      shouldParse('<a> <b> "string"^^<type>.',
                  ['a', 'b', '"string"^^http://example.org/type']),
    );

    it(
      'should parse a triple with a literal and a prefixed name type',
      shouldParse('@prefix x: <urn:x:y#>. <a> <b> "string"^^x:z.',
                  ['a', 'b', '"string"^^urn:x:y#z']),
    );

    it(
      'should differentiate between IRI and prefixed name types',
      shouldParse('@prefix : <noturn:>. :a :b "x"^^<urn:foo>. :a :b "x"^^:urn:foo.',
                  ['noturn:a', 'noturn:b', '"x"^^urn:foo'],
                  ['noturn:a', 'noturn:b', '"x"^^noturn:urn:foo']),
    );

    it(
      'should not parse a triple with a literal and a prefixed name type with an inexistent prefix',
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
                     }),
    );

    it(
      'should parse a triple with the "a" shorthand predicate',
      shouldParse('<a> a <t>.',
                  ['a', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 't']),
    );

    it('should parse triples with prefixes', shouldParse('@prefix : <#>.\n' +
                '@prefix a: <a#>.\n' +
                ':x a:a a:b.',
                ['#x', 'a#a', 'a#b']));

    it(
      'should parse triples with the prefix "prefix"',
      shouldParse('@prefix prefix: <http://prefix.cc/>.' +
                  'prefix:a prefix:b prefix:c.',
                  ['http://prefix.cc/a', 'http://prefix.cc/b', 'http://prefix.cc/c']),
    );

    it(
      'should parse triples with the prefix "base"',
      shouldParse('PREFIX base: <http://prefix.cc/>' +
                  'base:a base:b base:c.',
                  ['http://prefix.cc/a', 'http://prefix.cc/b', 'http://prefix.cc/c']),
    );

    it(
      'should parse triples with the prefix "graph"',
      shouldParse('PREFIX graph: <http://prefix.cc/>' +
                  'graph:a graph:b graph:c.',
                  ['http://prefix.cc/a', 'http://prefix.cc/b', 'http://prefix.cc/c']),
    );

    it('should not parse @PREFIX', shouldNotParse('@PREFIX : <#>.',
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

    it(
      'should parse triples with prefixes and different punctuation',
      shouldParse('@prefix : <#>.\n' +
                  '@prefix a: <a#>.\n' +
                  ':x a:a a:b;a:c a:d,a:e.',
                  ['#x', 'a#a', 'a#b'],
                  ['#x', 'a#c', 'a#d'],
                  ['#x', 'a#c', 'a#e']),
    );

    it(
      'should not parse undefined empty prefix in subject',
      shouldNotParse(':a ',
                     'Undefined prefix ":" on line 1.'),
    );

    it('should not parse undefined prefix in subject', shouldNotParse('a:a ',
                   'Undefined prefix "a:" on line 1.'));

    it(
      'should not parse undefined prefix in predicate',
      shouldNotParse('<a> b:c ',
                     'Undefined prefix "b:" on line 1.'),
    );

    it(
      'should not parse undefined prefix in object',
      shouldNotParse('<a> <b> c:d ',
                     'Undefined prefix "c:" on line 1.'),
    );

    it(
      'should not parse undefined prefix in datatype',
      shouldNotParse('<a> <b> "c"^^d:e ',
                     'Undefined prefix "d:" on line 1.'),
    );

    it(
      'should parse triples with SPARQL prefixes',
      shouldParse('PREFIX : <#>\n' +
                  'PrEfIX a: <a#> ' +
                  ':x a:a a:b.',
                  ['#x', 'a#a', 'a#b']),
    );

    it(
      'should not parse prefix declarations without prefix',
      shouldNotParse('@prefix <a> ',
                     'Expected prefix to follow @prefix on line 1.'),
    );

    it(
      'should not parse prefix declarations without IRI',
      shouldNotParse('@prefix : .',
                     'Expected IRI to follow prefix ":" on line 1.'),
    );

    it(
      'should not parse prefix declarations without a dot',
      shouldNotParse('@prefix : <a> ;',
                     'Expected declaration to end with a dot on line 1.'),
    );

    it(
      'should parse statements with shared subjects',
      shouldParse('<a> <b> <c>;\n<d> <e>.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']),
    );

    it(
      'should parse statements with shared subjects and trailing semicolon',
      shouldParse('<a> <b> <c>;\n<d> <e>;\n.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']),
    );

    it(
      'should parse statements with shared subjects and multiple semicolons',
      shouldParse('<a> <b> <c>;;\n<d> <e>.',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e']),
    );

    it(
      'should parse statements with shared subjects and predicates',
      shouldParse('<a> <b> <c>, <d>.',
                  ['a', 'b', 'c'],
                  ['a', 'b', 'd']),
    );

    it(
      'should not accept ; without preceding predicate',
      shouldNotParse('<a> <b> <c>. <x>; <y> <z>.',
                     'Expected predicate but got ; on line 1.'),
    );

    it(
      'should not accept , without preceding object',
      shouldNotParse('<a> <b> <c>. <x> <y>, <z>.',
                     'Expected entity but got , on line 1.'),
    );

    it('should parse diamonds', shouldParse('<> <> <> <>.\n(<>) <> (<>) <>.',
                [BASE_IRI, BASE_IRI, BASE_IRI, BASE_IRI],
                ['_:b0', BASE_IRI, '_:b1', BASE_IRI],
                ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', BASE_IRI],
                ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', BASE_IRI],
                ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it(
      'should parse statements with named blank nodes',
      shouldParse('_:a <b> _:c.',
                  ['_:b0_a', 'b', '_:b0_c']),
    );

    it(
      'should not parse statements with a blank node as predicate',
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
                     }),
    );

    it(
      'should not parse statements with a blank node label as predicate',
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
                     }),
    );

    it(
      'should parse statements with empty blank nodes',
      shouldParse('[] <b> [].',
                  ['_:b0', 'b', '_:b1']),
    );

    it(
      'should parse statements with unnamed blank nodes in the subject',
      shouldParse('[<a> <b>] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', 'b']),
    );

    it(
      'should parse statements with unnamed blank nodes in the object',
      shouldParse('<a> <b> [<c> <d>].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', 'd']),
    );

    it(
      'should parse statements with unnamed blank nodes with a string object',
      shouldParse('<a> <b> [<c> "x"].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '"x"']),
    );

    it(
      'should not parse a blank node with missing subject',
      shouldNotParse('<a> <b> [<c>].',
                     'Expected entity but got ] on line 1.'),
    );

    it(
      'should not parse a blank node with only a semicolon',
      shouldNotParse('<a> <b> [;].',
                     'Expected predicate but got ; on line 1.'),
    );

    it(
      'should not parse a dangling blank node closing brace',
      shouldNotParse('<a:a> <b:b> <c:c> ; ]',
                     'Unexpected ] on line 1.'),
    );

    it(
      'should parse a blank node with a trailing semicolon',
      shouldParse('<a> <b> [ <u> <v>; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v']),
    );

    it(
      'should parse a blank node with multiple trailing semicolons',
      shouldParse('<a> <b> [ <u> <v>;;; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v']),
    );

    it(
      'should parse a multi-predicate blank node',
      shouldParse('<a> <b> [ <u> <v>; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']),
    );

    it(
      'should parse a multi-predicate blank node with multiple semicolons',
      shouldParse('<a> <b> [ <u> <v>;;; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']),
    );

    it(
      'should parse a multi-object blank node',
      shouldParse('<a> <b> [ <u> <v>, <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'u', 'z']),
    );

    it(
      'should parse a multi-statement blank node ending with a literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z" ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"']),
    );

    it(
      'should parse a multi-statement blank node ending with a typed literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^http://example.org/t']),
    );

    it(
      'should parse a multi-statement blank node ending with a string with language',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^http://example.org/t']),
    );

    it(
      'should parse a multi-statement blank node with trailing semicolon',
      shouldParse('<a> <b> [ <u> <v>; <w> <z>; ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']),
    );

    it(
      'should parse statements with nested blank nodes in the subject',
      shouldParse('[<a> [<x> <y>]] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'x', 'y']),
    );

    it(
      'should parse statements with nested blank nodes in the object',
      shouldParse('<a> <b> [<c> [<d> <e>]].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'c', '_:b1'],
                  ['_:b1', 'd', 'e']),
    );

    it(
      'should reuse identifiers of blank nodes within and outside of graphs',
      shouldParse('_:a <b> _:c. <g> { _:a <b> _:c }',
                  ['_:b0_a', 'b', '_:b0_c'],
                  ['_:b0_a', 'b', '_:b0_c', 'g']),
    );

    it('should not parse an invalid blank node', shouldNotParse('[ <a> <b> .',
                   'Expected punctuation to follow "http://example.org/b" on line 1.'));

    it(
      'should parse a statements with only an anonymous node',
      shouldParse('[<p> <o>].',
                  ['_:b0', 'p', 'o']),
    );

    it(
      'should not parse a statement with only a blank anonymous node',
      shouldNotParse('[].',
                     'Unexpected . on line 1.'),
    );

    it(
      'should not parse an anonymous node with only an anonymous node inside',
      shouldNotParse('[[<p> <o>]].',
                     'Disallowed blank node as predicate on line 1.'),
    );

    it(
      'should parse statements with an empty list in the subject',
      shouldParse('() <a> <b>.',
                  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'a', 'b']),
    );

    it(
      'should parse statements with an empty list in the object',
      shouldParse('<a> <b> ().',
                  ['a', 'b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a single-element list in the subject',
      shouldParse('(<x>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a single-element list in the object',
      shouldParse('<a> <b> (<x>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it('should parse a list with a literal', shouldParse('<a> <b> ("x").',
                ['a', 'b', '_:b0'],
                ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"'],
                ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']));

    it(
      'should parse a list with a typed literal',
      shouldParse('<a> <b> ("x"^^<y>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"^^http://example.org/y'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse a list with a language-tagged literal',
      shouldParse('<a> <b> ("x"@en-GB).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"@en-gb'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a multi-element list in the subject',
      shouldParse('(<x> <y>) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a multi-element list in the object',
      shouldParse('<a> <b> (<x> <y>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a multi-element literal list in the object',
      shouldParse('<a> <b> ("x" "y"@en-GB 1 "z"^^<t>).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"x"'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"y"@en-gb'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"1"^^http://www.w3.org/2001/XMLSchema#integer'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '"z"^^http://example.org/t'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with prefixed names in lists',
      shouldParse('@prefix a: <a#>. <a> <b> (a:x a:y).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a#x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a#y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should not parse statements with undefined prefixes in lists',
      shouldNotParse('<a> <b> (a:x a:y).',
                     'Undefined prefix "a:" on line 1.'),
    );

    it(
      'should parse statements with blank nodes in lists',
      shouldParse('<a> <b> (_:x _:y).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b0_x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b0_y'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a nested empty list',
      shouldParse('<a> <b> (<x> ()).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with non-empty nested lists',
      shouldParse('<a> <b> (<x> (<y>)).',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a list containing a blank node',
      shouldParse('([]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it(
      'should parse statements with a list containing multiple blank nodes',
      shouldParse('([] [<x> <y>]) <a> <b>.',
                  ['_:b0', 'a', 'b'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b3'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b3', 'x', 'y']),
    );

    it(
      'should parse statements with a blank node containing a list',
      shouldParse('[<a> (<b>)] <c> <d>.',
                  ['_:b0', 'c', 'd'],
                  ['_:b0', 'a', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it('should not parse an invalid list', shouldNotParse('<a> <b> (]).',
                   'Expected entity but got ] on line 1.'));

    it(
      'should resolve IRIs against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> <c>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']),
    );

    it(
      'should not resolve IRIs against @BASE',
      shouldNotParse('@BASE <http://ex.org/>.',
                     'Expected entity but got @BASE on line 1.'),
    );

    it(
      'should resolve IRIs against SPARQL base',
      shouldParse('BASE <http://ex.org/>\n' +
                  '<a> <b> <c>. ' +
                  'BASE <d/> ' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']),
    );

    it(
      'should resolve IRIs against a @base with query string',
      shouldParse('@base <http://ex.org/?foo>.\n' +
                  '<> <b> <c>.\n' +
                  '@base <d/?bar>.\n' +
                  '<> <f> <g>.',
                  ['http://ex.org/?foo', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/?bar', 'http://ex.org/d/f', 'http://ex.org/d/g']),
    );

    it(
      'should resolve IRIs with query string against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<?> <?a> <?a=b>.\n' +
                  '@base <d>.\n' +
                  '<?> <?a> <?a=b>.' +
                  '@base <?e>.\n' +
                  '<> <?a> <?a=b>.',
                  ['http://ex.org/?', 'http://ex.org/?a', 'http://ex.org/?a=b'],
                  ['http://ex.org/d?', 'http://ex.org/d?a', 'http://ex.org/d?a=b'],
                  ['http://ex.org/d?e', 'http://ex.org/d?a', 'http://ex.org/d?a=b']),
    );

    it(
      'should not resolve IRIs with colons',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a>   <b>   <c>.\n' +
                  '<A:>  <b:>  <c:>.\n' +
                  '<a:a> <b:B> <C-D:c>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['A:',  'b:',  'c:'],
                  ['a:a', 'b:B', 'C-D:c']),
    );

    it(
      'should not allow relative URIs with a colon in the first path segment',
      shouldNotParse('<entity.beeldbank_leiden_person:A.E._Stuur.> <x:x> <x:x> .',
                     'Invalid IRI on line 1.'),
    );

    it(
      'should not allow relative URIs with a colon in the first path segment as base',
      shouldNotParse('@base <entity.beeldbank_leiden_person:A.E._Stuur.> .',
                     'Expected valid IRI to follow base declaration on line 1.'),
    );

    it(
      'should resolve datatype IRIs against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> "c"^^<d>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> "g"^^<h>.',
                  ['http://ex.org/a', 'http://ex.org/b', '"c"^^http://ex.org/d'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', '"g"^^http://ex.org/d/h']),
    );

    it(
      'should resolve IRIs against a base with a fragment',
      shouldParse('@base <http://ex.org/foo#bar>.\n' +
                  '<a> <b> <#c>.\n',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/foo#c']),
    );

    it(
      'should resolve IRIs with an empty fragment',
      shouldParse('@base <http://ex.org/foo>.\n' +
                  '<#> <b#> <#c>.\n',
                  ['http://ex.org/foo#', 'http://ex.org/b#', 'http://ex.org/foo#c']),
    );

    it(
      'should not resolve prefixed names',
      shouldParse('PREFIX ex: <http://ex.org/a/bb/ccc/../>\n' +
                  'ex:a ex:b ex:c .',
                  ['http://ex.org/a/bb/ccc/../a', 'http://ex.org/a/bb/ccc/../b', 'http://ex.org/a/bb/ccc/../c']),
    );

    it('should parse an empty default graph', shouldParse('{}'));

    it(
      'should parse a one-triple default graph ending without a dot',
      shouldParse('{<a> <b> <c>}',
                  ['a', 'b', 'c']),
    );

    it(
      'should parse a one-triple default graph ending with a dot',
      shouldParse('{<a> <b> <c>.}',
                  ['a', 'b', 'c']),
    );

    it(
      'should parse a three-triple default graph ending without a dot',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']),
    );

    it(
      'should parse a three-triple default graph ending with a dot',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']),
    );

    it(
      'should parse a three-triple default graph ending with a semicolon',
      shouldParse('{<a> <b> <c>;<d> <e>,<f>;}',
                  ['a', 'b', 'c'],
                  ['a', 'd', 'e'],
                  ['a', 'd', 'f']),
    );

    it(
      'should parse a default graph with a blank node ending with a dot',
      shouldParse('{ [<p> <o>]. }',
                  ['_:b0', 'p', 'o']),
    );

    it(
      'should parse a default graph with a blank node ending without a dot',
      shouldParse('{ [<p> <o>] }',
                  ['_:b0', 'p', 'o']),
    );

    it('should parse an empty named graph with an IRI', shouldParse('<g>{}'));

    it(
      'should parse a one-triple named graph with an IRI ending without a dot',
      shouldParse('<g> {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g']),
    );

    it(
      'should parse a one-triple named graph with an IRI ending with a dot',
      shouldParse('<g>{<a> <b> <c>.}',
                  ['a', 'b', 'c', 'g']),
    );

    it(
      'should parse a three-triple named graph with an IRI ending without a dot',
      shouldParse('<g> {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', 'g'],
                  ['a', 'd', 'e', 'g'],
                  ['a', 'd', 'f', 'g']),
    );

    it(
      'should parse a three-triple named graph with an IRI ending with a dot',
      shouldParse('<g>{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', 'g'],
                  ['a', 'd', 'e', 'g'],
                  ['a', 'd', 'f', 'g']),
    );

    it(
      'should parse an empty named graph with a prefixed name',
      shouldParse('@prefix g: <g#>.\ng:h {}'),
    );

    it(
      'should parse a one-triple named graph with a prefixed name ending without a dot',
      shouldParse('@prefix g: <g#>.\ng:h {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g#h']),
    );

    it(
      'should parse a one-triple named graph with a prefixed name ending with a dot',
      shouldParse('@prefix g: <g#>.\ng:h{<a> <b> <c>.}',
                  ['a', 'b', 'c', 'g#h']),
    );

    it(
      'should parse a three-triple named graph with a prefixed name ending without a dot',
      shouldParse('@prefix g: <g#>.\ng:h {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', 'g#h'],
                  ['a', 'd', 'e', 'g#h'],
                  ['a', 'd', 'f', 'g#h']),
    );

    it(
      'should parse a three-triple named graph with a prefixed name ending with a dot',
      shouldParse('@prefix g: <g#>.\ng:h{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', 'g#h'],
                  ['a', 'd', 'e', 'g#h'],
                  ['a', 'd', 'f', 'g#h']),
    );

    it(
      'should parse a named graph with a blank node ending with a dot',
      shouldParse('<g> { [<p> <o>]. }',
                  ['_:b0', 'p', 'o', 'g']),
    );

    it(
      'should parse a named graph with a blank node ending without a dot',
      shouldParse('<g> { [<p> <o>] }',
                  ['_:b0', 'p', 'o', 'g']),
    );

    it('should parse an empty anonymous graph', shouldParse('[] {}'));

    it(
      'should parse a one-triple anonymous graph ending without a dot',
      shouldParse('[] {<a> <b> <c>}',
                  ['a', 'b', 'c', '_:b0']),
    );

    it(
      'should parse a one-triple anonymous graph ending with a dot',
      shouldParse('[]{<a> <b> <c>.}',
                  ['a', 'b', 'c', '_:b0']),
    );

    it(
      'should parse a three-triple anonymous graph ending without a dot',
      shouldParse('[] {<a> <b> <c>;<d> <e>,<f>}',
                  ['a', 'b', 'c', '_:b0'],
                  ['a', 'd', 'e', '_:b0'],
                  ['a', 'd', 'f', '_:b0']),
    );

    it(
      'should parse a three-triple anonymous graph ending with a dot',
      shouldParse('[]{<a> <b> <c>;<d> <e>,<f>.}',
                  ['a', 'b', 'c', '_:b0'],
                  ['a', 'd', 'e', '_:b0'],
                  ['a', 'd', 'f', '_:b0']),
    );

    it(
      'should parse an empty named graph with an IRI and the GRAPH keyword',
      shouldParse('GRAPH <g> {}'),
    );

    it(
      'should parse an empty named graph with a prefixed name and the GRAPH keyword',
      shouldParse('@prefix g: <g#>.\nGRAPH g:h {}'),
    );

    it(
      'should parse an empty anonymous graph and the GRAPH keyword',
      shouldParse('GRAPH [] {}'),
    );

    it(
      'should parse a one-triple named graph with an IRI and the GRAPH keyword',
      shouldParse('GRAPH <g> {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g']),
    );

    it(
      'should parse a one-triple named graph with a prefixed name and the GRAPH keyword',
      shouldParse('@prefix g: <g#>.\nGRAPH g:h {<a> <b> <c>}',
                  ['a', 'b', 'c', 'g#h']),
    );

    it(
      'should parse a one-triple anonymous graph and the GRAPH keyword',
      shouldParse('GRAPH [] {<a> <b> <c>}',
                  ['a', 'b', 'c', '_:b0']),
    );

    it(
      'should parse a graph with 8-bit unicode escape sequences',
      shouldParse('<\\U0001d400> {\n<\\U0001d400> <\\U0001d400> "\\U0001d400"^^<\\U0001d400>\n}\n',
                  ['\ud835\udC00', '\ud835\udc00', '"\ud835\udc00"^^http://example.org/\ud835\udc00', '\ud835\udc00']),
    );

    it('should not parse a single closing brace', shouldNotParse('}',
                   'Unexpected graph closing on line 1.'));

    it('should not parse a single opening brace', shouldNotParse('{',
                   'Unexpected "{" on line 1.'));

    it('should not parse a superfluous closing brace ', shouldNotParse('{}}',
                   'Unexpected graph closing on line 1.'));

    it('should not parse a graph with only a dot', shouldNotParse('{.}',
                   'Expected entity but got . on line 1.'));

    it('should not parse a graph with only a semicolon', shouldNotParse('{;}',
                   'Expected entity but got ; on line 1.'));

    it('should not parse an unclosed graph', shouldNotParse('{<a> <b> <c>.',
                   'Unclosed graph on line 1.'));

    it(
      'should not parse a named graph with a list node as label',
      shouldNotParse('() {}',
                     'Expected entity but got { on line 1.'),
    );

    it(
      'should not parse a named graph with a non-empty blank node as label',
      shouldNotParse('[<a> <b>] {}',
                     'Expected entity but got { on line 1.'),
    );

    it(
      'should not parse a named graph with the GRAPH keyword and a non-empty blank node as label',
      shouldNotParse('GRAPH [<a> <b>] {}',
                     'Invalid graph label on line 1.'),
    );

    it(
      'should not parse a triple after the GRAPH keyword',
      shouldNotParse('GRAPH <a> <b> <c>.',
                     'Expected graph but got IRI on line 1.'),
    );

    it(
      'should not parse repeated GRAPH keywords',
      shouldNotParse('GRAPH GRAPH <g> {}',
                     'Invalid graph label on line 1.'),
    );

    it('should parse a quad with 4 IRIs', shouldParse('<a> <b> <c> <g>.',
                ['a', 'b', 'c', 'g']));

    it(
      'should parse a quad with 4 prefixed names',
      shouldParse('@prefix p: <p#>.\np:a p:b p:c p:g.',
                  ['p#a', 'p#b', 'p#c', 'p#g']),
    );

    it(
      'should not parse a quad with an undefined prefix',
      shouldNotParse('<a> <b> <c> p:g.',
                     'Undefined prefix "p:" on line 1.'),
    );

    it(
      'should parse a quad with 3 IRIs and a literal',
      shouldParse('<a> <b> "c"^^<d> <g>.',
                  ['a', 'b', '"c"^^http://example.org/d', 'g']),
    );

    it(
      'should parse a quad with 2 blank nodes and a literal',
      shouldParse('_:a <b> "c"^^<d> _:g.',
                  ['_:b0_a', 'b', '"c"^^http://example.org/d', '_:b0_g']),
    );

    it('should not parse a quad in a graph', shouldNotParse('{<a> <b> <c> <g>.}',
                   'Expected punctuation to follow "http://example.org/c" on line 1.'));

    it(
      'should not parse a quad with different punctuation',
      shouldNotParse('<a> <b> <c> <g>;',
                     'Expected dot to follow quad on line 1.'),
    );

    it(
      'should not parse base declarations without IRI',
      shouldNotParse('@base a: ',
                     'Expected valid IRI to follow base declaration on line 1.'),
    );

    it(
      'should not parse improperly nested parentheses and brackets',
      shouldNotParse('<a> <b> [<c> (<d>]).',
                     'Expected entity but got ] on line 1.'),
    );

    it(
      'should not parse improperly nested square brackets',
      shouldNotParse('<a> <b> [<c> <d>]].',
                     'Expected entity but got ] on line 1.'),
    );

    it('should error when an object is not there', shouldNotParse('<a> <b>.',
                   'Expected entity but got . on line 1.'));

    it('should error when a dot is not there', shouldNotParse('<a> <b> <c>',
                   'Expected entity but got eof on line 1.'));

    it(
      'should error with an abbreviation in the subject',
      shouldNotParse('a <a> <a>.',
                     'Expected entity but got abbreviation on line 1.'),
    );

    it(
      'should error with an abbreviation in the object',
      shouldNotParse('<a> <a> a .',
                     'Expected entity but got abbreviation on line 1.'),
    );

    it('should error if punctuation follows a subject', shouldNotParse('<a> .',
                   'Unexpected . on line 1.'));

    it(
      'should error if an unexpected token follows a subject',
      shouldNotParse('<a> @',
                     'Unexpected "@" on line 1.'),
      {
        token: {
          line: 1,
          type: '@PREFIX',
          value: '',
          prefix: '',
        },
        previousToken: undefined,
        line: 1,
      },
    );

    it('should not error if there is no triple callback', () => {
      new Parser().parse('');
    });

    it('should return prefixes through a callback', done => {
      const prefixes = {};
      new Parser().parse('@prefix a: <http://a.org/#>. a:a a:b a:c. @prefix b: <http://b.org/#>.',
                           tripleCallback, prefixCallback);

      function tripleCallback(error, triple) {
        expect(error).toBeFalsy();
        if (!triple) {
          expect(Object.keys(prefixes)).toHaveLength(2);
          expect(prefixes).toHaveProperty('a');
          expect(prefixes.a).toEqual(new NamedNode('http://a.org/#'));
          expect(prefixes).toHaveProperty('b');
          expect(prefixes.b).toEqual(new NamedNode('http://b.org/#'));
          done();
        }
      }

      function prefixCallback(prefix, iri) {
        expect(prefix).toBeDefined();
        expect(iri).toBeDefined();
        prefixes[prefix] = iri;
      }
    });

    it(
      'should return prefixes through a callback without triple callback',
      done => {
        const prefixes = {};
        new Parser().parse('@prefix a: <IRIa>. a:a a:b a:c. @prefix b: <IRIb>.',
                             null, prefixCallback);

        function prefixCallback(prefix, iri) {
          expect(prefix).toBeDefined();
          expect(iri).toBeDefined();
          prefixes[prefix] = iri;
          if (Object.keys(prefixes).length === 2)
            done();
        }
      },
    );

    it('should return prefixes at the last triple callback', done => {
      new Parser({ baseIRI: BASE_IRI })
        .parse('@prefix a: <IRIa>. a:a a:b a:c. @prefix b: <IRIb>.', tripleCallback);

      function tripleCallback(error, triple, prefixes) {
        expect(error).toBeFalsy();
        if (triple)
          expect(prefixes).toBeFalsy();
        else {
          expect(prefixes).toBeDefined();
          expect(Object.keys(prefixes)).toHaveLength(2);
          expect(prefixes).toHaveProperty('a', 'http://example.org/IRIa');
          expect(prefixes).toHaveProperty('b', 'http://example.org/IRIb');
          done();
        }
      }
    });

    it('should parse a string synchronously if no callback is given', () => {
      const triples = new Parser().parse('@prefix a: <urn:a:>. a:a a:b a:c.');
      expect(triples).toEqual([
        new Quad(termFromId('urn:a:a'), termFromId('urn:a:b'),
                 termFromId('urn:a:c'), termFromId('')),
      ]);
    });

    it('should throw on syntax errors if no callback is given', () => {
      expect((() => { new Parser().parse('<a> bar <c>'); })).toThrowError('Unexpected "bar" on line 1.');
    });

    it('should throw on grammar errors if no callback is given', () => {
      expect((() => { new Parser().parse('<a> <b> <c>'); })).toThrow('Expected entity but got eof on line 1');
    });

    it(
      'should parse an RDF-star triple with a triple with iris as subject correctly',
      () => {
        shouldParse('<<<a> <b> <c>>> <b> <c>.',
          [['a', 'b', 'c'], 'b', 'c']);
      },
    );

    it(
      'should not parse an RDF-star triple with a triple as predicate',
      shouldNotParse('<a> <<<b> <c> <d>>> <e>',
        'Expected entity but got << on line 1.'),
    );

    it(
      'should parse an RDF-star triple with a triple with blanknodes as subject correctly',
      shouldParse('<<_:a <b> _:c>> <b> <c>.',
        [['_:b0_a', 'b', '_:b0_c'], 'b', 'c']),
    );

    it(
      'should parse an RDF-star triple with a triple with blanknodes and literals as subject correctly',
      shouldParse('<<_:a <b> "c"^^<d>>> <b> <c>.',
        [['_:b0_a', 'b', '"c"^^http://example.org/d'], 'b', 'c']),
    );

    it(
      'should parse an RDF-star triple with a triple as object correctly',
      shouldParse('<a> <b> <<<a> <b> <c>>>.',
        ['a', 'b', ['a', 'b', 'c']]),
    );

    it(
      'should parse an RDF-star triple with a triple as object correctly',
      shouldParse('<a> <b> <<_:a <b> _:c>>.',
        ['a', 'b', ['_:b0_a', 'b', '_:b0_c']]),
    );

    it(
      'should parse an RDF-star triple with a triple as object correctly',
      shouldParse('<a> <b> <<_:a <b> "c"^^<d>>>.',
        ['a', 'b', ['_:b0_a', 'b', '"c"^^http://example.org/d']]),
    );

    it(
      'should parse nested triples correctly',
      shouldParse('<<<<<a> <b> <c>>> <f> <g>>> <d> <e>.',
        [[['a', 'b', 'c'], 'f', 'g'], 'd', 'e']),
    );
    it(
      'should parse nested triples correctly',
      shouldParse('<d> <e> <<<f> <g> <<<a> <b> <c>>>>>.',
        ['d', 'e', ['f', 'g', ['a', 'b', 'c']]]),
    );
    it(
      'should parse nested triples correctly',
      shouldParse('<<<f> <g> <<<a> <b> <c>>>>> <d> <e>.',
        [['f', 'g', ['a', 'b', 'c']], 'd', 'e']),
    );
    it(
      'should parse nested triples correctly',
      shouldParse('<d> <e> <<<<<a> <b> <c>>> <f> <g>>>.',
        ['d', 'e', [['a', 'b', 'c'], 'f', 'g']]),
    );

    it(
      'should not parse nested RDF-star statements that are partially closed',
      shouldNotParse('<d> <e> <<<<<a> <b> <c>>> <f> <g>.',
        'Expected entity but got . on line 1.',
      ),
    );

    it(
      'should not parse partially closed nested RDF-star statements',
      shouldNotParse('<d> <e> <<<<<a> <b> <c> <f> <g>>>.',
        'Expected >> but got IRI on line 1.',
      ),
    );

    it(
      'should not parse nested RDF-star statements with too many closing tags',
      shouldNotParse('<d> <e> <<<<<a> <b> <c>>>>> <f> <g>>>.',
        'Expected entity but got >> on line 1.',
      ),
    );

    it(
      'should not parse nested RDF-star statements with too many closing tags',
      shouldNotParse('<d> <e> <<<<<a> <b> <c>>> <f> <g>>>>>.',
        'Expected entity but got >> on line 1.',
      ),
    );

    it(
      'should not parse RDF-star statements with too many closing tags',
      shouldNotParse('<a> <b> <c>>>.',
        'Expected entity but got >> on line 1.',
      ),
    );

    it(
      'should not parse incomplete RDF-star statements',
      shouldNotParse('<d> <e> <<<a> <b>>>.',
        'Expected entity but got >> on line 1.',
      ),
    );

    it(
      'should not parse incomplete RDF-star statements',
      shouldNotParse('<<<a> <b>>> <d> <e>.',
        'Expected entity but got >> on line 1.',
      ),
    );

    it(
      'should not parse incorrectly nested RDF-star statements',
      shouldNotParse('>> <<',
        'Expected entity but got >> on line 1.',
      ),
    );

    it(
      'should not parse a nested triple on its own',
      shouldNotParse('<<<a> <b> <c>>>.',
        'Unexpected . on line 1.',
      ),
    );

    it('should parse an RDF-star quad', shouldParse('<<<a> <b> <c> <d>>> <a> <b> .',
      [['a', 'b', 'c', 'd'], 'a', 'b']));

    it(
      'should not parse a malformed RDF-star quad',
      shouldNotParse('<<<a> <b> <c> <d> <e>>> <a> <b> .',
        'Expected >> but got IRI on line 1.'),
    );

    it(
      'should parse statements with a shared RDF-star subject',
      shouldParse('<<<a> <b> <c>>> <b> <c>;\n<d> <c>.',
        [['a', 'b', 'c'], 'b', 'c'],
        [['a', 'b', 'c'], 'd', 'c']),
    );

    it(
      'should parse statements with a shared RDF-star subject',
      shouldParse('<<<a> <b> <c>>> <b> <c>;\n<d> <<<a> <b> <c>>>.',
        [['a', 'b', 'c'], 'b', 'c'],
        [['a', 'b', 'c'], 'd', ['a', 'b', 'c']]),
    );

    it(
      'should put nested triples in the default graph',
      shouldParse('<a> <b> <c> <g>.\n<<<a> <b> <c>>> <d> <e>.',
          ['a', 'b', 'c', 'g'],
          [['a', 'b', 'c'], 'd', 'e']),
    );

    it(
      'should parse an RDF-star triple using annotation syntax with one predicate-object',
      shouldParse('<a> <b> <c> {| <b> <c> |}.',
          ['a', 'b', 'c'], [['a', 'b', 'c'], 'b', 'c']),
    );

    it(
      'should parse an RDF-star triple using annotation syntax with two predicate-objects',
      shouldParse('<a> <b> <c> {| <b1> <c1>; <b2> <c2> |}.',
          ['a', 'b', 'c'], [['a', 'b', 'c'], 'b1', 'c1'], [['a', 'b', 'c'], 'b2', 'c2']),
    );

    it(
      'should parse an RDF-star triple using annotation syntax with one predicate-object followed by regular triples',
      shouldParse('<a> <b> <c> {| <b> <c> |}.\n<a2> <b2> <c2>.',
          ['a', 'b', 'c'], [['a', 'b', 'c'], 'b', 'c'], ['a2', 'b2', 'c2']),
    );

    it(
      'should not parse an RDF-star triple using annotation syntax with zero predicate-objects',
      shouldNotParse('<a> <b> <c> {| |}',
          'Expected entity but got |} on line 1.'),
    );

    it(
      'should not parse an RDF-star triple using an incomplete annotation syntax',
      shouldNotParse('<a> <b> <c> {| <b> |}',
          'Expected entity but got |} on line 1.'),
    );

    it(
      'should not parse an RDF-star triple using an incomplete annotation syntax after a semicolon',
      shouldNotParse('<a> <b> <c> {| <b1> <c1>; |}',
          'Expected entity but got |} on line 1.'),
    );

    it(
      'should not parse an RDF-star triple using an incomplete annotation syntax after a semicolon and entity',
      shouldNotParse('<a> <b> <c> {| <b1> <c1>; <b2> |}',
          'Expected entity but got |} on line 1.'),
    );

    it(
      'should not parse an RDF-star triple using an incomplete annotation syntax that misses |}',
      shouldNotParse('<a> <b> <c> {| <b1> <c1>',
          'Expected entity but got eof on line 1.'),
    );

    it(
      'should not parse an RDF-star triple using an incomplete annotation syntax that misses |} and starts a new subject',
      shouldNotParse('<a> <b> <c> {| <b1> <c1>. <a2> <b2> <c2>',
          'Expected entity but got eof on line 1.'),
    );

    it('should not parse an out of place |}', shouldNotParse('<a> <b> <c> |}',
        'Unexpected asserted triple closing on line 1.'));
  });

  describe('An Parser instance without document IRI', () => {
    function parser() { return new Parser(); }

    it('should keep relative IRIs', shouldParse(parser,
      '@prefix : <#>.\n' +
      '<a> <b> <c> <g>.\n' +
      ':d :e :f :g.',
      [termFromId('a'), termFromId('b'), termFromId('c'), termFromId('g')],
      [termFromId('#d'), termFromId('#e'), termFromId('#f'), termFromId('#g')]));

    it('should keep empty IRIs', shouldParse(parser,
      '@prefix : <>.\n' +
      '<> <> <> <>.\n' +
      ': : : :.',
      [new NamedNode(''), new NamedNode(''), new NamedNode(''), new NamedNode('')],
      [new NamedNode(''), new NamedNode(''), new NamedNode(''), new NamedNode('')]));
  });

  describe('An Parser instance with a document IRI', () => {
    function parser() { return new Parser({ baseIRI: 'http://ex.org/x/yy/zzz/f.ttl' }); }

    it('should resolve IRIs against the document IRI', shouldParse(parser,
                '@prefix : <#>.\n' +
                '<a> <b> <c> <g>.\n' +
                ':d :e :f :g.',
                ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/b', 'http://ex.org/x/yy/zzz/c', 'http://ex.org/x/yy/zzz/g'],
                ['http://ex.org/x/yy/zzz/f.ttl#d', 'http://ex.org/x/yy/zzz/f.ttl#e', 'http://ex.org/x/yy/zzz/f.ttl#f', 'http://ex.org/x/yy/zzz/f.ttl#g']));

    it(
      'should resolve IRIs with a trailing slash against the document IRI',
      shouldParse(parser,
                  '</a> </a/b> </a/b/c>.\n',
                  ['http://ex.org/a', 'http://ex.org/a/b', 'http://ex.org/a/b/c']),
    );

    it(
      'should resolve IRIs starting with ./ against the document IRI',
      shouldParse(parser,
                  '<./a> <./a/b> <./a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/a/b', 'http://ex.org/x/yy/zzz/a/b/c']),
    );

    it(
      'should resolve IRIs starting with multiple ./ sequences against the document IRI',
      shouldParse(parser,
                  '<./././a> <./././././a/b> <././././././a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/a/b', 'http://ex.org/x/yy/zzz/a/b/c']),
    );

    it(
      'should resolve IRIs starting with ../ against the document IRI',
      shouldParse(parser,
                  '<../a> <../a/b> <../a/b/c>.\n',
                  ['http://ex.org/x/yy/a', 'http://ex.org/x/yy/a/b', 'http://ex.org/x/yy/a/b/c']),
    );

    it(
      'should resolve IRIs starting multiple ../ sequences against the document IRI',
      shouldParse(parser,
                  '<../../a> <../../../a/b> <../../../../../../../../a/b/c>.\n',
                  ['http://ex.org/x/a', 'http://ex.org/a/b', 'http://ex.org/a/b/c']),
    );

    it(
      'should resolve IRIs starting with mixes of ./ and ../ sequences against the document IRI',
      shouldParse(parser,
                  '<.././a> <./.././a/b> <./.././.././a/b/c>.\n',
                  ['http://ex.org/x/yy/a', 'http://ex.org/x/yy/a/b', 'http://ex.org/x/a/b/c']),
    );

    it(
      'should resolve IRIs starting with .x, ..x, or .../ against the document IRI',
      shouldParse(parser,
                  '<.x/a> <..x/a/b> <.../a/b/c>.\n',
                  ['http://ex.org/x/yy/zzz/.x/a', 'http://ex.org/x/yy/zzz/..x/a/b', 'http://ex.org/x/yy/zzz/.../a/b/c']),
    );

    it(
      'should resolve datatype IRIs against the document IRI',
      shouldParse(parser,
                  '<a> <b> "c"^^<d>.',
                  ['http://ex.org/x/yy/zzz/a', 'http://ex.org/x/yy/zzz/b', '"c"^^http://ex.org/x/yy/zzz/d']),
    );

    it(
      'should resolve IRIs in lists against the document IRI',
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
          ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil']),
    );

    it('should respect @base statements', shouldParse(parser,
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

    it('should use the given prefix for blank nodes', shouldParse(parser,
                '_:a <b> _:c.\n',
                ['_:blanka', 'b', '_:blankc']));
  });

  describe('A Parser instance with an empty blank node prefix', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, blankNodePrefix: '' }); }

    it('should not use a prefix for blank nodes', shouldParse(parser,
                '_:a <b> _:c.\n',
                ['_:a', 'b', '_:c']));
  });

  describe('A Parser instance with a non-string format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 1 }); }

    it(
      'should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']),
    );

    it(
      'should parse a graph',
      shouldParse(parser, '{<a> <b> <c>}', ['a', 'b', 'c']),
    );
  });

  describe('A Parser instance for the Turtle format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'Turtle' }); }

    it(
      'should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']),
    );

    it(
      'should not parse a default graph',
      shouldNotParse(parser, '{}', 'Unexpected graph on line 1.'),
    );

    it(
      'should not parse a named graph',
      shouldNotParse(parser, '<g> {}', 'Expected entity but got { on line 1.'),
    );

    it(
      'should not parse a named graph with the GRAPH keyword',
      shouldNotParse(parser, 'GRAPH <g> {}', 'Expected entity but got GRAPH on line 1.'),
    );

    it(
      'should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "http://example.org/c" on line 1.'),
    );

    it(
      'should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'),
    );

    it(
      'should not parse an equality statement',
      shouldNotParse(parser, '<a> = <b>.', 'Unexpected "=" on line 1.'),
    );

    it(
      'should not parse a right implication statement',
      shouldNotParse(parser, '<a> => <b>.', 'Unexpected "=>" on line 1.'),
    );

    it(
      'should not parse a left implication statement',
      shouldNotParse(parser, '<a> <= <b>.', 'Unexpected "<=" on line 1.'),
    );

    it(
      'should not parse a formula as object',
      shouldNotParse(parser, '<a> <b> {}.', 'Unexpected graph on line 1.'),
    );

    it(
      'should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'),
    );

    it(
      'should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'),
    );

    it(
      'should not parse a formula as list item',
      shouldNotParse(parser, '( <a> { <b> <c> <d> } <e> ).',
        'Unexpected graph on line 1.'),
    );

    it(
      'should not parse a literal as subject',
      shouldNotParse(parser, '1 <a> <b>.',
        'Unexpected literal on line 1.'),
    );

    it(
      'should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star in the object position',
      shouldNotParse(parser, '<a> <b> <<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star with annotated syntax',
      shouldNotParse(parser, '<a> <b> <c> {| <b> <c> |}.',
          'Unexpected RDF-star syntax on line 1.'),
    );
  });

  describe('A Parser instance for the TurtleStar format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'TurtleStar' }); }

    it('should parse RDF-star', shouldParse(parser,
      '<<<a> <b> <c>>> <b> <c> .',
      [['a', 'b', 'c'], 'b', 'c']));

    it(
      'should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:b0_b" on line 1.'),
    );
  });

  describe('A Parser instance for the TriG format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'TriG' }); }

    it(
      'should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']),
    );

    it('should parse a default graph', shouldParse(parser, '{}'));

    it('should parse a named graph', shouldParse(parser, '<g> {}'));

    it(
      'should parse a named graph with the GRAPH keyword',
      shouldParse(parser, 'GRAPH <g> {}'),
    );

    it(
      'should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "http://example.org/c" on line 1.'),
    );

    it(
      'should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'),
    );

    it(
      'should not parse an equality statement',
      shouldNotParse(parser, '<a> = <b>.', 'Unexpected "=" on line 1.'),
    );

    it(
      'should not parse a right implication statement',
      shouldNotParse(parser, '<a> => <b>.', 'Unexpected "=>" on line 1.'),
    );

    it(
      'should not parse a left implication statement',
      shouldNotParse(parser, '<a> <= <b>.', 'Unexpected "<=" on line 1.'),
    );

    it(
      'should not parse a formula as object',
      shouldNotParse(parser, '<a> <b> {}.', 'Unexpected graph on line 1.'),
    );

    it(
      'should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'),
    );

    it(
      'should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'),
    );

    it(
      'should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star in the object position',
      shouldNotParse(parser, '<a> <b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star with annotated syntax',
      shouldNotParse(parser, '<a> <b> <c> {| <b> <c> |}.',
          'Unexpected RDF-star syntax on line 1.'),
    );
  });

  describe('A Parser instance for the TriGStar format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'TriGStar' }); }

    it('should parse RDF-star', shouldParse(parser, '<<<a> <b> <c>>> <a> <b> .',
      [['a', 'b', 'c'], 'a', 'b']));

    it(
      'should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:b0_b" on line 1.'),
    );
  });

  describe('A Parser instance for the N-Triples format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-Triples' }); }

    it(
      'should parse a single triple',
      shouldParse(parser, '_:a <http://ex.org/b> "c".',
                          ['_:b0_a', 'http://ex.org/b', '"c"']),
    );

    it(
      'should parse a single triple starting with Bom',
      shouldParse(parser, '\ufeff_:a <http://ex.org/b> "c".',
          ['_:b0_a', 'http://ex.org/b', '"c"']),
    );

    it(
      'should not parse a single quad',
      shouldNotParse(parser, '_:a <http://ex.org/b> "c" <http://ex.org/g>.',
                             'Expected punctuation to follow ""c"" on line 1.'),
    );

    it(
      'should not parse object lists',
      shouldNotParse(parser, '<http://example/s> <http://example/p> <http://example/o>, <http://example/o2> .',
          'Unexpected "," on line 1.'),
    );

    it(
      'should not parse relative IRIs',
      shouldNotParse(parser, '<a> <b> <c>.', 'Invalid IRI on line 1.'),
    );

    it(
      'should not parse a prefix declaration',
      shouldNotParse(parser, '@prefix : <p#>.', 'Unexpected "@prefix" on line 1.'),
    );

    it(
      'should not parse apostrophe literals',
      shouldNotParse(parser, "_:a <http://ex.org/b> 'c'.",
                             "Unexpected \"'c'.\" on line 1."),
    );

    it(
      'should not parse triple-quoted literals',
      shouldNotParse(parser, '_:a <http://ex.org/b> """c""".',
                             'Unexpected """"c"""." on line 1.'),
    );

    it(
      'should not parse triple-apostrophe literals',
      shouldNotParse(parser, "_:a <http://ex.org/b> '''c'''.",
                             "Unexpected \"'''c'''.\" on line 1."),
    );

    it(
      'should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'),
    );

    it(
      'should not parse an equality statement',
      shouldNotParse(parser, '<urn:a:a> = <urn:b:b>.', 'Unexpected "=" on line 1.'),
    );

    it(
      'should not parse a right implication statement',
      shouldNotParse(parser, '<urn:a:a> => <urn:b:b>.', 'Unexpected "=>" on line 1.'),
    );

    it(
      'should not parse a left implication statement',
      shouldNotParse(parser, '<urn:a:a> <= <urn:b:b>.', 'Unexpected "<=" on line 1.'),
    );

    it(
      'should not parse a formula as object',
      shouldNotParse(parser, '<urn:a:a> <urn:b:b> {}.', 'Unexpected "{}." on line 1.'),
    );

    it(
      'should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'),
    );

    it(
      'should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'),
    );

    it(
      'should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star in the object position',
      shouldNotParse(parser, '<http://ex.org/a> <http://ex.org/b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'),
    );
  });

  describe('A Parser instance for the N-TriplesStar format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-TriplesStar' }); }

    it(
      'should parse RDF-star',
      shouldParse(parser, '<<_:a <http://example.org/b> _:c>> <http://example.org/a> _:b .',
        [['_:b0_a', 'b', '_:b0_c'], 'a', '_:b0_b']),
    );

    it(
      'should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:b0_b" on line 1.'),
    );

    it(
      'should not parse annotated triples',
      shouldNotParse(parser, '_:a <http://ex.org/b> _:c {| <http://ex.org/b1> "c1" |} .',
          'Unexpected "{|" on line 1.'),
    );
  });

  describe('A Parser instance for the N-Quads format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-Quads' }); }

    it(
      'should parse a single triple',
      shouldParse(parser, '_:a <http://ex.org/b> "c".',
                          ['_:b0_a', 'http://ex.org/b', '"c"']),
    );

    it(
      'should parse a single quad',
      shouldParse(parser, '_:a <http://ex.org/b> "c" <http://ex.org/g>.',
                          ['_:b0_a', 'http://ex.org/b', '"c"', 'http://ex.org/g']),
    );

    it(
      'should not parse relative IRIs',
      shouldNotParse(parser, '<a> <b> <c>.', 'Invalid IRI on line 1.'),
    );

    it(
      'should not parse a prefix declaration',
      shouldNotParse(parser, '@prefix : <p#>.', 'Unexpected "@prefix" on line 1.'),
    );

    it(
      'should not parse a variable',
      shouldNotParse(parser, '?a ?b ?c.', 'Unexpected "?a" on line 1.'),
    );

    it(
      'should not parse an equality statement',
      shouldNotParse(parser, '<urn:a:a> = <urn:b:b>.', 'Unexpected "=" on line 1.'),
    );

    it(
      'should not parse a right implication statement',
      shouldNotParse(parser, '<urn:a:a> => <urn:b:b>.', 'Unexpected "=>" on line 1.'),
    );

    it(
      'should not parse a left implication statement',
      shouldNotParse(parser, '<urn:a:a> <= <urn:b:b>.', 'Unexpected "<=" on line 1.'),
    );

    it(
      'should not parse a formula as object',
      shouldNotParse(parser, '<urn:a:a> <urn:b:b> {}.', 'Unexpected "{}." on line 1.'),
    );

    it(
      'should not parse @forSome',
      shouldNotParse(parser, '@forSome <x>.', 'Unexpected "@forSome" on line 1.'),
    );

    it(
      'should not parse @forAll',
      shouldNotParse(parser, '@forAll <x>.', 'Unexpected "@forAll" on line 1.'),
    );

    it(
      'should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star in the object position',
      shouldNotParse(parser, '_:a <http://ex.org/b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'),
    );
  });

  describe('A Parser instance for the N-QuadsStar format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N-QuadsStar' }); }

    it(
      'should parse RDF-star',
      shouldParse(parser, '<<_:a <http://example.org/b> _:c>> <http://example.org/a> _:c .',
        [['_:b0_a', 'b', '_:b0_c'], 'a', '_:b0_c']),
    );

    it(
      'should not parse annotated triples',
      shouldNotParse(parser, '_:a <http://ex.org/b> _:c {| <http://ex.org/b1> "c1" |} .',
          'Unexpected "{|" on line 1.'),
    );
  });

  describe('A Parser instance for the N3 format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3' }); }

    it(
      'should parse a single triple',
      shouldParse(parser, '<a> <b> <c>.', ['a', 'b', 'c']),
    );

    it(
      'should not parse a default graph',
      shouldNotParse(parser, '{}', 'Expected entity but got eof on line 1.'),
    );

    it(
      'should not parse a named graph',
      shouldNotParse(parser, '<g> {}', 'Expected entity but got { on line 1.'),
    );

    it(
      'should not parse a named graph with the GRAPH keyword',
      shouldNotParse(parser, 'GRAPH <g> {}', 'Expected entity but got GRAPH on line 1.'),
    );

    it(
      'should not parse a quad',
      shouldNotParse(parser, '<a> <b> <c> <d>.', 'Expected punctuation to follow "http://example.org/c" on line 1.'),
    );

    it(
      'allows a blank node in predicate position',
      shouldParse(parser, '<a> [] <c>.', ['a', '_:b0', 'c']),
    );

    it(
      'allows a blank node label in predicate position',
      shouldParse(parser, '<a> _:b <c>.', ['a', '_:b0_b', 'c']),
    );

    it(
      'allows a blank node with properties in predicate position',
      shouldParse(parser, '<a> [<p> <o>] <c>.',
                  ['a', '_:b0', 'c'],
                  ['_:b0', 'p', 'o']),
    );

    it(
      'should parse a variable',
      shouldParse(parser, '?a ?b ?c.', ['?a', '?b', '?c']),
    );

    it('should parse a simple equality', shouldParse(parser, '<a> = <b>.',
                ['a', 'http://www.w3.org/2002/07/owl#sameAs', 'b']));

    it(
      'should parse a simple right implication',
      shouldParse(parser, '<a> => <b>.',
                  ['a', 'http://www.w3.org/2000/10/swap/log#implies', 'b']),
    );

    it(
      'should parse a simple left implication',
      shouldParse(parser, '<a> <= <b>.',
                  ['b', 'http://www.w3.org/2000/10/swap/log#implies', 'a']),
    );

    it(
      'should parse a right implication between one-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. } => { <d> <e> ?a }.',
                  ['_:b0', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1']),
    );

    it(
      'should parse a right implication between two-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. <d> <e> <f>. } => { <d> <e> ?a, <f> }.',
                  ['_:b0', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  'f',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1'],
                  ['d',  'e',  'f',  '_:b1']),
    );

    it(
      'should parse a left implication between one-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. } <= { <d> <e> ?a }.',
                  ['_:b1', 'http://www.w3.org/2000/10/swap/log#implies', '_:b0'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1']),
    );

    it(
      'should parse a left implication between two-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. <d> <e> <f>. } <= { <d> <e> ?a, <f> }.',
                  ['_:b1', 'http://www.w3.org/2000/10/swap/log#implies', '_:b0'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  'f',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1'],
                  ['d',  'e',  'f',  '_:b1']),
    );

    it(
      'should parse an equality of one-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. } = { <d> <e> ?a }.',
                  ['_:b0', 'http://www.w3.org/2002/07/owl#sameAs', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1']),
    );

    it(
      'should parse an equality of two-triple graphs',
      shouldParse(parser, '{ ?a ?b <c>. <d> <e> <f>. } = { <d> <e> ?a, <f> }.',
                  ['_:b0', 'http://www.w3.org/2002/07/owl#sameAs', '_:b1'],
                  ['?a', '?b', 'c',  '_:b0'],
                  ['d',  'e',  'f',  '_:b0'],
                  ['d',  'e',  '?a', '_:b1'],
                  ['d',  'e',  'f',  '_:b1']),
    );

    it(
      'should parse nested implication graphs',
      shouldParse(parser, '{ { ?a ?b ?c }<={ ?d ?e ?f }. } <= { { ?g ?h ?i } => { ?j ?k ?l } }.',
                  ['_:b3', 'http://www.w3.org/2000/10/swap/log#implies', '_:b0'],
                  ['_:b2', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1', '_:b0'],
                  ['?a', '?b', '?c', '_:b1'],
                  ['?d', '?e', '?f', '_:b2'],
                  ['_:b4', 'http://www.w3.org/2000/10/swap/log#implies', '_:b5', '_:b3'],
                  ['?g', '?h', '?i', '_:b4'],
                  ['?j', '?k', '?l', '_:b5']),
    );

    it(
      'should not reuse identifiers of blank nodes within and outside of formulas',
      shouldParse(parser, '_:a _:b _:c. { _:a _:b _:c } => { { _:a _:b _:c } => { _:a _:b _:c } }.',
                  ['_:b0_a', '_:b0_b', '_:b0_c'],
                  ['_:b0', 'http://www.w3.org/2000/10/swap/log#implies', '_:b1', ''],
                  ['_:b0.a', '_:b0.b', '_:b0.c', '_:b0'],
                  ['_:b2', 'http://www.w3.org/2000/10/swap/log#implies', '_:b3', '_:b1'],
                  ['_:b2.a', '_:b2.b', '_:b2.c', '_:b2'],
                  ['_:b3.a', '_:b3.b', '_:b3.c', '_:b3']),
    );

    it(
      'should parse a @forSome statement',
      shouldParse(parser, '@forSome <x>. <x> <x> <x>.',
                  ['_:b0', '_:b0', '_:b0']),
    );

    it(
      'should parse a @forSome statement with multiple entities',
      shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forSome a:x, <y>, a:z. a:x <y> a:z.',
                  ['_:b0', '_:b1', '_:b2']),
    );

    it(
      'should not parse a @forSome statement with an invalid prefix',
      shouldNotParse(parser, '@forSome a:b.',
                     'Undefined prefix "a:" on line 1.'),
    );

    it(
      'should not parse a @forSome statement with a blank node',
      shouldNotParse(parser, '@forSome _:a.',
                     'Unexpected blank on line 1.'),
    );

    it(
      'should not parse a @forSome statement with a variable',
      shouldNotParse(parser, '@forSome ?a.',
                     'Unexpected var on line 1.'),
    );

    it(
      'should correctly scope @forSome statements',
      shouldParse(parser, '@forSome <x>. <x> <x> { @forSome <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  ['_:b0', '_:b0', '_:b1'],
                  ['_:b2', '_:b2', '_:b2', '_:b1'],
                  ['_:b0', '_:b0', '_:b0']),
    );

    it(
      'should parse a @forAll statement',
      shouldParse(parser, '@forAll  <x>. <x> <x> <x>.',
                  ['?b0', '?b0', '?b0']),
    );

    it(
      'should parse a @forAll statement with multiple entities',
      shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forAll  a:x, <y>, a:z. a:x <y> a:z.',
                  ['?b0', '?b1', '?b2']),
    );

    it(
      'should not parse a @forAll statement with an invalid prefix',
      shouldNotParse(parser, '@forAll a:b.',
                     'Undefined prefix "a:" on line 1.'),
    );

    it(
      'should not parse a @forAll statement with a blank node',
      shouldNotParse(parser, '@forAll _:a.',
                     'Unexpected blank on line 1.'),
    );

    it(
      'should not parse a @forAll statement with a variable',
      shouldNotParse(parser, '@forAll ?a.',
                     'Unexpected var on line 1.'),
    );

    it(
      'should correctly scope @forAll statements',
      shouldParse(parser, '@forAll <x>. <x> <x> { @forAll <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  ['?b0', '?b0', '_:b1'],
                  ['?b2', '?b2', '?b2', '_:b1'],
                  ['?b0', '?b0', '?b0']),
    );

    it(
      'should parse a ! path of length 2 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe!fam:mother a fam:Person.',
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']),
    );

    it(
      'should parse a ! path of length 4 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>. @prefix loc: <l:>.' +
                          ':joe!fam:mother!loc:office!loc:zip loc:code 1234.',
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b0',   'l:office', '_:b1'],
                  ['_:b1',   'l:zip',    '_:b2'],
                  ['_:b2',   'l:code',   '"1234"^^http://www.w3.org/2001/XMLSchema#integer']),
    );

    it(
      'should parse a ! path of length 2 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe!fam:mother.',
                  ['x', 'is', '_:b0'],
                  ['ex:joe', 'f:mother', '_:b0']),
    );

    it(
      'should parse a ! path of length 4 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>. @prefix loc: <l:>.' +
                          '<x> <is> :joe!fam:mother!loc:office!loc:zip.',
                  ['x',      'is',       '_:b2'],
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b0',   'l:office', '_:b1'],
                  ['_:b1',   'l:zip',    '_:b2']),
    );

    it(
      'should parse a ^ path of length 2 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe^fam:son a fam:Person.',
                  ['_:b0', 'f:son', 'ex:joe'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']),
    );

    it(
      'should parse a ^ path of length 4 as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe^fam:son^fam:sister^fam:mother a fam:Person.',
                  ['_:b0', 'f:son',    'ex:joe'],
                  ['_:b1', 'f:sister', '_:b0'],
                  ['_:b2', 'f:mother', '_:b1'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']),
    );

    it(
      'should parse a ^ path of length 2 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe^fam:son.',
                  ['x',    'is',    '_:b0'],
                  ['_:b0', 'f:son', 'ex:joe']),
    );

    it(
      'should parse a ^ path of length 4 as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe^fam:son^fam:sister^fam:mother.',
                  ['x',    'is',       '_:b2'],
                  ['_:b0', 'f:son',    'ex:joe'],
                  ['_:b1', 'f:sister', '_:b0'],
                  ['_:b2', 'f:mother', '_:b1']),
    );

    it(
      'should parse mixed !/^ paths as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          ':joe!fam:mother^fam:mother a fam:Person.',
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b1',   'f:mother', '_:b0'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']),
    );

    it(
      'should parse mixed !/^ paths as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> :joe!fam:mother^fam:mother.',
                  ['x', 'is', '_:b1'],
                  ['ex:joe', 'f:mother', '_:b0'],
                  ['_:b1',   'f:mother', '_:b0']),
    );

    it(
      'should parse a ! path in a blank node as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '[fam:knows :joe!fam:mother] a fam:Person.',
                  ['_:b0', 'f:knows', '_:b1'],
                  ['ex:joe', 'f:mother', '_:b1'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']),
    );

    it(
      'should parse a ! path in a blank node as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> [fam:knows :joe!fam:mother].',
                  ['x', 'is', '_:b0'],
                  ['_:b0', 'f:knows', '_:b1'],
                  ['ex:joe', 'f:mother', '_:b1']),
    );

    it(
      'should parse a ^ path in a blank node as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '[fam:knows :joe^fam:son] a fam:Person.',
                  ['_:b0', 'f:knows', '_:b1'],
                  ['_:b1', 'f:son', 'ex:joe'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'f:Person']),
    );

    it(
      'should parse a ^ path in a blank node as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<x> <is> [fam:knows :joe^fam:son].',
                  ['x', 'is', '_:b0'],
                  ['_:b0', 'f:knows', '_:b1'],
                  ['_:b1', 'f:son', 'ex:joe']),
    );

    it(
      'should parse a ! path in a list as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(<x> :joe!fam:mother <y>) a :List.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',  'ex:List'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['ex:joe', 'f:mother', '_:b2']),
    );

    it(
      'should parse a ! path in a list as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<l> <is> (<x> :joe!fam:mother <y>).',
                  ['l', 'is', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['ex:joe', 'f:mother', '_:b2']),
    );

    it(
      'should parse a ^ path in a list as subject',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '(<x> :joe^fam:son <y>) a :List.',
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',  'ex:List'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'f:son', 'ex:joe']),
    );

    it(
      'should parse a ^ path in a list as object',
      shouldParse(parser, '@prefix : <ex:>. @prefix fam: <f:>.' +
                          '<l> <is> (<x> :joe^fam:son <y>).',
                  ['l', 'is', '_:b0'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',  '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'y'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
                  ['_:b2', 'f:son', 'ex:joe']),
    );

    it(
      'should parse a formula as list item',
      shouldParse(parser, '<a> <findAll> ( <b> { <b> a <type>. <b> <something> <foo> } <o> ).',
      ['a', 'findAll', '_:b0'],
      ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b'],
      ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2'],
      ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'o'],
      ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'],
      ['b', 'something', 'foo', '_:b1'],
      ['b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'type', '_:b1'],
  ),
    );

    it(
      'should not parse an invalid ! path',
      shouldNotParse(parser, '<a>!"invalid" ', 'Expected entity but got literal on line 1.'),
    );

    it(
      'should not parse an invalid ^ path',
      shouldNotParse(parser, '<a>^"invalid" ', 'Expected entity but got literal on line 1.'),
    );

    it(
      'should parse literal as subject',
      shouldParse(parser, '<a> <b> {1 <greaterThan> 0}.',
          ['a', 'b', '_:b0'],
          ['"1"^^http://www.w3.org/2001/XMLSchema#integer', 'greaterThan', '"0"^^http://www.w3.org/2001/XMLSchema#integer', '_:b0'],
      ),
    );

    it(
      'should parse literals with datatype as subject',
      shouldParse(parser, '<a> <b> {"a"^^<c> <greaterThan> "b"^^<c>}.',
          ['a', 'b', '_:b0'],
          ['"a"^^http://example.org/c', 'greaterThan', '"b"^^http://example.org/c', '_:b0'],
      ),
    );

    it(
      'should parse literals with language as subject',
      shouldParse(parser, '<a> <b> {"bonjour"@fr <sameAs> "hello"@en}.',
          ['a', 'b', '_:b0'],
          ['"bonjour"@fr', 'sameAs', '"hello"@en', '_:b0'],
      ),
    );

    it(
      'should not parse RDF-star in the subject position',
      shouldNotParse(parser, '<<<a> <b> <c>>> <a> <b> .',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star in the object position',
      shouldNotParse(parser, '<a> <b> <<<a> <b> <c>>>.',
        'Unexpected RDF-star syntax on line 1.'),
    );

    it(
      'should not parse RDF-star with annotated syntax',
      shouldNotParse(parser, '<a> <b> <c> {| <b> <c> |}.',
          'Unexpected RDF-star syntax on line 1.'),
    );
  });

  describe('A Parser instance for the N3Star format', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3Star' }); }

    it('should parse RDF-star', shouldParse(parser, '<<<a> <b> <c>>> <a> <b> .',
      [['a', 'b', 'c'], 'a', 'b']));

    it(
      'should not parse nested quads',
      shouldNotParse(parser, '<<_:a <http://ex.org/b> _:b <http://ex.org/b>>> <http://ex.org/b> "c" .',
        'Expected >> to follow "_:.b" on line 1.'),
    );
  });

  describe('A Parser instance for the N3 format with the explicitQuantifiers option', () => {
    function parser() { return new Parser({ baseIRI: BASE_IRI, format: 'N3', explicitQuantifiers: true }); }

    it(
      'should parse a @forSome statement',
      shouldParse(parser, '@forSome <x>. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b0', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x']),
    );

    it(
      'should parse a @forSome statement with multiple entities',
      shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forSome a:x, <y>, a:z. a:x <y> a:z.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b0',        'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b:y', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:z', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['a:x', 'b:y', 'a:z']),
    );

    it(
      'should correctly scope @forSome statements',
      shouldParse(parser, '@forSome <x>. <x> <x> { @forSome <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b0',      'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', '_:b1'],
                  ['_:b1', 'http://www.w3.org/2000/10/swap/reify#forSome', '_:b2',  'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x', '_:b1'],
                  ['x', 'x', 'x']),
    );

    it(
      'should parse a @forAll statement',
      shouldParse(parser, '@forAll <x>. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b0',       'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x']),
    );

    it(
      'should parse a @forAll statement with multiple entities',
      shouldParse(parser, '@prefix a: <a:>. @base <b:>. @forAll a:x, <y>, a:z. a:x <y> a:z.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b0',         'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b1', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'b:y', 'urn:n3:quantifiers'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b2', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'a:z', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['a:x', 'b:y', 'a:z']),
    );

    it(
      'should correctly scope @forAll statements',
      shouldParse(parser, '@forAll <x>. <x> <x> { @forAll <x>. <x> <x> <x>. }. <x> <x> <x>.',
                  ['', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b0',       'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', '_:b1'],
                  ['_:b1', 'http://www.w3.org/2000/10/swap/reify#forAll', '_:b2',   'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', 'x', 'urn:n3:quantifiers'],
                  ['_:b2', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil', 'urn:n3:quantifiers'],
                  ['x', 'x', 'x', '_:b1'],
                  ['x', 'x', 'x']),
    );
  });

  describe('A Parser instance with a custom DataFactory', () => {
    const factory = {};
    let parser;
    beforeAll(() => {
      factory.quad = function (s, p, o, g) { return { s: s, p: p, o: o, g: g }; };
      ['namedNode', 'blankNode', 'literal', 'variable', 'defaultGraph'].forEach(f => {
        factory[f] = function (n) { return n ? `${f[0]}-${n}` : f; };
      });
      parser = new Parser({ baseIRI: BASE_IRI, format: 'n3', factory: factory });
    });

    it('should use the custom factory', () => {
      expect(parser.parse('<a> ?b 1, _:d.')).toEqual([
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

      expect(quads.length).toBeGreaterThan(0);

      const g1 = DF.blankNode();
      const g2 = DF.blankNode();

      expect(isomorphic(quads, [
        DF.quad(
          DF.namedNode('http://example.com/weather'),
          DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          DF.namedNode('http://example.com/Raining'),
          g1,
        ),
        DF.quad(
          DF.namedNode('http://example.com/weather'),
          DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          DF.namedNode('http://example.com/Cloudy'),
          g2,
        ),
        DF.quad(
          g1,
          DF.namedNode('http://www.w3.org/2000/10/swap/log#implies'),
          g2,
        ),
      ])).toBe(true);
    });
  });

  describe('A turtle parser instance with external data factory', () => {
    it('should parse', () => {
      const parser = new Parser({
        baseIRI: BASE_IRI,
        format: 'turtle',
        factory: rdfDataModel,
      });
      const quads = parser.parse(`
        @prefix : <http://example.com/> .
        :weather a :Raining .

        :jeswr :knows [
          :name "Thomas" ;
        ] .
      `);

      const bnode = DF.blankNode();

      expect(isomorphic(quads, [
        DF.quad(
          DF.namedNode('http://example.com/weather'),
          DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          DF.namedNode('http://example.com/Raining'),
        ),
        DF.quad(
          DF.namedNode('http://example.com/jeswr'),
          DF.namedNode('http://example.com/knows'),
          bnode,
        ),
        DF.quad(
          bnode,
          DF.namedNode('http://example.com/name'),
          DF.literal('Thomas'),
        ),
      ])).toBe(true);
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

function shouldParse(parser, input) {
  const expected = Array.prototype.slice.call(arguments, 1);
  // Shift parameters as necessary
  if (parser.call)
    expected.shift();
  else
    input = parser, parser = Parser;

  return function (done) {
    const results = [];
    const items = expected.map(mapToQuad);
    new parser({ baseIRI: BASE_IRI }).parse(input, (error, triple) => {
      expect(error).toBeFalsy();
      if (triple)
        results.push(triple);
      else
        expect(toSortedJSON(results)).toBe(toSortedJSON(items)), done();
    });
  };
}


function shouldCallbackComments(parser, input) {
  const expected = Array.prototype.slice.call(arguments, 1);
  // Shift parameters as necessary
  if (parser.call)
    expected.shift();
  else
    input = parser, parser = Parser;

  return function (done) {
    const items = expected;
    const comments = [];
    new parser({ baseIRI: BASE_IRI }).parse(input, (error, triple) => {
      if (!triple) {
        // Marks the end
        expect(JSON.stringify(comments)).toBe(JSON.stringify(items));
        done();
      }
    }, null, comment => { comments.push(comment); });
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
      t.subject.toJSON(), t.predicate.toJSON(), t.object.toJSON(), t.graph.toJSON(),
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
        expect(triple).toBeFalsy();
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toEqual(expectedError);
        if (expectedContext) expect(error.context).toEqual(expectedContext);
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
    beforeAll(done => {
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
      expect(result.object.value).toBe(expected);
    });
  });
}
