import { describe, expect, it } from 'vitest';
import { loadComponents, TODO_DATA, validateComponents } from '../../src/data';
import { fakeRawComponents } from '../fixtures/fake-components';

describe('validateComponents', () => {
  it('accepts complete, valid data', () => {
    const { components, report } = validateComponents(fakeRawComponents());

    expect(report).toEqual({ missing: [], errors: [] });
    expect(components?.stockExchangeCards).toHaveLength(12);
    expect(components?.bonusCards[1]?.power).toEqual({
      kind: 'choice',
      options: ['architect', 'courthouse'],
    });
  });

  it('lists every TODO_DATA value by its path', () => {
    const raw = fakeRawComponents();
    raw.compass = { needleStart: TODO_DATA };
    raw.tracks = { cityHall: [1, 2], royalPalace: TODO_DATA, architect: TODO_DATA };

    const { components, report } = validateComponents(raw);

    expect(components).toBeUndefined();
    expect(report.errors).toEqual([]);
    expect(report.missing).toEqual([
      'tracks.royalPalace',
      'tracks.architect',
      'compass.needleStart',
    ]);
  });

  it('reports out-of-range values with their path', () => {
    const raw = fakeRawComponents();
    const cards = raw.stockExchangeCards as { shields: Record<string, { row: number }[]> }[];
    cards[3]!.shields['4']![1]!.row = 5;

    const { report } = validateComponents(raw);

    expect(report.errors).toEqual([
      'stockExchangeCards[3].shields.4[1].row: expected a whole number from 1 to 4, got 5',
    ]);
  });

  it('reports unknown and missing fields', () => {
    const raw = fakeRawComponents();
    raw.worksOfArt = { colorTiles: { blue: 6, pink: 6, yellow: 6, green: 6 }, blackTyles: 6 };

    const { report } = validateComponents(raw);

    expect(report.errors).toEqual([
      'worksOfArt.blackTyles: unknown field (typo?)',
      'worksOfArt.blackTiles: field is missing',
    ]);
  });

  it('checks totals against the component counts in the rulebook', () => {
    const raw = fakeRawComponents();
    raw.worksOfArt = { colorTiles: { blue: 6, pink: 6, yellow: 6, green: 6 }, blackTiles: 5 };
    (raw.bonusCards as { copies: number }[])[0]!.copies = 19;

    const { report } = validateComponents(raw);

    expect(report.errors).toEqual([
      'bonusCards: copies add up to 24, but the game has 25 Bonus cards',
      'worksOfArt: tiles add up to 29, but the game has 30',
    ]);
  });

  it('checks the Public Figure total including the 5 starting Brugmann cards', () => {
    const raw = fakeRawComponents();
    raw.publicFigures = {
      startingBrugmannCost: 1,
      deck: [{ figure: 'charlesBuls', costs: [1, 2, 3] }],
    };

    const { report } = validateComponents(raw);

    expect(report.errors).toEqual([
      'publicFigures.deck: 3 deck cards + 5 starting Brugmann cards = 8, but the game has 26 Public Figure cards',
    ]);
  });

  it('rejects needles pointing at the same compass space', () => {
    const raw = fakeRawComponents();
    raw.compass = { needleStart: [2, 2] };

    expect(validateComponents(raw).report.errors).toEqual([
      'compass.needleStart: the needles must point at different spaces',
    ]);
  });

  it('rejects Workshop dots that fall outside the grid at the start position', () => {
    const raw = fakeRawComponents();
    (raw.workshop as { cursorStart: unknown }).cursorStart = { row: 0, col: 2 };

    expect(validateComponents(raw).report.errors).toEqual([
      'workshop.dots.blue: is outside the grid when the cursor is at its start',
    ]);
  });

  it('rejects an unknown Bonus power kind', () => {
    const raw = fakeRawComponents();
    (raw.bonusCards as { power: unknown }[])[0]!.power = { kind: 'triple', effect: 'cityHall' };

    expect(validateComponents(raw).report.errors).toEqual([
      'bonusCards[0].power.kind: expected one of single, choice, double, got "triple"',
    ]);
  });

  it('rejects action strips with an unknown action', () => {
    const raw = fakeRawComponents();
    const strips = (raw.actionStrips as { strips: { basicSide: string[] }[] }).strips;
    strips[2]!.basicSide[4] = 'market';

    expect(validateComponents(raw).report.errors).toEqual([
      'actionStrips.strips[2].basicSide[4]: expected one of workshop, sale, royalTheater, materials, construction, got "market"',
    ]);
  });
});

describe('loadComponents', () => {
  it('returns the data when it is complete', () => {
    expect(loadComponents(fakeRawComponents()).compass.needleStart).toEqual([0, 3]);
  });

  it('throws a readable list of problems when it is not', () => {
    const raw = fakeRawComponents();
    raw.exhibitions = { years: TODO_DATA };

    expect(() => loadComponents(raw)).toThrow('missing: exhibitions.years');
  });
});
