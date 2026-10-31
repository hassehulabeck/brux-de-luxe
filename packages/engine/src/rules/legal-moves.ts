/**
 * legalMoves(state): every move allowed for the pending decision, and nothing else.
 * The UI shows these as options; bots score them; apply() refuses anything else.
 */

import { chanceOutcomes } from '../chance/outcomes';
import { ART_NOUVEAU_ACTIONS, BRUSSELS_ACTIONS, type GridPosition } from '../data/types';
import { MIN_BID, SALES_REQUIRING_EMPTY_SHOP_SPACE } from '../data/rulebook';
import type { GameState, PlayerIndex } from '../state/types';
import {
  affordablePayments,
  brusselsCost,
  buildingSpaces,
  canPerform,
  materialChoices,
  sellableColors,
} from './actions';
import { turnableNeedles } from './compass';
import { unpaidChoices } from './end';
import {
  allSpaces,
  assertNever,
  components,
  isInArea,
  player,
  spaceAt,
  workCount,
} from './helpers';
import type { Move, PlayerMove } from './moves';
import { affordableDisplayPositions, solvayMoves } from './public-figures';
import { bonusMoves } from './resolution';
import { neutralSpaces } from './steps';

export function legalMoves(state: GameState): Move[] {
  const pending = state.pending;
  if (pending === null) return [];
  switch (pending.kind) {
    case 'chance':
      return chanceOutcomes(state, pending.event);
    case 'chooseShield':
      return pending.options.map((shield) => ({ kind: 'chooseShield', shield }));
    case 'placeNeutral':
      return neutralSpaces(state).map((space) => ({ kind: 'placeNeutral', space }));
    case 'turn':
      return turnMoves(state, pending.player);
    case 'performOrSkip':
      return canPerform(state, pending.player, pending.action)
        ? [{ kind: 'performAction' }, { kind: 'skipAction' }]
        : [{ kind: 'skipAction' }];
    case 'chooseParkAction':
      return ART_NOUVEAU_ACTIONS.map((action) => ({ kind: 'chooseParkAction', action }));
    case 'keepWork':
      return [...new Set(pending.drawn)].map((color) => ({ kind: 'keepWork', color }));
    case 'moveCursor':
      return cursorPositions(state, workCount(player(state, pending.player))).map((to) => ({
        kind: 'moveCursor',
        to,
      }));
    case 'sellWork':
      return sellableColors(state, pending.player).map((color) => ({ kind: 'sellWork', color }));
    case 'placeInShop':
      return shopSlots(state).map((slot) => ({ kind: 'placeInShop', slot }));
    case 'takePublicFigure':
      return affordableDisplayPositions(state, pending.player).map((position) => ({
        kind: 'takePublicFigure',
        position,
      }));
    case 'keepPublicFigure':
      return [{ kind: 'keepPublicFigure' }, { kind: 'discardPublicFigure' }];
    case 'takeMaterials':
      return materialChoices(state, pending.count);
    case 'solvay':
      return solvayMoves(state, pending.player);
    case 'payConstruction':
      return affordablePayments(state, pending.player).map((payment) => ({
        kind: 'payConstruction',
        payment,
      }));
    case 'turnNeedle':
      return turnableNeedles(state).map((needle) => ({ kind: 'turnNeedle', needle }));
    case 'placeBuilding':
      return buildingSpaces(state).map((space) => ({ kind: 'placeBuilding', space }));
    case 'activatePublicFigure':
      return [
        ...player(state, pending.player).publicFigures.flatMap((figure, index) =>
          figure.rotated ? [] : [{ kind: 'activatePublicFigure' as const, index }],
        ),
        { kind: 'stopActivating' },
      ];
    case 'resolveBonus':
      return bonusMoves(state, pending.player);
    case 'payPublicFigures':
      return unpaidChoices(state, pending.player);
    case 'gameOver':
      return [];
    default:
      return assertNever(pending);
  }
}

/** A turn: place an Assistant with a bid, take a Brussels action, or pass. */
function turnMoves(state: GameState, owner: PlayerIndex): PlayerMove[] {
  const p = player(state, owner);
  const moves: PlayerMove[] = [];

  if (p.assistants.available > 0 && p.bf >= MIN_BID) {
    for (const space of allSpaces()) {
      if (!isInArea(state.round.area, space) || spaceAt(state, space).assistant) continue;
      for (let bid = MIN_BID; bid <= p.bf; bid++)
        moves.push({ kind: 'placeAssistant', space, bid });
    }
  }
  for (const action of BRUSSELS_ACTIONS) {
    if (p.assistants.available >= brusselsCost(state, action)) {
      moves.push({ kind: 'takeBrusselsAction', action });
    }
  }
  moves.push({ kind: 'pass' });
  return moves;
}

/**
 * Cursor positions reachable with up to `steps` horizontal/vertical moves
 * (Q4), keeping every dot of the cursor inside the Workshop grid (Q2).
 */
export function cursorPositions(state: GameState, steps: number): GridPosition[] {
  const { bfByRow, vpByColumn, dots } = components().workshop;
  const offsets = [{ row: 0, col: 0 }, ...Object.values(dots)];
  const from = state.workshopCursor;
  const result: GridPosition[] = [];
  for (let row = 0; row < bfByRow.length; row++) {
    for (let col = 0; col < vpByColumn.length; col++) {
      const distance = Math.abs(row - from.row) + Math.abs(col - from.col);
      const inside = offsets.every(
        (o) =>
          row + o.row >= 0 &&
          row + o.row < bfByRow.length &&
          col + o.col >= 0 &&
          col + o.col < vpByColumn.length,
      );
      if (distance <= steps && inside) result.push({ row, col });
    }
  }
  return result;
}

/** The first two sales of the game must go on an empty shop space (p. 5). */
function shopSlots(state: GameState): (0 | 1)[] {
  const slots = [0, 1] as const;
  if (state.salesMade >= SALES_REQUIRING_EMPTY_SHOP_SPACE) return [...slots];
  return slots.filter((slot) => state.shop[slot].length === 0);
}
