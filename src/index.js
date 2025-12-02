import Lexer from './N3Lexer';
import Parser from './N3Parser';
import Writer from './N3Writer';
import Store, { N3EntityIndex as EntityIndex } from './N3Store';
import StoreFactory from './N3StoreFactory';
import Reasoner, { getRulesFromDataset } from './N3Reasoner';
import StreamParser from './N3StreamParser';
import StreamWriter from './N3StreamWriter';
import * as Util from './N3Util';
import BaseIRI from './BaseIRI';

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
  StoreFactory,
  EntityIndex,
  StreamParser,
  StreamWriter,
  Util,
  Reasoner,
  BaseIRI,

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
  getRulesFromDataset,
};

// Export all named exports as a default object for backward compatibility
export default {
  Lexer,
  Parser,
  Writer,
  Store,
  StoreFactory,
  EntityIndex,
  StreamParser,
  StreamWriter,
  Util,
  Reasoner,
  BaseIRI,

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
