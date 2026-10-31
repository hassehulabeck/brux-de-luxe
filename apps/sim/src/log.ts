/**
 * The decision log (`--log <file>`): one JSON line per bot decision, with the
 * reason and the best alternatives, so a game can be read back afterwards.
 */

import { closeSync, openSync, writeSync } from 'node:fs';
import { describeMove, type BotDecision, type GameState } from '@brux/engine';

export interface DecisionLogEntry {
  game: number;
  seed: number;
  round: number;
  seat: number;
  bot: string;
  /** The kind of decision: "turn", "moveCursor", ... */
  decision: string;
  plan: string | null;
  move: string;
  score: number;
  reason: string;
  alternatives: { move: string; score: number; reason: string }[];
}

export function logEntry(input: {
  game: number;
  seed: number;
  state: GameState;
  player: number;
  bot: string;
  decision: BotDecision;
}): DecisionLogEntry {
  const { state, decision } = input;
  return {
    game: input.game,
    seed: input.seed,
    round: state.round.number,
    seat: input.player,
    bot: input.bot,
    decision: state.pending?.kind ?? 'none',
    plan: decision.plan ?? null,
    move: describeMove(state, decision.move),
    score: round(decision.score),
    reason: decision.reason,
    alternatives: decision.alternatives.slice(0, 3).map((alt) => ({
      move: describeMove(state, alt.move),
      score: round(alt.score),
      reason: alt.reason,
    })),
  };
}

/** A log file, written line by line as the games are played. */
export function openLog(path: string) {
  const fd = openSync(path, 'w');
  return {
    write: (entry: DecisionLogEntry) => writeSync(fd, `${JSON.stringify(entry)}\n`),
    close: () => closeSync(fd),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
