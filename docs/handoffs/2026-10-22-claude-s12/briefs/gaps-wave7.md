# Lanes `claude_s12_{race7,web7,pw7}` — wave 7: concurrency, FE03 state table, page-level operations

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (HEAD is the root checkpoint `4f643787`). Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. Report
`docs/handoffs/2026-10-22-claude-s12/lane-<lane>-report.md` (checkpoint early, keep `## Status` current); proposals
`docs/handoffs/2026-10-22-claude-s12/recite7/<lane>-proposals.json` (the `recite2/*-proposals.json` schema), written per row.
Debug-by-test: RED first. **Do not spawn sub-agents** (the host's concurrency cap). Never run Playwright, canonical db commands
or race modules; ALT pgTAP through the staged runner only (it queues on the CI lock).

Inputs: `docs/handoffs/2026-10-22-claude-s12/gaps/inventory-20261029c.json` (66 uncited clauses with their limitations), the
CURRENT ledger `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, BE03c/BE03b/FE03, root decisions
`.memory/raw/events/2026-10-29.jsonl` (DEC-235..241). Evidence policy DEC-226.

## race7 — the 14 `class: race` rows

AC-013, AC-019 ("and concurrency rules."), AC-044 "deletion", AC-047 "concurrency", AC-085 (one transaction in the Slice 12
lock order), AC-086 `activation_conflict`, AC-145 (`FOR UPDATE SKIP LOCKED` claims), AC-205 (activation race → 409
`activation_conflict`, nothing commits), AC-218 (under the revision/slot lock, DEC-185), AC-276 (re-prove capability under the
locks; `deadlock_detected` / lock failure → the operation's 409), AC-277 (the named scenarios), AC-294 (authority/visibility and
exact schema/default rechecked after waits). Prefer **dblink two-session pgTAP** (patterns: `supabase/tests/phase_02_slice_12_taxonomy_integrity_concurrency.sql`,
`phase_02_slice_12_gaps_lock_position4_race.sql`), which you can run on ALT: session A takes the lock and waits, session B's
call is observed blocked (`pg_locks`/`pg_stat_activity` wait evidence, not sleeps), then A commits/aborts and B's exact outcome
is asserted. A behaviour dblink cannot express (worker lease, out-of-order events) may be a race module in the
`infra/database-races/` kit style — write it, name it, root runs it in canonical race mode. A clause whose behaviour is not
reachable → BOUNDARY with lines. New files only; never edit existing suites.

## web7 — FE03 state table (AC-271) and the DEC-241 web items

Start from `lane-web6-report.md` (defect list), its probes `recite4/web6-probes/`, `review-refute5-report.md` (matrix
corrections, the 20 PINNED rows in `recite5/refutation.json` with dropClass PINNED or their FIX notes) and DEC-241. For every
defect cell: RED test asserting the FE03 cell, product fix, green — and rewrite each PINNED row that asserted the defect in the
same change (list each as a test correction). Cells: CMS-03C-13 selector "Place pattern" after a failed Load more; CMS-03C-17
skeleton after 250 ms (not text at 0 ms); governed queue keeps the last verified queue with `lastVerifiedAt`; latest-read
degraded/loading keep submit disabled and the verified comparison; form islands: 403 `CapabilityGate`, 409 refetched
automatically, unknown outcome refetched before retry, success refetches lists, 422 at the field, clear on success; FE03 1048
commit-only disabling in related content, activation and the composition island; G-A1 (a degraded governed detail does not keep
the stale review); AC-042 c5 provenance (render the parent version provenance the resource carries); report what FE03 requires
for 409 `reviewer_not_eligible` before changing it. Cancel/Back stay locked while a command is in flight (DEC-241). Components
≤ 200 lines; repo coverage 100%; READMEs updated.

## pw7 — page-level operations (DEC-241) and the remaining journeys

DEC-241: a mount-only page test does not close "consumed by … at /app/…". Write real-route specs that PERFORM the operation
from the page for AC-058 (CMS-03C-04 save from `/entries/:entryId/locales/:locale`), AC-105 (CMS-03C-12 save from
`/patterns/new` and from `/patterns/:patternKey`), AC-111 (CMS-03C-13 options listed and a pattern placed from the instance-insert
form on `/entries/:entryId/composition`); then the AC-273 journeys pw5 could not drive — template (the template routes now go to
production for real sessions: `tests/e2e/support/s12-real-template-locale.ts`), term merge, locale variant with `no_fallback`,
related content pinned and excluded. Follow `tests/e2e/phase-02-slice-12-definition-journeys-real-route.spec.ts` and the
harness README; write, lint, ad hoc tsc; list every spec + title + project for root; register nothing in the configs (root does).

## Claim

New files named in your report; web7 also the product components it names first (not the files of another active lane:
race7 is SQL-only, pw7 is tests/e2e-only). Never edit ledgers, receipts, trackers, specs, promoted migrations or another lane's
files. A spec contradiction → keep the RED test, name it, stop for root.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-row table (criterion, clause, outcome, identity),
runs, files with SHA-256, BOUNDARY items, defects, what root must run.
