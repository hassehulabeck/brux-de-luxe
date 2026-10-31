/**
 * Small shared helpers for the rules. `apply()` works on a private deep copy
 * of the state (a "draft"), so the functions that take a `draft` may change it.
 * Functions that take a `state` only read it.
 */

import { loadComponents } from '../data/components';
import {
  NOBLE_MATERIALS,
  WORK_COLORS,
  type Components,
  type GridPosition,
  type WorkOfArtColor,
} from '../data/types';
import { BUILDING_ROWS } from '../data/rulebook';
import { BOARD_SIZE, type ArtNouveauSpace } from '../state/coords';
import type { Area, GameState, PlayerIndex, PlayerState, Step } from '../state/types';

let cachedComponents: Components | undefined;

/** The transcribed component data, loaded and validated once. */
export function components(): Components {
  cachedComponents ??= loadComponents();
  return cachedComponents;
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function player(state: GameState, index: PlayerIndex): PlayerState {
  const found = state.players[index];
  if (!found) throw new Error(`No player ${index}`);
  return found;
}

/** Seats in clockwise order, starting with `from`. */
export function seatsFrom(state: GameState, from: PlayerIndex): PlayerIndex[] {
  return Array.from({ length: state.playerCount }, (_, i) => (from + i) % state.playerCount);
}

/** Push steps so that they run in the order given. */
export function pushSteps(draft: GameState, steps: Step[]): void {
  for (let i = steps.length - 1; i >= 0; i--) draft.steps.push(steps[i]!);
}

export function allSpaces(): ArtNouveauSpace[] {
  const spaces: ArtNouveauSpace[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) spaces.push({ row, col });
  }
  return spaces;
}

export function spaceAt(state: GameState, space: ArtNouveauSpace) {
  const found = state.board[space.row]?.[space.col];
  if (!found) throw new Error(`No action space (${space.row}, ${space.col})`);
  return found;
}

export function isInArea(area: Area | null, space: ArtNouveauSpace): boolean {
  if (!area) return false;
  return (
    space.row >= area.rows[0] &&
    space.row <= area.rows[1] &&
    space.col >= area.cols[0] &&
    space.col <= area.cols[1]
  );
}

export function sameSpace(a: GridPosition, b: GridPosition): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Total Works of Art a player has, black included. */
export function workCount(p: PlayerState): number {
  return [...WORK_COLORS, 'black' as const].reduce((sum, color) => sum + p.works[color], 0);
}

/** Number of different Work of Art colors a player has, black included (max 5). */
export function workColorCount(p: PlayerState): number {
  return [...WORK_COLORS, 'black' as const].filter((color: WorkOfArtColor) => p.works[color] > 0)
    .length;
}

export function nobleCount(p: PlayerState): number {
  return NOBLE_MATERIALS.reduce((sum, m) => sum + p.nobles[m], 0);
}

/** The Architect board row of the next Building tile, or undefined when all 6 are built. */
export function nextBuildingRow(p: PlayerState) {
  return BUILDING_ROWS[Math.floor(p.buildingsBuilt / 2)];
}

/** Buildings this player has on the Art Nouveau board. */
export function buildingsOnBoard(state: GameState, owner: PlayerIndex): number {
  return state.board.flat().filter((s) => s.building === owner).length;
}

/** Track value at the player's current space (tracks are capped at their last space). */
export function trackValue(
  state: GameState,
  owner: PlayerIndex,
  track: 'cityHall' | 'royalPalace' | 'architect',
): number {
  const values = components().tracks[track];
  return values[Math.min(player(state, owner).tracks[track], values.length - 1)] ?? 0;
}

/**
 * Advance a track by one space. At the last space nothing happens
 * (docs/rules-questions.md Q18).
 */
export function advanceTrack(
  draft: GameState,
  owner: PlayerIndex,
  track: 'cityHall' | 'royalPalace' | 'architect',
): void {
  const p = player(draft, owner);
  const last = components().tracks[track].length - 1;
  p.tracks[track] = Math.min(p.tracks[track] + 1, last);
}

/** Retrieve one Assistant from the Courthouse, if there is one. It is available at once. */
export function retrieveFromCourthouse(draft: GameState, owner: PlayerIndex): void {
  const p = player(draft, owner);
  if (p.assistants.courthouse > 0) {
    p.assistants.courthouse--;
    p.assistants.available++;
  }
}

/** Take up to `count` Jokers from the limited supply. */
export function gainJokers(draft: GameState, owner: PlayerIndex, count: number): void {
  const taken = Math.min(count, draft.supply.jokers);
  draft.supply.jokers -= taken;
  player(draft, owner).jokers += taken;
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
