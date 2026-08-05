// **N3ProvenanceParser** wraps N3Parser to track quad *utterances* on the
// side: a multiset of source occurrences layered over the set of quads.
//
// RDF/JS stores are sets of value-equal quads; provenance needs the
// occurrences.  Rather than slow the store down, this wrapper keeps a
// Map from a canonical quad key (never object identity — RDF/JS only
// promises `.equals()`, and N3Store reconstructs quads on read) to the
// quad's utterances:
//
//   {quad, subject: Range[], predicate: Range[], object: Range[], graph: Range[]}
//
// Each Range is {start, end} in absolute character offsets (plus
// {line, column} of the start).  Ranges come in arrays because provenance
// can be split or synthetic; a position whose term has no source token
// (e.g. rdf:first in a collection) has an empty array.
//
// The underlying parser reports spans through its opt-in `onQuadSpans`
// option, which costs nothing when unused.
import N3Parser from './N3Parser';

export function termKey(term) {
  switch (term.termType) {
  case 'NamedNode': return `<${term.value}>`;
  case 'BlankNode': return `_:${term.value}`;
  case 'Literal': {
    const val = `"${term.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
    if (term.language)
      return `${val}@${term.language}${term.direction ? `--${term.direction}` : ''}`;
    if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string')
      return `${val}^^<${term.datatype.value}>`;
    return val;
  }
  case 'DefaultGraph': return '';
  case 'Variable': return `?${term.value}`;
  case 'Quad': return `<<(${termKey(term.subject)} ${termKey(term.predicate)} ${termKey(term.object)})>>`;
  default: throw new Error(`termKey: unknown termType ${term.termType}`);
  }
}

export function quadKey(quad) {
  return `${termKey(quad.subject)} ${termKey(quad.predicate)} ${termKey(quad.object)} ${termKey(quad.graph)}`;
}

export class ProvenanceIndex {
  constructor() { this._map = new Map(); }

  _add(quad, utterance) {
    const key = quadKey(quad);
    if (!this._map.has(key))
      this._map.set(key, []);
    this._map.get(key).push(utterance);
  }

  // ### `get` returns the utterances of a quad (empty array if never uttered)
  get(quad) { return this._map.get(quadKey(quad)) || []; }

  // ### `size` is the number of distinct quads uttered
  get size() { return this._map.size; }

  [Symbol.iterator]() { return this._map.values(); }
}

export default class N3ProvenanceParser {
  constructor(options = {}) {
    this._options = options;
  }

  // ### `parse` synchronously parses `input`, returning
  // `{quads, provenance, prefixes}`
  parse(input) {
    function absolute(span) {
      if (!span)
        return [];
      const start = span.start;
      let end = span.end;
      // some lexer token lengths include trailing whitespace; trim it
      while (end > start && /\s/.test(input[end - 1]))
        end--;
      return [{ start, end, line: span.line }];
    }

    const provenance = new ProvenanceIndex();
    const parser = new N3Parser({
      ...this._options,
      // fires synchronously from _emit during the synchronous parse below
      onQuadSpans: (quad, spans) => {
        provenance._add(quad, {
          quad,
          subject:   absolute(spans.subject),
          predicate: absolute(spans.predicate),
          object:    absolute(spans.object),
          graph:     absolute(spans.graph),
        });
      },
    });
    const quads = parser.parse(input);
    const prefixes = parser._prefixes;
    return { quads, provenance, prefixes };
  }
}
