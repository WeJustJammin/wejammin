# Slice 09 real-scan pgTAP fragments

Shared include for the `../phase_02_slice_09_scan_*.sql` suites (BE03a real
migration scan, transform registry, per-row evidence). It is a psql `\ir`
include, not a Supabase-discovered test file.

| Fragment | Purpose |
| -------- | ------- |
| `00-guard.sqlinc` | In-test direct-write guard: BEFORE triggers on every producer-owned table record the top-level statement behind each write, so a suite can prove no review, decision, assignment, dry-run, evidence, target-row or plan row was written by a hand-written statement (`s09x_direct`) and that the named RPCs did write them (`s09x_via_rpc`). |

## Adding a suite

1. Include the `../phase_02_slice_09_dec108/00..04` fragments and
   `../phase_02_slice_09_dec119/00-support.sqlinc`, then this guard, and call
   `select pg_temp.s09x_arm();` once.
2. Drive producers only through named RPCs (`s09d_*` chain, `s09w_*` worker).
3. End with a positive `s09x_via_rpc(...) > 0` precondition and a
   `s09x_direct() = 0` assertion so zero is never vacuous.

Related: `../phase_02_slice_09_dec108/README.md`, `../phase_02_slice_09_schema/README.md`.
