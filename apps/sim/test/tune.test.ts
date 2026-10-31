import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, seededRng } from '@brux/engine';
import { botSpecError, createBot } from '../src/bots';
import { degeneracyWarnings } from '../src/degeneracy';
import { headToHead, type EntryStats, type MatchResult } from '../src/match';
import { formatStep, perturb, tunablePaths } from '../src/tune';

describe('bot specs', () => {
  it('accepts utility with a known weight set, and explains what is wrong otherwise', () => {
    expect(botSpecError('utility')).toBeNull();
    expect(botSpecError('utility:default')).toBeNull();
    expect(botSpecError('utility:nope')).toMatch(/unknown weight set "nope"/);
    expect(botSpecError('greedy:default')).toMatch(/only the utility bot/);
    expect(botSpecError('clever')).toMatch(/unknown bot/);
  });

  it('creates a utility bot with the weight set given', () => {
    const bot = createBot('utility:mine', 1, { mine: DEFAULT_WEIGHTS });
    expect(bot.name).toBe('utility:mine');
  });
});

describe('headToHead', () => {
  it('counts the games where one entry outscored the other, ties as half', () => {
    const result = {
      gameScores: [
        [10, 5, 1],
        [5, 5, 9],
        [1, 8, undefined],
        [undefined, 3, 4],
      ],
    } as unknown as MatchResult;
    expect(headToHead(result, 0, 1)).toBeCloseTo(1.5 / 3);
  });
});

describe('degeneracyWarnings', () => {
  const entry = (actions: Record<string, number>, finalBf = 0): EntryStats =>
    ({ label: 'utility', seats: 10, actions, finalBf }) as unknown as EntryStats;

  it('flags a bot that never uses Brussels, always tucks, never builds and hoards money', () => {
    const warnings = degeneracyWarnings(
      entry({ 'Tucked a Bonus card': 50, 'Used a Bonus card': 2 }, 300),
    );
    expect(warnings).toHaveLength(4);
  });

  it('is quiet for a bot that plays a bit of everything', () => {
    expect(
      degeneracyWarnings(
        entry(
          {
            'Brussels: Market': 20,
            'Tucked a Bonus card': 30,
            'Used a Bonus card': 20,
            'Built a Building': 40,
          },
          50,
        ),
      ),
    ).toEqual([]);
  });
});

describe('perturb', () => {
  it('changes 3 tunable weights, keeps chances at most 1 and the projection fixed', () => {
    const paths = tunablePaths(DEFAULT_WEIGHTS);
    expect(paths).not.toContain('considerations.projectionGain');
    expect(paths).not.toContain('fitness.builder.works'); // 0 stays 0
    for (let seed = 0; seed < 20; seed++) {
      const { weights, changes } = perturb(DEFAULT_WEIGHTS, seededRng(seed));
      expect(changes).toHaveLength(3);
      expect(weights.considerations.projectionGain).toBe(1);
      expect(weights.projection.buildConfidence).toBeLessThanOrEqual(1);
      expect(weights.auction.tieHold).toBeLessThanOrEqual(1);
    }
    // The original is not touched.
    expect(DEFAULT_WEIGHTS.auction.tieHold).toBe(0.5);
  });

  it('describes a step for the tuning log', () => {
    expect(
      formatStep({
        iteration: 0,
        changes: ['auction.tieHold 0.5 -> 0.6'],
        firstTry: 0.6,
        confirmation: 0.55,
        accepted: true,
      }),
    ).toBe('step 1: accepted (60%, then 55%)  auction.tieHold 0.5 -> 0.6');
  });
});
