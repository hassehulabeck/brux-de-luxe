/**
 * Public Figures: the Royal Theater display and the card effects
 * (rulebook p. 6, Appendix 1 on p. 11).
 */

import { PUBLIC_FIGURE_EFFECTS, ROYAL_THEATER_COSTS } from '../data/rulebook';
import { NOBLE_MATERIALS, type NobleMaterial, type PublicFigureId } from '../data/types';
import type { GameState, PlayerIndex, PublicFigureCard } from '../state/types';
import type { PlayerMove } from './moves';
import { advanceTrack, assertNever, gainJokers, player, retrieveFromCourthouse } from './helpers';

/** Display positions a player can take from: a card is there and they can pay for it. */
export function affordableDisplayPositions(state: GameState, owner: PlayerIndex): number[] {
  const bf = player(state, owner).bf;
  return state.royalTheater.display.flatMap((card, position) =>
    card && bf >= (ROYAL_THEATER_COSTS[position] ?? Infinity) ? [position] : [],
  );
}

/** Take a card from the display: pay, and shift the cards to the right to fill the gap. */
export function takeFromDisplay(
  draft: GameState,
  owner: PlayerIndex,
  position: number,
): PublicFigureCard {
  const display = draft.royalTheater.display;
  const card = display[position];
  if (!card) throw new Error(`No Public Figure at display position ${position}`);
  player(draft, owner).bf -= ROYAL_THEATER_COSTS[position] ?? 0;
  draft.royalTheater.display = [
    ...display.slice(0, position),
    ...display.slice(position + 1),
    null,
  ];
  return card;
}

/** End of Turn: discard the card on space 0 and shift the others right (p. 10). */
export function discardFreeDisplayCard(draft: GameState): void {
  const [first, ...rest] = draft.royalTheater.display;
  if (first) draft.royalTheater.discard.push(first);
  draft.royalTheater.display = [...rest, null];
}

/** A player can't keep two identical Public Figures (p. 6). */
export function canKeep(state: GameState, owner: PlayerIndex, figure: PublicFigureId): boolean {
  return !player(state, owner).publicFigures.some((kept) => kept.figure === figure);
}

/** Apply an effect that needs no decision. Returns false if the effect needs one (Solvay). */
export function applySimpleEffect(
  draft: GameState,
  owner: PlayerIndex,
  figure: PublicFigureId,
): boolean {
  const effect = PUBLIC_FIGURE_EFFECTS[figure];
  const p = player(draft, owner);
  switch (effect.kind) {
    case 'gainBf':
      p.bf += effect.amount;
      return true;
    case 'gainVp':
      p.vp += effect.amount;
      return true;
    case 'gainJokers':
      gainJokers(draft, owner, effect.amount);
      return true;
    case 'advanceTrack':
      advanceTrack(draft, owner, effect.track);
      return true;
    case 'retrieveFromCourthouse':
      retrieveFromCourthouse(draft, owner);
      return true;
    case 'nobleMaterialOrJokerExchange':
      return false;
    default:
      return assertNever(effect);
  }
}

/**
 * Ernest Solvay: gain 1 Noble Material, or exchange 1 Joker for 2 Noble
 * Materials. Both depend on the limited supply.
 */
export function solvayMoves(state: GameState, owner: PlayerIndex): PlayerMove[] {
  const supply = state.supply.nobles;
  const moves: PlayerMove[] = NOBLE_MATERIALS.filter((m) => supply[m] > 0).map((material) => ({
    kind: 'solvayTake',
    material,
  }));
  if (player(state, owner).jokers > 0) {
    for (const [a, b] of materialPairs()) {
      const needed = { wood: 0, stone: 0, iron: 0 };
      needed[a]++;
      needed[b]++;
      if (NOBLE_MATERIALS.every((m) => supply[m] >= needed[m])) {
        moves.push({ kind: 'solvayExchange', materials: [a, b] });
      }
    }
  }
  return moves;
}

/** Unordered pairs of Noble Materials, e.g. [wood, wood], [wood, stone], ... */
export function materialPairs(): [NobleMaterial, NobleMaterial][] {
  const pairs: [NobleMaterial, NobleMaterial][] = [];
  NOBLE_MATERIALS.forEach((a, i) => {
    for (const b of NOBLE_MATERIALS.slice(i)) pairs.push([a, b]);
  });
  return pairs;
}
