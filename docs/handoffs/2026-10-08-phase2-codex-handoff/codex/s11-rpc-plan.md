[codex] Starting Codex task thread.
[codex] Thread ready (01a11b72-0673-7481-98eb-2278b910c544).
[codex] Turn started (01a11b72-0a9d-7ba1-a87c-d57a7a7602a0).
[codex] Assistant message captured: I’ll use the project’s adversarial-review skill for contradiction/evidence discipline and par...
[codex] Running command: /usr/bin/zsh -lc 'cat /home/rob/.codex/worktrees/phase2-slice11/WeJammin/.codex/skills/parall...
[codex] Command completed: /usr/bin/zsh -lc 'cat /home/rob/.codex/worktrees/phase2-slice11/WeJammin/.codex/skills/parall... (exit 0)
[codex] Running command: /usr/bin/zsh -lc 'cat /home/rob/.codex/worktrees/phase2-slice11/WeJammin/.codex/skills/advers...
[codex] Command completed: /usr/bin/zsh -lc 'cat /home/rob/.codex/worktrees/phase2-slice11/WeJammin/.codex/skills/advers... (exit 0)
[codex] Running command: /usr/bin/zsh -lc 'rg -n "Slice 11|CMS-03B-05|DEC-134|DEC-149|2026100501|lock order" /home/rob...
[codex] Command completed: /usr/bin/zsh -lc 'rg -n "Slice 11|CMS-03B-05|DEC-134|DEC-149|2026100501|lock order" /home/rob... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '70,82p' /home/rob/.codex/memories/MEMORY.md"
[codex] Command completed: /usr/bin/zsh -lc "sed -n '70,82p' /home/rob/.codex/memories/MEMORY.md" (exit 0)
[codex] Running command: /usr/bin/zsh -lc 'cat /home/rob/.codex/memories/rollout_summaries/2026-10-07T17-08-15-yhjP-we...
[codex] Command completed: /usr/bin/zsh -lc 'cat /home/rob/.codex/memories/rollout_summaries/2026-10-07T17-08-15-yhjP-we... (exit 0)
[codex] Assistant message captured: Work split is now six read-only lanes: BE03b RPC contracts, criteria/decisions, existing SQL ...
[codex] Calling context-mode/ctx_batch_execute.
[codex] Tool context-mode/ctx_batch_execute completed.
[codex] Calling context-mode/ctx_search.
[codex] Tool context-mode/ctx_search completed.
[codex] Running command: /usr/bin/zsh -lc "rg -n '"'^## |''^### '"' .memory/wiki/specs/be/03b-editorial-workflow-publi...
[codex] Command completed: /usr/bin/zsh -lc "rg -n '"'^## |''^### '"' .memory/wiki/specs/be/03b-editorial-workflow-publi... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '145,245p' .memory/wiki/specs/be/03b-editorial-workflow-publication.md"
[codex] Command completed: /usr/bin/zsh -lc "sed -n '145,245p' .memory/wiki/specs/be/03b-editorial-workflow-publication.md" (exit 0)
[codex] Running command: /usr/bin/zsh -lc 'rg -n "ReviewSubmissionRequest|EditorialReviewResource|EditorialDecisionReq...
[codex] Command completed: /usr/bin/zsh -lc 'rg -n "ReviewSubmissionRequest|EditorialReviewResource|EditorialDecisionReq... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '900,1005p' .memory/wiki/specs/be/03b-editorial-workflow-publication...
[codex] Running command: /usr/bin/zsh -lc "sed -n '500,620p' .memory/wiki/specs/be/03b-editorial-workflow-publication.md"
[codex] Running command: /usr/bin/zsh -lc "sed -n '1260,1510p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '900,1005p' .memory/wiki/specs/be/03b-editorial-workflow-publication... (exit 0)
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1260,1510p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio... (exit 0)
[codex] Command completed: /usr/bin/zsh -lc "sed -n '500,620p' .memory/wiki/specs/be/03b-editorial-workflow-publication.md" (exit 0)
[codex] Running command: /usr/bin/zsh -lc "rg --files supabase/migrations | rg '/20260927090000_cms_editorial_support_...
[codex] Command completed: /usr/bin/zsh -lc "rg --files supabase/migrations | rg '/20260927090000_cms_editorial_support_... (exit 0)
[codex] Calling context-mode/ctx_batch_execute.
[codex] Tool context-mode/ctx_batch_execute completed.
[codex] Running command: /usr/bin/zsh -lc "sed -n '1,180p' supabase/migrations/20261005012100_cms_write_path_lock_help...
[codex] Running command: /usr/bin/zsh -lc "sed -n '1,180p' supabase/migrations/20261005013000_cms_activation_lock_orde...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1,180p' supabase/migrations/20261005013000_cms_activation_lock_orde... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '1,180p' supabase/migrations/20261005016000_cms_activation_no_late_a...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1,180p' supabase/migrations/20261005012100_cms_write_path_lock_help... (exit 0)
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1,180p' supabase/migrations/20261005016000_cms_activation_no_late_a... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '1955,1995p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1955,1995p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "rg -n \"create or replace function platform_private\\.cms_(reserve|reserve_...
[codex] Command completed: /usr/bin/zsh -lc "rg -n \"create or replace function platform_private\\.cms_(reserve|reserve_... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "rg -n \"create or replace function platform_private\\.cms_(reserve|reserve_...
[codex] Command completed: /usr/bin/zsh -lc "rg -n \"create or replace function platform_private\\.cms_(reserve|reserve_... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '1,70p' supabase/migrations/20261003130000_cms_reserve_conflict_type...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1,70p' supabase/migrations/20261003130000_cms_reserve_conflict_type... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '55,125p' supabase/migrations/20260930150000_cms_idempotency_busines...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '55,125p' supabase/migrations/20260930150000_cms_idempotency_busines... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '1,90p' supabase/migrations/20261002125000_cms_schema_review_support...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1,90p' supabase/migrations/20261002125000_cms_schema_review_support... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '2220,2470p' supabase/migrations/20260902080000_content_schema_regis...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '2220,2470p' supabase/migrations/20260902080000_content_schema_regis... (exit 0)
[codex] Starting collaboration tool: wait.
[codex] Collaboration tool wait completed.
[codex] Starting collaboration tool: wait.
[codex] Collaboration tool wait completed.
[codex] Starting collaboration tool: wait.
[codex] Collaboration tool wait completed.
[codex] Starting collaboration tool: wait.
[codex] Collaboration tool wait completed.
[codex] Starting collaboration tool: wait.
[codex] Collaboration tool wait completed.
[codex] Assistant message captured: Source reconciliation is complete. Two contract-level blockers are already clear: BE03b does ...
[codex] Running command: /usr/bin/zsh -lc 'rg -n "thread_id:|one global lock order|Key findings:|Lock-order inversion|...
[codex] Command completed: /usr/bin/zsh -lc 'rg -n "thread_id:|one global lock order|Key findings:|Lock-order inversion|... (exit 0)
[codex] Running command: /usr/bin/zsh -lc 'rg -n "rollout_summaries/2026-10-07T17-08-15|PostgreSQL, cms_activate_schem...
[codex] Command completed: /usr/bin/zsh -lc 'rg -n "rollout_summaries/2026-10-07T17-08-15|PostgreSQL, cms_activate_schem... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '1698,1720p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1698,1720p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio... (exit 0)
[codex] Running command: /usr/bin/zsh -lc "sed -n '1824,1877p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio...
[codex] Command completed: /usr/bin/zsh -lc "sed -n '1824,1877p' .memory/wiki/specs/be/03b-editorial-workflow-publicatio... (exit 0)
[codex] Assistant message captured: # Slice 11 RPC plan ## 0. Contract status and non-invention rule BE03b names the browser RPCs...
[codex] Turn completion inferred after the main thread finished and subagent work drained.
# Slice 11 RPC plan

