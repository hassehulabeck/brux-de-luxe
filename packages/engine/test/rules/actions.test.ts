import { describe, expect, it } from 'vitest';
import { legalMoves, type GameState } from '../../src';
import { edit, freeSpace, gameAtFirstTurn, kinds, play } from '../helpers/game';

const NO_WORKS = { blue: 0, pink: 0, yellow: 0, green: 0, black: 0 };

describe('Art Nouveau placement (p. 5)', () => {
  it('needs a bid of at least 1 BF and at most all your money', () => {
    const state = gameAtFirstTurn();
    const space = freeSpace(state, 'materials');
    const bids = legalMoves(state)
      .filter(
        (m) =>
          m.kind === 'placeAssistant' && m.space.row === space.row && m.space.col === space.col,
      )
      .map((m) => (m.kind === 'placeAssistant' ? m.bid : 0));
    expect(bids).toEqual([1, 2, 3, 4, 5]);
  });

  it('pays the bid and lets the player skip the action (just joining the auction)', () => {
    const state = gameAtFirstTurn();
    const placed = play(state, {
      kind: 'placeAssistant',
      space: freeSpace(state, 'materials'),
      bid: 3,
    });
    expect(placed.players[0]!.bf).toBe(2);
    expect(placed.players[0]!.assistants.available).toBe(4);
    expect(legalMoves(placed)).toEqual([{ kind: 'performAction' }, { kind: 'skipAction' }]);
    const skipped = play(placed, { kind: 'skipAction' });
    expect(skipped.pending).toEqual({ kind: 'turn', player: 1 });
  });

  it('allows only one Assistant per action space', () => {
    const state = gameAtFirstTurn();
    const space = freeSpace(state, 'materials');
    const next = play(state, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'skipAction' });
    expect(
      legalMoves(next).some(
        (m) =>
          m.kind === 'placeAssistant' && m.space.row === space.row && m.space.col === space.col,
      ),
    ).toBe(false);
  });
});

describe('Workshop action (p. 5)', () => {
  it('draws 1 + 1 per Exhibition tile, keeps one and returns the rest', () => {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.exhibitions = [1893, 1894];
    });
    const drawing = play(
      start,
      { kind: 'placeAssistant', space: freeSpace(start, 'workshop'), bid: 1 },
      { kind: 'performAction' },
    );
    expect(drawing.pending).toMatchObject({
      kind: 'chance',
      event: { kind: 'drawWorks', count: 3 },
    });
    const stackBefore = { ...drawing.workStacks.color };
    const drawn = play(drawing, { kind: 'revealWorks', colors: ['blue', 'blue', 'green'] });
    expect(legalMoves(drawn)).toEqual([
      { kind: 'keepWork', color: 'blue' },
      { kind: 'keepWork', color: 'green' },
    ]);
    const kept = play(drawn, { kind: 'keepWork', color: 'green' });
    expect(kept.players[0]!.works.green).toBe(start.players[0]!.works.green + 1);
    expect(kept.workStacks.color.blue).toBe(stackBefore.blue);
    expect(kept.workStacks.color.green).toBe(stackBefore.green - 1);
  });
});

describe('Royal Theater action (p. 6)', () => {
  function readyForTheater(change: (draft: GameState) => void = () => {}) {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.bf = 10;
      // Put the dealt display back into the deck, then lay out a known display from it.
      draft.royalTheater.deck.push(...draft.royalTheater.display.filter((c) => c !== null));
      draft.royalTheater.display = [
        { figure: 'mauriceMaeterlinck', cost: 5 },
        { figure: 'charlesBuls', cost: 3 },
        { figure: 'edouardEmpain', cost: 2 },
        { figure: 'princeAlbert', cost: 3 },
      ];
      for (const card of draft.royalTheater.display) {
        const i = draft.royalTheater.deck.findIndex((c) => c.figure === card!.figure);
        draft.royalTheater.deck.splice(i, 1);
      }
      change(draft);
    });
    return play(
      start,
      { kind: 'placeAssistant', space: freeSpace(start, 'royalTheater'), bid: 1 },
      { kind: 'performAction' },
    );
  }

  it('costs 0, 1, 2 or 3 BF from the right, and the effect happens at once', () => {
    const state = readyForTheater();
    expect(legalMoves(state)).toHaveLength(4);
    const taken = play(state, { kind: 'takePublicFigure', position: 3 });
    expect(taken.players[0]!.bf).toBe(10 - 1 - 3);
    expect(taken.players[0]!.tracks.royalPalace).toBe(1); // Prince Albert
    expect(taken.pending).toMatchObject({ kind: 'keepPublicFigure' });
  });

  it('shifts the display right and refills the 3 BF space from the deck', () => {
    const state = readyForTheater();
    const taken = play(
      state,
      { kind: 'takePublicFigure', position: 1 },
      { kind: 'discardPublicFigure' },
    );
    expect(taken.royalTheater.display.slice(0, 3)).toEqual([
      { figure: 'mauriceMaeterlinck', cost: 5 },
      { figure: 'edouardEmpain', cost: 2 },
      { figure: 'princeAlbert', cost: 3 },
    ]);
    expect(taken.pending).toMatchObject({ kind: 'chance', event: { kind: 'drawPublicFigure' } });
  });

  it('keeps the card rotated, and never two identical cards', () => {
    const state = readyForTheater();
    const kept = play(
      state,
      { kind: 'takePublicFigure', position: 0 },
      { kind: 'keepPublicFigure' },
    );
    expect(kept.players[0]!.vp).toBe(5);
    expect(kept.players[0]!.publicFigures).toContainEqual({
      figure: 'mauriceMaeterlinck',
      cost: 5,
      rotated: true,
    });

    const hasBuls = readyForTheater((draft) => {
      const i = draft.royalTheater.deck.findIndex((c) => c.figure === 'charlesBuls');
      const [buls] = draft.royalTheater.deck.splice(i, 1);
      draft.players[0]!.publicFigures.push({ ...buls!, rotated: false });
    });
    const again = play(hasBuls, { kind: 'takePublicFigure', position: 1 });
    // No keep decision: the second Charles Buls is discarded after its effect.
    expect(again.pending?.kind).not.toBe('keepPublicFigure');
    expect(again.royalTheater.discard).toContainEqual({ figure: 'charlesBuls', cost: 3 });
  });
});

