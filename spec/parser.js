const { StreamParser } = require('..');

// The w3c-cg/N3 suites are served from w3c-cg.github.io, but their expected
// results still spell document IRIs under the suite's former w3c.github.io home.
// Parse those documents against the IRI the results were written for, so test
// IRIs stay canonical while relative IRIs resolve the way the suite expects.
const N3_TESTS = 'https://w3c-cg.github.io/N3/tests/';
const N3_TESTS_RESULT_BASE = 'https://w3c.github.io/N3/tests/';

// Implements the IParser interface from rdf-test-suite
// https://github.com/rubensworks/rdf-test-suite.js/blob/master/lib/testcase/rdfsyntax/IParser.ts
module.exports = {
  parse: function (data, baseIRI, options) {
    if (baseIRI && baseIRI.startsWith(N3_TESTS))
      baseIRI = N3_TESTS_RESULT_BASE + baseIRI.slice(N3_TESTS.length);
    return require('arrayify-stream').arrayifyStream(require('streamify-string')(data).pipe(
      new StreamParser(Object.assign({
        baseIRI: baseIRI,
        implicitEmptyPrefix: true,
        parseUnsupportedVersions: true,
      }, options))));
  },
};
