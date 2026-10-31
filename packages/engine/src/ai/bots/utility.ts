/**
 * UtilityBot (PLAN.md section 5): plays like a player with a plan.
 *
 * Every decision:
 * 1. Blend the four plans from the bot's position (plans.ts).
 * 2. Score every candidate move: the considerations, added up with their
 *    weights, on the state after the move's best follow-ups (search.ts).
 * 3. Pick: on its turns the bot samples among its best few moves (the
 *    difficulty sets how many and how freely); every other decision takes
 *    the best move.
 *
 * The bot remembers which plan led each round, to give it some inertia.
 * That memory is only a nudge: a bot without it (after a reload) plays on.
 */

import type { Rng } from '../../chance/rng';
import { blendPlans, PLAN_LABELS, type Temperament } from '../plans';
import { utilityReason } from '../reason';
import { scoreMoves, type EvaluatedMove } from '../search';
import type { Bot, ScoredMove } from '../types';
import {
  DEFAULT_WEIGHTS,
  DIFFICULTIES,
  type Difficulty,
  type DifficultyName,
  type PlanName,
  type UtilityWeights,
} from '../weights';

export interface UtilityBotOptions {
  rng: Rng;
  difficulty?: DifficultyName;
  weights?: UtilityWeights;
  /** A fixed lean towards some plans, added to their fitness. */
  temperament?: Temperament;
  name?: string;
}

export function utilityBot(options: UtilityBotOptions): Bot {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const difficulty = DIFFICULTIES[options.difficulty ?? 'normal'];
  const leaders = new Map<number, PlanName>();

  return {
    name: options.name ?? 'utility',
    decide(view, me) {
      const blend = blendPlans(view, me, weights, {
        previousLeader: leaders.get(view.round.number - 1),
        temperament: options.temperament ?? {},
      });
      leaders.set(view.round.number, blend.leader);
      const plan = PLAN_LABELS[blend.leader];

      const scored = scoreMoves(view, me, weights, blend.sources);
      if (scored.length === 0) throw new Error('No legal moves');
      const choice =
        view.pending?.kind === 'turn'
          ? sample(scored, difficulty, options.rng)
          : bestWithTies(scored, options.rng);

      const toScored = (e: EvaluatedMove): ScoredMove => ({
        move: e.move,
        score: e.score,
        reason: utilityReason(view, e, me, plan),
      });
      return {
        ...toScored(choice),
        alternatives: scored
          .filter((e) => e !== choice)
          .slice(0, 3)
          .map(toScored),
        plan,
      };
    },
  };
}

/** The best move; equally good ones are picked at random. */
function bestWithTies(scored: EvaluatedMove[], rng: Rng): EvaluatedMove {
  const best = scored.filter((s) => s.score === scored[0]!.score);
  return best[rng.int(best.length)]!;
}

/**
 * Sample among the top-k moves, each weighted by exp(-(gap to the best) / T).
 * Temperature 0 (or k = 1) always plays the best move.
 */
export function sample(scored: EvaluatedMove[], difficulty: Difficulty, rng: Rng): EvaluatedMove {
  if (difficulty.temperature <= 0 || difficulty.topK <= 1) return bestWithTies(scored, rng);
  const top = scored.slice(0, difficulty.topK);
  const best = top[0]!.score;
  const odds = top.map((s) => Math.exp((s.score - best) / difficulty.temperature));
  let roll = rng.next() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    roll -= odds[i]!;
    if (roll <= 0) return top[i]!;
  }
  return top[0]!;
}
