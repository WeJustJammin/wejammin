# Slice 12 evidence-ledger gap report: P2-S12-AC-072 to AC-142 (lane B)

Verified at worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `ddda7d58c4a2af8e593f36e6e4ef16fe97017c74`.
Ledger fragment: `tests/contracts/phase-02-slice-12-evidence-ledger-072-142.ts` (71 entries, 341 clauses, every `text` byte-identical to the skeleton; clauses re-split only so they still tile the text).

## Result

All 71 criteria are `unverified` and no test is cited. The cause is structural, not a matter of missing test titles: the 13 operations these rows describe, CMS-03C-07 through CMS-03C-19, are not built. There is no route, contract schema, RPC, governed-review table, job type or web component for any of them. Slice 09 and Slice 11 siblings exist for several (listed per section) but a sibling proves its own operation, not the Slice 12 one, so none is cited.

No test file in the repository carries a `P2-S12-AC-072`..`AC-142` marker, and no test title or body names any of the operations, contracts or components below (searched, see K-keys).

## Search record

Every key below was searched as a fixed-string grep over `apps/`, `packages/`, `supabase/`, `infra/`, `scripts/` and `tests/` (excluding `node_modules`, `test-results` and the four Slice 12 ledger fragments). All returned zero files.

- K-GOV: `governed_review`, `GovernedReview`, `GovernedDecision`, `cms.definition_review`, `cms_governed_`, `/governed-reviews`, `definition-reviews`, `CmsGoverned`.
- K-ACT: `GovernedActivation`, `cms_governed_activation_schedules`, `cms.governed_activation`, `cms_claim_due_governed`, `cms_execute_governed`, `ClaimedGovernedActivation`, `ScheduledInstant`, `scheduledForUtc`.
- K-PAT: `patterns/versions`, `patterns/selector`, `PatternVersionRequest`, `PatternNode`, `blockTree`, `patternKey`, `PatternSelector`, `CmsPatternVersionDesigner`, `CmsPatternSelector`, `CmsPatternUpdateDiff`, `update-diff`, `CompositionUpdateDiff`, `pattern-updates`, `CompositionUpdateRequest`, `CmsCompositionInstanceList`.
- K-TAX: `taxonomies/versions`, `taxonomies/selector`, `TaxonomyVersionRequest`, `TaxonomySelector`, `taxonomyKey`, `allowedTypeKeys`, `canonicalOverlapDomains`, `CmsTaxonomyVersionDesigner`, `CmsTaxonomyFieldEditor`.
- K-CAN: `cms_canonical_taxonomy_match`, `CanonicalTaxonomyMatch`, `cms_canonical_domain_registry`, `cms_act_taxonomy_term`.

Also checked: `packages/contracts/src/platform-registries.ts` (last CMS-03C row is `CMS-03C-05` at line 1883; no `CMS-03C-06`..`CMS-03C-21` row), `apps/web/src/pages` (no `governed-reviews`, `definition-reviews`, `patterns`, `taxonomies` or entry `composition` route or page), a skip/todo/fixme scan of the composition tests (none found).

## What exists and what it does not prove

Foundations the build extends (all from Slice 09, none implement a CMS-03C-07..19 behaviour):

- `platform_private.cms_pattern_versions` (supabase/migrations/20260927290000_cms_composition_authority.sql:43): lacks `pattern_id` lineage, `compatible_type_ids`, `node_count`, `activated_at`, `retired_at` and any `supersedes_id`; carries a global `UNIQUE (pattern_key, version)` (line 63) where BE03c E14 requires `UNIQUE (owner_id, key, version)`; no CHECK refusing the reserved keys `context`, `versions`, `selector`, `new` (E13).
- `platform_private.cms_taxonomy_versions` (supabase/migrations/20260927260000_cms_taxonomy_authority.sql:6): lacks `taxonomy_id` lineage, `canonical_overlap_domains`, `activated_at`, `retired_at`; global `UNIQUE (taxonomy_key, version)` (line 29). `cms_template_versions` has the same global unique (…20260927200000_cms_template_authority.sql:178).
- `platform_private.cms_composition_instances` (…290000…:72): has state `pending_diff` but no `pending_pattern_version` or `carried_from_id` column.
- CMS-03C-03 (taxonomy term action) is routed but its production port `actTerm` fails closed for every request (apps/worker/src/cms-composition-production-taxonomy.ts:55) pending the canonical-overlap authority that CMS-03C-18 supplies.
- CMS-03C-01/02 siblings: apps/worker/src/cms-composition/template-version-routes.ts and pattern-instance-routes.ts, apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx.
- Slice 11 editorial review siblings (the governed machinery adopts their ten ordered checks, DEC-137): `platform_private.cms_record_review_decision`, `cms_assign_editorial_reviewer`, `cms_get_editorial_review`, `cms_list_editorial_reviews`; Worker routes under apps/worker/src/cms-editorial/review-*-routes.ts and schedule-routes.ts; web under apps/web/src/components/cms-editorial-workflow/; tests supabase/tests/phase_02_slice_11_criteria_decision_order.sql, tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts, tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts. Slice 09 schema-review siblings: `cms_submit_schema_review`, `cms_assign_schema_review`, `cms_decide_schema_review`, `cms_get_schema_review`.
- CMS-03B-20 sibling for CMS-03C-19: job `cms.publication_schedule.execute` (packages/contracts/src/cms-editorial/jobs.ts:12), `cms_claim_due_publication_schedules` (supabase/migrations/20261005017730_cms_claim_due_publication_schedules.sql:223), apps/worker/src/cms-publication-schedule-sweep.ts, wired from apps/worker/src/index.ts:24.

## Build order the evidence depends on

1. Governed-review tables (`cms_governed_reviews`, `_decisions`, `_assignments`, `_dependencies`, `cms_governed_activation_schedules`), the `cms.definition_review` capabilities and the CMS-03C-06 submit RPC: one build serves CMS-03C-06..11 and 19.
2. Pattern and taxonomy version-table deltas (BE03c Canonical records and fields) and the E14 per-owner unique change, then CMS-03C-12/16, then CMS-03C-13/17.
3. `cms_canonical_domain_registry` and CMS-03C-18, then CMS-03C-03 completion and the taxonomy activation preflight.
4. An entry composition page: AC-111, AC-117 and AC-123 (and the CMS-03C-02 UI) have no page to live on.
5. Web consumers last.

Family build effort is L for each of: governed reviews (07-11 plus 19), pattern versions and updates (12-15), taxonomy versions and selector (16-17), canonical match (18), and the web surfaces.

## Conventions used below

Size is the effort to write and pass the missing evidence once the operation exists (S under 1 h, M 1-4 h, L over 4 h); it excludes the build itself, which is given per family above.

Test-file tags (proposed names, none exist; follow the sibling naming):
- Governed family: GC `packages/contracts/src/cms-composition/governed-review.test.ts`; GO `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts`; GW `apps/worker/src/cms-composition/governed-review-routes.test.ts`; GP-dec/asg/act/rd `supabase/tests/phase_02_slice_12_governed_{decision,assignment,activation,reads}.sql`; GA-dec/asg/act/rd `tests/postgrest/phase-02-slice-12-governed-{decision,assignment,activation,reads}.apispec.ts`; GU-dec/asg/act/det/q `apps/web/src/components/cms-governed-review/CmsGoverned{DecisionForm,AssignmentForm,ActivationForm,ReviewDetail,ReviewQueue}.test.tsx`; GE `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts`.
- Pattern family: PC `packages/contracts/src/cms-composition/pattern-version.test.ts` and `pattern-update.test.ts`; PO-v/s/d/u `tests/contracts/phase-02-slice-12-pattern-{version,selector,update-diff,update}-openapi.test.ts`; PW `apps/worker/src/cms-composition/pattern-{version,selector,update}-routes.test.ts`; PP-v/s/d/u `supabase/tests/phase_02_slice_12_pattern_{version,selector,update_diff,update}.sql`; PA-v/s/d/u `tests/postgrest/phase-02-slice-12-pattern-{version,selector,update-diff,update}.apispec.ts`; PU-des/sel/diff/list `apps/web/src/components/cms-composition/Cms{PatternVersionDesigner,PatternSelector,PatternUpdateDiff,CompositionInstanceList}.test.tsx`; PE `tests/e2e/phase-02-slice-12-pattern-real-route.spec.ts`.
- Taxonomy family: XC `packages/contracts/src/cms-composition/taxonomy-version.test.ts` and `taxonomy-selector.test.ts`; XO `tests/contracts/phase-02-slice-12-taxonomy-{version,selector}-openapi.test.ts`; XW `apps/worker/src/cms-composition/taxonomy-{version,selector}-routes.test.ts`; XP / XP-s `supabase/tests/phase_02_slice_12_taxonomy_{version,selector}.sql`; XA / XA-s `tests/postgrest/phase-02-slice-12-taxonomy-{version,selector}.apispec.ts`; XU-des `apps/web/src/components/cms-composition/CmsTaxonomyVersionDesigner.test.tsx`; XU-fld `apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.test.tsx`; XE `tests/e2e/phase-02-slice-12-taxonomy-real-route.spec.ts`.
- Canonical match and job: NC `packages/contracts/src/cms-composition/canonical-taxonomy-match.test.ts`; NP `supabase/tests/phase_02_slice_12_canonical_taxonomy_match.sql`; JC `packages/contracts/src/cms-composition/governed-activation-job.test.ts`; JP `supabase/tests/phase_02_slice_12_governed_activation_sweep.sql`; JW `apps/worker/src/cms-governed-activation-sweep.test.ts`.
- Playwright specs must be added to `testMatch` in `playwright.s09-real.config.ts` and cited with `project: 'real-route-chrome'`. Real-stack `*.apispec.ts` files run under the postgrest vitest config and need the shared Supabase stack. A cited `.sqlinc` would run every including `.sql`; prefer top-level `.sql` descriptions.

