/**
 * The game at the table, for the Vue components. The rules and the game
 * history live in game/session.ts; this store adds what the screen needs:
 * the bot turn being shown, autosave, export and import.
 */

import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { describeMove, type Bot, type GameState, type Move } from '@brux/engine';
import { APP_COMMIT, recordError } from '../game/feedback';
import {
  endEvent,
  enqueue,
  flush,
  isLogOff,
  newGameId,
  sendWithFetch,
  setLogOff,
  startEvent,
  type GameLogEvent,
  type LogStorage,
} from '../game/game-log';
import { botInstruction, eventInstruction } from '../game/labels';
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
} from '../game/session';

const STORAGE_KEY = 'brux-de-luxe:game';

/** localStorage, or null where there is none (tests, blocked storage). */
function browserStorage(): LogStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** One flush at a time; a running flush also picks up events queued meanwhile. */
let flushing: Promise<void> | null = null;

/** Queue a game log event (if any) and try to send the queue. Never throws. */
function logGame(event: GameLogEvent | null): void {
  const storage = browserStorage();
  if (!storage) return;
  if (event) enqueue(storage, event);
  flushing ??= flush(storage, sendWithFetch)
    .catch(() => {})
    .finally(() => (flushing = null));
}

/** Which result was logged last: the game id and its number of moves. */
function endKey(session: Session): string {
  return `${session.config.gameId}:${session.moves.length}`;
}

export interface BotTurnStep {
  instruction: string;
  reason: string;
}

/** The bot moves a human still has to carry out on the board. */
export interface BotTurn {
  player: number;
  plan: string | null;
  steps: BotTurnStep[];
}

export const useGameStore = defineStore('game', {
  state: () => ({
    session: null as Session | null,
    bots: [] as (Bot | null)[],
    botTurn: null as BotTurn | null,
    /**
     * What the engine did on its own after a human or chance move (a shield
     * scoring, a secondary action...), for the table to copy on the board.
     */
    notes: [] as string[],
    error: null as string | null,
    /** endKey() of the game over last sent to the game log, so it is sent once. */
    endLogged: null as string | null,
    /** The player switched the game log off on this device. */
    logOff: (() => {
      const storage = browserStorage();
      return storage ? isLogOff(storage) : false;
    })(),
  }),

  getters: {
    state(): GameState | null {
      return this.session ? current(this.session) : null;
    },
    seats(): SessionConfig['seats'] {
      return this.session?.config.seats ?? [];
    },
    canUndo(): boolean {
      return this.session !== null && canUndo(this.session);
    },
    canRedo(): boolean {
      return this.session !== null && canRedo(this.session);
    },
    /** The bot turn is carried out: the next human (or bot) can go on. */
    botTurnDone(): boolean {
      const state = this.state;
      return state !== null && whoActs(state).kind !== 'chance';
    },
  },

  actions: {
    newGame(config: SessionConfig) {
      const session = startSession({ ...config, gameId: newGameId() });
      logGame(startEvent(session, new Date(), APP_COMMIT));
      this.setSession(session);
    },

    /** A human seat's decision or a chance outcome the table entered. */
    enter(move: Move) {
      if (!this.session) return;
      const source = whoActs(current(this.session)).kind === 'chance' ? 'chance' : 'human';
      try {
        this.session = markRaw(play(this.session, move, source));
        this.error = null;
      } catch (error) {
        recordError(error);
        this.error = error instanceof Error ? error.message : String(error);
        return;
      }
      this.notes = current(this.session).events.map((e) => eventInstruction(e, this.seats));
      this.save();
      this.runBots();
    },

    /**
     * Let bots decide. One bot's consecutive decisions are collected into
     * one turn to show. It stops when a human or the table must act, or
     * when another bot is next (that bot waits for "Done").
     */
    runBots() {
      if (!this.session) return;
      for (;;) {
        const player = botToAct(this.session);
        if (player === null) break;
        if (this.botTurn && this.botTurn.player !== player) break;
        const step = botDecision(this.session, this.bots);
        if (!step) break;
        const next = play(this.session, step.move, 'bot');
        const color = this.seats[player]?.color ?? '';
        const instruction = botInstruction(step.state, current(next), step.move, player, color);
        this.botTurn ??= { player, plan: step.decision.plan ?? null, steps: [] };
        // The reason starts by naming the move, which the instruction already does.
        // If only the plan is left ("(Builder)."), the plan badge says it already.
        const named = describeMove(step.state, step.move);
        let reason = step.decision.reason;
        if (reason.startsWith(named)) reason = reason.slice(named.length).replace(/^:\s*/, '');
        if (/^\s*\([^)]*\)\.?$/.test(reason)) reason = '';
        this.botTurn.steps.push({ instruction, reason });
        // Things the engine did on its own because of this move.
        for (const event of current(next).events) {
          this.botTurn.steps.push({ instruction: eventInstruction(event, this.seats), reason: '' });
        }
        this.botTurn.plan = step.decision.plan ?? this.botTurn.plan;
        this.session = markRaw(next);
      }
      this.save();
      this.logIfOver();
    },

    /** Tell the game log the result, once per ending (an undo can lead to another). */
    logIfOver() {
      if (!this.session || this.state?.pending?.kind !== 'gameOver') return;
      const key = endKey(this.session);
      if (this.endLogged === key) return;
      this.endLogged = key;
      logGame(endEvent(this.session, new Date()));
    },

    /** Send game log events that waited for a connection. */
    flushGameLog() {
      logGame(null);
    },

    setGameLogOff(off: boolean) {
      const storage = browserStorage();
      if (storage) setLogOff(storage, off);
      this.logOff = off;
    },

    dismissNotes() {
      this.notes = [];
    },

    /** The humans have carried out the bot's moves on the board. */
    doneWithBotTurn() {
      this.botTurn = null;
      this.runBots();
    },

    undo() {
      if (!this.session) return;
      this.session = markRaw(undo(this.session));
      this.botTurn = null;
      this.notes = [];
      this.save();
    },

    redo() {
      if (!this.session) return;
      this.session = markRaw(redo(this.session));
      this.botTurn = null;
      this.notes = [];
      this.save();
      this.runBots();
    },

    quit() {
      this.session = null;
      this.botTurn = null;
      this.notes = [];
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage may be unavailable (private mode): nothing to remove then.
      }
    },

    setSession(session: Session) {
      this.session = markRaw(session);
      this.bots = markRaw(createBots(session.config));
      this.botTurn = null;
      this.notes = [];
      this.error = null;
      // A loaded or imported game that is already over was logged when it ended.
      this.endLogged = current(session).pending?.kind === 'gameOver' ? endKey(session) : null;
      this.save();
      this.runBots();
    },

    // --- Saving -----------------------------------------------------------------

    save() {
      if (!this.session) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaved(this.session)));
      } catch {
        // Storage full or blocked: the game goes on, it just isn't saved.
      }
    },

    hasSavedGame(): boolean {
      try {
        return localStorage.getItem(STORAGE_KEY) !== null;
      } catch {
        return false;
      }
    },

    loadSaved() {
      try {
        const text = localStorage.getItem(STORAGE_KEY);
        if (text) this.setSession(fromSaved(JSON.parse(text)));
      } catch (error) {
        this.error = `The saved game could not be loaded: ${error instanceof Error ? error.message : error}`;
      }
    },

    exportJson(): string {
      return this.session ? JSON.stringify(toSaved(this.session), null, 2) : '';
    },

    importJson(text: string) {
      try {
        this.setSession(fromSaved(JSON.parse(text)));
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      }
    },
  },
});
