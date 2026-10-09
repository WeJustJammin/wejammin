# Slice 11 shared SQL helper API (lane S11-3s) - FROZEN signatures for lanes 3a / 3b / 3c

LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin. Migrations 20261005017500..20261005017599 (mine). Status per helper is in
`ORCH/s11/lane-s11-3s-report.md`; THIS file only freezes names, argument lists, return shapes, volatility and refusal tokens.
Do NOT redefine any of these in a 3a/3b/3c migration; call them. A signature change needs a NOTES.md entry from me first.

## Conventions (all helpers)
- Schema `platform_private`. SECURITY DEFINER, `search_path = ''`, owner `wejammin_cms_definer`, `revoke all ... from public, anon, authenticated, service_role`.
  Callers are your own definer-owned RPC bodies (same owner, so no grant is needed) and run under the CMS RPC context (`app.cms_rpc = 'true'`), exactly like every other `platform_private` helper (the readers do not set it; `cms_settings_snapshot` and the invalidation/lineage writers do). No browser wrapper exists for any of them.
- JSON shapes are the camelCase contract shapes of `packages/contracts/src/cms-editorial` (DependencyManifest, VersionSet, PreflightReport, ...).
  bigint versions inside JSON are decimal STRINGS (`"1"`), exactly like `CmsVersionSchema`. Hashes are lowercase 64-hex. Instants are
  `platform_private.auth_iso_time(ts)` strings.
- Refusals are `raise exception '<token>' using errcode = 'P0001'` (whole message = token). Tokens used here: `INVALID_REQUEST` (malformed
  helper input), `NOT_FOUND`, `DEPENDENCY_UNAVAILABLE`, `dependency_manifest_too_large`, `preflight_evidence_stale`, `dependency_changed`,
  `publication_conflict`, `publication_not_active`, `CONFLICT`, `VALIDATION_FAILED`. A helper never echoes caller values.
- Locks: helpers take NO lock on a position EARLIER than the one they own and never wait on a row lock while holding the settings advisory
  lock (leaf). Callers hold positions 0-4 of the BE03b global order before calling a position-5+ helper (DEC-157).
  `cms_invalidate_editorial_review` = position 5 (review row FOR UPDATE) then 6 (schedule rows, preview-token rows).
  `cms_append_publication_lineage` = position 7 (lineage advisory lock, then head row). Everything else is a plain read.

## 1. Effective revision state (E2) - STABLE
- `cms_revision_effective_state(p_revision_id uuid) returns text` - one of `published|scheduled|approved|rejected|submitted|draft`, first match
  wins in that order (E2 table). `NULL` when the revision does not exist.
- `cms_revision_effective_states(p_revision_ids uuid[]) returns table(revision_id uuid, state text)` - set form, one row per distinct existing
  id, ordered by `revision_id`; more than 1000 ids -> `INVALID_REQUEST`; null array -> empty set.

## 2. Dependency manifest, hash, version set (E1/E4)
- `cms_build_dependency_manifest(p_revision_id uuid) returns jsonb` - VOLATILE (records the E7 settings snapshot if absent). The only builder of a
  `DependencyManifest` (all nine groups, every list sorted ascending by lowercase UUID string, each identity once). Refuses: absent revision
  `NOT_FOUND`; missing active artifact / policy evidence `DEPENDENCY_UNAVAILABLE`; > 256 entries or > 32768 UTF-8 bytes (of the JCS) ->
  `dependency_manifest_too_large`. `dependencyHash = platform_private.cms_jcs_sha256(manifest)` (no separate alias).
