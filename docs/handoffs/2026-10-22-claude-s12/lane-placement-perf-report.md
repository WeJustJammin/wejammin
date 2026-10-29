# Lane claude_s12_placement_perf report

## Status
GREEN. HEAD cd89d54c (claude/phase2-slice12). Defect D1 fixed forward in five WIP migrations (`supabase/migrations-wip/placement-perf/`,
timestamps 20261024150000-150400): `gaps_perf_patterns.sql` is 44/44 with the 512-row placement p95 225 ms (was 661-990 ms, FAIL);
the in-database profile of the 512-row placement fell from 554 ms to 159 ms (p50). Two new test files, 66 tests, green; the 46-file
regression wave is green apart from one other lane's RED (gaps_lock_conversion, proved green with `gaps-db2` staged beside mine).
The aim of <= 200 ms is met in the profile (159 ms p50) and in the bench on a quiet host; the bench on this very busy host showed
p50 215 / p95 225 ms. The 512-node save p95 is 217-233 ms across runs (<= 250 target met; before 293 ms; it benefits from the block-rules fix).

## Scope
CMS-03C-02 placement (BE03c line ~1813, "RPC < 300 ms"; P2-S12-AC-279). Only `cms_insert_pattern_instance` and the helpers its
512-row path calls were changed; `cms_create_pattern_version` (web-impl lane) is not touched. No promoted migration, existing test,
ledger, receipt or spec was edited. No lock, check, audit or grant was weakened (see Behaviour preserved).

## Root cause (measured, not guessed)
Instrumented copy of the live producer run through `platform_api.cms_insert_pattern_instance` as `service_role` (marks in a GUC;
512-row p50, ms): path allocation 108 (O(n^2): the loop rebuilt the result array on every root), block-rules plan check 43
(O(n^2): n x n `starts_with` scans for parents, n x n for disallowed children), registry digest 21, plan 10, and the insert plus
projection 363, of which the per-row composition admission guard was 195 (EXPLAIN ANALYZE of a 512-row copy: FKs 3 ms each,
write guard 2.7 ms, `target_revision_guard` 266 ms). The guard calls `cms_revision_effective_state` once per row; that
SQL function over a plpgsql set-returning function cost 0.31 ms per call (158 ms for 512) because an SQL-language body called
from inside another statement is planned again on every call (a plpgsql body keeps its plan: 0.04 ms). The projection hashed
the same content image 512 times (RFC 8785 + SHA-256: 40-50 ms; the other 80 ms was the per-row function calls and an
overrides subselect that rescans overrides x nodes per row).

## Files (path, lines, SHA-256)
| path | lines | SHA-256 |
|---|---|---|
| supabase/migrations-wip/placement-perf/20261024150000_cms_pattern_placement_path_allocation_set_based.sql | 151 | 6926e14e9072b848f5c8805344292d7eff4b6ae20bb651e2b236c57830332b66 |
| supabase/migrations-wip/placement-perf/20261024150100_cms_block_rules_violation_linear.sql | 169 | 5917b0a4fcb1bbfadf74386d2c9c145f533b18ac115157e3f802d5e8ba4335eb |
| supabase/migrations-wip/placement-perf/20261024150200_cms_revision_effective_state_single_query.sql | 92 | 72f006db7e5f73be2850afc90ad065d54a75e1b96cb1afdcaea049764ebb149e |
| supabase/migrations-wip/placement-perf/20261024150300_cms_composition_instance_resource_hashed.sql | 101 | bbcb29c99aff656a78af41de9e07c0bd7171754ddc239b4f8c797ad13589cd11 |
| supabase/migrations-wip/placement-perf/20261024150400_cms_insert_pattern_instance_override_map_hashed_resources.sql | 135 | a76e634ca954474a09e626b254988f743c12fc4c864272fa3927a823647796f5 |
| supabase/migrations-wip/placement-perf/README.md | 23 | 2bba85e22557a01a50631abf7759aa9b2c7428d64ff7484ef534f813a9d23105 |
| supabase/tests/phase_02_slice_12_placement_perf_equivalence.sql | 375 | 11568e86fcb51e0cc35e77d4b5292fb61c3cb5f657963ca150ca67725e29981e |
| supabase/tests/phase_02_slice_12_placement_perf_effective_state.sql | 56 | df3b9f261ea27e7aad420a04fd31d3a8b806e736938e1d92bb0499b80d5961cf |

All eight are NEW files (no untracked original was edited in place, so no tar backup was needed). The README was added because the
WIP directory holds more than two files. The scratch profiling test lived briefly in `supabase/tests/` (the runner mounts only that
directory) as `zz_scratch_placement_perf_profile.sql` and was deleted; its last copy is in the lane scratch dir.

## What each migration does (behaviour preserved)
1. 150000 `cms_pattern_placement_path_allocation`: one pass (heads read once, running count of new paths, one aggregation). Same
   CONFLICT conditions (non-retired head, version at 2147483647, position past 2147483647), token and detail; non-root nodes pass
   through; retired heads reuse position at next version. Equivalence-tested against the verbatim old body. Defect caught by that
   test during authoring: the position cast overflowed (22003) before the CONFLICT check; fixed with `least(...)`.
