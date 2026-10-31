/**
 * Endgame score projection (PLAN.md 5.1): an estimate of the final score a
 * player is heading for.
 *
 *   project() = terminal + future
 *
 * - terminal: the final score if the game ended right now with what the
 *   player has, using the real final scoring, and paying for the kept
 *   Public Figures (cheapest first, as long as the money lasts).
 * - future: what the player's resources are still worth in the rounds left.
 *   Money to spend, works to sell, materials to build with, track positions
 *   that pay every round. Each part belongs to a value source, and the
 *   bot's plan weighs the sources (`sources`).
 *
 * In the last round the future part shrinks to nothing, so the bot's late
 * decisions are made on the real final score.
 */

import {
  ASSISTANTS_PER_PLAYER,
  BUILDING_ROWS,
  BUILDING_TILES_PER_PLAYER,
  COMPASS_BF_PER_UNIT,
  CONSTRUCTION_WITHOUT_JOKER_VP,
  ROUNDS,
  TUCK_ROW_BASE_VP_SYMBOLS,
  UNPAID_PUBLIC_FIGURE_PENALTY_VP,
} from '../data/rulebook';
import { finalScore } from '../rules/end';
import { NOBLE_MATERIALS, type CompassTile, type NobleMaterial } from '../data/types';
import { needleTiles } from '../rules/compass';
import { player, trackValue, workColorCount, workCount } from '../rules/helpers';
import { bonusType } from '../rules/resolution';
import type { GameState, PlayerIndex, PlayerState } from '../state/types';
import {
  VALUE_SOURCES,
  type ProjectionValues,
  type SourceWeights,
  type ValueSource,
} from './weights';

export interface Projection {
  /** The final score if the game ended now. */
  terminal: number;
  /** Future value per source, already weighted by the plan. */
  future: SourceWeights;
  total: number;
}

/** Every source counts once: the projection without a plan. */
export const NEUTRAL_SOURCES: SourceWeights = Object.fromEntries(
  VALUE_SOURCES.map((source) => [source, 1]),
) as SourceWeights;

export function project(
  state: GameState,
  owner: PlayerIndex,
  values: ProjectionValues,
  sources: SourceWeights = NEUTRAL_SOURCES,
  timing: Timing = timingOf(state, owner),
): Projection {
  const terminal = terminalScore(state, owner);
  const raw = futureValue(state, owner, values, timing);
  const future = Object.fromEntries(
    VALUE_SOURCES.map((source) => [source, raw[source] * sources[source]]),
  ) as SourceWeights;
  const total = terminal + VALUE_SOURCES.reduce((sum, source) => sum + future[source], 0);
  return { terminal, future, total };
}

// --- Timing ------------------------------------------------------------------------

/** Whole rounds still to come after the current one. */
export function futureRounds(state: GameState): number {
  return state.phase === 'gameOver' ? 0 : ROUNDS - state.round.number;
}

/** True while the player can still take actions this round. */
export function stillActing(state: GameState, owner: PlayerIndex): boolean {
  const early = state.phase === 'setup' || state.phase === 'stockExchange';
  return (early || state.phase === 'action') && !state.round.passed.includes(owner);
}

/** When a state is valued: the rounds still to come, and whether the player can still act now. */
export interface Timing {
  futureRounds: number;
  acting: boolean;
}

export function timingOf(state: GameState, owner: PlayerIndex): Timing {
  return { futureRounds: futureRounds(state), acting: stillActing(state, owner) };
}

/**
 * The timing for the state after a move. A move that ends the round (the
 * last pass, the last Bonus card) leads to a state in the next round. That
 * state is valued as of the end of the round the move was made in, so that
 * the round that just ended doesn't count as a round of income lost.
 */
export function timingAfter(before: GameState, after: GameState, owner: PlayerIndex): Timing {
  if (after.phase === 'gameOver' || after.round.number > before.round.number) {
    return { futureRounds: futureRounds(before), acting: false };
  }
  return timingOf(after, owner);
}

/** 1 while there is still a round in which a resource can be used once, else 0. */
function usable(timing: Timing): number {
  return Math.min(1, timing.futureRounds + (timing.acting ? 1 : 0));
}

// --- Terminal: the final score if the game ended now ---------------------------------

export function terminalScore(state: GameState, owner: PlayerIndex): number {
  const p = player(state, owner);
  const score = finalScore(state, owner);
  let total = score.total;

  // The Manneken Pis pawn only scores for whoever holds it at the very end.
  if (!firstPlayerIsFinal(state)) total -= score.mannekenPis;

  if (!hasPaidPublicFigures(state, owner)) {
    // Pay the cheapest cards first while the money lasts; the rest cost 5 VP each.
    let bf = p.bf;
    let unpaid = 0;
    for (const cost of p.publicFigures.map((f) => f.cost).sort((a, b) => a - b)) {
      if (cost <= bf) bf -= cost;
      else unpaid++;
    }
    total += Math.floor(bf / 4) * rowMultiplier(p, 0) - score.rows[0];
    total -= unpaid * (UNPAID_PUBLIC_FIGURE_PENALTY_VP + rowMultiplier(p, 2));
  }
  return total;
}

/** The first player of round 5's resolution keeps the pawn to the end. */
function firstPlayerIsFinal(state: GameState): boolean {
  return (
    state.phase === 'gameOver' || (state.round.number >= ROUNDS && state.phase === 'resolution')
  );
}

