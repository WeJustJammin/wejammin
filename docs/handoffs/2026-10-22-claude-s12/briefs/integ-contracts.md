# Lane `claude_s12_integ_contracts` — cross-slice contract/meta test reconciliation (Vitest, no DB)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-integ-contracts-report.md` (checkpoint early, after every run).

## Situation

Root's full unit baseline (`pnpm exec vitest run`, JSON `.lane-logs/s12-claude-intake-20261022/unit-full.json`):
28,700 tests, 21 failed in 15 files. Your failures (all in `tests/contracts/`):

1. `phase-02-slice-09-amendment-evidence.test.ts` and `phase-02-slice-09-marker-citations.test.ts`: marker
   `P2-S09-AC-1166` now lives in `apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts` (a lane
   split `locale-routes.test.ts`) but the Slice 09 evidence ledger cites the old file.
2. `phase-02-slice-09-pre-traceability.test.ts` (2): phase mirror expects `**3325 authored / 3321 active**` and
   "S12 plan rows: expected 296 to be 285" — the DEC-202 cascade (2026-10-17, +11 Slice 12 criteria
   AC-286…296) left the phase totals/plan-row expectations inconsistent across `phase-2.md`, the trackers and
   this test. Reconcile to the TRUE current counts (count criteria from the files; do not guess) — a
   tracking/document correction, not a criterion change.
3. `phase-02-slice-09-race-runner-gate.test.ts`: the registry of independent-session `.mjs` race runners under
   `supabase/tests` differs from the files present (new Slice 12 runners). Register exactly the files that exist.
4. `phase-02-slice-11-closeout.test.ts`: an unexpected `BOUNDARY:` marker reported in
   `supabase/migrations/20261010165000_cms_projection_consumer_state.sql` (a promoted, immutable migration —
   NEVER edit it). Find why the test now reports it (the test's allowlist/tracking vs DEC-197 #127 sentinel
   replacement history; see DEC-197 in `.memory/wiki/decisions.md`) and fix the test's expectation only if a
   cited record shows the marker is the tracked one; otherwise report to root.
5. `phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts` (2): `DEC197: applied version/name
   mismatch` from `infra/database-upgrades/delivery-receiving-upgrade-local-inventory.mjs:204`. Diagnose (likely
   the promoted-migration inventory grew since the fixture). These belong to the HELD DEC-197/203 native
   machinery: you may fix a stale unit fixture/expectation with evidence, but never run native/Docker/database
   code and never change the DEC-203 pinned sources listed in
   `.memory/pipeline/progress/verification/2026-10-21-bootstrap-observation-green-source-pins-v3.json`.
6. `phase-02-slice-11-process-record.test.ts`: 5 RED identities named by the Slice 11 process record no longer
   exist as titles (Slice 12 lanes renamed/split tests). Restore traceability (update the record's identity to
   the renamed title with a note, or restore the title) — never delete the record.
7. `phase-02-slice-11-sql-parity.test.ts` [P2-S12-AC-241]: expected only `locale` to replace the seeded reference
   gate but `pattern` is replaced too (DEC-193/199 WIP `20261016044400_cms_preflight_pattern_provider.sql`). Update
   to the spec truth (BE03c §"Preflight providers registered by Slice 12": pattern, taxonomy, locale), citing it.

NOT in scope: the receipt/evidence guards (`phase-02-slice-09-receipts-guard`, `phase-02-slice-10-evidence-guard`,
`phase-02-slice-11-evidence-guard`) — they need regenerated machine receipts after promotion and canonical runs
(root, later). Do not hand-edit receipts or hashes.

## Claim

`tests/contracts/phase-02-slice-09-*`, `phase-02-slice-10-*`, `phase-02-slice-11-*` test files and their
fixture/data modules, the Slice 09 evidence-ledger data files, `.memory/wiki/specs/phases/phase-2.md` and
slice-tracker HEADER count lines only (no criterion text or checkbox), `scripts/` meta-test registries the
tests read. Not: pgTAP files, WIP SQL, apps/ code. Each change cites its evidence.

## Method

Debug-by-test: each failure is already a failing test; confirm its cause by reading, fix minimally, rerun the
focused file. Final: the seven files plus `tests/contracts/phase-02-slice-12-*` and
`tests/contracts/phase-02-dec202-progress-denominator.test.ts` green, and
`node scripts/check-progress-consistency.mjs --quiet` exit 0. Pinned toolchain
(`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH pnpm exec vitest run <files>`).

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, counts, files, Requests to root.
