# Lane S11-3s report: Slice 11 shared SQL helpers (migrations 20261005017500..017599, pgTAP phase_02_slice_11_helpers_*)

LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin (claude/phase2-slice11). Nothing staged/committed. DB: ORCH/bin/lane-db.sh (main stack, shared lock).
Frozen API: ORCH/s11/helpers-api.md (written first, before any body).

## Plan (order: table-independent first)
H0 helpers-api.md freeze (DONE)
H1 cms_acting_context_version (item 5)
H2 cms_revision_references (item 3)
H3 cms_version_set_of / matches / hash parity fixture (item 2, pure part)
H4 cms_editorial_review_qualifying_decisions / distinct_approvals (shared by item 6 revocation + lane 3a)
H5 cms_revision_effective_state(s) (item 1)   [needs publication_versions.action from S11-2]
H6 settings keys + snapshot (item 4)           [needs cms_publication_settings_snapshots from S11-2]
H7 cms_build_dependency_manifest + status + currency (item 2)
H8 preflight registry view + evaluate (item 6) [needs cms_preflight_registry from S11-2]
H9 review invalidation core + triggers + for_person (item 7)
H10 publication lineage append + lock + state (item 8)
H11 cms_tzdb_version (item 4, last; needs S11-1 pin)
H12 full lane-db.sh run, db lint, fixture cascades

## Runner note
Main stack (supabase_db_wejammin) is NOT running on this host (docker ps shows only supabase_db_wejammin_ev + content-postgres; `lane-db.sh` fails
"supabase start is not running" after a 9 min lock wait). All my runs use ORCH/bin/lane-db-ev.sh (second stack, shared lock with S11-2, ~45 s).
Tests: supabase/tests/phase_02_slice_11_helpers_*.sql + fragments in supabase/tests/phase_02_slice_11_helpers/ (000-helpers, 001-world = real h11doc type).

## Checkpoints
(append below after each finished item)

### H1 cms_acting_context_version - DONE (item 5)
Files: supabase/migrations/20261005017500_cms_acting_context_version.sql; supabase/tests/phase_02_slice_11_helpers_acting_context.sql (27 assertions), fragment 000-helpers.sqlinc.
RED: 23/27 failed (function absent); GREEN 27/27 first run. Signature frozen: cms_acting_context_version(p_person_id uuid, p_acting_party_id uuid) returns text, STABLE definer.
Covers: literal-JCS oracle for creator/editor/outsider/stranger/null party, deactivated/lapsed/not-started grants, non-cms namespace, ended tenure, bytewise sort, null person INVALID_REQUEST, no API-role execute.

### H2 cms_revision_references - DONE (item 3)
Files: supabase/migrations/20261005017510_cms_revision_references.sql; supabase/tests/phase_02_slice_11_helpers_references.sql (52 assertions), fragment 001-world.sqlinc (real active h11doc type with the real editorial policy, builders).
RED: 45/52 failed (function absent); GREEN 52/52 first run. Signature frozen: cms_revision_references(p_revision_id uuid, p_kind text) returns bigint STABLE.
Semantics fixed (documented in the migration header): pattern=live instances naming a pattern; taxonomy=active assignments+recorded ids; privacy=distinct held/deletion_pending among entry+content relation targets;
media=non-empty media values + instances of blocks with a cms.media* data source; route=internal links at any depth; locale=variants + active no_fallback fields.
Cascade to flag: SEC-2 pin phase_02_slice_09_sec2_all_schema_definer_rls.sql (exact forced-table set touched by definer functions) gains platform_private.cms_term_assignments (and later every table my definers name).

### H3 cms_version_set_of / cms_version_set_matches_manifest - DONE (item 2, pure part)
Files: supabase/migrations/20261005017520_cms_version_set_projection.sql; supabase/tests/phase_02_slice_11_helpers_version_set.sql (41 assertions); parity fixture
 supabase/tests/phase_02_slice_11_helpers/version-set-parity.sqlinc (ONE file for both sides: a psql `\set parity_fixture '<json>'` line; TS reads the text between the first and last quote).
