# Lightning fast, asynchronous, streaming RDF for JavaScript

The N3.js library lets you handle [RDF](http://www.w3.org/TR/rdf-primer/) in JavaScript easily, in [Node.js](http://nodejs.org/) and the browser.
It offers:

- [**Parsing**](#parsing) triples/quads from
  [Turtle](http://www.w3.org/TR/turtle/),
  [TriG](http://www.w3.org/TR/trig/),
  [N-Triples](http://www.w3.org/TR/n-triples/)
  and [N-Quads](http://www.w3.org/TR/n-quads/).
- [**Writing**](#Writing) triples/quads to
  [Turtle](http://www.w3.org/TR/turtle/),
  [TriG](http://www.w3.org/TR/trig/),
  [N-Triples](http://www.w3.org/TR/n-triples/)
  and [N-Quads](http://www.w3.org/TR/n-quads/).
- **Storage** of triples/quads in memory

Parsing and writing is:
- **asynchronous** – triples arrive as soon as possible
- **streaming** – streams are parsed as data comes in, so you can parse files larger than memory
- **fast** – by far the [fastest parser in JavaScript](https://github.com/RubenVerborgh/N3.js/tree/master/perf)

## Installation
For Node.js, N3.js comes as an [npm package](https://npmjs.org/package/n3).

``` bash
$ npm install n3
```

``` js
var N3 = require('n3');
```

N3.js seamlessly works in browsers. Generate a browser version as follows:

``` bash
$ cd N3.js
$ npm install
$ npm run browser
```

``` html
<script src="n3-browser.min.js"></script>
```

In addition, N3.js is fully compatible with [browserify](http://browserify.org/),
so you can write code for Node.js and deploy it to browsers.

## Triple representation
For maximum performance and ease of use,
triples are simple objects with string properties.

**URLs, URIs and IRIs are simple strings.** For example, parsing this RDF document:
``` Turtle
@prefix c: <http://example.org/cartoons#>.
c:Tom a c:Cat.
```
results in this JavaScript object:
``` js
{
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  object:    'http://example.org/cartoons#Cat'
}
```

**Literals are represented as double quoted strings.** For example, parsing this RDF document:
``` Turtle
c:Tom c:name "Tom".
```
results in this JavaScript object:
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

For literals with a language or type, add a marker (`@` or `^^`) and the corresponding value as-is:
``` js
'"Tom"@en-gb' // lowercase language
'"1"^^http://www.w3.org/2001/XMLSchema#integer' // no angular brackets <>
```

An optional fourth element signals the graph to which a triple belongs:
``` js
{
  subject:   'http://example.org/cartoons#Tom',
  predicate: 'http://example.org/cartoons#name',
  object:    '"Tom"',
  graph:     'http://example.org/mycartoon'
}
```

The N3.js [Utility](#utility) (`N3.Util`) can help you with these representations.

## Parsing

### From an RDF document to triples

`N3.Parser` transforms Turtle, TriG, N-Triples or N-Quads document into triples through a callback:
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
The callback's first argument is an error value, the second is a triple.
If there are no more triples,
the callback is invoked one last time with `null` for `triple`
and a hash of prefixes as third argument.
<br>
Pass a second callback to `parse` to retrieve prefixes as they are read.

By default, `N3.Parser` parses a permissive superset of Turtle, TriG, N-Triples and N-Quads.
<br>
For strict compatibility with any of those languages, pass a `format` argument upon creation:

``` js
var parser1 = N3.Parser({ format: 'N-Triples' });
var parser2 = N3.Parser({ format: 'application/trig' });
```

### From RDF chunks to triples

`N3.Parser` can also parse triples from RDF documents arriving in chunks,
for instance, when being downloaded or read from disk.
Use `addChunk` to add a piece of data, and `end` to signal the end.

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

### From an RDF stream to triples

`N3.Parser` can parse [Node.js streams](http://nodejs.org/api/stream.html) as they grow,
returning triples as soon as they're ready.
<br>
This behavior sets N3.js apart from most other libraries.

``` js
var parser = N3.Parser(),
    rdfStream = fs.createReadStream('cartoons.ttl');
parser.parse(rdfStream, console.log);
```

In addition, `N3.StreamParser` offers a [Node.js stream](http://nodejs.org/api/stream.html) implementation,
so you can transform RDF streams and pipe them to anywhere.
This solution is ideal if your consumer is slower,
since source data is only read when the consumer is ready.

``` js
var streamParser = N3.StreamParser(),
    rdfStream = fs.createReadStream('cartoons.ttl');
rdfStream.pipe(streamParser);
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

A dedicated `prefix` event signals every prefix with `prefix` and `iri` arguments.

## Writing

### From triples to a string

`N3.Writer` serializes triples as an RDF document.
Write triples through `addTriple`.

``` js
var writer = N3.Writer({ prefixes: { c: 'http://example.org/cartoons#' } });
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

By default, `N3.Writer` writes Turtle (or TriG for triples with a `graph` property).
<br>
To write N-Triples (or N-Quads) instead, pass a `format` argument upon creation:

``` js
var writer1 = N3.Writer({ format: 'N-Triples' });
var writer2 = N3.Writer({ format: 'application/trig' });
```

### From triples to an RDF stream

`N3.Writer` can also write triples to a Node.js stream.

``` js
var writer = N3.Writer(process.stdout, { prefixes: { c: 'http://example.org/cartoons#' } });
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

### From a triple stream to an RDF stream

`N3.StreamWriter` is a writer implementation as a Node.js stream.

``` js
var streamParser = new N3.StreamParser(),
    inputStream = fs.createReadStream('cartoons.ttl'),
    streamWriter = new N3.StreamWriter({ prefixes: { c: 'http://example.org/cartoons#' } });
inputStream.pipe(streamParser);
streamParser.pipe(streamWriter);
streamWriter.pipe(process.stdout);
```

### Blank nodes and lists
You might want to use the `[…]` and list `(…)` notations of Turtle and TriG.
However, a streaming writer cannot create these automatically:
the shorthand notations are only possible if blank nodes or list heads are not used later on,
which can only be determined conclusively at the end of the stream.

The `blank` and `list` functions allow you to create them manually instead:
```js
var writer = N3.Writer({ prefixes: { c: 'http://example.org/cartoons#',
                                     foaf: 'http://xmlns.com/foaf/0.1/' } });
writer.addTriple(writer.blank('http://xmlns.com/foaf/0.1/givenName', '"Tom"@en'),
                 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
                 'http://example.org/cartoons#Cat');
writer.addTriple('http://example.org/cartoons#Jerry',
                 'http://xmlns.com/foaf/0.1/knows',
                 writer.blank([{
                   predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
                   object: 'http://example.org/cartoons#Cat'
                 },{
                   predicate: 'http://xmlns.com/foaf/0.1/givenName',
                   object: '"Tom"@en',
                 }]));
writer.addTriple('http://example.org/cartoons#Mammy',
                 'http://example.org/cartoons#hasPets',
                 writer.list([
                   'http://example.org/cartoons#Tom',
                   'http://example.org/cartoons#Jerry'
                 ]));
writer.end(function (error, result) { console.log(result); });
```

Be careful to use the output of `blank` and `list`
**only once** and **only as argument to `addTriple`** of the same writer,
as return values of these functions are unspecified.

## Storing

`N3.Store` allows you to store triples in memory and find them fast.

In this example, we create a new store and add the triples `:Pluto a :Dog.` and `:Mickey a :Mouse`.
<br>
Then, we find a triple with `:Mickey` as subject.

``` js
var store = N3.Store();
store.addTriple('http://ex.org/Pluto',  'http://ex.org/type', 'http://ex.org/Dog');
store.addTriple('http://ex.org/Mickey', 'http://ex.org/type', 'http://ex.org/Mouse');

var mickey = store.find('http://ex.org/Mickey', null, null)[0];
console.log(mickey.subject, mickey.predicate, mickey.object, '.');
```

## Utility
`N3.Util` offers helpers for IRI and literal representations.
<br>
As IRIs are most common, they are represented as simple strings:
``` js
var N3Util = N3.Util;
N3Util.isIRI('http://example.org/cartoons#Mickey'); // true
```
**Literals** are represented as double quoted strings:
``` js
N3Util.isLiteral('"Mickey Mouse"'); // true
N3Util.getLiteralValue('"Mickey Mouse"'); // 'Mickey Mouse'
N3Util.isLiteral('"Mickey Mouse"@en'); // true
N3Util.getLiteralLanguage('"Mickey Mouse"@en'); // 'en'
N3Util.isLiteral('"3"^^http://www.w3.org/2001/XMLSchema#integer'); // true
N3Util.getLiteralType('"3"^^http://www.w3.org/2001/XMLSchema#integer'); // 'http://www.w3.org/2001/XMLSchema#integer'
N3Util.isLiteral('"http://example.org/"'); // true
N3Util.getLiteralValue('"http://example.org/"'); // 'http://example.org/'
```
Note the difference between `'http://example.org/'` (IRI) and `'"http://example.org/"'` (literal).
<br>
Also note that the double quoted literals are _not_ raw Turtle/TriG syntax:
``` js
N3Util.isLiteral('"This word is "quoted"!"'); // true
N3Util.isLiteral('"3"^^http://www.w3.org/2001/XMLSchema#integer'); // true
```
The above string represents the string _This word is "quoted"!_,
even though the correct Turtle/TriG syntax for that is `"This word is \"quoted\"!"`
N3.js thus always parses literals, but adds quotes to differentiate from IRIs:
``` js
new N3.Parser().parse('<a> <b> "This word is \\"quoted\\"!".', console.log);
// { subject: 'a', predicate: 'b', object: '"This word is "quoted"!"' }
```

Literals can be created with `createLiteral`:
``` js
N3Util.createLiteral('My text', 'en-gb');
N3Util.createLiteral('123', 'http://www.w3.org/2001/XMLSchema#integer');
N3Util.createLiteral(123);
N3Util.createLiteral(false);
```

**Blank nodes** start with `_:`, and can be tested for as follows:
``` js
N3Util.isBlank('_:b1'); // true
N3Util.isIRI('_:b1'); // false
N3Util.isLiteral('_:b1'); // false
```

**Prefixed names** can be tested and expanded:
``` js
var prefixes = { rdfs: 'http://www.w3.org/2000/01/rdf-schema#' };
N3Util.isPrefixedName('rdfs:label'); // true;
N3Util.expandPrefixedName('rdfs:label', prefixes); // http://www.w3.org/2000/01/rdf-schema#label
```

### Loading the utility globally
For convenience, `N3Util` can be loaded globally:
``` js
require('n3').Util(global);
isIRI('http://example.org/cartoons#Mickey'); // true
isLiteral('"Mickey Mouse"'); // true
```

If desired, its methods can even be added directly on all strings:
``` js
require('n3').Util(String, true);
'http://example.org/cartoons#Mickey'.isIRI(); // true
'"Mickey Mouse"'.isLiteral(); // true
```

## Compatibility
### Specifications
The N3.js parser and writer is fully compatible with the following W3C specifications:
- [RDF 1.1 Turtle](http://www.w3.org/TR/turtle/)
  – [EARL report](https://raw.githubusercontent.com/RubenVerborgh/N3.js/earl/n3js-earl-report-turtle.ttl)
- [RDF 1.1 TriG](http://www.w3.org/TR/trig/)
  – [EARL report](https://raw.githubusercontent.com/RubenVerborgh/N3.js/earl/n3js-earl-report-trig.ttl)
- [RDF 1.1 N-Triples](http://www.w3.org/TR/n-triples/)
  – [EARL report](https://raw.githubusercontent.com/RubenVerborgh/N3.js/earl/n3js-earl-report-ntriples.ttl)
- [RDF 1.1 N-Quads](http://www.w3.org/TR/n-quads/)
  – [EARL report](https://raw.githubusercontent.com/RubenVerborgh/N3.js/earl/n3js-earl-report-nquads.ttl)

Pass a `format` option to the constructor with the name or MIME type of a format
for strict, fault-intolerant behavior.

Note that the library does not support full [Notation3](http://www.w3.org/TeamSubmission/n3/) yet
(and a standardized specification for this syntax is currently lacking).

### Breaking changes
N3.js 0.4.x introduces the following breaking changes from 0.3.x versions:
- The fourth element of a quad is named `graph` instead of `context`.
- `N3.Writer` and `N3.Store` constructor options are passed as a hash `{ prefixes: { … } }`.
- `N3.Util` URI methods such as `isUri` are now IRI methods such as `isIRI`.

## License, status and contributions
The N3.js library is copyrighted by [Ruben Verborgh](http://ruben.verborgh.org/)
and released under the [MIT License](https://github.com/RubenVerborgh/N3.js/blob/master/LICENSE.md).

[![Build Status](https://travis-ci.org/RubenVerborgh/N3.js.png?branch=master)](https://travis-ci.org/RubenVerborgh/N3.js)
<br>
[![Browser Build Status](https://ci.testling.com/RubenVerborgh/N3.js.png)](https://ci.testling.com/RubenVerborgh/N3.js)

Contributions are welcome, and bug reports or pull requests are always helpful.
If you plan to implement a larger feature, it's best to contact me first.
