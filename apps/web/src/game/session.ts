/**
 * A game at the table: the setup, every move so far, and the states they
 * lead to. Plain functions on plain data, so the Pinia store stays thin and
 * this can be tested without a browser.
 *
 * Who enters what:
 * - Human seats: the humans tap their own decisions.
 * - Chance (cards revealed, works drawn): the humans tell the app what came out.
 * - Bot seats: the app decides, and a human carries the move out on the board.
 *
 * A saved game is the setup plus the list of moves. Loading replays them.
 */

import {
  apply,
  newGame,
  seededRng,
  utilityBot,
  visibleState,
  type Bot,
  type BotDecision,
  type DifficultyName,
  type GameState,
  type Move,
  type PlayerCount,
  type PlayerIndex,
} from '@brux/engine';

export interface SeatConfig {
  name: string;
  /** The color of the seat's pieces, as the players call it. Only a label. */
  color: string;
  /** null for a human seat. */
  bot: { difficulty: DifficultyName } | null;
}

export interface SessionConfig {
  /** Seat 0 first: the first player of round 1, then clockwise. */
  seats: SeatConfig[];
  /** Seed for the bots' own random choices. */
  seed: number;
}

/** One bot decision, as the table sees it. */
export interface BotStep {
  player: PlayerIndex;
  move: Move;
  decision: BotDecision;
  /** The state the decision was made in (for describing it). */
  state: GameState;
}

export interface Session {
  config: SessionConfig;
  /** history[0] is the new game; history[i + 1] = apply(history[i], moves[i]). */
  history: GameState[];
  moves: Move[];
  /** For each move: who entered it. */
  sources: MoveSource[];
  /** Moves undone, most recent last, for redo. */
  undone: { move: Move; source: MoveSource }[];
}

export type MoveSource = 'human' | 'chance' | 'bot';

/** What a save file holds. */
export interface SavedGame {
  version: 1;
  config: SessionConfig;
  moves: Move[];
  sources: MoveSource[];
}

export function startSession(config: SessionConfig): Session {
  const state = newGame({ playerCount: config.seats.length as PlayerCount });
  return { config, history: [state], moves: [], sources: [], undone: [] };
}

export function current(session: Session): GameState {
  return session.history[session.history.length - 1]!;
}

/** Who has to act now: a seat, the table (chance), or nobody (game over). */
export function whoActs(
  state: GameState,
): { kind: 'seat'; player: PlayerIndex } | { kind: 'chance' } | { kind: 'none' } {
  const pending = state.pending;
  if (!pending || pending.kind === 'gameOver') return { kind: 'none' };
  if (pending.kind === 'chance') return { kind: 'chance' };
  return { kind: 'seat', player: pending.player };
}

export function isBotSeat(session: Session, player: PlayerIndex): boolean {
  return session.config.seats[player]?.bot != null;
}

/** True if the next decision is a bot's. */
export function botToAct(session: Session): PlayerIndex | null {
  const actor = whoActs(current(session));
  return actor.kind === 'seat' && isBotSeat(session, actor.player) ? actor.player : null;
}

/**
 * Play a move. apply() refuses illegal moves, so a broken save or a UI bug
 * can never put the game in an impossible state. A new move clears redo.
 */
export function play(session: Session, move: Move, source: MoveSource): Session {
  const next = apply(current(session), move);
  return {
    ...session,
    history: [...session.history, next],
    moves: [...session.moves, move],
    sources: [...session.sources, source],
    undone: [],
  };
}

/**
 * Undo back to before the last thing a human entered (a decision or a
 * chance outcome). Bot moves after it go too: the bot decides again.
 */
export function undo(session: Session): Session {
  const last = lastHumanInput(session);
  if (last < 0) return session;
  const undone = session.moves
    .slice(last)
    .map((move, i) => ({ move, source: session.sources[last + i]! }))
    .reverse();
  return {
    ...session,
    history: session.history.slice(0, last + 1),
    moves: session.moves.slice(0, last),
    sources: session.sources.slice(0, last),
    undone: [...session.undone, ...undone],
  };
}

export function canUndo(session: Session): boolean {
  return lastHumanInput(session) >= 0;
}

/** Index of the last move a human entered, or -1. */
function lastHumanInput(session: Session): number {
  for (let i = session.sources.length - 1; i >= 0; i--) {
    if (session.sources[i] !== 'bot') return i;
  }
  return -1;
}

/** Redo what the last undo took back (up to the next human input). */
export function redo(session: Session): Session {
  let result = session;
  const undone = [...session.undone];
  let first = true;
  while (undone.length > 0) {
    const next = undone[undone.length - 1]!;
    if (!first && next.source !== 'bot') break;
    undone.pop();
    result = { ...play(result, next.move, next.source), undone: [...undone] };
    first = false;
  }
  return result;
}

export function canRedo(session: Session): boolean {
  return session.undone.length > 0;
}

// --- Bots ------------------------------------------------------------------------

/** One utility bot per bot seat, with its own random generator. */
export function createBots(config: SessionConfig): (Bot | null)[] {
  return config.seats.map((seat, i) =>
    seat.bot
      ? utilityBot({ rng: seededRng(config.seed + i + 1), difficulty: seat.bot.difficulty })
      : null,
  );
}

/** The bot's decision for the current state. It only sees what its seat may see. */
export function botDecision(session: Session, bots: (Bot | null)[]): BotStep | null {
  const player = botToAct(session);
  if (player === null) return null;
  const bot = bots[player];
  if (!bot) return null;
  const state = current(session);
  const decision = bot.decide(visibleState(state, player), player);
  return { player, move: decision.move, decision, state };
}

// --- Saving ------------------------------------------------------------------------

export function toSaved(session: Session): SavedGame {
  return { version: 1, config: session.config, moves: session.moves, sources: session.sources };
}

/** Replay a saved game. Throws if the file is not a game or a move is illegal. */
export function fromSaved(saved: unknown): Session {
  const data = saved as Partial<SavedGame> | null;
  if (!data || data.version !== 1 || !data.config || !Array.isArray(data.moves)) {
    throw new Error('This is not a saved Bruxelles 1893 game.');
  }
  const sources = Array.isArray(data.sources) ? data.sources : data.moves.map(() => 'human');
  let session = startSession(data.config);
  data.moves.forEach((move, i) => {
    session = play(session, move, (sources[i] ?? 'human') as MoveSource);
  });
  return session;
}
