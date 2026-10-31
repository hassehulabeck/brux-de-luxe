import {
  greedyBot,
  randomBot,
  seededRng,
  utilityBot,
  WEIGHT_SETS,
  type Bot,
  type UtilityWeights,
} from '@brux/engine';

export const BOT_NAMES = ['random', 'greedy', 'utility'] as const;

/**
 * A bot as the command line names it: "random", "greedy", "utility", or
 * "utility:<weight set>" for the utility bot with another weight set.
 */
export type BotSpec = string;

export type WeightSets = Record<string, UtilityWeights>;

/** Why a bot spec is not valid, or null if it is. */
export function botSpecError(spec: BotSpec, weightSets: WeightSets = WEIGHT_SETS): string | null {
  const [name, set] = spec.split(':');
  if (!(BOT_NAMES as readonly string[]).includes(name ?? '')) {
    return `unknown bot "${spec}" (known: ${BOT_NAMES.join(', ')})`;
  }
  if (set === undefined) return null;
  if (name !== 'utility') return `only the utility bot takes a weight set ("${spec}")`;
  if (!weightSets[set]) {
    return `unknown weight set "${set}" (known: ${Object.keys(weightSets).join(', ')})`;
  }
  return null;
}

export function createBot(spec: BotSpec, seed: number, weightSets: WeightSets = WEIGHT_SETS): Bot {
  const error = botSpecError(spec, weightSets);
  if (error) throw new Error(error);
  const [name, set = 'default'] = spec.split(':');
  const rng = seededRng(seed);
  switch (name) {
    case 'random':
      return randomBot(rng);
    case 'greedy':
      return greedyBot(rng);
    default:
      return utilityBot({ rng, weights: weightSets[set]!, name: spec });
  }
}
