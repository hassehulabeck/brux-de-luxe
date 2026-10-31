import { describe, expect, it } from 'vitest';
import { projectionGain } from '../../../src/ai/considerations/projection-gain';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn } from '../../helpers/game';

describe('projectionGain', () => {
  it('is zero when nothing changes for the player', () => {
    const state = gameAtFirstTurn();
    expect(projectionGain(contextFor(state, { kind: 'pass' }, { after: state }))).toBe(0);
  });

  it('counts the VP and resources a move brings', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.pending = { kind: 'takeMaterials', player: 0, count: 2 };
    });
    const gain = projectionGain(
      contextFor(state, { kind: 'takeMaterials', materials: ['wood', 'stone'] }),
    );
    // At least the 2 VP the cubes are worth at the end, plus what they can build.
    expect(gain).toBeGreaterThan(2);
  });
});
