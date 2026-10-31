/**
 * The game at the table, for the Vue components. The rules and the game
 * history live in game/session.ts; this store adds what the screen needs:
 * the bot turn being shown, autosave, export and import.
 */

import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { describeMove, type Bot, type GameState, type Move } from '@brux/engine';
import { botInstruction } from '../game/labels';
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
    error: null as string | null,
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
      this.setSession(startSession(config));
    },

    /** A human seat's decision or a chance outcome the table entered. */
    enter(move: Move) {
      if (!this.session) return;
      const source = whoActs(current(this.session)).kind === 'chance' ? 'chance' : 'human';
      try {
        this.session = markRaw(play(this.session, move, source));
        this.error = null;
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        return;
      }
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
        const named = `${describeMove(step.state, step.move)}: `;
        const reason = step.decision.reason.startsWith(named)
          ? step.decision.reason.slice(named.length)
          : step.decision.reason;
        this.botTurn.steps.push({ instruction, reason });
        this.botTurn.plan = step.decision.plan ?? this.botTurn.plan;
        this.session = markRaw(next);
      }
      this.save();
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
      this.save();
    },

    redo() {
      if (!this.session) return;
      this.session = markRaw(redo(this.session));
      this.botTurn = null;
      this.save();
      this.runBots();
    },

    quit() {
      this.session = null;
      this.botTurn = null;
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
      this.error = null;
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
