/**
 * Turns the raw JSON in `json/` into typed, checked component data.
 *
 * Every value that still says "TODO_DATA" is reported as *missing*.
 * Every value that is filled in but invalid (wrong type, out of range, wrong
 * total) is reported as an *error* with its path, e.g.
 *   stockExchangeCards[3].shields.4[1].row: expected a whole number from 1 to 4, got 5
 *
 * Small `read…` helpers do the work. Each one returns the typed value, or
 * `undefined` after recording what was wrong in the report.
 */

import {
  ACTION_SPACES_PER_STRIP,
  ACTION_STRIP_COUNT,
  BONUS_CARD_COUNT,
  COMPASS_SPACE_COUNT,
  EXHIBITION_TILE_COUNT,
  FIRST_EXHIBITION_YEAR,
  LAST_EXHIBITION_YEAR,
  MAX_MANNEKEN_PIS_PER_BONUS_CARD,
  PUBLIC_FIGURE_CARD_COUNT,
  STARTING_BRUGMANN_CARD_COUNT,
  STOCK_EXCHANGE_CARD_COUNT,
  WORK_OF_ART_TILE_COUNT,
} from './rulebook';
import {
  ART_NOUVEAU_ACTIONS,
  BONUS_EFFECTS,
  PLAYER_COUNTS,
  PUBLIC_FIGURES,
  WORK_COLORS,
  type ActionStripsData,
  type BonusCardType,
  type BonusPower,
  type CompassData,
  type Components,
  type ExhibitionsData,
  type GridPosition,
  type PlayerCount,
  type PublicFiguresData,
  type StockExchangeCard,
  type TracksData,
  type WorkColor,
  type WorksOfArtData,
  type WorkshopData,
} from './types';
import { SHIELD_COUNT_PER_SIDE, type Shield } from '../state/coords';

export const TODO_DATA = 'TODO_DATA';

export interface DataReport {
  /** Paths whose value is still "TODO_DATA". */
  missing: string[];
  /** Values that are filled in but wrong. */
  errors: string[];
}

/** The JSON files, before validation. Same keys as `Components`. */
export type RawComponents = Record<keyof Components, unknown>;

export interface ValidationResult {
  /** Only set when nothing is missing and there are no errors. */
  components: Components | undefined;
  report: DataReport;
}

export function validateComponents(raw: RawComponents): ValidationResult {
  const report: DataReport = { missing: [], errors: [] };

  const components = {
    actionStrips: readActionStrips(report, 'actionStrips', raw.actionStrips),
    workshop: readWorkshop(report, 'workshop', raw.workshop),
    tracks: readTracks(report, 'tracks', raw.tracks),
    compass: readCompass(report, 'compass', raw.compass),
    stockExchangeCards: readStockExchangeCards(
      report,
      'stockExchangeCards',
      raw.stockExchangeCards,
    ),
    bonusCards: readBonusCards(report, 'bonusCards', raw.bonusCards),
    publicFigures: readPublicFigures(report, 'publicFigures', raw.publicFigures),
    worksOfArt: readWorksOfArt(report, 'worksOfArt', raw.worksOfArt),
    exhibitions: readExhibitions(report, 'exhibitions', raw.exhibitions),
  };

  const isComplete = report.missing.length === 0 && report.errors.length === 0;
  return { components: isComplete ? (components as Components) : undefined, report };
}

// ---------------------------------------------------------------------------
// Generic readers
// ---------------------------------------------------------------------------

/** Reads one value at `path`. Returns undefined if it is missing or invalid. */
type Reader<T> = (report: DataReport, path: string, value: unknown) => T | undefined;

function isTodo(report: DataReport, path: string, value: unknown): boolean {
  if (value === TODO_DATA) {
    report.missing.push(path);
    return true;
  }
  return false;
}

function fail(report: DataReport, path: string, message: string): undefined {
  report.errors.push(`${path}: ${message}`);
  return undefined;
}

function expected(what: string, value: unknown): string {
  return `expected ${what}, got ${JSON.stringify(value)}`;
}

function readInt(min: number, max: number): Reader<number> {
  return (report, path, value) => {
    if (isTodo(report, path, value)) return undefined;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      return fail(report, path, expected(`a whole number from ${min} to ${max}`, value));
    }
    return value;
  };
}

