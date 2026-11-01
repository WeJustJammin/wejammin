# Lanes `claude_s12_{web9a,web9b}` — wave 9: close review V20 and refute8b, then the last AC-271 cells and AC-069/AC-164

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (never kill processes by pattern; tar-backup an
untracked file before editing it). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`.
Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. Run
EVERY command in the FOREGROUND — no `run_in_background`, no monitors (a lane sat idle 36 h waiting on one). Never run
Playwright, races or db commands. **Do not spawn sub-agents.** Report `docs/handoffs/2026-10-22-claude-s12/lane-<lane>-report.md`
(checkpoint early, keep `## Status` current); proposals `docs/handoffs/2026-10-22-claude-s12/recite9/<lane>-proposals.json` (the
`recite8/*-proposals.json` schema, rows with `part` and `cell`), kept current after every retitle. Debug-by-test: RED first.
Components ≤ 200 lines, hooks/utilities ≤ 300, tests ≤ 400; changed-line coverage 100% (prove it with a v8 coverage run and
list uncovered changed lines — V20 m6 caught a false "0 uncovered"); 0 new import cycles; READMEs name every new file.

Inputs: `review-v20-report.md` (findings by id), `review-refute8b-report.md` + `recite8/refutation-8b.json` (AC-271 part matrix:
`error` and `degraded` open cells, `missedRows`, FIX rows, `retitleMap`), FE03 state tables and "Network and retry contract",
root decisions DEC-241..245 (`.memory/raw/events/2026-10-29.jsonl`, `2026-10-30.jsonl`) and the rulings below.

**Root rulings for this wave (DEC-246, owner may override):** (1) every CMS browser read gets the shared 8,000 ms deadline
`apps/web/src/lib/read-deadline.ts` (root wrote it, tested); on expiry the island shows its failed/degraded cell with its retry
control, never a frozen send; the two local `READ_DEADLINE_MS` copies (`related-conflict-read.ts`, `locale-source-refresh.ts`)
move to it; (2) `keepRetired` keeps only rows of the CURRENT draft revision; (3) a repeated failed re-check announces a sentence
that differs from the previous one, so a screen reader hears it; (4) the digest-409 copy says the block choices were read again
and the values are kept — no "Reload" (shorter than today: the pattern edit route has 94 B of budget, taxonomy edit 64 B);
(5) the composition placement's digest 409 re-reads what went stale (V20 m9), like the designers (DEC-245(1)).

**Bundle:** both lanes build into the same `apps/web/dist`, so ALWAYS build and measure under one lock, in the FOREGROUND:
`flock /tmp/wejammin-web-build.lock sh -c 'pnpm build > <scratch>/build.log 2>&1 && cp -r apps/web/dist <scratch>/dist && node scripts/verify-bundle-budget.mjs <scratch>/dist'`
before you report; no budget change;
anything new after a command goes behind `CMS_ON_DEMAND_CHUNKS` with a proof test, as wave 8 did.

## web9a — template, locale, pattern, vocabulary/term, registry read

V20 **B1** (preload `taxonomy-versions-read` in `CmsTaxonomyVersionDesigner.latest-states.test.tsx`; then a cold
`vitest run apps/web` must be green — clear `node_modules/.vite/vitest` results first or run with `--no-cache` if available),
**M1** both sentences (ruling 4), **m1** (ruling 1 for the registry context read), **m2** (pin the successor's registry hold:
a test that fails with `registry.holding` removed), **m4** (an edit clears `entryMoved`), **m7** = refute8b web8a idx 43 (rewrite
the pattern states row to assert the context re-read, retitle), **m8** (the live region exists before its content), **n1**
(READMEs), **n3** (title says what it compares, or compare with the contract too). AC-271: add the locale 422 row refute8b names
(`CmsLocaleVariantForm.states.test.tsx:196-209`) to your proposals; the connected taxonomy selector "first page, then a 503 keeps
the last page" test (refute8b `degraded` open cell; fix the product if it fails); the closing words "no-store and never
optimistic" for every read and command of your islands — a test per family asserting `cache: 'no-store'` and that nothing on the
page changes before the server answers (the create designer's key read has neither today). **AC-164 c3/c6**: the template pages
(`templates/new.astro`, `templates/[templateKey].astro`) disable submission with the sign-in, capability, rate-wait or retry state
when `cmsTemplateContextRead` is missing, denied or degraded — make the 403 / 429 (Retry-After) / 5xx answers testable (extract
the inline page logic into a tested module if needed) and test each.

## web9b — related content, composition, governed

V20 **m3** (ruling 2), **m5** (ruling 3), **m6** (test the failed-chunk path of `taxonomy-versions-on-demand.ts:22` — your lane's
seam), **m9** (ruling 5), **m10** (ruling 1 for composition reads; the M3 hold must end on expiry), **n4** (script the instance-list
reads the 74 tests leave unscripted, so each asserts the refetch it triggers; none may pass on an ignored 503). refute8b:
AC-284/285 "keeps the ordered pins" — the title claims "beside the server state the 409 read by itself": assert it or retitle;
the governed submit form's plain 401 (error cell) test; the governed queue degraded rows still titled "(kept half …)" — retitle
to what they assert (DEC-242(1)); the 6 BLIND rows (refute8b) — make each fail with its guard removed, or say why it cannot.
AC-271 closing words for your islands, as web9a (the composition instance-list read asserts neither no-store nor never-optimistic
today). **AC-069**: a behavioural page-mount test that `CmsGovernedReviewPanel` is hosted on the template and pattern pages (the
page renders it for a subject; the three source-text tests were refuted).

## Claim

web9a: `cms-composition/CmsTemplate*`, `cms-composition/{cms-registry-read,registry-read-*,cms-template-context-read,use-registry-context,CmsRegistryChangeNotice}*`,
`cms-locale/`, `cms-pattern-designer/`, `cms-taxonomy-designer/` (except `taxonomy-versions-on-demand*`), `cms-taxonomy-terms/`,
the connected taxonomy selector, `pages/app/cms-content-modeling/templates/`, `pattern-designer-*`. web9b: `cms-related-content/`,
`cms-composition-instances/`, `composition-*`, `cms-governed-review/`, `taxonomy-versions-on-demand*`, the pattern/template page
mount test for AC-069. Shared files (`scripts/verify-bundle-budget.mjs`, `tests/performance/cms-editorial-bundle-budget-mounted.test.ts`,
`apps/web/src/lib/`): one block each, name it in your report before editing. Never edit ledgers, receipts, trackers, specs,
migrations, Playwright specs or the other lane's files.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-item table (V20 id / refute8b item / AC → outcome),
runs (cold `vitest run apps/web` totals, tests/performance, tsc, eslint, coverage, cycles, bundle per CMS route), changed files with
SHA-256, test corrections (old→new), defects, BOUNDARY items.
