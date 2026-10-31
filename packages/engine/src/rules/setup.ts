/**
 * Setup (rulebook p. 2–3, 2-player changes on p. 12).
 *
 * newGame() lays out everything that is fixed. The random parts (strip
 * order, compass tiles, the Royal Theater display, starting works, Bonus
 * cards) are steps that ask the ChanceOracle, so the table app can ask the
 * players what they laid out instead.
 */

import {
  ASSISTANTS_PER_PLAYER,
  ASSISTANTS_STARTING_IN_COURTHOUSE,
  JOKER_SUPPLY,
  NOBLE_MATERIAL_SUPPLY,
  ROYAL_THEATER_DISPLAY_SIZE,
  STARTING_BF_BY_SEAT,
} from '../data/rulebook';
import { BRUSSELS_ACTIONS, type PlayerCount } from '../data/types';
import { BOARD_SIZE } from '../state/coords';
import type { GameState, PlayerState, PublicFigureCard, Step } from '../state/types';
import { components, pushSteps } from './helpers';
import { DEFAULT_RULES, type RuleOptions } from './options';
import { advance } from './steps';

export interface NewGameOptions {
  playerCount: PlayerCount;
  rules?: Partial<RuleOptions>;
}

export function newGame(options: NewGameOptions): GameState {
  const data = components();
  const { playerCount } = options;

  const deck: PublicFigureCard[] = data.publicFigures.deck.flatMap(({ figure, costs }) =>
    costs.map((cost) => ({ figure, cost })),
  );

  const players = Array.from({ length: playerCount }, (_, seat) => newPlayer(seat, playerCount));

  const state: GameState = {
    rules: { ...DEFAULT_RULES, ...options.rules },
    playerCount,
    phase: 'setup',
    firstPlayer: 0,
    players,
    board: [],
    stripOrder: [],
    bonusStrip: Array.from({ length: BOARD_SIZE }, () => null),
    bonusDeck: data.bonusCards.map((type) => type.copies),
    bonusDiscard: data.bonusCards.map(() => 0),
    workshopCursor: { ...data.workshop.cursorStart },
    shop: [[], []],
    salesMade: 0,
    workStacks: { color: { ...data.worksOfArt.colorTiles }, black: data.worksOfArt.blackTiles },
    compass: { tiles: [], needles: [...data.compass.needleStart] },
    royalTheater: {
      display: Array.from({ length: ROYAL_THEATER_DISPLAY_SIZE }, () => null),
      deck,
      discard: [],
      boxed: [],
    },
    supply: { nobles: { ...NOBLE_MATERIAL_SUPPLY }, jokers: JOKER_SUPPLY },
    stockExchange: { deck: data.stockExchangeCards.map((_, i) => i), discard: [] },
    round: {
      number: 1,
      stockExchangeCard: null,
      shield: null,
      area: null,
      lastActor: null,
      passed: [],
      brussels: Object.fromEntries(BRUSSELS_ACTIONS.map((a) => [a, []])) as never,
      bonusWon: [],
      mannekenPis: players.map(() => 0),
      tuckedRows: players.map(() => []),
    },
    steps: [],
    pending: null,
    final: null,
  };

  pushSteps(state, [
    { kind: 'arrangeStrips' },
    { kind: 'placeCompassTiles' },
    { kind: 'fillRoyalTheater' },
    ...players.map((_, p): Step => ({ kind: 'drawStartingWork', player: p })),
    { kind: 'dealBonusCards' },
    { kind: 'startRound' },
  ]);
  advance(state);
  return state;
}

function newPlayer(seat: number, playerCount: PlayerCount): PlayerState {
  const data = components();
  return {
    bf: STARTING_BF_BY_SEAT[seat] ?? 0,
    vp: 0,
    works: { blue: 0, pink: 0, yellow: 0, green: 0, black: 0 },
    nobles: { wood: 0, stone: 0, iron: 0 },
    jokers: 0,
    // Every player starts with a Georges Brugmann card (p. 3, Q12).
    publicFigures: [
      { figure: 'georgesBrugmann', cost: data.publicFigures.startingBrugmannCost, rotated: false },
    ],
    exhibitions: [],
    assistants: {
      available: ASSISTANTS_PER_PLAYER - ASSISTANTS_STARTING_IN_COURTHOUSE,
      artNouveau: 0,
      brussels: 0,
      courthouse: ASSISTANTS_STARTING_IN_COURTHOUSE,
    },
    hasNeutralAssistant: playerCount === 2,
    buildingsBuilt: 0,
    tracks: { cityHall: 0, royalPalace: 0, architect: 0 },
    tucked: [[], [], [], []],
  };
}
