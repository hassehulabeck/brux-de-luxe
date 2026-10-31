/**
 * 4. Shield majority: the VP an Assistant adds around the shields next to its
 * space (Resolution step 4), plus the VP it takes away from opponents.
 *
 * A shield scores when all 4 spaces around it have an Assistant. Each empty
 * space still in the area is filled with some chance; an empty space outside
 * the area never is, so that shield can't score this round.
 */

import { SHIELD_COUNT_PER_SIDE, spacesAroundShield, type Shield } from '../../state/coords';
import type { ArtNouveauSpace } from '../../state/coords';
import { isInArea, spaceAt, trackValue } from '../../rules/helpers';
import type { GameState, PlayerIndex } from '../../state/types';
import type { UtilityWeights } from '../weights';
import { opponents, type Consideration } from './context';

type Owner = PlayerIndex | 'neutral' | null;

export const shieldMajority: Consideration = ({ before, move, player: me, weights }) => {
  let placed: Owner;
  if (move.kind === 'placeAssistant') placed = me;
  else if (move.kind === 'placeNeutral') placed = 'neutral';
  else return 0;

  const others = opponents(before, me);
  let mine = 0;
  let denied = 0;
  for (const shield of shieldsAround(move.space)) {
    const was = (p: PlayerIndex) => expectedShieldVp(before, shield, p, weights);
    const now = (p: PlayerIndex) =>
      expectedShieldVp(before, shield, p, weights, { space: move.space, owner: placed });
    mine += now(me) - was(me);
    for (const p of others) denied += was(p) - now(p);
  }
  return mine + weights.shields.denial * denied;
};

/** The shields that touch an action space (1 to 4 of them). */
export function shieldsAround(space: ArtNouveauSpace): Shield[] {
  const result: Shield[] = [];
  for (let row = 1; row <= SHIELD_COUNT_PER_SIDE; row++) {
    for (let col = 1; col <= SHIELD_COUNT_PER_SIDE; col++) {
      const touches = spacesAroundShield({ row, col }).some(
        (s) => s.row === space.row && s.col === space.col,
      );
      if (touches) result.push({ row, col });
    }
  }
  return result;
}

/**
 * Expected VP a player gets from one shield this round: their City Hall value
 * if they have at least as many of its Assistants as anyone else (ties all
 * score), times the chance that the empty spaces get filled.
 */
export function expectedShieldVp(
  state: GameState,
  shield: Shield,
  p: PlayerIndex,
  weights: UtilityWeights,
  extra?: { space: ArtNouveauSpace; owner: Owner },
): number {
  const owners: Owner[] = spacesAroundShield(shield).map((space) => {
    if (extra && extra.space.row === space.row && extra.space.col === space.col) {
      return extra.owner;
    }
    const assistant = spaceAt(state, space).assistant;
    if (!assistant) return null;
    return assistant.kind === 'neutral' ? 'neutral' : assistant.player;
  });

  const empty = spacesAroundShield(shield).filter((_, i) => owners[i] === null);
  if (empty.some((space) => !isInArea(state.round.area, space))) return 0;

  const count = (o: Owner) => owners.filter((x) => x === o).length;
  const mine = count(p);
  if (mine === 0) return 0;
  const best = Math.max(...owners.filter((o) => o !== null && o !== p).map(count), 0);
  if (mine < best) return 0;
  return trackValue(state, p, 'cityHall') * weights.shields.completion ** empty.length;
}
