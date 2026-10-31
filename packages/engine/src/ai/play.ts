/**
 * Plays a whole game between bots. Used by the simulator and by tests.
 */

import type { ChanceOracle } from '../chance/oracle';
import type { PlayerCount } from '../data/types';
import { apply } from '../rules/apply';
import { assertInvariants } from '../rules/invariants';
import type { Move } from '../rules/moves';
import { newGame } from '../rules/setup';
import { visibleState } from '../rules/visible';
import type { GameState, PlayerIndex } from '../state/types';
import type { Bot, BotDecision } from './types';

export interface PlayOptions {
  /** One bot per seat, seat 0 first. */
  bots: Bot[];
  oracle: ChanceOracle;
  /** Run assertInvariants() after every move (slower). */
  checkInvariants?: boolean;
  /** Stop with an error after this many moves. A game normally needs far fewer. */
  maxMoves?: number;
  /** Called after every bot decision, before it is applied. */
  onDecision?: (state: GameState, player: PlayerIndex, decision: BotDecision) => void;
}

export interface PlayedGame {
  final: GameState;
  /** Every move in order, chance outcomes included: replaying them gives the same game. */
  moves: Move[];
}

export function playGame(options: PlayOptions): PlayedGame {
  const { bots, oracle, checkInvariants = false, maxMoves = 20_000 } = options;
  let state = newGame({ playerCount: bots.length as PlayerCount });
  const moves: Move[] = [];

  while (state.pending && state.pending.kind !== 'gameOver') {
    if (moves.length >= maxMoves) throw new Error(`The game did not end after ${maxMoves} moves`);
    const pending = state.pending;
    let move: Move;
    if (pending.kind === 'chance') {
      move = oracle.resolve(state, pending.event);
    } else {
      const bot = bots[pending.player];
      if (!bot) throw new Error(`No bot for player ${pending.player}`);
      const decision = bot.decide(visibleState(state, pending.player), pending.player);
      options.onDecision?.(state, pending.player, decision);
      move = decision.move;
    }
    state = apply(state, move);
    moves.push(move);
    if (checkInvariants) assertInvariants(state);
  }
  return { final: state, moves };
}
