# Lane claude_s12_db9b report (wave 9 single-session database gaps)

## Status
PARTIAL. Items 1, 2, 3 and 5 are GREEN (5 with BOUNDARY items). Item 4 found a DEFECT: a RED suite (7 `[RED]` tests) and a WIP note stop for root; no
migration was written because the fix needs a root decision (spec reason list). No product code, ledger, receipt, tracker, spec, promoted migration, web
code or other lane's file was touched. No sub-agent, no race, no canonical db command, no Playwright. Final bytes were all run on 2026-10-31 (ET 17:35-17:45).

## Scope
Brief `briefs/gaps-wave9-db.md`, section db9b: 1 V18 MINOR-2 / DEC-243; 2 AC-108 c3 / AC-190 c2; 3 AC-146 c5; 4 AC-211 c1 "again before publish";
5 AC-044 "deletion". New SQL test files only (lane `none`: promoted migrations only, 0 WIP migrations applied).

## Per-item outcome
| Item | Criterion, clause | Outcome | Identity (file, TAP tests) |
| ---- | ----------------- | ------- | -------------------------- |
| 1 | V18 MINOR-2 (DEC-243, P2-S09-AC-145 analogue) | GREEN: a designer of a second organization receives exactly the first designer's selectors (same members, same order), fresh and with the RPC flag leaked; the ungranted control is FORBIDDEN; types stay owner-scoped; a later-registered block reaches both | `phase_02_slice_12_gaps_db9b_template_context.sql`, 37 |
| 2a | AC-108 clause 3 "or other-owner version is never listed" | GREEN with BOUNDARY (below): real ACTIVE rows of the first owner (CMS-03C-12 + governed chain) are never listed to the second organization; positive control lists them to the first owner; concealment of the foreign type equals an absent type; the other owner's activation moves nothing in the caller's page or pageVersion | `phase_02_slice_12_gaps_db9b_pattern_selector_foreign.sql`, 51 |
| 2b | AC-190 clause 2 "selectors)" | GREEN: the taxonomy selector's owner predicate is ISOLATED (active vocabularies and terms of the first organization whose allowlists name the same type key and field key; the second organization's page is empty; first organization's page is non-empty and equals the independent oracle) | `phase_02_slice_12_gaps_db9b_taxonomy_selector_foreign.sql`, 34 |
| 3 | AC-146 clause 5 "with the prior active version intact" | GREEN for all five closed reason codes: `activation_authority_ended`, `approval_invalidated`, `canonical_source_unavailable` (taxonomy lineage), `dependency_changed`, `retries_exhausted` (real 15/60/300 s ladder). Each lineage has a REAL prior active version 1; after the block it is the byte-identical row, still active, `activated_at` unchanged, never retired, the only active member, no supersession, no event, no audit record. A completing control shows the same assertions would fail on a supersession | `..._fire_prior_active.sql` 43; `..._fire_prior_retries.sql` 21 |
| 4 | AC-211 clause 1 "again before publish" | DEFECT (RED) + BOUNDARY, see below | `..._legacy_forest.sql` 121 GREEN facts; `..._legacy_forest_red.sql` 112, 7 `[RED]` fail |
| 5 | AC-044 clause "deletion" | GREEN for the one deleting command that exists (CMS-03C-09 retire of a pattern lineage); BOUNDARY for entry and composition-instance deletion | `phase_02_slice_12_gaps_db9b_deletion.sql`, 59 |

