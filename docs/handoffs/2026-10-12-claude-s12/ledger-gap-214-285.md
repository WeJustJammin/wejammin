# Slice 12 evidence ledger gap report, lane D (P2-S12-AC-214 to AC-285)

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `ddda7d58c4a2af8e593f36e6e4ef16fe97017c74`. Fragment: `tests/contracts/phase-02-slice-12-evidence-ledger-214-285.ts`. Nothing was run (no tests, no pnpm, no database); every citation title was copied from source and re-matched against the file by a text extractor, not by a test run.

Reading guide: most of AC-214 to AC-285 describe behaviour that is not built (Slice 12 governed review, pattern update, term actions, related-content rules, per-field locale staleness, preflight providers, carry-over, the pages). `unverified` with the missing implementation named is the honest result for them. Only database invariants, the locale authoring RPC (CMS-03C-04) and Worker boundary tests exist, and they were cited only where their assertions produce the condition the clause names. Where a clause is only partly proven the caveat is written into the limitation. Citations mix pgTAP and Worker/contract unit tests; no real-stack (Worker + PostgREST + database) test exists for CMS-03C-02..05, so none is cited.

### P2-S12-AC-214 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Pattern update `accept`: for each listed instance a path changed only by the new version adopts it, a local override on a path the new version did not change is retained, every collision takes the explicit `yours` or `theirs` choice, and..."
- Implementation: appears missing (searched supabase/migrations, apps/worker/src, apps/web/src and packages/contracts/src for cms_apply_pattern_update, cms_get_instance_update_diff, pending_pattern_version, linked_update_scan and CMS-03C-14/15; only the `pending_diff` state value exists, supabase/migrations/20260927290000_cms_composition_authority.sql:76)
- Missing evidence: Add pgTAP supabase/tests/phase_02_slice_12_pattern_update_accept.sql driving cms_apply_pattern_update(accept) on pending_diff instances: a path changed only by the new version adopts it, a local override on a path the new version left unchanged is retained, every collision needs an explicit `yours` or `theirs` choice (missing choice refused `diff_has_collisions`), and an `active` row pinned to the target pattern version is appended. Add an apispec test through Worker + PostgREST for CMS-03C-15 success.
- Size: L (>4h)

### P2-S12-AC-215 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Pattern update `detach`: the command appends a `detached` row that materializes the instance's current effective content (the pinned tree plus its overrides) as local props and stops the instance receiving updates, and it is admitted for..."
- Implementation: appears missing (searched supabase/migrations, apps/worker/src, apps/web/src and packages/contracts/src for cms_apply_pattern_update, cms_get_instance_update_diff, pending_pattern_version, linked_update_scan and CMS-03C-14/15; only the `pending_diff` state value exists, supabase/migrations/20260927290000_cms_composition_authority.sql:76)
- Missing evidence: Add pgTAP supabase/tests/phase_02_slice_12_pattern_update_detach.sql: detach appends a `detached` row whose props equal the pinned tree plus its overrides, a later pattern activation and linked-update scan leave that instance untouched, and detach is admitted for any linked instance (states `active` and `pending_diff`, with and without collisions). Add an apispec success test.
- Size: M (1-4h)

### P2-S12-AC-216 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Pattern insertion target: CMS-03C-02 inserts only on the entry's current draft revision (effective state `draft` per E2, else 409 `revision_not_editable`) that the caller can read (patterns apply to entry revisions only, DEC-176), and `p..."
- Implementation: partial scaffolding only: table guard supabase/migrations/20260927500000_cms_composition_instance_guards.sql:51 (non-draft target is VALIDATION_FAILED, no current-draft test); route apps/worker/src/cms-composition/pattern-instance-routes.ts:51 and adapter apps/worker/src/cms-composition-production-pattern.ts:144 call the undeployed cms_insert_pattern_instance (fails closed 503). The RPC, DEC-176 owner-scope lineage check and 409 revision_not_editable are missing.
- Missing evidence: Add pgTAP for cms_insert_pattern_instance: a submitted, superseded or non-current revision is 409 revision_not_editable, an unreadable revision is concealed, a patternId from another owner scope is refused; add an apispec test for the 409 through Worker + PostgREST; update the pattern-instance contract test if the request stops carrying a caller revisionId (DEC-176).
- Size: M (1-4h)

### P2-S12-AC-217 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Pattern insertion version: the named pattern version must be `active` and its `compatibleTypeIds` must list the revision's content type, else 422 `pattern_version_not_active` or `pattern_incompatible`."
- Implementation: appears missing (searched supabase/migrations for compatible_type_ids on cms_pattern_versions, pattern_version_not_active, pattern_incompatible; the column exists only on template versions, supabase/migrations/20260927200000_cms_template_authority.sql)
- Missing evidence: Add pgTAP: a draft, review, superseded or retired pattern version is 422 `pattern_version_not_active`; an active version whose compatibleTypeIds omits the revision content type is 422 `pattern_incompatible`; a listed content type is accepted. Add a Worker catalog test for both 422 reason codes.
- Size: M (1-4h)

### P2-S12-AC-218 — partial
- Unproven clause(s): "Pattern insertion rows (DEC-175, DEC-181): the request `slotPath` must exist in the revision's template (or be a root path when the entry has no template);" "a top-level nested pattern reference (`kind: pattern`) in the pinned forest is expanded at placement into that pattern's own block roots, recursively, so every row carries a block;" "one placement writes one append-only row per block root of the pinned pattern version's forest after that expansion, one or more rows (at most 512, the node cap after expansion) in one transaction and all-or-nothing, and answers 201 `PatternPlacementResource`, an `items` list of one or more `CompositionInstanceResource`;" "each row stays pinned to the placed `(patternId, patternVersion)`, carries its block root's block identity in `block_key` and `block_version` with that root's `key` as the suffix of its `path`, keeps the nodes below a block root inside the pinned tree and stores the server-recomputed digest, the link mode and the `overrides` that lie under its root;" "`overrides` keys are normalized node paths under the inserted root (`/{nodeKey}(/{nodeKey})*`, at most 512 characters) that each name a node of the pinned tree, any other key being 422 `COMPOSITION_VALIDATION_FAILED` at `/overrides`;" "and an override collision produces `pending_diff` and never overwrites."
- Implementation: appears missing; the contract is the pre-DEC-181 single-row shape (packages/contracts/src/cms-composition/pattern-instance.ts: caller revisionId, overrides record of up to 64 keys of up to 128 characters, CompositionInstanceResourceSchema with no PatternPlacementResource or items); cms_composition_instances has no overrides column (supabase/migrations/20260927290000_cms_composition_authority.sql:72); the unique index is at :115.
- Missing evidence: Contracts: vitest for PatternPlacementResource (1..512 items) and the /overrides key grammar (`/{nodeKey}(/{nodeKey})*`, at most 512 characters, 422 COMPOSITION_VALIDATION_FAILED). pgTAP supabase/tests/phase_02_slice_12_pattern_insert.sql: nested-pattern expansion, 512-row cap, all-or-nothing rollback, per-row block_key/block_version/path suffix/digest/link mode/overrides, duplicate (revision_id, path) at the same version refused, override collision becomes pending_diff without overwrite. apispec for the 201 items body.
- Size: L (>4h)

### P2-S12-AC-219 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Composition write effect: every composition write (CMS-03C-02, which appends one row per block root (DEC-181), CMS-03C-15, the linked-update scan and the revision-append carry-over) appends a row, never changes the revision's `contentHas..."
- Implementation: appears missing (searched supabase/migrations for composition writers; the Slice 11 recheck only reacts to events, supabase/migrations/20261010164100_cms_dependency_recheck.sql)
- Missing evidence: Add pgTAP: for each writer (CMS-03C-02, CMS-03C-15, linked-update scan, revision-append carry-over) assert one appended composition row, the revision payload hash unchanged, and the revision live editorial review invalidated in the same transaction (reason `dependency_changed` for CMS-03C-02).
- Size: M (1-4h)

