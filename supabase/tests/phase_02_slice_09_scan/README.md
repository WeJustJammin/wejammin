# Slice 09 real-scan pgTAP fragments

Shared include for the `../phase_02_slice_09_scan_*.sql` suites (BE03a real
migration scan, transform registry, per-row evidence). It is a psql `\ir`
include, not a Supabase-discovered test file.

| Fragment | Purpose |
| -------- | ------- |
| `00-guard.sqlinc` | In-test direct-write guard: BEFORE triggers on every producer-owned table classify each write from the PL/pgSQL call stack (GET DIAGNOSTICS PG_CONTEXT). A write is a producer write only when its innermost function is a `platform_private`/`platform_api` function that existed when the guard was armed; a hand-written statement, a DO block, a pg_temp helper (even one named like a producer) and a function created after arming are all direct writes (`s09x_direct`), so a suite can prove no review, decision, assignment, dry-run, evidence, target-row or plan row was substituted and that the named RPCs did write them (`s09x_via_rpc`). `../phase_02_slice_09_evidence_paths.sql` proves each bypass is caught (AC713). |

## Adding a suite

1. Include the `../phase_02_slice_09_dec108/00..04` fragments and
   `../phase_02_slice_09_dec119/00-support.sqlinc`, then this guard, and call
   `select pg_temp.s09x_arm();` once.
2. Drive producers only through named RPCs (`s09d_*` chain, `s09w_*` worker).
3. End with a positive `s09x_via_rpc(...) > 0` precondition and a
   `s09x_direct() = 0` assertion so zero is never vacuous.

## Two-session race runner

`010-entry-lock-race.mjs` proves, across two committed `psql` sessions, that an
entry write and the activation switch serialize on the source version row (an
in-flight entry makes the switch block and then refuse with
`MIGRATION_SOURCE_DRIFT`; an in-flight switch makes the entry block and then be
refused with CONFLICT by the version-lock guard). Run it only right after
`pnpm db:reset` and run `pnpm db:reset` again afterwards: it commits the owner
initialization and immutable rows, which would break the pgTAP suites. It is not a
Supabase-discovered test.

Related: `../phase_02_slice_09_dec108/README.md`, `../phase_02_slice_09_schema/README.md`.
