/**
 * The Work of Art stacks and the shop (rulebook p. 5, docs/rules-questions.md Q8).
 */

import { WORK_COLORS, type WorkColor } from '../data/types';
import type { GameState } from '../state/types';

export function colorStackSize(state: GameState): number {
  return WORK_COLORS.reduce((sum, color) => sum + state.workStacks.color[color], 0);
}

/**
 * "Make two new stacks from the face-up tiles in the shop, making sure to
 * leave the top 2 tiles in place": every covered tile goes back to its stack.
 */
export function rebuildStacksFromShop(draft: GameState): void {
  for (const slot of draft.shop) {
    const covered = slot.splice(0, Math.max(0, slot.length - 1));
    for (const color of covered) {
      if (color === 'black') draft.workStacks.black++;
      else draft.workStacks.color[color]++;
    }
  }
}

/** Rebuild the stacks when one of them has run out (p. 5 note). */
export function rebuildStacksIfEmpty(draft: GameState): void {
  if (colorStackSize(draft) === 0 || draft.workStacks.black === 0) rebuildStacksFromShop(draft);
}

/** The colors currently visible in the shop (the top tile of each space). */
export function visibleShopColors(state: GameState) {
  return state.shop.map((slot) => slot[slot.length - 1]).filter((c) => c !== undefined);
}

export function removeFromColorStack(draft: GameState, colors: WorkColor[]): void {
  for (const color of colors) {
    if (draft.workStacks.color[color] <= 0) throw new Error(`No ${color} work left in the stack`);
    draft.workStacks.color[color]--;
  }
}