### P2-S12-AC-220 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Vocabulary model: a vocabulary is identified by its stable lineage id `taxonomyId`, a TaxonomyVersion is the reviewed rule set (shape, allowlists and declared canonical overlap domains), and the terms belong to the vocabulary, so `cms_te..."
- Implementation: appears missing (cms_terms is keyed by taxonomy_version_id, supabase/migrations/20260927260000_cms_taxonomy_authority.sql:37-62, plus UNIQUE (taxonomy_version_id, term_key) in 20260927460000_cms_taxonomy_stable_term_key.sql; no taxonomy_id anywhere in supabase/migrations; no cms_create_taxonomy_version)
- Missing evidence: Add a forward migration moving terms to the lineage id and pgTAP: cms_terms.taxonomy_id and UNIQUE (taxonomy_id, term_key, version) present, the old unique gone, a successor taxonomy version creates no duplicate or re-keyed term, term ids unchanged across versions and merges.
- Size: L (>4h)

### P2-S12-AC-221 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Term action preconditions: CMS-03C-03 runs under the vocabulary's `active` TaxonomyVersion (no active version is 409 `taxonomy_not_active`), `parentId` other than null requires shape `hierarchical`, and assigning a term to a field requir..."
- Implementation: appears missing (searched supabase/migrations for cms_act_taxonomy_term; apps/worker/src/cms-composition-production-taxonomy.ts:55 returns unavailable); the route boundary exists at apps/worker/src/cms-composition/taxonomy-routes.ts:52 with a port-stubbed test only
- Missing evidence: Add pgTAP for cms_act_taxonomy_term: no active TaxonomyVersion is 409 `taxonomy_not_active`, parentId on a flat vocabulary is refused, assigning a term to a field requires the active version to list the entry content type key and the field key; apispec for the 409.
- Size: M (1-4h)

### P2-S12-AC-222 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Canonical overlap (DEC-135): the overlap check runs only against the `canonicalOverlapDomains` declared by the vocabulary's active version, so for `create`, `rename` and `alias` over a declared built domain a `match` from CMS-03C-18 refu..."
- Implementation: appears missing (searched supabase, apps, packages for cms_canonical_taxonomy_match, canonical_overlap, canonicalOverlapDomains, cms_canonical_domain_registry)
- Missing evidence: Add pgTAP with a seeded built `role` provider row: create, rename and alias over a declared domain with a match are 422 TAXONOMY_VALIDATION_FAILED `canonical_overlap` with details.domain and details.canonicalId and no row written; merge and deprecate run no check; a vocabulary declaring no domain is never checked.
- Size: L (>4h)

### P2-S12-AC-223 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Unbuilt canonical domain (DEC-135): a declared domain whose provider is `unbuilt` is refused with the typed `canonical_source_unavailable` carrying `details.domain` at taxonomy-version activation and, defensively, at every `create`, `ren..."
- Implementation: appears missing (searched supabase, apps, packages for canonical_source_unavailable, cms_canonical_domain_registry, provider_state)
- Missing evidence: Add pgTAP: a declared domain whose provider is `unbuilt` is refused `canonical_source_unavailable` with details.domain at activation and at create, rename and alias; a provider fault or timeout is 503 DEPENDENCY_UNAVAILABLE and writes nothing (Worker catalog test for the 503).
- Size: M (1-4h)

### P2-S12-AC-224 — partial
- Unproven clause(s): "Term actions: `create` inserts a term with lifecycle `active` and its first labels, `rename` appends a new label version and never changes the key, `alias` appends an alias, `deprecate` moves the term to `deprecated` (still resolvable, not newly assignable)," "(a replacement creates a new version)."
- Implementation: tables and guards present: supabase/migrations/20260927260000_cms_taxonomy_authority.sql:37-92 (cms_terms, cms_term_labels), 20260927280000_cms_term_cas_lifecycle_guard.sql:6 (cms_terms_lifecycle_guard, merged never reactivates); the action RPC cms_act_taxonomy_term is missing and the Worker adapter fails closed (apps/worker/src/cms-composition-production-taxonomy.ts:55).
- Missing evidence: Add pgTAP for cms_act_taxonomy_term: create yields lifecycle `active` plus first labels; rename appends a label version and leaves term_key unchanged; alias appends an alias; deprecate yields `deprecated` (resolvable, not newly assignable); a replacement label is a new version. apispec for the 200 resource.
- Size: L (>4h)

### P2-S12-AC-225 — partial
- Unproven clause(s): "Term merge: `merge` locks the survivor and the retired term (`FOR UPDATE` in id order)," "requires a survivor that is `active` or `deprecated` and a retired term that is not already `merged`," "sets the retired term `merged` with its `successor_id`,"
- Implementation: partial: guard supabase/migrations/20260927400000_cms_taxonomy_successor_guard.sql:46-52 refuses any survivor that is not `active` (AC-225 also allows `deprecated`) and locks the taxonomy version row (line 40), not the two term rows in id order; lifecycle guard 20260927280000_cms_term_cas_lifecycle_guard.sql:6. The merge command is missing.
- Missing evidence: Add pgTAP for the merge action: deprecated survivor accepted, already-merged retired term refused, merged term stores successor_id, both rows locked FOR UPDATE in id order (add a race runner under infra/database-races for two opposing merges); relax the successor guard to admit `deprecated`.
- Size: M (1-4h)

### P2-S12-AC-226 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Term merge convergence: `merge` re-points every `active` TermAssignment of the retired term to the survivor by appending superseding assignment versions, converging up to 5,000 assignments in the same transaction and continuing a larger ..."
- Implementation: appears missing (searched supabase, apps, packages for merge_converge, converge, taxonomy job handlers; cms_term_assignments exists, supabase/migrations/20260927260000_cms_taxonomy_authority.sql:94)
- Missing evidence: Add pgTAP and a Worker job test: merge re-points every active assignment by appending superseding versions, converges up to 5,000 in the same transaction, a larger set continues through cms.taxonomy.merge_converge from a durable cursor (jobs row bound to the actor and acting party), and the retired id resolves to the survivor throughout.
- Size: L (>4h)

### P2-S12-AC-227 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Related-content targets (D11): a pin target must exist, differ from the source, have lifecycle `active`, belong to the same owner party as the source and be readable by the caller under the draft-read predicate, an exclusion target must ..."
- Implementation: appears missing (searched supabase, apps, packages for cms_curate_related_content, related_target_ineligible, derived_rule_unknown; the HTTP boundary exists at apps/worker/src/cms-composition/related-content-routes.ts:52 and the production adapter fails closed, apps/worker/src/cms-composition-production-related.ts:56)
- Missing evidence: Add pgTAP for cms_curate_related_content: pin eligibility matrix (absent, source itself, non-active, other owner, unreadable under the draft-read predicate) and exclusion rule (exists and readable only), each refused with one uniform 422 RELATED_CONTENT_VALIDATION_FAILED `related_target_ineligible` at /pins/{n} or /exclusions/{n} with byte-identical bodies; apispec through Worker + PostgREST.
- Size: L (>4h)

### P2-S12-AC-228 — partial
- Unproven clause(s): "a request replaces the whole rule set (pins in array order as `position`, exclusions and the derived rule) by appending `revoked` rows for removed items and `active` rows for new ones," "the strong `If-Match` is the source entry `version`," "pin and exclude rows require one."
- Implementation: table present: supabase/migrations/20260927310000_cms_locale_related_authority.sql:50-78 (append-only versions, mode CHECK at :68); the replacing RPC is missing. appears missing (searched supabase, apps, packages for cms_curate_related_content, related_target_ineligible, derived_rule_unknown; the HTTP boundary exists at apps/worker/src/cms-composition/related-content-routes.ts:52 and the production adapter fails closed, apps/worker/src/cms-composition-production-related.ts:56)
- Missing evidence: Add pgTAP: a pin or exclude insert without a target is 23514; cms_curate_related_content replaces the whole set (pins in array order as position, revoked rows for removed items, active rows for new ones) and CAS-checks If-Match against the source entry version; apispec for the stale If-Match.
- Size: L (>4h)

