/**
 * The transcribed data must agree with the rulebook's worked examples.
 */

import { describe, expect, it } from 'vitest';
import { RAW_COMPONENTS, type WorkshopData } from '../../src/data';

// The shape of this file is already checked by component-data.test.ts.
const workshop = RAW_COMPONENTS.workshop as WorkshopData;

describe('Workshop values match the rulebook examples', () => {
  it('Sale example (p. 5): the green dot in the 5th row and 1st column earns 2 BF and 6 VP', () => {
    expect(workshop.bfByRow[4]).toBe(2);
    expect(workshop.vpByColumn[0]).toBe(6);
  });

  it('black Sale example (p. 11): the center in the 3rd row and 2nd column earns 2 BF and 4 VP', () => {
    expect(workshop.bfByRow[2]).toBe(2);
    expect(workshop.vpByColumn[1]).toBe(4);
  });
});
