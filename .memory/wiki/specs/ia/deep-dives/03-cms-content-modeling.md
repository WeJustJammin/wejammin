# Deep Dive 03 — CMS content modeling and authoring

> **Parent IA Shard**: [../03-cms-content-modeling.md](../03-cms-content-modeling.md)
> **Architecture Source**: [../../2026-08-02-architecture-design.md](../../2026-08-02-architecture-design.md)
> **Status**: Complete — deepening converged

## Scope

This deep dive makes Shard 03's dynamic-but-bounded CMS deterministic. Shard 03
owns the protected schema-registry command and query boundary, including
capability-scoped list/detail projections. Shard 04 owns menus, routes, SEO,
media-library delivery, public query APIs, cache/search/sitemap convergence,
and degraded delivery. Shard 05 owns settings, flags, admin shell/tasks/search,
diagnostics, import/export, and retention operations.

## Deepening Record

| Pass                      | Result                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross-section consistency | Types, fields, entries, schemas, templates, blocks, terms, locales, reviews, schedules, and publications share immutable-version semantics.                        |
| What-if expansion         | Populated schema changes, concurrent edits, stale approvals, DST, migration interruption, withdrawn blocks, preview forwarding, and locale staleness converge.     |
| Adversarial pass          | Canonical-domain smuggling, arbitrary code/CSS, permission-by-navigation, draft/cache leakage, provenance override, relation BOLA, and legal fallback fail closed. |
| Convergence               | Final pass introduced no new boundary, state, actor, field, or unresolved implementation choice.                                                                   |

## Resolved Architecture Choices

| Question                          | Locked resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic schema storage            | Normalized definition/version tables plus strictly validated entry-revision JSONB and normalized links; no general ORM/EAV or runtime DDL per type.                                                                                                                                                                                                                                                                                                                                                                     |
| Schema compiler                   | Definition versions compile deterministically to Zod 4, OpenAPI/editor metadata, database validation metadata, and renderer binding manifest; artifact hash stored.                                                                                                                                                                                                                                                                                                                                                     |
| Admin-created fields/types        | Allowed only from protected registries and quotas; no user-authored validator, query, code, renderer, HTML, CSS, expression, or SQL.                                                                                                                                                                                                                                                                                                                                                                                    |
| Initial schema aggregate          | CMS-03A-01 creates the type, version, field/relation/template/capability bindings, locale/workflow references, and validation state in one atomic idempotent transaction; later field/relation commands edit only an unactivated draft.                                                                                                                                                                                                                                                                                 |
| Model envelope                    | Every persisted model carries `id`, `owner_id`, closed `state`, monotonic `version`, `created_at`, and `updated_at`; immutable rows pin `updated_at = created_at`. The explicit per-model exceptions matrix below is normative.                                                                                                                                                                                                                                                                                         |
| Locale/workflow/template defaults | `source_locale` is the required authoring/canonical source locale; `default_locale` is the governed delivery fallback root; `workflow_key` plus `workflow_version` resolve a protected policy; `default_template_version_id` is an optional immutable version reference.                                                                                                                                                                                                                                                |
| Autosave/locking                  | Optimistic revisions plus advisory presence lease; different fields merge, same-field conflicts require explicit choice.                                                                                                                                                                                                                                                                                                                                                                                                |
| Review invalidation               | Approval binds exact revision hash, schema/template/taxonomy/settings versions, relation target visibility snapshots, and checker versions. Required decision count and roles are snapshotted from the workflow/risk policy.                                                                                                                                                                                                                                                                                            |
| Schedule semantics                | Local wall time + IANA zone + resolved UTC + tzdb version. Once approved, UTC instant is authoritative unless editor creates a new schedule version.                                                                                                                                                                                                                                                                                                                                                                    |
| Breaking migration                | Expand → dry-run → resumable backfill → compatibility verify → active switch → later contract. Old version remains readable through switch window.                                                                                                                                                                                                                                                                                                                                                                      |
| Block execution                   | Code release owns implementation. CMS selects immutable registered version/props only; unsupported versions block new publish. Human admin can read registration metadata but cannot register or mutate a block.                                                                                                                                                                                                                                                                                                        |
| Block props identity              | `props_schema_ref` and `props_schema_hash` are the immutable identity. A normalized, signed props snapshot is derived evidence and must be bound to the signed `release_digest`; it never replaces the reference/hash.                                                                                                                                                                                                                                                                                                  |
| Protected registry reads          | Shard 03 exposes authenticated, capability-scoped, `no-store` list/detail projections with named query/page/detail schemas, deterministic bounded cursor pagination, and discriminated resources. No protected registry row is a public delivery source.                                                                                                                                                                                                                                                                |
| Pattern update                    | Explicit accept/detach per instance or bounded reviewed bulk operation; recursive/cyclic graph impossible.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Preview                           | Exact immutable version-set token, 15 minutes, audience/capability bound, no-store/noindex, reauthorized on every request.                                                                                                                                                                                                                                                                                                                                                                                              |
| Taxonomy merge                    | Survivor keeps ID; retired term becomes permanent alias/redirect; assignments migrate idempotently with impact audit.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Locale fallback                   | Field/type-specific ordered chain. Legal, policy acceptance, safety, jurisdiction and required accessibility content default no-fallback.                                                                                                                                                                                                                                                                                                                                                                               |
| Related candidates                | Explainable bounded deterministic rules only; no opaque model dependency at launch. Manual pins/exclusions are authoritative presentation choices.                                                                                                                                                                                                                                                                                                                                                                      |
| Entry bootstrap and draft detail  | `CMS-03B-10` creates the active entry with its first attributable draft revision, server-derived identity/assignment, and atomic audit/idempotency/outbox effects under a required `Idempotency-Key` and no update-only `If-Match`; `CMS-03B-11` serves only the caller-authorized current editable values, field provenance, schema identity, and canonical versions as `no-store` with a strong authenticated `ETag`, concealing a hidden or absent entry as 404 and denying a visible-but-unauthorized draft as 403. |

