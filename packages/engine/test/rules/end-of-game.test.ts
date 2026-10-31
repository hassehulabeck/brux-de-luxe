import { describe, expect, it } from 'vitest';
import { finalScore, legalMoves, loadComponents, type GameState } from '../../src';
import { edit, everyonePasses, gameAtFirstTurn, play } from '../helpers/game';

const types = loadComponents().bonusCards;
const withVpSymbols = (n: number) => types.findIndex((t) => t.vpSymbols === n);

/** Round 5, everyone about to pass, so the game ends after resolution. */
function lastRound(change: (draft: GameState) => void) {
  return edit(gameAtFirstTurn(), (draft) => {
    draft.round.number = 5;
    change(draft);
  });
}

/** Take Public Figures out of the deck for a player (keeps the cards conserved). */
function giveFigures(draft: GameState, owner: number, figures: { figure: string; cost: number }[]) {
  for (const wanted of figures) {
    const i = draft.royalTheater.deck.findIndex((c) => c.figure === wanted.figure);
    const [card] = draft.royalTheater.deck.splice(i, 1);
    draft.players[owner]!.publicFigures.push({ ...card!, cost: wanted.cost, rotated: false });
  }
}

describe('paying the Public Figures (p. 10)', () => {
  it('rulebook example: 15 BF of cards and 12 BF: pay 11, give up a 4 BF card, lose 5 VP (strict option)', () => {
    const state = lastRound((draft) => {
      giveFigures(draft, 1, [
        { figure: 'ernestSolvay', cost: 2 },
        { figure: 'henryVanDeVelde', cost: 4 },
        { figure: 'emileVandervelde', cost: 4 },
        { figure: 'mauriceMaeterlinck', cost: 4 },
      ]);
      draft.players[1]!.bf = 11; // + 1 BF when passing = 12 BF
      draft.rules.mustPayPublicFiguresWhenAble = true;
    });
    let ended = everyonePasses(state);
    while (ended.pending?.kind === 'resolveBonus') ended = play(ended, legalMoves(ended)[0]!);
    // The game ends after resolution: player 1 can't pay 1 + 2 + 4 + 4 + 4 = 15 BF.
    expect(ended.pending).toEqual({ kind: 'payPublicFigures', player: 1 });
    // A card may only stay unpaid if the money left can't cover it.
    const bf = ended.players[1]!.bf;
    expect(bf).toBe(12);
    const choices = legalMoves(ended);
    expect(choices).toEqual([
      // Allowed but bad: pay 12 BF for three 4 BF cards, lose Brugmann and Solvay (−10 VP).
      { kind: 'payPublicFigures', unpaid: [0, 1] },
      { kind: 'payPublicFigures', unpaid: [2] },
      { kind: 'payPublicFigures', unpaid: [3] },
      { kind: 'payPublicFigures', unpaid: [4] },
    ]);
    expect(choices).not.toContainEqual({ kind: 'payPublicFigures', unpaid: [1] });
    expect(choices).not.toContainEqual({ kind: 'payPublicFigures', unpaid: [1, 2] });

    const paid = play(ended, { kind: 'payPublicFigures', unpaid: [2] });
    const p = paid.players[1]!;
    expect(p.publicFigures.map((f) => f.figure)).toEqual([
      'georgesBrugmann',
      'ernestSolvay',
      'emileVandervelde',
      'mauriceMaeterlinck',
    ]);
    expect(p.bf).toBe(12 - 11);
    expect(paid.final?.[1]?.scoringTrack).toBe(-5);
  });

  it('lets players leave any card unpaid, paying is optional (Q19)', () => {
    const state = lastRound(() => {});
    let ended = everyonePasses(state);
    while (ended.pending?.kind === 'resolveBonus') ended = play(ended, legalMoves(ended)[0]!);
    expect(ended.pending).toEqual({ kind: 'payPublicFigures', player: 0 });
    expect(legalMoves(ended)).toEqual([
      { kind: 'payPublicFigures', unpaid: [] },
      { kind: 'payPublicFigures', unpaid: [0] },
    ]);
  });

  it('with mustPayPublicFiguresWhenAble on, pays everything without asking when affordable', () => {
    const state = lastRound((draft) => {
      draft.rules.mustPayPublicFiguresWhenAble = true;
    });
    let ended = everyonePasses(state);
    while (ended.pending?.kind === 'resolveBonus') ended = play(ended, legalMoves(ended)[0]!);
    expect(ended.pending).toEqual({ kind: 'gameOver' });
    expect(ended.phase).toBe('gameOver');
    // Brugmann costs 1 BF.
    expect(ended.players[0]!.bf).toBe(5 + 1 + 1 - 1);
  });
});

describe('final score (p. 10)', () => {
  it('rulebook example (blue player)', () => {
    // a. 80 VP on the track. b. 5 Buildings, Architect 8 (40 VP).
    // c1. 5 VP for 6 BF: row 1 has 5 VP symbols (1 printed + 2 cards with 2).
    // c2. 3 VP for 3 works (row 2: 1 symbol). c3. 2 VP for 2 Public Figures (row 3: 1 symbol).
    // c4. 6 VP for 5 Assistants (row 4: 2 symbols). d. 3 VP for 3 Noble Materials.
    const two = withVpSymbols(2);
    const one = withVpSymbols(1);
    const state = edit(gameAtFirstTurn(), (draft) => {
      const blue = draft.players[0]!;
      blue.vp = 80;
      blue.buildingsBuilt = 5;
      for (let col = 0; col < 5; col++) draft.board[4]![col]!.building = 0;
      blue.tracks.architect = 4; // value 8
      blue.bf = 6;
      blue.tucked = [[two, two], [], [], [one]];
      blue.works = { blue: 1, pink: 1, yellow: 0, green: 0, black: 1 };
      blue.publicFigures = [
        { figure: 'georgesBrugmann', cost: 1, rotated: false },
        { figure: 'charlesBuls', cost: 3, rotated: false },
      ];
      blue.assistants = { available: 5, artNouveau: 0, brussels: 0, courthouse: 2 };
      blue.nobles = { wood: 1, stone: 1, iron: 1 };
      draft.firstPlayer = 1; // the example doesn't include the Manneken Pis pawn
    });
    expect(finalScore(state, 0)).toEqual({
      player: 0,
      scoringTrack: 80,
      buildings: 40,
      rows: [5, 3, 2, 6],
      nobleMaterials: 3,
      mannekenPis: 0,
      total: 80 + 40 + 5 + 3 + 2 + 6 + 3,
    });
  });

  it('gives 5 VP to the holder of the Manneken Pis pawn', () => {
    expect(finalScore(gameAtFirstTurn(), 0).mannekenPis).toBe(5);
    expect(finalScore(gameAtFirstTurn(), 1).mannekenPis).toBe(0);
  });

  it('counts Assistants still on the boards for row 4, but not the Courthouse (Q14)', () => {
    const state = edit(gameAtFirstTurn(), (draft) => {
      draft.players[0]!.assistants = { available: 2, artNouveau: 2, brussels: 1, courthouse: 2 };
    });
    expect(finalScore(state, 0).rows[3]).toBe(3);
    const strict = edit(state, (draft) => {
      draft.rules.tuckRow4CountsAssistantsOnBoards = false;
    });
    expect(finalScore(strict, 0).rows[3]).toBe(0);
  });
});
