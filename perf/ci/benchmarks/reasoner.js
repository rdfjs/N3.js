// Reasoner
const { EX } = require('../data');
const { check, storeOf } = require('../helpers');

const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

const rdfsRules = `
@prefix rdfs: <${RDFS}> .
@prefix rdf: <${RDF}> .
{ ?s ?p ?o . ?p rdfs:domain ?c } => { ?s a ?c } .
{ ?s ?p ?o . ?p rdfs:range ?c } => { ?o a ?c } .
{ ?s a ?c . ?c rdfs:subClassOf ?d } => { ?s a ?d } .
{ ?s ?p ?o . ?p rdfs:subPropertyOf ?q } => { ?s ?q ?o } .
`;

module.exports = {
  'reasoner: deep taxonomy (1000)': N3 => {
    const { generateDeepTaxonomy } = require('deep-taxonomy-benchmark');
    const rules = new N3.Store(new N3.Parser({ format: 'text/n3' }).parse(
      '{ ?s a ?o . ?o <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o2 . } => { ?s a ?o2 . } .'));
    return () => {
      const store = generateDeepTaxonomy(1000, false);
      new N3.Reasoner(store).reason(rules);
    };
  },
  'reasoner: RDFS-style rules': N3 => {
    const { namedNode, quad } = N3.DataFactory;
    const rules = new N3.Store(new N3.Parser({ format: 'text/n3' }).parse(rdfsRules));
    const schema = [];
    for (let i = 0; i < 20; i++) {
      schema.push(quad(namedNode(`${EX}p${i}`), namedNode(`${RDFS}domain`), namedNode(`${EX}C${i % 5}`)));
      schema.push(quad(namedNode(`${EX}p${i}`), namedNode(`${RDFS}subPropertyOf`), namedNode(`${EX}q${i % 3}`)));
    }
    for (let i = 0; i < 5; i++)
      schema.push(quad(namedNode(`${EX}C${i}`), namedNode(`${RDFS}subClassOf`), namedNode(`${EX}D${i % 2}`)));
    const quads = storeOf(N3, 3000).map(q => quad(q.subject, q.predicate, q.object));
    return {
      before: () => new N3.Store([...schema, ...quads]),
      run: store => {
        const before = store.size;
        new N3.Reasoner(store).reason(rules);
        check(store.size > before, 'nothing inferred');
      },
    };
  },
  'reasoner: getRulesFromDataset': N3 => {
    const text = [];
    for (let i = 0; i < 2000; i++)
      text.push(`{ ?x <${EX}p${i}> ?y . ?y a <${EX}C${i}> } => { ?x <${EX}q${i}> ?y } .`);
    const dataset = new N3.Store(new N3.Parser({ format: 'text/n3' }).parse(text.join('\n')));
    return () => {
      check(N3.getRulesFromDataset(dataset).length === 2000, 'wrong rules');
    };
  },
};
