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

### Slice 09 pre-amendment evidence migrations (`20261002203000`-`20261002211000`)

Forward-only fixes found while proving the 240 pre-amendment criteria (lane p240-db; each has a
RED-first pgTAP test in `../tests/phase_02_slice_09_p240_*.sql`):

- `203000` A01 typed 422 for repeated field id/key, relation, template and capability refs, and an
  advisory lock on the type key so a concurrent loser is a typed 409.
- `204000` and `205000` null-safe field and relation input validation; a second relation for one
  field is a typed 409.
- `206000` identity guards: no DELETE on definition tables, CAS versions never decrease, leaving
  `blocked` needs the audited-transition setting.
- `207000` and `208000` A05 typed pair conflict; A08 only supported to deprecated and deprecated to
  withdrawn, one event timestamp, and an outbox payload of exactly the nine spec members.
- `209000` A06 accepts `context` and `correlationId` and validates per-kind unions; A06 and A07
  list blocks to authorized readers; A07 has exact keys.
- `210000` reserved-concept keys are refused for blocks and template manifests.
- `211000` `cms_create_entry` refuses a locale outside the active version's `supportedLocales`.

### Slice 09 P240 database rulings (`20261002212000`-`20261002215000`)

Forward-only migrations for the 2026-10-03 P240-db rulings (each has a RED-first pgTAP test):

- `212000` AC180 security-first API trim: `platform_api.cms_resolve_template_compatibility` and
  `platform_api.cms_validate_locale_config` stay (the specification names them, and definer RPCs
  use the validator) but no API role can execute them; the exact executable cms_ set is guarded by
  `../tests/phase_02_slice_09_r8_api_surface.sql` and, against the callers, by
  `tests/contracts/phase-02-slice-09-api-surface-callers.test.ts`.
- `213000` AC190 outbox producer: the code-owned, immutable `outbox_event_producers` event-type-prefix
  map, `outbox_event_producer(event_type)`, and `claim_outbox_batch` returning `occurred_at` and the
  registered `producer` so the dispatched envelope carries both
  (`../tests/phase_02_slice_09_p240_outbox_producer.sql`, `phase_02_slice_09_g1_consumer_boundary.sql`).
- `214000` AC081/AC203: `cms_get_entry_draft` returns the exact opaque placeholder relation for an
  unavailable target under the `placeholder` policy (`omit` still disappears, `block` still refuses)
  (`../tests/phase_02_slice_09_p240_relation_placeholder.sql`).
- `215000` DEC-123: `cms_create_type_draft` refuses a default template or template binding outright
  (422) and has no template-binding write; a successor version carries the source's template
  forward (`../tests/phase_02_slice_09_p240_dec123_template_binding.sql`).
- `216000` DEC-123 completion: `cms_create_schema_successor` accepts `defaultTemplateVersionId` and
  `templateBindings` (both null clones the source, both present replaces); each template is resolved
  through `cms_resolve_template_compatibility` against the exact candidate (new private gate
  `cms_successor_template_gate`: NOT_FOUND 404, INCOMPATIBLE 422 with a pointer, WITHDRAWN 409), and
  the bindings are written before the candidate compiles so the definition hash, review evidence and
  activation carry them (`../tests/phase_02_slice_09_p241_dec123_successor_binding.sql`).

### Slice 09 R12 holdover migrations (`20261003100000`-`20261003100300`)

Forward-only migrations for the R12 database holdovers (each has a RED-first pgTAP test):

- `100000` AC217: `cms_json_bounded` and `cms_jcs` become single-pass with unchanged results (the
  512 KiB compiled-manifest CHECK of a 128-field definition cost about 50 ms per field write; both
  stay IMMUTABLE and are held to the previous implementations by
  `../tests/phase_02_slice_09_canonical_json_equivalence.sql`).
- `100100` AC217: `cms_create_type_draft` validates the field array once and inserts it in one
  statement; create128 RPC p95 about 60 ms on the reference stack (was 168 ms quiet, 299 ms loaded;
  `../tests/phase_02_slice_09_evidence_bench128.sql`, 25 samples (n >= 20): every-op p95 < 300 ms binding, max < 1,200 ms; create128 p95 < 200 ms stays diagnostic only).
- `100200` AC390: `cms_create_schema_successor` accepts the optional `workflowKey`/`workflowVersion`
  pair (both null or absent keeps the source member, both present replaces it with a seeded registry
  member); CMS-03A-11 keeps reviewing under the strictest of the two members
  (`../tests/phase_02_slice_09_r12_successor_workflow.sql`).
- `100300` AC641: `cms_rollback_schema_migration` records a terminal worker failure of a
  `dry_running` plan: the attempt ends `failed` with the worker's code, the plan is `blocked` and a
  new CMS-03A-10 attempt recovers it (`../tests/phase_02_slice_09_r12_scan_failure.sql`).

### Slice 09 R13 migration (`20261003100400`)

- `100400` AC034: `cms_create_type_draft` gates on the new private `cms_require_scope_member` before
  the capability is read: a caller who is neither a confirmed current member of the named target
  registry scope nor acting in their own personal scope is refused `NOT_FOUND` (one body for a foreign
  and an absent organization), while a member lacking `cms.schema_designer` keeps `FORBIDDEN`
  (`../tests/phase_02_slice_09_p240_a01_aggregate.sql`).

### Slice 09 SEC-2 migrations (`20261003120000`-`20261003120500`)

- `120000` creates `wejammin_cms_definer` and `wejammin_cms_authority_reader` (NOLOGIN, NOSUPERUSER,
  NOBYPASSRLS, no memberships; `postgres` is a member WITH INHERIT and SET). Only statements that work
  on hosted Supabase (CREATEROLE, not SUPERUSER).
- `120100` grants them exactly what their function bodies need (schema usage, per-table verbs, EXECUTE);
  row-lock-only relations get a one-column UPDATE grant.
- `120200` gives the definer and reader roles per-verb policies on the non-Slice-09 forced tables their
  functions touch (mirrors the grants).
- `120300` gates `cms_template_versions` and `cms_owner_initialization`, exempts the reader's own reads
  from three restrictive policies, and adds the identity read policies for the definer role.
- `120350` runs the owner-grant backfill as the receipt holder; `120360` makes the two read-only
  consumer reads hold the RPC context; `120370` answers the CMS-03A-13 403 branch through a boolean
  helper; `120380` evaluates the session scope once per statement (three lookups through
  uncorrelated sub-selects) instead of once per row.
- `120400` and `120410` make every `platform_api` function that sets or reaches the RPC flag restore its previous
  value on return; `120500` hands ownership of the functions to the two roles.
  Proof: `../tests/phase_02_slice_09_sec2_definer_rls.sql`.

### Slice 09 DB3 migrations (`20261003130000`-`20261003130600`)

- `130000` D-IDEM: `cms_reserve_conflict` is a pass-through of `cms_reserve`, so the nine commands that
  reserve through it (CMS-03A-04, 09-12, 14-17) raise `IDEMPOTENCY_MISMATCH` for a reused key with a changed
  body (wire: 409 CONFLICT, `conflict: IDEMPOTENCY_MISMATCH`, `recoveryAction: use_new_idempotency_key`),
  instead of a bare CONFLICT that reached the wire as `INVALID_TRANSITION` / `refresh`
  (`../tests/phase_02_slice_09_dec108_*.sql`, `../../tests/postgrest/cms-idempotency-mismatch.apispec.ts`).
- `130100` `cms_json_bounded` expands each node only through a `jsonb_typeof` CASE (never a WHERE qual) and reads key
  and element counts only in the matching branch (`../tests/phase_02_slice_09_r14_json_bounded.sql`).
- `130200` CFG-05B-06 settlement receipts: `admin_mfa_factor_reset_settlements` is keyed by (reset, factor, outcome,
  factor version); the reconciler wake-up of a `failed` outcome is emitted by the first report only, so a replay or a
  concurrent duplicate adds no outbox row (`../tests/phase_02_slice_09_dec111_admin_mfa_reset.sql`,
  `../tests/phase_02_slice_09_dec111/010-admin-reset-race.mjs` S3).
