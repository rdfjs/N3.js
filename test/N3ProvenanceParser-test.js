import { Lexer, Parser, Store, DataFactory } from '../src';
import ProvenanceParser, { ProvenanceIndex } from '../examples/provenance/ProvenanceParser';
import EntityIndex from '../examples/provenance/EntityIndex';
import N3TermLocationParser from '../examples/provenance/TermLocationParser';
import rdfDataModel from '@rdfjs/data-model';
import { isomorphic } from 'rdf-isomorphic';
import { EventEmitter } from 'events';

const BASE_IRI = 'http://example.org/';

function parse(doc, options = {}) {
  return new ProvenanceParser({ baseIRI: BASE_IRI, blankNodePrefix: '', ...options }).parse(doc);
}
function offset(doc, position) {
  const newline = /\r\n|\r|\n/g;
  let lineStart = 0;
  for (let line = 1; line < position.line; line++) {
    const match = newline.exec(doc);
    lineStart = match.index + match[0].length;
  }
  return lineStart + position.column;
}
function slice(doc, range) {
  return doc.slice(offset(doc, range.start), offset(doc, range.end));
}
function frozenInterningFactory() {
  const terms = new Map(), factory = Object.create(DataFactory);
  factory.namedNode = value => {
    let term = terms.get(value);
    if (term === undefined)
      terms.set(value, term = Object.freeze(DataFactory.namedNode(value)));
    return term;
  };
  factory.literal = (...args) => Object.freeze(DataFactory.literal(...args));
  factory.blankNode = (...args) => Object.freeze(DataFactory.blankNode(...args));
  factory.variable = (...args) => Object.freeze(DataFactory.variable(...args));
  factory.defaultGraph = () => Object.freeze(DataFactory.defaultGraph());
  factory.quad = (...args) => Object.freeze(DataFactory.quad(...args));
  return factory;
}

