import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '../../../src';
import { shieldMajority, shieldsAround } from '../../../src/ai/considerations/shield-majority';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn, placeAssistant } from '../../helpers/game';

// Shield (4,1) sits between rows 0–1 and columns 0–1 (state/coords.ts).
const around = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

describe('shieldMajority', () => {
  it('finds the shields around a space', () => {
    expect(shieldsAround({ row: 0, col: 0 })).toEqual([{ row: 4, col: 1 }]);
    expect(shieldsAround({ row: 2, col: 2 })).toHaveLength(4);
  });

  it('completing a shield I lead is worth my City Hall value', () => {
    // Corner space (0,0) touches only shield (4,1), so only that shield counts.
    const state = edit(gameAtFirstTurn(), (draft) => {
      placeAssistant(draft, around[1]!, 0);
      placeAssistant(draft, around[2]!, 0);
      placeAssistant(draft, around[3]!, 1);
    });
    const move = { kind: 'placeAssistant' as const, space: around[0]!, bid: 1 };
    // City Hall starts at 1 VP. Before: 2 of 4 with one empty space (50% to fill).
    const value = shieldMajority(contextFor(state, move));
    expect(value).toBeCloseTo(1 - 1 * DEFAULT_WEIGHTS.shields.completion);
  });

  it("an opponent's VP on a tie counts against me", () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      placeAssistant(draft, around[1]!, 1);
      placeAssistant(draft, around[2]!, 1);
      placeAssistant(draft, around[3]!, 0);
    });
    const move = { kind: 'placeAssistant' as const, space: around[0]!, bid: 1 };
    // 2 against 2: both score 1. Me: 0 -> 1. Opponent: 0.5 (one space to fill) -> 1.
    const { completion, denial } = DEFAULT_WEIGHTS.shields;
    expect(shieldMajority(contextFor(state, move))).toBeCloseTo(1 - denial * (1 - completion));
  });

  it("breaking a three-way tie denies both opponents' VP", () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      placeAssistant(draft, around[1]!, 1);
      placeAssistant(draft, around[2]!, 2);
      placeAssistant(draft, around[3]!, 0);
    });
    const move = { kind: 'placeAssistant' as const, space: around[0]!, bid: 1 };
    // Me: 0.5 -> 1. Each opponent: 0.5 -> 0.
    const { completion, denial } = DEFAULT_WEIGHTS.shields;
    expect(shieldMajority(contextFor(state, move))).toBeCloseTo(
      1 - completion + denial * 2 * completion,
    );
  });

  it('is nothing for other moves', () => {
    expect(shieldMajority(contextFor(gameAtFirstTurn(), { kind: 'pass' }))).toBe(0);
  });
});
