/**
 * Scoring moves for the utility bot (PLAN.md 5.4).
 *
 * A move is scored on the state it leads to after the bot's own follow-up
 * decisions, played the best way: placing an Assistant on a Sale space is
 * worth what the best Sale from there is worth. The search stops at chance
 * events, other players' decisions and the bot's next turn. The one
 * exception is the bot's own Workshop draw: it is valued with the most
 * likely draw from the stack (the stack's contents are public).
 *
 * Speed-ups, so a full game takes well under a second:
 * - Bids above the minimum reuse the follow-ups of the minimum bid, with
 *   less money (the bid doesn't change what the action does).
 * - The best follow-ups of an action are found once per decision and then
 *   replayed for every other space with that action (and for the Park).
 * - Activating Public Figures is searched in card order only: the order of
 *   their effects doesn't change the result.
 */

import { MIN_BID } from '../data/rulebook';
import { WORK_COLORS, type WorkColor } from '../data/types';
import { applyLegalMove } from '../rules/apply';
import { legalMoves } from '../rules/legal-moves';
import { sameMove, type Move } from '../rules/moves';
import type { GameState, PlayerIndex } from '../state/types';
import { CONSIDERATIONS, type MoveContext } from './considerations';
import { columnBids } from './considerations/context';
import { placementValue } from './considerations/building-placement';
import { bestSaleAt } from './considerations/denial';
import {
  CONSIDERATION_NAMES,
  type ConsiderationName,
  type SourceWeights,
  type UtilityWeights,
} from './weights';

export interface EvaluatedMove {
  move: Move;
  score: number;
  /** Each consideration's value, before its weight. */
  terms: Record<ConsiderationName, number>;
  /** The state after the move and the best follow-ups. */
  after: GameState;
}

/**
 * Decisions that start something new: the follow-up search stops before
 * them. Each Bonus card is its own decision too: they hardly depend on each
 * other, and searching them all together multiplies the options.
 */
const NEW_DECISIONS = new Set([
  'turn',
  'chooseShield',
  'placeNeutral',
  'resolveBonus',
  'gameOver',
  'chance',
]);
const MAX_DEPTH = 12;
/** Workshop cursor positions searched for a Sale. */
const CURSOR_BEAM = 8;
/** Spaces searched for a new Building. */
const BUILDING_BEAM = 4;

/** Add up the considerations for one move. */
export function evaluate(ctx: MoveContext): {
  score: number;
  terms: Record<ConsiderationName, number>;
} {
  const terms = {} as Record<ConsiderationName, number>;
  let score = 0;
  for (const name of CONSIDERATION_NAMES) {
    const value = CONSIDERATIONS[name](ctx);
    terms[name] = value;
    score += ctx.weights.considerations[name] * value;
  }
  return { score, terms };
}

/**
 * The moves worth scoring: every legal move, with bids capped at 2 BF more
 * than it takes to catch the column's leader (PLAN.md 5.4).
 */
export function candidateMoves(view: GameState, me: PlayerIndex): Move[] {
  return legalMoves(view).filter(
    (m) => m.kind !== 'placeAssistant' || m.bid <= bidCap(view, me, m.space.col),
  );
}

export function bidCap(view: GameState, me: PlayerIndex, col: number): number {
  if (view.bonusStrip[col] === null) return MIN_BID;
  const totals = columnBids(view, col);
  const best = Math.max(...totals.filter((_, p) => p !== me));
  return Math.max(MIN_BID, best - totals[me]! + 2);
}

