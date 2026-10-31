/**
 * Runs a series of games and collects statistics per bot entry.
 */

import {
  ACTION_NAMES,
  BRUSSELS_ACTION_NAMES,
  playGame,
  seededOracle,
  type FinalScore,
  type GameState,
  type Move,
} from '@brux/engine';
import { createBot, type BotName } from './bots';
import type { MatchOptions } from './args';
import { logEntry, type DecisionLogEntry } from './log';

export interface EntryStats {
  label: string;
  /** Seats played: one per game this entry took part in, per seat. */
  seats: number;
  /** Wins, with ties shared (two winners get 0.5 each). */
  wins: number;
  totalScore: number;
  breakdown: Omit<FinalScore, 'player' | 'total' | 'rows'> & { rows: number[] };
  /** How often each kind of decision was chosen. */
  actions: Record<string, number>;
}

export interface GameError {
  game: number;
  seed: number;
  message: string;
}

export interface MatchResult {
  options: MatchOptions;
  games: number;
  totalMoves: number;
  milliseconds: number;
  entries: EntryStats[];
  errors: GameError[];
}

export interface MatchHooks {
  onGameDone?: (game: number) => void;
  /** Called for every bot decision, for the decision log. */
  onDecision?: (entry: DecisionLogEntry) => void;
}

export function runMatch(options: MatchOptions, hooks: MatchHooks = {}): MatchResult {
  const started = Date.now();
  const labels = entryLabels(options.bots);
  const entries = labels.map(newEntry);
  const errors: GameError[] = [];
  let totalMoves = 0;

  for (let game = 0; game < options.games; game++) {
    const playerCount = options.players[game % options.players.length]!;
    const seed = gameSeed(options.seed, game);
    // Rotate the seats every game so no bot always starts first.
    const entryForSeat = Array.from({ length: playerCount }, (_, seat) =>
      options.bots.length === 1 ? 0 : (seat + game) % playerCount,
    );
    const bots = entryForSeat.map((entry, seat) =>
      createBot(options.bots[entry] as BotName, seed + seat + 1),
    );
    try {
      const { final, moves } = playGame({
        bots,
        oracle: seededOracle(seed),
        checkInvariants: options.checkInvariants,
        onDecision: (state, player, decision) => {
          const entry = entries[entryForSeat[player]!]!;
          const label = actionLabel(state, decision.move);
          if (label) count(entry.actions, label);
          hooks.onDecision?.(logEntry({ game, seed, state, player, bot: entry.label, decision }));
        },
      });
      totalMoves += moves.length;
      recordScores(final, entries, entryForSeat);
    } catch (error) {
      errors.push({ game, seed, message: error instanceof Error ? error.message : String(error) });
    }
    hooks.onGameDone?.(game);
  }

  return {
    options,
    games: options.games,
    totalMoves,
    milliseconds: Date.now() - started,
    entries,
    errors,
  };
}

/** A different, reproducible seed for every game of a run. */
export function gameSeed(runSeed: number, game: number): number {
  return (Math.imul(runSeed, 2654435761) + game * 7919) >>> 0;
}

/** "greedy", "random #1", "random #2": duplicates get a number. */
export function entryLabels(bots: string[]): string[] {
  return bots.map((name, i) =>
    bots.filter((b) => b === name).length > 1
      ? `${name} #${bots.slice(0, i + 1).filter((b) => b === name).length}`
      : name,
  );
}

/** The decisions worth counting, in words a player would use. */
export function actionLabel(state: GameState, move: Move): string | null {
  switch (move.kind) {
    case 'placeAssistant': {
      const action = state.board[move.space.row]?.[move.space.col]?.action;
      return action ? `Art Nouveau: ${ACTION_NAMES[action]}` : null;
    }
    case 'takeBrusselsAction':
      return `Brussels: ${BRUSSELS_ACTION_NAMES[move.action]}`;
    case 'chooseParkAction':
      return `Park: ${ACTION_NAMES[move.action]}`;
    case 'pass':
      return 'Pass';
    case 'skipAction':
      return 'Skipped action';
    case 'keepPublicFigure':
      return 'Kept a Public Figure';
    case 'useBonus':
      return 'Used a Bonus card';
    case 'tuckBonus':
      return 'Tucked a Bonus card';
    case 'placeBuilding':
      return 'Built a Building';
    case 'sellWork':
      return 'Sold a Work of Art';
    default:
      return null;
  }
}

function recordScores(final: GameState, entries: EntryStats[], entryForSeat: number[]): void {
  const scores = final.final ?? [];
  const best = Math.max(...scores.map((s) => s.total));
  const winners = scores.filter((s) => s.total === best).length;
  for (const score of scores) {
    const entry = entries[entryForSeat[score.player]!]!;
    entry.seats++;
    entry.totalScore += score.total;
    if (score.total === best) entry.wins += 1 / winners;
    const b = entry.breakdown;
    b.scoringTrack += score.scoringTrack;
    b.buildings += score.buildings;
    score.rows.forEach((row, i) => (b.rows[i]! += row));
    b.nobleMaterials += score.nobleMaterials;
    b.mannekenPis += score.mannekenPis;
  }
}

function newEntry(label: string): EntryStats {
  return {
    label,
    seats: 0,
    wins: 0,
    totalScore: 0,
    breakdown: {
      scoringTrack: 0,
      buildings: 0,
      rows: [0, 0, 0, 0],
      nobleMaterials: 0,
      mannekenPis: 0,
    },
    actions: {},
  };
}

function count(counts: Record<string, number>, label: string): void {
  counts[label] = (counts[label] ?? 0) + 1;
}
