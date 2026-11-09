/**
 * The game log: the app tells public/api/games.php when a game starts and
 * when it ends, so we can see how the app is used (playtesting, Phase 7).
 *
 * What is sent: a random game id, the times, the seats (color and bot level,
 * never names), the build, and at the end every seat's final score. The
 * server keeps only the network part of the IP address (rough geography).
 *
 * Tables often have bad Wi-Fi, so events wait in a queue in localStorage and
 * are sent when the connection is back. Logging never gets in the way of
 * playing: every error is swallowed. Players can switch it off.
 */

import type { FinalScore } from '@brux/engine';
import { current, type Session } from './session';

/** Where the app is served from, the endpoint sits in api/ next to index.html. */
export const GAME_LOG_URL = './api/games.php';
export const QUEUE_KEY = 'brux-de-luxe:game-log-queue';
export const OFF_KEY = 'brux-de-luxe:game-log-off';
/** If the server is away for a long time, keep only the newest events. */
export const QUEUE_MAX = 50;

export interface LoggedSeat {
  color: string;
  /** The bot's difficulty, or null for a human seat. */
  bot: string | null;
}

export interface GameStartEvent {
  event: 'start';
  gameId: string;
  /** ISO time on this device. */
  at: string;
  commit: string;
  seats: LoggedSeat[];
}

export interface GameEndEvent {
  event: 'end';
  gameId: string;
  at: string;
  moves: number;
  scores: (FinalScore & LoggedSeat)[];
}

export type GameLogEvent = GameStartEvent | GameEndEvent;

/** The bits of localStorage the log uses, so tests can pass a plain object. */
export type LogStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Sends one event. Resolves to the HTTP status; rejects when offline. */
export type Send = (event: GameLogEvent) => Promise<number>;

/** A random id for a new game (UUID v4). */
export function newGameId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID needs https; getRandomValues works everywhere.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function seats(session: Session): LoggedSeat[] {
  return session.config.seats.map((s) => ({ color: s.color, bot: s.bot?.difficulty ?? null }));
}

/** null for a game without an id (saved before the log existed). */
export function startEvent(session: Session, at: Date, commit: string): GameStartEvent | null {
  const gameId = session.config.gameId;
  if (!gameId) return null;
  return { event: 'start', gameId, at: at.toISOString(), commit, seats: seats(session) };
}

/** null unless the game is over and has an id. */
export function endEvent(session: Session, at: Date): GameEndEvent | null {
  const gameId = session.config.gameId;
  const final = current(session).final;
  if (!gameId || !final) return null;
  const seated = seats(session);
  return {
    event: 'end',
    gameId,
    at: at.toISOString(),
    moves: session.moves.length,
    scores: final.map((score) => ({ ...score, ...seated[score.player]! })),
  };
}

// --- Switching it off ------------------------------------------------------------

export function isLogOff(storage: LogStorage): boolean {
  try {
    return storage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
}

/** Off also forgets events that were still waiting to be sent. */
export function setLogOff(storage: LogStorage, off: boolean): void {
  try {
    if (off) {
      storage.setItem(OFF_KEY, '1');
      storage.removeItem(QUEUE_KEY);
    } else {
      storage.removeItem(OFF_KEY);
    }
  } catch {
    // Storage blocked: nothing is queued either, so nothing is sent.
  }
}

// --- The queue ---------------------------------------------------------------------

export function readQueue(storage: LogStorage): GameLogEvent[] {
  try {
    const queue: unknown = JSON.parse(storage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(queue) ? (queue as GameLogEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(storage: LogStorage, queue: GameLogEvent[]): void {
  try {
    if (queue.length === 0) storage.removeItem(QUEUE_KEY);
    else storage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_MAX)));
  } catch {
    // Storage full or blocked: the event is lost, the game goes on.
  }
}

export function enqueue(storage: LogStorage, event: GameLogEvent): void {
  if (isLogOff(storage)) return;
  writeQueue(storage, [...readQueue(storage), event]);
}

/**
 * Send what is queued, oldest first. An event leaves the queue when the
 * server took it (2xx) or refused it for good (other 4xx). Offline, a server
 * error or "too many" (429): stop and try again later.
 */
export async function flush(storage: LogStorage, send: Send): Promise<void> {
  if (isLogOff(storage)) return;
  for (;;) {
    const [next] = readQueue(storage);
    if (!next) return;
    let status: number;
    try {
      status = await send(next);
    } catch {
      return; // offline
    }
    if (status === 429 || status >= 500) return;
    // Drop the event just sent. Read again: another tab may have added one.
    writeQueue(
      storage,
      readQueue(storage).filter(
        (e) => e.gameId !== next.gameId || e.event !== next.event || e.at !== next.at,
      ),
    );
  }
}

export const sendWithFetch: Send = async (event) => {
  const res = await fetch(GAME_LOG_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  return res.status;
};