## 0. Contract status and non-invention rule

BE03b names the browser RPCs but does not give their SQL signatures, concrete PostgreSQL grant roles, or individual `SECURITY DEFINER|INVOKER` declarations. It gives exact schema qualification only for CMS-03B-19/20 and then lists the remaining functions unqualified. Therefore:

- The signatures below are the exact proposed implementation plan, derived from the established Slice 10 convention: a `platform_private.<name>(p_request jsonb) RETURNS jsonb` implementation plus a `platform_api.<name>(p_request jsonb) RETURNS jsonb` wrapper for protected HTTP operations.
- Browser-facing `platform_api` wrappers use `SECURITY DEFINER`, `SET search_path=''`, owner `wejammin_cms_definer`, `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, and `GRANT EXECUTE ... TO service_role`. Private implementations are executable only by their owner or explicitly required helper roles.
- CMS-03B-19 and CMS-03B-20 cannot receive final executable grants yet: BE03b requires one dedicated Shard 04 delivery principal and one scheduled-worker principal, but supplies neither PostgreSQL role identifier. Granting generic `service_role` would contradict the one-principal restriction. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:172-180,1986-1994`; `supabase/migrations/20261005010300_cms_conflict_detail_read.sql:308-328`)
- Existing wrappers, helpers, ownership, and grants establish the single-JSON request convention and definer discipline. (`supabase/migrations/20260902080000_content_schema_registry_authority.sql:2227-2462`; `supabase/migrations/20261005013100_cms_deadlock_typed_conflict.sql:19-164`)

## 1. Shared SQL conventions

### Existing helpers to reuse

| Concern | Existing helper |
|---|---|
| Actor, acting context, correlation | `platform_private.cms_actor(jsonb) → uuid`; `cms_acting_party(jsonb,uuid) → uuid`; `cms_correlation(jsonb) → uuid` |
| Capability | `cms_require_capability(uuid,uuid,text) → void`; review-specific `cms_review_binding`, `cms_review_person_eligible`, `cms_review_is_owner`, `cms_review_owner_authority_end`, `cms_person_holds_capability` |
| Idempotency | `cms_reserve_conflict(jsonb,uuid,text) → idempotency_records`; `cms_complete(uuid,uuid,integer,jsonb) → void` |
| CAS | `cms_expected_version(jsonb) → bigint` |
| Audit | `cms_record_audit(text,uuid,uuid,text,uuid,text,uuid) → void` |
| Audit plus outbox | `cms_emit_event(...) → uuid` |
| Schema/version fencing | `cms_lock_schema_version_shared(uuid) → void` |
| Entry authority | `cms_lock_entry_authority(uuid,uuid,uuid) → void`; `cms_require_entry_capability_locked(uuid,uuid,text[],uuid) → text` |
| Relation targets | `cms_lock_entry_rows_shared(uuid[])`; `cms_lock_relation_target(uuid,uuid,uuid)` |
| Signed keyset cursor | `cms_signed_cursor_require_key()`; `cms_signed_cursor_open(text,jsonb,text[])`; `cms_signed_cursor_seal_page(text,jsonb,text[])` |
| Canonical hashing | `cms_jcs_sha256(jsonb) → text` |

Sources: `supabase/migrations/20260902080000_content_schema_registry_authority.sql:2227-2462`; `supabase/migrations/20261002125000_cms_schema_review_support.sql:29-386`; `supabase/migrations/20261005010400_cms_revision_comparison_domains.sql:67-240`; `supabase/migrations/20261005012100_cms_write_path_lock_helpers.sql:69-337`.

Idempotency storage is already scoped by `(actor_id, operation, key_hash)`; its request hash binds the resolved acting party. A changed request with the same key raises `IDEMPOTENCY_MISMATCH`. (`supabase/migrations/20260930150000_cms_idempotency_business_hash.sql:55-125`; `supabase/migrations/20261003130000_cms_reserve_conflict_typed_idempotency_mismatch.sql:1-27`)

### Existing global lock order

The exact locked order is:

> acting-context binding → `person_party` → `membership_tenure` → `organization_actor_grant` → `cms_entry_assignments`/presence → activation candidate → dependency graph → active content-type version → review rows → review assignments → migration plan

An entry writer additionally locks its target `ContentEntry` before authority rows, and relation targets—entry then assignments, ascending UUID—sit between authority and schema locks. A command may skip a position but may never acquire an earlier position after a later one. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1698-1720`; `supabase/migrations/20261005013000_cms_activation_lock_order.sql:17-34`)

Proposed Slice 11 extensions:

| Position | New lock |
|---|---|
| −1 | Owner settings-snapshot advisory lock, before any entry/domain lock |
| 5 | Editorial review row, editorial assignments, and decisions; already the review position |
| 6 | Publication schedule row or preview-token rows |
| 7 | Publication-lineage advisory lock, then current lineage head/publication rows |

Consequences:

- Preflight dependency/schema/reference reads and locks occur before position 5.
- Execution obtains authority/dependency/review locks before the schedule row, rechecks the lease after locking it, then obtains the lineage lock.
- `cms_append_publication_lineage` assumes all earlier locks are already held and acquires only position 7.
- Residual deadlocks map to `P0001 'CONFLICT'`, HTTP 409, commit nothing, and permit the same idempotency key. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1713-1720`; `supabase/migrations/20261005013100_cms_deadlock_typed_conflict.sql:1-15`)

