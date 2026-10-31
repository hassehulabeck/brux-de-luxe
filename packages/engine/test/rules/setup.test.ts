import { describe, expect, it } from 'vitest';
import { newGame, resolveChance, seededOracle } from '../../src';

const setUp = (playerCount: 2 | 3 | 4 | 5) =>
  resolveChance(newGame({ playerCount }), seededOracle(7));

describe('setup (p. 2–3)', () => {
  it('gives seats 5, 6, 7, 8 and 9 BF, starting with the first player', () => {
    expect(setUp(5).players.map((p) => p.bf)).toEqual([5, 6, 7, 8, 9]);
    expect(setUp(3).players.map((p) => p.bf)).toEqual([5, 6, 7]);
  });

  it('puts 5 Assistants in each supply and 2 in the Courthouse', () => {
    for (const p of setUp(4).players) {
      expect(p.assistants).toEqual({ available: 5, artNouveau: 0, brussels: 0, courthouse: 2 });
    }
  });

  it('gives each player a Georges Brugmann card (cost 1) and one color Work of Art', () => {
    for (const p of setUp(3).players) {
      expect(p.publicFigures).toEqual([{ figure: 'georgesBrugmann', cost: 1, rotated: false }]);
      expect(p.works.black).toBe(0);
      expect(p.works.blue + p.works.pink + p.works.yellow + p.works.green).toBe(1);
    }
  });

  it('lays out the board, compass, Royal Theater and Bonus cards', () => {
    const state = setUp(3);
    expect(state.board).toHaveLength(5);
    expect(state.board.every((row) => row.length === 5)).toBe(true);
    expect([...state.compass.tiles].sort()).toEqual([
      'anyNoble',
      'empty',
      'iron',
      'stone',
      'threeBf',
      'wood',
    ]);
    expect(state.compass.needles).toEqual([0, 5]);
    expect(state.royalTheater.display.every((card) => card !== null)).toBe(true);
    expect(state.royalTheater.deck).toHaveLength(21 - 4);
    expect(state.bonusStrip.every((card) => card !== null)).toBe(true);
  });

  it('reveals a Stock Exchange card and asks the first player for a shield', () => {
    const state = setUp(3);
    expect(state.round.number).toBe(1);
    expect(state.round.stockExchangeCard).not.toBeNull();
    expect(state.pending).toMatchObject({ kind: 'chooseShield', player: 0 });
  });

  it('gives each player a neutral Assistant only in a 2-player game (p. 12)', () => {
    expect(setUp(2).players.every((p) => p.hasNeutralAssistant)).toBe(true);
    expect(setUp(3).players.some((p) => p.hasNeutralAssistant)).toBe(false);
  });
});
