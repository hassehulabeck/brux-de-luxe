/**
 * The shape of a weight set for the utility bot. The numbers themselves live
 * in JSON (default.json), so they can be tuned without touching the logic.
 *
 * These are the bot's opinions about what things are worth, in VP. They are
 * not component data: nothing here is printed on the game.
 */

import type { ArtNouveauAction, PublicFigureId } from '../../data/types';

/**
 * Where future value comes from. The projection splits its estimate into
 * these sources, and each plan weighs them differently.
 */
export const VALUE_SOURCES = [
  'money',
  'works',
  'buildings',
  'cityHall',
  'figures',
  'assistants',
] as const;
export type ValueSource = (typeof VALUE_SOURCES)[number];
export type SourceWeights = Record<ValueSource, number>;

export const PLAN_NAMES = ['builder', 'artDealer', 'politician', 'opportunist'] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

export const CONSIDERATION_NAMES = [
  'projectionGain',
  'auction',
  'shieldMajority',
  'gift',
  'courthouseRisk',
  'mannekenPis',
  'denial',
  'buildingPlacement',
  'areaChoice',
] as const;
export type ConsiderationName = (typeof CONSIDERATION_NAMES)[number];

/** What resources are still worth during the game, on top of their end-game value. */
export interface ProjectionValues {
  /** VP per BF, while there is still a round to spend it in. */
  moneyInGame: number;
  /** VP per Work of Art (a future Sale), while there is still a round to sell it in. */
  workInGame: number;
  /** VP per Work of Art color per round left (pass income). */
  workColorPerRound: number;
  /** VP per Exhibition tile per round left (an extra Workshop draw). */
  exhibitionPerRound: number;
  /** VP per Assistant outside the Courthouse per round left. */
  assistantPerRound: number;
  /** VP per Assistant still available in the current Action phase (the actions left this round). */
  assistantThisRound: number;
  /** Shield majorities won per round, times the City Hall value. */
  shieldWinsPerRound: number;
  /** Share of the best Public Figures activated per round (Grand Plaza, Royal Theater secondaries). */
  figureActivationsPerRound: number;
  /** VP for activating each Public Figure once. */
  figureActivation: Record<PublicFigureId, number>;
  /** Most Buildings the bot expects to build in one round. */
  buildsPerRound: number;
  /** How sure the bot is that the Buildings its resources allow will really be built (0–1). */
  buildConfidence: number;
  /** BF counted as one construction unit (the 3 BF compass tile is not always there). */
  bfPerConstructionUnit: number;
  /** How much a Noble Material the compass needles don't point at counts as a construction unit (0–1). */
  offNeedleMaterialShare: number;
  /** Share of future Buildings expected to be built without Jokers (5 VP each). */
  noJokerShare: number;
}

/** A plan's fitness: bias + Σ weight × feature of the bot's own position. */
export interface FitnessWeights {
  bias: number;
  materials: number;
  buildings: number;
  architect: number;
  works: number;
  workColors: number;
  exhibitions: number;
  cityHall: number;
  royalPalace: number;
  figures: number;
  money: number;
}

export interface UtilityWeights {
  projection: ProjectionValues;
  /** Each plan's multiplier on each value source. */
  plans: Record<PlanName, SourceWeights>;
  fitness: Record<PlanName, FitnessWeights>;
  planning: {
    /** Softmax temperature of the plan blend: lower means one plan dominates. */
    temperature: number;
    /** Fitness bonus for the plan that led last round. */
    inertia: number;
    /** How much the opponents' fitness for the same plan lowers it ("contested"). */
    contest: number;
  };
  considerations: Record<ConsiderationName, number>;
  auction: {
    /** Chance that each opponent who can still bid outbids a lead of 1 BF. */
    outbidRisk: number;
    /** Chance that a tie holds until the end of the round. */
    tieHold: number;
  };
  shields: {
    /** Chance that each empty space around a shield is filled this round. */
    completion: number;
    /** How much an opponent's lost shield VP counts for the bot. */
    denial: number;
  };
  courthouse: {
    /** Chance of losing an Assistant to the Courthouse when leading, tied or behind on the Brussels board. */
    leadRisk: number;
    tieRisk: number;
    behindRisk: number;
  };
  mannekenPis: {
    /** VP of being first player in rounds 2–5 (shield choice, first pick). */
    firstPlayerValue: number;
  };
  denial: {
    /** VP of an opponent losing (or gaining) the means to build with the current needles. */
    constructionAccess: number;
  };
  buildings: {
    /** Expected VP per round for a Building on a space with this action, when it is in the area. */
    secondaryIncome: Record<ArtNouveauAction, number>;
    /** How much an opponent's Building in the chosen area counts against the bot. */
    opponentShare: number;
  };
}

export const DIFFICULTY_NAMES = ['easy', 'normal', 'hard', 'brutal'] as const;
export type DifficultyName = (typeof DIFFICULTY_NAMES)[number];

export interface Difficulty {
  /** Sampling temperature in VP. 0 always plays the best move. */
  temperature: number;
  /** Sample among this many of the best moves. */
  topK: number;
}