## 2. Complete typed refusal catalog

All database symbolic refusals use SQLSTATE `P0001`. Validation `DETAIL`, when present, is a JSON array of RFC 6901 request-body pointers. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1901-1906`; `supabase/migrations/20261005012100_cms_write_path_lock_helpers.sql:29-37`)

| HTTP mapping | Token or `details.reasonCode` |
|---|---|
| 401 `UNAUTHENTICATED` | `UNAUTHENTICATED` |
| 401 `STEP_UP_REQUIRED` | `STEP_UP_REQUIRED`; recovery details are `step_up` and allowed methods |
| 403 `FORBIDDEN` | `capability_missing`, `separation_of_duties` |
| 409 `CONFLICT` | `revision_not_submittable`, `dependency_changed`, `version_set_stale`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `publication_conflict`, `publication_not_active`, `preview_expired`, `preflight_evidence_stale` |
| 409 `VERSION_MISMATCH` | stale authorized CAS operand; includes safe expected/current versions |
| 409 `CONFLICT` | `IDEMPOTENCY_MISMATCH`, inherited from BE00 |
| 422 `VALIDATION_FAILED` | `preflight_failed`, `dependency_manifest_too_large`, `unknown_timezone`, `tzdb_version_mismatch`, `nonexistent_local_time`, `ambiguous_local_time`, `disambiguation_not_applicable`, `resolved_utc_mismatch`, `schedule_out_of_horizon`, `authority_ends_before_schedule`, `expiry_out_of_bounds` |
| 422 `VALIDATION_FAILED` write-value reasons | `rich_text_not_canonical`, `object_kind_unspecified`, `object_property_invalid`, `relation_target_unavailable`, `taxonomy_source_unavailable`, `term_unavailable`, `media_source_unavailable` |
| 503 `DEPENDENCY_UNAVAILABLE` | unavailable preflight; `dependencyClass='preflight'`, `retryable=true` |

The schedule’s closed result reasons are `approval_invalidated`, `preflight_failed`, `publisher_authority_ended`, `publication_not_active`, `retries_exhausted`, and `entry_unavailable`. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1876,1895-1906`)

## 3. Route and command RPCs

Every browser row below means two definitions with the same signature:

```sql
platform_private.<name>(p_request jsonb) RETURNS jsonb
platform_api.<name>(p_request jsonb) RETURNS jsonb
```

Both are `SECURITY DEFINER`, `SET search_path=''`, owned by `wejammin_cms_definer`; only the `platform_api` wrapper is granted to `service_role`.

### 3.1 `platform_private.cms_submit_review` / `platform_api.cms_submit_review`

- Request: `{entryId: uuid, revisionId: uuid, frozenHash: char(64), dependencyManifest: jsonb}` plus transport-injected `idempotencyKey`, `ifMatch`, context, and correlation.
- Return JSON: `EditorialReviewResource` with `id`, `version`, `createdAt`, `updatedAt`, `state`, `entryId`, `revisionId`, `riskClass`, `workflowPolicy`, `activationEvidence`, `frozenHash`, `requiredDecisionCount`, `recordedDecisionCount`, `dependencyHash`, `invalidatedReason`, `submittedAt`, `decidedAt`.
- Access: assigned author/editor with submission authority; hidden entry/revision is 404.
- Reuses: actor/context/correlation, entry-authority lock, schema-version lock, `cms_build_dependency_manifest`, preflight evaluator, reserve/complete, audit/event.
- Reads: entry, revision, field values, relations, schema/content-type version, workflow-policy evidence, settings snapshot, preflight registry, reference projections.
- Writes: editorial review, review-dependency rows, idempotency, audit, one `cms.entry.review-changed.v1`.
- Lock order: settings advisory −1 → entry 0 → authority 1 → relation targets 2 → candidate/dependencies 3 → active schema 4 → live-review uniqueness/review rows 5.
- Idempotency: operation scope `CMS-03B-05`; actor + acting-party-bound request hash + caller key. Exact replay returns the stored review.
- Refusals: `capability_missing`, `revision_not_submittable`, `dependency_changed`, `version_set_stale`, `preflight_evidence_stale`, `dependency_manifest_too_large`, `preflight_failed`, unavailable preflight, `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH`.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:157,511-516,831-930,1747-1802,1878-1906,2060`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:30-35,110-127`.

### 3.2 `platform_private.cms_record_review_decision` / `platform_api.cms_record_review_decision`

- Request: `{reviewId: uuid, decision: 'approve'|'reject', reason: text, expectedVersion: bigint}`.
- Return: the same `EditorialReviewResource` shape as submit.
- Access: active editorial-review assignment plus `cms.reviewer`, specialist capability when satisfying a specialist slot, and unconditional recent MFA.
- Reuses: `cms_review_binding(...,true)`, review/assignment eligibility helpers, manifest builder, preflight/current-dependency checks, reserve/complete, audit/event.
- Reads: review, frozen dependencies, revision/entry, assignments, decisions, tenure/grants, policy registry.
- Writes: one immutable decision, review CAS/version/state/count, optional committed review invalidation, idempotency, audit, one review-changed event.
- Lock order: authority 1 → candidate/dependency/schema 3–4 → review and assignments 5. The current prose saying the manifest rebuild occurs while already holding the review lock must be corrected; see contradictions.
- Idempotency: scope `CMS-03B-06`; exact replay returns the completed decision response.
- Refusals: `capability_missing`, `separation_of_duties`, `dependency_changed`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `preflight_evidence_stale`, `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH`; malformed decision/reason is 422.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:158,517-522,1824-1840,1878-1906,2060`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:36-41,133-135`.

### 3.3 `platform_private.cms_schedule_publication` / `platform_api.cms_schedule_publication`

