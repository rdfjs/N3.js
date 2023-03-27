import { BlankNode, Term } from '../src/N3DataFactory';

describe('BlankNode', () => {
  describe('The BlankNode module', () => {
    it('should be a function', () => {
      BlankNode.should.be.a('function');
    });

    it('should be a BlankNode constructor', () => {
      new BlankNode().should.be.an.instanceof(BlankNode);
    });

    it('should be a Term constructor', () => {
      new BlankNode().should.be.an.instanceof(Term);
    });
  });

  describe('A BlankNode instance created from a name', () => {
    let blankNode;
    before(() => { blankNode = new BlankNode('b1'); });

    it('should be a BlankNode', () => {
      blankNode.should.be.an.instanceof(BlankNode);
    });

    it('should be a Term', () => {
      blankNode.should.be.an.instanceof(Term);
    });

    it('should have term type "BlankNode"', () => {
      blankNode.termType.should.equal('BlankNode');
    });

    it('should have the name as value', () => {
      blankNode.should.have.property('value', 'b1');
    });

    it('should have "_:name" as id', () => {
      blankNode.should.have.property('id', '_:b1');
    });

    it('should equal a BlankNode instance with the same name', () => {
      blankNode.equals(new BlankNode('b1')).should.be.true;
    });

    it('should equal an object with the same term type and value', () => {
      blankNode.equals({
        termType: 'BlankNode',
        value: 'b1',
      }).should.be.true;
    });

    it('should not equal a falsy object', () => {
      blankNode.equals(null).should.be.false;
    });

    it('should not equal a BlankNode instance with another name', () => {
      blankNode.equals(new BlankNode('b2')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', () => {
      blankNode.equals({
        termType: 'BlankNode',
        value: 'b2',
      }).should.be.false;
    });

    it('should not equal an object with a different term type but the same value', () => {
      blankNode.equals({
        termType: 'NamedNode',
        value: 'b1',
      }).should.be.false;
    });

    it('should provide a JSON representation', () => {
      blankNode.toJSON().should.deep.equal({
        termType: 'BlankNode',
        value: 'b1',
      });
    });
  });
});