### P2-S12-AC-229 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Derived-rule registry (OD-5): the code-owned registry `CMS_RELATED_RULES` has `shared-terms` (reason `shared_terms`) and `same-type-recent` (reason `same_type_recent`) at version 1, a rule row selects exactly one, `derivedRule.reasonCode..."
- Implementation: appears missing (searched supabase, apps, packages for CMS_RELATED_RULES, cms_related_rule_valid, shared-terms, same-type-recent, shared_terms; packages/contracts/src/cms-composition/related-content.ts:17-19 only pattern-matches the key and reasonCode)
- Missing evidence: Add a vitest registry test (two rules at version 1 with reasons shared_terms and same_type_recent, maxCandidates 1..128, reasonCode as an equality expectation) and pgTAP for platform_private.cms_related_rule_valid plus the 422 `derived_rule_unknown` path.
- Size: M (1-4h)

### P2-S12-AC-230 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Related-content `eligibleCount`: a rule is never evaluated at write time except to compute `eligibleCount` (the eligible pins plus the derived candidates for the source revision's locale and the audience of the source's most recent activ..."
- Implementation: appears missing (searched supabase, apps, packages for cms_curate_related_content, related_target_ineligible, derived_rule_unknown; the HTTP boundary exists at apps/worker/src/cms-composition/related-content-routes.ts:52 and the production adapter fails closed, apps/worker/src/cms-composition-production-related.ts:56)
- Missing evidence: Add pgTAP: eligibleCount equals eligible pins plus derived candidates for the source revision locale and the audience of the most recent active publication, 0 derived when none, never above 128, and no rule evaluation at write time otherwise.
- Size: M (1-4h)

### P2-S12-AC-231 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Derived `shared-terms` ranking: candidates are entries of the same owner with an `active` publication head for the requested locale and audience, other than the source, not excluded and not already pinned, ranked by the number of active ..."
- Implementation: appears missing (searched supabase, apps, packages for cms_related_content_public_targets, shared-terms ranking, CMS-03C-21)
- Missing evidence: Add pgTAP over cms_related_content_public_targets with fixtures: same-owner active-head candidates for locale and audience, source/excluded/pinned removed, ranked by shared active terms descending (published revision in a public projection, draft in editorial preview), then head created_at descending, then entryId ascending.
- Size: L (>4h)

### P2-S12-AC-232 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Derived `same-type-recent` ranking: the same candidate set restricted to the source's content type is ranked by the target head's `created_at` descending then `entryId` ascending, and at most `maxCandidates` derived candidates are used."
- Implementation: appears missing (searched supabase, apps, packages for same-type-recent, cms_related_content_public_targets)
- Missing evidence: Add pgTAP: candidate set restricted to the source content type, ordered by head created_at descending then entryId ascending, truncated to maxCandidates.
- Size: M (1-4h)

### P2-S12-AC-233 — partial
- Unproven clause(s): "(`[]` exactly when `locale` is its `defaultLocale`);" "and after a successor changes the chain the new chain applies and the old chain is refused."
- Implementation: present: supabase/migrations/20261002167000_cms_locale_author_active_configuration.sql:158 (supportedLocales membership), :175-183 (active chain, `[]` for the default locale, FALLBACK_CHAIN_MISMATCH detail); Worker mapping apps/worker/src/cms-composition-production-locale.ts:70-71.
- Missing evidence: Extend supabase/tests/phase_02_slice_12_locale_config_enforcement.sql: authoring for the default locale requires `[]`; same members in another order is VERSION_MISMATCH; after a successor version changes the chain the new chain is accepted and the old one refused. Add an apispec test through Worker + PostgREST for the 409 body and the 422.
- Size: S (<1h)

### P2-S12-AC-234 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Derived locale variant state: a stored LocaleVariant row is `draft` (written by CMS-03C-04) or `stale` (appended by the source-change fan-out), while the browser `LocaleVariantState` also shows `review` and `approved`, derived from the e..."
- Implementation: appears missing (physical CHECK allows untranslated, draft, review, approved, stale, supabase/migrations/20260927310000_cms_locale_related_authority.sql:8-10; the wire enum packages/contracts/src/cms-composition/locale-variant.ts:81 lists the states but no read derives them)
- Missing evidence: Add a forward migration restricting the physical state to draft and stale and a derivation (read RPC or view) applying the 03b effective-state rule, with pgTAP for draft, stale, `submitted` shown as review, `approved` and `published` shown as approved, and untranslated when no variant exists.
- Size: M (1-4h)

### P2-S12-AC-235 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Per-field staleness: the variant records `field_source_hashes` (the source value hash of each translated field at write time), a field is stale when the current source value hash differs, `staleFieldIds` carries those fields, unchanged f..."
- Implementation: appears missing (searched supabase, apps, packages for field_source_hashes, stale_field_ids, staleFieldIds); staleness is per variant, supabase/migrations/20260927450000_cms_locale_source_stale.sql
- Missing evidence: Add pgTAP: write-time field_source_hashes per translated field, a field is stale when its current source value hash differs and staleFieldIds lists exactly those, unchanged fields keep approved state, and a CMS-03C-04 write with the current sourceHash appends a draft row that returns to approved only through the revision editorial review.
- Size: L (>4h)

### P2-S12-AC-236 — partial
- Unproven clause(s): "and a request that would create a 33rd distinct locale variant is refused 409 `LOCALE_VERSION_CONFLICT` `locale_limit_reached`."
- Implementation: present: supabase/migrations/20261005010900_cms_locale_fanout.sql:11-75 (cms_localization_fanout; p_limit must be 1..32 at :30, more dependents than p_limit is LOCALE_FANOUT_LIMIT at :73); the author RPC supabase/migrations/20261002167000_cms_locale_author_active_configuration.sql has no distinct-locale ceiling and `locale_limit_reached` appears nowhere.
- Missing evidence: Add pgTAP in supabase/tests/phase_02_slice_12_locale_limit.sql creating 32 variants (accepted) and a 33rd distinct locale (409 `locale_limit_reached`, nothing written), plus a Worker catalog test mapping the reason to LOCALE_VERSION_CONFLICT; make the 32-wide fan-out assertion exact.
- Size: M (1-4h)

### P2-S12-AC-237 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Locale event identity (D12): every locale variant and every stale row is a version of the locale aggregate `(entry, locale)`, and the outbox identity of `cms.localization.changed.v1` is aggregateType `cms.locale_variant`, aggregateId a U..."
- Implementation: appears missing (searched supabase for cms.locale.aggregate.v1 and cms.locale_variant; the relay pins cms.localization.changed.v1 to cms_content_entry, supabase/migrations/20261010164000_cms_review_recheck_relay.sql:76; producers: supabase/migrations/20261005010900_cms_locale_fanout.sql and the author RPC)
- Missing evidence: Add pgTAP: aggregateType `cms.locale_variant`, aggregateId UUIDv5(entry id, locale) under namespace `cms.locale.aggregate.v1`, aggregateVersion the variant row version, the author RPC and the fan-out writer never share a dedupe key. Update the Slice 10/11/12 locale event assertions that pin cms_content_entry.
- Size: M (1-4h)

