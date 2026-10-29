# Lane claude_s12_gaps_db1 report

## Status
GREEN for everything written; PARTIAL against the inventory (48 rows: 32 proven, several with a named residual BOUNDARY; 2 web defects fixed; 3 partial; 11 BOUNDARY). HEAD cd89d54c, branch `claude/phase2-slice12`.
Final pgTAP run `final1` (staged ALT runner, lane `none`, 10 new entrypoints in one run): **Files=10, Tests=304, pass=all, fail=0**, TAP `.lane-logs/alt-staged-none-072017-2239836.tap`, SHA-256 `e535db175f3bcbf2c1b9a9c4825bab242a2a224987ee0ada4100895a2e01c6e8`.
Vitest: 748 passed over the touched web directories, the Worker route files and the closeout guard (65 files), plus 2 in template.context-bounds. eslint --max-warnings=0, prettier --check and tsc (worker, web, root) clean on every touched file.
No WIP migration was needed: no genuine product SQL defect was found, so `supabase/migrations-wip/gaps-db1/` was not created. Two web defects were found and fixed (below). Nothing outside the claim was edited except the four web files named in Files.

## Scope
The 48 rows of `docs/handoffs/2026-10-22-claude-s12/gaps/inventory.json` with class pgtap|other and AC-001..AC-180. Scratch: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_gaps_db1/` (rows.json, run scripts, logs). Files were renamed to the `phase_02_slice_12_gaps_db1_` prefix after the usage-limit cut because other gap lanes use the `phase_02_slice_12_gaps_` prefix (`gaps_governed/` and `gaps_governed_persist.sql` are db2's, not mine).

## Per-row outcome

| Criterion | Clause | Outcome | Identity / reason |
|---|---|---|---|
| P2-S12-AC-001 | 3 | BOUNDARY | BE03c 1816-1818 is silent on what a template preserves of a block accessibility_contract; cms_define_template never reads it. Needs a spec line first. |
| P2-S12-AC-010 | 2 | BOUNDARY (infrastructure) | No composed Worker->Kong->PostgREST case written: the composition stack support mounts only template/locale routes and an active pattern fixture needs the whole governed chain (see Open items). |
| P2-S12-AC-016 | 1 | BOUNDARY (infrastructure) | Same: needs an active taxonomy + curator fixture over the real stack. Layered candidates named in the inventory stand. |
| P2-S12-AC-023 | 1 | PROVEN (active half); BOUNDARY (allowlisted half) | supabase/tests/phase_02_slice_12_gaps_db1_template.sql: "a caller-owned content type whose state is retired (with an active version) is refused VALIDATION_FAILED", "an active caller-owned content type with no active version ...", "one inactive member ...", "the three refusals created no template row". "allowlisted" has no distinct rule in BE03c or the migration. |
| P2-S12-AC-026 | 2 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql: foreign-lineage / foreign-lineage-absent-version / absent-lineage refusals (NOT_FOUND, no DETAIL, stores unchanged) with own-draft-lineage control (pattern_version_not_active at /patternVersion) and own-active positive control |
| P2-S12-AC-026 | 3 | PROVEN | 422 half: apps/worker/src/cms-composition/pattern-instance-routes.malformed-ids.test.ts (4 malformed revisionId/patternId cases + control); 404 half: pgTAP above. 404 absent revision already proven by 050-refusals unknown-revision. |
| P2-S12-AC-033 | 2 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql: "a source revision that EXISTS but belongs to an entry the caller cannot read is the concealed NOT_FOUND" (+ unchanged stores, no DETAIL, control authoring) |
| P2-S12-AC-043 | 2 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql (same as AC-026 #2: the caller edits its own readable revision, the pattern lineage belongs to ANOTHER organization -> NOT_FOUND) |
| P2-S12-AC-048 | 10 | PROVEN | apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.retry.test.tsx: "reconciles the list first, then retries the same request under the same Idempotency-Key" + fresh key once the request changed |
| P2-S12-AC-048 | 12 | DEFECT FIXED (web) | Red: CmsTaxonomyTermForm.leave.test.tsx fails 4/5 with the guard off (mutation of the one wiring line, restored). Fix: use-term-form.ts isTermFormDirty + CmsTaxonomyTermForm.tsx useCmsEditorialLeaveGuard + new CmsTaxonomyTermLeaveConfirm.tsx. Green 5/5. |
| P2-S12-AC-050 | 0 | PARTIAL | tests/contracts/phase-02-slice-12-closeout.test.ts (10 tests): tracker vs ledger vs ARCHITECTURE status, progress checker, feature-ledger/plan agreement (KNOWN DRIFT pinned: 25.05.03 and 25.05.04 are plan-listed for Slice 12 but "—" in the feature ledger), runbook existence/links/paths, OpenAPI --check, spec graph rebuild, lazy markers none, BOUNDARY set pinned. Criterion stays partial: one unresolved BOUNDARY (nested picker, AC-105) and the drift above. |
| P2-S12-AC-055 | 2 | PROVEN | same cases as AC-033 #2 (T+locale_variant.sql) |
| P2-S12-AC-055 | 4 | BOUNDARY | DEC-227 Q2 is an owner question (unsupported locale on the CMS-03C-04 write: spec 404 vs code 422); no test can pass either way until ruled. |
| P2-S12-AC-056 | 9 | PROVEN (characterization) | supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql: the editor replaying the creator's key and body gets 409 VERSION_MISMATCH, never the stored response, and reserves nothing. NOTE: reservations are keyed (actor, operation, key hash) (identity_idempotency_reserve), so a different actor can never receive IDEMPOTENCY_MISMATCH; BE03c 149 ("changed actor ... 409") and 1671 ("bound to actor") describe the same binding. The Tier 2 p95 clause of the same limitation is hosted evidence (perf lane). |
| P2-S12-AC-061 | 9 | BOUNDARY (owner decision) | BE03c 1734 says 03c consumes cms.publication.changed.v1; the implementation recomputes at read time and no consumer exists. Amend the clause or build the consumer. (Tier 2 p95: perf lane.) |
| P2-S12-AC-065 | 1 | PROVEN (cross-owner, absent); NOTE | supabase/tests/phase_02_slice_12_gaps_db1_governed.sql: "an absent id and a version row of another organization meet the same concealed NOT_FOUND" + stores unchanged. A FIRST version's lineage id IS its row id (control assertion), so lineage-vs-row cannot be separated for v1; a lineage id of a successor is the v1 row, a valid exact row id. |
| P2-S12-AC-066 | 2 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_governed.sql: concealed NOT_FOUND (absent / other organization), per-kind map (cms_governed_owner_capability for the three kinds), curator refused 403 capability_missing on a template version, designer refused on a taxonomy version, each with unchanged stores and a correct-holder control |
| P2-S12-AC-069 | 3 | DEFECT FIXED (web) | Red: CmsGovernedReviewPanel.icon.test.tsx 2/2 failed. Fix: new CmsGovernedLifecycleIcon.tsx (one decorative aria-hidden svg per state, distinct glyphs) in CmsGovernedReviewPanel.tsx. Green. (Page-mount, quoted-copy limits of the same limitation: see #6.) |
| P2-S12-AC-069 | 6 | BOUNDARY | FE03 879 quotes "Needs an independent reviewer's approval" as the reason copy; the panel says "An independent reviewer must approve it before it can be activated." and the EXISTING CmsGovernedReviewPanel.test.tsx:95 asserts that string. Aligning either side edits an existing test or a spec: root decision. |
| P2-S12-AC-069 | 11 | PROVEN | apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.not-found.test.tsx: a 404 at submit shows "This record is not available." with no capability gate; the 403 shows the gate and not the line |
| P2-S12-AC-072 | 5 | PROVEN (403); BOUNDARY (separation_of_duties branch) | supabase/tests/phase_02_slice_12_gaps_db1_governed.sql: creator designer2 holding a standing cms.reviewer grant, submitter = owner: assignment refused reviewer_not_eligible, decision refused 403 capability_missing, stores unchanged, independent reviewer control approves. The separation_of_duties branch needs an assignment for the creator/submitter, which the assignment guard forbids: unreachable by any lawful state. |
| P2-S12-AC-083 | 2 | PROVEN (labelled seam) | supabase/tests/phase_02_slice_12_gaps_db1_recheck.sql: activate and schedule with a changed subject hash and with a changed policy basis each commit the invalidation (dependency_changed, review v3, subject draft, no event, no schedule, stored 409). Both frozen sides are immutable, so the CURRENT-side readers cms_governed_subject_resolve / cms_governed_policy_basis are wrapped (rename-aside + transparent wrapper, restored byte for byte); the recheck function itself is unmodified. |
| P2-S12-AC-084 | 2 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_governed.sql: curator refused on a template review (404 unassigned / 403 assigned), designer refused on a taxonomy review (same split), subject/review/reservation stores unchanged; designer activates the template, curator activates the taxonomy |
| P2-S12-AC-088 | 2 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_governed.sql: three real labelled types; the served policyBasis is [Gap B/cms.disclosure.policy, Gap B/editorial, gap a/editorial] (label then policy key, C collation) |
| P2-S12-AC-101 | 3 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql: another owner's ACTIVE type (alone and mixed with owned types) is VALIDATION_FAILED at /compatibleTypeIds with stores unchanged; own-types control accepted |
| P2-S12-AC-105 | 6 | BOUNDARY | (a) wiring CmsPatternSelector into the designer: the selector lists by ONE content type while a pattern names up to 64 compatibleTypeIds - FE03 885/1110 does not say which; (b) node paths on cycle/depth/node-count refusals: CMS-03C-12 names no node (DEC-227 Q7 implementation gap). CmsPatternNestedPicker.tsx's BOUNDARY note is stale (the CMS-03C-13 route exists); pinned by the closeout test. |
| P2-S12-AC-107 | 1 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql: another owner's ACTIVE content type answers P0001:NOT_FOUND, identical to an absent id, no list, no effect |
| P2-S12-AC-108 | 3 | PARTIAL / BOUNDARY | supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql proves a draft version row of the other organization is never listed. An ACTIVE foreign version that otherwise qualifies cannot be produced without that organization's own governed chain (initialize_cms_owner + reviewer + assigner), so the owner predicate cannot be isolated from the state filter. |
| P2-S12-AC-137 | 3 | BOUNDARY | Whitespace collapse is unobservable in Phase 2 (facet codes contain no space), as the limitation states. |
| P2-S12-AC-138 | 0 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_acl.sql: proacl of cms_canonical_taxonomy_match is {wejammin_cms_definer} only; sole referrer cms_term_overlap_check <- cms_term_apply_write <- cms_act_taxonomy_term; cms_governed_first_unbuilt_domain reads provider_state (DEC-227 Q5; the limitation named cms_act_taxonomy_term as the direct caller: the real chain has one intermediate step) |
| P2-S12-AC-143 | 3 | PROVEN (3 of 4 sub-clauses); BOUNDARY (hash / policy basis) | supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql: creator grant ended -> activation_authority_ended; canonical provider unbuilt at fire -> canonical_source_unavailable; subject no longer scheduled / approval no longer approved -> approval_invalidated. A changed frozen subject hash or policy basis at fire is unreachable (both sides immutable; the claimed schedule is the only window) - the dependency_changed outcome is e3 in governed_schedule/050. |
| P2-S12-AC-144 | 1 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_acl.sql: claim/execute wrappers grant EXECUTE to service_role and the owner only; private functions owner-only |
| P2-S12-AC-144 | 3 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql: grant END (term passed, not revoked) blocks; a grant ending after the fire instant completes |
| P2-S12-AC-144 | 4 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql: scheduler step-up 9m50s old at acceptance (>600 s at fire) still completes; execute reads no step-up/MFA input |
| P2-S12-AC-147 | 3 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql f6: a temporary BEFORE UPDATE trigger refuses the final schedule CAS -> no event, no audit, no state change; the same lease then completes with one event and one audit |
| P2-S12-AC-147 | 4 | PROVEN | same file: grant-end recheck and absence of MFA recheck (AC-144 #3/#4) |
| P2-S12-AC-147 | 7 | PARTIAL (cited) | supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql drives approval_invalidated, activation_authority_ended, canonical_source_unavailable; dependency_changed = governed_schedule/050 e3, retries_exhausted = governed_schedule_ladder (existing identities, not rewritten) |
| P2-S12-AC-148 | 2 | PROVEN (resolver); BOUNDARY (Shard 04 projection) | supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql: gate verdict and cms_resolve_locale_field agree for missing, ok and stale no_fallback values; acl.sql: the gate and the field resolver both run the core cms_locale_resolutions. The Shard 04 delivery projection is a later shard with no boundary stub: split off. |
| P2-S12-AC-150 | 2 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_acl.sql: owner-only proacl for cms_resolve_locale_field and cms_locale_resolutions; the registered callers of the core are exactly the publication gate, the CMS-03C-04 reader and the field resolver; no function calls cms_resolve_locale_field |
| P2-S12-AC-152 | 0 | BOUNDARY | Shard 04 delivery projection not built (no migration, Worker or SQL function calls the resolver except the gate and the editorial read): nothing to test; needs the Shard 04 slice. |
| P2-S12-AC-152 | 1 | BOUNDARY | same |
| P2-S12-AC-152 | 3 | BOUNDARY | same |
| P2-S12-AC-159 | 4 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_template.sql: only the active type with an active version (typeKey/activeVersionId/activeVersion equal to the stored row) is listed; retired type, type with no active version, another owner's type absent; the artifact state CHECK allows only compiled |
| P2-S12-AC-159 | 6 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_template.sql: 129 owned supported candidates -> exactly 128 in C order; deprecated, withdrawn and foreign blocks absent; selector members exactly {blockKey, blockVersion}; packages/contracts/src/cms-composition/template.context-bounds.test.ts: 128 accepted / 129 refused (and 64/65) |
| P2-S12-AC-161 | 1 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql: invited tenure, ended tenure, expired end date, foreign acting party, person-less user (FORBIDDEN) and unknown actor (UNAUTHENTICATED) are refused; restoring the tenure restores the read |
| P2-S12-AC-161 | 3 | PROVEN | same file |
| P2-S12-AC-161 | 8 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql: a context read writes no audit/outbox/idempotency/template row; after a successful read and a grant end, CMS-03C-01 is refused FORBIDDEN |
| P2-S12-AC-173 | 1 | PROVEN | supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql: a key held by another owner is the same NOT_FOUND as an unused key; a shared key reads each owner's own lineage; the other-organization-only key is hidden from the owner |

## Files (new)

| Path | Lines | SHA-256 |
|---|---|---|
| `supabase/tests/phase_02_slice_12_gaps_db1_acl.sql` | 86 | `874f12241a4b1b6b93825e17c29de0a025b4d0128a1b1d5b12b435f9b336f538` |
| `supabase/tests/phase_02_slice_12_gaps_db1_governed.sql` | 285 | `1d1c7e4910bc08bf3a214818c8aa605e52f796022d27fa947eb1eaca6cead182` |
| `supabase/tests/phase_02_slice_12_gaps_db1_locale_gate.sql` | 62 | `f4b904cdf152780e2d1639ad9a85e7c1c203e322f22c5f2f42f0ddc5bf5c8bc8` |
| `supabase/tests/phase_02_slice_12_gaps_db1_locale_variant.sql` | 172 | `d3900550665bdad24e7ed0ff4bbbbb05044057d2f04b176bc35b4f4c72dc803a` |
| `supabase/tests/phase_02_slice_12_gaps_db1_pattern_placement.sql` | 116 | `4b89bb3b5c4992fd1938afd906d0440d3c1b6917d6b546bdba86854ae9b76cb0` |
| `supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql` | 190 | `4ef168ae9db135a7713be57784e6b2a7a987975147c9fc65f1c25aa87e5a2224` |
| `supabase/tests/phase_02_slice_12_gaps_db1_recheck.sql` | 146 | `193edf6ef2bd9e7b39c01473472070c7b117bc337f8146285b7af87a7259a45c` |
| `supabase/tests/phase_02_slice_12_gaps_db1_schedule_fire.sql` | 209 | `4989a5aa228447c857b1fd8d9480fb50ec25943bd0129b74859bcf0db0f17236` |
| `supabase/tests/phase_02_slice_12_gaps_db1_template.sql` | 162 | `067f64b79d74680a0d2dc89f7606ae4b51f6d0f91e21be8fa128b5697bfb77bc` |
| `supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql` | 84 | `5e2fc7fa8637441231bcf0330cab976a85a147bbd0c40864d92a70154b944520` |
| `supabase/tests/phase_02_slice_12_gaps_db1_template/000-fixtures.sqlinc` | 100 | `9f72d82acf0c5bd919ed5844975e83525230b216faabd5287d14da0302b4d3e6` |
| `supabase/tests/phase_02_slice_12_gaps_db1_template/README.md` | 13 | `af2e851baba6180c0312c9fc2cbde4211ec4dd3c0701fd0b5465852d1201df2a` |
| `apps/worker/src/cms-composition/pattern-instance-routes.malformed-ids.test.ts` | 126 | `7101fc988c4466e33f8c826fafdf3165aa88c7df1c7deb943ab8706a989eeab4` |
| `tests/contracts/phase-02-slice-12-closeout.test.ts` | 308 | `74bba99567ed2c0a02d51857fb22cecc8e9d0548971833957d2b2100af792a9e` |
| `packages/contracts/src/cms-composition/template.context-bounds.test.ts` | 53 | `f1d3a831281c38d801a24975a9ed10ec75e20f69d6aeb294cf290ccf6fa9d98f` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.leave.test.tsx` | 146 | `d041a7ee370e630e680533e6d7eb275ce7ede01f080979f1b36b85a9bc819841` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.retry.test.tsx` | 94 | `d70b819c323b1d9971e9791719e355ec7c71ce3a31dbec61e8dd78c7d9ee56e8` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermLeaveConfirm.tsx` | 31 | `231c107529936363911c1fc14fb8a938e6f7405c4201911fa03687602ccfba25` |
| `apps/web/src/components/cms-governed-review/CmsGovernedLifecycleIcon.tsx` | 57 | `b530f9fbfb64a804698cb1d010bb51a5fe382d038a52e332f92856ca1a73965f` |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.icon.test.tsx` | 75 | `1c9fb0ae9b0ad3f0bd1c4fe77f547c72933bfb3581af41ab48fa3ca4a6402dff` |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.not-found.test.tsx` | 90 | `e8bb207bb32c4b4df4246d45c152fd6d35a5536859829e87ed75ed06d3bc3fa4` |

