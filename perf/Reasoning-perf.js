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
  const store = new N3.Store(
    [
      new Quad(
      new NamedNode('j'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('o'),
    ),
    new Quad(
      new NamedNode('o'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      new NamedNode('o2'),
    ),
    new Quad(
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
      new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#Class'),
    )]
  );
  // console.time('loading foaf ontology');
  // await load('./data/foaf.ttl', store);
  // console.timeEnd('loading foaf ontology');

  // console.time('loading tim berners lee profile card');
  // await load('./data/timbl.ttl', store);
  // console.timeEnd('loading tim berners lee profile card');

  console.log(store.size)

  console.time('apply reasoning');
  store.reason([{
    premise: [
      new Quad(
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
  },
  // {
  //   premise: [new Quad(
  //     new Variable('?s'),
  //     new Variable('?p'),
  //     new Variable('?o'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?p'),
  //       new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //       new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#Property'),
  //     ),
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?a'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#domain'),
  //     new Variable('?x'),
  //   ),new Quad(
  //     new Variable('?u'),
  //     new Variable('?a'),
  //     new Variable('?y'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //       new Variable('?x'),
  //     ),
  //   ]
  // },
  {
    premise: [new Quad(
      new Variable('?a'),
      new NamedNode('http://www.w3.org/2000/01/rdf-schema#range'),
      new Variable('?x'),
    ),new Quad(
      new Variable('?u'), // With rules like this we *do not* need to iterate over the subject index so we should avoid doing so
      new Variable('?a'),
      new Variable('?v'), 
    )],
    conclusion: [
      new Quad(
        new Variable('?v'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new Variable('?x'),
      ),
    ]
  },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new Variable('?a'),
  //     new Variable('?x'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#Resource'),
  //     ),
  //     new Quad(
  //       new Variable('?x'),
  //       new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#Resource'),
  //     ),
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
  //     new Variable('?v'),
  //   ),new Quad(
  //     new Variable('?v'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
  //     new Variable('?x'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
  //       new Variable('?x'),
  //     )
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#Class'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#Resource'),
  //     )
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //     new Variable('?x'),
  //   ), new Quad(
  //     new Variable('?v'),
  //     new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //     new Variable('?u'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?v'),
  //       new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //       new Variable('?x'),
  //     )
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#Class'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //       new Variable('?u'),
  //     )
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //     new Variable('?v'),
  //   ),new Quad(
  //     new Variable('?v'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //     new Variable('?x'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //       new Variable('?x'),
  //     )
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#ContainerMembershipProperty'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#subPropertyOf'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#member'),
  //     )
  //   ]
  // },
  // {
  //   premise: [new Quad(
  //     new Variable('?u'),
  //     new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#Datatype'),
  //   )],
  //   conclusion: [
  //     new Quad(
  //       new Variable('?u'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //       new NamedNode('http://www.w3.org/2000/01/rdf-schema#Literal'),
  //     )
  //   ]
  // },
  ]);

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

  // console.log(store.has(
  //   new Quad(
  //     new NamedNode('http://example.org#me'),
  //     new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //     new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing'),
  //   ),
  // ))

  // console.log(store.has(
  //   new Quad(
  //     new NamedNode('http://example.org#me'),
  //     new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
  //     new NamedNode('http://xmlns.com/foaf/0.1/Person'),
  //   ),
  // ))
  // console.log(store.has(
  //   new Quad(
  //     new NamedNode('http://xmlns.com/foaf/0.1/Person'),
  //     new NamedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
  //     new NamedNode('http://www.w3.org/2003/01/geo/wgs84_pos#SpatialThing'),
  //   ),
  // ))

  console.log(store.getQuads())
  console.log(store.size)
}

run()
