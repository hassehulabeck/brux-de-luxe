import { describe, expect, it } from 'vitest';
import {
  greedyBot,
  legalMoves,
  playGame,
  randomBot,
  sameMove,
  seededOracle,
  seededRng,
  visibleState,
} from '../../src';
import type { GameState, WorkColor } from '../../src';
import { edit, gameAtFirstTurn } from '../helpers/game';

/** Give player 0 exactly these color works, moving tiles to and from the stack. */
function setWorks(draft: GameState, works: Partial<Record<WorkColor, number>>) {
  const p = draft.players[0]!;
  for (const color of ['blue', 'pink', 'yellow', 'green'] as const) {
    draft.workStacks.color[color] += p.works[color] - (works[color] ?? 0);
    p.works[color] = works[color] ?? 0;
  }
}

describe('randomBot', () => {
  it('always picks a legal move', () => {
    const state = gameAtFirstTurn();
    const bot = randomBot(seededRng(1));
    for (let i = 0; i < 20; i++) {
      const { move } = bot.decide(visibleState(state, 0), 0);
      expect(legalMoves(state).some((m) => sameMove(m, move))).toBe(true);
    }
  });
});

describe('greedyBot', () => {
  it('takes the move with the best immediate VP + BF, looking through its own follow-ups', () => {
    // No works to sell and Brugmann already used: the Stock Exchange action
    // (BF on the card) is the only gain.
    const start = edit(gameAtFirstTurn(), (draft) => {
      setWorks(draft, {});
      draft.players[0]!.publicFigures[0]!.rotated = true;
    });
    const decision = greedyBot(seededRng(1)).decide(visibleState(start, 0), 0);
    expect(decision.move).toEqual({ kind: 'takeBrusselsAction', action: 'stockExchange' });
    expect(decision.score).toBeGreaterThan(0);
    expect(decision.reason).toMatch(/^Stock Exchange: \+\d+ BF\.$/);
    expect(decision.alternatives.length).toBeGreaterThan(0);
    expect(decision.alternatives[0]!.score).toBeLessThanOrEqual(decision.score);
  });

  it('values a whole Sale: the rulebook example is worth 2 BF + 6 VP', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      setWorks(draft, { yellow: 1, green: 1 });
      draft.workshopCursor = { row: 2, col: 2 };
      draft.pending = { kind: 'moveCursor', player: 0 };
    });
    const decision = greedyBot(seededRng(1)).decide(visibleState(state, 0), 0);
    // The best Sale from here is at least as good as the rulebook's 8.
    expect(decision.score).toBeGreaterThanOrEqual(8);
    expect(decision.move.kind).toBe('moveCursor');
  });
});

describe('playGame', () => {
  it('plays bots against each other to the end, with invariants checked', () => {
    for (const seed of [1, 2, 3]) {
      const { final, moves } = playGame({
        bots: [
          greedyBot(seededRng(seed)),
          randomBot(seededRng(seed + 1)),
          greedyBot(seededRng(seed + 2)),
        ],
        oracle: seededOracle(seed),
        checkInvariants: true,
      });
      expect(final.phase).toBe('gameOver');
      expect(moves.length).toBeGreaterThan(50);
    }
  });

  it('gives bots only the visible state', () => {
    const seen: boolean[] = [];
    playGame({
      bots: [0, 1, 2].map((seat) => {
        const inner = randomBot(seededRng(seat));
        return {
          name: 'spy',
          decide: (view, player) => {
            if (view.pending?.kind === 'keepWork' && view.pending.player !== player)
              seen.push(true);
            return inner.decide(view, player);
          },
        };
      }),
      oracle: seededOracle(9),
    });
    expect(seen).toEqual([]);
  });
});
