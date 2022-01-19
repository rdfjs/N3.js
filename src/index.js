import Lexer from './N3Lexer.js';
import Parser from './N3Parser.js';
import Writer from './N3Writer.js';
import Store from './N3Store.js';
import StreamParser from './N3StreamParser.js';
import StreamWriter from './N3StreamWriter.js';
import * as Util from './N3Util.js';

import {
  default as DataFactory,

  Term,
  NamedNode,
  Literal,
  BlankNode,
  Variable,
  DefaultGraph,
  Quad,
  Triple,

  termFromId,
  termToId,
} from './N3DataFactory.js';

// Named exports
export {
  Lexer,
  Parser,
  Writer,
  Store,
  StreamParser,
  StreamWriter,
  Util,

  DataFactory,

  Term,
  NamedNode,
  Literal,
  BlankNode,
  Variable,
  DefaultGraph,
  Quad,
  Triple,

  termFromId,
  termToId,
};

// Export all named exports as a default object for backward compatibility
export default {
  Lexer,
  Parser,
  Writer,
  Store,
  StreamParser,
  StreamWriter,
  Util,

  DataFactory,

  Term,
  NamedNode,
  Literal,
  BlankNode,
  Variable,
  DefaultGraph,
  Quad,
  Triple,

  termFromId,
  termToId,
};
