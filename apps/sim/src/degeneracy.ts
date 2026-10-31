/**
 * Checks for degenerate strategies (PLAN.md Phase 5): a bot that never uses
 * the Brussels board, always tucks its Bonus cards, never builds, or hoards
 * money. Tuned weights must not drift into these, so the report flags them.
 */

import type { EntryStats } from './match';

/** Per game, a bot that takes fewer Brussels actions than this "never uses" the board. */
const MIN_BRUSSELS_ACTIONS = 0.5;
/** A bot that tucks more than this share of its Bonus cards "always tucks". */
const MAX_TUCK_SHARE = 0.9;
/** Per game, a bot that builds fewer Buildings than this "never builds". */
const MIN_BUILDINGS = 0.5;
/** A bot that ends the game with more BF than this on average "hoards money". */
const MAX_FINAL_BF = 20;

export function degeneracyWarnings(entry: EntryStats): string[] {
  if (entry.seats === 0) return [];
  const perGame = (n: number) => n / entry.seats;
  const count = (prefix: string) =>
    Object.entries(entry.actions)
      .filter(([label]) => label.startsWith(prefix))
      .reduce((sum, [, n]) => sum + n, 0);

  const warnings: string[] = [];
  const brussels = perGame(count('Brussels:'));
  if (brussels < MIN_BRUSSELS_ACTIONS) {
    warnings.push(`never uses the Brussels board (${brussels.toFixed(1)} actions per game)`);
  }
  const tucked = count('Tucked a Bonus card');
  const used = count('Used a Bonus card');
  if (tucked + used > 0 && tucked / (tucked + used) > MAX_TUCK_SHARE) {
    warnings.push(
      `always tucks Bonus cards (${Math.round((100 * tucked) / (tucked + used))}% tucked)`,
    );
  }
  const built = perGame(count('Built a Building'));
  if (built < MIN_BUILDINGS) {
    warnings.push(`never builds (${built.toFixed(1)} Buildings per game)`);
  }
  const bf = perGame(entry.finalBf);
  if (bf > MAX_FINAL_BF) warnings.push(`hoards money (${bf.toFixed(1)} BF left at the end)`);
  return warnings;
}

/** "utility: never builds (0.2 Buildings per game)", one line per warning. */
export function formatWarnings(entries: EntryStats[]): string[] {
  return entries.flatMap((e) => degeneracyWarnings(e).map((w) => `${e.label}: ${w}`));
}
