/**
 * Plans (PLAN.md 5.3): four personalities, each a set of multipliers on the
 * projection's value sources.
 *
 * - Builder: materials, Buildings, the Architect track.
 * - Art Dealer: Works of Art, Sales, Exhibitions.
 * - Politician: City Hall, Royal Palace, Public Figures.
 * - Opportunist: money and whatever pays now.
 *
 * Each plan gets a fitness from the bot's own position (bias + weighted
 * features), lowered when opponents are strong on the same path. The active
 * multipliers are a softmax blend of the plans, with a bonus for last
 * round's leading plan (so the bot doesn't flip-flop) and the bot's own
 * temperament.
 */

import { nobleCount, player, workColorCount, workCount } from '../rules/helpers';
import type { GameState, PlayerIndex } from '../state/types';
import {
  PLAN_NAMES,
  VALUE_SOURCES,
  type FitnessWeights,
  type PlanName,
  type SourceWeights,
  type UtilityWeights,
} from './weights';

export const PLAN_LABELS: Record<PlanName, string> = {
  builder: 'Builder',
  artDealer: 'Art Dealer',
  politician: 'Politician',
  opportunist: 'Opportunist',
};

export type Temperament = Partial<Record<PlanName, number>>;

export interface PlanBlend {
  /** Each plan's share of the blend, adding up to 1. */
  shares: Record<PlanName, number>;
  /** The plan with the biggest share: shown at the table. */
  leader: PlanName;
  /** The blended multipliers on the value sources. */
  sources: SourceWeights;
}

type Features = Omit<FitnessWeights, 'bias'>;

/** What a player's position looks like, in the terms the fitness weights use. */
export function features(state: GameState, owner: PlayerIndex): Features {
  const p = player(state, owner);
  return {
    materials: nobleCount(p) + p.jokers,
    buildings: p.buildingsBuilt,
    architect: p.tracks.architect,
    works: workCount(p),
    workColors: workColorCount(p),
    exhibitions: p.exhibitions.length,
    cityHall: p.tracks.cityHall,
    royalPalace: p.tracks.royalPalace,
    figures: p.publicFigures.length,
    money: p.bf,
  };
}

function rawFitness(weights: FitnessWeights, f: Features): number {
  return (Object.keys(f) as (keyof Features)[]).reduce(
    (sum, key) => sum + weights[key] * f[key],
    weights.bias,
  );
}

/** Each plan's fitness for this player: own position, minus how contested the path is. */
export function planFitness(
  state: GameState,
  owner: PlayerIndex,
  weights: UtilityWeights,
): Record<PlanName, number> {
  const own = features(state, owner);
  const opponents = state.players
    .map((_, i) => i)
    .filter((i) => i !== owner)
    .map((i) => features(state, i));
  return Object.fromEntries(
    PLAN_NAMES.map((plan) => {
      const fitness = weights.fitness[plan];
      const contested =
        opponents.reduce((sum, f) => sum + rawFitness(fitness, f), 0) /
        Math.max(1, opponents.length);
      return [plan, rawFitness(fitness, own) - weights.planning.contest * contested];
    }),
  ) as Record<PlanName, number>;
}

export function blendPlans(
  state: GameState,
  owner: PlayerIndex,
  weights: UtilityWeights,
  options: { previousLeader?: PlanName | undefined; temperament?: Temperament } = {},
): PlanBlend {
  const fitness = planFitness(state, owner, weights);
  const logits = PLAN_NAMES.map(
    (plan) =>
      (fitness[plan] +
        (plan === options.previousLeader ? weights.planning.inertia : 0) +
        (options.temperament?.[plan] ?? 0)) /
      weights.planning.temperature,
  );
  const top = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - top));
  const sum = exps.reduce((a, b) => a + b, 0);
  const shares = Object.fromEntries(PLAN_NAMES.map((plan, i) => [plan, exps[i]! / sum])) as Record<
    PlanName,
    number
  >;

  const leader = PLAN_NAMES.reduce((best, plan) => (shares[plan] > shares[best] ? plan : best));
  const sources = Object.fromEntries(
    VALUE_SOURCES.map((source) => [
      source,
      PLAN_NAMES.reduce((sum, plan) => sum + shares[plan] * weights.plans[plan][source], 0),
    ]),
  ) as SourceWeights;
  return { shares, leader, sources };
}