### P2-S12-AC-238 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Preflight provider `cms.pattern.active_digest` version 1 (category `pattern`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every PatternVersion in the manifest to b..."
- Implementation: appears missing (searched supabase, packages for cms.pattern.active_digest, cms.taxonomy.assignment_integrity, cms.locale.no_fallback_gate and the failing reasons; categories pattern, taxonomy and locale still run the reference gate, supabase/migrations/20261005017570_cms_preflight_evaluation.sql:335-381; the Slice 11 registry test only inserts a fabricated row, supabase/tests/phase_02_slice_11_preflight_registry_schema.sql:30)
- Missing evidence: Add a forward migration and pgTAP: newer registry row replacing preflight.reference_gate; passes when every PatternVersion in the manifest is active with an equal content_hash and the recomputed blockRegistryDigest equals the frozen one; fails `pattern_not_active` and `pattern_digest_changed`.
- Size: M (1-4h)

### P2-S12-AC-239 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Preflight provider `cms.taxonomy.assignment_integrity` version 1 (category `taxonomy`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate`, requires every `active` TermAssignment of..."
- Implementation: appears missing (searched supabase, packages for cms.pattern.active_digest, cms.taxonomy.assignment_integrity, cms.locale.no_fallback_gate and the failing reasons; categories pattern, taxonomy and locale still run the reference gate, supabase/migrations/20261005017570_cms_preflight_evaluation.sql:335-381; the Slice 11 registry test only inserts a fabricated row, supabase/tests/phase_02_slice_11_preflight_registry_schema.sql:30)
- Missing evidence: Add a forward migration and pgTAP: active assignments name active terms, deprecated tolerated, unconverged merged term fails `term_merged_unconverged`, changed allowlist fails `allowlist_changed`, a non-active manifest taxonomy version fails `taxonomy_version_not_active`.
- Size: M (1-4h)

### P2-S12-AC-240 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Preflight provider `cms.locale.no_fallback_gate` version 1 (category `locale`, `database`) is registered by forward migration as a newer registry row replacing `preflight.reference_gate` and evaluates every `no_fallback` field of the rev..."
- Implementation: appears missing (searched supabase, packages for cms.pattern.active_digest, cms.taxonomy.assignment_integrity, cms.locale.no_fallback_gate and the failing reasons; categories pattern, taxonomy and locale still run the reference gate, supabase/migrations/20261005017570_cms_preflight_evaluation.sql:335-381; the Slice 11 registry test only inserts a fabricated row, supabase/tests/phase_02_slice_11_preflight_registry_schema.sql:30)
- Missing evidence: Add a forward migration and pgTAP: every no_fallback field of the revision schema is evaluated for the revision locale in one statement, `no_fallback_missing`, `no_fallback_stale` and `locale_variant_not_approved` fail the category, otherwise pass; route, media and privacy stay on the reference gate.
- Size: L (>4h)

### P2-S12-AC-241 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Preflight dispatch: each Slice 12 provider is implemented in the deployed preflight evaluation before its registry row is inserted, so that no category evaluates `unavailable` with `provider_unavailable` because its provider is not imple..."
- Implementation: appears missing (packages/contracts/src/cms-editorial/preflight.ts:167-173 lists only provider_unavailable for non-worker categories; dispatch in supabase/migrations/20261005017570_cms_preflight_evaluation.sql:348-381 returns provider_unavailable for a key other than preflight.<category>)
- Missing evidence: Add pgTAP proving that after the Slice 12 migrations no category evaluates `unavailable` with `provider_unavailable`, and vitest in packages/contracts for the three closed reason sets and fixed reason copy.
- Size: M (1-4h)

### P2-S12-AC-242 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Taxonomy-version resolution (DEC-141): `platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)` resolves any taxonomy version id of the caller's owner scope, in any state from `draft` through `retired`, to `{ taxonomyI..."
- Implementation: appears missing (searched supabase for cms_resolve_taxonomy_version; fail-closed comparison at supabase/migrations/20261005014100_cms_compare_lineage_fail_closed.sql:9-15,46)
- Missing evidence: Add pgTAP: any taxonomy version id of the caller owner scope in any state resolves to {taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash}; absent or out-of-scope ids are `comparison_unavailable`; CMS-03B-03 and CMS-03B-04 compare non-empty recorded taxonomy versions. Update the Slice 10 comparison tests that pin the fail-closed behaviour.
- Size: M (1-4h)

### P2-S12-AC-243 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Restore of composition instances (DEC-141): `cms_restore_revision` carries the source revision's `active` composition instances into the new draft revision, each keeping its path and link mode and re-pinned to the current registry, so th..."
- Implementation: appears missing (cms_composition_instances is not referenced by any restore migration, e.g. supabase/migrations/20261005018055_cms_restore_revision_derived_state.sql; no carried_from_id)
- Missing evidence: Add pgTAP: active instances are carried with path and link mode and re-pinned; a withdrawn block pin is 409 `migration_chain_incomplete`; a no-longer-active pattern pin fails the same way unless detached; a slot path absent from the current compatible template is 409 `template_incompatible`; nothing fabricated.
- Size: L (>4h)

### P2-S12-AC-244 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Restore of term assignments (DEC-141): each `active` TermAssignment of the source revision is carried to the new revision, an assignment to an `active` or `deprecated` term carrying unchanged, a `merged` term re-pointed to its surviving ..."
- Implementation: appears missing (supabase/migrations/20261005018055_cms_restore_revision_derived_state.sql:353-358,413 only validates and copies taxonomy_version_ids; no restore of cms_term_assignments)
- Missing evidence: Add pgTAP: active/deprecated term assignments carry unchanged, a merged term is re-pointed to its successor, an unknown or other-vocabulary term fails 409 `migration_chain_incomplete`, and the new revision taxonomy_version_ids are the vocabularies current active version ids.
- Size: M (1-4h)

### P2-S12-AC-245 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Revision append carry-over (DEC-141): the Slice 12 migration extends `cms_create_revision`, `cms_resolve_conflict` and `cms_restore_revision` so that each carries the base revision's `active` composition instances into the new revision a..."
- Implementation: appears missing (searched supabase/migrations for carried_from_id and composition carry-over)
- Missing evidence: Add pgTAP for each of the three RPCs: active instances are appended to the new revision with carried_from_id provenance unless the command pointers change them; an autosave drops no composition.
- Size: L (>4h)

### P2-S12-AC-246 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Taxonomy field values (DEC-141): once Slice 12 registers the taxonomy authority, the 03b `taxonomy` value encoder replaces its fail-closed `taxonomy_source_unavailable` with the rule that each `termId` must be an `active` term of a vocab..."
- Implementation: appears missing (supabase/migrations/20261005010100_cms_field_kind_encodings.sql:364-414 refuses taxonomy values; Slice 10 pgTAP pins the refusal, e.g. supabase/tests/phase_02_slice_10_value_source_refusal.sql)
- Missing evidence: Add pgTAP: a termId must be an active term of a vocabulary whose active version lists the entry type key and field key; merged, deprecated, unknown and other-vocabulary terms are the uniform 422 VALIDATION_FAILED `term_unavailable`; revision taxonomy_version_ids are the active version ids. Update the Slice 10 value-source tests that pin the old refusal.
- Size: M (1-4h)

### P2-S12-AC-247 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Render plan (DEC-165 receiving obligation): `platform_private.cms_revision_render_plan` takes, for each `(revision_id, path)`, the current (highest `version`) composition instance in state `draft`, `active` or `pending_diff` in template ..."
- Implementation: partial: supabase/migrations/20261005017910_cms_load_quality_gate_input.sql:42-127 selects instance.state in (draft, active); highest version per (revision_id, path), pending_diff from the pinned version and block-root rows are missing.
- Missing evidence: Add a forward migration redefining cms_revision_render_plan and pgTAP: highest version per (revision_id, path), states draft/active/pending_diff, multiple template slots, id tie-break, pending_diff rendered from its pinned version, block-root rows at their own path, superseded and retired excluded; extend supabase/tests/phase_02_slice_11_checker_render_plan.sql accordingly.
- Size: M (1-4h)

