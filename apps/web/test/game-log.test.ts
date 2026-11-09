import { describe, expect, it } from 'vitest';
import type { FinalScore } from '@brux/engine';
import {
  OFF_KEY,
  QUEUE_KEY,
  QUEUE_MAX,
  endEvent,
  enqueue,
  flush,
  isLogOff,
  newGameId,
  readQueue,
  setLogOff,
  startEvent,
  type GameLogEvent,
  type LogStorage,
} from '../src/game/game-log';
import { current, startSession, type Session } from '../src/game/session';

function memoryStorage(): LogStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const session = startSession({
  seats: [
    { name: 'Hans', color: 'blue', bot: null },
    { name: 'Bot', color: 'red', bot: { difficulty: 'hard' } },
  ],
  seed: 1,
  gameId: '0b9c1f9e-5a5e-4c1b-9d47-0f6f2e1d3a77',
});

const score = (player: 0 | 1, total: number): FinalScore => ({
  player,
  scoringTrack: total - 10,
  buildings: 4,
  rows: [1, 2, 0, 3],
  nobleMaterials: 0,
  mannekenPis: 0,
  total,
});

/** The same game, pretending it is over after 7 moves. */
const over: Session = {
  ...session,
  history: [{ ...current(session), final: [score(0, 52), score(1, 61)] }],
  moves: Array(7).fill({ kind: 'pass' }),
};

const at = new Date('2026-11-09T19:30:00Z');

describe('game log events', () => {
  it('makes a random UUID per game', () => {
    const id = newGameId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newGameId()).not.toBe(id);
  });

  it('starts with the seats, without names', () => {
    expect(startEvent(session, at, 'abc1234')).toEqual({
      event: 'start',
      gameId: session.config.gameId,
      at: '2026-11-09T19:30:00.000Z',
      commit: 'abc1234',
      seats: [
        { color: 'blue', bot: null },
        { color: 'red', bot: 'hard' },
      ],
    });
    expect(JSON.stringify(startEvent(session, at, 'x'))).not.toContain('Hans');
  });

  it('ends with every seat’s whole final score', () => {
    expect(endEvent(session, at)).toBeNull(); // not over yet
    expect(endEvent(over, at)).toEqual({
      event: 'end',
      gameId: session.config.gameId,
      at: '2026-11-09T19:30:00.000Z',
      moves: 7,
      scores: [
        { ...score(0, 52), color: 'blue', bot: null },
        { ...score(1, 61), color: 'red', bot: 'hard' },
      ],
    });
  });

  it('logs nothing for a game saved before the log existed', () => {
    const old: Session = {
      ...over,
      config: { seats: over.config.seats, seed: over.config.seed },
    };
    expect(startEvent(old, at, 'x')).toBeNull();
    expect(endEvent(old, at)).toBeNull();
  });
});

describe('the game log queue', () => {
  const start = startEvent(session, at, 'abc')!;
  const end = endEvent(over, at)!;

  it('sends queued events in order and empties the queue', async () => {
    const storage = memoryStorage();
    enqueue(storage, start);
    enqueue(storage, end);
    const sent: GameLogEvent[] = [];
    await flush(storage, async (e) => (sent.push(e), 200));
    expect(sent).toEqual([start, end]);
    expect(storage.data.has(QUEUE_KEY)).toBe(false);
  });

  it('keeps events while offline, or when the server is busy or broken', async () => {
    const storage = memoryStorage();
    enqueue(storage, start);
    await flush(storage, () => Promise.reject(new TypeError('Failed to fetch')));
    await flush(storage, async () => 500);
    await flush(storage, async () => 429);
    expect(readQueue(storage)).toEqual([start]);
  });

  it('drops an event the server refuses for good', async () => {
    const storage = memoryStorage();
    enqueue(storage, start);
    enqueue(storage, end);
    const statuses = [400, 200];
    await flush(storage, async () => statuses.shift()!);
    expect(readQueue(storage)).toEqual([]);
  });

  it('keeps only the newest events', () => {
    const storage = memoryStorage();
    for (let i = 0; i < QUEUE_MAX + 5; i++) enqueue(storage, { ...start, commit: String(i) });
    const queue = readQueue(storage);
    expect(queue).toHaveLength(QUEUE_MAX);
    expect(queue[0]).toMatchObject({ commit: '5' });
  });

  it('switched off: queues nothing, sends nothing, forgets what waited', async () => {
    const storage = memoryStorage();
    enqueue(storage, start);
    setLogOff(storage, true);
    expect(isLogOff(storage)).toBe(true);
    expect(storage.data.get(OFF_KEY)).toBe('1');
    expect(readQueue(storage)).toEqual([]);
    enqueue(storage, end);
    expect(readQueue(storage)).toEqual([]);

    setLogOff(storage, false);
    expect(isLogOff(storage)).toBe(false);
  });

  it('survives storage that throws', async () => {
    const broken: LogStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => enqueue(broken, start)).not.toThrow();
    expect(() => setLogOff(broken, true)).not.toThrow();
    await expect(flush(broken, async () => 200)).resolves.toBeUndefined();
  });
});
