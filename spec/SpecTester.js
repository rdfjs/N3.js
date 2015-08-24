#!/usr/bin/env node
var N3 = require('../N3.js'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    request = require('request'),
    exec = require('child_process').exec,
    async = require('async');
require('colors');

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
          async.series({ actionStream: self._fetch.bind(self, test.action),
                         resultStream: self._fetch.bind(self, test.result) },
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
  var manifest = {}, testStore = new N3.Store(), self = this;
  new N3.Parser({ format: 'text/turtle' }).parse(manifestContents, function (error, triple) {
    // Store triples until there are no more
    if (error)  return callback(error);
    if (triple) return testStore.addTriple(triple.subject, triple.predicate, triple.object);

    // Once all triples are there, get the first item of the test list
    var tests = manifest.tests = [],
        skipped = manifest.skipped = [],
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
      test.negative = /Negative/.test(test.type);
      test.skipped = self._skipNegative && test.negative;
      (!test.skipped ? tests : skipped).push(test);

      // Find the next test item
      itemHead = testStore.find(itemHead, rest, null)[0].object;
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
      config = { format: this._name, documentIRI: url.resolve(this._manifest, test.action) },
      parser = new N3.Parser(config), self = this;
  parser.parse(actionStream, function (error, triple) {
    if (error)  test.error = error;
    if (triple) resultWriter.addTriple(triple);
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
    console.log(N3.Util.getLiteralValue(test.name).bold + ':',
                N3.Util.getLiteralValue(test.comment),
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
      homepage = 'https://github.com/RubenVerborgh/N3.js', app = homepage + '#n3js',
      developer = 'http://ruben.verborgh.org/#me', manifest = this._manifest + '#';

  report.addPrefix('manifest', manifest);
  report.addTriple('', prefixes.foaf + 'primaryTopic', app);
  report.addTriple('', prefixes.dc + 'issued', date);
  report.addTriple('', prefixes.foaf + 'maker', developer);

  report.addTriple(app, prefixes.rdf  + 'type', prefixes.earl + 'Software');
  report.addTriple(app, prefixes.rdf  + 'type', prefixes.earl + 'TestSubject');
  report.addTriple(app, prefixes.rdf  + 'type', prefixes.doap + 'Project');
  report.addTriple(app, prefixes.doap + 'name', '"N3.js"');
  report.addTriple(app, prefixes.doap + 'homepage', homepage);
  report.addTriple(app, prefixes.doap + 'license', 'http://opensource.org/licenses/MIT');
  report.addTriple(app, prefixes.doap + 'programming-language', '"JavaScript"');
  report.addTriple(app, prefixes.doap + 'implements', 'http://www.w3.org/TR/turtle/');
  report.addTriple(app, prefixes.doap + 'implements', 'http://www.w3.org/TR/trig/');
  report.addTriple(app, prefixes.doap + 'implements', 'http://www.w3.org/TR/n-triples/');
  report.addTriple(app, prefixes.doap + 'implements', 'http://www.w3.org/TR/n-quads/');
  report.addTriple(app, prefixes.doap + 'category', 'http://dbpedia.org/resource/Resource_Description_Framework');
  report.addTriple(app, prefixes.doap + 'download-page', 'https://npmjs.org/package/n3');
  report.addTriple(app, prefixes.doap + 'bug-database', homepage + '/issues');
  report.addTriple(app, prefixes.doap + 'blog', 'http://ruben.verborgh.org/blog/');
  report.addTriple(app, prefixes.doap + 'developer', developer);
  report.addTriple(app, prefixes.doap + 'maintainer', developer);
  report.addTriple(app, prefixes.doap + 'documenter', developer);
  report.addTriple(app, prefixes.doap + 'maker', developer);
  report.addTriple(app, prefixes.dc   + 'title', '"N3.js"');
  report.addTriple(app, prefixes.dc   + 'description', '"N3.js is an asynchronous, streaming RDF parser for JavaScript."@en');
  report.addTriple(app, prefixes.doap + 'description', '"N3.js is an asynchronous, streaming RDF parser for JavaScript."@en');
  report.addTriple(app, prefixes.dc   + 'creator', developer);

  report.addTriple(developer, prefixes.rdf  + 'type', prefixes.foaf + 'Person');
  report.addTriple(developer, prefixes.rdf  + 'type', prefixes.earl + 'Assertor');
  report.addTriple(developer, prefixes.foaf + 'name', '"Ruben Verborgh"');
  report.addTriple(developer, prefixes.foaf + 'homepage', 'http://ruben.verborgh.org/');
  report.addTriple(developer, prefixes.foaf + 'primaryTopicOf', 'http://ruben.verborgh.org/profile/');
  report.addTriple(developer, prefixes.rdfs + 'isDefinedBy', 'http://ruben.verborgh.org/profile/');

  tests.forEach(function (test, id) {
    var testUrl = manifest + test.id;
    report.addTriple(testUrl, prefixes.rdf + 'type', prefixes.earl + 'TestCriterion');
    report.addTriple(testUrl, prefixes.rdf + 'type', prefixes.earl + 'TestCase');
    report.addTriple(testUrl, prefixes.dc  + 'title', test.name);
    report.addTriple(testUrl, prefixes.dc  + 'description', test.comment);
    report.addTriple(testUrl, prefixes.mf  + 'action', url.resolve(manifest, test.action));
    if (test.result)
      report.addTriple(testUrl, prefixes.mf + 'result', url.resolve(manifest, test.result));
    report.addTriple(testUrl, prefixes.earl + 'assertions', '_:assertions' + id);
    report.addTriple('_:assertions' + id, prefixes.rdf + 'first', '_:assertion' + id);
    report.addTriple('_:assertions' + id, prefixes.rdf + 'rest', prefixes.rdf + 'nil');
    report.addTriple('_:assertion' + id, prefixes.rdf + 'type', prefixes.earl + 'Assertion');
    report.addTriple('_:assertion' + id, prefixes.earl + 'assertedBy', developer);
    report.addTriple('_:assertion' + id, prefixes.earl + 'test', manifest + test.id);
    report.addTriple('_:assertion' + id, prefixes.earl + 'subject', app);
    report.addTriple('_:assertion' + id, prefixes.earl + 'mode', prefixes.earl + 'automatic');
    report.addTriple('_:assertion' + id, prefixes.earl + 'result', '_:result' + id);
    report.addTriple('_:result' + id, prefixes.rdf + 'type', prefixes.earl + 'TestResult');
    report.addTriple('_:result' + id, prefixes.earl + 'outcome', prefixes.earl + (test.success ? 'passed' : 'failed'));
    report.addTriple('_:result' + id, prefixes.dc + 'date', date);
  });
  report.end(function () { callback(null, tests); });
};

module.exports = SpecTester;
