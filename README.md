# Lightning fast, asynchronous, streaming Turtle for JavaScript

The N3.js library lets you handle [Turtle](http://www.w3.org/TR/turtle/) and [RDF](http://www.w3.org/TR/rdf-primer/) in JavaScript _([Node](http://nodejs.org/) and browser)_ easily.
It offers:

- [**Turtle parsing**](#parsing) _([fully compliant](https://github.com/RubenVerborgh/N3.js/tree/master/spec) with the [Turtle standard](http://www.w3.org/TR/turtle/))_
- [**in-memory storage and manipulation**](#storing)
- [**Turtle writing**](#writing)

It has the following characteristics:
- extreme performance – by far the [fastest parser in JavaScript](https://github.com/RubenVerborgh/N3.js/tree/master/perf)
- asynchronous – triples arrive as soon as possible
- streaming – streams are parsed as data comes in, so you can easily parse files that don't fit into memory

At a later stage, this library will support [Notation3 (N3)](http://www.w3.org/TeamSubmission/n3/),
a Turtle superset.

## Installation
N3.js comes as an [npm package](https://npmjs.org/package/n3).

``` bash
$ npm install n3
```

``` js
var N3 = require('n3');
```

It is also fully compatible with [browserify](http://browserify.org/).
<br>
Alternatively, it offers a minimal browser version (without Node stream support).

``` bash
$ cd n3
$ npm install
$ make browser
```

``` html
<script src="n3-browser.min.js"></script>
```

## Triple representation
For maximum performance and easy of use,
triples are represented as simple objects.
<br>
Since URIs are most common when dealing with RDF,
they are represented as simple strings.

``` Turtle
@prefix c: <http://example.org/cartoons#>.
c:Tom a c:Cat.
```
is represented as
``` js
{
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  object:    'http://example.org/cartoons#Cat'
}
```

Literals are represented as double quoted strings.

``` Turtle
c:Tom c:name "Tom".
```
is represented as
``` js
{
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://example.org/cartoons#name',
  object:    '"Tom"'
}
```

This allows you to create and compare literals fast and easily:
``` js
triple.object === 'http://example.org/cartoons#Cat'
triple.object === '"Tom"'
```

The [Utility](#utility) section details entity representation in more depth.

## Parsing

### From a Turtle string to triples

`N3.Parser` parses strings into triples using a callback.
<br>
The callback's first argument is an error value,
the second is a triple.
If there are no more triples,
the callback is invoked one last time with `null` as `triple` value
and a hash of prefixes as the third argument.

``` js
var parser = N3.Parser();
parser.parse('@prefix c: <http://example.org/cartoons#>.\n' +
             'c:Tom a c:Cat.\n' +
             'c:Jerry a c:Mouse;\n' +
             '        c:smarterThan c:Tom.',
             function (error, triple, prefixes) {
               if (triple)
                 console.log(triple.subject, triple.predicate, triple.object, '.');
               else
                 console.log("# That's all, folks!", prefixes)
             });
```

Addionally, a second callback `function (prefix, uri)` can be passed to `parse`.

### From Turtle fragments to triples

`N3.Parser` can also parse triples from a Turtle document that arrives in fragments.

``` js
var parser = N3.Parser(), triples = [];
parser.parse(function (error, triple, prefixes) { triple && triples.push(triple); });

parser.addChunk('@prefix c: <http://example.org/cartoons#>.\n');
parser.addChunk('c:Tom a ');
parser.addChunk('c:Cat. c:Jerry a');
console.log(triples); // First triple

parser.addChunk(' c:Mouse.');
parser.end();
console.log(triples); // Both triples
```

### From a Turtle stream to triples

`N3.Parser` can parse streams as they grow, returning triples as soon as they're ready.
<br>
This behavior sets N3.js apart from most other Turtle libraries.

``` js
var parser = N3.Parser(),
    turtleStream = fs.createReadStream('cartoons.ttl');
parser.parse(turtleStream, console.log);
```

In addition, `N3.StreamParser` offers a [Node Stream](http://nodejs.org/api/stream.html) implementation,
so you can transform Turtle streams and pipe them to anywhere.
This solution is ideal if your consumer is slower,
as it avoids parser backpressure.

``` js
var streamParser = N3.StreamParser(),
    turtleStream = fs.createReadStream('cartoons.ttl');
turtleStream.pipe(streamParser);
streamParser.pipe(new SlowConsumer());

function SlowConsumer() {
  var writer = new require('stream').Writable({ objectMode: true });
  writer._write = function (triple, encoding, done) {
    console.log(triple);
    setTimeout(done, 1000);
  };
  return writer;
}
```

A dedicated `prefix` event signals every prefix with `prefix` and `uri` arguments.

## Storing

In this example below, we create a new store and add the triples `:Pluto a :Dog.` and `:Mickey a :Mouse`.
Then, we find a triple with `:Mickey` as subject.

``` js
var store = N3.Store();
store.addTriple(':Pluto', 'a', ':Dog');
store.addTriple(':Mickey', 'a', ':Mouse');

var mickey = store.find(':Mickey', null, null)[0];
console.log(mickey.subject, mickey.predicate, mickey.object, '.');
```

## Writing

### From triples to a string

`N3.Writer` can serialize triples as a Turtle string.

``` js
var writer = N3.Writer({ 'c': 'http://example.org/cartoons#' });
writer.addTriple('http://example.org/cartoons#Tom',
                 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
                 'http://example.org/cartoons#Cat');
writer.addTriple({
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://example.org/cartoons#name',
  object:    '"Tom"'
});
writer.end(function (error, result) { console.log(result); });
```

### From triples to a Turtle stream

`N3.Writer` can also write triples to an output stream.

``` js
var writer = N3.Writer(process.stdout, { 'c': 'http://example.org/cartoons#' });
writer.addTriple('http://example.org/cartoons#Tom',
                 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
                 'http://example.org/cartoons#Cat');
writer.addTriple({
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://example.org/cartoons#name',
  object:    '"Tom"'
});
writer.end();
```

### From a triple stream to a Turtle stream

`N3.StreamWriter` is a Turtle writer implementation as a [Node Stream](http://nodejs.org/api/stream.html).

``` js
var streamParser = new N3.StreamParser(),
    inputStream = fs.createReadStream('cartoons.ttl'),
    streamWriter = new N3.StreamWriter({ 'c': 'http://example.org/cartoons#' });
inputStream.pipe(streamParser);
streamParser.pipe(streamWriter);
streamWriter.pipe(process.stdout);
```

## Utility
`N3.Util` offers helpers for URI and literal representations.
<br>
As URIs are most common, they are represented as simple strings:
``` js
var N3Util = N3.Util;
N3Util.isUri('http://example.org/cartoons#Mickey'); // true
```
**Literals** are represented as double quoted strings:
``` js
N3Util.isLiteral('"Mickey Mouse"'); // true
N3Util.getLiteralValue('"Mickey Mouse"'); // 'Mickey Mouse'
N3Util.isLiteral('"Mickey Mouse"@en'); // true
N3Util.getLiteralLanguage('"Mickey Mouse"@en'); // 'en'
N3Util.isLiteral('"3"^^<http://www.w3.org/2001/XMLSchema#integer>'); // true
N3Util.getLiteralType('"3"^^<http://www.w3.org/2001/XMLSchema#integer>'); // 'http://www.w3.org/2001/XMLSchema#integer'
N3Util.isLiteral('"http://example.org/"'); // true
N3Util.getLiteralValue('"http://example.org/"'); // 'http://example.org/'
```
Note the difference between `'http://example.org/'` (URI) and `'"http://example.org/"'` (literal).
<br>
Also note that the double quoted literals are _not_ raw Turtle syntax:
``` js
N3Util.isLiteral('"This word is "quoted"!"'); // true
```
The above string represents the string _This word is "quoted"!_,
even though the correct Turtle syntax for that is `"This word is \"quoted\"!"`
N3.js thus always parses literals, but adds quotes to differentiate from URIs:
``` js
new N3.Parser().parse('<a> <b> "This word is \\"quoted\\"!".', console.log);
// { subject: 'a', predicate: 'b', object: '"This word is "quoted"!"' }
```

**Blank nodes** start with `_:`, and can be tested for as follows:
``` js
N3Util.isBlank('_:b1'); // true
N3Util.isUri('_:b1'); // false
N3Util.isLiteral('_:b1'); // false
```

**QNames** can be tested and expanded:
``` js
var prefixes = { 'rdfs': 'http://www.w3.org/2000/01/rdf-schema#' };
N3Util.isQName('rdfs:label'); // true;
N3Util.expandQName('rdfs:label', prefixes); // http://www.w3.org/2000/01/rdf-schema#label
```

### Loading the utility globally
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

# License, status and contributions
The N3.js library is copyrighted by [Ruben Verborgh](http://ruben.verborgh.org/)
and released under the [MIT License](https://github.com/RubenVerborgh/N3.js/blob/master/LICENSE.md).

[![Build Status](https://travis-ci.org/RubenVerborgh/N3.js.png?branch=master)](https://travis-ci.org/RubenVerborgh/N3.js)
<br>
[![Browser Build Status](https://ci.testling.com/RubenVerborgh/N3.js.png)](https://ci.testling.com/RubenVerborgh/N3.js)

Contributions are welcome, and bug reports or pull requests are always helpful.
If you plan to implement larger features, it's best to contact me first.
