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

The R12 holdover files are `phase_02_slice_09_canonical_json_equivalence.sql` (the
single-pass JSON helpers against verbatim copies of the previous implementations),
`phase_02_slice_09_r12_successor_workflow.sql` (AC390 producer path) and
`phase_02_slice_09_r12_scan_failure.sql` (AC641 failed attempt through the worker
failure call, no trigger disabling). The R13 AC034 scope-concealment proof (404 for a foreign or
absent target scope, 403 for a member without schema_designer) lives in
`phase_02_slice_09_p240_a01_aggregate.sql`.

### JWT claims in pgTAP

PostgREST publishes the verified token only as the JSON setting
`request.jwt.claims`, and every authority gate reads it through
`platform_private.request_jwt_claim`. A test sets claims with the shared
`pg_temp.set_jwt_claim(name, value[, is_local])` helper from
`support/jwt-claims.sqlinc` (include it with `\ir support/jwt-claims.sqlinc`
before the first `begin;`; included fixtures inherit it). It merges one claim
into the JSON, so `role` and `sub` stay independently settable; an empty value
removes the claim. Never set the pre-v10 per-claim settings: nothing reads them.
`sec1_jwt_claims_source.sql` is the catalog guard (no function, policy, view,
default, constraint or trigger reads them) and exercises each gate with the real
setting. The real Kong -> PostgREST proof is `tests/postgrest` (`pnpm db:api-test`).

### Definer roles in pgTAP (SEC-2)

The Slice 09 functions run as the NOLOGIN `wejammin_cms_definer` role, so the forced policies apply
inside them. Three consequences for a test:

- Selecting an actor with `pg_temp.s09d_session` stands for a NEW request: it clears the published
  session, the MFA subject and the RPC flag, as a fresh PostgREST transaction would. A Worker command
  (claim, sweep, snapshot) runs with `request.jwt.claims` role `service_role` and no human session.
- A test that calls a definer helper directly (a projection, a hash rebuild, a guard) holds the RPC
  context for the call (`select set_config('app.cms_rpc', 'true', true)` before, `''` after), as the
  command that normally calls it does.
- A hand-written write to a guarded table is a forgery. Label it (`FIXTURE FORGERY`, `TIME-WARP` or
  `NEGATIVE CONTROL`), set the flag around it, and never use it to claim a producer path. Authority
  that has a command is provisioned through that command (`initialize_cms_owner`,
  `rpc_create_organization`, `identity_context_bind`, CMS-03A-15).

`phase_02_slice_09_sec2_definer_rls.sql` is the guard: catalog ownership N/N, behaviour under
`SET ROLE wejammin_cms_definer` with forged, foreign and authorized sessions, every `platform_api`
function called under `anon`, `authenticated` and `service_role` with `request.jwt.claims`, and the
RPC flag restore.

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