Unproven clauses are listed as counts and themes. Because every entry is `unverified`, every clause of every criterion is unproven; the verbatim clause texts are the `clauses[].text` values in the ledger fragment.

## Per-criterion sections


## CMS-03C-07 governed review decision (POST /api/v1/cms/governed-reviews/{reviewId}/decision)

### P2-S12-AC-072 — unverified
- Unproven clause(s): all 6 clauses: MFA-first 401 before any idempotency reservation; active `cms.definition_review` assignment plus standing `cms.reviewer` grant (and specialist capability) required; hidden or absent review 404; readable review without effective assignment or capability, or a separation-of-duties violation (submitter, subject creator), 403; server-derived reviewer, slot capability and MFA instant; `reason` readable only by its decider.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_record_review_decision` (supabase/migrations/20261005017630_cms_record_review_decision.sql:52), apps/worker/src/cms-editorial/review-decision-routes.ts)
- Missing evidence: [GP-dec] pgTAP: an expired or absent MFA proof is refused 401 before concealment and writes no idempotency row; the assigned reviewer with and without a standing `cms.reviewer` grant and with and without the slot specialist capability; the submitter and the subject creator get 403 `separation_of_duties`; a hidden and an absent review return the identical 404; the decision row stores the server-derived reviewer, satisfied slot capability and `step_up_at`; another decider's `reason` is never returned. [GA-dec] real-stack apispec: the same through Worker and PostgREST, and a body carrying `capability` or `stepUpAt` is a 422 unknown key. Model on supabase/tests/phase_02_slice_11_criteria_decision_order.sql and tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts.
- Size: L

### P2-S12-AC-073 — unverified
- Unproven clause(s): all 7 clauses: Idempotency-Key and review-version If-Match required; one transaction in the Slice 12 lock order; the ten ordered CMS-03B-06 checks; unique reviewer per review and review CAS (`version` + 1); review ends at the first rejection; rate buckets 30/min/user and 60/min/party, 15,000 ms deadline, no-store, Tier 2; no event.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_record_review_decision` (supabase/migrations/20261005017630_cms_record_review_decision.sql:52), apps/worker/src/cms-editorial/review-decision-routes.ts)
- Missing evidence: [GP-dec] pgTAP: lock acquisition order (subject, dependency, content-type positions before the review row, DEC-157) proven by a two-session race or by `pg_locks`/trigger-recorded order; each of the ten checks refused in order with its own outcome; unique (review, reviewer) refuses a second decision; review `version` increments by exactly 1; the first rejection ends the review and later approvals are `review_not_open`; no outbox row is written. [GW] worker: header admission (Idempotency-Key, If-Match), rate buckets 30/60, 15,000 ms deadline, `Cache-Control: no-store`. [GA-dec] real-stack: Tier 2 headers and the no-event assertion.
- Size: L

### P2-S12-AC-074 — unverified
- Unproven clause(s): all 10 clauses: 400, 401 (UNAUTHENTICATED and STEP_UP_REQUIRED with `{ recoveryAction: 'step_up', allowedMethods }`, no reservation), 403, 404, 409 GOVERNED_REVIEW_VERSION_CONFLICT (stale, review_not_open, duplicate_decision, specialist_slot_unsatisfiable, committed dependency_changed returning the subject to `draft`), 415, 422, 429, 5xx deadline, 500 mapped to catalog `cms.03c.governed-review.v1`.
- Implementation: appears missing (searched: K-GOV; no catalog `cms.03c.governed-review.v1` exists; siblings that are not proof: `platform_private.cms_record_review_decision` (supabase/migrations/20261005017630_cms_record_review_decision.sql:52), apps/worker/src/cms-editorial/review-decision-routes.ts)
- Missing evidence: [GW] worker: table-driven mapping of every port outcome to status, code and `details.reasonCode` under catalog `cms.03c.governed-review.v1`, STEP_UP_REQUIRED detail shape, no reservation call before step-up. [GA-dec] real-stack apispec: one real refusal per status class (400 malformed header, 401 both codes, 403, 404, 409 per reason, 415, 422, 429 by exhausting the bucket, 502/503/504 by a bounded RPC fault, 500) and a committed `dependency_changed` that leaves the subject in `draft`. [GP-dec] pgTAP: no decision row after each refusal.
- Size: L

### P2-S12-AC-075 — unverified
- Unproven clause(s): all 6 clauses: CmsGovernedDecisionForm request building (`expectedVersion` = review version, no `capability`/`stepUpAt`); radio pair with persistent reason label and counter and a consequence-naming confirm control; 401 STEP_UP_REQUIRED to `/step-up?returnTo=` with draft restored and the same Idempotency-Key; `separation_of_duties` as CapabilityGate copy, never a step-up route; fixed copy for four 409 reasons; step-up round trip, each fixed message, ordinary and protected paths, focused result heading.
- Implementation: appears missing (searched: K-GOV; sibling that is not proof: apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.tsx)
- Missing evidence: [GU-dec] vitest (jsdom): request body has exactly the allowed members; each refusal renders its fixed message; 401 step-up navigation carries `returnTo`, restores the draft and reuses the Idempotency-Key; `separation_of_duties` renders the CapabilityGate copy and never navigates to `/step-up`; focus moves to the result heading. [GE] Playwright real-route-chrome: ordinary and protected decision paths and the step-up round trip against the real stack (add the spec to playwright.s09-real.config.ts testMatch).
- Size: L


## CMS-03C-08 governed reviewer assignment (POST .../assignments)

### P2-S12-AC-076 — unverified
- Unproven clause(s): all 3 clauses: POST /api/v1/cms/governed-reviews/{reviewId}/assignments with strict discriminated `GovernedReviewAssignmentRequest` and strict `GovernedReviewAssignmentResource` (201 create, 200 revoke, listed members); generated OpenAPI and discovered Hono route match the registry row.
- Implementation: appears missing (searched: K-GOV; no CMS-03C-06..11 row in packages/contracts/src/platform-registries.ts, whose last CMS-03C row is CMS-03C-05 at line 1883)
- Missing evidence: [GC] vitest: valid create and revoke accepted; unknown key, missing `expectedVersion`, extra member on either variant rejected; resource members exactly as listed with `actions` equal to `['read','decide']`. [GO] vitest (pattern: tests/contracts/phase-02-slice-12-taxonomy-term-openapi.test.ts): `platformRegistrySet` row, generated OpenAPI path/status codes (201 and 200) and the discovered Hono route agree.
- Size: S

### P2-S12-AC-077 — unverified
- Unproven clause(s): all 4 clauses: `create` grammar and expiry bounds (7 days, reviewer `cms.reviewer` grant day, owner designer/curator grant day, 422 `expiry_out_of_bounds`); optional NFC `reason` of 1-256 code points refused not normalized; `revoke` assignmentId (404 missing, 409 already revoked); strong If-Match equals `expectedVersion`.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_assign_editorial_reviewer` (supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql:50), apps/worker/src/cms-editorial/review-assignment-routes.ts)
- Missing evidence: [GC] vitest: NFC, length (code points, not UTF-16 units) and control-character cases for `reason`; UUID `reviewerPersonId`. [GP-asg] pgTAP: expiry at, one second past and one day past each of the three bounds (seven days, reviewer grant day, owner grant day); revoke of a missing assignment is 404 and a revoked one 409. [GA-asg] real-stack: If-Match different from `expectedVersion` is refused.
- Size: M

### P2-S12-AC-078 — unverified
- Unproven clause(s): all 6 clauses: unconditional recent MFA; receipt-derived owner holding non-grantable `cms.definition_review.assign` and a valid designer or curator grant (403 `capability_missing`); eligible reviewer rules; uniform 409 `reviewer_not_eligible` with no existence or role signal; hidden, absent or cross-owner review 404; assignee confers only `read` and `decide` on one frozen review.
- Implementation: appears missing (searched: K-GOV; no `cms.definition_review.assign` capability anywhere; siblings that are not proof: `platform_private.cms_assign_editorial_reviewer` (supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql:50), apps/worker/src/cms-editorial/review-assignment-routes.ts)
- Missing evidence: [GP-asg] pgTAP: non-owner and owner-without-designer/curator-grant get 403 `capability_missing`; each ineligibility (non-human, no membership, no active `cms.reviewer`, the submitter, the subject creator, unknown id) returns the byte-identical 409; cross-owner review is 404; the created assignment row has `capability_key = 'cms.definition_review'` and `actions = {read,decide}` and grants nothing on another review. [GA-asg] real-stack equivalents plus the MFA-first 401.
- Size: L

### P2-S12-AC-079 — unverified
- Unproven clause(s): all 8 clauses: Idempotency-Key and exact review-version If-Match; review row locked; review `version` unchanged on create and revoke; 16-active-assignment limit (409 `assignment_limit`); rate buckets 10/min/user and 20/min/party, 15,000 ms deadline, no-store, Tier 2; assignment change and audit atomic; no event; expired assignment inert.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_assign_editorial_reviewer` (supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql:50), apps/worker/src/cms-editorial/review-assignment-routes.ts)
- Missing evidence: [GP-asg] pgTAP: review `version` identical before and after create and revoke; the 17th active assignment is refused; audit row present exactly when the assignment row is (fault-injected rollback leaves neither); no outbox row; a decision by a reviewer whose assignment `ends_at` has passed is refused. [GW] worker: 10/20 buckets, deadline, no-store. [GA-asg] real-stack: header requirements and a lost-response retry.
- Size: M

