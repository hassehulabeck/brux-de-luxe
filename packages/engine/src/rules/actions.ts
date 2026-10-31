/**
 * The Art Nouveau actions (rulebook p. 5–7), their secondary actions
 * (Appendix 2, p. 11) and the Brussels actions (p. 7).
 */

import {
  BRUSSELS_DOUBLE_AVAILABILITY_FROM_PLAYERS,
  MARKET_JOKERS,
  MATERIALS_ACTION_CUBES,
  MATERIALS_SECONDARY_CUBES,
} from '../data/rulebook';
import {
  NOBLE_MATERIALS,
  type ArtNouveauAction,
  type BrusselsAction,
  type NobleMaterial,
  type WorkOfArtColor,
  WORK_COLORS,
} from '../data/types';
import type { GameState, PlayerIndex } from '../state/types';
import { canAfford, constructionPayments, needleTiles } from './compass';
import {
  allSpaces,
  assertNever,
  buildingsOnBoard,
  gainJokers,
  nextBuildingRow,
  player,
  spaceAt,
  trackValue,
  workCount,
} from './helpers';
import type { PlayerMove } from './moves';
import { affordableDisplayPositions } from './public-figures';
import { currentStockExchangeCard } from './stock-exchange';
import { colorStackSize, rebuildStacksIfEmpty, visibleShopColors } from './works';

/**
 * Whether performing the action can lead anywhere. Placing an Assistant is
 * always allowed (just to join the auction, p. 5), but performing a Sale with
 * nothing to sell, for example, is not offered.
 */
export function canPerform(
  state: GameState,
  owner: PlayerIndex,
  action: ArtNouveauAction,
): boolean {
  switch (action) {
    case 'workshop':
      return true;
    case 'sale':
      return sellableColors(state, owner).length > 0;
    case 'royalTheater':
      return affordableDisplayPositions(state, owner).length > 0;
    case 'materials':
      return true;
    case 'construction':
      return canConstruct(state, owner);
    default:
      return assertNever(action);
  }
}

/** Start performing an action: set the first decision, or do it at once. Works on a draft. */
export function startAction(draft: GameState, owner: PlayerIndex, action: ArtNouveauAction): void {
  switch (action) {
    case 'workshop': {
      rebuildStacksIfEmpty(draft);
      const count = Math.min(1 + player(draft, owner).exhibitions.length, colorStackSize(draft));
      if (count > 0) {
        draft.pending = {
          kind: 'chance',
          event: { kind: 'drawWorks', player: owner, count, reason: 'workshop' },
        };
      }
      return;
    }
    case 'sale':
      draft.pending = { kind: 'moveCursor', player: owner };
      return;
    case 'royalTheater':
      draft.pending = { kind: 'takePublicFigure', player: owner };
      return;
    case 'materials':
      takeMaterialsDecision(draft, owner, MATERIALS_ACTION_CUBES);
      return;
    case 'construction':
      draft.pending = { kind: 'payConstruction', player: owner };
      return;
    default:
      assertNever(action);
  }
}

/** The building owner's secondary action (Appendix 2). Works on a draft. */
export function secondaryAction(draft: GameState, owner: PlayerIndex, action: ArtNouveauAction) {
  const p = player(draft, owner);
  switch (action) {
    case 'workshop':
      // Take a black Work of Art.
      rebuildStacksIfEmpty(draft);
      if (draft.workStacks.black > 0) {
        draft.workStacks.black--;
        p.works.black++;
      }
      return;
    case 'sale':
      // 1 VP per work you have, black included.
      p.vp += workCount(p);
      return;
    case 'royalTheater':
      // Activate one upright Public Figure.
      draft.steps.push({ kind: 'activatePublicFigures', player: owner, remaining: 1 });
      return;
    case 'materials':
      takeMaterialsDecision(draft, owner, MATERIALS_SECONDARY_CUBES);
      return;
    case 'construction':
      // 1 VP per building you already have on the Art Nouveau board.
      p.vp += buildingsOnBoard(draft, owner);
      return;
    default:
      assertNever(action);
  }
}

// --- Sale ----------------------------------------------------------------------

/** Colors the player has that are not visible in the shop (p. 5). */
export function sellableColors(state: GameState, owner: PlayerIndex): WorkOfArtColor[] {
  const p = player(state, owner);
  const visible = visibleShopColors(state);
  return [...WORK_COLORS, 'black' as const].filter(
    (color) => p.works[color] > 0 && !visible.includes(color),
  );
}

// --- Materials -------------------------------------------------------------------

function takeMaterialsDecision(draft: GameState, owner: PlayerIndex, wanted: number): void {
  const inSupply = NOBLE_MATERIALS.reduce((sum, m) => sum + draft.supply.nobles[m], 0);
  const count = Math.min(wanted, inSupply);
  if (count > 0) draft.pending = { kind: 'takeMaterials', player: owner, count };
}

/** Every combination of `count` Noble Materials the supply can give (order doesn't matter). */
export function materialChoices(state: GameState, count: number): PlayerMove[] {
  const result: PlayerMove[] = [];
  const pick = (start: number, chosen: NobleMaterial[]) => {
    if (chosen.length === count) {
      result.push({ kind: 'takeMaterials', materials: chosen });
      return;
    }
    NOBLE_MATERIALS.forEach((material, i) => {
      if (i < start) return;
      const already = chosen.filter((m) => m === material).length;
      if (state.supply.nobles[material] > already) pick(i, [...chosen, material]);
    });
  };
  pick(0, []);
  return result;
}

// --- Construction ----------------------------------------------------------------

export function affordablePayments(state: GameState, owner: PlayerIndex) {
  const row = nextBuildingRow(player(state, owner));
  if (!row) return [];
  return constructionPayments(needleTiles(state), row.constructionUnits).filter((payment) =>
    canAfford(player(state, owner), payment),
  );
}

/** Empty action spaces for a Building: no Building and no Assistant, anywhere on the board. */
export function buildingSpaces(state: GameState) {
  return allSpaces().filter((space) => {
    const s = spaceAt(state, space);
    return s.building === null && s.assistant === null;
  });
}

function canConstruct(state: GameState, owner: PlayerIndex): boolean {
  return affordablePayments(state, owner).length > 0 && buildingSpaces(state).length > 0;
}

// --- Brussels board (p. 7) ---------------------------------------------------------

/**
 * Assistants needed for the next use of a Brussels action this round: 1, then
 * 2, 3, ... With 4–5 players each cost level is available twice.
 */
export function brusselsCost(state: GameState, action: BrusselsAction): number {
  const uses = state.round.brussels[action].length;
  const perLevel = state.playerCount >= BRUSSELS_DOUBLE_AVAILABILITY_FROM_PLAYERS ? 2 : 1;
  return Math.floor(uses / perLevel) + 1;
}

/** Perform a Brussels action after the Assistants are placed. Works on a draft. */
export function startBrusselsAction(draft: GameState, owner: PlayerIndex, action: BrusselsAction) {
  switch (action) {
    case 'market':
      gainJokers(draft, owner, MARKET_JOKERS);
      return;
    case 'stockExchange':
      player(draft, owner).bf += currentStockExchangeCard(draft).bf;
      return;
    case 'park':
      draft.pending = { kind: 'chooseParkAction', player: owner };
      return;
    case 'grandPlaza':
      draft.steps.push({
        kind: 'activatePublicFigures',
        player: owner,
        remaining: trackValue(draft, owner, 'royalPalace'),
      });
      return;
    default:
      assertNever(action);
  }
}
