/**
 * 6. Courthouse risk: the player with the most Assistants on the Brussels
 * board sends one of them to the Courthouse (Resolution step 5). This is the
 * extra risk a Brussels action adds, times what that Assistant is worth.
 */

import { BRUSSELS_ACTIONS } from '../../data/types';
import { brusselsCost } from '../../rules/actions';
import { player } from '../../rules/helpers';
import type { GameState, PlayerIndex } from '../../state/types';
import type { UtilityWeights } from '../weights';
import { activeOpponents, gainFor, type Consideration } from './context';

export const courthouseRisk: Consideration = ({ before, move, player: me, weights }) => {
  if (move.kind !== 'takeBrusselsAction') return 0;
  const totals = brusselsTotals(before);
  const was = courthouseChance(before, me, totals, weights);
  totals[me]! += brusselsCost(before, move.action);
  const now = courthouseChance(before, me, totals, weights);
  if (now === was) return 0;

  const loss = -gainFor(
    before,
    me,
    weights,
    (d) => {
      const a = player(d, me).assistants;
      a.available--;
      a.courthouse++;
    },
    { atResolution: true },
  );
  return -(now - was) * loss;
};

/** Assistants each player has on the Brussels board this round. */
export function brusselsTotals(state: GameState): number[] {
  const totals = state.players.map(() => 0);
  for (const action of BRUSSELS_ACTIONS) {
    for (const use of state.round.brussels[action]) totals[use.player]! += use.assistants;
  }
  return totals;
}

/** The chance this player sends an Assistant to the Courthouse, with these totals. */
export function courthouseChance(
  state: GameState,
  me: PlayerIndex,
  totals: number[],
  weights: UtilityWeights,
): number {
  const mine = totals[me]!;
  if (mine === 0) return 0;
  const best = Math.max(...totals.filter((_, p) => p !== me));
  const risk = weights.courthouse;
  if (mine < best) return risk.behindRisk / (best - mine);
  // Nobody left to catch up: the majority is certain.
  if (activeOpponents(state, me).length === 0) return 1;
  return mine > best ? risk.leadRisk : risk.tieRisk;
}
