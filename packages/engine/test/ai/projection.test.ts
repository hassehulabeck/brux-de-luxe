import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  finalScore,
  playGame,
  project,
  randomBot,
  seededOracle,
  seededRng,
  terminalScore,
} from '../../src';
import { constructionUnits, futureValue, timingAfter, timingOf } from '../../src/ai/projection';
import { edit, gameAtFirstTurn } from '../helpers/game';

const values = DEFAULT_WEIGHTS.projection;

describe('project()', () => {
  it('is exactly the final score when the game is over', () => {
    const { final } = playGame({
      bots: [0, 1, 2].map((s) => randomBot(seededRng(s))),
      oracle: seededOracle(3),
    });
    for (const score of final.final!) {
      expect(project(final, score.player, values).total).toBe(score.total);
    }
  });

  it('pays for the Public Figures cheapest first, and counts the rest as 5 VP lost', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      const p = draft.players[0]!;
      p.bf = 6;
      p.publicFigures = [
        { figure: 'mauriceMaeterlinck', cost: 5, rotated: false },
        { figure: 'henryVanDeVelde', cost: 4, rotated: false },
      ];
    });
    const score = finalScore(state, 0);
    // Pays the 4 BF card (2 BF left: 0 VP on row 1), can't pay the 5 BF card:
    // -5 VP, and it no longer counts on row 3.
    const expected = score.total - score.mannekenPis - score.rows[0] + 0 - (5 + 1);
    expect(terminalScore(state, 0)).toBe(expected);
  });

  it('values resources less as the rounds pass', () => {
    const early = gameAtFirstTurn();
    const late = edit(early, (draft) => {
      draft.round.number = 5;
    });
    const afterPassing = edit(late, (draft) => {
      draft.round.passed = [0];
    });
    const total = (s: typeof early) =>
      Object.values(futureValue(s, 0, values)).reduce((a, b) => a + b, 0);
    expect(total(early)).toBeGreaterThan(total(late));
    expect(total(late)).toBeGreaterThan(total(afterPassing));
    expect(futureValue(afterPassing, 0, values).money).toBe(0);
  });

  it('counts materials the needles point at more than the others', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.compass.tiles = ['wood', 'stone', 'iron', 'anyNoble', 'threeBf', 'empty'];
      draft.compass.needles = [0, 5]; // wood and the empty space
      const p = draft.players[0]!;
      p.bf = 0;
      p.jokers = 0;
      p.nobles = { wood: 2, stone: 0, iron: 0 };
    });
    const stone = edit(state, (draft) => {
      draft.players[0]!.nobles = { wood: 0, stone: 2, iron: 0 };
    });
    expect(constructionUnits(state, state.players[0]!, values)).toBe(2);
    expect(constructionUnits(stone, stone.players[0]!, values)).toBe(
      2 * values.offNeedleMaterialShare,
    );
  });

  it('values a state in the next round as of the end of the round the move was made in', () => {
    const before = gameAtFirstTurn();
    const nextRound = edit(before, (draft) => {
      draft.round.number = 2;
      draft.phase = 'stockExchange';
    });
    expect(timingAfter(before, nextRound, 0)).toEqual({ futureRounds: 4, acting: false });
    expect(timingAfter(before, before, 0)).toEqual(timingOf(before, 0));
  });
});
