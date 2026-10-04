describe('Store observer cleanup', () => {
  let Store, cleanup, registry;

  beforeEach(() => {
    registry = { register: jest.fn(), unregister: jest.fn() };
    jest.spyOn(global, 'FinalizationRegistry').mockImplementation(callback => {
      cleanup = callback;
      return registry;
    });
    jest.isolateModules(() => { Store = require('../src/N3Store').default; });
  });

  afterEach(() => jest.restoreAllMocks());

  it('removes finalized registrations without waiting for another store mutation', () => {
    const store = new Store({ matchSemantics: 'forwarded' });
    const first = store.match(), second = store.match();
    const holding = registry.register.mock.calls[0][1];
    cleanup(holding);
    expect(store._observers.size).toBe(1);
    expect(registry.unregister).toHaveBeenCalledWith(first._observer);
    second._detach();
    expect(store._observers).toBe(null);
    // A stale cleanup request must not disturb an empty observer set.
    cleanup(holding);
    expect(store._observers).toBe(null);
  });

  it('does not retain or access a parent that has already been collected', () => {
    const store = new Store({ matchSemantics: 'snapshot' });
    const view = store.match();
    const holding = registry.register.mock.calls[0][1];
    jest.spyOn(holding.store, 'deref').mockReturnValue(undefined);
    cleanup(holding);
    expect(registry.unregister).not.toHaveBeenCalled();
    view._detach();
    expect(registry.unregister).toHaveBeenCalledTimes(1);
  });

  it('prunes dead views during notification when finalization is delayed', () => {
    const store = new Store({ matchSemantics: 'forwarded' });
    const dead = store.match(), live = store.match();
    jest.spyOn(dead._observer, 'deref').mockReturnValue(undefined);
    store.addQuad('s', 'p', 'o');
    expect(store._observers.size).toBe(1);
    expect(live.size).toBe(1);
    expect(registry.unregister).toHaveBeenCalledWith(dead._observer);
    live._detach();
    expect(store._observers).toBe(null);
  });

  it('restores the no-observer path when notification prunes the last dead view', () => {
    const store = new Store({ matchSemantics: 'forwarded' });
    const dead = store.match();
    jest.spyOn(dead._observer, 'deref').mockReturnValue(undefined);
    store.addQuad('s', 'p', 'o');
    expect(store._observers).toBe(null);
    expect(store.size).toBe(1);
  });
});
