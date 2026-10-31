/**
 * Every decision in the game is a Move: plain JSON data with a `kind`.
 * Chance outcomes (what was drawn or revealed) are Moves too, so a game log
 * is just the list of moves and replays exactly.
 */

import type {
  ArtNouveauAction,
  BonusEffect,
  BrusselsAction,
  CompassTile,
  GridPosition,
  NobleMaterial,
  WorkColor,
  WorkOfArtColor,
} from '../data/types';
import type { ArtNouveauSpace, Shield } from '../state/coords';
import type { PublicFigureCard } from '../state/types';

/** What a player hands over for a Construction (rulebook p. 6–7). */
export interface ConstructionPayment {
  wood: number;
  stone: number;
  iron: number;
  bf: number;
  jokers: number;
}

export type ChanceMove =
  | { kind: 'revealStrips'; order: string[] }
  | { kind: 'revealCompassTiles'; tiles: CompassTile[] }
  | { kind: 'revealPublicFigure'; card: PublicFigureCard }
  /** Sorted in WORK_COLORS order. */
  | { kind: 'revealWorks'; colors: WorkColor[] }
  | { kind: 'revealStockExchangeCard'; card: number }
  | { kind: 'revealBonusCard'; card: number };

export type PlayerMove =
  // Stock Exchange phase
  | { kind: 'chooseShield'; shield: Shield }
  | { kind: 'placeNeutral'; space: ArtNouveauSpace }
  // A turn in the Action phase
  | { kind: 'placeAssistant'; space: ArtNouveauSpace; bid: number }
  | { kind: 'takeBrusselsAction'; action: BrusselsAction }
  | { kind: 'pass' }
  // Performing an action
  | { kind: 'performAction' }
  | { kind: 'skipAction' }
  | { kind: 'chooseParkAction'; action: ArtNouveauAction }
  | { kind: 'keepWork'; color: WorkColor }
  | { kind: 'moveCursor'; to: GridPosition }
  | { kind: 'sellWork'; color: WorkOfArtColor }
  | { kind: 'placeInShop'; slot: 0 | 1 }
  | { kind: 'takePublicFigure'; position: number }
  | { kind: 'keepPublicFigure' }
  | { kind: 'discardPublicFigure' }
  | { kind: 'takeMaterials'; materials: NobleMaterial[] }
  | { kind: 'solvayTake'; material: NobleMaterial }
  | { kind: 'solvayExchange'; materials: [NobleMaterial, NobleMaterial] }
  | { kind: 'payConstruction'; payment: ConstructionPayment }
  | { kind: 'turnNeedle'; needle: 0 | 1 }
  | { kind: 'placeBuilding'; space: ArtNouveauSpace }
  | { kind: 'activatePublicFigure'; index: number }
  | { kind: 'stopActivating' }
  // Resolution of the Turn
  /** `card` is an index into round.bonusWon. `choice` is set for "choice" cards only. */
  | { kind: 'useBonus'; card: number; choice: BonusEffect | null }
  | { kind: 'tuckBonus'; card: number; row: 1 | 2 | 3 | 4 }
  // End of the game: indexes into the player's publicFigures that are not paid.
  | { kind: 'payPublicFigures'; unpaid: number[] };

export type Move = ChanceMove | PlayerMove;

/** Moves are compared by value: same kind and same fields, in any key order. */
export function sameMove(a: Move, b: Move): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