### P2-S12-AC-248 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Event relay (DEC-166 receiving obligation): Slice 12's forward migration makes every Slice 12 event claimable by the outbox relay under the exact aggregate type its producer writes, including `cms.locale_variant` for `cms.localization.ch..."
- Implementation: appears missing (supabase/migrations/20261010164000_cms_review_recheck_relay.sql:70-80; no Slice 12 migration narrows the claim tuples)
- Missing evidence: Add a forward migration narrowing claim_outbox_batch to the exact tuples (cms.locale_variant, cms_template_version, cms_pattern_version, cms_taxonomy_version, cms_term) and pgTAP asserting every claimed event has a registered producer prefix and a listed aggregate type; update supabase/tests/phase_02_slice_11_recheck_relay.sql.
- Size: M (1-4h)

### P2-S12-AC-249 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Activation events: `cms.template.activated.v1` `{ templateId, templateVersionId }` and `cms.pattern.activated.v1` `{ patternId, patternVersionId }` (a new event type registered by Slice 12) are emitted exactly once by CMS-03C-09 only on ..."
- Implementation: appears missing (searched supabase, apps, packages for cms_activate_governed_subject and producers of cms.template.activated.v1 / cms.pattern.activated.v1; only consumers exist, supabase/migrations/20261010164100_cms_dependency_recheck.sql)
- Missing evidence: Add pgTAP: exactly one identifier-only event per committed activation, retirement (naming the retired version) and scheduled execution, with aggregateType cms_template_version or cms_pattern_version, aggregateId the switched version id, aggregateVersion its row version after the switch, none for schedule acceptance, refusal or review state change.
- Size: L (>4h)

### P2-S12-AC-250 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Taxonomy changed event: `cms.taxonomy.changed.v1` `{ taxonomyId, taxonomyVersionId }` is emitted once per committed CMS-03C-03 term action (carrying the vocabulary's active version id) and by CMS-03C-09 after a taxonomy-version activatio..."
- Implementation: appears missing (searched supabase, apps, packages for producers of cms.taxonomy.changed.v1; only consumers exist)
- Missing evidence: Add pgTAP: one event per committed term action (aggregateType cms_term, id the term id, version the term version after the action) and per taxonomy-version activation or retirement (aggregateType cms_taxonomy_version), identifier-only payload.
- Size: M (1-4h)

### P2-S12-AC-251 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_governed_reviews`: rows are inserted only through `cms_submit_governed_review`, with `state` one of `open`, `approved`, `rejected`, `invalidated`, `subject_kind` one of the three subject kinds, a polymorphic `subject_id`..."
- Implementation: appears missing (searched supabase/migrations for cms_governed_reviews, cms_submit_governed_review, cms_governed_subject_resolve)
- Missing evidence: Add pgTAP supabase/tests/phase_02_slice_12_governed_reviews_schema.sql: state and subject_kind sets, subject resolve trigger, 64-hex hash columns and approval_evidence_hash as the JCS SHA-256 of {policyBasisHash, subjectHash, subjectId, subjectKind}, required_decision_count 1..8 and recorded <= required, required_capabilities 1..16, policy_basis 1..64, the protected/invalidated/decided CHECKs, the partial UNIQUE, frozen-column immutability, CAS-only state advance, and revoked direct UPDATE/DELETE/grants.
- Size: L (>4h)

### P2-S12-AC-252 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_governed_review_decisions`: rows are append-only (`state` `recorded`, `version` 1, `updated_at = created_at`, UPDATE, DELETE and direct grants revoked) with `UNIQUE(review_id, reviewer_person_id)`, a NOT NULL `step_up_at..."
- Implementation: appears missing (searched supabase/migrations, apps, packages for the table and its RPCs; the Slice 11 editorial review tables are a different set) (cms_governed_review_decisions)
- Missing evidence: Add pgTAP: append-only rows, UNIQUE(review_id, reviewer_person_id), NOT NULL step_up_at, recorded assignment and slot, reason 1..2000 code points, hashes as 64 hex, server-derived reviewer/capability/MFA instant, reason readable only by its decider, trigger refusing the submitter or subject creator.
- Size: M (1-4h)

### P2-S12-AC-253 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_governed_review_assignments`: rows are created and revoked only by `cms_assign_governed_reviewer` with `capability_key` fixed to `cms.definition_review`, `actions` fixed to `read` and `decide`, `state` `active` or `revok..."
- Implementation: appears missing (searched supabase/migrations, apps, packages for the table and its RPCs; the Slice 11 editorial review tables are a different set) (cms_governed_review_assignments, cms_assign_governed_reviewer)
- Missing evidence: Add pgTAP: rows only through the RPC, capability_key fixed, actions read and decide, ends_at after starts_at and within seven days, UNIQUE active per reviewer, decide authority only inside the window on a non-revoked row, reason 1..256, revoked direct writes.
- Size: M (1-4h)

### P2-S12-AC-254 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_governed_review_dependencies`: rows are written only by `cms_submit_governed_review` from the frozen identities with `kind` one of `block`, `pattern`, `content_type` and `canonical_domain`, `UNIQUE(review_id, kind, ref_i..."
- Implementation: appears missing (searched supabase/migrations, apps, packages for the table and its RPCs; the Slice 11 editorial review tables are a different set) (cms_governed_review_dependencies)
- Missing evidence: Add pgTAP: rows written only by cms_submit_governed_review from the frozen identities, kind set (block, pattern, content_type, canonical_domain), UNIQUE(review_id, kind, ref_id), immutability, the two indexes, forced RLS and no grants.
- Size: M (1-4h)

### P2-S12-AC-255 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_governed_activation_schedules`: `state` is one of `pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`, `reason_code` is non-null exactly for `blocked` and `cancelled` and one of `approval_inva..."
- Implementation: appears missing (searched supabase/migrations, apps, packages for the table and its RPCs; the Slice 11 editorial review tables are a different set) (cms_governed_activation_schedules)
- Missing evidence: Add pgTAP: state set, reason_code non-null exactly for blocked and cancelled, attempt_count 0..3, expected_version, one live schedule per subject (partial UNIQUE), time-evidence columns never replaced, insert only by CMS-03C-09 and CAS updates only by the CMS-03C-19 claim and execute RPCs, revoked direct writes.
- Size: L (>4h)

### P2-S12-AC-256 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_canonical_domain_registry`: rows are seeded by forward migration only, immutable and never writable by a caller (`state` `seeded`, `updated_at = created_at`, `owner_id` the seeding release record), hold `domain` one of `..."
- Implementation: appears missing (searched supabase/migrations for cms_canonical_domain_registry, provider_state, cms_canonical_taxonomy_match)
- Missing evidence: Add pgTAP: seeded by migration only and immutable, domain set of six, provider_state built/unbuilt with provider_key/provider_version non-null exactly when built, UNIQUE(domain, version), current row is the greatest version, `role` seeded built and the other five unbuilt, no caller write.
- Size: M (1-4h)

### P2-S12-AC-257 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_pattern_versions` (Slice 12 delta): `compatible_type_ids jsonb NOT NULL` is an array of 1 to 64 UUIDs, `node_count smallint NOT NULL` is between 1 and 512, and `block_tree` is the bounded `PatternNode` forest whose every..."
- Implementation: appears missing (supabase/migrations/20260927290000_cms_composition_authority.sql:43-65 has block_tree as a free object checked by cms_pattern_tree_keys_valid, no compatible_type_ids, no node_count)
- Missing evidence: Add a forward migration and pgTAP: compatible_type_ids jsonb array of 1..64 UUIDs, node_count smallint 1..512, block_tree a bounded PatternNode forest whose block keys follow the BlockKey grammar (the existing grammar test targets the old object shape).
- Size: M (1-4h)

