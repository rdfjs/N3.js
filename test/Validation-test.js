import { isValidIRI, isValidBlankNodeLabel, isValidLanguageTag,
         isValidBaseDirection, isValidDatatypeValue } from '../src/Validation';

const XSD = 'http://www.w3.org/2001/XMLSchema#';

describe('Validation', () => {
  describe('isValidIRI', () => {
    it.each([
      ['http://example.org'],
      ['http://example.org/'],
      ['http://example.org/path?query=a/b?c#frag/ment?'],
      ['http://user:password@example.org:8080/'],
      ['http://example.org:/'],
      ['https://127.0.0.1/'],
      ['http://[2001:db8::1]/'],
      ['http://[::ffff:127.0.0.1]/'],
      ['http://[2001:db8:0:1:1:1:1:1]/'],
      ['http://[v7.futuristic:address]/'],
      ['http://例え.テスト/パス?クエリ#フラグメント'],
      ['http://example.org/%2F%af'],
      ['urn:isbn:0451450523'],
      ['tag:example.org,2024:x'],
      ['mailto:someone@example.org'],
      ['file:///tmp/file.txt'],
      ['a:'],
      ['a+b-c.d:e'],
      ['http://example.org/!$&\'()*+,;=:@'],
    ])('accepts %s', iri => {
      expect(isValidIRI(iri)).toBe(true);
    });

    it.each([
      [''],
      ['a'],
      ['/absolute/path'],
      ['../relative'],
      ['1http://example.org/'],
      ['http://exa mple.org/'],
      ['http://example.org/a b'],
      ['http://example.org/%ZZ'],
      ['http://example.org/%A'],
      ['http://example.org/<a>'],
      ['http://example.org/"a"'],
      ['http://example.org/a\\b'],
      ['http://example.org/a^b'],
      ['http://example.org/a`b'],
      ['http://example.org/a{b}'],
      ['http://example.org/a|b'],
      ['http://[not:an:ip/'],
      ['http://example.org/\u0000'],
      ['http://example.org/\uffff'],
    ])('rejects %s', iri => {
      expect(isValidIRI(iri)).toBe(false);
    });
  });

  describe('isValidBlankNodeLabel', () => {
    it.each([
      ['a'],
      ['b0_a'],
      ['0'],
      ['_'],
      ['9a'],
      ['a.b.c'],
      ['a-b\u00b7'],
      ['\u00c0'],
      ['a\u0300'],
      ['\u{10000}a'],
      ['a\u{2f800}'],
    ])('accepts %s', label => {
      expect(isValidBlankNodeLabel(label)).toBe(true);
    });

    it.each([
      [''],
      ['.a'],
      ['a.'],
      ['-a'],
      ['\u0300a'],
      ['a b'],
      ['a\tb'],
      ['a\nb'],
      ['a<b'],
      ['a>b'],
      ['a\u0000b'],
      ['a\u0007'],
      ['a!b'],
      ['\uffff'],
    ])('rejects %s', label => {
      expect(isValidBlankNodeLabel(label)).toBe(false);
    });
  });

  describe('isValidLanguageTag', () => {
    it.each([
      ['en'],
      ['EN'],
      ['en-GB'],
      ['es-419'],
      ['zh-Hant-CN'],
      ['de-CH-1901'],
      ['sl-rozaj-biske'],
      ['zh-min-nan'],
      ['en-a-bbb-x-a-cccc'],
      ['x-private-use'],
      ['i-klingon'],
      ['en-GB-oed'],
      ['hy-Latn-IT-arevela'],
      ['abcdefgh'],
    ])('accepts %s', tag => {
      expect(isValidLanguageTag(tag)).toBe(true);
    });

    it.each([
      ['a'],
      ['abcdefghi'],
      ['419'],
      ['en-a'],
      ['en-GB-'],
      ['i-notgrandfathered'],
      ['x'],
      ['en-x'],
    ])('rejects %s', tag => {
      expect(isValidLanguageTag(tag)).toBe(false);
    });
  });

  describe('isValidBaseDirection', () => {
    it.each([
      ['ltr'],
      ['rtl'],
    ])('accepts %s', direction => {
      expect(isValidBaseDirection(direction)).toBe(true);
    });

    it.each([
      [''],
      ['LTR'],
      ['auto'],
      ['ltr '],
      ['ltr\n'],
      ['xltr'],
      ['rtlx'],
    ])('rejects %s', direction => {
      expect(isValidBaseDirection(direction)).toBe(false);
    });
  });

  describe('isValidDatatypeValue', () => {
    it.each([
      ['true', 'boolean'],
      ['0', 'boolean'],
      ['-042', 'integer'],
      ['+8', 'integer'],
      ['.5', 'decimal'],
      ['-1.', 'decimal'],
      ['1.5E-10', 'double'],
      ['INF', 'double'],
      ['NaN', 'float'],
      ['-0475-12-31', 'date'],
      ['2024-02-29+14:00', 'date'],
      ['00:00:00', 'time'],
      ['24:00:00.0', 'time'],
      ['2024-02-29T23:59:59.999-13:59', 'dateTime'],
      ['12345-01-01T00:00:00', 'dateTime'],
    ])('accepts "%s" as xsd:%s', (value, datatype) => {
      expect(isValidDatatypeValue(value, XSD + datatype)).toBe(true);
    });

    it.each([
      ['TRUE', 'boolean'],
      ['1.0', 'integer'],
      ['1e5', 'decimal'],
      ['.', 'decimal'],
      ['+INF2', 'double'],
      ['nan', 'float'],
      ['2024-2-9', 'date'],
      ['2024-02-29+15:00', 'date'],
      ['24:00:00.5', 'time'],
      ['2024-01-01', 'dateTime'],
    ])('rejects "%s" as xsd:%s', (value, datatype) => {
      expect(isValidDatatypeValue(value, XSD + datatype)).toBe(false);
    });

    it('accepts any value of an unknown datatype', () => {
      expect(isValidDatatypeValue('anything', `${XSD}gYear`)).toBe(true);
    });
  });
});
