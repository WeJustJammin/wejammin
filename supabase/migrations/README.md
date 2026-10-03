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

## Slice 09 OD-4 locale configuration, multi-field scan, drift recovery, version lock

`20261002162000` adds `ownerCapability` (the resolved definition version's
`owner_capability`) to the CFG-05A-02 effective-value result. `20261002163000`
adds the immutable locale configuration of a content-type version
(`supported_locales`, `fallback_chains`, `locale_config_hash`, an immutability
trigger, and the pure validator `platform_api.cms_validate_locale_config` plus
`cms_locale_config_hash`, whose JCS SHA-256 matches the contract vectors).
Existing versions were backfilled deterministically from their own
`source_locale`/`default_locale`: `supported_locales` is the unique set
`{source, default}` sorted by UTF-8 bytes and every supported locale other than
the default gets the chain `[default]`; existing `definition_hash` values are
immutable evidence and are not rewritten, only versions compiled afterwards
compose `localeConfigHash` into `definition_hash`. `20261002164000` carries the
configuration through CMS-03A-01 (required request keys, exact 422 violations as
machine DETAIL `{"violations":[{"pointer","message"}]}`), CMS-03A-09 (both null
clones, both present replaces under the inherited source/default), the candidate
definition request, the artifact hash and every `ContentTypeVersionResource`.
`20261002165000` freezes `locale_config_hash` on the schema review and has both
switch paths refuse with CONFLICT when the candidate no longer recomputes to it;
the activation resource and the `cms.schema.activated.v1` payload carry it.
`20261002166000` makes a removed supported locale or a changed retained chain
`breaking` (a new locale is additive); `20261002167000` makes CMS-03C-04 enforce
the active version's supported locales (422) and exact fallback chain (409
`VERSION_MISMATCH` with DETAIL `{"reasonCode":"FALLBACK_CHAIN_MISMATCH",
"activeFallbackChain":[...]}`).

`20261002168000` is the multi-field scan protocol: the source-row read RPC returns
`{rows, nextCursor, done, targetFields[], retiredFields[]}` (a page with
`done = false` holds exactly `limit` rows), several changed fields are admitted
(`MIGRATION_TARGET_FIELD_AMBIGUOUS` is gone), retired fields are carried
unvalidated, a retire-only plan seals clean, and the batch, backfill and verify
recomputation use the same per-field semantics. `20261002169000` is drift
recovery: a raised error rolls its transaction back, so the invalidation rides
on the recovery command instead of the refusal. A new dry run is admitted for a
review/approved candidate whose scanned source drifted and atomically
invalidates the review (decisions stay as history), returns the candidate to
draft and starts the fresh attempt; the non-raising verify verdict
`MIGRATION_SOURCE_DRIFT` does the same eagerly. Without drift a frozen candidate
still refuses with CONFLICT. `20261002170000` closes the entry/switch race with
a `BEFORE INSERT` guard on `cms_entry_revisions` and `cms_publication_versions`
that takes `FOR SHARE` on the target version row and refuses a write that waited
behind a switch (superseded version) with CONFLICT; both switch paths already
lock the source version `FOR UPDATE` before the final unchanged check. pgTAP
coverage is `../tests/phase_02_slice_09_od4_locale_config.sql`,
`../tests/phase_02_slice_12_locale_config_enforcement.sql`,
`../tests/phase_02_slice_09_scan_multifield.sql`,
`../tests/phase_02_slice_09_scan_drift_recovery.sql` and
`../tests/phase_02_slice_09_entry_version_lock.sql`; the two-session race is
`../tests/phase_02_slice_09_scan/010-entry-lock-race.mjs`.

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

## Slice 09 Codex review follow-ups (stage 6)

