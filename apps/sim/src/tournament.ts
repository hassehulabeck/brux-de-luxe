/**
 * The fixed tournament (`--tournament`): the same matchups every time, so a
 * change to the bot can be compared with a fixed seed (CLAUDE.md, AI
 * conventions). Phase 4's bar is the first matchup: utility wins at least
 * 80% against two greedy bots. Phase 5's bar: utility:tuned beats plain
 * utility (the hand-made weights).
 */

import type { MatchOptions } from './args';
import type { BotSpec } from './bots';
import { formatWarnings } from './degeneracy';
import { runMatch, type MatchHooks, type MatchResult } from './match';

export const MATCHUPS: BotSpec[][] = [
  ['utility', 'greedy', 'greedy'],
  ['utility', 'random', 'random'],
  ['utility', 'greedy'],
  ['utility', 'greedy', 'greedy', 'greedy'],
  ['greedy', 'random', 'random'],
  // Phase 5: the tuned weights against the hand-made ones.
  ['utility:tuned', 'utility', 'utility'],
  ['utility:tuned', 'utility'],
  ['utility:tuned', 'greedy', 'greedy'],
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
  const warnings = results.flatMap((r) =>
    formatWarnings(r.entries.filter((e) => e.label.startsWith('utility'))).map(
      (w) => `  ${r.options.bots.length}p ${w}`,
    ),
  );
  return [
    `Tournament: ${first?.games ?? 0} games per matchup, seed ${first?.options.seed ?? '-'}`,
    'Win rate (average score) per bot:',
    ...rows,
    'Degenerate strategies (utility bots):',
    ...(warnings.length ? warnings : ['  none']),
  ].join('\n');
}
