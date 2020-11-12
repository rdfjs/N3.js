import Lexer from './N3Lexer';
import Parser from './N3Parser';
import Writer from './N3Writer';
import Store from './N3Store';
import StreamParser from './N3StreamParser';
import StreamWriter from './N3StreamWriter';
import * as Util from './N3Util';

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
} from './N3DataFactory';

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
