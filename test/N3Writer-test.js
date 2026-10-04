import {
  Writer,
  Parser,
  NamedNode,
  BlankNode,
  Literal,
  Quad,
  Variable,
  termFromId,
} from '../src';
import namespaces from '../src/IRIs';
import { isomorphic } from 'rdf-isomorphic';

const { xsd, rdf } = namespaces;

// Ends the writer, resolving with its output or rejecting with its error
function end(writer) {
  return new Promise((resolve, reject) => {
    writer.end((error, output) => error ? reject(error) : resolve(output));
  });
}

describe('Writer', () => {
  describe('The Writer export', () => {
    it('should be a function', () => {
      expect(Writer).toBeInstanceOf(Function);
    });

    it('should be a Writer constructor', () => {
      expect(new Writer()).toBeInstanceOf(Writer);
    });
  });

  describe('A Writer writing N3 formulas', () => {
    // Groups parsed N3 quads into top-level statements and formula contents
    function splitFormulas(quads) {
      const formulas = {}, statements = [];
      for (const quad of quads) {
        if (quad.graph.termType === 'BlankNode')
          (formulas[quad.graph.value] || (formulas[quad.graph.value] = [])).push(quad);
        else
          statements.push(quad);
      }
      return { formulas, statements };
    }

    // Shuffles quads deterministically for the given seed
    function shuffle(quads, seed) {
      const shuffled = quads.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        const j = seed % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    async function roundTrip(document, seed) {
      const quads = new Parser({ format: 'N3' }).parse(document);
      const { formulas, statements } = splitFormulas(seed ? shuffle(quads, seed) : quads);
      const writer = new Writer({ format: 'N3', formulas });
      writer.addQuads(statements);
      const output = await end(writer);
      return { quads, output, reparsed: new Parser({ format: 'N3' }).parse(output) };
    }

    it('should write the formulas of a rule', async () => {
      const { quads, output, reparsed } = await roundTrip('{ ?s a ?o } => { ?s a ?o }.');
      expect(output).toBe('{ ?s a ?o } <http://www.w3.org/2000/10/swap/log#implies> { ?s a ?o }.\n');
      expect(isomorphic(reparsed, quads)).toBe(true);
    });

    it('should write nested formulas and formulas with several statements', async () => {
      const document = '@prefix : <http://ex.org/>. :a :says { :b :c :d. :e :f { :g :h "i"@en } }.';
      const { quads, output, reparsed } = await roundTrip(document);
      expect(output).toBe('<http://ex.org/a> <http://ex.org/says> { <http://ex.org/b> <http://ex.org/c> <http://ex.org/d>. ' +
        '<http://ex.org/e> <http://ex.org/f> { <http://ex.org/g> <http://ex.org/h> "i"@en } }.\n');
      expect(isomorphic(reparsed, quads)).toBe(true);
    });

    it('should keep a blank node shared by two statements in one formula', async () => {
      const document = '@prefix : <http://ex.org/>. :a :says { _:x :p :o. _:x :q :r }.';
      const { quads, output, reparsed } = await roundTrip(document);
      expect(output).toMatch(/^<http:\/\/ex.org\/a> <http:\/\/ex.org\/says> \{ _:[^ ]+ <http:\/\/ex.org\/p> <http:\/\/ex.org\/o>; <http:\/\/ex.org\/q> <http:\/\/ex.org\/r> \}.\n$/);
      expect(isomorphic(reparsed, quads)).toBe(true);
      // A copy whose blank nodes are distinct is not isomorphic
      const [first, second] = reparsed.filter(quad => quad.subject.termType === 'BlankNode');
      const split = reparsed.map(quad => quad === second ?
        new Quad(new BlankNode('other'), quad.predicate, quad.object, quad.graph) : quad);
      expect(first).toBeDefined();
      expect(isomorphic(split, quads)).toBe(false);
    });

    it('should write formulas whose quads arrive in any order', async () => {
      const documents = [
        '@prefix : <http://ex.org/>. { ?x :p ?y. ?y :q ?z. { ?z :r ?x } => { ?x :s ?z } } => ' +
          '{ ?x :t ?z. ?z :u { ?x :v "w"@en } }.',
        '@prefix : <http://ex.org/>. :a :says { _:x :p :o. _:x :q { _:y :r _:x } }. ' +
          '{ :c :d :e } :f { :g :h :i }. :j :k ({ :l :m :n } { :o :p :q }).',
      ];
      for (const document of documents) {
        for (let seed = 1; seed <= 10; seed++) {
          const { quads, reparsed } = await roundTrip(document, seed);
          expect(isomorphic(reparsed, quads)).toBe(true);
        }
      }
    });

    it('should write a document with many formulas in any order', async () => {
      let document = '@prefix : <http://ex.org/>.\n';
      for (let i = 0; i < 200; i++) {
        document += `{ ?x :p${i % 7} ?y. ?y :q :o${i} } => { ?x :r${i} ?y. :n${i} :says { ?y :s { :d${i} :e _:b${i} } } }.\n`;
        document += `:s${i} :t { :a :b ${i}. :c :d { :e :f "x${i}" } }.\n`;
      }
      for (let seed = 1; seed <= 3; seed++) {
        const { quads, output, reparsed } = await roundTrip(document, seed);
        expect(output.match(/\{/g)).toHaveLength(1200);
        expect(isomorphic(reparsed, quads)).toBe(true);
      }
    });

    it('should write a formula that is the subject of several statements once', async () => {
      const documents = [
        '<urn:s> <urn:p> { { <urn:a> <urn:b> <urn:c> } <urn:p> <urn:d>; <urn:q> <urn:e> }.',
        '{ <urn:a> <urn:b> <urn:c> } <urn:p> <urn:d>; <urn:q> <urn:e>. <urn:x> <urn:y> <urn:z>.',
      ];
      for (const document of documents) {
        for (let seed = 0; seed <= 10; seed++) {
          const { quads, output, reparsed } = await roundTrip(document, seed);
          expect(output.match(/<urn:a>/g)).toHaveLength(1);
          expect(reparsed).toHaveLength(quads.length);
          expect(isomorphic(reparsed, quads)).toBe(true);
        }
      }
    });

    it('should write a formula that is the object of several statements once', async () => {
      const documents = [
        '{ <urn:a> <urn:b> <urn:c> } is <urn:p> of <urn:s>, <urn:t>.',
        '{ <urn:a> <urn:b> <urn:c> } is a of <urn:s>, <urn:t>; <urn:q> <urn:r>.',
        '<urn:x> <urn:y> { { <urn:a> <urn:b> <urn:c> } is <urn:p> of { <urn:d> <urn:e> <urn:f> }, <urn:t> }.',
      ];
      for (const document of documents) {
        for (let seed = 0; seed <= 10; seed++) {
          const { quads, output, reparsed } = await roundTrip(document, seed);
          expect(output.match(/<urn:a>/g)).toHaveLength(1);
          expect(reparsed).toHaveLength(quads.length);
          expect(isomorphic(reparsed, quads)).toBe(true);
        }
      }
    });

    // Generates a random N3 document with formulas in every position,
    // inside lists, nested, and shared through inverse verbs and object lists
    function randomDocument(random) {
      function pick(n) { return Math.floor(random() * n); }
      function iri() { return `<urn:${'abcdef'[pick(6)]}>`; }
      function formula(depth) { return `{ ${statements(depth)} }`; }
      function repeat(generate, separator) {
        const items = [];
        for (let i = pick(3); i >= 0; i--) items.push(generate());
        return items.join(separator);
      }
      function term(depth, list = true) {
        const r = random();
        if (depth > 0 && r < 0.3) return formula(depth - 1);
        if (list && r < 0.4) return `(${term(depth, false)} ${term(depth, false)})`;
        return r < 0.5 ? `?${'xy'[pick(2)]}` : iri();
      }
      function verb(depth, inverse) {
        const r = random();
        if (depth > 0 && r < 0.15) return formula(depth - 1);
        return !inverse && r < 0.3 ? 'a' : iri();
      }
      function objects(depth) { return repeat(() => random() < 0.2 ? '"l"' : term(depth), ', '); }
      function predicateObjects(depth) {
        return repeat(() => random() < 0.3 ?
          `is ${verb(depth, true)} of ${objects(depth)}` : `${verb(depth)} ${objects(depth)}`, '; ');
      }
      function statements(depth) { return repeat(() => `${term(depth)} ${predicateObjects(depth)}`, '. '); }
      return `${statements(2)}.`;
    }

    it('should write random documents with formulas in any order', async () => {
      for (let seed = 1; seed <= 30; seed++) {
        let state = seed;
        const document = randomDocument(() => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
        for (const order of [0, seed]) {
          const { quads, output, reparsed } = await roundTrip(document, order);
          // Every formula is written exactly once
          const formulas = new Set(quads.filter(quad => quad.graph.termType === 'BlankNode').map(quad => quad.graph.value));
          expect((output.match(/\{/g) || []).length).toBe(formulas.size);
          expect(reparsed).toHaveLength(quads.length);
          expect(isomorphic(reparsed, quads)).toBe(true);
        }
      }
    });

    it('should write a formula that is the subject and the object of statements once', async () => {
      const documents = [
        '{ <urn:a> <urn:b> <urn:c> } <urn:p> <urn:o>; is <urn:q> of <urn:s>.',
        '<urn:s> is { <urn:a> <urn:b> <urn:c> } of <urn:o>, <urn:r>.',
        '<urn:s> { <urn:a> <urn:b> <urn:c> } <urn:o>, <urn:r>.',
      ];
      for (const document of documents) {
        for (let seed = 0; seed <= 10; seed++) {
          const { quads, output, reparsed } = await roundTrip(document, seed);
          expect(output.match(/<urn:a>/g)).toHaveLength(1);
          expect(reparsed).toHaveLength(quads.length);
          expect(isomorphic(reparsed, quads)).toBe(true);
        }
      }
    });

    it('should write deeply nested formulas inside lists', async () => {
      const depth = 10000, formulas = {}, lists = {}, p = new NamedNode('urn:p');
      for (let i = 0; i < depth; i++) {
        formulas[`f${i}`] = [new Quad(p, p, i + 1 < depth ? new BlankNode(`l${i}`) : p)];
        lists[`l${i}`] = [new BlankNode(`f${i + 1}`)];
      }
      const writer = new Writer({ format: 'N3', formulas, lists });
      writer.addQuad(p, p, new BlankNode('f0'));
      const output = await end(writer);
      expect(output).toBe(`<urn:p> <urn:p> ${'{ <urn:p> <urn:p> ('.repeat(depth - 1)}{ <urn:p> <urn:p> <urn:p> }${') }'.repeat(depth - 1)}.\n`);
    });

    it('should write formulas inside quoted triples inside formulas', async () => {
      const p = new NamedNode('urn:p');
      const formulas = { f: [new Quad(p, p, new Quad(p, p, new BlankNode('g')))], g: [new Quad(p, p, p)] };
      const writer = new Writer({ format: 'N3', formulas });
      writer.addQuad(p, p, new BlankNode('f'));
      expect(await end(writer)).toBe('<urn:p> <urn:p> { <urn:p> <urn:p> <<(<urn:p> <urn:p> { <urn:p> <urn:p> <urn:p> })>> }.\n');
    });

    it('should not accept statements with formulas after the end', async () => {
      const writer = new Writer({ format: 'N3', formulas: { f: [] } });
      await end(writer);
      const done = jest.fn();
      writer.addQuad(new BlankNode('f'), new NamedNode('urn:p'), new NamedNode('urn:o'), done);
      expect(done).toHaveBeenCalledWith(new Error('Cannot write because the writer has been closed.'));
    });

    it('should write deeply nested formulas in predicate position', async () => {
      const depth = 20000, formulas = {}, p = new NamedNode('urn:p');
      for (let i = 0; i < depth; i++)
        formulas[`f${i}`] = [new Quad(p, i + 1 < depth ? new BlankNode(`f${i + 1}`) : p, p)];
      const writer = new Writer({ format: 'N3', formulas });
      writer.addQuad(p, new BlankNode('f0'), p);
      const output = await end(writer);
      expect(output).toBe(`<urn:p> ${'{ <urn:p> '.repeat(depth)}<urn:p>${' <urn:p> }'.repeat(depth)} <urn:p>.\n`);
    });

    it('should not group distinct pretty-printed subjects in a formula', () => {
      const writer = new Writer({ format: 'N3' }), p = new NamedNode('urn:p');
      const formula = writer.formula([new Quad(writer.blank(), p, p), new Quad(writer.blank(), p, p)]);
      expect(formula.id).toBe('{ [] <urn:p> <urn:p>. [] <urn:p> <urn:p> }');
    });

    it('should write deeply nested formulas', async () => {
      const depth = 20000, formulas = {}, p = new NamedNode('urn:p');
      for (let i = 0; i < depth; i++)
        formulas[`f${i}`] = [new Quad(p, p, i + 1 < depth ? new BlankNode(`f${i + 1}`) : p)];
      const writer = new Writer({ format: 'N3', formulas });
      writer.addQuad(p, p, new BlankNode('f0'));
      const output = await end(writer);
      expect(output).toBe(`<urn:p> <urn:p> ${'{ <urn:p> <urn:p> '.repeat(depth)}<urn:p>${' }'.repeat(depth)}.\n`);
    });

    it('should write formulas inside lists inside formulas', async () => {
      const p = new NamedNode('urn:p');
      const formulas = { f: [new Quad(p, p, new BlankNode('l'))], g: [new Quad(p, p, p)] };
      const writer = new Writer({ format: 'N3', formulas, lists: { l: [new BlankNode('g')] } });
      writer.addQuad(p, p, new BlankNode('f'));
      expect(await end(writer)).toBe('<urn:p> <urn:p> { <urn:p> <urn:p> ({ <urn:p> <urn:p> <urn:p> }) }.\n');
    });

    it('should not group formula statements about literals or quoted triples', async () => {
      const p = new NamedNode('urn:p'), writer = new Writer({ format: 'N3' });
      const formula = writer.formula([new Quad(new Literal('"x"'), p, p), new Quad(new Literal('"x"'), p, p),
        new Quad(new Quad(p, p, p), p, p)]);
      expect(formula.id).toBe('{ "x" <urn:p> <urn:p>. "x" <urn:p> <urn:p>. <<(<urn:p> <urn:p> <urn:p>)>> <urn:p> <urn:p> }');
    });

    it('should create formulas manually', async () => {
      const writer = new Writer({ format: 'N3', prefixes: { '': 'http://ex.org/' } });
      writer.addQuad(writer.formula([new Quad(new NamedNode('http://ex.org/a'), new NamedNode('http://ex.org/b'),
        new NamedNode('http://ex.org/c'))]), new NamedNode('http://ex.org/is'), writer.formula([]));
      expect(await end(writer)).toBe('@prefix : <http://ex.org/>.\n\n{ :a :b :c } :is {}.\n');
      expect(writer.formula()).toEqual(writer.formula([]));
    });

    it('should only expand blank nodes whose labels are formulas of their own', async () => {
      const writer = new Writer({ format: 'N3', formulas: { f: [] } });
      writer.addQuad(new Variable('f'), new NamedNode('http://ex.org/p'), new BlankNode('toString'));
      writer.addQuad(new BlankNode('constructor'), new NamedNode('http://ex.org/p'), new BlankNode('f'));
      expect(await end(writer)).toBe('?f <http://ex.org/p> _:toString.\n_:constructor <http://ex.org/p> {}.\n');
    });

    it('should not expand a formula inside itself', async () => {
      const p = new NamedNode('http://ex.org/p');
      const formulas = { f: [new Quad(new Variable('f'), p, new BlankNode('f'))] };
      const writer = new Writer({ format: 'N3', formulas });
      writer.addQuad(new NamedNode('http://ex.org/s'), p, new BlankNode('f'));
      expect(await end(writer)).toBe('<http://ex.org/s> <http://ex.org/p> { ?f <http://ex.org/p> _:f }.\n');
    });

    it('should leave blank nodes that are no formula unchanged', async () => {
      const writer = new Writer({ format: 'N3', formulas: {} });
      writer.addQuad(new BlankNode('b'), new NamedNode('http://ex.org/p'), new BlankNode('c'));
      expect(await end(writer)).toBe('_:b <http://ex.org/p> _:c.\n');
    });
  });

  describe('A Writer instance', () => {
    it('should serialize a single triple', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
      ).toBe('<a> <b> <c> .\n');
    });

    it('should serialize a single quad', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')),
      ).toBe('<a> <b> <c> <g> .\n');
    });

    it('should serialize a quad with an empty named node as graph', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('')),
      ).toBe('<a> <b> <c> <> .\n');
    });

    it('should serialize a triple with empty named nodes', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode(''), new NamedNode(''), new NamedNode('')),
      ).toBe('<> <> <> .\n');
    });

    it('should serialize an array of triples', () => {
      const writer = new Writer();
      const triples = [new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        new Quad(new NamedNode('d'), new NamedNode('e'), new NamedNode('f'))];
      expect(writer.quadsToString(triples)).toBe('<a> <b> <c> .\n<d> <e> <f> .\n');
    });

    it('should serialize a blank node from another library through its term type', () => {
      const writer = new Writer();
      const blankNode = { termType: 'BlankNode', value: 'b1', id: 'not-a-blank-node-id' };
      expect(
        writer.quadToString(blankNode, new NamedNode('b'), blankNode, blankNode),
      ).toBe('_:b1 <b> _:b1 _:b1 .\n');
    });

    it('should serialize a variable from another library through its term type', () => {
      const writer = new Writer();
      const variable = { termType: 'Variable', value: 'v' };
      expect(
        writer.quadToString(variable, new NamedNode('b'), variable),
      ).toBe('?v <b> ?v .\n');
    });

    it('should serialize 0 triples', shouldSerialize(''));

    it('should serialize 1 triple', shouldSerialize(['abc', 'def', 'ghi'],
                    '<abc> <def> <ghi>.\n'));

    it('should serialize 2 triples', shouldSerialize(['abc', 'def', 'ghi'],
                    ['jkl', 'mno', 'pqr'],
                    '<abc> <def> <ghi>.\n' +
                    '<jkl> <mno> <pqr>.\n'));

    it('should serialize 3 triples', shouldSerialize(['abc', 'def', 'ghi'],
                    ['jkl', 'mno', 'pqr'],
                    ['stu', 'vwx', 'yz'],
                    '<abc> <def> <ghi>.\n' +
                    '<jkl> <mno> <pqr>.\n' +
                    '<stu> <vwx> <yz>.\n'));

    it('should serialize a literal', shouldSerialize(['a', 'b', '"cde"'],
                    '<a> <b> "cde".\n'));

    it(
      'should serialize a literal with a type',
      shouldSerialize(['a', 'b', '"cde"^^fgh'],
                      '<a> <b> "cde"^^<fgh>.\n'),
    );

    it(
      'should serialize a literal with a language',
      shouldSerialize(['a', 'b', '"cde"@en-us'],
                      '<a> <b> "cde"@en-us.\n'),
    );

    it(
        'should serialize a literal with a language and direction',
        shouldSerialize(['a', 'b', '"cde"@en-us--ltr'],
            '<a> <b> "cde"@en-us--ltr.\n'),
    );

    it(
        'should serialize a literal containing "--" with a language',
        shouldSerialize(['a', 'b', '"bla bla -- more bla bla"@en'],
            '<a> <b> "bla bla -- more bla bla"@en.\n'),
    );

    // e.g. http://vocab.getty.edu/aat/300264727.ttl
    it(
      'should serialize a literal with an artificial language',
      shouldSerialize(['a', 'b', '"cde"@qqq-002'],
                       '<a> <b> "cde"@qqq-002.\n'),
    );

    it(
      'should serialize a literal containing a single quote',
      shouldSerialize(['a', 'b', '"c\'de"'],
                      '<a> <b> "c\'de".\n'),
    );

    it(
      'should serialize a literal containing a double quote',
      shouldSerialize(['a', 'b', '"c"de"'],
                      '<a> <b> "c\\"de".\n'),
    );

    it(
      'should serialize a literal containing a backspace',
      shouldSerialize(['a', 'b', '"c\\de"'],
                      '<a> <b> "c\\\\de".\n'),
    );

    it(
      'should serialize a literal containing a tab character',
      shouldSerialize(['a', 'b', '"c\tde"'],
                      '<a> <b> "c\\tde".\n'),
    );

    it(
      'should serialize a literal containing a newline character',
      shouldSerialize(['a', 'b', '"c\nde"'],
                      '<a> <b> "c\\nde".\n'),
    );

    it(
      'should serialize a literal containing a cariage return character',
      shouldSerialize(['a', 'b', '"c\rde"'],
                      '<a> <b> "c\\rde".\n'),
    );

    it(
      'should serialize a literal containing a backspace character',
      shouldSerialize(['a', 'b', '"c\bde"'],
                      '<a> <b> "c\\bde".\n'),
    );

    it(
      'should serialize a literal containing a form feed character',
      shouldSerialize(['a', 'b', '"c\fde"'],
                      '<a> <b> "c\\fde".\n'),
    );

    it(
      'should serialize a literal containing a line separator',
      shouldSerialize(['a', 'b', '"c\u2028de"'],
                      '<a> <b> "c\u2028de".\n'),
    );

    it(
      'should serialize a literal containing a paragraph separator',
      shouldSerialize(['a', 'b', '"c\u2029de"'],
                      '<a> <b> "c\u2029de".\n'),
    );

    it(
      'should serialize a literal containing special unicode characters',
      shouldSerialize(['a', 'b', '"c\u0000\u0001"'],
                      '<a> <b> "c\\u0000\\u0001".\n'),
    );

    it(
      'should serialize a true boolean literal',
      shouldSerialize(['a', 'b', `"true"^^${xsd.boolean}`],
                      '<a> <b> true.\n'),
    );

    it(
      'should serialize a false boolean literal',
      shouldSerialize(['a', 'b', `"false"^^${xsd.boolean}`],
                      '<a> <b> false.\n'),
    );

    it(
      'should serialize an invalid boolean literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.boolean}`],
                      `<a> <b> "invalid"^^<${xsd.boolean}>.\n`),
    );

    it(
      'should serialize an integer literal',
      shouldSerialize(['a', 'b', `"123"^^${xsd.integer}`],
                      '<a> <b> 123.\n'),
    );

    it(
      'should serialize a positive integer literal',
      shouldSerialize(['a', 'b', `"+123"^^${xsd.integer}`],
                      '<a> <b> +123.\n'),
    );

    it(
      'should serialize a negative integer literal',
      shouldSerialize(['a', 'b', `"-123"^^${xsd.integer}`],
                      '<a> <b> -123.\n'),
    );

    it(
      'should serialize an invalid integer literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.integer}`],
                      `<a> <b> "invalid"^^<${xsd.integer}>.\n`),
    );

    it(
      'should serialize a decimal literal',
      shouldSerialize(['a', 'b', `"123.456"^^${xsd.decimal}`],
                      '<a> <b> 123.456.\n'),
    );

    it(
      'should serialize a positive decimal literal',
      shouldSerialize(['a', 'b', `"+123.456"^^${xsd.decimal}`],
                      '<a> <b> +123.456.\n'),
    );

    it(
      'should serialize a negative decimal literal',
      shouldSerialize(['a', 'b', `"-123.456"^^${xsd.decimal}`],
                      '<a> <b> -123.456.\n'),
    );

    it(
      'should serialize an invalid decimal literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.decimal}`],
                      `<a> <b> "invalid"^^<${xsd.decimal}>.\n`),
    );

    it(
      'should serialize a double literal',
      shouldSerialize(['a', 'b', `"123.456E10"^^${xsd.double}`],
                      '<a> <b> 123.456E10.\n'),
    );

    it(
      'should serialize a positive double literal',
      shouldSerialize(['a', 'b', `"+123.456E10"^^${xsd.double}`],
                      '<a> <b> +123.456E10.\n'),
    );

    it(
      'should serialize a negative double literal',
      shouldSerialize(['a', 'b', `"-123.456E10"^^${xsd.double}`],
                      '<a> <b> -123.456E10.\n'),
    );

    it(
      'should serialize an invalid double literal',
      shouldSerialize(['a', 'b', `"invalid"^^${xsd.double}`],
                      `<a> <b> "invalid"^^<${xsd.double}>.\n`),
    );

    it(
      'should serialize blank nodes',
      shouldSerialize(['_:a', 'b', { termType: 'BlankNode', value: 'c' }],
                      '_:a <b> _:c.\n'),
    );

    it(
      'should not leave leading whitespace if the prefix set is empty',
      shouldSerialize({},
                      ['a', 'b', 'c'],
                      '<a> <b> <c>.\n'),
    );

    it(
      'should serialize prefixes',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: new NamedNode('http://a.org/b#'), c: 'http://a.org/c' } },
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n' +
                      '@prefix c: <http://a.org/c>.\n\n'),
    );

    it(
      'should use prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#', c: 'http://a.org/b' } },
                      ['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                      ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                      ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n' +
                      '@prefix c: <http://a.org/b>.\n\n' +
                      'a:bc b:ef a:bhi.\n' +
                      '<http://a.org/bc/de> <http://a.org/b#e#f> <http://a.org/b#x/t>.\n' +
                      'a:3a b:3a b:a3.\n'),
    );

    it(
      'should use prefixes for local names with dots',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#' } },
                      ['http://a.org/v1.0', 'http://a.org/b#a.b.c', 'http://a.org/a-1.b-2'],
                      ['http://a.org/vocab.', 'http://a.org/b#.a', 'http://a.org/b#a..b'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n' +
                      'a:v1.0 b:a.b.c a:a-1.b-2.\n' +
                      '<http://a.org/vocab.> <http://a.org/b#.a> <http://a.org/b#a..b>.\n'),
    );

    it('should round-trip prefixed names with dots through the parser', async () => {
      const writer = new Writer({ prefixes: { a: 'http://a.org/' } });
      const quad = new Quad(new NamedNode('http://a.org/v1.0'),
                            new NamedNode('http://a.org/p'),
                            new NamedNode('http://a.org/a.b.c'));
      writer.addQuad(quad);
      const output = await new Promise(resolve => {
        writer.end((error, result) => resolve(result));
      });
      expect(output).toBe('@prefix a: <http://a.org/>.\n\na:v1.0 a:p a:a.b.c.\n');
      expect(new Parser().parse(output)).toStrictEqual([quad]);
    });

    it(
      'should apply a prefix whose IRI contains a regular expression metacharacter',
      shouldSerialize({ prefixes: { ex: 'http://ex/a[b' } },
                      ['http://ex/a[bs', 'http://ex/a[bp', 'http://ex/a[bo'],
                      '@prefix ex: <http://ex/a[b>.\n\n' +
                      'ex:s ex:p ex:o.\n'),
    );

    it(
      'should apply prefixes whose IRIs contain regular expression metacharacters',
      shouldSerialize({ prefixes: { a: 'http://a.org/x[y', b: 'http://a.org/d{|^}-e' } },
                      ['http://a.org/x[ys', 'http://a.org/d{|^}-ep', 'http://a.org/x[yo'],
                      '@prefix a: <http://a.org/x[y>.\n' +
                      '@prefix b: <http://a.org/d{|^}-e>.\n\n' +
                      'a:s b:p a:o.\n'),
    );

    it(
      'should only treat IRIs with an exact prefix name as prefixed names',
      shouldSerialize({ prefixes: { 'a.b': 'http://a.org/' } },
                      ['a.b:s', 'axb:p', 'http://a.org/o'],
                      '@prefix a.b: <http://a.org/>.\n\n' +
                      'a.b:s <axb:p> a.b:o.\n'),
    );

    it(
      'should expand prefixes when possible',
      shouldSerialize({ prefixes: { a: 'http://a.org/', b: 'http://a.org/b#' } },
                      ['a:bc', 'b:ef', 'c:bhi'],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n' +
                      'a:bc b:ef <c:bhi>.\n'),
    );

    it(
      'should not repeat the same subjects',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['abc', 'mno', 'pqr'],
                      ['stu', 'vwx', 'yz'],
                      '<abc> <def> <ghi>;\n' +
                      '    <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'),
    );

    it(
      'should not repeat the same predicates',
      shouldSerialize(['abc', 'def', 'ghi'],
                      ['abc', 'def', 'pqr'],
                      ['abc', 'bef', 'ghi'],
                      ['abc', 'bef', 'pqr'],
                      ['stu', 'bef', 'yz'],
                      '<abc> <def> <ghi>, <pqr>;\n' +
                      '    <bef> <ghi>, <pqr>.\n' +
                      '<stu> <bef> <yz>.\n'),
    );

    it(
      'should write rdf:type as "a"',
      shouldSerialize(['abc', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'def'],
                      '<abc> a <def>.\n'),
    );

    it(
      'should serialize a graph with 1 triple',
      shouldSerialize(['abc', 'def', 'ghi', 'xyz'],
                      '<xyz> {\n' +
                      '<abc> <def> <ghi>\n' +
                      '}\n'),
    );

    it(
      'should serialize a graph with 3 triples',
      shouldSerialize(['abc', 'def', 'ghi', 'xyz'],
                      ['jkl', 'mno', 'pqr', 'xyz'],
                      ['stu', 'vwx', 'yz',  'xyz'],
                      '<xyz> {\n' +
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>\n' +
                      '}\n'),
    );

    it(
      'should serialize three graphs',
      shouldSerialize(['abc', 'def', 'ghi', 'xyz'],
                      ['jkl', 'mno', 'pqr', ''],
                      ['stu', 'vwx', 'yz',  'abc'],
                      '<xyz> {\n<abc> <def> <ghi>\n}\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<abc> {\n<stu> <vwx> <yz>\n}\n'),
    );

    it(
      'should serialize an empty named node as subject',
      shouldSerialize([new NamedNode(''), 'def', 'ghi'],
                      '<> <def> <ghi>.\n'),
    );

    it(
      'should serialize an empty named node as predicate',
      shouldSerialize(['abc', new NamedNode(''), 'ghi'],
                      '<abc> <> <ghi>.\n'),
    );

    it(
      'should serialize an empty named node as object',
      shouldSerialize(['abc', 'def', new NamedNode('')],
                      '<abc> <def> <>.\n'),
    );

    it(
      'should serialize an empty named node as graph',
      shouldSerialize(['abc', 'def', 'ghi', new NamedNode('')],
                      '<> {\n<abc> <def> <ghi>\n}\n'),
    );

    it(
      'should not merge an empty named graph into the default graph',
      shouldSerialize(['abc', 'def', 'ghi', ''],
                      ['jkl', 'mno', 'pqr', new NamedNode('')],
                      ['stu', 'vwx', 'yz',  ''],
                      '<abc> <def> <ghi>.\n' +
                      '<> {\n<jkl> <mno> <pqr>\n}\n' +
                      '<stu> <vwx> <yz>.\n'),
    );

    it('round-trips a triple with an empty named node', async () => {
      const input = '<> <http://ex.org/p> <http://ex.org/o>.\n';
      const quads = new Parser().parse(input);
      expect(quads[0].subject).toEqual(new NamedNode(''));
      const writer = new Writer();
      writer.addQuads(quads);
      const output = await end(writer);
      expect(output).toBe(input);
      expect(new Parser().parse(output)).toEqual(quads);
    });

    it(
      'should output 8-bit unicode characters as escape sequences',
      shouldSerialize(['\ud835\udc00', '\ud835\udc00', '"\ud835\udc00"^^\ud835\udc00', '\ud835\udc00'],
                      '<\\U0001d400> {\n<\\U0001d400> <\\U0001d400> "\\U0001d400"^^<\\U0001d400>\n}\n'),
    );

    it(
      'should escape control characters in IRIs',
      shouldSerialize(['a\u0001b', 'b', 'c'], '<a\\u0001b> <b> <c>.\n'),
    );

    it('should write canonical escapes in N-Triples', async () => {
      const writer = new Writer({ format: 'N-Triples' });
      writer.addQuad(new NamedNode('a\u0001b'), new NamedNode('b'), new Literal(
        '"\u0000\u0007\b\t\n\u000b\f\r\u000e\u001f\u007f\ufffe\uffff\u0080\ud835\udc00 \\\""'));
      expect(await end(writer)).toBe('<a\\u0001b> <b> "\\u0000\\u0007\\b\\t\\n\\u000B\\f\\r\\u000E\\u001F' +
        '\\u007F\\uFFFE\\uFFFF\u0080\ud835\udc00 \\\\\\"" .\n');
    });

    it('should write canonical triple terms in N-Quads', async () => {
      const writer = new Writer({ format: 'N-Quads' });
      writer.addQuad(new NamedNode('a'), new NamedNode('b'),
        new Quad(new NamedNode('c'), new NamedNode('d'), new NamedNode('e')), new NamedNode('g'));
      expect(await end(writer)).toBe('<a> <b> <<( <c> <d> <e> )>> <g> .\n');
    });

    it(
      'should not use escape sequences in blank nodes',
      shouldSerialize(['_:\ud835\udc00', '_:\ud835\udc00', '_:\ud835\udc00', '_:\ud835\udc00'],
                      '_:\ud835\udc00 {\n_:\ud835\udc00 _:\ud835\udc00 _:\ud835\udc00\n}\n'),
    );

    it('calls the done callback when ending the outputstream errors', async () => {
      const writer = new Writer({
        write: function () {},
        end: function () { throw new Error('error'); },
      });
      const error = await new Promise(resolve => writer.end(resolve));
      // A failing stream end is swallowed; the callback is still called without error
      expect(error).toBeUndefined();
    });

    it('sends output through end when no stream argument is given', async () => {
      const writer = new Writer();
      let notCalled = true;
      writer.addQuad(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), () => { notCalled = false; });
      const output = await end(writer);
      expect(output).toBe('<a> <b> <c>.\n');
      expect(notCalled).toBe(false);
    });

    it(
      'respects the prefixes argument when no stream argument is given',
      async () => {
        const writer = new Writer({ prefixes: { a: 'b#' } });
        writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
        const output = await end(writer);
        expect(output).toBe('@prefix a: <b#>.\n\na:a a:b a:c.\n');
      },
    );

    it('ignores an empty prefix list', async () => {
      const writer = new Writer();
      writer.addPrefixes({});
      writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
      const output = await end(writer);
      expect(output).toBe('<b#a> <b#b> <b#c>.\n');
    });

    it(
      'should serialize triples of graph with prefix for local names that begin with underscore',
      async () => {
        const writer = new Writer();
        writer.addPrefix('a', 'b#');
        writer.addQuad(new Quad(new NamedNode('b#_a'), new NamedNode('b#b'), new NamedNode('b#c'), new NamedNode('b#g')));
        const output = await end(writer);
        expect(output).toBe('@prefix a: <b#>.\n\na:g {\na:_a a:b a:c\n}\n');
      },
    );

    it(
      'serializes triples of a graph with a prefix declaration in between',
      async () => {
        const writer = new Writer();
        writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c')));
        writer.addPrefix('a', 'b#');
        writer.addQuad(new Quad(new NamedNode('b#a'), new NamedNode('b#b'), new NamedNode('b#c'), new NamedNode('b#g')));
        writer.addPrefix('d', 'e#');
        writer.addQuad({ subject: new NamedNode('b#a'), predicate: new NamedNode('b#b'), object: new NamedNode('b#d'), graph: new NamedNode('b#g') });
        const output = await end(writer);
        expect(output).toBe('<b#a> <b#b> <b#c>.\n' +
                            '@prefix a: <b#>.\n\na:g {\na:a a:b a:c\n}\n' +
                            '@prefix d: <e#>.\n\na:g {\na:a a:b a:d\n}\n');
      },
    );

    it('uses each prefix added between quads', async () => {
      const writer = new Writer();
      writer.addPrefix('a', 'b#');
      writer.addPrefix('c', 'd#');
      writer.addQuad(new Quad(new NamedNode('b#s'), new NamedNode('d#p'), new NamedNode('f#o')));
      writer.addPrefix('e', 'f#');
      writer.addQuad(new Quad(new NamedNode('b#s'), new NamedNode('d#p'), new NamedNode('f#o')));
      const output = await end(writer);
      expect(output).toBe('@prefix a: <b#>.\n\n@prefix c: <d#>.\n\na:s c:p <f#o>.\n' +
                          '@prefix e: <f#>.\n\na:s c:p e:o.\n');
    });

    it('should not write prefixes in N-Triples mode', async () => {
      const writer = new Writer({ format: 'N-Triples', prefixes: { a: 'b#' } });
      let called = false;
      function callback() { called = true; }
      writer.addPrefix('c', 'd#');
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new Literal('"c"'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new Literal(`"1"^^${xsd.integer}`));
      writer.addPrefix('e', 'f#', callback);
      const output = await end(writer);
      expect(called).toBe(true);
      expect(output).toBe(`<a> <b> "c" .\n<a> <b> "1"^^<${xsd.integer}> .\n`);
    });

    it('uses a base IRI when given', async () => {
      const writer = new Writer({ baseIRI: 'http://example.org/foo/' });
      writer.addQuad(new Quad(
        new NamedNode('http://example.org/foo/'),
        new NamedNode('http://example.org/foo/#b'),
        new NamedNode('http://example.org/foo/cdeFgh/ijk')));
      const output = await end(writer);
      expect(output).toBe('<> <#b> <cdeFgh/ijk>.\n');
    });

    it('uses a base IRI to relativize a graph to the empty IRI', async () => {
      const writer = new Writer({ baseIRI: 'http://example.org/foo/' });
      writer.addQuad(new Quad(
        new NamedNode('http://example.org/foo/a'),
        new NamedNode('http://example.org/foo/b'),
        new NamedNode('http://example.org/foo/c'),
        new NamedNode('http://example.org/foo/')));
      const output = await end(writer);
      expect(output).toBe('<> {\n<a> <b> <c>\n}\n');
    });

    it('uses partially match base IRIs', async () => {
      const writer = new Writer({ baseIRI: 'https://pod.example/profile/card' });
      writer.addQuad(new Quad(
          new NamedNode('https://pod.example/profile/card#me'),
          new NamedNode('http://www.w3.org/2002/07/owl#sameAs'),
          new NamedNode('https://pod.example/profile/card-1234.ttl')));
      const output = await end(writer);
      expect(output).toBe(
          '<#me> <http://www.w3.org/2002/07/owl#sameAs> <card-1234.ttl>.\n',
      );
    });

    it('does not write a base directive by default', async () => {
      const writer = new Writer({
        prefixes: { ex: 'http://other.example/ns#' },
        baseIRI: 'http://example.org/foo/',
      });
      writer.addQuad(new Quad(
        new NamedNode('http://example.org/foo/bar'),
        new NamedNode('http://other.example/ns#p'),
        new NamedNode('http://example.org/foo/baz')));
      const output = await end(writer);
      expect(output).toBe('@prefix ex: <http://other.example/ns#>.\n\n' +
                          '<bar> ex:p <baz>.\n');
    });

    it('writes a base directive with the writeBase option', async () => {
      const writer = new Writer({ baseIRI: 'http://example.org/foo/', writeBase: true });
      writer.addQuad(new Quad(
        new NamedNode('http://example.org/foo/'),
        new NamedNode('http://example.org/foo/#b'),
        new NamedNode('http://example.org/foo/cdeFgh/ijk')));
      const output = await end(writer);
      expect(output).toBe('@base <http://example.org/foo/>.\n' +
                          '<> <#b> <cdeFgh/ijk>.\n');
    });

    it('writes a base directive for a partially matching base IRI', async () => {
      const writer = new Writer({ baseIRI: 'https://pod.example/profile/card', writeBase: true });
      writer.addQuad(new Quad(
          new NamedNode('https://pod.example/profile/card#me'),
          new NamedNode('http://www.w3.org/2002/07/owl#sameAs'),
          new NamedNode('https://pod.example/profile/card-1234.ttl')));
      const output = await end(writer);
      expect(output).toBe(
          '@base <https://pod.example/profile/card>.\n' +
          '<#me> <http://www.w3.org/2002/07/owl#sameAs> <card-1234.ttl>.\n',
      );
    });

    it('writes the base directive before the prefixes', async () => {
      const writer = new Writer({
        prefixes: { ex: 'http://other.example/ns#' },
        baseIRI: 'http://example.org/foo/',
        writeBase: true,
      });
      writer.addQuad(new Quad(
        new NamedNode('http://example.org/foo/bar'),
        new NamedNode('http://other.example/ns#p'),
        new NamedNode('http://example.org/foo/baz')));
      const output = await end(writer);
      expect(output).toBe('@base <http://example.org/foo/>.\n' +
                          '@prefix ex: <http://other.example/ns#>.\n\n' +
                          '<bar> ex:p <baz>.\n');
    });

    it('should not write a base directive in N-Triples mode', async () => {
      const writer = new Writer({ format: 'N-Triples', baseIRI: 'http://example.org/foo/', writeBase: true });
      writer.addQuad(new NamedNode('http://example.org/foo/bar'), new NamedNode('http://example.org/foo/#b'), new Literal('"c"'));
      const output = await end(writer);
      expect(output).toBe('<http://example.org/foo/bar> <http://example.org/foo/#b> "c" .\n');
    });

    it('should not write a base directive in N-Quads mode', async () => {
      const writer = new Writer({ format: 'N-Quads', baseIRI: 'http://example.org/foo/', writeBase: true });
      writer.addQuad(new NamedNode('http://example.org/foo/bar'), new NamedNode('http://example.org/foo/#b'), new Literal('"c"'), new NamedNode('http://example.org/foo/g'));
      const output = await end(writer);
      expect(output).toBe('<http://example.org/foo/bar> <http://example.org/foo/#b> "c" <http://example.org/foo/g> .\n');
    });

    it('should accept triples with separated components', async () => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'));
      const output = await end(writer);
      expect(output).toBe('<a> <b> <c>, <d>.\n');
    });

    it('should accept quads with separated components', async () => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'), new NamedNode('g'));
      const output = await end(writer);
      expect(output).toBe('<g> {\n<a> <b> <c>, <d>\n}\n');
    });

    it('should serialize triples with an empty blank node as object', async () => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.blank());
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.blank([]));
      const output = await end(writer);
      expect(output).toBe('<a1> <b> [].\n' +
                          '<a2> <b> [].\n');
    });

    it('should serialize triples with the same blank node as object', async () => {
      const writer = new Writer();
      const blank = writer.blank();
      writer.addQuad(blank, new NamedNode('a'), new NamedNode('b'));
      writer.addQuad(blank, new NamedNode('c'), new NamedNode('d'));
      const output = await end(writer);
      expect(output).toBe('[] <a> <b>;\n' +
                          '    <c> <d>.\n');
    });

    it(
      'should serialize triples with a one-triple blank node as object',
      async () => {
        const writer = new Writer();
        writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.blank(new NamedNode('d'), new NamedNode('e')));
        writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.blank({ predicate: new NamedNode('d'), object: new NamedNode('e') }));
        writer.addQuad(new NamedNode('a3'), new NamedNode('b'), writer.blank([{ predicate: new NamedNode('d'), object: new NamedNode('e') }]));
        const output = await end(writer);
        expect(output).toBe('<a1> <b> [ <d> <e> ].\n' +
                            '<a2> <b> [ <d> <e> ].\n' +
                            '<a3> <b> [ <d> <e> ].\n');
      },
    );

    it(
      'should serialize triples with a two-triple blank node as object',
      async () => {
        const writer = new Writer();
        writer.addQuad(new NamedNode('a'), new NamedNode('b'), writer.blank([
            { predicate: new NamedNode('d'), object: new NamedNode('e') },
            { predicate: new NamedNode('f'), object: new Literal('"g"') },
        ]));
        const output = await end(writer);
        expect(output).toBe('<a> <b> [\n' +
                            '  <d> <e>;\n' +
                            '  <f> "g"\n' +
                            '].\n');
      },
    );

    it(
      'should serialize triples with a three-triple blank node as object',
      async () => {
        const writer = new Writer();
        writer.addQuad(new NamedNode('a'), new NamedNode('b'), writer.blank([
          { predicate: new NamedNode('d'), object: new NamedNode('e') },
          { predicate: new NamedNode('f'), object: new Literal('"g"') },
          { predicate: new NamedNode('h'), object: new NamedNode('i') },
        ]));
        const output = await end(writer);
        expect(output).toBe('<a> <b> [\n' +
                            '  <d> <e>;\n' +
                            '  <f> "g";\n' +
                            '  <h> <i>\n' +
                            '].\n');
      },
    );

    it(
      'should serialize triples with predicate-sharing blank node triples as object',
      async () => {
        const writer = new Writer();
        writer.addQuad(new NamedNode('a'), new NamedNode('b'), writer.blank([
          { predicate: new NamedNode('d'), object: new NamedNode('e') },
          { predicate: new NamedNode('d'), object: new NamedNode('f') },
          { predicate: new NamedNode('g'), object: new NamedNode('h') },
          { predicate: new NamedNode('g'), object: new NamedNode('i') },
        ]));
        const output = await end(writer);
        expect(output).toBe('<a> <b> [\n' +
          '  <d> <e>, <f>;\n' +
          '  <g> <h>, <i>\n' +
          '].\n');
      },
    );

    it('should serialize triples with nested blank nodes as object', async () => {
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
      const output = await end(writer);
      expect(output).toBe('<a1> <b> [\n' +
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
    });

    it('should serialize triples with an empty blank node as subject', async () => {
      const writer = new Writer();
      writer.addQuad(writer.blank(), new NamedNode('b'), new NamedNode('c'));
      writer.addQuad(writer.blank([]), new NamedNode('b'), new NamedNode('c'));
      const output = await end(writer);
      expect(output).toBe('[] <b> <c>.\n' +
                          '[] <b> <c>.\n');
    });

    it(
      'should serialize triples with a one-triple blank node as subject',
      async () => {
        const writer = new Writer();
        writer.addQuad(writer.blank(new NamedNode('a'), new NamedNode('b')), new NamedNode('c'), new NamedNode('d'));
        writer.addQuad(writer.blank({ predicate: new NamedNode('a'), object: new NamedNode('b') }), new NamedNode('c'), new NamedNode('d'));
        writer.addQuad(writer.blank([{ predicate: new NamedNode('a'), object: new NamedNode('b') }]), new NamedNode('c'), new NamedNode('d'));
        const output = await end(writer);
        expect(output).toBe('[ <a> <b> ] <c> <d>.\n' +
                            '[ <a> <b> ] <c> <d>.\n' +
                            '[ <a> <b> ] <c> <d>.\n');
      },
    );

    it('should serialize triples with an empty blank node as graph', async () => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), writer.blank());
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), writer.blank([]));
      const output = await end(writer);
      expect(output).toBe('[] {\n<a> <b> <c>\n}\n' +
                          '[] {\n<a> <b> <c>\n}\n');
    });

    it('should serialize triples with an empty list as object', async () => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.list());
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.list([]));
      const output = await end(writer);
      expect(output).toBe('<a1> <b> ().\n' +
                          '<a2> <b> ().\n');
    });

    it('should serialize triples with a one-element list as object', async () => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.list([new NamedNode('c')]));
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.list([new Literal('"c"')]));
      const output = await end(writer);
      expect(output).toBe('<a1> <b> (<c>).\n' +
                          '<a2> <b> ("c").\n');
    });

    it('should serialize triples with a three-element list as object', async () => {
      const writer = new Writer();
      writer.addQuad(new NamedNode('a1'), new NamedNode('b'), writer.list([new NamedNode('c'), new NamedNode('d'), new NamedNode('e')]));
      writer.addQuad(new NamedNode('a2'), new NamedNode('b'), writer.list([new Literal('"c"'), new Literal('"d"'), new Literal('"e"')]));
      const output = await end(writer);
      expect(output).toBe('<a1> <b> (<c> <d> <e>).\n' +
                          '<a2> <b> ("c" "d" "e").\n');
    });

    it('should serialize triples with an empty list as subject', async () => {
      const writer = new Writer();
      writer.addQuad(writer.list(),   new NamedNode('b1'), new NamedNode('c'));
      writer.addQuad(writer.list([]), new NamedNode('b2'), new NamedNode('c'));
      const output = await end(writer);
      expect(output).toBe('() <b1> <c>.\n' +
                          '() <b2> <c>.\n');
    });

    it('should serialize triples with a one-element list as subject', async () => {
      const writer = new Writer();
      writer.addQuad(writer.list([new NamedNode('a')]), new NamedNode('b1'), new NamedNode('c'));
      writer.addQuad(writer.list([new NamedNode('a')]), new NamedNode('b2'), new NamedNode('c'));
      const output = await end(writer);
      expect(output).toBe('(<a>) <b1> <c>.\n' +
                          '(<a>) <b2> <c>.\n');
    });

    it('should serialize triples with a three-element list as subject', async () => {
      const writer = new Writer();
      writer.addQuad(writer.list([new NamedNode('a1'), new Literal('"b"'), new Literal('"c"')]), new NamedNode('d'), new NamedNode('e'));
      const output = await end(writer);
      expect(output).toBe('(<a1> "b" "c") <d> <e>.\n');
    });

    it('should serialize a blank node in an N3 list with a valid label when formulaScopedBlankNodes is set', async () => {
      const quads = new Parser({ format: 'text/n3', formulaScopedBlankNodes: true }).parse('<a> <b> (_:x). _:x <c> <d>.');
      const writer = new Writer();
      writer.addQuads(quads);
      const output = await end(writer);
      // A label such as `_:.x` would fail to reparse (#332)
      expect(() => new Parser().parse(output)).not.toThrow();
    });

    it('should serialize a blank node in an N3 list with an invalid label by default', async () => {
      const quads = new Parser({ format: 'text/n3' }).parse('<a> <b> (_:x). _:x <c> <d>.');
      const writer = new Writer();
      writer.addQuads(quads);
      const output = await end(writer);
      // The default rescoping produces the label `_:.x`,
      // which fails to reparse (#332; the default flips in #630)
      expect(() => new Parser().parse(output)).toThrow();
    });

    it(
      'should serialize subject and object triples passed by options.listHeads',
      async () => {
        const lists = {
          l1: [new NamedNode('c'), new NamedNode('d'), new NamedNode('e')],
          l2: [new Literal('c'), new Literal('d'), new Literal('e')],
        };

        const writer = new Writer({ lists });
        writer.addQuad(new BlankNode('l1'), new NamedNode('b'), new BlankNode('l2'));
        writer.addQuad(new NamedNode('a3'), new NamedNode('b'), new BlankNode('m3'));
        const output = await end(writer);
        expect(output).toBe('(<c> <d> <e>) <b> ("c" "d" "e").\n' +
          '<a3> <b> _:m3.\n');
      },
    );

    it('should accept triples in bulk', async () => {
      const writer = new Writer();
      writer.addQuads([new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')),
        new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'))]);
      const output = await end(writer);
      expect(output).toBe('<a> <b> <c>, <d>.\n');
    });

    it('should not allow writing after end', async () => {
      const writer = new Writer();
      writer.addQuad(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')));
      writer.end();
      const error = await new Promise(resolve => {
        writer.addQuad(new Quad(new NamedNode('d'), new NamedNode('e'), new NamedNode('f')), resolve);
      });
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('message', 'Cannot write because the writer has been closed.');
    });

    it('should write simple triples in N-Quads mode', async () => {
      const writer = new Writer({ format: 'N-Quads' });
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'));
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'));
      const output = await end(writer);
      expect(output).toBe('<a> <b> <c> .\n<a> <b> <d> .\n');
    });

    it('should write simple quads in N-Quads mode', async () => {
      const writer = new Writer({ format: 'N-Quads' });
      let called = false;
      function callback() { called = true; }
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), callback);
      writer.addQuad(new NamedNode('a'), new NamedNode('b'), new NamedNode('d'), new NamedNode('g'));
      const output = await end(writer);
      expect(called).toBe(true);
      expect(output).toBe('<a> <b> <c> .\n<a> <b> <d> <g> .\n');
    });

    it('should end when the end option is not set', async () => {
      const outputStream = new QuickStream(), writer = new Writer(outputStream, {});
      expect(outputStream).toHaveProperty('ended', false);
      await new Promise(resolve => writer.end(resolve));
      expect(outputStream).toHaveProperty('ended', true);
    });

    it('should end when the end option is set to true', async () => {
      const outputStream = new QuickStream(), writer = new Writer(outputStream, { end: true });
      expect(outputStream).toHaveProperty('ended', false);
      await new Promise(resolve => writer.end(resolve));
      expect(outputStream).toHaveProperty('ended', true);
    });

    it('should not end when the end option is set to false', async () => {
      const outputStream = new QuickStream(), writer = new Writer(outputStream, { end: false });
      expect(outputStream).toHaveProperty('ended', false);
      await new Promise(resolve => writer.end(resolve));
      expect(outputStream).toHaveProperty('ended', false);
    });

    it(
      'should serialize a triple with a triple with mixed component types as subject',
      () => {
        const writer = new Writer();
        expect(
          writer.quadToString(new Quad(new BlankNode('b1'), new NamedNode('b'), new Literal('l1')), new NamedNode('b'), new NamedNode('c')),
        ).toBe('<<(_:b1 <b> "l")>> <b> <c> .\n');
      },
    );

    it('should serialize a triple with a triple with iris as subject', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), new NamedNode('b'), new NamedNode('c')),
      ).toBe('<<(<a> <b> <c>)>> <b> <c> .\n');
    });

    it(
      'should serialize a triple with a triple with blanknodes as subject',
      () => {
        const writer = new Writer();
        expect(
          writer.quadToString(new Quad(new BlankNode('b1'), new BlankNode('b2'), new BlankNode('b3')), new NamedNode('b'), new NamedNode('c')),
        ).toBe('<<(_:b1 _:b2 _:b3)>> <b> <c> .\n');
      },
    );

    it('should serialize a triple with a triple as object', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new BlankNode('b1'), new NamedNode('b'), new Literal('l1'))),
      ).toBe('<a> <b> <<(_:b1 <b> "l")>> .\n');
    });

    it('should serialize a triple with a triple with iris as object', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'))),
      ).toBe('<a> <b> <<(<a> <b> <c>)>> .\n');
    });

    it(
      'should serialize a triple with a triple with blanknodes as object',
      () => {
        const writer = new Writer();
        expect(
          writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new BlankNode('b1'), new BlankNode('b2'), new BlankNode('b3'))),
        ).toBe('<a> <b> <<(_:b1 _:b2 _:b3)>> .\n');
      },
    );

    it(
      'should serialize a quad with a triple with mixed component types as subject',
      () => {
        const writer = new Writer();
        expect(
          writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')),
        ).toBe('<<(<a> <b> <c>)>> <b> <c> <g> .\n');
      },
    );

    it('should serialize a quad with a triple as object', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c')), new NamedNode('g')),
      ).toBe('<a> <b> <<(<a> <b> <c>)>> <g> .\n');
    });

    it('should serialize a quad with a quad as subject', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')),
      ).toBe('<<(<a> <b> <c> <g>)>> <b> <c> <g> .\n');
    });

    it('should serialize a quad with a quad as object', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')), new NamedNode('g')),
      ).toBe('<a> <b> <<(<a> <b> <c> <g>)>> <g> .\n');
    });

    it('should serialize a triple with a quad as subject', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g')), new NamedNode('b'), new NamedNode('c')),
      ).toBe('<<(<a> <b> <c> <g>)>> <b> <c> .\n');
    });

    it('should serialize a triple with a quad as object', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), new NamedNode('b'), new Quad(new NamedNode('a'), new NamedNode('b'), new NamedNode('c'), new NamedNode('g'))),
      ).toBe('<a> <b> <<(<a> <b> <c> <g>)>> .\n');
    });

    it('should serialize a triple with a literal as subject',
      shouldSerialize([`"123"^^${xsd.boolean}`, 'b', 'c'], `"123"^^<${xsd.boolean}> <b> <c>.\n`));

    it('should serialize a triple with a literal as predicate',
      shouldSerialize(['a', `"123"^^${xsd.boolean}`, 'c'], `<a> "123"^^<${xsd.boolean}> <c>.\n`));

    it('should serialize a triple with a language-tagged literal as subject',
      shouldSerialize(['"hello"@en-us', 'b', 'c'], '"hello"@en-us <b> <c>.\n'));

    it('should serialize a triple with a literal as subject in N3 mode',
      shouldSerialize({ format: 'text/n3' },
                      [`"123"^^${xsd.boolean}`, 'b', 'c'],
                      `"123"^^<${xsd.boolean}> <b> <c>.\n`));

    it('should serialize a triple with a literal as subject via quadToString', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(termFromId(`"123"^^${xsd.boolean}`), new NamedNode('b'), new NamedNode('c')),
      ).toBe(`"123"^^<${xsd.boolean}> <b> <c> .\n`);
    });

    it('should serialize a triple with a literal as predicate via quadToString', () => {
      const writer = new Writer();
      expect(
        writer.quadToString(new NamedNode('a'), termFromId(`"123"^^${xsd.boolean}`), new NamedNode('c')),
      ).toBe(`<a> "123"^^<${xsd.boolean}> <c> .\n`);
    });

    it('should round-trip a triple with a literal as subject in N3 mode', async () => {
      const quad = new Quad(termFromId(`"1"^^${xsd.boolean}`),
        new NamedNode('http://example.com/p'), new NamedNode('http://example.com/o'));
      const writer = new Writer({ format: 'text/n3' });
      writer.addQuad(quad);
      const output = await end(writer);
      expect(new Parser({ format: 'text/n3' }).parse(output)).toEqual([quad]);
    });

    it('should escape a literal subject in N3 mode',
      shouldSerialize({ format: 'text/n3' },
                      ['"a"b"', 'b', 'c'],
                      '"a\\"b" <b> <c>.\n'));

    it('should not abbreviate a literal predicate whose value is rdf:type',
      shouldSerialize({ format: 'text/n3' },
                      ['a', `"${rdf.type}"`, 'c'],
                      `<a> "${rdf.type}" <c>.\n`));

    it('should round-trip literal subjects and predicates in N3 mode', async () => {
      const quads = [
        new Quad(termFromId('"x"@en'), new NamedNode('http://example.com/p'), new NamedNode('http://example.com/o')),
        new Quad(new NamedNode('http://example.com/s'), termFromId(`"1"^^${xsd.integer}`), new NamedNode('http://example.com/o')),
        new Quad(termFromId('"a"b"'), termFromId(`"${rdf.type}"`), termFromId('"c"')),
      ];
      const writer = new Writer({ format: 'text/n3' });
      writer.addQuads(quads);
      const output = await end(writer);
      expect(new Parser({ format: 'text/n3' }).parse(output)).toEqual(quads);
    });

    /*
     * Test relativization of IRIs
     *
     * For every baseIRI, the tested nodes to relativize remain the same.
     * If you have the list of nodes, each IRI is used once as the baseIRI.
     * The list of tested nodes also includes their “extended” variant, which is simply the IRI appended with `extended`.
     * This allows testing whether things like http://ex.org/foo match http://ex.org.fooextended in the way that it would relativize to <extended>, but properly relativize to <fooextended>.
     */
    testRelativizes('http://example.org/',
      { input: 'http://example.org/',                                expected: '' },
      { input: 'http://example.org/?',                               expected: '?' },
      { input: 'http://example.org/#',                               expected: '#' },
      { input: 'http://example.org/?query',                          expected: '?query' },
      { input: 'http://example.org/#fragment',                       expected: '#fragment' },
      { input: 'http://example.org/?query#',                         expected: '?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '?query#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: 'foo?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: 'foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: 'foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: 'foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: '?extended' },
      { input: 'http://example.org/#extended',                       expected: '#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: 'foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: 'foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: 'foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: 'foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '?/extended' },
      { input: 'http://example.org/??extended',                      expected: '??extended' },
      { input: 'http://example.org/#/extended',                      expected: '#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '#?extended' },
      { input: 'http://example.org/##extended',                      expected: '##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: 'foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: 'foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: 'foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: 'foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: 'foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: 'foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: 'foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/?',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: '' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: '?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: '?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '?query#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: 'foo?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: 'foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: 'foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: 'foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: '?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: 'foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: 'foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: 'foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: 'foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '?/extended' },
      { input: 'http://example.org/??extended',                      expected: '??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: 'foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: 'foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: 'foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: 'foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: 'foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: 'foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: 'foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/#',
      { input: 'http://example.org/',                                expected: '' },
      { input: 'http://example.org/?',                               expected: '?' },
      { input: 'http://example.org/#',                               expected: '#' },
      { input: 'http://example.org/?query',                          expected: '?query' },
      { input: 'http://example.org/#fragment',                       expected: '#fragment' },
      { input: 'http://example.org/?query#',                         expected: '?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '?query#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: 'foo?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: 'foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: 'foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: 'foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: '?extended' },
      { input: 'http://example.org/#extended',                       expected: '#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: 'foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: 'foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: 'foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: 'foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '?/extended' },
      { input: 'http://example.org/??extended',                      expected: '??extended' },
      { input: 'http://example.org/#/extended',                      expected: '#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '#?extended' },
      { input: 'http://example.org/##extended',                      expected: '##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: 'foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: 'foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: 'foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: 'foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: 'foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: 'foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: 'foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/?query#',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: '?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: '' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: '#' },
      { input: 'http://example.org/?query#fragment',                 expected: '#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: 'foo?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: 'foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: 'foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: 'foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: '?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: 'foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: 'foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: 'foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: 'foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '?/extended' },
      { input: 'http://example.org/??extended',                      expected: '??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: 'foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: 'foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: 'foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: 'foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: 'foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: 'foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: 'foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/?query#fragment',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: '?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: '' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: '#' },
      { input: 'http://example.org/?query#fragment',                 expected: '#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: 'foo?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: 'foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: 'foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: 'foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: '?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: 'foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: 'foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: 'foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: 'foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '?/extended' },
      { input: 'http://example.org/??extended',                      expected: '??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: 'foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: 'foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: 'foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: 'foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: 'foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: 'foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: 'foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: './?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: './?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: './?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: './?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '' },
      { input: 'http://example.org/foo?',                            expected: '?' },
      { input: 'http://example.org/foo#',                            expected: '#' },
      { input: 'http://example.org/foo?query',                       expected: '?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: './?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: './?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: './?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: './?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: './?/extended' },
      { input: 'http://example.org/??extended',                      expected: './??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: './?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: './?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: './?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: './?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: './?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo?',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: './?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: './?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: './?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: './?query#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: '' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: '?query' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: './?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: './?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: './?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: './?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: './?/extended' },
      { input: 'http://example.org/??extended',                      expected: './??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: './?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: './?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: './?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: './?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: './?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo#',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: './?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: './?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: './?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: './?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '' },
      { input: 'http://example.org/foo?',                            expected: '?' },
      { input: 'http://example.org/foo#',                            expected: '#' },
      { input: 'http://example.org/foo?query',                       expected: '?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: './?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: './?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: './?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: './?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: './?/extended' },
      { input: 'http://example.org/??extended',                      expected: './??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: './?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: './?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: './?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: './?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: './?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo?query',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: './?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: './?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: './?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: './?query#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: '?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: '' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: './?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: './?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: './?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: './?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: './?/extended' },
      { input: 'http://example.org/??extended',                      expected: './??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: './?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: './?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: './?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: './?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: './?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '#fragment#extended' },
    );

    testRelativizes('http://example.org/foo#fragment',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: './?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: './?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: './?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: './?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '' },
      { input: 'http://example.org/foo?',                            expected: '?' },
      { input: 'http://example.org/foo#',                            expected: '#' },
      { input: 'http://example.org/foo?query',                       expected: '?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: './?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: './?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: './?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: './?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: './?/extended' },
      { input: 'http://example.org/??extended',                      expected: './??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: './?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: './?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: './?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: './?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: './?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo?query#',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: './?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: './?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: './?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: './?query#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: '?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: '' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: './?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: './?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: './?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: './?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: './?/extended' },
      { input: 'http://example.org/??extended',                      expected: './??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: './?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: './?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: './?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: './?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: './?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '#fragment#extended' },
    );

    testRelativizes('http://example.org/foo?query#fragment',
      { input: 'http://example.org/',                                expected: './' },
      { input: 'http://example.org/?',                               expected: './?' },
      { input: 'http://example.org/#',                               expected: './#' },
      { input: 'http://example.org/?query',                          expected: './?query' },
      { input: 'http://example.org/#fragment',                       expected: './#fragment' },
      { input: 'http://example.org/?query#',                         expected: './?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: './?query#fragment' },
      { input: 'http://example.org/foo',                             expected: 'foo' },
      { input: 'http://example.org/foo?',                            expected: '?' },
      { input: 'http://example.org/foo#',                            expected: 'foo#' },
      { input: 'http://example.org/foo?query',                       expected: '' },
      { input: 'http://example.org/foo#fragment',                    expected: 'foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '#fragment' },
      { input: 'http://example.org/foo/',                            expected: 'foo/' },
      { input: 'http://example.org/foo/?',                           expected: 'foo/?' },
      { input: 'http://example.org/foo/#',                           expected: 'foo/#' },
      { input: 'http://example.org/foo/?query',                      expected: 'foo/?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: 'foo/#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: 'foo/?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: 'foo/?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'foo/bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'foo/bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'foo/bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'foo/bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'foo/bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'foo/bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'foo/bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'foo/bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'foo/bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'foo/bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'foo/bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'foo/bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'foo/bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'foo/bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: 'extended' },
      { input: 'http://example.org/?extended',                       expected: './?extended' },
      { input: 'http://example.org/#extended',                       expected: './#extended' },
      { input: 'http://example.org/?queryextended',                  expected: './?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: './#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: './?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: './?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: 'fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '?extended' },
      { input: 'http://example.org/foo#extended',                    expected: 'foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: 'foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'foo/extended' },
      { input: 'http://example.org/foo/?extended',                   expected: 'foo/?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: 'foo/#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: 'foo/?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: 'foo/#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: 'foo/?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: 'foo/?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'foo/barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'foo/bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'foo/bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'foo/bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'foo/bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'foo/bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'foo/bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'foo/bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'foo/bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'foo/bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'foo/bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'foo/bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'foo/bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'foo/bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: './?/extended' },
      { input: 'http://example.org/??extended',                      expected: './??extended' },
      { input: 'http://example.org/#/extended',                      expected: './#/extended' },
      { input: 'http://example.org/#?extended',                      expected: './#?extended' },
      { input: 'http://example.org/##extended',                      expected: './##extended' },
      { input: 'http://example.org/?query/extended',                 expected: './?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: './?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: './#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: './#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: './#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: './?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: './?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: './?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: 'foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: 'foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: 'foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: 'foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: 'foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: 'foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '' },
      { input: 'http://example.org/foo/?',                           expected: '?' },
      { input: 'http://example.org/foo/#',                           expected: '#' },
      { input: 'http://example.org/foo/?query',                      expected: '?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/?',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: '' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: '?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/#',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '' },
      { input: 'http://example.org/foo/?',                           expected: '?' },
      { input: 'http://example.org/foo/#',                           expected: '#' },
      { input: 'http://example.org/foo/?query',                      expected: '?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/?query',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: '?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: '' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/#fragment',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '' },
      { input: 'http://example.org/foo/?',                           expected: '?' },
      { input: 'http://example.org/foo/#',                           expected: '#' },
      { input: 'http://example.org/foo/?query',                      expected: '?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/?query#',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: '?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: '' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/?query#fragment',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: '?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: '' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: 'bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: 'bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: 'bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: 'bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: 'bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: 'bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: 'bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: 'bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: './?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: './?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: './?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: './?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '' },
      { input: 'http://example.org/foo/bar?',                        expected: '?' },
      { input: 'http://example.org/foo/bar#',                        expected: '#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: './?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: './?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: './?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: './?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar?',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: './?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: './?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: './?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: './?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: './?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: './?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: './?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: './?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar#',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: './?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: './?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: './?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: './?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '' },
      { input: 'http://example.org/foo/bar?',                        expected: '?' },
      { input: 'http://example.org/foo/bar#',                        expected: '#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: './?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: './?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: './?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: './?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar?query',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: './?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: './?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: './?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: './?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: './?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: './?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: './?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: './?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar#fragment',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: './?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: './?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: './?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: './?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '' },
      { input: 'http://example.org/foo/bar?',                        expected: '?' },
      { input: 'http://example.org/foo/bar#',                        expected: '#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: './?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: './?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: './?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: './?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar?query#',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: './?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: './?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: './?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: './?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: './?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: './?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: './?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: './?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar?query#fragment',
      { input: 'http://example.org/',                                expected: '../' },
      { input: 'http://example.org/?',                               expected: '../?' },
      { input: 'http://example.org/#',                               expected: '../#' },
      { input: 'http://example.org/?query',                          expected: '../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../foo' },
      { input: 'http://example.org/foo?',                            expected: '../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: './' },
      { input: 'http://example.org/foo/?',                           expected: './?' },
      { input: 'http://example.org/foo/#',                           expected: './#' },
      { input: 'http://example.org/foo/?query',                      expected: './?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: './#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: './?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: './?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: 'bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '?' },
      { input: 'http://example.org/foo/bar#',                        expected: 'bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '' },
      { input: 'http://example.org/foo/bar#fragment',                expected: 'bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: 'bar/' },
      { input: 'http://example.org/foo/bar/?',                       expected: 'bar/?' },
      { input: 'http://example.org/foo/bar/#',                       expected: 'bar/#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: 'bar/?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: 'bar/#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: 'bar/?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: 'bar/?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../extended' },
      { input: 'http://example.org/?extended',                       expected: '../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: 'extended' },
      { input: 'http://example.org/foo/?extended',                   expected: './?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: './#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: './?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: './#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: './?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: './?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: 'barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: 'bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: 'bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'bar/extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: 'bar/?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: 'bar/#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: 'bar/?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: 'bar/#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: 'bar/?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: 'bar/?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '' },
      { input: 'http://example.org/foo/bar/?',                       expected: '?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/?',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: '' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/#',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '' },
      { input: 'http://example.org/foo/bar/?',                       expected: '?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/?query',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: '?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/#fragment',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '' },
      { input: 'http://example.org/foo/bar/?',                       expected: '?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/?query#',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: '?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/?query#fragment',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: '?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: './?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: './?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: './?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: './?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: './?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: './?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: './?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: './?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz?',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: './?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: './?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: './?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: './?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: './?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: './?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: './?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: './?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz#',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: './?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: './?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: './?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: './?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: './?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: './?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: './?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: './?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz?query',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: './?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: './?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: './?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: './?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: './?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: './?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: './?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: './?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz#fragment',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: './?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: './?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: './?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: './?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: './?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: './?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: './?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: './?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz?query#',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: './?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: './?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: './?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: './?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: './?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: './?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: './?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: './?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz?query#fragment',
      { input: 'http://example.org/',                                expected: '../../' },
      { input: 'http://example.org/?',                               expected: '../../?' },
      { input: 'http://example.org/#',                               expected: '../../#' },
      { input: 'http://example.org/?query',                          expected: '../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../' },
      { input: 'http://example.org/foo/?',                           expected: '../?' },
      { input: 'http://example.org/foo/#',                           expected: '../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: './' },
      { input: 'http://example.org/foo/bar/?',                       expected: './?' },
      { input: 'http://example.org/foo/bar/#',                       expected: './#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: './?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: './#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: './?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: './?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: 'extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: './?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: './#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: './?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: './#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: './?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: './?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz/',
      { input: 'http://example.org/',                                expected: '../../../' },
      { input: 'http://example.org/?',                               expected: '../../../?' },
      { input: 'http://example.org/#',                               expected: '../../../#' },
      { input: 'http://example.org/?query',                          expected: '../../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../../' },
      { input: 'http://example.org/foo/?',                           expected: '../../?' },
      { input: 'http://example.org/foo/#',                           expected: '../../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '../' },
      { input: 'http://example.org/foo/bar/?',                       expected: '../?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '../#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '../?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '../#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '../?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '../?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: '../extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '../?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '../#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '../?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '../?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '../?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz/?',
      { input: 'http://example.org/',                                expected: '../../../' },
      { input: 'http://example.org/?',                               expected: '../../../?' },
      { input: 'http://example.org/#',                               expected: '../../../#' },
      { input: 'http://example.org/?query',                          expected: '../../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../../' },
      { input: 'http://example.org/foo/?',                           expected: '../../?' },
      { input: 'http://example.org/foo/#',                           expected: '../../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '../' },
      { input: 'http://example.org/foo/bar/?',                       expected: '../?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '../#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '../?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '../#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '../?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '../?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: '../extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '../?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '../#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '../?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '../?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '../?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz/#',
      { input: 'http://example.org/',                                expected: '../../../' },
      { input: 'http://example.org/?',                               expected: '../../../?' },
      { input: 'http://example.org/#',                               expected: '../../../#' },
      { input: 'http://example.org/?query',                          expected: '../../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../../' },
      { input: 'http://example.org/foo/?',                           expected: '../../?' },
      { input: 'http://example.org/foo/#',                           expected: '../../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '../' },
      { input: 'http://example.org/foo/bar/?',                       expected: '../?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '../#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '../?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '../#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '../?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '../?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: '../extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '../?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '../#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '../?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '../?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '../?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz/?query',
      { input: 'http://example.org/',                                expected: '../../../' },
      { input: 'http://example.org/?',                               expected: '../../../?' },
      { input: 'http://example.org/#',                               expected: '../../../#' },
      { input: 'http://example.org/?query',                          expected: '../../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../../' },
      { input: 'http://example.org/foo/?',                           expected: '../../?' },
      { input: 'http://example.org/foo/#',                           expected: '../../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '../' },
      { input: 'http://example.org/foo/bar/?',                       expected: '../?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '../#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '../?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '../#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '../?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '../?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: '../extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '../?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '../#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '../?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '../?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '../?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz/#fragment',
      { input: 'http://example.org/',                                expected: '../../../' },
      { input: 'http://example.org/?',                               expected: '../../../?' },
      { input: 'http://example.org/#',                               expected: '../../../#' },
      { input: 'http://example.org/?query',                          expected: '../../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../../' },
      { input: 'http://example.org/foo/?',                           expected: '../../?' },
      { input: 'http://example.org/foo/#',                           expected: '../../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '../' },
      { input: 'http://example.org/foo/bar/?',                       expected: '../?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '../#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '../?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '../#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '../?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '../?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: '../extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '../?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '../#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '../?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '../?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '../?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz/?query#',
      { input: 'http://example.org/',                                expected: '../../../' },
      { input: 'http://example.org/?',                               expected: '../../../?' },
      { input: 'http://example.org/#',                               expected: '../../../#' },
      { input: 'http://example.org/?query',                          expected: '../../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../../' },
      { input: 'http://example.org/foo/?',                           expected: '../../?' },
      { input: 'http://example.org/foo/#',                           expected: '../../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '../' },
      { input: 'http://example.org/foo/bar/?',                       expected: '../?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '../#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '../?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '../#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '../?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '../?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: '../extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '../?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '../#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '../?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '../?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '../?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../../foo?query#fragment#extended' },
    );

    testRelativizes('http://example.org/foo/bar/baz/?query#fragment',
      { input: 'http://example.org/',                                expected: '../../../' },
      { input: 'http://example.org/?',                               expected: '../../../?' },
      { input: 'http://example.org/#',                               expected: '../../../#' },
      { input: 'http://example.org/?query',                          expected: '../../../?query' },
      { input: 'http://example.org/#fragment',                       expected: '../../../#fragment' },
      { input: 'http://example.org/?query#',                         expected: '../../../?query#' },
      { input: 'http://example.org/?query#fragment',                 expected: '../../../?query#fragment' },
      { input: 'http://example.org/foo',                             expected: '../../../foo' },
      { input: 'http://example.org/foo?',                            expected: '../../../foo?' },
      { input: 'http://example.org/foo#',                            expected: '../../../foo#' },
      { input: 'http://example.org/foo?query',                       expected: '../../../foo?query' },
      { input: 'http://example.org/foo#fragment',                    expected: '../../../foo#fragment' },
      { input: 'http://example.org/foo?query#',                      expected: '../../../foo?query#' },
      { input: 'http://example.org/foo?query#fragment',              expected: '../../../foo?query#fragment' },
      { input: 'http://example.org/foo/',                            expected: '../../' },
      { input: 'http://example.org/foo/?',                           expected: '../../?' },
      { input: 'http://example.org/foo/#',                           expected: '../../#' },
      { input: 'http://example.org/foo/?query',                      expected: '../../?query' },
      { input: 'http://example.org/foo/#fragment',                   expected: '../../#fragment' },
      { input: 'http://example.org/foo/?query#',                     expected: '../../?query#' },
      { input: 'http://example.org/foo/?query#fragment',             expected: '../../?query#fragment' },
      { input: 'http://example.org/foo/bar',                         expected: '../../bar' },
      { input: 'http://example.org/foo/bar?',                        expected: '../../bar?' },
      { input: 'http://example.org/foo/bar#',                        expected: '../../bar#' },
      { input: 'http://example.org/foo/bar?query',                   expected: '../../bar?query' },
      { input: 'http://example.org/foo/bar#fragment',                expected: '../../bar#fragment' },
      { input: 'http://example.org/foo/bar?query#',                  expected: '../../bar?query#' },
      { input: 'http://example.org/foo/bar?query#fragment',          expected: '../../bar?query#fragment' },
      { input: 'http://example.org/foo/bar/',                        expected: '../' },
      { input: 'http://example.org/foo/bar/?',                       expected: '../?' },
      { input: 'http://example.org/foo/bar/#',                       expected: '../#' },
      { input: 'http://example.org/foo/bar/?query',                  expected: '../?query' },
      { input: 'http://example.org/foo/bar/#fragment',               expected: '../#fragment' },
      { input: 'http://example.org/foo/bar/?query#',                 expected: '../?query#' },
      { input: 'http://example.org/foo/bar/?query#fragment',         expected: '../?query#fragment' },
      { input: 'http://example.org/extended',                        expected: '../../../extended' },
      { input: 'http://example.org/?extended',                       expected: '../../../?extended' },
      { input: 'http://example.org/#extended',                       expected: '../../../#extended' },
      { input: 'http://example.org/?queryextended',                  expected: '../../../?queryextended' },
      { input: 'http://example.org/#fragmentextended',               expected: '../../../#fragmentextended' },
      { input: 'http://example.org/?query#extended',                 expected: '../../../?query#extended' },
      { input: 'http://example.org/?query#fragmentextended',         expected: '../../../?query#fragmentextended' },
      { input: 'http://example.org/fooextended',                     expected: '../../../fooextended' },
      { input: 'http://example.org/foo?extended',                    expected: '../../../foo?extended' },
      { input: 'http://example.org/foo#extended',                    expected: '../../../foo#extended' },
      { input: 'http://example.org/foo?queryextended',               expected: '../../../foo?queryextended' },
      { input: 'http://example.org/foo#fragmentextended',            expected: '../../../foo#fragmentextended' },
      { input: 'http://example.org/foo?query#extended',              expected: '../../../foo?query#extended' },
      { input: 'http://example.org/foo?query#fragmentextended',      expected: '../../../foo?query#fragmentextended' },
      { input: 'http://example.org/foo/extended',                    expected: '../../extended' },
      { input: 'http://example.org/foo/?extended',                   expected: '../../?extended' },
      { input: 'http://example.org/foo/#extended',                   expected: '../../#extended' },
      { input: 'http://example.org/foo/?queryextended',              expected: '../../?queryextended' },
      { input: 'http://example.org/foo/#fragmentextended',           expected: '../../#fragmentextended' },
      { input: 'http://example.org/foo/?query#extended',             expected: '../../?query#extended' },
      { input: 'http://example.org/foo/?query#fragmentextended',     expected: '../../?query#fragmentextended' },
      { input: 'http://example.org/foo/barextended',                 expected: '../../barextended' },
      { input: 'http://example.org/foo/bar?extended',                expected: '../../bar?extended' },
      { input: 'http://example.org/foo/bar#extended',                expected: '../../bar#extended' },
      { input: 'http://example.org/foo/bar?queryextended',           expected: '../../bar?queryextended' },
      { input: 'http://example.org/foo/bar#fragmentextended',        expected: '../../bar#fragmentextended' },
      { input: 'http://example.org/foo/bar?query#extended',          expected: '../../bar?query#extended' },
      { input: 'http://example.org/foo/bar?query#fragmentextended',  expected: '../../bar?query#fragmentextended' },
      { input: 'http://example.org/foo/bar/extended',                expected: '../extended' },
      { input: 'http://example.org/foo/bar/?extended',               expected: '../?extended' },
      { input: 'http://example.org/foo/bar/#extended',               expected: '../#extended' },
      { input: 'http://example.org/foo/bar/?queryextended',          expected: '../?queryextended' },
      { input: 'http://example.org/foo/bar/#fragmentextended',       expected: '../#fragmentextended' },
      { input: 'http://example.org/foo/bar/?query#extended',         expected: '../?query#extended' },
      { input: 'http://example.org/foo/bar/?query#fragmentextended', expected: '../?query#fragmentextended' },
      { input: 'http://example.org/?/extended',                      expected: '../../../?/extended' },
      { input: 'http://example.org/??extended',                      expected: '../../../??extended' },
      { input: 'http://example.org/#/extended',                      expected: '../../../#/extended' },
      { input: 'http://example.org/#?extended',                      expected: '../../../#?extended' },
      { input: 'http://example.org/##extended',                      expected: '../../../##extended' },
      { input: 'http://example.org/?query/extended',                 expected: '../../../?query/extended' },
      { input: 'http://example.org/?query?extended',                 expected: '../../../?query?extended' },
      { input: 'http://example.org/#fragment/extended',              expected: '../../../#fragment/extended' },
      { input: 'http://example.org/#fragment?extended',              expected: '../../../#fragment?extended' },
      { input: 'http://example.org/#fragment#extended',              expected: '../../../#fragment#extended' },
      { input: 'http://example.org/?query#fragment/extended',        expected: '../../../?query#fragment/extended' },
      { input: 'http://example.org/?query#fragment?extended',        expected: '../../../?query#fragment?extended' },
      { input: 'http://example.org/?query#fragment#extended',        expected: '../../../?query#fragment#extended' },
      { input: 'http://example.org/foo?/extended',                   expected: '../../../foo?/extended' },
      { input: 'http://example.org/foo??extended',                   expected: '../../../foo??extended' },
      { input: 'http://example.org/foo#/extended',                   expected: '../../../foo#/extended' },
      { input: 'http://example.org/foo#?extended',                   expected: '../../../foo#?extended' },
      { input: 'http://example.org/foo##extended',                   expected: '../../../foo##extended' },
      { input: 'http://example.org/foo?query/extended',              expected: '../../../foo?query/extended' },
      { input: 'http://example.org/foo?query?extended',              expected: '../../../foo?query?extended' },
      { input: 'http://example.org/foo#fragment/extended',           expected: '../../../foo#fragment/extended' },
      { input: 'http://example.org/foo#fragment?extended',           expected: '../../../foo#fragment?extended' },
      { input: 'http://example.org/foo#fragment#extended',           expected: '../../../foo#fragment#extended' },
      { input: 'http://example.org/foo?query#fragment/extended',     expected: '../../../foo?query#fragment/extended' },
      { input: 'http://example.org/foo?query#fragment?extended',     expected: '../../../foo?query#fragment?extended' },
      { input: 'http://example.org/foo?query#fragment#extended',     expected: '../../../foo?query#fragment#extended' },
    );

    function testRelativizes(baseIRI, ...cases) {
      describe(`baseIRI ${baseIRI}`, () => {
        const parser = new Parser({ baseIRI });
        // This parser is given no base IRI on purpose:
        // the written base directive must suffice to restore the IRIs
        const baselessParser = new Parser();
        for (const { input, expected } of cases) {
          const writer = new Writer({ baseIRI });
          const baseWriter = new Writer({ baseIRI, writeBase: true });
          const quad = new Quad(new NamedNode('urn:ex:s'), new NamedNode('urn:ex:p'), new NamedNode(input));
          it(`relativizes <${input}> to <${expected}>`, async () => {
            writer.addQuad(quad);
            baseWriter.addQuad(quad);

            const outputString = await new Promise(resolve => {
              writer.end((error, output) => {
                resolve(output);
              });
            });
            const baseOutputString = await new Promise(resolve => {
              baseWriter.end((error, output) => {
                resolve(output);
              });
            });

            expect(outputString).toBe(`<urn:ex:s> <urn:ex:p> <${expected}>.\n`);
            expect(baseOutputString).toBe(`@base <${baseIRI}>.\n${outputString}`);

            // Now parsing our resulting strings, should give us our original quad.
            for (const [outputParser, output] of [[parser, outputString], [baselessParser, baseOutputString]]) {
              const outputQuad = await new Promise(resolve => {
                outputParser.parse(output, (error, quad) => {
                  if (quad) {
                    resolve(quad);
                  }
                });
              });

              expect(outputQuad).toStrictEqual(quad);
            }
          });
        }
      });
    }
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
            expect(outputStream.result).toBe(expectedResult);
            expect(outputStream).toHaveProperty('ended', true);
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
