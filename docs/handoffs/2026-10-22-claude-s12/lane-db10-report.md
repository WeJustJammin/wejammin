# Lane claude_s12_db10 report (DEC-247)

## Status
GREEN. db9b's seven `[RED]` assertions pass with three WIP migrations (112/112 on the staged ALT runner, lane db10); 27 existing pattern, provider, placement and
preflight pgTAP files pass except two AC-279 timing assertions that fail identically on promoted migrations only (host load, see Runs). Contract and copy tests per token pass.
Bundle budget passes, thresholds unchanged. Nothing promoted, committed or staged.

## Scope
DEC-247: re-prove the CMS-03C-12 depth and node bounds in the `cms.pattern.active_digest` provider (before publish) and at CMS-03C-02 placement. BE03c 388, 1585, 1678, 1694; ledger P2-S12-AC-211 clause "again before publish".

Design:
- Depth rule is the producer's own: `cms_pattern_nested_closure` depth >= 9 (cms_create_pattern_version, 20261014020400), never a second constant. Node rule: the roots `cms_pattern_placement_nodes` expands (what placement already refuses above 512).
- `cms_pattern_placement_plan` needs no change. The live producer calls `cms_pattern_placement_selected_plan` (20261016043500, since 20261016043700 / 20261022080300), and both plans call `cms_pattern_placement_nodes`; plan's `v_roots > 512` already answers `pattern_nodes_exceeded` at `/patternId`. So the single depth change in the shared expander covers every plan (the brief named `cms_pattern_placement_plan`; I judged it dead for this purpose and did not replace it).
- Provider order per BE03c 1585: not_active, nested_not_active, depth, nodes, digest_changed, block_rules_violated. In `cms_pattern_live_pin_reason` the two checks sit after nested activity/containment and before the content-hash/digest check, so the digest function never walks a too-deep graph. `blockingCount` stays one unit per offending live pin.
- A mutual lineage cycle is not producible (db9b BOUNDARY facts), so `pattern_cycle` from the expander in the provider would only surface as the category `unavailable` through the function's existing `exception when others`.
- Cost note: the node count expands the pinned forest once per live pin (same expansion placement does). Bounded by the depth check first and the 30 s statement timeout; a pathological legacy forest fails closed as `unavailable`, not `passed`.

## Files
WIP migrations (untracked, root promotes in this order; tar backup not needed, all newly created):
| Path | Lines | SHA-256 |
| ---- | ----- | ------- |
| supabase/migrations-wip/db10/20261031110000_cms_pattern_placement_nodes_depth.sql | 95 | 03eacf2f26f3429d97dc78a9ed6ded9da909436bd9189b03309d1f1497132b55 |
| supabase/migrations-wip/db10/20261031110100_cms_pattern_live_pin_reason_bounds.sql | 98 | 867063411a0953f626564283d03eb94da62c151dde7fcc96fb6c2c5fe3373de2 |
| supabase/migrations-wip/db10/20261031110200_cms_pattern_active_digest_bounds.sql | 88 | bb534fa177cbb30accd0f12eb82778bc5a53aa566074ced18b74d28c446cba44 |
| supabase/migrations-wip/db10/README.md | 20 | 9fa031fb51b9e103bdb1b038c21db776bdd0267fb4f454457e3fd7570123bcc6 |

Each migration is a guarded anchored replacement in the style of 20261022080500 (anchor occurs once, inverse restores the installed source byte for byte, every `pg_proc` attribute except source unchanged); comments are restated.

New tests:
- supabase/tests/phase_02_slice_12_gaps_db10_bounds.sql (28 lines) deab603ba4f8247c6ee813770b09ec48644700b936b2dcf1f808d3bca1c9fe3c
- supabase/tests/phase_02_slice_12_gaps_db10_bounds/010-boundary.sqlinc (81 lines) ea8a785af062e8a9b3f386d6d36e991799d05d69db4aa8d68b79de9467c6dbf6

