/**
 * 5. Gift cost: choosing an action on a space with an opponent's Building
 * gives that opponent a secondary action (Appendix 2). This is what it is
 * worth to them, as a cost to the bot.
 */

import type { ArtNouveauAction } from '../../data/types';
import { buildingsOnBoard, player, spaceAt, workCount } from '../../rules/helpers';
import type { GameState, PlayerIndex } from '../../state/types';
import type { UtilityWeights } from '../weights';
import { gainFor, type Consideration } from './context';

export const gift: Consideration = ({ before, move, player: me, weights }) => {
  if (move.kind !== 'placeAssistant') return 0;
  const space = spaceAt(before, move.space);
  if (space.building === null || space.building === me) return 0;
  return -secondaryActionValue(before, space.building, space.action, weights);
};

/** What a secondary action is worth to the Building's owner. */
export function secondaryActionValue(
  state: GameState,
  owner: PlayerIndex,
  action: ArtNouveauAction,
  weights: UtilityWeights,
): number {
  const p = player(state, owner);
  switch (action) {
    case 'workshop':
      // A black Work of Art.
      return state.workStacks.black > 0
        ? gainFor(state, owner, weights, (d) => player(d, owner).works.black++)
        : 0;
    case 'sale':
      return workCount(p);
    case 'royalTheater': {
      // Activate the best upright Public Figure.
      const upright = p.publicFigures.filter((f) => !f.rotated);
      return Math.max(0, ...upright.map((f) => weights.projection.figureActivation[f.figure]));
    }
    case 'materials':
      return gainFor(state, owner, weights, (d) => player(d, owner).nobles.wood++);
    case 'construction':
      return buildingsOnBoard(state, owner);
  }
}
