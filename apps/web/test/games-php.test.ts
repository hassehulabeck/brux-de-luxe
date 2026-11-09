/**
 * public/api/games.php against an SQLite file (the web hotel uses MySQL; the
 * script only speaks SQL both understand). Runs the endpoint with PHP's
 * built-in web server; skipped when PHP or pdo_sqlite is missing.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const hasPhp = (() => {
  try {
    execFileSync('php', ['-r', 'exit(in_array("sqlite", PDO::getAvailableDrivers()) ? 0 : 1);']);
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasPhp)('games.php', () => {
  let php: ChildProcess;
  let url: string;
  let dbPath: string;

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brux-games-'));
    dbPath = join(dir, 'games.sqlite');
    const configPath = join(dir, 'config.php');
    writeFileSync(
      configPath,
      `<?php return ['dsn' => 'sqlite:${dbPath}', 'rate_dir' => '${dir}', 'client_key' => 'HTTP_X_TEST_IP'];`,
    );
    const port = 20000 + Math.floor(Math.random() * 20000);
    url = `http://127.0.0.1:${port}/games.php`;
    php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', resolve(__dirname, '../public/api')], {
      env: { ...process.env, BRUX_GAMES_CONFIG: configPath },
      stdio: 'ignore',
    });
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(url);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error('PHP server did not start');
  });

  afterAll(() => php?.kill());

  const post = async (body: unknown, ip = `10.0.${Math.floor(Math.random() * 250)}.7`) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-ip': ip },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as { ok?: boolean; error?: string } };
  };

  /** The row for a game, read with PHP so the test needs no SQLite package. */
  const row = (gameId: string): Record<string, string | number | null> | null =>
    JSON.parse(
      execFileSync('php', [
        '-r',
        `$db = new PDO('sqlite:${dbPath}'); $q = $db->prepare('SELECT * FROM games WHERE game_id = ?'); $q->execute([$argv[1]]); echo json_encode($q->fetch(PDO::FETCH_ASSOC) ?: null);`,
        gameId,
      ]).toString(),
    );

  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const now = () => new Date().toISOString();
  const seats = [
    { color: 'blue', bot: null },
    { color: 'red', bot: 'normal' },
    { color: 'green', bot: 'hard' },
  ];
  const score = (player: number, total: number) => ({
    player,
    color: seats[player]!.color,
    bot: seats[player]!.bot,
    scoringTrack: total - 9,
    buildings: 6,
    rows: [1, 0, 2, 0],
    nobleMaterials: 0,
    mannekenPis: player === 0 ? 3 : 0,
    total,
  });
  const scores = [score(0, 48), score(1, 61), score(2, 55)];

  it('logs a game from start to end, keeping only the network of the address', async () => {
    const gameId = id();
    const start = await post(
      { event: 'start', gameId, at: '2026-11-09T18:00:00+01:00', commit: 'abc1234', seats },
      '203.0.113.57',
    );
    expect(start).toEqual({ status: 200, json: { ok: true } });
    expect(row(gameId)).toMatchObject({
      ip_network: '203.0.113.0',
      app_commit: 'abc1234',
      player_count: 3,
      started_at: '2026-11-09 17:00:00', // stored in UTC
      ended_at: null,
      scores: null,
    });
    expect(JSON.parse(row(gameId)!.seats as string)).toEqual(seats);

    const end = await post(
      { event: 'end', gameId, at: '2026-11-09T19:45:00Z', moves: 412, scores },
      '198.51.100.9',
    );
    expect(end.status).toBe(200);
    const after = row(gameId)!;
    expect(after).toMatchObject({
      ip_network: '203.0.113.0', // the start's network is kept
      started_at: '2026-11-09 17:00:00',
      ended_at: '2026-11-09 19:45:00',
      moves: 412,
      winning_score: 61,
    });
    expect(after.start_received_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(after.end_received_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(JSON.parse(after.scores as string)).toEqual(scores);
  });

  it('replaces the result when a game ends again after an undo', async () => {
    const gameId = id();
    await post({ event: 'start', gameId, at: now(), seats });
    await post({ event: 'end', gameId, at: now(), moves: 400, scores });
    await post({
      event: 'end',
      gameId,
      at: now(),
      moves: 405,
      scores: [score(0, 70), ...scores.slice(1)],
    });
    expect(row(gameId)).toMatchObject({ moves: 405, winning_score: 70 });
  });

  it('takes an end without a start (the start was lost)', async () => {
    const gameId = id();
    expect(
      (await post({ event: 'end', gameId, at: now(), moves: 3, scores }, '2001:db8:abcd:12::1'))
        .status,
    ).toBe(200);
    expect(row(gameId)).toMatchObject({
      ip_network: '2001:db8:abcd::',
      started_at: null,
      player_count: 3,
    });
  });

  it('refuses events it cannot read', async () => {
    const gameId = id();
    const bad = [
      { event: 'middle', gameId, at: now(), seats },
      { event: 'start', gameId: 'not-a-uuid', at: now(), seats },
      { event: 'start', gameId, at: 'yesterday-ish', seats },
      { event: 'start', gameId, at: '2099-01-01T00:00:00Z', seats },
      { event: 'start', gameId, at: now(), seats: [seats[0]] },
      { event: 'start', gameId, at: now(), seats: [{ color: 'x', bot: 'DROP TABLE' }, seats[1]] },
      { event: 'end', gameId, at: now(), moves: -1, scores },
      {
        event: 'end',
        gameId,
        at: now(),
        moves: 3,
        scores: [{ ...score(0, 1), total: '1' }, score(1, 2)],
      },
      {
        event: 'end',
        gameId,
        at: now(),
        moves: 3,
        scores: [{ ...score(0, 1), rows: [1, 2] }, score(1, 2)],
      },
    ];
    for (const body of bad) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect((await fetch(url)).status).toBe(405);
    expect(row(gameId)).toBeNull();
  });

  it('allows 30 events per client per ten minutes', async () => {
    const statuses = [];
    for (let i = 0; i < 31; i++) {
      statuses.push(
        (await post({ event: 'start', gameId: id(), at: now(), seats }, '192.0.2.99')).status,
      );
    }
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