- Request: `{revisionId, action, localDateTime, timezone, resolvedUtc, tzdbVersion, disambiguation, audience, expectedVersion}` with UUID/text/timestamptz/bigint encodings.
- Return: `{id,version,createdAt,updatedAt,state,entryId,revisionId,action,localDateTime,timezone,resolvedUtc,tzdbVersion,disambiguation,audience,jobId,actualUtc,deviationSeconds,reasonCode,attemptCount}`.
- Access: owner-party `cms.publisher`, unconditional MFA, never revision author; publisher grant must remain valid through the scheduled instant.
- Reads: approved review and frozen evidence, revision/entry, publisher grant, pinned tz registry, all 17 preflight categories.
- Writes: pending schedule, idempotency, audit. No publication event until execution.
- Lock order: settings −1 → publisher authority 1 → dependency/schema 3–4 → approved review 5 → schedule uniqueness/row 6.
- Idempotency: scope `CMS-03B-07`; duplicate identity is `(entry,revision,action,local time,timezone,audience)`.
- Refusals: `capability_missing`, `separation_of_duties`, `dependency_changed`, `version_set_stale`, `preflight_evidence_stale`, all timezone/horizon/disambiguation tokens, `authority_ends_before_schedule`, `preflight_failed`, unavailable preflight, `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH`.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:159,523-549,930-963,1809-1824,1878-1906,2062`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:42-47,128-132`.

### 3.4 `platform_private.cms_mint_preview` / `platform_api.cms_mint_preview`

- Request: `{entryId,revisionId,locale,audience,route,versionSet}` plus entry-version `If-Match`.
- Return: `{token,expiresAt,entryId,revisionId,locale,audience,route,versionSet,revoked}`.
- Access: entry assignee, active reviewer assignee for the revision, or owner-party publisher. No MFA.
- Reuses: acting-context version helper, HMAC/JCS helper, reserve/complete, audit.
- Reads: entry/revision, preview scope, exact version set, active capabilities.
- Writes: hash-only preview-token row, idempotency, audit; no outbox.
- Lock order: entry 0 → authority 1 → schema/version evidence 4 → preview-token row 6.
- Idempotency: scope `CMS-03B-08`; exact replay re-derives the same token while active and unexpired.
- Refusals: `capability_missing`, `version_set_stale`, `preview_expired`, `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH`; route/audience/version validation is 422.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:160,550-560,964-975,1859-1864,1878-1906,2064`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:48-53,142-143`.

### 3.5 `platform_private.cms_publish_revision` / `platform_api.cms_publish_revision`

- Request: `{entryId,revisionId,frozenHash,expectedVersionSet,audience,expectedVersion}`.
- Return: `{id,version,createdAt,updatedAt,state,action,publicationVersionId,entryId,revisionId,locale,audience,publicationHash,projectionState,eventType:'cms.publication.changed.v1'}`.
- Access: owner-party `cms.publisher`, unconditional MFA, never revision author.
- Reuses: manifest/settings/preflight helpers, lineage append, reserve/complete, `cms_emit_event`.
- Reads: entry/revision, approved review, dependencies, publisher authority, settings/preflight registry, current lineage.
- Writes: append-only publication version, idempotency, audit, one outbox event.
- Lock order: settings −1 → publisher authority 1 → dependency/schema 3–4 → review 5 → lineage advisory/head 7.
- Idempotency: scope `CMS-03B-09`; lineage uniqueness is `(entry,locale,audience,version)`.
- Refusals: `capability_missing`, `separation_of_duties`, `dependency_changed`, `version_set_stale`, `publication_conflict`, `publication_not_active`, `preflight_evidence_stale`, `preflight_failed`, unavailable preflight, `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH`.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:161,561-568,976-991,1855-1858,1878-1906,2062`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:54-59,139-141`.

### 3.6 `platform_private.cms_get_entry_workflow` / `platform_api.cms_get_entry_workflow`

- Request: `{entryId:uuid, revisionId?:uuid}`.
- Return: `{entry,revision,preparation,review,schedules,publications,permittedNextActions}`. `preparation` contains `{frozenHash,dependencyManifest,dependencyHash,versionSet,riskClass,workflowPolicy,preflight}`; preflight has exactly 17 ordered results.
- Access: entry assignee, owner-party publisher, or active reviewer assignee.
- Reads: entry/revision, latest review, schedules, publication lineage, dependencies, settings, preflight registry.
- Writes/locks/idempotency: none; safe no-store read and no idempotency key.
- Refusals: ordinary read errors only—400, 401, 403, concealed 404, 415, 422 response-bound failure, 429, and bounded dependency 502–504.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:167,569-586,1344-1390,1878-1899,2064`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:72-77`.

### 3.7 `platform_private.cms_get_editorial_review` / `platform_api.cms_get_editorial_review`

- Request: `{reviewId:uuid}`.
- Return: review base plus `revisionNumber`, `locale`, `contentTypeLabel`, `frozen`, `distinctApprovalCount`, `decisions`, owner-only `assignments`, `myAssignment`, `permittedNextActions`. Decision summaries expose another reviewer’s reason as `null`.
- Access: submitter, active reviewer assignee, entry assignee, owner-party publisher, or receipt-derived owner.
- Reads: review, revision/entry, decisions, assignments, live grants.
- Writes/locks/idempotency: none.
- Refusals: read-only 400/401/403/concealed 404/415/422/429/502–504.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:168,1392-1440,1878-1899,2064`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:78-83`.

### 3.8 `platform_private.cms_list_editorial_reviews` / `platform_api.cms_list_editorial_reviews`

- Request: `{cursor?:text|null,limit:1..50,scope:'assigned'|'submitted',state?:EditorialReviewState}`.
- Return: `{items,nextCursor,pageVersion}`; each item has `reviewId`, `entryId`, `revisionId`, `revisionNumber`, `locale`, `contentTypeLabel`, `state`, `riskClass`, decision counts, `myDecision`, `assignmentEndsAt`, `submittedAt`, `updatedAt`.
- Access: verified human; rows limited strictly to the requested assigned/submitted scope.
- Reuses: existing signed-cursor open/seal helpers with a new domain such as `cms-03b-17`.
- Reads: reviews, revision/entry labels, caller decisions and assignment.
- Writes/locks/idempotency: none.
- Ordering: `(updatedAt DESC, reviewId DESC)`.
- Refusals: structural cursor/query 400; well-formed expired, tampered, or foreign-context cursor 409; other query violations 422.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:169,586-592,1431-1451,1721-1730,1878-1899`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:84-89`; `.memory/wiki/decisions.md:2044-2060`.

