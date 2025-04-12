import { BaseIRI } from '../src';

describe('BaseIRI', () => {
  it('should advertise support for base IRIs', () => {
    expect(BaseIRI.supports('http://example.org/')).toBe(true);

    expect(BaseIRI.supports(':')).toBe(false);
    expect(BaseIRI.supports('/')).toBe(false);

    expect(BaseIRI.supports('a:')).toBe(true);
    expect(BaseIRI.supports('abc:')).toBe(true);
    expect(BaseIRI.supports('#:')).toBe(false);
    expect(BaseIRI.supports('?:')).toBe(false);
    expect(BaseIRI.supports('a?b#c:')).toBe(false);

    expect(BaseIRI.supports('?abc:')).toBe(false);
    expect(BaseIRI.supports('#abc:')).toBe(false);
    expect(BaseIRI.supports('/foo/bar?abc:')).toBe(false);
    expect(BaseIRI.supports('/foo/bar#abc:')).toBe(false);

    expect(BaseIRI.supports('file:')).toBe(false);
    expect(BaseIRI.supports('file:abc')).toBe(false);
    expect(BaseIRI.supports('file:/abc')).toBe(false);
    expect(BaseIRI.supports('file://abc')).toBe(false);
    expect(BaseIRI.supports('file:///abc')).toBe(false);
    expect(BaseIRI.supports('FILE:abc')).toBe(false);

    expect(BaseIRI.supports('http://example.org/foo/')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo//')).toBe(false);
    expect(BaseIRI.supports('http://example.org/foo/.')).toBe(false);
    expect(BaseIRI.supports('http://example.org/foo/./')).toBe(false);
    expect(BaseIRI.supports('http://example.org/foo/..')).toBe(false);
    expect(BaseIRI.supports('http://example.org/foo/../')).toBe(false);
    expect(BaseIRI.supports('http://example.org/foo//bar')).toBe(false);
    expect(BaseIRI.supports('http://example.org/foo/./bar')).toBe(false);
    expect(BaseIRI.supports('http://example.org/foo/../bar')).toBe(false);

    expect(BaseIRI.supports('http://example.org/foo?/')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?//')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?/.')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?/./')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?/..')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?/../')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?//bar')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?/./bar')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo?/../bar')).toBe(true);

    expect(BaseIRI.supports('http://example.org/foo#/')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#//')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#/.')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#/./')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#/..')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#/../')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#//bar')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#/./bar')).toBe(true);
    expect(BaseIRI.supports('http://example.org/foo#/../bar')).toBe(true);
  });

  describe('A BaseIRI instance', () => {
    it('should relativize http://', () => {
      const baseIri = new BaseIRI('http://example.org/foo/');

      const iri = `${baseIri.base}baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe('baz');
    });

    it('should relativize https://', () => {
      const baseIri = new BaseIRI('https://example.org/foo/');

      const iri = `${baseIri.base}baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe('baz');
    });

    it('should not relativize a base IRI with a file scheme', () => {
      const baseIri = new BaseIRI('file:///tmp/foo/bar');

      const iri = `${baseIri.base}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a base IRI without scheme', () => {
      const baseIri = new BaseIRI('/tmp/foo/bar');

      const iri = `${baseIri.base}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a base IRI containing `//`', () => {
      const baseIri = new BaseIRI('http://example.org/foo//bar');

      const iri = `${baseIri.base}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a base IRI containing `/./`', () => {
      const baseIri = new BaseIRI('http://example.org/foo/./bar');

      const iri = `${baseIri.base}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a base IRI containing `/../`', () => {
      const baseIri = new BaseIRI('http://example.org/foo/../bar');

      const iri = `${baseIri.base}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a base IRI ending in `/.`', () => {
      const baseIri = new BaseIRI('http://example.org/foo/.');

      const iri = `${baseIri.base}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a base IRI ending in `/..`', () => {
      const baseIri = new BaseIRI('http://example.org/foo/..');

      const iri = `${baseIri.base}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize an IRI with file scheme', () => {
      const baseIri = new BaseIRI('http://example.org/foo/');

      const iri = 'file:///tmp/foo/bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize an IRI containing `//`', () => {
      const baseIri = new BaseIRI('http://example.org/foo/');

      const iri = 'http://example.org/foo//bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize an IRI containing `/./`', () => {
      const baseIri = new BaseIRI('http://example.org/foo/');

      const iri = 'http://example.org/foo/./bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize an IRI containing `/../`', () => {
      const baseIri = new BaseIRI('http://example.org/foo/');

      const iri = 'http://example.org/foo/../bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });
  });
});
