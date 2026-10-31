/**
 * Checks the real transcribed data in src/data/json/.
 *
 * - The shape test always runs: whatever has been filled in must be valid.
 * - The completeness test only runs with CHECK_DATA=1 (`pnpm check:data`),
 *   because it fails until every TODO_DATA has been filled in.
 */

import { describe, expect, it } from 'vitest';
import { componentDataReport } from '../../src/data';

describe('transcribed component data', () => {
  it('has no invalid values (TODO_DATA is allowed)', () => {
    expect(componentDataReport().errors).toEqual([]);
  });
});

describe.runIf(process.env.CHECK_DATA === '1')('transcribed component data is complete', () => {
  it('has no TODO_DATA left', () => {
    expect(componentDataReport().missing).toEqual([]);
  });
});
