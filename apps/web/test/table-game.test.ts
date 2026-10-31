import { describe, expect, it } from 'vitest';
import { cannotPerformReason, legalMoves } from '@brux/engine';
import { eventInstruction } from '../src/game/labels';
import { current, fromSaved, type SavedGame } from '../src/game/session';
import saved from './fixtures/table-game-2026-10-31.json';

/**
 * Hans's first table game (1 human + 2 bots, quit after round 2). It found
 * a secondary action the table was never told about.
 */
const game = saved as SavedGame;
const upTo = (moves: number) => fromSaved({ ...game, moves: game.moves.slice(0, moves) });

describe("the first table game's misses", () => {
  it("tells the table about a bot's secondary action on another bot's Building", () => {
    // Botty has 1 work. Move 129 ends Harry Kane's Sale on row 3, column 5, where Botty has a Building.
    const state = current(upTo(130));
    expect(state.events).toEqual([
      { kind: 'secondaryAction', owner: 1, action: 'sale', vp: 1, blackWork: false },
    ]);
    expect(eventInstruction(state.events[0]!, game.config.seats)).toBe(
      'Secondary action for Botty (red), owner of the Sale Building: score 1 VP.',
    );
  });

  it('explains why a second Building could not be paid', () => {
    // Round 2: 3 BF, then a 1 BF bid on a Construction space.
    const before = current(upTo(119));
    const space = legalMoves(before).find(
      (m) =>
        m.kind === 'placeAssistant' &&
        m.bid === 1 &&
        before.board[m.space.row]![m.space.col]!.action === 'construction',
    );
    const session = fromSaved({ ...game, moves: [...game.moves.slice(0, 119), space!] });
    const state = current(session);
    expect(legalMoves(state)).toEqual([{ kind: 'skipAction' }]);
    expect(cannotPerformReason(state, 0, 'construction')).toContain('using both');
  });
});