/** Score every candidate move, best first. */
export function scoreMoves(
  view: GameState,
  me: PlayerIndex,
  weights: UtilityWeights,
  sources: SourceWeights,
): EvaluatedMove[] {
  const search = followUpSearch(view, me, weights, sources);
  const minBidLeaf = new Map<string, GameState>();
  const scored = candidateMoves(view, me).map((move): EvaluatedMove => {
    let after: GameState;
    if (move.kind === 'placeAssistant') {
      const key = `${move.space.row},${move.space.col}`;
      let leaf = minBidLeaf.get(key);
      if (!leaf) {
        leaf = search({ ...move, bid: MIN_BID });
        minBidLeaf.set(key, leaf);
      }
      after = withBid(leaf, me, move.space, move.bid);
    } else {
      after = search(move);
    }
    const ctx: MoveContext = { before: view, move, after, player: me, weights, sources };
    return { move, after, ...evaluate(ctx) };
  });
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * A search for the best follow-ups of a root move. Returns the state after
 * them. The search for each action is shared through `cache`.
 */
function followUpSearch(
  view: GameState,
  me: PlayerIndex,
  weights: UtilityWeights,
  sources: SourceWeights,
) {
  const cache = new Map<string, Move[]>();

  const scoreOf = (root: Move, after: GameState) =>
    evaluate({ before: view, move: root, after, player: me, weights, sources }).score;

  function best(
    root: Move,
    start: GameState,
    depth: number,
    firstActivation: number,
  ): { after: GameState; score: number; path: Move[] } {
    const state = resolveOwnDraws(start, me);
    if (depth === 0 || !isOwnFollowUp(state, me)) {
      return { after: state, score: scoreOf(root, state), path: [] };
    }

    const key = cacheKey(state);
    const cached = key ? cache.get(key) : undefined;
    if (cached) {
      const replayed = replay(state, cached, me);
      if (replayed) return { after: replayed, score: scoreOf(root, replayed), path: cached };
    }

    let found: { after: GameState; score: number; path: Move[] } | null = null;
    for (const move of followUpMoves(state, me, weights)) {
      if (move.kind === 'activatePublicFigure' && move.index < firstActivation) continue;
      const next = move.kind === 'activatePublicFigure' ? move.index + 1 : 0;
      const child = best(root, applyLegalMove(state, move), depth - 1, next);
      if (!found || child.score > found.score) {
        found = { after: child.after, score: child.score, path: [move, ...child.path] };
      }
    }
    if (!found) return { after: state, score: scoreOf(root, state), path: [] };
    if (key) cache.set(key, found.path);
    return found;
  }

  return (root: Move): GameState => best(root, applyLegalMove(view, root), MAX_DEPTH, 0).after;
}

/**
 * The follow-ups worth searching. Two decisions have many options of which
 * only a few can be best, so only those are searched:
 * - the Workshop cursor: the positions with the best immediate Sale;
 * - a new Building: the spaces with the best expected income.
 */
function followUpMoves(state: GameState, me: PlayerIndex, weights: UtilityWeights): Move[] {
  const moves = legalMoves(state);
  const kind = state.pending?.kind;
  const value = (m: Move): number => {
    if (m.kind === 'moveCursor') return bestSaleAt(state, me, m.to);
    if (m.kind === 'placeBuilding') return placementValue(state, m.space, weights);
    return 0;
  };
  const beam = kind === 'moveCursor' ? CURSOR_BEAM : kind === 'placeBuilding' ? BUILDING_BEAM : 0;
  if (beam === 0 || moves.length <= beam) return moves;
  return moves
    .map((m) => ({ m, v: value(m) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, beam)
    .map(({ m }) => m);
}

function isOwnFollowUp(state: GameState, me: PlayerIndex): boolean {
  const pending = state.pending;
  return (
    pending !== null &&
    !NEW_DECISIONS.has(pending.kind) &&
    'player' in pending &&
    pending.player === me
  );
}

/** Performing an action leads to the same follow-ups wherever the Assistant stands. */
function cacheKey(state: GameState): string | null {
  return state.pending?.kind === 'performOrSkip' ? `perform:${state.pending.action}` : null;
}

/** Play a cached path of follow-ups again, or null if a move is no longer legal. */
function replay(start: GameState, path: Move[], me: PlayerIndex): GameState | null {
  let state = start;
  for (const move of path) {
    state = resolveOwnDraws(state, me);
    if (!legalMoves(state).some((m) => sameMove(m, move))) return null;
    state = applyLegalMove(state, move);
  }
  return resolveOwnDraws(state, me);
}

/** The bot's own Workshop draw, valued with the most likely colors. */
function resolveOwnDraws(start: GameState, me: PlayerIndex): GameState {
  let state = start;
  while (
    state.pending?.kind === 'chance' &&
    state.pending.event.kind === 'drawWorks' &&
    state.pending.event.player === me &&
    state.pending.event.reason === 'workshop'
  ) {
    state = applyLegalMove(state, {
      kind: 'revealWorks',
      colors: likelyDraw(state, state.pending.event.count),
    });
  }
  return state;
}

/** One draw at a time, the color with the most tiles left in the stack. */
export function likelyDraw(state: GameState, count: number): WorkColor[] {
  const left = { ...state.workStacks.color };
  const drawn: WorkColor[] = [];
  for (let i = 0; i < count; i++) {
    const color = WORK_COLORS.reduce((a, b) => (left[b] > left[a] ? b : a));
    if (left[color] === 0) break;
    left[color]--;
    drawn.push(color);
  }
  return drawn.sort((a, b) => WORK_COLORS.indexOf(a) - WORK_COLORS.indexOf(b));
}

/**
 * The state after the same move with a higher bid: less money, and the
 * higher bid on the board. A shallow copy: only the changed parts are new.
 */
function withBid(
  state: GameState,
  owner: PlayerIndex,
  space: { row: number; col: number },
  bid: number,
): GameState {
  if (bid === MIN_BID) return state;
  const extra = bid - MIN_BID;
  return {
    ...state,
    players: state.players.map((p, i) => (i === owner ? { ...p, bf: p.bf - extra } : p)),
    board: state.board.map((row, r) =>
      r !== space.row
        ? row
        : row.map((s, c) =>
            c === space.col && s.assistant?.kind === 'player'
              ? { ...s, assistant: { ...s.assistant, bid } }
              : s,
          ),
    ),
  };
}