### P2-S12-AC-080 — unverified
- Unproven clause(s): all 4 clauses: 409/422 refusals with no row written; 401 STEP_UP_REQUIRED without reservation or state change; 400/403/404/415/429/5xx mapped to catalog `cms.03c.governed-review.v1`; lost response reconciled by the same Idempotency-Key.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_assign_editorial_reviewer` (supabase/migrations/20261005017620_cms_assign_editorial_reviewer.sql:50), apps/worker/src/cms-editorial/review-assignment-routes.ts)
- Missing evidence: [GW] worker: table-driven status/code mapping. [GA-asg] real-stack: each refusal leaves the assignment table unchanged; replay with the same Idempotency-Key returns the committed 201; replay with a different body returns the idempotency conflict. [GP-asg] pgTAP: no row after each refusal.
- Size: L

### P2-S12-AC-081 — unverified
- Unproven clause(s): all 7 clauses: CmsGovernedAssignmentForm only when `permittedNextActions` has `assign_reviewer` (owner only); reviewer options from CMS-03A-18 grant list (`capability=cms.reviewer`, `state=active`); person id island-local and discarded on step-up navigation; client-side 7-day `expiresAt` bound; uniform refusal as one fixed message; 401 to `/step-up?returnTo=` without replay and with explicit re-confirmation after a `version` refetch; verification list (create and revoke, collapse to `reviewer_not_eligible`, bounds, `assignment_exists`, `assignment_limit`, `review_not_open`, owner-only, unchanged version).
- Implementation: appears missing (searched: K-GOV; sibling that is not proof: apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.tsx)
- Missing evidence: [GU-asg] vitest (jsdom): form absent unless `assign_reviewer` is permitted; options come only from the grant list request; person id not in URL, storage or the step-up `returnTo`; seven-day bound enforced client-side; each of the five refusals renders its fixed message and every eligibility refusal renders the one uniform message; no automatic replay after step-up. [GE] Playwright real-route-chrome: create and revoke through the real stack with the review `version` visibly unchanged.
- Size: L


## CMS-03C-09 governed activation, scheduling and retirement (POST .../activation)

### P2-S12-AC-082 — unverified
- Unproven clause(s): all 4 clauses: POST /api/v1/cms/governed-reviews/{reviewId}/activation with strict discriminated `GovernedActivationRequest` (activate, schedule with `ScheduledInstant`, retire); strict `GovernedActivationResource` (200 activate/retire, 202 schedule); listed members including `eventType` only on committed immediate activation or retirement; OpenAPI and Hono route match the registry row.
- Implementation: appears missing (searched: K-GOV, K-ACT: `ScheduledInstant` and `scheduledForUtc` have no definition anywhere)
- Missing evidence: [GC] vitest: each variant accepted and each mixed-variant payload rejected; resource strictness; `eventType` null for a schedule. [GO] vitest: registry row, OpenAPI 200/202 responses and discovered Hono route parity.
- Size: S

### P2-S12-AC-083 — unverified
- Unproven clause(s): all 4 clauses: ordered checks in one transaction (step-up proof, concealment per scope, `approved` review at `expectedVersion`, recheck of subject hash, policy basis and every dependency with committed invalidation and 409 `dependency_changed`); `retire` reason NFC 1-256 refused not normalized; strong If-Match equals `expectedVersion`.
- Implementation: appears missing (searched: K-GOV, K-ACT; siblings that are not proof: `platform_private.cms_execute_publication_schedule` (supabase/migrations/20261005017740_cms_execute_publication_schedule.sql:78), apps/worker/src/cms-editorial/schedule-routes.ts, the Slice 09 `cms_activate_schema_*` activation)
- Missing evidence: [GP-act] pgTAP: a review that is not `approved` or has a stale version is refused; a changed subject hash, policy basis or dependency commits the invalidation, returns the subject to `draft` and still answers 409 (the committed-then-refused ordering); check order proven by presenting two simultaneous faults. [GC] vitest: `retire` reason grammar. [GA-act] real-stack: If-Match mismatch refused.
- Size: L

### P2-S12-AC-084 — unverified
- Unproven clause(s): all 4 clauses: unconditional recent MFA before anything else (401, no reservation); subject-kind owner capability as for CMS-03C-06; hidden or absent review 404; visible review without the capability 403.
- Implementation: appears missing (searched: K-GOV; no CMS-03C-06 submit RPC exists either)
- Missing evidence: [GP-act] pgTAP per subject kind (template, pattern, taxonomy): designer holds template and pattern activation, curator holds taxonomy activation, a holder of the other capability gets 403, a stranger gets 404; MFA lapse is 401 before the 404. [GA-act] real-stack parity.
- Size: M

### P2-S12-AC-085 — unverified
- Unproven clause(s): all 5 clauses: Idempotency-Key and review-version If-Match; one transaction in the Slice 12 lock order; review row and lineage advisory lock held as an atomic CAS switch; rate buckets 20/min/user and 40/min/party, 15,000 ms deadline, no-store, Tier 2; switch and audit atomic.
- Implementation: appears missing (searched: K-GOV, K-ACT; siblings that are not proof: `platform_private.cms_execute_publication_schedule` (supabase/migrations/20261005017740_cms_execute_publication_schedule.sql:78), apps/worker/src/cms-editorial/schedule-routes.ts, the Slice 09 `cms_activate_schema_*` activation)
- Missing evidence: [GP-act] pgTAP: two concurrent activations of two versions of one lineage leave exactly one `active` (partial unique on lineage) with the loser refused `activation_conflict`; audit row and state switch commit or roll back together. [infra/database-races] a race scenario for the lineage advisory lock (see infra/database-races/README.md). [GW] worker: 20/40 buckets, deadline, no-store.
- Size: L

### P2-S12-AC-086 — unverified
- Unproven clause(s): all 5 clauses: 409 set (stale version, `subject_not_activatable`, `subject_not_retirable`, `dependency_changed`, `activation_conflict`, `schedule_exists`); 422 set (time, tzdb, horizon, preflight, `canonical_source_unavailable` with `details.domain`); 401 STEP_UP_REQUIRED without state change; 400/403/404/415/429/5xx mapping to catalog `cms.03c.governed-review.v1`; no partial switch.
- Implementation: appears missing (searched: K-GOV, K-ACT; siblings that are not proof: `platform_private.cms_execute_publication_schedule` (supabase/migrations/20261005017740_cms_execute_publication_schedule.sql:78), apps/worker/src/cms-editorial/schedule-routes.ts, the Slice 09 `cms_activate_schema_*` activation)
- Missing evidence: [GW] worker: status/code/`details` mapping table. [GA-act] real-stack: one real refusal per reason, with `canonical_source_unavailable` for a declared `unbuilt` domain naming `details.domain`. [GP-act] pgTAP: after every refusal the subject state, the previous active version and the schedule table are unchanged.
- Size: L

### P2-S12-AC-087 — unverified
- Unproven clause(s): all 8 clauses: CmsGovernedActivationForm offers activate, schedule (shared Time authority module computing `ScheduledInstant`) or retire (named consequence) behind `ConfirmationStep`; sends review `version` with unconditional step-up; typed `canonical_source_unavailable` message naming the domain; 200 shows activated and superseded versions, 202 shows Scheduled, not active; blocked and cancelled schedules with closed reason; never reads immediate activation as published; focus on result heading; verification of all three actions, the confirmation step, step-up round trip and closed schedule reasons.
- Implementation: appears missing (searched: K-GOV, K-ACT; sibling that is not proof: apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.tsx)
- Missing evidence: [GU-act] vitest (jsdom): each action's request body, the ConfirmationStep gate, 200 and 202 copy, closed schedule reason copy, absence of the word published after an immediate activation, step-up navigation and focus. [GE] Playwright real-route-chrome: activate, schedule and retire against the real stack.
- Size: L


## CMS-03C-10 governed review detail (GET /api/v1/cms/governed-reviews/{reviewId})

### P2-S12-AC-088 — unverified
- Unproven clause(s): all 3 clauses: GET /api/v1/cms/governed-reviews/{reviewId} returning the strict `GovernedReviewDetailResource` with the listed bounds (64 policyBasis, 0-8 distinctApprovalCount, 8 decisions, 32 assignments, 6 permittedNextActions); OpenAPI and Hono route match the registry row.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_get_editorial_review` (supabase/migrations/20261005017880_cms_get_editorial_review.sql:121) and `cms_list_editorial_reviews` (…17890_cms_list_editorial_reviews.sql:32), apps/worker/src/cms-editorial/review-detail-routes.ts and review-queue-routes.ts)
- Missing evidence: [GC] vitest: strict resource accepts the maximum sizes and rejects 65 policyBasis, 9 decisions, 33 assignments, 7 actions and unknown members. [GO] vitest: registry row, OpenAPI and discovered route parity.
- Size: S

