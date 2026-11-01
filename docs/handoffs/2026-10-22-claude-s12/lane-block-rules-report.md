# Lane claude_s12_block_rules (F2) report

## Status
GREEN for this lane's scope. Contracts+Worker+Web Vitest green; block_rules.sql and block_rules_legacy.sql green; final 86-file run: 80 files pass, 6 fail for reasons outside this lane (see Open items). HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e.

## Scope
DEC-210 (BE03c "Block composition rules (DEC-210)"): registry allowedChildren/slotRules enforced at CMS-03C-12 save,
CMS-03C-02 placement, CMS-03C-15 accept/detach (writer 041600 edited in place), and the cms.pattern.active_digest provider.

## Files (final SHA-256; block-rules WIP, writer 041600 edited in place, pgTAP, contracts/Worker/Web)
| path | lines | sha256 |
| --- | --- | --- |
| `supabase/migrations-wip/block-rules/20261022080000_cms_block_rules_core.sql` | 124 | 5f5ca6da82fa92f5e14355c4fd078544692b5d9bb48e2e39ef022d9dcfa1f099 |
| `supabase/migrations-wip/block-rules/20261022080100_cms_block_rules_trees.sql` | 205 | 3cac8f04453b10c5756efbb37801cc47c2039c8546598cfc08c207cd1d75f82c |
| `supabase/migrations-wip/block-rules/20261022080200_cms_create_pattern_version_block_rules.sql` | 87 | 741281066717b800cfba2dc4c8e876020a6e4067c91a221718abd3c632d38900 |
| `supabase/migrations-wip/block-rules/20261022080300_cms_insert_pattern_instance_block_rules.sql` | 84 | 12a517d820c5a15e2610a42da30803022009bf85565ca3fb4b78de439c3df159 |
| `supabase/migrations-wip/block-rules/20261022080400_cms_apply_pattern_update_block_rules.sql` | 87 | 6d6cf4ca0843e7c53b359e462be2b8058df366c066cf0af5931d81bb767534b7 |
| `supabase/migrations-wip/block-rules/20261022080500_cms_pattern_active_digest_block_rules.sql` | 129 | a212eab0a54d1032a5c883f18854a58b0d03f3e05942d25c35aec6b0749ccb8a |
| `supabase/migrations-wip/dec193/20261016041600_cms_detached_tree_safe_props.sql` | 101 | f8fabf71cecc304a47a0b8d2d6984a387e77082ba8eb205d50ae8cc64a3dd7bc |
| `supabase/tests/phase_02_slice_12_block_rules.sql` | 26 | 70e40a761fd7a886cd0e39a181094c16e4159a2de4841009dd8e1990470c88cf |
| `supabase/tests/phase_02_slice_12_block_rules_legacy.sql` | 28 | 5cafaf3988f196e7787f0fb8625200763a9a1ad8761b70d8c06e031ea14ea9ae |
| `supabase/tests/phase_02_slice_12_block_rules/000-fixture.sqlinc` | 73 | 0c5ee61778f3d30c2201bfe423d79477bdc1d20a10961b0c23c30d99f06b4f7e |
| `supabase/tests/phase_02_slice_12_block_rules/010-pure.sqlinc` | 83 | 73bfd0d73b0dac4a788737388779edab075b1982d03518b83f4ae3a402483e93 |
| `supabase/tests/phase_02_slice_12_block_rules/020-save.sqlinc` | 46 | 64da9f579684a2de39a74f5b4262f6fc6613fd930aad2024f82d1ef6272ed11d |
| `supabase/tests/phase_02_slice_12_block_rules/030-nested.sqlinc` | 27 | a41a9ab395a3a90124ac04d27b6282c3f591a7a37ea80d76f25d25cbd8f68cba |
| `supabase/tests/phase_02_slice_12_block_rules/040-legacy-setup.sqlinc` | 105 | 1e67a5b8b3063f7d3bcffbb59079ccf29064166fb197766a4d1739408860fe8c |
| `supabase/tests/phase_02_slice_12_block_rules/050-placement.sqlinc` | 34 | cb27079b07195a2be531f61d5f3ea967e3ce1af0576b822a579869653f9ca6d6 |
| `supabase/tests/phase_02_slice_12_block_rules/060-updates.sqlinc` | 44 | 154eaa9714f87a2b4b11a12e9122102c5c584738169777358d8050fde03e13cd |
| `supabase/tests/phase_02_slice_12_block_rules/070-provider.sqlinc` | 49 | 11d05f9c2697511eeaa034fc75665c5eb035d24d074c159c1cb631b35a51c314 |
| `packages/contracts/src/cms-composition/block-rules-refusal.ts` | 64 | f3b22049b27dea8607cb7bfab48441507d9b25cdc215a95642939921c5a8dca0 |
| `packages/contracts/src/cms-composition/block-rules-refusal.test.ts` | 112 | 2001ce3ef9cf6d8bc6d2157927830b536f5a90374cf92ddb78639f8ceb96170e |
| `packages/contracts/src/cms-composition/refusals.ts` | 318 | dac4a301568a0aeccc91d78f2e7174b5b94948d86fdc9d431eee4412b2b4ca42 |
| `packages/contracts/src/cms-composition/preflight-providers.ts` | 59 | 7c4356177e040e76bd349910bc9e15202207d5f63483b79dc0ad31d67f295028 |
| `packages/contracts/src/cms-editorial/preflight.ts` | 480 | 44493eab270bdfee9f2c7fb6824cd451af2eed2ccce7acb1cd6baeddadd0b62e |
| `apps/worker/src/cms-composition/block-rules-refusal.ts` | 31 | 7aa7e59089666823873a8432b08334bfbad2583af7b25ac0ff66f13e902993e2 |
| `apps/worker/src/cms-composition/pattern-instance-details.ts` | 45 | 97ab0996b55241d4712fc71288f40f5d4246e8953d698b39fd869bd0e040e992 |
| `apps/worker/src/cms-composition-production-pattern-definition-latest.ts` | 220 | 28cfff41d8f88c021f7dde0dfebaa6d797f1295d03b2e9b2dffc2ebf9fbd1ad3 |
| `apps/worker/src/cms-composition-production-pattern-errors.ts` | 102 | 8b82b82fec5e0f21539e72d8884debc503d4d774e2c23e0e82000097eec3bb0a |
| `apps/worker/src/cms-composition-production-pattern-update-failure.ts` | 143 | 07197d9c006258f6408c547936630b80a9c701205c690a4a61b2f5d7d47a7728 |
| `apps/web/src/components/cms-composition-instances/composition-copy.ts` | 92 | dbb8675d9d02230e98b4de579c19e91c95ea2ed47c28fe44a7015d7921db519d |
| `apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.ts` | 222 | fdea12926e5f98814c7fb85a09ddbd718e657363827625690361ade89cb8114e |
| `apps/web/src/components/cms-pattern-designer/pattern-designer-reasons.ts` | 84 | 6beb635f891d4acf4b8839ea206879128a6338eee3659d12d710df63e2e4d698 |