describe('Materials action (p. 6)', () => {
  it('takes 2 Noble Materials of your choice, limited by the supply', () => {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.supply.nobles = { wood: 1, stone: 0, iron: 10 };
      draft.players[1]!.nobles = { wood: 9, stone: 10, iron: 0 };
    });
    const state = play(
      start,
      { kind: 'placeAssistant', space: freeSpace(start, 'materials'), bid: 1 },
      { kind: 'performAction' },
    );
    expect(legalMoves(state)).toEqual([
      { kind: 'takeMaterials', materials: ['wood', 'iron'] },
      { kind: 'takeMaterials', materials: ['iron', 'iron'] },
    ]);
  });
});

describe('secondary actions (Appendix 2, p. 11)', () => {
  /** Player 1 owns a Building on a space with this action; player 0 uses it. */
  function useOpponentsBuilding(
    action: 'workshop' | 'sale' | 'royalTheater' | 'materials' | 'construction',
  ) {
    const base = gameAtFirstTurn();
    const space = freeSpace(base, action);
    const start = edit(base, (draft) => {
      draft.board[space.row]![space.col]!.building = 1;
      draft.players[1]!.buildingsBuilt = 1;
    });
    return { start, space };
  }

  it('Workshop: the owner takes a black Work of Art', () => {
    const { start, space } = useOpponentsBuilding('workshop');
    const after = play(start, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'skipAction' });
    expect(after.players[1]!.works.black).toBe(1);
    expect(after.events).toEqual([
      { kind: 'secondaryAction', owner: 1, action: 'workshop', vp: 0, blackWork: true },
    ]);
  });

  it('Sale: the owner gains 1 VP per work', () => {
    const { start, space } = useOpponentsBuilding('sale');
    const after = play(start, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'skipAction' });
    expect(after.players[1]!.vp).toBe(1);
    // The owner may not be at the board: the table is told to move the VP marker.
    expect(after.events).toEqual([
      { kind: 'secondaryAction', owner: 1, action: 'sale', vp: 1, blackWork: false },
    ]);
  });

  it('Materials: the owner takes 1 Noble Material, after the main action', () => {
    const { start, space } = useOpponentsBuilding('materials');
    const main = play(start, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'performAction' });
    expect(main.pending).toEqual({ kind: 'takeMaterials', player: 0, count: 2 });
    expect(main.events).toEqual([]);
    const secondary = play(main, { kind: 'takeMaterials', materials: ['wood', 'wood'] });
    expect(secondary.pending).toEqual({ kind: 'takeMaterials', player: 1, count: 1 });
    expect(secondary.events).toMatchObject([{ kind: 'secondaryAction', owner: 1 }]);
  });

  it('Royal Theater: the owner may activate one upright Public Figure', () => {
    const { start, space } = useOpponentsBuilding('royalTheater');
    const after = play(start, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'skipAction' });
    expect(after.pending).toEqual({ kind: 'activatePublicFigure', player: 1, remaining: 1 });
    const used = play(after, { kind: 'activatePublicFigure', index: 0 });
    expect(used.players[1]!.bf).toBe(6 + 5); // Georges Brugmann
    expect(used.players[1]!.publicFigures[0]!.rotated).toBe(true);
  });

  it('Construction: the owner gains 1 VP per Building on the board', () => {
    const { start, space } = useOpponentsBuilding('construction');
    const after = play(start, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'skipAction' });
    expect(after.players[1]!.vp).toBe(1);
  });

  it('does not trigger on a skipped action when secondaryActionWhenPrimarySkipped is off (Q17)', () => {
    const { start, space } = useOpponentsBuilding('sale');
    const strict = edit(start, (draft) => {
      draft.rules.secondaryActionWhenPrimarySkipped = false;
    });
    const after = play(strict, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'skipAction' });
    expect(after.players[1]!.vp).toBe(0);
    expect(after.events).toEqual([]);
  });

  it('does not trigger on your own Building', () => {
    const base = gameAtFirstTurn();
    const space = freeSpace(base, 'sale');
    const start = edit(base, (draft) => {
      draft.board[space.row]![space.col]!.building = 0;
      draft.players[0]!.buildingsBuilt = 1;
    });
    const after = play(start, { kind: 'placeAssistant', space, bid: 1 }, { kind: 'skipAction' });
    expect(after.players[0]!.vp).toBe(0);
  });
});

