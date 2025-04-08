import { BaseIri } from '../src';

describe('BaseIri', () => {
  describe('A BaseIri instance', () => {
    it('should relativize http://', () => {
      const baseIri = new BaseIri('http://example.org/foo/');

      const iri = `${baseIri.value}baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe('baz');
    });

    it('should relativize https://', () => {
      const baseIri = new BaseIri('https://example.org/foo/');

      const iri = `${baseIri.value}baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe('baz');
    });

    it('should not relativize when initializing with a file scheme IRI', () => {
      const baseIri = new BaseIri('file:///tmp/foo/bar');

      const iri = `${baseIri.value}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize when initializing with a IRI without scheme', () => {
      const baseIri = new BaseIri('/tmp/foo/bar');

      const iri = `${baseIri.value}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize when initializing with a IRI containing `//`', () => {
      const baseIri = new BaseIri('http://example.org/foo//bar');

      const iri = `${baseIri.value}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize when initializing with a IRI containing `/./`', () => {
      const baseIri = new BaseIri('http://example.org/foo/./bar');

      const iri = `${baseIri.value}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize when initializing with a IRI containing `/../`', () => {
      const baseIri = new BaseIri('http://example.org/foo/../bar');

      const iri = `${baseIri.value}/baz`;
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a IRI with file scheme', () => {
      const baseIri = new BaseIri('http://example.org/foo/');

      const iri = 'file:///tmp/foo/bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a IRI containing `//`', () => {
      const baseIri = new BaseIri('http://example.org/foo/');

      const iri = 'http://example.org/foo//bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a IRI containing `/./`', () => {
      const baseIri = new BaseIri('http://example.org/foo/');

      const iri = 'http://example.org/foo/./bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });

    it('should not relativize a IRI containing `/../`', () => {
      const baseIri = new BaseIri('http://example.org/foo/');

      const iri = 'http://example.org/foo/../bar';
      const relativized = baseIri.toRelative(iri);

      expect(relativized).toBe(iri);
    });
  });
});
