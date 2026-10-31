import defaults from './default.json';
import difficulties from './difficulty.json';
import tuned from './tuned.json';
import type { Difficulty, DifficultyName, UtilityWeights } from './types';

export * from './types';

/** The hand-made weight set from Phase 4. */
export const DEFAULT_WEIGHTS: UtilityWeights = defaults;

/** The default set after hill-climbing in the simulator (Phase 5, `pnpm sim -- --tune`). */
export const TUNED_WEIGHTS: UtilityWeights = tuned;

/**
 * Every weight set the bot can play with, by name. The simulator's
 * `--bots utility:<name>` picks one; plain `utility` is `default`.
 */
export const WEIGHT_SETS: Record<string, UtilityWeights> = {
  default: DEFAULT_WEIGHTS,
  tuned: TUNED_WEIGHTS,
};

export const DIFFICULTIES: Record<DifficultyName, Difficulty> = difficulties;
