# Deep Dive 05 — Platform configuration, admin and quality

> **Parent IA Shard**: [../05-platform-configuration-admin.md](../05-platform-configuration-admin.md)
> **Architecture Source**: [../../2026-08-02-architecture-design.md](../../2026-08-02-architecture-design.md)
> **Status**: Complete — deepening converged

## Scope

This deep dive owns definition/value resolution, controlled activation/runtime delivery, admin capability/task/search/bulk/diagnostic mechanics, portability verification and data-lifecycle orchestration. Shards 03/04 own CMS truth/delivery; Shard 06 owns safety case truth; provider/deploy secret stores own secrets.

CMS schema review is outside the CFG review ledger. DEC-108 (2026-10-02)
defines private CMS-owned reviews/decisions and an owner-only bounded
`cms.schema_review.assign` authority in IA03/BE03a. It grants only read/decide on
one frozen review to an existing eligible human, not generic CFG delegation,
administrator, designer or publisher authority. No owner-bootstrap rerun or
additional identity/real grant follows from approval. Settings candidates retain
their existing `config_change_review` and `config_approval` ownership.

## Deepening Record

| Pass                      | Result                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross-section consistency | Definitions, values, reviews, flags, experiments, switches, grants, tasks, bulk jobs, diagnostics, imports/exports/restores/checks and lifecycle requests share versioned evidence.                    |
| What-if expansion         | Missing parents, stale consumers, expired owners, control outage, revoked grants, changed bulk targets, partial imports, bad exports, failed restore and hold conflicts converge.                      |
| Adversarial pass          | Arbitrary-key injection, secret storage, auth-by-flag, protected-trait experiments, break-glass permanence, count/search leakage, mass mutation, export overreach and erasure of evidence fail closed. |
| Convergence               | Final pass introduced no new boundary, state, actor, field, or unresolved implementation choice.                                                                                                       |

## Canonical Field Contracts

### Settings, Flags, Experiments, and Switches

| Model                        | Fields and constraints                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `setting_definition_version` | `id, definition_id, key, version_no, value_kind, schema jsonb, owner_capability, allowed_scopes[], precedence[], merge_mode, default_source/value?, risk_class, approver_policy, consumer_keys[], lifecycle, hash`; key immutable.   |
| `setting_value_version`      | `id, definition_id/version, scope_type, scope_id?, environment?, typed_value jsonb, effective_from/to?, state, author_person/acting_party, supersedes_id?, value_hash, version`; unique active definition/scope/subject/environment. |
| `config_change_review`       | `id, candidate_type/id/version, frozen_hash, impact_manifest, risk, required_approvals, state, submitted_by/at, version`.                                                                                                            |
| `config_approval`            | `review_id, reviewer_person/context, capability, decision, reason, reviewed_hash, decided_at`; unique reviewer/review.                                                                                                               |
| `feature_flag_version`       | `id, key, owner, purpose, environments[], eligibility_rule_key/version, allocation, fallback, dependencies[], starts/ends, expires_at, state, version`.                                                                              |
| `experiment_version`         | `id, key, owner, hypothesis, eligibility_dimensions[], variants/allocation, metrics[], consent_ref?, stop_rule, starts/ends, state, version`.                                                                                        |
| `kill_switch_version`        | `id, key, owner, allowed_scopes, fallback_mode, runtime_contract_version, state, version`.                                                                                                                                           |
| `kill_switch_activation`     | `id, switch/version, scope, actor/context, reason, started/ends?, canonical_state, runtime_snapshot_hash, incident_ref, version`.                                                                                                    |

### Admin Operations

