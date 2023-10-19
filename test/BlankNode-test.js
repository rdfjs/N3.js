import { BlankNode, Term } from '../src/';

describe('BlankNode', () => {
  describe('The BlankNode module', () => {
    it('should be a function', () => {
      expect(BlankNode).toBeInstanceOf(Function);
    });

    it('should be a BlankNode constructor', () => {
      expect(new BlankNode()).toBeInstanceOf(BlankNode);
    });

    it('should be a Term constructor', () => {
      expect(new BlankNode()).toBeInstanceOf(Term);
    });
  });

  describe('A BlankNode instance created from a name', () => {
    let blankNode;
    beforeAll(() => { blankNode = new BlankNode('b1'); });

    it('should be a BlankNode', () => {
      expect(blankNode).toBeInstanceOf(BlankNode);
    });

    it('should be a Term', () => {
      expect(blankNode).toBeInstanceOf(Term);
    });

    it('should have term type "BlankNode"', () => {
      expect(blankNode.termType).toBe('BlankNode');
    });

    it('should have the name as value', () => {
      expect(blankNode).toHaveProperty('value', 'b1');
    });

    it('should have "_:name" as id', () => {
      expect(blankNode).toHaveProperty('id', '_:b1');
    });

    it('should equal a BlankNode instance with the same name', () => {
      expect(blankNode.equals(new BlankNode('b1'))).toBe(true);
    });

    it('should equal an object with the same term type and value', () => {
      expect(blankNode.equals({
        termType: 'BlankNode',
        value: 'b1',
      })).toBe(true);
    });

    it('should not equal a falsy object', () => {
      expect(blankNode.equals(null)).toBe(false);
    });

    it('should not equal a BlankNode instance with another name', () => {
      expect(blankNode.equals(new BlankNode('b2'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(blankNode.equals({
          termType: 'BlankNode',
          value: 'b2',
        })).toBe(false);
      }
    );

    it(
      'should not equal an object with a different term type but the same value',
      () => {
        expect(blankNode.equals({
          termType: 'NamedNode',
          value: 'b1',
        })).toBe(false);
      }
    );

    it('should provide a JSON representation', () => {
      expect(blankNode.toJSON()).toEqual({
        termType: 'BlankNode',
        value: 'b1',
      });
    });
  });
});
