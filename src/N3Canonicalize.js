// **N3Canonicalize** serializes quads as canonical N-Quads with the RDFC-1.0 algorithm and SHA-256.
// See https://www.w3.org/TR/rdf-canon/
import N3Writer from './N3Writer';

// Canonicalizes the quads of the store into a sorted N-Quads string, reading its indexes directly.
// As in rdf-canonize, Hash N-Degree Quads runs at most n^`maxWorkFactor` times (n times by default) for n blank nodes
// without unique first-degree hashes, so poison graphs fail instead of running indefinitely.
export default function canonicalize(store, { hashAlgorithm = 'SHA-256', maxWorkFactor = 1 }) {
  if (hashAlgorithm !== 'SHA-256')
    throw new Error(`Unsupported canonicalization hash algorithm: ${hashAlgorithm}`);

  // Serialize each term of the entity index in canonical N-Quads once, as null for blank nodes,
  // and keep the IRIs of predicates for Hash Related Blank Node
  const writer = new N3Writer({ format: 'N-Quads' }), entities = store._entities;
  const terms = Object.create(null), iris = Object.create(null);
  function termOf(id) {
    let term = terms[id];
    if (term === undefined) {
      const entity = store._termFromId(entities[id]);
      if (entity.termType === 'Quad')
        throw new Error('RDFC-1.0 does not define the canonicalization of triple terms');
      iris[id] = entity.value;
      term = terms[id] = entity.termType === 'DefaultGraph' ? '' :
        entity.termType === 'BlankNode' ? null : writer._encodeObject(entity);
    }
    return term;
  }
  // Serializes a quad of numeric ids, labeling each blank node through the `label` function
  function serialize([subject, predicate, object, graph], label) {
    const s = terms[subject], o = terms[object], g = terms[graph];
    return `${s === null ? `_:${label(subject)}` : s} ${terms[predicate]} ${o === null ? `_:${label(object)}` : o}${
      g === '' ? '' : ` ${g === null ? `_:${label(graph)}` : g}`} .\n`;
  }

  // Yields the numeric ids of the blank nodes in the subject, object and graph of the quad with their position
  function* blankNodesOf([subject, , object, graph]) {
    if (terms[subject] === null)
      yield [subject, 's'];
    if (terms[object] === null)
      yield [object, 'o'];
    if (terms[graph] === null)
      yield [graph, 'g'];
  }

  // Read the quads from the subject indexes as numeric ids. Quads without blank nodes are written at once;
  // the others are kept, and each blank node is mapped to the quads that mention it (4.4.3 step 2).
  const lines = [], blankQuads = [], quadsOf = new Map();
  for (const graph in store._graphs) {
    const subjects = store._graphs[graph].subjects, g = termOf(graph);
    for (const subject in subjects) {
      const predicates = subjects[subject], s = termOf(subject);
      for (const predicate in predicates) {
        const p = termOf(predicate);
        if (p === null)
          throw new Error('RDFC-1.0 does not define the canonicalization of blank node predicates');
        for (const object in predicates[predicate]) {
          const o = termOf(object);
          if (s !== null && o !== null && g !== null)
            lines.push(`${s} ${p} ${o}${g === '' ? '' : ` ${g}`} .\n`);
          else {
            const quad = [subject, predicate, object, graph];
            blankQuads.push(quad);
            for (const [id] of blankNodesOf(quad)) {
              const list = quadsOf.get(id);
              if (!list)
                quadsOf.set(id, [quad]);
              else if (list[list.length - 1] !== quad)
                list.push(quad);
            }
          }
        }
      }
    }
  }

  // Hash First Degree Quads (4.6)
  const firstDegreeHashes = new Map();
  function hashFirstDegree(id) {
    let hash = firstDegreeHashes.get(id);
    if (hash === undefined) {
      function labelReference(value) {
        return value === id ? 'a' : 'z';
      }
      const lines = quadsOf.get(id).map(quad => serialize(quad, labelReference));
      firstDegreeHashes.set(id, hash = sha256(sortByCodePoint(lines).join('')));
    }
    return hash;
  }

  // Issue canonical identifiers to blank nodes with unique first-degree hashes (4.4.3 steps 3–5)
  const canonical = new IdentifierIssuer('c14n'), hashToBlankNodes = new Map();
  for (const id of quadsOf.keys()) {
    const hash = hashFirstDegree(id), list = hashToBlankNodes.get(hash);
    list ? list.push(id) : hashToBlankNodes.set(hash, [id]);
  }
  const nonUnique = [];
  let nonUniqueCount = 0;
  for (const hash of [...hashToBlankNodes.keys()].sort()) {
    const list = hashToBlankNodes.get(hash);
    if (list.length === 1)
      canonical.issue(list[0]);
    else
      nonUnique.push(list), nonUniqueCount += list.length;
  }

  // Hash Related Blank Node (4.7)
  function hashRelated(related, quad, issuer, position) {
    const id = canonical.get(related) || issuer.get(related);
    return sha256(`${position}${position === 'g' ? '' : `<${iris[quad[1]]}>`}${
      id ? `_:${id}` : hashFirstDegree(related)}`);
  }

  // Hash N-Degree Quads (4.8), with separate budgets for its runs and for the permutations of
  // two or more related blank nodes, since related blank nodes that already have identifiers need no runs
  const workError = 'Canonicalization exceeded its maximum amount of work; a higher maxWorkFactor allows more';
  let deepIterations = nonUniqueCount ** maxWorkFactor, permutationSteps = deepIterations;
  function hashNDegree(id, issuer) {
    if (deepIterations-- <= 0)
      throw new Error(workError);
    const hashToRelated = new Map();
    for (const quad of quadsOf.get(id)) {
      for (const [related, position] of blankNodesOf(quad)) {
        if (related !== id) {
          const hash = hashRelated(related, quad, issuer, position), list = hashToRelated.get(hash);
          list ? list.push(related) : hashToRelated.set(hash, [related]);
        }
      }
    }
    let data = '';
    for (const hash of [...hashToRelated.keys()].sort()) {
      data += hash;
      let chosenPath = '', chosenIssuer;
      const related = hashToRelated.get(hash);
      for (const permutation of permutations(related)) {
        if (related.length > 1 && permutationSteps-- <= 0)
          throw new Error(workError);
        const result = permutationPath(permutation, issuer.copy(), chosenPath);
        if (result && (!chosenPath || result.path < chosenPath))
          chosenPath = result.path, chosenIssuer = result.issuer;
      }
      data += chosenPath;
      issuer = chosenIssuer;
    }
    return { hash: sha256(data), issuer };
  }

  // Builds the path of one permutation of related blank nodes (4.8.3 step 5.4),
  // or returns null as soon as it cannot become smaller than the chosen path
  function permutationPath(permutation, issuer, chosenPath) {
    const recursionList = [];
    let path = '';
    function exceedsChosenPath() {
      return chosenPath && path.length >= chosenPath.length && path > chosenPath;
    }
    for (const related of permutation) {
      const canonicalId = canonical.get(related);
      if (canonicalId)
        path += `_:${canonicalId}`;
      else {
        if (!issuer.get(related))
          recursionList.push(related);
        path += `_:${issuer.issue(related)}`;
      }
      if (exceedsChosenPath())
        return null;
    }
    for (const related of recursionList) {
      const result = hashNDegree(related, issuer);
      path += `_:${issuer.issue(related)}<${result.hash}>`;
      issuer = result.issuer;
      if (exceedsChosenPath())
        return null;
    }
    return { path, issuer };
  }

  // Issue canonical identifiers to the remaining blank nodes (4.4.3 step 6).
  // Hash N-Degree Quads recurses along chains of such blank nodes, so very long chains overflow the stack.
  try {
    issueRemaining();
  }
  catch (error) {
    throw error instanceof RangeError ? new Error(workError) : error;
  }
  function issueRemaining() {
    for (const list of nonUnique) {
      const results = [];
      for (const id of list) {
        if (!canonical.get(id)) {
          const issuer = new IdentifierIssuer('b');
          issuer.issue(id);
          results.push(hashNDegree(id, issuer));
        }
      }
      results.sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
      for (const { issuer } of results)
        for (const id of issuer.ids.keys())
          canonical.issue(id);
    }
  }

  // Serialize the quads with their canonical labels (4.4.3 step 7)
  for (const quad of blankQuads)
    lines.push(serialize(quad, canonical.get.bind(canonical)));
  return sortByCodePoint(lines).join('');
}

