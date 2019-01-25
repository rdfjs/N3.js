var N3Stream = require('./N3Stream');

class N3Source {
  match(subject, predicate, object, graph) {
    return new N3Stream();
  }
}

module.exports = N3Source;

