/**
 * Command-line options for the simulator.
 *
 *   pnpm sim -- --games 1000 --players 3 --bots greedy,random,random --seed 42
 */

import { parseArgs } from 'node:util';
import { BOT_NAMES, type BotName } from './bots';

export interface SimOptions {
  games: number;
  /** Player counts to play, cycled game by game. */
  players: number[];
  /** One bot per seat, or a single bot for every seat. */
  bots: BotName[];
  seed: number;
  checkInvariants: boolean;
}

export const USAGE = `Usage: pnpm sim -- [options]

  --games <n>          number of games (default 100)
  --players <n[,n]>    player count, or a list to cycle through (default 3)
  --bots <a,b,...>     one bot per seat, or one bot for all seats (default random)
                       bots: ${BOT_NAMES.join(', ')}
  --seed <n>           seed for the whole run (default 1)
  --no-invariants      skip the state invariant check after every move (faster)
  --help               show this help`;

export function parseSimArgs(argv: string[]): SimOptions {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  const { values } = parseArgs({
    args,
    options: {
      games: { type: 'string', default: '100' },
      players: { type: 'string', default: '3' },
      bots: { type: 'string', default: 'random' },
      seed: { type: 'string', default: '1' },
      'no-invariants': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.help) throw new UsageError(USAGE);

  const games = wholeNumber('games', values.games, 1);
  const seed = wholeNumber('seed', values.seed, 0);
  const players = values.players.split(',').map((p) => wholeNumber('players', p, 2));
  if (players.some((p) => p > 5)) throw new UsageError('--players: from 2 to 5');

  const bots = values.bots.split(',').map((name) => {
    if (!(BOT_NAMES as readonly string[]).includes(name)) {
      throw new UsageError(`--bots: unknown bot "${name}" (known: ${BOT_NAMES.join(', ')})`);
    }
    return name as BotName;
  });
  if (bots.length > 1 && players.some((p) => p !== bots.length)) {
    throw new UsageError(
      `--bots: ${bots.length} bots given, but --players is ${players.join(',')}`,
    );
  }

  return { games, players, bots, seed, checkInvariants: !values['no-invariants'] };
}

export class UsageError extends Error {}

function wholeNumber(name: string, text: string, min: number): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min) {
    throw new UsageError(`--${name}: expected a whole number of at least ${min}, got "${text}"`);
  }
  return value;
}
