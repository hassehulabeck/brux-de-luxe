/**
 * State invariants that must hold after every apply() (CLAUDE.md rule 6).
 * Throws an Error listing every broken invariant. Used by tests and the simulator.
 */

import {
  ASSISTANTS_PER_PLAYER,
  BUILDING_TILES_PER_PLAYER,
  JOKER_SUPPLY,
  NOBLE_MATERIAL_SUPPLY,
} from '../data/rulebook';
import { NOBLE_MATERIALS, WORK_COLORS, type WorkOfArtColor } from '../data/types';
import type { GameState, PublicFigureCard } from '../state/types';
import { buildingsOnBoard, components } from './helpers';

export function assertInvariants(state: GameState): void {
  const problems = invariantProblems(state);
  if (problems.length > 0) throw new Error(`Broken invariants:\n- ${problems.join('\n- ')}`);
}

export function invariantProblems(state: GameState): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  const data = components();
  const spaces = state.board.flat();

  check(state.pending !== null, 'a decision is pending');

  // Assistants: 7 per player, and the counts match the boards.
  state.players.forEach((p, i) => {
    const a = p.assistants;
    check(
      a.available + a.artNouveau + a.brussels + a.courthouse === ASSISTANTS_PER_PLAYER,
      `player ${i} has ${ASSISTANTS_PER_PLAYER} Assistants`,
    );
    check(
      Object.values(a).every((n) => n >= 0),
      `player ${i} has no negative Assistant count`,
    );
    const onBoard = spaces.filter(
      (s) => s.assistant?.kind === 'player' && s.assistant.player === i,
    ).length;
    check(onBoard === a.artNouveau, `player ${i}'s Art Nouveau Assistants match the board`);
    if (state.playerCount === 2) {
      const neutral = spaces.filter(
        (s) => s.assistant?.kind === 'neutral' && s.assistant.placedBy === i,
      ).length;
      check(neutral + (p.hasNeutralAssistant ? 1 : 0) === 1, `player ${i} has 1 neutral Assistant`);
    }
    check(
      p.buildingsBuilt === buildingsOnBoard(state, i) &&
        p.buildingsBuilt <= BUILDING_TILES_PER_PLAYER,
      `player ${i}'s Buildings match the board`,
    );
    check(p.bf >= 0 && p.jokers >= 0, `player ${i} has no negative BF or Jokers`);
  });

  // The compass needles never point at the same space.
  const [a, b] = state.compass.needles;
  check(a !== b, 'the compass needles point at different spaces');

  // Materials are conserved (money is unlimited, Q7).
  for (const m of NOBLE_MATERIALS) {
    const total = state.supply.nobles[m] + sum(state.players.map((p) => p.nobles[m]));
    check(total === NOBLE_MATERIAL_SUPPLY[m] && state.supply.nobles[m] >= 0, `${m} is conserved`);
  }
  const jokers = state.supply.jokers + sum(state.players.map((p) => p.jokers));
  check(jokers === JOKER_SUPPLY && state.supply.jokers >= 0, 'Jokers are conserved');

  // Works of Art are conserved.
  // Works in a player's hand for a moment: just drawn, or just sold and not yet in the shop.
  const drawn: WorkOfArtColor[] =
    state.pending?.kind === 'keepWork'
      ? state.pending.drawn
      : state.pending?.kind === 'placeInShop'
        ? [state.pending.color]
        : [];
  const countWorks = (color: WorkOfArtColor) =>
    (color === 'black' ? state.workStacks.black : state.workStacks.color[color]) +
    state.shop.flat().filter((c) => c === color).length +
    sum(state.players.map((p) => p.works[color])) +
    drawn.filter((c) => c === color).length;
  for (const color of WORK_COLORS) {
    check(countWorks(color) === data.worksOfArt.colorTiles[color], `${color} works are conserved`);
  }
  check(countWorks('black') === data.worksOfArt.blackTiles, 'black works are conserved');

  // Bonus cards are conserved.
  data.bonusCards.forEach((type, card) => {
    const total =
      (state.bonusDeck[card] ?? 0) +
      (state.bonusDiscard[card] ?? 0) +
      state.bonusStrip.filter((c) => c === card).length +
      sum(state.players.map((p) => p.tucked.flat().filter((c) => c === card).length)) +
      state.round.bonusWon.filter((w) => w.card === card && !w.tied).length;
    check(total === type.copies, `Bonus card type ${card} is conserved`);
  });

  // Public Figures are conserved.
  const theater = state.royalTheater;
  const inFlight: PublicFigureCard[] = [
    ...(state.pending?.kind === 'keepPublicFigure' ? [state.pending.card] : []),
    ...state.steps.flatMap((s) => (s.kind === 'keepPublicFigure' ? [s.card] : [])),
  ];
  const allFigures = [
    ...theater.deck,
    ...theater.display.filter((c) => c !== null),
    ...theater.discard,
    ...theater.boxed,
    ...state.players.flatMap((p) => p.publicFigures),
    ...inFlight,
  ];
  const deckSize = sum(data.publicFigures.deck.map((entry) => entry.costs.length));
  check(
    allFigures.filter((c) => c.figure !== 'georgesBrugmann').length === deckSize,
    'Public Figure cards are conserved',
  );
  check(
    allFigures.filter((c) => c.figure === 'georgesBrugmann').length === state.playerCount,
    'one Georges Brugmann card per player',
  );
  state.players.forEach((p, i) => {
    const figures = p.publicFigures.map((f) => f.figure);
    check(new Set(figures).size === figures.length, `player ${i} has no identical Public Figures`);
  });

  // Stock Exchange cards are conserved.
  const stock = [
    ...state.stockExchange.deck,
    ...state.stockExchange.discard,
    ...(state.round.stockExchangeCard === null ? [] : [state.round.stockExchangeCard]),
  ];
  check(
    stock.length === data.stockExchangeCards.length && new Set(stock).size === stock.length,
    'Stock Exchange cards are conserved',
  );

  return problems;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