### Common Model Envelope and Exceptions

The common persisted envelope is `id: uuid`, `owner_id: uuid`,
`state: closed enum`, `version: bigint`, `created_at: timestamptz`, and
`updated_at: timestamptz`. `owner_id` identifies the owning party or parent
aggregate and never grants authority. Code-owned rows point to their signed
release record; immutable rows set `updated_at = created_at` and reject updates.
The following matrix is the complete exception map and is shared by the
normalized tables, Zod contracts, RLS policies, and generated projections.

| Model group                                                                                                                           | Envelope interpretation                                                                                                                         | Explicit exception or additional rule                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content_type`, `content_type_version`, `field_definition_version`, `relation_definition`, `schema_artifact`, `schema_migration_plan` | The owner is the type/definition aggregate; `state` is lifecycle/workflow state and `version` is the immutable definition or operation version. | `content_type.lifecycle` (`active\|retired`) fulfills the envelope state and is the physical state column; it never carries draft/review workflow state. `content_type_version` owns draft/review/active state and stores locale/workflow/template references. `schema_artifact` is immutable, content-addressed, and has only the terminal `compiled` state. |
| `content_entry`, `entry_revision`, `entry_field_value`, `entry_relation`, `edit_presence`                                             | The owner is the entry aggregate; revision/link versions are monotonic and scoped to the entry.                                                 | `edit_presence.state` is `active\|expired\|revoked`, its renewal updates `updated_at`, and it never grants write authority or substitutes for a capability check.                                                                                                                                                                                             |
| `editorial_review`, `editorial_decision`, `publication_schedule`, `publication_version`                                               | The owner is the entry/review aggregate; state transitions are closed and auditable.                                                            | Decisions and publication versions are append-only evidence; prior publication rows remain readable and immutable.                                                                                                                                                                                                                                            |
| `block_definition_version`, `template_version`, `pattern_version`, `composition_instance`                                             | The owner is the release or composition aggregate; versioned renderer/binding identity and evidence are immutable after approval.               | `block_definition_version.owner_id` points to a signed release record; props identity is ref/hash and its normalized snapshot is derived evidence bound to `release_digest`; lifecycle may advance only `supported → deprecated → withdrawn` through a signed release boundary.                                                                               |
| `taxonomy_version`, `taxonomy_term`, `term_label`, `term_assignment`, `locale_variant_state`, `related_content_rule`                  | The owner is the vocabulary or entry aggregate; labels, assignments, locale states, and curation rules are versioned/append-only.               | Child rows inherit parent ownership; `locale_variant_state` stores both source and target locale; no fallback or assignment grants access.                                                                                                                                                                                                                    |

Child rows must carry their parent `owner_id` even when a more specific foreign
key exists. A missing envelope field is a schema error, not an implicit
exception.

The lifecycle-named envelope states are `content_type.lifecycle`,
`content_entry.lifecycle`, `block_definition_version.lifecycle`, and
`taxonomy_term.lifecycle`; each is that model's physical closed `state` and is
not duplicated as a second mutable state. Every other persisted model carries
an explicit closed `state` column. Immutable rows set `updated_at=created_at`
and reject updates; only advisory `edit_presence` renewal may refresh its
timestamps.

## Canonical Field Contracts

### Definitions and Schemas

| Model                      | Fields and constraints                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content_type`             | `id uuid PK, key varchar(64) unique, built_in bool, owner_capability, lifecycle active\|retired, created_at`; key lowercase `^[a-z][a-z0-9_]{1,63}$`, immutable.                                                                                                                                                                                                                                                     |
| `content_type_version`     | `id, content_type_id, version_no integer>0, label, workflow_key, workflow_version, source_locale, default_locale, default_template_version_id?, state, definition_hash, schema_artifact_id, supersedes_id?, created_by/at, activated_at?`; unique type/version. `source_locale` is the canonical authoring input; `default_locale` is the governed delivery fallback root and is not used for a `no_fallback` field. |
| `field_definition_version` | `id, type_version_id, field_id uuid, key, kind, constraints jsonb, validator_key/version?, required, default_mode none\|literal\|inherited, default_value?, localization_mode, editor_config, lifecycle`; unique type-version/key and field ID. Constraints use protected validator references; free-form executable patterns are forbidden.                                                                         |
| `relation_definition`      | `field_definition_id, target_kind content\|domain, target_type, cardinality one\|many, min/max, projection_key, on_unavailable omit\|block\|placeholder, ordered`; target/projection allowlisted. Required one is `min=1,max=1`; optional one is `min=0,max=1`; many uses explicit non-negative bounds.                                                                                                              |
| `schema_artifact`          | `id, type_version_id, compiler_version, zod_contract_ref, editor_manifest jsonb, renderer_manifest jsonb, artifact_hash, compiled_at`; immutable/reproducible and referenced by exactly one content-type version/hash.                                                                                                                                                                                               |
| `schema_migration_plan`    | `id, type_id, from_version_id, to_version_id, compatibility additive\|conditional\|breaking, transform_key/version?, dry_run_report, source_count, target_count, row_error_count, migrated_count, failed_count, state, cursor?, version`. Operational counters are derived telemetry and do not replace the normative dry-run report.                                                                                |

