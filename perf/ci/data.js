// Deterministic RDF documents for the CI benchmarks.
// The text is generated directly (not through the N3.js Writer), so the input
// is identical for the base and head builds being compared.

// Small seeded PRNG (mulberry32) so every run sees the same documents
function rng(seed) {
  return function () {
    seed |= 0;
    seed += 0x6D2B79F5;
    seed |= 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    const u = t + Math.imul(t ^ t >>> 7, 61 | t);
    t ^= u;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const EX = 'http://example.org/ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

function literalNT(r, i) {
  switch (i % 6) {
  case 0: return `"${WORDS[i % 8]} ${i}"`;
  case 1: return `"${WORDS[i % 8]} label"@en`;
  case 2: return `"${i}"^^<${XSD}integer>`;
  case 3: return `"line one\\nline \\"two\\" \\u00E9 ${i}"`;
  case 4: return `"${(r() * 1000).toFixed(3)}"^^<${XSD}decimal>`;
  default: return `"${WORDS[(i + 3) % 8]}"@en-GB`;
  }
}

function objectNT(r, i) {
  const k = i % 4;
  if (k === 0) return `<${EX}o${Math.floor(r() * 1000)}>`;
  if (k === 1) return `_:b${Math.floor(r() * 500)}`;
  return literalNT(r, i);
}

// Yields the lines of ntriples(count) in chunks of up to 1000 lines,
// so large documents can be streamed without holding them in memory
function* ntriplesChunks(count) {
  const r = rng(1);
  for (let start = 0; start < count; start += 1000) {
    const lines = [];
    for (let i = start; i < Math.min(start + 1000, count); i++) {
      const s = i % 7 === 0 ? `_:b${i % 500}` : `<${EX}s${i >> 3}>`;
      lines.push(`${s} <${EX}p${i % 20}> ${objectNT(r, i)} .\n`);
    }
    yield lines.join('');
  }
}

function ntriples(count) {
  return [...ntriplesChunks(count)].join('');
}

function nquads(count) {
  const r = rng(2), lines = [];
  for (let i = 0; i < count; i++) {
    const g = i % 5 === 0 ? '' : ` <${EX}g${i % 10}>`;
    lines.push(`<${EX}s${i >> 3}> <${EX}p${i % 20}> ${objectNT(r, i)}${g} .`);
  }
  return `${lines.join('\n')}\n`;
}

function turtleObject(r, i) {
  switch (i % 9) {
  case 0: return `ex:o${Math.floor(r() * 1000)}`;
  case 1: return `"${WORDS[i % 8]} ${i}"`;
  case 2: return `"${WORDS[i % 8]}"@en`;
  case 3: return `${i}`;
  case 4: return `${(r() * 100).toFixed(2)}`;
  case 5: return i % 2 ? 'true' : 'false';
  case 6: return `[ ex:name "n${i}" ; ex:value ${i} ]`;
  case 7: return `( ex:a${i % 5} ex:b${i % 7} "c" )`;
  default: return `"""multi\nline ${i}"""`;
  }
}

function turtleBody(r, subjects, offset = 0) {
  const out = [];
  for (let s = 0; s < subjects; s++) {
    const preds = [];
    for (let p = 0; p < 4; p++) {
      const i = (s + offset) * 4 + p;
      const objs = [turtleObject(r, i)];
      if (p === 0) objs.push(turtleObject(r, i + 1));
      preds.push(`${p === 3 ? 'a' : `ex:p${i % 20}`} ${objs.join(', ')}`);
    }
    out.push(`ex:s${s + offset} ${preds.join(' ;\n    ')} .`);
  }
  return out.join('\n');
}

const PREFIXES = `@prefix ex: <${EX}> .\n@prefix xsd: <${XSD}> .\n@base <http://example.org/base/> .\n`;

function turtle(subjects) {
  return `${PREFIXES}${turtleBody(rng(3), subjects)}\n<rel/a> ex:link <../b> .\n`;
}

function trig(subjects) {
  const r = rng(4), graphs = [];
  const perGraph = Math.ceil(subjects / 10);
  for (let g = 0; g < 10; g++)
    graphs.push(`ex:g${g} {\n${turtleBody(r, perGraph, g * perGraph)}\n}`);
  return `${PREFIXES}${turtleBody(r, perGraph)}\n${graphs.join('\n')}\n`;
}

function n3(rules) {
  const r = rng(5), out = [PREFIXES];
  for (let i = 0; i < rules; i++) {
    out.push(`{ ?x ex:p${i % 20} ?y . ?y a ex:C${i % 13} } => { ?x ex:q${i % 7} ?y ; ex:r [ ex:v ${i} ] } .`);
    out.push(`ex:s${i} ex:says { ex:a${i} ex:b${i % 9} ${turtleObject(r, i)} } .`);
    out.push(`ex:s${i} ex:p${i % 20} ${turtleObject(r, i + 1)} .`);
  }
  return `${out.join('\n')}\n`;
}

function turtleStar(subjects) {
  const r = rng(6), out = [PREFIXES];
  for (let s = 0; s < subjects; s++) {
    out.push(`ex:s${s} ex:p${s % 20} ${turtleObject(r, s)} ~ ex:r${s} {| ex:src ex:d${s % 30} ; ex:conf ${s % 100} |} .`);
    out.push(`<< ex:a${s} ex:b ex:c${s % 50} >> ex:said ex:p${s % 10} .`);
  }
  return `${out.join('\n')}\n`;
}

module.exports = { ntriples, ntriplesChunks, nquads, turtle, trig, n3, turtleStar, EX };