### P2-S12-AC-258 — partial
- Unproven clause(s): "Persistence `cms_composition_instances` (Slice 12 delta): `pending_pattern_version integer` is non-null exactly when `state = 'pending_diff'`," "`carried_from_id uuid` references `cms_composition_instances(id)` as the revision-append and restore carry-over provenance,"
- Implementation: present: supabase/migrations/20260927290000_cms_composition_authority.sql:72-117 (table, snapshot_time CHECK at :113), :130 (immutable guard trigger); pending_pattern_version and carried_from_id are missing.
- Missing evidence: Add a forward migration and pgTAP: pending_pattern_version CHECK (non-null iff pending_diff), carried_from_id self-referencing FK, a DELETE of an instance version rejected, and a row with updated_at <> created_at rejected.
- Size: S (<1h)

### P2-S12-AC-259 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Persistence `cms_taxonomy_versions` (Slice 12 delta): `canonical_overlap_domains jsonb NOT NULL DEFAULT '[]'` is an array of at most 6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction`, and a version ho..."
- Implementation: appears missing (supabase/migrations/20260927260000_cms_taxonomy_authority.sql:6-31 holds no overlap domains; canonical_overlap_domains appears nowhere in supabase)
- Missing evidence: Add a forward migration and pgTAP: canonical_overlap_domains jsonb NOT NULL DEFAULT [] as an array of at most 6 unique members of the six domains (reject a duplicate, a seventh member and an unknown domain), and a version holds rules only.
- Size: S (<1h)

### P2-S12-AC-260 — partial
- Unproven clause(s): "Persistence `cms_locale_variants` (Slice 12 delta): `field_source_hashes jsonb NOT NULL DEFAULT '{}'` is an object of at most 128 field-id keys to 64-hex hashes," "`stale_field_ids jsonb NOT NULL DEFAULT '[]'` is an array of at most 128 UUIDs," "the physical state is `draft` or `stale`,"
- Implementation: present: supabase/migrations/20260927310000_cms_locale_related_authority.sql:6-48 (table, snapshot time CHECK, state CHECK of five values); the two jsonb columns are missing.
- Missing evidence: Add a forward migration and pgTAP: the two columns with their bounds and defaults, state CHECK restricted to draft and stale, a row with updated_at <> created_at rejected.
- Size: M (1-4h)

### P2-S12-AC-261 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "RPC and grant inventory: all fifteen 03c tables use forced RLS with no direct write grants for `authenticated` and `anon`; the named RPCs are the five original commands (`cms_define_template`, `cms_insert_pattern_instance`, `cms_act_taxo..."
- Implementation: partial: forced RLS and no-grant assertions exist per existing table group (e.g. supabase/tests/phase_02_slice_12_taxonomy_authority.sql, phase_02_slice_12_composition_authority.sql, phase_02_slice_12_locale_related_authority.sql); the governed tables, canonical registry, cms_list_taxonomy_*, cms_*_governed_*, pattern/taxonomy version RPCs and internal RPCs are missing.
- Missing evidence: Add a catalog-derived pgTAP inventory test: all fifteen tables forced RLS with no write grants for authenticated and anon; every listed RPC exists as SECURITY DEFINER with search_path empty, PUBLIC execute revoked, named grants only, with a positive and a negative grant assertion each.
- Size: L (>4h)

### P2-S12-AC-262 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Governed read scopes: GovernedReview SELECT requires one of the scopes of the governed machinery (the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability, or the receipt-derived owner), a decision'..."
- Implementation: appears missing (searched supabase/migrations, apps, packages for the table and its RPCs; the Slice 11 editorial review tables are a different set) (cms_governed_reviews read scopes)
- Missing evidence: Add pgTAP with fixtures for submitter, assignee, owner-capability holder and receipt-derived owner: each reads the review, an outsider does not; reason readable only by its decider; assignments serialized only to the owner and own assignment to its reviewer without identifiers; schedules, dependencies and registry unreadable by browser and service role.
- Size: L (>4h)

### P2-S12-AC-263 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Slice 12 metrics: `cms_governed_review_total{subject_kind,outcome}`, `cms_governed_decision_total{decision,outcome}`, `cms_governed_activation_total{subject_kind,action,outcome}`, `cms_governed_review_invalidated_total{reason}`, `cms_gov..."
- Implementation: appears missing (searched apps, packages, infra for cms_governed_review_total, cms_pattern_update_total, cms_canonical_match_total, cms_locale_fanout_total and the others; only per-route CMS-03C-01..05 telemetry exists, e.g. apps/worker/src/cms-composition-production-locale.ts)
- Missing evidence: Add Worker/unit tests asserting each named metric increments at its event with exactly the listed labels, and a test that no label carries an id, label text, locale text, hash or person.
- Size: L (>4h)

### P2-S12-AC-264 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Alerts and diagnostics: alerts fire on a DLQ above 0, outbox age above 2 minutes, an activation blocked for more than 15 minutes, a stale locale legal-field count above 0 or a target-filter anomaly, traces cover validation, principal and..."
- Implementation: appears missing (searched infra/observability, apps/worker/src for Slice 12 alert rules and diagnostics allowlists)
- Missing evidence: Add alert-rule tests (DLQ above 0, outbox age above 2 minutes, activation blocked above 15 minutes, stale legal-field count above 0, target-filter anomaly), a trace-span coverage test per listed step, and a log-allowlist test rejecting content, locale text, labels, target names, tokens, raw rules and capability graphs.
- Size: L (>4h)

### P2-S12-AC-265 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Template pages: `/app/cms-content-modeling/templates/new` and `/app/cms-content-modeling/templates/:templateKey` are protected Astro SSR pages (`CmsTemplateDesigner` for create, `CmsTemplateEditDesigner` for a successor from `cmsTemplate..."
- Implementation: partial: apps/web/src/pages/app/cms-content-modeling/templates/new.astro and [templateKey].astro (CmsTemplateDesigner, CmsTemplateEditDesigner, 401 -> 303 sign-in redirect); divergence: a malformed key renders a 404 (templates/[templateKey].astro:26-34; asserted by tests/e2e/phase-02-slice-12-template-edit.spec.ts); CmsGovernedReviewPanel is missing.
- Missing evidence: Resolve the 400-versus-404 conflict with the criterion (change the page or the criterion). Add Playwright real-route and page tests for: 303 to the allowlisted sign-in redirect on a missing or expired session, 400 on malformed keys, disclosure-safe 404, 403 without cms.template_designer, reserved keys context/versions/new never resolving, :templateKey addressing the latest definition, Back restoring the form without serializing a definition, and the review panel.
- Size: L (>4h)

### P2-S12-AC-266 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Pattern pages: `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey` are protected Astro SSR pages with `CmsPatternVersionDesigner` and the bounded `CmsGovernedReviewPanel`: the server verifies ses..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) for patterns/new and patterns/:patternKey
- Missing evidence: Add the protected server-first page and islands, then Astro route/component tests and Playwright real-route tests for the session, expiry and acting-context checks (303 sign-in redirect), 400 on malformed ids or keys, disclosure-safe 404, 403 without the capability, and the URL-state rules of this criterion.
- Size: L (>4h)

### P2-S12-AC-267 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Taxonomy pages: `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId` are protected Astro SSR pages with `CmsTaxonomyVersionDesigner`, `CmsTaxonomyTermForm` and the bounded `CmsGovernedReviewPa..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) for taxonomies/new and taxonomies/:taxonomyId
- Missing evidence: Add the protected server-first page and islands, then Astro route/component tests and Playwright real-route tests for the session, expiry and acting-context checks (303 sign-in redirect), 400 on malformed ids or keys, disclosure-safe 404, 403 without the capability, and the URL-state rules of this criterion.
- Size: L (>4h)

