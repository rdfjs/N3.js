var BlankNode = require('../N3').BlankNode;

var Term = require('../N3').Term;

describe('BlankNode', function () {
  describe('The BlankNode module', function () {
    it('should be a function', function () {
      BlankNode.should.be.a('function');
    });

    it('should make BlankNode objects', function () {
      BlankNode().should.be.an.instanceof(BlankNode);
    });

    it('should make Term objects', function () {
      BlankNode().should.be.an.instanceof(Term);
    });

    it('should be a BlankNode constructor', function () {
      new BlankNode().should.be.an.instanceof(BlankNode);
    });

    it('should be a Term constructor', function () {
      new BlankNode().should.be.an.instanceof(Term);
    });
  });

  describe('A BlankNode instance created from a name', function () {
    var blankNode;
    before(function () { blankNode = new BlankNode('b1'); });

    it('should be a BlankNode', function () {
      blankNode.should.be.an.instanceof(BlankNode);
    });

    it('should be a Term', function () {
      blankNode.should.be.an.instanceof(Term);
    });

    it('should have term type "BlankNode"', function () {
      blankNode.termType.should.equal('BlankNode');
    });

    it('should have the name as value', function () {
      blankNode.should.have.property('value', 'b1');
    });

    it('should have "_:name" as id', function () {
      blankNode.should.have.property('id', '_:b1');
    });

    it('should equal a BlankNode instance with the same name', function () {
      blankNode.equals(new BlankNode('b1')).should.be.true;
    });

    it('should equal an object with the same term type and value', function () {
      blankNode.equals({
        termType: 'BlankNode',
        value: 'b1',
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      blankNode.equals(null).should.be.false;
    });

    it('should not equal a BlankNode instance with another name', function () {
      blankNode.equals(new BlankNode('b2')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', function () {
      blankNode.equals({
        termType: 'BlankNode',
        value: 'b2',
      }).should.be.false;
    });

    it('should not equal an object with a different term type but the same value', function () {
      blankNode.equals({
        termType: 'NamedNode',
        value: 'b1',
      }).should.be.false;
    });
  });
});
