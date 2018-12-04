var StreamParser = require('..').StreamParser;

// Implements the IParser interface from rdf-test-suite
// https://github.com/rubensworks/rdf-test-suite.js/blob/master/lib/testcase/rdfsyntax/IParser.ts
module.exports = {
  parse: function (data, baseIRI, options) {
    return require('arrayify-stream')(require('streamify-string')(data).pipe(
      new StreamParser(Object.assign({ baseIRI: baseIRI }, options))));
  },
};
