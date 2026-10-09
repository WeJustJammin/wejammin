# Lane S11-G — guard cascades, type regeneration, README rows, full DB verification (read ORCH/lanes/COMMON.md first)
All Slice 11 SQL lanes are finished (S11-2, 3s, 3a, 3b, 3c, 3d; S11-SR may still be fixing 017000..017595 — do not edit those files; read
ORCH/s11/lane-s11-sr-report.md before the full run). You own the ORCHESTRATOR-OWNED files below.
1. Apply every GUARD CASCADE row from ORCH/s11/lane-s11-{3s,3a,3b,3c,3d}-report.md to:
   supabase/tests/phase_02_slice_09_r8_api_surface.sql (classify each new cms_ function into its named set with its exact grants),
   supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql (forced-table set),
   supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql — rewrite its six assertions as an explicit ALLOW-LIST of the named Slice 11
   functions/tables (the file must still FAIL if any unnamed review/decision/schedule/preview/publication function appears); keep the
   header's intent, cite DEC-149 and BE03b, and keep each assertion's description stable where the meaning is unchanged (the Slice 10 evidence
   ledger cites these titles — list every title you change in your report).
2. tests/integration/phase-02-slice-10-ev-eb-publication-boundary-schedule.test.ts pins "the nine Slice 10 operations": cascade the same way
   (Slice 10 nine stay asserted; the Slice 11 operations are an explicit named allow-list). List changed titles.
3. Regenerate DB types: `cd LANE && flock /tmp/wejammin-supabase-ci.lock bash -c 'pnpm db:reset && pnpm db:types'`; then `pnpm db:types:check`.
4. README rows: supabase/migrations/README.md (Slice 11 sections — S11-2 report "Proposed docs" + one line per lane range 017500/017600/
   017700/017850/018000), and a README.md in each new test directory with more than 2 files (supabase/tests/phase_02_slice_11_*/ and
   supabase/tests/phase_02_slice_11_races/ if it has none) following the existing README style.
5. Full verification: `ORCH/bin/lane-db.sh LANE` (all pgTAP), `node infra/run-database-race-runners.mjs` via the lock (check how
   `pnpm db:races` invokes it; run `flock /tmp/wejammin-supabase-ci.lock pnpm db:races` if it does not lock itself), `supabase db lint` per
   the S11-3s report command. Classify every red by owner; bench128 p95 reds under host load: re-run once quiet and report both.
Usage is tight: be economical. Report ORCH/s11/lane-s11-g-report.md with checkpoints. Final chat <=5 lines.
