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
