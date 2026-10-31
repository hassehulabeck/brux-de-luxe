import { describe, expect, it } from 'vitest';
import { blendPlans, DEFAULT_WEIGHTS, PLAN_NAMES, type GameState } from '../../src';
import { edit, gameAtFirstTurn } from '../helpers/game';

const weights = DEFAULT_WEIGHTS;

function leaderOf(state: GameState) {
  return blendPlans(state, 0, weights).leader;
}

describe('plans', () => {
  it('blends the plans into shares that add up to 1', () => {
    const { shares, sources } = blendPlans(gameAtFirstTurn(), 0, weights);
    const sum = PLAN_NAMES.reduce((s, plan) => s + shares[plan], 0);
    expect(sum).toBeCloseTo(1);
    expect(Object.values(sources).every((v) => v > 0)).toBe(true);
  });

  it('follows the position: materials and Buildings make a Builder', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      const p = draft.players[0]!;
      p.nobles = { wood: 2, stone: 2, iron: 2 };
      p.jokers = 3;
      p.buildingsBuilt = 2;
    });
    expect(leaderOf(state)).toBe('builder');
  });

  it('follows the position: Works of Art and Exhibitions make an Art Dealer', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      const p = draft.players[0]!;
      p.works = { blue: 1, pink: 1, yellow: 2, green: 1, black: 1 };
      p.exhibitions = [1893, 1897];
    });
    expect(leaderOf(state)).toBe('artDealer');
  });

  it('follows the position: tracks and Public Figures make a Politician', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      const p = draft.players[0]!;
      p.tracks.cityHall = 4;
      p.tracks.royalPalace = 3;
    });
    expect(leaderOf(state)).toBe('politician');
  });

  it("gives last round's leading plan and the temperament a bonus", () => {
    const state = gameAtFirstTurn();
    const plain = blendPlans(state, 0, weights).shares.politician;
    expect(
      blendPlans(state, 0, weights, { previousLeader: 'politician' }).shares.politician,
    ).toBeGreaterThan(plain);
    expect(
      blendPlans(state, 0, weights, { temperament: { politician: 1 } }).shares.politician,
    ).toBeGreaterThan(plain);
  });

  it('is lowered when opponents are strong on the same path', () => {
    const state = gameAtFirstTurn();
    const contested = edit(state, (draft) => {
      for (const p of draft.players.slice(1)) p.nobles = { wood: 3, stone: 3, iron: 3 };
    });
    expect(blendPlans(contested, 0, weights).shares.builder).toBeLessThan(
      blendPlans(state, 0, weights).shares.builder,
    );
  });
});