### Private Schema Review Records (DEC-108)

Schema reviews are CMS-owned, never CFG setting-value candidates. Private
`cms_schema_reviews` freezes candidate definition/artifact/compiler/dependency,
actual immutable dry-run/report/plan identity, submitter/stable context and
code-owned workflow policy/risk/count/capabilities. One live review per exact
candidate evidence is allowed; frozen fields cannot be edited. States are
`open|approved|rejected|invalidated`. The common owner/state/version/time envelope
and ENABLE/FORCE RLS apply, with direct browser/service-role table grants revoked
and pinned-search-path named private RPCs as the only command authority.

`cms_schema_review_decisions` binds review, independently authenticated human,
private binding, qualifying capability/version, decision and verified MFA/time.
It is append-only, unique per review/human, and forbids submitter/self approval.
`cms_schema_review_assignments` records owner/review, reviewer/grantor humans,
fixed `cms.schema_review` read/decide scope, active/revoked state, starts/ends and
reason. Starts must be current and ends finite, no later than seven days or
the grantor authority end, which is the end of the owner's `cms.schema_designer`
grant valid-through day (the owner initialization receipt grant end bounds only
the grants created at initialization, and the owner renews through the owner CMS
capability grant commands below). Recheck effective interval and binding authority on
decision and activation; assignments create no identity or owner context and
cannot be delegated or broadened. The existing owner alone assigns/revokes
through `cms.schema_review.assign` with current binding-bound MFA.

Review identity hashes use a versioned private actor/person/party/binding
projection, excluding transient request/correlation and transport timestamps.
Canonical SHA-256 evidence covers the exact sorted immutable decisions and
frozen candidate/artifact/compiler/dry-run/policy composition. Private matching
UUIDs never enter islands, public evidence resources or logs. A decision's MFA
is checked and recorded at commit; activation checks current reviewer authority
and activator MFA without an arbitrary ten-minute decision-age rule. Policy
provides the exact count `1..8`: one independent reviewer for ordinary cases,
at least two for protected cases. Candidate/policy/compiler/dependency/authority
drift invalidates; rejection returns editable draft via audit, then resubmission
requires a new frozen review.

### Workflow Policy Registry and Owner CMS Capability Grants (DEC-109, DEC-110, DEC-119)

The workflow policy registry is code-owned and versioned. A member is
`{ key, version, riskClass, requiredDecisionCount 1..8, requiredCapabilities }`,
seeded as an immutable row by a forward-only migration, and bound one per content
type version through `workflow_key`/`workflow_version`. Every member is version 1.

| Key                                                                      | Risk class | Required decisions | Required capabilities (ordered slots)    |
| ------------------------------------------------------------------------ | ---------- | ------------------ | ---------------------------------------- |
| `editorial`, `editorial.default`, `cms.content.workflow`, `cms.standard` | ordinary   | 1                  | `cms.reviewer`                           |
| `cms.disclosure.policy`                                                  | protected  | 2                  | `cms.reviewer`, `cms.reviewer.policy`    |
| `cms.disclosure.legal`                                                   | protected  | 2                  | `cms.reviewer`, `cms.reviewer.legal`     |
| `cms.disclosure.security`                                                | protected  | 2                  | `cms.reviewer`, `cms.reviewer.security`  |
| `cms.disclosure.financial`                                               | protected  | 2                  | `cms.reviewer`, `cms.reviewer.financial` |

`policyHash` is the lowercase SHA-256 hex of the RFC 8785/JCS canonical JSON of
the member object, with `requiredCapabilities` in registry order and no hash or
evidence inside it. The first required capability is the base reviewer slot that
every counted decision satisfies (an editorial decision under `cms.reviewer`, a
schema-review decision under a current `cms.schema_review` assignment) and each
further capability is a specialist slot that at least one counted approving
human must hold through an effective grant. A schema review derives its policy
from the candidate version's own bound member and freezes it. Downgrade guard:
for a successor, the review (and the editorial policy the successor's version
carries) uses the strictest of the source version's bound member and the
candidate's own member: protected if either is protected, the larger decision
count, and the specialist slots of both in order, so a protected-to-ordinary key
change never lowers the requirement; the source member identity is kept on the
review beside the effective values. A review is
approved only when the distinct qualifying approvers equal the required count and
every specialist slot is held by one of them. Because recorded decisions never
exceed the required count, an approve decision is refused when the decisions
left after it are fewer than the specialist slots no counted approver holds.

The editorial `approvalEvidenceHash` is a decision-independent approval-basis
digest, so it exists at entry bootstrap: the JCS canonical SHA-256 of the bound
content-type version's frozen activation approval evidence hash, the bound
policy member's `policyHash` and the schema version identifier. It carries no
editorial decision and is distinct from the schema review's decision digest.

