import { describe, expect, it } from 'vitest';
import { auction, bonusCardValue, winChance } from '../../../src/ai/considerations/auction';
import { DEFAULT_WEIGHTS } from '../../../src';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn, placeAssistant } from '../../helpers/game';

const weights = DEFAULT_WEIGHTS;
const space = { row: 2, col: 1 };

describe('auction', () => {
  it('is worth the Bonus card when the bid takes the lead', () => {
    const state = gameAtFirstTurn();
    const value = bonusCardValue(state, 0, state.bonusStrip[1]!, weights);
    const move = { kind: 'placeAssistant' as const, space, bid: 3 };
    const chance = winChance(state, 0, 1, space.row, 3, weights);
    expect(chance.win).toBeGreaterThan(0);
    expect(auction(contextFor(state, move))).toBeCloseTo(
      chance.win * Math.max(value.use, value.tuck),
    );
  });

  it('is nothing when the bid stays behind', () => {
    const state = edit(gameAtFirstTurn(), (draft) =>
      placeAssistant(draft, { row: 0, col: 1 }, 1, 3),
    );
    expect(auction(contextFor(state, { kind: 'placeAssistant', space, bid: 2 }))).toBe(0);
  });

  it('a tie is only worth the central power, if it holds', () => {
    const state = edit(gameAtFirstTurn(), (draft) =>
      placeAssistant(draft, { row: 0, col: 1 }, 1, 2),
    );
    const value = bonusCardValue(state, 0, state.bonusStrip[1]!, weights);
    expect(auction(contextFor(state, { kind: 'placeAssistant', space, bid: 2 }))).toBeCloseTo(
      weights.auction.tieHold * value.use,
    );
  });

  it('a bigger lead is safer', () => {
    const state = gameAtFirstTurn();
    const small = winChance(state, 0, 1, space.row, 1, weights).win;
    const big = winChance(state, 0, 1, space.row, 3, weights).win;
    expect(big).toBeGreaterThan(small);
  });

  it('a lead nobody can challenge is certain', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.round.passed = [1, 2];
    });
    expect(winChance(state, 0, 1, space.row, 1, weights).win).toBe(1);
  });
});
