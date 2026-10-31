/**
 * Command-line options for the simulator.
 *
 *   pnpm sim -- --games 1000 --players 3 --bots greedy,random,random --seed 42
 */

import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { UtilityWeights } from '@brux/engine';
import { botSpecError, BOT_NAMES, type BotSpec } from './bots';

/** What one match needs: who plays, how many games, which seed. */
export interface MatchOptions {
  games: number;
  /** Player counts to play, cycled game by game. */
  players: number[];
  /** One bot per seat, or a single bot for every seat. */
  bots: BotSpec[];
  seed: number;
  checkInvariants: boolean;
  /** Weight sets for "utility:<name>" bots. Default: the engine's WEIGHT_SETS. */
  weightSets?: Record<string, UtilityWeights>;
}

export interface SimOptions extends MatchOptions {
  /** Write every bot decision to this file, as JSON lines. */
  log: string | null;
  /** Play the fixed tournament instead of one match. */
  tournament: boolean;
  /** Tune a weight set instead (see tune.ts). */
  tune: boolean;
  iterations: number;
  /** The weight set tuning starts from. */
  from: string;
  /** Where the tuned weight set is written. */
  out: string;
}

export const USAGE = `Usage: pnpm sim -- [options]

  --games <n>          number of games (default 100)
  --players <n[,n]>    player count, or a list to cycle through (default 3)
  --bots <a,b,...>     one bot per seat, or one bot for all seats (default random)
                       bots: ${BOT_NAMES.join(', ')}; utility:<weight set> for another weight set
  --seed <n>           seed for the whole run (default 1)
  --no-invariants      skip the state invariant check after every move (faster)
  --log <file>         write every bot decision (with its top 3 alternatives) as JSON lines
  --tournament         play the fixed tournament, --games games per matchup
  --tune               tune a weight set by hill-climbing, --games games per evaluation
  --iterations <n>     tuning steps (default 30)
  --from <set>         weight set to start tuning from (default: default)
  --out <file>         where to write the tuned weights (default: the engine's weights/tuned.json)
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
      log: { type: 'string' },
      tournament: { type: 'boolean', default: false },
      tune: { type: 'boolean', default: false },
      iterations: { type: 'string', default: '30' },
      from: { type: 'string', default: 'default' },
      out: { type: 'string', default: DEFAULT_TUNE_OUT },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.help) throw new UsageError(USAGE);

  const games = wholeNumber('games', values.games, 1);
  const seed = wholeNumber('seed', values.seed, 0);
  const players = values.players.split(',').map((p) => wholeNumber('players', p, 2));
  if (players.some((p) => p > 5)) throw new UsageError('--players: from 2 to 5');

  const bots = values.bots.split(',').map((spec) => {
    const error = botSpecError(spec);
    if (error) throw new UsageError(`--bots: ${error}`);
    return spec;
  });
  if (bots.length > 1 && players.some((p) => p !== bots.length)) {
    throw new UsageError(
      `--bots: ${bots.length} bots given, but --players is ${players.join(',')}`,
    );
  }

  return {
    games,
    players,
    bots,
    seed,
    checkInvariants: !values['no-invariants'],
    log: values.log ?? null,
    tournament: values.tournament,
    tune: values.tune,
    iterations: wholeNumber('iterations', values.iterations, 1),
    from: values.from,
    out: values.out,
  };
}

export class UsageError extends Error {}

/** The engine's weight folder, found from this file so it works from any directory. */
export const DEFAULT_TUNE_OUT = fileURLToPath(
  new URL('../../../packages/engine/src/ai/weights/tuned.json', import.meta.url),
);

function wholeNumber(name: string, text: string, min: number): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min) {
    throw new UsageError(`--${name}: expected a whole number of at least ${min}, got "${text}"`);
  }
  return value;
}
