/**
 * What one player can see. Bots only ever get this view (CLAUDE.md rule 4).
 *
 * The stacks and decks hold no order (see state/types.ts), so most of the
 * state is public. What is private: the Works of Art another player has just
 * drawn in the Workshop and is choosing between.
 */

import type { GameState, PlayerIndex } from '../state/types';
import { cloneState } from './helpers';

export function visibleState(state: GameState, viewer: PlayerIndex): GameState {
  const view = cloneState(state);
  if (view.pending?.kind === 'keepWork' && view.pending.player !== viewer) {
    view.pending = { ...view.pending, drawn: [] };
  }
  return view;
}
