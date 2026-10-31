import { describe, expect, it } from 'vitest';
import { isArtNouveauSpace, isShield, spacesAroundShield } from '../../src/state/coords';

describe('coords', () => {
  // Shield rows count from the bottom, columns from the left (rulebook p. 3).
  it('maps shield (1,1) to the four bottom-left action spaces', () => {
    expect(spacesAroundShield({ row: 1, col: 1 })).toEqual([
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
    ]);
  });

  it('maps shield (4,4) to the four top-right action spaces', () => {
    expect(spacesAroundShield({ row: 4, col: 4 })).toEqual([
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
    ]);
  });

  it('maps shield (4,1) to the four top-left action spaces', () => {
    expect(spacesAroundShield({ row: 4, col: 1 })).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it('every shield touches four valid action spaces', () => {
    for (let row = 1; row <= 4; row++) {
      for (let col = 1; col <= 4; col++) {
        const spaces = spacesAroundShield({ row, col });
        expect(spaces.every(isArtNouveauSpace)).toBe(true);
      }
    }
  });

  it('rejects coordinates outside the board', () => {
    expect(isShield({ row: 0, col: 1 })).toBe(false);
    expect(isShield({ row: 1, col: 5 })).toBe(false);
    expect(isArtNouveauSpace({ row: 5, col: 0 })).toBe(false);
    expect(isArtNouveauSpace({ row: 0, col: 1.5 })).toBe(false);
    expect(() => spacesAroundShield({ row: 0, col: 0 })).toThrow('Not a shield');
  });
});
