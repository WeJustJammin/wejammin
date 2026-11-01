# Slice 12 evidence ledger gap report, AC-001 to AC-071 (lane A)

Worktree HEAD verified: ddda7d58c4a2af8e593f36e6e4ef16fe97017c74 (branch claude/phase2-slice12). Ledger fragment: tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts. Nothing was executed: no test, pnpm, vitest, playwright, node script or database command ran; every citation title was copied from source by a static parser and every status below is a reading of the source, not a run result.

Reading guide. Verified entries are listed at the end. For each other criterion the section names the uncited clauses (verbatim; an unverified criterion is unproven as a whole), where the implementation lives or what was searched when it appears missing, the evidence to add, and a size. Findings that repeat across criteria:

- NO COMPOSED TEST for any CMS-03C operation. There is no `tests/postgrest/*.apispec.ts` (Worker to Kong/PostgREST to database) for CMS-03C-01, -02, -03, -04 or -05. Every Worker test stubs the port or mocks fetch; every pgTAP case calls the RPC with a hand-built request; the three Slice 12 Playwright specs run against an in-memory fixture (`tests/e2e/support/cms-template-fixture.ts`, `content-schema-registry-api.ts`). The Slice 09 request-shape sweep `tests/postgrest/cms-rpc-request-shape.apispec.ts` covers CMS-03A only. The only real-stack calls of cms_define_template and cms_author_locale_variant are the SEC-1 claim-gate probes (tests/postgrest/support/claim-gate-fixtures-cms.ts), which send a fabricated request and expect the refusal. Two apispecs (template, locale) would close the happy-path, resource-shape and replay clauses of AC004-AC009 and AC054-AC057.
- NON-CATALOG DEPENDENCY CODES. BE03c maps 502/503/504 to `DEPENDENCY_UNAVAILABLE` (reconciled 2026-10-02, DEC-172, DEC-179), but all five routes still emit `DEPENDENCY_INVALID_RESPONSE` (502) and `DEPENDENCY_DEADLINE_EXCEEDED` (504) (apps/worker/src/cms-composition/template-shared.ts:108, pattern-instance-contracts.ts:12, taxonomy-contracts.ts:12, locale-routes-support.ts:18, related-content-response.ts:5), the web relay and the browser mapper accept the same names, and the existing tests assert them. Affects AC008, AC014, AC020, AC057, AC062. One mechanical change plus test edits.
- SPEC RULES WITH NO IMPLEMENTATION (grep of apps, packages, supabase and tests finds nothing): `key_reserved` (E13), per-owner uniqueness (E14), audience grammar `^[a-z0-9_-]{1,48}$` (E4), `revision_not_editable`, `pattern_version_not_active`, `pattern_incompatible`, `pattern_cycle`, `taxonomy_not_active`, `canonical_source_unavailable`, `related_target_ineligible`, `derived_rule_unknown`, `locale_limit_reached`, `staleFieldIds`, `PatternPlacementResource`, `subject_not_submittable`.
- Production ports that refuse every request with 503 after admission: taxonomy term action (apps/worker/src/cms-composition-production-taxonomy.ts:55), related-content rule (cms-composition-production-related.ts:56). The pattern placement port calls an RPC that is not deployed (cms-composition-production-pattern.ts:144, `cms_insert_pattern_instance`). The governed-review machinery (CMS-03C-06 to -11, -19) does not exist at all.

### P2-S12-AC-001 — partial
- Unproven clause(s): "and accessibility contracts in templates."
- Implementation: present for regions, block compatibility, locale and audience: supabase/migrations/20260927200000_cms_template_authority.sql:36 (cms_template_manifest_valid) and :360 (cms_define_template), 20260927230000_cms_template_manifest_block_validation.sql and 20260927240000_cms_template_digest_supported_lifecycle.sql (block compatibility and supported lifecycle). appears missing for accessibility contracts in templates (block records carry an accessibility contract, supabase/migrations/20260902080000_content_schema_registry_authority.sql:886-953, but cms_template_manifest_valid, the template tables and cms_template_block_digest neither store nor compare one; searched: supabase/migrations/2026092*, 20261002*, packages/contracts/src/cms-composition/template.ts)
- Missing evidence: Decide what 'preserve accessibility contracts in templates' means in the spec (the BE03c text gives no field), then add a pgTAP case to phase_02_slice_12_template_authority.sql: register a block whose accessibility contract is stricter than another, build a template slot allowing it, and assert the stored template/digest changes or a refusal when the contract is dropped. If the owner rules it is satisfied by the block digest, add one assertion that the digest changes when only the block accessibility contract changes.
- Size: S (<1h)

### P2-S12-AC-002 — partial
- Unproven clause(s): "Reject cyclic or over-limit composition trees"
- Implementation: appears missing for rejection (searched: supabase/migrations/20260927290000_cms_composition_authority.sql, 20260927300000_cms_composition_path_and_tree_bounds.sql, 20260927500000_cms_composition_instance_guards.sql, 20261005018060_cms_composition_instance_guards_derived_state.sql, apps/worker/src/cms-composition/). present only as table guards: cms_pattern_tree_keys_valid (20260927300000_cms_composition_path_and_tree_bounds.sql:14-49, depth 8 / 262144 bytes via cms_json_bounded); immutability of pattern versions: 20260927290000_cms_composition_authority.sql:134-155 (cms_pattern_versions_lifecycle_guard)
- Missing evidence: pgTAP in phase_02_slice_12_composition_instance_guards.sql (or a new phase_02_slice_12_pattern_tree_bounds.sql): insert a cms_pattern_versions row with a block_tree deeper than 8 and with more than 512 nodes and a composition parent chain that loops, and assert each is refused; then a CMS-03C-12 create test for pattern_cycle once that RPC exists. Today only the acyclic control insert exists.
- Size: M (1-4h)