describe('Brussels actions (p. 7)', () => {
  it('cost 1, then 2, then 3 Assistants with 2–3 players', () => {
    let state = edit(gameAtFirstTurn(3), (draft) => {
      draft.players.forEach((p) => (p.assistants.available = 5));
    });
    state = play(state, { kind: 'takeBrusselsAction', action: 'market' });
    state = play(state, { kind: 'takeBrusselsAction', action: 'market' });
    state = play(state, { kind: 'takeBrusselsAction', action: 'market' });
    expect(state.round.brussels.market.map((u) => u.assistants)).toEqual([1, 2, 3]);
  });

  it('are available twice per cost with 4–5 players', () => {
    let state = gameAtFirstTurn(4);
    for (let i = 0; i < 4; i++)
      state = play(state, { kind: 'takeBrusselsAction', action: 'market' });
    expect(state.round.brussels.market.map((u) => u.assistants)).toEqual([1, 1, 2, 2]);
  });

  it('Market gives 3 Jokers, limited by the supply', () => {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.supply.jokers = 2;
      draft.players[1]!.jokers = 13;
    });
    const after = play(start, { kind: 'takeBrusselsAction', action: 'market' });
    expect(after.players[0]!.jokers).toBe(2);
  });

  it('Stock Exchange gives the BF on this round’s card', () => {
    const state = gameAtFirstTurn();
    const after = play(state, { kind: 'takeBrusselsAction', action: 'stockExchange' });
    expect(after.players[0]!.bf).toBeGreaterThan(5);
  });

  it('Park gives any Art Nouveau action, without a space, auction or secondary action', () => {
    const state = gameAtFirstTurn();
    const park = play(state, { kind: 'takeBrusselsAction', action: 'park' });
    expect(legalMoves(park)).toHaveLength(5);
    const chosen = play(park, { kind: 'chooseParkAction', action: 'materials' });
    expect(chosen.pending).toEqual({
      kind: 'performOrSkip',
      player: 0,
      action: 'materials',
      space: null,
    });
  });

  it('Grand Plaza activates upright Public Figures up to the Royal Palace value', () => {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.tracks.royalPalace = 1; // value 2
      for (const figure of ['charlesBuls', 'princeAlbert'] as const) {
        const i = draft.royalTheater.deck.findIndex((c) => c.figure === figure);
        const [card] = draft.royalTheater.deck.splice(i, 1);
        draft.players[0]!.publicFigures.push({ ...card!, rotated: false });
      }
    });
    let state = play(start, { kind: 'takeBrusselsAction', action: 'grandPlaza' });
    expect(state.pending).toEqual({ kind: 'activatePublicFigure', player: 0, remaining: 2 });
    state = play(state, { kind: 'activatePublicFigure', index: 1 });
    state = play(state, { kind: 'activatePublicFigure', index: 2 });
    expect(state.players[0]!.tracks).toMatchObject({ cityHall: 1, royalPalace: 2 });
    // Two activations used up: the turn moves on although Brugmann is still upright.
    expect(state.pending).toEqual({ kind: 'turn', player: 1 });
  });

  it('need enough Assistants', () => {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.assistants = { available: 0, artNouveau: 0, brussels: 0, courthouse: 7 };
    });
    expect(kinds(legalMoves(start))).toEqual(['pass']);
  });
});

describe('Pass (p. 7)', () => {
  it('first passer takes the Exhibition tile and 1 BF + 1 BF per color; later passers 1 BF per color', () => {
    const start = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.works = { ...NO_WORKS, blue: 2, black: 1 };
      draft.players[1]!.works = { ...NO_WORKS, blue: 1, pink: 1, green: 1 };
      draft.players[2]!.works = { ...NO_WORKS };
      draft.workStacks = { color: { blue: 3, pink: 5, yellow: 6, green: 5 }, black: 5 };
    });
    const after = play(start, { kind: 'pass' }, { kind: 'pass' });
    expect(after.players[0]!.bf).toBe(5 + 1 + 2);
    expect(after.players[0]!.exhibitions).toEqual([1893]);
    expect(after.players[1]!.bf).toBe(6 + 3);
    expect(after.players[1]!.exhibitions).toEqual([]);
    expect(after.pending).toEqual({ kind: 'turn', player: 2 });
  });

  it('skips players who passed until everyone has', () => {
    let state = gameAtFirstTurn();
    state = play(state, { kind: 'pass' });
    state = play(state, { kind: 'takeBrusselsAction', action: 'market' });
    state = play(state, { kind: 'pass' });
    expect(state.pending).toEqual({ kind: 'turn', player: 1 });
  });
});
