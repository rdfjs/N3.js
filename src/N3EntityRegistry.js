// Assigns shared numeric identifiers while an entity index owns them.
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

    this._id = 1;
    this._ids = new Map([['', 1]]);
    this._entities = Object.create(null);
    this._entities[1] = '';
    this._references = Object.create(null);
    this._references[1] = Infinity;
    this._freeIds = [];
    this._pendingReleases = [];
    this._releaseScheduled = false;

    // One registration per entity index releases all of its identifiers together.
    this._finalizer = new FinalizationRegistry(ownership => this._enqueueRelease(ownership));
  }

  _createOwnership(target) {
    const ownership = [];
    this._finalizer.register(target, ownership);
    return ownership;
  }

  _lookup(value) {
    return this._ids.get(value);
  }

  _intern(value) {
    let id = this._ids.get(value);
    if (!id) {
      if (this._freeIds.length)
        id = this._freeIds.pop();
      else {
        if (this._id >= Number.MAX_SAFE_INTEGER)
          throw new RangeError('Entity identifier limit exceeded');
        id = ++this._id;
      }
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
          this._freeIds.push(id);
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
