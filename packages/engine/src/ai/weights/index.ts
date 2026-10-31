import defaults from './default.json';
import difficulties from './difficulty.json';
import type { Difficulty, DifficultyName, UtilityWeights } from './types';

export * from './types';

/** The hand-made weight set from Phase 4. */
export const DEFAULT_WEIGHTS: UtilityWeights = defaults;

/**
 * Every weight set the bot can play with, by name. The simulator's
 * `--bots utility:<name>` picks one; plain `utility` is `default`.
 */
export const WEIGHT_SETS: Record<string, UtilityWeights> = {
  default: DEFAULT_WEIGHTS,
};

export const DIFFICULTIES: Record<DifficultyName, Difficulty> = difficulties;
