/**
 * Area choice (PLAN.md 5.5, Stock Exchange shield): the first player picks
 * one of two shields, and the area decides which Buildings pay this round.
 * The bot's own Buildings inside the area are income; opponents' Buildings
 * inside count against it.
 */

import { isInArea } from '../../rules/helpers';
import { largestArea } from '../../rules/stock-exchange';
import type { Consideration } from './context';

export const areaChoice: Consideration = ({ before, move, player: me, weights }) => {
  if (move.kind !== 'chooseShield') return 0;
  const area = largestArea(move.shield);
  let total = 0;
  before.board.forEach((row, r) =>
    row.forEach((space, c) => {
      if (space.building === null || !isInArea(area, { row: r, col: c })) return;
      const income = weights.buildings.secondaryIncome[space.action];
      total += space.building === me ? income : -weights.buildings.opponentShare * income;
    }),
  );
  return total;
};
