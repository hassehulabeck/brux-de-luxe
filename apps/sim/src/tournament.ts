/**
 * The fixed tournament (`--tournament`): the same matchups every time, so a
 * change to the bot can be compared with a fixed seed (CLAUDE.md, AI
 * conventions). Phase 4's bar is the first matchup: utility wins at least
 * 80% against two greedy bots.
 */

import type { MatchOptions } from './args';
import type { BotName } from './bots';
import { runMatch, type MatchHooks, type MatchResult } from './match';

export const MATCHUPS: BotName[][] = [
  ['utility', 'greedy', 'greedy'],
  ['utility', 'random', 'random'],
  ['utility', 'greedy'],
  ['utility', 'greedy', 'greedy', 'greedy'],
  ['greedy', 'random', 'random'],
];

export function runTournament(
  base: Pick<MatchOptions, 'games' | 'seed' | 'checkInvariants'>,
  hooks: MatchHooks = {},
): MatchResult[] {
  return MATCHUPS.map((bots) => runMatch({ ...base, bots, players: [bots.length] }, hooks));
}

export function formatTournament(results: MatchResult[]): string {
  const rows = results.map((r) => {
    const played = r.games - r.errors.length;
    const cells = r.entries.map(
      (e) =>
        `${e.label} ${((e.wins / Math.max(1, played)) * 100).toFixed(1)}% (${(e.totalScore / Math.max(1, e.seats)).toFixed(1)})`,
    );
    return `${r.options.bots.length}p  ${cells.join('  ·  ')}${r.errors.length ? `  [${r.errors.length} failed]` : ''}`;
  });
  const first = results[0];
  return [
    `Tournament: ${first?.games ?? 0} games per matchup, seed ${first?.options.seed ?? '-'}`,
    'Win rate (average score) per bot:',
    ...rows,
  ].join('\n');
}
