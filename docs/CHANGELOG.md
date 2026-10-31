# Changelog

## Phase 0: Scaffolding (2026-10-31)

- pnpm monorepo with `packages/engine`, `apps/sim` and `apps/web`.
- TypeScript 6.0 (strict), ESLint (flat config) + Prettier, Vitest.
- ESLint enforces the engine's purity rules: no Node APIs, no DOM, no `Math.random` in `packages/engine/src`.
- CI workflow: install, `pnpm check`, `pnpm test`, web build.
- `docs/rules-summary.md` (written from the rulebook) and `docs/rules-questions.md` started.
- Note: TypeScript 7 is not used yet, because `typescript-eslint` and `vue-tsc` only support up to TypeScript 6.0.

## Phase 1: Component data (2026-10-31)

- `engine/src/data/types.ts`: the game vocabulary (actions, colors, materials, compass tiles, Bonus effects, Public Figures) and the shape of all component data.
- `engine/src/data/rulebook.ts`: every value stated in the rulebook text, with page references.
- `engine/src/data/json/`: one JSON file per component, with `TODO_DATA` wherever a value is only printed on the physical component.
- `engine/src/data/validate.ts`: dependency-free validator. It reports missing values (`TODO_DATA`) and invalid values (with their exact path) separately, and checks totals against the rulebook's component counts.
- `engine/src/state/coords.ts`: Art Nouveau space ↔ shield mapping.
- Tests: validator behaviour (with clearly fake fixture data), a shape check of the real data that always runs, and a completeness check behind `CHECK_DATA=1` (`pnpm check:data`).
- `docs/data-entry-guide.md` written.
- From the rulebook illustrations: strips are rows; shield rows are numbered from the bottom (fixed in `coords.ts`); Workshop grid, City Hall, Royal Palace and Architect tracks, and the needle start are pre-filled for Hans to check. The Workshop values are tested against the two Sale examples.
- Hans answered Q2 (the whole Workshop cursor stays on the grid), Q4 (Sale cursor moves up to N spaces), Q5 (a blocked needle can't turn, so the other one turns) and Q12 (Brugmann cards are never in the deck). The validator now rejects Brugmann cards in the deck.
- Hans confirmed Q3 (Park gives no secondary action), Q6 (a Joker replaces a unit of any type), Q7 (money is unlimited), Q8 (stack rebuild) and Q11 (no Courthouse when nobody used Brussels).
- Hans answered Q9 (neutral Assistants return to their owners at the end of the round) and Q13 (no house rules). All rules questions are now closed.
- Hans transcribed the Action strips, Stock Exchange cards, Bonus cards, Public Figure deck (3 copies each), Works of Art and Exhibition years. Two typos fixed after validation ("architecht", and double-power cards using `options` instead of `effects`). Hans confirmed the starting Brugmann cost (1 BF). All component data is now complete.

## Phase 2: Rules engine (2026-10-31)

- `newGame()`, `legalMoves()` and `apply()`: the full game from setup to final scoring, for 2–5 players (2-player neutral Assistants included). How it works: `docs/engine.md`.
- Pending decisions and a step stack make multi-step actions (Sale, Construction, Royal Theater, Grand Plaza, Bonus cards, secondary actions) a chain of small decisions.
- Chance goes through a `ChanceOracle`. Stacks and decks hold no order, so there is no hidden information for bots to peek at. `seededOracle(seed)` for tests and the simulator.
- `assertInvariants()` checks component conservation after every move. `visibleState()` hides other players' Workshop draws.
- Rulebook examples as tests: Sale (2 BF + 6 VP), black Sale (2 BF + 4 VP), compass payments, shield majorities, Public Figure payment, blue player's final score.
- Seeded random games for 2–5 players run to the end with no broken invariants (200 random games take about 4 seconds).
- New literal readings behind rule options: Q14–Q19 in `docs/rules-questions.md`, waiting for Hans.
- Hans confirmed Q14–Q17 as implemented and decided Q19: paying for Public Figures is optional (`mustPayPublicFiguresWhenAble` now defaults to `false`). Q18: a disc never moves past the last space of a track. All rules questions are closed again.

## Phase 3: Simulator and baseline bots (2026-10-31)

- Bots in `engine/src/ai`: `randomBot` and `greedyBot` (best immediate VP + BF, looking through its own follow-up decisions). Bots return `{ move, score, reason, alternatives }` with a short English reason, and only see `visibleState()`.
- `playGame({ bots, oracle })` plays a whole game. `applyLegalMove()` lets bots look ahead without the legality check.
- `pnpm sim -- --games 1000 --players 3 --bots greedy,random,random --seed 42`: win rates, average scores with a breakdown by scoring category, and how often each decision is chosen. Seats rotate every game. `--players 2,3,4,5` cycles player counts. Invariants are checked after every move unless `--no-invariants` is given.
- 10,000 random games (2–5 players, seed 1) ran without errors and with invariants checked after every move, in 3 minutes.
- Greedy vs. two random bots, 3 players, 1,000 games, seed 42: greedy wins 79.0% (average 27.2 VP). As expected from a greedy bot, it lives off the Stock Exchange, Grand Plaza (Brugmann's 5 BF) and Park Sales, and never builds.

## Phase 4: Utility bot v1 (2026-10-31)

- `utilityBot` in `engine/src/ai`: plays with plans, an endgame score projection and considerations. How it works: `docs/ai.md`.
- `ai/projection.ts`: the final score if the game ended now (Public Figures paid) plus what the resources are still worth in the rounds left, split into six value sources.
- `ai/plans.ts`: Builder, Art Dealer, Politician and Opportunist. Fitness from the bot's own position, lowered when opponents are strong on the same path, softmax-blended, with inertia for last round's leading plan and an optional temperament. The leading plan is shown with every decision.
- `ai/considerations/`: projection gain, auction, shield majority, gift, Courthouse risk, Manneken Pis, denial, building placement and area choice. Each has its own file and test.
- `ai/search.ts`: look-ahead through the bot's own follow-up decisions, capped bids, and speed-ups (about 0.4 s per 3-player game).
- Weights in `ai/weights/default.json`, difficulty presets (Easy/Normal/Hard/Brutal: sampling temperature and top-k) in `ai/weights/difficulty.json`.
- Simulator: `--log <file>` writes every bot decision with its reason and top 3 alternatives as JSON lines; `--tournament` plays fixed matchups.
- **Result:** utility (Normal) vs. two greedy bots, 3 players, 1,000 games, seed 42, invariants checked: utility wins **100%** (average 154.0 VP against 23.1 and 21.0). Tournament (seed 42, 100 games each): utility wins 100% in every matchup (3p vs greedy, 3p vs random, 2p vs greedy, 4p vs greedy). Greedy vs. two random: 68.0%.
- For Phase 5 to look at: the bot scores a lot from tuck row 4 (Assistants beyond the second, 34.5 VP per game, 8.5 tucks against 5.2 uses), and hardly uses the Stock Exchange or Grand Plaza. Tempo/scarcity and opponent modelling are not built yet.