| Model                           | Fields and constraints                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_capability_grant`        | `id, subject_person_id, capability_key, resource_type/id?, scope jsonb, actions[], starts/ends, grantor, approval/evidence, state, version`; no wildcard action/resource. |
| `admin_task_projection`         | `source_type/id/version, task_class, required_capability, assignee_person?, due_at?, severity, freshness_at, state`; derived, not business truth.                         |
| `bulk_operation`                | `id, command_key/version, query_spec jsonb, target_manifest_object/hash/count, dry_run_report, state, cursor, success/failure/skipped counts, actor/context, version`.    |
| `bulk_item_result`              | `operation_id, target_type/id/expected_version, state, attempt_count, result/error_code, completed_at?`; unique operation/target.                                         |
| `diagnostic_definition_version` | `key/version, owner, input schema, timeout, freshness, evidence schema, severity mapping, runbook, lifecycle/hash`; code-owned.                                           |
| `diagnostic_run`                | `id, definition/version, target, state, started/completed, evidence_ref, result_codes[], freshness_at, actor/job, version`.                                               |

### Portability, Quality, and Lifecycle

| Model                    | Fields and constraints                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import_job`             | `id, source_format/version, object_id, target_scope, mapping_version, duplicate_policy, state, cursor, counts, dry_run/quarantine refs, actor/context, version`.            |
| `export_artifact`        | `id, export_type, scope_manifest, field_manifest, object_id, checksum, encryption_ref?, expires_at, max/download_count, state, actor/context, version`.                     |
| `restore_verification`   | `id, source_artifact/backup, target_environment, schema/count/hash/reference/RLS/render/a11y results, state, reviewer, completed_at, version`.                              |
| `quality_check_run`      | `id, checker_key/version, target_type/id/version, state, findings jsonb, blocking_count, evidence_ref?, run_at`; findings schema bounded.                                   |
| `data_lifecycle_request` | `id, request_type archive\|delete\|anonymize\|hold\|release_hold\|erasure, requester/subject, scope, verification, store_manifest, conflict/decision refs, state, version`. |
| `lifecycle_store_result` | `request_id, store/processor, item_count, action, state, evidence_ref, attempted/completed_at, error_code?`; unique request/store/action.                                   |

## State Machines

| Aggregate         | Allowed transitions                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Definition        | `draft → active → deprecated → retired`; key never reused; retired definitions remain readable for history.                       |
| Value/change      | `draft → review → approved → scheduled\|active → superseded\|rolled_back`; changed hash/authority invalidates review.             |
| Flag              | `draft → active → paused\|expired\|retired`; absent/expired evaluates fallback.                                                   |
| Experiment        | `draft → approved → running → paused\|stopped\|completed`; assignment immutable per user/cohort/version.                          |
| Kill activation   | `requested → active → resolving → ended`; emergency failure still records/reconciles canonical evidence.                          |
| Capability grant  | `pending → active → expired\|revoked`; revocation immediate, no restoration without new grant.                                    |
| Bulk/import       | `draft → dry_run → approved → running → completed\|partial\|failed\|cancelled`; resumes exact target/cursor only.                 |
| Export            | `requested → generating → ready → expired\|revoked\|failed`; expiry/revoke removes delivery before bytes.                         |
| Lifecycle request | `requested → verifying → planned → approved\|blocked → executing → completed\|partial\|failed`; hold conflict may remain blocked. |

## Effective-Value Resolution

1. Load active definition/version by immutable key; caller cannot supply schema/scope/precedence.
2. Build only definition-allowed candidate scopes for request context.
3. Load active time/environment-eligible values; validate each against its own definition version and compatibility.
4. Order by explicit definition precedence. `replace` takes first; `append_unique` preserves higher-first normalized values; `object_merge_allowlist` merges only declared keys.
5. If no value, evaluate contract-owned default source/value. Missing required default is a diagnostic/error, never zero/empty guess.
6. Return typed value and complete safe provenance. Consumer registers supported definition/version range and safe fallback.
7. Consumer incompatible/unavailable uses last compatible or contract fallback and opens diagnostic; never coerces unknown type.

## Change Activation and Runtime Snapshot

- Impact manifest lists consumers, effective contexts, public routes, cache/projection rebuilds, active flags/experiments, risk/checker results and rollback value.
- Approval binds candidate and manifest hashes, reviewer capability/MFA, definition risk policy and effective interval.
- Activation transaction switches active value/version, writes audit/idempotency/outbox and snapshot-build intent.
- Snapshot compiler emits signed/versioned minimum runtime config for consumers that must evaluate without database availability. It contains no secrets/private content and only approved definitions.
- Worker accepts only newer valid signature/schema/environment snapshot. Canonical PostgreSQL remains source; snapshot is a read replica/artifact.
- Kill switch has predeclared default/fallback compiled into runtime contract so safe mode can activate during control-plane outage; reconciliation later records exact incident actor/reason/version.

