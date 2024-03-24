import { NamedNode, Term } from '../src';

describe('NamedNode', () => {
  describe('The NamedNode module', () => {
    it('should be a function', () => {
      expect(NamedNode).toBeInstanceOf(Function);
    });

    it('should be a NamedNode constructor', () => {
      expect(new NamedNode()).toBeInstanceOf(NamedNode);
    });

    it('should be a Term constructor', () => {
      expect(new NamedNode()).toBeInstanceOf(Term);
    });
  });

  describe('A NamedNode instance created from an IRI', () => {
    let namedNode;
    beforeAll(() => { namedNode = new NamedNode('http://example.org/foo#bar'); });

    it('should be a NamedNode', () => {
      expect(namedNode).toBeInstanceOf(NamedNode);
    });

    it('should be a Term', () => {
      expect(namedNode).toBeInstanceOf(Term);
    });

    it('should have term type "NamedNode"', () => {
      expect(namedNode.termType).toBe('NamedNode');
    });

    it('should have the IRI as value', () => {
      expect(namedNode).toHaveProperty('value', 'http://example.org/foo#bar');
    });

    it('should have the IRI as id', () => {
      expect(namedNode).toHaveProperty('id', 'http://example.org/foo#bar');
    });

    it('should equal a NamedNode instance with the same IRI', () => {
      expect(namedNode.equals(new NamedNode('http://example.org/foo#bar'))).toBe(true);
    });

    it('should equal an object with the same term type and value', () => {
      expect(namedNode.equals({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      })).toBe(true);
    });

    it('should not equal a falsy object', () => {
      expect(namedNode.equals(null)).toBe(false);
    });

    it('should not equal a NamedNode instance with another IRI', () => {
      expect(namedNode.equals(new NamedNode('http://example.org/other'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(namedNode.equals({
          termType: 'NamedNode',
          value: 'http://example.org/other',
        })).toBe(false);
      }
    );

    it(
      'should not equal an object with a different term type but the same value',
      () => {
        expect(namedNode.equals({
          termType: 'BlankNode',
          value: 'http://example.org/foo#bar',
        })).toBe(false);
      }
    );

    it('should provide a JSON representation', () => {
      expect(namedNode.toJSON()).toEqual({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });
  });
});