### P2-S12-AC-268 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Definition review pages: `/app/cms-content-modeling/definition-reviews` and `/app/cms-content-modeling/definition-reviews/:reviewId` are protected server-first pages (`CmsGovernedReviewQueue`, `CmsGovernedReviewDetail`, `CmsGovernedDecis..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) for definition-reviews and definition-reviews/:reviewId
- Missing evidence: Add the protected server-first page and islands, then Astro route/component tests and Playwright real-route tests for the session, expiry and acting-context checks (303 sign-in redirect), 400 on malformed ids or keys, disclosure-safe 404, 403 without the capability, and the URL-state rules of this criterion.
- Size: L (>4h)

### P2-S12-AC-269 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Composition page: `/app/cms-content-modeling/entries/:entryId/composition` is a protected server-first page with `CmsCompositionInstanceList`, `CmsPatternSelector` and `CmsPatternUpdateDiff`: the server verifies session, expiry and actin..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) for entries/:entryId/composition
- Missing evidence: Add the protected server-first page and islands, then Astro route/component tests and Playwright real-route tests for the session, expiry and acting-context checks (303 sign-in redirect), 400 on malformed ids or keys, disclosure-safe 404, 403 without the capability, and the URL-state rules of this criterion.
- Size: L (>4h)

### P2-S12-AC-270 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Locale page: `/app/cms-content-modeling/entries/:entryId/locales/:locale` is a protected server-first page with `CmsLocaleVariantForm`: the server verifies session, expiry and acting context (303 sign-in redirect), malformed ids are 400,..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) for entries/:entryId/locales/:locale
- Missing evidence: Add the protected server-first page and islands, then Astro route/component tests and Playwright real-route tests for the session, expiry and acting-context checks (303 sign-in redirect), 400 on malformed ids or keys, disclosure-safe 404, 403 without the capability, and the URL-state rules of this criterion.
- Size: M (1-4h)

### P2-S12-AC-271 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Definition governance states: for `governedReviewState` (CMS-03C-10 and -11), `selectorState` and `latestReadState` (CMS-03C-13 and -17 and the template, pattern, vocabulary-version and term reads), `diffState` (CMS-03C-14) and `commandS..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) (no governedReviewState, selectorState, latestReadState, diffState or commandState island)
- Missing evidence: Add component tests per state table (idle, loading with 250 ms skeleton and only the commit control disabled, success, empty, error, degraded, disabled), 401 STEP_UP_REQUIRED routing to /step-up?returnTo=, 403 capability_missing and separation_of_duties CapabilityGate copy, fixed 409/422 copy, unknown mutation outcome reconciled by refetch before retry, and a degraded diff never kept.
- Size: L (>4h)

### P2-S12-AC-272 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Governed surface privacy: decision reasons, the policy basis, pattern diff values, canonical ids and every assignment identifier are re-derived by the server and never enter a public or private cache, an analytics event, a Realtime body,..."
- Implementation: appears missing (searched apps/web/src and packages/contracts/src for CMS-03C-18..21 clients and governed surfaces)
- Missing evidence: Add tests asserting decision reasons, policy basis, pattern diff values, canonical ids and assignment identifiers never reach a public or private cache, analytics event, Realtime body, URL or log, and a static test that no browser route, form, proxy or client type names CMS-03C-18 to CMS-03C-21.
- Size: M (1-4h)

### P2-S12-AC-273 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "End-to-end journeys: Playwright, using the real routes and two people, creates, submits, assigns, decides (ordinary and protected) and activates, schedules and retires a template, a pattern and a vocabulary; shows a dependency invalidati..."
- Implementation: appears missing (tests/e2e has template and locale API specs only: tests/e2e/phase-02-slice-12-template-real-route.spec.ts, phase-02-slice-12-locale-real-route.spec.ts, both on in-memory ports)
- Missing evidence: Add Playwright real-route specs with two people: create, submit, assign, decide (ordinary and protected), activate, schedule and retire a template, pattern and vocabulary; dependency invalidation returning a subject to draft; linked pattern update accepted and detached; term merge with convergence; locale variant with a no_fallback block; related content pinned and excluded; keyboard-only and 200% zoom; no diff value, canonical id or person id in URL, storage, logs or telemetry.
- Size: L (>4h)

### P2-S12-AC-274 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Typed refusals: within the Slice 12 catalogs a refusal carries exactly one lowercase `details.reasonCode` from the closed list (`capability_missing`, `separation_of_duties`, `subject_not_submittable`, `review_not_open`, `duplicate_decisi..."
- Implementation: partial: apps/worker/src/cms-composition-production-locale.ts:70-71 and packages/contracts/src/cms-composition/locale-variant.ts cover FALLBACK_CHAIN_MISMATCH; the other reason codes appear nowhere in supabase, apps or packages (searched each).
- Missing evidence: Add contract tests for the closed reasonCode list and per-reason status (including 422 for pattern_version_not_active, pattern_incompatible, nested_pattern_not_active and GOVERNED_REVIEW_VERSION_CONFLICT for every governed 409), and per-operation tests that a provider timeout or fault is 503 DEPENDENCY_UNAVAILABLE, never a success-shaped body, and that an unmapped status or uncatalogued message is a 500 INTERNAL_ERROR without the original payload.
- Size: L (>4h)

### P2-S12-AC-275 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Registry parity: CI matches the discovered Hono routes and the generated OpenAPI to every Slice 12 browser operation ID (CMS-03C-01 to CMS-03C-17 and the five supporting reads) on method and path, request, success and error schemas, auth..."
- Implementation: partial: infra/openapi-definitions.mjs registers CMS-03C-01..05 only (operation keys at :2386, :2437, :2475, :2508, :2538; per-operation tests in tests/contracts/phase-02-slice-12-{template,locale,related-content,taxonomy-term}-openapi.test.ts); CMS-03C-06..17 and the five supporting reads are missing.
- Missing evidence: Add tests/contracts/phase-02-slice-12-registry-openapi.test.ts on the pattern of tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts: discovered Hono routes versus generated OpenAPI versus registry for every Slice 12 browser operation id on method, path, schemas, auth, CORS, rate, timeout, cache, idempotency, ETag and SLO, plus absence of CMS-03C-18 to -21.
- Size: M (1-4h)

### P2-S12-AC-276 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Lock order: the Slice 12 writers (CMS-03C-01 to CMS-03C-09, CMS-03C-12, CMS-03C-15, CMS-03C-16 and CMS-03C-19, the linked-update scan, the revision-append carry-over, the recheck job and the term merge) take their locks in the Slice 12 l..."
- Implementation: appears missing (Slice 10/11 lock helpers exist, supabase/migrations/20261005012100_cms_write_path_lock_helpers.sql and supabase/tests/phase_02_slice_10_activation_lock_order.sql, but no Slice 12 writer takes them)
- Missing evidence: Add a pgTAP lock-order test per writer against the extended BE03b order (DEC-157 term position), a race runner under supabase/tests/phase_02_slice_12_races for opposing writers, and a test that `deadlock_detected` and lock-acquisition failure map to the operation *_VERSION_CONFLICT with nothing committed and the same Idempotency-Key reusable.
- Size: L (>4h)

### P2-S12-AC-277 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Concurrency scenarios: template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate and out-of-order ev..."
- Implementation: appears missing (searched supabase/tests/phase_02_slice_10_races, phase_02_slice_11_races and infra/database-races for Slice 12 scenarios)
- Missing evidence: Add race runners and deterministic tests for the eight scenarios: template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate and out-of-order events, worker lease expiry, restore-epoch fencing.
- Size: L (>4h)

