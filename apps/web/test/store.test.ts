import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { legalMoves, seededOracle } from '@brux/engine';
import { whoActs } from '../src/game/session';
import { useGameStore } from '../src/stores/game';

describe('game store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('plays a whole game: the table answers chance, the human taps, bots move and wait for Done', () => {
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
  }, 60_000);

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
