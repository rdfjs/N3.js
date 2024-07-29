#!/usr/bin/env node
const { getTimblAndFoaf, generateDeepTaxonomy, getRdfs } = require('deep-taxonomy-benchmark');
const N3 = require('..');

const SUBCLASS_RULE = N3.getRulesFromDataset(new N3.Store((new N3.Parser({ format: 'text/n3' })).parse('{ ?s a ?o . ?o <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?o2 . } => { ?s a ?o2 . } .')));

async function deepTaxonomy(extended = false) {
  for (let i = 1; i <= (extended ? 3 : 5); i++) {
    const TITLE = `test-dl-${10 ** i}.n3`;
    const store = generateDeepTaxonomy(10 ** i, extended);

    console.time(`Reasoning: ${TITLE}`);
    new N3.Reasoner(store).reason(SUBCLASS_RULE);
    console.timeEnd(`Reasoning: ${TITLE}`);
  }
}

async function run() {
  const RDFS_RULE = N3.getRulesFromDataset(await getRdfs());
  const store = new N3.Store([...await getTimblAndFoaf()]);

  console.time('Reasoning');
  new N3.Reasoner(store).reason(RDFS_RULE);
  console.timeEnd('Reasoning');
}

(async () => {
  console.log('Reasoning over TimBL profile and FOAF');
  await run();

  console.log('\nRunning Deep Taxonomy Benchmark');
  await deepTaxonomy();

  console.log('\nRunning Extended Deep Taxonomy Benchmark');
  await deepTaxonomy(true);
})();
