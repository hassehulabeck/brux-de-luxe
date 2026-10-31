import {
  apply,
  assertInvariants,
  legalMoves,
  newGame,
  resolveChance,
  seededOracle,
  seededRng,
  visibleState,
  type GameState,
  type PlayerCount,
} from '../../src';

export interface RandomGameResult {
  final: GameState;
  moves: number;
}

/**
 * Plays a whole game with random legal moves and a seeded oracle, checking
 * the invariants after every move. Bots choose from the visible state only.
 */
export function playRandomGame(seed: number, playerCount: PlayerCount): RandomGameResult {
  const oracle = seededOracle(seed);
  const rng = seededRng(seed + 1);
  let state = resolveChance(newGame({ playerCount }), oracle);
  let moves = 0;
  while (state.pending?.kind !== 'gameOver') {
    const pending = state.pending!;
    if (!('player' in pending)) throw new Error(`Unexpected pending ${pending.kind}`);
    const options = legalMoves(visibleState(state, pending.player));
    if (options.length === 0) throw new Error(`No legal moves for ${pending.kind}`);
    // Prefer cheap bids so random players don't spend everything on the first space.
    const move = options[rng.int(options.length)]!;
    state = resolveChance(apply(state, move), oracle);
    assertInvariants(state);
    if (++moves > 5000) throw new Error('The game did not end');
  }
  return { final: state, moves };
}