- `130300` `cms_valid_field_input`: only a MISSING `defaultValue` is refused for a literal default; an explicit JSON
  null is a literal default (BE03a `Json.nullable().optional()`), in agreement with the contract, the Worker and the
  storage CHECK (`../tests/phase_02_slice_09_p240_a02_field.sql`).
- `130400` `cms_release_route_gate`: a human or admin caller (role `authenticated`, or a request context naming a
  human actor) on CMS-03A-05 and CMS-03A-08 is `FORBIDDEN` (403) instead of `UNAUTHENTICATED`; the migration-worker
  gates keep `cms_require_release_worker` unchanged.
- `130500` a replayed release nonce raises `CONFLICT` with DETAIL `RELEASE_NONCE_REPLAYED`, so the Worker counts it as
  a rejected nonce claim.
- `130600` the CMS-03A-05 answer carries `contentHash`, `createdAt` and `updatedAt` (BE03a ResourceMeta), without which
  the Worker refused every committed registration as 502.

### Slice 09 integrator migration (`20261003140000`)

- `140000` CMS-03A-15 against an existing active grant aggregate raises `CONFLICT` with DETAIL `ACTIVE_GRANT_EXISTS`
  (AC527), so the Worker answers 409 with `details.recoveryAction: 'renew'`; idempotency and version conflicts stay
  detail-free. The function body is regenerated from the live definition with that one statement changed.

### Slice 09 SEC-2 second sweep (`20261003150000`-`20261003150200`)

Codex R14 finding 1: the administrative MFA reset stayed under the BYPASSRLS owner because the first
catalog guard scanned two schemas and a CMS table set. The sweep covers every schema and every forced
table; 33 more definer functions created or redefined by Slice 09 migrations were moved.

- `150000` creates `wejammin_platform_definer` (NOLOGIN, NOSUPERUSER, NOBYPASSRLS, no memberships) for the
  five functions that are neither CMS nor MFA work (rate limiter, consumer dead letters, outbox lease claim,
  configuration value resolver, profile claim conversion).
- `150010` `platform_private.auth_user_usable(uuid, boolean)`: the two functions that join `auth.users` read it
  through one boolean lookup that stays with the platform owner, because no migration can grant a dedicated role
  USAGE on the Auth-owned `auth` schema.
- `150100` privileges, policies and EXECUTE grants for the three roles. The binding version, session rows and
  security events are admitted by `identity_session_scope_ok` (system scope or the verified subject); the
  administrative reset record is system-scope only; the actor-grant projection is writable only inside a CMS
  command; other slices' tables get a policy for the one NOLOGIN owner that mirrors the grant verb for verb.
- `150200` hands ownership of the 33 functions to `wejammin_cms_definer` (the MFA commands, including
  `admin_mfa_factor_reset` and `identity.rpc_admin_reset_mfa_factors`), `wejammin_cms_authority_reader` (the
  read-only authority and identity lookups) and `wejammin_platform_definer`.
  Proof: `../tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql` (catalog guard over every schema with the
  explicit legacy list `../tests/support/sec2-legacy-bypass-definers.sqlinc`, and behaviour of both reset
  functions under forged and foreign sessions).

### Slice 10 editorial authoring migrations (`20261005010000`-`20261005012500`)

Forward-only migrations for CMS-03B-01..04 and CMS-03B-10..14 (entry authoring, conflict resolution,
history and comparison, restore, and the protected reads). They have not been released, so the first
group was corrected in place during Slice 10 repair and later files are forward fixes. Every
`platform_private` function stays ungranted to API roles and every `platform_api` wrapper is
service-role only. pgTAP coverage is `../tests/phase_02_slice_10_*.sql`; the lock, authority and cap
races are `../tests/phase_02_slice_10_races/`. Operations: `../../docs/runbooks/platform/cms-editorial.md`.

- `010000` the `rich_text.v1` value grammar (DEC-112): a canonical flat bounded AST, its protected registry
  membership and the total-text length bound; non-canonical input is refused, never canonicalised
  (`../tests/phase_02_slice_10_rich_text_v1.sql`).
- `010100` typed field-kind encodings (DEC-112, DEC-133): one shared kind gate for draft values and literal
  defaults, the depth-1 typed object structure, relation targets, list item kind and strict taxonomy and
  media shapes (`../tests/phase_02_slice_10_field_kind_shape.sql`, `../tests/phase_02_slice_10_value_encodings.sql`).
- `010200` CMS-03B-11 draft detail carries `revisionNumber`, `schemaVersionId` and the bounded
  `openConflict` identity; `contentHash` covers the returned projection
  (`../tests/phase_02_slice_10_draft_detail_identity.sql`, `../tests/phase_02_slice_10_draft_detail_lineage.sql`).
- `010300` CMS-03B-12 conflict detail: bounded three-way preimages of an open conflict with no ownership
  identity (`../tests/phase_02_slice_10_conflict_detail.sql`).
- `010400` CMS-03B-03 comparison over the field, block and relation domains with the keyed relation
  `targetToken`, `comparison_too_large` above 512 changes, the safe restore descriptor, and the shared
  Vault-signed cursor helpers (`../tests/phase_02_slice_10_comparison_domains.sql`,
  `../tests/phase_02_slice_10_compare_chain_shared.sql`, `../tests/phase_02_slice_10_compare_lineage.sql`).
- `010500` CMS-03B-04 restore: the immutable `cms_restore_chain_manifests`, chain re-derivation from
  completed 03a plan edges, edge-by-edge translation with revalidation, a required idempotency key and the
  `{ resource, restoreVerification }` answer (`../tests/phase_02_slice_10_restore_chain.sql`,
  `../tests/phase_02_slice_10_restore_chain_rebind.sql`, `../tests/phase_02_slice_10_restore_transform_revalidation.sql`).
- `010600` the advisory two-minute edit-presence lease: renewed inside CMS-03B-01, released by
  authority-loss triggers and expired by the service-role sweep
  (`../tests/phase_02_slice_10_presence_lease.sql`).
- `010700` CMS-03B-13 entry list with a Vault-signed cursor under its own signature domain and the owning
  `entryId` on each item (`../tests/phase_02_slice_10_entry_list.sql`, `../tests/phase_02_slice_10_cursor_signature.sql`).
- `010800` CMS-03B-14 author-safe authoring-context read; the entry point is
  `cms_get_entry_authoring_context` (`../tests/phase_02_slice_10_authoring_context.sql`).
- `010900` the locked D12 `cms_localization_fanout` wrapper over the canonical stale-locale producer
  (`../tests/phase_02_slice_10_locale_fanout_regression.sql`).
- `011000` the write commands refuse a non-empty taxonomy or media value with the typed
  `taxonomy_source_unavailable` / `media_source_unavailable` and admit the validated field kinds
  (`../tests/phase_02_slice_10_value_source_refusal.sql`). The taxonomy producer boundary still
  holds: no non-empty taxonomy value resolves here, and the refusal stays
  `taxonomy_source_unavailable` until a Slice 12 registration is implemented and verified. The
  media `media_source_unavailable` boundary is unchanged.
- `011100` DEC-139: CMS-03B-12 answers a closed conflict with the same 404 as an absent one.
- `011200` DEC-140: structural CMS-03B-13 cursor faults are `INVALID_REQUEST`; an expired, tampered or
  foreign cursor stays `CONFLICT`.
- `011300` DEC-143: revoking a capability grant or membership tenure also revokes the person's active entry
  assignments in the same transaction (`../tests/phase_02_slice_10_presence_lease.sql`).
- `011400` `rich_text.v1` link, `mailto:` and whitespace parity with the TypeScript validator
  (`../tests/phase_02_slice_10_rich_text_link_parity.sql`).
- `011500` DEC-144: the closed per-kind object-property constraint vocabulary
  (`../tests/phase_02_slice_10_object_property_constraints.sql`).
