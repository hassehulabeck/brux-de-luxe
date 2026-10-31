/**
 * apply(state, move) → new state. The input state is never changed.
 *
 * 1. Refuse the move unless legalMoves(state) contains it.
 * 2. Copy the state into a draft and handle the move on the draft.
 * 3. Let the step interpreter run until the next decision is pending.
 */

import {
  BUILDING_ROWS,
  CONSTRUCTION_WITHOUT_JOKER_VP,
  FIRST_PASS_BASE_BF,
  PASS_BF_PER_WORK_COLOR,
} from '../data/rulebook';
import { NOBLE_MATERIALS } from '../data/types';
import type { GameState, Pending } from '../state/types';
import { brusselsCost, startAction, startBrusselsAction } from './actions';
import { turnNeedle } from './compass';
import { payPublicFigures } from './end';
import {
  assertNever,
  cloneState,
  components,
  nextBuildingRow,
  player,
  pushSteps,
  spaceAt,
  workColorCount,
} from './helpers';
import { legalMoves } from './legal-moves';
import { sameMove, type Move } from './moves';
import { takeFromDisplay } from './public-figures';
import { tuckBonus, useBonus } from './resolution';
import { largestArea } from './stock-exchange';
import { advance } from './steps';
import { rebuildStacksIfEmpty, removeFromColorStack } from './works';

export class IllegalMoveError extends Error {}

export function apply(state: GameState, move: Move): GameState {
  if (!legalMoves(state).some((legal) => sameMove(legal, move))) {
    throw new IllegalMoveError(
      `Illegal move ${JSON.stringify(move)} for pending ${JSON.stringify(state.pending)}`,
    );
  }
  return applyLegalMove(state, move);
}

/**
 * apply() without the legality check, for a move taken straight from
 * legalMoves(state). Bots use it to look ahead quickly. Anything else
 * (the UI, game logs) should use apply().
 */
export function applyLegalMove(state: GameState, move: Move): GameState {
  const draft = cloneState(state);
  const pending = draft.pending!;
  draft.pending = null;
  draft.events = [];
  handleMove(draft, pending, move);
  advance(draft);
  return draft;
}

