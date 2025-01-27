import { Literal, NamedNode, Term } from '../src';

describe('Literal', () => {
  describe('The Literal module', () => {
    it('should be a function', () => {
      expect(Literal).toBeInstanceOf(Function);
    });

    it('should be a Literal constructor', () => {
      expect(new Literal()).toBeInstanceOf(Literal);
    });

    it('should be a Term constructor', () => {
      expect(new Literal()).toBeInstanceOf(Term);
    });
  });

  describe('A Literal instance created from the empty string without language or datatype', () => {
    let literal;
    beforeAll(() => { literal = new Literal('""'); });

    it('should be a Literal', () => {
      expect(literal).toBeInstanceOf(Literal);
    });

    it('should be a Term', () => {
      expect(literal).toBeInstanceOf(Term);
    });

    it('should have term type "Literal"', () => {
      expect(literal.termType).toBe('Literal');
    });

    it('should have the empty string as value', () => {
      expect(literal).toHaveProperty('value', '');
    });

    it('should have the empty string as language', () => {
      expect(literal).toHaveProperty('language', '');
    });

    it('should have the empty string as direction', () => {
      expect(literal).toHaveProperty('direction', '');
    });

    it('should have xsd:string as datatype', () => {
      expect(literal).toHaveProperty('datatype');
      expect(literal.datatype).toBeInstanceOf(NamedNode);
      expect(literal.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should have the quoted empty string as id', () => {
      expect(literal).toHaveProperty('id', '""');
    });

    it('should equal a Literal instance with the same value', () => {
      expect(literal.equals(new Literal('""'))).toBe(true);
    });

    it(
      'should equal an object with the same term type, value, language, and datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: '',
          datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
        })).toBe(true);
      },
    );

    it('should not equal a falsy object', () => {
      expect(literal.equals(null)).toBe(false);
    });

    it('should not equal a Literal instance with a non-empty value', () => {
      expect(literal.equals(new Literal('"x"'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'x',
          language: '',
          datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different language',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: 'en',
          datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: '',
          datatype: { value: 'other', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it('should not equal an object with a different term type', () => {
      expect(literal.equals({
        termType: 'NamedNode',
        value: '',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(literal.toJSON()).toEqual({
        termType: 'Literal',
        value: '',
        language: '',
        direction: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/2001/XMLSchema#string',
        },
      });
    });
  });

  describe('A Literal instance created from a string without language or datatype', () => {
    let literal;
    beforeAll(() => { literal = new Literal('"my @^^ string"'); });

    it('should be a Literal', () => {
      expect(literal).toBeInstanceOf(Literal);
    });

    it('should be a Term', () => {
      expect(literal).toBeInstanceOf(Term);
    });

    it('should have term type "Literal"', () => {
      expect(literal.termType).toBe('Literal');
    });

    it('should have the text value as value', () => {
      expect(literal).toHaveProperty('value', 'my @^^ string');
    });

    it('should have the empty string as language', () => {
      expect(literal).toHaveProperty('language', '');
    });

    it('should have xsd:string as datatype', () => {
      expect(literal).toHaveProperty('datatype');
      expect(literal.datatype).toBeInstanceOf(NamedNode);
      expect(literal.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should have the quoted string as id', () => {
      expect(literal).toHaveProperty('id', '"my @^^ string"');
    });

    it('should equal a Literal instance with the same value', () => {
      expect(literal.equals(new Literal('"my @^^ string"'))).toBe(true);
    });

    it(
      'should equal an object with the same term type, value, language, and datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: '',
          datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
        })).toBe(true);
      },
    );

    it('should not equal a falsy object', () => {
      expect(literal.equals(null)).toBe(false);
    });

    it('should not equal a Literal instance with another value', () => {
      expect(literal.equals(new Literal('"other string"'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'other string',
          language: '',
          datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different language',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: 'en',
          datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: '',
          datatype: { value: 'other', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it('should not equal an object with a different term type', () => {
      expect(literal.equals({
        termType: 'NamedNode',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'http://www.w3.org/2001/XMLSchema#string', termType: 'NamedNode' },
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(literal.toJSON()).toEqual({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        direction: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/2001/XMLSchema#string',
        },
      });
    });
  });

  describe('A Literal instance created from the empty string with a language', () => {
    let literal;
    beforeAll(() => { literal = new Literal('""@en-us'); });

    it('should be a Literal', () => {
      expect(literal).toBeInstanceOf(Literal);
    });

    it('should be a Term', () => {
      expect(literal).toBeInstanceOf(Term);
    });

    it('should have term type "Literal"', () => {
      expect(literal.termType).toBe('Literal');
    });

    it('should have the empty string as value', () => {
      expect(literal).toHaveProperty('value', '');
    });

    it('should have the language tag as language', () => {
      expect(literal).toHaveProperty('language', 'en-us');
    });

    it('should have the empty string as direction', () => {
      expect(literal).toHaveProperty('direction', '');
    });

    it('should have rdf:langString as datatype', () => {
      expect(literal).toHaveProperty('datatype');
      expect(literal.datatype).toBeInstanceOf(NamedNode);
      expect(literal.datatype.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    });

    it('should have the quoted empty string as id', () => {
      expect(literal).toHaveProperty('id', '""@en-us');
    });

    it('should equal a Literal instance with the same value', () => {
      expect(literal.equals(new Literal('""@en-us'))).toBe(true);
    });

    it(
      'should equal an object with the same term type, value, language, and datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: 'en-us',
          datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
        })).toBe(true);
      },
    );

    it('should not equal a falsy object', () => {
      expect(literal.equals(null)).toBe(false);
    });

    it('should not equal a Literal instance with a non-empty value', () => {
      expect(literal.equals(new Literal('"x"'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'x',
          language: 'en-us',
          datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different language',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: '',
          datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: 'en-us',
          datatype: { value: 'other', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it('should not equal an object with a different term type', () => {
      expect(literal.equals({
        termType: 'NamedNode',
        value: '',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(literal.toJSON()).toEqual({
        termType: 'Literal',
        value: '',
        language: 'en-us',
        direction: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
        },
      });
    });
  });

  describe('A Literal instance created from the empty string with a language and direction', () => {
    let literal;
    beforeAll(() => { literal = new Literal('""@en-us--rtl'); });

    it('should be a Literal', () => {
      expect(literal).toBeInstanceOf(Literal);
    });

    it('should be a Term', () => {
      expect(literal).toBeInstanceOf(Term);
    });

    it('should have term type "Literal"', () => {
      expect(literal.termType).toBe('Literal');
    });

    it('should have the empty string as value', () => {
      expect(literal).toHaveProperty('value', '');
    });

    it('should have the language tag as language', () => {
      expect(literal).toHaveProperty('language', 'en-us');
    });

    it('should have the direction as direction', () => {
      expect(literal).toHaveProperty('direction', 'rtl');
    });

    it('should have rdf:langString as datatype', () => {
      expect(literal).toHaveProperty('datatype');
      expect(literal.datatype).toBeInstanceOf(NamedNode);
      expect(literal.datatype.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString');
    });

    it('should have the quoted empty string as id', () => {
      expect(literal).toHaveProperty('id', '""@en-us--rtl');
    });

    it('should equal a Literal instance with the same value', () => {
      expect(literal.equals(new Literal('""@en-us--rtl'))).toBe(true);
    });

    it(
        'should equal an object with the same term type, value, language, and datatype',
        () => {
          expect(literal.equals({
            termType: 'Literal',
            value: '',
            language: 'en-us',
            direction: 'rtl',
            datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString', termType: 'NamedNode' },
          })).toBe(true);
        },
    );

    it('should not equal a falsy object', () => {
      expect(literal.equals(null)).toBe(false);
    });

    it('should not equal a Literal instance with a non-empty value', () => {
      expect(literal.equals(new Literal('"x"'))).toBe(false);
    });

    it(
        'should not equal an object with the same term type but a different value',
        () => {
          expect(literal.equals({
            termType: 'Literal',
            value: 'x',
            language: 'en-us',
            direction: 'rtl',
            datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString', termType: 'NamedNode' },
          })).toBe(false);
        },
    );

    it(
        'should not equal an object with the same term type but a different language',
        () => {
          expect(literal.equals({
            termType: 'Literal',
            value: '',
            language: '',
            direction: 'rtl',
            datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString', termType: 'NamedNode' },
          })).toBe(false);
        },
    );

    it(
        'should not equal an object with the same term type but a different datatype',
        () => {
          expect(literal.equals({
            termType: 'Literal',
            value: '',
            language: 'en-us',
            direction: 'rtl',
            datatype: { value: 'other', termType: 'NamedNode' },
          })).toBe(false);
        },
    );

    it('should not equal an object with a different term type', () => {
      expect(literal.equals({
        termType: 'NamedNode',
        value: '',
        language: 'en-us',
        direction: 'rtl',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(literal.toJSON()).toEqual({
        termType: 'Literal',
        value: '',
        language: 'en-us',
        direction: 'rtl',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString',
        },
      });
    });
  });

  describe('A Literal instance created from a string without language or datatype', () => {
    let literal;
    beforeAll(() => { literal = new Literal('"my @^^ string"@en-us'); });

    it('should be a Literal', () => {
      expect(literal).toBeInstanceOf(Literal);
    });

    it('should be a Term', () => {
      expect(literal).toBeInstanceOf(Term);
    });

    it('should have term type "Literal"', () => {
      expect(literal.termType).toBe('Literal');
    });

    it('should have the text value as value', () => {
      expect(literal).toHaveProperty('value', 'my @^^ string');
    });

    it('should have the language tag as language', () => {
      expect(literal).toHaveProperty('language', 'en-us');
    });

    it('should have the empty string as direction', () => {
      expect(literal).toHaveProperty('direction', '');
    });

    it('should have rdf:langString as datatype', () => {
      expect(literal).toHaveProperty('datatype');
      expect(literal.datatype).toBeInstanceOf(NamedNode);
      expect(literal.datatype.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    });

    it('should have the quoted string as id', () => {
      expect(literal).toHaveProperty('id', '"my @^^ string"@en-us');
    });

    it('should equal a Literal instance with the same value', () => {
      expect(literal.equals(new Literal('"my @^^ string"@en-us'))).toBe(true);
    });

    it(
      'should equal an object with the same term type, value, language, and datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: 'en-us',
          datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
        })).toBe(true);
      },
    );

    it('should not equal a falsy object', () => {
      expect(literal.equals(null)).toBe(false);
    });

    it('should not equal a Literal instance with another value', () => {
      expect(literal.equals(new Literal('"other string"'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'other string',
          language: 'en-us',
          datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different language',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: 'fr',
          datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: 'en-us',
          datatype: { value: 'other', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it('should not equal an object with a different term type', () => {
      expect(literal.equals({
        termType: 'NamedNode',
        value: 'my @^^ string',
        language: 'en-us',
        datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', termType: 'NamedNode' },
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(literal.toJSON()).toEqual({
        termType: 'Literal',
        value: 'my @^^ string',
        language: 'en-us',
        direction: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
        },
      });
    });
  });

  describe('A Literal instance created from the empty string with a datatype', () => {
    let literal;
    beforeAll(() => { literal = new Literal('""^^http://example.org/types#type'); });

    it('should be a Literal', () => {
      expect(literal).toBeInstanceOf(Literal);
    });

    it('should be a Term', () => {
      expect(literal).toBeInstanceOf(Term);
    });

    it('should have term type "Literal"', () => {
      expect(literal.termType).toBe('Literal');
    });

    it('should have the empty string as value', () => {
      expect(literal).toHaveProperty('value', '');
    });

    it('should have the empty string as language', () => {
      expect(literal).toHaveProperty('language', '');
    });

    it('should have the empty string as direction', () => {
      expect(literal).toHaveProperty('direction', '');
    });

    it('should have the datatype', () => {
      expect(literal).toHaveProperty('datatype');
      expect(literal.datatype).toBeInstanceOf(NamedNode);
      expect(literal.datatype.value).toBe('http://example.org/types#type');
    });

    it('should have the quoted empty string as id', () => {
      expect(literal).toHaveProperty('id', '""^^http://example.org/types#type');
    });

    it('should equal a Literal instance with the same value', () => {
      expect(literal.equals(new Literal('""^^http://example.org/types#type'))).toBe(true);
    });

    it(
      'should equal an object with the same term type, value, language, and datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: '',
          datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
        })).toBe(true);
      },
    );

    it('should not equal a falsy object', () => {
      expect(literal.equals(null)).toBe(false);
    });

    it('should not equal a Literal instance with a non-empty value', () => {
      expect(literal.equals(new Literal('"x"^^http://example.org/types#type'))).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'x',
          language: '',
          datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different language',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: 'en',
          datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: '',
          language: '',
          datatype: { value: 'other', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it('should not equal an object with a different term type', () => {
      expect(literal.equals({
        termType: 'NamedNode',
        value: '',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(literal.toJSON()).toEqual({
        termType: 'Literal',
        value: '',
        language: '',
        direction: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://example.org/types#type',
        },
      });
    });
  });

  describe('A Literal instance created from a string with a datatype', () => {
    let literal;
    beforeAll(
      () => { literal = new Literal('"my @^^ string"^^http://example.org/types#type'); },
    );

    it('should be a Literal', () => {
      expect(literal).toBeInstanceOf(Literal);
    });

    it('should be a Term', () => {
      expect(literal).toBeInstanceOf(Term);
    });

    it('should have term type "Literal"', () => {
      expect(literal.termType).toBe('Literal');
    });

    it('should have the text value as value', () => {
      expect(literal).toHaveProperty('value', 'my @^^ string');
    });

    it('should have the empty string as language', () => {
      expect(literal).toHaveProperty('language', '');
    });

    it('should have the empty string as direction', () => {
      expect(literal).toHaveProperty('direction', '');
    });

    it('should have the datatype', () => {
      expect(literal).toHaveProperty('datatype');
      expect(literal.datatype).toBeInstanceOf(NamedNode);
      expect(literal.datatype.value).toBe('http://example.org/types#type');
    });

    it('should have the quoted string as id', () => {
      expect(literal).toHaveProperty('id', '"my @^^ string"^^http://example.org/types#type');
    });

    it('should equal a Literal instance with the same value', () => {
      expect(
        literal.equals(new Literal('"my @^^ string"^^http://example.org/types#type')),
      ).toBe(true);
    });

    it(
      'should equal an object with the same term type, value, language, and datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: '',
          datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
        })).toBe(true);
      },
    );

    it('should not equal a falsy object', () => {
      expect(literal.equals(null)).toBe(false);
    });

    it('should not equal a Literal instance with another value', () => {
      expect(
        literal.equals(new Literal('"other string"^^http://example.org/types#type')),
      ).toBe(false);
    });

    it(
      'should not equal an object with the same term type but a different value',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'other string',
          language: '',
          datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different language',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: 'en',
          datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it(
      'should not equal an object with the same term type but a different datatype',
      () => {
        expect(literal.equals({
          termType: 'Literal',
          value: 'my @^^ string',
          language: '',
          datatype: { value: 'other', termType: 'NamedNode' },
        })).toBe(false);
      },
    );

    it('should not equal an object with a different term type', () => {
      expect(literal.equals({
        termType: 'NamedNode',
        value: 'my @^^ string',
        language: '',
        datatype: { value: 'http://example.org/types#type', termType: 'NamedNode' },
      })).toBe(false);
    });

    it('should provide a JSON representation', () => {
      expect(literal.toJSON()).toEqual({
        termType: 'Literal',
        value: 'my @^^ string',
        language: '',
        direction: '',
        datatype: {
          termType: 'NamedNode',
          value: 'http://example.org/types#type',
        },
      });
    });
  });
});
