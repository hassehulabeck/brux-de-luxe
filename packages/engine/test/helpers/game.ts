/**
 * Helpers for building game states in rule tests. The states come from a
 * real seeded setup, then tests edit a copy to set up the situation they need.
 */

import {
  apply,
  assertInvariants,
  legalMoves,
  newGame,
  resolveChance,
  seededOracle,
  type ArtNouveauAction,
  type ArtNouveauSpace,
  type GameState,
  type Move,
  type PlayerCount,
} from '../../src';
import { allSpaces } from '../../src/rules/helpers';

/** A game right after setup, at the first turn of round 1 (player 0 to act). */
export function gameAtFirstTurn(playerCount: PlayerCount = 3, seed = 1): GameState {
  const oracle = seededOracle(seed);
  let state = resolveChance(newGame({ playerCount }), oracle);
  while (state.pending?.kind !== 'turn') {
    const [first] = legalMoves(state);
    state = resolveChance(apply(state, first!), oracle);
  }
  // Make the whole board available, so tests can use any space.
  return edit(state, (draft) => {
    draft.round.area = { rows: [0, 4], cols: [0, 4] };
  });
}

/** A changed copy of a state. The original is not touched. */
export function edit(state: GameState, change: (draft: GameState) => void): GameState {
  const draft = JSON.parse(JSON.stringify(state)) as GameState;
  change(draft);
  return draft;
}

/** Apply moves in order (chance outcomes included), checking invariants after each. */
export function play(state: GameState, ...moves: Move[]): GameState {
  let current = state;
  for (const move of moves) {
    current = apply(current, move);
    assertInvariants(current);
  }
  return current;
}

/** The first free space with this action (no Assistant, no Building). */
export function freeSpace(state: GameState, action: ArtNouveauAction): ArtNouveauSpace {
  const found = allSpaces().find((space) => {
    const s = state.board[space.row]![space.col]!;
    return s.action === action && !s.assistant && s.building === null;
  });
  if (!found) throw new Error(`No free ${action} space`);
  return found;
}

export function kinds(moves: Move[]): string[] {
  return [...new Set(moves.map((m) => m.kind))];
}

/** Put an Assistant on a space (keeping the Assistant counts right). */
export function placeAssistant(
  draft: GameState,
  space: ArtNouveauSpace,
  owner: number | 'neutral',
  bid = 1,
): void {
  const target = draft.board[space.row]![space.col]!;
  if (owner === 'neutral') {
    const placedBy = draft.players.findIndex((p) => p.hasNeutralAssistant);
    draft.players[placedBy]!.hasNeutralAssistant = false;
    target.assistant = { kind: 'neutral', placedBy };
    return;
  }
  const p = draft.players[owner]!;
  p.assistants.available--;
  p.assistants.artNouveau++;
  target.assistant = { kind: 'player', player: owner, bid };
}

/** Lay out these Bonus card types under the 5 columns (keeping the cards conserved). */
export function setBonusStrip(draft: GameState, cards: number[]): void {
  draft.bonusStrip.forEach((card) => {
    if (card !== null) draft.bonusDeck[card]!++;
  });
  draft.bonusStrip = cards.map((card) => {
    draft.bonusDeck[card]!--;
    return card;
  });
}

/** Everyone passes, starting with the player to act. */
export function everyonePasses(state: GameState): GameState {
  let current = state;
  while (current.pending?.kind === 'turn') current = play(current, { kind: 'pass' });
  return current;
}
