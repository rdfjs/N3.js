// **Validation** contains the well-formedness checks
// behind the parser's opt-in `validate` option.
// All checks are purely lexical:
// they test against the grammars of the relevant specifications,
// not against registries or value spaces.

const XSD = 'http://www.w3.org/2001/XMLSchema#';

// ### Absolute IRIs, following the `IRI` rule of RFC 3987
const UCSCHAR = '\\u00A0-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF' +
  '\\u{10000}-\\u{1FFFD}\\u{20000}-\\u{2FFFD}\\u{30000}-\\u{3FFFD}' +
  '\\u{40000}-\\u{4FFFD}\\u{50000}-\\u{5FFFD}\\u{60000}-\\u{6FFFD}' +
  '\\u{70000}-\\u{7FFFD}\\u{80000}-\\u{8FFFD}\\u{90000}-\\u{9FFFD}' +
  '\\u{A0000}-\\u{AFFFD}\\u{B0000}-\\u{BFFFD}\\u{C0000}-\\u{CFFFD}' +
  '\\u{D0000}-\\u{DFFFD}\\u{E1000}-\\u{EFFFD}';
const IPRIVATE = '\\uE000-\\uF8FF\\u{F0000}-\\u{FFFFD}\\u{100000}-\\u{10FFFD}';
const IUNRESERVED = `[A-Za-z0-9\\-._~${UCSCHAR}]`;
const PCT_ENCODED = '%[0-9A-Fa-f]{2}';
const SUB_DELIMS = "[!$&'()*+,;=]";
const IPCHAR = `(?:${IUNRESERVED}|${PCT_ENCODED}|${SUB_DELIMS}|[:@])`;
const H16 = '[0-9A-Fa-f]{1,4}';
const DEC_OCTET = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])';
const IPV4 = `${DEC_OCTET}(?:\\.${DEC_OCTET}){3}`;
const LS32 = `(?:${H16}:${H16}|${IPV4})`;
const IPV6 = `(?:(?:${H16}:){6}${LS32}` +
  `|::(?:${H16}:){5}${LS32}` +
  `|(?:${H16})?::(?:${H16}:){4}${LS32}` +
  `|(?:(?:${H16}:)?${H16})?::(?:${H16}:){3}${LS32}` +
  `|(?:(?:${H16}:){0,2}${H16})?::(?:${H16}:){2}${LS32}` +
  `|(?:(?:${H16}:){0,3}${H16})?::${H16}:${LS32}` +
  `|(?:(?:${H16}:){0,4}${H16})?::${LS32}` +
  `|(?:(?:${H16}:){0,5}${H16})?::${H16}` +
  `|(?:(?:${H16}:){0,6}${H16})?::)`;
const IP_LITERAL = `\\[(?:${IPV6}|v[0-9A-Fa-f]+\\.[A-Za-z0-9\\-._~!$&'()*+,;=:]+)\\]`;
const IREG_NAME = `(?:${IUNRESERVED}|${PCT_ENCODED}|${SUB_DELIMS})*`;
const IHOST = `(?:${IP_LITERAL}|${IPV4}|${IREG_NAME})`;
const IUSERINFO = `(?:${IUNRESERVED}|${PCT_ENCODED}|${SUB_DELIMS}|:)*`;
const IAUTHORITY = `(?:${IUSERINFO}@)?${IHOST}(?::[0-9]*)?`;
const IHIER_PART = `(?://${IAUTHORITY}(?:/${IPCHAR}*)*` +
  `|/(?:${IPCHAR}+(?:/${IPCHAR}*)*)?` +
  `|${IPCHAR}+(?:/${IPCHAR}*)*)?`;
const IQUERY = `(?:${IPCHAR}|[${IPRIVATE}/?])*`;
const IFRAGMENT = `(?:${IPCHAR}|[/?])*`;
const IRI = new RegExp(
  `^[A-Za-z][A-Za-z0-9+.-]*:${IHIER_PART}(?:\\?${IQUERY})?(?:#${IFRAGMENT})?$`, 'u');

// ### Language tags, following the `Language-Tag` rule of RFC 5646 (BCP 47)
const LANGUAGE_TAG = new RegExp(
  // langtag: language, script, region, variants, extensions, private use
  '^(?:(?:[a-z]{2,3}(?:-[a-z]{3}(?:-[a-z]{3}){0,2})?|[a-z]{4,8})' +
  '(?:-[a-z]{4})?(?:-(?:[a-z]{2}|[0-9]{3}))?' +
  '(?:-(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3}))*' +
  '(?:-[a-wy-z0-9](?:-[a-z0-9]{2,8})+)*(?:-x(?:-[a-z0-9]{1,8})+)?' +
  // privateuse-only tags
  '|x(?:-[a-z0-9]{1,8})+' +
  // irregular grandfathered tags (the regular ones match the langtag rule)
  '|en-GB-oed|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE' +
  '|i-(?:ami|bnn|default|enochian|hak|klingon|lur|mingo|navajo|pwn|tao|tay|tsu))$',
  'i');

// ### Lexical spaces of common XSD datatypes,
// following the patterns of XML Schema Definition Language 1.1 Part 2
const TIMEZONE = '(?:Z|[+-](?:0[0-9]|1[0-3]):[0-5][0-9]|[+-]14:00)?';
const DATE = '-?(?:[1-9][0-9]{3,}|0[0-9]{3})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])';
const TIME = '(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]+)?|24:00:00(?:\\.0+)?)';
const DECIMAL = '[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)';
const FLOATING_POINT = `(?:${DECIMAL}(?:[eE][+-]?[0-9]+)?|[+-]?INF|NaN)`;
const datatypes = {
  [`${XSD}boolean`]:  /^(?:true|false|1|0)$/,
  [`${XSD}integer`]:  /^[+-]?[0-9]+$/,
  [`${XSD}decimal`]:  new RegExp(`^${DECIMAL}$`),
  [`${XSD}double`]:   new RegExp(`^${FLOATING_POINT}$`),
  [`${XSD}float`]:    new RegExp(`^${FLOATING_POINT}$`),
  [`${XSD}date`]:     new RegExp(`^${DATE}${TIMEZONE}$`),
  [`${XSD}time`]:     new RegExp(`^${TIME}${TIMEZONE}$`),
  [`${XSD}dateTime`]: new RegExp(`^${DATE}T${TIME}${TIMEZONE}$`),
};

// Checks whether the given string is an absolute IRI as per RFC 3987
export function isValidIRI(iri) {
  return IRI.test(iri);
}

// Checks whether the given string is a well-formed language tag as per BCP 47
export function isValidLanguageTag(tag) {
  return LANGUAGE_TAG.test(tag);
}

// Checks whether the given literal value is within the lexical space
// of the given datatype IRI; values of unknown datatypes cannot be judged
export function isValidDatatypeValue(value, datatype) {
  const pattern = datatypes[datatype];
  return !pattern || pattern.test(value);
}