### P2-S12-AC-278 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "No leakage: no private locale text, draft composition, unauthorized target, capability or canonical-domain authority enters a public projection, an event payload, a log or a cache."
- Implementation: partial: payload assertions exist in supabase/tests/phase_02_slice_12_locale_author_rpc.sql ("outbox payload excludes translated field values and source text") and phase_02_slice_12_locale_source_stale.sql ("locale change events never disclose source or translated text").
- Missing evidence: Add leakage tests across public projection, event payload, log and cache for private locale text, draft composition, unauthorized target, capability and canonical-domain authority.
- Size: L (>4h)

### P2-S12-AC-279 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "Representative-size performance: 64-slot templates, 512-node pattern bounds, 50-term pages, 128 locale fields and 64 related targets meet the Tier 2 p95 < 1,200 ms and RPC < 300 ms targets."
- Implementation: appears missing (infra/performance/api-p95-smoke.mjs is a generic smoke; no 64-slot, 512-node, 50-term, 128-field or 64-target benchmark)
- Missing evidence: Add benchmark fixtures (64-slot template, 512-node pattern, 50-term page, 128 locale fields, 64 related targets) with assertions of Tier 2 p95 < 1,200 ms per route and RPC < 300 ms.
- Size: L (>4h)

### P2-S12-AC-280 — partial
- Unproven clause(s): "implement locked behavior and completion exactly. Operation: CMS-03C-04 (author locale variant), BE03c ledger 25.05.03."
- Implementation: present: supabase/migrations/20261002167000_cms_locale_author_active_configuration.sql:12 (cms_author_locale_variant), apps/worker/src/cms-composition/locale-routes.ts:53; the locked Slice 12 deltas (AC-234..AC-237, AC-260) are missing.
- Missing evidence: Add tests/postgrest/phase-02-slice-12-locale-variant.apispec.ts through Worker + PostgREST + database for 201, 403, 404, 409 FALLBACK_CHAIN_MISMATCH and 422; finish AC-233..AC-237 before citing the last clause.
- Size: M (1-4h)

### P2-S12-AC-281 — partial
- Unproven clause(s): "revocation," "deletion," "and cascade."
- Implementation: present: supabase/migrations/20261002167000_cms_locale_author_active_configuration.sql:12 (refusals NOT_FOUND, FORBIDDEN, VERSION_MISMATCH); recovery surfaces (locale page, revalidation) are missing.
- Missing evidence: Add pgTAP: authority revoked between read and write is refused, a deleted or hidden source is concealed, a stale cascade is followed by a successful revalidation write; add a Playwright real-route spec for the recovery path once the locale page exists.
- Size: M (1-4h)

### P2-S12-AC-282 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "`CMS-15` Author locale variant: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/v..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) for entries/:entryId/locales/:locale; apps/web/src/server/cms-composition-platform-locale.ts is the proxy only
- Missing evidence: Add the native form island and tests: server-derived actor/context/capability, Zod input, required ETag and idempotency, authoritative response with version and provenance, announced status, exact ApiError mapping, retained input, focus to summary or field, reconcile an unknown mutation before retry, URL state for navigation only, scoped draft before commit, server state after success.
- Size: L (>4h)

### P2-S12-AC-283 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "CMS-16 Curate related content: given Actor may edit the source entry, every pinned or excluded target is an existing entry the acting context is authorized to reference, and derived candidates come only from explainable bounded determini..."
- Implementation: appears missing (apps/worker/src/cms-composition-production-related.ts:56 returns unavailable; cms_curate_related_content and cms_related_content_public_targets are not deployed)
- Missing evidence: After AC-227..AC-232, add the apispec through Worker + PostgREST + database for CMS-03C-05: source-entry edit authority, authorized pin and exclusion targets, bounded deterministic derived candidates over authorized projections.
- Size: L (>4h)

### P2-S12-AC-284 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "CMS-16 Curate related content: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade."
- Implementation: appears missing (see AC-283)
- Missing evidence: Add pgTAP and apispec cases for invalid authority, stale If-Match, revoked authority, deleted or unpublished target and cascade, each with its declared failure and recovery.
- Size: M (1-4h)

### P2-S12-AC-285 — unverified
- Unproven clause(s): whole criterion, single clause, no test cited: "`CMS-16` Curate related content: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/..."
- Implementation: appears missing (searched apps/web/src/pages/app/cms-content-modeling and apps/web/src/components/cms-composition; web proxies exist only for CMS-03C-01..05) (no related-content form or island; apps/web/src/server/cms-composition-platform-related.ts is the proxy only)
- Missing evidence: Add the native form island and the same interaction, a11y and reconciliation tests listed for AC-282, for CMS-16.
- Size: L (>4h)

## Summary

(a) Counts: verified 0, partial 10, unverified 62 (72 criteria).

Partial: AC-218, AC-224, AC-225, AC-228, AC-233, AC-236, AC-258, AC-260, AC-280, AC-281.

(b) Implementation appears entirely missing (no code of any kind for the behaviour): AC-214, AC-215, AC-219, AC-222, AC-223, AC-226, AC-229, AC-230, AC-231, AC-232, AC-235, AC-237, AC-238, AC-239, AC-240, AC-241, AC-242, AC-243, AC-244, AC-245, AC-249, AC-250, AC-251, AC-252, AC-253, AC-254, AC-255, AC-256, AC-259, AC-262, AC-263, AC-264, AC-266, AC-267, AC-268, AC-269, AC-270, AC-271, AC-272, AC-273, AC-276, AC-277, AC-279, AC-282, AC-285.

Scaffolding only or partly built (HTTP boundary, table, guard, older shape or neighbouring behaviour exists; the criterion behaviour is not complete): AC-216, AC-217, AC-218, AC-220, AC-221, AC-224, AC-225, AC-227, AC-228, AC-233, AC-234, AC-236, AC-246, AC-247, AC-248, AC-257, AC-258, AC-260, AC-261, AC-265, AC-274, AC-275, AC-278, AC-280, AC-281, AC-283, AC-284.

(c) Cited tests believed to fail or be skipped: none found. The cited pgTAP files and the two cited vitest files contain no skip, todo, fixme or only. Nothing was executed, so a failing cited test cannot be ruled out. Weak spots in cited tests (stated in the limitations): `supabase/tests/phase_02_slice_10_locale_fanout_regression.sql` accepts SQLSTATE 42883 as a refusal of a 33-wide fan-out (not cited); the locale Playwright spec `tests/e2e/phase-02-slice-12-locale-real-route.spec.ts` and the template specs run on in-memory ports (not cited).

Existing tests that pin behaviour a Slice 12 migration will change (update them in the same change, none is cited): `supabase/tests/phase_02_slice_10_value_source_refusal.sql` and neighbours (taxonomy_source_unavailable, AC-246); `supabase/tests/phase_02_slice_10_compare_lineage*.sql` (taxonomy comparison fails closed, AC-242); `supabase/tests/phase_02_slice_11_recheck_relay.sql` and `phase_02_slice_11_recheck_event_resolve.sql` (relay aggregate types, AC-237/AC-248); `supabase/tests/phase_02_slice_11_checker_render_plan.sql` (render plan, AC-247); `supabase/tests/phase_02_slice_12_locale_source_stale.sql` event assertions keyed on the entry aggregate (AC-237).

Criterion text and tracker divergences found while reading: AC-225 allows a `deprecated` survivor but the existing guard `supabase/migrations/20260927400000_cms_taxonomy_successor_guard.sql` accepts only `active`; AC-265 says malformed keys are 400 but the template page and `tests/e2e/phase-02-slice-12-template-edit.spec.ts` produce 404; AC-218 and the contract `packages/contracts/src/cms-composition/pattern-instance.ts` still describe the pre-DEC-181 single-row response.

Formatting note: the fragment was formatted by hand to match prettier output; run `pnpm exec prettier --write tests/contracts/phase-02-slice-12-evidence-ledger-214-285.ts` before committing.
