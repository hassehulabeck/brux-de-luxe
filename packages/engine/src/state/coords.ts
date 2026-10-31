/**
 * Coordinates on the Art Nouveau board. This file is the one place where the
 * mapping between action spaces and shields is defined.
 *
 * Action spaces: 5×5, zero-based, used internally. Row 0 is the top row.
 * Each row is one Action strip (rulebook p. 1 and p. 3).
 *
 *          col 0   col 1   col 2   col 3   col 4
 *   row 0  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (4,1)   (4,2)   (4,3)   (4,4)        <- shield row 4
 *   row 1  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (3,1)   (3,2)   (3,3)   (3,4)        <- shield row 3
 *   row 2  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (2,1)   (2,2)   (2,3)   (2,4)        <- shield row 2
 *   row 3  [    ]  [    ]  [    ]  [    ]  [    ]
 *                (1,1)   (1,2)   (1,3)   (1,4)        <- shield row 1
 *   row 4  [    ]  [    ]  [    ]  [    ]  [    ]
 *   Bonus  [card]  [card]  [card]  [card]  [card]
 *                  1       2       3       4          <- shield columns
 *
 * Shields: 4×4, numbered 1–4 exactly as the rulebook and the Stock Exchange
 * cards print them, so card data can be typed in as printed. The first
 * number is the shield row, the second the shield column (rulebook p. 4).
 *
 * Shield rows are counted from the BOTTOM (row 1 is next to the Bonus
 * strip) and shield columns from the left. The setup illustration on p. 3
 * shows this: the row labels 4, 3, 2, 1 run down the edge of the Brussels
 * board, and the column labels 1–4 sit on the Bonus strip.
 *
 * So shield { row: r, col: c } sits where the four action spaces in rows
 * 4-r and 5-r, columns c-1 and c, meet.
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
  const rowAbove = BOARD_SIZE - 1 - shield.row;
  const rowBelow = rowAbove + 1;
  return [
    { row: rowAbove, col: shield.col - 1 },
    { row: rowAbove, col: shield.col },
    { row: rowBelow, col: shield.col - 1 },
    { row: rowBelow, col: shield.col },
  ];
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
