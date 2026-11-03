import { describe, expect, it } from 'vitest';
import {
  feedbackRequest,
  gameSummary,
  sendFeedback,
  type FeedbackForm,
} from '../src/game/feedback';
import { fromSaved, startSession, toSaved } from '../src/game/session';

const client = { commit: 'abc1234', userAgent: 'test', screen: '1024x768' };
const form = (over: Partial<FeedbackForm> = {}): FeedbackForm => ({
  kind: 'bug',
  title: '  The bot did something odd ',
  description: ' It placed two Assistants. ',
  name: ' Hans ',
  website: '',
  attach: true,
  ...over,
});
const session = startSession({
  seats: [
    { name: 'Hans', color: 'blue', bot: null },
    { name: 'Bot', color: 'red', bot: { difficulty: 'normal' } },
  ],
  seed: 1,
});

describe('suggestion box', () => {
  it('attaches the saved game and errors to a bug report', () => {
    const request = feedbackRequest(form(), session, client, ['TypeError: x']);
    expect(request).toMatchObject({
      kind: 'bug',
      title: 'The bot did something odd',
      description: 'It placed two Assistants.',
      name: 'Hans',
      client,
      summary: '2 players (Bot: normal) · round 1, setup · 0 moves',
      attachment: { game: toSaved(session), errors: ['TypeError: x'] },
    });
  });

  it('leaves the game out of ideas, unticked bugs and reports from the start screen', () => {
    expect(feedbackRequest(form({ kind: 'idea' }), session, client, []).attachment).toBeUndefined();
    expect(
      feedbackRequest(form({ attach: false }), session, client, []).attachment,
    ).toBeUndefined();
    const fromStart = feedbackRequest(form(), null, client, []);
    expect(fromStart.attachment).toBeUndefined();
    expect(fromStart.summary).toBeUndefined();
  });

  it('summarises a game without bots', () => {
    const humans = startSession({
      seats: [session.config.seats[0]!, session.config.seats[0]!],
      seed: 1,
    });
    expect(gameSummary(humans)).toBe('2 players · round 1, setup · 0 moves');
  });

  it("returns the issue number, or the server's sentence", async () => {
    const answer = (status: number, body: unknown) => async () =>
      new Response(JSON.stringify(body), { status });
    const request = feedbackRequest(form(), null, client, []);
    expect(await sendFeedback(request, answer(200, { issue: 7 }))).toBe(7);
    await expect(
      sendFeedback(request, answer(429, { error: 'Wait a few minutes.' })),
    ).rejects.toThrow('Wait a few minutes.');
    await expect(sendFeedback(request, answer(404, 'nope'))).rejects.toThrow(
      'The server answered 404',
    );
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(sendFeedback(request, offline)).rejects.toThrow("Couldn't reach the server");
  });

  it('imports a bug report file like a saved game', () => {
    const report = { format: 'brux-report/1', title: 'x', game: toSaved(session) };
    expect(toSaved(fromSaved(report))).toEqual(toSaved(session));
  });
});
