import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, largestArea } from '../../../src';
import { areaChoice } from '../../../src/ai/considerations/area-choice';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn } from '../../helpers/game';

describe('areaChoice', () => {
  // Shield (1,1): the largest area is rows 0–3, columns 1–4.
  const shield = { row: 1, col: 1 };
  const move = { kind: 'chooseShield' as const, shield };

  it('likes its own Buildings in the area and dislikes opponents', () => {
    expect(largestArea(shield)).toEqual({ rows: [0, 3], cols: [1, 4] });
    const base = gameAtFirstTurn();
    const action = base.board[0]![1]!.action;
    const income = DEFAULT_WEIGHTS.buildings.secondaryIncome[action];
    const mine = edit(base, (draft) => {
      draft.board[0]![1]!.building = 0;
    });
    const theirs = edit(base, (draft) => {
      draft.board[0]![1]!.building = 1;
    });
    expect(areaChoice(contextFor(mine, move, { after: mine }))).toBe(income);
    expect(areaChoice(contextFor(theirs, move, { after: theirs }))).toBe(
      -DEFAULT_WEIGHTS.buildings.opponentShare * income,
    );
  });

  it('ignores Buildings outside the area', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.board[4]![0]!.building = 0;
    });
    expect(areaChoice(contextFor(state, move, { after: state }))).toBe(0);
  });
});
