import { describe, expect, it } from 'vitest';
import { constructionPayments, legalMoves, type GameState } from '../../src';
import { edit, freeSpace, gameAtFirstTurn, play } from '../helpers/game';

describe('compass payments (p. 6–7)', () => {
  it('rulebook example: 3 units with wood + 3 BF is 2 wood + 3 BF or 1 wood + 6 BF', () => {
    const payments = constructionPayments(['wood', 'threeBf'], 3).filter((p) => p.jokers === 0);
    expect(payments).toEqual(
      expect.arrayContaining([
        { wood: 2, stone: 0, iron: 0, bf: 3, jokers: 0 },
        { wood: 1, stone: 0, iron: 0, bf: 6, jokers: 0 },
      ]),
    );
    expect(payments).toHaveLength(2);
  });

  it('rulebook example: 4 units with wood + the empty space is 4 wood', () => {
    expect(constructionPayments(['wood', 'empty'], 4).filter((p) => p.jokers === 0)).toEqual([
      { wood: 4, stone: 0, iron: 0, bf: 0, jokers: 0 },
    ]);
  });

  it('pays 2 units as one of each type', () => {
    expect(constructionPayments(['stone', 'iron'], 2).filter((p) => p.jokers === 0)).toEqual([
      { wood: 0, stone: 1, iron: 1, bf: 0, jokers: 0 },
    ]);
  });

  it('lets any unit be a Joker, even all of them (Q6)', () => {
    const payments = constructionPayments(['stone', 'iron'], 2);
    expect(payments).toContainEqual({ wood: 0, stone: 0, iron: 1, bf: 0, jokers: 1 });
    expect(payments).toContainEqual({ wood: 0, stone: 0, iron: 0, bf: 0, jokers: 2 });
  });

  it('lets "1 noble material of your choice" be any Noble Material', () => {
    const payments = constructionPayments(['anyNoble', 'threeBf'], 2).filter((p) => p.jokers === 0);
    expect(payments).toEqual([
      { wood: 0, stone: 0, iron: 1, bf: 3, jokers: 0 },
      { wood: 0, stone: 1, iron: 0, bf: 3, jokers: 0 },
      { wood: 1, stone: 0, iron: 0, bf: 3, jokers: 0 },
    ]);
  });
});

/** Player 0 about to Construct, with wood and stone under the needles. */
function readyToBuild(change: (draft: GameState) => void = () => {}) {
  const start = edit(gameAtFirstTurn(), (draft) => {
    draft.compass.tiles = ['wood', 'stone', 'iron', 'anyNoble', 'threeBf', 'empty'];
    draft.compass.needles = [0, 1];
    const p = draft.players[0]!;
    p.bf = 20;
    p.nobles = { wood: 4, stone: 4, iron: 0 };
    p.jokers = 2;
    draft.supply.nobles = { wood: 6, stone: 6, iron: 10 };
    draft.supply.jokers = 13;
    change(draft);
  });
  const space = freeSpace(start, 'construction');
  return play(start, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'performAction' });
}

describe('Construction action (p. 6)', () => {
  it('costs 2 units for the lower row and gives 5 VP without Jokers', () => {
    const state = readyToBuild();
    const payment = { wood: 1, stone: 1, iron: 0, bf: 0, jokers: 0 };
    expect(legalMoves(state)).toContainEqual({ kind: 'payConstruction', payment });
    const paid = play(state, { kind: 'payConstruction', payment });
    expect(paid.players[0]!.vp).toBe(5);
    expect(paid.players[0]!.nobles).toEqual({ wood: 3, stone: 3, iron: 0 });
    expect(paid.supply.nobles).toEqual({ wood: 7, stone: 7, iron: 10 });
  });

  it('gives no 5 VP when a Joker is used', () => {
    const state = readyToBuild();
    const payment = { wood: 1, stone: 0, iron: 0, bf: 0, jokers: 1 };
    const paid = play(state, { kind: 'payConstruction', payment });
    expect(paid.players[0]!.vp).toBe(0);
    expect(paid.supply.jokers).toBe(14);
  });

  it('builds the rows bottom to top: 2, then 3, then 4 units', () => {
    const units = (built: number) => {
      const state = readyToBuild((draft) => withBuildings(draft, built));
      const move = legalMoves(state)[0]!;
      if (move.kind !== 'payConstruction') throw new Error('expected a payment');
      const { wood, stone, iron, jokers } = move.payment;
      return wood + stone + iron + jokers;
    };
    expect([0, 1, 2, 3, 4, 5].map(units)).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it('is not offered when all 6 Buildings are built', () => {
    const start = edit(gameAtFirstTurn(), (draft) => withBuildings(draft, 6));
    const placed = play(start, {
      kind: 'placeAssistant',
      space: freeSpace(start, 'construction'),
      bid: 1,
    });
    expect(legalMoves(placed)).toEqual([{ kind: 'skipAction' }]);
  });

  it('then turns a needle one space clockwise, never onto the other needle (Q5)', () => {
    const state = readyToBuild();
    const paid = play(state, {
      kind: 'payConstruction',
      payment: { wood: 1, stone: 1, iron: 0, bf: 0, jokers: 0 },
    });
    // Needles on 0 and 1: needle 0 is blocked by needle 1.
    expect(legalMoves(paid)).toEqual([{ kind: 'turnNeedle', needle: 1 }]);
    const turned = play(paid, { kind: 'turnNeedle', needle: 1 });
    expect(turned.compass.needles).toEqual([0, 2]);
  });

  it('places the Building on any empty space without an Assistant, even outside the area', () => {
    const state = edit(readyToBuild(), (draft) => {
      draft.round.area = { rows: [0, 0], cols: [0, 0] };
    });
    const placed = play(
      state,
      { kind: 'payConstruction', payment: { wood: 1, stone: 1, iron: 0, bf: 0, jokers: 0 } },
      { kind: 'turnNeedle', needle: 1 },
    );
    const spaces = legalMoves(placed).map((m) => (m.kind === 'placeBuilding' ? m.space : null));
    expect(spaces).toHaveLength(24); // 25 spaces minus the one with the Assistant
    const built = play(placed, { kind: 'placeBuilding', space: { row: 4, col: 4 } });
    expect(built.board[4]![4]!.building).toBe(0);
    expect(built.players[0]!.buildingsBuilt).toBe(1);
  });

  it('gives 5 VP for each top-row Building', () => {
    const state = readyToBuild((draft) => withBuildings(draft, 4));
    const payment = legalMoves(state).find(
      (m) => m.kind === 'payConstruction' && m.payment.jokers === 0,
    )!;
    if (payment.kind !== 'payConstruction') throw new Error('expected a payment');
    const { wood, stone } = payment.payment;
    expect(wood + stone).toBe(4);
    const built = play(
      state,
      payment,
      { kind: 'turnNeedle', needle: 1 },
      { kind: 'placeBuilding', space: freeSpaceForBuilding(state) },
    );
    expect(built.players[0]!.vp).toBe(5 + 5);
  });
});

function freeSpaceForBuilding(state: GameState) {
  for (let row = 4; row >= 0; row--) {
    for (let col = 4; col >= 0; col--) {
      const s = state.board[row]![col]!;
      if (!s.assistant && s.building === null) return { row, col };
    }
  }
  throw new Error('no free space');
}

/** Player 0 has already built `count` Buildings, on the bottom row of the board. */
function withBuildings(draft: GameState, count: number) {
  draft.players[0]!.buildingsBuilt = count;
  for (let i = 0; i < count; i++) {
    const row = 4 - Math.floor(i / 5);
    draft.board[row]![i % 5]!.building = 0;
  }
}
