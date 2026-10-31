import { describe, expect, it } from 'vitest';
import {
  greedyBot,
  legalMoves,
  playGame,
  randomBot,
  sameMove,
  seededOracle,
  seededRng,
  utilityBot,
  visibleState,
  type Bot,
  type GameState,
} from '../../src';
import { bestSaleAt } from '../../src/ai/considerations/denial';
import { bidCap, candidateMoves, likelyDraw } from '../../src/ai/search';
import { edit, gameAtFirstTurn, placeAssistant } from '../helpers/game';

const decide = (state: GameState, bot: Bot = utilityBot({ rng: seededRng(1) })) =>
  bot.decide(visibleState(state, 0), 0);

describe('utilityBot', () => {
  it('picks a legal move and explains it with its plan', () => {
    const state = gameAtFirstTurn();
    const decision = decide(state);
    expect(legalMoves(state).some((m) => sameMove(m, decision.move))).toBe(true);
    expect(decision.plan).toMatch(/^(Builder|Art Dealer|Politician|Opportunist)$/);
    expect(decision.reason).toMatch(/\((Builder|Art Dealer|Politician|Opportunist)\)\.$/);
    expect(decision.alternatives.length).toBeLessThanOrEqual(3);
  });

  it('on brutal, plays its best-scored move', () => {
    const decision = decide(
      gameAtFirstTurn(),
      utilityBot({ rng: seededRng(1), difficulty: 'brutal' }),
    );
    for (const alt of decision.alternatives) expect(alt.score).toBeLessThanOrEqual(decision.score);
  });

  it('makes the most of a Sale: the cursor goes where the best work pays most', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      const p = draft.players[0]!;
      for (const color of ['blue', 'pink', 'yellow', 'green'] as const) {
        draft.workStacks.color[color] += p.works[color];
        p.works[color] = 0;
      }
      p.works.yellow = 1;
      draft.workStacks.color.yellow--;
      p.works.green = 1;
      draft.workStacks.color.green--;
      draft.workshopCursor = { row: 2, col: 2 };
      draft.pending = { kind: 'moveCursor', player: 0 };
    });
    const { move } = decide(state);
    if (move.kind !== 'moveCursor') throw new Error('expected a cursor move');
    const best = Math.max(
      ...legalMoves(state).map((m) => (m.kind === 'moveCursor' ? bestSaleAt(state, 0, m.to) : 0)),
    );
    expect(bestSaleAt(state, 0, move.to)).toBe(best);
  });

  it('caps bids at 2 BF above what it takes to catch the leader', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.bf = 20;
      placeAssistant(draft, { row: 0, col: 2 }, 1, 3);
    });
    expect(bidCap(state, 0, 2)).toBe(5);
    expect(bidCap(state, 0, 1)).toBe(2);
    const bids = candidateMoves(state, 0).flatMap((m) =>
      m.kind === 'placeAssistant' && m.space.col === 2 ? [m.bid] : [],
    );
    expect(Math.max(...bids)).toBe(5);
  });

  it('values its own Workshop draw with the most likely colors', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.workStacks.color = { blue: 1, pink: 3, yellow: 2, green: 0 };
    });
    expect(likelyDraw(state, 1)).toEqual(['pink']);
    // pink 3 -> 2, then pink and yellow are level (pink comes first), then yellow.
    expect(likelyDraw(state, 3)).toEqual(['pink', 'pink', 'yellow']);
  });

  it('decides the same way from the same seed', () => {
    const state = gameAtFirstTurn();
    expect(decide(state, utilityBot({ rng: seededRng(4) }))).toEqual(
      decide(state, utilityBot({ rng: seededRng(4) })),
    );
  });

  it('plays whole games for 2 to 5 players, with invariants checked after every move', () => {
    for (const count of [2, 3, 4, 5]) {
      const bots = Array.from({ length: count }, (_, seat) =>
        seat === 0
          ? utilityBot({ rng: seededRng(seat) })
          : seat % 2
            ? greedyBot(seededRng(seat))
            : randomBot(seededRng(seat)),
      );
      const { final } = playGame({ bots, oracle: seededOracle(count), checkInvariants: true });
      expect(final.phase).toBe('gameOver');
    }
  }, 60_000);
});