`cms_capability_grants` is the versioned owner grant aggregate: owner
organization, existing human, one grantable CMS capability, finite UTC
valid-from and valid-through (at most seven UTC days inclusive), last action
(`granted|renewed|revoked`), optional reason and version. `state` is physically
`active|revoked`; `lapsed` is derived from valid-through. One aggregate exists
per owner, human and capability. `cms_capability_grant_events` is the
append-only history with one row per grant, renewal or revocation, the aggregate
version, term and stable private context evidence. Each mutation writes the
aggregate, the event and the effective-authority projection on the organization
actor-grant row in one transaction with audit and outbox, and a forward-only
migration backfills aggregates for the grants created at owner initialization.
Grant (new or re-established), renewal and revocation require the receipt-derived
owner with recent MFA; the subject must hold a confirmed membership in the
owner's organization; the capability must be in the closed grantable registry;
and the owner may target itself for any grantable capability, because the owner
is the only human in the organization today and separation of duties is enforced
at decision time (submitter is never the reviewer, distinct humans, specialist
slot held), not at grant time. The grantable registry also carries the
navigation editor, media contributor and media curator capabilities named by
shard 04; their assigned menu, publication, upload-purpose and asset scopes are
still checked by the owning operations. A protected owner-only list serves the
console.

### Entries, Reviews, and Publication

Review and activation evidence snapshots are immutable server results. They
contain the protected workflow policy `key`, `version`, `policyHash`,
`requiredDecisionCount` (`1..8`), `requiredCapabilities`, and
`approvalEvidenceHash`; approval IDs are request references only: the approve-decision IDs of
exactly one approved review for the candidate. The server resolves the IDs to
distinct humans and capabilities under current assignment authority (each
decision having recorded recent MFA at commit), and a protected policy always
has `requiredDecisionCount>=2`.

Relation definitions require finite non-null bounds: `min` is integer `0..128`,
`max` is integer `1..128`, `min<=max`; `one` requires `min` `0|1` and `max=1`,
and `many` always records explicit bounds.

| Model                  | Fields and constraints                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content_entry`        | `id uuid PK, type_id, owner_party_id?, lifecycle active\|archived\|deletion_pending\|held, current_draft_revision_id?, version, created_by/at`.                                                                                       |
| `entry_revision`       | `id, entry_id, revision_no, schema_version_id, template_version_id?, taxonomy_version_ids[], parent_revision_ids[], locale_payloads jsonb, content_hash, author_person_id, acting_party_id, state, created_at`; immutable after save. |
| `entry_relation`       | `revision_id, field_id, target_kind, target_id, expected_target_version?, position`; unique revision/field/target; never stores target fields/authority.                                                                              |
| `edit_presence`        | `entry_id, person_id, acting_party_id, lease_until, last_seen_at, current_field_id?`; advisory, no write authority.                                                                                                                   |
| `editorial_review`     | `id, revision_id, frozen_hash, dependency_manifest jsonb, risk_class ordinary\|protected, state, submitted_by/at, due_at?, version`.                                                                                                  |
| `editorial_decision`   | `review_id, reviewer_person_id, acting_party_id, capability, decision approve\|reject, reason_code, comment?, decided_at, reviewed_hash`; unique reviewer/review.                                                                     |
| `publication_schedule` | `id, entry_id, revision_id, action publish\|unpublish\|expire\|archive, local_datetime, timezone, resolved_at_utc, tzdb_version, state, job_id?, version`.                                                                            |
| `publication_version`  | `id, entry_id, revision_id, schema/template/taxonomy/settings version set, locale/audience, publication_hash, state active\|superseded\|revoked, activated_at`; one active per entry/locale/audience.                                 |

### Composition, Taxonomy, and Locale

| Model                      | Fields and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `block_definition_version` | `id, block_key, version, props_schema_ref, props_schema_hash, props_schema_snapshot jsonb, props_snapshot_signature, release_digest, renderer_ref, allowed_children, data_sources, accessibility_contract, compatible_from/to, lifecycle supported\|deprecated\|withdrawn`; code-release-owned. Definition evidence is immutable; lifecycle advances monotonically only through a signed release boundary. The reference/hash is identity and the normalized signed snapshot is derived evidence bound to the release digest. Withdrawn blocks preserve existing publications unless the fixed security/takedown rule requires fail closed and always block new publish. |
| `template_version`         | `id, key, version, compatible_type_keys[], slots jsonb, reserved_regions[], binding_manifest, state, hash`; no arbitrary markup/code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pattern_version`          | `id, key, version, block_tree jsonb, state, hash, owner_capability`; acyclic validated tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `composition_instance`     | `revision_id, path, slot_key, block_key/version, pattern_id/version?, link_mode linked\|detached, props jsonb, bindings jsonb`; unique revision/path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `taxonomy_version`         | `id, key, version, owner_capability, shape flat\|hierarchical, allowed_type/field keys, state, hash`; key immutable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `taxonomy_term`            | `id, taxonomy_id, key, parent_id?, lifecycle active\|deprecated\|merged, successor_id?, created_at`; acyclic parent; stable ID.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `term_label`               | `term_id, locale, label, description?, aliases[]`; normalized uniqueness within taxonomy/locale where configured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `locale_variant_state`     | `entry_id, revision_id, locale, source_locale/revision, state untranslated\|draft\|review\|approved\|stale, approved_by/at?`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `related_content_rule`     | `source_entry_id, target_entry_id?, rule_key/version?, mode pin\|exclude\|derived, reason_code, order?, state, version`; cycles allowed only where relation definition permits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## State Machines

