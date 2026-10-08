import { NamedNode, DefaultGraph, Term, BlankNode, Literal, Variable } from '../src/N3DataFactory';

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
      },
    );

    it(
      'should not equal an object with a different term type but the same value',
      () => {
        expect(namedNode.equals({
          termType: 'BlankNode',
          value: 'http://example.org/foo#bar',
        })).toBe(false);
      },
    );

    it('should provide a JSON representation', () => {
      expect(namedNode.toJSON()).toEqual({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });
  });

  describe('A NamedNode instance created from the empty IRI', () => {
    let namedNode;
    beforeAll(() => { namedNode = new NamedNode(''); });

    it('should have the empty string as value', () => {
      expect(namedNode).toHaveProperty('value', '');
    });

    it('should not have the empty string as id', () => {
      expect(namedNode).toHaveProperty('id', '<>');
    });

    it('should equal a NamedNode instance with the empty IRI', () => {
      expect(namedNode.equals(new NamedNode(''))).toBe(true);
    });

    it('should equal an object with term type "NamedNode" and the empty value', () => {
      expect(namedNode.equals({ termType: 'NamedNode', value: '' })).toBe(true);
    });

    it('should not equal the default graph', () => {
      expect(namedNode.equals(new DefaultGraph())).toBe(false);
      expect(new DefaultGraph().equals(namedNode)).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(namedNode.toJSON()).toEqual({ termType: 'NamedNode', value: '' });
    });
  });

  describe('A NamedNode instance whose IRI starts like the id of another term', () => {
    it('should not equal a variable with the same id', () => {
      expect(new NamedNode('?x').equals(new Variable('x'))).toBe(false);
      expect(new Variable('x').equals(new NamedNode('?x'))).toBe(false);
    });

    it('should not equal a blank node with the same id', () => {
      expect(new NamedNode('_:b').equals(new BlankNode('b'))).toBe(false);
      expect(new BlankNode('b').equals(new NamedNode('_:b'))).toBe(false);
    });

    it('should not equal a literal with the same id', () => {
      expect(new NamedNode('"a"').equals(new Literal('"a"'))).toBe(false);
    });

    it('should equal a named node with the same IRI', () => {
      expect(new NamedNode('?x').equals(new NamedNode('?x'))).toBe(true);
    });
  });
});
