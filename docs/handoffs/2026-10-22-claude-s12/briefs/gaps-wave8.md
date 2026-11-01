# Lanes `claude_s12_{web8a,web8b,db8}` — wave 8: FE03 refetch cells (DEC-242) and the reachable concurrency gaps

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (never kill processes by pattern; tar-backup an
untracked file before editing it). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`
(HEAD is root checkpoint 2, `85ab5ff0`). Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not
word-split; `/bin/ls`, never bare `ls`. Report `docs/handoffs/2026-10-22-claude-s12/lane-<lane>-report.md` (checkpoint early,
keep `## Status` current); proposals `docs/handoffs/2026-10-22-claude-s12/recite8/<lane>-proposals.json` (the
`recite2/*-proposals.json` schema) — keep them current after every test move or retitle (review V17 N8). Debug-by-test: RED
first. **Do not spawn sub-agents.** Never run Playwright, races or canonical db commands; ALT pgTAP through the staged runner
only. Components ≤ 200 lines, hooks/utilities ≤ 300, tests ≤ 400; changed-line coverage 100%.

Inputs: FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md` state tables; root decisions DEC-241/242
(`.memory/raw/events/2026-10-29.jsonl`) and the M1 reading (a control that starts another command is disabled while one is in
flight; inputs stay editable; values typed meanwhile survive completion); `lane-web7-report.md` (open items A2, A3, A4, B5, B7,
B8, other 422 reasons, reviewer_not_eligible), `review-v17-report.md` (N1, N5, N7 and the seeds), `review-refute7-report.md`
and `recite7/refutation.json` (AC-271 partRulings; AC-294, AC-085, AC-277 findings), `lane-race7-report.md` (AC-294 plan).

## web8a — template, locale, pattern and vocabulary islands

FE03 409 cell (version conflict refetched automatically, the person's values kept and compared), unknown-outcome cell (the
outcome is reconciled by a read BEFORE any retry is offered), 422 at the field for every reason FE03 names a field for, success
refetch where FE03 says so — in the template create/successor designers, the locale variant form, the pattern designer and the
vocabulary designer + term form/action. Today several islands require an explicit "Check latest version" press and their tests
script it: replace that with the FE03 behaviour, rewriting each such test as a named test correction (not weakened — it must
assert the automatic refetch and the kept values). Locale FALLBACK_CHAIN_MISMATCH stays as is (DEC-242).

## web8b — related content, composition and governed islands

The same 409 / unknown-outcome / success-refetch cells for the related-content form, the composition insert/accept/detach/bulk
islands (B5: if a list refetch needs a browser read the platform does not expose, say so with lines — DEC-206 added a protected
composition-instances read; check whether a browser proxy for it exists before calling it missing), and the governed decision,
assignment and activation forms; `reviewer_not_eligible` (FE03 884 fixed copy plus a refetch of the review); V17 N1 (a row
selection toggled during a command survives completion), N7 (focus after "Read the review again" moves to the restored review's
heading and the outcome is announced), N5 (retitle the two over-claiming rows to what they assert).

## db8 — AC-294, AC-085 and AC-277

dblink two-session pgTAP on the race7 harness (`supabase/tests/phase_02_slice_12_race7/`, may be `\ir`-ed; new files only):
AC-294 per race7's plan (authority/visibility and exact schema/default rechecked after waits: a mid-scenario schema activation and
an entry archive while a writer waits); AC-085 waits observed at lock positions 3 and 4 (refute7 finding 4); AC-277 "locale
source edit versus translation" and "related target unpublish" (refute7: work volume, not a missing spec — build the committed
Slice 11 world they need from existing fixtures). A behaviour contradicting BE03c → RED test, named, then a NEW WIP dir
`supabase/migrations-wip/db8/` (timestamps `20261030100000`–`109999`).

## Claim

web8a: the template (`cms-composition/CmsTemplate*`), locale (`cms-locale/`), pattern (`cms-pattern-designer/`), vocabulary and
term (`cms-taxonomy-designer/`, `cms-taxonomy-terms/`) components and their tests. web8b: `cms-related-content/`,
`cms-composition-instances/`, `cms-governed-review/` and their tests. Shared hooks: name them in your report BEFORE editing; if
both lanes need one, web8b owns it and web8a asks root. db8: SQL tests + its WIP dir. Never edit ledgers, receipts, trackers,
specs, promoted migrations, Playwright specs or another lane's files.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-cell/row table, runs, changed files with SHA-256,
test corrections (old→new), defects, BOUNDARY items, bundle-relevant files.