| Aggregate                                     | Allowed transitions                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Type/schema/template/taxonomy/pattern version | `draft → review → approved → scheduled\|active → superseded\|retired`; blocked may return to draft; active content immutable.           |
| Entry revision                                | `draft → submitted → approved\|rejected → scheduled\|published`; any changed draft creates a new revision and invalidates prior review. |
| Review                                        | `open → approved\|rejected\|invalidated`; protected review requires required distinct capabilities/humans.                              |
| Schedule                                      | `pending → executing → completed\|failed_retryable\|blocked\|cancelled`; exact action idempotent.                                       |
| Migration                                     | `draft → dry_running → ready\|blocked → running → verifying → completed\|failed_retryable\|failed_terminal`; resume from cursor.        |
| Term                                          | `active → deprecated → merged`; merged cannot reactivate and redirects permanently.                                                     |
| Locale                                        | `untranslated → draft → review → approved`; source change makes approved `stale`; explicit revalidation returns approved.               |
| Publication                                   | `active → superseded\|revoked`; unpublish creates a new state/version and does not delete prior publication evidence.                   |

## Schema Compilation and Compatibility

1. Validate definition rows against protected registry contracts and reserved-key list; every validator is a protected key/version, never author-supplied executable text.
2. Resolve deterministic field order, defaults, conditional requirements, localization and relation schemas. Encode relation optionality as bounds (`one,min=0,max=1` for optional one) and retain ordering/unavailable behavior.
3. Compile strict Zod input/output schemas; unknown fields reject except preserved retired fields during migration window.
4. Compile editor manifest, render binding manifest, OpenAPI refs, migration diff, and compatibility class.
5. Hash canonical normalized definition and compiler version; repeated compile must produce the same hash. Persist one immutable `schema_artifact` with the hash, compiler version, contract reference, and generated manifests; activation references this exact artifact.
6. Additive: new optional field/type label/editor metadata. Conditional: stricter constraint or required field with proven complete non-fabricating transform. Breaking: kind/key/semantic removal, incompatible required/default, relation/cardinality change, or reserved binding change.
7. Activation requires zero unresolved references, valid migration plan for conditional/breaking, impacted template/block compatibility, and dry-run counts/evidence.

### Reachable Activation Producer Chain (DEC-108)

1. CMS-03A-09 clones an immutable source into a new draft with new definition
   row IDs, stable field IDs/keys and remapped local references. Increment the
   version number without mutating the source; artifact references include the
   exact `/v{versionNo}` and never use a random salt to hide collisions.
2. CMS-03A-10 derives source/target/classification/compiler/transform evidence,
   binds a new attempt/report identity to the still-draft candidate under CAS and
   atomically creates the attempt, plan and job. Queued/running state does not
   claim passed counts/hashes; actual scan completion seals immutable report
   evidence. Exact idempotent retries reuse the same attempt/plan/job;
   changed candidate/transform starts a new run and preserves earlier attempts.
3. Scan every affected real current/draft/revision/template/binding/locale row,
   recording bounded per-row input/output/error hashes and deterministic counts.
   A zero-source additive result is valid only after proving zero actual rows;
   nonzero scans cannot be replaced with counter arithmetic or manual reports.
   Transforms are code-owned pure registry key/version/digest plus strict schema,
   permitted field kinds and bounded behavior, never uploaded code/SQL.
4. CMS-03A-11 accepts a passed immutable dry-run and freezes the review/policy
   evidence atomically with `draft → review`. CMS-03A-14 assigns eligible existing
   independent humans; CMS-03A-12 appends decisions; CMS-03A-13 returns the
   authorized safe review detail. No producer trusts caller report counts,
   hashes, classification, ownership or authority.
5. CMS-03A-04 rechecks current authority and exact candidate/evidence under CAS,
   runs/resumes actual backfill and verification, then switches only when ready.
   The prior active remains readable until the atomic switch; failures or
   concurrent changes cannot partially activate or erase immutable evidence.

Production prerequisite coverage within Slice 09 includes only protected entry
bootstrap/draft-read source authority, the real scanner/registered transform,
CMS-03C-01 immutable template draft creation and
`platform_api.cms_resolve_template_compatibility`. The named read/preflight
resolver checks exact type/version/template/owner compatibility and withdrawn
state without mutation or scope leakage. Initial bindings already use the draft
aggregate producer. Readable immutable compatible template UUIDs suffice; public
template activation is a separate Slice 12 contract gap. Remaining editorial,
composition, taxonomy and localization outcomes stay in Slices 10/12.

Acceptance exercises create → actual dry-run → frozen review → independent
decisions → first activation, then actual source rows → compatible template →
successor → nonzero dry-run/backfill/verify → independent review → second switch.
Test humans for this path (author, editor, reviewers, specialist reviewers,
template designer, publisher) are provisioned only through the owner CMS
capability grant command and assigned through the review assignment command;
inserting `organization_actor_grant` rows, or inserting review, decision,
dry-run, approved state or completed plans directly, cannot satisfy this path.

## Entry Validation and Revision Merge