/** Handle a legal move on the draft. May set the next pending decision or push steps. */
function handleMove(draft: GameState, pending: Pending, move: Move): void {
  switch (move.kind) {
    // --- Chance outcomes --------------------------------------------------------
    case 'revealStrips': {
      const strips = components().actionStrips.strips;
      draft.stripOrder = move.order;
      draft.board = move.order.map((id) =>
        strips
          .find((s) => s.id === id)!
          .basicSide.map((action) => ({ action, assistant: null, building: null })),
      );
      return;
    }
    case 'revealCompassTiles':
      draft.compass.tiles = move.tiles;
      return;
    case 'revealPublicFigure': {
      const deck = draft.royalTheater.deck;
      const index = deck.findIndex(
        (c) => c.figure === move.card.figure && c.cost === move.card.cost,
      );
      deck.splice(index, 1);
      const slot = draft.royalTheater.display.indexOf(null);
      draft.royalTheater.display[slot] = move.card;
      return;
    }
    case 'revealWorks': {
      const event = expectChance(pending, 'drawWorks');
      removeFromColorStack(draft, move.colors);
      if (event.reason === 'setup') {
        for (const color of move.colors) player(draft, event.player).works[color]++;
      } else {
        draft.pending = { kind: 'keepWork', player: event.player, drawn: move.colors };
      }
      return;
    }
    case 'revealStockExchangeCard':
      draft.stockExchange.deck = draft.stockExchange.deck.filter((c) => c !== move.card);
      draft.round.stockExchangeCard = move.card;
      return;
    case 'revealBonusCard': {
      const event = expectChance(pending, 'drawBonusCard');
      draft.bonusDeck[move.card]!--;
      draft.bonusStrip[event.column] = move.card;
      return;
    }

    // --- Stock Exchange phase -------------------------------------------------------
    case 'chooseShield':
      draft.round.shield = move.shield;
      draft.round.area = largestArea(move.shield);
      return;
    case 'placeNeutral':
      spaceAt(draft, move.space).assistant = { kind: 'neutral', placedBy: decider(pending) };
      player(draft, decider(pending)).hasNeutralAssistant = false;
      return;

    // --- A turn ------------------------------------------------------------------------
    case 'placeAssistant': {
      const owner = decider(pending);
      const p = player(draft, owner);
      const space = spaceAt(draft, move.space);
      p.bf -= move.bid;
      p.assistants.available--;
      p.assistants.artNouveau++;
      space.assistant = { kind: 'player', player: owner, bid: move.bid };
      draft.pending = {
        kind: 'performOrSkip',
        player: owner,
        action: space.action,
        space: move.space,
      };
      return;
    }
    case 'takeBrusselsAction': {
      const owner = decider(pending);
      const cost = brusselsCost(draft, move.action);
      const p = player(draft, owner);
      p.assistants.available -= cost;
      p.assistants.brussels += cost;
      draft.round.brussels[move.action].push({ player: owner, assistants: cost });
      startBrusselsAction(draft, owner, move.action);
      return;
    }
    case 'pass': {
      const owner = decider(pending);
      const p = player(draft, owner);
      const income = workColorCount(p) * PASS_BF_PER_WORK_COLOR;
      if (draft.round.passed.length === 0) {
        // The first to pass takes this year's Exhibition tile (p. 7).
        const year = components().exhibitions.years[draft.round.number - 1];
        if (year !== undefined) p.exhibitions.push(year);
        p.bf += FIRST_PASS_BASE_BF + income;
      } else {
        p.bf += income;
      }
      draft.round.passed.push(owner);
      return;
    }

    // --- Performing an action ----------------------------------------------------------
    case 'performAction':
    case 'skipAction': {
      if (pending.kind !== 'performOrSkip') throw new Error('No action to perform');
      const owner = pending.player;
      const building = pending.space ? spaceAt(draft, pending.space).building : null;
      const triggersSecondary =
        building !== null &&
        building !== owner &&
        (move.kind === 'performAction' || draft.rules.secondaryActionWhenPrimarySkipped);
      // The secondary action happens after the main action, so it goes under it on the stack.
      if (triggersSecondary) {
        draft.steps.push({ kind: 'secondaryAction', owner: building, action: pending.action });
      }
      if (move.kind === 'performAction') startAction(draft, owner, pending.action);
      return;
    }
    case 'chooseParkAction':
      // The Park gives the action without an Assistant on the board: no auction,
      // no secondary action (Q3).
      draft.pending = {
        kind: 'performOrSkip',
        player: decider(pending),
        action: move.action,
        space: null,
      };
      return;
    case 'keepWork': {
      if (pending.kind !== 'keepWork') throw new Error('No works drawn');
      player(draft, pending.player).works[move.color]++;
      const rest = [...pending.drawn];
      rest.splice(rest.indexOf(move.color), 1);
      for (const color of rest) draft.workStacks.color[color]++;
      rebuildStacksIfEmpty(draft);
      return;
    }
    case 'moveCursor':
      draft.workshopCursor = move.to;
      draft.pending = { kind: 'sellWork', player: decider(pending) };
      return;
    case 'sellWork': {
      const owner = decider(pending);
      const p = player(draft, owner);
      const { bfByRow, vpByColumn, dots } = components().workshop;
      // Black works use the center of the cursor (p. 11).
      const offset = move.color === 'black' ? { row: 0, col: 0 } : dots[move.color];
      const row = draft.workshopCursor.row + offset.row;
      const col = draft.workshopCursor.col + offset.col;
      p.bf += bfByRow[row] ?? 0;
      p.vp += vpByColumn[col] ?? 0;
      p.works[move.color]--;
      draft.pending = { kind: 'placeInShop', player: owner, color: move.color };
      return;
    }
    case 'placeInShop': {
      if (pending.kind !== 'placeInShop') throw new Error('Nothing to place in the shop');
      draft.shop[move.slot].push(pending.color);
      draft.salesMade++;
      return;
    }
    case 'takePublicFigure': {
      const owner = decider(pending);
      const card = takeFromDisplay(draft, owner, move.position);
      pushSteps(draft, [
        { kind: 'publicFigureEffect', player: owner, figure: card.figure },
        { kind: 'keepPublicFigure', player: owner, card },
        { kind: 'fillRoyalTheater' },
      ]);
      return;
    }
    case 'keepPublicFigure':
    case 'discardPublicFigure': {
      if (pending.kind !== 'keepPublicFigure') throw new Error('No Public Figure to keep');
      if (move.kind === 'keepPublicFigure') {
        // Kept cards are placed rotated: used this round (p. 6).
        player(draft, pending.player).publicFigures.push({ ...pending.card, rotated: true });
      } else {
        draft.royalTheater.discard.push(pending.card);
      }
      return;
    }
    case 'takeMaterials': {
      const p = player(draft, decider(pending));
      for (const material of move.materials) {
        draft.supply.nobles[material]--;
        p.nobles[material]++;
      }
      return;
    }
    case 'solvayTake': {
      draft.supply.nobles[move.material]--;
      player(draft, decider(pending)).nobles[move.material]++;
      return;
    }
    case 'solvayExchange': {
      const p = player(draft, decider(pending));
      p.jokers--;
      draft.supply.jokers++;
      for (const material of move.materials) {
        draft.supply.nobles[material]--;
        p.nobles[material]++;
      }
      return;
    }
    case 'payConstruction': {
      const p = player(draft, decider(pending));
      const { payment } = move;
      for (const material of NOBLE_MATERIALS) {
        p.nobles[material] -= payment[material];
        draft.supply.nobles[material] += payment[material];
      }
      p.bf -= payment.bf;
      p.jokers -= payment.jokers;
      draft.supply.jokers += payment.jokers;
      if (payment.jokers === 0) p.vp += CONSTRUCTION_WITHOUT_JOKER_VP;
      draft.pending = { kind: 'turnNeedle', player: decider(pending) };
      return;
    }
    case 'turnNeedle':
      turnNeedle(draft, move.needle);
      draft.pending = { kind: 'placeBuilding', player: decider(pending) };
      return;
    case 'placeBuilding': {
      const owner = decider(pending);
      const p = player(draft, owner);
      const row = nextBuildingRow(p) ?? BUILDING_ROWS[BUILDING_ROWS.length - 1]!;
      p.vp += row.immediateVp;
      p.buildingsBuilt++;
      spaceAt(draft, move.space).building = owner;
      return;
    }
    case 'activatePublicFigure': {
      if (pending.kind !== 'activatePublicFigure') throw new Error('No Public Figure to activate');
      const figure = player(draft, pending.player).publicFigures[move.index]!;
      figure.rotated = true;
      pushSteps(draft, [
        { kind: 'publicFigureEffect', player: pending.player, figure: figure.figure },
        { kind: 'activatePublicFigures', player: pending.player, remaining: pending.remaining - 1 },
      ]);
      return;
    }
    case 'stopActivating':
      return;

    // --- Resolution and end of the game ---------------------------------------------------
    case 'useBonus':
      useBonus(draft, move.card, move.choice);
      return;
    case 'tuckBonus':
      tuckBonus(draft, move.card, move.row);
      return;
    case 'payPublicFigures':
      payPublicFigures(draft, decider(pending), move.unpaid);
      return;

    default:
      assertNever(move);
  }
}

/** The player who made the pending decision. */
function decider(pending: Pending): number {
  if (!('player' in pending)) throw new Error(`No player decides ${pending.kind}`);
  return pending.player;
}

function expectChance<K extends string>(pending: Pending, kind: K) {
  if (pending.kind !== 'chance' || pending.event.kind !== kind) {
    throw new Error(`Expected a ${kind} chance event`);
  }
  return pending.event as Extract<typeof pending.event, { kind: K }>;
}
