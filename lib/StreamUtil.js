const { Readable } = require('stream');

class IteratorReadable extends Readable {
  constructor(iterator, options = {}) {
    options.objectMode = options.objectMode === undefined ? true : options.objectMode;
    super(options);
    this._read = () => {
      const { value, done } = iterator.next();
      if (done) {
        this.push(null);
      }
      else {
        this.push(value);
      }
    };
  }
}

class ArrayReadable extends IteratorReadable {
  constructor(array, options) {
    super(array.values(), options);
  }
}

exports.ArrayReadable = ArrayReadable;