### P2-S12-AC-089 — unverified
- Unproven clause(s): all 4 clauses: UUID path with no query key; decision `reason` only to its decider and `assignments` only to the receipt-derived owner (others `[]`); no decision member beyond the six listed; response with more than 8 decisions or 32 assignments refused as 502 `DEPENDENCY_UNAVAILABLE`.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_get_editorial_review` (supabase/migrations/20261005017880_cms_get_editorial_review.sql:121) and `cms_list_editorial_reviews` (…17890_cms_list_editorial_reviews.sql:32), apps/worker/src/cms-editorial/review-detail-routes.ts and review-queue-routes.ts)
- Missing evidence: [GW] worker: query key and non-UUID path are 400; an oversize port response becomes 502 with no body leak. [GP-rd] pgTAP: decider sees own reason, a second reviewer and the owner do not; assignments are `[]` for every non-owner reader. [GA-rd] real-stack equivalents.
- Size: M

### P2-S12-AC-090 — unverified
- Unproven clause(s): all 4 clauses: read scopes (submitter, non-revoked assignee, owner-capability holder, receipt-derived owner); hidden/absent/cross-owner 404 and no-read-scope 403; `reason` only on the caller's own decision; `assignments` only to the owner and own assignment to its reviewer; no person, actor or party identifier serialized.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_get_editorial_review` (supabase/migrations/20261005017880_cms_get_editorial_review.sql:121) and `cms_list_editorial_reviews` (…17890_cms_list_editorial_reviews.sql:32), apps/worker/src/cms-editorial/review-detail-routes.ts and review-queue-routes.ts)
- Missing evidence: [GP-rd] pgTAP: one row per scope holder (readable), a revoked assignee and a stranger (404 or 403 by readability), a cross-owner reader (404); the serialized JSON is scanned for person, actor and party identifier keys and values. [GA-rd] real-stack parity.
- Size: M

### P2-S12-AC-091 — unverified
- Unproven clause(s): all 4 clauses: no-store mutation-free safe read rejecting Idempotency-Key and If-Match; strong ETag `"{review.version}"`; read buckets 300/min/user and 600/min/party, 8,000 ms deadline, Tier 1 p95 < 750 ms; no audit or outbox row, no event.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_get_editorial_review` (supabase/migrations/20261005017880_cms_get_editorial_review.sql:121) and `cms_list_editorial_reviews` (…17890_cms_list_editorial_reviews.sql:32), apps/worker/src/cms-editorial/review-detail-routes.ts and review-queue-routes.ts)
- Missing evidence: [GW] worker: Idempotency-Key or If-Match present is 400; `Cache-Control: no-store`; ETag equals the review version; 300/600 buckets; 8,000 ms deadline. [GP-rd] pgTAP: row counts of audit and outbox unchanged across a read. [GA-rd] real-stack: p95 < 750 ms over a bounded sample is the only place the Tier 1 target is provable (see the Slice 11 reads benches under supabase/tests/phase_02_slice_11_reads_bench128).
- Size: M

### P2-S12-AC-092 — unverified
- Unproven clause(s): all 4 clauses: 400, 401, 403, 404, 415 mapping; response-contract failure as 502 `DEPENDENCY_UNAVAILABLE`; 429, 502/503/504 and 500 mapping to catalog `cms.03c.governed-review.v1`; a concealed review answered with the same 404.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_get_editorial_review` (supabase/migrations/20261005017880_cms_get_editorial_review.sql:121) and `cms_list_editorial_reviews` (…17890_cms_list_editorial_reviews.sql:32), apps/worker/src/cms-editorial/review-detail-routes.ts and review-queue-routes.ts)
- Missing evidence: [GW] worker: table-driven mapping. [GA-rd] real-stack: one real response per status, and byte-identical 404 bodies for absent, hidden and cross-owner reviews.
- Size: M

### P2-S12-AC-093 — unverified
- Unproven clause(s): all 6 clauses: CmsGovernedReviewDetail at `/app/cms-content-modeling/definition-reviews/:reviewId` renders subject identity and hash, policy basis by label and key, required/recorded/qualifying counts, decisions as a semantic list without the decider's label, own reason, `myAssignment`, owner-only assignment summaries by `reviewerLabel`; actions only from `permittedNextActions`; focus to heading on navigation only; no person, actor or party identifier in text, URL or telemetry; verification per reader scope.
- Implementation: appears missing (searched: K-GOV; no definition-reviews page; sibling that is not proof: apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.tsx and apps/web/src/pages/app/cms-content-modeling/reviews/[reviewId].astro)
- Missing evidence: [GU-det] vitest (jsdom): one render per reader scope asserting visible and absent content, reason only for the decider, actions from `permittedNextActions` only, focus behaviour and an identifier scan of DOM, URL and telemetry payloads. [GE] Playwright real-route-chrome: the page for the submitter, assignee and owner.
- Size: L


## CMS-03C-11 governed review queue (GET /api/v1/cms/governed-reviews)

### P2-S12-AC-094 — unverified
- Unproven clause(s): all 3 clauses: GET /api/v1/cms/governed-reviews with strict `GovernedReviewQueueQuery`; strict `GovernedReviewQueuePage` (50 items of listed members, `nextCursor` <= 512 or null, `pageVersion`); signed keyset `(updatedAt DESC, reviewId DESC)`.
- Implementation: appears missing (searched: K-GOV; siblings that are not proof: `platform_private.cms_get_editorial_review` (supabase/migrations/20261005017880_cms_get_editorial_review.sql:121) and `cms_list_editorial_reviews` (…17890_cms_list_editorial_reviews.sql:32), apps/worker/src/cms-editorial/review-detail-routes.ts and review-queue-routes.ts)
- Missing evidence: [GC] vitest: page and item strictness and bounds. [GO] vitest: registry row, OpenAPI and route parity. [GP-rd] pgTAP: order is `(updated_at DESC, review_id DESC)` across ties.
- Size: M

### P2-S12-AC-095 — unverified
- Unproven clause(s): all 3 clauses: accepted query members (`scope` assigned default/submitted/owned, closed `state`, closed `subjectKind`, `limit` 1-50 default 25, `cursor` <= 512); other query keys, a body and mutation headers rejected; unknown scope/state/kind, out-of-range limit or malformed cursor refused with the 400/409/422 of the validation matrix (DEC-140).
- Implementation: appears missing (searched: K-GOV)
- Missing evidence: [GC] vitest: query schema; every closed enum and the limit boundary 0, 1, 50, 51. [GW] worker: unknown key, body and mutation header refusals with the DEC-140 status for each fault class. [GA-rd] real-stack spot checks.
- Size: M

### P2-S12-AC-096 — unverified
- Unproven clause(s): all 5 clauses: verified human required; `scope=assigned`, `scope=submitted` and `scope=owned` list only their own reviews; a review outside those scopes is never listed.
- Implementation: appears missing (searched: K-GOV)
- Missing evidence: [GP-rd] pgTAP: seed reviews so that each of the three scopes has one member and one non-member per caller, assert each scope returns exactly its set and the union of other callers' reviews never appears; unverified human refused. [GA-rd] real-stack parity.
- Size: M

### P2-S12-AC-097 — unverified
- Unproven clause(s): all 5 clauses: no-store mutation-free safe read; signed keyset cursor bound to the complete query and acting scope; default 25 and maximum 50; filter allowlist `scope`, `state`, `subjectKind`; read buckets 300/600, 8,000 ms deadline, Tier 1 p95 < 750 ms.
- Implementation: appears missing (searched: K-GOV)
- Missing evidence: [GW] worker: headers, allowlist, buckets and deadline. [GP-rd] pgTAP: a cursor minted under one query or acting scope is refused under another. [GA-rd] real-stack: Tier 1 sample.
- Size: M

