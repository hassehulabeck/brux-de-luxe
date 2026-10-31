/**
 * Weight tuning (PLAN.md Phase 5): hill-climbing over a weight set.
 *
 * Each step changes a few weights of the current best set (the champion)
 * by a random factor, and plays the result (the candidate) against it:
 * 3-player games of candidate, champion and greedy, seats rotating. Only the
 * two utility bots are compared: who scored more in each game.
 *
 * Games are noisy, so a candidate has to win twice: clearly on a first set
 * of games, and again on fresh games. Only then does it become the champion.
 */

import { writeFileSync } from 'node:fs';
import { seededRng, type Rng, type UtilityWeights } from '@brux/engine';
import { headToHead, runMatch } from './match';

export interface TuneOptions {
  iterations: number;
  /** Games per evaluation (the confirmation plays as many again). */
  games: number;
  seed: number;
  checkInvariants: boolean;
}

export interface TuneStep {
  iteration: number;
  /** "auction.tieHold 0.5 -> 0.62" for each changed weight. */
  changes: string[];
  /** Share of games the candidate outscored the champion. */
  firstTry: number;
  confirmation: number | null;
  accepted: boolean;
}

/** A candidate must outscore the champion in more than this share of the first games. */
export const ACCEPT_SHARE = 0.55;
/** ... and in more than half of the confirmation games. */
export const CONFIRM_SHARE = 0.5;
/** Weights changed per step, and the spread of the random factor (log scale). */
const CHANGES_PER_STEP = 3;
const SIGMA = 0.3;

/** The scale of everything: the projection counts once. */
const FIXED = new Set(['considerations.projectionGain']);
/** Chances and shares: kept between 0 and 1. */
const PROBABILITIES = new Set([
  'projection.buildConfidence',
  'projection.noJokerShare',
  'projection.offNeedleMaterialShare',
  'auction.outbidRisk',
  'auction.tieHold',
  'shields.completion',
  'courthouse.leadRisk',
  'courthouse.tieRisk',
  'courthouse.behindRisk',
]);

export function tune(
  start: UtilityWeights,
  options: TuneOptions,
  onStep?: (step: TuneStep, champion: UtilityWeights) => void,
): { champion: UtilityWeights; steps: TuneStep[] } {
  const rng = seededRng(options.seed);
  let champion = start;
  const steps: TuneStep[] = [];

  for (let iteration = 0; iteration < options.iterations; iteration++) {
    const { weights: candidate, changes } = perturb(champion, rng);
    const duel = (k: number) =>
      duelShare(candidate, champion, { ...options, seed: options.seed * 1000 + iteration * 2 + k });
    const firstTry = duel(0);
    const confirmation = firstTry > ACCEPT_SHARE ? duel(1) : null;
    const accepted = confirmation !== null && confirmation > CONFIRM_SHARE;
    if (accepted) champion = candidate;
    const step = { iteration, changes, firstTry, confirmation, accepted };
    steps.push(step);
    onStep?.(step, champion);
  }
  return { champion, steps };
}

/** Share of games in which `candidate` outscored `champion` (3 players, with greedy). */
export function duelShare(
  candidate: UtilityWeights,
  champion: UtilityWeights,
  options: Pick<TuneOptions, 'games' | 'seed' | 'checkInvariants'>,
): number {
  const result = runMatch({
    games: options.games,
    players: [3],
    bots: ['utility:candidate', 'utility:champion', 'greedy'],
    seed: options.seed,
    checkInvariants: options.checkInvariants,
    weightSets: { candidate, champion },
  });
  if (result.errors.length > 0) throw new Error(`A game failed: ${result.errors[0]!.message}`);
  return headToHead(result, 0, 1);
}

/** Every weight that may be tuned, as a dotted path: numbers that aren't 0 or fixed. */
export function tunablePaths(weights: UtilityWeights): string[] {
  const paths: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'number') {
      if (value !== 0 && !FIXED.has(path)) paths.push(path);
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(weights, '');
  return paths;
}

/** A copy with a few weights multiplied by a random factor around 1. */
export function perturb(
  weights: UtilityWeights,
  rng: Rng,
): { weights: UtilityWeights; changes: string[] } {
  const copy = JSON.parse(JSON.stringify(weights)) as UtilityWeights;
  const paths = tunablePaths(copy);
  const changes: string[] = [];
  for (let i = 0; i < CHANGES_PER_STEP && paths.length > 0; i++) {
    const path = paths.splice(rng.int(paths.length), 1)[0]!;
    const keys = path.split('.');
    const parent = keys
      .slice(0, -1)
      .reduce<Record<string, unknown>>(
        (obj, key) => obj[key] as Record<string, unknown>,
        copy as unknown as Record<string, unknown>,
      );
    const last = keys[keys.length - 1]!;
    const old = parent[last] as number;
    let value = old * Math.exp(SIGMA * gaussian(rng));
    if (PROBABILITIES.has(path)) value = Math.min(1, value);
    value = Math.round(value * 1000) / 1000;
    parent[last] = value;
    changes.push(`${path} ${old} -> ${value}`);
  }
  return { weights: copy, changes };
}

/** A standard normal number (Box–Muller). */
function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

export function writeWeights(path: string, weights: UtilityWeights): void {
  writeFileSync(path, `${JSON.stringify(weights, null, 2)}\n`);
}

export function formatStep(step: TuneStep): string {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const result = step.accepted
    ? `accepted (${pct(step.firstTry)}, then ${pct(step.confirmation!)})`
    : step.confirmation !== null
      ? `rejected (${pct(step.firstTry)}, then ${pct(step.confirmation)})`
      : `rejected (${pct(step.firstTry)})`;
  return `step ${step.iteration + 1}: ${result}  ${step.changes.join(', ')}`;
}
