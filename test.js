var N3 = require('n3');

var store = new N3.Store();
store.addTriple('a', 'b', '"c"');
store.addTriple('"a"', 'b', 'c');
console.log(store.find('"a"', null, null));