### P2-S12-AC-098 — unverified
- Unproven clause(s): all 3 clauses: structurally malformed cursor 400; expired, tampered or foreign-bound cursor 409 `GOVERNED_REVIEW_VERSION_CONFLICT` and client restarts from the first page; session, rate, dependency and internal failures mapped under catalog `cms.03c.governed-review.v1` with no audit or outbox effect.
- Implementation: appears missing (searched: K-GOV; a sealed-cursor sibling exists in supabase/migrations/20261010161000_cms_history_sealed_cursor.sql, not proof)
- Missing evidence: [GA-rd] real-stack: malformed, expired, tampered and foreign-bound cursor cases with their statuses; a first-page restart succeeds. [GP-rd] pgTAP: audit and outbox row counts unchanged. [GW] worker mapping for 401/429/5xx.
- Size: M

### P2-S12-AC-099 — unverified
- Unproven clause(s): all 7 clauses: CmsGovernedReviewQueue scope tabs, `state` and `subjectKind` filters and signed `nextCursor` as URL state (never a protected value); row content; native links to the detail; polite count announcements; no-records versus filter-miss; cursor dropped after a cursor 409; verification per scope, filters, cursor binding, DEC-140 fault classes and never-listed-outside-scope.
- Implementation: appears missing (searched: K-GOV; sibling that is not proof: apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.tsx)
- Missing evidence: [GU-q] vitest (jsdom): tab and filter URL state, cursor handling after 409, empty-state variants, live-region text. [GE] Playwright real-route-chrome: three scopes against the real stack.
- Size: L


## CMS-03C-12 pattern version create (POST /api/v1/cms/patterns/versions)

### P2-S12-AC-100 — unverified
- Unproven clause(s): all 3 clauses: POST /api/v1/cms/patterns/versions with strict `PatternVersionRequest` (`patternKey`, `compatibleTypeIds`, `blockTree` of 1-32 root `PatternNode`s, optional digest, `expectedVersion` or null) returning strict `PatternVersionResource` (201, `draft`, `nodeCount` 1-512); OpenAPI and Hono route match the registry row.
- Implementation: appears missing (searched: K-PAT; existing foundation: `platform_private.cms_pattern_versions`, supabase/migrations/20260927290000_cms_composition_authority.sql:43, which lacks `pattern_id` lineage, `compatible_type_ids`, `node_count`, `activated_at`, `retired_at`)
- Missing evidence: [PC] vitest: request and resource strictness, 1 and 32 root nodes, 513-node refusal, `expectedVersion` null and integer. [PO-v] vitest: registry row, OpenAPI 201 and discovered route parity.
- Size: S

### P2-S12-AC-101 — unverified
- Unproven clause(s): all 6 clauses: `patternKey` grammar and reserved keys; 1-64 unique active `compatibleTypeIds` of the caller's owner scope; 1-32 root nodes with key grammar; `block` nodes with canonical BlockKey and registered non-withdrawn version; props of at most 64 keys and depth 8; `expectedVersion` null for a first version or the parent's `version`.
- Implementation: appears missing (searched: K-PAT; `cms_pattern_versions` has only the key regex, no E13 CHECK refusing the reserved keys context, versions, selector, new; sibling that is not proof: the template validation in packages/contracts/src/cms-composition/template.ts and migration 20261002210000_cms_reserved_concept_block_template_keys.sql)
- Missing evidence: [PC] vitest: boundary tests for each grammar (key regexes, 64 ids, depth 8, 64 props keys, reserved keys `context`, `versions`, `selector`, `new`). [PP-v] pgTAP: a type id from another owner or an inactive type, and a withdrawn block version, are refused; a first version needs `expectedVersion` null and a successor needs the parent's `version`.
- Size: M

### P2-S12-AC-102 — unverified
- Unproven clause(s): all 6 clauses: server-derived session and acting context; verified human with `cms.template_designer` in the caller's owner scope; hidden owner or pattern 404; readable pattern without capability 403; no step-up; response carries no owner, capability or authority identifier.
- Implementation: appears missing (searched: K-PAT; sibling that is not proof: CMS-03C-01 authority in apps/worker/src/cms-composition/template-version-routes.ts)
- Missing evidence: [PP-v] pgTAP: designer succeeds, a non-designer in the same owner party gets 403, a stranger 404; no MFA proof is required. [PA-v] real-stack apispec: same through the Worker and a scan of the 201 body for owner, capability and authority members.
- Size: M

### P2-S12-AC-103 — unverified
- Unproven clause(s): all 6 clauses: Idempotency-Key; `expectedVersion` equals parent `version` (strong If-Match) when editing and null for a new lineage; per-owner unique `(key, version)` and CAS; server-computed `blockRegistryDigest`; rate buckets 30/60, 15,000 ms deadline, no-store, Tier 2; no event.
- Implementation: appears missing (searched: K-PAT; `cms_pattern_versions` carries a global UNIQUE (pattern_key, version) at supabase/migrations/20260927290000_cms_composition_authority.sql:63 where BE03c E14 requires UNIQUE (owner_id, key, version))
- Missing evidence: [PP-v] pgTAP: two owners can hold the same `(pattern_key, version)`; a duplicate within one owner is refused; a stale parent is a CAS conflict; the stored digest equals the recomputed one even when the request carries a different digest; no outbox row. [PW] worker: 30/60 buckets, deadline, no-store, If-Match equals `expectedVersion`. [PA-v] real-stack: idempotent replay.
- Size: M

### P2-S12-AC-104 — unverified
- Unproven clause(s): all 7 clauses: 400, 401, 403, 404 `COMPOSITION_NOT_FOUND`, 409 `COMPOSITION_VERSION_CONFLICT` (stale parent, key or version, cycle, idempotency conflict), 415, 422 `COMPOSITION_VALIDATION_FAILED` (tree, props, graph, nested pattern inactive or incompatible with `details.reasonCode` `nested_pattern_not_active`), 429, 502/503/504 and 500 under catalog `cms.03c.composition.v1`; rollback leaves no pattern row.
- Implementation: appears missing (searched: K-PAT; sibling that is not proof: CMS-03C-02 mapping in apps/worker/src/cms-composition/pattern-instance-responses.ts)
- Missing evidence: [PW] worker: mapping table. [PA-v] real-stack: one real refusal per status including a two-pattern cycle and a draft nested pattern. [PP-v] pgTAP: pattern table row count unchanged after every refusal.
- Size: L

### P2-S12-AC-105 — unverified
- Unproven clause(s): all 6 clauses: CmsPatternVersionDesigner at `/app/cms-content-modeling/patterns/new` and `/patterns/:patternKey` builds `PatternVersionRequest` over a nested ordered node list (block selectors, nested `CmsPatternSelector`, content type selectors); add/remove/move-up/move-down without drag-only path; server digest, `nodeCount` and inline cycle, depth and node-count refusals with the node path; read version as `expectedVersion`; verification of keyboard operation, inline refusals, error summary links and focused result heading.
- Implementation: appears missing (searched: K-PAT; no patterns page or `cmsPatternLatestRead` route; sibling that is not proof: apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx)
- Missing evidence: [PU-des] vitest (jsdom): request built from the node tree, each control reachable and operable by keyboard, refusal text carries the node path, error summary links focus the node, focus lands on the result heading. [PE] Playwright real-route-chrome: create a pattern and a successor through the real stack.
- Size: L


## CMS-03C-13 pattern selector (GET /api/v1/cms/patterns/selector)

### P2-S12-AC-106 — unverified
- Unproven clause(s): all 3 clauses: GET /api/v1/cms/patterns/selector with strict `PatternSelectorQuery`; strict `PatternSelectorPage` (50 items of listed members, `nextCursor` <= 512, `pageVersion`); signed keyset `(patternKey ASC, patternVersion DESC)`.
- Implementation: appears missing (searched: K-PAT; sibling that is not proof: GET /api/v1/cms/templates/context at apps/web/src/pages/api/v1/cms/templates/context.ts)
- Missing evidence: [PC] vitest: query and page strictness and bounds. [PO-s] vitest: registry row, OpenAPI and route parity. [PP-s] pgTAP: order `(pattern_key ASC, version DESC)`.
- Size: S

### P2-S12-AC-107 — unverified
- Unproven clause(s): all 3 clauses: UUID `contentTypeId` of a content type in the caller's owner scope, signed `cursor` <= 512, `limit` 1-50 default 25; other keys, a body and mutation headers rejected; hidden or absent content type is the same 404.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PC] vitest: query schema and limit boundaries 0, 1, 50, 51. [PW] worker: unknown key, body and mutation header refusals. [PA-s] real-stack: another owner's content type and an absent one return byte-identical 404.
- Size: M