- Validate author capability and assignment before loading protected draft and again at save/submit.
- Server normalizes values by field kind; rich text is approved structured AST, never raw executable HTML.
- Defaults are recorded as provenance-bearing resolved values only when materialized; inherited/default display remains distinguishable from authored value.
- Autosave submits changed field paths plus base revision. Non-overlapping paths may create a merge revision with both parents.
- Same path changed from same base yields 409 with base/theirs/yours safe values and requires explicit resolution.
- Relations validate target kind/existence/projection/visibility but publication/read rechecks current target authority/lifecycle.
- Restore translates old revision through registered migration chain into a new draft; no direct activation of obsolete schema.
- Entry bootstrap creates the active `ContentEntry` and its first attributable draft `EntryRevision` in one transaction from server-derived identity and assignment; a required `Idempotency-Key` makes a replay return the same entry and revision with no second audit/idempotency/outbox effect, and a refused create commits neither row.
- The create request carries `contentTypeId`, a `contentTypeVersionId` that resolves to the same active compiled schema, a BCP 47 `locale`, 1-128 unique stable JSON-Pointer `changedPaths`, and strict stable-field-ID `values` (at most 128 keys, depth 8, 256 KiB); it carries a required `Idempotency-Key` and no update-only `If-Match`, and neither route trusts caller-supplied owner, acting party, capability, or authority.
- The protected draft-detail `GET` returns only the caller-authorized current editable values, field provenance, schema identity, and canonical versions; a concealed or absent target is 404, a visible target without assignment or read scope is 403, the response is `no-store` with a strong authenticated `ETag`, it has no mutation effect, and browser direct table access stays revoked.

### Entry Bootstrap and Draft Detail

Entry bootstrap and draft detail are the two `CMS-05` boundaries that make first-draft authoring reachable without weakening concealment: create is a human form requiring an `Idempotency-Key` and no update-only `If-Match`, while draft detail is a protected read-only `GET` that carries no body, idempotency key, or precondition header and never mutates state.

## Review and Publication Algorithm

1. Submit freezes revision hash and dependency manifest: schema, template, blocks, patterns, terms, locale sources, settings, relation targets/projections, checker/rule-pack versions.
2. Run contract, relation, privacy, security, accessibility, rights/media, route/SEO, locale, migration, and domain-binding preflights owned across Shards 00/01/04/05.
3. Resolve the immutable workflow key/version and risk classification, then collect exactly the distinct human/capability decisions required by that policy. Protected classes require at least two distinct humans, named specialist capability, and recent MFA; ordinary workflows may require fewer. The members and slot semantics are in the Workflow Policy Registry subsection above. Any revision/dependency/authority change invalidates affected approvals.
4. Schedule or immediate publish re-runs preflight against the frozen set/current revocation state.
5. PostgreSQL transaction creates `publication_version`, marks prior version superseded, records audit/idempotency, and writes one outbox event.
6. Shard 04 builds route/render/search/sitemap/cache projections from exact publication ID. Until convergence, last-known-good remains active unless revocation/takedown/privacy requires fail closed.
7. Failed downstream consumer retries idempotently; canonical control plane shows honest pending/degraded consumer status.

## Migration Algorithm

- Dry run scans every current/draft/revision/template/binding/locale relation affected and records deterministic counts/errors without mutation.
- Backfill uses registered code-owned pure transform over bounded batches, storing cursor, source/target versions, input/output hashes, and failures.
- The initial registered transforms are `identity.revalidate`, which carries retained values unchanged and validates them against the target (the conditional stricter-constraint class, breaking changes that retain or retire the existing value, and the executor of the integrated second-activation path), and `default.fill_literal`, which writes only the target field's declared literal default (the conditional required-field class). A value-converting change has no registered transform, cannot name a transform pair and is refused until a transform ships in code.
- Failed rows remain on old readable schema and block active switch unless policy explicitly permits a mixed-version compatibility period.
- Verification compares counts, required fields, relation integrity, renderability, accessibility, and sample/full hash rules.
- Switch changes active schema only after readiness evidence. Contract/removal occurs later after no supported app/publication reads old form.
- Rollback before switch stops migration. After switch, correction is forward-fix or active-version switch to a separately compatible version; completed business/editorial evidence is never erased.

## Protected Registry Query Boundary

Shard 03 owns the protected schema-registry read model in addition to its
commands. The contract is authenticated, capability-scoped, tenant/acting-
context filtered, `Cache-Control: no-store`, and never a public delivery
source. The named contracts are:

- `ContentSchemaRegistryListQuery`: bounded `limit`, opaque `cursor`, optional
  key prefix, lifecycle/state filters, and a deterministic sort plus direction;
  the cursor includes the last sort key and immutable ID tie-breaker.
- `ContentSchemaRegistryListPage`: `items` is an array of discriminated
  `ContentSchemaRegistryRecord` resources and `nextCursor` is nullable. A
  record identifies its `resourceKind` and contains only the capability-
  permitted version/field/relation/template/capability metadata.
- `ContentSchemaRegistryDetail`: one discriminated resource selected by
  immutable ID and version, with nested definitions and the exact
  `schemaArtifact` or release-manifest reference/hash where applicable.

List and detail deny unauthorized records without existence leakage and
recheck capability/RLS at read time. Shard 04 owns public publication
projections and may consume only immutable publication output; it does not
expose this registry query or control-plane rows.

## Composition and Preview Validation

`blockRegistryDigest` is SHA-256 lowercase hexadecimal of the RFC 8785/JCS
canonical JSON for reachable block-version tuples
`{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}`.
Tuples sort by `blockKey` UTF-8 and then numeric `blockVersion`. The server
resolves the reachable set and recomputes the digest at template/pattern create
and activate and at publication preflight; any client digest is expected
evidence only. A `placeholder` relation fallback is exactly
`{status:'unavailable', reason:'unavailable'}` and contains no target
identifier, type, key, title, data, or existence distinction for private,
deleted, embargoed, or concealed targets.