## Files (path, lines, SHA-256)
| Path | Lines | SHA-256 |
| ---- | ----- | ------- |
| supabase/tests/phase_02_slice_12_gaps_db9b_template_context.sql | 139 | a9b11fb7f38393d714aac69726abdca1caf8f901041dfe284b904c4ac1e767b5 |
| supabase/tests/phase_02_slice_12_gaps_db9b_pattern_selector_foreign.sql | 186 | c912712d7dfe0779dfe5f316aae70b6820f704b7b3a317810e482f981967d72e |
| supabase/tests/phase_02_slice_12_gaps_db9b_taxonomy_selector_foreign.sql | 116 | a1fc7578039a2ead555298ed93c64c34da6130785c3264b25b997873ccd5aaf9 |
| supabase/tests/phase_02_slice_12_gaps_db9b_fire_prior_active.sql | 251 | 9c2d904191d774eb8363ae7f825f732614f4a27a0935176952a50250967c442d |
| supabase/tests/phase_02_slice_12_gaps_db9b_fire_prior_retries.sql | 123 | 38f5f07654300b8939e829896bc8b503d666e10c74a932ecb50f30df06f0583c |
| supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest.sql | 26 | 95f88d6374e1929462df1ebfda5bfd3a5cdf253e9afecc2895c8256985a2ab08 |
| supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest_red.sql | 26 | 68dbe0a56dc34c91ca970cc2059d28e95cd5b326d679b59af012ef46a0ba7ebd |
| supabase/tests/phase_02_slice_12_gaps_db9b_deletion.sql | 231 | 83368b3f742cdc44e7a53ca75eb44968c1a539596e94d6712e15688cdfe614e4 |
| supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest/000-world.sqlinc | 98 | 1c4db7a1ee2f3a40b8f6bcd9a65300736ae39c00a034cf3015a1ab10aa28f226 |
| supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest/010-facts.sqlinc | 70 | c09cde4e60e4d15bc52d2e9eb9c424abc34cd446878d4baf66c3172105c23834 |
| supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest/020-red.sqlinc | 24 | 5985186e12f4c11a90aef8847ce94acde88968124fca67e579086e5228522147 |
| supabase/tests/phase_02_slice_12_gaps_db9b_legacy_forest/README.md | 16 | 0d93422f2ff481d35c7c5d7a92e6e48c183d2dbce7261e1684d2ff2139f9d42b |
| supabase/tests/phase_02_slice_12_gaps_db9b_support/010-consumer-bootstrap.sqlinc | 75 | 8805339e07692365664b9dc57da99bf5b18ba4c450ee96ff4105fbb54e118ac4 |
| supabase/tests/phase_02_slice_12_gaps_db9b_support/020-provider.sqlinc | 20 | 634384489ad3401e1cd1dbbef7a8b72b3d49328225c05d57698d00823186471c |
| supabase/tests/phase_02_slice_12_gaps_db9b_support/README.md | 9 | 6bf0d76fe8ba3d24d5d724aabdf560ae0f82033a26221101d8120888fd72359e |
| supabase/migrations-wip/db9b/README.md (note only, no SQL) | 22 | 8293c6bcbc83cad6cec82eb83a0aedc410ea869d447759890891d5ee78248410 |
| docs/handoffs/2026-10-22-claude-s12/recite9/db9b-proposals.json | | f4880072917cebd4e283a8ac10496a8189e73851fbd2d6d278e8f570f7321ba2 |

Scratch: /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_db9b/ (ledger reader, proposal generator). No untracked
file was edited in place, so no tar backup was needed (the AC-277 U1 edit of `race8_related.sql` belongs to db9a).

## Runs (all lane `none`, staged ALT runner, TAP under .lane-logs/)
Final-bytes runs:
| Run | Files | Result | TAP | SHA-256 |
| --- | ----- | ------ | --- | ------- |
| A1 17:35 ET | template_context 37, pattern_selector_foreign 51, taxonomy_selector_foreign 34, fire_prior_active 43, legacy_forest 121, deletion 59 | pass, Files=6 Tests=345, 78 s | alt-staged-none-173525-1266705.tap | 769aaf6e9d6f1da61045e77d2425e0fc6694c77b63f540769ef602a238314b38 |
| A2 17:37 ET | fire_prior_retries 21 | pass, Tests=21, 445 s | alt-staged-none-173718-1273725.tap | 6580fdec111c791a10a95f195d220ab179a67569dfcb4185658ad0ef0544e6e1 |
| B 17:45 ET | legacy_forest_red 112 | FAIL by design: tests 106-112 (the 7 `[RED]`), 105 setup/control pass | alt-staged-none-174519-1302112.tap | 291b7f1d691c491ba7927be283f35241a0cdf0f16636887b452935ae28c81de2 |