RED: 31/37 failed (functions absent); GREEN 41/41 (after fixing my own mutation matrix: taxonomyVersionIds is the one member the manifest does not carry, exactly as TS documents, so the matrix covers the 12 manifest-bound members x 3 fixtures = 36 drifts, taxonomy gets explicit sorted/unsorted assertions).
Parity: the three fixtures were verified with `node --experimental-strip-types` against the real TS versionSetOf / versionSetMatchesManifest and the strict DependencyManifestSchema / VersionSetSchema (all true). FOR ORCHESTRATOR/lane TS: add a TS test reading version-set-parity.sqlinc (format in its header) - I may not write TS.
Frozen: cms_version_set_of(p_manifest jsonb, p_taxonomy_version_ids jsonb) returns jsonb IMMUTABLE; cms_version_set_matches_manifest(p_version_set jsonb, p_manifest jsonb) returns boolean IMMUTABLE (false, never an error, on malformed input).

### H4 cms_editorial_review_qualifying_decisions / cms_editorial_review_distinct_approvals - DONE (shared by item 6 revocation + lane 3a)
Files: supabase/migrations/20261005017530_cms_editorial_review_approvers.sql; supabase/tests/phase_02_slice_11_helpers_approvers.sql (28), fragment 002-reviews.sqlinc (review/assignment/decision builders over the S11-2 row builders and guards).
RED: 20/28 failed; GREEN 28/28. Counts an approve while the decider holds the standing capability of the SATISFIED slot (cms_person_holds_capability in the review owner party) and the authorizing assignment is not revoked; assignment expiry does not unwind (proved: the fixture windows already ended); lapsed grant / deactivated grant / ended tenure / revoked assignment / slot not held / reject all do not count.

### H5 cms_revision_effective_state / cms_revision_effective_states - DONE (item 1)
Files: supabase/migrations/20261005017540_cms_revision_effective_state.sql; supabase/tests/phase_02_slice_11_helpers_effective_state.sql (44).
RED: 36/44 failed; GREEN 44/44. First match wins published > scheduled > approved > rejected > submitted > draft; latest review = greatest submitted_at then id (insertion order irrelevant, proven); invalidated => draft; only a PUBLISH schedule in pending|executing|failed_retryable schedules; a revoked lineage stays published; set form <=1000 ids (INVALID_REQUEST above), absent ids omitted, single form NULL for absent.
OPEN (NOTES): AC-086 adoption of this helper by the Slice 10 reads (cms_list_entries, cms_list_revisions, cms_get_entry_draft, write responses) has no owner; the physical state is already the constant draft, so those reads currently project 'draft'.

### H6 settings keys / registry version / effective values / cms_settings_snapshot - DONE (item 4a)
Files: supabase/migrations/20261005017550_cms_publication_settings_snapshot.sql; supabase/tests/phase_02_slice_11_helpers_settings.sql (35).
RED: 19/25 then script abort (table rows absent); GREEN 35/35 (two of my own defects found by a debug run: pg_catalog.coalesce is not a function; a local variable named like the column).
Empty registry => snapshot [] hash 4f53cda1...; ordinal 1 recorded once; repeat reuses; per-owner ordinals; new snapshot = max+1; earlier snapshot reused (no row); owner advisory xact lock verified in pg_locks; registered-key path goes through cfg_resolve_effective_value (consumer cms.publication; stubbed key => DEPENDENCY_UNAVAILABLE, nothing recorded).

