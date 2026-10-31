/**
 * FAKE component data for tests only.
 *
 * These values are made up so that they pass validation (right counts and
 * totals). They are NOT the real values from the game and must never be
 * copied into src/data/json/.
 */

import type { RawComponents } from '../../src/data';

// A function, not a constant, so every card gets its own objects and tests can change them safely.
function shieldPair() {
  return [
    { row: 1, col: 1 },
    { row: 4, col: 4 },
  ];
}

export function fakeRawComponents(): RawComponents {
  return {
    actionStrips: {
      orientation: 'column',
      strips: ['A', 'B', 'C', 'D', 'E'].map((id) => ({
        id,
        basicSide: ['workshop', 'sale', 'royalTheater', 'materials', 'construction'],
      })),
    },
    workshop: {
      bfByRow: [0, 1, 2, 3, 4],
      vpByColumn: [0, 1, 2, 3, 4],
      cursorStart: { row: 2, col: 2 },
      dots: {
        blue: { row: -1, col: 0 },
        pink: { row: 0, col: 1 },
        yellow: { row: 1, col: 0 },
        green: { row: 0, col: -1 },
      },
    },
    tracks: {
      cityHall: [1, 2, 3],
      royalPalace: [1, 2, 3],
      architect: [1, 2, 3],
    },
    compass: { needleStart: [0, 3] },
    stockExchangeCards: Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      bf: 1,
      shields: { 2: shieldPair(), 3: shieldPair(), 4: shieldPair(), 5: shieldPair() },
    })),
    bonusCards: [
      { copies: 20, mannekenPis: 1, vpSymbols: 1, power: { kind: 'single', effect: 'cityHall' } },
      {
        copies: 5,
        mannekenPis: 0,
        vpSymbols: 0,
        power: { kind: 'choice', options: ['architect', 'courthouse'] },
      },
    ],
    publicFigures: {
      startingBrugmannCost: 1,
      deck: [
        { figure: 'charlesBuls', costs: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
        { figure: 'princeAlbert', costs: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
      ],
    },
    worksOfArt: {
      colorTiles: { blue: 6, pink: 6, yellow: 6, green: 6 },
      blackTiles: 6,
    },
    exhibitions: { years: [1893, 1894, 1895, 1896, 1910] },
  };
}
