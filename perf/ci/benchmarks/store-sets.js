// Store set operations, each against the kinds of input it handles differently:
// - the same store
// - an N3.Store sharing the receiver's EntityIndex (index-level fast paths)
// - an N3.Store with its own EntityIndex (term-by-term paths)
// - a match() view over a store sharing the index
// - an RDF/JS dataset that is not an N3.Store
// - an array of quads, where the method accepts one
// The receiver holds 5,000 quads and the input 5,000, half of them shared.
const { check, storeOf, OtherDataset } = require('../helpers');

const SIZE = 5000;

const inputs = {
  'same store': ({ store }) => store,
  'N3 store, shared index': ({ N3, quads, entityIndex }) => new N3.Store(quads, { entityIndex }),
  'N3 store, own index': ({ N3, quads }) => new N3.Store(quads),
  'match() view': ({ N3, quads, entityIndex }) => new N3.Store(quads, { entityIndex }).match(),
  'non-N3 dataset': ({ quads }) => new OtherDataset(quads),
  'array': ({ quads }) => quads,
};

function mergesIntoExistingGraphs(N3) {
  const entityIndex = new N3.EntityIndex(), quads = storeOf(N3, 1);
  try {
    new N3.Store(quads, { entityIndex }).addAll(new N3.Store(quads, { entityIndex }));
    return true;
  }
  catch (error) {
    return false;
  }
}

function createContext(N3) {
  const entityIndex = new N3.EntityIndex();
  const own = storeOf(N3, SIZE), other = storeOf(N3, SIZE, SIZE / 2);
  return { N3, entityIndex, own, quads: other, store: new N3.Store(own, { entityIndex }) };
}

// operation(receiver, input) runs `repeat` times per measurement, so fast
// paths still take long enough to time reliably. A mutating operation
// gets a fresh receiver for every measurement.
const operations = {
  'addAll': {
    inputs: Object.keys(inputs),
    mutates: true,
    // Merging the indexes of a store sharing the EntityIndex into a graph
    // the receiver already has threw a TypeError until that was fixed
    available: {
      'same store': mergesIntoExistingGraphs,
      'N3 store, shared index': mergesIntoExistingGraphs,
      'match() view': mergesIntoExistingGraphs,
    },
    run: (store, other) => check(store.addAll(other).size >= SIZE, 'wrong size'),
  },
  'union': {
    inputs: Object.keys(inputs),
    run: (store, other) => check(store.union(other).size >= SIZE, 'wrong size'),
  },
  'intersection': {
    inputs: Object.keys(inputs).filter(i => i !== 'array'),
    run: (store, other) => check(store.intersection(other).size > 0, 'empty'),
  },
  'difference': {
    inputs: Object.keys(inputs).filter(i => i !== 'array'),
    run: (store, other) => check(store.difference(other).size < SIZE, 'wrong size'),
  },
  'contains': {
    inputs: Object.keys(inputs).filter(i => i !== 'array'),
    // Containment of a subset, which has to look at every quad of the input
    subset: true,
    run: (store, other) => check(store.contains(other), 'not contained'),
  },
  'equals': {
    inputs: Object.keys(inputs).filter(i => i !== 'array'),
    // An equal dataset, which has to look at every quad
    equal: true,
    run: (store, other) => check(store.equals(other), 'not equal'),
  },
  'new Store()': {
    inputs: ['N3 store, shared index', 'N3 store, own index', 'match() view', 'non-N3 dataset', 'array'],
    construct: true,
    run: (N3, other, entityIndex) => check(new N3.Store(other, { entityIndex }).size > 0, 'empty'),
  },
};

// Repeats for inputs whose fast paths finish in well under a millisecond,
// so that every measurement takes long enough to time reliably
const repeats = {
  'contains: same store': 20000000,
  'equals: same store': 20000000,
  'difference: same store': 300000,
  'contains: N3 store, shared index': 40,
  'contains: match() view': 40,
  'contains: N3 store, own index': 20,
  'contains: non-N3 dataset': 60,
  'equals: N3 store, shared index': 20,
  'equals: match() view': 15,
  'equals: N3 store, own index': 10,
  'equals: non-N3 dataset': 20,
  'addAll: N3 store, own index': 3,
  'addAll: non-N3 dataset': 3,
  'addAll: array': 3,
  'new Store(): array': 2,
  'intersection: N3 store, own index': 3,
  'intersection: non-N3 dataset': 3,
  'difference: N3 store, own index': 3,
  'difference: non-N3 dataset': 3,
};

function benchmark(operationName, inputName) {
  const operation = operations[operationName];
  const repeat = repeats[`${operationName}: ${inputName}`] || 1;
  const available = operation.available && operation.available[inputName];
  function setup(N3) {
    const context = createContext(N3);
    // Subset and equality checks get an input whose quads are all in the receiver
    if (operation.subset) context.quads = context.own.slice(0, SIZE / 2);
    if (operation.equal) context.quads = context.own;
    const other = inputs[inputName](context);
    if (operation.mutates) {
      return {
        before: () => Array.from({ length: repeat }, () => {
          const store = new N3.Store(context.own, { entityIndex: context.entityIndex });
          return { store, input: inputName === 'same store' ? store : other };
        }),
        run: pairs => {
          for (const { store, input } of pairs) operation.run(store, input);
        },
      };
    }
    if (operation.construct) {
      return () => {
        for (let i = 0; i < repeat; i++) operation.run(N3, other, context.entityIndex);
      };
    }
    return () => {
      for (let i = 0; i < repeat; i++) operation.run(context.store, other);
    };
  }
  return available ? { available, setup } : setup;
}

const benchmarks = {};
for (const [operationName, operation] of Object.entries(operations))
  for (const inputName of operation.inputs)
    benchmarks[`store ${operationName}: ${inputName}`] = benchmark(operationName, inputName);

function isLiteralQuad(quad) {
  return quad.object.termType === 'Literal';
}

// The same operations called on a match() view rather than on a store
function viewBenchmark(run) {
  return N3 => {
    const { store, quads, entityIndex } = createContext(N3);
    const other = new N3.Store(quads, { entityIndex });
    return () => {
      // A new view each time, so its filtered store is built in the measurement
      check(run(store.match(), other, N3), 'empty');
    };
  };
}
Object.assign(benchmarks, {
  'store view: has, size and match': viewBenchmark((view, other) => {
    let n = view.size;
    for (const q of other) if (view.has(q)) n++;
    return n + view.match(null, null, null, other.toArray()[0].graph).size;
  }),
  'store view: union, intersection and difference': viewBenchmark((view, other) =>
    view.union(other).size + view.intersection(other).size + view.difference(other).size),
  'store view: contains, equals and filter': viewBenchmark((view, other) =>
    view.contains(view) + view.equals(other) + view.filter(isLiteralQuad).size),
});

// addAll on a view, which adds to the view's own filtered store or, with
// forwarded semantics, to the underlying store; each run gets a fresh store
function viewAddAllBenchmark(matchSemantics) {
  return N3 => {
    const { own, quads, entityIndex } = createContext(N3);
    const other = new N3.Store(quads, { entityIndex });
    return {
      before: () => new N3.Store(own, { entityIndex }).match(null, null, null, null, { matchSemantics }),
      run: view => check(view.addAll(other).size >= SIZE, 'wrong size'),
    };
  };
}
benchmarks['store view: addAll'] = viewAddAllBenchmark(undefined);
benchmarks['store view: addAll, forwarded'] = viewAddAllBenchmark('forwarded');

module.exports = benchmarks;
