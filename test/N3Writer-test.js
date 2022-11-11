import {
  Writer,
  NamedNode,
  BlankNode,
  Literal,
  Quad,
  termFromId,
} from '../src/';
import namespaces from '../src/IRIs';

const { xsd } = namespaces;

describe('Writer', () => {
  describe('The Writer export', () => {
    it('should be a function', () => {
      Writer.should.be.a('function');
    });

    it('should be a Writer constructor', () => {
      new Writer().should.be.an.instanceof(Writer);
    });
  });

  describe('A Writer instance', () => {
    it('should serialize a single triple', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')).should.equal('<a> <b> <c> .\n');
    });

    it('should serialize a single quad', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')).should.equal('<a> <b> <c> <g> .\n');
    });

    it('should serialize an array of triples', () => {
      const writer = new Writer();
      const triples = [new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        new Quad(new NamedNode('d'), new NamedNode('e'), new NamedNode('f'))];
      writer.quadsToString(triples).should.equal('<a> <b> <c> .\n<d> <e> <f> .\n');
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

    it('should serialize a true boolean literal',
      shouldSerialize(['a', 'b', `"true"^^${xsd.boolean}`],
                      '<a> <b> true.\n'));

    it('should serialize a false boolean literal',
      shouldSerialize(['a', 'b', `"false"^^${xsd.boolean}`],
                      '<a> <b> false.\n'));

    it('should serialize an invalid boolean literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.boolean}`],
                      `<a> <b> "invalid"^^<${xsd.boolean}>.\n`));

    it('should serialize an integer literal',
      shouldSerialize(['a', 'b', `"123"^^${xsd.integer}`],
                      '<a> <b> 123.\n'));

    it('should serialize a positive integer literal',
      shouldSerialize(['a', 'b', `"+123"^^${xsd.integer}`],
                      '<a> <b> +123.\n'));

    it('should serialize a negative integer literal',
      shouldSerialize(['a', 'b', `"-123"^^${xsd.integer}`],
                      '<a> <b> -123.\n'));

    it('should serialize an invalid integer literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.integer}`],
                      `<a> <b> "invalid"^^<${xsd.integer}>.\n`));

    it('should serialize a decimal literal',
      shouldSerialize(['a', 'b', `"123.456"^^${xsd.decimal}`],
                      '<a> <b> 123.456.\n'));

    it('should serialize a positive decimal literal',
      shouldSerialize(['a', 'b', `"+123.456"^^${xsd.decimal}`],
                      '<a> <b> +123.456.\n'));

    it('should serialize a negative decimal literal',
      shouldSerialize(['a', 'b', `"-123.456"^^${xsd.decimal}`],
                      '<a> <b> -123.456.\n'));

    it('should serialize an invalid decimal literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.decimal}`],
                      `<a> <b> "invalid"^^<${xsd.decimal}>.\n`));

    it('should serialize a double literal',
      shouldSerialize(['a', 'b', `"123.456E10"^^${xsd.double}`],
                      '<a> <b> 123.456E10.\n'));

    it('should serialize a positive double literal',
      shouldSerialize(['a', 'b', `"+123.456E10"^^${xsd.double}`],
                      '<a> <b> +123.456E10.\n'));

    it('should serialize a negative double literal',
      shouldSerialize(['a', 'b', `"-123.456E10"^^${xsd.double}`],
                      '<a> <b> -123.456E10.\n'));

    it('should serialize an invalid double literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.double}`],
                      `<a> <b> "invalid"^^<${xsd.double}>.\n`));

    it('should serialize blank nodes',
      shouldSerialize(['_:a', 'b', { termType: 'BlankNode', value: 'c' }],
                      '_:a <b> _:c.\n'));

    it('should not leave leading whitespace if the prefix set is empty',
      shouldSerialize({},
                      ['a', 'b', 'c'],
                      '<a> <b> <c>.\n'));

    it('should serialize prefixes',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: new NamedNode('http://a.org/b#'), c: 'http://a.org/c' } },
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n' +
                      '@prefix c: <http://a.org/c>.\n\n'));

    it('should use prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#', c: 'http://a.org/b' } },
                      ['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                      ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                      ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n' +
                      '@prefix c: <http://a.org/b>.\n\n' +
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

    it('calls the done callback when ending the outputstream errors', done => {
      const writer = new Writer({
        write: function () {},
        end: function () { throw new Error('error'); },
      });
      writer.end(done);
    });

    it('sends output through end when no stream argument is given', done => {
      const writer = new Writer();
      let notCalled = true;
      writer.addQuad(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), () => { notCalled = false; });
      writer.end((error, output) => {
        output.should.equal('<a> <b> <c>.\n');
        done(notCalled || error);
      });
    });

    it('respects the prefixes argument when no stream argument is given', done => {
      const writer = new Writer({ prefixes: { a: 'b#' } });
      writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
      writer.end((error, output) => {
        output.should.equal('@prefix a: <b#>.\n\na:a a:b a:c.\n');
        done(error);
      });
    });

    it('ignores an empty prefix list', done => {
      const writer = new Writer();
      writer.addPrefixes({});
      writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
      writer.end((error, output) => {
        output.should.equal('<b#a> <b#b> <b#c>.\n');
        done(error);
      });
    });

    it('should serialize triples of graph with prefix for local names that begin with underscore', done => {
      const writer = new Writer();
      writer.addPrefix('a', 'b#');
      writer.addQuad(new Quad(new NamedNode('b#_a'), new NamedNode('b#b'), new NamedNode('b#c'), new NamedNode('b#g')));
      writer.end((error, output) => {
        output.should.equal('@prefix a: <b#>.\n\na:g {\na:_a a:b a:c\n}\n');
        done(error);
      });
    });

    it('serializes triples of a graph with a prefix declaration in between', done => {
      const writer = new Writer();
      writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
      writer.addPrefix('a', 'b#');
      writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c'), new NamedNode('b#g')));
      writer.addPrefix('d', 'e#');
      writer.addQuad({ subject: new NamedNode('b#a'), predicate: new NamedNode('b#b'), object: new NamedNode('b#d'), graph: new NamedNode('b#g') });
      writer.end((error, output) => {
        output.should.equal('<b#a> <b#b> <b#c>.\n' +
                            '@prefix a: <b#>.\n\na:g {\na:a a:b a:c\n}\n' +
                            '@prefix d: <e#>.\n\na:g {\na:a a:b a:d\n}\n');
        done(error);
      });
    });

    it('should not write prefixes in N-Triples mode', done => {
      const writer = new Writer({ format: 'N-Triples', prefixes: { a: 'b#' } });
      let called = false;
      function callback() { called = true; }
      writer.addPrefix('c', 'd#');
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new Literal('"c"'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new Literal(`"1"^^${xsd.integer}`));
      writer.addPrefix('e', 'f#', callback);
      writer.end((error, output) => {
        called.should.be.true;
        output.should.equal(`<a> <b> "c" .\n<a> <b> "1"^^<${xsd.integer}> .\n`);
        done(error);
      });
    });

    it('uses a base IRI when given', done => {
      const writer = new Writer({ baseIRI: 'http://example.org/foo/' });
      writer.addQuad(new Quad(
        new NamedNode('http://example.org/foo/'),
        new NamedNode('http://example.org/foo/#b'),
        new NamedNode('http://example.org/foo/cdeFgh/ijk')));
      writer.end((error, output) => {
        output.should.equal('<> <#b> <cdeFgh/ijk>.\n');
        done(error);
      });
    });

    it('does not use partially match base IRIs', done => {
      const writer = new Writer({ baseIRI: 'https://pod.example/profile/card' });
      writer.addQuad(new Quad(
        new NamedNode('https://pod.example/profile/card#me'),
        new NamedNode('http://www.w3.org/2002/07/owl#sameAs'),
        new NamedNode('https://pod.example/profile/card-1234.ttl')));
      writer.end((error, output) => {
        output.should.equal('<#me> <http://www.w3.org/2002/07/owl#sameAs> <https://pod.example/profile/card-1234.ttl>.\n');
        done(error);
      });
    });

    it('should accept triples with separated components', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'));
      writer.end((error, output) => {
        output.should.equal('<a> <b> <c>, <d>.\n');
        done(error);
      });
    });

    it('should accept quads with separated components', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'), new NamedNode('g'));
      writer.end((error, output) => {
        output.should.equal('<g> {\n<a> <b> <c>, <d>\n}\n');
        done(error);
      });
    });

    it('should serialize triples with an empty blank node as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.blank());
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.blank([]));
      writer.end((error, output) => {
        output.should.equal('<a1> <b> [].\n' +
                            '<a2> <b> [].\n');
        done(error);
      });
    });

    it('should serialize triples with a one-triple blank node as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.blank(new NamedNode('d'), new NamedNode('e')));
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.blank({ predicate: new NamedNode('d'), object: new NamedNode('e') }));
      writer.addQuad(new NamedNode('a3'), new NamedNode('b'), writer.blank([{ predicate: new NamedNode('d'), object: new NamedNode('e') }]));
      writer.end((error, output) => {
        output.should.equal('<a1> <b> [ <d> <e> ].\n' +
                            '<a2> <b> [ <d> <e> ].\n' +
                            '<a3> <b> [ <d> <e> ].\n');
        done(error);
      });
    });

    it('should serialize triples with a two-triple blank node as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), writer.blank([
          { predicate: new NamedNode('d'), object: new NamedNode('e') },
          { predicate: new NamedNode('f'), object: new Literal('"g"') },
      ]));
      writer.end((error, output) => {
        output.should.equal('<a> <b> [\n' +
                            '  <d> <e>;\n' +
                            '  <f> "g"\n' +
                            '].\n');
        done(error);
      });
    });

    it('should serialize triples with a three-triple blank node as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: new NamedNode('e') },
        { predicate: new NamedNode('f'), object: new Literal('"g"') },
        { predicate: new NamedNode('h'), object: new NamedNode('i') },
      ]));
      writer.end((error, output) => {
        output.should.equal('<a> <b> [\n' +
                            '  <d> <e>;\n' +
                            '  <f> "g";\n' +
                            '  <h> <i>\n' +
                            '].\n');
        done(error);
      });
    });

    it('should serialize triples with predicate-sharing blank node triples as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: new NamedNode('e') },
        { predicate: new NamedNode('d'), object: new NamedNode('f') },
        { predicate: new NamedNode('g'), object: new NamedNode('h') },
        { predicate: new NamedNode('g'), object: new NamedNode('i') },
      ]));
      writer.end((error, output) => {
        output.should.equal('<a> <b> [\n' +
          '  <d> <e>, <f>;\n' +
          '  <g> <h>, <i>\n' +
          '].\n');
        done(error);
      });
    });

    it('should serialize triples with nested blank nodes as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: writer.blank() },
      ]));
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: writer.blank(new NamedNode('e'), new NamedNode('f')) },
        { predicate: new NamedNode('g'), object: writer.blank(new NamedNode('h'), new Literal('"i"')) },
      ]));
      writer.addQuad(new NamedNode('a3'), new NamedNode('b'), writer.blank([
        { predicate: new NamedNode('d'), object: writer.blank([
          { predicate: new NamedNode('g'), object: writer.blank(new NamedNode('h'), new NamedNode('i')) },
          { predicate: new NamedNode('j'), object: writer.blank(new NamedNode('k'), new Literal('"l"')) },
        ]) },
      ]));
      writer.end((error, output) => {
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

    it('should serialize triples with an empty blank node as subject', done => {
      const writer = new Writer();
      writer.addQuad(writer.blank(), new NamedNode('b'), new NamedNode('c'));
      writer.addQuad(writer.blank([]), new NamedNode('b'), new NamedNode('c'));
      writer.end((error, output) => {
        output.should.equal('[] <b> <c>.\n' +
                            '[] <b> <c>.\n');
        done(error);
      });
    });

    it('should serialize triples with a one-triple blank node as subject', done => {
      const writer = new Writer();
      writer.addQuad(writer.blank(new NamedNode('a'), new NamedNode('b')), new NamedNode('c'), new NamedNode('d'));
      writer.addQuad(writer.blank({ predicate: new NamedNode('a'), object: new NamedNode('b') }), new NamedNode('c'), new NamedNode('d'));
      writer.addQuad(writer.blank([{ predicate: new NamedNode('a'), object: new NamedNode('b') }]), new NamedNode('c'), new NamedNode('d'));
      writer.end((error, output) => {
        output.should.equal('[ <a> <b> ] <c> <d>.\n' +
                            '[ <a> <b> ] <c> <d>.\n' +
                            '[ <a> <b> ] <c> <d>.\n');
        done(error);
      });
    });

    it('should serialize triples with an empty blank node as graph', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), writer.blank());
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), writer.blank([]));
      writer.end((error, output) => {
        output.should.equal('[] {\n<a> <b> <c>\n}\n' +
                            '[] {\n<a> <b> <c>\n}\n');
        done(error);
      });
    });

    it('should serialize triples with an empty list as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.list());
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.list([]));
      writer.end((error, output) => {
        output.should.equal('<a1> <b> ().\n' +
                            '<a2> <b> ().\n');
        done(error);
      });
    });

    it('should serialize triples with a one-element list as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.list([new NamedNode('c')]));
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.list([new Literal('"c"')]));
      writer.end((error, output) => {
        output.should.equal('<a1> <b> (<c>).\n' +
                            '<a2> <b> ("c").\n');
        done(error);
      });
    });

    it('should serialize triples with a three-element list as object', done => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.list([new NamedNode('c'), new NamedNode('d'), new NamedNode('e')]));
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.list([new Literal('"c"'), new Literal('"d"'), new Literal('"e"')]));
      writer.end((error, output) => {
        output.should.equal('<a1> <b> (<c> <d> <e>).\n' +
                            '<a2> <b> ("c" "d" "e").\n');
        done(error);
      });
    });

    it('should serialize triples with an empty list as subject', done => {
      const writer = new Writer();
      writer.addQuad(writer.list(),   new NamedNode('b1'), new NamedNode('c'));
      writer.addQuad(writer.list([]), new NamedNode('b2'), new NamedNode('c'));
      writer.end((error, output) => {
        output.should.equal('() <b1> <c>.\n' +
                            '() <b2> <c>.\n');
        done(error);
      });
    });

    it('should serialize triples with a one-element list as subject', done => {
      const writer = new Writer();
      writer.addQuad(writer.list([new NamedNode('a')]), new NamedNode('b1'), new NamedNode('c'));
      writer.addQuad(writer.list([new NamedNode('a')]), new NamedNode('b2'), new NamedNode('c'));
      writer.end((error, output) => {
        output.should.equal('(<a>) <b1> <c>.\n' +
                            '(<a>) <b2> <c>.\n');
        done(error);
      });
    });

    it('should serialize triples with a three-element list as subject', done => {
      const writer = new Writer();
      writer.addQuad(writer.list([new NamedNode('a1'), new Literal('"b"'), new Literal('"c"')]), new NamedNode('d'), new NamedNode('e'));
      writer.end((error, output) => {
        output.should.equal('(<a1> "b" "c") <d> <e>.\n');
        done(error);
      });
    });

    it('should serialize subject and object triples passed by options.listHeads', done => {
      const lists = {
        l1: [new NamedNode('c'), new NamedNode('d'), new NamedNode('e')],
        l2: [new Literal('c'), new Literal('d'), new Literal('e')],
      };

      const writer = new Writer({ lists });
      writer.addQuad(new BlankNode('l1'), new NamedNode('b'), new BlankNode('l2'));
      writer.addQuad(new NamedNode('a3'), new NamedNode('b'), new BlankNode('m3'));
      writer.end((error, output) => {
        output.should.equal('(<c> <d> <e>) <b> ("c" "d" "e").\n' +
          '<a3> <b> _:m3.\n');
        done(error);
      });
    });

    it('should accept triples in bulk', done => {
      const writer = new Writer();
      writer.addQuads([new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'))]);
      writer.end((error, output) => {
        output.should.equal('<a> <b> <c>, <d>.\n');
        done(error);
      });
    });

    it('should not allow writing after end', done => {
      const writer = new Writer();
      writer.addQuad(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')));
      writer.end();
      writer.addQuad(new Quad(new NamedNode('d'), new NamedNode('e'), new NamedNode('f')), error => {
        error.should.be.an.instanceof(Error);
        error.should.have.property('message', 'Cannot write because the writer has been closed.');
        done();
      });
    });

    it('should write simple triples in N-Quads mode', done => {
      const writer = new Writer({ format: 'N-Quads' });
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'));
      writer.end((error, output) => {
        output.should.equal('<a> <b> <c> .\n<a> <b> <d> .\n');
        done(error);
      });
    });

    it('should write simple quads in N-Quads mode', done => {
      const writer = new Writer({ format: 'N-Quads' });
      let called = false;
      function callback() { called = true; }
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), callback);
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'), new NamedNode('g'));
      writer.end((error, output) => {
        called.should.be.true;
        output.should.equal('<a> <b> <c> .\n<a> <b> <d> <g> .\n');
        done(error);
      });
    });

    it('should end when the end option is not set', done => {
      const outputStream = new QuickStream(), writer = new Writer(outputStream, {});
      outputStream.should.have.property('ended', false);
      writer.end(() => {
        outputStream.should.have.property('ended', true);
        done();
      });
    });

    it('should end when the end option is set to true', done => {
      const outputStream = new QuickStream(), writer = new Writer(outputStream, { end: true });
      outputStream.should.have.property('ended', false);
      writer.end(() => {
        outputStream.should.have.property('ended', true);
        done();
      });
    });

    it('should not end when the end option is set to false', done => {
      const outputStream = new QuickStream(), writer = new Writer(outputStream, { end: false });
      outputStream.should.have.property('ended', false);
      writer.end(() => {
        outputStream.should.have.property('ended', false);
        done();
      });
    });

    it('should serialize a triple with a triple with mixed component types as subject', () => {
      const writer = new Writer();
      writer.quadToString(new Quad(new BlankNode('b1'), new NamedNode('b'), new Literal('l1')), new NamedNode('b'), new NamedNode('c')).should.equal('<<_:b1 <b> "l">> <b> <c> .\n');
    });

    it('should serialize a triple with a triple with iris as subject', () => {
      const writer = new Writer();
      writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), new NamedNode('b'), new NamedNode('c')).should.equal('<<<a> <b> <c>>> <b> <c> .\n');
    });

    it('should serialize a triple with a triple with blanknodes as subject', () => {
      const writer = new Writer();
      writer.quadToString(new Quad(new BlankNode('b1'), new BlankNode('b2'), new BlankNode('b3')), new NamedNode('b'), new NamedNode('c')).should.equal('<<_:b1 _:b2 _:b3>> <b> <c> .\n');
    });

    it('should serialize a triple with a triple as object', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new BlankNode('b1'), new NamedNode('b'), new Literal('l1'))).should.equal('<a> <b> <<_:b1 <b> "l">> .\n');
    });

    it('should serialize a triple with a triple with iris as object', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'))).should.equal('<a> <b> <<<a> <b> <c>>> .\n');
    });

    it('should serialize a triple with a triple with blanknodes as object', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new BlankNode('b1'), new BlankNode('b2'), new BlankNode('b3'))).should.equal('<a> <b> <<_:b1 _:b2 _:b3>> .\n');
    });

    it('should serialize a quad with a triple with mixed component types as subject', () => {
      const writer = new Writer();
      writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')).should.equal('<<<a> <b> <c>>> <b> <c> <g> .\n');
    });

    it('should serialize a quad with a triple as object', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), new NamedNode('g')).should.equal('<a> <b> <<<a> <b> <c>>> <g> .\n');
    });

    it('should serialize a quad with a quad as subject', () => {
      const writer = new Writer();
      writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')).should.equal('<<<a> <b> <c> <g>>> <b> <c> <g> .\n');
    });

    it('should serialize a quad with a quad as object', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')), new NamedNode('g')).should.equal('<a> <b> <<<a> <b> <c> <g>>> <g> .\n');
    });

    it('should serialize a triple with a quad as subject', () => {
      const writer = new Writer();
      writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')), new NamedNode('b'), new NamedNode('c')).should.equal('<<<a> <b> <c> <g>>> <b> <c> .\n');
    });

    it('should serialize a triple with a quad as object', () => {
      const writer = new Writer();
      writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g'))).should.equal('<a> <b> <<<a> <b> <c> <g>>> .\n');
    });
  });
});

function shouldSerialize(/* prefixes?, tripleArrays..., expectedResult */) {
  const tripleArrays = Array.prototype.slice.call(arguments),
      expectedResult = tripleArrays.pop(),
      prefixes = tripleArrays[0] instanceof Array ? null : tripleArrays.shift();

  return function (done) {
    const outputStream = new QuickStream(),
        writer = new Writer(outputStream, prefixes);
    (function next() {
      const item = tripleArrays.shift();
      if (item) {
        const subject   = typeof item[0] === 'string' ? termFromId(item[0]) : item[0];
        const predicate = typeof item[1] === 'string' ? termFromId(item[1]) : item[1];
        const object    = typeof item[2] === 'string' ? termFromId(item[2]) : item[2];
        const graph     = typeof item[3] === 'string' ? termFromId(item[3]) : item[3];
        writer.addQuad(new Quad(subject, predicate, object, graph), next);
      }
      else
        writer.end(error => {
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

function QuickStream() {
  const stream = { ended: false };
  let buffer = '';
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
