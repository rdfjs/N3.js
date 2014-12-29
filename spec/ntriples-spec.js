#!/usr/bin/env node
var SpecTester = require('./SpecTester');
new SpecTester({
  name: 'ntriples',
  title: 'RDF 1.1 N-Triples – Line-based syntax for an RDF graph Test Cases',
  manifest: 'http://www.w3.org/2013/N-TriplesTests/manifest.ttl',
}).run();
