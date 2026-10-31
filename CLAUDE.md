# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this project is

A web app that acts as the brain for **bot opponents** in the physical board game **Bruxelles 1893** (2013 Pearl Games / Z-Man edition). Humans enter their moves; the app keeps the game state and decides the bots' moves using a **utility AI with shifting plans**. Read `PLAN.md` first. It is the source of truth for scope, architecture and phase order. Work phase by phase and do not jump ahead.

The owner is Hans, a web development instructor (PHP/Laravel background). Prefer clear, teachable code over clever code.

## Commands

```bash
pnpm install
pnpm check          # typecheck + lint + prettier check, all packages
pnpm test           # vitest, all packages
pnpm test:watch
pnpm format         # prettier --write
pnpm check:data     # fails until every TODO_DATA in engine/src/data/json is filled in
pnpm --filter engine test
pnpm sim -- --games 1000 --players 3 --bots utility,greedy,random --seed 42
pnpm sim -- --tournament --seed 42   # fixed matchups, --games games each (default 100)
pnpm sim -- --games 1 --bots utility,greedy,greedy --log decisions.jsonl   # decision log
pnpm sim -- --tune --iterations 40 --games 80 --seed 42 --no-invariants   # tune weights -> weights/tuned.json
pnpm --filter web dev
pnpm --filter web build
```

Run `pnpm check && pnpm test` before telling Hans a task is done. If you add a script, add it here too.

## Repository map

- `packages/engine`: pure TypeScript rules engine + AI. **No runtime dependencies, no DOM, no Node APIs.**
- `apps/sim`: Node CLI for bot-vs-bot simulation and weight tuning.
- `apps/web`: Vue 3 + Vite + Pinia table app (static build, PWA).
- `docs/`: rules summary, open rule questions, data entry guide, engine, AI and table app guides, changelog.

## Hard rules

1. **Never invent component data.** Workshop grid values, Action strip layouts, Stock Exchange cards, Bonus cards, Public Figure costs/counts, compass tiles, track values: if they are not already in `packages/engine/src/data/` or written explicitly in the rulebook, add a `TODO_DATA` placeholder and tell Hans. Do not guess "plausible" numbers.
2. **Don't make up rules.** If the rulebook is ambiguous, add the question to `docs/rules-questions.md`, implement the most literal reading behind a named option (e.g. `rules.parkTriggersSecondary`), and mention it in your summary.
3. **The engine is pure and immutable.** `apply(state, move)` returns a new state and never mutates. No `Math.random()` in the engine. All randomness goes through `ChanceOracle`.
4. **Bots only see `visibleState(state, player)`.** No peeking at deck order, face-down stacks or other hidden information, even in simulation.
5. **Every rule change gets a test.** Use the rulebook's worked examples as fixtures where they exist.
6. **State invariants must hold after every `apply`.** Component counts are conserved, there is never more than one assistant per Art Nouveau space, and the needles never point at the same compass space. A shared `assertInvariants()` check runs in tests.
7. Keep `Move` and `GameState` JSON-serialisable (no classes, Maps or functions inside). Game logs and undo depend on this.

## Engine conventions

- The state always contains `pending` (who decides what). `legalMoves(state)` returns moves for that pending decision only. Multi-step actions (Sale, Construction, Bonus resolution) are a sequence of pending decisions, not one giant move.
- Discriminated unions for `Move` and `Pending` (`kind` field). Exhaustive `switch` with a `never` check.
- Name things after the rulebook: `ArtNouveauBoard`, `BrusselsBoard`, `Courthouse`, `WorkshopCursor`, `RoyalTheater`, `Bracket`, `Compass`, `Exhibition`, `BonusCard`, `PublicFigure`, `ArchitectTrack`, `CityHallTrack`, `RoyalPalaceTrack`, `MannekenPis`. Money is `bf`.
- Coordinates: Art Nouveau spaces are `{ row: 0..4, col: 0..4 }` internally. Shields use the rulebook's 1–4 numbering `{ row: 1..4, col: 1..4 }`, so Stock Exchange card data can be entered exactly as printed. Document the mapping in one place (`state/coords.ts`).

## AI conventions

- Each consideration lives in its own file in `ai/considerations/` as a pure function and has its own unit test with a hand-built state.
- Bots return `{ move, score, reason, alternatives }`. Reasons are short, player-facing English sentences (the UI shows them at the table).
- Weights live in JSON (`ai/weights/*.json`), not hard-coded in logic.
- When you change AI behaviour, run a fixed-seed tournament (`pnpm sim -- --tournament --seed 42`) and report the win-rate change.

## Web app conventions

- Tablet-first, big touch targets, readable at arm's length on a table. Works offline after first load.
- The UI never re-implements rules. It renders `legalMoves()` as options and dispatches the chosen `Move`.
- Pinia store holds `history: GameState[]` for undo/redo. Autosave to `localStorage` after every move (wrapped in try/catch).
- Bot moves are shown as clear physical instructions for a human to carry out, followed by a "Done" confirmation.

## Deployment

- `ci.yml`: check + test on every push and PR.
- `deploy.yml`: on push to `main`, build `apps/web` and upload `apps/web/dist` to the web hotel via SFTP (`lftp`). Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR`, optional `FTP_PORT` (default 22). Never commit credentials.
- Railway is reserved for an optional later log/weights API (Phase 7). Don't add a backend before that.

## Git

- Small, focused commits with conventional messages (`feat(engine): sale action cursor movement`).
- Work on a branch per phase or feature; open a PR to `main`.
- Update `docs/CHANGELOG.md` at the end of each phase.

## When unsure

Ask Hans, especially about rule interpretations, component values, and anything that changes how a bot plays. A short question is better than a confident guess.
