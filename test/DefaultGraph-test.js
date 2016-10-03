var DefaultGraph = require('../N3').DefaultGraph;

var Term = require('../N3').Term;

describe('DefaultGraph', function () {
  describe('The DefaultGraph module', function () {
    it('should be a function', function () {
      DefaultGraph.should.be.a('function');
    });

    it('should make DefaultGraph objects', function () {
      DefaultGraph().should.be.an.instanceof(DefaultGraph);
    });

    it('should make Term objects', function () {
      DefaultGraph().should.be.an.instanceof(Term);
    });

    it('should be a DefaultGraph constructor', function () {
      new DefaultGraph().should.be.an.instanceof(DefaultGraph);
    });

    it('should be a Term constructor', function () {
      new DefaultGraph().should.be.an.instanceof(Term);
    });
  });

  describe('A DefaultGraph instance', function () {
    var defaultGraph;
    before(function () { defaultGraph = new DefaultGraph(); });

    it('should be a DefaultGraph', function () {
      defaultGraph.should.be.an.instanceof(DefaultGraph);
    });

    it('should be a Term', function () {
      defaultGraph.should.be.an.instanceof(Term);
    });

    it('should have term type "DefaultGraph"', function () {
      defaultGraph.termType.should.equal('DefaultGraph');
    });

    it('should have the empty string as value', function () {
      defaultGraph.should.have.property('value', '');
    });

    it('should have the empty string as id', function () {
      defaultGraph.should.have.property('id', '');
    });

    it('should equal another DefaultGraph instance', function () {
      defaultGraph.equals(new DefaultGraph()).should.be.true;
    });

    it('should equal an object with the same term type', function () {
      defaultGraph.equals({
        termType: 'DefaultGraph',
      }).should.be.true;
    });

    it('should not equal a falsy object', function () {
      defaultGraph.equals(null).should.be.false;
    });

    it('should not equal an object with a different term type', function () {
      defaultGraph.equals({
        termType: 'Literal',
      }).should.be.false;
    });

    it('should provide a JSON representation', function () {
      defaultGraph.toJSON().should.deep.equal({
        termType: 'DefaultGraph',
        value: '',
      });
    });
  });
});
