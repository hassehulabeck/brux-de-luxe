/**
 * Formats a MatchResult as plain text tables for the terminal.
 */

import { formatWarnings } from './degeneracy';
import type { EntryStats, MatchResult } from './match';

export function formatReport(result: MatchResult): string {
  const { options, entries } = result;
  const played = result.games - result.errors.length;
  const lines: string[] = [
    `${played} of ${result.games} games played in ${(result.milliseconds / 1000).toFixed(1)} s` +
      ` (players: ${options.players.join(',')}, bots: ${options.bots.join(',')}, seed: ${options.seed}` +
      `${options.checkInvariants ? ', invariants checked' : ''})`,
    `Average moves per game: ${played ? Math.round(result.totalMoves / played) : 0}`,
    '',
    table(
      [
        'Bot',
        'Win rate',
        'Avg score',
        'Track',
        'Buildings',
        'Row 1',
        'Row 2',
        'Row 3',
        'Row 4',
        'Nobles',
        'M. Pis',
      ],
      entries.map((e) => [
        e.label,
        percent(e.wins / Math.max(1, gamesPerSeatShare(e, result))),
        avg(e.totalScore, e.seats),
        avg(e.breakdown.scoringTrack, e.seats),
        avg(e.breakdown.buildings, e.seats),
        ...e.breakdown.rows.map((r) => avg(r, e.seats)),
        avg(e.breakdown.nobleMaterials, e.seats),
        avg(e.breakdown.mannekenPis, e.seats),
      ]),
    ),
    '',
    'Decisions per game (per seat):',
    actionsTable(entries),
  ];

  const warnings = formatWarnings(entries);
  lines.push(
    '',
    'Degenerate strategies:',
    ...(warnings.length ? warnings.map((w) => `  ${w}`) : ['  none']),
  );

  if (result.errors.length > 0) {
    lines.push('', `${result.errors.length} game(s) failed:`);
    for (const e of result.errors.slice(0, 10)) {
      lines.push(`  game ${e.game} (seed ${e.seed}): ${e.message.split('\n').join(' | ')}`);
    }
  }
  return lines.join('\n');
}

/**
 * Games an entry could have won. A bot playing every seat (single-bot runs)
 * wins every game, so its win rate is shown per seat instead.
 */
function gamesPerSeatShare(entry: EntryStats, result: MatchResult): number {
  return result.options.bots.length === 1 ? entry.seats : result.games - result.errors.length;
}

function actionsTable(entries: EntryStats[]): string {
  const labels = [...new Set(entries.flatMap((e) => Object.keys(e.actions)))].sort();
  return table(
    ['Decision', ...entries.map((e) => e.label)],
    labels.map((label) => [label, ...entries.map((e) => avg(e.actions[label] ?? 0, e.seats))]),
  );
}

function table(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

function avg(total: number, n: number): string {
  return n === 0 ? '-' : (total / n).toFixed(1);
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}
