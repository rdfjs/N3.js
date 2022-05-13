#!/usr/bin/env node
const N3 = require('..');
const path = require('path');
const { load, SUBCLASS_RULE, RDFS_RULE, generateDeepTaxonomy } = require('../test/util');

async function deepTaxonomy() {
  for (let i = 1; i <= 6; i++) {
    const TITLE = `test-dl-${10 ** i}.n3`;
    const store = generateDeepTaxonomy(10 ** i);

    console.time(`Reasoning: ${TITLE}`);
    new N3.Reasoner(store).reason(SUBCLASS_RULE);
    console.timeEnd(`Reasoning: ${TITLE}`);
  }
}

async function run() {
  const store = new N3.Store();
  console.time('loading foaf ontology');
  await load(path.join(__dirname, './data/foaf.ttl'), store);
  console.timeEnd('loading foaf ontology');

  console.time('loading tim berners lee profile card');
  await load(path.join(__dirname, './data/timbl.ttl'), store);
  console.timeEnd('loading tim berners lee profile card');

  console.time('Reasoning');
  new N3.Reasoner(store).reason(RDFS_RULE);
  console.timeEnd('Reasoning');
}

(async () => {
  console.log('Reasoning over TimBL profile and FOAF');
  await run();

  console.log('\nRunning Deep Taxonomy Benchmark');
  await deepTaxonomy();
})();
