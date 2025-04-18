import { escapeRegex } from './Util';

// Do not handle base IRIs without scheme, and currently unsupported cases:
// - file: IRIs (which could also use backslashes)
// - IRIs containing /. or /.. or //
const BASE_UNSUPPORTED = /^:?[^:?#]*(?:[?#]|$)|^file:|^[^:]*:\/*[^?#]+?\/(?:\.\.?(?:\/|$)|\/)/i;
const SUFFIX_SUPPORTED = /^(?:(?:[^/?#]{3,}|\.?[^/?#.]\.?)(?:\/[^/?#]{3,}|\.?[^/?#.]\.?)*\/?)?(?:[?#]|$)/;
const CURRENT = './';
const PARENT = '../';
const QUERY = '?';
const FRAGMENT = '#';

export default class BaseIRI {
  constructor(base) {
    this.base = base;
    this._baseLength = 0;
    this._baseMatcher = null;
    this._pathReplacements = new Array(base.length + 1);
  }

  static supports(base) {
    return !BASE_UNSUPPORTED.test(base);
  }

  _getBaseMatcher() {
    if (this._baseMatcher)
      return this._baseMatcher;
    if (!BaseIRI.supports(this.base))
      return this._baseMatcher = /.^/;

    // Extract the scheme
    const scheme = /^[^:]*:\/*/.exec(this.base)[0];
    const regexHead = ['^', escapeRegex(scheme)];
    const regexTail = [];

    // Generate a regex for every path segment
    const segments = [], segmenter = /[^/?#]*([/?#])/y;
    let segment, query = 0, fragment = 0, last = segmenter.lastIndex = scheme.length;
    while (!query && !fragment && (segment = segmenter.exec(this.base))) {
      // Truncate base resolution path at fragment start
      if (segment[1] === FRAGMENT)
        fragment = segmenter.lastIndex - 1;
      else {
        // Create regex that matches the segment
        regexHead.push(escapeRegex(segment[0]), '(?:');
        regexTail.push(')?');

        // Create dedicated query string replacement
        if (segment[1] !== QUERY)
          segments.push(last = segmenter.lastIndex);
        else {
          query = last = segmenter.lastIndex;
          fragment = this.base.indexOf(FRAGMENT, query);
          this._pathReplacements[query] = QUERY;
        }
      }
    }

    // Precalculate parent path substitutions
    for (let i = 0; i < segments.length; i++)
      this._pathReplacements[segments[i]] = PARENT.repeat(segments.length - i - 1);
    this._pathReplacements[segments[segments.length - 1]] = CURRENT;

    // Add the remainder of the base IRI (without fragment) to the regex
    this._baseLength = fragment > 0 ? fragment : this.base.length;
    regexHead.push(
      escapeRegex(this.base.substring(last, this._baseLength)),
      query ? '(?:#|$)' : '(?:[?#]|$)',
    );
    return this._baseMatcher = new RegExp([...regexHead, ...regexTail].join(''));
  }

  toRelative(iri) {
    // Unsupported or non-matching base IRI
    const match = this._getBaseMatcher().exec(iri);
    if (!match)
      return iri;

    // Exact base IRI match
    const length = match[0].length;
    if (length === this._baseLength && length === iri.length)
      return '';

    // Parent path match
    const parentPath = this._pathReplacements[length];
    if (parentPath) {
      const suffix = iri.substring(length);
      // Don't abbreviate unsupported path
      if (parentPath !== QUERY && !SUFFIX_SUPPORTED.test(suffix))
        return iri;
      // Omit ./ with fragment or query string
      if (parentPath === CURRENT && /^[^?#]/.test(suffix))
        return suffix;
      // Append suffix to relative parent path
      return parentPath + suffix;
    }

    // Fragment or query string, so include delimiter
    return iri.substring(length - 1);
  }
}