Previous detail:
Contracts (Vitest GREEN, packages/contracts/src/cms-composition + cms-editorial 95 files / 1134 tests):
- refusals.ts (+ refusals.test.ts, refusals-operations.test.ts): `block_rules_violated` 422 token on CMS-03C-02/-12/-15, plainDetails member.
- cms-editorial/preflight.ts, cms-composition/preflight-providers.ts (+ preflight.test.ts, preflight-reasons.test.ts,
  preflight-pattern-provider.test.ts, preflight-providers.test.ts): `pattern_block_rules_violated` appended to the pattern category set.

## Design decisions (assumptions flagged)
- Pointer for CMS-03C-12 uses the request-body RFC 6901 pointer `/blockTree/{i}/children/{j}...` (BE03c says "in `nodes`";
  CMS-03C-12 has no `nodes` member). Offending node = the disallowed CHILD for an allowedChildren violation, the rule-bearing
  node for maxNodes/maxDepth. Nested-reference expansion violations point at the reference node.
- Provider precedence: pattern_not_active > nested_pattern_not_active > pattern_digest_changed > pattern_block_rules_violated.
- Placement checks only the selected roots' subtrees (what is written); accept/detach check the tree each new row carries.
- Provider checks the whole pinned version forest per live pin, and the detached tree per canonical row.

## Runs
See the table at the end of this file (runs 1-3).

