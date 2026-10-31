import defaults from './default.json';
import difficulties from './difficulty.json';
import type { Difficulty, DifficultyName, UtilityWeights } from './types';

export * from './types';

/** The hand-made weight set. Phase 5 tunes it. */
export const DEFAULT_WEIGHTS: UtilityWeights = defaults;

export const DIFFICULTIES: Record<DifficultyName, Difficulty> = difficulties;
