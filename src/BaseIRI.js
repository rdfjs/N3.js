import { escapeRegex } from './Util';

// Do not handle base IRIs without scheme, and currently unsupported cases:
// - file: IRIs (which could also use backslashes)
// - IRIs containing /. or /.. or //
const INVALID_OR_UNSUPPORTED = /^:?[^:?#]*(?:[?#]|$)|^file:|^[^:]*:\/*[^?#]+?\/(?:\.\.?(?:\/|$)|\/)/i;

export default class BaseIRI {
  constructor(base) {
    this.base = base;
    this._initialized = false;
    this._baseLength = 0;
    this._baseMatcher = null;
    this._pathReplacements = {};
  }

  static supports(base) {
    return !INVALID_OR_UNSUPPORTED.test(base);
  }

  _init() {
    if (this._initialized)
      return this.baseMatcher !== null;
    this._initialized = true;

    if (!BaseIRI.supports(this.base))
      return false;

    // Generate regex for baseIRI with optional groups for segments
    let baseIRIRegex = '';
    let segmentsCount = 0;
    let stage = 0;
    const slashPositions = [];
    let i = 0;
    let containsQuery = false;

    // Stage 0: extract the scheme
    const scheme = /^[^:]*:\/*/.exec(this.base)[0];
    baseIRIRegex += escapeRegex(scheme);
    i = scheme.length;
    stage = 1;

    // Stage 1: find the next segment until reaching ? or #
    let end = this.base.length;
    while (stage === 1 && i < end) {
      const match = /[/?#]/.exec(this.base.substring(i));
      if (match) {
        if (match[0] === '#') {
          // Stop at this hash.
          end = i + match.index;
          stage = 3;
        }
        else {
          baseIRIRegex += escapeRegex(this.base.substring(i, i + match.index + 1));
          baseIRIRegex += '(';
          segmentsCount++;
          if (match[0] === '/') {
            slashPositions.push(i + match.index);
          }
          else {
            this._pathReplacements[i + match.index] = '?';
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

    // Stage 2: find any fragment
    if (stage === 2) {
      const match = /#/.exec(this.base.substring(i));
      if (match) {
        // Stop at this hash.
        end = i + match.index;
      }
      stage = 3;
    }

    // Stage 3: parse the remainder of the base IRI
    if (stage === 3) {
      baseIRIRegex += escapeRegex(this.base.substring(i, end));
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
    if (this._pathReplacements[end - 1] === undefined) {
      this._pathReplacements[end - 1] = '';
    }
    for (let i = 0; i < slashPositions.length; i++) {
      this._pathReplacements[slashPositions[i]] = '../'.repeat(slashPositions.length - i - 1);
    }
    this._pathReplacements[slashPositions[slashPositions.length - 1]] = './';

    // Set the baseMatcher
    this._baseMatcher = new RegExp(baseIRIRegex);
    this._baseLength = end;
    return true;
  }

  toRelative(iri) {
    if (!this._init())
      return iri;
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
    let substitution = this._pathReplacements[length - 1];
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
