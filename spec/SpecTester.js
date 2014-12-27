#!/usr/bin/env node
var N3Parser = require('../lib/N3Parser.js'),
    N3Store = require('../lib/N3Store.js');
var fs = require('fs'),
    url = require('url'),
    path = require('path'),
    request = require('request'),
    exec = require('child_process').exec,
    async = require('async');
require('colors');

// How many test cases may run in parallel?
var workers = 4;

// Prefixes
var prefixes = {
  mf:   'http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#',
  rdf:  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  rdft: 'http://www.w3.org/ns/rdftest#',
  dc:   'http://purl.org/dc/terms/',
  doap: 'http://usefulinc.com/ns/doap#',
  earl: 'http://www.w3.org/ns/earl#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  xsd:  'http://www.w3.org/2001/XMLSchema#',
};

// List predicates
var first = prefixes.rdf + 'first',
    rest = prefixes.rdf + 'rest',
    nil = prefixes.rdf + 'nil';

// Base class for objects that execute W3C spec test cases
function SpecTester(settings) {
  settings = settings || {};
  for (var key in settings)
    this['_' + key] = settings[key];

  // Create the folders that will contain the spec files and results
  [
    this._testFolder   = path.join(__dirname, this._name),
    this._outputFolder = path.join(this._testFolder, 'results'),
  ]
  .forEach(function (folder) { fs.existsSync(folder) || fs.mkdirSync(folder); });
}
// Makes the specified class inherit from the current class
SpecTester.isPrototypeOf = function (Class) {
  Class.prototype = Object.create(this.prototype);
};


// # Test suite execution

// Fetches the manifest, executes all tests, and reports results
SpecTester.prototype.run = function () {
  var self = this;
  console.log(this._title.bold);

  // 1. Fetch the tests, execute them, and generate the report
  async.waterfall([
    // 1.1 Fetch and parse the manifest
    self._fetch.bind(self, self._manifest.match(/[^\/]*$/)[0]),
    self._parseManifest.bind(self),

    // 1.2 Execute all tests in the manifest
    function executeTests(manifest, callback) {
      async.mapLimit(manifest.tests, workers,
        // 1.2.1 Execute an individual test
        function (test, callback) {
          async.parallel({ actionStream: self._fetch.bind(self, test.action),
                           resultStream: self._fetch.bind(self, test.result), },
            function (err, results) {
              self._performTest(test, results.actionStream, callback);
            });
        },
        // 1.2.2 Show the summary of all performed tests
        function showSummary(error, tests) {
          var score = tests.reduce(function (sum, test) { return sum + test.success; }, 0);
          console.log(('* passed ' + score + ' out of ' + manifest.tests.length + ' tests').bold);
          callback(error, tests);
        });
    },

    // 2. Generate the EARL report
    function (tests, callback) { self._generateEarlReport(tests, callback); },
  ],
  function (error) {
    if (error) {
      console.error('ERROR'.red);
      console.error((error.stack || error.toString()).red);
      process.exit(1);
    }
  });
};

// Fetches and caches the specified file, or retrieves it from disk
SpecTester.prototype._fetch = function (filename, callback) {
  if (!filename) return callback(null, null);
  var localFile = path.join(this._testFolder, filename), self = this;
  fs.exists(localFile, function (exists) {
    if (exists)
      fs.readFile(localFile, 'utf8', callback);
    else
      request.get(url.resolve(self._manifest, filename),
                  function (error, response, body) { callback(error, body); })
             .pipe(fs.createWriteStream(localFile));
  });
};