describe('ProvenanceParser', () => {
  describe('utterance multiset semantics', () => {
    it('records two utterances for the same quad uttered twice', () => {
      const doc = '<s> <p> <o> .\n<s> <p> <o> .';
      const { quads, provenance } = parse(doc);
      expect(quads).toHaveLength(2);
      const utts = provenance.get(quads[0]);
      expect(utts).toHaveLength(2);
      expect(slice(doc, utts[0].subject)).toBe('<s>');
      expect(utts[0].subject.start).not.toEqual(utts[1].subject.start);
    });

    it('packs occurrence data directly for duplicate utterances', () => {
      const doc = '<s> <p> <o> .\n<s> <p> <o> .\n<s> <p> <o> .';
      const { quads, provenance } = parse(doc);
      expect(provenance.get(quads[0])).toHaveLength(3);
      const occurrences = Object.values(provenance._quadOccurrences)[0];
      expect(occurrences).toHaveLength(48);
      expect(occurrences.every(value => typeof value === 'number')).toBe(true);
    });

    it('reuses the subject span across a predicateObjectList', () => {
      const doc = '<s> <p1> <o1> ;\n    <p2> <o2> .';
      const { quads, provenance } = parse(doc);
      const [u1] = provenance.get(quads[0]);
      const [u2] = provenance.get(quads[1]);
      expect(u1.subject).toEqual(u2.subject);
      expect(slice(doc, u2.predicate)).toBe('<p2>');
      expect(u2.predicate.start.line).toBe(2);
    });

    it.each([
      ['LF', '\n'],
      ['CRLF', '\r\n'],
      ['CR', '\r'],
    ])('converts indented line positions after %s to source offsets', (_, newline) => {
      const doc = `<s> <p> <o> .${newline}  <s2> <p2> <o2> .`;
      const { quads, provenance } = parse(doc);
      const [utterance] = provenance.get(quads[1]);
      expect(utterance.subject.start).toEqual({ line: 2, column: 2 });
      expect(slice(doc, utterance.subject)).toBe('<s2>');
    });

    it('carries all four ranges in N-Quads', () => {
      const doc = '<http://e/s> <http://e/p> <http://e/o> <http://e/g> .';
      const { quads, provenance } = parse(doc, { format: 'application/n-quads' });
      const occurrence = provenance.get(quads[0])[0];
      expect(['subject', 'predicate', 'object', 'graph'].map(component => slice(doc, occurrence[component])))
        .toEqual(['<http://e/s>', '<http://e/p>', '<http://e/o>', '<http://e/g>']);
    });

    it('associates inverted N3 terms with their resulting quad positions', () => {
      const doc = '<o> is <p> of <s> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const occurrence = provenance.get(quads[0])[0];
      expect(['subject', 'predicate', 'object'].map(component => slice(doc, occurrence[component])))
        .toEqual(['<s>', '<p>', '<o>']);
    });

    it.each([
      ['LF', '\n'],
      ['CRLF', '\r\n'],
      ['CR', '\r'],
    ])('converts a multiline literal containing %s to a source range', (_, newline) => {
      const lexicalLiteral = `"""first${newline}second"""`;
      const doc = `<s> <p> ${lexicalLiteral} .`;
      const { quads, provenance } = parse(doc);
      const location = provenance.get(quads[0])[0].object;
      expect(location).toEqual({
        start: { line: 1, column: 8 },
        end: { line: 2, column: 9 },
      });
      expect(slice(doc, location)).toBe(lexicalLiteral);
    });

    it('includes a suffix after a multiline literal', () => {
      const literal = '"""first\nsecond"""@en--rtl';
      const doc = `<s> <p> ${literal} .`;
      const { quads, provenance } = parse(doc);
      expect(slice(doc, provenance.get(quads[0])[0].object)).toBe(literal);
    });

    it('accounts for a byte-order mark when converting line positions', () => {
      const doc = '\uFEFF<s> <p> <o> .';
      const { quads, provenance } = parse(doc);
      const subject = provenance.get(quads[0])[0].subject;
      expect(subject.start).toEqual({ line: 1, column: 1 });
      expect(slice(doc, subject)).toBe('<s>');
    });

    it('covers original escaped spellings rather than decoded values', () => {
      const doc = '@prefix ex: <http://e/>. ex:s ex:p\\-x "a\\tb" .';
      const { quads, provenance } = parse(doc);
      const occurrence = provenance.get(quads[0])[0];
      expect(slice(doc, occurrence.subject)).toBe('ex:s');
      expect(slice(doc, occurrence.predicate)).toBe('ex:p\\-x');
      expect(slice(doc, occurrence.object)).toBe('"a\\tb"');
    });

    it('gives anonymous property-list terms their complete span', () => {
      const doc = '[ <p> <o> ] <q> <r> .';
      const { quads, provenance } = parse(doc);
      const inner = quads.find(q => q.predicate.value === `${BASE_IRI}p`);
      const [u] = provenance.get(inner);
      expect(slice(doc, u.subject)).toBe('[ <p> <o> ]');
      expect(slice(doc, u.object)).toBe('<o>');
    });

    it('spans literals, including language-tagged ones', () => {
      const doc = '<s> <p> "hello"@en .';
      const { quads, provenance } = parse(doc);
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.object)).toBe('"hello"@en');
    });
  });

  describe('value-keyed lookup', () => {
    it('allows occurrences to be added through the public API', () => {
      const provenance = new ProvenanceIndex();
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      const occurrence = { subject: null, predicate: null, object: null, graph: null };
      provenance.add(quad, occurrence);
      expect(provenance.get(quad)).toEqual([occurrence]);
      provenance.add(quad, occurrence);
      expect(provenance.get(quad)).toHaveLength(2);
    });

    it('snapshots public additions and returns fresh occurrence values', () => {
      const provenance = new ProvenanceIndex();
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      const occurrence = {
        subject: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } },
        predicate: null,
        object: null,
        graph: null,
      };
      provenance.add(quad, occurrence);
      occurrence.subject.start.column = 99;
      const first = provenance.get(quad);
      first[0].subject.start.column = 88;
      expect(provenance.get(quad)[0].subject.start.column).toBe(0);
    });

    it('does not retain partial data when a public occurrence is malformed', () => {
      const provenance = new ProvenanceIndex(), quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      expect(() => provenance.add(quad, {
        subject: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } },
      })).toThrow();
      expect([...provenance]).toEqual([]);

      const occurrence = { subject: null, predicate: null, object: null, graph: null };
      provenance.add(quad, occurrence);
      expect(provenance.get(quad)).toEqual([occurrence]);
    });

    it('does not allocate an entity ID for an unknown lookup', () => {
      const entityIndex = new EntityIndex(), provenance = new ProvenanceIndex(entityIndex);
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      const allocatedIds = entityIndex._id;
      expect(provenance.get(quad)).toEqual([]);
      expect(entityIndex._id).toBe(allocatedIds);
    });

    it('returns no occurrences for a known but unrecorded quad', () => {
      const entityIndex = new EntityIndex(), provenance = new ProvenanceIndex(entityIndex);
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      entityIndex.intern(quad);
      expect(provenance.get(quad)).toEqual([]);
    });

    it('appends pending parser data after an existing public occurrence', () => {
      const entityIndex = new EntityIndex(), provenance = new ProvenanceIndex(entityIndex);
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      const occurrence = { subject: null, predicate: null, object: null, graph: null };
      provenance.add(quad, occurrence);
      const range = [1, 0, 1, 3, false], quadId = entityIndex.lookup(quad);
      provenance._add(quadId, range, null, null, null);
      expect(provenance.get(quad)).toHaveLength(2);
    });

    it('groups multiple pending occurrences before compacting them', () => {
      const entityIndex = new EntityIndex(), provenance = new ProvenanceIndex(entityIndex);
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      const quadId = entityIndex.intern(quad), range = [1, 0, 1, 3, false];
      provenance._add(quadId, range, null, null, null);
      provenance._add(quadId, range, null, null, null);
      range[4] = true;
      expect(provenance.get(quad)).toHaveLength(2);
    });

    it('finalizes pending data behind an existing compact occurrence', () => {
      const entityIndex = new EntityIndex(), provenance = new ProvenanceIndex(entityIndex);
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      provenance.add(quad, { subject: null, predicate: null, object: null, graph: null });
      const range = [1, 0, 1, 3, false];
      provenance._add(entityIndex.lookup(quad), range, null, null, null);
      range[4] = true;
      provenance._finalizeAll();
      expect(provenance.get(quad)).toHaveLength(2);
    });

    it('keeps closed occurrences behind an earlier pending occurrence', () => {
      const entityIndex = new EntityIndex(), provenance = new ProvenanceIndex(entityIndex);
      const quad = DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      );
      const quadId = entityIndex.intern(quad), range = [1, 2, 1, 5, false];
      provenance._add(quadId, range, null, null, null);
      provenance._add(quadId, null, null, null, null);
      range[4] = true;
      expect(provenance.get(quad).map(({ subject }) => subject && subject.start.column))
        .toEqual([2, null]);
    });

    it('resolves quads reconstructed by a store', () => {
      const doc = '<s> <p> "lit" .';
      const { quads, provenance } = parse(doc);
      const store = new Store(quads);
      const rebuilt = store.getQuads(null, null, null)[0];
      expect(rebuilt).not.toBe(quads[0]);
      expect(provenance.get(rebuilt)).toHaveLength(1);
    });

    it('shares compact numeric quad identities with an N3 entity index', () => {
      const entityIndex = new EntityIndex();
      const { quads, provenance } = parse('<s> <p> "lit" .', { entityIndex });
      const allocatedIds = entityIndex._id;
      const quadId = entityIndex._termToNumericId(quads[0]);
      expect(quadId).toEqual(expect.any(Number));
      expect(Object.getPrototypeOf(provenance._quadOccurrences)).toBeNull();
      expect(provenance._quadOccurrences[quadId]).toHaveLength(16);

      const store = new Store({ entityIndex });
      store.addQuads(quads);
      expect(entityIndex._id).toBe(allocatedIds);
      expect(provenance.get(store.getQuads(null, null, null)[0])).toHaveLength(1);
    });

    it('preserves duplicate insertion order', () => {
      const doc = '<s> <p> <o> .\n\n  <s> <p> <o> .';
      const { quads, provenance } = parse(doc);
      const occurrences = provenance.get(quads[0]);
      expect(occurrences.map(({ subject }) => subject.start)).toEqual([
        { line: 1, column: 0 },
        { line: 3, column: 2 },
      ]);
    });
  });

  describe('TriG', () => {
    it('carries the graph label span', () => {
      const doc = '<g> { <s> <p> <o> }';
      const { quads, provenance } = parse(doc, { format: 'application/trig' });
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.graph)).toBe('<g>');
    });
  });

  describe('RDF 1.2', () => {
    it('spans annotation-derived reification quads', () => {
      const doc = '<s> <p> <o> ~ <r> {| <a> <b> |} .';
      const { quads, provenance } = parse(doc);
      const reifies = quads.find(q => q.predicate.value.endsWith('#reifies'));
      const [u] = provenance.get(reifies);
      expect(slice(doc, u.subject)).toBe('<r>');
      const annot = quads.find(q => q.predicate.value === `${BASE_IRI}a`);
      const [ua] = provenance.get(annot);
      expect(slice(doc, ua.object)).toBe('<b>');
    });
  });

  describe('coverage of span-less and exotic terms', () => {
    it("spans the complete 'a' predicate", () => {
      const doc = '<s> a <C> .';
      const { quads, provenance } = parse(doc);
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.predicate)).toBe('a');
      expect(slice(doc, u.object)).toBe('<C>');
    });

    it.each([
      ['=', '='],
      ['=>', '=>'],
      ['<=', '<='],
    ])('spans the complete %s predicate abbreviation', (operator, expected) => {
      const doc = `<s> ${operator} <o> .`;
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      expect(slice(doc, provenance.get(quads[0])[0].predicate)).toBe(expected);
    });

    it('spans language-tagged literals inside collections', () => {
      const doc = '<s> <p> ("x"@en) .';
      const { quads, provenance } = parse(doc);
      const first = quads.find(q => q.predicate.value.endsWith('#first'));
      const [u] = provenance.get(first);
      expect(slice(doc, u.object)).toBe('"x"@en');
    });

    it('spans subject literals in N3 mode', () => {
      const doc = '"s" <p> <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.subject)).toBe('"s"');
    });

    it('spans predicate literals in N3 mode', () => {
      const doc = '<s> "p" <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.predicate)).toBe('"p"');
    });

    it.each([
      ['"s" "p" "o" .', ['"s"', '"p"', '"o"']],
      ['"s" 42 "o" .', ['"s"', '42', '"o"']],
      ['42 "p" true .', ['42', '"p"', 'true']],
      ['"s"@en "p" "o" .', ['"s"@en', '"p"', '"o"']],
    ])('keeps adjacent N3 term ranges independent in %s', (doc, expected) => {
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const occurrence = provenance.get(quads[0])[0];
      expect(['subject', 'predicate', 'object'].map(component => slice(doc, occurrence[component])))
        .toStrictEqual(expected);
    });

    it('keeps adjacent literal ranges independent inside a collection', () => {
      const doc = '<s> <p> ("a" "b" 42 "c") .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const items = quads.filter(q => q.predicate.value.endsWith('#first'));
      expect(items.map(q => slice(doc, provenance.get(q)[0].object)))
        .toStrictEqual(['"a"', '"b"', '42', '"c"']);
    });

    // Numbers and booleans reach the parser as a single `literal` token whose
    // prefix already holds the datatype, so they bypass the pending literal-token path.
    it('spans pre-datatyped object literals', () => {
      const doc = '<s> <p> 42, 1.5e0, true .';
      const { quads, provenance } = parse(doc);
      expect(quads.map(q => slice(doc, provenance.get(q)[0].object)))
        .toStrictEqual(['42', '1.5e0', 'true']);
    });

    it('spans pre-datatyped literals in collections', () => {
      const doc = '<s> <p> (42) .';
      const { quads, provenance } = parse(doc);
      const first = quads.find(q => q.predicate.value.endsWith('#first'));
      expect(slice(doc, provenance.get(first)[0].object)).toBe('42');
    });

    it('spans pre-datatyped subject and predicate literals in N3 mode', () => {
      const doc = '42 true <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.subject)).toBe('42');
      expect(slice(doc, u.predicate)).toBe('true');
    });

    it('indexes triple terms', () => {
      const doc = '<a> <b> <<( <s> <p> <o> )>> .';
      const { quads, provenance } = parse(doc);
      expect(provenance.get(quads[0])).toHaveLength(1);
    });

    it('spans rdf:nil denoted by an empty collection', () => {
      const doc = '() <p> <o> .';
      const { quads, provenance } = parse(doc);
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.subject)).toBe('()');
    });

    it('spans complete non-empty and nested collections', () => {
      const doc = '(<a> (<b>)) <p> <o> .';
      const { quads, provenance } = parse(doc);
      const outer = quads.find(q => q.predicate.value === `${BASE_IRI}p`);
      expect(slice(doc, provenance.get(outer)[0].subject)).toBe('(<a> (<b>))');
      const nestedMembership = quads.find(q => q.predicate.value.endsWith('#first') &&
        q.object.termType === 'BlankNode');
      expect(slice(doc, provenance.get(nestedMembership)[0].object)).toBe('(<b>)');
    });

    it('spans a collection used as a predicate', () => {
      const doc = '<s> (<p>) <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const outer = quads.find(q => q.object.value.endsWith('/o'));
      expect(slice(doc, provenance.get(outer)[0].predicate)).toBe('(<p>)');
    });

    it('leaves generated list cells and predicates without ranges', () => {
      const doc = '(<a> <b>) <p> <o> .';
      const { quads, provenance } = parse(doc);
      const second = quads.find(q => q.predicate.value.endsWith('#first') && q.object.value.endsWith('/b'));
      const occurrence = provenance.get(second)[0];
      expect(occurrence.subject).toBeNull();
      expect(occurrence.predicate).toBeNull();
    });

    it('spans a property list used as a list item', () => {
      const doc = '([ <p> <o> ]) <q> <r> .';
      const { quads, provenance } = parse(doc);
      const membership = quads.find(q => q.predicate.value.endsWith('#first'));
      expect(slice(doc, provenance.get(membership)[0].object)).toBe('[ <p> <o> ]');
    });

    it('leaves path-generated terms without ranges', () => {
      const doc = '<s>!<p> <q> <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const path = quads.find(q => q.predicate.value === `${BASE_IRI}p`);
      const outer = quads.find(q => q.predicate.value === `${BASE_IRI}q`);
      expect(provenance.get(path)[0].object).toBeNull();
      expect(provenance.get(outer)[0].subject).toBeNull();
    });

    it('leaves explicit-quantifier list structure without ranges', () => {
      const doc = '@forAll <x>. <x> <p> <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3', explicitQuantifiers: true });
      const item = quads.find(q => q.predicate.value.endsWith('#first'));
      const occurrence = provenance.get(item)[0];
      expect(occurrence.subject).toBeNull();
      expect(occurrence.predicate).toBeNull();
      expect(slice(doc, occurrence.object)).toBe('<x>');
    });

    it('spans complete anonymous property lists and formulas', () => {
      const doc = '[ <p> <o> ] <q> { <s> <p2> <o2> } .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const outer = quads.find(q => q.predicate.value === `${BASE_IRI}q`);
      const occurrence = provenance.get(outer)[0];
      expect(slice(doc, occurrence.subject)).toBe('[ <p> <o> ]');
      expect(slice(doc, occurrence.object)).toBe('{ <s> <p2> <o2> }');
      const inner = quads.find(q => q.predicate.value === `${BASE_IRI}p2`);
      expect(slice(doc, provenance.get(inner)[0].graph)).toBe('{ <s> <p2> <o2> }');
    });

    it('spans formulas whose final statement has explicit punctuation', () => {
      const doc = '{ <s> <p> <o> . } <q> <r> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const outer = quads.find(q => q.predicate.value === `${BASE_IRI}q`);
      expect(slice(doc, provenance.get(outer)[0].subject)).toBe('{ <s> <p> <o> . }');
    });

    it('spans a formula used as a predicate', () => {
      const doc = '<s> { <a> <b> <c> } <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const outer = quads.find(q => q.subject.value === `${BASE_IRI}s`);
      expect(slice(doc, provenance.get(outer)[0].predicate)).toBe('{ <a> <b> <c> }');
    });

    it('spans an empty formula that denotes true', () => {
      const doc = '{} <p> <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3', emptyFormulaAsTrue: true });
      expect(slice(doc, provenance.get(quads[0])[0].subject)).toBe('{}');
    });

    it('spans complete RDF-star triple terms', () => {
      const doc = '<a> <b> <<( <s> <p> <o> )>> .';
      const { quads, provenance } = parse(doc);
      expect(slice(doc, provenance.get(quads[0])[0].object)).toBe('<<( <s> <p> <o> )>>');
    });

    it('preserves an invalid RDF-star closing-token error', () => {
      expect(() => parse('<a> <b> <<( <s> <p> <o> >> .'))
        .toThrow('Expected )>> but got >>');
    });

    it('spans the complete embedded triple in N3 reification', () => {
      const doc = '<a> <b> << <s> <p> <o> >> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const reifies = quads.find(q => q.predicate.value.endsWith('#reifies'));
      const occurrence = provenance.get(reifies)[0];
      expect(occurrence.subject).toBeNull();
      expect(slice(doc, occurrence.object)).toBe('<< <s> <p> <o> >>');
    });

    it('uses the lexical range of an explicit reifier', () => {
      const doc = '<a> <b> << <s> <p> <o> ~ <r> >> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const reifies = quads.find(q => q.predicate.value.endsWith('#reifies'));
      expect(slice(doc, provenance.get(reifies)[0].subject)).toBe('<r>');
    });

    it('preserves an invalid N3 reification closing-token error', () => {
      expect(() => parse('<a> <b> << <s> <p> <o> )>> .', { format: 'text/n3' }))
        .toThrow('Expected >> but got )>>');
    });

    it('spans a blank named graph label as []', () => {
      const doc = 'GRAPH [] { <s> <p> <o> . }';
      const { quads, provenance } = parse(doc, { format: 'application/trig' });
      expect(slice(doc, provenance.get(quads[0])[0].graph)).toBe('[]');
    });

    it('spans an IRI following the GRAPH keyword', () => {
      const doc = 'GRAPH <g> { <s> <p> <o> . }';
      const { quads, provenance } = parse(doc, { format: 'application/trig' });
      expect(slice(doc, provenance.get(quads[0])[0].graph)).toBe('<g>');
    });

    it('preserves an invalid blank graph-label error', () => {
      expect(() => parse('GRAPH [ <g> { <s> <p> <o> . }', { format: 'application/trig' }))
        .toThrow('Invalid graph label');
    });

    it('constructs without options', () => {
      const { quads } = new ProvenanceParser().parse('<http://x/s> <http://x/p> <http://x/o> .');
      expect(quads).toHaveLength(1);
    });

    it('iterates over utterance lists without exposing counts', () => {
      const { provenance } = parse('<s> <p> <o> .\n<s> <p> <o2> .');
      const entries = [...provenance];
      expect(entries.map(([, occurrences]) => occurrences.length)).toEqual([1, 1]);
      expect(entries[0][0].termType).toBe('Quad');
      expect(provenance).not.toHaveProperty('size');
      expect(provenance).not.toHaveProperty('utteranceCount');
      expect(new ProvenanceIndex().get(DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      ))).toEqual([]);
    });
  });

  describe('occurrence tracking', () => {
    it('keeps the opening token active for delayed literal construction', () => {
      const doc = '<s> <p> "typed"^^<type>, "directed"@en--ltr, 42 .';
      const { quads, provenance } = parse(doc);
      expect(quads.map(q => slice(doc, provenance.get(q)[0].object)))
        .toStrictEqual(['"typed"^^<type>', '"directed"@en--ltr', '42']);
    });

    it('uses a null source token for implicit reification terms', () => {
      const { quads, provenance } = parse('<s> <p> <o> ~ .');
      const reifies = quads.find(q => q.predicate.value.endsWith('#reifies'));
      expect(reifies).toBeDefined();
      expect(Object.getOwnPropertySymbols(reifies)).toHaveLength(0);
      expect(Object.getOwnPropertySymbols(reifies.subject)).toHaveLength(0);
      expect(Object.getOwnPropertySymbols(reifies.object)).toHaveLength(0);
      expect(provenance.get(reifies)[0].subject).toBeNull();
      expect(provenance.get(reifies)[0].object).toBeNull();
    });

    it('does not attach private metadata to emitted terms', () => {
      const { quads } = parse('<s> <p> <o> .');
      expect(Object.getOwnPropertySymbols(quads[0])).toHaveLength(0);
      expect(Object.getOwnPropertySymbols(quads[0].subject)).toHaveLength(0);
      expect(Object.getOwnPropertySymbols(quads[0].predicate)).toHaveLength(0);
      expect(Object.getOwnPropertySymbols(quads[0].object)).toHaveLength(0);
    });

    it('locates each use of a quantified entity at its own token', () => {
      const doc = '@forAll <x>. <x> <p> <o> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const quad = quads.find(({ predicate }) => predicate.value === `${BASE_IRI}p`);
      const [{ subject }] = provenance.get(quad);
      expect(offset(doc, subject.start)).toBe(doc.lastIndexOf('<x>'));
    });

    it('locates simultaneous uses of one quantified term independently', () => {
      const doc = '@forAll <x>. <x> <x> <x> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const quad = quads[quads.length - 1], occurrence = provenance.get(quad)[0];
      expect([occurrence.subject, occurrence.predicate, occurrence.object]
        .map(range => [range.start.column, range.end.column]))
        .toEqual([[13, 16], [17, 20], [21, 24]]);
    });

    it('locates interned terms independently without mutating them', () => {
      const factory = frozenInterningFactory();

      const doc = '<x> <x> <x> .';
      const { quads, provenance } = parse(doc, { factory });
      expect(quads[0].subject).toBe(quads[0].predicate);
      expect(quads[0].predicate).toBe(quads[0].object);
      const occurrence = provenance.get(quads[0])[0];
      expect([occurrence.subject, occurrence.predicate, occurrence.object]
        .map(range => [range.start.column, range.end.column]))
        .toEqual([[0, 3], [4, 7], [8, 11]]);
      expect(Object.getOwnPropertySymbols(quads[0].subject)).toHaveLength(0);
    });

    it('does not confuse an interned rdf:nil term with a list placeholder', () => {
      const nil = '<http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>',
          doc = `${nil} <p> () .`,
          { quads, provenance } = parse(doc, { factory: frozenInterningFactory() }),
          occurrence = provenance.get(quads[0])[0];
      expect(slice(doc, occurrence.subject)).toBe(nil);
      expect(slice(doc, occurrence.object)).toBe('()');
    });

    it('supports quantified terms from an RDF/JS factory without internal IDs', () => {
      const doc = '@forAll <x>. <x> <p> <o> .',
          { quads, provenance } = parse(doc, { format: 'text/n3', factory: rdfDataModel }),
          quad = quads[quads.length - 1];
      expect(quad.subject.termType).toBe('Variable');
      expect(quad.predicate.value).toBe(`${BASE_IRI}p`);
      expect(quad.object.value).toBe(`${BASE_IRI}o`);
      expect(slice(doc, provenance.get(quad)[0].subject)).toBe('<x>');
    });

    it('carries the location of an IRI property-list identifier', () => {
      const doc = '[id <s> <p> <o>].';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      expect(slice(doc, provenance.get(quads[0])[0].subject)).toBe('<s>');
    });

    it('propagates entity parse errors', () => {
      expect(() => parse('<s> <p> .')).toThrow('Expected entity but got .');
    });

    it('passes raw factory terms to inherited prefix callbacks', () => {
      const prefixes = [];
      new N3TermLocationParser({ factory: rdfDataModel }).parse(
        '@prefix ex: <http://example.com/>. ex:s ex:p ex:o.',
        { onPrefix: (...args) => prefixes.push(args) },
      );
      expect(prefixes).toEqual([['ex', rdfDataModel.namedNode('http://example.com/')]]);
    });

    it('preserves custom factory receivers and method arities', () => {
      function recordingFactory(calls) {
        const factory = Object.create(DataFactory);
        for (const name of ['namedNode', 'blankNode', 'variable', 'literal', 'defaultGraph', 'quad']) {
          Object.defineProperty(factory, name, {
            value(...args) {
              calls.push({ name, arity: args.length, receiver: this });
              return DataFactory[name](...args);
            },
          });
        }
        return factory;
      }

      const doc = '<s> <p> [ <q> "value" ] .\n<s> <p> <<( <x> <y> _:z )>> .';
      const plainCalls = [], trackedCalls = [];
      new Parser({ baseIRI: BASE_IRI, blankNodePrefix: '', factory: recordingFactory(plainCalls) }).parse(doc);
      const trackedFactory = recordingFactory(trackedCalls);
      parse(doc, { factory: trackedFactory });
      expect(trackedCalls.map(({ name, arity }) => ({ name, arity })))
        .toStrictEqual(plainCalls.map(({ name, arity }) => ({ name, arity })));
      expect(trackedCalls.every(({ receiver }) => receiver === trackedFactory)).toBe(true);

      const variableCalls = [], variableFactory = recordingFactory(variableCalls);
      parse('?s <p> <o> .', { format: 'text/n3', factory: variableFactory });
      expect(variableCalls.find(({ name }) => name === 'variable').receiver).toBe(variableFactory);
    });

    it('uses the custom factory when reconstructing indexed quads', () => {
      class CustomNamedNode {
        constructor(value) { this.termType = 'NamedNode'; this.value = value; }
      }
      const factory = Object.create(DataFactory);
      factory.namedNode = value => new CustomNamedNode(value);
      const { provenance } = parse('<s> <p> <o> .', { factory });
      const [[quad]] = provenance;
      expect(quad.subject).toBeInstanceOf(CustomNamedNode);
      expect(quad.predicate).toBeInstanceOf(CustomNamedNode);
      expect(quad.object).toBeInstanceOf(CustomNamedNode);
    });

    it('rejects a non-RDF/JS quad factory with a clear error', () => {
      const factory = {
        namedNode: value => value,
        blankNode: value => `_:${value || 'b'}`,
        variable: value => `?${value}`,
        literal: value => `"${value}"`,
        defaultGraph: () => '',
        quad: (s, p, o, g) => ({ s, p, o, g }),
      };
      expect(() => parse('<s> <p> <o> .', { factory }))
        .toThrow('ProvenanceParser requires an RDF/JS-compatible data factory');
    });

    it('does not change what the parser emits', () => {
      const doc = '@prefix ex: <http://ex.example/>.\nex:s ex:p [ ex:q (1 2) ], "x"@en--ltr .';
      // anonymous blank node labels come from a global counter, so compare
      // with labels normalized by order of first appearance
      function normalize(quads) {
        const seen = new Map();
        function label(l) {
          if (!seen.has(l)) seen.set(l, `bn${seen.size}`);
          return seen.get(l);
        }
        return quads.map(q => JSON.stringify(q.toJSON(), (k, v, o) => v))
          .map((s, i) => JSON.parse(s))
          .map(j => JSON.parse(JSON.stringify(j), (k, v) =>
            v && v.termType === 'BlankNode' ? { ...v, value: label(v.value) } : v));
      }
      const plain = new Parser({ baseIRI: BASE_IRI, blankNodePrefix: '' }).parse(doc);
      const tracked = parse(doc);
      expect(normalize(tracked.quads)).toEqual(normalize(plain));
    });
  });

  describe('facade behavior', () => {
    it('constructs with null options', () => {
      expect(new ProvenanceParser(null).parse('<s> <p> <o> .').quads).toHaveLength(1);
    });

    it('rejects streaming input immediately', () => {
      expect(() => new ProvenanceParser().parse({ on() {} }))
        .toThrow('ProvenanceParser.parse only accepts a string');
    });

    it.each(['line', 'start', 'end'])('rejects custom lexer tokens without a numeric %s coordinate', field => {
      const lexer = {
        tokenize(input) {
          return new Lexer().tokenize(input).map(token => {
            const copy = { ...token };
            delete copy[field];
            return copy;
          });
        },
      };
      expect(() => parse('<s> <p> <o> .', { lexer }))
        .toThrow('Lexical provenance requires lexer tokens with numeric line, start, end, and multiline endLine');
    });

    it('rejects a non-numeric custom-lexer endLine', () => {
      const lexer = {
        tokenize(input) {
          return new Lexer().tokenize(input).map(token => ({ ...token, endLine: 'invalid' }));
        },
      };
      expect(() => parse('<s> <p> <o> .', { lexer }))
        .toThrow('Lexical provenance requires lexer tokens with numeric line, start, end, and multiline endLine');
    });

    it('accepts N3Lexer itself as a custom lexer for multiline tokens', () => {
      const doc = '<s> <p> """a\nb""" .', { quads, provenance } = parse(doc, { lexer: new Lexer() });
      expect(slice(doc, provenance.get(quads[0])[0].object)).toBe('"""a\nb"""');
    });

    it('validates coordinates on every custom-lexer token', () => {
      const lexer = {
        tokenize(input) {
          const tokens = new Lexer().tokenize(input).map(token => ({ ...token }));
          delete tokens[1].start;
          return tokens;
        },
      };
      expect(() => parse('<s> <p> <o> .', { lexer }))
        .toThrow('Lexical provenance requires lexer tokens with numeric line, start, end, and multiline endLine');
    });

    it('can be reused without carrying prefixes or occurrences across parses', () => {
      const parser = new ProvenanceParser({ baseIRI: BASE_IRI });
      const first = parser.parse('@prefix ex: <http://ex/>. ex:s ex:p ex:o.');
      const second = parser.parse('<s> <p> <o>.');
      expect(first.prefixes.ex).toBe('http://ex/');
      expect(second.prefixes.ex).toBeUndefined();
      expect(second.provenance.get(first.quads[0])).toEqual([]);
    });

    it('calls onQuad in parse order with complete public ranges', () => {
      const events = [], doc = '[ <p> <o> ] <q> <r> .';
      const result = parse(doc, { onQuad: (quad, occurrence) => events.push([quad, occurrence]) });
      expect(events.map(([quad]) => quad)).toEqual(result.quads);
      expect(slice(doc, events[0][1].subject)).toBe('[ <p> <o> ]');
    });

    it('emits completed quads before a later parse error', () => {
      const events = [];
      expect(() => new ProvenanceParser({
        baseIRI: BASE_IRI,
        onQuad: (...args) => events.push(args),
      }).parse('<s> <p> <o> . <unfinished>')).toThrow();
      expect(events).toHaveLength(1);
      expect(events[0][0].subject.value).toBe(`${BASE_IRI}s`);
    });

    it('emits a completed compound range before a later parse error', () => {
      const events = [];
      expect(() => new ProvenanceParser({
        baseIRI: BASE_IRI,
        format: 'text/n3',
        onQuad: (...args) => events.push(args),
      }).parse('[ <p> <o> ] . <unfinished>')).toThrow();
      expect(events).toHaveLength(1);
      expect(events[0][1].subject).toEqual({
        start: { line: 1, column: 0 },
        end: { line: 1, column: 11 },
      });
    });

    it('stops emitting when an onQuad callback throws', () => {
      const error = new Error('stop'), events = [];
      expect(() => parse('[ <p> <o> ] <q> <r> .', {
        onQuad: quad => {
          events.push(quad);
          throw error;
        },
      })).toThrow(error);
      expect(events).toHaveLength(1);
    });

    it('supports the inherited callback path in the internal location parser', done => {
      const events = [];
      new N3TermLocationParser({ onQuad: (...args) => events.push(args) })
        .parse('<s> <p> <o> .', (error, quad) => {
          if (error)
            return done(error);
          if (quad)
            return;
          expect(events).toHaveLength(1);
          done();
        });
    });

    it('constructs the internal location parser without options', () => {
      expect(new N3TermLocationParser().parse('<s> <p> <o> .')).toHaveLength(1);
    });
  });
});


