/**
 * Short English descriptions of moves, for bot reasons and decision logs.
 */

import { PUBLIC_FIGURE_NAMES, ROYAL_THEATER_COSTS } from '../data/rulebook';
import type { ArtNouveauAction, BonusEffect, BrusselsAction, CompassTile } from '../data/types';
import { affordablePayments, buildingSpaces, canPerform } from '../rules/actions';
import { needleTiles } from '../rules/compass';
import { bonusType } from '../rules/resolution';
import { assertNever, nextBuildingRow, player } from '../rules/helpers';
import type { ConstructionPayment, Move } from '../rules/moves';
import type { GameState, PlayerIndex } from '../state/types';

export const ACTION_NAMES: Record<ArtNouveauAction, string> = {
  workshop: 'Workshop',
  sale: 'Sale',
  royalTheater: 'Royal Theater',
  materials: 'Materials',
  construction: 'Construction',
};

export const BRUSSELS_ACTION_NAMES: Record<BrusselsAction, string> = {
  market: 'Market',
  stockExchange: 'Stock Exchange',
  park: 'Fiftieth Anniversary Park',
  grandPlaza: 'Grand Plaza',
};

export const COMPASS_TILE_NAMES: Record<CompassTile, string> = {
  wood: 'Wood',
  stone: 'Stone',
  iron: 'Iron',
  anyNoble: 'Any Noble Material',
  threeBf: '3 BF',
  empty: 'Empty',
};

export const BONUS_EFFECT_NAMES: Record<BonusEffect, string> = {
  cityHall: 'City Hall +1',
  courthouse: 'Assistant back from the Courthouse',
  royalPalace: 'Royal Palace +1',
  architect: 'Architect +1',
};

/** Spaces are shown 1-based, row 1 at the top, as a player would count them. */
function space({ row, col }: { row: number; col: number }): string {
  return `row ${row + 1}, column ${col + 1}`;
}

function payment(p: ConstructionPayment): string {
  const parts = [
    p.wood && `${p.wood} wood`,
    p.stone && `${p.stone} stone`,
    p.iron && `${p.iron} iron`,
    p.bf && `${p.bf} BF`,
    p.jokers && `${p.jokers} Joker${p.jokers > 1 ? 's' : ''}`,
  ].filter(Boolean);
  return parts.join(', ');
}

export function describeMove(state: GameState, move: Move): string {
  switch (move.kind) {
    case 'revealStrips':
      return `Action strips ${move.order.join(', ')}, top to bottom`;
    case 'revealCompassTiles':
      return `Compass tiles: ${move.tiles.join(', ')}`;
    case 'revealPublicFigure':
      return `Reveal ${PUBLIC_FIGURE_NAMES[move.card.figure]}`;
    case 'revealWorks':
      return `Draw ${move.colors.join(', ')}`;
    case 'revealStockExchangeCard':
      return `Stock Exchange card ${move.card + 1}`;
    case 'revealBonusCard':
      return `Bonus card type ${move.card + 1}`;
    case 'chooseShield':
      return `Bracket on shield ${move.shield.row}-${move.shield.col}`;
    case 'placeNeutral':
      return `Neutral Assistant on ${space(move.space)}`;
    case 'placeAssistant': {
      const action = state.board[move.space.row]?.[move.space.col]?.action;
      const name = action ? ACTION_NAMES[action] : 'action';
      return `${name} on ${space(move.space)}, bid ${move.bid} BF`;
    }
    case 'takeBrusselsAction':
      return BRUSSELS_ACTION_NAMES[move.action];
    case 'pass':
      return 'Pass';
    case 'performAction':
      return 'Perform the action';
    case 'skipAction':
      return 'Skip the action';
    case 'chooseParkAction':
      return `Park: ${ACTION_NAMES[move.action]}`;
    case 'keepWork':
      return `Keep the ${move.color} work`;
    case 'moveCursor':
      return `Move the Workshop cursor to row ${move.to.row + 1}, column ${move.to.col + 1}`;
    case 'sellWork':
      return `Sell the ${move.color} work`;
    case 'placeInShop':
      return `Put it on shop space ${move.slot + 1}`;
    case 'takePublicFigure': {
      const card = state.royalTheater.display[move.position];
      return `Take ${card ? PUBLIC_FIGURE_NAMES[card.figure] : 'a Public Figure'} (${move.position} BF)`;
    }
    case 'keepPublicFigure':
      return 'Keep the Public Figure';
    case 'discardPublicFigure':
      return 'Discard the Public Figure';
    case 'takeMaterials':
      return `Take ${move.materials.join(' and ')}`;
    case 'solvayTake':
      return `Solvay: take ${move.material}`;
    case 'solvayExchange':
      return `Solvay: a Joker for ${move.materials.join(' and ')}`;
    case 'payConstruction':
      return `Pay ${payment(move.payment)}`;
    case 'turnNeedle':
      return `Turn needle ${move.needle + 1}`;
    case 'placeBuilding':
      return `Build on ${space(move.space)}`;
    case 'activatePublicFigure': {
      const pending = state.pending;
      const owner = pending && 'player' in pending ? pending.player : 0;
      const figure = state.players[owner]?.publicFigures[move.index];
      return `Activate ${figure ? PUBLIC_FIGURE_NAMES[figure.figure] : 'a Public Figure'}`;
    }
    case 'stopActivating':
      return 'Stop activating Public Figures';
    case 'useBonus':
      return move.choice
        ? `${bonusCard(state, move.card)}: ${BONUS_EFFECT_NAMES[move.choice]}`
        : `${bonusCard(state, move.card)}: ${bonusPower(state, move.card)}`;
    case 'tuckBonus':
      return `${bonusCard(state, move.card)}: tuck it under row ${move.row}`;
    case 'payPublicFigures':
      return move.unpaid.length === 0
        ? 'Pay for every Public Figure'
        : `Leave ${move.unpaid.length} Public Figure${move.unpaid.length > 1 ? 's' : ''} unpaid`;
    default:
      return assertNever(move);
  }
}

