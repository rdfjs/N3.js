// Assigns shared numeric identifiers while an entity scope owns them.
// Bound finalizer cleanup so large stores do not monopolize the event loop.
const RELEASE_BATCH_SIZE = 4096;

function scheduleTask(callback) {
  /* istanbul ignore else */
  if (typeof setImmediate === 'function')
    return setImmediate(callback);
  /* istanbul ignore next */
  return setTimeout(callback, 0);
}

export default class N3EntityRegistry {
  constructor() {
    if (typeof FinalizationRegistry !== 'function')
      throw new Error('EntityRegistry requires FinalizationRegistry support');

    this._maxId = Number.MAX_SAFE_INTEGER;
    this._pendingReleases = [];
    this._releaseScheduled = false;
    this._activeScopes = 0;
    this._reset();

    // One registration per entity scope releases all of its identifiers together.
    this._finalizer = new FinalizationRegistry(ownership => this._releaseScope(ownership));
  }

  _reset() {
    this._id = 1;
    this._ids = new Map([['', 1]]);
    this._entities = Object.create(null);
    this._entities[1] = '';
    this._references = Object.create(null);
    this._references[1] = Infinity;
    this._wrapped = false;
    this._pendingReleases.length = 0;
  }

  _createOwnership(target) {
    const ownership = [];
    this._finalizer.register(target, ownership);
    this._activeScopes++;
    return ownership;
  }

  _lookup(value) {
    return this._ids.get(value);
  }

  _nextId() {
    if (!this._wrapped && this._id < this._maxId)
      return ++this._id;

    this._wrapped = true;
    const first = this._id >= this._maxId ? 2 : this._id + 1;
    let id = first;
    do {
      if (!(id in this._references))
        return this._id = id;
      id = id >= this._maxId ? 2 : id + 1;
    }
    while (id !== first);
    throw new RangeError('Entity identifier limit exceeded');
  }

  _intern(value) {
    let id = this._ids.get(value);
    if (!id) {
      id = this._nextId();
      this._ids.set(value, id);
      this._entities[id] = value;
      this._references[id] = 0;
    }
    return id;
  }

  _retain(id, ownership) {
    ownership.push(id);
    this._references[id]++;
  }

  _releaseScope(ownership) {
    if (--this._activeScopes === 0)
      this._reset();
    else
      this._enqueueRelease(ownership);
  }

  _enqueueRelease(ownership) {
    this._pendingReleases.push(ownership);
    if (!this._releaseScheduled)
      this._scheduleRelease();
  }

  _scheduleRelease() {
    this._releaseScheduled = true;
    const task = scheduleTask(() => this._drainReleases());
    // Do not keep Node.js processes alive solely to clean an unreachable store.
    /* istanbul ignore next */
    task.unref?.();
  }

  _drainReleases() {
    this._releaseScheduled = false;
    let remaining = RELEASE_BATCH_SIZE;

    while (remaining > 0 && this._pendingReleases.length) {
      const ownership = this._pendingReleases[this._pendingReleases.length - 1];
      while (remaining > 0 && ownership.length) {
        const id = ownership.pop();
        remaining--;

        if (--this._references[id] === 0) {
          this._ids.delete(this._entities[id]);
          delete this._entities[id];
          delete this._references[id];
        }
      }
      if (!ownership.length)
        this._pendingReleases.pop();
    }

    if (this._pendingReleases.length)
      this._scheduleRelease();
  }
}

// Align identifiers between all stores from this module instance.
export const entityRegistry = new N3EntityRegistry();
