#!/usr/bin/env node
var SpecTester = require('./SpecTester');
new SpecTester({
  name: 'trig',
  title: 'RDF 1.1 TriG – RDF Dataset Language Test Cases',
  manifest: 'http://www.w3.org/2013/TriGTests/manifest.ttl',
}).run();