### H7 cms_build_dependency_manifest + bounds + version set + currency + status + dependency rows - DONE (item 2)
Files: supabase/migrations/20261005017560_cms_dependency_manifest.sql; supabase/tests/phase_02_slice_11_helpers_manifest.sql (82); fragments 001-world.sqlinc (adds template/instance/assignment builders), 000-helpers.sqlinc (h11_raw_exec/h11_raw_insert).
RED: 27 failed + abort at the first absent-function dependency (functions absent); GREEN 82/82; all 7 helper test files together 307/307 on the main stack.
Frozen: cms_build_dependency_manifest(uuid) jsonb VOLATILE; cms_dependency_manifest_within_bounds(jsonb) boolean STABLE; cms_revision_version_set(uuid,jsonb) jsonb STABLE; cms_manifest_identities_current(jsonb) boolean VOLATILE; cms_frozen_dependencies_status(uuid,jsonb) text VOLATILE ('current'|'stale'); cms_review_dependency_refs(uuid,jsonb) table(kind text, ref_id uuid) STABLE (the ReviewDependency rows for cms_submit_review: schema/template/block/pattern/term/taxonomy_version/locale_source/relation_target/settings(snapshot row id)).
Semantics decided (documented in the migration header, owner may override): terms hash JCS uses version as a decimal STRING; blocks = live composition instances + the revision template's slot allowedBlocks, an unresolvable block => DEPENDENCY_UNAVAILABLE; relation availability = existing ACTIVE content entry (no actor in the builder), block-policy unavailable targets stay listed; localeSources = (source_locale, source_revision_id, source_hash) of the latest variant row; bounds 256 entries/32768 bytes plus per-group contract maxima (128/128/256/32/128/128).
Proven in the test: sorted bytewise, each identity once, instance retired state ignored, withdrawn block keeps manifest bytes but makes the frozen set stale, deprecated stays current, taxonomy version must be active, pinned relation version wins, 256/257 and 32768/32769 boundaries, 128+128 integration refusal.

