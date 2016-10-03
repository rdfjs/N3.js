var NamedNode = require('../N3').NamedNode;

var Term = require('../N3').Term;

describe('NamedNode', function () {
  describe('The NamedNode module', function () {
    it('should be a function', function () {
      NamedNode.should.be.a('function');
    });

    it('should make NamedNode objects', function () {
      NamedNode().should.be.an.instanceof(NamedNode);
    });

    it('should make Term objects', function () {
      NamedNode().should.be.an.instanceof(Term);
    });

    it('should be a NamedNode constructor', function () {
      new NamedNode().should.be.an.instanceof(NamedNode);
    });

    it('should be a Term constructor', function () {
      new NamedNode().should.be.an.instanceof(Term);
    });
  });

  describe('A NamedNode instance created from an IRI', function () {
    var namedNode;
    before(function () { namedNode = new NamedNode('http://example.org/foo#bar'); });

    it('should be a NamedNode', function () {
      namedNode.should.be.an.instanceof(NamedNode);
    });

    it('should be a Term', function () {
      namedNode.should.be.an.instanceof(Term);
    });

    it('should have term type "NamedNode"', function () {
      namedNode.termType.should.equal('NamedNode');
    });

    it('should have the IRI as value', function () {
      namedNode.should.have.property('value', 'http://example.org/foo#bar');
    });

    it('should have the IRI as id', function () {
      namedNode.should.have.property('id', 'http://example.org/foo#bar');
    });

    it('should equal a NamedNode instance with the same IRI', function () {
      namedNode.equals(new NamedNode('http://example.org/foo#bar')).should.be.true;
    });

    it('should equal an object with the same term type and value', function () {
      namedNode.equals({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      namedNode.equals(null).should.be.false;
    });

    it('should not equal a NamedNode instance with another IRI', function () {
      namedNode.equals(new NamedNode('http://example.org/other')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      namedNode.equals({
        termType: 'NamedNode',
        value: 'http://example.org/other',
      }).should.be.false;
    });

    it('should not equal an object with a different term type but the same value', function () {
      namedNode.equals({
        termType: 'BlankNode',
        value: 'http://example.org/foo#bar',
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      namedNode.toJSON().should.deep.equal({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });
  });
});
