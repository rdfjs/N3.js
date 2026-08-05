import { Parser, Store, ProvenanceParser, ProvenanceIndex, termKey, DataFactory } from '../src';

const BASE_IRI = 'http://example.org/';

function parse(doc, options = {}) {
  return new ProvenanceParser({ baseIRI: BASE_IRI, blankNodePrefix: '', ...options }).parse(doc);
}
function slice(doc, r) {
  return doc.slice(r.start, r.end);
}

describe('ProvenanceParser', () => {
  describe('utterance multiset semantics', () => {
    it('records two utterances for the same quad uttered twice', () => {
      const doc = '<s> <p> <o> .\n<s> <p> <o> .';
      const { quads, provenance } = parse(doc);
      expect(quads).toHaveLength(2);
      const utts = provenance.get(quads[0]);
      expect(utts).toHaveLength(2);
      expect(slice(doc, utts[0].subject[0])).toBe('<s>');
      expect(utts[0].subject[0].start).not.toBe(utts[1].subject[0].start);
    });

    it('reuses the subject span across a predicateObjectList', () => {
      const doc = '<s> <p1> <o1> ;\n    <p2> <o2> .';
      const { quads, provenance } = parse(doc);
      const [u1] = provenance.get(quads[0]);
      const [u2] = provenance.get(quads[1]);
      expect(u1.subject).toEqual(u2.subject);
      expect(slice(doc, u2.predicate[0])).toBe('<p2>');
      expect(u2.predicate[0].line).toBe(2);
    });

    it('gives synthetic blank nodes their introducing bracket span', () => {
      const doc = '[ <p> <o> ] <q> <r> .';
      const { quads, provenance } = parse(doc);
      const inner = quads.find(q => q.predicate.value === `${BASE_IRI}p`);
      const [u] = provenance.get(inner);
      expect(slice(doc, u.subject[0])).toBe('[');
      expect(slice(doc, u.object[0])).toBe('<o>');
    });

    it('spans literals, including language-tagged ones', () => {
      const doc = '<s> <p> "hello"@en .';
      const { quads, provenance } = parse(doc);
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.object[0])).toBe('"hello"');
    });
  });

  describe('value-keyed lookup', () => {
    it('resolves quads reconstructed by a store', () => {
      const doc = '<s> <p> "lit" .';
      const { quads, provenance } = parse(doc);
      const store = new Store(quads);
      const rebuilt = store.getQuads(null, null, null)[0];
      expect(rebuilt).not.toBe(quads[0]);
      expect(provenance.get(rebuilt)).toHaveLength(1);
    });
  });

  describe('TriG', () => {
    it('carries the graph label span', () => {
      const doc = '<g> { <s> <p> <o> }';
      const { quads, provenance } = parse(doc, { format: 'application/trig' });
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.graph[0])).toBe('<g>');
    });
  });

  describe('RDF 1.2', () => {
    it('spans annotation-derived reification quads', () => {
      const doc = '<s> <p> <o> ~ <r> {| <a> <b> |} .';
      const { quads, provenance } = parse(doc);
      const reifies = quads.find(q => q.predicate.value.endsWith('#reifies'));
      const [u] = provenance.get(reifies);
      expect(slice(doc, u.subject[0])).toBe('<r>');
      const annot = quads.find(q => q.predicate.value === `${BASE_IRI}a`);
      const [ua] = provenance.get(annot);
      expect(slice(doc, ua.object[0])).toBe('<b>');
    });
  });

  describe('coverage of span-less and exotic terms', () => {
    it("gives 'a' predicates no span", () => {
      const doc = '<s> a <C> .';
      const { quads, provenance } = parse(doc);
      const [u] = provenance.get(quads[0]);
      expect(u.predicate).toEqual([]);
      expect(slice(doc, u.object[0])).toBe('<C>');
    });

    it('spans language-tagged literals inside collections', () => {
      const doc = '<s> <p> ("x"@en) .';
      const { quads, provenance } = parse(doc);
      const first = quads.find(q => q.predicate.value.endsWith('#first'));
      const [u] = provenance.get(first);
      expect(slice(doc, u.object[0])).toBe('"x"');
    });

    it('spans subject literals in N3 mode', () => {
      const doc = '"s" <p> <o> <g> .';
      const { quads, provenance } = parse(doc, { format: 'text/n3' });
      const [u] = provenance.get(quads[0]);
      expect(slice(doc, u.subject[0])).toBe('"s"');
    });

    it('keys triple terms, variables and the default graph', () => {
      const doc = '<a> <b> <<( <s> <p> <o> )>> .';
      const { quads, provenance } = parse(doc);
      expect(provenance.get(quads[0])).toHaveLength(1);
      expect(termKey(DataFactory.variable('v'))).toBe('?v');
      expect(termKey(DataFactory.defaultGraph())).toBe('');
      expect(() => termKey({ termType: 'Unheard' })).toThrow(/unknown termType/);
    });

    it('gives rdf:nil subjects (empty collection) no span', () => {
      const doc = '() <p> <o> .';
      const { quads, provenance } = parse(doc);
      const [u] = provenance.get(quads[0]);
      expect(u.subject).toEqual([]);
    });

    it('constructs without options', () => {
      const { quads } = new ProvenanceParser().parse('<http://x/s> <http://x/p> <http://x/o> .');
      expect(quads).toHaveLength(1);
    });

    it('exposes size and iteration over utterance lists', () => {
      const { provenance } = parse('<s> <p> <o> .\n<s> <p> <o2> .');
      expect(provenance.size).toBe(2);
      expect([...provenance].map(utts => utts.length)).toEqual([1, 1]);
      expect(new ProvenanceIndex().get(DataFactory.quad(
        DataFactory.namedNode('x:s'), DataFactory.namedNode('x:p'), DataFactory.namedNode('x:o'),
      ))).toEqual([]);
    });
  });

  describe('the onQuadSpans option', () => {
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
});
