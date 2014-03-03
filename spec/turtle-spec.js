#!/usr/bin/env node
var N3Parser = require('../lib/N3Parser.js'),
    N3Store = require('../lib/N3Store.js');
var fs = require('fs'),
    path = require('path'),
    request = require('request'),
    exec = require('child_process').exec,
    colors = require('colors'),
    async = require('async');

// Should the tests run in parallel?
var parallel = false;

// Path to the tests and the tests' manifest
var testPath = "http://www.w3.org/2013/TurtleTests/",
    manifest = "manifest.ttl";

// Prefixes
var prefixes = {
  mf: "http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  rdft: "http://www.w3.org/ns/rdftest#",
  dc: "http://purl.org/dc/terms/",
  doap: "http://usefulinc.com/ns/doap#",
  earl: "http://www.w3.org/ns/earl#",
  foaf: "http://xmlns.com/foaf/0.1/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  manifest: testPath + manifest + '#',
};

// List predicates
var first = prefixes.rdf + "first",
    rest = prefixes.rdf + "rest",
    nil = prefixes.rdf + "nil";

// Create the folders that will contain the spec files and results
var specFolder = __dirname,
    testFolder = path.join(specFolder, 'turtle'),
    outputFolder = path.join(testFolder, 'results');
[specFolder, testFolder, outputFolder].forEach(function (folder) {
  if (!fs.existsSync(folder))
    fs.mkdirSync(folder);
});

runSpecTest();



/*************************************************

  Test suite execution

**************************************************/


// Fetches the manifest, executes all tests, and reports results
function runSpecTest() {
  console.log("Turtle Terse RDF Triple Language Test Cases".bold);
  async.waterfall([
    // Fetch and parse the manifest
    fetch.bind(null, manifest),
    parseManifest,

    // Perform the tests in the manifest
    function performTests(manifest, callback) {
      async[parallel ? 'map' : 'mapSeries'](manifest.tests, function (test, callback) {
        async.parallel({ actionTurtle: fetch.bind(null, test.action),
                         resultTurtle: fetch.bind(null, test.result) },
          function (err, results) {
            performTest(test, results.actionTurtle, callback);
          });
      },

      // Show the summary of the performed tests
      function showSummary(error, tests) {
        var score = tests.reduce(function (sum, test) { return sum + test.success; }, 0);
        console.log(("* passed " + score + " out of " + manifest.tests.length + " tests").bold);
        callback(error, tests);
      });
    },

    // Generate the EARL report
    generateEarlReport,
  ],
  function (error) {
    if (error) {
      console.error("ERROR".red);
      console.error(error.red);
      process.exit(1);
    }
  });
}

// Parses the tests manifest into tests
function parseManifest(manifestContents, callback) {
  var manifest = {},
      testStore = new N3Store();

  // Parse the manifest into triples
  new N3Parser().parse(manifestContents, function (err, triple) {
    if (err)
      return callback(err);

    // Store triples until there are no more
    if (triple)
      return testStore.addTriple(triple.subject, triple.predicate, triple.object);

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
}

// Fetches and caches the specified file, or retrieves it from disk
function fetch(testFile, callback) {
  if (!testFile)
    return callback(null, null);

  var localFile = path.join(testFolder, testFile);
  fs.exists(localFile, function (exists) {
    if (exists)
      fs.readFile(localFile, 'utf8', callback);
    else
      request.get(testPath + testFile,
                  function (error, response, body) { callback(error, body); })
             .pipe(fs.createWriteStream(localFile));
  });
}



/*************************************************

  Individual test execution

**************************************************/


// Performs the specified test by parsing the specified Turtle document
function performTest(test, actionTurtle, callback) {
  // Create the results file
  var resultFile = path.join(outputFolder, test.action.replace(/\.ttl$/, '.nt')),
      resultStream = fs.createWriteStream(resultFile);

  resultStream.once('open', function () {
    // Try to parse the specified document
    var config = { documentURI: testPath + test.action };
    new N3Parser(config).parse(actionTurtle,
      function (error, triple) {
        if (error)
          test.error = error;

        // Write the triple to the results file, or end if none are left
        if (triple)
          resultStream.write(toNTriple(triple));
        else
          resultStream.end();
      });
  });

  // Verify the result if the result has been written
  resultStream.once('close', function () {
    verifyResult(test, resultFile, test.result && (testFolder + test.result), callback);
  });
}

// Verifies and reports the test result
function verifyResult(test, resultFile, correctFile, callback) {
  // Negative tests are successful if an error occurred
  var negativeTest = /TestTurtleNegative/.test(test.type);
  if (negativeTest) {
    displayResult(null, !!test.error);
  }
  // Positive tests are successful if the results are equal,
  // or if the correct solution is not given but no error occurred
  else {
    if (!correctFile)
      displayResult(null, !test.error);
    else if (resultFile)
      compareGraphs(resultFile, correctFile, displayResult);
    else
      displayResult(null, false);
  }

  // Display the test result
  function displayResult(error, success, comparison) {
    console.log(unString(test.name).bold + ':', unString(test.comment),
                (success ? 'OK'.green : 'FAIL'.red).bold);
    if (!success) {
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
}

// Verifies whether the two graphs are equal
function compareGraphs(actual, expected, callback) {
  // Try a full-text comparison (fastest)
  async.parallel({
    actualContents: fs.readFile.bind(fs, actual, 'utf8'),
    expectedContents: fs.readFile.bind(fs, expected, 'utf8'),
  },
  function (error, results) {
    // If the full-text comparison was successful, graphs are certainly equal
    if (results.actualContents === results.expectedContents)
      callback(null, true);
    // If not, we check for proper graph equality with SWObjects
    else
      exec('sparql -d ' + expected + ' --compare ' + actual, function (error, stdout, stderr) {
        callback(error, /^matched\s*$/.test(stdout), stdout);
      });
  });
}



/*************************************************

  Conversion routines

**************************************************/


// Converts the triple to NTriples format (primitive and incomplete)
function toNTriple(triple) {
  var subject = triple.subject,
      predicate = triple.predicate,
      object = triple.object;

  if (/^".*"$/.test(object))
    object = escapeString(object);
  else
    object = escape(object);

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
  var result = '';

  // Add all characters, converting to an unicode escape code if necessary
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



/*************************************************

  EARL report generation

**************************************************/

var homepage = 'https://github.com/RubenVerborgh/N3.js',
    application = homepage + '#n3js',
    developer = 'http://ruben.verborgh.org/#me';

function generateEarlReport(tests, callback) {
  // Create the report file
  var reportFile = path.join(outputFolder, 'earl-report.ttl'),
      report = fs.createWriteStream(reportFile),
      date = new Date().toISOString();

  report.once('open', function () {
    for (var prefix in prefixes)
      writeln('@prefix ', prefix, ': <', prefixes[prefix], '>.');
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
    writeln('  dc:description   "N3.js is an asynchronous, streaming Turtle parser for JavaScript."@en;');
    writeln('  doap:description "N3.js is an asynchronous, streaming Turtle parser for JavaScript."@en;');
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
      writeln('  mf:action <', testPath, test.action, '>;');
      if (test.result)
        writeln('  mf:result <', testPath, test.result, '>;');
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
    for(var i = 0; i < arguments.length; i++)
      report.write(arguments[i]);
    report.write('\n');
  }
}
