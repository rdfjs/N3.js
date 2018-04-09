var N3Writer = require('../N3').Writer,
    Datatype = require('../lib/Datatypes');
var Term = Datatype.Term,
    NamedNode = Datatype.NamedNode,
    Literal = Datatype.Literal,
    Quad = Datatype.Quad,
    Triple = Datatype.Triple;

describe('N3Writer', function () {
  describe('The N3Writer module', function () {
    it('should be a function', function () {
      N3Writer.should.be.a('function');
    });

    it('should make N3Writer objects', function () {
      N3Writer().should.be.an.instanceof(N3Writer);
    });

    it('should be an N3Writer constructor', function () {
      new N3Writer().should.be.an.instanceof(N3Writer);
    });
  });

  describe('An N3Writer instance', function () {
    it('should serialize a single triple', function () {
      var writer = N3Writer();
      writer.tripleToString(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.equal('<a> <b> <c>.\n');
    });

    it('should serialize a single quad', function () {
      var writer = N3Writer();
      writer.tripleToString(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')).should.equal('<a> <b> <c> <g>.\n');
    });

    it('should serialize an array of triples', function () {
      var writer = N3Writer();
      var triples = [new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        new Quad(new NamedNode('d'), new NamedNode('e'), new NamedNode('f'))];
      writer.triplesToString(triples).should.equal('<a> <b> <c>.\n<d> <e> <f>.\n');
    });


    it('should serialize 0 triples',
      shouldSerialize(''));

    it('should serialize 1 triple',
      shouldSerialize(['abc', 'def', 'ghi'],
                      '<abc> <def> <ghi>.\n'));

    it('should serialize 2 triples',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['jkl', 'mno', 'pqr'],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n'));

    it('should serialize 3 triples',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['jkl', 'mno', 'pqr'],
                      ['stu', 'vwx', 'yz'],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'));

    it('should serialize a literal',
      shouldSerialize(['a', 'b', '"cde"'],
                      '<a> <b> "cde".\n'));

    it('should serialize a literal with a type',
      shouldSerialize(['a', 'b', '"cde"^^fgh'],
                      '<a> <b> "cde"^^<fgh>.\n'));

    it('should serialize a literal with a language',
      shouldSerialize(['a', 'b', '"cde"@en-us'],
                      '<a> <b> "cde"@en-us.\n'));

    // e.g. http://vocab.getty.edu/aat/300264727.ttl
    it('should serialize a literal with an artificial language',
       shouldSerialize(['a', 'b', '"cde"@qqq-002'],
                        '<a> <b> "cde"@qqq-002.\n'));

    it('should serialize a literal containing a single quote',
      shouldSerialize(['a', 'b', '"c\'de"'],
                      '<a> <b> "c\'de".\n'));

    it('should serialize a literal containing a double quote',
      shouldSerialize(['a', 'b', '"c"de"'],
                      '<a> <b> "c\\"de".\n'));

    it('should serialize a literal containing a backspace',
      shouldSerialize(['a', 'b', '"c\\de"'],
                      '<a> <b> "c\\\\de".\n'));

    it('should serialize a literal containing a tab character',
      shouldSerialize(['a', 'b', '"c\tde"'],
                      '<a> <b> "c\\tde".\n'));

    it('should serialize a literal containing a newline character',
      shouldSerialize(['a', 'b', '"c\nde"'],
                      '<a> <b> "c\\nde".\n'));

    it('should serialize a literal containing a cariage return character',
      shouldSerialize(['a', 'b', '"c\rde"'],
                      '<a> <b> "c\\rde".\n'));

    it('should serialize a literal containing a backspace character',
      shouldSerialize(['a', 'b', '"c\bde"'],
                      '<a> <b> "c\\bde".\n'));

    it('should serialize a literal containing a form feed character',
      shouldSerialize(['a', 'b', '"c\fde"'],
                      '<a> <b> "c\\fde".\n'));

    it('should serialize a literal containing a line separator',
      shouldSerialize(['a', 'b', '"c\u2028de"'],
                      '<a> <b> "c\u2028de".\n'));

    it('should serialize a literal containing a paragraph separator',
      shouldSerialize(['a', 'b', '"c\u2029de"'],
                      '<a> <b> "c\u2029de".\n'));

    it('should serialize a literal containing special unicode characters',
      shouldSerialize(['a', 'b', '"c\u0000\u0001"'],
                      '<a> <b> "c\\u0000\\u0001".\n'));

    it('should serialize blank nodes',
      shouldSerialize(['_:a', 'b', '_:c'],
                      '_:a <b> _:c.\n'));

    it('should not serialize a literal in the subject',
      shouldNotSerialize(['"a"', 'b', '"c"'],
                          'A literal as subject is not allowed: "a"'));

    it('should not leave leading whitespace if the prefix set is empty',
      shouldSerialize({},
                      ['a', 'b', 'c'],
                      '<a> <b> <c>.\n'));

    it('should serialize valid prefixes',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#', c: 'http://a.org/b' } },
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n'));

    it('should use prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#', c: 'http://a.org/b' } },
                      ['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                      ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                      ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n' +
                      'a:bc b:ef a:bhi.\n' +
                      '<http://a.org/bc/de> <http://a.org/b#e#f> <http://a.org/b#x/t>.\n' +
                      '<http://a.org/3a> <http://a.org/b#3a> b:a3.\n'));

    it('should expand prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#' } },
                      ['a:bc', 'b:ef', 'c:bhi'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n' +
                      'a:bc b:ef <c:bhi>.\n'));

    it('should not repeat the same subjects',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['abc', 'mno', 'pqr'],
                      ['stu', 'vwx', 'yz'],
                      '<abc> <def> <ghi>;\n' +
                      '    <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'));

    it('should not repeat the same predicates',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['abc', 'def', 'pqr'],
                      ['abc', 'bef', 'ghi'],
                      ['abc', 'bef', 'pqr'],
                      ['stu', 'bef', 'yz'],
                      '<abc> <def> <ghi>, <pqr>;\n' +
                      '    <bef> <ghi>, <pqr>.\n' +
                      '<stu> <bef> <yz>.\n'));

    it('should write rdf:type as "a"',
      shouldSerialize(['abc', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'def'],
                      '<abc> a <def>.\n'));

    it('should serialize a graph with 1 triple',
      shouldSerialize(['abc', 'def', 'ghi', 'xyz'],
                      '<xyz> {\n' +
                      '<abc> <def> <ghi>\n' +
                      '}\n'));

    it('should serialize a graph with 3 triples',
      shouldSerialize(['abc', 'def', 'ghi', 'xyz'],
                      ['jkl', 'mno', 'pqr', 'xyz'],
                      ['stu', 'vwx', 'yz',  'xyz'],
                      '<xyz> {\n' +
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>\n' +
                      '}\n'));

    it('should serialize three graphs',
      shouldSerialize(['abc', 'def', 'ghi', 'xyz'],
                      ['jkl', 'mno', 'pqr', ''],
                      ['stu', 'vwx', 'yz',  'abc'],
                      '<xyz> {\n<abc> <def> <ghi>\n}\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<abc> {\n<stu> <vwx> <yz>\n}\n'));

    it('should output 8-bit unicode characters as escape sequences',
      shouldSerialize(['\ud835\udc00', '\ud835\udc00', '"\ud835\udc00"^^\ud835\udc00', '\ud835\udc00'],
                      '<\\U0001d400> {\n<\\U0001d400> <\\U0001d400> "\\U0001d400"^^<\\U0001d400>\n}\n'));

    it('should not use escape sequences in blank nodes',
      shouldSerialize(['_:\ud835\udc00', '_:\ud835\udc00', '_:\ud835\udc00', '_:\ud835\udc00'],
                      '_:\ud835\udc00 {\n_:\ud835\udc00 _:\ud835\udc00 _:\ud835\udc00\n}\n'));

    it('calls the done callback when ending the outputstream errors', function (done) {
      var writer = new N3Writer({
        write: function () {},
        end: function () { throw new Error('error'); },
      });
      writer.end(done);
    });

    it('sends output through end when no stream argument is given', function (done) {
      var writer = new N3Writer(), notCalled = true;
      writer.addTriple(new Triple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), function () { notCalled = false; });
      writer.end(function (error, output) {
        output.should.equal('<a> <b> <c>.\n');
        done(notCalled || error);
      });
    });

    it('respects the prefixes argument when no stream argument is given', function (done) {
      var writer = new N3Writer({ prefixes: { a: 'b#' } });
      writer.addTriple(new Triple(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
      writer.end(function (error, output) {
        output.should.equal('@prefix a: <b#>.\n\na:a a:b a:c.\n');
        done(error);
      });
    });

    it('does not repeat identical prefixes', function (done) {
      var writer = new N3Writer();
      writer.addPrefix('a', 'b#');
      writer.addPrefix('a', 'b#');
      writer.addTriple(new Triple(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
      writer.addPrefix('a', 'b#');
      writer.addPrefix('a', 'b#');
      writer.addPrefix('b', 'b#');
      writer.addPrefix('a', 'c#');
      writer.end(function (error, output) {
        output.should.equal('@prefix a: <b#>.\n\na:a a:b a:c.\n' +
                            '@prefix b: <b#>.\n\n@prefix a: <c#>.\n\n');
        done(error);
      });
    });

    it('serializes triples of a graph with a prefix declaration in between', function (done) {
      var writer = new N3Writer();
      writer.addPrefix('a', 'b#');
      writer.addTriple(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c'), new NamedNode('b#g')));
      writer.addPrefix('d', 'e#');
      writer.addTriple(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#d'), new NamedNode('b#g')));
      writer.end(function (error, output) {
        output.should.equal('@prefix a: <b#>.\n\na:g {\na:a a:b a:c\n}\n' +
                            '@prefix d: <e#>.\n\na:g {\na:a a:b a:d\n}\n');
        done(error);
      });
    });

    it('should accept triples with separated components', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'));
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'));
      writer.end(function (error, output) {
        output.should.equal('<a> <b> <c>, <d>.\n');
        done(error);
      });
    });

    it('should accept quads with separated components', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g'));
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'), new NamedNode('g'));
      writer.end(function (error, output) {
        output.should.equal('<g> {\n<a> <b> <c>, <d>\n}\n');
        done(error);
      });
    });

    it('should serialize triples with an empty blank node as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a1'), new NamedNode('b'), writer.blank());
      writer.addTriple(new NamedNode('a2'), new NamedNode('b'), writer.blank([]));
      writer.end(function (error, output) {
        output.should.equal('<a1> <b> [].\n' +
                            '<a2> <b> [].\n');
        done(error);
      });
    });

    it('should serialize triples with a one-triple blank node as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a1'), new NamedNode('b'), writer.blank(new NamedNode('d'), new NamedNode('e')));
      writer.addTriple(new NamedNode('a2'), new NamedNode('b'), writer.blank({ predicate: new NamedNode('d'), object: new NamedNode('e') }));
      writer.addTriple(new NamedNode('a3'), new NamedNode('b'), writer.blank([{ predicate: new NamedNode('d'), object: new NamedNode('e') }]));
      writer.end(function (error, output) {
        output.should.equal('<a1> <b> [ <d> <e> ].\n' +
                            '<a2> <b> [ <d> <e> ].\n' +
                            '<a3> <b> [ <d> <e> ].\n');
        done(error);
      });
    });

    it('should serialize triples with a two-triple blank node as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), writer.blank([
          { predicate: new NamedNode('d'), object: new NamedNode('e') },
          { predicate: new NamedNode('f'), object: new Literal('"g"') },
      ]));
      writer.end(function (error, output) {
        output.should.equal('<a> <b> [\n' +
                            '  <d> <e>;\n' +
                            '  <f> "g"\n' +
                            '].\n');
        done(error);
      });
    });

    it('should serialize triples with a three-triple blank node as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: new NamedNode('e') },
        { predicate: new NamedNode('f'), object: new Literal('"g"') },
        { predicate: new NamedNode('h'), object: new NamedNode('i') },
      ]));
      writer.end(function (error, output) {
        output.should.equal('<a> <b> [\n' +
                            '  <d> <e>;\n' +
                            '  <f> "g";\n' +
                            '  <h> <i>\n' +
                            '].\n');
        done(error);
      });
    });

    it('should serialize triples with predicate-sharing blank node triples as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: new NamedNode('e') },
        { predicate: new NamedNode('d'), object: new NamedNode('f') },
        { predicate: new NamedNode('g'), object: new NamedNode('h') },
        { predicate: new NamedNode('g'), object: new NamedNode('i') },
      ]));
      writer.end(function (error, output) {
        output.should.equal('<a> <b> [\n' +
          '  <d> <e>, <f>;\n' +
          '  <g> <h>, <i>\n' +
          '].\n');
        done(error);
      });
    });

    it('should serialize triples with nested blank nodes as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a1'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: writer.blank() },
      ]));
      writer.addTriple(new NamedNode('a2'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: writer.blank(new NamedNode('e'), new NamedNode('f')) },
        { predicate: new NamedNode('g'), object: writer.blank(new NamedNode('h'), new Literal('"i"')) },
      ]));
      writer.addTriple(new NamedNode('a3'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: writer.blank([
          { predicate: new NamedNode('g'), object: writer.blank(new NamedNode('h'), new NamedNode('i')) },
          { predicate: new NamedNode('j'), object: writer.blank(new NamedNode('k'), new Literal('"l"')) },
        ]) },
      ]));
      writer.end(function (error, output) {
        output.should.equal('<a1> <b> [\n' +
          '  <d> []\n' +
          '].\n' +
          '<a2> <b> [\n' +
          '  <d> [ <e> <f> ];\n' +
          '  <g> [ <h> "i" ]\n' +
          '].\n' +
          '<a3> <b> [\n' +
          '  <d> [\n' +
          '  <g> [ <h> <i> ];\n' +
          '  <j> [ <k> "l" ]\n' +
          ']\n' +
          '].\n');
        done(error);
      });
    });

    it('should serialize triples with an empty blank node as subject', function (done) {
      var writer = N3Writer();
      writer.addTriple(writer.blank(), new NamedNode('b'), new NamedNode('c'));
      writer.addTriple(writer.blank([]), new NamedNode('b'), new NamedNode('c'));
      writer.end(function (error, output) {
        output.should.equal('[] <b> <c>.\n' +
                            '[] <b> <c>.\n');
        done(error);
      });
    });

    it('should serialize triples with a one-triple blank node as subject', function (done) {
      var writer = N3Writer();
      writer.addTriple(writer.blank(new NamedNode('a'), new NamedNode('b')), new NamedNode('c'), new NamedNode('d'));
      writer.addTriple(writer.blank({ predicate: new NamedNode('a'), object: new NamedNode('b') }), new NamedNode('c'), new NamedNode('d'));
      writer.addTriple(writer.blank([{ predicate: new NamedNode('a'), object: new NamedNode('b') }]), new NamedNode('c'), new NamedNode('d'));
      writer.end(function (error, output) {
        output.should.equal('[ <a> <b> ] <c> <d>.\n' +
                            '[ <a> <b> ] <c> <d>.\n' +
                            '[ <a> <b> ] <c> <d>.\n');
        done(error);
      });
    });

    it.skip('should serialize triples with an empty blank node as graph', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), writer.blank());
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), writer.blank([]));
      writer.end(function (error, output) {
        output.should.equal('[] {\n<a> <b> <c>\n}\n' +
                            '[] {\n<a> <b> <c>\n}\n');
        done(error);
      });
    });

    it('should serialize triples with an empty list as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a1'), new NamedNode('b'), writer.list());
      writer.addTriple(new NamedNode('a2'), new NamedNode('b'), writer.list([]));
      writer.end(function (error, output) {
        output.should.equal('<a1> <b> ().\n' +
                            '<a2> <b> ().\n');
        done(error);
      });
    });

    it('should serialize triples with a one-element list as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a1'), new NamedNode('b'), writer.list([new NamedNode('c')]));
      writer.addTriple(new NamedNode('a2'), new NamedNode('b'), writer.list([new Literal('"c"')]));
      writer.end(function (error, output) {
        output.should.equal('<a1> <b> (<c>).\n' +
                            '<a2> <b> ("c").\n');
        done(error);
      });
    });

    it('should serialize triples with a three-element list as object', function (done) {
      var writer = N3Writer();
      writer.addTriple(new NamedNode('a1'), new NamedNode('b'), writer.list([new NamedNode('c'), new NamedNode('d'), new NamedNode('e')]));
      writer.addTriple(new NamedNode('a2'), new NamedNode('b'), writer.list([new Literal('"c"'), new Literal('"d"'), new Literal('"e"')]));
      writer.end(function (error, output) {
        output.should.equal('<a1> <b> (<c> <d> <e>).\n' +
                            '<a2> <b> ("c" "d" "e").\n');
        done(error);
      });
    });

    it('should serialize triples with an empty list as subject', function (done) {
      var writer = N3Writer();
      writer.addTriple(writer.list(),   new NamedNode('b1'), new NamedNode('c'));
      writer.addTriple(writer.list([]), new NamedNode('b2'), new NamedNode('c'));
      writer.end(function (error, output) {
        output.should.equal('() <b1> <c>;\n' +
                            '    <b2> <c>.\n');
        done(error);
      });
    });

    it('should serialize triples with a one-element list as subject', function (done) {
      var writer = N3Writer();
      writer.addTriple(writer.list([new NamedNode('a')]), new NamedNode('b1'), new NamedNode('c'));
      writer.addTriple(writer.list([new NamedNode('a')]), new NamedNode('b2'), new NamedNode('c'));
      writer.end(function (error, output) {
        output.should.equal('(<a>) <b1> <c>;\n' +
                            '    <b2> <c>.\n');
        done(error);
      });
    });

    it('should serialize triples with a three-element list as subject', function (done) {
      var writer = N3Writer();
      writer.addTriple(writer.list([new NamedNode('a1'), new Literal('"b"'), new Literal('"c"')]), new NamedNode('d'), new NamedNode('e'));
      writer.end(function (error, output) {
        output.should.equal('(<a1> "b" "c") <d> <e>.\n');
        done(error);
      });
    });

    it('should accept triples in bulk', function (done) {
      var writer = N3Writer();
      writer.addTriples([new Triple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        new Triple(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'))]);
      writer.end(function (error, output) {
        output.should.equal('<a> <b> <c>, <d>.\n');
        done(error);
      });
    });

    it('should not allow writing after end', function (done) {
      var writer = N3Writer();
      writer.addTriple(new Triple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')));
      writer.end();
      writer.addTriple(new Triple(new NamedNode('d'), new NamedNode('e'), new NamedNode('f')), function (error) {
        error.should.be.an.instanceof(Error);
        error.should.have.property('message', 'Cannot write because the writer has been closed.');
        done();
      });
    });

    it('should write simple triples in N-Triples mode', function (done) {
      var writer = N3Writer({ format: 'N-Triples' });
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'));
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'));
      writer.end(function (error, output) {
        output.should.equal('<a> <b> <c>.\n<a> <b> <d>.\n');
        done(error);
      });
    });

    it('should write simple quads in N-Quads mode', function (done) {
      var writer = N3Writer({ format: 'N-Quads' });
      var called = false;
      function callback() { called = true; }
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), callback);
      writer.addTriple(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'), new NamedNode('g'));
      writer.end(function (error, output) {
        called.should.be.true;
        output.should.equal('<a> <b> <c>.\n<a> <b> <d> <g>.\n');
        done(error);
      });
    });

    it('should end when the end option is not set', function (done) {
      var outputStream = new QuickStream(), writer = N3Writer(outputStream, {});
      outputStream.should.have.property('ended', false);
      writer.end(function () {
        outputStream.should.have.property('ended', true);
        done();
      });
    });

    it('should end when the end option is set to true', function (done) {
      var outputStream = new QuickStream(), writer = N3Writer(outputStream, { end: true });
      outputStream.should.have.property('ended', false);
      writer.end(function () {
        outputStream.should.have.property('ended', true);
        done();
      });
    });

    it('should not end when the end option is set to false', function (done) {
      var outputStream = new QuickStream(), writer = N3Writer(outputStream, { end: false });
      outputStream.should.have.property('ended', false);
      writer.end(function () {
        outputStream.should.have.property('ended', false);
        done();
      });
    });
  });
});