### P2-S12-AC-003 — partial
- Unproven clause(s): "assignments convergent"
- Implementation: present for keys, acyclicity, survivors and redirects as table guards: supabase/migrations/20260927380000_cms_taxonomy_hierarchy_cycle_guard.sql, 20260927390000 (merged parent), 20260927400000/20260927410000 (successor guards), 20260927460000_cms_taxonomy_stable_term_key.sql, 20260927480000_cms_taxonomy_assignment_field_owner.sql. appears missing for assignment convergence and for the driving command (no cms_act_taxonomy_term; searched supabase/migrations, apps/worker/src)
- Missing evidence: pgTAP in phase_02_slice_12_taxonomy_link_integrity.sql: after a merge, re-assign an already-merged term to a revision field twice (and concurrently through two dblink sessions) and assert exactly one assignment version converges on the survivor with the old id resolved; plus the same through the CMS-03C-03 apispec once the action RPC exists.
- Size: M (1-4h)

### P2-S12-AC-004 — partial
- Unproven clause(s): "and complete the declared happy path"
- Implementation: present: Worker route apps/worker/src/cms-composition/template-routes.ts:36 (createCmsTemplateApp) and template-version-routes.ts; production RPC adapter apps/worker/src/cms-composition-production.ts:176-290 (defineTemplate); RPC supabase/migrations/20260927200000_cms_template_authority.sql:360 (platform_private.cms_define_template; manifest check cms_template_manifest_valid at :36, latest redefinition in 20261002210000_cms_reserved_concept_block_template_keys.sql; platform_api wrapper redefined in 20261003120410_content_rpc_flag_restore.sql:66); registry row packages/contracts/src/platform-registries.ts:1761
- Missing evidence: tests/postgrest/phase-02-slice-12-template-version.apispec.ts (vitest, postgrest config; model: tests/postgrest/cms-editorial-composition.apispec.ts and cms-idempotency-mismatch.apispec.ts). Seed an owner with cms.template_designer and an active content type, then POST /api/v1/cms/templates/versions through the production Worker over Kong/PostgREST: assert 201, the strict TemplateVersionResource, a strong ETag "1", cache-control no-store, exactly one cms_template_versions row, one audit event and no outbox event; then a successor with If-Match "1" answering 201 with ETag "2". Parse the real body with TemplateVersionResourceSchema.
- Size: M (1-4h)

### P2-S12-AC-005 — partial
- Unproven clause(s): "and every invalid request value"
- Implementation: present: Worker route apps/worker/src/cms-composition/template-routes.ts:36, production adapter apps/worker/src/cms-composition-production.ts:176, RPC supabase/migrations/20260927200000_cms_template_authority.sql:360 (full file list under AC004); E13/E4 not implemented (searched: packages/contracts/src/cms-composition/template.ts:18-20 and :106-110, supabase/migrations/20261002210000_cms_reserved_concept_block_template_keys.sql:124-129)
- Missing evidence: Implement the reserved template keys (context, versions, new) in CmsTemplateKeySchema and a SQL CHECK and the audience grammar ^[a-z0-9_-]{1,48}$ in SafeAudienceSchema and cms_template_manifest_valid, then add rejectedAt cases in packages/contracts/src/cms-composition/template.test.ts (path /templateKey with reasonCode key_reserved; /audience for 'Members', ' public', 49 characters) and pgTAP refusals in phase_02_slice_12_template_authority.sql plus the apispec above asserting the 422 body pointer for one value that passes Zod but fails SQL.
- Size: M (1-4h)

### P2-S12-AC-006 — partial
- Unproven clause(s): "and 404 boundary."
- Implementation: present: Worker route apps/worker/src/cms-composition/template-routes.ts:36, production adapter apps/worker/src/cms-composition-production.ts:176, RPC supabase/migrations/20260927200000_cms_template_authority.sql:360 (full file list under AC004) (404 path: cms_define_template raises NOT_FOUND for an absent or foreign-owner parent at supabase/migrations/20260927200000_cms_template_authority.sql:457-458)
- Missing evidence: pgTAP in phase_02_slice_12_template_authority.sql: with a second owner holding template 'other-owner-template', call cms_define_template as the first owner with expectedVersion '1' and ifMatch '1' for that key and assert NOT_FOUND (concealed, identical to an absent key) and no row written; add the same case to the apispec above asserting 404 TEMPLATE_NOT_FOUND with empty details.
- Size: S (<1h)

### P2-S12-AC-008 — partial
- Unproven clause(s): "timeout"
- Implementation: present: Worker route apps/worker/src/cms-composition/template-routes.ts:36, production adapter apps/worker/src/cms-composition-production.ts:176, RPC supabase/migrations/20260927200000_cms_template_authority.sql:360 (full file list under AC004); non-catalog 502/504 names at apps/worker/src/cms-composition/template-shared.ts:108-122; also apps/web/src/server/cms-composition-platform-mutation.ts and apps/web/src/components/cms-composition/cms-template-designer-submit.ts
- Missing evidence: Change ERROR_CODES (502 and 504) to DEPENDENCY_UNAVAILABLE in template-shared.ts, the web relay and the browser submit mapper, update the stale tests (template-routes.test.ts it.each rows 502/504 and the 'treats malformed dependency envelopes as 502' case, cms-composition-platform-mutation-*.test.ts, cms-template-designer-submit.test.ts 'accepts only BE03c %i %s as a typed refusal'), and add cases asserting 502, 503 and 504 all answer DEPENDENCY_UNAVAILABLE with the catalog message. Same change for the pattern, taxonomy, locale and related-content routes (see AC014, AC020, AC057, AC062).
- Size: M (1-4h)

### P2-S12-AC-010 — partial
- Unproven clause(s): "and success contracts" "and complete the declared happy path" "CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 PatternPlacementResource."
- Implementation: partial: route apps/worker/src/cms-composition/pattern-instance-routes.ts:278; contracts packages/contracts/src/cms-composition/pattern-instance.ts:38-78 (single-row CompositionInstanceResourceSchema); registry row packages/contracts/src/platform-registries.ts:1784 (successSchema CompositionInstanceResourceSchema); web proxy apps/web/src/pages/api/v1/cms/compositions/pattern-instances.ts. appears missing: PatternPlacementResource and the items list (searched: packages/contracts, apps/worker, apps/web, supabase for PatternPlacement), and the RPC cms_insert_pattern_instance (apps/worker/src/cms-composition-production-pattern.ts:144 calls it; no migration defines it)
- Missing evidence: Contract first: add PatternPlacementResourceSchema (items of 1..512 rows, DEC-175/DEC-181) and change the registry row, with a packages/contracts/src/cms-composition/pattern-instance.test.ts case and a tests/contracts/phase-02-slice-12-pattern-openapi.test.ts mirroring the template one; then the RPC in a new migration with pgTAP supabase/tests/phase_02_slice_12_pattern_placement.sql and an apispec tests/postgrest/phase-02-slice-12-pattern-placement.apispec.ts asserting 201 with one row per block root.
- Size: L (>4h)

