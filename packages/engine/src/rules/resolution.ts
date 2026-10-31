/**
 * C. Resolution of the Turn phase (rulebook p. 8–9).
 */

import { EXHIBITION_MANNEKEN_PIS } from '../data/rulebook';
import { BRUSSELS_ACTIONS, type BonusEffect } from '../data/types';
import { SHIELD_COUNT_PER_SIDE, spacesAroundShield } from '../state/coords';
import type { GameState, PlayerIndex } from '../state/types';
import {
  advanceTrack,
  assertNever,
  components,
  player,
  retrieveFromCourthouse,
  seatsFrom,
  spaceAt,
  trackValue,
} from './helpers';
import type { PlayerMove } from './moves';

/** 1. Bids: the highest total bid in each column wins its Bonus card. Ties share the power. */
export function resolveBids(draft: GameState): void {
  draft.bonusStrip.forEach((card, col) => {
    if (card === null) return;
    const totals = draft.players.map(() => 0);
    for (const row of draft.board) {
      const assistant = row[col]?.assistant;
      if (assistant?.kind === 'player') totals[assistant.player]! += assistant.bid;
    }
    const best = Math.max(...totals);
    if (best === 0) return; // Nobody bid: the card stays and is discarded at End of Turn.
    const winners = totals.flatMap((total, p) => (total === best ? [p] : []));
    const tied = winners.length > 1;
    for (const winner of winners) draft.round.bonusWon.push({ player: winner, card, tied });
    if (tied) draft.bonusDiscard[card]!++;
    draft.bonusStrip[col] = null;
  });
}

/** 2. New first player: most Manneken Pis earned this round. */
export function chooseFirstPlayer(draft: GameState): void {
  const counts = draft.players.map(() => 0);
  for (const won of draft.round.bonusWon) {
    if (won.tied && !draft.rules.tiedBonusCardsCountMannekenPis) continue;
    counts[won.player]! += bonusType(won.card).mannekenPis;
  }
  const exhibitionWinner = draft.round.passed[0];
  if (exhibitionWinner !== undefined) counts[exhibitionWinner]! += EXHIBITION_MANNEKEN_PIS;
  draft.round.mannekenPis = counts;

  const start = draft.rules.firstPlayerTieIncludesCurrent
    ? draft.firstPlayer
    : (draft.firstPlayer + 1) % draft.playerCount;
  const best = Math.max(...counts);
  const newFirst = seatsFrom(draft, start).find((p) => counts[p] === best);
  if (newFirst !== undefined) draft.firstPlayer = newFirst;
}

/** 3. The moves for one Bonus card decision: use its central power, or tuck it. */
export function bonusMoves(state: GameState, owner: PlayerIndex): PlayerMove[] {
  const moves: PlayerMove[] = [];
  state.round.bonusWon.forEach((won, index) => {
    if (won.player !== owner) return;
    const type = bonusType(won.card);
    if (type.power.kind === 'choice') {
      for (const choice of type.power.options)
        moves.push({ kind: 'useBonus', card: index, choice });
    } else {
      moves.push({ kind: 'useBonus', card: index, choice: null });
    }
    // Tied cards are already discarded; cards without VP symbols can't be tucked (p. 9).
    if (won.tied || type.vpSymbols === 0) return;
    for (const row of [1, 2, 3, 4] as const) {
      if (!state.round.tuckedRows[owner]!.includes(row)) {
        moves.push({ kind: 'tuckBonus', card: index, row });
      }
    }
  });
  return moves;
}

export function useBonus(draft: GameState, index: number, choice: BonusEffect | null): void {
  const won = takeWonCard(draft, index);
  const power = bonusType(won.card).power;
  switch (power.kind) {
    case 'single':
      applyBonusEffect(draft, won.player, power.effect);
      break;
    case 'choice':
      if (!choice || !power.options.includes(choice)) throw new Error('Choose one of the powers');
      applyBonusEffect(draft, won.player, choice);
      break;
    case 'double':
      for (const effect of power.effects) applyBonusEffect(draft, won.player, effect);
      break;
    default:
      assertNever(power);
  }
  // "A Bonus card is discarded after using its central power" (p. 8). Tied ones already are.
  if (!won.tied) draft.bonusDiscard[won.card]!++;
}

export function tuckBonus(draft: GameState, index: number, row: 1 | 2 | 3 | 4): void {
  const won = takeWonCard(draft, index);
  player(draft, won.player).tucked[(row - 1) as 0 | 1 | 2 | 3].push(won.card);
  draft.round.tuckedRows[won.player]!.push(row);
}

/**
 * 4. Shield majorities: each shield with 4 Assistants around it scores. The
 * player with the most of them gains their City Hall value; tied players all
 * score. In a 2-player game, if the neutral color wins outright nobody scores.
 */
export function scoreShields(draft: GameState): void {
  for (let row = 1; row <= SHIELD_COUNT_PER_SIDE; row++) {
    for (let col = 1; col <= SHIELD_COUNT_PER_SIDE; col++) {
      for (const scorer of shieldWinners(draft, { row, col })) {
        player(draft, scorer).vp += trackValue(draft, scorer, 'cityHall');
      }
    }
  }
}

/** The players who score a shield (empty if it doesn't score). */
export function shieldWinners(state: GameState, shield: { row: number; col: number }) {
  const owners = spacesAroundShield(shield).map((space) => {
    const assistant = spaceAt(state, space).assistant;
    if (!assistant) return null;
    return assistant.kind === 'neutral' ? 'neutral' : assistant.player;
  });
  if (owners.includes(null)) return [];

  const counts = new Map<PlayerIndex | 'neutral', number>();
  for (const owner of owners) counts.set(owner!, (counts.get(owner!) ?? 0) + 1);
  const best = Math.max(...counts.values());
  const leaders = [...counts].filter(([, n]) => n === best).map(([owner]) => owner);
  return leaders.filter((owner): owner is PlayerIndex => owner !== 'neutral');
}

/** 5. Brussels majority: the player(s) with the most Assistants there send one to the Courthouse. */
export function brusselsMajority(draft: GameState): void {
  const totals = draft.players.map(() => 0);
  for (const action of BRUSSELS_ACTIONS) {
    for (const use of draft.round.brussels[action]) totals[use.player]! += use.assistants;
  }
  const best = Math.max(...totals);
  if (best === 0) return; // Nobody used the Brussels board (Q11).
  totals.forEach((total, p) => {
    if (total !== best) return;
    const assistants = player(draft, p).assistants;
    assistants.brussels--;
    assistants.courthouse++;
  });
}

export function applyBonusEffect(draft: GameState, owner: PlayerIndex, effect: BonusEffect) {
  if (effect === 'courthouse') retrieveFromCourthouse(draft, owner);
  else advanceTrack(draft, owner, effect);
}

export function bonusType(card: number) {
  const type = components().bonusCards[card];
  if (!type) throw new Error(`No Bonus card type ${card}`);
  return type;
}

function takeWonCard(draft: GameState, index: number) {
  const [won] = draft.round.bonusWon.splice(index, 1);
  if (!won) throw new Error(`No won Bonus card ${index}`);
  return won;
}