// Sorts the strings by Unicode code point, which only differs from the faster UTF-16 order for surrogate pairs
function sortByCodePoint(strings) {
  return strings.some(string => /[\uD800-\uDFFF]/.test(string)) ? strings.sort(codePointOrder) : strings.sort();
}

// Compares strings by Unicode code point, which differs from UTF-16 order for surrogate pairs
function codePointOrder(a, b) {
  let i = 0;
  while (i < a.length && a.charCodeAt(i) === b.charCodeAt(i))
    i++;
  if (i === a.length || i === b.length)
    return a.length - b.length;
  return codePointRank(a.charCodeAt(i)) - codePointRank(b.charCodeAt(i));
}

// Moves surrogates above the other UTF-16 code units, since they encode code points above U+FFFF
function codePointRank(unit) {
  return unit >= 0xE000 ? unit - 0x800 : unit >= 0xD800 ? unit + 0x2000 : unit;
}

// Issues sequential identifiers with a prefix (4.5)
class IdentifierIssuer {
  constructor(prefix, ids = new Map()) {
    this.prefix = prefix;
    this.ids = ids;
  }

  get(id) {
    return this.ids.get(id);
  }

  issue(id) {
    let issued = this.ids.get(id);
    if (issued === undefined)
      this.ids.set(id, issued = `${this.prefix}${this.ids.size}`);
    return issued;
  }

