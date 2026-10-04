// **N3Bindings** implements the RDF/JS query spec's immutable Bindings and BindingsFactory.
// https://rdf.js.org/query-spec/#bindings-interface
import N3DataFactory from './N3DataFactory';

// Accepts a variable term or its name, without a `?` prefix
function nameOf(key) {
  return typeof key === 'string' ? key : key.value;
}

export class Bindings {
  // `entries` maps variable names to terms and is owned by the new instance
  constructor(entries = new Map(), factory = N3DataFactory) {
    this._entries = entries;
    this._factory = factory;
  }

  get size() {
    return this._entries.size;
  }

  has(key) {
    return this._entries.has(nameOf(key));
  }

  get(key) {
    return this._entries.get(nameOf(key));
  }

  set(key, value) {
    return this._with(new Map(this._entries).set(nameOf(key), value));
  }

  delete(key) {
    const entries = new Map(this._entries);
    entries.delete(nameOf(key));
    return this._with(entries);
  }

  *keys() {
    for (const name of this._entries.keys())
      yield this._factory.variable(name);
  }

  values() {
    return this._entries.values();
  }

  forEach(fn) {
    for (const [name, value] of this._entries)
      fn(value, this._factory.variable(name));
  }

  *[Symbol.iterator]() {
    for (const [name, value] of this._entries)
      yield [this._factory.variable(name), value];
  }

  equals(other) {
    if (!other || other.size !== this.size)
      return false;
    for (const [name, value] of this._entries) {
      const otherValue = other.get(name);
      if (!otherValue || !value.equals(otherValue))
        return false;
    }
    return true;
  }

  filter(fn) {
    const entries = new Map();
    for (const [name, value] of this._entries)
      if (fn(value, this._factory.variable(name)))
        entries.set(name, value);
    return this._with(entries);
  }

  map(fn) {
    const entries = new Map();
    for (const [name, value] of this._entries)
      entries.set(name, fn(value, this._factory.variable(name)));
    return this._with(entries);
  }

  merge(other) {
    const entries = new Map(this._entries);
    for (const [variable, value] of other) {
      const existing = entries.get(variable.value);
      if (existing && !existing.equals(value))
        return undefined;
      entries.set(variable.value, value);
    }
    return this._with(entries);
  }

  mergeWith(merger, other) {
    const entries = new Map(this._entries);
    for (const [variable, value] of other) {
      const existing = entries.get(variable.value);
      entries.set(variable.value, existing && !existing.equals(value) ? merger(existing, value, variable) : value);
    }
    return this._with(entries);
  }

  _with(entries) {
    return new Bindings(entries, this._factory);
  }
}

// Shared by all instances, so creating bindings stays cheap
Bindings.prototype.type = 'bindings';

export class BindingsFactory {
  // `factory` creates the variable terms that keys are returned as
  constructor(factory = N3DataFactory) {
    this._factory = factory;
  }

  bindings(entries) {
    return new Bindings(new Map((entries || []).map(([variable, value]) => [variable.value, value])), this._factory);
  }

  fromBindings(bindings) {
    return this.bindings([...bindings]);
  }
}
