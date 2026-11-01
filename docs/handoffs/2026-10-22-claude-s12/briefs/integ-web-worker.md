# Lane `claude_s12_integ_web_worker` — shared web/worker integration and one Worker regression (Vitest, no DB)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-integ-web-worker-report.md` (checkpoint early, after every run).

## Inputs

Root's full unit baseline: `.lane-logs/s12-claude-intake-20261022/unit-full.json`. Lane reports with
`## Requests to root` for shared files: `lane-web-locale-report.md`, `lane-web-composition-report.md`,
`lane-dec205-read-report.md`, `lane-dec206-read-report.md`, `lane-governed-recheck-report.md` (all in
`docs/handoffs/2026-10-22-claude-s12/`). Root delegates those shared-file requests to you, as amended below.

## Work items

1. **Worker regression (debug-by-test)**: `apps/worker/src/production-async-entrypoint-taxonomy-merge.test.ts`
   fails 4 tests (missing/changed RPC call sequence: expected 8 calls got 7; empty failure records). Lane
   `claude_s12_governed_recheck` additively edited `async-entrypoint.ts`, `async-runtime-rpc-types.ts`,
   `production-async-entrypoint.ts` (see its report). Find the true cause; if the regression is in that wiring,
   fix the production code (not the test) and prove with the existing failing tests + the governed-recheck and
   Slice 11 entrypoint suites. If the test oracle is stale, cite the spec line.
2. **Reachability**: entry page `apps/web/src/pages/app/cms-content-modeling/entries/[entryId].astro` and its
   loader `load-entry-edit-page.ts` gain the Translate links (`localeVariantLinks`, web-locale report request 1)
   and the Composition link (web-composition report request 1), each with route tests (the composition lane
   left a test block to append to `composition-route.test.tsx`). Keep the page ≤200 lines (extract a small
   component if needed).
3. **`apps/web/src/components/step-up-required.inventory.test.ts`**: classify every new 401-reading mapper
   (expected 73 vs 81 found) as step-up aware or exempt with the correct reason per BE03c catalogs (only
   CMS-03C-07/08/09 carry `STEP_UP_REQUIRED`); cite the catalog row per entry.
4. **Bundle budget**: `scripts/verify-bundle-budget.mjs` + `tests/performance/cms-editorial-bundle-budget*.test.ts`
   declare every CMS content-modeling page exactly once (21 vs 23: the locale and composition pages).
5. **Documentation boundaries** (`tests/documentation-boundaries.test.ts`): `apps/web/src/components/cms-locale/README.md`
   needs the required sections (see the test for the exact headings, e.g. Ownership); every new 3+-file directory
   from the Slice 12 lanes needs a conforming README; `apps/web/src/pages/app/cms-content-modeling/templates/[templateKey].astro`
   is 205 > 200 lines — extract without behaviour change (route tests stay green).
6. **READMEs requested by lanes**: `entries/[entryId]/README.md`, `patterns/README.md`, `apps/web/src/server/README.md`,
   `pages/api/v1/cms/README.md`, `pages/api/v1/cms/entries/[entryId]/README.md`, new `compositions/README.md`.
7. **FE03 step-up wording**: the dec205 lane notes FE03's locale route-protection row says "step-up gates the
   commits and never the read" although the CMS-03C-04 catalog has no step-up row. Do NOT edit FE03; report the
   exact rows that disagree with BE03c (root decides).

## Claim

The files named above, plus new extracted components/tests they require. Not: pgTAP, WIP SQL, contracts,
`tests/contracts/*` (lane `claude_s12_integ_contracts`), Slice 12 pgTAP/WIP (repair lanes).

## Method

Debug-by-test for item 1; RED-first route tests for item 2. Focused Vitest with the pinned toolchain
(`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH pnpm exec vitest run <files>`). Final: the full
`apps/web` and `apps/worker` Vitest projects plus `tests/documentation-boundaries.test.ts` and
`tests/performance/` green; web `astro check`/tsc and eslint on touched files clean.

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, counts, files, Requests to root.
