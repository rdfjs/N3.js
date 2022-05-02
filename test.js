function* test() {
  for (let i = 0; i < 10; i++) {
    yield;
  }
}


for (const x of test()) {
  console.log(x)
}



// for (let i = 0; i < 10_000_000; i++) {
//   // m[i] = null;
// }


// const s = new Set();

// console.time('set')
// for (let i = 0; i < 10_000_000; i++) {
//   s.add(i);
// }
// console.timeEnd('set')

// const m = new Map();

// console.time('map')
// for (let i = 0; i < 10_000_000; i++) {
//   m[i] = null;
// }
// console.timeEnd('map')

// https://stackoverflow.com/questions/49841972/javascript-how-come-map-has-is-so-much-faster-than-set-has-and-array-indexof
// TODO: Raise this as an issue with v8