### H8 cms_preflight_registry_current / cms_accessibility_binding_hash / cms_evaluate_preflight (+ cms_text_is_executable, cms_json_executable_leaves) - DONE (item 6)
Files: supabase/migrations/20261005017570_cms_preflight_evaluation.sql; supabase/tests/phase_02_slice_11_helpers_preflight.sql (152); fragment 003-registry.sqlinc (blocks/patterns/template builders shared with the manifest test).
RED: functions absent (abort at the first direct reference); GREEN 152/152 after fixing my own defects (pg_catalog.least/extract are syntax not functions; plpgsql variables named like columns actor_id/review_id; 'tomorrow' is a valid timestamp so effectiveAt/evaluatedAt are now strict ISO). All 8 helper files together 459/459 on the main stack.
Per provider (registry row decides; an unimplemented newer row => unavailable/provider_unavailable): contract validators_changed|value_invalid (+relation min/max), schema schema_not_active|schema_evidence_changed, template not_active|incompatible|changed, block withdrawn|digest_changed, settings changed, relation target_unavailable|version_changed (policy omit/placeholder honoured), security unsafe_content (executable URL after stripping whitespace, script/style/... elements, event-handler/style attributes in tags, template expressions; SQL text excluded - owner ruling welcome), migration non-terminal plan as source/target, domain_binding allowlist, revocation per phase (submit: lifecycle + submitter's active edit assignment+grant [reason entry_unavailable: BE03b registers no submitter reason]; schedule/publish: publisher grant covering the effective UTC day + counted approvers still qualified when a review is given; execute: entry + creator grant only, DEC-120), accessibility evidence mapping + verification (key/version, +-60 s, binding => preflight_evidence_stale | dependency_changed; execute => preflight_evidence_stale for any mis-binding, DEC-158c).
Interpretations to ratify: blockingCount = offender count (reference count for gates) capped at 1000; a submit-phase submitter authority loss reports entry_unavailable; `draft` migration plans count as non-terminal; DEC-143 interplay proven (losing a grant revokes the assignment; re-granting does not restore it).

### H9 review invalidation core + producers + preview-token primitives - DONE (item 7)
Files: supabase/migrations/20261005017580_cms_review_invalidation.sql; supabase/tests/phase_02_slice_11_helpers_invalidation.sql (92).
RED: abort at the first absent function; GREEN 92/92 (own fixture defects only: schedule offset check, version arithmetic, trigger-name pattern). All 9 helper files together 551/551 on the main stack.
Frozen: cms_invalidate_editorial_review(p_request jsonb) jsonb {reviewId,invalidated,cancelledSchedules,revokedPreviewTokens}; cms_invalidate_reviews_for_person(p_person_id uuid, p_capability text) integer; cms_revoke_active_preview_tokens(p_entry_id uuid, p_person_id uuid) integer; cms_preview_scope_holds(p_person_id, p_acting_party_id, p_entry_id, p_revision_id) boolean STABLE (3c: use it in mint AND in the CMS-03B-19 verifier); cms_revoke_tokens_without_scope(party, person) integer; cms_trigger_correlation() uuid.
Triggers (new only): cms_entry_revisions_review_invalidation (INSERT: older live reviews of the same entry AND locale -> revision_superseded; the revision chain is per locale), cms_content_entries_review_invalidation (lifecycle leaves active -> live reviews entry_unavailable + the entry's tokens revoked even with no live review), cms_organization_actor_grant_review_authority + cms_membership_tenure_review_authority (UPDATE|DELETE -> invalidate_reviews_for_person + tokens without scope), cms_entry_assignments_preview_scope + cms_editorial_review_assignments_preview_scope (tokens without scope).
Proven: closed reasons, CAS version+1, decided_at cleared on approved->invalidated, idempotent no-op on non-live (no second event), audit (no actor for a system producer) + exactly one review-changed event at the new version, schedules pending|failed_retryable -> cancelled (approval_invalidated | entry_unavailable), executing/completed untouched, tokens revoked only for entry_unavailable (and expired/other-entry tokens untouched), E2 draft after invalidation, lapsed/removed grant and ended tenure invalidate counted approvers (policy-slot loss does not touch a base-slot approve), assignment revocation alone does NOT invalidate (CMS-03B-18 recount), preview scope = assignee | reviewer assignee | owner-party publisher and loss revokes tokens (DEC-143 pattern).

### H10 cms_append_publication_lineage / cms_publication_lineage_lock / cms_publication_row_state + `cms.publication.` producer prefix - DONE (item 8)
Files: supabase/migrations/20261005017590_cms_publication_lineage_append.sql; supabase/tests/phase_02_slice_11_helpers_lineage.sql (81).
RED: abort at the first absent function; GREEN 81/81 (own fixture defects only: char(64) vs text in is(), the sqlerrm suffix on SQLSTATE 23503). All 10 helper files 632/632 on the main stack.
Frozen/changed vs the first draft of helpers-api.md (no lane had coded against it yet): the request drops actingPartyId/settingsVersion (owner = the entry owner; settings version projects from the version set) and a tombstone accepts NO evidence (copies the active head); the answer is the PublicationResource of the appended row (projectionState pending, DEC-158e).
Proven: first publish v1 with publication_id = own id; second publish v2 supersedes (derived, no UPDATE); tombstone v3 copies evidence, revoked_at set, activated_at null; publication_not_active on a revoked/absent head; publish after a revoked head v4 same lineage; per-audience lineages; publication_hash literal-JCS oracle; payload identifiers only; event aggregate keyed by the lineage id at the lineage sequence; audit row per append; separation_of_duties/entry_unavailable/CONFLICT backstops; strict per-action request members; scheduleId stored; lineage advisory lock held (pg_locks). Race (publication_conflict via UNIQUE) is for the lane-3 race runner.

### H11 cms_tzdb_version - DONE (item 4b)
Files: supabase/migrations/20261005017595_cms_tzdb_version.sql; supabase/tests/phase_02_slice_11_helpers_tzdb.sql (9). RED observed (9/9 failed with the migration withheld), GREEN 9/9.
cms_tzdb_version() = '2026e' (S11-1 pin, dec-153-pin), IMMUTABLE definer; the literal sits in the function body so a TS parity test can read it from the migration. FOR S11-1/orchestrator: add the parity test (read supabase/migrations/20261005017595_cms_tzdb_version.sql, match `select '<tag>'::text`, compare with CMS_TZDB_VERSION).

### H12 integration run, older-test cascades, lint - DONE
Full run 2 after the cascades (`s11/lane-s11-3s-fullrun2.log`, 304 files, 11945 assertions, exit 1): all 11 helper files green; schema.sql #448 and p240_a03_relation #93 now green; remaining 19 reds all classified below (none mine): bench128 x4 host load; guard files x10 (sec2 #6, ev_eb #2/#3/#6, r8_api_surface #4/#13/#14, p240_authority #51, schema.sql #17) = GUARD CASCADE + lane 3a's service_role-executable private functions (3a's own new tests rpc_review_assign #7, rpc_review_decision #11, rpc_review_submit #10 assert the opposite, so 3a is mid-fix); lane S11-2 schedules_schema #51 and schema_posture #4 = NOTES posted.
Cascades I applied (older tests that pinned a catalog my migrations legitimately change; assertion strength kept):
- supabase/tests/phase_02_slice_09_dec108/06-trigger-probes.sqlinc: +4 rows in s09t_inventory (cms_content_entries_review_invalidation 17, cms_entry_assignments_preview_scope 25, cms_entry_revisions_review_invalidation 5, cms_editorial_review_assignments_preview_scope 25); supabase/tests/phase_02_slice_09_schema/012-trigger-catalog.sqlinc count 128 -> 132 (fixes schema.sql #448).
- supabase/tests/phase_02_slice_09_p240_a03_relation.sql: pinned list gains platform_private.cms_evaluate_preflight (it re-checks relation cardinality/domain binding), count twenty-three -> twenty-four (verified green, #93).
GUARD CASCADE (orchestrator-owned files, NOT edited by me; expect them red until the orchestrator applies the three lanes' rows):
- phase_02_slice_09_sec2_all_schema_definer_rls.sql #6 (forced tables named by definer functions): add platform_private.cms_editorial_decisions, cms_editorial_review_assignments, cms_editorial_review_dependencies, cms_editorial_reviews, cms_pattern_versions, cms_preflight_registry, cms_preview_tokens, cms_publication_schedules, cms_publication_settings_snapshots, cms_term_assignments (the exact `have:` string is in .lane-logs/tap-135717.tap, test 6; it already includes the 3a rows).
- phase_02_slice_10_ev_eb_publication_scope.sql #3 (private names): my allow-list rows are cms_append_publication_lineage, cms_editorial_review_distinct_approvals, cms_editorial_review_qualifying_decisions, cms_invalidate_editorial_review, cms_publication_lineage_lock, cms_publication_row_state, cms_publication_settings_effective_values, cms_publication_settings_keys, cms_publication_settings_registry_version, cms_revoke_active_preview_tokens (3a adds cms_assign_editorial_reviewer, cms_editorial_review_resource, cms_editorial_review_scopes); #6 (manifest/version-set names): platform_private.cms_build_dependency_manifest, cms_dependency_manifest_within_bounds, cms_revision_version_set, cms_version_set_matches_manifest, cms_version_set_of. #2 is 3a only. NOTE #1 will also flip when 3b/3c land preview/schedule/publication wrappers.
- None of my helpers is executable by anon/authenticated/service_role (checked in the catalog); the r8_api_surface #4/#13/#14, p240_authority #51 and schema.sql #17 reds are lane 3a's private cms_assign_editorial_reviewer / cms_record_review_decision / cms_submit_review (service_role-executable) plus their platform_api wrappers.
Lane S11-2 files that my new triggers make red (I may not edit them; NOTES entry posted): phase_02_slice_11_schedules_schema.sql #51 (archiving the entry now invalidates the approved review via cms_content_entries_review_invalidation, so the schedule guard answers CONFLICT, not entry_unavailable) and phase_02_slice_11_schema_posture.sql #4 (cms_editorial_review_assignments carries my extra AFTER trigger cms_editorial_review_assignments_preview_scope).
bench128 p95 reds (activate/create128/dry_run/submit): host load, not a regression. Every op, including assign (8.6 -> 43.7 ms) which no Slice 11 object touches, is 4.5-5x slower than the Slice 10 baseline (create128 p95 196 -> 932 ms, decide 40 -> 192 ms) with loadavg 11-15 on 8 cores; re-run on a quiet host.
db lint (`supabase db lint --local --level warning --schema platform_private,audit_private,platform_api,public_api`): one warning, platform_private.valid_response_ref (migration 20260830100000, pre-existing); nothing in 017500..017595.

## Remaining
Nothing in my range. Handed off: orchestrator applies GUARD CASCADE rows; S11-2 adjusts schedules_schema #51 and schema_posture #4; 3a revokes service_role on its three private commands; S11-1/orchestrator add the TS parity tests (version-set-parity.sqlinc vs versionSetOf; migration 017595 literal vs CMS_TZDB_VERSION); owner questions AC-086 and assignment-revocation (see NOTES 2026-10-08 S11-3s entry); quiet-host re-run of bench128.
