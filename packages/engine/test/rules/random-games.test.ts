import { describe, expect, it } from 'vitest';
import { playRandomGame } from '../helpers/random-game';

describe('a seeded random game', () => {
  for (const playerCount of [2, 3, 4, 5] as const) {
    it(`runs from setup to final scoring with ${playerCount} players`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { final } = playRandomGame(seed * 100 + playerCount, playerCount);
        expect(final.phase).toBe('gameOver');
        expect(final.round.number).toBe(5);
        expect(final.final).toHaveLength(playerCount);
      }
    });
  }

  it('is reproducible from its seed', () => {
    expect(playRandomGame(42, 3).final).toEqual(playRandomGame(42, 3).final);
  });
});