function readText(): Reader<string> {
  return (report, path, value) => {
    if (isTodo(report, path, value)) return undefined;
    if (typeof value !== 'string' || value.trim() === '') {
      return fail(report, path, expected('a non-empty text', value));
    }
    return value;
  };
}

function readOneOf<T extends string>(allowed: readonly T[]): Reader<T> {
  return (report, path, value) => {
    if (isTodo(report, path, value)) return undefined;
    if (!allowed.includes(value as T)) {
      return fail(report, path, expected(`one of ${allowed.join(', ')}`, value));
    }
    return value as T;
  };
}

interface Length {
  min: number;
  max: number;
}

function readList<T>(item: Reader<T>, length: Length): Reader<T[]> {
  return (report, path, value) => {
    if (isTodo(report, path, value)) return undefined;
    if (!Array.isArray(value)) return fail(report, path, expected('a list [ ... ]', value));
    if (value.length < length.min || value.length > length.max) {
      const size = length.min === length.max ? `${length.min}` : `${length.min} to ${length.max}`;
      return fail(report, path, `expected ${size} entries, got ${value.length}`);
    }
    // Read every entry (not just until the first problem) so the report is complete.
    const items = value.map((entry, i) => item(report, `${path}[${i}]`, entry));
    return items.every((entry) => entry !== undefined) ? (items as T[]) : undefined;
  };
}

function readPair<T>(item: Reader<T>): Reader<[T, T]> {
  return readList(item, { min: 2, max: 2 }) as Reader<[T, T]>;
}

/** Reads an object with exactly the given fields. Extra fields are not allowed (they are usually typos). */
function readObject<T extends object>(fields: { [K in keyof T]: Reader<T[K]> }): Reader<T> {
  return (report, path, value) => {
    if (isTodo(report, path, value)) return undefined;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(report, path, expected('an object { ... }', value));
    }
    const input = value as Record<string, unknown>;
    const fieldNames = Object.keys(fields);
    for (const key of Object.keys(input)) {
      if (!fieldNames.includes(key)) fail(report, `${path}.${key}`, 'unknown field (typo?)');
    }

    const result: Record<string, unknown> = {};
    let ok = true;
    for (const key of fieldNames) {
      const reader = fields[key as keyof T];
      if (!(key in input)) {
        fail(report, `${path}.${key}`, 'field is missing');
        ok = false;
        continue;
      }
      const fieldValue = reader(report, `${path}.${key}`, input[key]);
      if (fieldValue === undefined) ok = false;
      result[key] = fieldValue;
    }
    return ok ? (result as T) : undefined;
  };
}

/** Builds the field readers for a `Record<K, T>` with a fixed set of keys. */
function fieldsFor<K extends PropertyKey, T>(keys: readonly K[], reader: Reader<T>) {
  return Object.fromEntries(keys.map((key) => [key, reader])) as { [P in K]: Reader<T> };
}

// Generous upper bounds that only exist to catch typos (e.g. 55 instead of 5).
const MAX_VALUE = 99;
const MAX_GRID_SIZE = 20;
const MAX_TRACK_LENGTH = 30;

// ---------------------------------------------------------------------------
// Component readers
// ---------------------------------------------------------------------------

const readActionStripsShape = readObject<ActionStripsData>({
  orientation: readOneOf(['row', 'column'] as const),
  strips: readList(
    readObject({
      id: readText(),
      basicSide: readList(readOneOf(ART_NOUVEAU_ACTIONS), {
        min: ACTION_SPACES_PER_STRIP,
        max: ACTION_SPACES_PER_STRIP,
      }),
    }),
    { min: ACTION_STRIP_COUNT, max: ACTION_STRIP_COUNT },
  ),
});

function readActionStrips(report: DataReport, path: string, value: unknown) {
  const data = readActionStripsShape(report, path, value);
  if (data) {
    const ids = data.strips.map((strip) => strip.id);
    if (new Set(ids).size !== ids.length)
      fail(report, `${path}.strips`, 'strip ids must be unique');
  }
  return data;
}

const readGridPosition = readObject<GridPosition>({
  row: readInt(0, MAX_GRID_SIZE - 1),
  col: readInt(0, MAX_GRID_SIZE - 1),
});

const readGridOffset = readObject<GridPosition>({
  row: readInt(-MAX_GRID_SIZE, MAX_GRID_SIZE),
  col: readInt(-MAX_GRID_SIZE, MAX_GRID_SIZE),
});

