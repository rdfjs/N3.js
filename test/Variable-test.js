import { Variable, Term } from '../src/';

describe('Variable', () => {
  describe('The Variable module', () => {
    it('should be a function', () => {
      Variable.should.be.a('function');
    });

    it('should be a Variable constructor', () => {
      new Variable().should.be.an.instanceof(Variable);
    });

    it('should be a Term constructor', () => {
      new Variable().should.be.an.instanceof(Term);
    });
  });

  describe('A Variable instance created from a name', () => {
    var variable;
    before(() => { variable = new Variable('v1'); });

    it('should be a Variable', () => {
      variable.should.be.an.instanceof(Variable);
    });

    it('should be a Term', () => {
      variable.should.be.an.instanceof(Term);
    });

    it('should have term type "Variable"', () => {
      variable.termType.should.equal('Variable');
    });

    it('should have the name as value', () => {
      variable.should.have.property('value', 'v1');
    });

    it('should have "?name" as id value', () => {
      variable.should.have.property('id', '?v1');
    });

    it('should equal a Variable instance with the same name', () => {
      variable.equals(new Variable('v1')).should.be.true;
    });

    it('should equal an object with the same term type and value', () => {
      variable.equals({
        termType: 'Variable',
        value: 'v1',
      }).should.be.true;
    });

    it('should not equal a falsy object', () => {
      variable.equals(null).should.be.false;
    });

    it('should not equal a Variable instance with another name', () => {
      variable.equals(new Variable('v2')).should.be.false;
    });

    it('should not equal an object with the same term type but a different value', () => {
      variable.equals({
        termType: 'Variable',
        value: 'v2',
      }).should.be.false;
    });

    it('should not equal an object with a different term type but the same value', () => {
      variable.equals({
        termType: 'NamedNode',
        value: 'v1',
      }).should.be.false;
    });

    it('should provide a JSON representation', () => {
      variable.toJSON().should.deep.equal({
        termType: 'Variable',
        value: 'v1',
      });
    });
  });
});