Earlier runs (all classified): item 1: harness (request built under role service_role, 42501), then my wrong expectation (two active owner types); item 3: my
wrong expectation (`approval_invalidated` returns the successor to draft, not blocked); item 2 pattern: genuine BOUNDARY (below); item 4: harness (a STABLE
helper in one statement does not see rows written by an earlier lateral call: p3 failed; fixed with one statement per pattern), digest fixture (legacy rows must
carry the platform's own digest or submit refuses), and manifest NOT_FOUND (the pinned row's path must be a root chain the pinned forest really expands to);
item 5: harness (idempotency key too short; every event of one transaction shares one `occurred_at`, so "newest event" must order by aggregate_version).
Test 48 of the deletion file flaked once on that tie before the fix; the final bytes ran green once after the fix (A1).

## Test corrections
none (no existing test changed).

## Spec citations
- Item 1: DEC-243 (BE03c:206 amended, FE03:1129), migration 20261029150000; oracle phase_02_slice_09_p240_reads_detail.sql:110 (P2-S09-AC-145); review V18 MINOR-2.
- Item 2: BE03c 175, 1266, 1363, 1474 (selector), 405 (type in the caller's owner scope), 1377/1478 (taxonomy selector); E14 (AC-190).
- Item 3: BE03c "Scheduled activation" (CMS-03C-19, line 188), ladder 15/60/300 s; DEC-120 (no MFA at fire).
- Item 4: BE03c 1678, 388, 1694, 408, 1585; ledger AC-211.
- Item 5: IA03:533 (CMS-12), BE03c "Retirement removes exposure only" (DEC-190), BE03b 1891/1964/1980/2005, 20260926090000:33-34.

## Open items / BOUNDARY (with lines)
1. **Item 2, an ACTIVE row of the SECOND organization is not producible by the real path.** CMS-03C-08 assign and CMS-03C-09 activate require the review's `owner`
   scope, which `platform_private.cms_governed_review_scopes` grants only to the holder of a `cms_owner_initialization` receipt of that organization
   (supabase/migrations/20261013300500_cms_governed_review_support.sql:92-99); the receipt is single-use (`BOOTSTRAP_ALREADY_INITIALIZED`,
   20260910023405_isolate_owner_bootstrap_context.sql:39-41). Proven in both files: the second organization's submit succeeds and its assign is refused
   `capability_missing`; only the first organization holds a receipt. Forging a receipt would forge authority evidence, so none is forged. Restructured: the foreign
   rows are the first owner's real active rows; the caller is the second organization (labelled forged fixtures: its cms.author / cms.template_designer
   grants and one clone-built active content type, the S09 world's accepted forgeries).
2. **Item 2, pattern half: the owner predicate cannot be isolated from the content-type predicate.** CMS-03C-12 refuses a `compatibleTypeIds` member that is not an
   active type of the caller's owner scope (BE03c 405, AC-101 c3), so no version of one owner can name another's type. The observable clause is proven in both
   directions with positive controls; the taxonomy half does isolate the predicate (allowlists name type KEYS).
3. **Item 4, `pattern_cycle` is not producible.** Mutual cycle X<->Y: both drafts, each nested pin inactive, so submit refuses `subject_not_submittable`
   (20261013300820:154-158 as reclassified by 20261014040100:24-30, BE03c 1304). Self-lineage: at most one version of a lineage is active (partial unique index
   `cms_pattern_versions_active_lineage_idx`, 20261014020100:101-102); the closest producible cycle (version 2 pinning version 1 of its own lineage) activates and
   supersedes the version it pins, and placement then classifies it `nested_pattern_not_active` (fact test), never `pattern_cycle`. Literal-tree depth over 8 and
   over 512 nodes cannot be stored: the table CHECK `cms_pattern_versions_block_tree_valid` (20261014020100:79-92) refuses them; only the EXPANDED bounds can be.
4. **Item 5, entry deletion/tombstone: no command exists.** `cms_content_entries.lifecycle` admits archived, deletion_pending and held (20260926090000:33-34;
   BE03b 1964, 1980, 2005) but no platform_api or platform_private function writes it (catalog scan in the deletion file) and no cms_* function other than a trigger
   guard is named for delete/tombstone/archive/purge/erase. BE03b 1891 `entry_unavailable` is the reader side. Composition-instance deletion: none (DELETE refused even
   inside the RPC context, proved); the only tombstone is the retired row CMS-03C-15 accept appends for a removed root (20261014140600:241), covered by
   phase_02_slice_12_dec193_consumers and pattern_updates*.

## Defects
**D1 (item 4, RED, root decision).** BE03c 1678 says composition graphs "enforce protected depth/node/slot counts before save and again before publish"; 388 and 1694 give
CMS-03C-02 "max protected depth/nodes" and "expand graph with cycle/depth/node checks". Observed on the promoted migrations, with ACTIVE legacy rows hand-built
as drafts and made active only by the real governed chain:
- the publication pattern provider (`cms.pattern.active_digest`, `cms_pattern_live_pin_reason`) answers `passed` for a revision pinning a pattern nested TEN levels deep
  (the producer accepts at most eight levels below the root) and for one expanding to 544 block roots (limit 512);
- CMS-03C-02 places the ten-level pattern (its depth guard is the documented 128-level runaway guard, placement lane report line 226); it does refuse the 544-root
  pattern with `pattern_nodes_exceeded` at `/patternId` (GREEN fact).
RED tests (`phase_02_slice_12_gaps_db9b_legacy_forest_red.sql`, names start `[RED]`): provider outcome is not `passed` (deep, wide), provider reasonCode
`pattern_depth_exceeded` / `pattern_nodes_exceeded`, `blockingCount` 1, placement refusal `pattern_depth_exceeded` at `/patternId` with nothing written. The two
token-agnostic assertions ("not passed") separate the contradiction from the token choice: BE03c 1585 lists only `pattern_not_active`, `nested_pattern_not_active`,
`pattern_digest_changed` and `pattern_block_rules_violated` as provider reasons. Options and recommendation are in `supabase/migrations-wip/db9b/README.md`
(A recommended: placement + provider re-prove the producer's own rules; B provider only; C accept as designed and amend BE03c 1678).

## Requests to root
1. Decide D1 (options in `supabase/migrations-wip/db9b/README.md`); then a fix lane can write the anchored-replacement migration(s) in `supabase/migrations-wip/db9b/`
   (20261031105000..109999) and the RED suite becomes its GREEN witness (the `isnt(... 'passed')` pair first).
2. Apply `recite9/db9b-proposals.json` (schema of `recite2/*-proposals.json`; titles are the TAP titles; `computed` marks titles built at run time by
   `pg_temp.d9f_blocked`): AC-108 c3, AC-190 c2, AC-146 c5 propose `verified`; AC-211 (no adds) proposes `partial` with the DEFECT limitation; AC-044 proposes
   `partial` with the BOUNDARY limitation for entry/composition deletion. Do not cite the `[RED]` tests.
3. Consider a tracking issue for BOUNDARY 1: a second organization can never activate its own governed subjects; whether that is intended multi-tenancy
   behaviour is an owner question outside this lane.
4. The accepted fixtures (second-organization grants, clone-built foreign type, consumer-settings bootstrap) are labelled in each file header; the consumer
   bootstrap is copied from `phase_02_slice_12_dec193_consumers/000-fixture.sqlinc` lines 2-72 into `phase_02_slice_12_gaps_db9b_support/` rather than including
   that whole world.

No new patterns, decisions or blockers were logged to `.memory` (root owns memory capture); candidates for root: PAT "a STABLE sql helper in the same statement does
not see rows written by an earlier lateral call"; PAT "every event of one pgTAP transaction shares one `occurred_at`: order by lifecycle counter"; DEC candidate D1.
