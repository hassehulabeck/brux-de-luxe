/**
 * The step interpreter. `state.steps` is the engine's to-do list (a stack,
 * the last step runs first). `advance()` keeps running steps until one of
 * them needs a decision and sets `state.pending`.
 *
 * A step that needs to happen again later (for example "fill the Royal
 * Theater display", one card at a time) pushes itself back before it sets
 * the pending decision.
 */

import type { GameState, Step } from '../state/types';
import { ROUNDS } from '../data/rulebook';
import { BRUSSELS_ACTIONS } from '../data/types';
import {
  allSpaces,
  assertNever,
  components,
  isInArea,
  player,
  pushSteps,
  seatsFrom,
  spaceAt,
} from './helpers';
import { applySimpleEffect, canKeep, solvayMoves } from './public-figures';
import { secondaryAction } from './actions';
import { brusselsMajority, chooseFirstPlayer, resolveBids, scoreShields } from './resolution';
import { endOfRound, finalScores, mustChooseUnpaidFigures, payAllPublicFigures } from './end';

/**
 * Run steps until a decision is pending. Works on a draft: apply() sets
 * `pending` to null after handling a move, and this fills it in again.
 */
export function advance(draft: GameState): void {
  while (draft.pending === null) {
    const step = draft.steps.pop();
    if (!step) throw new Error('The engine ran out of steps without a pending decision');
    runStep(draft, step);
  }
}

function runStep(draft: GameState, step: Step): void {
  switch (step.kind) {
    // --- Setup (p. 2–3) ------------------------------------------------------
    case 'arrangeStrips':
      draft.pending = { kind: 'chance', event: { kind: 'arrangeStrips' } };
      return;
    case 'placeCompassTiles':
      draft.pending = { kind: 'chance', event: { kind: 'placeCompassTiles' } };
      return;
    case 'fillRoyalTheater': {
      const theater = draft.royalTheater;
      if (!theater.display.includes(null)) return;
      if (theater.deck.length === 0 && theater.discard.length > 0) {
        // "When the stack of Public Figure cards is empty, shuffle the discard pile" (p. 10).
        theater.deck = theater.discard;
        theater.discard = [];
      }
      if (theater.deck.length === 0) return;
      draft.steps.push(step);
      draft.pending = { kind: 'chance', event: { kind: 'drawPublicFigure' } };
      return;
    }
    case 'drawStartingWork':
      draft.pending = {
        kind: 'chance',
        event: { kind: 'drawWorks', player: step.player, count: 1, reason: 'setup' },
      };
      return;
    case 'dealBonusCards': {
      const column = draft.bonusStrip.indexOf(null);
      if (column === -1 || draft.bonusDeck.every((copies) => copies === 0)) return;
      draft.steps.push(step);
      draft.pending = { kind: 'chance', event: { kind: 'drawBonusCard', column } };
      return;
    }

    // --- A. Stock Exchange phase (p. 4) -----------------------------------------
    case 'startRound':
      startRound(draft);
      return;
    case 'drawStockExchangeCard':
      draft.pending = { kind: 'chance', event: { kind: 'drawStockExchangeCard' } };
      return;
    case 'chooseShield': {
      const card = components().stockExchangeCards[draft.round.stockExchangeCard ?? -1];
      if (!card) throw new Error('No Stock Exchange card revealed');
      draft.pending = {
        kind: 'chooseShield',
        player: draft.firstPlayer,
        options: card.shields[draft.playerCount],
      };
      return;
    }

    // --- B. Action phase (p. 5–7) -------------------------------------------------
    case 'placeNeutral': {
      draft.phase = 'action';
      const free = neutralSpaces(draft);
      if (!player(draft, step.player).hasNeutralAssistant || free.length === 0) return;
      draft.pending = { kind: 'placeNeutral', player: step.player };
      return;
    }
    case 'nextTurn':
      nextTurn(draft);
      return;
    case 'secondaryAction':
      secondaryAction(draft, step.owner, step.action);
      return;
    case 'publicFigureEffect':
      if (applySimpleEffect(draft, step.player, step.figure)) return;
      if (solvayMoves(draft, step.player).length > 0) {
        draft.pending = { kind: 'solvay', player: step.player };
      }
      return;
    case 'keepPublicFigure':
      if (canKeep(draft, step.player, step.card.figure)) {
        draft.pending = { kind: 'keepPublicFigure', player: step.player, card: step.card };
      } else {
        draft.royalTheater.discard.push(step.card);
      }
      return;
    case 'activatePublicFigures': {
      const upright = player(draft, step.player).publicFigures.some((f) => !f.rotated);
      if (step.remaining <= 0 || !upright) return;
      draft.pending = {
        kind: 'activatePublicFigure',
        player: step.player,
        remaining: step.remaining,
      };
      return;
    }

    // --- C. Resolution of the Turn phase (p. 8–9) ---------------------------------
    case 'resolveBids':
      draft.phase = 'resolution';
      resolveBids(draft);
      return;
    case 'chooseFirstPlayer':
      chooseFirstPlayer(draft);
      // Bonus cards are used in seat order, starting with the new first player.
      pushSteps(
        draft,
        seatsFrom(draft, draft.firstPlayer).map((p) => ({ kind: 'resolveBonusCards', player: p })),
      );
      return;
    case 'resolveBonusCards':
      if (!draft.round.bonusWon.some((won) => won.player === step.player)) return;
      draft.steps.push(step);
      draft.pending = { kind: 'resolveBonus', player: step.player };
      return;
    case 'scoreShields':
      scoreShields(draft);
      return;
    case 'brusselsMajority':
      brusselsMajority(draft);
      if (draft.round.number >= ROUNDS) {
        // The game ends here, skipping the End of Turn phase (p. 10).
        pushSteps(draft, [
          ...seatsFrom(draft, draft.firstPlayer).map((p): Step => ({
            kind: 'payPublicFigures',
            player: p,
          })),
          { kind: 'finalScoring' },
        ]);
      } else {
        draft.steps.push({ kind: 'endOfRound' });
      }
      return;

    // --- D. End of Turn phase (p. 10) and end of the game ------------------------
    case 'endOfRound':
      endOfRound(draft);
      return;
    case 'payPublicFigures':
      if (mustChooseUnpaidFigures(draft, step.player)) {
        draft.pending = { kind: 'payPublicFigures', player: step.player };
      } else {
        payAllPublicFigures(draft, step.player);
      }
      return;
    case 'finalScoring':
      draft.final = finalScores(draft);
      draft.phase = 'gameOver';
      draft.pending = { kind: 'gameOver' };
      return;

    default:
      assertNever(step);
  }
}

