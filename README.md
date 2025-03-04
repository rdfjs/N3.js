# Lightning fast, asynchronous, streaming RDF for JavaScript
[![Build Status](https://github.com/rdfjs/n3.js/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rdfjs/N3.js/actions)
[![Coverage Status](https://coveralls.io/repos/github/rdfjs/N3.js/badge.svg)](https://coveralls.io/github/rdfjs/N3.js)
[![npm version](https://badge.fury.io/js/n3.svg)](https://www.npmjs.com/package/n3)
[![DOI](https://zenodo.org/badge/3058202.svg)](https://zenodo.org/badge/latestdoi/3058202)

The N3.js library is an implementation of the [RDF.js low-level specification](http://rdf.js.org/) that lets you handle [RDF](https://www.w3.org/TR/rdf-primer/) in JavaScript easily.
It offers:

- [**Parsing**](#parsing) triples/quads from
  [Turtle](https://www.w3.org/TR/turtle/),
  [TriG](https://www.w3.org/TR/trig/),
  [N-Triples](https://www.w3.org/TR/n-triples/),
  [N-Quads](https://www.w3.org/TR/n-quads/),
  [RDF-star](https://www.w3.org/2021/12/rdf-star.html)
  and [Notation3 (N3)](https://www.w3.org/TeamSubmission/n3/)
- [**Writing**](#writing) triples/quads to
  [Turtle](https://www.w3.org/TR/turtle/),
  [TriG](https://www.w3.org/TR/trig/),
  [N-Triples](https://www.w3.org/TR/n-triples/),
  [N-Quads](https://www.w3.org/TR/n-quads/)
  and [RDF-star](https://www.w3.org/2021/12/rdf-star.html)
- [**Storage**](#storing) of triples/quads in memory

Parsing and writing is:
- 🎛 **asynchronous** – triples arrive as soon as possible
- 🚰 **streaming** – streams are parsed as data comes in, so you can parse files larger than memory
- ⚡️ **fast** – triples are flying out at high speeds

## Installation
For Node.js, N3.js comes as an [npm package](https://npmjs.org/package/n3).

```Bash
$ npm install n3
```

```JavaScript
const N3 = require('n3');
```

N3.js seamlessly works in browsers via [webpack](https://webpack.js.org/)
or [browserify](http://browserify.org/).
If you're unfamiliar with these tools,
you can read
[_webpack: Creating a Bundle – getting started_](https://webpack.js.org/guides/getting-started/#creating-a-bundle)
or
[_Introduction to browserify_](https://writingjavascript.org/posts/introduction-to-browserify).
You will need to create a "UMD bundle" and supply a name (e.g. with the `-s N3` option in browserify).

You can also load it via CDN:
```html
<script src="https://unpkg.com/n3/browser/n3.min.js"></script>
```

## Creating triples/quads
N3.js follows the [RDF.js low-level specification](http://rdf.js.org/).

`N3.DataFactory` will give you the [factory](http://rdf.js.org/#datafactory-interface) functions to create triples and quads:

```JavaScript
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;
const myQuad = quad(
  namedNode('https://ruben.verborgh.org/profile/#me'), // Subject
  namedNode('http://xmlns.com/foaf/0.1/givenName'),    // Predicate
  literal('Ruben', 'en'),                              // Object
  defaultGraph(),                                      // Graph
);
console.log(myQuad.termType);              // Quad
console.log(myQuad.value);                 // ''
console.log(myQuad.subject.value);         // https://ruben.verborgh.org/profile/#me
console.log(myQuad.object.value);          // Ruben
console.log(myQuad.object.datatype.value); // http://www.w3.org/1999/02/22-rdf-syntax-ns#langString
console.log(myQuad.object.language);       // en
```

In the rest of this document, we will treat “triples” and “quads” equally:
we assume that a quad is simply a triple in a named or default graph.

## Parsing

### From an RDF document to quads

`N3.Parser` transforms Turtle, TriG, N-Triples, or N-Quads document into quads through a callback:
```JavaScript
const tomAndJerry = `PREFIX c: <http://example.org/cartoons#>
  # Tom is a cat
  c:Tom a c:Cat.
  c:Jerry a c:Mouse;
    c:smarterThan c:Tom.`

const parser = new N3.Parser();

parser.parse(tomAndJerry,
  (error, quad, prefixes) => {
    if (quad)
      console.log(quad);
    else
      console.log("# That's all, folks!", prefixes);
  });
```
The callback's first argument is an optional error value, the second is a quad.
If there are no more quads,
the callback is invoked one last time with `null` for `quad`
and a hash of prefixes as third argument.
<br>

Alternatively, an object can be supplied, where `onQuad`, `onPrefix` and `onComment` are used to listen for `quads`, `prefixes` and `comments` as follows:
```JavaScript
const parser = new N3.Parser();

parser.parse(tomAndJerry, {
  // onQuad (required) accepts a listener of type (quad: RDF.Quad) => void
  onQuad: (err, quad) => { console.log(quad); },
  // onPrefix (optional) accepts a listener of type (prefix: string, iri: NamedNode) => void
  onPrefix: (prefix, iri) => { console.log(prefix, 'expands to', iri.value); },
  // onComment (optional) accepts a listener of type (comment: string) => void
  onComment: (comment) => { console.log('#', comment); },
});
```

If no callbacks are provided, parsing happens synchronously returning an array of quads:

```JavaScript
const parser = new N3.Parser();

// An array of resultant Quads
const quadArray = parser.parse(tomAndJerry);
```

By default, `N3.Parser` parses a permissive superset of Turtle, TriG, N-Triples, and N-Quads.
<br>
For strict compatibility with any of those languages, pass a `format` argument upon creation:

```JavaScript
const parser1 = new N3.Parser({ format: 'N-Triples' });
const parser2 = new N3.Parser({ format: 'application/trig' });
```

Notation3 (N3) is supported _only_ through the `format` argument:

```JavaScript
const parser3 = new N3.Parser({ format: 'N3' });
const parser4 = new N3.Parser({ format: 'Notation3' });
const parser5 = new N3.Parser({ format: 'text/n3' });
```

It is possible to provide the base IRI of the document that you want to parse.
This is done by passing a `baseIRI` argument upon creation:
```JavaScript
const parser = new N3.Parser({ baseIRI: 'http://example.org/' });
```

By default, `N3.Parser` will prefix blank node labels with a `b{digit}_` prefix.
This is done to prevent collisions of unrelated blank nodes having identical
labels. The `blankNodePrefix` constructor argument can be used to modify the
prefix or, if set to an empty string, completely disable prefixing:
```JavaScript
const parser = new N3.Parser({ blankNodePrefix: '' });
```

The parser can output a backwards chaining rule such as `_:q <= _:p.` in two ways:
- as `_:p log:implies _:q.` (default)
- as `_:q log:isImpliedBy _:p.` (when the `isImpliedBy` flag is set to `true`)
```JavaScript
const parser = new N3.Parser({ isImpliedBy: true });
```

### From an RDF stream to quads

`N3.Parser` can parse [Node.js streams](http://nodejs.org/api/stream.html) as they grow,
returning quads as soon as they're ready.

```JavaScript
const parser = new N3.Parser(),
      rdfStream = fs.createReadStream('cartoons.ttl');
parser.parse(rdfStream, console.log);
```

`N3.StreamParser` is a [Node.js stream](http://nodejs.org/api/stream.html) and [RDF.js Sink](http://rdf.js.org/#sink-interface) implementation.
This solution is ideal if your consumer is slower,
since source data is only read when the consumer is ready.

```JavaScript
const streamParser = new N3.StreamParser(),
      rdfStream = fs.createReadStream('cartoons.ttl');
rdfStream.pipe(streamParser);
streamParser.pipe(new SlowConsumer());

function SlowConsumer() {
  const writer = new require('stream').Writable({ objectMode: true });
  writer._write = (quad, encoding, done) => {
    console.log(quad);
    setTimeout(done, 1000);
  };
  return writer;
}
```

A dedicated `prefix` event signals every prefix with `prefix` and `term` arguments.
A dedicated `comment` event can be enabled by setting `comments: true` in the N3.StreamParser constructor.

## Writing

### From quads to a string

`N3.Writer` serializes quads as an RDF document.
Write quads through `addQuad`.

```JavaScript
const writer = new N3.Writer({ prefixes: { c: 'http://example.org/cartoons#' } }); // Create a writer which uses `c` as a prefix for the namespace `http://example.org/cartoons#`
writer.addQuad(quad(
  namedNode('http://example.org/cartoons#Tom'),   // Subject
  namedNode('http://example.org/cartoons#name'),  // Predicate
  literal('Tom')                                  // Object
));
writer.end((error, result) => console.log(result));
```

By default, `N3.Writer` writes Turtle (or TriG if some quads are in a named graph).
<br>
To write N-Triples (or N-Quads) instead, pass a `format` argument upon creation:

```JavaScript
const writer1 = new N3.Writer({ format: 'N-Triples' });
const writer2 = new N3.Writer({ format: 'application/trig' });
```

### From quads to an RDF stream

`N3.Writer` can also write quads to a Node.js stream through `addQuad`.

```JavaScript
const writer = new N3.Writer(process.stdout, { end: false, prefixes: { c: 'http://example.org/cartoons#' } });
writer.addQuad(
  namedNode('http://example.org/cartoons#Tom'),                   // Subject
  namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),   // Predicate
  namedNode('http://example.org/cartoons#Cat')                    // Object
);
writer.addQuad(quad(
  namedNode('http://example.org/cartoons#Tom'),     // Subject
  namedNode('http://example.org/cartoons#name'),  // Predicate
  literal('Tom')                                    // Object
));
writer.end();
```

### From a quad stream to an RDF stream

`N3.StreamWriter` is a [Node.js stream](http://nodejs.org/api/stream.html) and [RDF.js Sink](http://rdf.js.org/#sink-interface) implementation.

```JavaScript
const streamParser = new N3.StreamParser(),
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
```JavaScript
const writer = new N3.Writer({ prefixes: { c: 'http://example.org/cartoons#',
                                       foaf: 'http://xmlns.com/foaf/0.1/' } });
writer.addQuad(
  writer.blank(
    namedNode('http://xmlns.com/foaf/0.1/givenName'),
    literal('Tom', 'en')),
  namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  namedNode('http://example.org/cartoons#Cat')
);
writer.addQuad(quad(
  namedNode('http://example.org/cartoons#Jerry'),
  namedNode('http://xmlns.com/foaf/0.1/knows'),
  writer.blank([{
    predicate: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    object:    namedNode('http://example.org/cartoons#Cat'),
  },{
    predicate: namedNode('http://xmlns.com/foaf/0.1/givenName'),
    object:    literal('Tom', 'en'),
  }])
));
writer.addQuad(
  namedNode('http://example.org/cartoons#Mammy'),
  namedNode('http://example.org/cartoons#hasPets'),
  writer.list([
    namedNode('http://example.org/cartoons#Tom'),
    namedNode('http://example.org/cartoons#Jerry'),
  ])
);
writer.end((error, result) => console.log(result));
```

## Storing

`N3.Store` allows you to store triples in memory and find them fast.

In this example, we create a new store and add the triples `:Pluto a :Dog.` and `:Mickey a :Mouse`.
<br>
Then, we find triples with `:Mickey` as subject.

```JavaScript
const store = new N3.Store();
store.add(
  quad(
    namedNode('http://ex.org/Pluto'),
    namedNode('http://ex.org/type'),
    namedNode('http://ex.org/Dog')
  )
);
store.add(
  quad(
    namedNode('http://ex.org/Mickey'),
    namedNode('http://ex.org/type'),
    namedNode('http://ex.org/Mouse')
  )
);

// Retrieve all quads
for (const quad of store)
  console.log(quad);
// Retrieve Mickey's quads
for (const quad of store.match(namedNode('http://ex.org/Mickey'), null, null))
  console.log(quad);
```

If you are using multiple stores, you can reduce memory consumption by allowing them to share an entity index:
```JavaScript
const entityIndex = new N3.EntityIndex();
const store1 = new N3.Store([], { entityIndex });
const store2 = new N3.Store([], { entityIndex });
```

### [`Dataset` Interface](https://rdf.js.org/dataset-spec/#dataset-interface)
This store adheres to the `Dataset` interface which exposes the following properties

Attributes:
 - `size` — A non-negative integer that specifies the number of quads in the set.

Methods:
 - `add` — Adds the specified quad to the dataset. Existing quads, as defined in `Quad.equals`, will be ignored.
 - `delete` — Removes the specified quad from the dataset.
 - `has` — Determines whether a dataset includes a certain quad.
 - `match` — Returns a new dataset that is comprised of all quads in the current instance matching the given arguments.
 - `[Symbol.iterator]` — Implements the iterator protocol to allow iteration over all `quads` in the dataset as in the example above.

### Addition and deletion of quads
The store implements the following manipulation methods in addition to the standard [`Dataset` Interface](https://rdf.js.org/dataset-spec/#dataset-interface)
([documentation](http://rdfjs.github.io/N3.js/docs/N3Store.html)):
- `addQuad` to insert one quad
- `addQuads` to insert an array of quads
- `removeQuad` to remove one quad
- `removeQuads` to remove an array of quads
- `remove` to remove a stream of quads
- `removeMatches` to remove all quads matching the given pattern
- `deleteGraph` to remove all quads with the given graph
- `createBlankNode` returns an unused blank node identifier

### Searching quads or entities
The store provides the following search methods
([documentation](http://rdfjs.github.io/N3.js/docs/N3Store.html)):
- `match` returns a stream and generator of quads matching the given pattern
- `getQuads` returns an array of quads matching the given pattern
- `countQuads` counts the number of quads matching the given pattern
- `forEach` executes a callback on all matching quads
- `every` returns whether a callback on matching quads always returns true
- `some`  returns whether a callback on matching quads returns true at least once
- `getSubjects` returns an array of unique subjects occurring in matching quads
- `forSubjects` executes a callback on unique subjects occurring in matching quads
- `getPredicates` returns an array of unique predicates occurring in matching quad
- `forPredicates` executes a callback on unique predicates occurring in matching quads
- `getObjects` returns an array of unique objects occurring in matching quad
- `forObjects` executes a callback on unique objects occurring in matching quads
- `getGraphs` returns an array of unique graphs occurring in matching quad
- `forGraphs` executes a callback on unique graphs occurring in matching quads

## Reasoning

N3.js supports reasoning as follows:

```JavaScript
import { Reasoner, Store, Parser } from 'n3';

const parser = new Parser({ format: 'text/n3' });
const rules = `
{
  ?s a ?o .
  ?o <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o2 .
} => {
  ?s a ?o2 .
} .
`

const rulesDataset = new Store(parser.parse(rules));
const dataset = new Store(/* Dataset */)

// Applies the rules to the store; mutating it
const reasoner = new Reasoner(store);
reasoner.reason(rules);
```

**Note**: N3.js currently only supports rules with [Basic Graph Patterns](https://www.w3.org/TR/sparql11-query/#BasicGraphPattern) in the premise and conclusion. Built-ins and backward-chaining are *not* supported. For an RDF/JS reasoner that supports all Notation3 reasoning features, see [eye-js](https://github.com/eyereasoner/eye-js/).

## Compatibility
### Format specifications
The N3.js parser and writer is fully compatible with the following W3C specifications:
- [RDF 1.1 Turtle](https://www.w3.org/TR/turtle/)
  – [EARL report](https://raw.githubusercontent.com/rdfjs/N3.js/earl/n3js-earl-report-turtle.ttl)
- [RDF 1.1 TriG](https://www.w3.org/TR/trig/)
  – [EARL report](https://raw.githubusercontent.com/rdfjs/N3.js/earl/n3js-earl-report-trig.ttl)
- [RDF 1.1 N-Triples](https://www.w3.org/TR/n-triples/)
  – [EARL report](https://raw.githubusercontent.com/rdfjs/N3.js/earl/n3js-earl-report-ntriples.ttl)
- [RDF 1.1 N-Quads](https://www.w3.org/TR/n-quads/)
  – [EARL report](https://raw.githubusercontent.com/rdfjs/N3.js/earl/n3js-earl-report-nquads.ttl)

In addition, the N3.js parser also supports [Notation3 (N3)](https://www.w3.org/TeamSubmission/n3/) (no official specification yet).

The N3.js parser and writer are also fully compatible with the RDF-star variants
of the W3C specifications.

The default mode is permissive
and allows a mixture of different syntaxes, including RDF-star.
Pass a `format` option to the constructor with the name or MIME type of a format
for strict, fault-intolerant behavior.
If a format string contains `star` or `*`
(e.g., `turtlestar` or `TriG*`),
RDF-star support for that format will be enabled.

### Interface specifications
The N3.js submodules are compatible with the following [RDF.js](http://rdf.js.org) interfaces:

- `N3.DataFactory` implements
  [`DataFactory`](http://rdf.js.org/data-model-spec/#datafactory-interface)
  - the terms it creates implement [`Term`](http://rdf.js.org/data-model-spec/#term-interface)
    and one of
    [`NamedNode`](http://rdf.js.org/data-model-spec/#namednode-interface),
    [`BlankNode`](http://rdf.js.org/data-model-spec/#blanknode-interface),
    [`Literal`](http://rdf.js.org/data-model-spec/#literal-interface),
    [`Variable`](http://rdf.js.org/data-model-spec/#variable-interface),
    [`DefaultGraph`](http://rdf.js.org/data-model-spec/#defaultgraph-interface)
  - the triples/quads it creates implement
    [`Term`](http://rdf.js.org/data-model-spec/#term-interface),
    [`Triple`](http://rdf.js.org/data-model-spec/#triple-interface)
    and
    [`Quad`](http://rdf.js.org/data-model-spec/#quad-interface)
- `N3.StreamParser` implements
  [`Stream`](http://rdf.js.org/stream-spec/#stream-interface)
  and
  [`Sink`](http://rdf.js.org/stream-spec/#sink-interface)
- `N3.StreamWriter` implements
  [`Stream`](http://rdf.js.org/stream-spec/#stream-interface)
  and
  [`Sink`](http://rdf.js.org/stream-spec/#sink-interface)
- `N3.Store` implements
  [`Store`](http://rdf.js.org/stream-spec/#store-interface)
  [`Source`](http://rdf.js.org/stream-spec/#source-interface)
  [`Sink`](http://rdf.js.org/stream-spec/#sink-interface)
  [`DatasetCore`](https://rdf.js.org/dataset-spec/#datasetcore-interface)

## License and contributions
The N3.js library is copyrighted by [Ruben Verborgh](https://ruben.verborgh.org/)
and released under the [MIT License](https://github.com/rdfjs/N3.js/blob/master/LICENSE.md).

Contributions are welcome, and bug reports or pull requests are always helpful.
If you plan to implement a larger feature, it's best to contact me first.
