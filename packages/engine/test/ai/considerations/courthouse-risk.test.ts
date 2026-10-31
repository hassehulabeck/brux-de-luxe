import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '../../../src';
import { courthouseChance, courthouseRisk } from '../../../src/ai/considerations/courthouse-risk';
import { contextFor } from '../../helpers/ai';
import { edit, gameAtFirstTurn } from '../../helpers/game';

const move = { kind: 'takeBrusselsAction' as const, action: 'market' as const };

describe('courthouseRisk', () => {
  it('the first Brussels action of the round risks an Assistant', () => {
    expect(courthouseRisk(contextFor(gameAtFirstTurn(), move))).toBeLessThan(0);
  });

  it('is smaller when an opponent already has more Assistants there', () => {
    const behind = edit(gameAtFirstTurn(), (draft) => {
      draft.round.brussels.stockExchange.push({ player: 1, assistants: 3 });
      draft.players[1]!.assistants.available -= 3;
      draft.players[1]!.assistants.brussels += 3;
    });
    const alone = courthouseRisk(contextFor(gameAtFirstTurn(), move));
    expect(courthouseRisk(contextFor(behind, move))).toBeGreaterThan(alone);
  });

  it('is certain when leading and nobody else can still act', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.round.passed = [1, 2];
    });
    expect(courthouseChance(state, 0, [1, 0, 0], DEFAULT_WEIGHTS)).toBe(1);
  });
});
