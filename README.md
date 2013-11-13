# Lightning fast, asynchronous, streaming Turtle / N3 / RDF

[**Notation3 or N3**](http://www.w3.org/TeamSubmission/n3/) is a superset of [RDF](http://www.w3.org/TR/rdf-primer/), the [Semantic Web](http://www.w3.org/2001/sw/) language.
This library will provide a high-performance N3 store, parser, and generator (when finished).

Currently implemented:
- streaming Turtle parser, [fully compliant](https://github.com/RubenVerborgh/node-n3/tree/master/spec) with the [latest candidate recommendation](http://www.w3.org/TR/turtle/)
- high-performance in-memory N3 store

## Parsing Turtle from a string or stream

The _node-n3_ library can parse Turtle strings.

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
                 console.log("# That's all, folks!")
             });
```

Additionally, it can parse streams as they grow, returning triples as soon as they're ready.
<br>
This behavior sets _node-n3_ apart from most other Turtle libraries.

``` js
var parser = new n3.Parser(),
    turtleStream = fs.createReadStream('cartoons.ttl');
parser.parse(turtleStream, console.log);
```

## From text stream to triple stream

_node-n3_ offers a _Transform_ interface to the Node _Stream_ system,
so you can transform Turtle streams and pipe them to anywhere.
This solution is ideal if your consumer is slower,
as it avoids backpressure from the parser.

``` js
var streamParser = new n3.StreamParser(),
    turtleStream = fs.createReadStream('cartoons.ttl');
turtleStream.pipe(streamParser);
streamParser.pipe(new SlowWriter());

function SlowWriter() {
  var writer = new Writable({ objectMode: true });
  writer._write = function (triple, encoding, done) {
    console.log(triple);
    setTimeout(done, 1000);
  };
  return writer;
}
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

## Representing URIs and literals
_node-n3_ has a special syntax to represent URIs and literals,
making code efficient to write and execute.
<br>
As URIs are most common, they are represented as simple strings:
``` js
var N3Util = require('n3').Util;
N3Util.isUri('http://example.org/cartoons#Mickey'); // true
```
Literals are represented as double quoted strings:
``` js
N3Util.isLiteral('"Mickey Mouse"'); // true
N3Util.isLiteral('"Mickey Mouse"@en'); // true
N3Util.isLiteral('"3"^^<http://www.w3.org/2001/XMLSchema#integer>'); // true
N3Util.isLiteral('"http://example.org/"'); // true
```
Note the difference between `'http://example.org/'` (URI) and `'"http://example.org/"'` (literal).
<br>
Also note that the double quoted literals are _not_ raw Turtle syntax:
``` js
N3Util.isLiteral('"This word is "quoted"!"'); // true
```
The above string represents the string _This word is "quoted"!_,
even though the correct Turtle syntax for that is `"This word is \"quoted\"!"`
_node-n3_ thus always parses literals, but adds quotes to differentiate from URIs:
``` js
new n3.Parser().parse('<a> <b> "This word is \\"quoted\\"!".', console.log);
// { subject: 'a', predicate: 'b', object: '"This word is "quoted"!"' }
```

For convenience, `N3Util` can also be loaded globally:
``` js
require('n3').Util(global);
isUri('http://example.org/cartoons#Mickey'); // true
isLiteral('"Mickey Mouse"'); // true
```

If desired, the methods can even be added directly on all strings:
``` js
require('n3').Util(String, true);
'http://example.org/cartoons#Mickey'.isUri(); // true
'"Mickey Mouse"'.isLiteral(); // true
```

## Installation
You can install the _n3_ library as an [npm](http://npmjs.org/) package.

``` bash
$ npm install n3
```

# Learn more

The [Bringing reasoning to the Web](http://reasoning.restdesc.org/) page explains the origins of this project and provides pointers to related resources.
