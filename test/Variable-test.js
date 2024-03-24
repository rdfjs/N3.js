import { Variable, Term } from '../src';

describe('Variable', () => {
  describe('The Variable module', () => {
    it('should be a function', () => {
      expect(Variable).toBeInstanceOf(Function);
    });

    it('should be a Variable constructor', () => {
      expect(new Variable()).toBeInstanceOf(Variable);
    });

    it('should be a Term constructor', () => {
      expect(new Variable()).toBeInstanceOf(Term);
    });
  });

  describe('A Variable instance created from a name', () => {
    let variable;
    beforeAll(() => { variable = new Variable('v1'); });

    it('should be a Variable', () => {
      expect(variable).toBeInstanceOf(Variable);
    });

    it('should be a Term', () => {
      expect(variable).toBeInstanceOf(Term);
    });

    it('should have term type "Variable"', () => {
      expect(variable.termType).toBe('Variable');
    });

    it('should have the name as value', () => {
      expect(variable).toHaveProperty('value', 'v1');
    });

    it('should have "?name" as id value', () => {
      expect(variable).toHaveProperty('id', '?v1');
    });

    it('should equal a Variable instance with the same name', () => {
      expect(variable.equals(new Variable('v1'))).toBe(true);
    });

    it('should equal an object with the same term type and value', () => {
      expect(variable.equals({
        termType: 'Variable',
        value: 'v1',
      })).toBe(true);
    });

    it('should not equal a falsy object', () => {
      expect(variable.equals(null)).toBe(false);
    });

    it('should not equal a Variable instance with another name', () => {
      expect(variable.equals(new Variable('v2'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(variable.equals({
          termType: 'Variable',
          value: 'v2',
        })).toBe(false);
      }
    );

    it(
      'should not equal an object with a different term type but the same value',
      () => {
        expect(variable.equals({
          termType: 'NamedNode',
          value: 'v1',
        })).toBe(false);
      }
    );

    it('should provide a JSON representation', () => {
      expect(variable.toJSON()).toEqual({
        termType: 'Variable',
        value: 'v1',
      });
    });
  });
});