CMS-03A-05 signs the exact raw request body with Ed25519. The protected trust
registry owns `keyId` and public-key validity/revocation; rotation keys overlap
for the configured transition window. Required headers are `keyId`,
`issuedAt`, `nonce`, and `signature`. The versioned signing input is the
domain separator `WEJAMMIN-CMS-03A-05-RELEASE-V1`, followed by `keyId`,
`issuedAt`, `nonce`, and `sha256(rawBody)` in the specified newline-delimited
order. The server permits at most five minutes of clock skew, retains nonce
replay records for at least ten minutes, rejects revoked/out-of-window keys or
nonces, and persists immutable `keyId`, `rawBodyHash`, `signatureHash`,
`nonceHash`, and `verifiedAt` evidence.

- Block props validate against exact registered Zod schema; renderer/data-source references come from code manifest, never content. Registration accepts only a signed release manifest; `props_schema_ref/hash` remain identity and the normalized snapshot must verify its signature and `release_digest` before use.
- Template slot validates required/allowed blocks, max counts/depth, reserved regions, binding types, and compatible content/schema versions.
- Pattern graph and block tree have maximum protected depth/count settings and reject cycles before save/publish.
- Domain data binding reads only named projection contract and still enforces target/viewer authorization; preview cannot broaden it. Human CMS surfaces may inspect block registration metadata through the protected read boundary but cannot mutate it.
- Shard 02 fixed profile Header→Now→Record→Detail and reserved provenance components are code-owned template constraints.
- Preview token binds user, acting context, target revision, full version set, audience/locale/route, expiry and nonce; every open rechecks capability and revocation.

## Taxonomy, Localization, and Relationship Rules

- Editorial taxonomy creation checks canonical taxonomy registry. Overlap requires reference/mapping, not a duplicate vocabulary.
- Term key immutable; rename changes labels; merge picks survivor, creates alias/redirect, migrates assignments idempotently, and preserves old ID resolution.
- Free text is never silently coerced. Mapping proposal and curated acceptance are separate states.
- Source locale change marks translated fields stale by source field/hash. Unchanged fields may retain approved state. `source_locale` is the required canonical authoring locale and `default_locale` is only the governed fallback root.
- Fallback resolves per field through explicit ordered locales, recording chosen source. `no_fallback` returns missing/block state rather than wrong-language/jurisdiction text and never silently falls through to `default_locale`.
- Manual related pins remain first if target eligible; exclusions always remove; derived candidates declare rule/reason/version and are recomputed from authorized current projections.

## Abuse and Recovery Verification

| Threat/failure              | Required proof                                                                                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical entity smuggling  | Reserved-key/type/relation tests reject identity, rights, money, authority, dispute and entitlement ownership in CMS.                                                                                                                                 |
| Arbitrary code/style        | Schema/block/template inputs reject scripts, expressions, CSS, HTML handlers, dynamic imports, and unknown renderer/data sources.                                                                                                                     |
| Draft/control leak          | Public APIs/caches/search/sitemaps cannot select draft/control tables; preview tokens deny forwarding/revocation/expiry.                                                                                                                              |
| Relation BOLA               | Wrong user/party/target tests fail at authoring preview, publication, and public hydration.                                                                                                                                                           |
| Approval bypass             | Self-approval, stale hash, revoked reviewer, missing second reviewer, and changed dependency block protected publish.                                                                                                                                 |
| Migration corruption        | Dry-run, resume, duplicate batch, partial failure, count/hash/relation/render checks prove convergence.                                                                                                                                               |
| Provenance override         | Templates/blocks cannot reorder/remove reserved Shard 02 provenance structure.                                                                                                                                                                        |
| Locale legal leak           | Missing no-fallback field blocks locale publication and never borrows another jurisdiction.                                                                                                                                                           |
| Scheduler duplication       | Same schedule/job executes publication transition once and records late/duplicate evidence.                                                                                                                                                           |
| Control-plane outage        | Last-known-good serves; revocation/takedown path can remove unsafe output independently.                                                                                                                                                              |
| Entry create replay/refusal | Repeated create idempotency key returns the same entry and first revision with no duplicate effect; a refused create commits neither row and never leaks existence.                                                                                   |
| Draft-detail concealment    | Concealed or absent entry returns 404 and visible-but-unauthorized returns 403 with no values, ownership, or authority disclosure; the response is `no-store` with no mutation effect.                                                                |
| Grant overreach             | Non-owner callers, non-grantable capabilities (assignment-only and owner-only review keys, `admin.*`, wildcards), cross-organization subjects, terms over seven days and delegation are refused; every grant is step-up gated, audited and revocable. |
| Specialist bypass           | A protected approval cannot complete without a counted approver who holds the class specialist capability through an effective grant; an assignment alone never satisfies the slot.                                                                   |

## Cross-Shard Contracts

| Consumer      | Contract                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shard 04      | Exact publication version, route/render inputs, block/template manifests, media refs, locale/taxonomy/related projections, invalidation event.                         |
| Shard 05      | Protected workflow/risk/checker definitions, settings, and admin task/diagnostic status; it cannot override Shard 03 invariants or own the schema-registry read model. |
| Shard 01      | Human/acting context/capability and optional owner-party refs; CMS references never grant authority.                                                                   |
| Domain shards | Named read-only projection contracts and canonical IDs; no copied transactional state or table coupling.                                                               |