`20261002171000` carries every row unchanged for a field-neutral breaking or
conditional plan (no target field, no retired field, such as a locale-only
change) instead of failing each row as unprovable; the registry behavior
identifiers and transform digests are unchanged. `20261002172000` makes a
completed migration plan immutable evidence of its exact attempt: CMS-03A-10
refuses to replace it only while every persisted fingerprint (source rows and
hash, target definition, compiler and artifact identity, classification,
transform pair and hash) equals the freshly computed one, otherwise it
supersedes the plan and starts a new attempt. `20261002173000` resolves the
risk class a worker activation reports (response, already-active replay,
`cms.schema.activated.v1`) from the approved review snapshot bound to the
candidate's frozen policy key, version and hash, never the newest registry
version. `20261002174000` requires `tenure.starts_on <=` the current UTC date in
every effective-capability predicate and the CMS grant subject-eligibility
check, and CMS-03A-15 locks and rechecks the subject's tenure row.
`20261002175000` makes the administrative MFA reset authorize from locked
state: target serialization lock first, then the operator grant, then the
target's tenure and person rows (`FOR SHARE`) with the membership predicate
rechecked immediately before the identity reset; the independent-session race
is `../tests/phase_02_slice_09_dec111/010-admin-reset-race.mjs`.
`20261002176000` adds the shared account-scoped MFA verification lock
(`identity.mfa_verification_lockouts`, ten failures in a sliding 15 minutes
persist a 15-minute lock, no operation id in the key). Both verify-prepare RPCs
refuse a locked account with `MFA_VERIFICATION_LOCKED:<seconds>` before any
provider contact; `auth_mfa_verification_failure_record` charges enrollment
failures and `auth_step_up_challenge_failure_record` charges the same budget in
its own transaction (response unchanged). Concurrency is proven by
`../tests/phase_02_slice_09_dec111/011-verification-lock-race.mjs`; pgTAP is
`../tests/phase_02_slice_09_dec111_mfa_verification_lock.sql`. Run the `.mjs`
runners only right after `pnpm db:reset` and reset again afterwards.
`20261002177000` makes CMS-03A-10 refuse (409) a new dry-run attempt while an
earlier plan of the version pair is `running`, `verifying` or `failed_retryable`
and its scanned source is unchanged (BE03a "Canonical records and fields");
a drifted source stays the one recovery that supersedes an in-flight plan.
`20261002178000` makes CMS-03A-13 deny a known readable review with 403 when
the caller is a confirmed member of the review's owning party acting as it but
holds neither `cms.schema_designer` nor an effective assignment; an absent,
cross-owner or out-of-party review remains an indistinguishable 404. pgTAP is
`../tests/phase_02_slice_09_evidence_cms09_10.sql` and
`../tests/phase_02_slice_09_evidence_cms11_14.sql`.

`20261002179000` tightens the admin MFA reset idempotency key to BE05b's 16..128
characters (record CHECK and RPC; contract `Cfg05b06IdempotencyKeySchema` and the
CFG-05B-06 route enforce the same range). `20261002180000` adds the AC-903
self-read surface for the MFA tables: security-invoker views
`api_identity.mfa_factor_self_v1` and `api_identity.step_up_challenge_self_v1` over
safe columns, one self-read policy per table and column-level `SELECT` for
`authenticated` only (tables keep forced RLS and no table-level grant; pgTAP is
`../tests/phase_02_slice_09_dec111_mfa_self_views.sql`). `20261002181000` adds the six
sealed evidence members (counts and hashes) to `activationPreparation.dryRunRef` for
a completed sealed dry run only. `20261002182000` makes the CMS-03A-09 idempotency
binding path-independent so a same-actor same-key request against another source
version is a 409 (AC-300). `20261002183000` extends the migration source set with the
affected `cms_locale_variants` rows of a breaking locale-configuration change: the
source-row functions and the six plan readers now take the (source, target) version
pair (AC-1197; pgTAP `../tests/phase_02_slice_09_scan_locale_variants.sql`).
`20261002184000` is the G1 consumer boundary: service-role `platform_api` reads for
the MFA reconciler, the reconciling-age gauge, the security notification and the
current capability grant, the append-only `platform_private.consumer_dead_letters`
store with its idempotent RPC, and the outbox relay selector widened from
`job.requested` to the four tuples the Worker accepts (pgTAP
`../tests/phase_02_slice_09_g1_consumer_boundary.sql`; real consumers over the real
database are exercised by `../../tests/db-integration/`). `20261002185000` adds the
AC-916 in-app notification intent store (`identity.in_app_notification_intents`,
append-only, forced RLS, recipient resolved server-side, idempotent by notification
id) behind `platform_api.in_app_notification_record`, with a holder-only invoker view
(pgTAP `../tests/phase_02_slice_09_ac916_in_app_notifications.sql`). `20261002186000`
adds `reviewOpenAgeMs` to the operational snapshot and `20261002187000` admits the four
review-lifecycle alert codes (`review_open_past_window`, `decision_denial_spike`,
`assignment_denial_spike`, `capability_grant_denial_spike`) to the alert delivery log
and claim RPC (pgTAP `../tests/phase_02_slice_09_operational_review_age.sql` and
`../tests/phase_02_slice_09_operational_alert_codes.sql`).

