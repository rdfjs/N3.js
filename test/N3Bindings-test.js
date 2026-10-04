import { Bindings, BindingsFactory, DataFactory } from '../src';

const { namedNode, literal, variable } = DataFactory;

describe('Bindings', () => {
  const [a, b, c] = [variable('a'), variable('b'), variable('c')];
  const [x, y, z] = [namedNode('urn:x'), literal('y'), namedNode('urn:z')];
  const factory = new BindingsFactory();
  const bindings = factory.bindings([[a, x], [b, y]]);

  function entries(result) {
    return [...result].map(([key, value]) => [key.value, value.value]);
  }

  it('should be of type bindings', () => {
    expect(bindings.type).toBe('bindings');
    expect(new Bindings().size).toBe(0);
    expect(factory.bindings().size).toBe(0);
  });

  it('should look up variables by term or by name', () => {
    expect(bindings.size).toBe(2);
    expect(bindings.has(a)).toBe(true);
    expect(bindings.has('b')).toBe(true);
    expect(bindings.has(c)).toBe(false);
    expect(bindings.get(a)).toBe(x);
    expect(bindings.get('b')).toBe(y);
    expect(bindings.get('c')).toBeUndefined();
  });

  it('should list keys, values and entries', () => {
    expect([...bindings.keys()].map(key => key.equals(a) || key.equals(b))).toEqual([true, true]);
    expect([...bindings.values()]).toEqual([x, y]);
    expect(entries(bindings)).toEqual([['a', 'urn:x'], ['b', 'y']]);
    const seen = [];
    bindings.forEach((value, key) => seen.push([key.value, value.value]));
    expect(seen).toEqual([['a', 'urn:x'], ['b', 'y']]);
  });

  it('should set and delete without changing the original', () => {
    expect(entries(bindings.set(c, z))).toEqual([['a', 'urn:x'], ['b', 'y'], ['c', 'urn:z']]);
    expect(entries(bindings.set('a', z))).toEqual([['a', 'urn:z'], ['b', 'y']]);
    expect(entries(bindings.delete(a))).toEqual([['b', 'y']]);
    expect(entries(bindings.delete('c'))).toEqual([['a', 'urn:x'], ['b', 'y']]);
    expect(bindings.size).toBe(2);
  });

  it('should compare with other bindings', () => {
    expect(bindings.equals(factory.bindings([[b, literal('y')], [a, namedNode('urn:x')]]))).toBe(true);
    expect(bindings.equals(factory.bindings([[a, x], [b, z]]))).toBe(false);
    expect(bindings.equals(factory.bindings([[a, x], [c, y]]))).toBe(false);
    expect(bindings.equals(factory.bindings([[a, x]]))).toBe(false);
    expect(bindings.equals(null)).toBe(false);
    expect(bindings.equals(undefined)).toBe(false);
  });

  it('should filter and map', () => {
    expect(entries(bindings.filter((value, key) => key.value === 'a'))).toEqual([['a', 'urn:x']]);
    expect(entries(bindings.map((value, key) => key.equals(b) ? z : value))).toEqual([['a', 'urn:x'], ['b', 'urn:z']]);
  });

  it('should merge compatible bindings', () => {
    expect(entries(bindings.merge(factory.bindings([[a, x], [c, z]]))))
      .toEqual([['a', 'urn:x'], ['b', 'y'], ['c', 'urn:z']]);
    expect(bindings.merge(factory.bindings([[a, z]]))).toBeUndefined();
  });

  it('should merge conflicting bindings with a merger', () => {
    const merger = jest.fn(() => literal('merged'));
    const merged = bindings.mergeWith(merger, factory.bindings([[a, z], [b, y], [c, z]]));
    expect(entries(merged)).toEqual([['a', 'merged'], ['b', 'y'], ['c', 'urn:z']]);
    expect(merger).toHaveBeenCalledTimes(1);
    expect(merger.mock.calls[0][0]).toBe(x);
    expect(merger.mock.calls[0][1]).toBe(z);
    expect(merger.mock.calls[0][2].equals(a)).toBe(true);
  });

  it('should copy bindings from another factory', () => {
    const copy = factory.fromBindings(bindings);
    expect(copy).not.toBe(bindings);
    expect(copy.equals(bindings)).toBe(true);
  });

  it('should create keys with the given data factory', () => {
    const custom = { variable: name => ({ termType: 'Variable', value: name, custom: true }) };
    const [key] = new BindingsFactory(custom).bindings([[a, x]]).keys();
    expect(key.custom).toBe(true);
  });
});