  copy() {
    return new IdentifierIssuer(this.prefix, new Map(this.ids));
  }
}

// Yields every distinct ordering of the list in lexicographic order, reusing one array
function* permutations(list) {
  const items = list.slice().sort();
  for (;;) {
    yield items;
    let i = items.length - 2, j = items.length - 1;
    while (i >= 0 && items[i] >= items[i + 1])
      i--;
    if (i < 0)
      return;
    while (items[j] <= items[i])
      j--;
    [items[i], items[j]] = [items[j], items[i]];
    for (j = items.length - 1, i++; i < j; i++, j--)
      [items[i], items[j]] = [items[j], items[i]];
  }
}

// SHA-256 constants: the fractional parts of the square and cube roots of the first primes
const H0 = [], K = [], W = new Uint32Array(64), encoder = new TextEncoder();
for (let n = 2; K.length < 64; n++) {
  let prime = true;
  for (let d = 2; d * d <= n && prime; d++)
    prime = n % d !== 0;
  if (prime) {
    H0.length < 8 && H0.push((n ** (1 / 2) % 1) * 2 ** 32 | 0);
    K.push((n ** (1 / 3) % 1) * 2 ** 32 | 0);
  }
}

function rotate(x, n) {
  return (x >>> n) | (x << (32 - n));
}

// Returns the hexadecimal SHA-256 hash of the string's UTF-8 encoding
function sha256(string) {
  const bytes = encoder.encode(string), length = bytes.length;
  const words = new Uint32Array(((length + 72) >> 6) << 4), H = Uint32Array.from(H0);
  for (let i = 0; i < length; i++)
    words[i >> 2] |= bytes[i] << (24 - (i & 3) * 8);
  words[length >> 2] |= 0x80 << (24 - (length & 3) * 8);
  words[words.length - 2] = length / 0x20000000;
  words[words.length - 1] = length << 3;
  for (let j = 0; j < words.length; j += 16) {
    for (let t = 0; t < 64; t++) {
      W[t] = t < 16 ? words[j + t] :
        (rotate(W[t - 2], 17) ^ rotate(W[t - 2], 19) ^ (W[t - 2] >>> 10)) + W[t - 7] +
        (rotate(W[t - 15], 7) ^ rotate(W[t - 15], 18) ^ (W[t - 15] >>> 3)) + W[t - 16];
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const t1 = h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t];
      const t2 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
      h = g, g = f, f = e, e = (d + t1) | 0, d = c, c = b, b = a, a = (t1 + t2) | 0;
    }
    H[0] += a, H[1] += b, H[2] += c, H[3] += d, H[4] += e, H[5] += f, H[6] += g, H[7] += h;
  }
  let hex = '';
  for (let i = 0; i < 8; i++)
    hex += (H[i] + 0x100000000).toString(16).slice(1);
  return hex;
}