## Files (product edits, named per the brief)

| Path | Lines | SHA-256 | Change |
|---|---|---|---|
| `apps/web/src/components/cms-taxonomy-terms/use-term-form.ts` | 322 | `75fd65d48f6b918184053051634f086089e79217c82a987bff5deb863aab3253` | isTermFormDirty + `dirty` in the hook result |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx` | 212 | `846334144e37d6726fa09020b2587fbce5fc75b3c775ba67cd04fa6ce3379fb3` | useCmsEditorialLeaveGuard wiring, navigate seam, inline confirmation |
| `apps/web/src/components/cms-taxonomy-terms/README.md` | 74 | `8632e0a5b0c29c462a79428c4fd76a6782da929c065f803007ef1b25d3119202` | documents the leave confirmation |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.tsx` | 142 | `5a53ec005765df6fc1c1f77c0e8c12eb645731691f511e20070a91d1aa53c010` | lifecycle icon beside the lifecycle text |

## Runs

| Run | Files | Result |
|---|---|---|
| run1, run2, run3, run5 | template, placement, governed | harness failures only (artifact/definition hash uniqueness, tenure check constraints, detail empty string vs NULL, lineage id of a first version equals its row id): fixed in the tests |
| run4 | template + placement + governed | template and placement GREEN; governed iterated |
| run6 | governed + pattern_types | pattern_types GREEN (36); governed fixture order (DEC-108 chain must precede the party update) |
| run7 | governed + acl | governed GREEN 33/33; acl 16/17 (the term-overlap caller chain has one more step) |
| run8 | acl + schedule_fire | acl GREEN; schedule_fire 27/28 (now() is the transaction start; clock_timestamp()) |
| run9 | pattern_types, locale_variant, locale_gate, recheck, schedule_fire | all GREEN except locale_variant harness (foreign entry needs a foreign-owned type: cms_content_entries_type_owner_fkey) |
| run10 | locale_variant | GREEN 13/13 |
| final1 | all ten entrypoints | `Files=10, Tests=304`, PASS, TAP SHA above (per-file plans: template 24, template_context 17, pattern_placement 40, governed 33, pattern_types 48, acl 17, locale_variant 13, locale_gate 66 (60 included gate assertions + 6), recheck 18, schedule_fire 28) |

