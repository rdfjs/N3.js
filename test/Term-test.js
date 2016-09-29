var Term = require('../N3').Term;

describe('Term', function () {
  describe('The Term module', function () {
    it('should be a function', function () {
      Term.should.be.a('function');
    });

    it('should make Term objects', function () {
      Term().should.be.an.instanceof(Term);
    });

    it('should be a Term constructor', function () {
      new Term().should.be.an.instanceof(Term);
    });
  });
});