### 3.9 `platform_private.cms_assign_editorial_reviewer` / `platform_api.cms_assign_editorial_reviewer`

- Request union:
  - create: `{action:'create',expectedVersion,reviewerPersonId,expiresAt,reason?}`
  - revoke: `{action:'revoke',expectedVersion,assignmentId,reason?}`
- Return: `{id,version,createdAt,updatedAt,reviewId,state,capability:'cms.editorial_review',actions:['read','decide'],startsAt,expiresAt,reason}`.
- Access: receipt-derived owner holding ungrantable `cms.editorial_review.assign`, current `cms.editor`, and unconditional MFA.
- Reads: review/revision author and submitter, prospective reviewer standing grants/tenure, owner authority end.
- Writes: assignment CAS, idempotency, audit, one review-changed event; review version remains unchanged.
- Lock order: owner/reviewer authority 1 → review and assignment rows 5.
- Idempotency: scope `CMS-03B-18`.
- Refusals: `capability_missing`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `review_not_open`, `expiry_out_of_bounds`, `VERSION_MISMATCH`, `IDEMPOTENCY_MISMATCH`.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:170,593-608,1453-1465,1824-1838,1878-1906`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:90-95,144`.

## 4. Internal service RPCs

### 4.1 `platform_api.cms_verify_preview_token(p_request jsonb) RETURNS jsonb`

- Request: `{tokenHash:char(64),actorPersonId:uuid,actingContextVersion:char(64),route:text,locale:text,audience:text}`.
- Result:
  - valid: `{valid:true,userId,entryId,revisionId,exactVersionSet,expiresAt,revoked:false}`
  - denied: `{valid:false,userId:null,entryId:null,revisionId:null,exactVersionSet:null,expiresAt:null,revoked:boolean}`