Every failure was classified: all of the above are harness errors (test fixtures), none a product defect.

## Test corrections
None. No existing test or oracle was edited.

## Spec citations
BE03c 149, 175, 188, 193, 382-388, 398-405, 1262, 1266, 1304, 1326, 1387-1397, 1401, 1474, 1479 (step 4), 1611, 1638, 1671, 1734, 1816-1818; FE03 879, 885, 926, 1110; DEC-226 (rules 1-5), DEC-227 (Q1, Q2, Q5, Q7), DEC-120, DEC-121, DEC-188, DEC-190, DEC-192.

## Open items / BOUNDARY
1. AC-001 #3 - spec silent (accessibility_contract inside a template).
2. AC-023 #1 "allowlisted" - no distinct rule.
3. AC-010 #2 / AC-016 #1 - composed apispecs not written (infrastructure): `tests/postgrest/support/phase-02-slice-12-composition-stack.ts` mounts only the template, detail and locale routes and there is no governed-chain fixture helper for an ACTIVE pattern / taxonomy over the real stack. Needed from root: a support helper that drives CMS-03C-12/-14 -> -06 -> -08 -> -07 -> -09 through Kong (or psql RPC calls as the pgTAP chain does) and mounts `createCmsPatternInstanceApp` / the taxonomy term route; then the two apispecs are ~120 lines each. I did not write them blind (they could not be run here).
4. AC-055 #4 - DEC-227 Q2 owner question.
5. AC-056 / AC-061 Tier 2 p95 - hosted evidence (perf lane); AC-061 #9 consumer-vs-recompute owner decision.
6. AC-069 #6 - copy quote versus the existing test string.
7. AC-072 #5 - separation_of_duties branch unreachable by lawful state (defense in depth).
8. AC-083 #2 - proven only through a labelled substitution of the CURRENT-side readers (both frozen sides are immutable).
9. AC-105 #6 - nested picker wiring ambiguity and absent node pointers.
10. AC-108 #3 - active foreign version cannot be produced.
11. AC-137 #3, AC-152 x3 (Shard 04 projection), AC-148 #2 second half.
12. Feature-ledger drift: `25.05.03` and `25.05.04` read "—" while the phase plan lists them for Slice 12 (pinned in the closeout test as KNOWN DRIFT).
13. Bundle budget: the term form now imports the shared leave-guard hook (small); the web static-closure tests pass, root's bundle gate should confirm.
14. AC-056 #9 note: idempotency reservations are per actor by design; BE03c 149 ("changed actor returns 409") is satisfied observably only through the stale entry version.

## Requests to root
- Decide AC-069 #6 (align the panel copy + the existing test, or amend the FE03 quote).
- Decide AC-055 #4 (DEC-227 Q2), AC-061 #9, AC-105 #6, and the feature-ledger rows for 25.05.03/25.05.04.
- Provide the governed-chain stack helper (item 3) or accept the layered candidates for AC-010 #2 / AC-016 #1.
- Cite the new identities in the ledger (the ledger apply lane); computed descriptions: the `s12pl_refused`/`s12pd_refused` titles are generated, cite them under the entrypoint `.sql` (DEC-226 rule 5).
- Run the canonical gates over the new files; they need no unpromoted migration (lane `none`).
