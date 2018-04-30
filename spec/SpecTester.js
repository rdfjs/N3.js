#!/usr/bin/env node
var N3 = require('../N3.js'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    http = require('follow-redirects').http,
    exec = require('child_process').exec,
    async = require('async');
require('colors');

var fromId = N3.DataFactory.internal.fromId;

// How many test cases may run in parallel?
var workers = 1;

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
  if (!(this instanceof SpecTester))
    return new SpecTester(settings);
  settings = settings || {};
  for (var key in settings)
    this['_' + key] = settings[key];

  // Create the folders that will contain the spec files and results
  [
    this._testFolder   = path.join(__dirname, this._name),
    this._reportFolder = path.join(__dirname, 'reports'),
  ]
  .forEach(function (folder) { fs.existsSync(folder) || fs.mkdirSync(folder); });
}


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
          async.series({
            actionStream: self._fetch.bind(self, test.action),
            resultStream: self._fetch.bind(self, test.result),
          },
          function (error, results) {
            if (error) return callback(error);
            self._performTest(test, results.actionStream, callback);
          });
        },
        // 1.2.2 Show the summary of all performed tests
        function showSummary(error, tests) {
          var score = tests.reduce(function (sum, test) { return sum + test.success; }, 0);
          manifest.skipped.forEach(function (test) { self._verifyResult(test); });
          console.log(('* passed ' + score +
                       ' out of ' + manifest.tests.length + ' tests' +
                       ' (' + manifest.skipped.length + ' skipped)').bold);
          callback(error, tests);
        });
    },

    // 2. Generate the EARL report
    function (tests, callback) { self._generateEarlReport(tests, callback); },

    // 3. Return with the proper exit code
    function (tests) {
      process.exit(tests.every(function (test) { return test.success; }) ? 0 : 1);
    },
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
    if (exists) {
      fs.readFile(localFile, 'utf8', callback);
    }
    else {
      var request = http.get(url.resolve(self._manifest, filename));
      request.on('response', function (response) {
        response.pipe(fs.createWriteStream(localFile))
                .on('close', function () { self._fetch(filename, callback); });
      });
      request.on('error', callback);
    }
  });
};

