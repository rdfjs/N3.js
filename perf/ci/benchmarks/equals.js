// Term#equals and Quad#equals between terms created by N3.js
const { check } = require('../helpers');
const { EX } = require('../data');

// Pairs of distinct instances of each term type, so equals cannot shortcut on identity
function termPairs(N3, count) {
  const { namedNode, blankNode, literal, variable, defaultGraph } = N3.DataFactory;
  const dt = `${EX}datatype`, left = [], right = [];
  for (let i = 0; i < count; i++) {
    for (const make of [
      () => namedNode(`${EX}s${i}`),
      () => blankNode(`b${i}`),
      () => literal(`l${i}`, 'en'),
      () => literal(`${i}`, namedNode(dt)),
      () => variable(`v${i}`),
    ]) {
      left.push(make());
      right.push(make());
    }
  }
  left.push(defaultGraph());
  right.push(new N3.DefaultGraph());
  return { left, right };
}

module.exports = {
  'equals: equal terms of every type': N3 => {
    const { left, right } = termPairs(N3, 20000);
    return () => {
      let n = 0;
      for (let r = 0; r < 12; r++)
        for (let i = 0; i < left.length; i++) if (left[i].equals(right[i])) n++;
      check(n, 'nothing equal');
    };
  },
  'equals: terms with different values': N3 => {
    const { left, right } = termPairs(N3, 20000);
    return () => {
      let n = 0;
      for (let r = 0; r < 12; r++)
        for (let i = 0; i < left.length; i++) if (!left[i].equals(right[(i + 5) % right.length])) n++;
      check(n, 'everything equal');
    };
  },
  'equals: IRIs whose ids match other term types': N3 => {
    const { namedNode, blankNode, literal, variable } = N3.DataFactory;
    const iris = [], others = [];
    for (let i = 0; i < 20000; i++) {
      iris.push(namedNode(`?v${i}`), namedNode(`_:b${i}`), namedNode(`"l${i}"`));
      others.push(variable(`v${i}`), blankNode(`b${i}`), literal(`l${i}`));
    }
    return () => {
      let n = 0;
      for (let r = 0; r < 12; r++)
        for (let i = 0; i < iris.length; i++) n += iris[i].equals(others[i]) + others[i].equals(iris[i]) + 1;
      check(n, 'nothing compared');
    };
  },
  'equals: quads and triple terms': N3 => {
    const { namedNode, literal, quad } = N3.DataFactory;
    function make(i) {
      return quad(namedNode(`${EX}s${i}`), namedNode(`${EX}p`),
        i % 2 ? literal(`l${i}`, 'en') : quad(namedNode(`${EX}a${i}`), namedNode(`${EX}b`), literal(`${i}`)),
        i % 3 ? namedNode(`${EX}g`) : undefined);
    }
    const left = [], right = [];
    for (let i = 0; i < 20000; i++) {
      left.push(make(i));
      right.push(make(i));
    }
    return () => {
      let n = 0;
      for (let r = 0; r < 12; r++)
        for (let i = 0; i < left.length; i++) {
          if (left[i].equals(right[i])) n++;
          if (!left[i].equals(right[(i + 1) % right.length])) n++;
        }
      check(n, 'nothing compared');
    };
  },
};
