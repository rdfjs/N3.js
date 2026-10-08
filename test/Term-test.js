import {
  termToId,
  termFromId,
} from '../src';

import {
  Term,
  NamedNode,
  BlankNode,
  Literal,
  Variable,
  DefaultGraph,
  Quad,
  escapeQuotes,
  unescapeQuotes,
} from '../src/N3DataFactory';

const DEEP_TRIPLE = new Quad(
  new Quad(
    new Quad(
      new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d'),
      ),
      new Variable('var-b'),
      new Quad(
        new BlankNode('n3-000'),
        new Variable('var-b'),
        new Literal('"abc"@en-us'),
        new NamedNode('http://ex.org/d'),
      ),
      new NamedNode('http://ex.org/d'),
    ),
    new Variable('var-b'),
    new Quad(
      new BlankNode('n3-000'),
      new Variable('var-b'),
      new Literal('"abc"@en-us'),
      new NamedNode('http://ex.org/d'),
    ),
    new NamedNode('http://ex.org/d'),
  ),
  new NamedNode('http://ex.org/b'),
  new Quad(
    new Quad(
      new BlankNode('n3-000'),
      new Variable('var-b'),
      new Literal('"abc"@en-us'),
      new NamedNode('http://ex.org/d'),
    ),
    new Variable('var-b'),
    new Quad(
      new BlankNode('n3-000'),
      new Variable('var-b'),
      new Literal('"abc"@en-us'),
      new NamedNode('http://ex.org/d'),
    ),
    new NamedNode('http://ex.org/d'),
  ),
  new NamedNode('http://ex.org/d'),
);

