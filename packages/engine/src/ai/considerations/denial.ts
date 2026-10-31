/**
 * 8. Opponent denial: a Sale moves the Workshop cursor and covers a shop
 * color, and a Construction turns a compass needle. Both can spoil what an
 * opponent was planning. This is how much the bot's move lowers the
 * opponents' best Sale, and whether it takes away (or gives) their means
 * to build.
 */

import { affordablePayments, sellableColors } from '../../rules/actions';
import type { GridPosition } from '../../data/types';
import { components, sameSpace, workCount } from '../../rules/helpers';
import { cursorPositions } from '../../rules/legal-moves';
import type { GameState, PlayerIndex } from '../../state/types';
import { opponents, type Consideration } from './context';

export const denial: Consideration = ({ before, after, player: me, weights }) => {
  const cursorMoved = !sameSpace(before.workshopCursor, after.workshopCursor);
  const shopChanged = JSON.stringify(before.shop) !== JSON.stringify(after.shop);
  const needlesTurned = before.compass.needles.some((n, i) => after.compass.needles[i] !== n);
  if (!cursorMoved && !shopChanged && !needlesTurned) return 0;

  let total = 0;
  for (const p of opponents(before, me)) {
    if (cursorMoved || shopChanged) total += bestSaleValue(before, p) - bestSaleValue(after, p);
    if (needlesTurned) {
      const could = affordablePayments(before, p).length > 0;
      const can = affordablePayments(after, p).length > 0;
      total += weights.denial.constructionAccess * (Number(could) - Number(can));
    }
  }
  return total;
};

/** The most BF + VP a player could get from a Sale right now. */
export function bestSaleValue(state: GameState, p: PlayerIndex): number {
  if (sellableColors(state, p).length === 0) return 0;
  return Math.max(
    0,
    ...cursorPositions(state, workCount(state.players[p]!)).map((at) => bestSaleAt(state, p, at)),
  );
}

/** The most BF + VP a player could get from a Sale with the cursor at this position. */
export function bestSaleAt(state: GameState, p: PlayerIndex, at: GridPosition): number {
  const { bfByRow, vpByColumn, dots } = components().workshop;
  let best = 0;
  for (const color of sellableColors(state, p)) {
    // Black works use the center of the cursor (p. 11).
    const offset = color === 'black' ? { row: 0, col: 0 } : dots[color];
    const value = (bfByRow[at.row + offset.row] ?? 0) + (vpByColumn[at.col + offset.col] ?? 0);
    best = Math.max(best, value);
  }
  return best;
}
