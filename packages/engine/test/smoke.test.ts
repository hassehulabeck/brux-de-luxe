import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from '../src/index';

describe('engine package', () => {
  it('can be imported', () => {
    expect(ENGINE_NAME).toContain('Bruxelles');
  });
});
