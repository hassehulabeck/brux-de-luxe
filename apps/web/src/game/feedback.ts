/**
 * The suggestion box: what a report holds and how it is sent. The server
 * side is public/api/feedback.php, which files it as a GitHub issue.
 */

import { current, toSaved, type SavedGame, type Session } from './session';

export type FeedbackKind = 'bug' | 'idea';

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 5000;
export const NAME_MAX = 60;

/** Where the app is served from, the endpoint sits in api/ next to index.html. */
export const FEEDBACK_URL = './api/feedback.php';

/** The build's short commit hash, set in vite.config.ts. */
export const APP_COMMIT = __APP_COMMIT__;

export interface FeedbackForm {
  kind: FeedbackKind;
  title: string;
  description: string;
  name: string;
  /** Honeypot: hidden in the form, so only bots fill it in. */
  website: string;
  /** Attach the game (bugs only), so it can be replayed. */
  attach: boolean;
}

export interface FeedbackRequest {
  kind: FeedbackKind;
  title: string;
  description: string;
  name: string;
  website: string;
  client: { commit: string; userAgent: string; screen: string };
  /** One line about the game, for the issue. */
  summary?: string;
  attachment?: { game: SavedGame; errors: string[] };
}

export interface ClientInfo {
  commit: string;
  userAgent: string;
  screen: string;
}

/** "3 players (Bot: normal, Bot 2: hard) · round 2, Actions · 84 moves" */
export function gameSummary(session: Session): string {
  const state = current(session);
  const bots = session.config.seats
    .filter((s) => s.bot)
    .map((s) => `${s.name}: ${s.bot!.difficulty}`)
    .join(', ');
  const round = Math.min(state.round.number, 5);
  return [
    `${session.config.seats.length} players${bots ? ` (${bots})` : ''}`,
    `round ${round}, ${state.phase}`,
    `${session.moves.length} moves`,
  ].join(' · ');
}

export function feedbackRequest(
  form: FeedbackForm,
  session: Session | null,
  client: ClientInfo,
  errors: string[],
): FeedbackRequest {
  const request: FeedbackRequest = {
    kind: form.kind,
    title: form.title.trim(),
    description: form.description.trim(),
    name: form.name.trim(),
    website: form.website,
    client,
  };
  if (session) {
    request.summary = gameSummary(session);
    if (form.kind === 'bug' && form.attach) {
      request.attachment = { game: toSaved(session), errors };
    }
  }
  return request;
}

/** Sends the report. Returns the issue number, or throws with a sentence to show. */
export async function sendFeedback(
  request: FeedbackRequest,
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  let response: Response;
  try {
    response = await fetchFn(FEEDBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("Couldn't reach the server. Are you online?");
  }
  const json = (await response.json().catch(() => ({}))) as { issue?: number; error?: string };
  if (!response.ok || typeof json.issue !== 'number') {
    throw new Error(json.error ?? `The server answered ${response.status}. Try again later.`);
  }
  return json.issue;
}

// --- Errors in the browser, attached to bug reports -------------------------------

const MAX_ERRORS = 20;
const errors: string[] = [];

export function recordError(error: unknown): void {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error);
  errors.push(`${new Date().toISOString()} ${message}`.slice(0, 4000));
  if (errors.length > MAX_ERRORS) errors.shift();
}

export function recentErrors(): string[] {
  return [...errors];
}