const readWorkshopShape = readObject<WorkshopData>({
  bfByRow: readList(readInt(0, MAX_VALUE), { min: 1, max: MAX_GRID_SIZE }),
  vpByColumn: readList(readInt(0, MAX_VALUE), { min: 1, max: MAX_GRID_SIZE }),
  cursorStart: readGridPosition,
  dots: readObject<Record<WorkColor, GridPosition>>(fieldsFor(WORK_COLORS, readGridOffset)),
});

function readWorkshop(report: DataReport, path: string, value: unknown) {
  const data = readWorkshopShape(report, path, value);
  if (!data) return undefined;

  const rows = data.bfByRow.length;
  const cols = data.vpByColumn.length;
  const isOnGrid = (p: GridPosition) => p.row >= 0 && p.row < rows && p.col >= 0 && p.col < cols;

  if (!isOnGrid(data.cursorStart)) {
    fail(report, `${path}.cursorStart`, `is outside the ${rows}×${cols} grid`);
  }
  const offsets = WORK_COLORS.map((color) => `${data.dots[color].row},${data.dots[color].col}`);
  if (offsets.includes('0,0')) {
    fail(report, `${path}.dots`, 'a colored dot cannot be at the center (that is the black dot)');
  }
  if (new Set(offsets).size !== offsets.length) {
    fail(report, `${path}.dots`, 'two colored dots have the same position');
  }
  for (const color of WORK_COLORS) {
    const dot = {
      row: data.cursorStart.row + data.dots[color].row,
      col: data.cursorStart.col + data.dots[color].col,
    };
    if (!isOnGrid(dot)) {
      fail(report, `${path}.dots.${color}`, 'is outside the grid when the cursor is at its start');
    }
  }
  return data;
}

const readTrack = readList(readInt(0, MAX_VALUE), { min: 1, max: MAX_TRACK_LENGTH });

const readTracks = readObject<TracksData>({
  cityHall: readTrack,
  royalPalace: readTrack,
  architect: readTrack,
});

function readCompass(report: DataReport, path: string, value: unknown) {
  const data = readObject<CompassData>({
    needleStart: readPair(readInt(0, COMPASS_SPACE_COUNT - 1)),
  })(report, path, value);
  if (data && data.needleStart[0] === data.needleStart[1]) {
    fail(report, `${path}.needleStart`, 'the needles must point at different spaces');
  }
  return data;
}

const readShield = readObject<Shield>({
  row: readInt(1, SHIELD_COUNT_PER_SIDE),
  col: readInt(1, SHIELD_COUNT_PER_SIDE),
});

const readStockExchangeCard = readObject<StockExchangeCard>({
  id: readInt(1, STOCK_EXCHANGE_CARD_COUNT),
  bf: readInt(0, MAX_VALUE),
  shields: readObject<Record<PlayerCount, [Shield, Shield]>>(
    fieldsFor(PLAYER_COUNTS, readPair(readShield)),
  ),
});

function readStockExchangeCards(report: DataReport, path: string, value: unknown) {
  const cards = readList(readStockExchangeCard, {
    min: STOCK_EXCHANGE_CARD_COUNT,
    max: STOCK_EXCHANGE_CARD_COUNT,
  })(report, path, value);
  if (cards) {
    const ids = cards.map((card) => card.id);
    if (new Set(ids).size !== ids.length) fail(report, path, 'card ids must be unique');
  }
  return cards;
}

const readBonusEffect = readOneOf(BONUS_EFFECTS);

const BONUS_POWER_READERS = {
  single: readObject<Extract<BonusPower, { kind: 'single' }>>({
    kind: readOneOf(['single'] as const),
    effect: readBonusEffect,
  }),
  choice: readObject<Extract<BonusPower, { kind: 'choice' }>>({
    kind: readOneOf(['choice'] as const),
    options: readPair(readBonusEffect),
  }),
  double: readObject<Extract<BonusPower, { kind: 'double' }>>({
    kind: readOneOf(['double'] as const),
    effects: readPair(readBonusEffect),
  }),
};

/** A Bonus power has one of three shapes. Its `kind` field says which. */
function readBonusPower(report: DataReport, path: string, value: unknown): BonusPower | undefined {
  if (isTodo(report, path, value)) return undefined;
  const kind = (value as { kind?: unknown } | null)?.kind;
  if (kind === 'single' || kind === 'choice' || kind === 'double') {
    return BONUS_POWER_READERS[kind](report, path, value);
  }
  return fail(report, `${path}.kind`, expected('one of single, choice, double', kind));
}

