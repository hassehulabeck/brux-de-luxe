import { describe, expect, it } from 'vitest';
import { parseSimArgs, UsageError } from '../src/args';
import type { DecisionLogEntry } from '../src/log';
import { entryLabels, gameSeed, runMatch } from '../src/match';
import { formatReport } from '../src/report';
import { formatTournament, MATCHUPS, runTournament } from '../src/tournament';

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
      log: null,
      tournament: false,
    });
  });

  it('reads --log and --tournament', () => {
    const options = parseSimArgs(['--log', 'decisions.jsonl', '--tournament', '--games', '50']);
    expect(options.log).toBe('decisions.jsonl');
    expect(options.tournament).toBe(true);
    expect(options.games).toBe(50);
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

describe('decision log', () => {
  it('logs every bot decision with its reason and up to 3 alternatives', () => {
    const entries: DecisionLogEntry[] = [];
    runMatch(
      {
        games: 1,
        players: [3],
        bots: ['utility', 'greedy', 'random'],
        seed: 2,
        checkInvariants: false,
      },
      { onDecision: (entry) => entries.push(entry) },
    );
    const utility = entries.filter((e) => e.bot === 'utility');
    expect(utility.length).toBeGreaterThan(20);
    expect(utility.every((e) => e.plan !== null && e.reason.length > 0)).toBe(true);
    expect(entries.every((e) => e.alternatives.length <= 3)).toBe(true);
    expect(entries[0]).toMatchObject({ game: 0, round: 1 });
    // Every line is plain JSON.
    expect(JSON.parse(JSON.stringify(utility[0]))).toEqual(utility[0]);
  });
});

describe('tournament', () => {
  it('plays every matchup and reports each bot', () => {
    const results = runTournament({ games: 1, seed: 3, checkInvariants: false });
    expect(results).toHaveLength(MATCHUPS.length);
    expect(results.every((r) => r.errors.length === 0)).toBe(true);
    const text = formatTournament(results);
    expect(text).toContain('Tournament: 1 games per matchup, seed 3');
    expect(text).toContain('utility');
  }, 30_000);
});