## Test corrections
None. Existing oracles unchanged; contract tests were extended (new members) in `refusals*.test.ts`, `preflight*.test.ts`, `preflight-providers.test.ts`, `preflight-pattern-provider.test.ts` (closed set now includes `pattern_block_rules_violated`, P2-S12-AC-238).

## Spec citations
- BE03c ~1520 "Block composition rules (DEC-210)"; changelog 2026-10-22 row ~1878.

## Open items / BOUNDARY
- BOUNDARY: none from the spec. Pointer for CMS-03C-12 uses the request-body RFC 6901 pointer (BE03c says "in `nodes`").
- DEFECT in F1's file, outside my claim (report to F1/root): `supabase/migrations-wip/dec193/20261016044200_cms_pattern_active_digest.sql`
  lines 124-133: the passing path does `return query select 'passed'` with no `return;`, then falls through to
  `return query select 'failed', reason(null), 0`, so a passing pin yields TWO rows `passed::0`, `failed::0` (observed in run 5 TAP).
  `cms_evaluate_preflight` reads the first row (`SELECT ... INTO`), so behaviour is right today by emission order only. My BR-V05 asserts the first row and prints the full list.
- Final wide run: 6 files not green, none caused by this lane: dec191, governed_activation, governed_decision, governed_recheck, governed_schedule abort with
  `unexpected function metadata; no automatic repair` from F4b's in-progress lapse fixture (`governed_recheck/070-isolation.sqlinc:22` / `002-lapse-helpers.sqlinc`, edited 20:27 local, its WIP `fix-recheck` is not in the root-specified stack);
  locale_observability 56 failures (private reader function missing: the DEC-208 locale observability WIP is not in the stack). None touches a function this lane patched.

## Requests to root
- RESOLVED (root, 2026-10-22): BE03c "Slice 12 typed refusals" now lists `block_rules_violated` (CMS-03C-02/-12/-15 only) and the
  `cms.pattern.active_digest` reason list includes `pattern_block_rules_violated`; FE03 rows and P2-S12-AC-211/238/274 updated.
  AC-238 ledger clause: `preflight-providers.test.ts` "closes the pattern provider to its own failure reasons" must include
  `pattern_block_rules_violated` (verified in the contract test, see Files).


