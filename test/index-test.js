import { expectNoInternalMembers } from './browser-bundle-support';
import * as N3 from '../src';

describe('The package entry point', () => {
  it('does not export the internal term classes', () => {
    expect.hasAssertions();
    expectNoInternalMembers(N3);
  });
});
