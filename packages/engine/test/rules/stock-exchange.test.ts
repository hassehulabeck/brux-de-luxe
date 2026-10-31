import { describe, expect, it } from 'vitest';
import { apply, largestArea, legalMoves, newGame, resolveChance, seededOracle } from '../../src';

describe('Stock Exchange phase (p. 4)', () => {
  it('points the Bracket at the largest area: the rulebook example, shield 1-1', () => {
    // Shield 1-1 is bottom left: the largest area is the top 4 rows, right 4 columns.
    expect(largestArea({ row: 1, col: 1 })).toEqual({ rows: [0, 3], cols: [1, 4] });
  });

  it('works for every corner and the middle shields', () => {
    expect(largestArea({ row: 4, col: 4 })).toEqual({ rows: [1, 4], cols: [0, 3] });
    expect(largestArea({ row: 2, col: 3 })).toEqual({ rows: [0, 2], cols: [0, 2] });
    expect(largestArea({ row: 3, col: 2 })).toEqual({ rows: [2, 4], cols: [2, 4] });
  });

  it('lets the first player choose one of the two shields on the card', () => {
    const state = resolveChance(newGame({ playerCount: 3 }), seededOracle(3));
    const options = legalMoves(state);
    expect(options).toHaveLength(2);
    const chosen = options[1]!;
    if (chosen.kind !== 'chooseShield') throw new Error('expected a shield');
    const next = apply(state, chosen);
    expect(next.round.shield).toEqual(chosen.shield);
    expect(next.round.area).toEqual(largestArea(chosen.shield));
    expect(next.pending).toEqual({ kind: 'turn', player: 0 });
  });

  it('only allows Assistants inside the available area', () => {
    const state = resolveChance(newGame({ playerCount: 3 }), seededOracle(3));
    const next = apply(state, legalMoves(state)[0]!);
    const area = next.round.area!;
    for (const move of legalMoves(next)) {
      if (move.kind !== 'placeAssistant') continue;
      expect(move.space.row).toBeGreaterThanOrEqual(area.rows[0]);
      expect(move.space.row).toBeLessThanOrEqual(area.rows[1]);
      expect(move.space.col).toBeGreaterThanOrEqual(area.cols[0]);
      expect(move.space.col).toBeLessThanOrEqual(area.cols[1]);
    }
  });
});