## Flags and Experiments

- Flag evaluation uses environment, stable subject/cohort hash and explicit eligibility rule registry. Evaluation is deterministic and logged by version, not raw user traits.
- Flag cannot change endpoint/RLS authorization, legal status, consent, entitlement, price already agreed, ledger or evidence state.
- Experiment dimensions are allowlisted non-protected product context; special-category/protected traits, private message/content and inferred vulnerability are prohibited.
- Experiment assignment is sticky for experiment version; allocation change creates a new version/cohort policy and never rewrites historical exposure.
- Every flag/experiment has owner, expiry/end, fallback and cleanup task. Expired/unknown evaluates safe fallback.

## Admin Search, Tasks, and Bulk

- Task projections read source IDs/status/freshness only. Source domain remains truth and task completion rechecks it.
- Search schemas define allowed entity types, fields, filters, sort, snippets and minimum-count policy. Per-result and aggregate/count authorization apply before response.
- Bulk dry run resolves exact ordered target IDs/versions into protected manifest object; execution never reruns broad query or adds targets.
- Each item calls the ordinary guarded command with bulk operation correlation/idempotency. Item version mismatch skips/fails that item.
- Capability revocation prevents new leases/items. Cancel stops future items; completed effects remain and rollback uses explicit compensating command if supported.

## Portability Algorithms

### Import

1. Private upload and scan source; identify format/version/encoding.
2. Map only supported CMS schemas, fields, terms, routes, media manifests and settings definitions/values.
3. Validate every row/reference/value and classify create/update/duplicate/conflict/quarantine/unsupported.
4. Dry run emits counts, sampled/bounded errors, route/media/rights/accessibility impact and target versions.
5. Approved execution uses exact mapping/source hash and bounded batches; imported claims remain source-marked and cannot create authority/verification/consent/rights/money truth.

### Export and Restore

- Export compiler uses exact allowlisted scope/fields, canonical versions and referenced-object manifest; excludes secrets and unrelated protected evidence.
- Artifact is encrypted where required, checksummed, short-lived, download-limited and audited; link/token possession does not replace authorization.
- Restore runs only in isolated non-production target first, applies supported migrations, restores objects/metadata, then verifies schema, counts, hashes, references, RLS, representative rendering, accessibility and absence of secrets.
- Supabase Free has no production PITR or RPO/RTO guarantee. Shard 00 therefore keeps protected writes closed; synthetic/local restore and CMS export are diagnostic portability evidence only and cannot open the recovery gate.

## Quality and Lifecycle Algorithms

- Quality checker registry is code-owned/versioned; results are evidence against exact target/version and expire when target/checker dependency changes.
- Blocking set includes invalid structure/schema/reference, inaccessible required content/block, privacy/rights/legal/route blocker and failed required rendition. Readability/style are warnings unless explicit policy says otherwise.
- Lifecycle planner enumerates canonical DB rows, revisions, projections, objects/renditions, caches/search/sitemap, exports/backups/processors and shared/third-party references.
- Legal hold prevents destructive actions but does not grant broad access; held data is sealed/minimized and every access audited.
- Erasure/anonymization separates subject-owned optional content from jointly authored evidence/obligations and records exceptions. CMS cannot decide legal exception; counsel-approved rule pack/operator does.
- Completion requires store-by-store evidence and residual manifest. Partial completion remains open and user/operator status is truthful.

## Abuse and Recovery Verification

| Threat/failure                   | Required proof                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Arbitrary key/secret/invariant   | Unknown definition, secret-like value, protected category and scope escalation reject before persistence. |
| Authorization by flag            | Same user/party/resource remains denied by endpoint/RLS across all flag variants.                         |
| Experiment discrimination        | Protected/private dimensions rejected; consent/eligibility/assignment tests deterministic.                |
| Break-glass abuse                | MFA, reason, bounded scope/term, notification, evidence and automatic expiry/revocation tests pass.       |
| Search/count leak                | Wrong capability cannot infer protected existence through result, snippet, facet or count.                |
| Bulk mass overreach              | Execution target set equals dry-run manifest exactly; query drift cannot add items.                       |
| Export exfiltration              | Field/scope allowlist, expiry/download/revocation and wrong-user/party tests deny.                        |
| Restore false confidence         | Count-only success fails when RLS/reference/render/a11y checks fail.                                      |
| Erasure destroys shared evidence | Conflict planner holds/minimizes/routes exception; no silent cascade.                                     |
| Diagnostic false healthy         | timeout/unavailable/stale dependency yields unknown/stale, never healthy.                                 |

