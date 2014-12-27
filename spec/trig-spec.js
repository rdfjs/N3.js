#!/usr/bin/env node
var SpecTester = require('./SpecTester');

function TrigSpecTester() {
  SpecTester.call(this, {
    name: 'trig',
    title: 'RDF 1.1 TriG – RDF Dataset Language Test Cases',
    manifest: 'http://www.w3.org/2013/TrigTests/manifest.ttl',
  });
}
SpecTester.isPrototypeOf(TrigSpecTester);

new TrigSpecTester().run();
