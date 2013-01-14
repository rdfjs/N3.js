# Node-n3 is a Notation3 and RDF library for node.js.

[**Notation3 or N3**](http://www.w3.org/TeamSubmission/n3/) is a superset of [RDF](http://www.w3.org/TR/rdf-primer/), the [Semantic Web](http://www.w3.org/2001/sw/) language.
This library will provide a high-performance N3 store, parser, and generator (when finished).

Currently implemented:
- high-performance N3 store
- streaming Turtle parser

[**Bringing reasoning to the Web**](http://reasoning.restdesc.org/) is the initiative with several open source projects (such as this one) that make N3 reasoning accessible.

# Use the node-n3 library.

## Installation
You can install the n3 library as an [npm](http://npmjs.org/) package.

``` bash
$ npm install n3
```

## Storing and finding items

In this example below, we create a new store and add the triples `:Pluto a :Dog.` and `:Mickey a :Mouse`.
Then, we find a triple with `:Mickey` as subject.

``` js
var n3 = require('n3');

var store = new n3.Store();
store.add(':Pluto', 'a', ':Dog');
store.add(':Mickey', 'a', ':Mouse');

var mickey = store.find(':Mickey', null, null)[0];
console.log(mickey.subject, mickey.predicate, mickey.object, '.');
// :Mickey a :Mouse .
```

# Parsing Turtle

The node-n3 library features a streaming Turtle parser,
processing Turtle documents as they grow.

``` js
var parser = new n3.Parser();
parser.parse('@prefix c: <http://example.org/cartoons#>.\n' +
             'c:Tom a c:Cat.\n' +
             'c:Jerry a c:Mouse;\n' +
             '        c:smarterThan c:Tom.',
             function (error, triple) {
               if (triple)
                 console.log(triple.subject, triple.predicate, triple.object, '.');
               else
                 console.log("# That's it, folks!")
             });
```

# Learn more.

The [Bringing reasoning to the Web](http://reasoning.restdesc.org/) page explains the origins of this project and provides pointers to related resources.
