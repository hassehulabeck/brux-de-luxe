import { describe, expect, it } from 'vitest';
import { cursorPositions, legalMoves } from '../../src';
import { edit, freeSpace, gameAtFirstTurn, play } from '../helpers/game';

/** Player 0 with the given works, the cursor and the shop set up, about to Sell. */
function readyToSell(
  works: Partial<Record<'blue' | 'pink' | 'yellow' | 'green' | 'black', number>>,
  options: {
    cursor?: { row: number; col: number };
    shop?: [string[], string[]];
    salesMade?: number;
  } = {},
) {
  const start = edit(gameAtFirstTurn(), (draft) => {
    const p = draft.players[0]!;
    p.works = { blue: 0, pink: 0, yellow: 0, green: 0, black: 0, ...works };
    // Keep the works conserved: take them out of the stacks.
    for (const p2 of draft.players.slice(1))
      p2.works = { blue: 0, pink: 0, yellow: 0, green: 0, black: 0 };
    draft.workStacks = { color: { blue: 6, pink: 6, yellow: 6, green: 6 }, black: 6 };
    draft.shop = (options.shop ?? [[], []]) as typeof draft.shop;
    for (const color of [...Object.entries(works)].flatMap(([c, n]) => Array(n).fill(c))) {
      if (color === 'black') draft.workStacks.black--;
      else draft.workStacks.color[color as 'blue']--;
    }
    for (const color of draft.shop.flat()) {
      if (color === 'black') draft.workStacks.black--;
      else draft.workStacks.color[color]--;
    }
    draft.workshopCursor = options.cursor ?? { row: 3, col: 3 };
    draft.salesMade = options.salesMade ?? 0;
  });
  return play(
    start,
    { kind: 'placeAssistant', space: freeSpace(start, 'sale'), bid: 1 },
    { kind: 'performAction' },
  );
}

describe('Sale action (p. 5)', () => {
  it('rulebook example: green work, cursor left 1 and down 1, earns 2 BF and 6 VP', () => {
    const state = readyToSell(
      { green: 1, yellow: 1 },
      { cursor: { row: 2, col: 2 }, shop: [['yellow'], ['blue']], salesMade: 2 },
    );
    const before = state.players[0]!;
    const after = play(
      state,
      { kind: 'moveCursor', to: { row: 3, col: 1 } },
      { kind: 'sellWork', color: 'green' },
      { kind: 'placeInShop', slot: 0 },
    );
    expect(after.players[0]!.bf - before.bf).toBe(2);
    expect(after.players[0]!.vp - before.vp).toBe(6);
    expect(after.players[0]!.works.green).toBe(0);
    // Green now covers yellow: green and blue are visible, yellow can be sold again.
    expect(after.shop[0]).toEqual(['yellow', 'green']);
  });

  it('rulebook example (p. 11): a black work uses the cursor center, 2 BF and 4 VP', () => {
    const state = readyToSell({ black: 1 }, { cursor: { row: 2, col: 1 } });
    const before = state.players[0]!;
    const after = play(
      state,
      { kind: 'moveCursor', to: { row: 2, col: 1 } },
      { kind: 'sellWork', color: 'black' },
      { kind: 'placeInShop', slot: 0 },
    );
    expect(after.players[0]!.bf - before.bf).toBe(2);
    expect(after.players[0]!.vp - before.vp).toBe(4);
  });

  it('moves the cursor up to one space per work owned, keeping the cursor on the grid (Q2, Q4)', () => {
    const state = readyToSell({ blue: 1, pink: 1 }, { cursor: { row: 3, col: 3 } });
    const targets = legalMoves(state).map((m) => (m.kind === 'moveCursor' ? m.to : null));
    // Up to 2 steps from the center: 13 positions, all inside the inner 5×5.
    expect(targets).toHaveLength(13);
    expect(targets).toContainEqual({ row: 3, col: 3 });
    expect(targets).toContainEqual({ row: 1, col: 3 });
    expect(targets).toContainEqual({ row: 4, col: 4 });
    expect(targets).not.toContainEqual({ row: 3, col: 0 });
  });

  it('never lets a dot leave the grid', () => {
    const state = readyToSell({ blue: 6 }, { cursor: { row: 1, col: 1 } });
    for (const to of cursorPositions(state, 6)) {
      expect(to.row).toBeGreaterThanOrEqual(1);
      expect(to.row).toBeLessThanOrEqual(5);
      expect(to.col).toBeGreaterThanOrEqual(1);
      expect(to.col).toBeLessThanOrEqual(5);
    }
  });

  it('cannot sell a color that is visible in the shop', () => {
    const state = readyToSell({ blue: 1, pink: 1 }, { shop: [['blue'], []], salesMade: 1 });
    const afterMove = play(state, { kind: 'moveCursor', to: { row: 3, col: 3 } });
    expect(legalMoves(afterMove)).toEqual([{ kind: 'sellWork', color: 'pink' }]);
  });

  it('is not offered when every work matches a visible shop color', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.works = { blue: 0, pink: 0, yellow: 0, green: 0, black: 1 };
      draft.players
        .slice(1)
        .forEach((p) => (p.works = { blue: 0, pink: 0, yellow: 0, green: 0, black: 0 }));
      draft.workStacks = { color: { blue: 6, pink: 6, yellow: 6, green: 6 }, black: 4 };
      draft.shop = [['black'], []];
    });
    const placed = play(state, { kind: 'placeAssistant', space: freeSpace(state, 'sale'), bid: 1 });
    expect(legalMoves(placed)).toEqual([{ kind: 'skipAction' }]);
  });

  it('puts the first two sales of the game on an empty shop space', () => {
    const first = readyToSell({ blue: 1 }, { salesMade: 0 });
    const sold = play(
      first,
      { kind: 'moveCursor', to: { row: 3, col: 3 } },
      { kind: 'sellWork', color: 'blue' },
    );
    expect(legalMoves(sold)).toHaveLength(2);

    const second = readyToSell({ pink: 1 }, { shop: [['blue'], []], salesMade: 1 });
    const sold2 = play(
      second,
      { kind: 'moveCursor', to: { row: 3, col: 3 } },
      { kind: 'sellWork', color: 'pink' },
    );
    expect(legalMoves(sold2)).toEqual([{ kind: 'placeInShop', slot: 1 }]);

    const third = readyToSell({ pink: 1 }, { shop: [['blue'], ['yellow']], salesMade: 2 });
    const sold3 = play(
      third,
      { kind: 'moveCursor', to: { row: 3, col: 3 } },
      { kind: 'sellWork', color: 'pink' },
    );
    expect(legalMoves(sold3)).toHaveLength(2);
  });
});