- `SECURITY DEFINER`, empty search path, owner `wejammin_cms_definer`.
- Grant: unresolved exact Shard 04 delivery PostgreSQL role; all other roles revoked.
- Reads: preview token, entry/revision, current capability snapshot/scope.
- Writes/locks/idempotency: none. Unknown, ambiguous, timeout, or transport failure denies.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:174-180,608-617,1462-1482,1859-1864`; `.memory/wiki/specs/be/04c-public-delivery-cache.md:85-94,319-333,361-365`.

### 4.2 `platform_private.cms_claim_due_publication_schedules(p_batch integer) RETURNS SETOF jsonb`

Each row is:

```json
{
  "scheduleId": "uuid",
  "revisionId": "uuid",
  "scheduleVersion": 1,
  "expectedVersion": 1,
  "leaseId": "uuid",
  "dependencyHash": "64hex",
  "activationEvidenceHash": "64hex",
  "correlationId": "uuid"
}
```

- Valid batch: 1–100; scheduled worker uses 25.
- Grant: unresolved exact scheduled-worker PostgreSQL role.
- Reads/writes: due schedules; `FOR UPDATE SKIP LOCKED`; pending/failed-retryable → executing, version +1, new five-minute lease. Expired executing leases are returned to failed-retryable with attempt increment before reclaim.
- Lock: position 6 only; it must not acquire an earlier lock after claiming.
- Idempotency: lease/version CAS, not an `Idempotency-Key`.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:179,1484-1494,1865-1868`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:102-107`.

### 4.3 `platform_private.cms_execute_publication_schedule(p_schedule_id uuid, p_expected_version bigint, p_lease_id uuid, p_evidence jsonb) RETURNS jsonb`

Result:

```json
{
  "scheduleId": "uuid",
  "outcome": "completed|blocked|failed_retryable|already_completed|cancelled",
  "reasonCode": "token|null",
  "publicationVersionId": "uuid|null",
  "actualUtc": "timestamptz|null",
  "deviationSeconds": "integer|null"
}
```

`cancelled` is included in this plan because execution explicitly produces it; its absence from the current Zod enum is an open contradiction.

- Grant: unresolved exact scheduled-worker PostgreSQL role.
- Reuses: preflight evaluator, lineage append, audit/event.
- Reads: schedule identity/lease, approved review, frozen dependencies, schedule creator’s publisher authority, all 17 preflights, lineage head.
- Writes: schedule CAS/retry state, publication row, audit, one publication-changed outbox event.
- Lock order: authority 1 → dependency/schema 3–4 → review 5 → schedule 6 and lease recheck → lineage 7.
- Idempotency: `(schedule_id, expected_version)`; completed replay returns `already_completed`.
- Result reasons: `approval_invalidated`, `preflight_failed`, `publisher_authority_ended`, `publication_not_active`, `retries_exhausted`, `entry_unavailable`.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:179,1495-1513,1865-1876,1905-1906`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:102-107`.

## 5. Invalidation, preflight, lineage, and outbox functions

### 5.1 `platform_private.cms_invalidate_reviews_for_person(p_person_id uuid, p_capability text) RETURNS integer`

- Existing normative name and arguments; proposed return is the number of reviews transitioned.
- `SECURITY DEFINER`; owner `wejammin_cms_definer`; no API-role grant.
- Reads: live decisions/assignments and current standing grants.
- Writes: live reviews → invalidated, pending/retryable schedules → cancelled, and corresponding audit/events.
- Lock order: revocation already owns authority position 1; then dependency/candidate 3–4 → review 5 → schedules 6.
- Idempotent: already-invalidated reviews skipped.
- Reason: `reviewer_authority_changed`.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1842-1854,1988`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:136-138`.

### 5.2 Proposed `platform_private.cms_invalidate_editorial_review(p_request jsonb) RETURNS jsonb`

Core helper missing from BE03b’s name inventory. Proposed result:

```json
{
  "reviewId": "uuid",
  "invalidated": true,
  "cancelledSchedules": 0,
  "revokedPreviewTokens": 0
}
```

- Accepts only server-built `{reviewId,reasonCode,correlationId}`.
- Closed reasons: `revision_superseded`, `dependency_changed`, `reviewer_authority_changed`, `entry_unavailable`.
- Writes review CAS/version, schedule cancellations, entry-unavailable preview revocations, audit and review-change event atomically.
- Private, definer-owned, no direct grant.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1842-1854`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:136-138`.

### 5.3 Proposed `platform_private.cms_editorial_review_invalidation_trigger() RETURNS trigger`

- Used only where row-local producers can safely identify invalidation: entry lifecycle leaving active and revision supersession.
- Capability revocation must call `cms_invalidate_reviews_for_person`; it must not rely solely on an RLS-scoped trigger.
- Locks candidate/dependencies before reviews, never reviews before schema/dependency rows.
- Existing `cms_activation_review_invalidation_trigger()` is schema-activation-specific and must not be reused for editorial-review rows. (`supabase/migrations/20260902080000_content_schema_registry_authority.sql:1926-2036`; `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1842-1854`)

### 5.4 `platform_private.cms_revoke_preview_tokens(p_request jsonb) RETURNS jsonb`

Proposed request `{personId?:uuid,entryId?:uuid,reasonCode,correlationId}` and result `{revokedTokens:integer}`.

- Called only by authority-loss, lifecycle, and takedown producers.
- Writes unexpired token rows under CAS; no browser grant.
- Idempotent: already revoked/expired rows skipped.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1842-1844,1859-1863,1988`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:142-143`.

### 5.5 `platform_private.cms_recheck_review_dependencies(p_kind text, p_ref_id uuid, p_batch integer) RETURNS jsonb`

Proposed result `{checkedReviews,invalidatedReviews,nextCursor}`.

- Batch 1–500; dependency-index keyset continuation.
- Rebuilds the manifest and calls the core invalidator on inequality/non-current identity.
- Idempotent: invalidated reviews skipped.
- No public/API execute; BE00 dependency-job principal only.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1849-1854,1988`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:136-138`.

### 5.6 Proposed `platform_private.cms_evaluate_preflight_registry(p_request jsonb) RETURNS jsonb`

Request is server-built:

```json
{
  "revisionId": "uuid",
  "phase": "submit|schedule|publish|execute|workflow_read",
  "actorPersonId": "uuid|null",
  "actingPartyId": "uuid|null",
  "effectiveAt": "timestamptz",
  "evidence": "PreflightEvidence|null"
}
```

Return is `PreflightReport`:

```json
{
  "evaluatedAt": "timestamptz",
  "passed": true,
  "results": [
    {
      "category": "contract",
      "outcome": "passed|failed|unavailable",
      "providerKey": "text",
      "providerVersion": 1,
      "reasonCode": "text|null",
      "blockingCount": 0
    }
  ]
}
```

- Exactly 17 results in registry order; no short circuit.
- Private, `SECURITY DEFINER`, no direct API grant.
- Reuses `cms_revision_references`, manifest/current-evidence helpers, and verified Worker accessibility evidence.
- Reads only; caller command decides whether to commit a refusal.
- Failed category → 422 `preflight_failed`; otherwise any unavailable category → 503 preflight dependency unavailable. Execute maps failure to blocked and unavailable to retryable.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1235-1299,1767-1802`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:116-127`.

### 5.7 Proposed `platform_private.cms_append_publication_lineage(p_request jsonb) RETURNS jsonb`

Server-built request includes `entryId`, `revisionId`, `locale`, `audience`, `action`, optional `scheduleId`, `publisherPersonId`, evidence hashes, version set, settings snapshot, and correlation.

- Return: `PublicationResource`.
- Private definer helper; callable only from publish/execute/takedown functions.
- Reads/writes: current lineage head and append-only `cms_publication_versions`.
- Lock: position 7 lineage advisory lock, then current head; caller must already hold all earlier locks.
- Refusals: `publication_conflict`, `publication_not_active`.
- No independent idempotency record; it participates in the caller’s transaction.
- Sources: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1855-1858,1975`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:139-141`.

### 5.8 Existing `platform_private.cms_emit_event(...) RETURNS uuid`

Exact signature:

```sql
platform_private.cms_emit_event(
  p_action text,
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_aggregate_version bigint,
  p_payload jsonb,
  p_correlation_id uuid
) RETURNS uuid
```

It delegates to `cfg_emit_effects`, which inserts audit and outbox effects atomically. Slice 11 must reuse it rather than create another outbox helper. (`supabase/migrations/20260902080000_content_schema_registry_authority.sql:2417-2443`; `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1855-1858,1986-1994`)

### 5.9 Other required named private helpers

| Proposed signature | Purpose |
|---|---|
| `cms_revision_effective_state(p_revision_id uuid) RETURNS text` | Derived published → scheduled → approved → rejected → submitted → draft state |
| `cms_revision_effective_states(p_revision_ids uuid[]) RETURNS TABLE(revision_id uuid,state text)` | Bounded set form |
| `cms_build_dependency_manifest(p_revision_id uuid) RETURNS jsonb` | Sole canonical manifest/version-set builder |
| `cms_publication_settings_keys() RETURNS text[]` | Code-owned settings registry |
| `cms_revision_references(p_revision_id uuid,p_kind text) RETURNS bigint` | Reference-gate count |
| `cms_tzdb_version() RETURNS text` | SQL mirror of the pinned Worker tzdb tag |
| `cms_acting_context_version(p_person_id uuid,p_acting_party_id uuid) RETURNS text` | Preview capability-snapshot hash |

All are private, pinned-search-path functions with no browser grant. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1732-1773,1803-1815,1859-1863`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:108-120,128-131,142-143`)

## 6. Data-model delta from the 20260927 foundation

The foundation explicitly creates only six support tables and intentionally omits RPC implementations. (`supabase/migrations/20260927090000_cms_editorial_support_authority.sql:1-31`)

| Table | Required Slice 11 changes absent from foundation | Contract evidence | Foundation evidence |
|---|---|---|---|
| `cms_entry_revisions` | Narrow physical `state` to `draft`; add effective-state helper/set form | BE03b:1732-1746; criteria:108-109 | Current six-state CHECK is in `supabase/migrations/20260926090000_cms_authoring_contract_foundation.sql:86-90` |
| `cms_editorial_reviews` | `entry_id`, `decided_at`, closed invalidation reason CHECK, state/reason and terminal/decided coupling, indexes for queue/entry/submitter | BE03b:1967 | Foundation:62-135 |
| `cms_editorial_decisions` | `assignment_id`, `assignment_version`, `step_up_at NOT NULL`, separation-of-duties insert trigger and required indexes | BE03b:1968 | Foundation:137-180 |
| `cms_publication_schedules` | `review_id`, audience slug, attempt/next-attempt, lease, reason code/state coupling, audience-inclusive uniqueness, revision/state/due/review indexes | BE03b:1969 | Foundation:182-239 |
| `cms_publication_versions` | Stable `publication_id`, `supersedes_id`, `action`, `schedule_id`, publisher person, active/revoked physical state, evidence consistency, lineage trigger, lineage/version uniqueness | BE03b:1975 | Foundation:240-308 |
| `cms_preview_tokens` | Canonical `person_id`, active/revoked state, exact 15-minute expiry CHECK, revocation coupling, audience slug ≤48, person and entry/state indexes | BE03b:1976-1977 | Foundation:309-356 |
| `cms_editorial_review_assignments` | Entire table: reviewer/grantor, fixed capability/actions, active/revoked CAS, ≤7-day bound, uniques/indexes, forced RLS | BE03b:1981; criteria:144 | Absent; foundation list:8-14 |
| `cms_editorial_review_dependencies` | Entire immutable `(review_id,kind,ref_id)` table and dependency lookup index | BE03b:1982; criteria:136-138 | Absent |
| `cms_publication_settings_snapshots` | Entire immutable owner/ordinal registry snapshot table and uniqueness | BE03b:1983; criteria:114-115 | Absent |
| `cms_preflight_registry` | Entire immutable versioned 17-category provider registry | BE03b:1984; criteria:116-122 | Absent |
| Review invalidation machinery | Core invalidator, row-local trigger, authority-loss helper integration, schedule cancellation, token revocation | BE03b:1842-1854 | Foundation has only generic write/immutable guards:358-388 |
| Manifest/reference/time helpers | Manifest builder, settings registry, reference counter, tzdb mirror, acting-context version | BE03b:1747-1815,1859-1863 | No definitions in the foundation or Slice 10 `2026100501*.sql` migrations |

`cms_restore_chain_manifests` already exists and should not be recreated. (`supabase/migrations/20261005010500_cms_restore_chain_manifest.sql:29-83`; `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1980`)

Audit, idempotency, outbox, and Shard 04 projection-consumer state remain producer-owned; Slice 11 must not create local copies. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:27,111-142,1855-1858,1986-1994`)

