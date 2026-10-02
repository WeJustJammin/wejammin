# Slice 09 activation producer amendment — owner approved

**Date:** 2026-10-01  
**Status:** owner approved on 2026-10-02; specification cascade and implementation pending. Approval alone changes no capability grant or acceptance result. See the [exact approval record](2026-10-02-slice-09-activation-amendment-approval.md).  
**Scope:** complete the already required CMS schema-version lifecycle before dependent slices resume.

## Existing requirements and contradictions

IA03 AC-CMS-04 requires the schema designer to use policy-qualified distinct
human decisions and forbids activation alone. IA03 deep-dive §§State Machines,
Schema Compilation and Compatibility, and Migration Algorithm already require
successor versions, review, immutable dry-run evidence, compatibility checks,
backfill verification, and an atomic active switch. BE03a §§Route Registry and
State machine and concurrency require these gates but close the public registry
at eight operations without a successor, dry-run, review-submission, or
review-decision producer.

The installed activation RPC incorrectly treats a CMS version as a
`setting_value` in the settings-owned CFG review ledger. The CFG commands only
accept settings candidates and record `settings.approve`; activation demands
`cms.schema_designer`. Its protected risk key set is disjoint from its admitted
workflow keys. Directly inserted review fixtures hide both contradictions.
The existing owner bootstrap supplies the only schema designer, while the
owner's prior decision retains one administrator. The proposal below supplies
approval authority independently of design or administrator authority.

## Proposed ownership and authority

1. Use private CMS-owned `cms_schema_reviews` and append-only
   `cms_schema_review_decisions`, following the existing CMS editorial review
   ownership pattern. Retain the shared BE00 audit/outbox authority. CFG review
   tables remain settings-owned.
2. Add `cms.schema_review` as an approval-only capability, with a dedicated
   CMS assignment authority; no existing runtime CMS grant command supplies
   this authority. The existing owner alone receives
   `cms.schema_review.assign`, allowing assignment/revocation of exactly
   `read` and `decide` on one frozen review to an existing eligible human.
   Each assignment is owner/review-scoped, expires within seven days and no
   later than the grantor's own authority, and is rechecked at decision and
   activation. It confers no schema design, content editing, publication,
   template, settings, general capability-administration, delegation, or
   administrator authority. No real account or assignment is created by
   approving this contract proposal. Existing `organization_actor_grant`
   remains the authority for design; `admin_capability_grants` is not silently
   imported into the CMS gate.
3. The code-owned workflow policy resolves the decision count and capability
   set. Ordinary schema policy requires one eligible distinct reviewer;
   protected schema policy requires at least two eligible distinct reviewers.
   The submitter never counts, each human counts once, and authority is
   rechecked at decision and activation. This retains IA03's existing rules.
4. Retain the established Worker/service-role trust model. Actor, acting party,
   binding ID, capabilities, and MFA are server-resolved. The private binding
   ID stays out of browser resources and telemetry. Review binding uses a
   stable actor/person/party/binding projection, excluding request IDs,
   correlation IDs, and transport timestamps.

## Proposed protected operations

All operations inherit BE00 strict JSON/media, origin/CSRF, no-store,
request-id/error-envelope, rate, idempotency, ETag/CAS, transaction, audit, and
outbox rules. These are first-party protected console operations. No GET
performs a mutation.

