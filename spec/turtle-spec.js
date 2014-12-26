#!/usr/bin/env node
var SpecTester = require('./SpecTester');

function TurtleSpecTester() {
  SpecTester.call(this, {
    title: 'Turtle Terse RDF Triple Language Test Cases',
  });
}
SpecTester.isPrototypeOf(TurtleSpecTester);

new TurtleSpecTester().run();
