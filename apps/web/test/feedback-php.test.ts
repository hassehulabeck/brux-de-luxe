/**
 * public/api/feedback.php against a fake GitHub API. Runs the endpoint with
 * PHP's built-in web server; skipped when PHP is not installed.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startSession, toSaved } from '../src/game/session';

const hasPhp = (() => {
  try {
    execFileSync('php', ['-r', 'exit(function_exists("curl_init") ? 0 : 1);']);
    return true;
  } catch {
    return false;
  }
})();

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

describe.skipIf(!hasPhp)('feedback.php', () => {
  let github: Server;
  let php: ChildProcess;
  let url: string;
  let calls: Call[];
  let branchExists: boolean;
  let configPath: string;

  beforeAll(async () => {
    github = createServer((req, res) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        const path = req.url!.replace('/repos/owner/repo', '');
        calls.push({ method: req.method!, path, body: data ? JSON.parse(data) : null });
        const send = (status: number, body: unknown) => {
          res.writeHead(status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        if (path === '/labels') return send(422, {});
        if (path === '/issues') return send(201, { number: 42 });
        if (path === '/git/ref/heads/bug-reports')
          return branchExists ? send(200, { object: { sha: 'head' } }) : send(404, {});
        if (path === '/git/commits/head') return send(200, { tree: { sha: 'base-tree' } });
        if (path === '/git/trees') return send(201, { sha: 'tree' });
        if (path === '/git/commits') return send(201, { sha: 'commit' });
        if (path.startsWith('/git/refs')) return send(200, {});
        send(404, {});
      });
    });
    await new Promise<void>((done) => github.listen(0, '127.0.0.1', done));
    const githubPort = (github.address() as { port: number }).port;

    const dir = mkdtempSync(join(tmpdir(), 'brux-feedback-'));
    configPath = join(dir, 'config.php');
    writeFileSync(
      configPath,
      `<?php return ['token' => 't', 'repo' => 'owner/repo', 'api' => 'http://127.0.0.1:${githubPort}', 'rate_dir' => '${dir}', 'client_key' => 'HTTP_X_TEST_IP'];`,
    );
    const port = 20000 + Math.floor(Math.random() * 20000);
    url = `http://127.0.0.1:${port}/feedback.php`;
    php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', resolve(__dirname, '../public/api')], {
      env: { ...process.env, BRUX_FEEDBACK_CONFIG: configPath },
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

  afterAll(() => {
    php?.kill();
    github?.close();
  });

  beforeEach(() => {
    calls = [];
    branchExists = true;
  });

  const post = async (body: unknown, ip = String(Math.random())) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-ip': ip },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as { issue?: number; error?: string } };
  };
  const idea = {
    kind: 'idea',
    title: 'Show the plan',
    description: 'Ping @someone please',
    name: 'Hans',
    website: '',
    client: { commit: 'abc1234', userAgent: 'test', screen: '1x1' },
  };
  const game = toSaved(
    startSession({
      seats: [
        { name: 'Hans', color: 'blue', bot: null },
        { name: 'B', color: 'red', bot: null },
      ],
      seed: 1,
    }),
  );

  it('files an idea as an issue, without pinging anyone', async () => {
    const { status, json } = await post(idea);
    expect(status).toBe(200);
    expect(json.issue).toBe(42);
    const issue = calls.find((c) => c.path === '/issues')!.body!;
    expect(issue.title).toBe('[Idea] Show the plan (abc1234)');
    expect(issue.labels).toEqual(['enhancement', 'from-the-app']);
    expect(issue.body).toContain('**From:** Hans');
    expect(issue.body).toContain('@​someone');
    expect(calls.some((c) => c.path.startsWith('/git'))).toBe(false);
  });

  it('commits an attached game to bug-reports and links it from the issue', async () => {
    branchExists = false;
    const { status } = await post({
      ...idea,
      kind: 'bug',
      title: 'Bot broke',
      attachment: { game, errors: ['TypeError: boom'] },
    });
    expect(status).toBe(200);
    const tree = calls.find((c) => c.path === '/git/trees')!.body!;
    expect(tree.base_tree).toBeUndefined();
    const file = (tree.tree as { path: string; content: string }[])[0]!;
    expect(file.path).toMatch(/^reports\/\d{4}-\d\d-\d\d\/\d{6}-[0-9a-f]{8}\.json$/);
    const report = JSON.parse(file.content);
    expect(report).toMatchObject({
      format: 'brux-report/1',
      kind: 'bug',
      game,
      errors: ['TypeError: boom'],
    });
    expect(calls.find((c) => c.path === '/git/refs')!.body).toEqual({
      ref: 'refs/heads/bug-reports',
      sha: 'commit',
    });
    const issue = calls.find((c) => c.path === '/issues')!.body!;
    expect(issue.labels).toEqual(['bug', 'from-the-app']);
    expect(issue.body).toContain(`https://github.com/owner/repo/blob/bug-reports/${file.path}`);
    expect(issue.body).toContain('TypeError: boom');
  });

  it('builds on the existing bug-reports branch', async () => {
    await post({ ...idea, kind: 'bug', attachment: { game, errors: [] } });
    expect(calls.find((c) => c.path === '/git/trees')!.body!.base_tree).toBe('base-tree');
    expect(
      calls.find((c) => c.path === '/git/refs/heads/bug-reports' && c.method === 'PATCH'),
    ).toBeTruthy();
  });

  it('rejects bad reports with a sentence to show', async () => {
    expect((await post({ ...idea, kind: 'rant' })).json.error).toBe('Is it a bug or an idea?');
    expect((await post({ ...idea, title: 'x' })).json.error).toBe('Give it a short title.');
    expect((await post({ ...idea, description: ' ' })).json.error).toBe('Tell us a bit more.');
    expect((await post({ ...idea, website: 'spam.example' })).status).toBe(400);
    expect((await post({ ...idea, attachment: { game: { version: 9 } } })).status).toBe(400);
    expect((await fetch(url)).status).toBe(405);
    expect(calls.some((c) => c.path === '/issues')).toBe(false);
  });

  it('allows five reports per client per ten minutes', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await post(idea, 'same-client')).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
