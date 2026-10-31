/**
 * Building placement (PLAN.md 5.5): a Building pays its owner every time an
 * opponent takes its action. That needs the space to be in the available
 * area, so the value is the chance of that (from the Stock Exchange cards
 * still in the deck) times the action's expected income, for each round
 * left, this one included if the Action phase is still going.
 */

import { components, isInArea, spaceAt } from '../../rules/helpers';
import { largestArea } from '../../rules/stock-exchange';
import type { ArtNouveauSpace } from '../../state/coords';
import type { GameState } from '../../state/types';
import { futureRounds } from '../projection';
import type { UtilityWeights } from '../weights';
import type { Consideration } from './context';

export const buildingPlacement: Consideration = ({ before, after, player: me, weights }) => {
  let total = 0;
  after.board.forEach((row, r) =>
    row.forEach((space, c) => {
      if (space.building !== me || before.board[r]![c]!.building === me) return;
      total += placementValue(before, { row: r, col: c }, weights);
    }),
  );
  return total;
};

/** What a new Building on this space is expected to earn its owner. */
export function placementValue(
  state: GameState,
  at: ArtNouveauSpace,
  weights: UtilityWeights,
): number {
  const income = weights.buildings.secondaryIncome[spaceAt(state, at).action];
  const thisRound = state.phase === 'action' && isInArea(state.round.area, at) ? 1 : 0;
  return income * (areaChance(state, at) * futureRounds(state) + thisRound);
}

/**
 * The chance that a space is in a future round's area: over the Stock
 * Exchange cards not revealed yet (public: the rest are discarded or in
 * play), each of the card's two shields equally likely.
 */
export function areaChance(state: GameState, space: ArtNouveauSpace): number {
  const all = components().stockExchangeCards;
  const deck =
    state.stockExchange.deck.length > 0 ? state.stockExchange.deck : all.map((_, i) => i);
  let inside = 0;
  let total = 0;
  for (const index of deck) {
    for (const shield of all[index]!.shields[state.playerCount]) {
      total++;
      if (isInArea(largestArea(shield), space)) inside++;
    }
  }
  return total === 0 ? 0 : inside / total;
}