function readBonusCards(report: DataReport, path: string, value: unknown) {
  const types = readList(
    readObject<BonusCardType>({
      copies: readInt(1, BONUS_CARD_COUNT),
      mannekenPis: readInt(0, MAX_MANNEKEN_PIS_PER_BONUS_CARD),
      vpSymbols: readInt(0, MAX_VALUE),
      power: readBonusPower,
    }),
    { min: 1, max: BONUS_CARD_COUNT },
  )(report, path, value);
  if (types) {
    const total = types.reduce((sum, type) => sum + type.copies, 0);
    if (total !== BONUS_CARD_COUNT) {
      fail(
        report,
        path,
        `copies add up to ${total}, but the game has ${BONUS_CARD_COUNT} Bonus cards`,
      );
    }
  }
  return types;
}

function readPublicFigures(report: DataReport, path: string, value: unknown) {
  const data = readObject<PublicFiguresData>({
    startingBrugmannCost: readInt(0, MAX_VALUE),
    deck: readList(
      readObject({
        figure: readOneOf(PUBLIC_FIGURES),
        costs: readList(readInt(0, MAX_VALUE), { min: 0, max: PUBLIC_FIGURE_CARD_COUNT }),
      }),
      { min: 1, max: PUBLIC_FIGURES.length },
    ),
  })(report, path, value);
  if (!data) return undefined;

  // Brugmann cards are only dealt at setup and are never in the deck (rules-questions.md Q12).
  const brugmannInDeck = data.deck.find((entry) => entry.figure === 'georgesBrugmann');
  if (brugmannInDeck && brugmannInDeck.costs.length > 0) {
    fail(report, `${path}.deck`, 'Georges Brugmann cards are never in the deck, use "costs": []');
  }

  const figures = data.deck.map((entry) => entry.figure);
  if (new Set(figures).size !== figures.length) {
    fail(
      report,
      `${path}.deck`,
      'each figure may only be listed once (put all its costs in one list)',
    );
  }
  const deckCards = data.deck.reduce((sum, entry) => sum + entry.costs.length, 0);
  const total = deckCards + STARTING_BRUGMANN_CARD_COUNT;
  if (total !== PUBLIC_FIGURE_CARD_COUNT) {
    fail(
      report,
      `${path}.deck`,
      `${deckCards} deck cards + ${STARTING_BRUGMANN_CARD_COUNT} starting Brugmann cards = ${total}, but the game has ${PUBLIC_FIGURE_CARD_COUNT} Public Figure cards`,
    );
  }
  return data;
}

function readWorksOfArt(report: DataReport, path: string, value: unknown) {
  const readCount = readInt(0, WORK_OF_ART_TILE_COUNT);
  const data = readObject<WorksOfArtData>({
    colorTiles: readObject<Record<WorkColor, number>>(fieldsFor(WORK_COLORS, readCount)),
    blackTiles: readCount,
  })(report, path, value);
  if (data) {
    const colorTotal = WORK_COLORS.reduce((sum, color) => sum + data.colorTiles[color], 0);
    const total = colorTotal + data.blackTiles;
    if (total !== WORK_OF_ART_TILE_COUNT) {
      fail(report, path, `tiles add up to ${total}, but the game has ${WORK_OF_ART_TILE_COUNT}`);
    }
  }
  return data;
}

function readExhibitions(report: DataReport, path: string, value: unknown) {
  const data = readObject<ExhibitionsData>({
    years: readList(readInt(FIRST_EXHIBITION_YEAR, LAST_EXHIBITION_YEAR), {
      min: EXHIBITION_TILE_COUNT,
      max: EXHIBITION_TILE_COUNT,
    }),
  })(report, path, value);
  if (data) {
    const ascending = data.years.every((year, i) => i === 0 || year > (data.years[i - 1] ?? 0));
    if (!ascending) fail(report, `${path}.years`, 'years must be in round order (ascending)');
    if (data.years[0] !== FIRST_EXHIBITION_YEAR || data.years.at(-1) !== LAST_EXHIBITION_YEAR) {
      fail(
        report,
        `${path}.years`,
        `the rulebook says the years run from ${FIRST_EXHIBITION_YEAR} to ${LAST_EXHIBITION_YEAR}`,
      );
    }
  }
  return data;
}