## 7. D19 ordered preflight registry

Submit and workflow-read evaluate categories 1–16. Schedule acceptance, immediate publish, and execution evaluate all 17. Preview mint evaluates none. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1793-1797`)

| # | Category | Provider key / kind | Slice 11 status | Registered refusal reasons |
|---:|---|---|---|---|
| 1 | `contract` | `preflight.contract` / database | Implement now | `value_invalid`, `validators_changed` |
| 2 | `schema` | `preflight.schema` / database | Implement now | `schema_not_active`, `schema_evidence_changed` |
| 3 | `template` | `preflight.template` / database | Implement now | `template_not_active`, `template_incompatible`, `template_changed` |
| 4 | `block` | `preflight.block` / database | Implement now | `block_withdrawn`, `block_digest_changed` |
| 5 | `pattern` | `preflight.reference_gate` / reference gate | Unbuilt; Slice 12 | `provider_unbuilt_reference` |
| 6 | `taxonomy` | `preflight.reference_gate` / reference gate | Unbuilt; Slice 12 | `provider_unbuilt_reference` |
| 7 | `settings` | `preflight.settings` / database | Implement now | `settings_changed` |
| 8 | `relation` | `preflight.relation` / database | Implement now | `relation_target_unavailable`, `relation_version_changed` |
| 9 | `privacy` | `preflight.reference_gate` / reference gate | Unbuilt; Slice 16 | `provider_unbuilt_reference` |
| 10 | `security` | `preflight.security` / database | Implement now | `unsafe_content` |
| 11 | `accessibility` | `cms.a11y.structural` v1 / Worker | Implement now | `blocking_finding`, `checker_failed` |
| 12 | `media` | `preflight.reference_gate` / reference gate | Unbuilt; Slice 14 | `provider_unbuilt_reference` |
| 13 | `route` | `preflight.reference_gate` / reference gate | Unbuilt; Slice 13 | `provider_unbuilt_reference` |
| 14 | `locale` | `preflight.reference_gate` / reference gate | Unbuilt; Slice 12, DEC-138 | `provider_unbuilt_reference` |
| 15 | `migration` | `preflight.migration` / database | Implement now | `migration_in_progress` |
| 16 | `domain_binding` | `preflight.domain_binding` / database | Implement now | `binding_not_allowlisted` |
| 17 | `revocation` | `preflight.revocation` / database | Implement now | `entry_unavailable`, `reviewer_authority_changed`, `publisher_authority_ended` |

Rows and reasons: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1773-1791`. Locale ownership: `.memory/wiki/decisions.md:2018-2030,2200-2212`. Media ownership: `.memory/wiki/decisions.md:1691-1703`.

A reference gate passes only when `cms_revision_references(revision,kind)=0`; otherwise it fails closed with `provider_unbuilt_reference`. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1767-1773`)

Accessibility evidence mapping required by DEC-150:

| Worker run outcome | Preflight result | Reason | Command behavior |
|---|---|---|---|
| `healthy` | `passed` | `null` | Continue |
| `blocked` | `failed` | `blocking_finding` | 422 `preflight_failed`; execution becomes blocked |
| `failed` | `unavailable` | `checker_failed` | 503 retryable; execution becomes failed-retryable |
| `stale` | Never accepted as evidence | — | Worker must run the current checker again |

Evidence additionally requires the current provider key/version, age ≤60 seconds, and a matching JCS binding hash. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1799-1802`; `.memory/wiki/specs/be/05c-portability-quality-lifecycle.md:1048-1079`; `.memory/wiki/decisions.md:2172-2184`)

## 8. Parallel migration lanes

### Shared prerequisite: `20261005017500..20261005017599`

Must merge before parallel lanes:

1. Alter the five foundation tables and narrow revision physical state.
2. Create assignment, dependency, settings-snapshot, and preflight-registry tables.
3. Seed the 17 registry rows.
4. Add effective-state, manifest, settings, reference, tzdb, acting-context, preflight-evaluation, and core invalidation helpers.
5. Add common ownership, RLS, write guards, revokes, and definer grants.
6. Add review/decision/lineage constraints and triggers.
7. Record the concrete IANA tag/SHA before schedule code can be accepted.

