# Lanes `claude_s12_coverage_{1,2}` — close the 100% Worker coverage threshold for Slice 12

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (HEAD must be `fc62deef` or a later root commit on
`claude/phase2-slice12`; check it). Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not
word-split: multi-file commands go in a bash script. `/bin/ls`, never bare `ls`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-coverage-<n>-report.md` (checkpoint early; keep `## Status` current).

## Problem

`pnpm validate` (`.lane-logs/canonical/validate-20261024T061954Z.log`) passed every test and failed only the global 100%
coverage threshold of `vitest.config.ts` (statements 99.48%, branches 99.18%, functions 99.55%, lines 99.69%). The gaps
are in 47 Slice 12 Worker files, listed with missing counts `{statements,branches,functions,lines}` in
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_root/coverage-gaps.txt`.

| Lane | Files |
|---|---|
| 1 | every path containing `governed-` or `pattern-` (production adapters `apps/worker/src/cms-composition-production-*` and `apps/worker/src/cms-composition/*`) |
| 2 | every other path in the list: taxonomy, locale, related-content, observability, `production-job-effect-dispatcher.ts` |

## Method (tests are the spec; Slice 11 reached 100% narrow coverage the same way)

1. Measure narrowly: `pnpm exec vitest run --coverage --coverage.include=<file> … <the tests that exercise those files>`
   (coverage reporter `text` shows the uncovered line numbers). Never edit `vitest.config.ts` thresholds or includes.
2. For every uncovered statement or branch, read the code and the spec that defines it (BE03c
   `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` — route registry, field/error matrices, typed
   refusals, Worker adapters; BE00 for ApiError/transport). Then:
   - **Reachable behaviour** → a test that asserts the SPECIFIED outcome (status, code, details, no port call, telemetry),
     not one that merely executes the line. Drive it through the real route/adapter with only the external boundary
     faked (PostgREST `fetch`, the session resolver), as the neighbouring tests do. If the code's outcome contradicts the
     spec, that is a defect: write the failing test first (debug-by-test), then fix the code, and name it in the report.
   - **Genuinely unreachable** (a guard the types or an upstream validator already make impossible) → prefer deleting it
     if deletion keeps every test green and the reason is provable; otherwise a single `/* v8 ignore next -- <reason> */`
     with the proof in the reason (repo precedent: 6 such comments, e.g. `apps/web/src/server/cms-workflow-platform-reads.ts:173`).
     Every ignore and every deletion is listed in the report with its proof; keep them rare.
3. Put new cases in NEW test files next to the source (`<name>.coverage.test.ts` or a descriptive name) where possible;
   if you must add to an existing test file, name it in the report (root reruns the evidence receipts for cited files).
4. Do not add test titles that duplicate an existing full test name in the same file (`it.each` titles must interpolate a
   per-case label).

## Runs

Vitest only (no supabase, docker, db, race, Playwright). Final: narrow coverage of your files = 100/100/100/100 with the
command line in the report; the touched packages' tests all pass; `pnpm exec tsc --build --pretty false tsconfig.json`,
`pnpm exec eslint <touched> --max-warnings=0`, `pnpm exec prettier --check <touched>`.

## Claim

Lane 1: the governed/pattern files of the list and new/changed tests beside them. Lane 2: the rest of the list and its
tests. Product code only where a defect or a provably dead branch requires it (name the file first in the report). Never
edit ledgers, receipts, specs, `vitest.config.ts` or another lane's files. Live: root, refutation reviews a/c/d
(read-only), the other coverage lane.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, the narrow coverage line, files with SHA-256
(new/changed tests, any product change with its defect or dead-code proof), every v8 ignore, requests to root.
