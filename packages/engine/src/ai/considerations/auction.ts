/**
 * 3. Auction value: the column's Bonus card, times the chance of winning it
 * with this bid. The bid money itself is already counted by the projection.
 *
 * - Behind: no chance.
 * - Tied: only the central power, if the tie holds.
 * - Ahead: each opponent who can still bid enough might outbid the lead,
 *   less likely the bigger the lead and only if the column has room left.
 */

import { isInArea, player, spaceAt } from '../../rules/helpers';
import { applyBonusEffect, bonusType } from '../../rules/resolution';
import type { GameState, PlayerIndex } from '../../state/types';
import type { UtilityWeights } from '../weights';
import { activeOpponents, columnBids, gainFor, type Consideration } from './context';

export const auction: Consideration = ({ before, move, player: me, weights }) => {
  if (move.kind !== 'placeAssistant') return 0;
  const col = move.space.col;
  const card = before.bonusStrip[col];
  if (card === null || card === undefined) return 0;

  const chance = winChance(before, me, col, move.space.row, move.bid, weights);
  if (chance.win === 0 && chance.tie === 0) return 0;
  const value = bonusCardValue(before, me, card, weights);
  return chance.win * Math.max(value.use, value.tuck) + chance.tie * value.use;
};

export function winChance(
  state: GameState,
  me: PlayerIndex,
  col: number,
  row: number,
  bid: number,
  weights: UtilityWeights,
): { win: number; tie: number } {
  const totals = columnBids(state, col);
  const mine = totals[me]! + bid;
  const best = Math.max(...totals.filter((_, p) => p !== me));
  if (mine < best) return { win: 0, tie: 0 };
  if (mine === best) return { win: 0, tie: weights.auction.tieHold };

  const lead = mine - best;
  const room = state.board.some(
    (_, rowIndex) => rowIndex !== row && isOpen(state, { row: rowIndex, col }),
  );
  const rivals = room
    ? activeOpponents(state, me).filter((p) => player(state, p).bf + totals[p]! >= mine).length
    : 0;
  const outbid = Math.min(1, (rivals * weights.auction.outbidRisk) / lead);
  return { win: 1 - outbid, tie: 0 };
}

/**
 * What a Bonus card is worth to a player: its central power (best choice),
 * or tucked under the best row still free this round.
 */
export function bonusCardValue(
  state: GameState,
  me: PlayerIndex,
  card: number,
  weights: UtilityWeights,
): { use: number; tuck: number } {
  // The same decision asks for the same cards many times: remember them per state.
  const memo = memoFor(state, weights);
  const key = `${me}:${card}`;
  const known = memo.get(key);
  if (known) return known;
  const value = computeBonusCardValue(state, me, card, weights);
  memo.set(key, value);
  return value;
}

const memos = new WeakMap<GameState, WeakMap<UtilityWeights, Map<string, BonusValue>>>();
type BonusValue = { use: number; tuck: number };

function memoFor(state: GameState, weights: UtilityWeights): Map<string, BonusValue> {
  let byWeights = memos.get(state);
  if (!byWeights) memos.set(state, (byWeights = new WeakMap()));
  let memo = byWeights.get(weights);
  if (!memo) byWeights.set(weights, (memo = new Map()));
  return memo;
}

function computeBonusCardValue(
  state: GameState,
  me: PlayerIndex,
  card: number,
  weights: UtilityWeights,
): BonusValue {
  const type = bonusType(card);
  const effects =
    type.power.kind === 'single'
      ? [[type.power.effect]]
      : type.power.kind === 'choice'
        ? type.power.options.map((e) => [e])
        : [type.power.effects];
  const use = Math.max(
    ...effects.map((list) =>
      gainFor(state, me, weights, (d) => list.forEach((e) => applyBonusEffect(d, me, e)), {
        atResolution: true,
      }),
    ),
  );
  let tuck = 0;
  if (type.vpSymbols > 0) {
    for (const row of [1, 2, 3, 4] as const) {
      if (state.round.tuckedRows[me]?.includes(row)) continue;
      const gain = gainFor(state, me, weights, (d) => player(d, me).tucked[row - 1]!.push(card), {
        atResolution: true,
      });
      tuck = Math.max(tuck, gain);
    }
  }
  return { use, tuck };
}

/** True if the space is in this round's area and free. */
export function isOpen(state: GameState, space: { row: number; col: number }): boolean {
  return isInArea(state.round.area, space) && spaceAt(state, space).assistant === null;
}
