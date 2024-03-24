import { Quad, Triple, DefaultGraph, termFromId, Term } from '../src';

describe('Quad', () => {
  describe('The Quad module', () => {
    it('should be a function', () => {
      expect(Quad).toBeInstanceOf(Function);
    });

    it('should be a Quad constructor', () => {
      expect(new Quad()).toBeInstanceOf(Quad);
    });

    it('should equal Triple', () => {
      expect(Quad).toBe(Triple);
    });
  });

  describe('A Quad instance created with subject/predicate/object', () => {
    let quad, subject, predicate, object;
    beforeAll(() => {
      quad = new Quad(
        subject   = termFromId('s'),
        predicate = termFromId('p'),
        object    = termFromId('o')
      );
    });

    it('should be a Quad', () => {
      expect(quad).toBeInstanceOf(Quad);
    });

    it('should be a Term', () => {
      expect(quad).toBeInstanceOf(Term);
    });

    it('should have the correct termType', () => {
      expect(quad.termType).toBe('Quad');
    });

    it('should have the correct subject', () => {
      expect(quad.subject).toBe(subject);
    });

    it('should have the correct predicate', () => {
      expect(quad.predicate).toBe(predicate);
    });

    it('should have the correct object', () => {
      expect(quad.object).toBe(object);
    });

    it('should have the default graph', () => {
      expect(quad.graph).toBe(new DefaultGraph());
    });

    it('should equal a quad with the same components', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      })).toBe(true);
    });

    it('should not equal a quad with a different subject', () => {
      expect(quad.equals({
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      })).toBe(false);
    });

    it('should not equal a quad with a different predicate', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     new DefaultGraph(),
      })).toBe(false);
    });

    it('should not equal a quad with a different object', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     new DefaultGraph(),
      })).toBe(false);
    });

    it('should not equal a quad with a different graph', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(quad.toJSON()).toEqual({
        termType:  'Quad',
        subject:   { termType: 'NamedNode', value: 's' },
        predicate: { termType: 'NamedNode', value: 'p' },
        object:    { termType: 'NamedNode', value: 'o' },
        graph:     { termType: 'DefaultGraph', value: '' },
      });
    });
  });

  describe('A Quad instance created with subject/predicate/object/graph', () => {
    let quad, subject, predicate, object, graph;
    beforeAll(() => {
      quad = new Quad(
        subject   = termFromId('s'),
        predicate = termFromId('p'),
        object    = termFromId('o'),
        graph     = termFromId('g')
      );
    });

    it('should be a Quad', () => {
      expect(quad).toBeInstanceOf(Quad);
    });

    it('should be a Term', () => {
      expect(quad).toBeInstanceOf(Term);
    });

    it('should have the correct termType', () => {
      expect(quad.termType).toBe('Quad');
    });

    it('should have the correct subject', () => {
      expect(quad.subject).toBe(subject);
    });

    it('should have the correct predicate', () => {
      expect(quad.predicate).toBe(predicate);
    });

    it('should have the correct object', () => {
      expect(quad.object).toBe(object);
    });

    it('should have the default graph', () => {
      expect(quad.graph).toBe(graph);
    });

    it('should equal a quad with the same components', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     graph,
      })).toBe(true);
    });

    it('should not equal a quad with a different subject', () => {
      expect(quad.equals({
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     graph,
      })).toBe(false);
    });

    it('should not equal a quad with a different predicate', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     graph,
      })).toBe(false);
    });

    it('should not equal a quad with a different object', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     graph,
      })).toBe(false);
    });

    it('should not equal a quad with a different graph', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(quad.toJSON()).toEqual({
        termType:  'Quad',
        subject:   { termType: 'NamedNode', value: 's' },
        predicate: { termType: 'NamedNode', value: 'p' },
        object:    { termType: 'NamedNode', value: 'o' },
        graph:     { termType: 'NamedNode', value: 'g' },
      });
    });
  });

  describe('A Quad instance with nested quads', () => {
    let quad, subject, predicate, object;
    beforeAll(() => {
      quad = new Quad(
        subject   = termFromId('<<_:n3-123 ?var-a ?var-b _:n3-000>>'),
        predicate = termFromId('p'),
        object    = termFromId('<<http://ex.org/a http://ex.org/b http://ex.org/c>>')
      );
    });

    it('should be a Quad', () => {
      expect(quad).toBeInstanceOf(Quad);
    });

    it('should be a Term', () => {
      expect(quad).toBeInstanceOf(Term);
    });

    it('should have the correct termType', () => {
      expect(quad.termType).toBe('Quad');
    });

    it('should have the correct subject', () => {
      expect(quad.subject).toBe(subject);
    });

    it('should have the correct predicate', () => {
      expect(quad.predicate).toBe(predicate);
    });

    it('should have the correct object', () => {
      expect(quad.object).toBe(object);
    });

    it('should have the default graph', () => {
      expect(quad.graph).toBe(new DefaultGraph());
    });

    it('should equal a quad with the same components', () => {
      expect(quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      })).toBe(true);
    });

    it('should not equal a quad with a different subject', () => {
      expect(quad.equals({
        termType: 'Quad',
        value: '',
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      })).toBe(false);
    });

    it('should not equal a quad with a different predicate', () => {
      expect(quad.equals({
        termType: 'Quad',
        value: '',
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     new DefaultGraph(),
      })).toBe(false);
    });

    it('should not equal a quad with a different object', () => {
      expect(quad.equals({
        termType: 'Quad',
        value: '',
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     new DefaultGraph(),
      })).toBe(false);
    });

    it('should not equal a quad with a different graph', () => {
      expect(quad.equals({
        termType: 'Quad',
        value: '',
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(quad.toJSON()).toEqual({
        termType:  'Quad',
        subject:   termFromId('<<_:n3-123 ?var-a ?var-b _:n3-000>>').toJSON(),
        predicate: { termType: 'NamedNode', value: 'p' },
        object:    termFromId('<<http://ex.org/a http://ex.org/b http://ex.org/c>>').toJSON(),
        graph:     { termType: 'DefaultGraph', value: '' },
      });
    });
  });
});
