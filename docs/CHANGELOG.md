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

## Phase 5: Tuning (2026-10-31)

- Weight sets by name: `WEIGHT_SETS` in `engine/src/ai/weights/index.ts` (`default`, `tuned`). The simulator takes `--bots utility:<set>`; plain `utility` is `default`.
- `pnpm sim -- --tune`: hill-climbing over a weight set (`apps/sim/src/tune.ts`). Each step changes 3 weights by a random factor and plays the candidate against the champion (with a greedy bot as third seat). A candidate must outscore the champion in more than 55% of the games, then in more than 50% of fresh games. How it works: `docs/ai.md`.
- Degeneracy checks in every report: never uses the Brussels board, always tucks, never builds, hoards money (`apps/sim/src/degeneracy.ts`).
- The tournament now also plays the tuned set against the hand-made one.
- `ai/weights/tuned.json`: two tuning runs from `default` (seeds 42 and 43, 80 games per evaluation), 13 accepted steps in all. By mistake, both runs wrote to the same file at the same time. The file holds the second run's champion, which started from the first run's first 4 steps. Every check below was made on this file.
- **Result:** tournament, seed 42, 100 games per matchup, invariants checked: `utility:tuned` wins 70% against two `utility` (default) bots in 3-player games, 85% head to head in 2-player games, and 100% against two greedy bots (186.4 VP on average). On a fresh seed (7), 300 games of tuned vs default vs greedy: tuned wins 96.7% (156.7 VP against 100.8). No degenerate strategies are flagged. The Phase 4 matchups give exactly the same results as before.
- The tuned set plays a different game: mostly an Art Dealer. Per game it takes 9.3 Workshop actions (default: 1.3), scores 53 VP from works on tuck row 2 (default: 2), and builds 2.4 Buildings (default: 4.9).

## Phase 6: Table app (2026-10-31)

- `apps/web`: the table app (Vue 3 + Pinia). How it works: `docs/web.md`.
- New game wizard: 2–5 seats in turn order, human or bot, bot difficulty. Setup chance events (strips, compass tiles, Public Figures, starting works, Bonus cards, Stock Exchange card) are asked as prompts.
- Human decisions follow `legalMoves()`: tap a board space and choose the bid, tap the Workshop cursor position, or press a button.
- Bot turns are shown as physical instructions with the bot's reason and plan, followed by **Done**. Draws during a bot's turn are asked in between.
- Undo (back to the last human input) and redo, autosave to `localStorage` after every move, export and import as JSON.
- Offline after the first visit (hand-written service worker, web app manifest), tablet-first layout that also works on a phone.
- `deploy.yml`: build and FTP upload to the web hotel on every push to `main`, once the FTP secrets are set.
- Tests: session (undo/redo, save/load, illegal moves), wording, and a store test that plays a whole game with one human and two bots.
- Checked in a real browser (headless Chrome): setup wizard, setup prompts, a human turn with a bid, and a bot turn with a draw in the middle. No console errors.
- **Still to do for "done":** play a complete game at a real table with 1 human and 2 bots, without workarounds (PLAN.md Phase 6).

## Phase 6 follow-up: first table game (2026-10-31)

Hans played two rounds with 1 human and 2 bots. The export is kept as a test fixture (`apps/web/test/fixtures/table-game-2026-10-31.json`).

- **Secondary actions the table never saw.** A bot's Sale on another bot's Building gave the owner 1 VP, but nobody was told to move the marker. The engine now records `state.events` (table events) for secondary actions, shield scorings and the Brussels majority. The app shows them in the bot's turn, or in an "Also on the board" box after a human move.
- **Shield majorities** are now listed one shield at a time ("Shield 3-4: Hans (yellow) scores 1 VP"), so nobody has to count them by hand.
- **Bonus cards** remember the column they lay under. The app groups the choices per card ("Column 3: Architect +1 · 1 Manneken Pis · 1 VP symbol"), and bot instructions name the column.
- **"Only Skip" explained.** The second Building was refused correctly: the needles pointed at 3 BF and Any Noble Material, so the Building cost 1 Noble Material and 3 BF, and the bid left 2 BF. The engine's new `cannotPerformReason()` says that next to **Skip**.
- Bot reasons that only repeat the instruction and the plan are hidden.
- No AI behaviour changed (the events are not read by the bots), so no new tournament.
