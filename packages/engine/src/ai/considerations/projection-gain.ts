/**
 * 1–2. Projection gain: how much the move (with its follow-ups) changes the
 * bot's projected final score, weighted by the bot's plan. This covers the
 * immediate VP and BF as well as resources for later.
 */

import { project, timingAfter } from '../projection';
import type { Consideration } from './context';

export const projectionGain: Consideration = ({ before, after, player, weights, sources }) =>
  project(after, player, weights.projection, sources, timingAfter(before, after, player)).total -
  project(before, player, weights.projection, sources).total;
