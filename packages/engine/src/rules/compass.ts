/**
 * Compass rules (rulebook p. 6–7): which payments a Construction allows, and
 * how the needles turn.
 */

import { COMPASS_BF_PER_UNIT } from '../data/rulebook';
import { NOBLE_MATERIALS, type CompassTile, type NobleMaterial } from '../data/types';
import type { GameState, PlayerState } from '../state/types';
import type { ConstructionPayment } from './moves';
import { canonicalJson } from './moves';

const COMPASS_SPACES = 6;

/** The tiles the two needles point at. */
export function needleTiles(state: GameState): [CompassTile, CompassTile] {
  const [a, b] = state.compass.needles.map((space) => state.compass.tiles[space]);
  if (!a || !b) throw new Error('The compass tiles are not placed');
  return [a, b];
}

/**
 * Every distinct payment for `units` construction units with the two needle
 * tiles, before checking what the player can afford.
 *
 * - Both unit types must be used, in any split, unless one needle points at
 *   the empty space: then the other type pays for everything.
 * - Any unit may be a Joker instead (Q6).
 * - "1 noble material of your choice" may be paid with any Noble Material.
 * - "3 BF" units cost 3 BF each.
 */
export function constructionPayments(
  tiles: [CompassTile, CompassTile],
  units: number,
): ConstructionPayment[] {
  const [a, b] = tiles;
  const splits: [number, number][] = [];
  if (a === 'empty') splits.push([0, units]);
  else if (b === 'empty') splits.push([units, 0]);
  else for (let first = 1; first < units; first++) splits.push([first, units - first]);

  const found = new Map<string, ConstructionPayment>();
  for (const [unitsA, unitsB] of splits) {
    for (const partA of payWithTile(a, unitsA)) {
      for (const partB of payWithTile(b, unitsB)) {
        const payment = addPayments(partA, partB);
        found.set(canonicalJson(payment), payment);
      }
    }
  }
  return [...found.values()];
}

export function canAfford(p: PlayerState, payment: ConstructionPayment): boolean {
  return (
    p.nobles.wood >= payment.wood &&
    p.nobles.stone >= payment.stone &&
    p.nobles.iron >= payment.iron &&
    p.bf >= payment.bf &&
    p.jokers >= payment.jokers
  );
}

/** The needles a player may turn: one space clockwise, never onto the other needle (Q5). */
export function turnableNeedles(state: GameState): (0 | 1)[] {
  const [a, b] = state.compass.needles;
  const result: (0 | 1)[] = [];
  if ((a + 1) % COMPASS_SPACES !== b) result.push(0);
  if ((b + 1) % COMPASS_SPACES !== a) result.push(1);
  return result;
}

export function turnNeedle(draft: GameState, needle: 0 | 1): void {
  draft.compass.needles[needle] = (draft.compass.needles[needle] + 1) % COMPASS_SPACES;
}

const NOTHING: ConstructionPayment = { wood: 0, stone: 0, iron: 0, bf: 0, jokers: 0 };

/** All ways to pay `units` units of one tile type, each unit either real or a Joker. */
function payWithTile(tile: CompassTile, units: number): ConstructionPayment[] {
  if (units === 0) return [NOTHING];
  const result: ConstructionPayment[] = [];
  for (let jokers = 0; jokers <= units; jokers++) {
    const real = units - jokers;
    for (const part of payRealUnits(tile, real)) result.push({ ...part, jokers });
  }
  return result;
}

function payRealUnits(tile: CompassTile, units: number): ConstructionPayment[] {
  switch (tile) {
    case 'wood':
    case 'stone':
    case 'iron':
      return [{ ...NOTHING, [tile]: units }];
    case 'threeBf':
      return [{ ...NOTHING, bf: units * COMPASS_BF_PER_UNIT }];
    case 'anyNoble':
      return nobleSplits(units).map((split) => ({ ...NOTHING, ...split }));
    case 'empty':
      return units === 0 ? [NOTHING] : [];
  }
}

/** Every way to split `units` over wood, stone and iron. */
function nobleSplits(units: number): Record<NobleMaterial, number>[] {
  const result: Record<NobleMaterial, number>[] = [];
  for (let wood = 0; wood <= units; wood++) {
    for (let stone = 0; stone <= units - wood; stone++) {
      result.push({ wood, stone, iron: units - wood - stone });
    }
  }
  return result;
}

function addPayments(a: ConstructionPayment, b: ConstructionPayment): ConstructionPayment {
  const sum = { ...NOTHING };
  for (const key of [...NOBLE_MATERIALS, 'bf', 'jokers'] as const) sum[key] = a[key] + b[key];
  return sum;
}
