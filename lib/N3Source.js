var N3Stream = require('./N3Stream');

function N3Source() {
  if (!(this instanceof N3Source))
    return new N3Source();
}

N3Source.prototype = {
  constructor: N3Source,
  match: function (subject, predicate, object, graph) {
    return new N3Stream();
  },
};

module.exports = N3Source;

