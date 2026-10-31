import { describe, expect, it } from 'vitest';
import { parseSimArgs, UsageError } from '../src/args';
import { entryLabels, gameSeed, runMatch } from '../src/match';
import { formatReport } from '../src/report';

describe('parseSimArgs', () => {
  it('reads the options from the README example', () => {
    expect(
      parseSimArgs([
        '--',
        '--games',
        '1000',
        '--players',
        '3',
        '--bots',
        'greedy,random,random',
        '--seed',
        '42',
      ]),
    ).toEqual({
      games: 1000,
      players: [3],
      bots: ['greedy', 'random', 'random'],
      seed: 42,
      checkInvariants: true,
    });
  });

  it('rejects unknown bots and a bot list that does not fit the player count', () => {
    expect(() => parseSimArgs(['--bots', 'clever'])).toThrow(UsageError);
    expect(() => parseSimArgs(['--players', '4', '--bots', 'greedy,random'])).toThrow(UsageError);
    expect(() => parseSimArgs(['--players', '6'])).toThrow(UsageError);
  });
});

describe('runMatch', () => {
  it('plays every game, rotates the seats and counts every seat', () => {
    const result = runMatch({
      games: 6,
      players: [3],
      bots: ['greedy', 'random', 'random'],
      seed: 5,
      checkInvariants: true,
    });
    expect(result.errors).toEqual([]);
    expect(result.entries.map((e) => e.label)).toEqual(['greedy', 'random #1', 'random #2']);
    expect(result.entries.map((e) => e.seats)).toEqual([6, 6, 6]);
    const wins = result.entries.reduce((sum, e) => sum + e.wins, 0);
    expect(wins).toBeCloseTo(6);
    expect(formatReport(result)).toContain('6 of 6 games played');
  });

  it('is reproducible from the run seed', () => {
    const options = {
      games: 3,
      players: [2, 4],
      bots: ['random' as const],
      seed: 8,
      checkInvariants: false,
    };
    const a = runMatch(options);
    const b = runMatch(options);
    expect(a.entries).toEqual(b.entries);
    expect(a.totalMoves).toBe(b.totalMoves);
  });
});

describe('helpers', () => {
  it('numbers duplicate bots', () => {
    expect(entryLabels(['greedy', 'random', 'random'])).toEqual([
      'greedy',
      'random #1',
      'random #2',
    ]);
  });

  it('gives each game its own seed', () => {
    expect(new Set([0, 1, 2, 3].map((g) => gameSeed(42, g))).size).toBe(4);
  });
});