// Parses the tests manifest into tests
SpecTester.prototype._parseManifest = function (manifestContents, callback) {
  // Parse the manifest into triples
  var manifest = {}, testStore = new N3Store();
  new N3Parser({ format: 'text/turtle' }).parse(manifestContents, function (error, triple) {
    // Store triples until there are no more
    if (error)  return callback(error);
    if (triple) return testStore.addTriple(triple.subject, triple.predicate, triple.object);

    // Once all triples are there, get the first item of the test list
    var tests = manifest.tests = [],
        itemHead = testStore.find('', prefixes.mf + 'entries', null)[0].object;
    // Loop through all test items
    while (itemHead && itemHead !== nil) {
      // Find and store the item's properties
      var itemValue = testStore.find(itemHead, first, null)[0].object,
          itemTriples = testStore.find(itemValue, null, null),
          test = { id: itemValue.replace(/^#/, '') };
      itemTriples.forEach(function (triple) {
        var propertyMatch = triple.predicate.match(/#(.+)/);
        if (propertyMatch)
          test[propertyMatch[1]] = triple.object;
      });
      tests.push(test);

      // Find the next test item
      itemHead = testStore.find(itemHead, rest, null)[0].object;
    }
    return callback(null, manifest);
  });
};


// # Individual test execution

// Performs the test by parsing the specified document
SpecTester.prototype._performTest = function (test, actionStream, callback) {
  // Create the results file
  var resultFile = path.join(this._testFolder, test.action.replace(/\.ttl$/, '.nt')),
      resultStream = fs.createWriteStream(resultFile), self = this;
  resultStream.once('open', function () {
    // Try to parse the specified document
    var config = { format: self._name, documentURI: url.resolve(self._manifest, test.action) };
    new N3Parser(config).parse(actionStream,
      function (error, triple) {
        if (error) test.error = error;
        if (triple) resultStream.write(toNTriple(triple));
        else resultStream.end();
      });
  });
  // Verify the result if the result has been written
  resultStream.once('close', function () {
    self._verifyResult(test, resultFile,
                       test.result && path.join(self._testFolder, test.result), callback);
  });
};

// Verifies and reports the test result
SpecTester.prototype._verifyResult = function (test, resultFile, correctFile, callback) {
  // Negative tests are successful if an error occurred
  var negativeTest = /Negative/.test(test.type);
  if (negativeTest) {
    displayResult(null, !!test.error);
  }
  // Positive tests are successful if the results are equal,
  // or if the correct solution is not given but no error occurred
  else {
    if (!correctFile)
      displayResult(null, !test.error);
    else if (!resultFile)
      displayResult(null, false);
    else
      this._compareResultFiles(resultFile, correctFile, displayResult);
  }

  // Display the test result
  function displayResult(error, success, comparison) {
    console.log(unString(test.name).bold + ':', unString(test.comment),
                (success ? 'OK'.green : 'FAIL'.red).bold);
    if (error || !success) {
      console.log((correctFile ? fs.readFileSync(correctFile, 'utf8') : '(empty)').grey);
      console.log('  was expected, but got'.bold.grey);
      console.log((resultFile ? fs.readFileSync(resultFile, 'utf8') : '(empty)').grey);
      console.log(('  error: '.bold + (test.error || '(none)')).grey);
      if (comparison)
        console.log(('  comparison: ' + comparison).grey);
    }
    test.success = success;
    callback(null, test);
  }
};

// Verifies whether the two result files are equivalent
SpecTester.prototype._compareResultFiles = function (actual, expected, callback) {
  // Try a full-text comparison (fastest)
  async.parallel({
    actualContents:   fs.readFile.bind(fs,   actual, 'utf8'),
    expectedContents: fs.readFile.bind(fs, expected, 'utf8'),
  },
  function (error, results) {
    // If the full-text comparison was successful, graphs are certainly equal
    if (results.actualContents === results.expectedContents)
      callback(error, !error);
    // If not, we check for proper equality with SWObjects
    else
      exec('sparql -d ' + expected + ' --compare ' + actual, function (error, stdout) {
        callback(error, /^matched\s*$/.test(stdout), stdout);
      });
  });
};



// # EARL report generation

// Generate an EARL report with the given test results
SpecTester.prototype._generateEarlReport = function (tests, callback) {
  // Create the report file
  var reportFile = path.join(this._outputFolder, 'earl-report.ttl'),
      report = fs.createWriteStream(reportFile),
      date = new Date().toISOString(), self = this;
  var homepage = 'https://github.com/RubenVerborgh/N3.js',
      application = homepage + '#n3js',
      developer = 'http://ruben.verborgh.org/#me';

  report.once('open', function () {
    for (var prefix in prefixes)
      writeln('@prefix ', prefix, ': <', prefixes[prefix], '>.');
    writeln('@prefix manifest: <', self._manifest, '#>.');
    writeln();

    writeln('<> foaf:primaryTopic <', application, '>;');
    writeln('  dc:issued "', date, '"^^xsd:dateTime;');
    writeln('  foaf:maker <', developer, '>.');
    writeln();

    writeln('<', application, '> a earl:Software, earl:TestSubject, doap:Project;');
    writeln('  doap:name "N3.js";');
    writeln('  doap:homepage <', homepage, '>;');
    writeln('  doap:license <http://opensource.org/licenses/MIT>;');
    writeln('  doap:programming-language "JavaScript";');
    writeln('  doap:implements <http://www.w3.org/TR/turtle/>;');
    writeln('  doap:category <http://dbpedia.org/resource/Resource_Description_Framework>;');
    writeln('  doap:download-page <https://npmjs.org/package/n3>;');
    writeln('  doap:bug-database <', homepage, '/issues>;');
    writeln('  doap:blog <http://ruben.verborgh.org/blog/>;');
    writeln('  doap:developer <', developer, '>;');
    writeln('  doap:maintainer <', developer, '>;');
    writeln('  doap:documenter <', developer, '>;');
    writeln('  doap:maker <', developer, '>;');
    writeln('  dc:title "N3.js";');
    writeln('  dc:description   "N3.js is an asynchronous, streaming RDF parser for JavaScript."@en;');
    writeln('  doap:description "N3.js is an asynchronous, streaming RDF parser for JavaScript."@en;');
    writeln('  dc:creator <', developer, '>.');
    writeln();

    writeln('<', developer, '> a foaf:Person, earl:Assertor;');
    writeln('  foaf:name "Ruben Verborgh";');
    writeln('  foaf:homepage <http://ruben.verborgh.org/>;');
    writeln('  foaf:primaryTopicOf <http://ruben.verborgh.org/profile/>;');
    writeln('  rdfs:isDefinedBy <http://ruben.verborgh.org/profile/>.');

    tests.forEach(function (test) {
      writeln();
      writeln('manifest:', test.id, ' a earl:TestCriterion, earl:TestCase;');
      writeln('  dc:title ', escapeString(unString(test.name)), ';');
      writeln('  dc:description ', escapeString(unString(test.comment)), ';');
      writeln('  mf:action <', url.resolve(self._manifest, test.action), '>;');
      if (test.result)
        writeln('  mf:result <', url.resolve(self._manifest, test.result), '>;');
      writeln('  earl:assertions (');
      writeln('     [ a earl:Assertion;');
      writeln('       earl:assertedBy <', developer, '>;');
      writeln('       earl:test manifest:', test.id, ';');
      writeln('       earl:subject <', application, '>;');
      writeln('       earl:mode earl:automatic;');
      writeln('       earl:result [ a earl:TestResult; ',
                        'earl:outcome earl:', (test.success ? 'passed' : 'failed'), '; ',
                        'dc:date "', date, '"^^xsd:dateTime',
                      ' ]]');
      writeln('  ).');
    });
    report.end();
  });
  report.once('close', callback);

  function writeln() {
    for (var i = 0; i < arguments.length; i++)
      report.write(arguments[i]);
    report.write('\n');
  }
};


// # Conversion routines

// Converts the triple to NTriples format (primitive and incomplete)
function toNTriple(triple) {
  var subject = triple.subject, predicate = triple.predicate, object = triple.object;
  if (/^".*"$/.test(object))
    object = escapeString(object);
  else
    object = escape(object).replace(/"\^\^(.*)$/, '"^^<$1>');

  return (subject.match(/^_/)   ? subject   : '<' + subject   + '>') + ' ' +
         (predicate.match(/^_/) ? predicate : '<' + predicate + '>') + ' ' +
         (object.match(/^_|^"/) ? object    : '<' + object +    '>') + ' .\n';
}

// Removes the quotes around a string
function unString(value) {
  return value ? value.replace(/^("""|")(.*)\1$/, '$2') : '';
}

// Escapes unicode characters in a URI
function escape(value) {
  // Add all characters, converting to a unicode escape code if necessary
  var result = '';
  for (var i = 0; i < value.length; i++) {
    var code = value.charCodeAt(i);
    if (code >= 32 && code < 128) {
      result += value[i];
    }
    else {
      var hexCode = code.toString(16);
      while (hexCode.length < 4)
        hexCode = '0' + hexCode;
      result += '\\u' + hexCode;
    }
  }

  // Convert surrogate pairs to actual unicode (http://mathiasbynens.be/notes/javascript-encoding)
  result = result.replace(/\\u([a-z0-9]{4})\\u([a-z0-9]{4})/gi, function (all, high, low) {
    high = parseInt(high, 16);
    low = parseInt(low, 16);
    if (high >= 0xD800 && high <= 0xDBFF && low >= 0xDC00 && low <= 0xDFFF) {
      var result = (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000;
      result = result.toString(16);
      while (result.length < 8)
        result = '0' + result;
      return '\\U' + result;
    }
    return all;
  });

  return result;
}

// Escapes characters in a string
function escapeString(value) {
  value = value.replace(/\\/g, '\\\\');
  value = escape(unString(value));
  value = value.replace(/"/g, '\\"');
  return '"' + value + '"';
}

module.exports = SpecTester;
