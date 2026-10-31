import { describe, expect, it } from 'vitest';
import { bestSaleValue, denial } from '../../../src/ai/considerations/denial';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn } from '../../helpers/game';

describe('denial', () => {
  it("moving the cursor away from an opponent's best Sale is worth what they lose", () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      for (const p of draft.players) p.works = { blue: 0, pink: 0, yellow: 0, green: 0, black: 0 };
      draft.players[1]!.works.blue = 1;
      draft.workshopCursor = { row: 1, col: 1 }; // blue dot on the 6 BF + 6 VP corner
    });
    const after = edit(state, (draft) => {
      draft.workshopCursor = { row: 5, col: 5 };
    });
    expect(bestSaleValue(state, 1)).toBe(12);
    const value = denial(contextFor(state, { kind: 'pass' }, { after }));
    expect(value).toBe(bestSaleValue(state, 1) - bestSaleValue(after, 1));
    expect(value).toBeGreaterThan(0);
  });

  it('is nothing when the cursor, shop and needles stay put', () => {
    const state = gameAtFirstTurn();
    expect(denial(contextFor(state, { kind: 'pass' }, { after: state }))).toBe(0);
  });
});
