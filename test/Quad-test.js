import { Quad, Triple, DefaultGraph, termFromId, Term } from '../src/';

describe('Quad', () => {
  describe('The Quad module', () => {
    it('should be a function', () => {
      Quad.should.be.a('function');
    });

    it('should be a Quad constructor', () => {
      new Quad().should.be.an.instanceof(Quad);
    });

    it('should equal Triple', () => {
      Quad.should.equal(Triple);
    });
  });

  describe('A Quad instance created with subject/predicate/object', () => {
    let quad, subject, predicate, object;
    before(() => {
      quad = new Quad(
        subject   = termFromId('s'),
        predicate = termFromId('p'),
        object    = termFromId('o')
      );
    });

    it('should be a Quad', () => {
      quad.should.be.an.instanceof(Quad);
    });

    it('should be a Term', () => {
      quad.should.be.an.instanceof(Term);
    });

    it('should have the correct termType', () => {
      quad.termType.should.equal('Quad');
    });

    it('should have the correct subject', () => {
      quad.subject.should.equal(subject);
    });

    it('should have the correct predicate', () => {
      quad.predicate.should.equal(predicate);
    });

    it('should have the correct object', () => {
      quad.object.should.equal(object);
    });

    it('should have the default graph', () => {
      quad.graph.should.equal(new DefaultGraph());
    });

    it('should equal a quad with the same components', () => {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.true;
    });

    it('should not equal a quad with a different subject', () => {
      quad.equals({
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different predicate', () => {
      quad.equals({
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different object', () => {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different graph', () => {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      }).should.be.false;
    });

    it('should provide a JSON representation', () => {
      quad.toJSON().should.deep.equal({
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
    before(() => {
      quad = new Quad(
        subject   = termFromId('s'),
        predicate = termFromId('p'),
        object    = termFromId('o'),
        graph     = termFromId('g')
      );
    });

    it('should be a Quad', () => {
      quad.should.be.an.instanceof(Quad);
    });

    it('should be a Term', () => {
      quad.should.be.an.instanceof(Term);
    });

    it('should have the correct termType', () => {
      quad.termType.should.equal('Quad');
    });

    it('should have the correct subject', () => {
      quad.subject.should.equal(subject);
    });

    it('should have the correct predicate', () => {
      quad.predicate.should.equal(predicate);
    });

    it('should have the correct object', () => {
      quad.object.should.equal(object);
    });

    it('should have the default graph', () => {
      quad.graph.should.equal(graph);
    });

    it('should equal a quad with the same components', () => {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     graph,
      }).should.be.true;
    });

    it('should not equal a quad with a different subject', () => {
      quad.equals({
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     graph,
      }).should.be.false;
    });

    it('should not equal a quad with a different predicate', () => {
      quad.equals({
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     graph,
      }).should.be.false;
    });

    it('should not equal a quad with a different object', () => {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     graph,
      }).should.be.false;
    });

    it('should not equal a quad with a different graph', () => {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      }).should.be.false;
    });

    it('should provide a JSON representation', () => {
      quad.toJSON().should.deep.equal({
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
    before(() => {
      quad = new Quad(
        subject   = termFromId('<<_:n3-123 ?var-a ?var-b _:n3-000>>'),
        predicate = termFromId('p'),
        object    = termFromId('<<http://ex.org/a http://ex.org/b http://ex.org/c>>')
      );
    });

    it('should be a Quad', () => {
      quad.should.be.an.instanceof(Quad);
    });

    it('should be a Term', () => {
      quad.should.be.an.instanceof(Term);
    });

    it('should have the correct termType', () => {
      quad.termType.should.equal('Quad');
    });

    it('should have the correct subject', () => {
      quad.subject.should.equal(subject);
    });

    it('should have the correct predicate', () => {
      quad.predicate.should.equal(predicate);
    });

    it('should have the correct object', () => {
      quad.object.should.equal(object);
    });

    it('should have the default graph', () => {
      quad.graph.should.equal(new DefaultGraph());
    });

    it('should equal a quad with the same components', () => {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.true;
    });

    it('should not equal a quad with a different subject', () => {
      quad.equals({
        termType: 'Quad',
        value: '',
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different predicate', () => {
      quad.equals({
        termType: 'Quad',
        value: '',
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different object', () => {
      quad.equals({
        termType: 'Quad',
        value: '',
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different graph', () => {
      quad.equals({
        termType: 'Quad',
        value: '',
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      }).should.be.false;
    });

    it('should provide a JSON representation', () => {
      quad.toJSON().should.deep.equal({
        termType:  'Quad',
        subject:   termFromId('<<_:n3-123 ?var-a ?var-b _:n3-000>>').toJSON(),
        predicate: { termType: 'NamedNode', value: 'p' },
        object:    termFromId('<<http://ex.org/a http://ex.org/b http://ex.org/c>>').toJSON(),
        graph:     { termType: 'DefaultGraph', value: '' },
      });
    });
  });
});
