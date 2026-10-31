/**
 * GreedyBot: picks the move with the best immediate gain in VP + BF.
 *
 * "Immediate" means: this move plus the player's own follow-up decisions
 * that come right after it (a Sale is cursor → work → shop space), played
 * out the best way. The look-ahead stops at a chance event, another
 * player's decision, or the player's next turn. Ties are broken at random.
 */

import type { Rng } from '../../chance/rng';
import { MIN_BID } from '../../data/rulebook';
import { applyLegalMove } from '../../rules/apply';
import { legalMoves } from '../../rules/legal-moves';
import type { Move } from '../../rules/moves';
import type { GameState, PlayerIndex } from '../../state/types';
import { describeMove } from '../explain';
import type { Bot, ScoredMove } from '../types';

/** Decisions that start something new: the look-ahead stops before them. */
const NEW_DECISIONS = new Set(['turn', 'chooseShield', 'placeNeutral', 'gameOver', 'chance']);
const MAX_LOOKAHEAD = 8;

export function greedyBot(rng: Rng): Bot {
  return {
    name: 'greedy',
    decide(view, player) {
      const scored = candidates(view).map((move): ScoredMove => {
        const outcome = bestOutcome(applyLegalMove(view, move), player, MAX_LOOKAHEAD);
        const gain = worth(outcome, player) - worth(view, player);
        return { move, score: gain, reason: reasonFor(view, move, outcome, player) };
      });
      scored.sort((a, b) => b.score - a.score);
      const best = scored.filter((s) => s.score === scored[0]!.score);
      const choice = best[rng.int(best.length)]!;
      return { ...choice, alternatives: scored.filter((s) => s !== choice).slice(0, 3) };
    },
  };
}

/** VP + BF: what the greedy bot cares about. */
function worth(state: GameState, player: PlayerIndex): number {
  const p = state.players[player]!;
  return p.vp + p.bf;
}

/** Higher bids never gain anything immediately, so only the minimum bid is considered. */
function candidates(state: GameState): Move[] {
  return legalMoves(state).filter((m) => m.kind !== 'placeAssistant' || m.bid === MIN_BID);
}

/** The state with the best VP + BF this player can reach with their own follow-up decisions. */
function bestOutcome(state: GameState, player: PlayerIndex, depth: number): GameState {
  const pending = state.pending;
  const ownFollowUp =
    pending !== null &&
    !NEW_DECISIONS.has(pending.kind) &&
    'player' in pending &&
    pending.player === player;
  if (!ownFollowUp || depth === 0) return state;
  let best = state;
  let bestWorth = -Infinity;
  for (const move of candidates(state)) {
    const outcome = bestOutcome(applyLegalMove(state, move), player, depth - 1);
    if (worth(outcome, player) > bestWorth) {
      best = outcome;
      bestWorth = worth(outcome, player);
    }
  }
  return best;
}

function reasonFor(view: GameState, move: Move, outcome: GameState, player: PlayerIndex): string {
  const before = view.players[player]!;
  const now = outcome.players[player]!;
  const vp = now.vp - before.vp;
  const bf = now.bf - before.bf;
  const gains = [vp && `${signed(vp)} VP`, bf && `${signed(bf)} BF`].filter(Boolean);
  return `${describeMove(view, move)}${gains.length ? `: ${gains.join(', ')}` : ''}.`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
