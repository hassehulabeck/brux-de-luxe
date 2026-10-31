/**
 * Values written explicitly in the rulebook text (Z-Man English edition, 2013).
 * Page numbers are given for every value. Anything that is only printed on a
 * component (or only shown in a rulebook picture) belongs in `json/` instead.
 */

import type { BonusEffect, CompassTile, NobleMaterial, PublicFigureId } from './types';

// Game length and players (p. 4, p. 12)
export const ROUNDS = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

// Component counts (p. 1)
export const STOCK_EXCHANGE_CARD_COUNT = 12;
export const BONUS_CARD_COUNT = 25;
export const PUBLIC_FIGURE_CARD_COUNT = 26;
export const STARTING_BRUGMANN_CARD_COUNT = 5;
export const EXHIBITION_TILE_COUNT = 5;
export const FIRST_EXHIBITION_YEAR = 1893;
export const LAST_EXHIBITION_YEAR = 1910;
export const WORK_OF_ART_TILE_COUNT = 30;
export const ACTION_STRIP_COUNT = 5;
export const ACTION_SPACES_PER_STRIP = 5;
export const COMPASS_SPACE_COUNT = 6;

// General supply (p. 1). Whether money is limited: docs/rules-questions.md Q7.
export const NOBLE_MATERIAL_SUPPLY: Record<NobleMaterial, number> = {
  wood: 10,
  stone: 10,
  iron: 10,
};
export const JOKER_SUPPLY = 15;
export const COINS = { oneBf: 76, fiveBf: 12 } as const;

// Per player (p. 1–2)
export const ASSISTANTS_PER_PLAYER = 7;
export const ASSISTANTS_STARTING_IN_COURTHOUSE = 2;
export const BUILDING_TILES_PER_PLAYER = 6;

/** Starting money by seat: the first player gets 5 BF, then 6, 7, 8, 9 clockwise (p. 3). */
export const STARTING_BF_BY_SEAT = [5, 6, 7, 8, 9] as const;

// Art Nouveau actions (p. 5–6)
export const MIN_BID = 1;
export const ROYAL_THEATER_DISPLAY_SIZE = 4;
/** Cost of each Royal Theater display space, from the rightmost (free) space (p. 6). */
export const ROYAL_THEATER_COSTS = [0, 1, 2, 3] as const;
export const MATERIALS_ACTION_CUBES = 2;
/** The first two sales of the game must go onto an empty shop space (p. 5). */
export const SALES_REQUIRING_EMPTY_SHOP_SPACE = 2;

/** Building rows on the Architect board, built bottom to top (p. 6). */
export const BUILDING_ROWS = [
  { row: 'lower', tiles: 2, constructionUnits: 2, immediateVp: 0 },
  { row: 'middle', tiles: 2, constructionUnits: 3, immediateVp: 0 },
  { row: 'upper', tiles: 2, constructionUnits: 4, immediateVp: 5 },
] as const;
/** VP for constructing without any Joker cube (p. 6). */
export const CONSTRUCTION_WITHOUT_JOKER_VP = 5;
/** One "3 BF" compass unit (p. 6). */
export const COMPASS_BF_PER_UNIT = 3;
/** The six compass tiles, placed randomly around the compass at setup (p. 6). */
export const COMPASS_TILE_SET: readonly CompassTile[] = [
  'wood',
  'stone',
  'iron',
  'anyNoble',
  'threeBf',
  'empty',
];

// Secondary actions on buildings (Appendix 2, p. 11)
export const MATERIALS_SECONDARY_CUBES = 1;

// Brussels actions (p. 7)
export const MARKET_JOKERS = 3;
/** With 4–5 players each Brussels action is available twice per cost level (p. 7). */
export const BRUSSELS_DOUBLE_AVAILABILITY_FROM_PLAYERS = 4;

// Pass (p. 7)
export const FIRST_PASS_BASE_BF = 1;
export const PASS_BF_PER_WORK_COLOR = 1;

// Resolution (p. 8–9)
export const EXHIBITION_MANNEKEN_PIS = 2;
export const MAX_MANNEKEN_PIS_PER_BONUS_CARD = 2;
export const ASSISTANTS_AROUND_SCORED_SHIELD = 4;

/** The four rows of the Architect board that Bonus cards can be tucked under (p. 9). */
export const TUCK_ROWS = [
  { row: 1, scores: 'bf', perUnit: 4 },
  { row: 2, scores: 'worksOfArt', perUnit: 1 },
  { row: 3, scores: 'publicFigures', perUnit: 1 },
  { row: 4, scores: 'assistantsBeyondTwo', perUnit: 1 },
] as const;
/** Each tuck row has one VP symbol printed on the board (p. 9). */
export const TUCK_ROW_BASE_VP_SYMBOLS = 1;
export const ASSISTANTS_NOT_SCORED_BY_TUCK_ROW_4 = 2;

// End of game (p. 10)
export const UNPAID_PUBLIC_FIGURE_PENALTY_VP = 5;
export const VP_PER_NOBLE_MATERIAL = 1;
export const MANNEKEN_PIS_FINAL_VP = 5;

// Public Figure effects (Appendix 1, p. 11). Costs and copies are component data.
export type PublicFigureEffect =
  | { kind: 'gainBf'; amount: number }
  | { kind: 'gainVp'; amount: number }
  | { kind: 'gainJokers'; amount: number }
  | { kind: 'advanceTrack'; track: Exclude<BonusEffect, 'courthouse'> }
  | { kind: 'retrieveFromCourthouse' }
  | {
      kind: 'nobleMaterialOrJokerExchange';
      noble: number;
      exchangeJokers: number;
      exchangeNobles: number;
    };

export const PUBLIC_FIGURE_EFFECTS: Record<PublicFigureId, PublicFigureEffect> = {
  georgesBrugmann: { kind: 'gainBf', amount: 5 },
  ernestSolvay: {
    kind: 'nobleMaterialOrJokerExchange',
    noble: 1,
    exchangeJokers: 1,
    exchangeNobles: 2,
  },
  charlesBuls: { kind: 'advanceTrack', track: 'cityHall' },
  henryVanDeVelde: { kind: 'advanceTrack', track: 'architect' },
  edouardEmpain: { kind: 'gainJokers', amount: 2 },
  princeAlbert: { kind: 'advanceTrack', track: 'royalPalace' },
  emileVandervelde: { kind: 'retrieveFromCourthouse' },
  mauriceMaeterlinck: { kind: 'gainVp', amount: 5 },
};

export const PUBLIC_FIGURE_NAMES: Record<PublicFigureId, string> = {
  georgesBrugmann: 'Georges Brugmann',
  ernestSolvay: 'Ernest Solvay',
  charlesBuls: 'Charles Buls',
  henryVanDeVelde: 'Henry Van De Velde',
  edouardEmpain: 'Edouard Empain',
  princeAlbert: 'Prince Albert',
  emileVandervelde: 'Emile Vandervelde',
  mauriceMaeterlinck: 'Maurice Maeterlinck',
};
