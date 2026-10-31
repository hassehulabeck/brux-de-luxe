/**
 * Coordinates on the Art Nouveau board. This file is the one place where the
 * mapping between action spaces and shields is defined.
 *
 * Action spaces: 5×5, zero-based, used internally.
 *
 *          col 0   col 1   col 2   col 3   col 4
 *   row 0  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (1,1)   (1,2)   (1,3)   (1,4)        <- shield row 1
 *   row 1  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (2,1)   (2,2)   (2,3)   (2,4)        <- shield row 2
 *   row 2  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (3,1)   (3,2)   (3,3)   (3,4)
 *   row 3  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (4,1)   (4,2)   (4,3)   (4,4)
 *   row 4  [    ]  [    ]  [    ]  [    ]  [    ]
 *   Bonus  [card]  [card]  [card]  [card]  [card]
 *
 * Shields: 4×4, numbered 1–4 exactly as the rulebook and the Stock Exchange
 * cards print them, so card data can be typed in as printed. The first
 * number is the shield row, the second the shield column (rulebook p. 4).
 *
 * Shield { row: r, col: c } sits where the four action spaces
 * (r-1, c-1), (r-1, c), (r, c-1) and (r, c) meet.
 *
 * To be confirmed by Hans (docs/rules-questions.md, Q1): shield row 1 is the
 * top row and shield column 1 is the left column, as drawn above.
 */

export const BOARD_SIZE = 5;
export const SHIELD_COUNT_PER_SIDE = 4;

/** An action space on the Art Nouveau board, row and col are 0–4. */
export interface ArtNouveauSpace {
  row: number;
  col: number;
}

/** A City of Brussels shield, row and col are 1–4 as printed in the rulebook. */
export interface Shield {
  row: number;
  col: number;
}

export function isArtNouveauSpace(space: ArtNouveauSpace): boolean {
  return isInRange(space.row, 0, BOARD_SIZE - 1) && isInRange(space.col, 0, BOARD_SIZE - 1);
}

export function isShield(shield: Shield): boolean {
  return (
    isInRange(shield.row, 1, SHIELD_COUNT_PER_SIDE) &&
    isInRange(shield.col, 1, SHIELD_COUNT_PER_SIDE)
  );
}

/** The four action spaces around a shield (used for shield majorities). */
export function spacesAroundShield(shield: Shield): ArtNouveauSpace[] {
  if (!isShield(shield)) {
    throw new Error(`Not a shield: (${shield.row}, ${shield.col})`);
  }
  return [
    { row: shield.row - 1, col: shield.col - 1 },
    { row: shield.row - 1, col: shield.col },
    { row: shield.row, col: shield.col - 1 },
    { row: shield.row, col: shield.col },
  ];
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
