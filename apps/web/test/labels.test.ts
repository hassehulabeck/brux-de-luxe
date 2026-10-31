import { describe, expect, it } from 'vitest';
import {
  apply,
  legalMoves,
  loadComponents,
  newGame,
  resolveChance,
  seededOracle,
} from '@brux/engine';
import {
  bonusCardLabel,
  botInstruction,
  chanceLabel,
  stockExchangeCardLabel,
  stripLabel,
} from '../src/game/labels';

const components = loadComponents();

function firstTurn() {
  const oracle = seededOracle(1);
  let state = resolveChance(newGame({ playerCount: 3 }), oracle);
  while (state.pending?.kind !== 'turn')
    state = resolveChance(apply(state, legalMoves(state)[0]!), oracle);
  return state;
}

describe('labels', () => {
  it('describes Bonus cards, Stock Exchange cards and strips from the component data', () => {
    expect(bonusCardLabel(0)).toMatch(/Royal Palace \+1 · 1 Manneken Pis · 1 VP symbol/);
    const state = newGame({ playerCount: 3 });
    const card = components.stockExchangeCards[0]!;
    expect(stockExchangeCardLabel(state, 0)).toBe(`${card.bf} BF · shield 3-4 or 4-3`);
    expect(stripLabel('1')).toBe('Sale · Royal Theater · Materials · Construction · Workshop');
  });

  it('labels a revealed Public Figure with its cost', () => {
    const state = newGame({ playerCount: 3 });
    expect(
      chanceLabel(state, { kind: 'revealPublicFigure', card: { figure: 'charlesBuls', cost: 3 } }),
    ).toBe('Charles Buls (costs 3 BF)');
  });

  it('turns a bot move into a physical instruction', () => {
    const before = firstTurn();
    const move = legalMoves(before).find((m) => m.kind === 'placeAssistant' && m.bid === 2)!;
    if (move.kind !== 'placeAssistant') throw new Error('expected a placement');
    const text = botInstruction(before, apply(before, move), move, 0, 'red');
    expect(text).toMatch(/^Place a red Assistant on row \d, column \d \(.+\) with 2 BF\.$/);
    const pass = botInstruction(
      before,
      apply(before, { kind: 'pass' }),
      { kind: 'pass' },
      0,
      'red',
    );
    expect(pass).toMatch(/^Pass\. Take the Exhibition tile\. Take \d+ BF\.$/);
  });
});
