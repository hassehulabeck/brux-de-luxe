import { describe, expect, it } from 'vitest';
import { apply, IllegalMoveError, legalMoves, visibleState, type GameState } from '../../src';
import { freeSpace, gameAtFirstTurn, play } from '../helpers/game';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('apply()', () => {
  it('never changes the state it is given', () => {
    const state = deepFreeze(gameAtFirstTurn());
    const copy = JSON.stringify(state);
    for (const move of legalMoves(state).slice(0, 50)) apply(state, move);
    expect(JSON.stringify(state)).toBe(copy);
  });

  it('refuses moves that are not legal for the pending decision', () => {
    const state = gameAtFirstTurn();
    expect(() => apply(state, { kind: 'performAction' })).toThrow(IllegalMoveError);
    expect(() =>
      apply(state, { kind: 'placeAssistant', space: { row: 0, col: 0 }, bid: 99 }),
    ).toThrow(IllegalMoveError);
  });

  it('keeps the state JSON-serialisable', () => {
    const state = gameAtFirstTurn();
    expect(JSON.parse(JSON.stringify(state)) as GameState).toEqual(state);
  });
});

describe('visibleState()', () => {
  it('hides the Works of Art another player is choosing between', () => {
    const start = gameAtFirstTurn();
    const drawing = play(
      start,
      { kind: 'placeAssistant', space: freeSpace(start, 'workshop'), bid: 1 },
      { kind: 'performAction' },
    );
    const outcome = legalMoves(drawing)[0]!;
    const choosing = play(drawing, outcome);
    expect(choosing.pending).toMatchObject({ kind: 'keepWork', player: 0 });
    expect(visibleState(choosing, 0).pending).toEqual(choosing.pending);
    expect(visibleState(choosing, 1).pending).toEqual({ kind: 'keepWork', player: 0, drawn: [] });
  });
});
