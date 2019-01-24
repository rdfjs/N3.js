function N3Stream() {
  if (!(this instanceof N3Stream))
    return new N3Stream();
}

N3Stream.prototype.constructor = N3Stream;

module.exports = N3Stream;
