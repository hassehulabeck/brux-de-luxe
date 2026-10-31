/**
 * Helpers for the AI tests: a MoveContext for a consideration, built from a
 * hand-made state and a move.
 */

import {
  applyLegalMove,
  DEFAULT_WEIGHTS,
  type GameState,
  type Move,
  type UtilityWeights,
} from '../../src';
import type { MoveContext } from '../../src/ai/considerations';
import { NEUTRAL_SOURCES } from '../../src/ai/projection';

export function contextFor(
  before: GameState,
  move: Move,
  options: { after?: GameState; player?: number; weights?: UtilityWeights } = {},
): MoveContext {
  return {
    before,
    move,
    after: options.after ?? applyLegalMove(before, move),
    player: options.player ?? 0,
    weights: options.weights ?? DEFAULT_WEIGHTS,
    sources: NEUTRAL_SOURCES,
  };
}

/** A copy of the default weights with some values changed. */
export function weightsWith(change: (w: UtilityWeights) => void): UtilityWeights {
  const copy = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS)) as UtilityWeights;
  change(copy);
  return copy;
}
