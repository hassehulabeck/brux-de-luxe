import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { legalMoves, seededOracle } from '@brux/engine';
import { whoActs } from '../src/game/session';
import { useGameStore } from '../src/stores/game';

describe('game store', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  /** A browser's localStorage and a server that takes every game log event. */
  function fakeBrowser() {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    const sent: { event: string; gameId: string; moves?: number }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body));
        return { status: 200 };
      }),
    );
    return { sent };
  }

  it('plays a whole game: the table answers chance, the human taps, bots move and wait for Done', async () => {
    const { sent } = fakeBrowser();
    const game = useGameStore();
    game.newGame({
      seats: [
        { name: 'Hans', color: 'blue', bot: null },
        { name: 'Bot 1', color: 'red', bot: { difficulty: 'normal' } },
        { name: 'Bot 2', color: 'green', bot: { difficulty: 'easy' } },
      ],
      seed: 3,
    });
    const oracle = seededOracle(11);
    let botTurns = 0;
    const tableNotes: string[] = [];
    for (let i = 0; i < 2000 && game.state!.phase !== 'gameOver'; i++) {
      const state = game.state!;
      const actor = whoActs(state);
      if (actor.kind === 'chance' && state.pending?.kind === 'chance') {
        game.enter(oracle.resolve(state, state.pending.event));
      } else if (game.botTurn) {
        expect(game.botTurn.steps.length).toBeGreaterThan(0);
        expect(game.botTurnDone).toBe(true);
        botTurns++;
        tableNotes.push(...game.botTurn.steps.map((s) => s.instruction));
        game.doneWithBotTurn();
      } else {
        expect(actor).toEqual({ kind: 'seat', player: 0 });
        game.enter(legalMoves(state).at(-1)!); // the last option: passes rather than wastes money
        tableNotes.push(...game.notes);
      }
    }
    expect(game.state!.phase).toBe('gameOver');
    expect(game.state!.final).toHaveLength(3);
    expect(botTurns).toBeGreaterThan(10);
    // Shield scorings are told to the table, so nobody has to count majorities.
    expect(tableNotes.some((note) => note.startsWith('Shield '))).toBe(true);

    // The game log heard about the start and the end, once each.
    const gameId = game.session!.config.gameId;
    await vi.waitFor(() => expect(sent.map((e) => e.event)).toEqual(['start', 'end']));
    expect(sent.every((e) => e.gameId === gameId)).toBe(true);
    expect(sent[1]!.moves).toBe(game.session!.moves.length);

    // Loading the finished game again is not a second ending.
    game.importJson(game.exportJson());
    game.flushGameLog();
    await new Promise((r) => setTimeout(r, 10));
    expect(sent).toHaveLength(2);
  }, 60_000);

  it('logs nothing when the players switched the log off', async () => {
    const { sent } = fakeBrowser();
    const game = useGameStore();
    game.setGameLogOff(true);
    game.newGame({
      seats: [0, 1].map((i) => ({ name: `P${i}`, color: `c${i}`, bot: null })),
      seed: 1,
    });
    expect(game.session!.config.gameId).toBeTruthy();
    await new Promise((r) => setTimeout(r, 10));
    expect(sent).toEqual([]);
  });

  it('shows an error instead of playing an illegal move', () => {
    const game = useGameStore();
    game.newGame({
      seats: [0, 1].map((i) => ({ name: `P${i}`, color: `c${i}`, bot: null })),
      seed: 1,
    });
    game.enter({ kind: 'pass' });
    expect(game.error).toMatch(/Illegal move/);
  });

  it('exports a game and imports it again', () => {
    const game = useGameStore();
    game.newGame({
      seats: [0, 1].map((i) => ({ name: `P${i}`, color: `c${i}`, bot: null })),
      seed: 1,
    });
    const oracle = seededOracle(2);
    for (let i = 0; i < 5; i++) {
      const pending = game.state!.pending;
      if (pending?.kind === 'chance') game.enter(oracle.resolve(game.state!, pending.event));
    }
    const text = game.exportJson();
    const before = game.state;
    game.quit();
    game.importJson(text);
    expect(game.state).toEqual(before);
  });
});
