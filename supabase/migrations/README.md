# Database migrations

## Contents

Timestamped SQL files define the canonical PostgreSQL schema, RLS policies,
authority functions, audit records, and forward-only compatibility changes.
They run in filename order during local reset and CI verification.

## Ownership

This directory owns schema evolution only. Application orchestration belongs in
`packages/application`; generated TypeScript projections belong in
`packages/data-access/src/database.types.ts`.

## Extension

Add a new timestamped migration for every schema change. Never rewrite a
migration that has been applied to a shared environment. Use a forward fix and
pair it with pgTAP coverage in `../tests`.

## Conventions

- Qualify objects with their schema.
- Enable and force RLS on private authority tables.
- Revoke default access before granting the narrow executable boundary.
- Keep `security definer` functions on a fixed, empty `search_path`.
- Treat destructive rollback as prohibited production behavior.

## Slice 09 DEC-108 schema-review chain

`20261002120000` to `20261002137000` add the CMS-owned activation producers in
dependency order: capability and workflow-policy registries, the three private
review tables and their invalidation triggers, attempt-scoped dry-run reports and
plans, the versioned artifact compiler, shared review authority helpers, then
one command per migration (successor, dry-run, submit, assign, decide, review
read, template-compatibility resolver, activation, detail projection), the
state and edit-in-review fixes, and a final grant sweep. The `platform_api`
wrappers are service-role only and every `platform_private.cms_*` function stays
ungranted. pgTAP coverage is `../tests/phase_02_slice_09_dec108_*.sql`.

## Slice 09 editorial policy evidence and owner CMS grants

`20261002138000` replaces the fail-closed `cms_editorial_workflow_policy_evidence`
stub (DEC-109): it resolves the policy a content-type version binds through
`workflow_key`/`workflow_version` from the seeded `cms_workflow_policies`
registry and returns NULL on absence, ambiguity or a malformed binding, so
`cms_create_entry` succeeds for an activated type and still refuses
(`DEPENDENCY_UNAVAILABLE`) otherwise. `20261002139000` to `20261002145000` add
the owner CMS capability grants (DEC-119, DEC-120): the closed grantable registry,
the `cms_capability_grants` aggregate (term at most 90 UTC days, `valid_through -
valid_from <= 89`) and its append-only `cms_capability_grant_events`, the
owner-initialization backfill, shared owner/eligibility/projection helpers, then
one command per migration (grant CMS-03A-15, renew -16, revoke -17, list -18) and a
final grant sweep. Every write also upserts the `organization_actor_grant`
projection in the same transaction. The `platform_api` wrappers are service-role
only. pgTAP coverage is `../tests/phase_02_slice_09_dec109_*.sql` and
`../tests/phase_02_slice_09_dec119_*.sql`.

## Slice 09 real migration scan and transform registry

`20261002146000` seeds the code-owned `cms_schema_transform_registry`
(`identity.revalidate` v1 and `default.fill_literal` v1, digest = JCS SHA-256 of
the member definition, equal to the Worker's registry literals) and replaces the
hard-coded pair list: an unregistered pair never resolves. `20261002147000` adds the
private append-only `cms_schema_migration_target_rows`, the live source-row set
(revisions and publication versions of the source version, ordered by table and
id), the canonical row documents and hashes, the registered executor contract and
the service-role `cms_read_schema_migration_source_rows` RPC. `20261002148000`
replaces the counter-arithmetic batch processor with one that derives every counter
from per-row evidence (dry run appends `cms_schema_dry_run_row_evidence`, backfill
replays against it and writes the target rows) and replaces the all-zero
source-evidence guard with the evidence/counter consistency predicate.
`20261002149000` to `20261002151000` record the proven source row count at plan
creation, restart the backfill cursor, seal and verify from the recorded evidence,
and fence both switch paths against source drift. `20261002152000` fixes the
redefinition of an existing field of a successor draft (it addressed the source
version's definition row). `20261002153000` lets a fresh dry-run attempt supersede a
completed plan whose scanned source has since drifted. pgTAP coverage is
`../tests/phase_02_slice_09_scan_*.sql` and the rewritten
`../tests/phase_02_slice_09_schema/` fragments.

## Slice 09 DEC-111 step-up MFA identity state

`20261002154000` adds `identity.auth_user_bindings.mfa_version` (the per-account
ETag), `identity.mfa_factor_registry` and `identity.step_up_challenges` (forced
RLS, no client grant, state-machine and immutability triggers; rows are deleted
only by the retention sweep). They hold protected application and provider
references and lifecycle state only, never a TOTP secret, URI, code or token.
`20261002155000` holds the private support functions (binding lock, CAS, safe
projection, evidence writers, first-party session rotation, the code-owned step-up
capability designation and the fail-closed last-factor guard).
`20261002156000` to `20261002158000` are the service-role-only `platform_api`
RPCs the Worker calls: factor read, enrollment begin/finish/verify prepare/settle,
`mark_reconciling` and the reconciler's `auth_mfa_factor_reconcile`; removal
begin/finish; step-up challenge begin/finish/verify prepare/failure record/settle.
The settle RPCs rotate the first-party session in the same transaction.
`20261002159000` adds `platform_private.admin_mfa_factor_resets`,
`identity.rpc_admin_reset_mfa_factors` and the CFG-05B-06 wrappers
`admin_mfa_factor_reset` and `admin_mfa_factor_reset_settle`. `20261002160000`
widens the identity rate-limit vocabulary to AUTH-API-01..21 and `20261002161000`
adds the retention sweep `auth_mfa_registry_sweep`. pgTAP coverage is
`../tests/phase_02_slice_09_dec111_*.sql`.

## Related links

- `../tests/README.md`
- `../../docs/runbooks/platform/release-recovery-gates.md`
- `../../.memory/wiki/specs/be/00-infrastructure.md`