### Lane A — review authority: `20261005017600..20261005017699`

Owns only:

- `cms_submit_review`
- `cms_record_review_decision`
- `cms_assign_editorial_reviewer`
- `cms_invalidate_reviews_for_person`
- invalidation trigger/core integration
- dependency recheck job

Tables primarily written: reviews, decisions, assignments, dependencies.

### Lane B — schedule and publication: `20261005017700..20261005017849`

Owns only:

- `cms_schedule_publication`
- `cms_publish_revision`
- `cms_claim_due_publication_schedules`
- `cms_execute_publication_schedule`
- lineage append
- publication event emission calls

Tables primarily written: schedules and publication versions.

### Lane C — preview and reads: `20261005017850..20261005017999`

Owns only:

- `cms_mint_preview`
- `platform_api.cms_verify_preview_token`
- `cms_revoke_preview_tokens`
- `cms_get_entry_workflow`
- `cms_get_editorial_review`
- `cms_list_editorial_reviews`

Tables primarily written: preview tokens; all remaining RPCs are reads.

Each lane adds only its own API wrappers/grants. Shared files and shared helper signatures are frozen before dispatch, preventing three lanes from redefining common functions.

## 9. Open contradictions and specification gaps

1. **CONTRADICTION — decision lock order.** The global order forbids acquiring dependency/schema positions 3–4 after review position 5, and says invalidation/decision use candidate-before-review order. The decision algorithm instead says it holds the review row lock before rebuilding dependencies. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1698-1720,1838-1840`)

2. **CONTRADICTION — schedule execution lock order.** Execution is described as running “under the schedule and lineage locks” before rereading approval and running all preflights; those checks may acquire authority/dependency/review locks that precede schedule/lineage. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1698-1720,1865-1874`)

3. **CONTRADICTION — missing `cancelled` execution result.** Execution cancels an unavailable entry and the error section refers to blocked/cancelled results, but `ScheduleExecutionResult.outcome` omits `cancelled`. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1495-1513,1865-1876,1905-1906`)

4. **CONTRADICTION — preview route grammar.** BE03b prose/SQL require one leading slash and ≤2048 characters; its Zod uses `max(4096)`. BE04c uses a ≤512 grammar without a leading slash. Exact verifier equality makes these representations incompatible without an unstated normalization boundary. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:273-274,550-560,608-617,967-972,1976`; `.memory/wiki/specs/be/04c-public-delivery-cache.md:128,181-184`)

5. **CONTRADICTION — preview persistence model.** BE03b requires separate auth `user_id`, canonical `person_id`, entry/revision IDs, capability-snapshot hash, nonce, state, and exact version set. BE04c’s `preview_session` uses `user_id` as the canonical person and omits several of those columns. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1947,1976-1977`; `.memory/wiki/specs/be/04c-public-delivery-cache.md:345-349`)

6. **CONTRADICTION — accessibility evidence acceptance.** BE03b says the RPC “accepts” evidence only when the outcome is `healthy`, then says blocked/failed evidence is verified and mapped. DEC-150 and AC101 require those non-healthy mappings. Input validation versus accepted refusal evidence is unresolved. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1799-1802`; `.memory/wiki/decisions.md:2172-2184`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:126-127`)

7. **CONTRADICTION — physical revision state.** E2 requires `cms_entry_revisions.state='draft'`; the BE database table still declares six physical states. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1732-1746,1943,1967`)

8. **CONTRADICTION — decision reason length.** `SafeText` permits up to 2,000 Unicode code points, while the SQL table permits at most 2,000 bytes. Valid non-ASCII API input can fail persistence. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:315-323,517-522,1968`)

9. **CONTRADICTION — assignment reason normalization.** The field matrix requires NFC; the Zod create/revoke schemas enforce only string length. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:301,593-608`)

10. **CONTRADICTION — schedule validator claims.** The `localDateTime` comment calls the regex range-checked, but it accepts out-of-range numeric components. The timezone comment rejects `.`/`..` segments while the regex admits dots. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:523-537,1809-1824`)

11. **CONTRADICTION — projection-state vocabulary.** BE03b exposes `pending|converged|degraded`; BE04c consumer rows use `building|ready|blocked|failed_retryable|active|superseded|revoked`, with no aggregation mapping. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:978-991,1855-1858`; `.memory/wiki/specs/be/04c-public-delivery-cache.md:346`)

12. **CONTRADICTION — tracker completeness.** BE03b says no ambiguity remains, but DEC-155 leaves AC035/038/041 wording and E6/E11 scope pending owner ratification. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:2213-2218`; `.memory/wiki/decisions.md:2242-2254`; `.memory/pipeline/progress/slices/phase-02-slice-11.md:60,63,66`)

13. **CONTRADICTION — tzdb pin.** AC103 requires a recorded IANA release tag, SHA, and generation command. DEC-153 says they remain unrecorded, and BE03b supplies only an example such as `2025b`. (`.memory/pipeline/progress/slices/phase-02-slice-11.md:128`; `.memory/wiki/decisions.md:2214-2226`; `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1811-1815`)

14. **SPEC GAP: BE § SQL function DDL —** browser RPC SQL argument/return signatures and per-function grant roles are absent even though the ambiguity gate says all implementation detail is complete — implementation cannot claim exact spec-derived DDL — ratify this plan’s single-JSON convention and concrete grants. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:172-180,1986-1994,2190-2218`)

15. **SPEC GAP: BE § Internal service principals —** Shard 04 delivery and scheduled worker are semantic principals, not PostgreSQL role names — generic `service_role` would violate the exclusive grant contract — name/provision the two DB roles before the corresponding grants land. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:172-180,1988-1994`)

16. **SPEC GAP: BE § Shared helper names —** no normative name/signature exists for preflight evaluation, core editorial-review invalidation, settings-snapshot creation, or publication-lineage append — independently implemented lanes could create incompatible helpers — ratify the proposed private signatures before parallel dispatch. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1747-1809,1842-1858,1981-1988`)

17. **SPEC GAP: BE § Assignment CAS —** assignment create/revoke requires exact review `If-Match` but explicitly does not advance review version — concurrent assignment operations can validate the same review operand unless assignment-row uniqueness/version or review locking is the declared serialization authority — document that authority explicitly. (`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:170,193,1824-1838,1943`)

