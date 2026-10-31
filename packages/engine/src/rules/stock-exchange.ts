/**
 * A. Stock Exchange phase (rulebook p. 4): reveal a card, the first player
 * chooses one of its two shields, and the Bracket points at the largest area.
 */

import { BOARD_SIZE, type Shield } from '../state/coords';
import type { Area, GameState } from '../state/types';
import { components } from './helpers';

/**
 * The largest of the 4 areas made by the lines through a shield.
 *
 * Shield row r has 5-r board rows above it and r below; shield column c has
 * c board columns to its left and 5-c to its right (see state/coords.ts).
 * The board has an odd size, so each side always has one bigger half, and
 * the largest area is simply the bigger half of the rows times the bigger
 * half of the columns. There is never a tie.
 */
export function largestArea(shield: Shield): Area {
  const rowsAbove = BOARD_SIZE - shield.row;
  const rows: [number, number] =
    rowsAbove > shield.row ? [0, rowsAbove - 1] : [rowsAbove, BOARD_SIZE - 1];
  const colsLeft = shield.col;
  const cols: [number, number] =
    colsLeft > BOARD_SIZE - colsLeft ? [0, colsLeft - 1] : [colsLeft, BOARD_SIZE - 1];
  return { rows, cols };
}

export function currentStockExchangeCard(state: GameState) {
  const index = state.round.stockExchangeCard;
  if (index === null) throw new Error('No Stock Exchange card revealed this round');
  const card = components().stockExchangeCards[index];
  if (!card) throw new Error(`No Stock Exchange card ${index}`);
  return card;
}
