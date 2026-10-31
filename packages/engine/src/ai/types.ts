import type { Move } from '../rules/moves';
import type { GameState, PlayerIndex } from '../state/types';

export interface ScoredMove {
  move: Move;
  score: number;
  /** A short, player-facing sentence. The table app shows it. */
  reason: string;
}

export interface BotDecision extends ScoredMove {
  /** The best other moves, best first. */
  alternatives: ScoredMove[];
}

/**
 * A bot decides for one player. It only ever gets visibleState(state, player)
 * (CLAUDE.md rule 4), and only when that player has a pending decision.
 */
export interface Bot {
  readonly name: string;
  decide(view: GameState, player: PlayerIndex): BotDecision;
}