| ID         | Method and path                                                                  | Input and success                                                                                                                                                                                                                           | Authority and effect                                                                                                                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMS-03A-09 | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/successors` | `{ expectedVersion }` → `201 ContentTypeVersionResource`                                                                                                                                                                                    | Schema designer on the readable immutable source. Clone the definition aggregate into a fresh draft with new row IDs, preserved stable field identities/keys, remapped local row references and incremented version number. Preserve the source. Required Idempotency-Key and exact source If-Match.                                               |
| CMS-03A-10 | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/dry-runs`   | `{ expectedVersion, transformKey, transformVersion }`, nullable transform pair only for additive classification → `202 SchemaDryRunResource`                                                                                                | Schema designer on the draft. Server derives source/target/compiler/classification, creates or reuses a bound migration plan, queues a bounded scan through the migration worker, and returns an observable job. Caller cannot supply counts, hashes, classification, or a report.                                                                 |
| CMS-03A-11 | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/reviews`    | `{ expectedVersion, dryRunId }` → `201 SchemaReviewResource`                                                                                                                                                                                | Schema designer on a draft with a passed persisted dry run. Freeze policy, definition/artifact/compiler/dependency evidence and stable submitter context. Transition draft to review atomically.                                                                                                                                                   |
| CMS-03A-12 | `POST /api/v1/cms/schema-reviews/{reviewId}/decisions`                           | `{ expectedVersion, decision: 'approve' \| 'reject' }` → `201 SchemaReviewDecisionResource`                                                                                                                                                 | Assigned `cms.schema_review` human with policy-required capability and recent binding-bound MFA. Append one decision; reject self/repeated humans; recheck frozen evidence. Transition review/candidate to approved or rejected only under the frozen policy count.                                                                                |
| CMS-03A-13 | `GET /api/v1/cms/schema-reviews/{reviewId}`                                      | UUID path, empty query/body → `200 SchemaReviewResource`                                                                                                                                                                                    | Submitter/schema-designer scope or assigned review-only scope. Return safe candidate identity, frozen evidence summary, required/recorded decision counts, decision references and eligible next actions. Conceal inaccessible reviews.                                                                                                            |
| CMS-03A-14 | `POST /api/v1/cms/schema-reviews/{reviewId}/assignments`                         | Strict discriminated create/revoke request with `expectedVersion`; create references an eligible existing human and finite `expiresAt`, revoke references an assignment → `201 SchemaReviewAssignmentResource` for create, `200` for revoke | Existing owner with `cms.schema_review.assign`, recent binding-bound MFA and exact review If-Match. Only read/decide on that frozen review can be assigned, for at most seven days. Reject the submitter, unknown/ineligible humans, cross-owner reviews, broad scopes and delegation. Audit assignment/revocation atomically; create no identity. |

The existing CMS-03A-07 protected detail adds a typed `activationPreparation`
projection containing dry-run/job/review references and permitted next actions.
It contains no actor ownership identifiers, private binding ID, approval
capability graph, raw content, or caller-authoritative policy fields.
The workbench provides successor, dry-run, submit-review and activation forms;
the assigned reviewer opens the protected review detail and a native decision
form. The activation confirmation receives a server-verified human-readable
acting-context label through the existing protected acting-context read and
an expiring MFA disclosure from private service-binding metadata. It shows no
raw binding/actor/party identifiers; the activation POST remains authoritative.
The FE03 island props currently serialize actor/party UUIDs even though the
new disclosure does not display them. The amendment reconciles the safe
projection invariant by retaining context-matching identifiers server-side
and supplying only the necessary safe registry resources, label and expiry
to the client island; raw private binding/session IDs remain prohibited.

## Persistence and transaction contracts

`cms_schema_reviews` has the common owner/state/version/timestamp envelope,
candidate content-type/version FKs, submitter auth/person IDs, stable context
hash, immutable definition/artifact/compiler/dependency hashes, immutable
dry-run FK, policy key/version/hash, risk class, required decision count 1..8,
required capability set, and approval-evidence hash. States are
`open | approved | rejected | invalidated`. There is at most one live review
for one exact candidate/evidence identity. Frozen fields are immutable.

`cms_schema_review_decisions` has the common immutable envelope, review FK,
reviewer auth/person IDs, verified context binding, named capability/version,
decision, decision timestamp, and verified MFA evidence. Unique review/human
constraints prevent repeated humans. UPDATE/DELETE and browser table access
are revoked; named commands perform all writes with forced RLS and pinned
search paths.

`cms_schema_review_assignments` has the common owner/version/timestamp
envelope, frozen review FK, reviewer-person reference, grantor-person reference,
fixed capability `cms.schema_review`, fixed actions `read` and `decide`,
`active | revoked` state, finite start/end timestamps and reason. Eligibility
also requires `starts_at <= now < ends_at`; no expiry sweep is needed to revoke
effective authority. Assignment never grants a reviewer the owner's acting
context or any other CMS capability. All three new tables explicitly enable
and force RLS, revoke direct browser/service-role table access and permit only
the named private command gates. A reviewer must independently authenticate
and hold an eligible binding; assignment is not identity or session evidence.

Candidate changes invalidate the open/approved review and decisions whenever
the definition, artifact, compiler, dependencies, policy or relevant authority
changes. Recent MFA is checked for each decision and again at activation.
The installed ten-minute review-creation/decision-age shortcut is explicitly
replaced: the decision records binding-bound recent MFA at decision time;
activation rechecks current assignment/capability, frozen evidence, and the
activator's current binding/MFA. An immutable decision is not expired merely
because it was made over ten minutes ago. The active binding/heartbeat and
recent-MFA requirements are retained. A rejection returns the candidate to
editable draft through the audited transition; drift invalidates its review
and requires preflight/resubmission rather than reusing old decisions.

Approval evidence uses a versioned, canonical SHA-256 composition of the
frozen review identity/version/hash and a deterministically sorted exact
decision set (decision ID, reviewer-person identity, assigned capability,
assignment ID/version, reviewed hash, decision and timestamp). The activation
evidence composition binds that approval digest to the frozen candidate,
artifact, compiler, dependencies, dry-run and workflow policy. Public hashes
remain lowercase 64-hex equality expectations; internal human identifiers
and authority records are never serialized into public evidence resources.

Successor row IDs are new, while stable field IDs and immutable field keys
persist across versions. Existing uniqueness is already scoped to
`(content_type_version_id, stable_field_id)` and
`(content_type_version_id, field_key)` and remains so. The artifact compiler
uses the actual versioned contract reference `/v{versionNo}`; its deterministic
artifact hash includes that versioned reference, the compiler version and the
compiled manifests. No random salt or mutation of the source artifact is
allowed. This permits unchanged clones to coexist without claiming identical
versioned artifacts. Tests cover both second and third versions.

The dry-run command binds its report ID onto the still-draft candidate under
CAS before review freezes it. It creates a dedicated plan/report identity and
a BE00 job in the same idempotent transaction. A same-key retry returns the
same report/plan/job; changed candidate/transform evidence requires a new
explicit run and invalidates earlier preparation. The plan/report uniqueness
contract must admit retained earlier attempts rather than overwrite immutable
evidence. `GET /api/v1/jobs/{jobId}` uses the existing BE00 job states and scope;
the protected detail projects preparation and immutable report references.

The dry-run scans actual affected current/draft/revision/template/binding/locale
relations without mutating them and retains exact source/target/error counts,
input/output/compiler hashes, transform identity and result. First activation
may produce a zero-source additive report only after proving no affected
persisted rows. Nonzero readiness remains fail-closed until a protected plan
producer, actual scanner, code-owned registered pure transform executor and
durable per-row source/output/error evidence all exist. Counter arithmetic or
a manually inserted report never proves transformation. The transform registry
locks key/version/digest, source and target schema constraints, accepted field
kinds and deterministic bounded behavior; callers cannot upload expressions,
SQL or executable code. Conditional/breaking work uses that registered executor
and resumable plan; the old active version serves through backfill and
verification. The active switch waits for the locked readiness gates.

## Dependency correction — no early downstream completion

The current plan has two cycles: Slice 09 requires a compatible template
owned by Slice 12, and nonzero migration proof requires content-row authority
owned by Slice 10, while both depend on Slice 09 completion. The proposed plan
amendment brings only those indispensable production prerequisites into Slice
09's implementation scope: the already-approved protected entry-create/read
authority needed to produce real source rows, the source-owned scan/transform
adapter, and CMS-03C-01 immutable template-draft creation plus a named protected
compatibility resolver. The remaining editorial/composition/taxonomy/localization
work stays in its existing slices and cannot be declared complete early.

AC169 references a readable immutable compatible template UUID; it does not
require the template's separate public activation. Existing template draft
definitions are immutable under their guard. The named
`platform_api.cms_resolve_template_compatibility` service-role RPC resolves
exact type/version/template references under the verified actor/owner scope,
conceals inaccessible templates, rejects incompatible or withdrawn records,
and returns only a safe version/digest/compatibility projection. It supports
the existing protected detail and mutation preflight, not a mutating GET.
Use the locked CMS-03C-01 path `POST /api/v1/cms/templates/versions`; do not
introduce the inconsistent `/cms/templates` shorthand from the compact inventory.
Template public activation remains an explicit unresolved Slice 12 contract
gap; a draft binding is not proof that public template activation works.

## Error and recovery requirements

Structural/header/query failures use 400 `INVALID_REQUEST`; missing/expired
sessions use 401 `UNAUTHENTICATED`; absent/stale MFA uses 401 `STEP_UP_REQUIRED`
with `{ recoveryAction: 'step_up', allowedMethods: string[] }` using only
configured allowlisted method identifiers. Capability/scope denial uses 403
`FORBIDDEN`; hidden targets use 404 `NOT_FOUND`; moved versions,
idempotency/evidence/state conflicts use 409 `CONFLICT`; non-JSON uses 415;
bounded field/registry/transform violations use 422 `VALIDATION_FAILED`; rates
use 429 `RATE_LIMITED`; validated dependency failures use BE00 502/503/504;
unexpected errors use scrubbed 500 `INTERNAL_ERROR`. Exact activation
`STEP_UP_REQUIRED` already exists in BE00; it must be explicit in the BE03a
operation matrices and Worker mapping rather than collapsing an RPC refusal
to 400 or returning `reauthenticate` recovery for the wrong error.

Writes are atomic with idempotency, audit and outbox. An unknown response is
reconciled by the same scoped idempotency identity before another effect.
Immutable source versions, reports, decisions, and completed migration evidence
remain readable under authorized projections after supersession.

## Implementation and acceptance sequence

1. Cascade the approved amendment through IA03/deep-dive, BE03a, FE03, capability
   contracts, OpenAPI/route inventory, Phase 2 plan and the Slice 09 tracker.
2. Implement private actor/binding transport and safe confirmation context.
3. Implement successor and dry-run producers, then CMS review/assignment/decision
   producers and their protected forms. Supply the minimum real source-row,
   transform and compatible-template authority listed above before the successor
   test; preserve the remainder of Slices 10 and 12.
4. Execute one integrated non-fixture producer path: create → dry-run → submit
   review → independent decisions → activate; then active source → compatible
   template → successor → actual dry-run/backfill/verify → independent review
   → second atomic switch. Tests may provision local test humans through the
   actual authority commands but may not directly insert review, decision,
   dry-run, approved-state, or completed-plan rows to claim this path.
5. Verify refusal, invalidation, old-active fallback, concurrent switch,
   idempotent replay, rollback/resume and all 17 open activation criteria;
   retain the independently verified AC250 regressions and update
   acceptance only when the real implementation paths satisfy each criterion.
6. Add traceable open criteria and recompute the depth floor for the newly
   specified successor, report/job, review, assignment and compatibility
   operations. Do not retain 279 as a claimed final denominator after adding
   contracts, or treat the existing criteria as exhaustive for new producers.

## Source verification notes

- BE03a Route Registry closes the surface at eight operations; IA03 AC-CMS-04
  requires independent policy-qualified approvals.
- BE00 Error Detail Schemas defines 401 `STEP_UP_REQUIRED` and its exact
  step-up recovery details.
- `20260902080000` field uniqueness is version-scoped, not globally unique;
  the code's explicit zero-row migration boundary must not be relaxed alone.
- `20260927200000` pins template draft definition fields while allowing only
  governed lifecycle movement. BE03c's template creation uses `/templates/versions`.
- Existing admin grant commands cannot bootstrap CMS reviewers: the owner
  lacks `admin.capability.grant`, the delegate must be a subset of a matching
  parent grant, and CMS never consults that table. The proposed narrow CMS
  assignment authority is new and requires owner approval.

AC209 remains post-deployment, AC211 post-launch, and AC265/AC266 pre-release.
The proposal does not waive them or require a paid provider. Phase 2 remains
8/17 and Slice 09 is 262/279 after the separate AC250 disclosure verification.
The 17 activation-chain criteria remain open after owner approval; implementation
and verified producer-path evidence, not approval alone, close them.
