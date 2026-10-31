# How the rules engine works

A short tour of `packages/engine/src`, for reading or changing the rules.

## The three functions

```ts
const state = newGame({ playerCount: 3 }); // setup, waiting for the first decision
legalMoves(state); // every allowed move for the pending decision
const next = apply(state, move); // a new state; `state` itself never changes
```

- `state.pending` always says **who decides what**: `{ kind: 'turn', player: 1 }`, `{ kind: 'moveCursor', player: 0 }`, `{ kind: 'chance', event: … }` and so on (`state/types.ts`).
- `legalMoves(state)` lists the moves for that decision only. The table app shows them as buttons and bots score them. Nothing else is allowed: `apply()` throws an `IllegalMoveError` for any move that isn't in the list.
- Multi-step actions are a chain of small decisions. A Sale is `moveCursor` → `sellWork` → `placeInShop`. A Construction is `payConstruction` → `turnNeedle` → `placeBuilding`.

## Inside apply()

1. Check that the move is legal.
2. Copy the state (a "draft") and handle the move on the copy (`rules/apply.ts`).
3. Run **steps** until the next decision is pending (`rules/steps.ts`).

`state.steps` is the engine's to-do list, kept as a stack (the last step runs first). For example, when a player takes a Royal Theater card, the engine pushes "apply the card's effect", "keep or discard it" and "refill the display", in that order. A step either does its work at once (scoring the shields) or sets a pending decision ("Solvay: which material?"). This is how secondary actions happen after the main action, and how the Grand Plaza activates one Public Figure after another.

## Chance

Stacks and decks are stored as their contents only, never in a shuffled order, so there is no hidden deck order for a bot to peek at. Whenever something is drawn, the state asks with `pending: { kind: 'chance', event }`, and a **ChanceOracle** answers with a move such as `{ kind: 'revealStockExchangeCard', card: 4 }`.

- `seededOracle(seed)` draws with a seeded random generator (tests, simulator).
- The table app will ask the players what was revealed, choosing from `chanceOutcomes(state, event)`.

A game log is the list of moves, chance outcomes included, so any game can be replayed exactly.

## Rule options

Where the rulebook can be read in more than one way, the literal reading is the default and a named option in `rules/options.ts` switches to the other one. Each option links to its question in `rules-questions.md`.

## Checks

- `assertInvariants(state)` checks that components are conserved (Assistants, materials, works, cards), that the needles differ, and that the board matches the players' counts. The tests run it after every move.
- `visibleState(state, player)` is what a bot is allowed to see.

## Where the rules live

| File                      | Rulebook                                                    |
| ------------------------- | ----------------------------------------------------------- |
| `rules/setup.ts`          | Setup, p. 2–3 and p. 12                                     |
| `rules/stock-exchange.ts` | A. Stock Exchange phase, p. 4                               |
| `rules/actions.ts`        | Art Nouveau actions, secondary actions, Brussels board      |
| `rules/compass.ts`        | Compass rules, p. 6–7                                       |
| `rules/public-figures.ts` | Royal Theater and Appendix 1                                |
| `rules/works.ts`          | Work of Art stacks and the shop                             |
| `rules/resolution.ts`     | C. Resolution of the Turn, p. 8–9                           |
| `rules/end.ts`            | D. End of Turn, paying Public Figures, final scoring, p. 10 |