function startRound(draft: GameState): void {
  draft.phase = 'stockExchange';
  draft.round = {
    ...draft.round,
    stockExchangeCard: null,
    shield: null,
    area: null,
    lastActor: null,
    passed: [],
    brussels: Object.fromEntries(BRUSSELS_ACTIONS.map((a) => [a, []])) as never,
    bonusWon: [],
    mannekenPis: draft.players.map(() => 0),
    tuckedRows: draft.players.map(() => []),
  };
  const neutrals: Step[] =
    draft.playerCount === 2
      ? seatsFrom(draft, draft.firstPlayer).map((p) => ({ kind: 'placeNeutral', player: p }))
      : [];
  pushSteps(draft, [
    { kind: 'drawStockExchangeCard' },
    { kind: 'chooseShield' },
    ...neutrals,
    { kind: 'nextTurn' },
  ]);
}

/** Spaces for a neutral Assistant: in the available area, no Assistant, no Building (p. 12). */
export function neutralSpaces(state: GameState) {
  return allSpaces().filter((space) => {
    const s = spaceAt(state, space);
    return isInArea(state.round.area, space) && !s.assistant && s.building === null;
  });
}

/** Clockwise from the last player to act, the next player who hasn't passed. */
function nextTurn(draft: GameState): void {
  draft.phase = 'action';
  const { lastActor, passed } = draft.round;
  const start = lastActor === null ? draft.firstPlayer : (lastActor + 1) % draft.playerCount;
  const next = seatsFrom(draft, start).find((p) => !passed.includes(p));
  if (next === undefined) {
    pushSteps(draft, [
      { kind: 'resolveBids' },
      { kind: 'chooseFirstPlayer' },
      // chooseFirstPlayer pushes the resolveBonusCards steps on top of these.
      { kind: 'scoreShields' },
      { kind: 'brusselsMajority' },
    ]);
    return;
  }
  draft.round.lastActor = next;
  draft.steps.push({ kind: 'nextTurn' });
  draft.pending = { kind: 'turn', player: next };
}
