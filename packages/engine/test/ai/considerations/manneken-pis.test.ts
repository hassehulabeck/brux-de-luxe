import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '../../../src';
import {
  expectedMannekenPis,
  firstPlayerChance,
  mannekenPis,
} from '../../../src/ai/considerations/manneken-pis';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn } from '../../helpers/game';

describe('mannekenPis', () => {
  it('passing first earns the Exhibition tile and its 2 Manneken Pis', () => {
    const state = gameAtFirstTurn();
    const ctx = contextFor(state, { kind: 'pass' });
    expect(expectedMannekenPis(ctx.after)[0]).toBe(2);
    // Before: everyone on 0, a three-way tie. After: first player for sure.
    expect(firstPlayerChance(state, 0)).toBeCloseTo(1 / 3);
    expect(mannekenPis(ctx)).toBeCloseTo((2 / 3) * DEFAULT_WEIGHTS.mannekenPis.firstPlayerValue);
  });

  it("is worth the pawn's 5 VP in the last round", () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.round.number = 5;
    });
    expect(mannekenPis(contextFor(state, { kind: 'pass' }))).toBeCloseTo((2 / 3) * 5);
  });

  it('is nothing outside the Action phase', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.phase = 'resolution';
    });
    expect(mannekenPis(contextFor(state, { kind: 'pass' }, { after: state }))).toBe(0);
  });
});
