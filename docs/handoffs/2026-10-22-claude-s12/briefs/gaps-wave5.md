# Lanes `claude_s12_gaps_{unit5,api5,pw5}` — wave 5: the remaining test-writable Slice 12 gaps

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split: multi-file commands go in a bash script. `/bin/ls`, never bare `ls`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-gaps-<lane>-report.md` (checkpoint early; keep `## Status` current). Proposals:
`docs/handoffs/2026-10-22-claude-s12/recite4/<lane>-proposals.json` in the `recite2/*-proposals.json` schema, written per row as
you finish it, citing only tests whose asserting line you read and (where you may run it) ran green.

## Input

`docs/handoffs/2026-10-22-claude-s12/gaps/inventory-20261029b.json` — every uncited clause with its criterion, clause text,
`class` and the criterion's limitation (which names the missing test). Clause texts and current citations: the CURRENT ledger
`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`. Specs: BE03c, BE03b, FE03 (`.memory/wiki/specs/fe/03-cms-content-modeling.md`),
BE00. Evidence policy DEC-226 (`.memory/raw/events/2026-10-24.jsonl`): a tier label never proves a p95; "every other role" needs
proacl; "consumed at /app/…" needs page-level behaviour; a stubbed-token Worker test counts only if the database raises that token
on that operation (cite the SQL line). Root DEC-235/236/237 (`.memory/raw/events/2026-10-29.jsonl`).

| Lane | Rows (criterion: clause class) |
|---|---|
| `unit5` | worker: AC-039, AC-095, AC-126, AC-128 (both), AC-134 (both), AC-169; web: AC-042 "scoped draft before commit", AC-164 "neither extend the general auth-session resource nor", AC-271, AC-272 |
| `api5` | AC-010 and AC-016 "and complete the declared happy path" (composed apispecs, model `tests/postgrest/phase-02-slice-12-template-version.apispec.ts`), AC-211 "again before publish", AC-238, AC-001 "and accessibility contracts in templates." |
| `pw5` | every `class` = playwright row: AC-042 (focus, render), AC-058, AC-075, AC-093, AC-105, AC-111, AC-129, AC-164 (both), AC-176, AC-182, AC-265 (three), AC-273 |

## Work, per row

1. Confirm the gap is real (search; a test may exist — then report its identity and write nothing). A clause the code cannot
   reach or a consumer that does not exist (e.g. AC-169 server retry with no server caller) → BOUNDARY with lines, no test.
2. Write the test that proves the clause's exact behaviour through the real entry point. New files only, titles unique and
   literal with `[P2-S12-AC-NNN]`; never edit an existing test or suite file. A contradiction with the spec is a defect: keep
   the RED test and name the product fix in your report FIRST (unit5 may fix Worker/web product code it names; api5 SQL fixes go
   to a NEW WIP dir `supabase/migrations-wip/gaps-api5/`, timestamps `20261029120000`–`129999`).
3. `pw5`: real-route Playwright specs (`tests/e2e/phase-02-slice-12-*-real-route.spec.ts` style, project `real-route-chrome`,
   two people where the clause needs them; the harness Worker now serves every Slice 12 boundary —
   `tests/e2e/support/s12-real-governed.ts` and its parity test). You may NOT run Playwright: write, lint, typecheck what can be,
   and list each spec + title for root to run. Page-level means the page at the clause's `/app/…` route, not a component.
4. `api5`: apispecs run only under root's PostgREST runner (write them, name them); pgTAP through the ALT staged runner.
   `unit5`: focused Vitest on your new files and any product file you change (100% coverage holds repo-wide).

## Claim

Only NEW files named in your report (+ named product fixes, + api5's WIP dir, + your proposals file). Never edit ledgers,
receipts, trackers, specs, promoted migrations, existing tests, or the other lanes' files. Root's canonical runs share the
host: ALT runs queue on the CI lock, which is expected.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-row table (criterion, clause, outcome, identity),
runs, files with SHA-256, BOUNDARY items, defects, the specs/apispecs root must run.
