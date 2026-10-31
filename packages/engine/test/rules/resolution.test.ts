import { describe, expect, it } from 'vitest';
import { legalMoves, loadComponents, shieldWinners, type GameState } from '../../src';
import {
  edit,
  everyonePasses,
  gameAtFirstTurn,
  placeAssistant,
  play,
  setBonusStrip,
} from '../helpers/game';

// Bonus card types in bonus-cards.json, found by their power.
const types = loadComponents().bonusCards;
const typeIndex = (match: (t: (typeof types)[number]) => boolean) => types.findIndex(match);
const CITY_HALL = typeIndex((t) => t.power.kind === 'single' && t.power.effect === 'cityHall');
const ROYAL_PALACE = typeIndex(
  (t) => t.power.kind === 'single' && t.power.effect === 'royalPalace',
);
const ARCHITECT = typeIndex((t) => t.power.kind === 'single' && t.power.effect === 'architect');
const COURTHOUSE = typeIndex((t) => t.power.kind === 'single' && t.power.effect === 'courthouse');
const CHOICE = typeIndex((t) => t.power.kind === 'choice');
const DOUBLE = typeIndex((t) => t.power.kind === 'double');

function resolving(setup: (draft: GameState) => void, playerCount: 2 | 3 = 3) {
  const start = edit(gameAtFirstTurn(playerCount), (draft) => {
    setBonusStrip(draft, [CITY_HALL, ROYAL_PALACE, ARCHITECT, COURTHOUSE, CHOICE]);
    setup(draft);
  });
  return everyonePasses(start);
}

describe('1. bids (p. 8)', () => {
  it('the highest total bid in a column wins its Bonus card', () => {
    const state = resolving((draft) => {
      placeAssistant(draft, { row: 0, col: 0 }, 1, 2);
      placeAssistant(draft, { row: 1, col: 0 }, 1, 1);
      placeAssistant(draft, { row: 2, col: 0 }, 2, 2);
    });
    // Player 1 bid 3 in column 0 against 2.
    expect(state.pending).toEqual({ kind: 'resolveBonus', player: 1 });
    expect(state.round.bonusWon).toEqual([{ player: 1, card: CITY_HALL, column: 0, tied: false }]);
  });

  it('a tie gives every tied player the central power, but nobody keeps the card', () => {
    const state = resolving((draft) => {
      placeAssistant(draft, { row: 0, col: 1 }, 1, 2);
      placeAssistant(draft, { row: 1, col: 1 }, 2, 2);
    });
    expect(state.round.bonusWon).toEqual([
      { player: 1, card: ROYAL_PALACE, column: 1, tied: true },
      { player: 2, card: ROYAL_PALACE, column: 1, tied: true },
    ]);
    // Q10: a tied card can't be tucked.
    expect(legalMoves(state)).toEqual([{ kind: 'useBonus', card: 0, choice: null }]);
    const used = play(state, { kind: 'useBonus', card: 0, choice: null });
    expect(used.players[1]!.tracks.royalPalace).toBe(1);
  });

  it('a column without bids keeps its card until it is discarded at End of Turn', () => {
    const state = resolving(() => {});
    expect(state.round.bonusWon).toEqual([]);
  });
});

describe('2. new first player (p. 8)', () => {
  it('goes to the most Manneken Pis this round, counting 2 for the Exhibition tile', () => {
    // Player 0 passes first (Exhibition: 2). Player 2 wins two 1-Manneken Pis cards.
    const state = resolving((draft) => {
      placeAssistant(draft, { row: 0, col: 0 }, 2);
      placeAssistant(draft, { row: 0, col: 1 }, 2);
    });
    expect(state.round.mannekenPis).toEqual([2, 0, 2]);
    // Tie between 0 and 2: the first clockwise from the current first player (0) keeps it (Q15).
    expect(state.firstPlayer).toBe(0);
  });

  it('with firstPlayerTieIncludesCurrent off, a tie skips the current first player (Q15)', () => {
    const state = resolving((draft) => {
      draft.rules.firstPlayerTieIncludesCurrent = false;
      placeAssistant(draft, { row: 0, col: 0 }, 2);
      placeAssistant(draft, { row: 0, col: 1 }, 2);
    });
    expect(state.firstPlayer).toBe(2);
  });

  it('with tiedBonusCardsCountMannekenPis on, a tied card counts too (Q16)', () => {
    const state = resolving((draft) => {
      draft.rules.tiedBonusCardsCountMannekenPis = true;
      placeAssistant(draft, { row: 0, col: 0 }, 1);
      placeAssistant(draft, { row: 1, col: 0 }, 2);
    });
    expect(state.round.mannekenPis).toEqual([2, 1, 1]);
  });

  it('a clear winner takes the Manneken Pis pawn', () => {
    const state = resolving((draft) => {
      placeAssistant(draft, { row: 0, col: 0 }, 2);
      placeAssistant(draft, { row: 0, col: 1 }, 2);
      placeAssistant(draft, { row: 0, col: 2 }, 2);
    });
    expect(state.firstPlayer).toBe(2);
  });
});