## Cross-Shard Contracts

| Consumer         | Contract                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shards 03/04     | Typed setting/flag values, risk/checker definitions, admin tasks/diagnostics/import/export/lifecycle orchestration; cannot weaken their invariants. |
| Shard 06         | Admin capability/audit/notification/evidence/hold task contracts; Shard 06 owns case/safety truth and restrictions.                                 |
| Shard 00         | Runtime snapshot, jobs, logging, SLO/runbook/recovery and secret/deploy boundary.                                                                   |
| All later shards | Contract-owned product variables and registered consumers; domains own business/legal/transaction truth.                                            |

## Implementation Envelope

- **Technology choice:** canonical domain state uses Supabase PostgreSQL with RLS, typed Hono/Zod command/query boundaries, transactional outbox events, Cloudflare Queue workers for bounded asynchronous effects, and Astro/React web/PWA projections; external systems remain replaceable provider adapters.
- **Rationale:** one PostgreSQL authority plus additive events prevents split truth, RLS enforces tenant/party scope near data, and queued adapters isolate provider latency without weakening canonical-state or p95 web-read guarantees.
- **Phasing:** (1) schema/RLS/settings and capability gates, (2) commands/events/idempotency, (3) projections and accessible surface, (4) provider or counsel-gated effects only after their evidence gate; disabled capability schemas/commands remain unreachable.
- **Failure modes:** validation/authority/version failures stop before mutation; ambiguous provider outcomes remain typed pending/unknown; retries reuse idempotency keys; projection lag exposes freshness; deletion/revocation preserves required evidence and invalidates derived access.
- **Integration contracts:** the parent [05-platform-configuration-admin § Contracts](../05-platform-configuration-admin.md#contracts) defines commands/queries and [05-platform-configuration-admin § Event Schemas](../05-platform-configuration-admin.md#event-schemas) defines asynchronous handoff. Producers retain canonical ownership; consumers never strengthen provenance, permission, confidence or terminal state.

## Changelog

| Date       | Change                                                                                   | Workflow                         | Sections Affected |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------------------- | ----------------- |
| 2026-08-02 | Initial deep-dive skeleton                                                               | /decompose-architecture-validate | All               |
| 2026-08-02 | Authored resolution, runtime, admin, portability, quality, lifecycle and abuse contracts | /write-architecture-spec-deepen  | All               |

## Dependency References

- [[specs/ia/05-platform-configuration-admin|Shard 05 — Platform configuration, admin and quality]]
- [[specs/ia/04-cms-delivery-media|Shard 04 — CMS navigation, media and delivery]]
- [[specs/ia/03-cms-content-modeling|Shard 03 — CMS content modeling and authoring]]
- [[specs/ia/01-identity-authority|Shard 01 — Identity authority and party governance]]
- [[specs/ia/00-infrastructure|Shard 00 — Cross-cutting platform foundation]]
- [[specs/2026-08-02-architecture-design|WeJammin — Architecture Design]]

<!-- spec-graph: auto-generated -->

## Related Specs

### References

- [[specs/ia/05-platform-configuration-admin|Shard 05 — Platform configuration, admin and quality]]
- [[specs/ia/04-cms-delivery-media|Shard 04 — CMS navigation, media and delivery]]
- [[specs/ia/03-cms-content-modeling|Shard 03 — CMS content modeling and authoring]]
- [[specs/ia/01-identity-authority|Shard 01 — Identity authority and party governance]]
- [[specs/ia/00-infrastructure|Shard 00 — Cross-cutting platform foundation]]
- [[specs/2026-08-02-architecture-design|WeJammin — Architecture Design]]