### P2-S12-AC-011 — partial
- Unproven clause(s): "and every invalid request value" "with the exact stable field violation"
- Implementation: partial: contract packages/contracts/src/cms-composition/pattern-instance.ts:38-78, route pattern-instance-routes.ts. appears missing: the semantic checks (searched supabase/migrations for revision_not_editable, pattern_version_not_active, pattern_incompatible; none) and the RPC
- Missing evidence: Extend pattern-instance.test.ts to assert exact violation pointers and codes (not only .success false), add a route case asserting the 422 body details.violations for an override depth of 9, and, once the RPC exists, pgTAP asserting each refusal writes nothing (row-count and audit/outbox unchanged).
- Size: M (1-4h)

### P2-S12-AC-012 — partial
- Unproven clause(s): "scope" "and 404 boundary."
- Implementation: partial: apps/worker/src/cms-composition-production-pattern.ts; table RLS and grants supabase/migrations/20260927290000_cms_composition_authority.sql. appears missing: the assignment and concealed 404/403 decision (no RPC)
- Missing evidence: pgTAP in the new phase_02_slice_12_pattern_placement.sql: author with an edit assignment on the draft revision succeeds; author without assignment on a visible revision is FORBIDDEN (403); a hidden revision is NOT_FOUND identical to an absent one; plus the apispec asserting 401/403/404 over the real stack.
- Size: M (1-4h)