## Runs
| # | Time (UTC) | Stack | Plan | Result | Classification / notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-10-22 20:04 | stack WITHOUT block-rules | `phase_02_slice_12_block_rules.sql` + `_legacy.sql` | 201 tests, 114 failed (TAP `.lane-logs/alt-staged-...-155840-2427406.tap` sha256 41429220c76305375cdcbd5867afdd4f9a123b3196bd42a3c1ce170de04258c4) | HARNESS, not feature RED: my fixture registered parents before their children (the registry refuses an unregistered child key). Fixed (leaves first, `order by ord`). |
| 2 | 2026-10-22 20:47 | stamp `163640-2612160`, stack pattern-updates..governed-recheck + block-rules (no fix-* lanes) | `phase_02_slice_12_block_rules.sql` + `_legacy.sql` | file 1: 124/124 ok. File 2: 197 tests, 38 not ok. TAP sha256 dd1f7ff27aa596d331e3ba654a5fa885d25bdd414f5f689d19ef8fb072750309 | 36 = BR-V01..V04 (9 each) + 2 of BR-V05 (provider/frozen-status): `s12pc_check` shows manifest builder `P0001:DEPENDENCY_UNAVAILABLE` even for the control pin `brv-ok` => HARNESS (fixture lacks a manifest prerequisite), not a feature defect: placement/updates suites (BR-P*, BR-U*) and every refusal pass. First failing: test 151 BR-V01-control. |
| F1 runs | 155647-2417168 / 160503-2465224 / 160719-2481556 (staged my WIP) | | 160719: BR-V* same 38 failures (same harness cause); 160503 tiny tap, 0 not ok (not a full run); 155647 pre-dates fixture fixes | skimmed only |
| 3 | 2026-10-22 22:41 queued, ran ~23:10 | stamp `184027-3117144`, same stack as run 2 | `_legacy.sql` only, with a TEMP diagnostic notice in 070 | 197 tests, 38 not ok (same 151-159,162-170,173-181,184-192,195-196). TAP sha256 68066d17b0be323466de9a66278fe6cd5e0826b16d8c9cc1ba68ace61946f6ea | HARNESS, diagnosed: `cms_build_dependency_manifest` -> `cms_settings_snapshot(uuid)` line 21 RAISE DEPENDENCY_UNAVAILABLE. Since 20261010130000 (E7/DEC-163) the snapshot is a read-only lookup recorded by ordinary write tails; this world ran none. Fix: seed the exact empty E7 snapshot as the DEC-193 consumer fixture does (CS-E7), in 070-provider.sqlinc; diagnostic removed. No SQL production file changed. |
| 4 | 2026-10-22 23:22 | stamp `191329-3265481`, same stack | `_legacy.sql` only (E7 snapshot seeded in 070) | 195 tests, 0 not ok, then psql ERROR 070-provider.sqlinc:34 `more than one row returned by a subquery used as an expression` (aborted, no plan, exit 3). TAP sha256 7394bb611bd6ae58812a01bc2faedbc08f060bebdc9705711f585f0c2fb4d3d1 | PROGRESS: BR-V01..V04 (control, live pin, canonical tree, not-active precedence) all ok with the real manifest builder, frozen status and 17-category evaluator. The abort is HARNESS in my direct-call assertion BR-V05 (scalar subselect over a set-returning function). Observed (static read of F1's `dec193/20261016044200_cms_pattern_active_digest.sql` 124-133): the passing path `return query select 'passed'` has no `return;`, so it falls through to `return query select 'failed', null, 0` -> two rows; the evaluator's SELECT ... INTO takes the first row, so behaviour is correct by emission order. Not my claim (see Requests to root). BR-V05 rewritten to array_agg (exact one row for failed; first row + diag listing for pass). |
| 5 | 2026-10-22 23:44 | stamp `194410-3402826`, stack without fix-dec193 | `_legacy.sql` only | 198 tests, 1 not ok (#196 BR-V05 direct provider call: have `{passed::0,failed::0}`, want `{failed:pattern_block_rules_violated:1}`). TAP sha256 d0b23c46ef2f1962afcfb86af71dda261ee58019107caed1c5cb4eb4270b77d7 | HARNESS (my direct call ran without the CMS RPC context that cms_evaluate_preflight/s12pc_check set, so the SECURITY INVOKER provider read no rows; the evaluator-driven BR-V02 assertions pass). Also CONFIRMS F1's 044200 defect: the passing path returns two rows `passed::0` then `failed::0` (missing `return;`). Fix: wrap the direct calls in `set_config('app.cms_rpc','true',true)`. F4a's run 190808 aborted on the run-4 bytes (same BR-V05 subquery), superseded. |
| 6 | 2026-10-22 19:50 local (23:50Z) | stamp `194551-3414794`, standard stack incl. fix-dec193 (wip migrations 83) | `_legacy.sql` | 198/198 PASS, pg_prove exit 0. TAP sha256 2ca5c13e16db77e235f3d8d36c561aec492a574811c4df6eae181887bb948e96 | GREEN: placement, accept/detach, provider (live pin, canonical tree, precedence), frozen status. |
| 7 | 2026-10-22 19:52 local | stamp `195116-3441150` | 86-file final plan | NOTESTS (Files=0): HARNESS, my zsh invocation did not word-split the file list (memory: zsh does not word-split). Relaunched via /bin/bash script; no test ran. |
| 8 | 2026-10-22 20:25 local | stamp `195257-3453719`, standard stack incl. fix-dec193 (wip migrations 83) | 86 files: all `phase_02_slice_12*.sql` (75, excl. races) + 11 Slice 11 files touching pattern/preflight/manifest | Files=86 Tests=14903; 80 files fully ok (incl. block_rules 124 and block_rules_legacy 198, all dec193_*, pattern_*, S11). TAP sha256 11405bc1a00375c33a3659e28af01803fbc04d24f0e143cd8c176d2acedf2924 | 6 files red, all NOT this lane: dec191/governed_activation/governed_decision/governed_recheck/governed_schedule abort at F4b's `s12fr_lapse` fixture (`unexpected function metadata; no automatic repair`); locale_observability 7-75 (private reader absent, DEC-208 WIP not in stack). First failing: dec191 `040-detail.sqlinc:87`. |