CMS-10 consumes a signed release manifest from the release worker. Its
`props_schema_ref/hash`, normalized signed snapshot, and `release_digest` are
readable through Shard 03's protected registry detail projection; no browser or
admin command can mutate that registration. No block-registration event is
substituted for `cms.template.activated.v1`, which remains emitted only by a
template-version activation.

## Implementation Envelope

- **Technology choice:** canonical domain state uses Supabase PostgreSQL with RLS, typed Hono/Zod command/query boundaries, transactional outbox events, Cloudflare Queue workers for bounded asynchronous effects, and Astro/React web/PWA projections; external systems remain replaceable provider adapters.
- **Rationale:** one PostgreSQL authority plus additive events prevents split truth, RLS enforces tenant/party scope near data, and queued adapters isolate provider latency without weakening canonical-state or p95 web-read guarantees.
- **Phasing:** (1) schema/RLS/settings and capability gates, (2) commands/events/idempotency, (3) projections and accessible surface, (4) provider or counsel-gated effects only after their evidence gate; disabled capability schemas/commands remain unreachable.
- **Failure modes:** validation/authority/version failures stop before mutation; ambiguous provider outcomes remain typed pending/unknown; retries reuse idempotency keys; projection lag exposes freshness; deletion/revocation preserves required evidence and invalidates derived access.
- **Integration contracts:** the parent [03-cms-content-modeling § Contracts](../03-cms-content-modeling.md#contracts) defines commands/queries and [03-cms-content-modeling § Event Schemas](../03-cms-content-modeling.md#event-schemas) defines asynchronous handoff. Producers retain canonical ownership; consumers never strengthen provenance, permission, confidence or terminal state.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                           | Workflow                         | Sections Affected                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-08-02 | Initial deep-dive skeleton                                                                                                                                                                                                                                                                                                                                                                       | /decompose-architecture-validate | All                                                                                                               |
| 2026-08-02 | Authored schema, revision, migration, composition, publication, taxonomy, locale and abuse contracts                                                                                                                                                                                                                                                                                             | /write-architecture-spec-deepen  | All                                                                                                               |
| 2026-09-02 | Applied Slice 09 IA-first contract clarification: atomic initial aggregate, model envelope exceptions, locale/workflow/template references, bounded relations, policy-derived approvals, immutable artifacts, protected reads, and release-only block registration                                                                                                                               | /implement-slice                 | Canonical Field Contracts, Schema Compilation, Composition, Cross-Shard Contracts                                 |
| 2026-09-02 | Locked Slice 09 remediation: finite relation bounds and opaque placeholder fallback; server-frozen policy/approval evidence; canonical block-registry digest; always-present nullable migrationPlanId; Ed25519 release envelope and immutable verification evidence                                                                                                                              | /implement-slice                 | Canonical Field Contracts, Model Envelope, Review/Publication, Composition, Abuse Verification                    |
| 2026-09-26 | DEC-106: added protected initial-entry create (BE03b `CMS-03B-10`) and authorized draft-detail read (BE03b `CMS-03B-11`); atomic active entry plus first attributable draft revision with server-derived identity/assignment and create idempotency, authorized draft-detail loading with 404/403 concealment and no-store/ETag, no browser authority fields, browser table grants still revoked | /propagate-decision              | Resolved Architecture Choices, Entry Validation and Revision Merge, Abuse and Recovery Verification, Changelog    |
| 2026-10-02 | DEC-108 consistency closure: `approvalIds` are the approve-decision IDs of one approved review resolved under current assignment authority, and the grantor authority end is defined.                                                                                                                                                                                                            |
| 2026-10-02 | DEC-109/DEC-110/DEC-119: added the workflow policy registry members, `policyHash` and reviewer-slot semantics, the editorial `approvalEvidenceHash` basis, the owner CMS capability grant aggregate and event contract, the two initial transforms, the grant and specialist abuse rows, and the owner-grant provisioning of integrated-path test humans.                                        | /propagate-decision              | Canonical Field Contracts, Review and Publication Algorithm, Migration Algorithm, Abuse and Recovery Verification |
| 2026-10-02 | DEC-119 follow-ups: owner may self-grant any grantable capability with separation enforced at decision time; strictest-of downgrade guard for a successor's review and editorial policy; navigation and media capabilities join the grantable registry                                                                                                                                           | /propagate-decision              | Owner CMS capability grants, Workflow policy registry, Abuse                                                      |

DEC-108 (2026-10-02, owner-approved): private schema-review ownership and bounded
assignment, reachable successor/dry-run/review producers, stable private evidence
and actual source/template prerequisite scope added. No release gate was waived.

## Dependency References

- [[specs/ia/03-cms-content-modeling|Shard 03 — CMS content modeling and authoring]]
- [[specs/ia/01-identity-authority|Shard 01 — Identity authority and party governance]]
- [[specs/ia/00-infrastructure|Shard 00 — Cross-cutting platform foundation]]
- [[specs/2026-08-02-architecture-design|WeJammin — Architecture Design]]

<!-- spec-graph: auto-generated -->

## Related Specs

### References

- [[specs/ia/03-cms-content-modeling|Shard 03 — CMS content modeling and authoring]]
- [[specs/ia/01-identity-authority|Shard 01 — Identity authority and party governance]]
- [[specs/ia/00-infrastructure|Shard 00 — Cross-cutting platform foundation]]
- [[specs/2026-08-02-architecture-design|WeJammin — Architecture Design]]
