#!/usr/bin/env node
var SpecTester = require('./SpecTester');
new SpecTester({
  name: 'nquads',
  title: 'RDF 1.1 N-Quads – Line-based syntax for RDF datasets Test Cases',
  manifest: 'http://www.w3.org/2013/N-QuadsTests/manifest.ttl',
}).run();
