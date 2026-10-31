/**
 * D. End of Turn phase and the end of the game (rulebook p. 10).
 */

import {
  ASSISTANTS_NOT_SCORED_BY_TUCK_ROW_4,
  ASSISTANTS_PER_PLAYER,
  MANNEKEN_PIS_FINAL_VP,
  TUCK_ROW_BASE_VP_SYMBOLS,
  UNPAID_PUBLIC_FIGURE_PENALTY_VP,
  VP_PER_NOBLE_MATERIAL,
} from '../data/rulebook';
import type { FinalScore, GameState, PlayerIndex } from '../state/types';
import { buildingsOnBoard, nobleCount, player, pushSteps, trackValue, workCount } from './helpers';
import type { PlayerMove } from './moves';
import { discardFreeDisplayCard } from './public-figures';
import { bonusType } from './resolution';

export function endOfRound(draft: GameState): void {
  // Assistants come back, except those in the Courthouse; bids go to the supply.
  for (const p of draft.players) {
    p.assistants.available += p.assistants.artNouveau + p.assistants.brussels;
    p.assistants.artNouveau = 0;
    p.assistants.brussels = 0;
    if (draft.playerCount === 2) p.hasNeutralAssistant = true;
    for (const figure of p.publicFigures) figure.rotated = false;
  }
  for (const row of draft.board) for (const space of row) space.assistant = null;

  // The next Exhibition tile is revealed: it is round.number + 1's tile.
  draft.round.number++;

  discardFreeDisplayCard(draft);

  draft.bonusStrip.forEach((card, col) => {
    if (card !== null) draft.bonusDiscard[card]!++;
    draft.bonusStrip[col] = null;
  });

  if (draft.round.stockExchangeCard !== null) {
    draft.stockExchange.discard.push(draft.round.stockExchangeCard);
    draft.round.stockExchangeCard = null;
  }

  pushSteps(draft, [
    { kind: 'fillRoyalTheater' },
    { kind: 'dealBonusCards' },
    { kind: 'startRound' },
  ]);
}

// --- Paying the Public Figures ---------------------------------------------------

function totalCost(state: GameState, owner: PlayerIndex, indexes: number[]): number {
  const figures = player(state, owner).publicFigures;
  return indexes.reduce((sum, i) => sum + (figures[i]?.cost ?? 0), 0);
}

/** True if the player has a choice of which kept Public Figures to leave unpaid. */
export function mustChooseUnpaidFigures(state: GameState, owner: PlayerIndex): boolean {
  const p = player(state, owner);
  if (!state.rules.mustPayPublicFiguresWhenAble) return p.publicFigures.length > 0;
  return p.publicFigures.reduce((sum, f) => sum + f.cost, 0) > p.bf;
}

export function payAllPublicFigures(draft: GameState, owner: PlayerIndex): void {
  payPublicFigures(draft, owner, []);
}

/**
 * The choices of cards to leave unpaid (p. 10 example: 15 BF of cards, 12 BF
 * in hand, give up one 4 BF card). Paying is optional (Q19), so any choice
 * the player can afford is allowed. With `mustPayPublicFiguresWhenAble` on, a
 * card may only stay unpaid if the money left can't cover it.
 */
export function unpaidChoices(state: GameState, owner: PlayerIndex): PlayerMove[] {
  const p = player(state, owner);
  const count = p.publicFigures.length;
  const moves: PlayerMove[] = [];
  for (let mask = 0; mask < 1 << count; mask++) {
    const unpaid = [...Array(count).keys()].filter((i) => mask & (1 << i));
    const paid = [...Array(count).keys()].filter((i) => !(mask & (1 << i)));
    const left = p.bf - totalCost(state, owner, paid);
    if (left < 0) continue;
    const mustPay = state.rules.mustPayPublicFiguresWhenAble;
    if (!mustPay || unpaid.every((i) => (p.publicFigures[i]?.cost ?? 0) > left)) {
      moves.push({ kind: 'payPublicFigures', unpaid });
    }
  }
  return moves;
}

export function payPublicFigures(draft: GameState, owner: PlayerIndex, unpaid: number[]): void {
  const p = player(draft, owner);
  const kept = p.publicFigures.filter((_, i) => !unpaid.includes(i));
  const lost = p.publicFigures.filter((_, i) => unpaid.includes(i));
  p.bf -= kept.reduce((sum, f) => sum + f.cost, 0);
  p.vp -= lost.length * UNPAID_PUBLIC_FIGURE_PENALTY_VP;
  p.publicFigures = kept;
  for (const { figure, cost } of lost) draft.royalTheater.boxed.push({ figure, cost });
}

// --- Final score ---------------------------------------------------------------------

export function finalScores(state: GameState): FinalScore[] {
  return state.players.map((_, owner) => finalScore(state, owner));
}

export function finalScore(state: GameState, owner: PlayerIndex): FinalScore {
  const p = player(state, owner);
  const multiplier = (row: 0 | 1 | 2 | 3) =>
    TUCK_ROW_BASE_VP_SYMBOLS +
    p.tucked[row].reduce((sum, card) => sum + bonusType(card).vpSymbols, 0);

  const assistants = state.rules.tuckRow4CountsAssistantsOnBoards
    ? ASSISTANTS_PER_PLAYER - p.assistants.courthouse
    : p.assistants.available;

  const rows: FinalScore['rows'] = [
    Math.floor(p.bf / 4) * multiplier(0),
    workCount(p) * multiplier(1),
    p.publicFigures.length * multiplier(2),
    Math.max(0, assistants - ASSISTANTS_NOT_SCORED_BY_TUCK_ROW_4) * multiplier(3),
  ];
  const score = {
    player: owner,
    scoringTrack: p.vp,
    buildings: buildingsOnBoard(state, owner) * trackValue(state, owner, 'architect'),
    rows,
    nobleMaterials: nobleCount(p) * VP_PER_NOBLE_MATERIAL,
    mannekenPis: state.firstPlayer === owner ? MANNEKEN_PIS_FINAL_VP : 0,
  };
  return {
    ...score,
    total:
      score.scoringTrack +
      score.buildings +
      rows.reduce((a, b) => a + b, 0) +
      score.nobleMaterials +
      score.mannekenPis,
  };
}
