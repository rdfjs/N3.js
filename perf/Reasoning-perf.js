#!/usr/bin/env node
const N3 = require('..');
const fs = require('fs'),
    path = require('path'),
    assert = require('assert');

const { Quad, NamedNode, Variable } = N3;

function load(filename, store) {
  return new Promise((res) => {
    new N3.Parser({ baseIRI: 'http://example.org' }).parse(fs.createReadStream(path.join(__dirname, filename)), (error, quad) => {
      assert(!error, error);
      if (quad)
        store.add(quad);
      else {
        res();
      }
    });
    
  })
}

async function run() {
  const store = new N3.Store();
  console.time('loading foaf ontology');
  await load('./data/foaf.ttl', store);
  console.timeEnd('loading foaf ontology');

  console.time('loading tim berners lee profile card');
  await load('./data/timbl.ttl', store);
  console.timeEnd('loading tim berners lee profile card');

  console.log(store.size)

  console.time('apply reasoning');
  store.reason([{
    premise: [new Quad(
      new Variable('?s'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new Variable('?o'),
    ),new Quad(
      new Variable('?o'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      new Variable('?o2'),
    )],
    conclusion: [
      new Quad(
        new Variable('?s'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?o2'),
      ),
    ]
  }]);

  // for (const elem of store.match(null, new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null)) {
  //   const r = [...store.match(elem.object, new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'), null)];
  //   if (r.length > 0) {
  //     // console.log([...store.match(null, new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null)])
  //     console.log(elem.subject.value, r);
  //   }
  //   // console.log([...store.match(elem.object, new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'), null)])
  // }
  // console.log([...store.match(null, new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null)])
  // console.log([...store.match(null, new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'), null)])

  console.timeEnd('apply reasoning');

  console.log(store.has(
    new Quad(
      new NamedNode('http://example.org#me'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing'),
    ),
  ))

  console.log(store.has(
    new Quad(
      new NamedNode('http://example.org#me'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('http://xmlns.com/foaf/0.1/Person'),
    ),
  ))
  console.log(store.has(
    new Quad(
      new NamedNode('http://xmlns.com/foaf/0.1/Person'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing'),
    ),
  ))

  console.log(store.size)
}

run()