- `cms_version_set_of(p_manifest jsonb, p_taxonomy_version_ids jsonb) returns jsonb` - IMMUTABLE pure projection = TS `versionSetOf`.
- `cms_version_set_matches_manifest(p_version_set jsonb, p_manifest jsonb) returns boolean` - IMMUTABLE = TS `versionSetMatchesManifest`.
- `cms_revision_version_set(p_revision_id uuid, p_manifest jsonb) returns jsonb` - STABLE: `cms_version_set_of(p_manifest, revision.taxonomy_version_ids)`.
- `cms_dependency_manifest_within_bounds(p_manifest jsonb) returns boolean` - STABLE: <= 256 entries in total (list elements + present singletons), per-group contract maxima, <= 32768 UTF-8 bytes of JCS.
- `cms_review_dependency_refs(p_revision_id uuid, p_manifest jsonb) returns table(kind text, ref_id uuid)` - STABLE: the ReviewDependency rows `cms_submit_review` writes (kinds
  schema, template, block, pattern, term, taxonomy_version (the revision's ids), locale_source, relation_target, settings (= the snapshot ROW id)); one row per identity. Malformed manifest `INVALID_REQUEST`.
- `cms_manifest_identities_current(p_manifest jsonb) returns boolean` - VOLATILE (records the settings snapshot): every frozen identity is current (schema = type's active version
  with equal artifact hash; template/pattern `active` with equal hash; taxonomy versions `active`; blocks `supported|deprecated` never `withdrawn`;
  settings snapshot equal to the owner's current one). Pure currency, no recompute equality.
- `cms_frozen_dependencies_status(p_revision_id uuid, p_frozen_manifest jsonb) returns text` - VOLATILE: `'current'` only when the rebuilt manifest
  equals the frozen one bit-for-bit AND `cms_manifest_identities_current` AND every taxonomy version the revision records is `active`; otherwise `'stale'` (also when the manifest cannot be rebuilt). The caller maps `'stale'` to 409
  `version_set_stale` and invalidates the review `dependency_changed`.

## 3. Reference counter (D19)
- `cms_revision_references(p_revision_id uuid, p_kind text) returns bigint` - STABLE. `p_kind` in `pattern|taxonomy|privacy|media|route|locale`
  (anything else `INVALID_REQUEST`). Counts references of that kind the revision holds; `0` for an absent revision.

## 4. Settings snapshot (E7) and time pin (E8)
- `cms_publication_settings_keys() returns text[]` - IMMUTABLE, registry version 1 = `'{}'`.
- `cms_publication_settings_registry_version() returns bigint` - IMMUTABLE, `1`.
- `cms_settings_snapshot(p_owner_id uuid) returns jsonb` - VOLATILE. `{ "version": "<ordinal>", "hash": "<64hex>" }`; inserts under
  `ON CONFLICT (owner_id, snapshot_hash) DO NOTHING` + the owner advisory lock (leaf lock) and reads the ordinal back. Empty registry hashes to
  `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.
- `cms_tzdb_version() returns text` - IMMUTABLE, the pinned IANA tag recorded by lane S11-1 (parity-tested against `CMS_TZDB_VERSION`).

## 5. Acting-context version (preview binding)
- `cms_acting_context_version(p_person_id uuid, p_acting_party_id uuid) returns text` - STABLE. Lowercase SHA-256 of the JCS
  `{ actingPartyId, capabilities, personId }`; `capabilities` = the person's active `cms.*` capability keys in that acting party (confirmed,
  in-window tenure + active in-window grant), sorted bytewise ascending. `p_acting_party_id` null -> `actingPartyId: null`, `capabilities: []`.

## 4b. Settings evaluation
- `cms_publication_settings_effective_values(p_owner_id uuid, p_at timestamptz) returns jsonb` - the snapshot array (`[]` for registry v1; per key via `cfg_resolve_effective_value`, consumer `cms.publication`; unservable key `DEPENDENCY_UNAVAILABLE`).

## 6. Editorial-review approvers (live recount, shared by decision + preflight)
- `cms_editorial_review_qualifying_decisions(p_review_id uuid) returns table(decision_id uuid, reviewer_person_id uuid, capability text, assignment_id uuid)`
  - STABLE. The `approve` decisions that COUNT now: the decider still holds the standing capability the decision satisfied in the review's owner
  party (`cms_person_holds_capability(owner, person, decision.capability)`), and the decision's assignment is not `revoked`. Assignment expiry does
  not unwind a decision. Ordered by `decided_at, id`.
- `cms_editorial_review_distinct_approvals(p_review_id uuid) returns integer` - STABLE. `count(distinct reviewer_person_id)` of the above.

## 7. Preflight registry and evaluation (D19)
- `cms_preflight_registry_current() returns table(category text, registry_version bigint, owner_slice text, provider_key text, provider_version bigint, provider_kind text, reference_kind text)`
  - STABLE. The current (greatest `registry_version`) row of each of the 17 categories in registry order.
- `cms_accessibility_binding_hash(p_revision_id uuid, p_dependency_hash text) returns text` - STABLE. SHA-256 of the JCS
  `{ checkerKey, checkerVersion, revisionId, revisionContentHash, dependencyHash }` (checker key/version from the registry row, `revisionContentHash`
  = the revision `payload_hash`). The Worker computes the same value; mismatch rules below.
- `cms_evaluate_preflight(p_request jsonb) returns jsonb` - VOLATILE (may record the settings snapshot) but writes nothing else. Request (exact keys,
  server-built, never browser): `{ phase: 'submit'|'schedule'|'publish'|'execute', revisionId: uuid, actingPartyId: uuid, actorPersonId: uuid,
  effectiveAt: instant, reviewId?: uuid|null, frozenManifest?: DependencyManifest|null, evidence?: PreflightEvidence|null }`.
  `actorPersonId` is the person whose authority `revocation` checks (submit: submitter; schedule/publish: publisher; execute: the schedule creator);
  `effectiveAt` is the instant the action takes effect (schedule: `resolvedUtc`; publish: now; execute: the fire instant; submit: now);
  `reviewId` is the approved review for schedule/publish/execute (counted approvers are rechecked), null on submit; `frozenManifest` is what
  `schema|template|block|settings|relation|domain_binding...` compare against (null = compare against the manifest rebuilt now).
  Returns exactly the TS `PreflightReport` `{ evaluatedAt, passed, results[17] }` (registry order, no short circuit; submit/workflow-read evaluate
  the same 17 with the category-1..16 + submit-scope `revocation`; phases differ only in the `revocation` scope).
  Evidence verification (accessibility): provider key/version != current registry row, or `evaluatedAt` outside +-60 s -> `preflight_evidence_stale`
  (409); `bindingHash` != `cms_accessibility_binding_hash` -> `dependency_changed` (409) in submit/schedule/publish, `preflight_evidence_stale` in
  execute (DEC-158c); evidence null -> the `accessibility` result is `unavailable/checker_failed`. `healthy -> passed`, `blocked -> failed
  blocking_finding`, `failed -> unavailable checker_failed` (DEC-150).
  Caller aggregation (3a/3b): any `failed` -> 422 `preflight_failed` with `details.preflight`; else any `unavailable` -> 503; execute maps failed ->
  blocked(`preflight_failed`), unavailable -> failed_retryable.

## 8. Review invalidation, token revocation, preview scope (position 5/6) - IMPLEMENTED (017580)
- `cms_invalidate_editorial_review(p_request jsonb) returns jsonb` - VOLATILE. Request (exact keys, server-built): `{ reviewId: uuid, reasonCode: 'revision_superseded'|
  'dependency_changed'|'reviewer_authority_changed'|'entry_unavailable', correlationId: uuid, actorId?: uuid|null }` (null/absent actor = system). Result
  `{ reviewId, invalidated: boolean, cancelledSchedules: integer, revokedPreviewTokens: integer }`. Locks the review row FOR UPDATE; a review that is not `open|approved`
  is an idempotent no-op (`invalidated:false`, no event). Otherwise, in one transaction: review `-> invalidated` (`invalidated_reason`, `decided_at` cleared,
  `version + 1`), the review's `pending|failed_retryable` schedules -> `cancelled` (`reason_code` `approval_invalidated`, or `entry_unavailable` for that reason; version + 1,
  `next_attempt_at` cleared; an `executing` schedule is left to finish), for `entry_unavailable` the entry's unexpired active preview tokens -> `revoked`; audit
  (`cms.entry.review.invalidate`, `CMS_REVIEW_INVALIDATED`) + exactly one `cms.entry.review-changed.v1` `{ reviewId, revisionId }` at the new review version
  (aggregate `cms_editorial_review`). Absent review `NOT_FOUND`; malformed request `INVALID_REQUEST`.
- `cms_invalidate_reviews_for_person(p_person_id uuid, p_capability text) returns integer` - VOLATILE. Invalidates (`reviewer_authority_changed`) every live review in which the
  person has a recorded approve (for the slot capability when `p_capability` is given, any when null) that no longer COUNTS per `cms_editorial_review_qualifying_decisions`;
  returns the number transitioned; safe to repeat. Null person `INVALID_REQUEST`. CMS-03A-17 / any revoker may call it directly.
- `cms_revoke_active_preview_tokens(p_entry_id uuid, p_person_id uuid) returns integer` - VOLATILE: CAS-revokes (state `revoked`, `revoked_at`, `version + 1`) the unexpired
  `active` tokens of the entry and/or the minting person (at least one required, else `INVALID_REQUEST`); returns the count. 3c's `cms_revoke_preview_tokens` should wrap it.
- `cms_preview_scope_holds(p_person_id uuid, p_acting_party_id uuid, p_entry_id uuid, p_revision_id uuid) returns boolean` - STABLE. BE03b preview scope: entry assignee (active
  cms.author/cms.editor assignment + standing grant) OR active reviewer assignee of a review of the revision (confirmed tenure) OR owner-party `cms.publisher`; false for any null
  argument or a revision that is not of the entry. Use it in CMS-03B-08 (mint) AND in the CMS-03B-19 verifier ("the minting person's preview scope still holds").
- `cms_revoke_tokens_without_scope(p_acting_party_id uuid, p_person_id uuid) returns integer` - VOLATILE: revokes the person's active tokens whose scope no longer holds.
- `cms_trigger_correlation() returns uuid` - request correlation (`app.correlation_id`) or a fresh uuid, for trigger-driven effects.
- Wired by me (NEW AFTER ROW triggers only, no old migration edited): `cms_entry_revisions_review_invalidation` (INSERT: older live reviews of the same entry AND locale ->
  `revision_superseded`; the revision chain is per locale), `cms_content_entries_review_invalidation` (lifecycle leaves `active` -> live reviews `entry_unavailable` + the entry's
  tokens revoked, also with no live review), `cms_organization_actor_grant_review_authority` + `cms_membership_tenure_review_authority` (UPDATE|DELETE ->
  `cms_invalidate_reviews_for_person(person, null)` + `cms_revoke_tokens_without_scope`), `cms_entry_assignments_preview_scope` + `cms_editorial_review_assignments_preview_scope`
  (tokens without scope). 3a/3b/3c must NOT re-implement these; they DO call the core directly for `dependency_changed` (decision, schedule, publish, executor, recheck job).
- NOT wired (spec contradiction, NOTES): assignment revocation on an open review only recounts (CMS-03B-18), no review version bump.

## 9. Publication lineage (E3) - IMPLEMENTED (017590)
- `cms_publication_lineage_lock(p_entry_id uuid, p_locale text, p_audience text) returns void` - VOLATILE, position 7 advisory xact lock; idempotent per tx; a leaf lock.
- `cms_publication_row_state(p_row_id uuid) returns text` - STABLE derived browser state `active|superseded|revoked` (NULL when absent).
- `cms_append_publication_lineage(p_request jsonb) returns jsonb` - VOLATILE. Request (exact keys, server-built):
  publish `{ entryId, revisionId, locale, audience, action:'publish', publisherPersonId, versionSet: VersionSet, dependencyHash, activationEvidenceHash, correlationId, scheduleId?, actorId? }`;
  unpublish|expire|archive `{ entryId, locale, audience, action, publisherPersonId, correlationId, scheduleId?, actorId? }` (a tombstone NEVER accepts evidence: it copies the active
  head's revision + evidence). Takes the lineage lock, reads the head, appends the next row, audit (`cms.publication.<action>`, `CMS_PUBLICATION_APPENDED`) + exactly one
  `cms.publication.changed.v1` `{ entryId, publicationVersionId }` (producer `cms.editorial`, aggregate `cms_publication` keyed by the lineage id at the lineage sequence).
  Returns the PublicationResource of the appended row: `{ id (lineage publication_id), version (lineage sequence, decimal string), createdAt, updatedAt, state ('active' for publish,
  'revoked' for a tombstone), action, publicationVersionId (the row id), entryId, revisionId, locale, audience, publicationHash, projectionState:'pending', eventType }`.
  Refusals (P0001): `INVALID_REQUEST`, `NOT_FOUND` (entry/revision), `VALIDATION_FAILED` (revision not of the entry, locale != revision locale, version set not the revision's),
  `publication_not_active` (tombstone without an `active` head), `publication_conflict` (unique-key collision of a race), and the data-model guard's `separation_of_duties`
  (publisher = revision author), `entry_unavailable`, `CONFLICT` (no approved review of the revision at that dependency hash). No idempotency record: the caller owns it.
  The `cms.publication.` event prefix is registered here.

## 10. Time pin (E8) - IMPLEMENTED (017595)
- `cms_tzdb_version() returns text` - IMMUTABLE, `'2026e'` (DEC-153 / `dec-153-pin`); a literal in the function body for the parity test.

## NEEDS FROM OTHER LANES
(see ORCH/lanes/NOTES.md "NEEDS FROM S11-2" lines; this file never blocks on them)
