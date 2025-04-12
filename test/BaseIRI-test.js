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
    relativizes('an HTTP URL', 'http://example.org/foo/',
      'http://example.org/foo/baz', 'baz');

    relativizes('an HTTPS URL', 'https://example.org/foo/',
      'https://example.org/foo/baz', 'baz');

    relativizes('a file URL', 'file:///tmp/foo/bar',
      'file:///tmp/foo/bar/baz');

    relativizes('a base IRI without scheme', '/tmp/foo/bar',
      '/tmp/foo/bar/baz');

    relativizes('a base IRI containing //', 'http://example.org/foo//bar',
      'http://example.org/foo//bar/baz');

    relativizes('a base IRI containing ./', 'http://example.org/foo/./bar',
      'http://example.org/foo/./bar/baz');

    relativizes('a base IRI containing ../', 'http://example.org/foo/../bar',
      'http://example.org/foo/../bar/baz');

    relativizes('a base IRI ending in //', 'http://example.org/foo//',
      'http://example.org/foo//baz');

    relativizes('a base IRI ending in ./', 'http://example.org/foo/.',
      'http://example.org/foo/./baz');

    relativizes('a base IRI ending in ../', 'http://example.org/foo/..',
      'http://example.org/foo/../baz');

    relativizes('an IRI ending in //', 'http://example.org/foo/',
      'http://example.org/foo//');

    relativizes('an IRI ending in /.', 'http://example.org/foo/',
      'http://example.org/foo/.');

    relativizes('an IRI ending in /..', 'http://example.org/foo/',
      'http://example.org/foo/..');

    relativizes('an IRI ending in /./', 'http://example.org/foo/',
      'http://example.org/foo/./');

    relativizes('an IRI ending in /../', 'http://example.org/foo/',
      'http://example.org/foo/../');

    relativizes('an IRI containing // at the matching position', 'http://example.org/foo/',
      'http://example.org/foo//baz');

    relativizes('an IRI containing ./ at the matching position', 'http://example.org/foo/',
      'http://example.org/foo/./baz');

    relativizes('an IRI containing ../ at the matching position', 'http://example.org/foo/',
      'http://example.org/foo/../baz');

    relativizes('an IRI containing //', 'http://example.org/foo/',
      'http://example.org/foo/bar//baz');

    relativizes('an IRI containing ./', 'http://example.org/foo/',
      'http://example.org/foo/bar/./baz');

    relativizes('an IRI containing ../', 'http://example.org/foo/',
      'http://example.org/foo/bar/../baz');

    relativizes('an IRI containing // in its query string', 'http://example.org/foo/',
      'http://example.org/foo/baz?bar//baz', 'baz?bar//baz');

    relativizes('an IRI containing ./ in its query string', 'http://example.org/foo/',
      'http://example.org/foo/baz?bar/./baz', 'baz?bar/./baz');

    relativizes('an IRI containing ../ in its query string', 'http://example.org/foo/',
      'http://example.org/foo/baz?bar/../baz', 'baz?bar/../baz');

    relativizes('an IRI containing // in its fragment', 'http://example.org/foo/',
      'http://example.org/foo/baz#bar//baz', 'baz#bar//baz');

    relativizes('an IRI containing ./ in its fragment', 'http://example.org/foo/',
      'http://example.org/foo/baz#bar/./baz', 'baz#bar/./baz');

    relativizes('an IRI containing ../ in its fragment', 'http://example.org/foo/',
      'http://example.org/foo/baz#bar/../baz', 'baz#bar/../baz');
  });
});

function relativizes(description, base, absolute, relative) {
  it(`${relative ? 'relativizes' : 'does not relativize'} ${description}`, () => {
    const baseIri = new BaseIRI(base);
    expect(baseIri.toRelative(absolute)).toBe(relative || absolute);
  });
}
