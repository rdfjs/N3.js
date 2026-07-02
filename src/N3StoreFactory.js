import N3Store from './N3Store';

export default class N3DatasetCoreFactory {
  dataset(quads) {
    return new N3Store(quads);
  }
}
