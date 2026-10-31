import { describe, expect, it } from 'vitest';
import { cannotPerformReason, describeMove, legalMoves, type GameState } from '../../src';
import {
  edit,
  everyonePasses,
  freeSpace,
  gameAtFirstTurn,
  placeAssistant,
  play,
} from '../helpers/game';

describe('cannotPerformReason', () => {
  /** From a real game: 2 wood, and the needles at "Any Noble Material" and "3 BF". */
  function constructionWith(bf: number, bid: number): GameState {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.compass.tiles = ['anyNoble', 'threeBf', 'wood', 'empty', 'iron', 'stone'];
      draft.compass.needles = [1, 0];
      const p = draft.players[0]!;
      p.bf = bf;
      p.nobles = { wood: 2, stone: 0, iron: 0 };
      draft.supply.nobles.wood -= 2;
      p.jokers = 0;
    });
    return play(start, { kind: 'placeAssistant', space: freeSpace(start, 'construction'), bid });
  }

  it('says why a Building can’t be paid: both needle types must be used', () => {
    // 4 BF minus a 2 BF bid leaves 2 BF, but the 3 BF unit needs 3.
    const state = constructionWith(4, 2);
    expect(legalMoves(state)).toEqual([{ kind: 'skipAction' }]);
    expect(cannotPerformReason(state, 0, 'construction')).toBe(
      'The needles point at 3 BF and Any Noble Material: your next Building costs 2 units, ' +
        'using both. You have 2 wood, 2 BF and no Jokers.',
    );
  });

  it('is null when the action can be carried out', () => {
    const state = constructionWith(4, 1);
    expect(legalMoves(state)).toContainEqual({ kind: 'performAction' });
    expect(cannotPerformReason(state, 0, 'construction')).toBeNull();
  });

  it('explains a Sale without a sellable work', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      const works = draft.players[0]!.works;
      for (const color of Object.keys(works) as (keyof typeof works)[]) works[color] = 0;
    });
    expect(cannotPerformReason(state, 0, 'sale')).toMatch(/no work/);
  });
});

describe('Bonus card moves name the column', () => {
  it('so a player who won two cards knows which one is meant', () => {
    const start = edit(gameAtFirstTurn(), (draft) => {
      placeAssistant(draft, { row: 0, col: 1 }, 0);
      placeAssistant(draft, { row: 0, col: 3 }, 0);
    });
    const state = everyonePasses(start);
    expect(state.pending).toEqual({ kind: 'resolveBonus', player: 0 });
    const texts = legalMoves(state).map((move) => describeMove(state, move));
    expect(texts.some((t) => t.startsWith('Column 2 Bonus card'))).toBe(true);
    expect(texts.some((t) => t.startsWith('Column 4 Bonus card'))).toBe(true);
  });
});
