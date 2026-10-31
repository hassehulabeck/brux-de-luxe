/**
 * What every consideration gets, and small helpers they share.
 *
 * A consideration is a pure function (ctx) => number, in VP. The utility bot
 * adds them up, each times its weight from the weight set.
 */

import { cloneState, player } from '../../rules/helpers';
import type { Move } from '../../rules/moves';
import type { GameState, PlayerIndex } from '../../state/types';
import { NEUTRAL_SOURCES, project } from '../projection';
import type { SourceWeights, UtilityWeights } from '../weights';

export interface MoveContext {
  /** What the bot sees before the move. */
  before: GameState;
  /** The move being scored. */
  move: Move;
  /** After the move and the bot's best follow-up decisions (a whole Sale, say). */
  after: GameState;
  player: PlayerIndex;
  weights: UtilityWeights;
  /** The plan blend's multipliers on the value sources. */
  sources: SourceWeights;
}

export type Consideration = (ctx: MoveContext) => number;

/**
 * How much a change is worth to a player, measured by the projection. The
 * change is made on a copy. With `atResolution`, both states are valued as
 * if the Action phase were over: for things that happen during the
 * Resolution of the Turn (Bonus cards, the Courthouse).
 */
export function gainFor(
  state: GameState,
  owner: PlayerIndex,
  weights: UtilityWeights,
  change: (draft: GameState) => void,
  options: { sources?: SourceWeights; atResolution?: boolean } = {},
): number {
  const sources = options.sources ?? NEUTRAL_SOURCES;
  const base: GameState = options.atResolution ? { ...state, phase: 'resolution' } : state;
  const changed = cloneState(base);
  change(changed);
  return (
    project(changed, owner, weights.projection, sources).total -
    project(base, owner, weights.projection, sources).total
  );
}

/** Each player's total bid in a column. */
export function columnBids(state: GameState, col: number): number[] {
  const totals = state.players.map(() => 0);
  for (const row of state.board) {
    const assistant = row[col]?.assistant;
    if (assistant?.kind === 'player') totals[assistant.player]! += assistant.bid;
  }
  return totals;
}

/** The opponents of a player, in seat order. */
export function opponents(state: GameState, owner: PlayerIndex): PlayerIndex[] {
  return state.players.map((_, i) => i).filter((i) => i !== owner);
}

/** Opponents who can still act this round. */
export function activeOpponents(state: GameState, owner: PlayerIndex): PlayerIndex[] {
  return opponents(state, owner).filter(
    (i) => !state.round.passed.includes(i) && player(state, i).assistants.available > 0,
  );
}