describe('Callback-based provenance integration', () => {
  it.each([
    ['turtle', '(() ()) <p> <o>.'],
    ['text/n3', '(() ()) <p> <o>.'],
    ['text/n3', '<s> () ().'],
    ['text/n3', '(()!<p> ()^<q>) <r> <o>.'],
  ])('keeps lexical empty lists distinct from synthetic rdf:nil in %s: %s', (format, doc) => {
    const { quads, provenance } = parse(doc, { format });
    expect(isomorphic(quads, new Parser({ baseIRI: BASE_IRI, format }).parse(doc))).toBe(true);
    const occurrences = quads.map(quad => [quad, provenance.get(quad)[0]]);
    const lexical = occurrences.flatMap(([quad, occurrence]) =>
      ['subject', 'predicate', 'object'].filter(component => occurrence[component] &&
        quad[component].value.endsWith('#nil')).map(component => slice(doc, occurrence[component])));
    expect(lexical).toContain('()');
    const tails = occurrences.filter(([quad]) => quad.predicate.value.endsWith('#rest') &&
      quad.object.value.endsWith('#nil'));
    expect(tails.map(([, occurrence]) => occurrence.object)).toEqual(tails.map(() => null));
  });

  it.each([
    '[ <p> <o>; is <q> of <r> ] <a> <b>.',
    '{ <s> is <p> of <o>; <q> <r> }.',
    '<s> is <p> of <o> {| <q> <r> |}.',
    '<a> <b> <<( <s> is <p> of <o> )>>.',
    '<s> <- (<a>) <o>.',
  ])('preserves current N3 inverse semantics and term locations: %s', doc => {
    const { quads, provenance } = parse(doc, { format: 'text/n3' });
    expect(isomorphic(quads, new Parser({ baseIRI: BASE_IRI, format: 'text/n3' }).parse(doc))).toBe(true);
    for (const quad of quads) {
      const occurrence = provenance.get(quad)[0];
      const lexical = ['subject', 'predicate', 'object'].filter(component =>
        occurrence[component] && quad[component].termType === 'NamedNode' &&
        quad[component].value.startsWith(BASE_IRI));
      expect(lexical.map(component => slice(doc, occurrence[component])))
        .toEqual(lexical.map(component => `<${quad[component].value.slice(BASE_IRI.length)}>`));
    }
  });

  it('composes public observers and comments without losing literal suffix ranges', () => {
    const doc = '<s> <p> "text" # between\n @en--rtl .', before = [], after = [], comments = [];
    const parser = new N3TermLocationParser({ baseIRI: BASE_IRI });
    const quads = parser.parse(doc, {
      onToken: token => before.push(token),
      onTokenEnd: token => after.push(token),
      onComment: comment => comments.push(comment),
    });
    expect(quads[0].object.direction).toBe('rtl');
    expect(before).toEqual(after);
    expect(comments).toEqual([' between']);
  });

  it('keeps locations identical across every two-chunk split', () => {
    const doc = '\uFEFF<g> { [ <p> """a\r\nb"""@en--rtl ] <q> (() <x>) . }';
    const expected = parse(doc, { format: 'trig' });
    const expectedRanges = expected.quads.map(quad => expected.provenance.get(quad)[0]);
    for (let split = 0; split <= doc.length; split++) {
      const input = new EventEmitter(), entityIndex = new EntityIndex(),
          index = new ProvenanceIndex(entityIndex), quads = [];
      new N3TermLocationParser({
        baseIRI: BASE_IRI, format: 'trig', entityIndex,
        onQuad: (quad, id, ...ranges) => index._add(id, ...ranges),
      }).parse(input, (error, quad) => {
        if (error) throw error;
        if (quad) quads.push(quad);
      });
      input.emit('data', doc.slice(0, split));
      input.emit('data', doc.slice(split));
      input.emit('end');
      expect(isomorphic(quads, expected.quads)).toBe(true);
      expect(quads.map(quad => index.get(quad)[0])).toEqual(expectedRanges);
    }
  });

  it('supports resolving unknown IDs and interning a default-graph tuple', () => {
    const index = new EntityIndex();
    expect(index.resolve(999)).toBeUndefined();
    const term = DataFactory.namedNode('urn:value'), id = index.intern(term);
    const quadId = index.internQuad(id, id, id);
    expect(index.resolve(quadId)).toEqual(DataFactory.quad(term, term, term));
  });
});


describe('Empty-list identity with interning factories', () => {
  it.each([
    '<http://www.w3.org/1999/02/22-rdf-syntax-ns#nil> () ().',
    '() <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil> ().',
    '() () <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil>.',
  ])('preserves the separate lexical spellings in %s', doc => {
    const { quads, provenance } = parse(doc, { format: 'text/n3', factory: frozenInterningFactory() });
    const occurrence = provenance.get(quads[0])[0];
    expect(['subject', 'predicate', 'object'].map(component => slice(doc, occurrence[component])))
      .toEqual(doc.slice(0, -1).split(' '));
  });
});