// Parses the tests manifest into tests
SpecTester.prototype._parseManifest = function (manifestContents, callback) {
  // Parse the manifest into quads
  var manifest = {}, testStore = new N3.Store(), self = this;
  new N3.Parser({ format: 'text/turtle' }).parse(manifestContents, function (error, quad) {
    // Store quads until there are no more
    if (error) return callback(error);
    if (quad)  return testStore.addQuad(quad.subject, quad.predicate, quad.object);

    // Once all quads are there, get the first item of the test list
    var tests = manifest.tests = [],
        skipped = manifest.skipped = [],
        itemHead = testStore.getObjects('', prefixes.mf + 'entries')[0];
    // Loop through all test items
    while (itemHead && itemHead.value !== nil) {
      // Find and store the item's properties
      var itemValue = testStore.getObjects(itemHead, first)[0],
          itemQuads = testStore.getQuads(itemValue, null, null),
          test = { id: itemValue.value.replace(/^#/, '') };
      itemQuads.forEach(function (quad) {
        var propertyMatch = quad.predicate.value.match(/#(.+)/);
        if (propertyMatch)
          test[propertyMatch[1]] = quad.object.value;
      });
      test.negative = /Negative/.test(test.type);
      test.skipped = self._skipNegative && test.negative;
      (!test.skipped ? tests : skipped).push(test);

      // Find the next test item
      itemHead = testStore.getQuads(itemHead, rest, null)[0].object;
    }
    return callback(null, manifest);
  });
};


// # Individual test execution

// Performs the test by parsing the specified document
SpecTester.prototype._performTest = function (test, actionStream, callback) {
  // Try to parse the specified document
  var resultFile = path.join(this._testFolder, test.action.replace(/\.\w+$/, '-result.nq')),
      resultWriter = new N3.Writer(fs.createWriteStream(resultFile), { format: 'N-Quads' }),
      config = { format: this._name, baseIRI: url.resolve(this._manifest, test.action) },
      parser = new N3.Parser(config), self = this;
  parser.parse(actionStream, function (error, quad) {
    if (error)  test.error = error;
    if (quad) resultWriter.addQuad(quad);
    // Verify the result after it has been written
    else
      resultWriter.end(function () {
        self._verifyResult(test, resultFile,
                           test.result && path.join(self._testFolder, test.result), callback);
      });
  });
};

// Verifies and reports the test result
SpecTester.prototype._verifyResult = function (test, resultFile, correctFile, callback) {
  // Negative tests are successful if an error occurred
  if (test.skipped || test.negative) {
    displayResult(null, !!test.error);
  }
  // Positive tests are successful if the results are equal,
  // or if the correct solution is not given but no error occurred
  else if (!correctFile)
    displayResult(null, !test.error);
  else if (!resultFile)
    displayResult(null, false);
  else
    this._compareResultFiles(resultFile, correctFile, displayResult);

  // Display the test result
  function displayResult(error, success, comparison) {
    console.log(test.name.bold + ':', test.comment,
                (test.skipped ? 'SKIP'.yellow : (success ? 'ok'.green : 'FAIL'.red)).bold);
    if (!test.skipped && (error || !success)) {
      console.log((correctFile ? fs.readFileSync(correctFile, 'utf8') : '(empty)').grey);
      console.log('  was expected, but got'.bold.grey);
      console.log((resultFile ? fs.readFileSync(resultFile, 'utf8') : '(empty)').grey);
      console.log(('  error: '.bold + (test.error || '(none)')).grey);
      if (comparison)
        console.log(('  comparison: ' + comparison).grey);
    }
    test.success = success;
    callback && callback(null, test);
  }
};

// Verifies whether the two result files are equivalent
SpecTester.prototype._compareResultFiles = function (actual, expected, callback) {
  // Try a full-text comparison (fastest)
  async.series({
    actualContents:   fs.readFile.bind(fs,   actual, 'utf8'),
    expectedContents: fs.readFile.bind(fs, expected, 'utf8'),
  },
  function (error, results) {
    // If the full-text comparison was successful, graphs are certainly equal
    if (results.actualContents.trim() === results.expectedContents.trim())
      callback(error, !error);
    // Otherwise, check for proper equality with SWObjects
    else {
      // SWObjects doesn't support N-Quads, so convert to TriG if necessary
      if (/\.nq/.test(expected)) {
        fs.writeFileSync(actual   += '.trig', quadsToTrig(results.actualContents));
        fs.writeFileSync(expected += '.trig', quadsToTrig(results.expectedContents));
      }
      exec('sparql -d ' + expected + ' --compare ' + actual,
           function (error, stdout) { callback(error, /^matched\s*$/.test(stdout), stdout); });
    }
    function quadsToTrig(nquad) {
      return nquad.replace(/^([^\s]+)\s+([^\s]+)\s+(.+)\s+([^\s"]+)\s*\.$/mg, '$4 { $1 $2 $3 }');
    }
  });
};



// # EARL report generation

// Generate an EARL report with the given test results
SpecTester.prototype._generateEarlReport = function (tests, callback) {
  // Create the report file
  var reportFile = path.join(this._reportFolder, 'n3js-earl-report-' + this._name + '.ttl'),
      report = new N3.Writer(fs.createWriteStream(reportFile), { prefixes: prefixes }),
      date = '"' + new Date().toISOString() + '"^^' + prefixes.xsd + 'dateTime',
      homepage = 'https://github.com/rdfjs/N3.js', app = homepage + '#n3js',
      developer = 'https://ruben.verborgh.org/profile/#me', manifest = this._manifest + '#';

  report.addPrefix('manifest', manifest);

  function addTriple(s, p, o) {
    report.addQuad(fromId(s), fromId(p), fromId(o));
  }

  addTriple(reportFile, prefixes.foaf + 'primaryTopic', app);
  addTriple(reportFile, prefixes.dc + 'issued', date);
  addTriple(reportFile, prefixes.foaf + 'maker', developer);

  addTriple(app, prefixes.rdf  + 'type', prefixes.earl + 'Software');
  addTriple(app, prefixes.rdf  + 'type', prefixes.earl + 'TestSubject');
  addTriple(app, prefixes.rdf  + 'type', prefixes.doap + 'Project');
  addTriple(app, prefixes.doap + 'name', '"N3.js"');
  addTriple(app, prefixes.doap + 'homepage', homepage);
  addTriple(app, prefixes.doap + 'license', 'http://opensource.org/licenses/MIT');
  addTriple(app, prefixes.doap + 'programming-language', '"JavaScript"');
  addTriple(app, prefixes.doap + 'implements', 'https://www.w3.org/TR/turtle/');
  addTriple(app, prefixes.doap + 'implements', 'https://www.w3.org/TR/trig/');
  addTriple(app, prefixes.doap + 'implements', 'https://www.w3.org/TR/n-triples/');
  addTriple(app, prefixes.doap + 'implements', 'https://www.w3.org/TR/n-quads/');
  addTriple(app, prefixes.doap + 'category', 'http://dbpedia.org/resource/Resource_Description_Framework');
  addTriple(app, prefixes.doap + 'download-page', 'https://npmjs.org/package/n3');
  addTriple(app, prefixes.doap + 'bug-database', homepage + '/issues');
  addTriple(app, prefixes.doap + 'blog', 'https://ruben.verborgh.org/blog/');
  addTriple(app, prefixes.doap + 'developer', developer);
  addTriple(app, prefixes.doap + 'maintainer', developer);
  addTriple(app, prefixes.doap + 'documenter', developer);
  addTriple(app, prefixes.doap + 'maker', developer);
  addTriple(app, prefixes.dc   + 'title', '"N3.js"');
  addTriple(app, prefixes.dc   + 'description', '"N3.js is an asynchronous, streaming RDF parser for JavaScript."@en');
  addTriple(app, prefixes.doap + 'description', '"N3.js is an asynchronous, streaming RDF parser for JavaScript."@en');
  addTriple(app, prefixes.dc   + 'creator', developer);

  addTriple(developer, prefixes.rdf  + 'type', prefixes.foaf + 'Person');
  addTriple(developer, prefixes.rdf  + 'type', prefixes.earl + 'Assertor');
  addTriple(developer, prefixes.foaf + 'name', '"Ruben Verborgh"');
  addTriple(developer, prefixes.foaf + 'homepage', 'https://ruben.verborgh.org/');
  addTriple(developer, prefixes.foaf + 'primaryTopicOf', 'https://ruben.verborgh.org/profile/');

  tests.forEach(function (test, id) {
    var testUrl = manifest + test.id;
    addTriple(testUrl, prefixes.rdf + 'type', prefixes.earl + 'TestCriterion');
    addTriple(testUrl, prefixes.rdf + 'type', prefixes.earl + 'TestCase');
    addTriple(testUrl, prefixes.dc  + 'title', test.name);
    addTriple(testUrl, prefixes.dc  + 'description', test.comment);
    addTriple(testUrl, prefixes.mf  + 'action', url.resolve(manifest, test.action));
    if (test.result)
      addTriple(testUrl, prefixes.mf + 'result', url.resolve(manifest, test.result));
    addTriple(testUrl, prefixes.earl + 'assertions', '_:assertions' + id);
    addTriple('_:assertions' + id, prefixes.rdf + 'first', '_:assertion' + id);
    addTriple('_:assertions' + id, prefixes.rdf + 'rest', prefixes.rdf + 'nil');
    addTriple('_:assertion' + id, prefixes.rdf + 'type', prefixes.earl + 'Assertion');
    addTriple('_:assertion' + id, prefixes.earl + 'assertedBy', developer);
    addTriple('_:assertion' + id, prefixes.earl + 'test', manifest + test.id);
    addTriple('_:assertion' + id, prefixes.earl + 'subject', app);
    addTriple('_:assertion' + id, prefixes.earl + 'mode', prefixes.earl + 'automatic');
    addTriple('_:assertion' + id, prefixes.earl + 'result', '_:result' + id);
    addTriple('_:result' + id, prefixes.rdf + 'type', prefixes.earl + 'TestResult');
    addTriple('_:result' + id, prefixes.earl + 'outcome', prefixes.earl + (test.success ? 'passed' : 'failed'));
    addTriple('_:result' + id, prefixes.dc + 'date', date);
  });
  report.end(function () { callback(null, tests); });
};

module.exports = SpecTester;