describe('3. Bonus cards (p. 8–9)', () => {
  it('a card is used for its power or tucked under a row, one card per row per round', () => {
    let state = resolving((draft) => {
      placeAssistant(draft, { row: 0, col: 0 }, 1);
      placeAssistant(draft, { row: 0, col: 2 }, 1);
      placeAssistant(draft, { row: 0, col: 3 }, 1);
    });
    expect(state.pending).toEqual({ kind: 'resolveBonus', player: 1 });
    state = play(state, { kind: 'tuckBonus', card: 0, row: 2 });
    expect(state.players[1]!.tucked[1]).toEqual([CITY_HALL]);
    // Row 2 is used this round.
    expect(legalMoves(state)).not.toContainEqual({ kind: 'tuckBonus', card: 0, row: 2 });
    state = play(state, { kind: 'useBonus', card: 0, choice: null });
    expect(state.players[1]!.tracks.architect).toBe(1);
    state = play(state, { kind: 'useBonus', card: 0, choice: null });
    // Courthouse: one Assistant comes back from the Courthouse.
    expect(state.players[1]!.assistants.courthouse).toBe(1);
  });

  it('a choice card gives one of its two powers; a card without VP symbols can’t be tucked', () => {
    const state = resolving((draft) => placeAssistant(draft, { row: 0, col: 4 }, 1));
    const choice = types[CHOICE]!;
    expect(choice.vpSymbols).toBe(0);
    expect(legalMoves(state).map((m) => m.kind)).toEqual(['useBonus', 'useBonus']);
  });

  it('a double card gives both powers', () => {
    const state = resolving((draft) => {
      setBonusStrip(draft, [DOUBLE, ROYAL_PALACE, ARCHITECT, COURTHOUSE, CHOICE]);
      placeAssistant(draft, { row: 0, col: 0 }, 1);
    });
    const used = play(state, { kind: 'useBonus', card: 0, choice: null });
    const power = types[DOUBLE]!.power;
    if (power.kind !== 'double') throw new Error('expected a double card');
    expect(used.players[1]!.tracks.architect).toBe(2); // "double architect" is the first double card
  });
});

describe('4. shield majorities (p. 9)', () => {
  /** Shield 2-2 is surrounded by spaces (1,1) (1,2) (2,1) (2,2). */
  const around22 = [
    { row: 2, col: 1 },
    { row: 2, col: 2 },
    { row: 3, col: 1 },
    { row: 3, col: 2 },
  ];

  it('rulebook example: the majority scores its City Hall value, ties all score in full', () => {
    // Like the p. 9 example: shields without 4 Assistants don't score, a majority
    // scores the City Hall value, and in a tie every tied player scores in full.
    //   row 2:  . 1 1 2 1        blue = player 1 (City Hall value 2)
    //   row 3:  . 1 2 1 2        orange = player 2 (City Hall value 4)
    // Shield 2-2: blue 3–1. Shields 2-3 and 2-4: 2–2 ties. Shield 2-1: not surrounded.
    const state = edit(gameAtFirstTurn(), (draft) => {
      setBonusStrip(draft, [ROYAL_PALACE, ROYAL_PALACE, ARCHITECT, ARCHITECT, COURTHOUSE]);
      draft.players[1]!.tracks.cityHall = 1; // value 2
      draft.players[2]!.tracks.cityHall = 5; // value 4
      draft.players.forEach((p) => {
        p.assistants.available = 7;
        p.assistants.courthouse = 0;
      });
      const layout: [number, number, number][] = [
        [2, 1, 1],
        [2, 2, 1],
        [2, 3, 2],
        [2, 4, 1],
        [3, 1, 1],
        [3, 2, 2],
        [3, 3, 1],
        [3, 4, 2],
      ];
      for (const [row, col, owner] of layout) placeAssistant(draft, { row, col }, owner);
    });
    expect(shieldWinners(state, { row: 2, col: 2 })).toEqual([1]);
    expect(shieldWinners(state, { row: 2, col: 3 }).sort()).toEqual([1, 2]);
    expect(shieldWinners(state, { row: 2, col: 4 }).sort()).toEqual([1, 2]);
    expect(shieldWinners(state, { row: 2, col: 1 })).toEqual([]);

    const done = finishBonuses(everyonePasses(state));
    expect(done.players[1]!.vp).toBe(3 * 2);
    expect(done.players[2]!.vp).toBe(2 * 4);
    // The table is told, shield by shield, whose VP marker to move.
    const scored = done.events.filter((e) => e.kind === 'shieldScored');
    expect(scored).toHaveLength(5);
    expect(scored).toEqual(
      expect.arrayContaining([
        { kind: 'shieldScored', shield: { row: 2, col: 2 }, player: 1, vp: 2 },
        { kind: 'shieldScored', shield: { row: 2, col: 3 }, player: 1, vp: 2 },
        { kind: 'shieldScored', shield: { row: 2, col: 3 }, player: 2, vp: 4 },
        { kind: 'shieldScored', shield: { row: 2, col: 4 }, player: 1, vp: 2 },
        { kind: 'shieldScored', shield: { row: 2, col: 4 }, player: 2, vp: 4 },
      ]),
    );
  });

  it('2 players: nobody scores if the neutral color wins, but a tie with it scores (p. 12)', () => {
    const state = edit(gameAtFirstTurn(2), (draft) => {
      draft.board.flat().forEach((s) => {
        if (s.assistant?.kind === 'neutral') {
          draft.players[s.assistant.placedBy]!.hasNeutralAssistant = true;
          s.assistant = null;
        }
      });
      placeAssistant(draft, around22[0]!, 'neutral');
      placeAssistant(draft, around22[1]!, 'neutral');
      placeAssistant(draft, around22[2]!, 0);
      placeAssistant(draft, around22[3]!, 1);
    });
    expect(shieldWinners(state, { row: 2, col: 2 })).toEqual([]);

    const tie = edit(state, (draft) => {
      const s = draft.board[around22[1]!.row]![around22[1]!.col]!;
      const placedBy = (s.assistant as { placedBy: number }).placedBy;
      draft.players[placedBy]!.hasNeutralAssistant = true;
      s.assistant = null;
      placeAssistant(draft, around22[1]!, 0);
    });
    expect(shieldWinners(tie, { row: 2, col: 2 })).toEqual([0]);
  });
});

