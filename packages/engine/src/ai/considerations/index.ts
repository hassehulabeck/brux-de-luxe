/**
 * Every consideration the utility bot adds up (PLAN.md 5.2), by name. The
 * weight of each one is in the weight set (`considerations`).
 */

import type { ConsiderationName } from '../weights';
import { areaChoice } from './area-choice';
import { auction } from './auction';
import { buildingPlacement } from './building-placement';
import type { Consideration } from './context';
import { courthouseRisk } from './courthouse-risk';
import { denial } from './denial';
import { gift } from './gift';
import { mannekenPis } from './manneken-pis';
import { projectionGain } from './projection-gain';
import { shieldMajority } from './shield-majority';

export type { Consideration, MoveContext } from './context';

export const CONSIDERATIONS: Record<ConsiderationName, Consideration> = {
  projectionGain,
  auction,
  shieldMajority,
  gift,
  courthouseRisk,
  mannekenPis,
  denial,
  buildingPlacement,
  areaChoice,
};