Contracts and web copy (tracked files, edited):
- packages/contracts/src/cms-composition/preflight-providers.ts (+2 tokens) 1870e7dfab9cc8ae743429a4bb91031f8a6a7e10d49a248d70fd0949cf230230 (this is the contracts package, not the web `cms-composition/` component dir)
- packages/contracts/src/cms-editorial/preflight.ts (+2 tokens) a73d36dfd76465df2de370eebf0212983ca96708f8ee04f4441580215ff08c6b
- apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.ts (+2 sentences) 57879e7d71d091eef2f2a17877f53d9ad12a9ef0a12de18d797b908fa951fbbd
- tests updated: packages/contracts/src/cms-composition/preflight-providers.test.ts, packages/contracts/src/cms-editorial/{preflight.test.ts,preflight-reasons.test.ts,preflight-pattern-provider.test.ts}, apps/web/src/components/cms-editorial-workflow/cms-workflow-pattern-reasons.test.ts
- proposals: docs/handoffs/2026-10-22-claude-s12/recite9/db10-proposals.json baa9c6002463fd41038fdc56cd679272b6080abb5bc39b6a3776f2fbffa8f861

Token order in the contracts is `[pattern_not_active, pattern_digest_changed, nested_pattern_not_active, pattern_depth_exceeded, pattern_nodes_exceeded, pattern_block_rules_violated]`; the existing list is not in precedence order (digest before nested) and I kept that, inserting after `nested_pattern_not_active`.
The placement-side tokens (`pattern_depth_exceeded`, `pattern_nodes_exceeded` at `/patternId`) already exist in `packages/contracts/src/cms-composition/refusals.ts` and in the worker mapper `placementRpcError`; no change needed there. Not touched: `apps/web/.../cms-composition-instances/composition-copy.ts` (web9 zone); placement refusal copy for the two tokens there is unchanged and was not examined for the 9th-level case, flag to root if FE03 names it.

## Runs (all through lane-db-alt-staged.sh, foreground; TAP copies in scratch `.../scratchpad/claude_s12_db10/`)
| # | Time | Lane (WIP) | Plan | Result | First failure | TAP | SHA-256 |
| - | ---- | ---------- | ---- | ------ | ------------- | --- | ------- |
| 1 | 17:51 | none | db9b RED suite | 112 tests, 105 ok, 7 FAIL (106-112) = the 7 `[RED]`: fixtures and controls green, provider answered `passed`, placement placed l-deep (genuine missing feature, not harness) | not ok 106 | .lane-logs/alt-staged-none-175139-1325785.tap | d63dbec3243363982a6a59aa108df7f69a96e0f5d9ccd9a2430d5cc38b0c5aa7 |
| 2 | 17:53 | db10 | db9b RED suite | 112/112 PASS | - | .lane-logs/alt-staged-db10-175347-1335179.tap | c269929000f160fbfa97e24d17525afcdac0660bb54b9a4f3148a06662d34ea2 |
| 3 | 17:54 | db10 | 27 existing files (db9b facts, block_rules x2, dec191 x3, dec193 currentness, db1 placement/types, db9b selector, pattern_governed, placement_owner, governed recheck/retire, pattern_definition, pattern_placement, pattern_selector, update_diff, pattern_updates, placement_perf x2, race_fixes_pattern_locks, gaps_perf_patterns, nestable_read x2, slice_11 helpers_preflight, preflight_registry_schema) | Files=27 Tests=6163: 6161 ok, 2 FAIL | not ok 29 (gaps_perf_patterns: save of a 512-node forest p95 < 300 ms), not ok 41 (placement of 512 rows p95 < 300 ms) | .lane-logs/alt-staged-db10-175443-1339978.tap | b93539275aca556c2c946d7af2d1a2c36f2d0e3e1c92c951b811bbaa5fbd1750 |
| 4 | 18:10 | none | gaps_perf_patterns only | same two FAIL on promoted migrations only (host load average 6-10 during all runs, other lanes running) | not ok 29, 41 | .lane-logs/alt-staged-none-181048-1407643.tap | 1b3f8f96d369f3acfd37192479a1bc3fd7068627131e0ffd0d2fa87e889dede1 |
| 5 | 18:12 | db10 | gaps_db10_bounds + db9b RED | Files=2 Tests=239 PASS | - | .lane-logs/alt-staged-db10-181247-1421218.tap | 7c0f61c8ec14d8d7f9abefcee9ef72dc0aa789da870c66a35bbcd02e7d07a952 |
| 6 | 18:14 | none | gaps_db10_bounds only | 127 tests, 2 FAIL (126 reason order, 127 blocking count) = the aggregation assertions fail without the WIP; the at-bound controls pass | not ok 126 | .lane-logs/alt-staged-none-181401-1427197.tap | 1da204c1a8a2773f0b4e34dbefaa3fdd7f1397444b40fc4d06feb4e5310ef9bb |