describe('Term', () => {
  describe('The Term module', () => {
    it('should be a function', () => {
      expect(Term).toBeInstanceOf(Function);
    });

    it('should be a Term constructor', () => {
      expect(new Term()).toBeInstanceOf(Term);
    });
  });

  describe('A Term instance', () => {
    it('has an integer hashCode', () => {
      expect(new Term().hashCode()).toBe(0);
    });
  });

  describe('termFromId', () => {
    it('should no longer parse JSON triple term IDs', () => {
      expect(termFromId('["s","p","o"]')).toEqual(new NamedNode('["s","p","o"]'));
    });

    it('should create a DefaultGraph from a falsy value', () => {
      expect(termFromId(null).toJSON()).toEqual({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a DefaultGraph from the empty string', () => {
      expect(termFromId('').toJSON()).toEqual({
        termType: 'DefaultGraph',
        value: '',
      });
    });

    it('should create a NamedNode with the empty IRI from <>', () => {
      expect(termFromId('<>').toJSON()).toEqual({
        termType: 'NamedNode',
        value: '',
      });
    });

    it('should create a NamedNode from an IRI', () => {
      expect(termFromId('http://example.org/foo#bar').toJSON()).toEqual({
        termType: 'NamedNode',
        value: 'http://example.org/foo#bar',
      });
    });

    it(
      'should create a BlankNode from a string that starts with an underscore',
      () => {
        expect(termFromId('_:b1').toJSON()).toEqual({
          termType: 'BlankNode',
          value: 'b1',
        });
      },
    );

    it(
      'should create a Variable from a string that starts with a question mark',
      () => {
        expect(termFromId('?v1').toJSON()).toEqual({
          termType: 'Variable',
          value: 'v1',
        });
      },
    );

    it(
      'should create a Literal from a string that starts with a quotation mark',
      () => {
        expect(termFromId('"abc"@en-us').toJSON()).toEqual({
          termType: 'Literal',
          value: 'abc',
          language: 'en-us',
          direction: '',
          datatype: {
            termType: 'NamedNode',
            value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
          },
        });
      },
    );

    it(
        /**/'should create a Literal from a string that starts with a quotation mark and has a direction',
        () => {
          expect(termFromId('"abc"@en-us--rtl').toJSON()).toEqual({
            termType: 'Literal',
            value: 'abc',
            language: 'en-us',
            direction: 'rtl',
            datatype: {
              termType: 'NamedNode',
              value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString',
            },
          });
        },
    );

    describe('with a custom factory', () => {
      const factory = {
        defaultGraph: function ()     { return ['d'];       },
        namedNode:    function (n)    { return ['n', n];    },
        blankNode:    function (b)    { return ['b', b];    },
        variable:     function (v)    { return ['v', v];    },
        literal:      function (l, m) { return ['l', l, m]; },
      };

      it('should create a DefaultGraph from a falsy value', () => {
        expect(termFromId(null, factory)).toEqual(['d']);
      });

      it('should create a DefaultGraph from the empty string', () => {
        expect(termFromId('', factory)).toEqual(['d']);
      });

      it('should create a NamedNode from an IRI', () => {
        expect(termFromId('http://example.org/foo#bar', factory)).toEqual(['n', 'http://example.org/foo#bar']);
      });

      it(
        'should create a BlankNode from a string that starts with an underscore',
        () => {
          expect(termFromId('_:b1', factory)).toEqual(['b', 'b1']);
        },
      );

      it(
        'should create a Variable from a string that starts with a question mark',
        () => {
          expect(termFromId('?v1', factory)).toEqual(['v', 'v1']);
        },
      );

      it('should create a Literal without language or datatype', () => {
        expect(termFromId('"abc"', factory)).toEqual(['l', 'abc', undefined]);
      });

      it('should create a Literal with a language', () => {
        expect(termFromId('"abc"@en-us', factory)).toEqual(['l', 'abc', 'en-us']);
      });

      it('should create a Literal with a language and direction', () => {
        expect(termFromId('"abc"@en-us--rtl', factory)).toEqual(['l', 'abc', { language: 'en-us', direction: 'rtl' }]);
      });

      it('should create a Literal with a datatype', () => {
        expect(termFromId('"abc"^^https://ex.org/type', factory)).toEqual(['l', 'abc', ['n', 'https://ex.org/type']]);
      });
    });
  });

  describe('termToId', () => {
    it('should throw on triple terms, which have no string ID', () => {
      expect(() => termToId(DEEP_TRIPLE)).toThrow('Triple terms have no string ID');
      expect(() => termToId(DEEP_TRIPLE.toJSON())).toThrow('Triple terms have no string ID');
    });

    it('should create the empty string a falsy value', () => {
      expect(termToId(null)).toBe('');
      expect(termToId(false)).toBe('');
      expect(termToId('')).toBe('');
    });

    it('should create the empty string from the DefaultGraph', () => {
      expect(termToId(new DefaultGraph())).toBe('');
      expect(termToId(new DefaultGraph().toJSON())).toBe('');
    });

    it('should create a distinct id from the empty IRI', () => {
      expect(termToId(new NamedNode(''))).toBe('<>');
      expect(termToId(new NamedNode('').toJSON())).toBe('<>');
    });

    it(
      'should create an id that starts with a question mark from a Variable',
      () => {
        expect(termToId(new Variable('abc'))).toBe('?abc');
        expect(termToId(new Variable('abc').toJSON())).toBe('?abc');
      },
    );

    it(
      'should create an id that starts with a question mark from a Variable string',
      () => {
        expect(termToId('?abc')).toBe('?abc');
      },
    );

    it(
      'should create an id that starts with a quotation mark from a Literal',
      () => {
        expect(termToId(new Literal('"abc"'))).toBe('"abc"');
        expect(termToId(new Literal('"abc"').toJSON())).toBe('"abc"');
      },
    );

    it(
      'should create an id that starts with a quotation mark from a Literal string',
      () => {
        expect(termToId('"abc"')).toBe('"abc"');
      },
    );

    it(
      'should create an id that starts with a quotation mark and datatype from a Literal with a datatype',
      () => {
        expect(termToId(new Literal('"abc"^^http://example.org'))).toBe('"abc"^^http://example.org');
        expect(termToId(new Literal('"abc"^^http://example.org').toJSON())).toBe('"abc"^^http://example.org');
      },
    );

    it(
      'should create an id that starts with a quotation mark and datatype from a Literal string with a datatype',
      () => {
        expect(termToId('"abc"^^http://example.org')).toBe('"abc"^^http://example.org');
      },
    );

    it(
      'should create an id that starts with a quotation mark and language tag from a Literal with a language',
      () => {
        expect(termToId(new Literal('"abc"@en-us'))).toBe('"abc"@en-us');
        expect(termToId(new Literal('"abc"@en-us').toJSON())).toBe('"abc"@en-us');
      },
    );

    it(
        'should create an id that starts with a quotation mark and language tag from a Literal with a language and direction',
        () => {
          expect(termToId(new Literal('"abc"@en-us--rtl'))).toBe('"abc"@en-us--rtl');
          expect(termToId(new Literal('"abc"@en-us--rtl').toJSON())).toBe('"abc"@en-us--rtl');
        },
    );

    it(
      'should create an id that starts with a quotation mark and language tag from a Literal string with a language',
      () => {
        expect(termToId('"abc"@en-us')).toBe('"abc"@en-us');
      },
    );

    it(
        'should create an id that starts with a quotation mark and language tag from a Literal string with a language and direction',
        () => {
          expect(termToId('"abc"@en-us--rtl')).toBe('"abc"@en-us--rtl');
        },
    );

    it(
      'should create an id that starts with a quotation mark, datatype and language tag from a Literal with a datatype and language',
      () => {
        expect(termToId(new Literal('"abc"^^http://example.org@en-us'))).toBe('"abc"^^http://example.org@en-us');
        expect(termToId(new Literal('"abc"^^http://example.org@en-us').toJSON())).toBe('"abc"^^http://example.org@en-us');
      },
    );

    it(
      'should create an id that starts with a quotation mark, datatype and language tag from a Literal string with a datatype and language',
      () => {
        expect(termToId('"abc"^^http://example.org@en-us')).toBe('"abc"^^http://example.org@en-us');
      },
    );

    it(
      'should create an id that starts with an underscore from a BlankNode',
      () => {
        expect(termToId(new BlankNode('abc'))).toBe('_:abc');
        expect(termToId(new BlankNode('abc').toJSON())).toBe('_:abc');
      },
    );

    it(
      'should create an id that starts with an underscore from a BlankNode string',
      () => {
        expect(termToId('_:abc')).toBe('_:abc');
      },
    );

    it('should create an IRI from a NamedNode', () => {
      expect(termToId(new NamedNode('http://example.org/'))).toBe('http://example.org/');
      expect(termToId(new NamedNode('http://example.org/').toJSON())).toBe('http://example.org/');
    });

    it('should create an IRI from a NamedNode string', () => {
      expect(termToId('http://example.org/')).toBe('http://example.org/');
    });

    it('should throw on an unknown type', () => {
      expect((() => { termToId({ termType: 'unknown' }); })).toThrow('Unexpected termType: unknown');
    });
  });

  describe('escaping', () => {
    it('should unescape an escaped string correctly', () => {
      const id = '"Hello ""World"""@en-us';
      expect(unescapeQuotes(id)).toBe('"Hello "World""@en-us');
    });

    it('should escape an unescaped string correctly', () => {
      const id = '"Hello "World""@en-us';
      expect(escapeQuotes(id)).toBe('"Hello ""World"""@en-us');
    });

    it('should not change an unescaped string', () => {
      const id = '"Hello "World""@en-us';
      expect(unescapeQuotes(id)).toBe(id);
    });

    it('should not change a string without quotes', () => {
      const id = '"Hello World"@en-us';
      expect(escapeQuotes(id)).toBe(id);
    });

    it('should not change a blank node', () => {
      const id = '_:b1';
      expect(escapeQuotes(id)).toBe(id);
    });

    it('should not change a variable', () => {
      const id = '?v1';
      expect(escapeQuotes(id)).toBe(id);
    });

    it('should not change the empty string', () => {
      const id = '';
      expect(escapeQuotes(id)).toBe(id);
    });
  });
});
