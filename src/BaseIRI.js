export default class BaseIRI {
  constructor(iri) {
    if (iri.startsWith('file://')) {
      // Base IRIs starting with file:// are not supported. Silently fail.
      return;
    }

    // Generate regex for baseIRI with optional groups for segments
    // Stage 0: find the first scheme delimiter -> stage 1
    // Stage 1: find the next /, ?, or #. '/' -> new segment -> stage 1, '?' -> stage 2, '#' -> update end to position before hash -> stage 3, none -> stage 3
    // Stage 2: find the next #. '#' -> update end to position before hash -> stage 3, none -> stage 3
    // Stage 3: find the end of the string, add '$' to this last segment
    this._baseSubstitutions = {};
    let baseIRIRegex = '';
    let segmentsCount = 0;
    let stage = 0;
    const slashPositions = [];
    let i = 0;
    let containsQuery = false;
    // Stage 0
    const match = /:\/{0,2}/.exec(iri);
    if (match) {
      baseIRIRegex += escapeRegex(iri.substring(0, match.index + match[0].length));
      i = match.index + match[0].length;
      stage = 1;
    }
    else {
      // Base IRI should contain a scheme followed by its delimiter (e.g., http://). Silently fail.
      return;
    }

    if (/\/\.{0,2}\//.test(iri.substring(i))) {
      // Base IRIs containing `//`, `/./`, or `/../` are not supported. Silently fail.
      return;
    }

    let end = iri.length;
    while (stage === 1 && i < end) {
      // Stage 1
      const match = /[/?#]/.exec(iri.substring(i));
      if (match) {
        if (match[0] === '#') {
          // Stop at this hash.
          end = i + match.index;
          stage = 3;
        }
        else {
          baseIRIRegex += escapeRegex(iri.substring(i, i + match.index + 1));
          baseIRIRegex += '(';
          segmentsCount++;
          if (match[0] === '/') {
            slashPositions.push(i + match.index);
          }
          else {
            this._baseSubstitutions[i + match.index] = '?';
            containsQuery = true;
            stage = 2;
          }
          i += match.index + 1;
        }
      }
      else {
        stage = 3;
      }
    }
    if (stage === 2) {
      // Stage 2
      const match = /#/.exec(iri.substring(i));
      if (match) {
        // Stop at this hash.
        end = i + match.index;
      }
      stage = 3;
    }
    if (stage === 3) {
      // Stage 3
      baseIRIRegex += escapeRegex(iri.substring(i, end));
      if (containsQuery) {
        baseIRIRegex += '(#|$)';
      }
      else {
        baseIRIRegex += '([?#]|$)';
      }
      i = end;
    }

    // Complete the optional groups for the segments
    baseIRIRegex += ')?'.repeat(segmentsCount);

    // Precalculate the rest of the substitutions
    if (this._baseSubstitutions[end - 1] === undefined) {
      this._baseSubstitutions[end - 1] = '';
    }
    for (let i = 0; i < slashPositions.length; i++) {
      this._baseSubstitutions[slashPositions[i]] = '../'.repeat(slashPositions.length - i - 1);
    }
    this._baseSubstitutions[slashPositions[slashPositions.length - 1]] = './';

    // Set the baseMatcher
    this._baseMatcher = new RegExp(baseIRIRegex);
    this._baseLength = end;
    this.value = iri.substring(0, end);
  }

  toRelative(iri) {
    if (iri.startsWith('file://')) {
      return iri;
    }
    const delimiterMatch = /:\/{0,2}/.exec(iri);
    if (!delimiterMatch || /\/\.{0,2}\//.test(iri.substring(delimiterMatch.index + delimiterMatch[0].length))) {
      return iri;
    }
    const match = this._baseMatcher.exec(iri);
    if (!match) {
      return iri;
    }
    const length = match[0].length;
    if (length === this._baseLength && length === iri.length) {
      return '';
    }
    let substitution = this._baseSubstitutions[length - 1];
    if (substitution !== undefined) {
      const substr = iri.substring(length);
      if (substitution === './' && substr && ((!substr.startsWith('#') && !substr.startsWith('?')) || length === this._baseLength)) {
        substitution = '';
      }
      return substitution + substr;
    }
    // Matched the [?#], so make sure to add the delimiter
    return iri.substring(length - 1);
  }
}

function escapeRegex(regex) {
  return regex.replace(/[\]\/\(\)\*\+\?\.\\\$]/g, '\\$&');
}