describe('5. Brussels majority (p. 9)', () => {
  it('the players with the most Assistants there each send one to the Courthouse', () => {
    let state = gameAtFirstTurn();
    state = play(state, { kind: 'takeBrusselsAction', action: 'market' }); // 0: 1
    state = play(state, { kind: 'takeBrusselsAction', action: 'market' }); // 1: 2
    state = play(state, { kind: 'takeBrusselsAction', action: 'stockExchange' }); // 2: 1
    state = play(state, { kind: 'takeBrusselsAction', action: 'stockExchange' }); // 0: 2 → 3
    state = play(state, { kind: 'takeBrusselsAction', action: 'park' }); // 1: 1 → 3
    state = play(state, { kind: 'chooseParkAction', action: 'materials' }, { kind: 'skipAction' });
    const done = finishBonuses(everyonePasses(state));
    expect(done.players.map((p) => p.assistants.courthouse)).toEqual([3, 3, 2]);
    expect(done.events).toContainEqual({ kind: 'brusselsMajority', players: [0, 1] });
  });

  it('nobody goes to the Courthouse when nobody used the Brussels board (Q11)', () => {
    const done = finishBonuses(everyonePasses(gameAtFirstTurn()));
    expect(done.players.map((p) => p.assistants.courthouse)).toEqual([2, 2, 2]);
    expect(done.events.some((e) => e.kind === 'brusselsMajority')).toBe(false);
  });
});

describe('D. End of Turn (p. 10)', () => {
  it('returns Assistants, turns Public Figures upright and starts round 2', () => {
    let state = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.publicFigures[0]!.rotated = true;
    });
    state = play(state, { kind: 'takeBrusselsAction', action: 'market' });
    state = play(
      state,
      { kind: 'placeAssistant', space: { row: 0, col: 0 }, bid: 1 },
      { kind: 'skipAction' },
    );
    const discardBefore = state.royalTheater.discard.length;
    const next = finishBonuses(everyonePasses(state));
    expect(next.round.number).toBe(2);
    expect(next.pending).toMatchObject({ kind: 'chance', event: { kind: 'drawPublicFigure' } });
    expect(next.board.flat().every((s) => s.assistant === null)).toBe(true);
    expect(next.players[0]!.publicFigures[0]!.rotated).toBe(false);
    expect(next.players[0]!.assistants.artNouveau + next.players[0]!.assistants.brussels).toBe(0);
    expect(next.royalTheater.discard.length).toBe(discardBefore + 1);
    expect(next.stockExchange.discard).toHaveLength(1);
  });
});

/** Use every won Bonus card for its power (first option) until resolution is done. */
function finishBonuses(state: GameState): GameState {
  let current = state;
  while (current.pending?.kind === 'resolveBonus') {
    const use = legalMoves(current).find((m) => m.kind === 'useBonus')!;
    current = play(current, use);
  }
  return current;
}