Slice 09 audit remediation (R3) adds four forward-only migrations. `20261002188000`
makes the "recent binding-bound MFA" check of every CMS review/grant command use the
Worker-verified step-up proof (`context.stepUpVerified` and `context.stepUpAt`, fresh when
`-30 s <= now - stepUpAt <= 600 s`) instead of the acting-context binding heartbeat, which
stays a separate liveness check (`../tests/phase_02_slice_09_r3_recent_mfa.sql`).
`20261002189000` removes `reconciling -> expired` from the MFA factor guard and from
`auth_mfa_factor_reconcile` (BE01a: reconciling goes only to verified, pending or removed;
the registry sweep writes `pending -> expired`). `20261002190000` counts the CMS grant
reason in Unicode characters after NFC, in the function and both table CHECKs, matching the
contract (`../tests/phase_02_slice_09_dec119_grant_command.sql`). `20261002191000`
invalidates an open or approved schema review when the compiled artifact of its candidate
changes (`../tests/phase_02_slice_09_r3_activation_gates.sql`). `20261002192000`
(AC181) adds the session-resolving RLS helpers (`cms_session_scope_ok`,
`cms_session_scope_ok_report`, `identity_session_scope_ok`) and RESTRICTIVE session-scope
policies, AND-ed with the RPC gate, on every new private CMS table and write policies on the
identity MFA tables; `cms_acting_party()` and `mfa_lock_binding()` publish the verified
session, and a service-role call with no published human session is the system scope
(`../tests/phase_02_slice_09_r3_rls_session_scope.sql`; the platform `postgres` role has
BYPASSRLS, so the behavioural proofs run as a non-bypass probe role). `20261002193000`
(AC1135) adds the service-role `platform_api.cms_sweep_expired_review_authority(p_batch)`
sweep that invalidates open or approved reviews whose counted approve decision relied on an
assignment or specialist capability that has since lapsed; the Worker schedules it each cron
tick (`../tests/phase_02_slice_09_r3_expiry_sweep.sql`). The R3 suites
`phase_02_slice_09_r3_*.sql` also hold the activation-gate, grant, rate-limit, error-row
and IA edge-case assertions.

Slice 09 review remediation adds three forward-only migrations. `20261002194000` makes
the reviewer branch of `cms_session_scope_ok` require the effective assignment (state
`active`, `starts_at <= now < ends_at`, the same predicate the decision RPC uses) and
owner consistency between the assignment, the review and the row, in every restrictive
session policy's USING and WITH CHECK
(`../tests/phase_02_slice_09_r3_rls_session_scope.sql`). `20261002195000` replaces
`auth_mfa_factor_reconcile` with a six-argument form that takes the factor `version`
the reconciler observed (`p_expected_version`) and compares it atomically under the
binding and factor row locks: a mismatch answers `{ "stale": true }` and applies
nothing, an absent or non-positive version is `INVALID_REQUEST`
(`../tests/phase_02_slice_09_dec111_mfa_enrollment.sql`, AC-913). `20261002196000`
makes both settle RPCs (`auth_mfa_enrollment_verify_settle`,
`auth_step_up_challenge_verify_settle`) re-check the persisted MFA verification lockout
after they acquire the binding lock, so a verification prepared while unlocked cannot
commit after concurrent failures lock the account
(`../tests/phase_02_slice_09_dec111_mfa_verification_lock.sql`; the committed-session
race runner is `../tests/phase_02_slice_09_dec111/012-settle-race.mjs`).