### P2-S12-AC-108 — unverified
- Unproven clause(s): all 4 clauses: verified human with `cms.author` or `cms.editor` in the owner party; lists only `active` pattern versions of that owner whose `compatibleTypeIds` contain the requested type; draft, non-compatible and other-owner versions never listed; no owner or authority field serialized.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PP-s] pgTAP: seed active, draft, superseded, incompatible and other-owner versions and assert only the compatible active ones are returned for an author and for an editor, and nothing for a user with neither; the page JSON has no owner or authority member. [PA-s] real-stack parity.
- Size: M

### P2-S12-AC-109 — unverified
- Unproven clause(s): all 5 clauses: no-store mutation-free safe read; signed keyset cursor bound to query and acting scope; default 25, maximum 50; ETag on the page version; read buckets 300/600, 8,000 ms deadline, Tier 1 p95 < 750 ms.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PW] worker: headers, ETag, buckets, deadline. [PP-s] pgTAP: cross-query and cross-scope cursor refusal. [PA-s] real-stack: Tier 1 sample.
- Size: M

### P2-S12-AC-110 — unverified
- Unproven clause(s): all 4 clauses: 400, 401, 403, 404, 415, 409 cursor/context mismatch, 422, 429, 5xx mapping under catalog `cms.03c.composition.v1` with no audit or outbox effect; client restarts from the first page after a cursor conflict.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PW] worker: mapping table. [PA-s] real-stack: one real response per status and a successful first-page restart after a 409. [PP-s] pgTAP: audit and outbox counts unchanged.
- Size: M

### P2-S12-AC-111 — unverified
- Unproven clause(s): all 5 clauses: CmsPatternSelector in the instance-insert form at `/app/cms-content-modeling/entries/:entryId/composition`; items for the entry's content type as a native list or select with polite count; empty state `No compatible pattern is active`; cursor in component state only; verification of active-only, order, cursor binding and empty state.
- Implementation: appears missing (searched: K-PAT; no composition page under apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/ and no instance-insert form component; the CMS-03C-02 client lives only in apps/web/src/server/cms-composition-platform-pattern.ts)
- Missing evidence: [PU-sel] vitest (jsdom): list render, polite announcement, empty state text, cursor absent from URL and storage. [PE] Playwright real-route-chrome: the selector inside the composition page.
- Size: L


## CMS-03C-14 pattern update diff (GET .../instances/{instanceId}/update-diff)

### P2-S12-AC-112 — unverified
- Unproven clause(s): all 3 clauses: GET /api/v1/cms/compositions/instances/{instanceId}/update-diff; strict `CompositionUpdateDiffResource` (instance members, `targetPatternVersion`, 128 paths of `path`/`base`/`theirs`/`yours`/`collision`, `collisionCount` 0-128, `bulkEligible`); OpenAPI and Hono route match the registry row.
- Implementation: appears missing (searched: K-PAT; foundation: `cms_composition_instances` state `pending_diff` exists at supabase/migrations/20260927290000_cms_composition_authority.sql:76 but there is no `pending_pattern_version` column)
- Missing evidence: [PC] vitest: resource strictness, 128-path and 512-character path bounds. [PO-d] vitest: registry row, OpenAPI and route parity.
- Size: S

### P2-S12-AC-113 — unverified
- Unproven clause(s): all 4 clauses: UUID path only; collision defined as local override differing from base AND the new version also changing the path; each value schema-typed and null when absent; more than 128 changed paths or 256 KiB is 422 `diff_too_large`.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PP-d] pgTAP or [PW] worker unit on the diff builder: the four combinations of override-changed and version-changed set `collision` only for both-true; 129 paths and a 256 KiB+1 value each give 422 `diff_too_large`. [PC] vitest: query-key refusal.
- Size: M

### P2-S12-AC-114 — unverified
- Unproven clause(s): all 5 clauses: assigned author or editor on the instance's revision; instance with no newer compatible `active` version answers 200 with `paths: []`, `collisionCount` 0, `bulkEligible` false, target equal to pinned; hidden or absent 404; visible without edit 403; only bounded schema-typed values and no owner or authority field.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PP-d] pgTAP: assigned author, assigned editor, unassigned member (403), stranger (404); the no-update shape exactly. [PA-d] real-stack: body scan for owner and authority members.
- Size: M

### P2-S12-AC-115 — unverified
- Unproven clause(s): all 4 clauses: no-store safe read rejecting Idempotency-Key and If-Match; strong ETag `"{instance.version}"`; 128 paths and 256 KiB bounds; read buckets 300/600, 8,000 ms deadline, Tier 1 p95 < 750 ms.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PW] worker: header refusals, ETag, buckets, deadline. [PA-d] real-stack: size-bound refusal and Tier 1 sample.
- Size: M

### P2-S12-AC-116 — unverified
- Unproven clause(s): all 4 clauses: 400, 401, 403, 404, 415, 422 `diff_too_large`, 429, 5xx mapping under catalog `cms.03c.composition.v1`; never overwrites an instance; an unanswered update leaves the instance on its pinned version.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PW] worker: mapping table. [PA-d] real-stack: one real response per status; instance row (version, pinned pattern version, props) byte-identical before and after every read.
- Size: M

### P2-S12-AC-117 — unverified
- Unproven clause(s): all 7 clauses: CmsPatternUpdateDiff three-way list per path with colliding paths marked and a keep-my-override / take-the-new-value radio pair per collision; `no-update` state; typed `diff_too_large` refusal; never keeps a diff when degraded; unanswered update leaves the instance pinned; verification of collision marking, 128-path and 256 KiB bounds, `bulkEligible` and focus on the first unanswered collision.
- Implementation: appears missing (searched: K-PAT; no composition page)
- Missing evidence: [PU-diff] vitest (jsdom): collision marking, radio pairs, no-update copy, refusal copy, degraded state, focus target. [PE] Playwright real-route-chrome against a seeded `pending_diff` instance.
- Size: L


## CMS-03C-15 pattern update accept or detach (POST /api/v1/cms/compositions/pattern-updates)

### P2-S12-AC-118 — unverified
- Unproven clause(s): all 3 clauses: POST /api/v1/cms/compositions/pattern-updates with strict discriminated `CompositionUpdateRequest` (`accept` with `targetPatternVersion`, or `detach`; 1-32 `instances` of `instanceId`, `expectedVersion`, up to 128 `choices`; entry `expectedVersion`); strict `CompositionUpdateResource` 200 with 1-32 `CompositionInstanceResource`; OpenAPI and route parity.
- Implementation: appears missing (searched: K-PAT; sibling that is not proof: CMS-03C-02 contracts in packages/contracts/src/cms-composition/pattern-instance.ts)
- Missing evidence: [PC] vitest: both variants, 0/1/32/33 instances, 128/129 choices, unknown keys. [PO-u] vitest: registry row, OpenAPI 200 and route parity.
- Size: S

### P2-S12-AC-119 — unverified
- Unproven clause(s): all 6 clauses: only `accept` or `detach`; 1-32 unique instances each with own `expectedVersion`; `targetPatternVersion` must be the latest `active` compatible version above the pinned one (422 `pattern_version_not_active`); `choices` only for a single-instance request and covering every colliding path (missing choice 422); bulk request containing a colliding instance 409 `diff_has_collisions`; strong If-Match equals the entry `expectedVersion`.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PC] vitest: uniqueness, choices-only-for-single and missing-choice cases. [PP-u] pgTAP: target equal to pinned, below latest, above latest and not-active versions; a bulk with one colliding instance is refused and applies nothing. [PA-u] real-stack: If-Match mismatch.
- Size: M

### P2-S12-AC-120 — unverified
- Unproven clause(s): all 5 clauses: assigned author or editor on each listed instance's revision; hidden or absent instance 404; visible without edit 403; instance state eligibility (`pending_diff` or active linked for accept, any linked for detach); entry and instance versions current.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PP-u] pgTAP: each instance state against both actions; one unauthorized instance in a batch of several refuses the whole batch; stale entry and stale instance versions each refused. [PA-u] real-stack parity.
- Size: M

### P2-S12-AC-121 — unverified
- Unproven clause(s): all 5 clauses: Idempotency-Key and entry-aggregate If-Match; CAS on each instance's own `version`; all-or-nothing for 1-32 instances; rate buckets 60/120, 15,000 ms deadline, no-store, Tier 2; a row appended for every adopted or detached instance.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PP-u] pgTAP: a fault on instance N of 32 leaves all 32 unchanged; appended rows exist for each adopted or detached instance and prior rows are untouched. [PW] worker: 60/120 buckets, deadline, no-store. [PA-u] real-stack idempotent replay.
- Size: M

### P2-S12-AC-122 — unverified
- Unproven clause(s): all 4 clauses: 409 `COMPOSITION_VERSION_CONFLICT` (stale entry or instance, `diff_has_collisions`, idempotency conflict); 422 (`pattern_version_not_active`, `COMPOSITION_VALIDATION_FAILED`); 400/401/403/404/415/429/5xx mapping under catalog `cms.03c.composition.v1`; overwrites nothing on any refusal.
- Implementation: appears missing (searched: K-PAT)
- Missing evidence: [PW] worker: mapping table. [PA-u] real-stack: one real response per status. [PP-u] pgTAP: instance and revision rows unchanged after every refusal.
- Size: L

