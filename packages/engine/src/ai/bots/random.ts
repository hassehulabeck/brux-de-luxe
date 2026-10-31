import type { Rng } from '../../chance/rng';
import { legalMoves } from '../../rules/legal-moves';
import type { Bot } from '../types';
import { describeMove } from '../explain';

/** Picks any legal move, each equally likely. A baseline for testing. */
export function randomBot(rng: Rng): Bot {
  return {
    name: 'random',
    decide(view) {
      const moves = legalMoves(view);
      const move = moves[rng.int(moves.length)];
      if (!move) throw new Error('No legal moves');
      return { move, score: 0, reason: `${describeMove(view, move)} (random).`, alternatives: [] };
    },
  };
}
