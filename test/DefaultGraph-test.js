import { DefaultGraph, Term } from '../src/';

describe('DefaultGraph', () => {
  describe('The DefaultGraph module', () => {
    it('should be a function', () => {
      expect(DefaultGraph).toBeInstanceOf(Function);
    });

    it('should be a DefaultGraph constructor', () => {
      expect(new DefaultGraph()).toBeInstanceOf(DefaultGraph);
    });

    it('should be a Term constructor', () => {
      expect(new DefaultGraph()).toBeInstanceOf(Term);
    });
  });

  describe('A DefaultGraph instance', () => {
    let defaultGraph;
    beforeAll(() => { defaultGraph = new DefaultGraph(); });

    it('should be a DefaultGraph', () => {
      expect(defaultGraph).toBeInstanceOf(DefaultGraph);
    });

    it('should be a Term', () => {
      expect(defaultGraph).toBeInstanceOf(Term);
    });

    it('should have term type "DefaultGraph"', () => {
      expect(defaultGraph.termType).toBe('DefaultGraph');
    });

    it('should have the empty string as value', () => {
      expect(defaultGraph).toHaveProperty('value', '');
    });

    it('should have the empty string as id', () => {
      expect(defaultGraph).toHaveProperty('id', '');
    });

    it('should equal another DefaultGraph instance', () => {
      expect(defaultGraph.equals(new DefaultGraph())).toBe(true);
    });

    it('should equal an object with the same term type', () => {
      expect(defaultGraph.equals({
        termType: 'DefaultGraph',
      })).toBe(true);
    });

    it('should not equal a falsy object', () => {
      expect(defaultGraph.equals(null)).toBe(false);
    });

    it('should not equal an object with a different term type', () => {
      expect(defaultGraph.equals({
        termType: 'Literal',
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(defaultGraph.toJSON()).toEqual({
        termType: 'DefaultGraph',
        value: '',
      });
    });
  });
});
