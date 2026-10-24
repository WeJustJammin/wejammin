# Lane claude_s12_v2_nits report

## Status
GREEN (2026-10-23 ~00:50Z local stage clock). Final run: 21 files, 10,032 tests, 0 failed, exit 0. All four items closed; one BOUNDARY (V2-04 b: spec states no multi-pin reason order, so no test). Mutant run proves the new PAT-031 assertions can fail. Mutant WIP removed.

## Scope
Brief `briefs/prepromo-nits-v2.md`; closes V2-01, V2-04, V2-05, V2-07 of `review-v2-report.md`. HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e.
Backup of every claimed file before editing: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_v2_nits/orig-040541.tar` (SHA-256 8e4a41a8c8a5de749b5a054c62058fc5618971b6319696c5ffbba22c1653e40e). Mutant copy kept at `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_v2_nits/mutant-copy/`.

## Files (path, lines after, SHA-256 before, SHA-256 after)
| File | Lines | Before | After |
| --- | --- | --- | --- |
| `supabase/tests/phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc` | 206 | 715eeb989e66d8a33ef24f2b2403de7f58677ceb0edfa7111d603bfe141d66f3 | b20f6b8b60800b7593fc41b8922e41eef827fefdf099ba53721f545ba344be94 |
| `supabase/tests/phase_02_slice_12_pattern_updates_common/README.md` | 23 | a15fffc45ae53f169fb945f9e6607c55fa28f2acb78ebd59d156b885f8ea3a43 | 809b1860f4a335c1fc19f1c86bbed3f6ff1fcb361ddbfee08dd0e13696495559 |
| `supabase/tests/phase_02_slice_12_pattern_updates/060-effects.sqlinc` | 54 | 044034b7340524ca4a20e049b8b459b21e50973137d6aa02459411156ebf4979 | 5f0dba6033df9c3e95ebf20ba7aa62be83a2d5cb59267f88683abd19297b984c |
| `supabase/tests/phase_02_slice_12_pattern_updates/085-rpc-context.sqlinc` | 48 | NEW | 4c13a2798bc255e3786430497f8eadd64103c47028240a517fb6415e022044fc |
| `supabase/tests/phase_02_slice_12_pattern_updates/README.md` | 24 | 53ecefd133ecf1a7a495e1902be04c4deb5c14a59864c690e6d488b86a792802 | c28dc3b8f88a16caf037dbbdd119a3f47cdd53c62b7910c31b130ea7bdd11ce7 |
| `supabase/tests/phase_02_slice_12_pattern_updates.sql` | 45 | 0724638753a83efcfda6b100b10905e2ba736d923937b3e16a956b298e56df3f | 1443202b52c175c9c14642d4b4142cf9ff23f447953a124fb66af5aa8866f889 |
| `supabase/tests/phase_02_slice_12_block_rules/040-legacy-setup.sqlinc` | 134 | 1e67a5b8b3063f7d3bcffbb59079ccf29064166fb197766a4d1739408860fe8c | 765319088dd85fb007dc1ef05dd86ff15f8f76f4892b7f63bfd608f95c5d19ef |
| `supabase/tests/phase_02_slice_12_block_rules/050-placement.sqlinc` | 43 | cb27079b07195a2be531f61d5f3ea967e3ce1af0576b822a579869653f9ca6d6 | ce12edb4bb2f94155cf682f40466b1b974f4280d909e427a8059c7622dc128d5 |
| `supabase/tests/phase_02_slice_12_block_rules/060-updates.sqlinc` | 85 | 154eaa9714f87a2b4b11a12e9122102c5c584738169777358d8050fde03e13cd | db18c34ec9c661040ca9a51ac4bb66500bb744e4962fbc7e8b24855da7acad30 |
| `supabase/tests/phase_02_slice_12_block_rules/070-provider.sqlinc` | 57 | 266e3d8114f62415c6d23e44df6e496e9777d6bb19760f01b1505e6c7d377961 | 64c2b3dc5a50ec6ce94f0d9f746c0f372027e3cefb11d179d09406ef0ba87487 |
| `supabase/tests/phase_02_slice_12_block_rules/README.md` | 23 | 3e0263bc922ab82f9cd8536ab9004de45a2928adeff8650095fa52bcf8eb80c9 | 1b20418ce95ba69b15f206d6581337905f0b235bb9456272f62f120d58bba2a1 |
| `supabase/migrations-wip/pattern-updates/20261014140410_cms_get_instance_update_diff_public.sql` | 34 | 9dde7629cf5a62e5d084fd9617894f02b32daedd5eaebe20955a6723ac5432a2 | b4d471562e04d3331caa091b3849e8e898312bca2e27f0309f3138b1bf84e690 |
| `supabase/migrations-wip/dec193/README.md` | 273 | 02de443b7050c71f7df7c0d600e96b3d349c046559d47c49acd624d5a1724c1a | c36ea9fbf6bbe77f0c6dafeb266d866d01326d6172631f18a2f976739fd4fdab |

Mutant (never promoted, deleted from the worktree after run B): `supabase/migrations-wip/v2-nits-mutant/20261023990000_mutant_skip_rpc_restore.sql`, copy in scratch.

## What changed
- V2-01: `s12pu_call` (common helper) gains an optional 6th parameter `p_flag` (the caller's `app.cms_rpc`, cleared again afterwards) and records `rpc_before`/`rpc_after` in `s12pu_out`. `060-effects.sqlinc` line 40 (vacuous "boolean text" check) is replaced by (a) every call started with the flag cleared and (b) `rpc_after = rpc_before` after every call (success, replay, refusal). New `085-rpc-context.sqlinc`: both `platform_api` wrappers as real `service_role`, flag cleared and flag = sentinel `caller-flag-not-true`, real non-empty answers asserted (diff instance id; `items` length 1), plus the idempotent replay path. Uses tag ap14 (untouched by earlier cases) for the two applies.
- V2-04 (a): `brd-multi` (pre-rule two-root detach) refuses at `/instances/1` (U08) and `/instances/0` when mirrored (U09); `brm-a` bulk accept refuses at `/instances/1/choices` (U10) and `/instances/0/choices` mirrored (U11). A bulk accept admits no collision (`diff_has_collisions`, 140600:187-191), so brm-v2 is a pre-rule, collision-free successor (props change of /ok only) whose /bad still breaks maxNodes. `U16`: the clean root detaches on its own.
- V2-04 (c): empty allow-list and depth through placement (P09-P12, `/patternVersion` and `/roots`), detach (U12 empty, U13 depth), accept (U14 depth, choices taken from the real CMS-03C-14 diff), and the provider (BR-V02b empty allow-list, BR-V02c depth).
- V2-05: the dead privilege-closure DO block removed from `140410` (applied AFTER run A had staged the original bytes, so run A tested the old bytes and run H the new).
- V2-07: dec193 README gains a 35-row inventory, one line per migration; every file name present (checked by script).

## Runs (all on the standard stack `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,dec208`; stage clock times)
| Run | Stage stamp | Plan | Result | TAP SHA-256 (first 16) |
| --- | --- | --- | --- | --- |
| A | 000852-407932 | 21 files, original 140410 | 10,030 tests, 4 failed (block_rules_legacy 221, 224, 234, 237): my accept cases gave choices on non-collision paths -> VALIDATION_FAILED. Harness/test-authoring defect, not feature RED. All of 085 and 060 passed. | 8ff2d07f8e2a5a03 |
| C | 001518-437736 | 21 files | 5 failed (219-220, 223-224, 235): without choices the single-collision accept gives diff_has_collisions / VALIDATION_FAILED. Test-authoring. | b5ae85e3faf0c3d1 |
| B (mutant) | 001544-440893 | pattern_updates.sql + wrapper copies that skip the restore | 1,490 tests, 6 FAILED as required: 1357 (060 no-leak), 1478, 1481, 1484, 1487, 1489 (085). Proves the V2-01 assertions can fail. | 66f1a3a7bcd0d1c5 |
| D | 002342-480112 | 21 files | 2 failed (220, 224): multi-instance accept with choices is refused (bulk admits no collisions; 140600:187-191). Test-authoring. | 4399948d61912845 |
| E | 003037-514095 | block_rules_legacy only (debug output of the diff) | 2 failed, diff showed both /r and /r/c collide. | - |
| F | 003328-533204 | block_rules_legacy only | 2 failed, same cause (bulk). | - |
| G | 003512-545265 | block_rules_legacy only, collision-free brm | PASS 310/310 | - |
| H (final) | 003631-554570 | all pattern*, dec193*, block_rules*, composition* (21 files) on final bytes | PASS: Files=21, Tests=10,032, exit 0 | 56eb1f5c7d87de9a |

## Test corrections
Only one pre-existing assertion changed: `060-effects.sqlinc:40` `select ok(coalesce(nullif(current_setting('app.cms_rpc', true), ''), 'false') in ('true', 'false'), 'setup sanity: the harness flag is a boolean text');` (true whether the flag leaked or not) replaced by the two assertions above, which fail under the mutant (run B). Strengthening, not weakening.

## Spec citations
BE03c 176/177 (CMS-03C-14/15 routes), SEC-2 / PAT-031 (wrapper restores the caller's `app.cms_rpc`), BE03c "Block composition rules (DEC-210)" line 1524 (pointers `/instances/{i}/choices` accept, `/instances/{i}` detach), BE03c 1573 and P2-S12-AC-238 (provider reasons), BE03c "Linked update" (bulk admits no collision, 140600:187-191).

## Open items / BOUNDARY
- V2-04 (b) BOUNDARY: provider reason precedence when a pin fails `pattern_digest_changed` or `nested_pattern_not_active` and another pin fails `pattern_block_rules_violated`. BE03c 1573 / AC-238 / FE03 606 list the four reasons without stating which one a multi-reason category reports. The code (080500) reports in the order not_active, nested, digest, rules and BR-V04 pins only not_active-first. No test added; a comment in `070-provider.sqlinc` records the boundary. Missing: a spec sentence on multi-pin reason order (root decision if wanted; no stub exists, so no tracking issue/sentinel).
- Reported behavior: an accept request with 2+ instances refuses any colliding instance (`diff_has_collisions`), so the rule check at an accept index above 0 is only reachable with collision-free targets (used here).

## Requests to root
- None blocking. Optional: decide the multi-pin provider reason order (BOUNDARY above).