- `011600` the typed 422 reason classifier and the relation-authoring helpers
  (`../tests/phase_02_slice_10_typed_reasons.sql`).
- `011700` create, append and resolve emit the typed reasons and author relation values as normalized
  `EntryRelation` rows (`../tests/phase_02_slice_10_relation_authoring.sql`).
- `011800` CMS-03B-12 shows a relation field's conflict sides in the canonical relation form.
- `011900` restore re-fetches the editorial workflow-policy evidence
  (`../tests/phase_02_slice_10_restore_policy_evidence.sql`).
- `012000` DEC-146: the protected `rich_text.v1`@1 registry entry (descriptor and JCS SHA-256 hash), frozen
  into compiled artifacts and required equal at activation
  (`../tests/phase_02_slice_10_protected_validator_freeze.sql`, `../tests/phase_02_slice_10_validator_registry_gate.sql`).
- `012100` write-path lock helpers: `FOR SHARE` schema-version and authority locks, ordered relation-target
  locks and the three-slot per-actor concurrent-write cap (`../tests/phase_02_slice_10_write_path_locks.sql`).
- `012200` CMS-03B-13 reader driven from the caller's authorized assignments with `LIMIT limit + 1`; items add
  `entryLifecycle` and `entryUpdatedAt` (`../tests/phase_02_slice_10_entry_list_authorized_keyset.sql`).
- `012300` create, append and resolve hardening: the protected-validator gate, version and authority locks,
  successor-version scalar binding, conflict supersession, safe `/fields/...` violation pointers,
  `entryVersion` in responses and the `x-cms-idempotent-replay` marker
  (`../tests/phase_02_slice_10_validation_pointers.sql`, `../tests/phase_02_slice_10_successor_create.sql`,
  `../tests/phase_02_slice_10_conflict_lifecycle.sql`, `../tests/phase_02_slice_10_response_contracts.sql`).
- `012400` restore hardening: the same gates, a typed `VERSION_MISMATCH` for a stale entry version, conflict
  supersession, and the `cms.entry.revision-restored.v1` evidence event with its chain audit row
  (`../tests/phase_02_slice_10_restore_evidence.sql`).
- `012500` the presence sweep answers `{ expiredLeases, activeLeases }` for the `cms_presence_active` gauge
  (`../tests/phase_02_slice_10_response_contracts.sql`).
- `013000` ONE lock order for the writers, both schema activation commands and authority revocation (Codex SQL
  review 3 findings 1 and 2): the identity authority rows (binding, tenure, grants) before the candidate, then the graph,
  the active version and the review rows; `cms_invalidate_activation_reviews` locks the candidate before its reviews;
  `cms_lock_activation_authority` is split into `cms_lock_activation_identity_authority` and
  `cms_lock_activation_review_rows` (`../tests/phase_02_slice_10_activation_lock_order.sql`, race runners `010` and `014`).
- `013100` a deadlock outside that order is the typed retryable `CONFLICT` for the four writers, both activation
  commands and the CMS-03A-17 revocation (race runner `010`, S4).
- `013200` the CMS-03B-13 cursor carries the collection epoch (`aheadDigest`), so an entry updated between two pages is a
  `409 CONFLICT` restart, never a silent skip (`../tests/phase_02_slice_10_entry_list_epoch_cursor.sql`). The
  `010900` fan-out wrapper's variables were renamed in place (`../tests/phase_02_slice_10_locale_fanout_branch.sql`).
- `013300` `cms_create_entry` assigns the creator the capability they proved (`cms.editor` for an editor-only creator),
  not a hard-coded `cms.author` (evidence gap EB-AC063; `../tests/phase_02_slice_10_create_entry_capability.sql`).
- `014000` CMS-03B-01 refusals follow the BE03b validation matrix: a well-formed `baseRevision` that names no readable
  revision is the 422 `VALIDATION_FAILED` at `/baseRevision` (was a 404), and an entry that is not active is the policy-safe
  404 `NOT_FOUND` (was a 409 `INVALID_TRANSITION`) (`../tests/phase_02_slice_10_write_refusal_contract.sql`).
- `014100` CMS-03B-03 comparison fails closed with `comparison_unavailable` on a non-empty recorded taxonomy-version list
  (DEC-141) and on a recorded template version that no longer resolves
  (`../tests/phase_02_slice_10_compare_lineage.sql`, `../tests/phase_02_slice_10_ev_ea_gaps.sql`).
- `015000` `cms_create_entry` refuses a stored artifact whose hash is not the version definition hash (or that is not the
  version's own artifact) as `DEPENDENCY_UNAVAILABLE` before any write, like every other schema consumer (evidence gap
  EC-079-a; `../tests/phase_02_slice_10_activation_structure_binding.sql`, `../tests/phase_02_slice_10_ev_ec_r1_gaps.sql`).
- `016000` the activation commands never acquire an authority row after the candidate and the active version: the human
  switch locks only the review rows where it called the legacy composite (which rescanned the authority rows), the Worker
  switch rechecks the approval through `cms_worker_human_approval_evidence_valid` (review rows only; the standalone
  `cms_worker_human_approval_valid` delegates to it) (Codex final review HIGH; race runner `014` R3,
  `../tests/phase_02_slice_10_activation_lock_order.sql`).
- `016100` `cms_create_entry` requires the caller's SchemaArtifact evidence members to be JSON strings and compares them
  null-safely, so JSON null no longer skips the AC-079 comparison (Codex final review MEDIUM;
  `../tests/phase_02_slice_10_create_artifact_evidence_nulls.sql`).
- `016200` the writers' relation-target lock takes the target entry and the caller's assignments over it only
  (`cms_lock_entry_assignments_shared`), never rescanning the caller's person, tenure and grant rows after the active version.

### Slice 11 editorial workflow migrations (`20261005017000`-`20261005018100`)

`018100` is the DEC-162 prerequisite repair for the private initial-scope count
helper: valid first candidate/type-owner checks and actual persisted E/R/P/L
census, with existing non-null source counting retained. It transfers only that
helper to the existing restricted CMS definer, with temporary schema CREATE
immediately revoked and no API grants. The helper's snapshot is not the final
protected scan/seal concurrency fence; `../tests/phase_02_slice_11_first_empty_scope.sql`
contains bounded private fixture proof, not authenticated activation evidence.