/** At the end of the game, has this player already paid for their Public Figures? */
export function hasPaidPublicFigures(state: GameState, owner: PlayerIndex): boolean {
  if (state.phase === 'gameOver') return true;
  const scoringQueued = state.steps.some((s) => s.kind === 'finalScoring');
  if (!scoringQueued) return false;
  const stillToPay =
    state.steps.some((s) => s.kind === 'payPublicFigures' && s.player === owner) ||
    (state.pending?.kind === 'payPublicFigures' && state.pending.player === owner);
  return !stillToPay;
}

/** The multiplier of a tuck row (0-based): 1 + the VP symbols on the cards under it. */
export function rowMultiplier(p: PlayerState, row: 0 | 1 | 2 | 3): number {
  return (
    TUCK_ROW_BASE_VP_SYMBOLS + p.tucked[row].reduce((sum, c) => sum + bonusType(c).vpSymbols, 0)
  );
}

// --- Future: what the resources are still worth in the rounds left ---------------------

export function futureValue(
  state: GameState,
  owner: PlayerIndex,
  values: ProjectionValues,
  timing: Timing = timingOf(state, owner),
): Record<ValueSource, number> {
  const p = player(state, owner);
  const rounds = timing.futureRounds;
  const acting = timing.acting;
  const once = usable(timing);

  return {
    money: values.moneyInGame * p.bf * once,
    works:
      values.workInGame * workCount(p) * once +
      values.workColorPerRound * workColorCount(p) * rounds +
      values.exhibitionPerRound * p.exhibitions.length * rounds,
    buildings: futureBuildingsValue(state, owner, values, timing),
    cityHall: values.shieldWinsPerRound * trackValue(state, owner, 'cityHall') * rounds,
    figures: figuresValue(state, owner, values, rounds, acting),
    assistants:
      values.assistantPerRound * (ASSISTANTS_PER_PLAYER - p.assistants.courthouse) * rounds +
      (acting ? values.assistantThisRound * p.assistants.available : 0),
  };
}

/**
 * The Buildings the player's materials (and some money) can still pay for,
 * limited by the tiles left and the rounds left, each worth the Architect
 * value plus its construction VP. Fractions count: half the materials for a
 * Building is worth half a Building.
 */
export function futureBuildingsValue(
  state: GameState,
  owner: PlayerIndex,
  values: ProjectionValues,
  timing: Timing = timingOf(state, owner),
): number {
  const p = player(state, owner);
  const roundsToBuild = timing.futureRounds + (timing.acting ? 1 : 0);
  let capacity = Math.min(
    BUILDING_TILES_PER_PLAYER - p.buildingsBuilt,
    values.buildsPerRound * roundsToBuild,
  );
  let units = constructionUnits(state, p, values);
  const architect = trackValue(state, owner, 'architect');

  let total = 0;
  for (let tile = p.buildingsBuilt; tile < BUILDING_TILES_PER_PLAYER && capacity > 0; tile++) {
    const row = BUILDING_ROWS[Math.floor(tile / 2)]!;
    const share = Math.min(1, capacity, units / row.constructionUnits);
    if (share <= 0) break;
    total +=
      share * (architect + values.noJokerShare * CONSTRUCTION_WITHOUT_JOKER_VP + row.immediateVp);
    units -= row.constructionUnits;
    capacity -= 1;
  }
  return values.buildConfidence * total;
}

/**
 * Construction units a player has: Jokers, Noble Materials and some money.
 * Materials the compass needles point at now count in full, others a little
 * less (the needles turn, but slowly). Money counts in full only while a
 * needle points at the 3 BF tile.
 */
export function constructionUnits(
  state: GameState,
  p: PlayerState,
  values: ProjectionValues,
): number {
  const tiles: CompassTile[] = state.compass.tiles.length > 0 ? needleTiles(state) : [];
  const onNeedle = (m: NobleMaterial) => tiles.includes(m) || tiles.includes('anyNoble');
  const nobles = NOBLE_MATERIALS.reduce(
    (sum, m) => sum + p.nobles[m] * (onNeedle(m) ? 1 : values.offNeedleMaterialShare),
    0,
  );
  const bfPerUnit = tiles.includes('threeBf') ? COMPASS_BF_PER_UNIT : values.bfPerConstructionUnit;
  return nobles + p.jokers + p.bf / bfPerUnit;
}

/**
 * Activating Public Figures: the best ones, up to the Royal Palace value,
 * a share of the rounds left. Upright cards can still be used this round.
 */
function figuresValue(
  state: GameState,
  owner: PlayerIndex,
  values: ProjectionValues,
  rounds: number,
  acting: boolean,
): number {
  const p = player(state, owner);
  const limit = trackValue(state, owner, 'royalPalace');
  const best = (cards: typeof p.publicFigures) =>
    cards
      .map((f) => values.figureActivation[f.figure])
      .sort((a, b) => b - a)
      .slice(0, limit)
      .reduce((sum, v) => sum + v, 0);
  const later = best(p.publicFigures) * rounds;
  const now = acting ? best(p.publicFigures.filter((f) => !f.rotated)) : 0;
  return values.figureActivationsPerRound * (later + now);
}

/** Used by tests and the decision log: the projection's parts, rounded. */
export function describeProjection(projection: Projection): string {
  const parts = VALUE_SOURCES.map((s) => `${s} ${projection.future[s].toFixed(1)}`);
  return `${projection.total.toFixed(1)} (final now ${projection.terminal}, ${parts.join(', ')})`;
}
