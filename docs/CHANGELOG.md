# Changelog

## Phase 0: Scaffolding (2026-10-31)

- pnpm monorepo with `packages/engine`, `apps/sim` and `apps/web`.
- TypeScript 6.0 (strict), ESLint (flat config) + Prettier, Vitest.
- ESLint enforces the engine's purity rules: no Node APIs, no DOM, no `Math.random` in `packages/engine/src`.
- CI workflow: install, `pnpm check`, `pnpm test`, web build.
- `docs/rules-summary.md` (written from the rulebook) and `docs/rules-questions.md` started.
- Note: TypeScript 7 is not used yet, because `typescript-eslint` and `vue-tsc` only support up to TypeScript 6.0.