AC-279 timing (not a regression of this change): the two failing assertions are CMS-03C-12 save (untouched by DEC-247) and placement of 512 rows. Run 4 vs run 3, p95: pat_create_512 401.6 vs 518.5 ms, place512 575.1 vs 547.1 ms, place32 39.5 vs 50.6 ms. The baseline without the WIP fails the same 2 and is no faster on placement, so the closure check adds no measurable cost at 32 references. Run 3 overlapped a Vitest run I made (my fault for the noisy part); run 4 did not, and still failed. The perf assertions need a quiet host; root's canonical `db:verify` is the authority for AC-279.

Vitest (foreground): the five touched test files RED first (11 failed, right reason: expected token lists and copy not present), GREEN after (50 passed); then `packages/contracts` + `apps/web/src/components/cms-editorial-workflow` whole: 250 files, 3001 tests pass.

Bundle (`flock /tmp/wejammin-web-build.lock sh -c 'pnpm build ... && cp -r apps/web/dist <scratch>/dist && node scripts/verify-bundle-budget.mjs <scratch>/dist'`): build ok, verifier exit 0, `passed: true`. Workbench (InfrastructureWorkbench) 19,287 B gzip of 35,840; initial route 79,116 B of 92,160; largest lazy chunk 51,526 B of 81,920; thresholds unchanged. The build includes other lanes' uncommitted edits, so absolute figures are not attributable to this lane; my web delta is two sentences in a label map (about 0.1 KB gzip). Output `bundle.json` SHA-256 c1d54d0b0f1501290dd3f812f3a9713abff9ae8b6d3a74f9899a5004448cb74c in scratch.

## Test corrections
None. No existing RED assertion edited. Existing contract/web tests changed only to add the two new tokens to the expected lists (insertion after `nested_pattern_not_active`); each is a one-element-pair insertion in `preflight-providers.test.ts`, `preflight.test.ts`, `preflight-reasons.test.ts`, `preflight-pattern-provider.test.ts` (PATTERN_REASONS) and `cms-workflow-pattern-reasons.test.ts` (PATTERN_REASONS, title "four" to "six"). New tests: one explicit DEC-247 test in `preflight-pattern-provider.test.ts` and one copy test in `cms-workflow-pattern-reasons.test.ts`; the existing loops over PATTERN_REASONS now give a contract test per token.

## Spec citations
BE03c 388 (CMS-03C-02 graph row: 9th nested level 422 `pattern_depth_exceeded` at `/patternId`; 513th root `pattern_nodes_exceeded`), 1585 (provider reasons and order, re-proved bounds over the expanded forest of every live use), 1678 (before save and again before publish), 1694; changelog 2026-10-31; DEC-247; ledger P2-S12-AC-211.

## Open items / BOUNDARY
- `pattern_cycle` stays unreachable by a producible row (db9b BOUNDARY facts); no change.
- Update-time expander `cms_pattern_update_nodes` (linked update, CMS-03C-15) has its own copy of the expansion and no depth re-proof; DEC-247 names only provider and placement, so untouched. Root may want a ruling.
- AC-279 timing assertions fail on this loaded host with or without the WIP.

## Requests to root
1. Promote the three WIP migrations (order above; no timestamp collision, range 20261031110000-110200), run canonical `db:verify`/`validate` on a quiet host.
2. Record the AC-211 "again before publish" citations from `recite9/db10-proposals.json` after promotion (clause index 2, 14 titles).
3. Decide whether FE03 names placement-refusal copy for a 9th-level `pattern_depth_exceeded` in `cms-composition-instances/composition-copy.ts` (web9 zone, untouched).