Slice 09 closure adds one forward-only migration. `20261002197000` changes only the
denial branch of the CMS-03A-12 assignment lookup in `cms_decide_schema_review`: a
caller to whom the review is readable (the owning party's schema designer or owner,
per `cms_review_scope`) but who holds no effective assignment is 403 `FORBIDDEN`
(AC-431); a review not readable to the caller (another organization, an expired or
revoked assignment, an unrelated human) stays an indistinguishable 404
(`../tests/phase_02_slice_09_r3_cms_error_rows.sql`). The independent-session
`.mjs` race runners are executed by `pnpm db:races`
(`../../infra/run-database-race-runners.mjs`), which `pnpm db:verify` (and therefore
`pnpm db:ci`) runs after `pnpm db:test`: it resets before each runner and once at
the end, and fails on any nonzero exit or a runner that asserted nothing
(AC-424, AC-586).

Constraint tightening: `20261002179000` replaces the 8..256 idempotency-key CHECK on
`platform_private.admin_mfa_factor_resets` directly because that table is created by
`20261002159000` in the same unreleased change set (neither migration is on `main` or
any remote), so no deployed row can violate it. Future constraint tightening on a
table that has been deployed uses `ADD CONSTRAINT ... NOT VALID`, a preflight query
that finds and remediates violating rows, then `VALIDATE CONSTRAINT`.

Slice 09 R8 adds five forward-only migrations, each with its RED-first pgTAP suite.
`20261002198000` makes review assignments owner-consistent: an assignment INSERT whose
`owner_id` differs from its review's is refused `CONFLICT` (DETAIL
`assignment_owner_mismatch`), a decision may only cite an assignment of the review's
owner (DETAIL `decision_assignment_owner_mismatch`), and the decision lookup,
`cms_review_scope` and `cms_review_qualifying_approvers` require
`assignment.owner_id = review.owner_id`, so a legacy mismatched row (assignments are
immutable and cannot be rewritten) is inert
(`../tests/phase_02_slice_09_r8_review_owner_consistency.sql`). `20261002199000`
makes `auth_mfa_factor_reconcile` re-check the persisted MFA verification lockout under
the binding lock for the `verified` and `pending` outcomes (`MFA_VERIFICATION_LOCKED:<s>`,
nothing written; `removed` still settles)
(`../tests/phase_02_slice_09_r8_mfa_reconcile_lockout.sql`, and the committed-session race
in `../tests/phase_02_slice_09_dec111/012-settle-race.mjs`). `20261002200000` makes
`admin_mfa_factor_reset_settle` emit `identity.mfa-factor.changed.v1` for each factor a
`failed` provider outcome leaves reconciling, so the reconciler is woken again
(`../tests/phase_02_slice_09_dec111_admin_mfa_reset.sql`, AC-933). `20261002201000` makes the
CMS-03A-01 and CMS-03A-09 RPCs call `platform_api.cms_validate_locale_config` itself
(AC-1203; `../tests/phase_02_slice_09_r8_locale_validator_path.sql`). `20261002202000`
implements the BE00 error details the Worker needs: a stale If-Match is `VERSION_MISMATCH`
with DETAIL `{expectedVersion, currentVersion}` (state conflicts stay a bare `CONFLICT`),
every Slice 09 `FORBIDDEN` carries DETAIL `{reasonCode}` (`OWNER_REQUIRED` or
`CAPABILITY_REQUIRED`), and OD-4 locale violations are `{path, message}` rather than
`{pointer, message}` (`../tests/phase_02_slice_09_r8_error_details.sql`).

## Related links

- `../tests/README.md`
- `../../docs/runbooks/platform/release-recovery-gates.md`
- `../../.memory/wiki/specs/be/00-infrastructure.md`
