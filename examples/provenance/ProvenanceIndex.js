// **N3ProvenanceIndex** stores and resolves the locations of quad occurrences.
import N3EntityIndex from './EntityIndex';

const components = ['subject', 'predicate', 'object', 'graph'];
const valuesPerRange = 4;
const valuesPerOccurrence = components.length * valuesPerRange;

function writeRange(target, offset, range) {
  if (range === null) {
    target[offset] = 0;
    target[offset + 1] = 0;
    target[offset + 2] = 0;
    target[offset + 3] = 0;
    return;
  }
  if (Array.isArray(range)) {
    target[offset] = range[0];
    target[offset + 1] = range[1];
    target[offset + 2] = range[2];
    target[offset + 3] = range[3];
  }
  else {
    target[offset] = range.line;
    target[offset + 1] = range.start;
    target[offset + 2] = range.endLine || range.line;
    target[offset + 3] = range.end;
  }
}

function appendRanges(target, subject, predicate, object, graph) {
  const offset = target.length;
  writeRange(target, offset, subject);
  writeRange(target, offset + valuesPerRange, predicate);
  writeRange(target, offset + valuesPerRange * 2, object);
  writeRange(target, offset + valuesPerRange * 3, graph);
}

function isClosedRange(range) {
  return range === null || !Array.isArray(range) || range[4];
}

function appendPending(target, pending) {
  for (const occurrence of pending)
    appendRanges(target, occurrence[0], occurrence[1], occurrence[2], occurrence[3]);
}

function readRange(source, offset) {
  return source[offset] === 0 ? null : {
    start: { line: source[offset], column: source[offset + 1] },
    end: { line: source[offset + 2], column: source[offset + 3] },
  };
}

function materializeRange(range) {
  if (range === null)
    return null;
  return Array.isArray(range) ? {
    start: { line: range[0], column: range[1] },
    end: { line: range[2], column: range[3] },
  } : {
    start: { line: range.line, column: range.start },
    end: { line: range.endLine || range.line, column: range.end },
  };
}

export function materializeOccurrence(subject, predicate, object, graph) {
  return {
    subject: materializeRange(subject),
    predicate: materializeRange(predicate),
    object: materializeRange(object),
    graph: materializeRange(graph),
  };
}

function readOccurrences(source) {
  const occurrences = new Array(source.length / valuesPerOccurrence);
  for (let offset = 0, index = 0; offset < source.length; offset += valuesPerOccurrence, index++) {
    occurrences[index] = {
      subject: readRange(source, offset),
      predicate: readRange(source, offset + valuesPerRange),
      object: readRange(source, offset + valuesPerRange * 2),
      graph: readRange(source, offset + valuesPerRange * 3),
    };
  }
  return occurrences;
}

export class ProvenanceIndex {
  constructor(entityIndex = new N3EntityIndex()) {
    this._entityIndex = entityIndex;
    this._quadOccurrences = Object.create(null);
    this._pendingOccurrences = Object.create(null);
  }

  // Adds public occurrence data by value. Later changes to `occurrence` do not
  // alter the index.
  add(quad, occurrence) {
    // Pack first so malformed public input cannot partially mutate the index.
    const packed = [];
    for (const component of components) {
      const range = occurrence[component];
      if (range === null)
        packed.push(0, 0, 0, 0);
      else
        packed.push(range.start.line, range.start.column, range.end.line, range.end.column);
    }

    const quadId = this._entityIndex.intern(quad);
    this._finalize(quadId);
    const stored = this._quadOccurrences[quadId];
    if (stored === undefined)
      this._quadOccurrences[quadId] = packed;
    else
      stored.push(...packed);
  }

  // Adds the parser's compact, mutable range references. Compound ranges are
  // finalized when parsing finishes, once their closing token is known.
  _add(quadId, subject, predicate, object, graph) {
    const pending = this._pendingOccurrences[quadId];
    if (pending !== undefined) {
      pending.push([subject, predicate, object, graph]);
      return;
    }

    if (isClosedRange(subject) && isClosedRange(predicate) &&
        isClosedRange(object) && isClosedRange(graph)) {
      let stored = this._quadOccurrences[quadId];
      if (stored === undefined)
        stored = this._quadOccurrences[quadId] = [];
      appendRanges(stored, subject, predicate, object, graph);
      return;
    }

    this._pendingOccurrences[quadId] = [[subject, predicate, object, graph]];
  }

  _finalize(quadId) {
    const pending = this._pendingOccurrences[quadId];
    if (pending === undefined)
      return;

    let stored = this._quadOccurrences[quadId];
    if (stored === undefined)
      stored = this._quadOccurrences[quadId] = [];
    appendPending(stored, pending);
    delete this._pendingOccurrences[quadId];
  }

  _finalizeAll() {
    const allPending = this._pendingOccurrences;
    this._pendingOccurrences = Object.create(null);
    for (const quadId in allPending) {
      let stored = this._quadOccurrences[quadId];
      if (stored === undefined)
        stored = this._quadOccurrences[quadId] = [];
      appendPending(stored, allPending[quadId]);
    }
  }

  get(quad) {
    const quadId = this._entityIndex.lookup(quad);
    if (quadId === undefined)
      return [];
    this._finalize(quadId);
    const occurrences = this._quadOccurrences[quadId];
    return occurrences === undefined ? [] : readOccurrences(occurrences);
  }

  *[Symbol.iterator]() {
    this._finalizeAll();
    for (const quadId in this._quadOccurrences)
      yield [this._entityIndex.resolve(quadId), readOccurrences(this._quadOccurrences[quadId])];
  }
}
