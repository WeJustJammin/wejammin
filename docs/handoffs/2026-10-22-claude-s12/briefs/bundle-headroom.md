# Lane `claude_s12_bundle_headroom` — restore initial-route bundle headroom (entry editor, taxonomy edit)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split. `/bin/ls`, never bare `ls`. Report `docs/handoffs/2026-10-22-claude-s12/lane-bundle-headroom-report.md`.
`pnpm build && pnpm bundle:check` is allowed for you; nothing database-related; real-route Playwright is root's (name specs).

## Problem

`scripts/verify-bundle-budget.mjs` (`BUNDLE_BUDGETS.initialRouteGzipBytes` 92,160 B; lazy chunks 81,920 B; on-demand
exemptions only in `CMS_ON_DEMAND_CHUNKS`) now FAILS: the CMS entry editor initial route is 92,386 B (it passed at
`cd89d54c`; later contracts preflight reason sets, the taxonomy copy and the term-form leave guard landed in client code),
and the CMS taxonomy edit route has ~112 B headroom, which kept the AC-271 skeleton (`CmsLoadingRegion`) out of
`CmsGovernedReviewPanel`'s subject re-read, `CmsTaxonomyConflictPanel` and `CmsTaxonomyTermChoice`
(`lane-web-impl-report.md`, "Budget-forced exclusion").

## Work

1. Measure: build, record every route's initial gzip bytes and the top contributors of the two routes (esbuild/rollup
   metafile or the budget script's own listing). Find what grew since `cd89d54c` (diff the module lists).
2. Restore headroom without dropping behaviour or weakening the budget: move code that is not needed before first
   interaction into on-demand chunks the existing load-on-intent / `retryable-import.ts` mechanism already uses (e.g. the
   preflight reason copy tables, refusal-detail renderers, the leave-guard dialog body), or trim dead imports. Do NOT touch
   the pattern designer, `CmsPatternNestedPicker` or the pointer-grammar helpers (the nestable-read lane is live there;
   their consolidation is a later lane). Never add a
   route to `CMS_ON_DEMAND_CHUNKS` unless the chunk really is on-demand, and never raise a budget.
3. Target: every initial route ≤ 92,160 B with ≥ 1,024 B headroom on the entry editor and the taxonomy edit route; then
   wire `CmsLoadingRegion` into the three excluded components (FE03 AC-271 rule, fake-timer tests at 249/250 ms) and stay
   in budget.
4. Tests for every moved module (the failed-import retry path included, PAT-031: jsdom does not model the module cache —
   name the real-route specs that cover the moved code for root).

## Claim

The web files you move or trim for the entry editor and taxonomy edit routes (name them in the report before editing). Never edit `scripts/verify-bundle-budget.mjs` budgets, ledgers, receipts, specs or migrations. Live: nestable-read
lane (pattern designer + picker files), gaps-db2, placement-perf.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-route bytes before/after, files with SHA-256,
specs for root, requests.