### P2-S12-AC-123 — unverified
- Unproven clause(s): all 6 clauses: Accept (single, or bulk of up to 32 when none collide) and Detach commands in CmsCompositionInstanceList and CmsPatternUpdateDiff carry the entry `version` and each instance's `version`; `pending_diff` shown as Update available beside the pinned version; refetch and keep the author's choices on `diff_has_collisions` and `revision_not_editable`; never accept automatically; verification of theirs-only adoption, retained overrides, mandatory collision choices, bulk all-or-nothing, detach and focus on the first unanswered collision.
- Implementation: appears missing (searched: K-PAT; neither component exists)
- Missing evidence: [PU-list] and [PU-diff] vitest (jsdom): command bodies carry both version operands, Update available copy, refetch-with-choices-kept on the two named refusals, no automatic accept on mount. [PE] Playwright real-route-chrome: accept, bulk accept and detach against the real stack.
- Size: L


## CMS-03C-16 taxonomy version create (POST /api/v1/cms/taxonomies/versions)

### P2-S12-AC-124 — unverified
- Unproven clause(s): all 3 clauses: POST /api/v1/cms/taxonomies/versions with strict `TaxonomyVersionRequest` (`taxonomyKey`, `shape`, 1-64 `allowedTypeKeys`, 1-64 `allowedFieldKeys`, 0-6 `canonicalOverlapDomains`, `expectedVersion`) returning strict `TaxonomyVersionResource` (201 `draft`); OpenAPI and Hono route match the registry row.
- Implementation: appears missing (searched: K-TAX; foundation: `platform_private.cms_taxonomy_versions`, supabase/migrations/20260927260000_cms_taxonomy_authority.sql:6, which lacks `taxonomy_id` lineage, `canonical_overlap_domains`, `activated_at`, `retired_at`)
- Missing evidence: [XC] vitest: request and resource strictness and bounds (0 and 6 domains, 64 and 65 keys, unknown domain). [XO] vitest: registry row, OpenAPI 201 and route parity (pattern: tests/contracts/phase-02-slice-12-taxonomy-term-openapi.test.ts).
- Size: S

### P2-S12-AC-125 — unverified
- Unproven clause(s): all 7 clauses: `taxonomyKey` grammar; `shape` flat or hierarchical; unique type and field keys with the key grammar; 0-6 unique canonical domains from the six; never-reused (owner, key, version); `expectedVersion` null for first version or parent's `version`; a declared domain with no registered provider is accepted at create.
- Implementation: appears missing (searched: K-TAX)
- Missing evidence: [XC] vitest: grammar and uniqueness boundaries. [XP] pgTAP: a never-reused (owner, key, version) triple (reuse refused even after supersession); a domain whose `cms_canonical_domain_registry` provider is `unbuilt` is accepted at create. [XA] real-stack parity.
- Size: M

### P2-S12-AC-126 — unverified
- Unproven clause(s): all 6 clauses: server-derived session and acting context; verified human with `cms.taxonomy_curator` in the caller's owner scope; hidden owner or taxonomy 404; readable taxonomy without capability 403; no step-up; response carries no owner, capability or authority identifier.
- Implementation: appears missing (searched: K-TAX; sibling that is not proof: CMS-03C-03 curator authority in apps/worker/src/cms-composition/taxonomy-routes.ts, whose production port currently fails closed)
- Missing evidence: [XP] pgTAP: curator succeeds, a non-curator in the owner party gets 403, a stranger 404, no MFA required. [XA] real-stack body scan for owner, capability and authority members.
- Size: M

### P2-S12-AC-127 — unverified
- Unproven clause(s): all 5 clauses: Idempotency-Key; `expectedVersion` equals parent `version` (strong If-Match) when editing and null for a new lineage; per-owner unique (key, version) and CAS; rate buckets 30/60, 15,000 ms deadline, no-store, Tier 2; no event.
- Implementation: appears missing (searched: K-TAX; `cms_taxonomy_versions` carries a global UNIQUE (taxonomy_key, version) at supabase/migrations/20260927260000_cms_taxonomy_authority.sql:29 where BE03c E14 requires UNIQUE (owner_id, key, version))
- Missing evidence: [XP] pgTAP: two owners may share `(taxonomy_key, version)`; a duplicate within one owner is refused; stale parent is a CAS conflict; no outbox row. [XW] worker: buckets, deadline, no-store, If-Match equals `expectedVersion`. [XA] real-stack idempotent replay.
- Size: M

### P2-S12-AC-128 — unverified
- Unproven clause(s): all 7 clauses: 400, 401, 403 `TAXONOMY_FORBIDDEN`, 404, 409 `TAXONOMY_VERSION_CONFLICT`, 415, 422 `TAXONOMY_VALIDATION_FAILED`, 429, 502/503/504 `DEPENDENCY_UNAVAILABLE` and 500 under catalog `cms.03c.taxonomy.v1`; no vocabulary row after a refusal.
- Implementation: appears missing (searched: K-TAX; no catalog `cms.03c.taxonomy.v1`)
- Missing evidence: [XW] worker: mapping table. [XA] real-stack: one real response per status. [XP] pgTAP: version table unchanged after every refusal.
- Size: L

### P2-S12-AC-129 — unverified
- Unproven clause(s): all 5 clauses: CmsTaxonomyVersionDesigner at `/app/cms-content-modeling/taxonomies/new` and `/taxonomies/:taxonomyId`; builds the request from key, shape, validated tag lists and a six-domain checkbox group showing per-domain provider availability; reviewer-visible declaration summary before submit; group labels and descriptions exposed programmatically; verification of allowlist bounds, domain declaration, availability text per domain and focused result heading.
- Implementation: appears missing (searched: K-TAX; no taxonomies page; sibling that is not proof: apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx)
- Missing evidence: [XU-des] vitest (jsdom): tag-list grammar and 64-unique bounds, six checkboxes with the exact availability strings (Phase 2: `role` built, five unbuilt), summary text, `fieldset`/`legend` and `aria-describedby` wiring, focus. [XE] Playwright real-route-chrome: create and supersede a vocabulary.
- Size: L


## CMS-03C-17 taxonomy selector (GET /api/v1/cms/taxonomies/selector)

### P2-S12-AC-130 — unverified
- Unproven clause(s): all 3 clauses: GET /api/v1/cms/taxonomies/selector with strict `TaxonomySelectorQuery`; strict `TaxonomySelectorPage` (100 terms of listed members, nullable `parentId` and `label`, `nextCursor` <= 512, `pageVersion`); signed keyset `(taxonomyKey ASC, termKey ASC)`.
- Implementation: appears missing (searched: K-TAX)
- Missing evidence: [XC] vitest: query and page strictness and bounds. [XO] vitest: registry row, OpenAPI and route parity. [XP-s] pgTAP: order `(taxonomy_key ASC, term_key ASC)`.
- Size: S

### P2-S12-AC-131 — unverified
- Unproven clause(s): all 3 clauses: `typeKey` and `fieldKey` grammar, BCP 47 `locale`, signed `cursor` <= 512, `limit` 1-100 default 50; other keys, a body and mutation headers rejected; `label` null with no locale fallback when a term has no label for the requested locale.
- Implementation: appears missing (searched: K-TAX)
- Missing evidence: [XC] vitest: grammar and limit boundaries 0, 1, 100, 101. [XW] worker: unknown key, body and mutation refusals. [XP-s] pgTAP: a term with only an `en` label requested in `fr` yields `label: null`, not the `en` label.
- Size: M

### P2-S12-AC-132 — unverified
- Unproven clause(s): all 4 clauses: verified human with `cms.author` or `cms.editor` in the owner party; only `active` terms of `active` vocabularies of that owner whose allowlist names the requested type and field key, never `merged` or `deprecated`; hidden or absent vocabulary 404; no owner or authority field serialized.
- Implementation: appears missing (searched: K-TAX)
- Missing evidence: [XP-s] pgTAP: seed active, deprecated and merged terms, a draft vocabulary, an allowlist miss on type and on field, and another owner's vocabulary; assert only the qualifying active terms are listed. [XA-s] real-stack body scan.
- Size: M

### P2-S12-AC-133 — unverified
- Unproven clause(s): all 5 clauses: no-store mutation-free safe read; signed keyset cursor bound to query and acting scope; default 50, maximum 100; ETag on the page version; read buckets 300/600, 8,000 ms deadline, Tier 1 p95 < 750 ms.
- Implementation: appears missing (searched: K-TAX)
- Missing evidence: [XW] worker: headers, ETag, buckets, deadline. [XP-s] pgTAP: cross-query and cross-scope cursor refusal. [XA-s] real-stack: Tier 1 sample.
- Size: M

### P2-S12-AC-134 — unverified
- Unproven clause(s): all 3 clauses: 400, 401, 403, 404, 415, 409 cursor/context mismatch, 422, 429, 5xx mapping under catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.
- Implementation: appears missing (searched: K-TAX)
- Missing evidence: [XW] worker: mapping table. [XA-s] real-stack: one real response per status. [XP-s] pgTAP: audit and outbox counts unchanged.
- Size: M

