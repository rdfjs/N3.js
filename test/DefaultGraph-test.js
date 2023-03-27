import { DefaultGraph, Term } from '../src/N3DataFactory';

describe('DefaultGraph', () => {
  describe('The DefaultGraph module', () => {
    it('should be a function', () => {
      DefaultGraph.should.be.a('function');
    });

    it('should be a DefaultGraph constructor', () => {
      new DefaultGraph().should.be.an.instanceof(DefaultGraph);
    });

    it('should be a Term constructor', () => {
      new DefaultGraph().should.be.an.instanceof(Term);
    });
  });

  describe('A DefaultGraph instance', () => {
    let defaultGraph;
    before(() => { defaultGraph = new DefaultGraph(); });

    it('should be a DefaultGraph', () => {
      defaultGraph.should.be.an.instanceof(DefaultGraph);
    });

    it('should be a Term', () => {
      defaultGraph.should.be.an.instanceof(Term);
    });

    it('should have term type "DefaultGraph"', () => {
      defaultGraph.termType.should.equal('DefaultGraph');
    });

    it('should have the empty string as value', () => {
      defaultGraph.should.have.property('value', '');
    });

    it('should have the empty string as id', () => {
      defaultGraph.should.have.property('id', '');
    });

    it('should equal another DefaultGraph instance', () => {
      defaultGraph.equals(new DefaultGraph()).should.be.true;
    });

    it('should equal an object with the same term type', () => {
      defaultGraph.equals({
        termType: 'DefaultGraph',
      }).should.be.true;
    });

    it('should not equal a falsy object', () => {
      defaultGraph.equals(null).should.be.false;
    });

    it('should not equal an object with a different term type', () => {
      defaultGraph.equals({
        termType: 'Literal',
      }).should.be.false;
    });

    it('should provide a JSON representation', () => {
      defaultGraph.toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });
  });
});
