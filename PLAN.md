# Bruxelles 1893 Automa: Project Plan

## 0. Status (updated 2026-10-31)

| Phase                        | Status      | PR                                                                                 |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| 0. Scaffolding               | Done        | #1                                                                                 |
| 1. Component data            | Done        | #2, #3 (#2 was merged into the Phase 0 branch by mistake; #3 brought it to `main`) |
| 2. Rules engine              | Done        | #4                                                                                 |
| 3. Simulator + baseline bots | Done        | #5                                                                                 |
| **4. Utility bot v1**        | **Next**    |                                                                                    |
| 5–8                          | Not started |                                                                                    |

Repository: https://github.com/hassehulabeck/brux-de-luxe (public). Work on a branch per phase off `main` and open a PR to `main` (no stacked PRs). CI runs `pnpm check`, `pnpm test` and the web build.

Where things stand:

- **Component data is complete.** Hans transcribed every value; `pnpm check:data` passes. The rulebook PDF stays out of the repo (`*.pdf` is gitignored, it is copyrighted).
- **All rules questions are answered** (Q1–Q19 in `docs/rules-questions.md`). Where Hans chose between readings, the choice is a default in `engine/src/rules/options.ts`.
- **The engine plays full games** for 2–5 players. How it works: `docs/engine.md`. 10,000 random games ran with invariants checked after every move and no errors.
- **Baseline:** in 3-player games (1,000 games, seed 42), `greedy` beats two `random` bots 79.0% of the time with an average of 27.2 VP. Greedy lives off the Stock Exchange, Grand Plaza (Brugmann's 5 BF) and Park Sales and never builds. Phase 4's bar is utility ≥ 80% against greedy.
- History of each phase: `docs/CHANGELOG.md`.

Decisions taken along the way that differ from or add to the plan below:

- **TypeScript is pinned to `~6.0.3`**: typescript-eslint and vue-tsc don't support TypeScript 7 yet. pnpm 12 needs `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml`.
- **Stacks and decks hold no order.** They are stored as counts/lists of contents, and each draw is decided by the `ChanceOracle` at the moment it happens. So there is no hidden deck order at all, and `visibleState()` only has to hide another player's Workshop draw.
- **Pending decisions plus a step stack.** `state.pending` says who decides what; `state.steps` is the engine's to-do list (secondary actions, Public Figure effects, refills, resolution). `apply()` copies the state, handles the move on the copy, then runs steps until the next decision.
- **Chance outcomes are moves** (`revealWorks`, `revealStockExchangeCard`, ...), so a game log is just the list of moves. `chanceOutcomes(state, event)` lists them for the table app.
- **Georges Brugmann cards are only the 5 starting cards** (cost 1). The shuffled Public Figure deck has 21 cards, 3 of each other figure.
- **Bots:** `Bot.decide(view, player)` returns `{ move, score, reason, alternatives }`; `playGame({ bots, oracle })` runs a game; `applyLegalMove()` skips the legality check for look-ahead. The sim CLI lives in `apps/sim` (`--games`, `--players 2,3,4,5`, `--bots`, `--seed`, `--no-invariants`, `--help`).

Next steps for Phase 4 (see section 5 and Phase 4 below): `ai/projection.ts`, `ai/considerations/` (one file and one test each), `ai/plans.ts`, weights in `ai/weights/*.json`, the utility bot in `ai/bots/`, and `--log` and `--tournament` in the sim.

## 1. Goal

Build a web app that plays **Bruxelles 1893** (Pearl Games / Z-Man, 2013 edition) as one or more bot opponents at a physical table. The bot should play like a real player. It reads the full game state (its own collection, economy, materials, tracks, and the opponents' positions), builds a plan that fits its circumstances, and changes that plan when the circumstances change. It should not just block spaces or follow a fixed script.

A human enters every move made at the physical table into the app. The app keeps the game state, decides the bot's moves, and announces them with a short reason. A human then carries out the bot's move on the physical board.

### Success criteria

- A complete 5-round game, with 1–2 bots plus 1–3 humans, can be played at the table using only the app as the bot's brain. Entering a human move should take about 10 seconds.
- In self-play, the utility bot beats the greedy baseline at least 80% of the time.
- Experienced human players judge that the bot's moves "look like something a player would do". This is checked through logged playtests (Phase 7).
- Difficulty can be adjusted, and the bot cannot be farmed with a single predictable exploit.

### Non-goals (for now)

- Online multiplayer between humans.
- Computer vision or camera input.
- Belle Époque (2nd edition) or Bruxelles 1897 compatibility. The data model should not make these impossible, but no work goes into them.
- The advanced (marked) side of the Action strips. Its rules are not in the base rulebook. It can be added later as data.

---

## 2. Tech stack and hosting

| Concern                   | Choice                                                                            | Why                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Language                  | **TypeScript** (strict) everywhere                                                | One language lets the same engine run in the browser, in the CLI simulator and in tests. The bot needs fast move enumeration close to the UI. |
| Monorepo                  | **pnpm workspaces**                                                               | Simple, fast, good TS support.                                                                                                                |
| Rules engine and AI       | Pure TS package, **no runtime dependencies**                                      | Deterministic, testable, runs anywhere.                                                                                                       |
| Tests                     | **Vitest**                                                                        | Fast, works with TS without extra setup.                                                                                                      |
| Simulator                 | Node CLI (`tsx`)                                                                  | Headless bot-vs-bot runs for tuning.                                                                                                          |
| Web UI                    | **Vue 3 + Vite + Pinia**                                                          | Close to the Laravel/Inertia world, lightweight, builds to static files.                                                                      |
| Styling                   | Plain CSS with custom properties (or UnoCSS if preferred)                         | Tablet-first, large touch targets.                                                                                                            |
| Persistence (MVP)         | `localStorage` + JSON export/import of the game log                               | No backend needed to play.                                                                                                                    |
| Hosting (MVP)             | **Static build deployed to the shared PHP web hotel via FTP** from GitHub Actions | It already exists, costs nothing extra, and a static site needs nothing more.                                                                 |
| Hosting (later, optional) | **Railway**: small API + Postgres to collect playtest logs and tuned weight sets  | Used only once there are enough playtest logs to need central storage. Could be Laravel if preferred.                                         |

The app must stay fully usable offline once loaded (PWA in Phase 6), because game tables often have bad Wi-Fi.

---

## 3. Repository layout

```
brux-de-luxe/
├─ PLAN.md
├─ CLAUDE.md
├─ docs/
│  ├─ rules-summary.md        # condensed rules, written from the rulebook
│  ├─ rules-questions.md      # rule ambiguities + decisions taken (Q1–Q19, all answered)
│  ├─ data-entry-guide.md     # how to transcribe physical components
│  ├─ engine.md               # how the rules engine works
│  └─ CHANGELOG.md            # what each phase delivered
├─ packages/
│  └─ engine/
│     ├─ src/
│     │  ├─ data/             # component data (JSON + TS types), transcribed by hand
│     │  ├─ state/            # GameState, Pending, Step types; coords.ts
│     │  ├─ rules/            # setup, legalMoves(), apply(), steps, scoring, invariants, options
│     │  ├─ chance/           # ChanceOracle, seeded RNG, chance outcomes
│     │  ├─ ai/
│     │  │  ├─ projection.ts  # endgame score projection
│     │  │  ├─ plans.ts       # Builder / ArtDealer / Politician / Opportunist
│     │  │  ├─ considerations/ # one file per scoring term
│     │  │  ├─ bots/          # random, greedy (done), utility (Phase 4)
│     │  │  ├─ explain.ts     # human-readable move descriptions
│     │  │  ├─ play.ts        # playGame(): bots against each other
│     │  │  └─ types.ts       # Bot, BotDecision
│     │  └─ index.ts
│     └─ test/
├─ apps/
│  ├─ sim/                    # CLI: run N games, tournaments, weight tuning
│  └─ web/                    # Vue table app
└─ .github/workflows/
   ├─ ci.yml                  # lint, typecheck, test
   └─ deploy.yml              # build web → FTP to web hotel
```

---

## 4. Core architecture

### 4.1 Engine principles

- **Immutable state.** `apply(state, move) → newState`. No mutation, so undo means keeping a history stack.
- **Moves are data.** Every decision any player makes is a serialisable `Move` object, including sub-decisions such as bracket orientation, which Work of Art to keep, compass payment, needle choice, building placement, and Bonus card use or tuck.
- **A pending-decision model.** The state always says _who must decide what next_ (`state.pending`), e.g. `{ kind: 'chooseAction', player }`, `{ kind: 'chooseShield', player, options }`, `{ kind: 'resolveBonus', player, cards }`. `legalMoves(state)` returns only moves for the current pending decision. Multi-step actions such as Sale (cursor → color → shop slot) become a sequence of pending decisions, so both the UI and the bot handle them the same way.
- **Chance is external.** Random events (revealing a Stock Exchange card, Work of Art draws, Public Figure reveals, Bonus card draws, setup shuffles) are `ChanceEvent`s resolved by a `ChanceOracle`:
  - `SeededOracle`: used by the simulator and tests.
  - `TableOracle`: the UI asks the human "Which Stock Exchange card was revealed?" or "Bot draws 2 Works of Art: which colors?".
- **Hidden information is respected.** Bots may only read what a human player could see. Deck order is never visible to a bot, even in simulation. Enforce this with a `visibleState(state, player)` view that bots receive.

### 4.2 Game state (high level)

- Setup: player count, colors, seat order, Art Nouveau strip arrangement (which strip in which column, which side), compass tile positions.
- Round: round number (1–5), revealed Exhibition tile, Stock Exchange card, bracket shield and orientation → available area, first player, pass order.
- Art Nouveau board: 5×5 spaces → `{ actionType, assistant?: {player, bid}, building?: player }`; 4×4 shields; Bonus card under each column.
- Brussels board: per action, the assistants placed this round per player, the next use cost, and double availability at 4–5 players. Courthouse contents.
- Shared: Workshop cursor position, shop (2 slots, as stacks so covered works are tracked), compass needles, Royal Theater display (4) + deck/discard, supplies (cubes, Work of Art stacks).
- Per player: BF, Works of Art (by color, black separate), noble cubes by type, Jokers, Public Figures (upright/rotated), Exhibition tiles, Assistants (available / placed / in Courthouse), Building tiles remaining by row, tracks (Architect, City Hall, Royal Palace, VP), tucked Bonus cards per row, Manneken Pis count this round.

### 4.3 Component data

All component values come from the **physical game**, transcribed into `packages/engine/src/data/`. This includes the Workshop grid values, Action strip layouts (both sides), Stock Exchange cards, Bonus cards, Public Figure cards (count per figure and end-game cost), compass tiles, track values, and Exhibition tiles. The rulebook does not contain all of these.

**Claude Code must never invent component values.** Missing data goes in as a clearly marked placeholder (`TODO_DATA`) with a failing data-completeness test, and Hans fills it in. `docs/data-entry-guide.md` explains exactly what to transcribe from each component.

---

## 5. The bot (utility AI with plans)

### 5.1 Endgame score projection

`project(state, player) → number` estimates the final score:
current VP + buildings built × projected Architect level + projected future buildings + tucked-row multipliers × projected holdings (BF/4, Works, Public Figures, Assistants − 2) + noble cubes − expected Public Figure penalties + Manneken Pis expectation.
Most move evaluation is simply **Δprojection**, plus terms that the projection cannot capture.

### 5.2 Considerations (scoring terms)

Each one is a pure function `(visibleState, move, ctx) → number`, with plan weights applied:

1. Immediate VP/BF/resources (exact simulation of the effect).
2. Δprojection (plan-weighted per value source).
3. Auction value: Bonus card value to me × P(win or tie at this bid) − bid.
4. Shield majority Δ: VP gained or denied at City Hall level.
5. Gift cost: secondary actions handed to opponents' buildings.
6. Courthouse risk: P(I end with the most Brussels assistants) × value of an assistant for the rounds left.
7. Tempo/scarcity: will this space, color or card still be there on my next turn?
8. Opponent denial (Sale cursor damage, compass needle turns that hurt opponents).

### 5.3 Plans (personalities)

Four weight vectors over the value sources: **Builder**, **Art Dealer**, **Politician**, **Opportunist/Financier**.

- At the start of each round (and after big state changes), compute each plan's _fitness_ from the bot's own position and how contested that path is.
- Active weights = softmax blend of the plans' fitness + an **inertia bonus** for last round's leading plan + the bot's fixed **temperament** bias.
- The UI shows the current dominant plan, so the table can "read" the bot.

### 5.4 Decision procedure

1. `legalMoves(visibleState)`. Bid amounts are capped to a sensible range: from the minimum up to (leader + 2) and the bot's cash.
2. Score every move. Sub-decisions with small spaces (cursor cells × color, compass payment combinations, needle turns) are enumerated fully.
3. Pick: top-1 at the hardest level, otherwise weighted sampling among the top-k by score (temperature).
4. Return `{ move, score, reason, topAlternatives }`. The reason is a single line, e.g. _"Sale yellow → +6 BF, +3 VP (Art Dealer)"_.

### 5.5 Special decisions

- **Stock Exchange shield and bracket:** simulate both options; sum my top-k move values in each area + secondary income from my buildings inside − opponents' expected value.
- **Bids:** smallest amount that wins or ties, capped at Bonus value × aggression; ±1 noise at higher difficulty; raise the bid on the most wanted column when I'm about to pass.
- **Building placement:** expected opponent usage (action popularity × chance the space is inside future areas) + top-row bonus.
- **Bonus card use vs tuck:** compare marginal projection gains; respect one card per row per round.
- **Pass:** pass when no move beats the pass value (the first pass also counts the Exhibition tile, 2 Manneken Pis, extra Workshop draws and the first-player value).

### 5.6 Difficulty

Knobs: sampling temperature, projection quality (simple / full), opponent modelling (none / 1-ply on contested columns), plus optional handicaps (starting BF ±2, VP per round). Presets: **Easy / Normal / Hard / Brutal**.

---

## 6. Phases and milestones

Each phase ends with green CI and a short entry in `docs/CHANGELOG.md`.

### Phase 0: Scaffolding (done)

- pnpm monorepo, TS strict, ESLint + Prettier, Vitest, CI workflow.
- Empty `engine`, `sim`, `web` packages that build.
- `docs/rules-summary.md` written from the rulebook; `docs/rules-questions.md` started.
- **Done when:** `pnpm i && pnpm check && pnpm test` passes in CI.

### Phase 1: Component data (done)

- TS types + JSON for all components, with `TODO_DATA` placeholders.
- `docs/data-entry-guide.md` written.
- Data-completeness tests (these fail until Hans fills in values; mark them `skip` behind an env flag so CI can still pass).
- **Done when:** types are agreed and the data entry guide is clear enough for Hans to transcribe the components.

### Phase 2: Rules engine (done)

Implement in order, each with unit tests based on the rulebook examples:

1. Setup (incl. 2-player neutral assistants, starting money 5/6/7/8/9, Brugmann cards).
2. Stock Exchange phase: shield choice, bracket orientation → largest area.
3. Action phase: Art Nouveau placement + bid, each of the 5 actions incl. multi-step Sale and Construction (compass rules, Joker +5 VP rule, needle turn, placement anywhere empty, top-row +5 VP).
4. Secondary actions on buildings (Appendix 2).
5. Brussels actions with escalating assistant cost and double availability at 4–5p.
6. Pass (first pass: Exhibition tile + income).
7. Resolution: bids/Bonus cards (incl. ties), new first player, Bonus use/tuck, shield majorities, Courthouse.
8. End of turn and end of game (Public Figure payment, full scoring).

- Rulebook examples become tests: Sale example (2 BF + 6 VP), compass examples, shield majority example, end-game scoring example (blue player), Public Figure payment example.
- **Done when:** a seeded random game runs from setup to final scoring with no illegal states, and all rulebook-example tests pass.

### Phase 3: Simulator + baseline bots (done)

- `RandomBot`, `GreedyBot` (maximise immediate VP+BF).
- `pnpm sim --games 1000 --players 3 --bots greedy,random,random --seed 42` → win rates, average scores, score breakdowns, action frequencies.
- Property tests: game always terminates; state invariants hold (counts of cubes, coins, assistants, tiles are conserved).
- **Done when:** 10,000 random games run without errors.

### Phase 4: Utility bot v1 (next)

- Projection, considerations, plans, explanation strings.
- Decision logs (`--log`) with the top-3 alternatives per decision.
- **Done when:** Utility (Normal) beats Greedy ≥ 80% in 3-player self-play, and a sample of logged decisions reads sensibly.

### Phase 5: Tuning

- Hill-climbing / simple evolutionary search over plan weights and consideration weights in `apps/sim`.
- Tournament mode between weight sets; save tuned sets as JSON in `engine/src/ai/weights/`.
- Check for degenerate behaviour (never uses Brussels, always tucks, never builds, hoards money).
- **Done when:** tuned weights beat hand weights and there are no obvious degenerate strategies.

### Phase 6: Table app (MVP)

- New game wizard: players, seats, which seats are bots + difficulty/temperament, strip arrangement, compass tiles, starting Work of Art draws.
- Main screen: compact board state, whose turn, pending decision.
- Human move input: big-button flow that follows the pending decision (action type → space → bid → sub-choices). Only legal options are selectable.
- Bot turn: shows the move clearly ("Place assistant on column 3, row 2 (Sale), bid 2 BF. Move cursor right 1. Sell yellow. Put it on the left shop slot") + reason + plan badge + "Done" button.
- Chance prompts via `TableOracle`.
- Undo/redo, autosave to `localStorage`, export/import game JSON.
- PWA (offline after first load), tablet-first layout, also usable on a phone.
- Deploy workflow to the web hotel.
- **Done when:** a complete real-table game with 1 human + 2 bots is played without workarounds.

### Phase 7: Playtesting loop

- In-app "flag this bot move as un-human" button with an optional note → stored in the game log.
- Post-game summary: scores, the bot's plan over time, flagged moves with alternatives.
- Iterate considerations based on flags.
- Optional: Railway API + Postgres to upload logs and pull tuned weight sets.

### Phase 8 (optional): Extras

- Paper "lite" deck generated from the bot's typical behaviour.
- Advanced strip sides, Belle Époque data.
- Opening hints / "what would the bot do?" mode for human learning.

---

## 7. Testing strategy

- **Unit:** every rule, using the rulebook examples as fixtures.
- **Property/fuzz:** random legal play with seeded RNG; invariant checks after every `apply`.
- **Golden games:** recorded full games (JSON) replayed and checked against the stored final scores.
- **AI regression:** fixed-seed tournaments must not drop below stored win-rate thresholds.

## 8. Open questions for Hans

None at the moment. Rule questions and their answers live in `docs/rules-questions.md` (Q1–Q19, all answered). New ambiguities go there, with the literal reading implemented behind an option in `engine/src/rules/options.ts`.
