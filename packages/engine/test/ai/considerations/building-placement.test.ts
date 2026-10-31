import { describe, expect, it } from 'vitest';
import { areaChance, buildingPlacement } from '../../../src/ai/considerations/building-placement';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn } from '../../helpers/game';

function withBuilding(at: { row: number; col: number }) {
  const before = gameAtFirstTurn();
  const after = edit(before, (draft) => {
    draft.board[at.row]![at.col]!.building = 0;
    draft.players[0]!.buildingsBuilt = 1;
  });
  return contextFor(before, { kind: 'placeBuilding', space: at }, { after });
}

describe('buildingPlacement', () => {
  it('the center of the board is in more future areas than a corner', () => {
    const state = gameAtFirstTurn();
    expect(areaChance(state, { row: 2, col: 2 })).toBeGreaterThan(
      areaChance(state, { row: 0, col: 0 }),
    );
  });

  it('values a new Building by its expected income', () => {
    expect(buildingPlacement(withBuilding({ row: 2, col: 2 }))).toBeGreaterThan(0);
  });

  it('is nothing without a new Building', () => {
    const state = gameAtFirstTurn();
    expect(buildingPlacement(contextFor(state, { kind: 'pass' }, { after: state }))).toBe(0);
  });
});