### P2-S12-AC-013 — partial
- Unproven clause(s): "CMS-03C-02: enforce declared idempotency" "If-Match or CAS" "duplicate, replay" "and concurrency rules."
- Implementation: appears missing for the database half (searched: supabase/migrations/*pattern*, cms_insert_pattern_instance). present for Worker rate, deadline, no-store and query refusal: pattern-instance-routes.ts:278, pattern-instance-contracts.ts
- Missing evidence: pgTAP and apispec for cms_insert_pattern_instance: exact-key replay returns the identical body and writes nothing, same key with another body is 409 IDEMPOTENCY_MISMATCH, stale entry version is 409, duplicate revision/path is 409, and two concurrent writers (race runner under infra/database-races or a dblink pgTAP) leave exactly one winner.
- Size: L (>4h)

### P2-S12-AC-014 — partial
- Unproven clause(s): "timeout"
- Implementation: partial: apps/worker/src/cms-composition/pattern-instance-contracts.ts:12-26 (ERROR_CODES with the non-catalog 502/504 names), apps/worker/src/cms-composition-production-pattern.ts. appears missing: the RPC that raises the domain failures
- Missing evidence: Same ERROR_CODES change as AC008 for pattern-instance-contracts.ts and web apps/web/src/server/cms-composition-platform-pattern.ts, with the stale deadline/502 assertions in pattern-instance-boundary.test.ts and cms-composition-platform-pattern.test.ts updated; plus apispec cases for 409 cycle/slot/CAS and 422 graph once the RPC exists.
- Size: M (1-4h)

### P2-S12-AC-015 — partial
- Unproven clause(s): "CMS-03C-02: commit audit and outbox effects atomically where applicable" "reconcile lost responses without duplicate effects"
- Implementation: appears missing (searched: supabase/migrations for a pattern placement audit action, cms.composition outbox type; none). Worker telemetry present: apps/worker/src/cms-composition-production-pattern.ts (emit) with test 'emits a redacted operational telemetry event'
- Missing evidence: pgTAP asserting one audit record and (if the spec's event table names one) one outbox row in the placement transaction, a refused placement writing neither, and a same-key replay adding no second effect; apispec for a lost response replay.
- Size: M (1-4h)

### P2-S12-AC-016 — partial
- Unproven clause(s): "and complete the declared happy path"
- Implementation: partial: contracts packages/contracts/src/cms-composition/taxonomy-term.ts; route apps/worker/src/cms-composition/taxonomy-routes.ts:281; registry packages/contracts/src/platform-registries.ts:1809. appears missing: cms_act_taxonomy_term RPC and canonical overlap provider (apps/worker/src/cms-composition-production-taxonomy.ts:55 returns unavailable; searched supabase/migrations for cms_act_taxonomy_term, cms_canonical_taxonomy_match; none), and a web page route (apps/web/src/pages/api/v1/cms/taxonomies/ does not exist)
- Missing evidence: Build the RPC and the web proxy, then tests/postgrest/phase-02-slice-12-taxonomy-term-action.apispec.ts asserting 200 TaxonomyTermResource, ETag and one term version written for create/rename/alias/deprecate/merge.
- Size: L (>4h)

### P2-S12-AC-017 — partial
- Unproven clause(s): "and every invalid request value" "with the exact stable field violation"
- Implementation: partial: taxonomy-routes.ts:281 and taxonomy-contracts.ts; semantic rules appear missing (searched supabase/migrations for taxonomy_not_active; none)
- Missing evidence: Route test asserting exact violation pointer and code for each contract rule (termKey, labels NFC, aliases, survivorId), pgTAP and apispec for taxonomy_not_active, a parentId under a flat shape and a self/cyclic/merged survivor each answering a pointed 422/409 with nothing written.
- Size: M (1-4h)

### P2-S12-AC-018 — partial
- Unproven clause(s): "scope" "and 404 boundary."
- Implementation: partial: taxonomy-routes.ts:281; table RLS supabase/migrations/20260927260000_cms_taxonomy_authority.sql and 20260927270000_cms_taxonomy_private_guard_privileges.sql. appears missing: the database decision (no RPC)
- Missing evidence: pgTAP and apispec: curator of vocabulary A acting on vocabulary B is 403, a hidden vocabulary or term is the same 404 as an absent one, a member without the capability is 403, no session is 401.
- Size: M (1-4h)

### P2-S12-AC-019 — partial
- Unproven clause(s): "CMS-03C-03: enforce declared idempotency" "If-Match or CAS" "replay" "and concurrency rules."
- Implementation: partial: Worker rate/deadline/no-store in taxonomy-routes.ts:281; table-level unique key and version columns in 20260927260000_cms_taxonomy_authority.sql. appears missing: term lock, CAS, replay (no RPC)
- Missing evidence: pgTAP and apispec for the action RPC: stale If-Match is 409 and writes nothing, exact replay returns the same body, same key with another body is 409, two concurrent merges of one term leave one winner (race runner or dblink).
- Size: L (>4h)

### P2-S12-AC-020 — partial
- Unproven clause(s): "timeout" "and preserve safe recovery."
- Implementation: partial: apps/worker/src/cms-composition/taxonomy-contracts.ts:12-26 (non-catalog 502/504 names); production boundary apps/worker/src/cms-composition-production-taxonomy.ts:55. appears missing: the domain failures' producer (no RPC)
- Missing evidence: ERROR_CODES change as AC008 plus apispec cases for each declared domain failure (409 term/merge/CAS/idempotency, 422 canonical_source_unavailable with details.domain) once the RPC exists, and a safe-recovery assertion (details carry only expectedVersion/currentVersion).
- Size: M (1-4h)

### P2-S12-AC-021 — partial
- Unproven clause(s): "CMS-03C-03: commit audit and outbox effects atomically where applicable" "reconcile lost responses without duplicate effects"
- Implementation: appears missing (searched: supabase/migrations for cms.taxonomy.changed.v1 producer and a taxonomy audit action; none)
- Missing evidence: pgTAP: a committed term action writes one audit record and one cms.taxonomy.changed.v1 outbox event in the same transaction, a refused action neither, a same-key replay no second effect; production-binding telemetry redaction test in apps/worker/src/cms-composition-production-taxonomy.test.ts.
- Size: M (1-4h)

### P2-S12-AC-022 — partial
- Unproven clause(s): "not a reserved key (`context`, `versions`, `new`)"
- Implementation: present: Worker route apps/worker/src/cms-composition/template-routes.ts:36, production adapter apps/worker/src/cms-composition-production.ts:176, RPC supabase/migrations/20260927200000_cms_template_authority.sql:360 (full file list under AC004); global uniqueness at 20260927200000_cms_template_authority.sql:178; reserved-key list supabase/migrations/20260902080000_content_schema_registry_authority.sql:228 (cms_reserved_key)
- Missing evidence: Implement E13 and E14 (forward migration: UNIQUE (owner_id, template_key, version), template_id lineage column, owner-scoped previous-row lookup in cms_define_template at :448-463 which currently reads other owners' rows and leaks existence as CONFLICT), then pgTAP asserting a second owner can define the same key, a reserved key is refused with reasonCode key_reserved, and contract rejectedAt cases for context/versions/new in template.test.ts.
- Size: M (1-4h)

### P2-S12-AC-023 — partial
- Unproven clause(s): "each active/allowlisted ContentTypeVersion family"
- Implementation: present: supabase/migrations/20260927200000_cms_template_authority.sql:425-437 (active type, active version and owner scope)
- Missing evidence: Two pgTAP cases in phase_02_slice_12_template_authority.sql: a content type whose state is not active (or whose version is not active) and a content type owned by another party each answer VALIDATION_FAILED and leave no row.
- Size: S (<1h)

### P2-S12-AC-025 — partial
- Unproven clause(s): "audience `^[a-z0-9_-]{1,48}$` matched as submitted and never trimmed"
- Implementation: present for bindings and locale; audience grammar appears missing: packages/contracts/src/cms-composition/template.ts:106-110 and supabase/migrations/20261002210000_cms_reserved_concept_block_template_keys.sql:126-129 implement the old rule
- Missing evidence: Change SafeAudienceSchema and the SQL check to ^[a-z0-9_-]{1,48}$ matched as submitted, then template.test.ts rejectedAt cases ('Public', ' public', 'public ', 49 characters) and a pgTAP refusal.
- Size: S (<1h)

### P2-S12-AC-026 — partial
- Unproven clause(s): "`revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller" "`patternId` a lineage id of the caller's owner scope" "400/404."
- Implementation: partial: contract packages/contracts/src/cms-composition/pattern-instance.ts:38-48; table guard supabase/migrations/20260927500000_cms_composition_instance_guards.sql. appears missing: revision_not_editable rule and the patternId lineage (cms_pattern_versions has no pattern_id column: 20260927290000_cms_composition_authority.sql:43-62)
- Missing evidence: Migration adding the lineage id, then pgTAP/apispec: submitted or non-current revision answers 409 revision_not_editable, an unreadable revision 404, a patternId from another owner 404, malformed ids 400.
- Size: L (>4h)

### P2-S12-AC-027 — partial
- Unproven clause(s): "naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`)" "422."
- Implementation: appears missing (searched: supabase/migrations/*pattern*, apps/worker/src/cms-composition/ for pattern_version_not_active, pattern_incompatible, compatible_type_ids on patterns; none)
- Missing evidence: Needs CMS-03C-12 and CMS-03C-09 first (an active, compatible PatternVersion); then pgTAP and apispec for an inactive version (422 pattern_version_not_active) and an incompatible content type (422 pattern_incompatible).
- Size: L (>4h)

### P2-S12-AC-028 — partial
- Unproven clause(s): "Enforce CMS-03C-02: slotPath/overrides; normalized"
- Implementation: partial: packages/contracts/src/cms-composition/pattern-instance.ts:15-35 (hasSafeSlotPath, PatternOverridesSchema). appears missing: path normalization and node-path override keys (DEC-175)
- Missing evidence: Contract tests with exact pointers for '/a//b', '/a/./b', trailing slash and an override key that names no node of the pinned tree; the node-tree check belongs to the RPC (pgTAP).
- Size: M (1-4h)

### P2-S12-AC-029 — unverified
- Unproven clause(s): the whole criterion (Enforce CMS-03C-02: graph; no cycles; max protected depth/nodes; all blocks registered and compatible; 409/422.)
- Implementation: appears missing (searched: supabase/migrations, apps/worker/src, packages/contracts for pattern graph validation; only cms_pattern_tree_keys_valid at 20260927300000_cms_composition_path_and_tree_bounds.sql:14 checks block-key grammar)
- Missing evidence: Implement the graph validator in the placement/create RPCs, then pgTAP: cycle through a nested lineage is 409 pattern_cycle, depth 9 and 513 nodes are 422, an unregistered or incompatible nested block is 422, each leaving no row.
- Size: L (>4h)

### P2-S12-AC-030 — partial
- Unproven clause(s): "(the vocabulary lineage id); the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`)" "`parentId` other than null requires shape `hierarchical`"
- Implementation: partial: packages/contracts/src/cms-composition/taxonomy-term.ts:28-50. appears missing: active-version and shape rules (no RPC; cms_taxonomy_versions stores state and shape at 20260927260000_cms_taxonomy_authority.sql:6-35)
- Missing evidence: pgTAP/apispec: action against a vocabulary with no active TaxonomyVersion is 409 taxonomy_not_active; a parentId under shape flat is 422 with pointer /parentId; the lineage id question (taxonomyId is a version-row id today) resolved in the spec first.
- Size: M (1-4h)

### P2-S12-AC-032 — partial
- Unproven clause(s): "422/409."
- Implementation: partial: table guards supabase/migrations/20260927380000, 20260927390000, 20260927400000, 20260927410000 (taxonomy); Zod rule taxonomy-term.ts:39-50. appears missing: 422/409 mapping through an action RPC
- Missing evidence: apispec through the action route: a self survivor, a cyclic parent and an already-merged survivor each answer the specified 422 (pointer /survivorId or /parentId) or 409 with nothing written.
- Size: M (1-4h)

### P2-S12-AC-033 — partial
- Unproven clause(s): "source revision must exist and be readable"
- Implementation: present: RPC supabase/migrations/20261002167000_cms_locale_author_active_configuration.sql:12 (cms_author_locale_variant); route apps/worker/src/cms-composition/locale-routes.ts:292
- Missing evidence: pgTAP in phase_02_slice_12_locale_author_rpc.sql: a sourceRevisionId that does not exist, belongs to another entry, or is hidden from the caller answers NOT_FOUND with no row written; the route maps it to 404 LOCALE_SOURCE_NOT_FOUND (apispec).
- Size: S (<1h)

### P2-S12-AC-036 — partial
- Unproven clause(s): "exclusions win" "every pin is an eligible target and every exclusion an existing readable entry" "and an ineligible, hidden or absent target is the one uniform 422 `related_target_ineligible`"
- Implementation: partial: packages/contracts/src/cms-composition/related-content.ts:16-32; route apps/worker/src/cms-composition/related-content-routes.ts:274. appears missing: eligibility and the uniform refusal (searched for related_target_ineligible; none) and the RPC (apps/worker/src/cms-composition-production-related.ts:56 returns unavailable)
- Missing evidence: Specify and build cms_curate_related_content and CMS-03C-21; then pgTAP/apispec: an ineligible, hidden or absent pin and exclusion are the same 422 related_target_ineligible at /pins/{n} or /exclusions/{n}; exclusions win in the public-target projection.
- Size: L (>4h)

### P2-S12-AC-037 — partial
- Unproven clause(s): "`key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value" "(an unknown key or version is 422 `derived_rule_unknown`)"
- Implementation: partial: packages/contracts/src/cms-composition/related-content.ts:13-15 and :41-52 (RuleKeySchema is a regex, not the registry). appears missing: the code-owned rule registry and derived_rule_unknown
- Missing evidence: Add the registry (shared-terms, same-type-recent with registered versions and reasonCode) in contracts and the RPC; tests: unknown key/version is 422 derived_rule_unknown at /derivedRule/key, a wrong reasonCode is refused, in related-content.test.ts and pgTAP.
- Size: M (1-4h)

### P2-S12-AC-038 — partial
- Unproven clause(s): "400/409." "The related-content public-target projection CMS-03C-21 (BE03c ledger 25.05.04) is owned here with the CMS-03C-05 command."
- Implementation: partial: related-content.ts (expectedVersion) and related-content-routes.ts. appears missing: CAS on the source entry (no RPC) and CMS-03C-21 platform_private.cms_related_content_public_targets (searched supabase/migrations; none)
- Missing evidence: pgTAP for the rule RPC: stale source-entry version is 409 and writes nothing; pgTAP for cms_related_content_public_targets returning at most 128 ordered public targets and dropping an unpublished or private target.
- Size: L (>4h)

### P2-S12-AC-039 — partial
- Unproven clause(s): "Enforce All"
- Implementation: present for CMS-03C-01..05 (each route's admission); appears missing for CMS-03C-06..17 and the supporting reads (no routes)
- Missing evidence: As each remaining route lands, add its admission cases (415 non-JSON, 400 short/long Idempotency-Key, 422 unknown key, body over 262,144 bytes) to its route test; add one boundary test at exactly 262,144 and 262,145 bytes in a shared test.
- Size: M (1-4h)

### P2-S12-AC-040 — partial
- Unproven clause(s): "implement locked behavior and completion exactly. Operations: CMS-03C-06 (governed review submit), CMS-03C-07 (decision), CMS-03C-08 (reviewer assignment), CMS-03C-09 (activation), CMS-03C-10 (review detail), CMS-03C-11 (review queue) and CMS-03C-19 (governed scheduled-activation executor), BE03 ..."
- Implementation: partial: CMS-03C-01 present (see AC004). appears missing: CMS-03C-06..11 and CMS-03C-19 entirely (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, cms_governed_review; none)
- Missing evidence: Whole governed-review machinery (BE03c 'Governed review machinery'); evidence per AC064-AC071 plus activation and executor tests (race runner for the executor claim, pgTAP for activation switch, apispec for the queue).
- Size: L (>4h)

### P2-S12-AC-041 — partial
- Unproven clause(s): "and cascade."
- Implementation: partial: CMS-03C-01 flows present (file list under AC004); cascade appears missing: no activation, retirement or supersession path exists for templates (CMS-03C-09 absent)
- Missing evidence: pgTAP and apispec once CMS-03C-09 exists: revoking cms.template_designer between form load and submit answers 403 and keeps the unsent values client-side (Playwright), a withdrawn template referenced by a binding cascades as the spec states, with the exact post-state asserted.
- Size: L (>4h)

### P2-S12-AC-042 — partial
- Unproven clause(s): "focus stays until navigation or named result heading" "Render authoritative response/version/provenance/next action" "scoped draft before commit"
- Implementation: present: web components apps/web/src/components/cms-composition/CmsTemplateDesigner.tsx, CmsTemplateEditDesigner.tsx, CmsTemplateStatus.tsx (status copy and link), pages apps/web/src/pages/app/cms-content-modeling/templates/*.astro. appears missing: provenance in the success view, named-result-heading focus after success, a scoped unsent draft store
- Missing evidence: Extend tests/e2e/phase-02-slice-12-template-real-route.spec.ts: after success assert focus on the result heading (or stays on the control until navigation), the success view names the parent version, and an unsent value survives a reload from the scoped draft; and one run of the same flow against the Supabase-backed Worker (not tests/e2e/support/cms-template-fixture.ts).
- Size: M (1-4h)

### P2-S12-AC-043 — partial
- Unproven clause(s): "CMS-12 Use reusable pattern: given Actor may edit the target entry revision" "and readable" "and the resulting block tree stays acyclic within the protected depth and count limits." "implement locked behavior and completion exactly. Operations: CMS-03C-12 (pattern version create), CMS-03C-13 (pattern selector), CMS-03C-14 (update diff) and CMS-03C-15 (pattern update), BE03c ledger 25.03.03."
- Implementation: partial: pattern tables supabase/migrations/20260927290000_cms_composition_authority.sql:43-110 (immutability guard). appears missing: CMS-03C-12..15 (searched apps, packages, supabase for pattern version create, patterns/selector, update-diff, pattern-updates; none)
- Missing evidence: Build the four operations; evidence per operation as for CMS-03C-01 (contract, route, RPC pgTAP, apispec).
- Size: L (>4h)

### P2-S12-AC-044 — unverified
- Unproven clause(s): the whole criterion (CMS-12 Use reusable pattern: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.)
- Implementation: appears missing (no CMS-12 operation beyond the undeployed CMS-03C-02 route)
- Missing evidence: Failure/recovery matrix tests per operation once built: invalid authority, stale CAS, revoked capability, deleted/withdrawn pattern version, cascade to instances.
- Size: L (>4h)

### P2-S12-AC-045 — unverified
- Unproven clause(s): the whole criterion (`CMS-12` Use reusable pattern: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capabil ...)
- Implementation: appears missing (searched apps/web/src for CmsPattern*, pattern selector, update diff; none)
- Missing evidence: Component/DOM tests and a Playwright real-route spec for the pattern selector, placement form and diff view covering each listed interaction clause.
- Size: L (>4h)

### P2-S12-AC-046 — partial
- Unproven clause(s): "CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary" "canonical-taxonomy overlap has been checked" "implement locked behavior and completion exactly. Operations: CMS-03C-16 (taxonomy version create), CMS-03C-17 (taxonomy selector) and CMS-03C-18 (canonical-taxonomy overlap provider), BE03c ledger 25.05.01."
- Implementation: partial: term guards supabase/migrations/20260927380000..20260927410000. appears missing: CMS-03C-16 (taxonomy version create), CMS-03C-17 (selector), CMS-03C-18 (platform_private.cms_canonical_taxonomy_match) and the per-vocabulary curator check (searched; none)
- Missing evidence: Build the three operations; pgTAP for cms_canonical_taxonomy_match (bounded to 64 candidates, 2,000 ms provider fault is 503) and the apispec for taxonomy create and selector.
- Size: L (>4h)

### P2-S12-AC-047 — unverified
- Unproven clause(s): the whole criterion (CMS-14 Govern taxonomy term: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.)
- Implementation: appears missing (term action RPC and CMS-03C-16..18 absent)
- Missing evidence: Failure/recovery matrix tests per operation once built.
- Size: L (>4h)

### P2-S12-AC-048 — unverified
- Unproven clause(s): the whole criterion (`CMS-14` Govern taxonomy term: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capabil ...)
- Implementation: appears missing (no vocabulary page, term form or selector under apps/web/src)
- Missing evidence: Component/DOM tests and Playwright real-route spec for the CMS-14 surface.
- Size: L (>4h)

### P2-S12-AC-049 — unverified
- Unproven clause(s): the whole criterion (Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation.)
- Implementation: not applicable to code
- Missing evidence: A closeout test of the Slice 11 kind (tests/contracts/phase-02-slice-12-closeout.test.ts) plus retained RED evidence and a canonical pnpm validate at the closing commit; verify only at close.
- Size: S (<1h)

### P2-S12-AC-050 — unverified
- Unproven clause(s): the whole criterion (Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation bounda ...)
- Implementation: not applicable to code; fail-closed stubs without BOUNDARY markers at apps/worker/src/cms-composition-production-taxonomy.ts:55, cms-composition-production-related.ts:56 and cms-composition-production-pattern.ts:144
- Missing evidence: Closeout test (tracker gate lines, feature-ledger 25.03.02/25.03.03/25.05.01-25.05.04, runbooks, architecture graph) and either implement the stubs or give each a BOUNDARY comment, tracking issue and sentinel test per .claude/rules/boundary-not-placeholder.md.
- Size: M (1-4h)

### P2-S12-AC-051 — unverified
- Unproven clause(s): the whole criterion (Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale, ...)
- Implementation: appears missing (searched supabase/migrations, apps, packages for cms_resolve_locale_field, cms.locale.no_fallback_gate, cms_no_fallback_block_total; none)
- Missing evidence: Build CMS-03C-20; pgTAP: a no_fallback field is never resolved through fallbackChains, a missing target-locale value blocks the locale preflight, the counter increments once; plus the publication preflight integration test (apispec) refusing publication.
- Size: L (>4h)

### P2-S12-AC-052 — unverified
- Unproven clause(s): the whole criterion (Keep serving the last approved translation for a stale fallback-permitted locale field after its source changes (never resolving it through the fallback cha ...)
- Implementation: partial mechanics only: stale transition supabase/migrations/20260927450000_cms_locale_source_stale.sql; appears missing: resolver, staleFieldIds (packages/contracts/src/cms-composition/locale-variant.ts:79-91), cms_locale_stale_total
- Missing evidence: Build CMS-03C-20 and the editorial read; pgTAP: a stale fallback-permitted field keeps its last approved value and is reported stale, no_fallback missing value blocks; metric assertion.
- Size: L (>4h)

### P2-S12-AC-054 — partial
- Unproven clause(s): "as 201 (`state` one of `untranslated`, `draft`, `review`, `approved`, `stale`; `entryId`, `revisionId`, `locale`, `sourceRevisionId`, `fallbackChain`, `noFallbackFieldIds` and `staleFieldIds`, which is empty unless `state` is `stale`)"
- Implementation: present: contract packages/contracts/src/cms-composition/locale-variant.ts:79-91 (no staleFieldIds); RPC supabase/migrations/20261002167000_cms_locale_author_active_configuration.sql:12-330 (response built at :315, state always draft); route apps/worker/src/cms-composition/locale-routes.ts:292
- Missing evidence: Add staleFieldIds to LocaleVariantResourceSchema and the RPC response and the derived variant states; add tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts: POST through the production Worker and PostgREST, parse the real body with LocaleVariantResourceSchema, assert 201, ETag, rows written.
- Size: M (1-4h)

### P2-S12-AC-055 — partial
- Unproven clause(s): "on a source revision the caller can read" "locale or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`" "and the operation never borrows another jurisdiction's text."
- Implementation: present: RPC (as AC054), route locale-routes.ts:292, production adapter apps/worker/src/cms-composition-production-locale.ts:199
- Missing evidence: pgTAP: absent/foreign/unreadable source revision and unsupported-locale path are NOT_FOUND; a test that no field value of another locale variant is copied (fields absent from the request are not filled); apispec asserting 403 vs 404 split.
- Size: S (<1h)

### P2-S12-AC-056 — partial
- Unproven clause(s): "enforces a unique entry, locale and source revision" "the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets" "answers a changed actor, body, path or version under the same key with 409."
- Implementation: present: as AC054; unique key/version indexes supabase/migrations/20260927310000_cms_locale_related_authority.sql:5-48
- Missing evidence: pgTAP: a second variant for the same entry, locale and source revision is a 409 LOCALE_VERSION_CONFLICT duplicate; same key with a changed body/path/version/actor is 409 (IDEMPOTENCY_MISMATCH, as phase_02_slice_12_template_authority.sql does for templates); a benchmark case in the style of phase_02_slice_09_evidence_bench128.sql for p95 < 1,200 ms and RPC < 300 ms.
- Size: M (1-4h)

### P2-S12-AC-057 — partial
- Unproven clause(s): "a schema or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`)"
- Implementation: present: apps/worker/src/cms-composition/locale-routes-support.ts:18-32 (non-catalog 502/504 names)
- Missing evidence: ERROR_CODES change as AC008 for the locale route, its production adapter (cms-composition-production-locale.ts) and apps/web/src/server/cms-composition-platform-locale.ts, with locale-routes.test.ts, cms-composition-production-locale.test.ts and cms-composition-platform-locale.test.ts updated; pgTAP for a duplicate locale and an absent source revision as the producers of the 404/409 tokens.
- Size: M (1-4h)

### P2-S12-AC-058 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-04 is consumed by the protected `CmsLocaleVariantForm` at `/app/cms-content-modeling/entries/:entryId/locales/:locale`, which offers only localizabl ...)
- Implementation: appears missing (searched apps/web/src for CmsLocaleVariantForm and the page /app/cms-content-modeling/entries/[entryId]/locales/[locale]; only the same-origin proxy apps/web/src/pages/api/v1/cms/entries/[entryId]/locales/[locale]/variants.ts exists)
- Missing evidence: Build the form and page and the protected version-detail read; component tests for per-field resolution, the no_fallback rule, derived states, both fixed 409 messages, the 403/404 split and focus, plus a Playwright real-route spec.
- Size: L (>4h)

### P2-S12-AC-059 — partial
- Unproven clause(s): "as 201 (`state` `active` or `revoked`, `sourceEntryId`, `pins`, `exclusions`, `derivedRule` of `key` and `version` or null, and `eligibleCount` 0-128);"
- Implementation: present: contracts related-content.ts, route related-content-routes.ts:274, registry row platform-registries.ts:1883. appears missing: a producer of the 201 (apps/worker/src/cms-composition-production-related.ts:56 returns unavailable; no cms_curate_related_content migration)
- Missing evidence: After the RPC: apispec asserting 201 and the real RelatedContentResource (state, pins, exclusions, derivedRule, eligibleCount computed 0-128).
- Size: L (>4h)

### P2-S12-AC-060 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-05 serves only an assigned CMS author or editor who can edit the source entry: a hidden source or target is 404 `RELATED_CONTENT_NOT_FOUND`, a visib ...)
- Implementation: appears missing (no related-content RPC; table only supabase/migrations/20260927310000_cms_locale_related_authority.sql:50)
- Missing evidence: pgTAP and apispec: assigned author/editor succeeds, visible source without edit assignment is 403 RELATED_CONTENT_FORBIDDEN, hidden source/target 404, a pinned target the caller cannot read is refused uniformly and the stored rule exposes no authority.
- Size: L (>4h)

### P2-S12-AC-061 — partial
- Unproven clause(s): "applies CAS on the source entry" "no-store and Tier 2" "and emits no event of its own (it consumes `cms.publication.changed.v1` for invalidation)."
- Implementation: partial: Worker apps/worker/src/cms-composition/related-content-routes.ts:274; append-only table 20260927310000_cms_locale_related_authority.sql:50. appears missing: CAS, event assertion (no RPC)
- Missing evidence: pgTAP: stale source-entry version 409, unique pin/exclusion targets enforced in SQL, rows appended not updated, no outbox event emitted; latency benchmark for Tier 2.
- Size: L (>4h)

### P2-S12-AC-062 — partial
- Unproven clause(s): "a target projection or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`)" "commits no mutation on unresolved target authorization" "and lets a target that later becomes private or unpublished drop out of the public projection while the rule history stays private."
- Implementation: partial: apps/worker/src/cms-composition/related-content-response.ts:5-18 (non-catalog 502/504 names)
- Missing evidence: ERROR_CODES change as AC008 for related-content, plus the no-mutation-on-unresolved-authorization and public-projection drop-out cases once CMS-03C-21 exists.
- Size: M (1-4h)

### P2-S12-AC-063 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-05 is consumed by the protected `CmsRelatedContentForm`, which builds `RelatedContentRuleRequest` from an ordered pin list with move controls (no dr ...)
- Implementation: appears missing (no CmsRelatedContentForm; only proxy apps/web/src/pages/api/v1/cms/entries/[entryId]/related-content.ts)
- Missing evidence: Build the form and page; component tests for pin/exclusion bounds, move controls, derived rule registry, uniform refusal message, 403/404 split, focus; Playwright real-route spec.
- Size: L (>4h)

### P2-S12-AC-064 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-06 registers POST /api/v1/cms/governed-reviews with the strict `GovernedReviewSubmissionRequest` (`subjectKind`, `subjectId`, `subjectHash`) and ret ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text)
- Missing evidence: Contracts + registry row + OpenAPI test, the route and tests, tables and submit RPC with pgTAP, and an apispec asserting the 201 body and contentHash (JCS SHA-256).
- Size: L (>4h)

### P2-S12-AC-065 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-06 accepts only a closed `subjectKind`, a `subjectId` that is the exact version row id in the caller's owner scope and a `subjectHash` of 64 lowerca ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text)
- Missing evidence: pgTAP for the submit validation: closed subjectKind, wrong subjectHash 422 /subjectHash, non-draft or live-review 409 subject_not_submittable, unbuilt canonical domain 422 canonical_source_unavailable, partial unique index.
- Size: M (1-4h)

### P2-S12-AC-066 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-06 derives session and acting context server-side and serves only a holder of the subject kind's owner capability in the subject's owner party (`cms ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text)
- Missing evidence: pgTAP and apispec: designer/curator submits, member without capability 403 capability_missing, hidden subject 404, submitted_by server-derived, no step-up required, no identifiers in the body.
- Size: M (1-4h)

### P2-S12-AC-067 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-06 requires an `Idempotency-Key` and no `If-Match`, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and the Ti ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text)
- Missing evidence: pgTAP for the transaction (freeze hash/policy basis/block digest, open review + dependency rows, subject to review, audit, no event) and a rate/deadline route test at 30/60 per minute.
- Size: M (1-4h)

### P2-S12-AC-068 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-06 maps malformed IDs, header or body (400), a missing session (401), a missing capability (403), a hidden or absent subject (404), `subject_not_sub ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text)
- Missing evidence: Route test for the full error catalog cms.03c.governed-review.v1 plus pgTAP asserting no write on any refusal and 503 for NULL workflow-policy evidence.
- Size: M (1-4h)

### P2-S12-AC-069 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern and vocabulary pages, which shows the subject version's lifecycle ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text); no CmsGovernedReviewPanel
- Missing evidence: Component tests and Playwright for each subject kind, subject_not_submittable, one live review per version, the 403/404 split and focus.
- Size: L (>4h)

### P2-S12-AC-070 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-07 registers POST /api/v1/cms/governed-reviews/{reviewId}/decision with the strict `GovernedDecisionRequest` (`reviewId`, `decision` `approve` or `r ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text)
- Missing evidence: Contracts (GovernedDecisionRequest, unknown capability/stepUpAt keys are 422), registry row, OpenAPI test, route with unconditional step-up, decision RPC with pgTAP and apispec.
- Size: L (>4h)

### P2-S12-AC-071 — unverified
- Unproven clause(s): the whole criterion (CMS-03C-07 requires the path `reviewId` to equal the body `reviewId`, `decision` `approve` or `reject`, a `reason` of 1-2000 code points in NFC with no cont ...)
- Implementation: appears missing (searched apps, packages, supabase, tests for governed-reviews, GovernedReview, governed_review, cms_governed; only ledger and tracker text)
- Missing evidence: Contract tests with exact pointers for reason grammar (1-2000 code points, NFC, no control/line/paragraph separator/bidi, no <>{}), path/body reviewId equality and If-Match equals expectedVersion; reuse the 03b SafeText helper if it exports one.
- Size: M (1-4h)

## Summary

(a) Counts: verified 7, partial 44, unverified 20 (of 71; no contract-only).

Verified: AC-007, AC-009, AC-024, AC-031, AC-034, AC-035, AC-053. These carry no limitation, but see the first reading-guide bullet: they rest on RPC-level pgTAP plus stubbed Worker tests, not on a composed apispec.

(b) Criteria whose implementation appears entirely missing (no route, RPC or table beyond bare storage): AC-029, AC-044, AC-045, AC-047, AC-048, AC-051, AC-058, AC-060, AC-063, AC-064, AC-065, AC-066, AC-067, AC-068, AC-069, AC-070, AC-071. AC052 has only the source-change stale transition (pgTAP phase_02_slice_12_locale_source_stale.sql); its resolver, read and metric are missing. Also entirely missing but inside partial criteria: AC040 (CMS-03C-06..11, -19), AC043 (CMS-03C-12..15), AC046 (CMS-03C-16..18). AC049 and AC050 are closeout criteria with no Slice 12 closeout test.

(c) Cited tests believed to fail or be skipped: none found by reading. There is no `.skip`, `.todo`, `.fixme` or duplicated title in any of the 57 cited files (checked statically; an `it.each` title that cannot be resolved statically is never cited). No run was made, so none is known to pass either. Environment risks: `phase_02_slice_12_template_authority.sql` opens a dblink session to `host=db port=5432` for the lock probe, which depends on the local stack hostname; the three Slice 12 Playwright specs (tests/e2e/phase-02-slice-12-template-real-route.spec.ts, -template-uncertain-real-route.spec.ts, -locale-real-route.spec.ts) are `testIgnore`d in playwright.config.ts and run only under playwright.s09-real.config.ts, project `real-route-chrome` (the ledger cites the first two with that project; the locale spec, a fetch-only route test, and tests/e2e/phase-02-slice-12-template-edit.spec.ts, project `chrome`, are not cited); the cited Slice 09 pgTAP files (p240_identity, p241_dec123_successor_binding, dec108_resolver, template_compat_guard) are long fixtures and add runtime to the evidence run.

Formatting note: the fragment was written to match the prettier layout of the Slice 10 and 11 ledgers (single quotes, `title:` and `limitation:` broken after the colon when over 80 columns) but prettier was not run; run `pnpm exec prettier --write tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts` before the guard.
