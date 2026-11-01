# Lane `claude_s12_repair_b` report

## Status

GREEN. Every Slice 10 and Slice 11 pgTAP file (177 top-level `.sql` files) passes on the full WIP stack
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,repair-b`:
**Files=177, Tests=6277, 0 failures** (final run 6). No production SQL changed; no WIP migration edited; `supabase/migrations-wip/repair-b/` was created and stays empty (no repair-b migration was needed). All eleven failures were stale oracles or fixtures that predate a cited Slice 12 requirement; none was a genuine regression.

## Scope

Brief `docs/handoffs/2026-10-22-claude-s12/briefs/repair-b-s10s11.md`, worktree HEAD `b16edb54`. Lane list exactly as in the brief.

## Classification of the eleven files (run 1, 298 tests ran, 8 files failing + 3 exit-3 aborts)

| File | Failure | Class | Superseding citation |
| --- | --- | --- | --- |
| S10 compare_lineage_domains #12 | duplicate-path refusal no longer raised | stale oracle | Composition rows are append-only versions per path: BE03c 1511 "`(revision_id, path)` is unique per version"; BE03b 1712 + dec193 `20261016041900` compare the newest head of a path. Two `active` versions of one path are one history. |
| S10 comparison_domains #8 | comparison body no longer contains `blockRegistryDigest`/`bindings` | stale oracle (structure) | The side hash is the JCS of `cms_composition_instance_content` (BE03b 1712, DEC-193). Assertion now proves the comparison calls it and that function carries the locked keys. |
| S10 ev_eb_publication_scope #2 | `cms_recheck_governed_reviews` in `platform_api` | stale oracle | BE03c 1495 and 1612 (recheck RPC). |
| S10 ev_eb_publication_scope #5 | `publication_projection` table | stale oracle | BE04c 345, DEC-197 (dec197 WIP `20261016030000`). |
| S10 write_path_locks #11 | restore no longer calls `cms_lock_entry_rows_shared` | stale oracle, behaviour preserved | BE03b 1729/1750 rule 2, DEC-201, BE03c 1571: restore fences every external relation target FOR SHARE through `cms_lock_relation_target` (target row + caller assignments) at position 2. |
| S10 restore_transform_revalidation #36-43 | restore refused `migration_chain_incomplete` | stale fixture | Same rule (BE03b 1750 rule 2): a relation target the caller cannot read is refused first with `migration_chain_incomplete` on restore. The forged same-party target had no assignment for the actor, so it was (correctly) invisible. Fixture now assigns it exactly like the forged entry. Foreign target unchanged. |
| S11 checker_render_plan #24-25 | plan order and hash | stale oracle | BE03c 1511 / DEC-185: render order is region, slot ordinal, authored `position`, path, id. Independent vector recomputed in python (reproduces the old vector 2cb8fc5d... for the old order, and gives 1cf797d0... for the new). |
| S11 helpers_manifest #25-28, 49, 55, 62, 65, 67, 69, 72, 73, 86 | manifest build NOT_FOUND, then status stale | harness fixture vs DEC-186/DEC-199 | (a) a pinned row's `path` must be a block-root key chain of its pattern version (below the template slot when the revision has a template) and carry that root's block (dec193 `cms_pattern_root_snapshot`, BE03c 1511, DEC-186); (b) a live pin is current only while the stored pattern `block_registry_digest` equals the digest recomputed over its reachable blocks (DEC-199, BE03c 1564, `cms_pattern_live_pin_reason`). Test-local forests with recomputed digests; the deprecation of `h11.second` is kept observable on a standalone block so test 73 still means "every identity current". |
| S11 recheck_index, recheck_run (exit 3 / 5 failures) | same NOT_FOUND, and r8 falsely invalidated by the bogus placeholder digest | harness fixture | same as above. |
| S11 rpc_reads_gate (exit 3, then #17, 24, 25) | `cms_composition_instances_pending_version_check`; `pending_diff` row now renders; order by position | harness fixture + stale oracle | `pending_diff` rows need `pending_pattern_version` (pattern-updates `20261014140000`, BE03c 1426); BE03c 1515 "A `pending_diff` instance renders its pinned version"; BE03c 1511 / DEC-185 position order. |
| S11 preflight_registry_schema #10, 21 | newer registry row 23505 / CONFLICT | stale fixture | BE03c 1564: Slice 12 itself registers registry version 2 of `pattern`; the "later slice" fixture row is now version 99 (insert guard asks only for strictly newer). |

The 2026-10-14 `lifecycle_version` fixture cause is not what blocks the S11 aborts today; the aborts were the DEC-186 path/forest and pending-version causes above.

## Files (final SHA-256, lines)

Edited tests (corrections):

- `supabase/tests/phase_02_slice_10_compare_lineage_domains.sql` 1bd328d8c2a957c08515f11582822b7a90f06b95c72352a99f9f2810056c7b9b (317)
- `supabase/tests/phase_02_slice_10_comparison_domains.sql` bff09456c507eff276badb9c20267f974fabb76c960aa5c193035c7bb6cedeba (184)
- `supabase/tests/phase_02_slice_10_ev_eb_publication_scope.sql` 338ccdffae0fe206a823d75337e0b8e903a5040aabcc6ff9e4ef63c472515f01 (81)
- `supabase/tests/phase_02_slice_10_write_path_locks.sql` 7c2dff093bff05e02973ef9bc747897d9ffac1358885a11b61469a0c6395a626 (176)
- `supabase/tests/phase_02_slice_10_restore_transform/001-seams-and-validators.sqlinc` 2b10b6814f95c1e86a1f4ca7e515af573c7bcc9d5ad1fa57796dd4a8828f1e17 (384) (the restore-transform fragment, not a shared helper)
- `supabase/tests/phase_02_slice_11_checker_render_plan.sql` 3ac6965077555d49b896e434529c0e3b0e045e6d8adf95a94ba1cbef795573c3 (215)
- `supabase/tests/phase_02_slice_11_helpers_manifest.sql` 0bb5811ff23ee16b093b380dd19a410d57df5fcb0d4cb2668ac2d73c94e166bc (705)
- `supabase/tests/phase_02_slice_11_preflight_registry_schema.sql` cb6eb51f5259706e906bf0a9e4d6552c2b7c72e868cd167310822722a9afb3e1 (250)
- `supabase/tests/phase_02_slice_11_recheck_index.sql` 0ad2fa17be2d91a2a021796e649376e40d78ccbfda1af0ff2896b442a24b3469 (159)
- `supabase/tests/phase_02_slice_11_recheck_run.sql` 9da801bfe42807c95c77d0056e72c8489a2a45900ce5fd61494a914e3378a6ab (390)
- `supabase/tests/phase_02_slice_11_rpc_reads_gate.sql` 1d0e00f4189167f8c4812eabc5df0dfbb19428bd746bc3c1c96dd5a69efd416e (276)

New: `supabase/tests/phase_02_slice_11_pattern_forest.sqlinc` ed843eacd98a4cf1754c0fbae5d8524d0a8384889aaec94aab7b7f88ed65d25c (34): the test-local `pg_temp.h11x_forest(pattern_version_id, block_key, root_keys[])` include (declares a pattern version's block roots and stores the recomputed registry digest). It is not under a shared helper directory and is not picked up by pg_prove (`.sqlinc`). Included by helpers_manifest, recheck_index, recheck_run.

Not edited: shared helpers (`phase_02_slice_10_rpc`, `…remaining_schema`, `…signed_read`, `phase_02_slice_11_helpers/`), any WIP migration, Slice 09/12 tests. Temporary diagnostic probes (`phase_02_slice_10_zz_repair_b_probe.sql`, `phase_02_slice_11_zz_repair_b_probe2/3.sql`) were created for runs 2 and 3 and deleted before run 4.

## Runs (all one run per deliberate change; background, no timeout, no loop)

| # | Start (UTC) | Plan | Result | TAP (copied in `<scratchpad>/claude_s12_repair_b/`) |
| --- | --- | --- | --- | --- |
| 1 | 17:37 | the eleven brief files | FAIL: 298 tests, 8 files with failures + 3 aborts | run1.tap sha256 c7e3a894b230e839a561bc2ac0ec5bbce282c6a3580edfafe6c1191dd69ed897 |
| 2 | 17:47 | same eleven + restore probe | FAIL: 405 tests; remaining restore 36-43, manifest 73, recheck_run 21/23/31/32/39, reads_gate 17/24/25 | run2.tap d28c247558989d54e875ab8102d579e710a6b730ce64999f6930815fe83ffc06; probe: restore message `migration_chain_incomplete` |
| 3 | 17:50 | same eleven + 3 probes | FAIL: restore, render, reads_gate fixed; manifest 73 and recheck_run 21/23/31/32/39 remained (probe: frozen == rebuilt, legacy current true, so the DEC-199 revision-aware provider failed on the placeholder digest) | run3.tap |
| 4 | 17:53 (waited for locks to 18:28) | same eleven | PASS 371 tests | `.lane-logs/alt-staged-…repair-b-135328-1825672.tap` sha256 02bed189a27ff6e765ee69dc8df60d2926418047fae0693ff64bed19de347979 |
| 5 | 18:29 | all S10+S11 `.sql` | harness error (my zsh invocation passed one word-joined path; 0 tests, `NOTESTS`) | not evidence |
| 6 | 18:30 | all 177 S10 + S11 `.sql` files | **PASS Files=177, Tests=6277, 0 not ok** | `.lane-logs/alt-staged-…repair-b-143013-2012254.tap` sha256 888eaef762380ba02144c0bee01fa5dd61977fb7f1edc4bc40188812e1956198 |

## Test corrections (exact summary; every change keeps or strengthens its assertion)

1. `compare_lineage_domains` #12: the refusal assertion is replaced by "state `00000` and exactly one `block` change, at `/blocks//hero`, for two `active` versions of one path" (BE03c 1511, BE03b 1712). The 256-character pointer refusal below it is unchanged.
2. `comparison_domains` #8: from "`cms_list_revisions` body contains `blockRegistryDigest` and `bindings`" to "body calls `cms_composition_instance_content` and that function's definition contains `blockRegistryDigest`, `bindings`, `blockKey`, `patternRef`" (BE03b 1712, DEC-193).
3. `ev_eb_publication_scope` #2 add `cms_recheck_governed_reviews` (BE03c 1495/1612); #5 add `publication_projection` (BE04c 345, DEC-197). Titles updated.
4. `write_path_locks` #11: restore must contain `cms_lock_relation_target(` (DEC-201, BE03b position 2), append and resolve still `cms_lock_entry_rows_shared(`.
5. `restore_transform/001-seams-and-validators.sqlinc` `s10r_forge_target`: a non-foreign forged target also gets the creator `cms.author` and editor `cms.editor` assignments (BE03b 1750 rule 2, DEC-201). The foreign target stays unassigned, so the existing foreign-target refusal test still proves the tenant rule alone.
6. `checker_render_plan` #24: expected order rp-i1 then rp-i2 (position 0 before 1 although `/b/1` sorts first); #25: expected hash 1cf797d05a557d56721888fe67aaf5b985ac7a5adbf2930b507ce02c1322dfc2 (independent python vector; previous 2cb8fc5d… recorded in a comment).
7. `rpc_reads_gate`: the `pending_diff` fixture is written `active` then moved to `pending_diff` with `pending_pattern_version = 2` (raw, labelled); #17 expects the four rendering heads i2, i1, i0, i8 in position order (superseded head excluded); #24 "moving an instance" now changes its `position` (a path no longer orders); #25 expects i2, i1, i8 then the unknown-slot i0.
8. `preflight_registry_schema`: default fixture row registry version 2 -> 99 with the BE03c 1564 comment.
9. `helpers_manifest`, `recheck_index`, `recheck_run`: pattern forests via `h11x_forest`; template-revision pinned rows at `/primary/a`; `comp:i3` and `cur:i1` use `h11.first` (pattern roots), new standalone `comp:i6` and `cur:i3` use `h11.second` so test 72/73 stay meaningful under the DEC-199 digest.

## Spec citations

BE03c 1426, 1495, 1511 (positions, path rule, DEC-185/186), 1515 (pending_diff renders), 1564 (providers, DEC-199), 1571 (restore, DEC-201), 1612; BE03b 1712 (D5 compare), 1729 and 1750 rule 2 (position 2 target locks, uniform refusal); BE04c 345; DEC-185, 186, 193, 197, 199, 201.

## Open items / BOUNDARY

None. One observation for root: DEC-199 makes a manifest stale when a block reachable through a live pattern pin is deprecated or withdrawn (the recomputed digest includes lifecycle). The S12 pattern provider suites own that behaviour; S11 now only keeps its currentness cases independent of it.

## Requests to root

1. Optional: fold `h11x_forest` into the shared `phase_02_slice_11_helpers/003-registry.sqlinc` (a pattern fixture whose digest is the recomputed one) when helpers are next unfrozen; until then the local `.sqlinc` include is enough. No other helper change is required.
2. The S09 inventory pins (reserved for root) may need a `publication_projection`-style adjustment only if S09 counts platform_private tables; this lane did not look.
3. No canonical gates, staging, commits or promotion were run or are requested of this lane.
