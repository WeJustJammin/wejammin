# Database contract tests

## Contents

The pgTAP files verify migrations, privilege boundaries, RLS, idempotency,
state machines, restore fencing, and recovery provenance against a reset local
database.

## Ownership

This directory owns executable database acceptance evidence. It does not own
the schema under test or application-level orchestration.

### Slice 08 — Admin workspace foundation

`phase_02_slice_08_{schema,boundaries,semantics}.sql` owns acceptance evidence
for the seven `platform_private.admin_*` tables, forced RLS/no direct DML,
strict constraints/indexes/FKs, and the active Worker-only RPCs
`platform_api.admin_inbox`, `admin_capability_action`, and
`admin_audit_diagnostic`. Search/bulk execution and diagnostic-run execution
remain deferred; diagnostic definition/run tables are forward-only foundations.
The focused `phase_02_slice_08_{security_reaudit,inbox_reaudit,audit_reaudit,
context_capabilities_reaudit}.sql` suites pin purpose-grant approval, durable
CAS/idempotency, filtered pagination/freshness, disclosure-safe audit reads,
and the service-only capability-context seam.

### Slice 09 — acceptance evidence markers

Every assertion that proves a Slice 09 acceptance criterion carries the marker
`[P2-S09-AC-NNN]` in its pgTAP description (or its runner check label), so
`grep -rn "\[P2-S09-AC-NNN\]" supabase/tests` lists exactly the tests behind
one criterion. The lane files are `phase_02_slice_09_evidence_{cms09_10,
cms11_14,grants,constraints_reviews,constraints_grants,constraints_reports,
paths,mfa,misc,bench128}.sql`; the shared
`phase_02_slice_09_dec108/05-probes.sqlinc` isolates one real CHECK, NOT NULL,
unique constraint or partial unique index of a table (copying the table's own
definition into a temp table), probes every foreign key, generates a violating
row for every CHECK, and lists the functions that write a table, so a new writer
fails the file that pins the writer set. `phase_02_slice_09_schema/011-constraint-probes.sqlinc`
runs those generated probes over every BE03a persistence table at the end of the
schema entrypoint. The two-session runners are
`phase_02_slice_09_dec108/012-concurrent-commands.mjs`,
`phase_02_slice_09_scan/010-entry-lock-race.mjs`,
`phase_02_slice_09_dec111/{010-admin-reset-race,011-verification-lock-race}.mjs`
and `phase_02_slice_09_schema/009c-independent-sessions.mjs`; run each only
right after `pnpm db:reset` and reset again afterwards (they commit rows).

## Extension

Add tests beside the migration that introduces a behavior. Cover both allowed
and denied paths, including direct-table and service-role bypass attempts.

## Conventions

- Declare an exact plan and keep assertions deterministic.
- Run against disposable local data only.
- Roll back fixture data at the end of each test file.
- Never claim hosted PITR or provider behavior from synthetic evidence.

## Related links

- `../migrations/README.md`
- `../../docs/runbooks/platform/release-recovery-gates.md`
- `../../packages/data-access/src/database.types.ts`
