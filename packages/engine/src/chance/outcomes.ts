/**
 * The possible outcomes of each chance event, as moves. The table app shows
 * these as options ("which card was revealed?"); the seeded oracle draws one
 * with the right probabilities.
 */

import { COMPASS_TILE_SET } from '../data/rulebook';
import { WORK_COLORS, type WorkColor } from '../data/types';
import { components } from '../rules/helpers';
import type { ChanceMove } from '../rules/moves';
import { canonicalJson } from '../rules/moves';
import type { ChanceEvent, GameState } from '../state/types';

export function chanceOutcomes(state: GameState, event: ChanceEvent): ChanceMove[] {
  switch (event.kind) {
    case 'arrangeStrips':
      return permutations(components().actionStrips.strips.map((s) => s.id)).map((order) => ({
        kind: 'revealStrips',
        order,
      }));
    case 'placeCompassTiles':
      return permutations([...COMPASS_TILE_SET]).map((tiles) => ({
        kind: 'revealCompassTiles',
        tiles,
      }));
    case 'drawPublicFigure': {
      const distinct = new Map(state.royalTheater.deck.map((card) => [canonicalJson(card), card]));
      return [...distinct.values()].map((card) => ({ kind: 'revealPublicFigure', card }));
    }
    case 'drawWorks':
      return workDraws(state.workStacks.color, event.count).map((colors) => ({
        kind: 'revealWorks',
        colors,
      }));
    case 'drawStockExchangeCard':
      return state.stockExchange.deck.map((card) => ({ kind: 'revealStockExchangeCard', card }));
    case 'drawBonusCard':
      return state.bonusDeck.flatMap((copies, card) =>
        copies > 0 ? [{ kind: 'revealBonusCard' as const, card }] : [],
      );
  }
}

/** Every multiset of `count` colors the stack can give, sorted in WORK_COLORS order. */
export function workDraws(stack: Record<WorkColor, number>, count: number): WorkColor[][] {
  const result: WorkColor[][] = [];
  const pick = (start: number, chosen: WorkColor[]) => {
    if (chosen.length === count) {
      result.push(chosen);
      return;
    }
    WORK_COLORS.forEach((color, i) => {
      if (i < start) return;
      if (stack[color] > chosen.filter((c) => c === color).length) pick(i, [...chosen, color]);
    });
  };
  pick(0, []);
  return result;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}
