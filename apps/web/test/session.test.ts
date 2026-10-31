import { describe, expect, it } from 'vitest';
import { legalMoves, seededOracle } from '@brux/engine';
import {
  botDecision,
  botToAct,
  canRedo,
  canUndo,
  createBots,
  current,
  fromSaved,
  play,
  redo,
  startSession,
  toSaved,
  undo,
  whoActs,
  type Session,
  type SessionConfig,
} from '../src/game/session';

const config: SessionConfig = {
  seats: [
    { name: 'Hans', color: 'blue', bot: null },
    { name: 'Bot', color: 'red', bot: { difficulty: 'normal' } },
    { name: 'Eva', color: 'green', bot: null },
  ],
  seed: 1,
};

/** Answer chance events with a seeded oracle and humans with their first legal move, until a bot acts. */
function playUntilBot(session: Session): Session {
  const oracle = seededOracle(5);
  let s = session;
  for (let i = 0; i < 200 && botToAct(s) === null; i++) {
    const state = current(s);
    const actor = whoActs(state);
    if (actor.kind === 'none') break;
    if (actor.kind === 'chance' && state.pending?.kind === 'chance') {
      s = play(s, oracle.resolve(state, state.pending.event), 'chance');
    } else {
      s = play(s, legalMoves(state)[0]!, 'human');
    }
  }
  return s;
}

describe('session', () => {
  it('starts with the setup chance events for the table to answer', () => {
    const session = startSession(config);
    expect(whoActs(current(session))).toEqual({ kind: 'chance' });
    expect(canUndo(session)).toBe(false);
  });

  it('lets the bot decide when it is its turn, from what its seat can see', () => {
    const session = playUntilBot(startSession(config));
    const step = botDecision(session, createBots(config));
    expect(step?.player).toBe(1);
    expect(legalMoves(current(session))).toContainEqual(step!.move);
    expect(step!.decision.reason.length).toBeGreaterThan(0);
  });

  it('refuses illegal moves', () => {
    expect(() => play(startSession(config), { kind: 'pass' }, 'human')).toThrow();
  });

  it('undo goes back to before the last human input, bot moves included, and redo replays them', () => {
    let session = playUntilBot(startSession(config));
    const beforeBot = session.moves.length;
    const bots = createBots(config);
    for (let i = 0; i < 3 && botToAct(session) !== null; i++) {
      session = play(session, botDecision(session, bots)!.move, 'bot');
    }
    const afterBot = session.moves.length;
    expect(afterBot).toBeGreaterThan(beforeBot);

    const undone = undo(session);
    expect(undone.moves.length).toBe(beforeBot - 1);
    expect(current(undone)).toEqual(undone.history[beforeBot - 1]);
    expect(canRedo(undone)).toBe(true);

    const redone = redo(undone);
    expect(redone.moves).toEqual(session.moves);
    expect(canRedo(redone)).toBe(false);
  });

  it('a new move clears redo', () => {
    const session = playUntilBot(startSession(config));
    const undone = undo(session);
    const state = current(undone);
    const move =
      whoActs(state).kind === 'chance'
        ? session.moves[undone.moves.length]!
        : legalMoves(state)[0]!;
    expect(canRedo(play(undone, move, 'human'))).toBe(false);
  });

  it('saves as setup + moves and loads by replaying them', () => {
    const session = playUntilBot(startSession(config));
    const saved = JSON.parse(JSON.stringify(toSaved(session)));
    const loaded = fromSaved(saved);
    expect(current(loaded)).toEqual(current(session));
    expect(loaded.sources).toEqual(session.sources);
    expect(() => fromSaved({ hello: 'world' })).toThrow(/not a saved/);
  });
});