/** "Column 2 Bonus card": where the card lay, since a player can win more than one. */
function bonusCard(state: GameState, index: number): string {
  const won = state.round.bonusWon[index];
  return won ? `Column ${won.column + 1} Bonus card` : 'Bonus card';
}

/** "City Hall +1", or "Architect +1 and Architect +1" for a double card. */
function bonusPower(state: GameState, index: number): string {
  const won = state.round.bonusWon[index];
  const power = won ? bonusType(won.card).power : null;
  if (power?.kind === 'single') return BONUS_EFFECT_NAMES[power.effect];
  if (power?.kind === 'double')
    return power.effects.map((e) => BONUS_EFFECT_NAMES[e]).join(' and ');
  return 'use its power';
}

/**
 * Why a player can't carry out an action, or null if they can. The table
 * app shows it next to "Skip the action", so nobody is left wondering.
 */
export function cannotPerformReason(
  state: GameState,
  owner: PlayerIndex,
  action: ArtNouveauAction,
): string | null {
  if (canPerform(state, owner, action)) return null;
  const p = player(state, owner);
  switch (action) {
    case 'workshop':
    case 'materials':
      return null;
    case 'sale':
      return 'You have no work of a color that is not already showing in the shop.';
    case 'royalTheater': {
      const cheapest = cheapestFigure(state);
      return cheapest === null
        ? 'There is no Public Figure in the Royal Theater.'
        : `You have ${p.bf} BF and the cheapest Public Figure costs ${cheapest} BF.`;
    }
    case 'construction': {
      const row = nextBuildingRow(p);
      if (!row) return 'You have built all your Buildings.';
      if (buildingSpaces(state).length === 0) return 'There is no empty space for a Building.';
      if (affordablePayments(state, owner).length > 0) return null;
      const [a, b] = needleTiles(state).map((tile) => COMPASS_TILE_NAMES[tile]);
      const both = a === 'Empty' || b === 'Empty' ? '' : ', using both';
      return (
        `The needles point at ${a} and ${b}: your next Building costs ` +
        `${row.constructionUnits} units${both}. You have ${resources(state, owner)}.`
      );
    }
    default:
      return assertNever(action);
  }
}

function cheapestFigure(state: GameState): number | null {
  const costs = state.royalTheater.display.flatMap((card, position) =>
    card ? [ROYAL_THEATER_COSTS[position] ?? 0] : [],
  );
  return costs.length ? Math.min(...costs) : null;
}

/** "2 wood, 2 BF and no Jokers" */
function resources(state: GameState, owner: PlayerIndex): string {
  const p = player(state, owner);
  const nobles = payment({ ...p.nobles, bf: 0, jokers: 0 });
  const jokers = p.jokers === 0 ? 'no Jokers' : `${p.jokers} Joker${p.jokers > 1 ? 's' : ''}`;
  return `${nobles || 'no Noble Materials'}, ${p.bf} BF and ${jokers}`;
}