### P2-S12-AC-135 — unverified
- Unproven clause(s): all 7 clauses: CmsTaxonomyFieldEditor inside CMS-03B-01, CMS-03B-10 and CMS-03B-11 value authoring lists active terms for the entry type and field key (label for the entry locale, else the term key), writes `{ termIds }`, shows level text for hierarchical vocabularies, announces the selection count politely, on `term_unavailable` refetches the selector and keeps the other values; verification that merged and deprecated terms are never listed and the `term_unavailable` recovery.
- Implementation: appears missing (searched: K-TAX; taxonomy fields still render the stub at apps/web/src/components/cms-editorial-fields/CmsUnavailableField.tsx:7 and apps/web/src/components/cms-editorial-fields/cms-field-value.ts:49 only decodes the value)
- Missing evidence: [XU-fld] vitest (jsdom) under apps/web/src/components/cms-editorial-fields/: list, label fallback to term key, `{ termIds }` payload, level text, live-region count, `term_unavailable` refetch keeping sibling values, and the CmsUnavailableField taxonomy stub no longer rendered. [XE] Playwright real-route-chrome in an entry edit form.
- Size: L


## CMS-03C-18 canonical taxonomy match (database-internal RPC)

### P2-S12-AC-136 — unverified
- Unproven clause(s): all 4 clauses: exactly one RPC `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)`; strict `CanonicalTaxonomyMatchRequest`; discriminated `CanonicalTaxonomyMatchResult` (`no_match`, `match`, `source_unavailable`); no browser route, proxy or client type and absent from the browser route inventory.
- Implementation: appears missing (searched: K-CAN; no `cms_canonical_domain_registry` table either)
- Missing evidence: [NC] vitest: request and result schemas (six domains, 64 candidates of 1-160 characters, all three result variants). [NP] pgTAP: the function exists once with exactly that signature (catalog query on `pg_proc`). [XO] vitest: the operation id is absent from `platformRegistrySet.routes`, the generated OpenAPI and the web route tree.
- Size: M

### P2-S12-AC-137 — unverified
- Unproven clause(s): all 4 clauses: NFC candidates compared with the domain projection after NFKC/lowercase/trim/whitespace-collapse by exact equality only; never fuzzy; one domain and at most 64 candidates per call; `source_unavailable` for an `unbuilt` provider.
- Implementation: appears missing (searched: K-CAN)
- Missing evidence: [NP] pgTAP: matrix of key, label and alias candidates with case, width-variant (NFKC), padded and doubled-space forms all matching exactly; a one-character-off candidate and a near-synonym returning `no_match`; 65 candidates and an unknown domain refused; an `unbuilt` domain returns `source_unavailable` with its `domain`.
- Size: M

### P2-S12-AC-138 — unverified
- Unproven clause(s): all 3 clauses: executable only by `cms_act_taxonomy_term` and the activation preflight (PUBLIC, anon, authenticated and every other role revoked); reads only the domain's named read-only projection, never another shard's store (DEC-100); returns only canonical id and kind.
- Implementation: appears missing (searched: K-CAN; neither named caller exists)
- Missing evidence: [NP] pgTAP: `has_function_privilege` false for PUBLIC, anon, authenticated, service_role and every other role, true only for the two definer callers; the function body reads only the named projection (catalog dependency query); result keys limited to `canonicalId` and `canonicalKind`.
- Size: M

### P2-S12-AC-139 — unverified
- Unproven clause(s): all 3 clauses: read-only, bounded to 64 candidates and one domain per call, 2,000 ms provider timeout; no insert, update, delete, audit or outbox row, so a retry is harmless.
- Implementation: appears missing (searched: K-CAN)
- Missing evidence: [NP] pgTAP: row counts of the editorial, audit and outbox tables identical before and after calls (match, no_match, source_unavailable); repeated call gives the same result; provider timeout of 2,000 ms asserted with a deliberately slow provider stub (a documented pg_sleep fixture).
- Size: M

### P2-S12-AC-140 — unverified
- Unproven clause(s): all 3 clauses: provider fault or timeout is 503 `DEPENDENCY_UNAVAILABLE` for the calling command with no editorial write; typed `source_unavailable` (never `no_match`) for an unbuilt domain so the caller refuses `canonical_source_unavailable`; never a success-shaped body on a fault.
- Implementation: appears missing (searched: K-CAN; the CMS-03C-03 production `actTerm` at apps/worker/src/cms-composition-production-taxonomy.ts:55 returns `unavailable('cms_composition')` for every request, which is a fail-closed stub and not provider-fault handling)
- Missing evidence: [NP] pgTAP: injected provider fault and timeout raise a typed error that the calling command maps to 503 and rolls back (assert no term, audit or outbox row); an unbuilt domain returns `source_unavailable`. [XA] real-stack: term action against an unbuilt declared domain refuses `canonical_source_unavailable` and against a faulting provider answers 503.
- Size: M

### P2-S12-AC-141 — unverified
- Unproven clause(s): all 6 clauses: consumed only by `cms_act_taxonomy_term` (create, rename, alias) and the taxonomy-version activation preflight; verification of match/no_match/source_unavailable per domain, exact equality after normalization, the `role` provider reading the Shard 02 role facet assertion projection, provider-fault 503 with no editorial write, and absence of the RPC from browser routes and generated OpenAPI.
- Implementation: appears missing (searched: K-CAN; neither caller exists; the Shard 02 table `platform_private.role_facet_assertion` exists at supabase/migrations/20260901030000_party_identity_aliases.sql:66 but no named read-only projection or `role` provider over it exists)
- Missing evidence: [NP] pgTAP: six-domain matrix (role built, the other five unbuilt) for each caller path; `role` matches an asserted role facet and does not match an unasserted one. [XO] vitest: absence from browser routes and generated OpenAPI. A dependency scan test that only the two callers reference the RPC.
- Size: L


## CMS-03C-19 governed activation execution (Worker sweep, two RPCs)

### P2-S12-AC-142 — unverified
- Unproven clause(s): all 4 clauses: exactly two RPCs run by the Worker `scheduled` sweep as BE00 job type `cms.governed_activation.execute`: `cms_claim_due_governed_activations(batch)` (integer 1-100, strict `ClaimedGovernedActivation` records) and `cms_execute_governed_activation(schedule_id, expected_version, lease_id)` returning strict `GovernedActivationExecutionResult` (`completed`, `blocked`, `failed_retryable`, `already_completed`); neither is a browser route, proxy or client type.
- Implementation: appears missing (searched: K-ACT, K-CAN; sibling that is not proof: `cms.publication_schedule.execute` at packages/contracts/src/cms-editorial/jobs.ts:12, `platform_private.cms_claim_due_publication_schedules` at supabase/migrations/20261005017730_cms_claim_due_publication_schedules.sql:223 and apps/worker/src/cms-publication-schedule-sweep.ts)
- Missing evidence: [JC] vitest: job-type constant and the two strict result schemas (batch 0 and 101 refused). [JP] pgTAP: both functions exist once with the stated signatures, claim returns at most `batch` records with a lease, a second concurrent claim returns disjoint records (SKIP LOCKED), execute returns each of the four outcomes with `reasonCode`, `actualUtc`, `deviationSeconds`. [JW] worker: the scheduled sweep calls the claim then execute and is wired in apps/worker/src/index.ts (sibling test: apps/worker/src/cms-publication-schedule-sweep-wiring.test.ts). [XO] vitest: absence from browser routes.
- Size: L


## Totals

(a) Counts: verified 0, partial 0, unverified 71 (AC-072 to AC-142). Size of the missing evidence once the operations exist: S 9, M 38, L 24.

(b) Criteria whose implementation appears entirely missing: all 71. No operation, route, contract schema, RPC, job type or component of CMS-03C-07..19 exists. Partial foundations (tables only, with the column gaps listed above) exist for AC-100..105 (`cms_pattern_versions`), AC-112..117 (`cms_composition_instances`) and AC-124..129 (`cms_taxonomy_versions`); none of the behaviours these rows describe is implemented on them.

(c) Cited tests believed failing or skipped: none, because nothing is cited. No `skip`, `todo`, `fixme` or `xit` exists in apps/worker/src/cms-composition*, apps/web/src/components/cms-composition, packages/contracts/src/cms-composition, tests/postgrest/cms-*, tests/e2e/phase-02-slice-12-* or supabase/tests/phase_02_slice_12_*.sql. Siblings the next author may be tempted to cite and must not: Slice 11 CMS-03B-06/18 tests (editorial reviews, different tables and routes), Slice 09 `cms_*_schema_review` tests, the CMS-03C-03 term-action tests (the production port is a fail-closed stub).

Recommended order for the orchestrator: build step 1 of the build order first, since it is the shared infrastructure of AC-072..099 (28 rows) and AC-142, then steps 2 to 5.
