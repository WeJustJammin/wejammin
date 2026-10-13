# Lane bundle logs (2026-10-12)

Evidence for `../lane-bundle-report.md`: the CMS editorial route bundle budget (P2-S11-AC-106), its extension of `pnpm bundle:check` and the lazy-contracts refactor that makes every CMS editorial island fit.

## Contents

- `gate-red-1-unit.log`, `gate-unit-*.log`: the unit tests of the extended gate (`tests/performance/cms-editorial-bundle-budget.test.ts`), RED before the gate existed and GREEN after.
- `build-baseline.log`, `build-<n>.log`: the production builds in the order they were made; `bundle-check-red-1.log`: `pnpm bundle:check` on the unmodified build (RED: eleven CMS routes and islands over their thresholds).
- `workflow-vitest-*.log`, `pageactions-vitest-*.log`, `editor-vitest-*.log`, `richtext-1.log`, `structured-values-1.log`, `rules-diff-1.log`, `suite-web-contracts-1.log`, `coverage-contracts-1.log`: the suites run after each step of the refactor.
- `tsc-web-*.log`, `eslint-*.log`, `docs-boundaries-*.log`, `infra-1.log`: type, lint, documentation and contract-entry checks.
- `bundle-*.log`, `e2e-*.log` and the mutation logs: the real-route Playwright runs and their mutation checks, when present.

## Ownership

The `bundle` lane owns this directory. Nothing here is acceptance evidence by itself: the criterion is proven by the tests the report cites and by the ledger.

## Extension

A new run adds its output here under a name that says what it shows (RED, GREEN, a mutation, a repeat) and, in the first line of the
file or in the report, the command that produced it. Never record a result that was not observed, and never overwrite the log of an earlier run.

## Conventions

`*.log` files are git-ignored and exist only in the worktree that ran them; scripts, notes and the other captured outputs are kept as they
were produced. A log whose command is not in its first line names the command in the report. Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-bundle-report.md`
- `../lane-last-gaps-report.md`
- `../../../scripts/verify-bundle-budget.mjs`
- `../../../tests/performance/README.md`