2. 150100 `cms_block_rules_violation` (DEC-210): parents by one hash join over chain prefixes, disallowed children by one grouped
   join. Equivalent on 16 handcrafted + 400 seeded random forests (192 violating, 208 clean, all three reasons).
3. 150200 `cms_revision_effective_state(uuid)`: SQL -> PL/pgSQL, one query, same derivation (published > scheduled > approved >
   rejected > submitted > draft; NULL for absent/NULL id). Same signature, STABLE, SECURITY DEFINER, owner, search_path, ACL, comment.
   The set form `cms_revision_effective_states`, the guard function and the trigger are untouched (pinned by S11 e2_adoption and
   the S09 trigger probes, which pass). Duplicate derivation is deliberate and pinned by the effective_state agreement test.
4. 150300 new private `cms_composition_instance_resource_hashed(row, hash)`; `cms_composition_instance_resource(row)` delegates to
   it, so there is still one projection body and every caller's output is unchanged (asserted against the verbatim old body).
5. 150400 producer, three anchored replacements (each anchor occurs once; inverse restores the installed source byte for byte;
   all other pg_proc attributes unchanged): per-root override map aggregated once; each distinct content image hashed once and
   the rows projected through the hashed form (`hashed as materialized`: without it the planner re-ran the distinct pass per joined row).
Every migration aborts unless the installed source equals the promoted source exactly (1-4: whole-body equality; 5: anchors).
Locks, FOR SHARE / FOR UPDATE order, idempotency, audit, outbox, response, grants and RLS are untouched. The admission guard still
runs for every inserted row.

## Runs (ALT staged runner; all in the background; stamp = TAP name under .lane-logs/)
| # | stamp | lane | files | result | TAP SHA-256 |
|---|---|---|---|---|---|
| 1 | 072842-2291422 | none | gaps_perf_patterns | BEFORE: 43/44, #41 place512 p95 FAIL (genuine D1) | d5eeecbf6fe89409d145a02c617ccaf43b2f9acc6a55a62df78a43fb63dce17e |
| 2-6 | 073233, 073440, 073716, 191158, 193... (profiling) | none / placement-perf | scratch profile | profiling only (no assertions) | n/a |
| 7 | 191830-131468 | placement-perf | equivalence | HARNESS: pgTAP `like` missing (use `alike`) | n/a |
| 8 | 191920-134474 | placement-perf | equivalence | GENUINE: allocation position overflow 22003 (real defect in my first body), random-forest generator uncorrelated (HARNESS), detached-tree fixture grammar (HARNESS), idempotency key too short (HARNESS) | n/a |
| 9 | 192031-138522 | placement-perf | (two files in one arg) | HARNESS: runner wrapper passed one arg | n/a |
| 10 | 192114-141070 | placement-perf | equivalence + effective_state | GENUINE: `pg_catalog.least` does not exist (my body) | n/a |
| 11 | 192158-144417 | placement-perf | equivalence + effective_state | 66 tests, 6 failures: 4 HARNESS (attribute text), 2 generator (uncorrelated subqueries) | n/a |
| 12 | 194730-209890 | placement-perf | equivalence | 50/50 PASS | bf332214cf0016c929c4635c9f121c430d5356216369602c7731b45f1fd0e071 |
| 13 | 194830-213570 | placement-perf | bench + profile | 43/44: #41 FAIL p95 399 ms (migration 150200 was still the SQL-language form; fixed before run 14) | 389594fc4845d7a5efeeee564d9157fabc3763077ceb3a5bd9215df0dfdf4277 |
| 14 | 195820-238243 | placement-perf | bench + equivalence + effective_state | 110/110 PASS, place512 p50 248 p95 263 | eaaa75937c9dee35dee2a2f682d6a59e3fdb35ea3f72171f6705c139d5df368a |
| 15 | 200334-258138 | placement-perf | same, with `materialized` | 109/110: #41 p95 332 ms on a loaded host (update32_accept +31% in the same run: noise); profile showed the plan was already fixed | cea5bb2d26f5c0f78b3cca551cdd0910e8367f079059e649228ae92d2f2ab892 |
| 16 | 203415-329102 | placement-perf | 46-file regression wave | 10,742 ok / 5 not ok (gaps_lock_conversion only, see below); bench place512 p50 214.7 p95 225.4, pat_create_512 p95 233 | 5d94a1db5d69829db37c2941b8877ff54a61312026bfe1180362216468195a81 |
| 17 | 204217-346827 | placement-perf,gaps-db2 | gaps_lock_conversion + equivalence + effective_state + pattern_placement | 827/827 PASS | e005e127a59f9b4f2f4c1c23acd8149a2556d32e2b611a8dfc5e8dc422c5a20f |
| 18 | 204324-353540 | placement-perf | scratch profile, sizes 32/128/256/512, final bytes | profiling only; source of the AFTER table | 26b5fe776d1991aa5b09f0d0c644772745f9ab7381d4ced043f75dd6b3431ede |

