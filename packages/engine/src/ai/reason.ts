/**
 * Player-facing reasons for the utility bot's moves: what the move does,
 * what the bot gains, and what else made it attractive.
 *
 *   "Sale on row 2, column 3, bid 1 BF: +6 BF, +3 VP (Art Dealer)."
 */

import { NOBLE_MATERIALS } from '../data/types';
import { nobleCount, workCount } from '../rules/helpers';
import type { GameState, PlayerIndex, PlayerState } from '../state/types';
import { describeMove } from './explain';
import type { EvaluatedMove } from './search';
import type { ConsiderationName } from './weights';

/** Only considerations worth at least this many VP are mentioned. */
const NOTE_THRESHOLD = 1;

const NOTES: Partial<Record<ConsiderationName, (value: number) => string | null>> = {
  auction: (v) => (v > 0 ? 'bids for the Bonus card' : null),
  shieldMajority: (v) => (v > 0 ? 'goes for a shield majority' : null),
  mannekenPis: (v) => (v > 0 ? 'aims to be first player' : null),
  denial: (v) => (v > 0 ? "spoils an opponent's plans" : null),
  buildingPlacement: (v) => (v > 0 ? 'a Building that will pay' : null),
  areaChoice: (v) => (v > 0 ? 'keeps its Buildings in play' : 'keeps opponents out of play'),
  gift: (v) => (v < 0 ? 'even with a gift to an opponent' : null),
  courthouseRisk: (v) => (v < 0 ? 'risking the Courthouse' : null),
};

export function utilityReason(
  view: GameState,
  evaluated: EvaluatedMove,
  me: PlayerIndex,
  plan: string,
): string {
  const gains = describeGains(view.players[me]!, evaluated.after.players[me]!);
  const notes = (Object.keys(NOTES) as ConsiderationName[])
    .filter((name) => Math.abs(evaluated.terms[name]) >= NOTE_THRESHOLD)
    .sort((a, b) => Math.abs(evaluated.terms[b]) - Math.abs(evaluated.terms[a]))
    .slice(0, 2)
    .map((name) => NOTES[name]!(evaluated.terms[name]))
    .filter((note): note is string => note !== null);
  const details = [...gains, ...notes];
  return `${describeMove(view, evaluated.move)}${details.length ? `: ${details.join(', ')}` : ''} (${plan}).`;
}

/** What changed for the player, in a few words each. */
export function describeGains(before: PlayerState, after: PlayerState): string[] {
  const gains: string[] = [];
  const add = (change: number, unit: string, plural = `${unit}s`) => {
    if (change !== 0) gains.push(`${signed(change)} ${Math.abs(change) === 1 ? unit : plural}`);
  };
  add(after.vp - before.vp, 'VP', 'VP');
  add(after.bf - before.bf, 'BF', 'BF');
  add(workCount(after) - workCount(before), 'work');
  const nobles = nobleCount(after) - nobleCount(before);
  if (nobles > 0) {
    const kinds = NOBLE_MATERIALS.flatMap((m) =>
      after.nobles[m] > before.nobles[m] ? [`+${after.nobles[m] - before.nobles[m]} ${m}`] : [],
    );
    gains.push(...kinds);
  } else {
    add(nobles, 'material');
  }
  add(after.jokers - before.jokers, 'Joker');
  if (after.buildingsBuilt > before.buildingsBuilt) gains.push('a new Building');
  if (after.tracks.cityHall > before.tracks.cityHall) gains.push('City Hall +1');
  if (after.tracks.royalPalace > before.tracks.royalPalace) gains.push('Royal Palace +1');
  if (after.tracks.architect > before.tracks.architect) gains.push('Architect +1');
  add(after.publicFigures.length - before.publicFigures.length, 'Public Figure');
  if (after.exhibitions.length > before.exhibitions.length) gains.push('the Exhibition tile');
  if (after.assistants.courthouse < before.assistants.courthouse) {
    gains.push('an Assistant back from the Courthouse');
  }
  return gains;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
