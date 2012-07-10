var N3Parser = require('../lib/n3parser.js');
var N3Store = require('../lib/n3store.js');
var fs = require('fs'),
    request = require('request');

var turtleTestsUrl = "http://www.w3.org/2001/sw/DataAccess/df1/tests/";
var goodTestsManifest = turtleTestsUrl + "manifest.ttl";
var rdfs = "http://www.w3.org/2000/01/rdf-schema#",
    mf = "http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#",
    qt = "http://www.w3.org/2001/sw/DataAccess/tests/test-query#",
    rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
var first = rdf + "first",
    rest = rdf + "rest",
    nil = rdf + "nil";

var specFolder = './test/spec/';
var testFolder = './test/spec/turtle/';

if (!fs.existsSync(specFolder))
  fs.mkdirSync(specFolder);
if (!fs.existsSync(testFolder))
  fs.mkdirSync(testFolder);
  
fetchTestList(function (tests) {
  fetchTestFiles(tests, function () {
    performTests(tests);
  });
});

function exit(error) {
  console.error(error);
  process.exit(1);
}

function fetchTestList(callback) {
  request.get(goodTestsManifest, function (error, response, body) {
    if (error || response.statusCode != 200)
      return exit("Could not download " + goodTestsManifest);
    var manifestStore = new N3Store();
    new N3Parser().parse(body, function (err, triple) {
      if (err)
        return exit(err);
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
            result:  manifestStore.find(entryValue, mf   + 'result',  null)[0].object,
          });
          entryHead = manifestStore.find(entryHead, rest, null)[0].object;
        }
        return callback(tests);
      }
    });
  });
}

function fetchTestFiles(tests, callback) {
  var pending = tests.length * 2;
  tests.forEach(function (test) {
    request.get(turtleTestsUrl + test.data, fileFetched)
           .pipe(fs.createWriteStream(testFolder + test.data));
    request.get(turtleTestsUrl + test.result, fileFetched)
           .pipe(fs.createWriteStream(testFolder + test.result));
  });
  function fileFetched() {
    if (--pending === 0)
      callback();
  }
}

function performTests(tests) {
  tests.forEach(function (test) {
    new N3Parser().parse(fs.createReadStream(testFolder + test.data),
      function (error, triple) {
        console.log(test.data, error, triple);
      });
  });
}
