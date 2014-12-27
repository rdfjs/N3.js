#!/usr/bin/env node
var SpecTester = require('./SpecTester');
new SpecTester({
  name: 'turtle',
  title: 'RDF 1.1 Turtle – Terse RDF Triple Language Test Cases',
  manifest: 'http://www.w3.org/2013/TurtleTests/manifest.ttl',
}).run();
