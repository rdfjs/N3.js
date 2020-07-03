import { Quad, Triple, DefaultGraph, termFromId } from '../src/';

describe('Quad', function () {
  describe('The Quad module', function () {
    it('should be a function', function () {
      Quad.should.be.a('function');
    });

    it('should be a Quad constructor', function () {
      new Quad().should.be.an.instanceof(Quad);
    });

    it('should equal Triple', function () {
      Quad.should.equal(Triple);
    });
  });

  describe('A Quad instance created with subject/predicate/object', function () {
    var quad, subject, predicate, object;
    before(function () {
      quad = new Quad(
        subject   = termFromId('s'),
        predicate = termFromId('p'),
        object    = termFromId('o')
      );
    });

    it('should be a Quad', function () {
      quad.should.be.an.instanceof(Quad);
    });

    it('should have the correct subject', function () {
      quad.subject.should.equal(subject);
    });

    it('should have the correct predicate', function () {
      quad.predicate.should.equal(predicate);
    });

    it('should have the correct object', function () {
      quad.object.should.equal(object);
    });

    it('should have the default graph', function () {
      quad.graph.should.equal(new DefaultGraph());
    });

    it('should equal a quad with the same components', function () {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.true;
    });

    it('should not equal a quad with a different subject', function () {
      quad.equals({
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different predicate', function () {
      quad.equals({
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different object', function () {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     new DefaultGraph(),
      }).should.be.false;
    });

    it('should not equal a quad with a different graph', function () {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      quad.toJSON().should.deep.equal({
        subject:   { termType: 'NamedNode', value: 's' },
        predicate: { termType: 'NamedNode', value: 'p' },
        object:    { termType: 'NamedNode', value: 'o' },
        graph:     { termType: 'DefaultGraph', value: '' },
      });
    });
  });

  describe('A Quad instance created with subject/predicate/object/graph', function () {
    var quad, subject, predicate, object, graph;
    before(function () {
      quad = new Quad(
        subject   = termFromId('s'),
        predicate = termFromId('p'),
        object    = termFromId('o'),
        graph     = termFromId('g')
      );
    });

    it('should be a Quad', function () {
      quad.should.be.an.instanceof(Quad);
    });

    it('should have the correct subject', function () {
      quad.subject.should.equal(subject);
    });

    it('should have the correct predicate', function () {
      quad.predicate.should.equal(predicate);
    });

    it('should have the correct object', function () {
      quad.object.should.equal(object);
    });

    it('should have the default graph', function () {
      quad.graph.should.equal(graph);
    });

    it('should equal a quad with the same components', function () {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     graph,
      }).should.be.true;
    });

    it('should not equal a quad with a different subject', function () {
      quad.equals({
        subject:   termFromId('x'),
        predicate: predicate,
        object:    object,
        graph:     graph,
      }).should.be.false;
    });

    it('should not equal a quad with a different predicate', function () {
      quad.equals({
        subject:   subject,
        predicate: termFromId('x'),
        object:    object,
        graph:     graph,
      }).should.be.false;
    });

    it('should not equal a quad with a different object', function () {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    termFromId('x'),
        graph:     graph,
      }).should.be.false;
    });

    it('should not equal a quad with a different graph', function () {
      quad.equals({
        subject:   subject,
        predicate: predicate,
        object:    object,
        graph:     termFromId('x'),
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      quad.toJSON().should.deep.equal({
        subject:   { termType: 'NamedNode', value: 's' },
        predicate: { termType: 'NamedNode', value: 'p' },
        object:    { termType: 'NamedNode', value: 'o' },
        graph:     { termType: 'NamedNode', value: 'g' },
      });
    });
  });
});
