import { greedyBot, randomBot, seededRng, type Bot } from '@brux/engine';

export const BOT_NAMES = ['random', 'greedy'] as const;
export type BotName = (typeof BOT_NAMES)[number];

export function createBot(name: BotName, seed: number): Bot {
  const rng = seededRng(seed);
  switch (name) {
    case 'random':
      return randomBot(rng);
    case 'greedy':
      return greedyBot(rng);
  }
}
