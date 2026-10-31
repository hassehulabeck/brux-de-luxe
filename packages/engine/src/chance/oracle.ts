/**
 * A ChanceOracle decides what comes out of a draw or a shuffle.
 *
 * - The seeded oracle (here) is used by tests and the simulator.
 * - The table app will ask the players what was revealed instead, choosing
 *   from chanceOutcomes(state, event).
 */

import { COMPASS_TILE_SET } from '../data/rulebook';
import { WORK_COLORS, type WorkColor } from '../data/types';
import { apply } from '../rules/apply';
import { components } from '../rules/helpers';
import type { ChanceMove } from '../rules/moves';
import type { ChanceEvent, GameState } from '../state/types';
import { seededRng, shuffled, type Rng } from './rng';

export interface ChanceOracle {
  resolve(state: GameState, event: ChanceEvent): ChanceMove;
}

export function seededOracle(seed: number): ChanceOracle {
  const rng = seededRng(seed);
  return { resolve: (state, event) => drawWithRng(rng, state, event) };
}

/** Draw from the real contents of the stack or deck, so every card has its true chance. */
export function drawWithRng(rng: Rng, state: GameState, event: ChanceEvent): ChanceMove {
  switch (event.kind) {
    case 'arrangeStrips':
      return {
        kind: 'revealStrips',
        order: shuffled(
          rng,
          components().actionStrips.strips.map((s) => s.id),
        ),
      };
    case 'placeCompassTiles':
      return { kind: 'revealCompassTiles', tiles: shuffled(rng, COMPASS_TILE_SET) };
    case 'drawPublicFigure': {
      const deck = state.royalTheater.deck;
      return { kind: 'revealPublicFigure', card: deck[rng.int(deck.length)]! };
    }
    case 'drawWorks': {
      const stack: WorkColor[] = WORK_COLORS.flatMap((color) =>
        Array.from({ length: state.workStacks.color[color] }, () => color),
      );
      const colors = shuffled(rng, stack)
        .slice(0, event.count)
        .sort((a, b) => WORK_COLORS.indexOf(a) - WORK_COLORS.indexOf(b));
      return { kind: 'revealWorks', colors };
    }
    case 'drawStockExchangeCard': {
      const deck = state.stockExchange.deck;
      return { kind: 'revealStockExchangeCard', card: deck[rng.int(deck.length)]! };
    }
    case 'drawBonusCard': {
      const cards = state.bonusDeck.flatMap((copies, card) =>
        Array.from({ length: copies }, () => card),
      );
      return { kind: 'revealBonusCard', card: cards[rng.int(cards.length)]! };
    }
  }
}

/** Apply chance outcomes until a player has to decide something. */
export function resolveChance(state: GameState, oracle: ChanceOracle): GameState {
  let current = state;
  while (current.pending?.kind === 'chance') {
    current = apply(current, oracle.resolve(current, current.pending.event));
  }
  return current;
}
