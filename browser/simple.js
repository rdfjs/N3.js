
const README = 'https://github.com/rdfjs/N3.js#'

console.log(N3);
let target = document.getElementById("target");
target.innerHTML = "";
let title = document.createElement("h1");
title.textContent = "N3.js in the Browser";
target.appendChild(title);

let Cartoons = `PREFIX c: <http://example.org/cartoons#>
   c:Tom a c:Cat.
   c:Jerry a c:Mouse;
           c:smarterThan c:Tom.`

class Log {
  pre = null

  section (h, title, fragment) {
    let hElt = document.createElement(h)
    let a = document.createElement("a")
    a.setAttribute("href", README + fragment)
    a.appendChild(document.createTextNode(title))
    hElt.appendChild(a)
    this.pre = document.createElement("pre")
    target.appendChild(hElt)
    target.appendChild(this.pre)
  }

  write (msg) {
    let toAdd = typeof msg === "object"
        ? JSON.stringify(msg, null, 2)
        : msg
    this.pre.innerHTML += toAdd + "\n"
  }
  // writable () {
  //   readableStream.on('data', function(chunk) {
  //     writableStream.write(chunk);
  //   });
  // }
}

/** create a ReadableStream from a string
 */
function createReadStream (str) {
  const chunkSize = 10
  let nowAt = -chunkSize

  return new ReadableStream({
    pull (controller) {
      return pump();
      function pump() {
        if (nowAt > str.length)
          controller.close();
        else
          controller.enqueue(str.substr(nowAt += chunkSize, chunkSize))
        // return pump();
      }
    }  
  });
}

const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;

Promise.resolve(new Log()).then(log => {
  log.section("h2", "Creating triples/quads", "creating-triplesquads")

  const myQuad = quad(
    namedNode('https://ruben.verborgh.org/profile/#me'),
    namedNode('http://xmlns.com/foaf/0.1/givenName'),
    literal('Ruben', 'en'),
    defaultGraph(),
  );
  log.write(myQuad.subject.value);         // https://ruben.verborgh.org/profile/#me
  log.write(myQuad.object.value);          // Ruben
  log.write(myQuad.object.datatype.value); // http://www.w3.org/1999/02/22-rdf-syntax-ns#langString
  log.write(myQuad.object.language);       // en

  return log;
}).then(log => {
  log.section("h2", "Parsing", "parsing")
  log.section("h3", "From an RDF document to quads", "from-an-rdf-document-to-quads")
  return new Promise((resolve, reject) => {

    const parser = new N3.Parser();
    parser.parse(Cartoons,
      (error, quad, prefixes) => {
        if (quad)
          log.write(quad);
        else {
          log.write("# That's all, folks!", prefixes);
          resolve(log)
        }
      });

  })
}).then(log => {
  log.section("h3", "From an RDF stream to quads", "from-an-rdf-stream-to-quads")
  return new Promise((resolve, reject) => {

    const streamParser = new N3.StreamParser(),
          rdfStream = createReadStream(Cartoons);
resolve(log); return; // !! broken here
    rdfStream.pipeTo(streamParser);
    streamParser.pipeTo(new SlowConsumer());

    function SlowConsumer() {
      const writer = new WritableStream({ objectMode: true });
      writer._write = (quad, encoding, done) => {
        log.write(quad);
        setTimeout(done, 1000);
      };
      return writer;
    }

  })
}).then(log => {
  log.section("h2", "Writing", "writing")
  log.section("h3", "From quads to a string", "from-quads-to-a-string")
  return new Promise((resolve, reject) => {

    const writer = new N3.Writer({ prefixes: { c: 'http://example.org/cartoons#' } });
    writer.addQuad(
      namedNode('http://example.org/cartoons#Tom'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://example.org/cartoons#Cat')
    );
    writer.addQuad(quad(
      namedNode('http://example.org/cartoons#Tom'),
      namedNode('http://example.org/cartoons#name'),
      literal('Tom')
    ));
    writer.end((error, result) => {
      log.write(result)
      resolve(log)
    });

  })
}).then(log => {
  log.section("h3", "From quads to an RDF stream", "from-quads-to-an-rdf-stream")

  const writer = new N3.Writer(log, { end: false, prefixes: { c: 'http://example.org/cartoons#' } });
  writer.addQuad(
    namedNode('http://example.org/cartoons#Tom'),
    namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    namedNode('http://example.org/cartoons#Cat')
  );
  writer.addQuad(quad(
    namedNode('http://example.org/cartoons#Tom'),
    namedNode('http://example.org/cartoons#name'),
    literal('Tom')
  ));
  writer.end();

  return log
}).then(log => {
  log.section("h3", "From a quad stream to an RDF stream", "from-a-quad-stream-to-an-rdf-stream")

  const streamParser = new N3.StreamParser(),
        inputStream = createReadStream(Cartoons),
        streamWriter = new N3.StreamWriter({ prefixes: { c: 'http://example.org/cartoons#' } });
return log; // !! broken here
  inputStream.pipe(streamParser);
  streamParser.pipe(streamWriter);
  streamWriter.pipe(log);

  return log
}).then(log => {
  log.section("h3", "Blank nodes and lists", "blank-nodes-and-lists")

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
  writer.end((error, result) => log.write(result));

  return log
}).then(log => {
  log.section("h2", "Storing", "storing")

  const store = new N3.Store();
  store.addQuad(
    namedNode('http://ex.org/Pluto'), 
    namedNode('http://ex.org/type'),
    namedNode('http://ex.org/Dog')
  );
  store.addQuad(
    namedNode('http://ex.org/Mickey'),
    namedNode('http://ex.org/type'),
    namedNode('http://ex.org/Mouse')
  );

  const mickey = store.getQuads(namedNode('http://ex.org/Mickey'), null, null)[0];
  log.write(mickey);

  return log
})

