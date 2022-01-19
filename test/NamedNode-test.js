import { NamedNode, Term } from '../src/index.js';

describe('NamedNode', () => {
  describe('The NamedNode module', () => {
    it('should be a function', () => {
      NamedNode.should.be.a('function');
    });

    it('should be a NamedNode constructor', () => {
      new NamedNode().should.be.an.instanceof(NamedNode);
    });

    it('should be a Term constructor', () => {
      new NamedNode().should.be.an.instanceof(Term);
    });
  });

  describe('A NamedNode instance created from an IRI', () => {
    let namedNode;
    before(() => { namedNode = new NamedNode('http://example.org/foo#bar'); });

    it('should be a NamedNode', () => {
      namedNode.should.be.an.instanceof(NamedNode);
    });

    it('should be a Term', () => {
      namedNode.should.be.an.instanceof(Term);
    });

    it('should have term type "NamedNode"', () => {
      namedNode.termType.should.equal('NamedNode');
    });

    it('should have the IRI as value', () => {
      namedNode.should.have.property('value', 'http://example.org/foo#bar');
    });

    it('should have the IRI as id', () => {
      namedNode.should.have.property('id', 'http://example.org/foo#bar');
    });

    it('should equal a NamedNode instance with the same IRI', () => {
      namedNode.equals(new NamedNode('http://example.org/foo#bar')).should.be.true;
    });

    it('should equal an object with the same term type and value', () => {
      namedNode.equals({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      }).should.be.true;
    });

    it('should not equal a falsy object', () => {
      namedNode.equals(null).should.be.false;
    });

    it('should not equal a NamedNode instance with another IRI', () => {
      namedNode.equals(new NamedNode('http://example.org/other')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', () => {
      namedNode.equals({
        termType: 'NamedNode',
        value: 'http://example.org/other',
      }).should.be.false;
    });

    it('should not equal an object with a different term type but the same value', () => {
      namedNode.equals({
        termType: 'BlankNode',
        value: 'http://example.org/foo#bar',
      }).should.be.false;
    });

    it('should provide a JSON representation', () => {
      namedNode.toJSON().should.deep.equal({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });
  });
});
