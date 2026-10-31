export type { Bot, BotDecision, ScoredMove } from './types';
export { describeMove, ACTION_NAMES, BRUSSELS_ACTION_NAMES } from './explain';
export { randomBot } from './bots/random';
export { greedyBot } from './bots/greedy';
export { playGame, type PlayOptions, type PlayedGame } from './play';
