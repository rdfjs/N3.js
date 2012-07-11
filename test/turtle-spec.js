var N3Parser = require('../lib/n3parser.js'),
    N3Store = require('../lib/n3store.js');
var fs = require('fs'),
    request = require('request'),
    exec = require('child_process').exec,
    colors = require('colors'),
    async = require('async');

var turtleTestsUrl = "http://www.w3.org/2001/sw/DataAccess/df1/tests/";
var positiveManifest = turtleTestsUrl + "manifest.ttl",
    negativeManifest = turtleTestsUrl + "manifest-bad.ttl";
var rdfs = "http://www.w3.org/2000/01/rdf-schema#",
    mf = "http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#",
    qt = "http://www.w3.org/2001/sw/DataAccess/tests/test-query#",
    rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
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
  function fetchPositiveManifest(callback) {
    request.get(positiveManifest, callback);
  },
  parseManifest,
  function performPositiveTests(tests, callback) {
    async.map(tests, function (test, callback) {
      var outputFile = outputFolder + test.result.replace(/\.out$/, '.nt');
      async.parallel({
        fetchData: function (callback) {
          request.get(turtleTestsUrl + test.data, callback)
                 .pipe(fs.createWriteStream(testFolder + test.data));
        },
        fetchResult: function (callback) {
          request.get(turtleTestsUrl + test.result, callback)
                 .pipe(fs.createWriteStream(testFolder + test.result));
        },
        createFile: function (callback) {
          var stream = fs.createWriteStream(outputFile)
                         .on('open', function () { callback(null, stream); });
        }
      },
      function (err, results) {
        var outputStream = results.createFile;
        var config = { documentURI: turtleTestsUrl + test.data };
        new N3Parser(config).parse(fs.createReadStream(testFolder + test.data),
          function (error, triple) {
            if (triple) {
              outputStream.write(toNTriple(triple));
            }
            else {
              outputStream.end();
              verifyResult(test, outputFile, testFolder + test.result, callback);
            }
          });
      });
    }, function (error, results) {
      var score = results.reduce(function (sum, r) { return sum + r; }, 0);
      console.log(("* passed " + score + " out of " + tests.length + " positive tests").bold);
      callback();
    });
  },
  function fetchNegativeManifest(callback) {
    request.get(negativeManifest, callback);
  },
  parseManifest,
  function performNegativeTests(tests, callback) {
    async.map(tests, function (test, callback) {
      async.parallel({
        fetchData: function (callback) {
          request.get(turtleTestsUrl + test.data, callback)
                 .pipe(fs.createWriteStream(testFolder + test.data));
        }
      },
      function (err, results) {
        var config = { documentURI: turtleTestsUrl + test.data };
        new N3Parser(config).parse(fs.createReadStream(testFolder + test.data),
          function (error, triple) {
            if (error) {
              console.log(unString(test.name).bold + ':', unString(test.comment), 'OK'.green.bold);
              callback(null, true);
            }
            else if (triple === null) {
              console.log(unString(test.name).bold + ':', unString(test.comment), 'FAIL'.red.bold);
              callback(null, false);
            }
          });
      });
    }, function (error, results) {
      var score = results.reduce(function (sum, r) { return sum + r; }, 0);
      console.log(("* passed " + score + " out of " + tests.length + " negative tests").bold);
      callback();
    });
  }
],
function (error) {
  if (error) {
    console.error(error);
    process.exit(1);
  }
});

function parseManifest(response, body, callback) {
  if (response.statusCode != 200)
    return callback("Could not download manifest.");
  var manifestStore = new N3Store();
  new N3Parser().parse(body, function (err, triple) {
    if (err)
      return callback(err);
    if (triple) {
      manifestStore.add(triple.subject, triple.predicate, triple.object);
    }
    else {
      var tests = [];
      var entryHead = manifestStore.find('', mf + 'entries', null)[0].object;
      while (entryHead && entryHead !== nil) {
        var entryValue = manifestStore.find(entryHead, first, null)[0].object,
            action = manifestStore.find(entryValue, mf + 'action', null)[0].object;
        tests.push({
          name:    manifestStore.find(entryValue, mf   + 'name',    null)[0].object,
          comment: manifestStore.find(entryValue, rdfs + 'comment', null)[0].object,
          data:    manifestStore.find(action,     qt   + 'data',    null)[0].object,
          result:  (manifestStore.find(entryValue, mf   + 'result',  null)[0] || {}).object,
        });
        entryHead = manifestStore.find(entryHead, rest, null)[0].object;
      }
      return callback(null, tests);
    }
  });
}

function unString(value) {
  return value.replace(/^"(.*)"$/, '$1');
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
      console.log(output.correct.replace(/^/gm, '      ').grey);
      console.log('  was expected, but got'.bold.grey);
      console.log(output.result.replace(/^/gm, '      ').grey);
    }
    callback(null, success);
  });
}

function parseWithCwm(file, callback) {
  exec('cwm ' + file + ' --ntriples', function (error, stdout, stderr) {
    var result = stdout.replace(/^\s*#.*$/gm, '').trim();
    callback(error, result);
  });
}
