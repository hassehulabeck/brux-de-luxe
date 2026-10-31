/**
 * 7. Manneken Pis: whoever earns the most Manneken Pis this round becomes
 * first player (Resolution step 2). They come from the Bonus cards won (the
 * current leader of each column is expected to win it) and 2 from the
 * Exhibition tile of the first player to pass.
 *
 * Being first player is worth a little in rounds 1–4 (shield choice, first
 * pick) and the pawn's 5 VP after round 5.
 */

import { EXHIBITION_MANNEKEN_PIS, MANNEKEN_PIS_FINAL_VP, ROUNDS } from '../../data/rulebook';
import { bonusType } from '../../rules/resolution';
import type { GameState, PlayerIndex } from '../../state/types';
import { columnBids, type Consideration } from './context';

export const mannekenPis: Consideration = ({ before, after, player: me, weights }) => {
  if (before.phase !== 'action') return 0;
  const gain = firstPlayerChance(after, me) - firstPlayerChance(before, me);
  if (gain === 0) return 0;
  const value =
    before.round.number >= ROUNDS ? MANNEKEN_PIS_FINAL_VP : weights.mannekenPis.firstPlayerValue;
  return gain * value;
};

/** Manneken Pis each player is on course to earn this round. */
export function expectedMannekenPis(state: GameState): number[] {
  const counts = state.players.map(() => 0);
  state.bonusStrip.forEach((card, col) => {
    if (card === null) return;
    const totals = columnBids(state, col);
    const best = Math.max(...totals);
    if (best === 0) return;
    const leaders = totals.flatMap((t, p) => (t === best ? [p] : []));
    const tied = leaders.length > 1;
    if (tied && !state.rules.tiedBonusCardsCountMannekenPis) return;
    for (const p of leaders) counts[p]! += bonusType(card).mannekenPis;
  });
  const exhibition = state.round.passed[0];
  if (exhibition !== undefined) counts[exhibition]! += EXHIBITION_MANNEKEN_PIS;
  return counts;
}

/** 1 if on course for the most Manneken Pis, shared on a tie, else 0. */
export function firstPlayerChance(state: GameState, me: PlayerIndex): number {
  const counts = expectedMannekenPis(state);
  const best = Math.max(...counts);
  if (counts[me] !== best) return 0;
  return 1 / counts.filter((c) => c === best).length;
}
