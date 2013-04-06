var N3Parser = require('../lib/n3parser.js'),
    N3Store = require('../lib/n3store.js');
var fs = require('fs'),
    request = require('request'),
    exec = require('child_process').exec,
    colors = require('colors'),
    async = require('async');

var testPath = "https://dvcs.w3.org/hg/rdf/raw-file/default/rdf-turtle/tests-ttl/",
    manifest = "manifest.ttl";
var rdfs = "http://www.w3.org/2000/01/rdf-schema#",
    mf = "http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#",
    qt = "http://www.w3.org/2001/sw/DataAccess/tests/test-query#",
    rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdft = "http://www.w3.org/ns/rdftest#";
var first = rdf + "first",
    rest = rdf + "rest",
    nil = rdf + "nil";

var specFolder = './test/spec/',
    testFolder = specFolder + 'turtle/',
    outputFolder = testFolder + 'results/';

[specFolder, testFolder, outputFolder].forEach(function (folder) {
  if (!fs.existsSync(folder))
    fs.mkdirSync(folder);
});

console.log("Turtle Terse RDF Triple Language Test Cases".bold);
async.waterfall([
  fetch.bind(null, manifest),
  parseManifest,
  function performTests(tests, callback) {
    async.mapSeries(tests, function (test, callback) {
      async.parallel([fetch.bind(null, test.action),
                      fetch.bind(null, test.result)],
        function (err, results) {
          performTest(test, results[0], results[1], callback);
        });
    },
    function (error, results) {
      var score = results.reduce(function (sum, r) { return sum + r; }, 0);
      console.log(("* passed " + score + " out of " + tests.length + " tests").bold);
      callback();
    });
  },
],
function (error) {
  if (error) {
    console.error("ERROR".red);
    console.error(error.red);
    process.exit(1);
  }
});

function fetch(testFile, callback) {
  if (!testFile)
    return callback(null, null);

  var localFile = testFolder + testFile;
  fs.exists(localFile, function (exists) {
    if (exists)
      fs.readFile(localFile, 'utf8', callback);
    else
      request.get(testPath + testFile, function (error, response, body) { callback(error, body); })
             .pipe(fs.createWriteStream(localFile));
  });
}

function parseManifest(manifest, callback) {
  var manifestStore = new N3Store();
  new N3Parser().parse(manifest, function (err, triple) {
    if (err)
      return callback(err);
    if (triple) {
      manifestStore.add(triple.subject, triple.predicate, triple.object);
    }
    else {
      var tests = [];
      var entryHead = manifestStore.find('', mf + 'entries', null)[0].object;
      while (entryHead && entryHead !== nil) {
        var test = {},
            entryValue = manifestStore.find(entryHead, first, null)[0].object,
            entryTriples = manifestStore.find(entryValue, null, null);
        entryTriples.forEach(function (triple) {
          var propertyMatch = triple.predicate.match(/#(.+)/);
          if (propertyMatch)
            test[propertyMatch[1]] = triple.object;
        });
        tests.push(test);
        entryHead = manifestStore.find(entryHead, rest, null)[0].object;
      }
      return callback(null, tests);
    }
  });
}

function performTest(test, action, result, callback) {
  var outputFile = outputFolder + test.action.replace(/\.ttl$/, '.nt'),
    outputStream = fs.createWriteStream(outputFile).once('open', function () {
      var config = { documentURI: testPath + test.data };
      new N3Parser(config).parse(action,
        function (error, triple) {
          if (error) {
            fs.unlink(outputFile);
            outputFile = undefined;
          }
          if (triple)
            outputStream.write(toNTriple(triple));
          else
            outputStream.end();
        });
    });
  outputStream.once('close', function () {
    verifyResult(test, outputFile, test.result && (testFolder + test.result), callback);
  });
}

function toNTriple(triple) {
  var subject = triple.subject,
      predicate = triple.predicate,
      object = triple.object;
  return (subject.match(/^_/)   ? subject   : '<' + subject   + '>') + ' ' +
         (predicate.match(/^_/) ? predicate : '<' + predicate + '>') + ' ' +
         (object.match(/^_|^"/) ? object    : '<' + object +    '>') + ' .\n';
}

function verifyResult(test, resultFile, correctFile, callback) {
  async.parallel({
    result:  function (callback) { parseWithCwm(resultFile,  callback); },
    correct: function (callback) { parseWithCwm(correctFile, callback); }
  },
  function (error, output) {
    var success = (output.result === output.correct);
    console.log(unString(test.name).bold + ':', unString(test.comment),
                (success ? 'OK'.green : 'FAIL'.red).bold);
    if (!success) {
      console.log((output.correct + '').replace(/^/gm, '      ').grey);
      console.log('  was expected, but got'.bold.grey);
      console.log((output.result + '').replace(/^/gm, '      ').grey);
    }
    callback(null, success);
  });
}

function parseWithCwm(file, callback) {
  if (!file)
    return callback();
  exec('cwm ' + file + ' --ntriples', function (error, stdout, stderr) {
    var result = stdout.replace(/^\s*#.*$/gm, '').trim();
    callback(error, result);
  });
}

function unString(value) {
  return value.replace(/^"(.*)"$/, '$1');
}
