/**
 * Words for the table: chance outcomes as players see them, and a bot's
 * move as a physical instruction ("Place a blue Assistant on ...").
 *
 * Only wording lives here. What is legal and what a move does always comes
 * from the engine (CLAUDE.md: the UI never re-implements rules).
 */

import {
  ACTION_NAMES,
  BRUSSELS_ACTION_NAMES,
  describeMove,
  loadComponents,
  PUBLIC_FIGURE_NAMES,
  type BonusEffect,
  type GameState,
  type Move,
  type PlayerIndex,
} from '@brux/engine';

const components = loadComponents();

export const BONUS_EFFECT_LABELS: Record<BonusEffect, string> = {
  cityHall: 'City Hall +1',
  courthouse: 'Assistant back from the Courthouse',
  royalPalace: 'Royal Palace +1',
  architect: 'Architect +1',
};

/** "City Hall +1 or Royal Palace +1 · 1 Manneken Pis · 1 VP symbol" */
export function bonusCardLabel(card: number): string {
  const type = components.bonusCards[card];
  if (!type) return `Bonus card ${card + 1}`;
  const power =
    type.power.kind === 'single'
      ? BONUS_EFFECT_LABELS[type.power.effect]
      : type.power.kind === 'choice'
        ? type.power.options.map((e) => BONUS_EFFECT_LABELS[e]).join(' or ')
        : type.power.effects.map((e) => BONUS_EFFECT_LABELS[e]).join(' and ');
  return `${power} · ${plural(type.mannekenPis, 'Manneken Pis', 'Manneken Pis')} · ${plural(type.vpSymbols, 'VP symbol')}`;
}

/** "5 BF · shield 3-4 or 4-3": the Stock Exchange card as it reads for this player count. */
export function stockExchangeCardLabel(state: GameState, card: number): string {
  const data = components.stockExchangeCards[card];
  if (!data) return `Stock Exchange card ${card + 1}`;
  const [a, b] = data.shields[state.playerCount];
  return `${data.bf} BF · shield ${a.row}-${a.col} or ${b.row}-${b.col}`;
}

/** The actions on an Action strip, left to right. */
export function stripLabel(id: string): string {
  const strip = components.actionStrips.strips.find((s) => s.id === id);
  return strip ? strip.basicSide.map((a) => ACTION_NAMES[a]).join(' · ') : id;
}

export const COMPASS_TILE_LABELS: Record<string, string> = {
  wood: 'Wood',
  stone: 'Stone',
  iron: 'Iron',
  anyNoble: 'Any Noble Material',
  threeBf: '3 BF',
  empty: 'Empty',
};

/** A chance outcome as the players would say it. */
export function chanceLabel(state: GameState, move: Move): string {
  switch (move.kind) {
    case 'revealStockExchangeCard':
      return stockExchangeCardLabel(state, move.card);
    case 'revealBonusCard':
      return bonusCardLabel(move.card);
    case 'revealPublicFigure':
      return `${PUBLIC_FIGURE_NAMES[move.card.figure]} (costs ${move.card.cost} BF)`;
    case 'revealWorks':
      return move.colors.length ? move.colors.join(' + ') : 'nothing';
    default:
      return describeMove(state, move);
  }
}

/**
 * A bot's move as an instruction for the human who moves its pieces.
 * `after` is the state after the move, to say what the bot gains.
 */
export function botInstruction(
  before: GameState,
  after: GameState,
  move: Move,
  player: PlayerIndex,
  color: string,
): string {
  const space = (s: { row: number; col: number }) => `row ${s.row + 1}, column ${s.col + 1}`;
  const p0 = before.players[player]!;
  const p1 = after.players[player]!;
  switch (move.kind) {
    case 'chooseShield':
      return `Put the Bracket on shield ${move.shield.row}-${move.shield.col}.`;
    case 'placeNeutral':
      return `Place the bot's neutral Assistant on ${space(move.space)}.`;
    case 'placeAssistant': {
      const action = before.board[move.space.row]?.[move.space.col]?.action;
      const name = action ? ACTION_NAMES[action] : 'the action';
      return `Place a ${color} Assistant on ${space(move.space)} (${name}) with ${move.bid} BF.`;
    }
    case 'takeBrusselsAction': {
      const used = p1.assistants.brussels - p0.assistants.brussels;
      return `Place ${plural(used, `${color} Assistant`)} on ${BRUSSELS_ACTION_NAMES[move.action]} (Brussels board).`;
    }
    case 'pass': {
      const tile =
        p1.exhibitions.length > p0.exhibitions.length ? ' Take the Exhibition tile.' : '';
      return `Pass.${tile} Take ${p1.bf - p0.bf} BF.`;
    }
    case 'performAction':
      return 'Carry out the action.';
    case 'skipAction':
      return 'Skip the action.';
    case 'keepWork':
      return `Keep the ${move.color} work and put the others back.`;
    case 'moveCursor':
      return `Move the Workshop cursor to row ${move.to.row + 1}, column ${move.to.col + 1}.`;
    case 'sellWork':
      return `Sell the ${move.color} work: take ${p1.bf - p0.bf} BF and ${p1.vp - p0.vp} VP.`;
    case 'placeInShop':
      return `Put the sold work on shop space ${move.slot + 1}.`;
    case 'turnNeedle':
      return `Turn needle ${move.needle + 1} one space clockwise.`;
    case 'placeBuilding':
      return `Put a ${color} Building on ${space(move.space)}.`;
    default:
      return `${describeMove(before, move)}.`;
  }
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
