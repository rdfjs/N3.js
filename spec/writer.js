const { Parser, Writer } = require('..');
const parser = require('./parser');

// Implements the IParser interface from rdf-test-suite, with the Writer in the loop:
// each document is parsed, written in the same format, and parsed again.
// Syntax and evaluation tests then check that the Writer's output
// is valid and carries the same quads as the original document.
module.exports = {
  parse: async function (data, baseIRI, options) {
    const format = options && options.format || parser.inferFormat(baseIRI);
    options = Object.assign({}, options, { format });
    const prefixes = {};
    const quads = await new Promise((resolve, reject) => {
      const result = [];
      new Parser(Object.assign({ baseIRI, implicitEmptyPrefix: true, parseUnsupportedVersions: true }, options))
        .parse(data, {
          onQuad: (error, quad) => error ? reject(error) : quad ? result.push(quad) : resolve(result),
          onPrefix: (prefix, iri) => { prefixes[prefix] = iri; },
        });
    });
    const written = await new Promise((resolve, reject) => {
      const writer = new Writer({ format, prefixes });
      writer.addQuads(quads);
      writer.end((error, result) => error ? reject(error) : resolve(result));
    });
    try {
      return await parser.parse(written, baseIRI, options);
    }
    catch (error) {
      error.message += `\nWriter output:\n${written}`;
      throw error;
    }
  },
};
