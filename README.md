# Lightning fast, asynchronous, streaming Turtle for JavaScript

The _node-n3_ library lets you handle [Turtle](http://www.w3.org/TR/turtle/) and [RDF](http://www.w3.org/TR/rdf-primer/) in JavaScript easily.
It offers:

- [**Turtle parsing**](#parsing) _([fully compliant](https://github.com/RubenVerborgh/node-n3/tree/master/spec) with the [latest candidate recommendation](http://www.w3.org/TR/turtle/))_
- [**in-memory storage and manipulation**](#storing)
- [**Turtle writing**](#writing)

It has the following characteristics:
- extreme performance – by far the [fastest parser in JavaScript](https://github.com/RubenVerborgh/node-n3/tree/master/perf)
- asynchronous – triples arrive as soon as possible
- streaming – streams are parsed as data comes in, so you can easily parse files that don't fit into memory

At a later stage, this library will support [Notation3 (N3)](http://www.w3.org/TeamSubmission/n3/),
a Turtle superset.

## Installation
_node-n3_ comes as an [npm package](https://npmjs.org/package/n3).

``` bash
$ npm install n3
```

``` js
var n3 = require('n3');
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

`n3.Parser` parses strings into triples using a callback.

``` js
var parser = new require('n3').Parser();
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

### From a Turtle stream to triples

`n3.Parser` can parse streams as they grow, returning triples as soon as they're ready.
<br>
This behavior sets _node-n3_ apart from most other Turtle libraries.

``` js
var parser = new require('n3').Parser(),
    turtleStream = fs.createReadStream('cartoons.ttl');
parser.parse(turtleStream, console.log);
```

In addition, `n3.StreamParser` offers a [Node Stream](http://nodejs.org/api/stream.html) implementation,
so you can transform Turtle streams and pipe them to anywhere.
This solution is ideal if your consumer is slower,
as it avoids parser backpressure.

``` js
var streamParser = new require('n3').StreamParser(),
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

## Storing

In this example below, we create a new store and add the triples `:Pluto a :Dog.` and `:Mickey a :Mouse`.
Then, we find a triple with `:Mickey` as subject.

``` js
var store = new require('n3').Store();
store.add(':Pluto', 'a', ':Dog');
store.add(':Mickey', 'a', ':Mouse');

var mickey = store.find(':Mickey', null, null)[0];
console.log(mickey.subject, mickey.predicate, mickey.object, '.');
```

## Writing

### From triples to a Turtle stream

`n3.Writer` writes triples to an output stream.

``` js
var writer = new require('n3').Writer(process.stdout);
writer.addTriple({
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  object:    'http://example.org/cartoons#Cat'
});
writer.addTriple({
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://example.org/cartoons#name',
  object:    '"Tom"'
});
writer.end();
```

### From a triple stream to a Turtle stream

`n3.StreamWriter` is a Turtle writer implementation as a [Node Stream](http://nodejs.org/api/stream.html).

``` js
var n3 = require('n3'),
    streamParser = new n3.StreamParser(),
    inputStream = fs.createReadStream('cartoons.ttl'),
    streamWriter = new n3.StreamWriter();
inputStream.pipe(streamParser);
streamParser.pipe(streamWriter);
streamWriter.pipe(process.stdout);
```

## Utility
`n3.Util` offers helpers for URI and literal representations.
<br>
As URIs are most common, they are represented as simple strings:
``` js
var N3Util = require('n3').Util;
N3Util.isUri('http://example.org/cartoons#Mickey'); // true
```
Literals are represented as double quoted strings:
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

# License, status and contributions
The _node-n3_ library is copyrighted by [Ruben Verborgh](http://ruben.verborgh.org/)
and released under the [MIT License](https://github.com/RubenVerborgh/node-n3/blob/master/LICENSE.md).

Current versions are considered beta, so the API might change from release to release.
As such, it is best to depend on a specific version of the package.

Contributions are welcome, and bug reports or pull requests are always helpful.
If you plan to implement larger features, it's best to contact me first.
