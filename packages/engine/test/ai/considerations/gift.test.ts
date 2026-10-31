import { describe, expect, it } from 'vitest';
import { gift } from '../../../src/ai/considerations/gift';
import { contextFor } from '../../helpers/ai';
import { edit, freeSpace, gameAtFirstTurn } from '../../helpers/game';

describe('gift', () => {
  it("a Sale on an opponent's Building gives them 1 VP per work", () => {
    const base = gameAtFirstTurn();
    const space = freeSpace(base, 'sale');
    const state = edit(base, (draft) => {
      draft.board[space.row]![space.col]!.building = 1;
      draft.players[1]!.buildingsBuilt = 1;
      draft.players[1]!.works = { blue: 1, pink: 1, yellow: 1, green: 0, black: 0 };
    });
    const move = { kind: 'placeAssistant' as const, space, bid: 1 };
    expect(gift(contextFor(state, move))).toBe(-3);
  });

  it('costs nothing on my own Building or an empty space', () => {
    const base = gameAtFirstTurn();
    const space = freeSpace(base, 'sale');
    const mine = edit(base, (draft) => {
      draft.board[space.row]![space.col]!.building = 0;
      draft.players[0]!.buildingsBuilt = 1;
    });
    const move = { kind: 'placeAssistant' as const, space, bid: 1 };
    expect(gift(contextFor(mine, move))).toBe(0);
    expect(gift(contextFor(base, move))).toBe(0);
  });
});
