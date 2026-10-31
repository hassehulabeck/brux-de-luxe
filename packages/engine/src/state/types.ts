/**
 * The complete game state. Everything here is plain data (no classes, Maps or
 * functions), so a state can be saved as JSON, logged and undone.
 *
 * Hidden information: the stacks and decks are stored as unordered contents
 * (counts or lists), never as a shuffled order. What comes out of a draw is
 * decided by a ChanceOracle when the draw happens, so there is no deck order
 * for anyone to peek at.
 */

import type {
  ArtNouveauAction,
  BrusselsAction,
  CompassTile,
  GridPosition,
  NobleMaterial,
  PlayerCount,
  PublicFigureId,
  WorkColor,
  WorkOfArtColor,
} from '../data/types';
import type { RuleOptions } from '../rules/options';
import type { ArtNouveauSpace, Shield } from './coords';

/** Seat number, 0-based, clockwise. Seat 0 is the first player of round 1. */
export type PlayerIndex = number;

export type Phase = 'setup' | 'stockExchange' | 'action' | 'resolution' | 'gameOver';

export interface PublicFigureCard {
  figure: PublicFigureId;
  /** End-game cost printed on the card. */
  cost: number;
}

export interface KeptPublicFigure extends PublicFigureCard {
  /** Rotated 90°: used this round, can't be activated again until End of Turn. */
  rotated: boolean;
}

/** An Assistant pawn on the Art Nouveau board. */
export type Assistant =
  | { kind: 'player'; player: PlayerIndex; bid: number }
  /** 2-player game only (Appendix 3): never bids, returns to the player who placed it. */
  | { kind: 'neutral'; placedBy: PlayerIndex };

export interface ArtNouveauSpaceState {
  action: ArtNouveauAction;
  assistant: Assistant | null;
  building: PlayerIndex | null;
}

/** A rectangle of action spaces, inclusive bounds (0–4). */
export interface Area {
  rows: [number, number];
  cols: [number, number];
}

export interface Tracks {
  /** Space index on each track, 0 is the starting space. Values are in components.tracks. */
  cityHall: number;
  royalPalace: number;
  architect: number;
}

/** Where a player's 7 Assistant pawns are. The four numbers always add up to 7. */
export interface AssistantCounts {
  available: number;
  artNouveau: number;
  brussels: number;
  courthouse: number;
}

export interface PlayerState {
  bf: number;
  vp: number;
  works: Record<WorkOfArtColor, number>;
  nobles: Record<NobleMaterial, number>;
  jokers: number;
  publicFigures: KeptPublicFigure[];
  /** Years of the Exhibition tiles won. Each one gives +1 draw on Workshop actions. */
  exhibitions: number[];
  assistants: AssistantCounts;
  /** 2-player game: the neutral Assistant is in front of the player, ready to place. */
  hasNeutralAssistant: boolean;
  /** Building tiles moved from the Architect board to the Art Nouveau board (0–6). */
  buildingsBuilt: number;
  tracks: Tracks;
  /** Bonus card types tucked under each of the 4 rows of the Architect board (rows 1–4). */
  tucked: [number[], number[], number[], number[]];
}

export interface BrusselsUse {
  player: PlayerIndex;
  assistants: number;
}

export interface WonBonusCard {
  player: PlayerIndex;
  /** Index into components.bonusCards. */
  card: number;
  /** Won in a tie: central power only, the card is already discarded (p. 8). */
  tied: boolean;
}

export interface RoundState {
  /** 1–5. */
  number: number;
  /** Index into components.stockExchangeCards, or null before it is revealed. */
  stockExchangeCard: number | null;
  shield: Shield | null;
  area: Area | null;
  /** The player who took the last turn, or null at the start of the Action phase. */
  lastActor: PlayerIndex | null;
  /** Players who passed, in the order they passed. The first one took the Exhibition tile. */
  passed: PlayerIndex[];
  brussels: Record<BrusselsAction, BrusselsUse[]>;
  /** Bonus cards won this round and not yet used or tucked. */
  bonusWon: WonBonusCard[];
  /** Manneken Pis earned this round, per player (Resolution step 2). */
  mannekenPis: number[];
  /** Architect board rows (1–4) each player has tucked a card under this round. */
  tuckedRows: number[][];
}

export interface FinalScore {
  player: PlayerIndex;
  scoringTrack: number;
  buildings: number;
  /** Tucked rows 1–4. */
  rows: [number, number, number, number];
  nobleMaterials: number;
  mannekenPis: number;
  total: number;
}

export interface GameState {
  rules: RuleOptions;
  playerCount: PlayerCount;
  phase: Phase;
  /** Holder of the Manneken Pis pawn. */
  firstPlayer: PlayerIndex;
  players: PlayerState[];

  /** The Art Nouveau board, [row][col]. Empty until the strips are revealed. */
  board: ArtNouveauSpaceState[][];
  /** Strip id for each board row, top to bottom. */
  stripOrder: string[];
  /** The Bonus card type under each column, or null. */
  bonusStrip: (number | null)[];
  /** Copies left of each Bonus card type (index into components.bonusCards). */
  bonusDeck: number[];
  bonusDiscard: number[];

