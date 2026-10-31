import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, WEIGHT_SETS } from '../../src';

/** Every dotted path to a number, sorted. */
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'number') return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => paths(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe('weight sets', () => {
  it('has the hand-made and the tuned set', () => {
    expect(Object.keys(WEIGHT_SETS)).toEqual(['default', 'tuned']);
    expect(WEIGHT_SETS.default).toBe(DEFAULT_WEIGHTS);
  });

  it('every set has exactly the weights of the default set, all finite and not negative', () => {
    for (const [name, weights] of Object.entries(WEIGHT_SETS)) {
      expect(paths(weights), name).toEqual(paths(DEFAULT_WEIGHTS));
      for (const path of paths(weights)) {
        const value = path
          .split('.')
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], weights);
        expect(Number.isFinite(value) && (value as number) >= 0, `${name}.${path}`).toBe(true);
      }
    }
  });
});