function shouldSerialize(/* prefixes?, tripleArrays..., expectedResult */) {
  var tripleArrays = Array.prototype.slice.call(arguments),
      expectedResult = tripleArrays.pop(),
      prefixes = tripleArrays[0] instanceof Array ? null : tripleArrays.shift();

  return function (done) {
    var outputStream = new QuickStream(),
        writer = N3Writer(outputStream, prefixes);
    (function next() {
      var item = tripleArrays.shift();
      if (item)
        writer.addTriple(new Quad(Term.fromId(item[0]), Term.fromId(item[1]), Term.fromId(item[2]), Term.fromId(item[3])), next);
      else
        writer.end(function (error) {
          try {
            outputStream.result.should.equal(expectedResult);
            outputStream.should.have.property('ended', true);
            done(error);
          }
          catch (e) {
            done(e);
          }
        });
    })();
  };
}

function shouldNotSerialize(/* tripleArrays..., expectedResult */) {
  var tripleArrays = Array.prototype.slice.call(arguments),
      expectedMessage = tripleArrays.pop();

  return function (done) {
    var outputStream = new QuickStream(),
        writer = N3Writer(outputStream),
        item = tripleArrays.shift();
    writer.addTriple(new Quad(Term.fromId(item[0]), Term.fromId(item[1]), Term.fromId(item[2]), Term.fromId(item[3])),
                      function (error) {
                        if (error) {
                          error.message.should.equal(expectedMessage);
                          done();
                        }
                      });
  };
}

function QuickStream() {
  var stream = { ended: false }, buffer = '';
  stream.write = function (chunk, encoding, callback) {
    buffer += chunk;
    callback && callback();
  };
  stream.end = function (callback) {
    stream.ended = true;
    stream.result = buffer;
    buffer = null;
    callback();
  };
  return stream;
}