  workshopCursor: GridPosition;
  /** The two shop spaces, as stacks: the last tile is the visible one. */
  shop: [WorkOfArtColor[], WorkOfArtColor[]];
  /** Sales made so far this game. The first 2 must go on an empty shop space. */
  salesMade: number;
  workStacks: { color: Record<WorkColor, number>; black: number };

  compass: {
    /** The tile on each of the 6 compass spaces, clockwise. */
    tiles: CompassTile[];
    /** The compass space each needle points at. */
    needles: [number, number];
  };

  royalTheater: {
    /** Display position 0 is the free (rightmost) space, then 1, 2 and 3 BF. */
    display: (PublicFigureCard | null)[];
    deck: PublicFigureCard[];
    discard: PublicFigureCard[];
    /** Unpaid at the end of the game: back to the box. */
    boxed: PublicFigureCard[];
  };

  supply: { nobles: Record<NobleMaterial, number>; jokers: number };

  stockExchange: { deck: number[]; discard: number[] };

  round: RoundState;

  /** Work still to do, as a stack (the last step runs first). See rules/steps.ts. */
  steps: Step[];
  /**
   * Who must decide what next. Only null for a moment inside apply(), while
   * the engine works out the next decision. A state you receive always has one.
   */
  pending: Pending | null;

  final: FinalScore[] | null;
}

// ---------------------------------------------------------------------------
// Chance events: resolved by a ChanceOracle (seeded RNG, or the table).
// ---------------------------------------------------------------------------

export type ChanceEvent =
  | { kind: 'arrangeStrips' }
  | { kind: 'placeCompassTiles' }
  | { kind: 'drawPublicFigure' }
  | { kind: 'drawWorks'; player: PlayerIndex; count: number; reason: 'setup' | 'workshop' }
  | { kind: 'drawStockExchangeCard' }
  | { kind: 'drawBonusCard'; column: number };

// ---------------------------------------------------------------------------
// Pending decisions. `legalMoves(state)` lists the moves for the pending one.
// ---------------------------------------------------------------------------

export type Pending =
  | { kind: 'chance'; event: ChanceEvent }
  | { kind: 'chooseShield'; player: PlayerIndex; options: [Shield, Shield] }
  | { kind: 'placeNeutral'; player: PlayerIndex }
  | { kind: 'turn'; player: PlayerIndex }
  | {
      kind: 'performOrSkip';
      player: PlayerIndex;
      action: ArtNouveauAction;
      /** The space the Assistant went on, or null for the Fiftieth Anniversary Park. */
      space: ArtNouveauSpace | null;
    }
  | { kind: 'chooseParkAction'; player: PlayerIndex }
  | { kind: 'keepWork'; player: PlayerIndex; drawn: WorkColor[] }
  | { kind: 'moveCursor'; player: PlayerIndex }
  | { kind: 'sellWork'; player: PlayerIndex }
  | { kind: 'placeInShop'; player: PlayerIndex; color: WorkOfArtColor }
  | { kind: 'takePublicFigure'; player: PlayerIndex }
  | { kind: 'keepPublicFigure'; player: PlayerIndex; card: PublicFigureCard }
  | { kind: 'takeMaterials'; player: PlayerIndex; count: number }
  | { kind: 'solvay'; player: PlayerIndex }
  | { kind: 'payConstruction'; player: PlayerIndex }
  | { kind: 'turnNeedle'; player: PlayerIndex }
  | { kind: 'placeBuilding'; player: PlayerIndex }
  | { kind: 'activatePublicFigure'; player: PlayerIndex; remaining: number }
  | { kind: 'resolveBonus'; player: PlayerIndex }
  | { kind: 'payPublicFigures'; player: PlayerIndex }
  | { kind: 'gameOver' };

// ---------------------------------------------------------------------------
// Steps: the engine's to-do list. A step either does its work at once or
// sets a pending decision. See rules/steps.ts.
// ---------------------------------------------------------------------------

export type Step =
  | { kind: 'arrangeStrips' }
  | { kind: 'placeCompassTiles' }
  | { kind: 'fillRoyalTheater' }
  | { kind: 'drawStartingWork'; player: PlayerIndex }
  | { kind: 'dealBonusCards' }
  | { kind: 'startRound' }
  | { kind: 'drawStockExchangeCard' }
  | { kind: 'chooseShield' }
  | { kind: 'placeNeutral'; player: PlayerIndex }
  | { kind: 'nextTurn' }
  | { kind: 'secondaryAction'; owner: PlayerIndex; action: ArtNouveauAction }
  | { kind: 'publicFigureEffect'; player: PlayerIndex; figure: PublicFigureId }
  | { kind: 'keepPublicFigure'; player: PlayerIndex; card: PublicFigureCard }
  | { kind: 'activatePublicFigures'; player: PlayerIndex; remaining: number }
  | { kind: 'resolveBids' }
  | { kind: 'chooseFirstPlayer' }
  | { kind: 'resolveBonusCards'; player: PlayerIndex }
  | { kind: 'scoreShields' }
  | { kind: 'brusselsMajority' }
  | { kind: 'endOfRound' }
  | { kind: 'payPublicFigures'; player: PlayerIndex }
  | { kind: 'finalScoring' };
