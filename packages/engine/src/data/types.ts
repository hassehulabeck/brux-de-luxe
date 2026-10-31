/**
 * The vocabulary of the game, named after the rulebook, plus the shape of the
 * component data in `json/`. The values themselves are never written here.
 */

import type { Shield } from '../state/coords';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const ART_NOUVEAU_ACTIONS = [
  'workshop',
  'sale',
  'royalTheater',
  'materials',
  'construction',
] as const;
export type ArtNouveauAction = (typeof ART_NOUVEAU_ACTIONS)[number];

export const BRUSSELS_ACTIONS = ['market', 'stockExchange', 'park', 'grandPlaza'] as const;
export type BrusselsAction = (typeof BRUSSELS_ACTIONS)[number];

/** The four colors of the color Works of Art stack. */
export const WORK_COLORS = ['blue', 'pink', 'yellow', 'green'] as const;
export type WorkColor = (typeof WORK_COLORS)[number];

/** Black works come from their own stack (Workshop secondary action). */
export type WorkOfArtColor = WorkColor | 'black';

export const NOBLE_MATERIALS = ['wood', 'stone', 'iron'] as const;
export type NobleMaterial = (typeof NOBLE_MATERIALS)[number];

/** The six compass tiles (rulebook p. 6). */
export const COMPASS_TILES = ['wood', 'stone', 'iron', 'anyNoble', 'threeBf', 'empty'] as const;
export type CompassTile = (typeof COMPASS_TILES)[number];

/** The four central powers of Bonus cards (rulebook p. 8). */
export const BONUS_EFFECTS = ['cityHall', 'courthouse', 'royalPalace', 'architect'] as const;
export type BonusEffect = (typeof BONUS_EFFECTS)[number];

export const PUBLIC_FIGURES = [
  'georgesBrugmann',
  'ernestSolvay',
  'charlesBuls',
  'henryVanDeVelde',
  'edouardEmpain',
  'princeAlbert',
  'emileVandervelde',
  'mauriceMaeterlinck',
] as const;
export type PublicFigureId = (typeof PUBLIC_FIGURES)[number];

export const PLAYER_COUNTS = [2, 3, 4, 5] as const;
export type PlayerCount = (typeof PLAYER_COUNTS)[number];

// ---------------------------------------------------------------------------
// Component data (validated, complete). See docs/data-entry-guide.md.
// ---------------------------------------------------------------------------

/** Whether the strips form the rows or the columns of the Art Nouveau board. */
export type StripOrientation = 'row' | 'column';

export interface ActionStrip {
  /** The identifier printed on the strip, or the label Hans gives it. */
  id: string;
  /**
   * The 5 actions on the basic side (without the special symbol).
   * Row strips: left to right. Column strips: top to bottom.
   */
  basicSide: ArtNouveauAction[];
}

export interface ActionStripsData {
  orientation: StripOrientation;
  strips: ActionStrip[];
}

/** A position in the Workshop grid. Zero-based, row 0 is the top row. */
export interface GridPosition {
  row: number;
  col: number;
}

export interface WorkshopData {
  /** BF income for each grid row, top to bottom. */
  bfByRow: number[];
  /** VP income for each grid column, left to right. */
  vpByColumn: number[];
  /** Where the cursor's center sits at setup. */
  cursorStart: GridPosition;
  /** Offset of each colored dot from the cursor center. Black uses the center itself. */
  dots: Record<WorkColor, GridPosition>;
}

export interface TracksData {
  /** VP per shield majority, for each City Hall space from the starting shield. */
  cityHall: number[];
  /** Max Public Figures per Grand Plaza action, for each Royal Palace space from the start. */
  royalPalace: number[];
  /** End-game VP per building, for each Architect track space from the start. */
  architect: number[];
}

export interface CompassData {
  /** Compass spaces (0–5, clockwise) the two needles point at during setup. */
  needleStart: [number, number];
}

export interface StockExchangeCard {
  /** Our own numbering, 1–12. Not printed on the cards. */
  id: number;
  /** Money for the Stock Exchange action (top of the card). */
  bf: number;
  /** The two shields the first player chooses between, per player count. */
  shields: Record<PlayerCount, [Shield, Shield]>;
}

export type BonusPower =
  | { kind: 'single'; effect: BonusEffect }
  | { kind: 'choice'; options: [BonusEffect, BonusEffect] }
  | { kind: 'double'; effects: [BonusEffect, BonusEffect] };

/** One kind of Bonus card. Identical cards are entered once, with `copies`. */
export interface BonusCardType {
  copies: number;
  mannekenPis: number;
  /** VP symbols used when tucked. 0 means the card can't be tucked. */
  vpSymbols: number;
  power: BonusPower;
}

export interface PublicFigureDeckEntry {
  figure: PublicFigureId;
  /** End-game cost of each physical card of this figure in the shuffled deck. */
  costs: number[];
}

export interface PublicFiguresData {
  /** End-game cost printed on the starting Georges Brugmann cards. */
  startingBrugmannCost: number;
  deck: PublicFigureDeckEntry[];
}

export interface WorksOfArtData {
  colorTiles: Record<WorkColor, number>;
  blackTiles: number;
}

export interface ExhibitionsData {
  /** The year on each Exhibition tile, in round order. */
  years: number[];
}

/** All transcribed component data, fully filled in and validated. */
export interface Components {
  actionStrips: ActionStripsData;
  workshop: WorkshopData;
  tracks: TracksData;
  compass: CompassData;
  stockExchangeCards: StockExchangeCard[];
  bonusCards: BonusCardType[];
  publicFigures: PublicFiguresData;
  worksOfArt: WorksOfArtData;
  exhibitions: ExhibitionsData;
}