Forward-only migrations for CMS-03B-05..09 (review submission, decision, schedule, preview, publication) and the
CMS-03B-15..20 reads, reviewer assignment, preview verification and schedule execution, plus the data model under
them. They have not been released. Every `platform_private` function stays ungranted to API roles and every
`platform_api` wrapper is `SECURITY DEFINER` with `search_path = ''` and `EXECUTE` granted to `service_role` only
(the definer-owned functions run as `wejammin_cms_definer`). pgTAP coverage is `../tests/phase_02_slice_11_*.sql` (fragments in
`../tests/phase_02_slice_11_*/`); the lock and idempotency races are `../tests/phase_02_slice_11_races/`.
Operations: `../../docs/runbooks/platform/cms-editorial.md`. Spec: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md`.

- `017000`-`017090` (lane S11-2, `../tests/phase_02_slice_11_schema/`): the data model reconciled to the locked BE03b
  shapes. `017000` the `(id, entry_id)` revision key; `017010` `EditorialReview` (`entry_id`, `decided_at`, the closed
  invalidation reasons and the CAS/transition state guard, which reads `cms_editorial_decisions` so a count-only
  approval is refused); `017020` reviewer assignments (bounded read/decide window, sixteen-per-review limit, revoke-only
  update); `017030` decisions (authorizing assignment, MFA window, separation of duties); `017040` the immutable
  `ReviewDependency` index written at submission; `017050` the E7 settings snapshots (hash, gapless ordinals);
  `017060` the seeded seventeen-category D19 preflight registry (DEC-134); `017070` publication schedules (lease,
  retry, completion and reason rules, the transition machine); `017080` the E3 append-only publication lineage;
  `017090` preview tokens (derived plaintext never stored, exact 15-minute expiry, CAS revocation, route CHECK fix).
  The guard functions are owned by `wejammin_cms_definer` and no API role holds a table grant.
- `017500`-`017595` (lane S11-3s, `../tests/phase_02_slice_11_helpers/`): the shared helpers every command calls. The
  acting-context version, the revision reference counter, the `VersionSet` projection (E1) and the dependency-manifest
  builder with its strict structure validator, the qualifying-approver recount (DEC-136), the derived revision state
  (E2), the settings snapshot (E7), the preflight evaluation (D19, DEC-158(c)), the single review invalidation core with
  its producers and preview-token revocation primitives, the lineage append (E3, lock position 7) and the SQL mirror of
  the pinned tzdb release `2026e` (DEC-153). None is executable by an API role.
- `017600`-`017640` (lane S11-3a, `../tests/phase_02_slice_11_rpc_review_*.sql`): review authority. `017600` shared
  helpers (step-up instant, scopes, resources, person lock); `017610` the assignment reason bound is 256 code points,
  not octets (DEC-158(b)); `017620` `cms_assign_editorial_reviewer` (CMS-03B-18, DEC-136/157/161);
  `017630` `cms_record_review_decision` (CMS-03B-06, DEC-157/159); `017635` the append-only accessibility audit-summary
  table and recorder (DEC-159(5)); `017640` `cms_submit_review` (CMS-03B-05).
- `017700`-`017740` (lane S11-3b, `../tests/phase_02_slice_11_rpc_publication_*.sql`): publication. `017700` shared
  publication helpers; `017710` `cms_schedule_publication` (CMS-03B-07, E8 time authority); `017720`
  `cms_publish_revision` (CMS-03B-09, E3 lineage); `017730` `cms_claim_due_publication_schedules` and `017740`
  `cms_execute_publication_schedule` (CMS-03B-20, the Worker `scheduled` sweep; never a browser route).
- `017850`-`017910` (lane S11-3c, `../tests/phase_02_slice_11_rpc_preview_*.sql` and `_rpc_reads_*.sql`): preview and reads.
  `017850` `cms_verify_preview_token` (CMS-03B-19, total and byte-identical on denial); `017860` `cms_mint_preview`
  (CMS-03B-08); `017870` the named private `cms_revoke_preview_tokens`; `017880` `cms_get_editorial_review`
  (CMS-03B-16); `017890` `cms_list_editorial_reviews` (CMS-03B-17, signed keyset cursor); `017900`
  `cms_get_entry_workflow` (CMS-03B-15); `017910` `cms_load_quality_gate_input` (DEC-159(4)). Reads write no audit,
  outbox or idempotency row.
- `018000`-`018090` (lane S11-3d, `../tests/phase_02_slice_11_e2_*.sql`): E2 adoption. The concealment classifier, the
  draft read, the revision history, the entry list, entry create, revision append, conflict resolution, restore and the
  composition-instance guards take `EntryRevisionState` from `cms_revision_effective_state(s)`, and `018090` fixes the
  physical `cms_entry_revisions.state` to the constant `draft` (no other code computes or stores a revision state).
- `165000`-`165200` (lane preview-projection, `../tests/phase_02_slice_11_projection_state*.sql` and
  `_preview_takedown.sql`): `165000` the BE04c `projection_consumer_state` table (private, forced RLS, RPC-only
  writes; `projection_id` keeps no foreign key until the delivery slice creates `publication_projection`) and the
  `cms_publication_projection_state` derivation (AC-116); `165100` the lineage append and the workflow read serve
  `projectionState` from it instead of a literal; `165200` the service-role takedown RPC
  `platform_api.cms_takedown_preview_tokens` over the private `cms_revoke_preview_tokens` seam (AC-118).

### Slice 11 forward migrations (`20261010130000`-`20261010171000`)

Forward-only amendments written after the `20261005017000`-`20261005018100` set. Functions they replace are
MD5-pinned by these files, so later changes to those functions must also be new forward migrations.

- `130000` E7 / DEC-163: settings snapshots are initialized by the existing authorized write tails
  (`cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict`, `cms_restore_revision`,
  `cms_author_locale_variant`); reads only look up (fail closed when missing).
- `140000` the schedule executor fences null and expired leases before any stale-evidence handling.
- `150000`-`154000` exact CMS-03B-07 instants (BE03b:266): private sub-microsecond remainders on
  `cms_publication_schedules` (storage; the self-check excludes planner statistics so populated tables migrate),
  nine-digit admission, due ordering, half-even deviation rounding over exact nanoseconds, and nine-digit
  workflow reconstruction.
- `161000`-`161100` sealed (encrypt-then-MAC) cursors for state-filtered revision history (DEC-168).
- `162000`-`162200` audit-event-keyed accessibility summaries, committed lapse and `version_set_stale`
  refusals at CMS-03B-07, and executor conflict propagation without consuming retries (DEC-169).
- `164000`-`164100` dependency recheck: the review recheck relay and the bounded, idempotent
  `cms.review.dependency_recheck` run (AC-113, DEC-166).
- `166000`-`166100` Slice 09 performance: `cms_create_type_draft` compiles its definition once and the compiled
  manifest bound is one jsonpath scan (P2-S09-AC-217), with byte-for-byte parity tests.
- `169000` (lane reviewA-1, `../tests/phase_02_slice_11_rls_session_scope.sql`): predicate RLS (BE03b "Permission, RLS and
  grants", AC-007/013/019/025/031/119). RESTRICTIVE session-scope policies on the nine Slice 11 tables and the accessibility
  audit summary, in addition to the CMS RPC-context gate: a published CMS session may only see and write rows of its acting
  party and only as a live member of it; the exclusive writers (submitter, decider, schedule creator, preview minter,
  assignment grantor) must name the session person; reviewer assignments need the owner receipt; the preflight registry is
  writable only under the system scope. A transaction with no published session (the service paths) is admitted by the gate
  alone. The same review changed `017620` in place (never deployed): the owner's valid `cms.editor` grant is required for a
  revoke as well as a create (BE03b CMS-03B-18).
- `170000`-`170100` (finisher lane, `../tests/phase_02_slice_11_rpc_publication_execute_entry_unavailable.sql`): an
  executing schedule whose entry is no longer `active` is CANCELLED `entry_unavailable` by the executor in its own
  transaction (BE03b "Schedule execution", CMS-03B-20, AC-083; the orchestrator ruling of 2026-10-11 supersedes DEC-158(d)
  for this one case and closes the race of a claim that precedes the entry leaving `active`). `170000` lets the schedule
  state guard admit `executing -> cancelled` with `entry_unavailable` only; `170100` adds `cms_schedule_cancel` /
  `cms_schedule_cancelled_result` and changes `cms_execute_publication_schedule` by three MD5-pinned, reversible anchors
  (the lifecycle is read under the entry row's `FOR SHARE` lock and checked before the review is re-read). Every other
  invalidation still blocks an executing schedule `approval_invalidated`.
- `170200` (finisher lane, `../tests/phase_02_slice_11_rls_session_scope.sql`): the relationship / assignment / capability
  predicates on SELECT (A-M2): `<table>_session_relationship` restrictive policies so a row read directly under a verified
  session is exactly a row the read RPCs would show it (the five review scopes, the CMS-03B-15 workflow read scopes, owner or
  own-assignee assignments, workflow participants for settings snapshots, preview tokens never). They bind every role except
  the CMS definer role, whose bodies decide 404 versus 403 and run the invalidation and recount cascades under any session.
- `171000` (lane queue-perf, `../tests/phase_02_slice_11_reads_plan_stability.sql`): the CMS-03B-17 reviewer queue reader is
  linear whatever the planner believes (AC-064). The canonical gate sat 63 minutes in one queue-page statement: the reader joined
  `cms_editorial_reviews` twice and, once autovacuum had left `relpages > 0, reltuples = 0` behind a long run of rolled-back
  fixtures, the planner estimated one row per table and chose review(503) x [assignment(201) x review(503)], 27 million tuples
  and 65 s per call. The page now reads the caller's active assignment ids first (one array), probes the reviews once by id,
  applies the keyset order and LIMIT before the four decoration joins and looks the assignment end up per page row. Two MD5-pinned,
  reversible anchors; owner, ACL, `search_path`, comment and signature unchanged. The relationship policies of `170200` are not the
  cause (dropped, the same statistics take 62.6 s against 65.0 s) and are untouched.

### Slice 12 FIX forward migrations (`20261013100000`-`20261013100500`)

CMS-03C-01 (templates), the two template reads and CMS-03C-04 (locale) made to match the locked BE03c text
(`../../docs/handoffs/2026-10-12-claude-s12/lane-fix-report.md`).

- `100000` (`../tests/phase_02_slice_12_fix_template_per_owner.sql`, `..._key_audience.sql`, `..._populated.sql`): E14 makes
  `UNIQUE (template_key, version)` per owner, `UNIQUE (owner_id, template_key, version)`: the global constraint answered a second
  owner's first version of a key with a 409 and so disclosed the key. Adds the lineage id `template_id` (the version-1 row's id,
  backfilled over the `supersedes_id` chain before `NOT NULL`), `UNIQUE (template_id, version)` and one active version per lineage,
  and the table CHECKs of E13 (`template_key` not `context`, `versions`, `new`) and E4 (audience `^[a-z0-9_-]{1,48}$`). Runs on a
  populated table: both CHECKs are added `NOT VALID` and validated only when no row violates them, so a legacy row can never abort
  the deploy (it just cannot be updated again); the definition CHECK is paused for the backfill UPDATE and restored. The lineage
  rules are folded into `cms_template_versions_guard()` (no new trigger; the AC215 inventory is unchanged) and the guard moves to
  the definer role (SEC-2). The text between the `BEGIN/END FIX-TEMPLATE-LINEAGE-DDL` markers is replayed verbatim by the
  populated-table witness (a vitest fails if the copies differ).
- `100100`: `cms_template_manifest_valid` takes the audience grammar (E4); every other clause is the body of `20261002210000`.
- `100200`: `cms_define_template` looks the previous version up inside the caller's owner scope (E14), refuses a reserved key with the
  typed token `key_reserved` (DETAIL `["/templateKey"]`) and a bad audience with `VALIDATION_FAILED` (DETAIL `["/audience"]`) before any
  lookup, writes the lineage id and answers it as `templateId`; a stored idempotent response that predates `templateId` is completed.
- `100300`: `cms_template_latest` answers `templateId` and sets the RPC-context flag it never set (SEC-2: the definer role is held to
  the forced CMS policies, so over the real API the read found no row and answered NOT_FOUND for the caller's own template; every pgTAP
  suite missed it because its fixtures leave the flag set, `../tests/phase_02_slice_12_fix_template_reads_rpc_context.sql` starts the
  request without it). Its `platform_api` wrapper becomes the flag-restoring wrapper of the other CMS reads.
- `100400` (`../tests/phase_02_slice_12_fix_locale_stale_field_ids.sql`): the CMS-03C-04 command answers and stores
  `staleFieldIds: []` (LocaleVariantResource, DEC-121) and completes an older stored receipt on replay. A guarded amendment of the LIVE
  source (two anchors, inverse-replacement proof, attributes unchanged), because `20261010130000` (E7) had already amended the body in
  place with the settings-snapshot tail.
- `100500`: the same flag and wrapper for `cms_template_context` (the picker listed no content type and no block over the real API).

## Slice 12 authoring-context `typeKey` projection (`20261020203606`)

`20261020203606` adds the server-derived `typeKey` to the author-safe CMS-03B-14
`AuthoringContextType` projection. It replaces only
`platform_private.cms_authoring_context_type(uuid)`, body-for-body equal to the
Slice 10 definition in `20261005010800` plus `'typeKey', type_row.type_key` taken
from the joined `cms_content_types` row; the language, `STABLE` behavior, the
fixed empty `search_path`, the compiled-artifact/owner/hash and version-row
joins, the existing fields, the `wejammin_cms_definer` owner and the
private-helper ACL (revoked from PUBLIC, `anon`, `authenticated` and
`service_role`; executable only by the owning definer) are unchanged. No table,
public wrapper, grant, audit/outbox effect or request argument is added or
removed, and the RPC identity and signature are unchanged.

The member is required, so this is a coordinated strict-response-parser
migration: the projection, the shared contract and every first-party consumer are
promoted together, never as a compatible mixed-version release.

**Status: UNRUN.** The migration and its pgTAP coverage
(`../tests/phase_02_slice_10_authoring_context_type_key.sql`) are authored but
have not been applied or executed — the native/database prerequisites are blocked
— so this section claims no database, gate or acceptance-criteria pass. The
existing `../tests/phase_02_slice_10_authoring_context.sql` was not run in this
continuation, and this note makes no claim about earlier runs.

## Slice 12 joint promotion of 2026-10-23 (80 migrations)

Eighty migrations from fourteen reviewed WIP lanes were promoted from `supabase/migrations-wip/` into this directory on
2026-10-23. The sources and SHA-256 values are recorded in
`../../docs/handoffs/2026-10-22-claude-s12/evidence/promotion-manifest-20261023.json`. Their timestamps lie between
`20261014050600` and `20261022120000`, so several sort before `20261020203606`. A local database that already applied
`20261020203606` must apply the missing earlier files with `supabase migration up --include-all`; a fresh
`supabase db reset` applies them in filename order. The fourteen sections below follow timestamp order of each lane's
first file. Behavior is specified by BE03c, BE03b and the DEC-NNN records in `.memory/wiki/decisions.md` (later records
are in `.memory/raw/events/`); the pgTAP coverage is `../tests/phase_02_slice_12_*.sql`.

### Slice 12 locale preflight gate (`20261014050600`-`20261014050700`)

The `locale` category of the publication preflight (BE03c "Locale preflight provider" and "Preflight providers registered
by Slice 12"; BE03b "Publication preflight registry"; P2-S12-AC-051, AC-052, AC-152, AC-240, AC-241; DEC-121, DEC-138,
DEC-192). Promoted together on 2026-10-23; a local database that already applied `20261020203606` needs
`supabase migration up --include-all`. Tests: `../tests/phase_02_slice_12_locale_gate.sql`.

- `20261014050600_cms_locale_no_fallback_gate.sql`: provider body `cms_locale_no_fallback_gate(revision, phase)`. It
  evaluates every active `no_fallback` field of the revision's schema version for the revision's locale in one statement
  and fails the category with `no_fallback_missing` or `no_fallback_stale` plus a blocking count. Otherwise a revision
  that is a locale variant fails with `locale_variant_not_approved` unless its effective state is approved, scheduled or
  published (DEC-192); the check applies in the schedule, publish and execute phases, never at submit. Private, STABLE,
  `SECURITY DEFINER`, owned by the CMS definer.
- `20261014050700_cms_preflight_locale_provider.sql`: a guarded anchored amendment of the live `cms_evaluate_preflight`
  dispatches the `locale` category to the gate before the generic `preflight.<category>` key check, then registers
  provider `cms.locale.no_fallback_gate` version 1 as registry version 2 for the category (kind `database`), replacing
  the reference-gate row. The `route`, `media` and `privacy` rows stay on the reference gate. The seeding release
  record id is the fixed namespaced value for DEC-138.

### Slice 12 pattern updates (`20261014140000`-`20261014140610`)

CMS-03C-14 (the typed three-way update diff) and CMS-03C-15 (accept or detach of 1 to 32 linked pattern instances), with
the pending-version column of AC-258 (BE03c "Pattern versions and linked updates" and "Canonical records"; P2-S12-AC-112
to AC-123, AC-219, AC-258, AC-261; DEC-181, DEC-185, DEC-186, DEC-193). Promoted together on 2026-10-23; a local database
that already applied `20261020203606` needs `supabase migration up --include-all`. The CMS-03C-13 selector pair
`20261014140300`/`20261014140310` was in this directory before this promotion, and the earlier WIP CMS-03C-14 reader
`140400` was folded into `20261016040300` (DEC-215). Tests: `../tests/phase_02_slice_12_pattern_update_diff.sql`,
`../tests/phase_02_slice_12_pattern_updates.sql`.

- `20261014140000_cms_composition_instance_pending_version.sql`: nullable `pending_pattern_version` on composition rows,
  non-null exactly when `state = 'pending_diff'`. Existing rows carry NULL, so populated tables migrate.
- `20261014140100_cms_pattern_update_nodes.sql`: `cms_pattern_update_nodes(owner, forest, visited, strict)` expands a
  pattern version into its block nodes with key chains, like the placement expander; `strict = true` requires every
  nested pinned version to be active, `false` only that it exists (the base of a diff).
- `20261014140200_cms_pattern_update_plan.sql`: `cms_pattern_update_target` and the DEC-193 writer plan
  `cms_pattern_update_plan` (exact flat-slot base and target root snapshots, typed collision delta, pinned and target
  metadata). Only the head of a path that is linked and `active` or `pending_diff` is offered a target.
- `20261014140410_cms_get_instance_update_diff_public.sql`: the `platform_api` transport of CMS-03C-14 (a safe read);
  `service_role` only, restores the RPC-context flag. The private reader is `20261016040300`.
- `20261014140500_cms_pattern_update_check.sql`: the store-free request check of CMS-03C-15, run first so a malformed
  request takes no lock and no idempotency key; the choices-path grammar allows up to 72 segments and 4680 characters
  (DEC-193).
- `20261014140550_cms_pattern_update_next_row.sql`: `cms_pattern_update_next_row`, the row appended per instance at the
  next version, same position; one pure base/local/target resolution decides it (accept adopts the target pin, a removed
  target root retires the row with its prior pin, detach keeps the prior pin).
- `20261014140600_cms_apply_pattern_update.sql`: the CMS-03C-15 private command for an assigned author or editor,
  all-or-nothing over the current draft revision; returns `{ items, entryVersion }`. A named row that is not the newest
  of its path is 422 at its `instanceId`; only a stale head `expectedVersion` is 409.
- `20261014140605_cms_apply_pattern_update_closure.sql`: owner, ACL and table privileges of the command and its
  privilege closure, split out to keep each file under 300 lines.
- `20261014140610_cms_apply_pattern_update_public.sql`: the Worker transport; a deadlock or lock timeout becomes the
  retryable `CONFLICT` token and the sub-transaction rolls back, so the same `Idempotency-Key` may be retried.

### Slice 12 DEC-194 taxonomy merge recovery (`20261014190010`-`20261014190050`)

The bounded automatic sweep that re-requests a failed `cms.taxonomy.merge_converge` job (DEC-194; DEC-212 for the table
name; BE03c "Merge convergence recovery" and "Slice 12 lock order"; P2-S12-AC-226). Promoted together on 2026-10-23; a
local database that already applied `20261020203606` needs `supabase migration up --include-all`. Tests:
`../tests/phase_02_slice_12_dec194_sweep.sql`; races: `../tests/phase_02_slice_12_dec194_*.race.mjs`.

- `20261014190010_cms_reconcile_taxonomy_merge_converge_public.sql`: `platform_api` wrapper of the sweep; no request
  members, answers `{ requested }` (a count), `service_role` only, a lock failure is the typed retryable `CONFLICT`;
  called from the Worker scheduled tick.
- `20261014190020_cms_taxonomy_merge_recovery_identity.sql`: `platform_private.taxonomy_merge_recoveries` (durable
  failed-job to accepted-job identity, independent of BE00 receipt TTL; outside the `cms_` namespace per DEC-212; forced
  RLS, no API-role grant) and the per-acting-party enqueue mutex `cms_taxonomy_merge_enqueue_lock`.
- `20261014190030_cms_taxonomy_merge_request_serialized.sql`: replaces `cms_act_taxonomy_term` and
  `cms_request_taxonomy_merge_converge` so a merge takes the mutex after the position-1 authority lock and before the
  idempotency reservation and the vocabulary and term locks; the late enqueue takes the same key again.
- `20261014190040_cms_taxonomy_merge_handler_serialized.sql`: replaces `cms_run_taxonomy_merge_converge` so the claimed
  continuation takes position-1 authority before the mutex, rereads the claim after each wait, and rolls back
  provisional effects if a late receipt wait loses the claim.
- `20261014190050_cms_taxonomy_merge_recovery_serialized.sql`: the single definition of the sweep body. Per party with a
  failed job, merged-term work and no queued or running job it requests one fresh job under a key derived from the failed
  job's id, at most one per party per 15 minutes, stopping after 3 consecutive failed generations, and records each
  reconciled failed job once in `taxonomy_merge_recoveries`.

### Slice 12 DEC-195 related-content read (`20261014200000`-`20261014200010`)

`cmsRelatedContentRead`, the protected read of a source entry's saved related-content rule (DEC-195; BE03c route
registry, validation matrix and error matrix; P2-S12-AC-060 to AC-063, AC-261). Promoted together on 2026-10-23; a local
database that already applied `20261020203606` needs `supabase migration up --include-all`.

- `20261014200000_cms_get_related_content.sql`: private `cms_get_related_content(jsonb)` answering the strict
  `{ rule }` of the source's current active rule set, else `{ "rule": null }`; a malformed `entryId` is
  `INVALID_REQUEST` before any authority or existence answer.
- `20261014200010_cms_get_related_content_public.sql`: the `platform_api` transport; `service_role` only, restores the
  RPC-context flag.

### Slice 12 DEC-197 receiving contracts (`20261016030000`)

Receiving storage for DEC-197 (BE04a registry and lifecycle entry, BE04c registry); no compiler, delivery writer, API RPC,
policy, principal or seed data. Promoted together on 2026-10-23; a local database that already applied `20261020203606`
needs `supabase migration up --include-all`. Tests: `../tests/phase_02_slice_11_delivery_receiving.sql`.

- `20261016030000_delivery_receiving_contracts.sql`: creates `platform_private.route_manifest_version` (one active row,
  guard function and trigger) and `platform_private.publication_projection`, both with forced RLS and no API-role
  access, then adds two validated foreign keys from `projection_consumer_state` to the projection. Any orphan consumer
  row aborts the transaction and rolls back all of it.

### Slice 12 DEC-193 snapshot, diff, writer, carry, provider and restore migrations (`20261016040000`-`20261017044800`)

Detached local-tree snapshots and the linked-update accept and detach path on top of them (DEC-193), with the related
carry, publication-currentness and restore amendments (DEC-198, DEC-199, DEC-200, DEC-201, DEC-209; DEC-210 for the
block-rule call in the registry file; DEC-215 for the history squash). Promoted together on 2026-10-23; a local database
that already applied `20261020203606` needs `supabase migration up --include-all`. No superseded intermediate function
body is carried: the squash lists are in `../../docs/handoffs/2026-10-22-claude-s12/lane-squash-report.md`. Tests:
`../tests/phase_02_slice_12_dec193_*.sql`.

- `20261016040000_cms_detached_tree_storage.sql`: nullable `detached_tree` column, the pure validator
  `cms_detached_tree_valid(jsonb)` and its row CHECK.
- `20261016040100_cms_pattern_diff_delta.sql`: store-free typed delta over ordered expanded block forests for CMS-03C-14.
- `20261016040200_cms_pattern_diff_plan.sql`: CMS-03C-14 planner with exact flat template-slot prefix binding, no writes
  or locks.
- `20261016040300_cms_get_instance_update_diff_dec193.sql`: the single private CMS-03C-14 reader
  `cms_get_instance_update_diff(jsonb)`.
- `20261016040400_cms_pattern_slot_exact.sql`: forward clone of the placement producer so a template-bound placement
  names one exact flat slot.
- `20261016040500_cms_pattern_snapshot_expanded.sql`: pure canonical-snapshot representation for internal resolution.
- `20261016040600_cms_pattern_update_resolve.sql`: pure simultaneous per-selector resolution seam for accept.
- `20261016040700_cms_pattern_root_snapshot.sql`: writer adapter for one real expanded block root with exact flat-slot
  binding.
- `20261016040800_cms_detached_tree_registry.sql`: canonical-content registry validation of a detached tree, including
  the DEC-210 block-rule check.
- `20261016041200_cms_composition_instance_content.sql`: shared private content image of an instance row; the legacy
  NULL-tree image is unchanged.
- `20261016041300_cms_composition_instance_resource_dec193.sql`: public instance resource; only the private content-hash
  image changes.
- `20261016041700_cms_preflight_effective_security.sql`: the security preflight provider counts only effective stored
  content.
- `20261016041900_cms_revision_comparison_dec193.sql`: revision comparison reads the newest immutable composition row
  before state filtering (DEC-198).
- `20261016042000_cms_composition_carry_provenance.sql`: nullable private immediate carry provenance (DEC-198, DEC-200).
- `20261016042100_cms_revision_composition_carry.sql`: ordinary revision carry planner and writer, not restore.
- `20261016042200_cms_revision_composition_carry_rpcs.sql`: carry wired into `cms_create_revision` and
  `cms_resolve_conflict`; conflict resolution carries from the entry's current draft (`theirs`), not the base (DEC-209).
- `20261016042300_cms_revision_effective_composition.sql`: read adapters for the effective composition of a revision.
- `20261016042400_cms_composition_dependency_manifest_dec193.sql`: dependency manifest amends only the composition block
  and provenance reads.
- `20261016042500_cms_revision_render_plan_dec193.sql`: render plan keeps its six columns and derivations over the
  effective composition.
- `20261016042600_cms_accessibility_composition_dec193.sql`: accessibility check amends only the block payload lookup.
- `20261016043400_cms_pattern_placement_roots_check.sql`: request guard for the optional expanded block-root selectors
  (`roots`) of CMS-03C-02.
- `20261016043500_cms_pattern_placement_selected_plan.sql`: placement plan expands the whole pin, then selects block
  roots in forest order.
- `20261016043600_cms_pattern_placement_path_allocation.sql`: path and position allocation, newest head first; retired
  paths reuse their position.
- `20261016043700_cms_insert_pattern_selected_roots.sql`: five exact live-source amendments wiring selected roots into the
  CMS-03C-02 producer.
- `20261016044000_cms_pattern_registry_digest_readonly.sql`: read-only registry digest for publication currentness
  (DEC-199).
- `20261016044100_cms_pattern_live_pin_reason.sql`: the closed publication reason of one live pattern pin (DEC-199).
- `20261016044200_cms_pattern_active_digest.sql`: the `cms.pattern.active_digest` effective composition pattern provider
  (DEC-199).
- `20261016044300_cms_revision_manifest_currentness.sql`: revision-aware frozen-manifest currentness over the effective
  pattern provider.
- `20261016044400_cms_preflight_pattern_provider.sql`: installs the pattern provider row and dispatches it before the
  shared `preflight.<category>` key guard.
- `20261017044500_cms_restore_composition_plan.sql`: restore heads bound to the source and activity-neutral dependency
  refs (DEC-201).
- `20261017044510_cms_restore_composition_lock_plan.sql`: restore dependency lock planner over the previous file's heads
  and refs.
- `20261017044600_cms_restore_composition_registry.sql`: read-only restore repin after the planner's dependency
  position 3.
- `20261017044700_cms_restore_composition_copy.sql`: private restore copy after the caller's early dependency and schema
  locks.
- `20261017044705_cms_restore_composition_copy_acl.sql`: ownership, ACL and trusted-closure proof of the restore copy,
  split from `044700` for the file-size limit.
- `20261017044800_cms_restore_composition_integration.sql`: restore integration; amends only the post-E7 body of
  `cms_restore_revision(jsonb)`.

### Slice 12 DEC-202 default template (`20261022010000`-`20261022010100`)

The first revision's template pin comes from the exact authorized active content-type version's stored default (DEC-202;
BE03b "Initial revision default template (CMS-03B-10, DEC-202)" and "Write-path lock order" row 3; P2-S12-AC-286 to
AC-296). Promoted together on 2026-10-23; a local database that already applied `20261020203606` needs
`supabase migration up --include-all`. Tests: `../tests/phase_02_slice_12_entry_default_template.sql`.

- `20261022010000_cms_entry_default_template_helpers.sql`: private `cms_lock_default_template_shared` (`FOR SHARE` on the
  exact same-owner default template version) and `cms_entry_default_template_gate`, which runs the existing
  compatibility resolver and maps only its three expected refusals to 404, 422 and 409.
- `20261022010100_cms_create_entry_default_template.sql`: four guarded anchored amendments of the live
  `cms_create_entry` (declaration, schema lock moved after the relation-target loop, default lock then content-type
  version lock, the first revision inserts the resolved default instead of NULL).

### Slice 12 DEC-205 locale-variant read (`20261022020000`-`20261022020010`)

`cmsLocaleVariantRead`, the protected read of one entry's current locale variant for the translation form (DEC-205;
BE03c epic index CMS-15, route registry, validation matrix and `LocaleVariantRead`; P2-S12-AC-058, AC-152, AC-234,
AC-270). Promoted together on 2026-10-23; a local database that already applied `20261020203606` needs
`supabase migration up --include-all`.

- `20261022020000_cms_get_locale_variant.sql`: private `cms_get_locale_variant(jsonb)` answering the strict
  `{ locale, activeFallbackChain, variant, fields, resolutions }`; a malformed `entryId` or locale is `INVALID_REQUEST`
  before authority.
- `20261022020010_cms_get_locale_variant_public.sql`: the `platform_api` transport; `service_role` only, restores the
  RPC-context flag.

### Slice 12 governed review recheck (`20261022030000`-`20261022030300`)

Governed review invalidation: P2-S12-AC-202 (producers enqueue `cms.governed_review.recheck`), AC-203 (the bounded
recheck run), AC-204 (reviewer-authority invalidation in the revoking or ending transaction); DEC-207 amends AC-202 so a
grant revocation invalidates synchronously and never enqueues the recheck. Spec: BE03c "Governed review machinery" and
"Slice 12 lock order"; BE03b "Review invalidation". Promoted together on 2026-10-23; a local database that already
applied `20261020203606` needs `supabase migration up --include-all`. The companion fix `20261022120000` (DEC-221) is the
last section below. Tests: `../tests/phase_02_slice_12_governed_recheck.sql`.

- `20261022030000_cms_governed_recheck_verdict.sql`: `cms_governed_recheck_verdict(review)` answering current,
  dependency_changed or reviewer_authority_changed.
- `20261022030100_cms_recheck_governed_reviews.sql`: `cms_recheck_governed_reviews(request)` and its `platform_api`
  wrapper; one bounded run, subject lock first, one failing review isolated.
- `20261022030200_cms_invalidate_governed_reviews_for_person.sql`: `cms_invalidate_governed_reviews_for_person(person,
capability)`, its per-candidate step `cms_governed_invalidate_review_if_live` (subject lock, re-read, skip a review no
  longer live: DEC-221) and the two AFTER UPDATE or DELETE triggers (actor grant, membership tenure).
- `20261022030300_cms_governed_recheck_resolve_event.sql`: `cms_governed_recheck_resolve_event(event)`, the producers'
  event resolver.

### Slice 12 DEC-206 composition instances read (`20261022050000`-`20261022050010`)

`cmsCompositionInstancesRead`, the protected read of the composition instances of an entry's current draft revision
(DEC-206, aligned to BE00 collection rules; BE03c route registry row 182 and validation row 409; P2-S12-AC-269).
Promoted together on 2026-10-23; a local database that already applied `20261020203606` needs
`supabase migration up --include-all`. Tests: `../tests/phase_02_slice_12_composition_instances_read.sql`.

- `20261022050000_cms_list_composition_instances.sql`: private keyset reader `cms_list_composition_instances(jsonb)`
  answering the strict page `{ revisionId, items, nextCursor }`; the cursor is unsigned at this layer.
- `20261022050010_cms_list_composition_instances_public.sql`: `cms_list_composition_instances_signed`, which verifies the
  signed context-bound cursor (domain `cms-03c-instances`) and signs the next one, and the `platform_api` transport
  (`service_role` only, restores `app.cms_rpc`). A cursor fault answers `INVALID_REQUEST`.

### Slice 12 DEC-210 block composition rules (`20261022080000`-`20261022080500`)

`allowedChildren` and `slotRules` of the pinned block versions are enforced at the CMS-03C-12 save, the CMS-03C-02
placement, the CMS-03C-15 accept and detach, and by the `cms.pattern.active_digest` provider (DEC-210; BE03c "Block
composition rules (DEC-210)"). Promoted together on 2026-10-23; a local database that already applied `20261020203606`
needs `supabase migration up --include-all`. The writer `20261016040800` raises `block_rules_violated` through the shared
check. To add an operation, call the shared enforcers from its producer by an anchored patch and add the RED pgTAP in
`../tests/phase_02_slice_12_block_rules/`.

- `20261022080000_cms_block_rules_core.sql`: the pure `cms_block_rules_violation` and the registry rules map
  `cms_block_rules_registry`.
- `20261022080100_cms_block_rules_trees.sql`: tree adapters and the enforcers (`cms_block_rules_enforce_save`,
  `cms_block_rules_enforce_plan`, `cms_detached_tree_block_rules`, the pointer resolver).
- `20261022080200_cms_create_pattern_version_block_rules.sql`: anchored patch of the installed
  `cms_create_pattern_version`.
- `20261022080300_cms_insert_pattern_instance_block_rules.sql`: anchored patch of the installed
  `cms_insert_pattern_instance`, after the DEC-193 selected roots.
- `20261022080400_cms_apply_pattern_update_block_rules.sql`: anchored patch mapping the writer refusal to
  `/instances/{i}/choices` or `/instances/{i}`.
- `20261022080500_cms_pattern_active_digest_block_rules.sql`: anchored patch of the DEC-193 pattern provider.

### Slice 12 DEC-208 locale observability (`20261022100000`-`20261022100020`)

Database-side locale observability (DEC-208 owner decision, DEC-213 mechanism, DEC-216 active entries only, DEC-219 cost
bound; BE03c Observability, "Database-side locale observability (DEC-208)"). The Worker reads, once per minute on its
scheduled tick, the window `[T - 3 min, T - 2 min)` of the source-change fan-out and the count of stale `no_fallback`
fields on current locale variants. Promoted together on 2026-10-23; a local database that already applied `20261020203606`
needs `supabase migration up --include-all`. Tests: `../tests/phase_02_slice_12_locale_observability.sql`; Worker:
`apps/worker/src/cms-composition/locale-observability.ts`. The answer is closed (three integers); extend the reader and
the strict parser in `locale-observability.ts` together.

- `20261022100000_cms_locale_variants_observability_indexes.sql`: `INDEX(state, created_at)`,
  `INDEX(entry_id, lower(locale), version DESC, created_at DESC, id DESC)` and, from the DEC-219 plan diagnostic,
  `INDEX(entry_id, locale, version DESC, created_at DESC, id DESC)` (under forced RLS `lower()` is not leakproof, so the
  gauge skip scan uses the plain column).
- `20261022100005_cms_locale_stale_legal_field_count.sql`: private helper `cms_locale_stale_legal_field_count`, the gauge
  as a recursive skip scan from the active entries.
- `20261022100010_cms_locale_observability_read.sql`: private `SECURITY DEFINER` reader
  `cms_locale_observability_read`; sets the transaction-local RPC context, counts active entries only, answers
  `VALIDATION_FAILED` on a malformed window, no function-level `statement_timeout`.
- `20261022100020_cms_locale_observability_read_public.sql`: internal `platform_api` transport, `service_role` only,
  restores the caller's `app.cms_rpc`, no browser operation id.

### Slice 12 linked-update scan (`20261022110000`-`20261022110300`)

The database half of the platform-queue job `cms.pattern.linked_update_scan` (P2-S12-AC-212, AC-213; BE03c "Linked update
(diff, accept, detach)", "Job transport (DEC-166, DEC-180 G9)", "Slice 12 lock order" and "Event schemas"
`cms.pattern.activated.v1`). Promoted together on 2026-10-23; a local database that already applied `20261020203606`
needs `supabase migration up --include-all`. Tests: `../tests/phase_02_slice_12_linked_scan.sql`.

- `20261022110000_cms_linked_scan_request.sql`: `cms_linked_scan_request(request)`: exact keys, batch of 1 to 500 and the
  decoded opaque cursor `<entry uuid>.<hex of the path>`.
- `20261022110050_cms_pattern_update_next_row_pending.sql`: anchored forward patch of `cms_pattern_update_next_row`
  adding the `pending` action, the one writer of the `pending_diff` row.
- `20261022110100_cms_scan_linked_pattern_updates.sql`: `cms_scan_linked_pattern_updates(request)`, one bounded
  idempotent run (at most 500 instances, ascending entry id then bytewise path) in the Slice 12 lock order.
- `20261022110200_cms_scan_linked_pattern_updates_api.sql`: the `platform_api` wrapper; `service_role` only, restores
  `app.cms_rpc`, a deadlock or lock failure is the retryable `CONFLICT`.
- `20261022110300_cms_linked_scan_resolve_event.sql`: `cms_linked_scan_resolve_event(event)`, the producer's resolver of a
  `cms.pattern.activated.v1` row to `{ patternId, patternVersionId }`.

### Slice 12 governed frozen-status lock failures (`20261022120000`)

The Review V4 follow-up for the governed recheck (DEC-221; BE03c "Governed review machinery" Invalidation, changelog row
"Governed lock failures and revocation races"). Promoted together on 2026-10-23, after and with the governed recheck
files; a local database that already applied `20261020203606` needs `supabase migration up --include-all`. Tests:
`../tests/phase_02_slice_12_governed_recheck.sql`.

- `20261022120000_cms_governed_frozen_status_lock_failures.sql`: anchored patch of the live
  `platform_private.cms_governed_frozen_status(uuid)` so the handler around the digest recomputation re-raises
  `deadlock_detected` (40P01) and `lock_not_available` (55P03); the recheck run, the decision and the activation then
  answer the retryable `CONFLICT`. Every other digest error is still `changed`. `57014` is not named because PL/pgSQL
  `when others` never traps it.

### Slice 12 race fix: publication pattern-dependency locks (`20261023100000`-`20261023100100`)

Promoted on 2026-10-23 after the first canonical run of `supabase/tests/phase_02_slice_12_dec199_publication.race.mjs` showed that schedule (CMS-03B-07), publish (CMS-03B-09) and execute (CMS-03B-20) never locked the PatternVersion rows the DEC-199 pattern provider reads (DEC-224; BE03c "Slice 12 lock order"). A local database that already applied `20261020203606` needs `supabase migration up --include-all`.

- `20261023100000_cms_lock_revision_pattern_dependencies.sql` — private helper: `FOR SHARE`, ascending id, on the live pattern roots and nested versions of one revision (a row with a nonnull `detached_tree` pins none; a missing revision locks nothing).
- `20261023100100_cms_publication_pattern_dependency_locks.sql` — anchored amendment (exactly-once anchor, inverse check, attributes unchanged) of `cms_publication_lock_review(uuid)` and `cms_schedule_lock_review(uuid,uuid)` to call the helper before position 4.

pgTAP: `supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql`; the wait itself is proven by the DEC-199 race module.

## Related links

- `../tests/README.md`
- `../../docs/runbooks/platform/release-recovery-gates.md`
- `../../.memory/wiki/specs/be/00-infrastructure.md`
