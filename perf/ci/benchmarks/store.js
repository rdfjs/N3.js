// Store: adding, removing, querying and views
const { Readable } = require('stream');
const { EX } = require('../data');
const { check, storeOf } = require('../helpers');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

// Terms used to query a store built from storeOf
function patterns(N3) {
  const { namedNode } = N3.DataFactory;
  const s = [], p = [], o = [], g = [];
  for (let i = 0; i < 1000; i++) s.push(namedNode(`${EX}s${i}`));
  for (let i = 0; i < 20; i++) p.push(namedNode(`${EX}p${i}`));
  for (let i = 0; i < 15000; i += 3) o.push(namedNode(`${EX}o${i + 1}`));
  for (let i = 0; i < 4; i++) g.push(namedNode(`${EX}g${i}`));
  return { s, p, o, g };
}

function ended(stream) {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

// A view's semantics decide how it reacts when the store changes later
function viewBench(matchSemantics) {
  return N3 => {
    const quads = storeOf(N3, 5000);
    const { p } = patterns(N3);
    return {
      before: () => new N3.Store(quads),
      run: store => {
        let n = 0;
        const views = p.map(predicate => store.match(null, predicate, null, null, { matchSemantics }));
        for (const view of views) {
          n += view.size;
          for (const q of view) if (view.has(q)) n++;
        }
        // Mutations notify the non-lazy views
        for (let i = 0; i < 500; i++) store.removeQuad(quads[i]);
        for (const view of views) n += view.size;
        check(n, 'nothing matched');
      },
    };
  };
}

module.exports = {
  'store: addQuad': N3 => {
    const quads = storeOf(N3, 15000);
    return () => {
      const store = new N3.Store();
      for (const q of quads) store.addQuad(q);
      check(store.size === quads.length, 'wrong size');
    };
  },
  'store: addQuad (strings)': N3 => () => {
    const store = new N3.Store();
    for (let i = 0; i < 40; i++)
      for (let j = 0; j < 40; j++)
        for (let k = 0; k < 40; k++)
          store.addQuad(`${EX}${i}`, `${EX}${j}`, `${EX}${k}`);
    check(store.size === 64000, 'wrong size');
  },
  'store: add, has and delete': N3 => {
    const quads = storeOf(N3, 15000);
    return () => {
      const store = new N3.Store();
      for (const q of quads) store.add(q);
      let n = 0;
      for (const q of quads) if (store.has(q)) n++;
      for (let i = 0; i < quads.length; i += 2) store.delete(quads[i]);
      check(n === quads.length && store.size === quads.length / 2, 'wrong size');
    };
  },
  'store: addQuads and removeQuads': N3 => {
    const quads = storeOf(N3, 15000);
    return () => {
      const store = new N3.Store();
      store.addQuads(quads);
      store.removeQuads(quads.slice(0, 7500));
      check(store.size === 7500, 'wrong size');
    };
  },
  'store: removeQuad': N3 => {
    const quads = storeOf(N3, 20000);
    return {
      before: () => new N3.Store(quads),
      run: store => {
        for (const q of quads) store.removeQuad(q);
        check(store.size === 0, 'not empty');
      },
    };
  },
  'store: removeMatches, deleteMatches and deleteGraph': N3 => {
    const quads = storeOf(N3, 15000);
    const { s, p, g } = patterns(N3);
    return {
      before: () => new N3.Store(quads),
      run: async store => {
        for (let i = 0; i < 200; i++) await ended(store.removeMatches(s[i], null, null, null));
        for (let i = 0; i < 5; i++) store.deleteMatches(null, p[i], null, null);
        await ended(store.deleteGraph(g[0]));
        check(store.size > 0 && store.size < quads.length, 'wrong size');
      },
    };
  },
  'store: import and remove streams': N3 => {
    const quads = storeOf(N3, 15000);
    return async () => {
      const store = new N3.Store();
      await ended(store.import(Readable.from(quads)));
      await ended(store.remove(Readable.from(quads.slice(0, 7500))));
      check(store.size === 7500, 'wrong size');
    };
  },
  'store: getQuads by subject/predicate/object': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { s, p, o } = patterns(N3);
    return () => {
      let n = 0;
      for (const x of s) n += store.getQuads(x, null, null, null).length;
      for (const x of p) n += store.getQuads(null, x, null, null).length;
      for (const x of o) n += store.getQuads(null, null, x, null).length;
      for (let i = 0; i < 1000; i++) n += store.getQuads(s[i], p[i % 20], null, null).length;
      check(n, 'nothing found');
    };
  },
  'store: getQuads by graph and readQuads': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { s, g } = patterns(N3);
    return () => {
      let n = 0;
      for (const x of g) n += store.getQuads(null, null, null, x).length;
      for (let i = 0; i < 1000; i++) n += store.getQuads(s[i], null, null, g[i % 4]).length;
      for (const x of s) for (const q of store.readQuads(x, null, null, null)) if (q) n++;
      check(n, 'nothing found');
    };
  },
  'store: countQuads and has': N3 => {
    const quads = storeOf(N3, 15000);
    const store = new N3.Store(quads);
    return () => {
      let n = 0;
      for (let i = 0; i < quads.length; i++) if (store.has(quads[i])) n++;
      for (let i = 0; i < 5000; i++) n += store.countQuads(quads[i].subject, null, null, null);
      for (let i = 0; i < 5000; i++) n += store.countQuads(null, null, quads[i].object, null);
      check(n, 'nothing found');
    };
  },
  'store: match and iterate': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { p } = patterns(N3);
    return () => {
      let n = 0;
      for (const q of store) if (q) n++;
      for (const x of p)
        for (const q of store.match(null, x, null, null)) if (q) n++;
      check(n, 'nothing found');
    };
  },
  'store: match() view, lazy': viewBench('lazy'),
  'store: match() view, snapshot': viewBench('snapshot'),
  'store: match() view, forwarded': viewBench('forwarded'),
  'store: match() view read as a stream': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { p } = patterns(N3);
    return async () => {
      let n = 0;
      function count() { n++; }
      for (const x of p) {
        const view = store.match(null, x, null, null);
        view.on('data', count);
        await ended(view);
      }
      check(n, 'nothing found');
    };
  },
  'store: forEach, every and some': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { s } = patterns(N3);
    return () => {
      let n = 0;
      function count() { n++; }
      store.forEach(count);
      if (store.every(q => q.subject.termType === 'NamedNode')) n++;
      if (store.some(q => q.object.termType === 'BlankNode')) n++;
      for (let i = 0; i < 500; i++) {
        store.forEach(count, s[i], null, null, null);
        if (store.every(() => true, s[i], null, null, null)) n++;
        if (store.some(() => false, s[i], null, null, null)) n++;
      }
      check(n, 'nothing found');
    };
  },
  'store: getSubjects, getPredicates, getObjects and getGraphs': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { s, p, g } = patterns(N3);
    return () => {
      let n = 0;
      for (let r = 0; r < 2; r++) for (const x of p) n += store.getSubjects(x, null, null).length;
      for (let i = 0; i < 300; i++) n += store.getPredicates(s[i], null, null).length;
      for (let i = 0; i < 300; i++) n += store.getObjects(s[i], null, null).length;
      for (const x of g) n += store.getSubjects(null, null, x).length;
      n += store.getGraphs().length + store.getObjects(null, null, null).length;
      for (let i = 0; i < 300; i++) n += store.getGraphs(s[i], null, null).length;
      check(n, 'nothing found');
    };
  },
  'store: forSubjects, forPredicates, forObjects and forGraphs': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { s, p } = patterns(N3);
    return () => {
      let n = 0;
      function count() { n++; }
      for (let r = 0; r < 3; r++) {
        for (const x of p) store.forSubjects(count, x, null, null);
        for (let i = 0; i < 300; i++) store.forPredicates(count, s[i], null, null);
        for (let i = 0; i < 300; i++) store.forObjects(count, s[i], null, null);
        store.forObjects(count, null, null, null);
        for (let i = 0; i < 300; i++) store.forGraphs(count, s[i], null, null);
      }
      check(n, 'nothing found');
    };
  },
  'store: size after changes': N3 => {
    const quads = storeOf(N3, 15000);
    return {
      before: () => new N3.Store(quads),
      run: store => {
        let n = 0;
        for (let i = 0; i < quads.length; i++) {
          // Removing invalidates the cached size, so it is counted again
          store.removeQuad(quads[i]);
          n += store.size;
        }
        check(n, 'empty');
      },
    };
  },
  'store: filter, map and reduce': N3 => {
    const store = new N3.Store(storeOf(N3, 15000));
    const { namedNode, quad } = N3.DataFactory;
    const p = namedNode(`${EX}mapped`);
    return () => {
      const filtered = store.filter(q => q.object.termType === 'Literal');
      const mapped = store.map(q => quad(q.subject, p, q.object, q.graph));
      const total = store.reduce((sum, q) => sum + q.object.value.length, 0);
      check(filtered.size && mapped.size && total, 'nothing found');
    };
  },
  'store: toArray, toString and toStream': N3 => {
    const store = new N3.Store(storeOf(N3, 8000));
    return async () => {
      let n = store.toArray().length + store.toString().length;
      const stream = store.toStream();
      stream.on('data', () => { n++; });
      await ended(stream);
      check(n, 'nothing found');
    };
  },
  'store: createBlankNode': N3 => () => {
    const store = new N3.Store();
    let n = 0;
    for (let i = 0; i < 20000; i++) n += store.createBlankNode(i % 2 ? `b${i % 1000}` : undefined).value.length;
    check(n, 'nothing created');
  },
  'store: extractLists': N3 => {
    const { namedNode, literal, blankNode, quad } = N3.DataFactory;
    const first = namedNode(`${RDF}first`), rest = namedNode(`${RDF}rest`), nil = namedNode(`${RDF}nil`);
    const quads = [];
    for (let l = 0; l < 2000; l++) {
      quads.push(quad(namedNode(`${EX}s${l}`), namedNode(`${EX}list`), blankNode(`l${l}_0`)));
      for (let i = 0; i < 5; i++) {
        quads.push(quad(blankNode(`l${l}_${i}`), first, literal(`item ${i}`)));
        quads.push(quad(blankNode(`l${l}_${i}`), rest, i < 4 ? blankNode(`l${l}_${i + 1}`) : nil));
      }
    }
    return {
      before: () => new N3.Store(quads),
      run: store => {
        check(Object.keys(store.extractLists({ remove: true })).length === 2000, 'wrong lists');
      },
    };
  },
  'store: triple terms (RDF 1.2)': N3 => {
    const { namedNode, literal, quad } = N3.DataFactory;
    const quads = [];
    for (let i = 0; i < 5000; i++) {
      const inner = quad(namedNode(`${EX}a${i % 500}`), namedNode(`${EX}b`), literal(`c${i}`));
      quads.push(quad(namedNode(`${EX}r${i}`), namedNode(`${RDF}reifies`), inner));
    }
    return () => {
      const store = new N3.Store(quads);
      let n = 0;
      for (let i = 0; i < 5000; i += 5) n += store.getQuads(null, null, quads[i].object, null).length;
      for (const q of store.match(null, quads[0].predicate, null, null)) if (q.object.termType === 'Quad') n++;
      check(n, 'nothing found');
    };
  },
  'store: stores sharing an EntityIndex': N3 => {
    const quads = storeOf(N3, 2000);
    return () => {
      const entityIndex = new N3.EntityIndex();
      let n = 0;
      for (let i = 0; i < 10; i++) n += new N3.Store(quads, { entityIndex }).size;
      check(n === 20000, 'wrong size');
    };
  },
  'store: StoreFactory dataset': N3 => {
    const quads = storeOf(N3, 15000);
    return () => {
      check(new N3.StoreFactory().dataset(quads).size === quads.length, 'wrong size');
    };
  },
};
