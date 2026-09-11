// **N3ProvenanceParser** parses a document and indexes each quad utterance by
// the locations emitted by N3TermLocationParser.
import N3TermLocationParser from './TermLocationParser';
import N3EntityIndex from './EntityIndex';
import { ProvenanceIndex, materializeOccurrence } from './ProvenanceIndex';

export { ProvenanceIndex };

function isComplete(event) {
  for (let i = 1; i < event.length; i++)
    if (Array.isArray(event[i]) && !event[i][4])
      return false;
  return true;
}

export default class N3ProvenanceParser {
  constructor(options = {}) { this._options = options || {}; }

  parse(input) {
    if (typeof input !== 'string')
      throw new TypeError('ProvenanceParser.parse only accepts a string');

    const { entityIndex: suppliedEntityIndex, onQuad, ...parserOptions } = this._options,
        entityIndex = suppliedEntityIndex || new N3EntityIndex({ factory: parserOptions.factory }),
        provenance = new ProvenanceIndex(entityIndex),
        emitted = onQuad && [];
    let nextEmission = 0, callbackFailed = false;
    function flushEvents() {
      while (emitted && nextEmission < emitted.length && isComplete(emitted[nextEmission])) {
        const event = emitted[nextEmission++];
        try {
          onQuad(event[0], materializeOccurrence(event[1], event[2], event[3], event[4]));
        }
        catch (error) {
          callbackFailed = true;
          throw error;
        }
      }
      if (emitted && nextEmission === emitted.length)
        emitted.length = nextEmission = 0;
    }
    const parser = new N3TermLocationParser({
      ...parserOptions,
      entityIndex,
      onQuad: (quad, quadId, subject, predicate, object, graph) => {
        provenance._add(quadId, subject, predicate, object, graph);
        if (emitted) {
          emitted.push([quad, subject, predicate, object, graph]);
          flushEvents();
        }
      },
    });
    let quads;
    try {
      quads = parser.parse(input);
    }
    catch (error) {
      if (!callbackFailed)
        flushEvents();
      throw error;
    }
    provenance._finalizeAll();
    flushEvents();
    return { quads, provenance, prefixes: parser._prefixes };
  }
}
