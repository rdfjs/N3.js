var N3Parser = require('../N3').Parser;
var chai = require('chai'),
    expect = chai.expect;
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
                  ['a', 'b', '"3.0"^^<http://www.w3.org/2001/XMLSchema#decimal>']));

    it('should parse a triple with an integer literal',
      shouldParse('<a> <b> 3.',
                  ['a', 'b', '"3"^^<http://www.w3.org/2001/XMLSchema#integer>']));

    it('should parse a triple with a floating point literal',
      shouldParse('<a> <b> 1.3e2.',
                  ['a', 'b', '"1.3e2"^^<http://www.w3.org/2001/XMLSchema#double>']));

    it('should parse a triple with a boolean literal',
      shouldParse('<a> <b> true.',
                  ['a', 'b', '"true"^^<http://www.w3.org/2001/XMLSchema#boolean>']));

    it('should parse a triple with a literal and a language code',
      shouldParse('<a> <b> "string"@en.',
                  ['a', 'b', '"string"@en']));

    it('should normalize language codes to lowercase',
      shouldParse('<a> <b> "string"@EN.',
                  ['a', 'b', '"string"@en']));

    it('should parse a triple with a literal and a URI type',
      shouldParse('<a> <b> "string"^^<type>.',
                  ['a', 'b', '"string"^^<type>']));

    it('should parse a triple with a literal and a qname type',
      shouldParse('@prefix x: <y#>. <a> <b> "string"^^x:z.',
                  ['a', 'b', '"string"^^<y#z>']));

    it('should not parse a triple with a literal and a qname type with an inexistent prefix',
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
                     'Expected explicituri to follow prefix ":" at line 1.'));

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
                  ['_:b0', 'b', '_:b1']));

    it('should not parse statements with named blank nodes',
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

    it('should parse a multi-statement blank node',
      shouldParse('<a> <b> [ <u> <v>; <w> <z> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', 'z']));

    it('should parse a multi-statement blank node ending with a literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z" ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"']));

    it('should parse a multi-statement blank node ending with a typed literal',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^<t>']));

    it('should parse a multi-statement blank node ending with a string with language',
      shouldParse('<a> <b> [ <u> <v>; <w> "z"^^<t> ].',
                  ['a', 'b', '_:b0'],
                  ['_:b0', 'u', 'v'],
                  ['_:b0', 'w', '"z"^^<t>']));

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

    it('should parse statements with qnames in lists',
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
                  ['a', 'b', '_:b1'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b0'],
                  ['_:b1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', '_:b3'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', '_:b2'],
                  ['_:b3', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
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
                     'Expected list item instead of "bracketclose" at line 1.'));

    it('should resolve URIs against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<a> <b> <c>.\n' +
                  '@base <d/>.\n' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    it('should resolve URIs against SPARQL base',
      shouldParse('BASE <http://ex.org/>\n' +
                  '<a> <b> <c>. ' +
                  'BASE <d/> ' +
                  '<e> <f> <g>.',
                  ['http://ex.org/a', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/e', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    it('should resolve URIs against a @base with query string',
      shouldParse('@base <http://ex.org/?foo>.\n' +
                  '<> <b> <c>.\n' +
                  '@base <d/?bar>.\n' +
                  '<> <f> <g>.',
                  ['http://ex.org/?foo', 'http://ex.org/b', 'http://ex.org/c'],
                  ['http://ex.org/d/?bar', 'http://ex.org/d/f', 'http://ex.org/d/g']));

    it('should resolve URIs with query string against @base',
      shouldParse('@base <http://ex.org/>.\n' +
                  '<?> <?a> <?a=b>.\n' +
                  '@base <d>.\n' +
                  '<?> <?a> <?a=b>.' +
                  '@base <?e>.\n' +
                  '<> <?a> <?a=b>.',
                  ['http://ex.org/?', 'http://ex.org/?a', 'http://ex.org/?a=b'],
                  ['http://ex.org/d?', 'http://ex.org/d?a', 'http://ex.org/d?a=b'],
                  ['http://ex.org/d?e', 'http://ex.org/d?a', 'http://ex.org/d?a=b']));

    it('should not parse base declarations without IRI',
      shouldNotParse('@base a: ',
                     'Expected explicituri to follow base declaration at line 1.'));

    it('should not parse invalid @base statements',
      shouldNotParse('@base <http://ex.org/foo#bar>.\n' +
                     '<a> <b> <c>.\n',
                     'Invalid base URI at line 1.'));

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
                     'Unexpected dot at line 1.'));

    it('should error if an unexpected token follows a subject',
      shouldNotParse('<a> [',
                     'Expected predicate to follow "a" at line 1.'));

    it('should not error if there is no triple callback', function () {
      new N3Parser().parse('');
    });

    it('should return prefixes through a callback', function (done) {
      var prefixes = {};
      new N3Parser().parse('@prefix a: <URIa>. a:a a:b a:c. @prefix b: <URIb>.',
                           tripleCallback, prefixCallback);

      function tripleCallback(error, triple) {
        expect(error).not.to.exist;
        if (!triple) {
          Object.keys(prefixes).should.have.length(2);
          prefixes.should.have.property('a', 'URIa');
          prefixes.should.have.property('b', 'URIb');
          done();
        }
      }

      function prefixCallback(prefix, uri) {
        expect(prefix).to.exist;
        expect(uri).to.exist;
        prefixes[prefix] = uri;
      }
    });

    it('should return prefixes at the last triple callback', function (done) {
      new N3Parser().parse('@prefix a: <URIa>. a:a a:b a:c. @prefix b: <URIb>.', tripleCallback);

      function tripleCallback(error, triple, prefixes) {
        expect(error).not.to.exist;
        if (triple)
          expect(prefixes).not.to.exist;
        else {
          expect(prefixes).to.exist;
          Object.keys(prefixes).should.have.length(2);
          prefixes.should.have.property('a', 'URIa');
          prefixes.should.have.property('b', 'URIb');
          done();
        }
      }
    });

    describe('when the addChunk/end interface is used', function () {
      it('should return the parsed triples', function () {
        var triples = [], parser = new N3Parser();
        parser.parse(function (error, triple) { triple && triples.push(triple); });
        parser.addChunk('<a> <b> <c>.');
        triples.should.have.length(1);
        parser.addChunk('<a> <b> <d>.');
        triples.should.have.length(2);
        parser.end();
        triples.should.have.length(2);
      });
    });
  });

  describe('An N3Parser instance with a document URI', function () {
    var parser = new N3Parser({ documentURI: 'http://ex.org/doc/f.ttl' });

    it('should resolve URIs against the document URI',
      shouldParse(parser,
                  '@prefix : <#>.\n' +
                  '<a> <b> <c>.\n' +
                  ':e :f :g.',
                  ['http://ex.org/doc/a', 'http://ex.org/doc/b', 'http://ex.org/doc/c'],
                  ['http://ex.org/doc/f.ttl#e', 'http://ex.org/doc/f.ttl#f', 'http://ex.org/doc/f.ttl#g']));

    it('should resolve URIs with a trailing slashes against the document URI',
      shouldParse(parser,
                  '</a> </a/b> </a/b/c>.\n',
                  ['http://ex.org/a', 'http://ex.org/a/b', 'http://ex.org/a/b/c']));

    it('should respect @base statements',
      shouldParse(parser,
                  '<a> <b> <c>.\n' +
                  '@base <http://ex.org/x/>.\n' +
                  '<e> <f> <g>.\n' +
                  '@base <d/>.\n' +
                  '<h> <i> <j>.\n' +
                  '@base </e/>.\n' +
                  '<k> <l> <m>.',
                  ['http://ex.org/doc/a', 'http://ex.org/doc/b', 'http://ex.org/doc/c'],
                  ['http://ex.org/x/e', 'http://ex.org/x/f', 'http://ex.org/x/g'],
                  ['http://ex.org/x/d/h', 'http://ex.org/x/d/i', 'http://ex.org/x/d/j'],
                  ['http://ex.org/e/k', 'http://ex.org/e/l', 'http://ex.org/e/m']));
  });

  describe('An N3Parser instance with an invalid document URI', function () {
    it('cannot be created', function (done) {
      try {
        new N3Parser({ documentURI: 'http://ex.org/doc/f#' });
      }
      catch (error) {
        error.message.should.equal('Invalid document URI');
        done();
      }
    });
  });
});

function shouldParse(parser, input) {
  var hasParser = parser instanceof N3Parser,
      expected = Array.prototype.slice.call(arguments, hasParser ? 2 : 1),
      items = expected.map(function (item) {
        return { subject: item[0], predicate: item[1], object: item[2],
                 context: item[3] || 'n3/contexts#default' };
      });
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

function shouldNotParse(input, expectedError) {
  return function (done) {
    new N3Parser().parse(input, function (error, triple) {
      if (error) {
        expect(triple).not.to.exist;
        error.should.be.an.instanceof(Error);
        error.message.should.eql(expectedError);
        done();
      }
      else if (!triple)
        throw new Error("Expected error " + expectedError);
    });
  };
}