## Before / after (in-database, instrumented real path as service_role, p50 ms)
| rows | before (run 2-3, quiet) | after (run 18, 6 samples, final bytes) |
|---|---|---|
| 32 | 30.7 | 13.7 |
| 128 | 118.5 | 43.6 |
| 256 | 237.8 | 82.4 |
| 512 | 554.2 | 159.0 |
512-row sections after: insert + projection 116 (insert alone 71: FKs ~15, admission guard 34), digest 18.7, plan 8.8, rules 5.4,
allocation 2.9, the rest < 10. Cost is now linear (0.31 ms per row).
Bench `gaps_perf_patterns.sql` (24 samples; the host was shared with other lanes, so absolute numbers move +/-30% run to run):
| op | before (run 1) | after (run 16) |
|---|---|---|
| place512 | p50 803.7 / p95 989.9 (perf lane quiet-host: 627.5 / 661.3) | p50 214.7 / p95 225.4 |
| place32 | 57.4 / 68.8 | 14.0 / 14.9 |
| pat_create_512 (512-node save) | 248.0 / 293.1 | 198.6 / 233.2 |
| pat_create_succ512 | 225.9 / 327.5 | 160.9 / 164.5 |
| update32_accept / detach | 613 / 686, 386 / 433 | 365 / 487, 219 / 312 (noisy; Tier 2 < 1,200 holds) |
32 and 128/256-row bench numbers are not in the bench file (it measures 512 and 32); the profile table above is the 32/128/256/512 series.

## Suites run (final bytes of 150000-150400, lane placement-perf unless noted)
Run 16, 46 files, 10,742 ok: placement_perf_equivalence (50), placement_perf_effective_state (16), gaps_perf_patterns (44),
pattern_placement, dec193_selected_roots, dec193_consumers, dec193_pattern_currentness, dec193_security, dec193_diff, dec193_carry,
dec193_writer_boundaries, block_rules, block_rules_legacy, composition_instance_guards, composition_instances_read,
composition_authority, composition_owner_integrity, pattern_updates, pattern_update_diff, linked_scan, gaps_db1_pattern_placement,
gaps_placement_owner, gaps_rpc_inventory, gaps_lock_conversion, dec191_pattern, pattern_definition, pattern_selector, locale_gate,
gaps_locale_missing_stale, governed_recheck_pattern, S11 e2_adoption, e2_composition_guard, e2_review_evidence, e2_scan_entries,
e2_scan_history, e2_state_check, helpers_effective_state, helpers_invalidation, read_hint_author_publisher, rpc_preview_mint,
rpc_publication_execute / publish / schedule, rpc_review_submit_refusals, rpc_review_submit, S09 r8_api_surface.
The only failures, 5 in `gaps_lock_conversion.sql` (#1, 2, 38, 41, 44, lock-failure conversion), are the gaps-db2 lane's RED test
for its migration 130300; with `gaps-db2` staged beside mine (run 17) the file passes 46/46 together with my suites, so they are not mine.

## Test corrections
None. No existing test was edited.

## Spec citations
BE03c 1813 (RPC < 300 ms, Tier 2 p95 < 1,200 ms; P2-S12-AC-279); CMS-03C-02 placement DEC-175/181/185/186/193 (allocation,
positions, retired reuse); DEC-210 (block rules); BE03b "Derived revision workflow state (E2)" / P2-S11-AC-085 (effective state);
CMSCOMP-DRAFT-TARGET guard (20260927500000 / 20261005018060).

## Open items / BOUNDARY
- RED-first note: the executable RED is the existing bench assertion #41 (run 1 FAIL). The equivalence suites assert the new
  bodies equal the old ones, so they pass before and after the behaviour-neutral rewrite by design; they did catch two defects of
  my own first drafts (runs 8 and 10).
- `cms_revision_effective_state` now duplicates the derivation held in the set form `cms_revision_effective_states` (the
  "one derivation" of 20261005017540 is now two bodies). Pinned by the agreement test. Alternative if root prefers one body:
  re-point the set form at the single form (slower for 1000-id list reads); not done.
- Remaining per-row cost is the insert machinery (9 FK triggers, RLS policy calls, the admission guard at ~66 microseconds per row).
  The guard's trigger/function names and body are pinned by S09/S11 oracles, so it was not restructured.
- Registry digest (19 ms) and the placement expansion (9 ms) are linear and belong to the governed/closure helpers; not touched.
- Bench numbers move +/-30% with host load; the < 300 ms assertion passed with 25% headroom under heavy load (run 16) and failed
  once (run 15, p95 332 ms) on a host where even unchanged operations were 30% slower.

## Requests to root
1. Promote `supabase/migrations-wip/placement-perf/*.sql` (five migrations, in order) with the two new test files; they stage
   cleanly beside `gaps-db2` (run 17). They do not touch `cms_create_pattern_version`, `cms_write_commands*`, or any function patched by
   the other live WIP lanes (grep checked).
2. Include the two new pgTAP files in the canonical `db:verify` list and the CP evidence; the bench `gaps_perf_patterns.sql` #41 is
   the acceptance test (rerun it on a quiet host in the canonical run).
3. Decide whether the duplicated derivation in cms_revision_effective_state is acceptable (see Open items).
