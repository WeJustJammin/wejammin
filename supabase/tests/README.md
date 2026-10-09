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

### Verbose TAP and evidence receipts

`pnpm db:test` (`supabase test db`) prints one verdict per file, which is not
evidence for any single criterion. `pnpm db:test:tap [--out file]`
(`infra/run-pgtap-verbose.mjs`) runs the same suites through the same pg_prove
image with `-v`, so every assertion prints its own `ok N - description` line and
each file prints its plan. `pnpm evidence:collect --pgtap <that file>` turns each
assertion into one receipt per marker; a file that ran fewer assertions than it
planned, has no plan, or numbers its assertions out of order fails every
assertion it printed, SKIP and TODO assertions are `skipped` and never prove
anything, and a file with no assertion lines yields no receipt (the collector
exits 3). Run it right after `pnpm db:reset`, like `pnpm db:test`.

### SEC-2 definer-role guards

`phase_02_slice_09_sec2_definer_rls.sql` proves the CMS tables and
`phase_02_slice_09_sec2_all_schema_definer_rls.sql` proves the same class over
every schema and every forced table: a SECURITY DEFINER function that names a
forced table is owned by one of three NOLOGIN, non-BYPASSRLS roles
(`wejammin_cms_definer`, `wejammin_cms_authority_reader`,
`wejammin_platform_definer`) unless it is on the explicit legacy list
`support/sec2-legacy-bypass-definers.sqlinc` (equality both ways; converting a
legacy function means deleting its row), the exact set of forced tables those
roles touch is pinned, every table privilege has a permissive policy for that
verb, and the administrative MFA reset is refused by row-level security under a
forged or foreign session. `support/sec2-helpers.sqlinc` holds the shared
`SET ROLE` harness.

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

### Slice 11 — editorial workflow and publication

The Slice 11 pgTAP files are `phase_02_slice_11_*.sql`; each entrypoint opens one transaction and rolls back.
Most include fragments with psql `\ir`. Standalone `phase_02_slice_11_first_empty_scope.sql` pins DEC-162's
private initial-scope count helper with controlled draft/type/content fixtures; it is not authenticated
producer, scan/seal-fence or activation evidence. Publication/current-active/cross-owner cases and an
independent locale-only initial predicate remain unproven there. Fragment directories (each with a README): `phase_02_slice_11_schema/`
(the data model, lane S11-2), `phase_02_slice_11_helpers/` (the shared helpers, S11-3s),
`phase_02_slice_11_rpc_review/` (CMS-03B-05, 06, 18; S11-3a), `phase_02_slice_11_rpc_publication/` (CMS-03B-07, 09, 20;
S11-3b), `phase_02_slice_11_rpc_preview/` and `phase_02_slice_11_rpc_reads/` (CMS-03B-08, 15, 16, 17, 19; S11-3c) and
`phase_02_slice_11_e2/` (the derived revision state, S11-3d). The independent-session runners are
`phase_02_slice_11_races/` (`pnpm db:races`).

The guard files that pin the whole catalog carry the Slice 11 names as explicit allow-lists, so an unnamed function or
table fails them: `phase_02_slice_09_r8_api_surface.sql` (the service-role-only supporting RPC set),
`phase_02_slice_09_sec2_all_schema_definer_rls.sql` (the forced tables a definer function names) and
`phase_02_slice_10_ev_eb_publication_scope.sql` (the review, decision, schedule, preview, publication, manifest and
version-set functions and tables).

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
