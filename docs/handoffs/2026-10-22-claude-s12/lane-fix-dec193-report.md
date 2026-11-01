# Lane report: claude_s12_fix_dec193 (F1)

## Status
GREEN (F1 scope complete, 2026-10-22 23:08 UTC). Final run 7 (183502-3089762): all 91 files this lane can affect pass except suites owned by live lanes F2
(block_rules_legacy 38) and F4b (governed-recheck fallout 30 + dec191 #40). HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e. Open: BOUNDARY R1-008 (spec gap), root decisions below.

## Scope
R1-002 (DEC-209), R1-003, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010; R1-004 only as needed.
WIP dir: supabase/migrations-wip/fix-dec193 (range 20261022090000-099999).

## Files
SHA-256 as of the successor checkpoint 4 (22:36 UTC). WIP SQL (before -> after where edited in place):
- dec193/20261016041500_cms_pattern_update_locked_target.sql (296 lines) b1839aa5... -> 3be4cdba816be89bb419df53962428c4af021178bee37acd7ae11839eeb4abae (R1-007)
- dec193/20261016042200_cms_revision_composition_carry_rpcs.sql (93) a714f7d2... -> 88ce2bb10566fd88256f322988004e47b7756d8d7968d5183c80179b9d04e31b (R1-002, DEC-209)
- dec193/20261017044700_cms_restore_composition_copy.sql 326 -> 280 lines, 57d93681fb69360f4c15ea67df0fc715bf0611b394dab5dce6fadbd42f6263b3 -> 1c5cfbe76b568edefe319ee732a79c897b333afccf8ae12d664f1513f94c6a14 (R1-003)
- NEW dec193/20261017044705_cms_restore_composition_copy_acl.sql (55) e52625e32a0f6e7d006b9f365acc1d88f08783da1ebfe96a4c05589353d7812b (R1-003 tail: `$owner$` + `$closure$`)
- NEW fix-dec193/20261022090000_cms_pattern_update_next_row_carry_provenance.sql (64) edd76d3b7921fa3059aeca5331c95741ad1f02cedbe0923c8df98b46b3682ef0 (R1-006)
- NEW fix-dec193/20261022090100_cms_drop_dead_pattern_update_helpers.sql (38) 703423a540eaec2311e8719cffee506b85f0db240cda4cd9ba34dedc0695ad6d (R1-005)
- fix-dec193/README.md 429b12ce...; dec193/README.md c123389d... (inventory)
Not touched: pattern-updates/* (R1-005 handled by the forward drop, no in-place edit); dec193/20261016041600 (F2's).
Tests (untracked trees; SHA-256 now): dec193_carry/{000-fixture 99745dab, 010-append-conflict 728daedb, 016 34b0130c, 017 2208fc66, 018 afaba3d3,
019-provenance-after-update (NEW) a443dd0f, README a0b89132}, dec193_carry.sql 7eb86ad3, pattern_updates/{005-schema e6bc2ebc, 040-refusals 92c1fa4a},
pattern_placement/050-refusals 8a16199e, dec193_resolution/030-inconsistent.sqlinc 6c838f3f... -> 3dc6d67f780ad5fc2a3f908609aa699e63b76f0187a3c442bfc9cb9411d927bc (successor edit, test correction 4).

## Runs
Stack for every run: pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,fix-dec193.
- Run 1 (RED, old code + new/changed tests + 044700 split) 15:46 local: files dec193_carry, pattern_updates, pattern_placement.
  TAP .lane-logs/alt-staged-...fix-dec193-154657-2357745.tap SHA-256 6cb213b7e18dcb44c36a12fa20e6bfbb65ebd33b556a617aba816b0b2a2edf41.
  Reset OK with the 044705 split (76 WIP migrations). pattern_updates 1474 tests / 5 fail = genuine feature RED:
  251 R1-005 (dead helpers exist), 796-797 and 800-801 R1-007 (old row answers VERSION_MISMATCH). dec193_carry 369 run / 3 fail:
  107, 114, 115 = genuine RED for R1-002 (resolved draft carries the base's detached local, pin 1, not the current draft's linked pin 2).
  Then HARNESS abort at 019 (label CP-APP collided with 018: s12cc_out_pkey), so pattern_placement did not run and R1-006 had no
  verdict. Harness classification, not feature RED; label renamed CV-*, Run 2 repeats dec193_carry only.
- Run 2 (RED, same old code) 15:49 local: dec193_carry only. 819 tests, 4 fail = genuine RED: 107, 114, 115 (R1-002, as run 1) and 374
  CV-PROV001 (R1-006: accept and detach rows appended after a carried head inherit its carried_from_id, `carried:true` at version 2).
  TAP .lane-logs/alt-staged-...fix-dec193-154941-2374088.tap SHA-256 a9e9796aa8bb88dd743f08713e5173c8e2cb3329f3c370bdd75ff4dce66ee653.
- Run 3 (GREEN attempt) 15:52 local, files dec193_carry, pattern_updates, pattern_placement, dec201_restore_contracts, dec201_restore_template_gate.
  TAP .lane-logs/alt-staged-...fix-dec193-155227-2391838.tap SHA-256 f5af39419b9cc2a2a2bb50426e1e0ed57b4c66edcd324d51b3b964acdbde319f.
  FAIL 139+58 = HARNESS/OTHER-LANE, not my feature: every writer call refused `function platform_private.cms_detached_tree_block_rules(jsonb, jsonb)
  does not exist`. Cause: lane F2 edited dec193/20261016041600 in place at 15:53:04 (it now calls F2's helper defined in
  migrations-wip/block-rules/20261022080100), but the brief's stack list omits `block-rules`. Not rerun with identical bytes: Run 4 adds
  `block-rules` to the stack (deviation from the brief's exact list, forced by F2's edit; see Requests to root).
- Run 4 (GREEN attempt, stack + `block-rules`) start 15:56:47 local, stamp 155647-2417168, files dec193_carry, pattern_updates, pattern_placement,
  dec201_restore_contracts, dec201_restore_template_gate. Plan 817 / 1474 / 715 / 86 / 88 (3180 tests), 16 not ok, 3,164 ok lines.
  First failing test dec193_carry 757 "rr-parent-excluded: actual public conflicting append". TAP SHA-256
  fb3e1f6f3d0899f352504edf42f5af9f4b22a186758b01c28c29fc81481c1b8e. Reset OK (461 promoted + 84 WIP).
  Classification: 16 failures (757-759, 763, 765-767, 771, 774-777, 782, 795, 798-799) = the `rr-parent-*`, `rr-fault`, `rr-retry`
  restore worlds of `dec193_carry/018-parent-path-carry.sqlinc` built on the OLD text (plan 817): genuine test-oracle defect of my own
  (DEC-209 rehome incomplete in 018). The predecessor's 016:04:43 edit of 018 (plan 817 -> 819) followed this run; confirmed GREEN in run 6.
  pattern_updates 1474/1474, pattern_placement 715/715, dec201 86/86 and 88/88 all green, i.e. R1-005, R1-007 (pattern_updates), R1-009 verified.
- Run 5 (invalid) start 16:05:03 local, stamp 160503-2465224: 0/0 tests. HARNESS: pg_prove aborted "Cannot detect source of
  .../phase_02_slice_12_block_compatib" because the predecessor passed the whole file list as ONE space-joined argument (invocation
  error). Reset itself OK (461 + 84). TAP SHA-256 15b8c44275541058f6eb9e86b8ee287ffed217957af2d81f1e91eb7837ac56d1. No feature verdict.
- Run 6 (full S12 + S10/S11 regression, stack + `block-rules`) start 16:07:19 local, stamp 160719-2481556, 91 files, plan 14,819,
  14,662 ok / 157 not ok. First failing test: phase_02_slice_12_block_rules.sql #15 "BR-SETUP: the nine rule fixtures register through the
  signed CMS-03A-05 producer". TAP SHA-256 9d661b116e8e987f05f915e4dd8721188ab63677755654cb5b6e865ded24b909.
  Mine and GREEN: dec193_carry 819/819 (incl. R1-002 CC-RES001..005 and R1-006 CV-PROV), dec193_consumers 924, dec193_diff 259,
  dec193_pattern_currentness 927, dec193_security 624, dec193_selected_roots 1203, dec193_slot_binding 119, dec193_snapshot 231,
  dec193_writer_boundaries 154, pattern_updates 1474, pattern_update_diff 577, pattern_placement 715, dec201 86/88, dec191_pattern 62, S10 and S11 files green.
  Failures by owner:
  * MINE, fixed after this run: dec193_resolution 508-509 `rs-api-prior-instance` (oracle still VERSION_MISMATCH; R1-007 makes it
    VALIDATION_FAILED `["/instances/0/instanceId"]`; I missed this file when changing the code). Genuine stale oracle of mine.
  * F2 (block-rules WIP, live lane): block_rules 31 fail (15-16, 35-36, 39, 41-43, ...), block_rules_legacy 89 fail. Not mine.
  * F4b (governed-recheck WIP, tenure-end/lag fixtures being rewritten at 16:09): governed_recheck 23, governed_activation 6 (65-68, 111-112),
    governed_decision 3 (46-48), governed_schedule 2 (51-52), dec191 #40 (approval_invalidated after a grant lapse). Not mine; re-verified in my final run.
  Stack decision: runs need `block-rules` because lane F2 edited `dec193/20261016041600` in place at 15:53:04 so that it calls
  `platform_private.cms_detached_tree_block_rules(jsonb,jsonb)` defined in `block-rules/20261022080100`; without it every writer call fails (run 3).
  Failures inside F2's suites are F2's; mine are judged only on non-F2/F4b files.
- Run 7 (FINAL, full S12 + S10/S11 regression on current bytes, stack + `block-rules`) 18:35 local, stamp 183502-3089762, 91 files, plan 14,820,
  14,751 ok / 69 not ok. TAP SHA-256 8bf378a09ff7e4d2bc640259e59f5af60fb1b51e30d06713a56348034c35d1fc. First failing test:
  block_rules_legacy #151 "BR-V01-control: actual manifest/status/evaluator execute" (F2).
  All files this lane can affect are GREEN: dec193_carry 819/819, dec193_consumers 924/924, dec193_diff 259, dec193_pattern_currentness 927,
  dec193_resolution 552/552 (the successor's `rs-api-prior-instance` correction now passes), dec193_security 624, dec193_selected_roots 1203,
  dec193_slot_binding 119, dec193_snapshot 231, dec193_writer_boundaries 154, dec191_exhausted/lineage/pattern 13/18/62, pattern_updates 1474,
  pattern_update_diff 577, pattern_placement 715, dec201_restore_contracts 86, dec201_restore_template_gate 88, dec194_sweep, all other S12 files, S10 (15) and S11 (2) files.
  The 69 failures are not mine: block_rules_legacy 38 (151-159, 162-170, 173-181, 184-192, 195-196: F2 WIP, down from 89 in run 6),
  and F4b's in-progress governed-recheck fallout, which lane F4b records itself (`lane-fix-recheck-report.md`: governed_activation 6/124, governed_decision 3/58,
  governed_schedule 2/56, dec191 #40 with exit 3, governed_recheck 19/112 (23 in run 6)). No failure involves a function this lane changed.
- GREEN edits applied after Run 2 (before/after SHA-256):
  042200 a714f7d2...->88ce2bb1... ; 041500 b1839aa5...->3be4cdba... ; new fix-dec193/20261022090000 edd76d3b... ; 20261022090100 703423a5... ;
  tests: resolve worlds rehomed to the current draft (see Test corrections).

## Test corrections
All test trees are untracked; diffs are described exactly. Each oracle change cites the spec/decision that contradicts the old text.
1. `dec193_carry` resolve worlds (DEC-209, BE03c "Receiving obligations from Slice 10" 4): the old oracles asserted that a resolved
   draft carries the CONFLICT BASE ("resolve copies exact full512-node base snapshot, not empty theirs", "distinct current is
   composition-empty; base remains authoritative"). DEC-209 makes that the exact defect. The worlds now keep their composition on
   the current draft (theirs):
   - `000-fixture.sqlinc`: `s12cc_world` gains column `carry_source_id`; new `s12cc_capture_carry(tag)` and `s12cc_theirs_first(tag)`
     (creates the current draft first and makes it the world's source); `s12cc_copied` reads `coalesce(carry_source_id, source_id)`.
   - `010-append-conflict.sqlinc`: `cc-conflict` gets a real public CMS-03C-02 placement of `cc-v2` on its current draft (linked,
     pin 2, props `THEIRS-ROOT/THEIRS-CHILD`), distinct from the base's detached local + accepted keep; setup assert the two head sets
     differ; new CC-RES004 (resolved rows = theirs placements: path, link mode, pin, props) and CC-RES005 (no detached tree, binding or
     detached link mode from the base leaks); `cc-prov` added to the world list (R1-006).
   - `016-append-carry-boundaries.sqlinc` (`cb-wide-res`, `cb-fault-res`), `017-pending-carry.sqlinc` (`cb-pending-res`),
     `018-parent-path-carry.sqlinc` (`cp-res`, `cp-excluded-res`, `cp-cycle-res`): world built on the current draft via
     `s12cc_theirs_first` immediately after `s12cb_world`; the later `s12cc_current(...)` call removed; the "base remains
     authoritative"/"empty theirs" assertions rewritten to the DEC-209 premise (base revision 1 composition-empty, current draft
     non-empty); `s12cp_conflict` keeps the old behavior for the restore worlds of `022` (names not ending in `-res`).
   - Every other assertion (exact copied rows, provenance, positions, parents, effects, replay, refusal) is unchanged.
2. `pattern_updates/040-refusals.sqlinc` `r-instance-old-row` (R1-007; BE03c 410 and 1416): token/detail changed from
   `VERSION_MISMATCH` + `{expectedVersion,currentVersion,instanceId}` to `VALIDATION_FAILED` + `["/instances/0/instanceId"]`
   (accept); new `r-instance-old-row-detach` (detach). The stale head `expectedVersion` cases (`r-instance-stale`) keep 409.
4. (successor) `dec193_resolution/030-inconsistent.sqlinc` `rs-api-prior-instance` (R1-007; BE03c 410 and 1416, same citation as correction 2):
   token/detail `VERSION_MISMATCH` + `{expectedVersion:"1",currentVersion:"2",instanceId}` -> `VALIDATION_FAILED` + `["/instances/0/instanceId"]`.
   The head's stale-`expectedVersion` oracle `rs-api-instance-cas` (409) is unchanged, so the 409/422 boundary stays pinned on both sides.
   Missed by the predecessor: first seen failing in run 6 (tests 508-509).
3. Added (no oracle weakened): `pattern_updates/005-schema.sqlinc` R1-005 assertion; `dec193_carry/019-provenance-after-update.sqlinc`
   (R1-006, driver `phase_02_slice_12_dec193_carry.sql` includes it); `pattern_placement/050-refusals.sqlinc` R1-009 (3 assertions).
   README of `dec193_carry` paragraph for CC-RES rewritten.

## Spec citations
- R1-002: BE03c "Receiving obligations from Slice 10" 4 (base row), amended by owner decision DEC-209 (2026-10-22, resolved conflicts carry `theirs`, changelog row 2026-10-22).
- R1-003: lane rules (SQL files under 300 lines). R1-005: dec193 README ("no shortest-suffix/identity heuristic"). R1-006: BE03c 1591 (carry provenance).
- R1-007: BE03c 410 and 1413/1416 (an older row is 422 COMPOSITION_VALIDATION_FAILED at `/instances/{n}/instanceId`; stale entry or instance version is 409).
- R1-009: coverage of the octet bound on `slotPath` (BE03c CMS-03C-02 slotPath length, octets). R1-010: runbook note below.

## Open items / BOUNDARY
- R1-010 decision (evidence): migrations from 20261013300000 onward are untracked (never in any commit, local branch, origin/claude/phase2-slice12 or origin/main; origin/main ends at 20261005016200). The promoted permissive producer 20261014110300 therefore never ran against a shared/hosted database; legacy nested-slot rows can exist only in local dev databases. No forward data migration or guard added.
- R1-008 BOUNDARY (spec gap, no code change): BE03c 1511/1514 say the render plan "reads each row as one block at its own path" and
  that nodes below a block root "are never rows"; BE03c 1515 requires the tree's descendants only for a row that carries a
  `detached_tree`. Final code (`dec193/042300`, `042500`, `042600`) emits one plan/checker entry per node of the effective tree
  (pointer `/composition/{rowId}` for node 0, `/composition/{rowId}/nodes/{i}` below) for NULL-tree linked rows too, and no spec
  names the pointer grammar. The pgTAP oracle (`dec193_consumers/040`) calls the ordinal pointers "a PRIVATE implementation vector"
  and the shared Worker parity literal pins them. Deciding it either way is a product/spec call (a linked root with children either
  renders its descendants in the plan or hides them from the accessibility checker), so I changed nothing. Proposed BE03c row for
  root: "The render plan and the accessibility checker input list a composition row's block root at pointer `/composition/{rowId}`
  and each descendant block of its effective tree (the detached tree, or the pinned tree resolved with the row's overrides) at
  `/composition/{rowId}/nodes/{i}`, `i` the zero-based canonical preorder index, for linked and detached rows alike; the pointer is
  an identity, not an address a client may dereference." Also needs BE05c/BE03b mention. Changing to detached-only instead means
  editing 042300/042500/042600, the Worker parity literal and the renderPlanHash vectors.

## Requests to root
1. R1-008 BOUNDARY (above): add the proposed BE03c row (render plan / checker pointer grammar for descendants, also BE03b/BE05c mention), or tell me to restrict
   descendants to detached trees (then 042300/042500/042600, the Worker parity literal and renderPlanHash vectors change).
2. R1-004 (not required, not done): superseded bodies (040700/041800, 040800/041600, 041100/041500, 041900/042900, 044500/044710, 044600/044720, pattern-updates 140200..140600)
   and the digest pins in 044710/044720/044800. Decision for root: promote as is and treat those files as untouchable, or squash. I changed 041500 and
   042200 in place and 044700 (split); none of them is pinned by 044710/044720/044800 (they pin 044500/044600 bodies and passed in run 7).
3. Stack: until F2 promotes `block-rules`, any run that includes dec193 must include `block-rules` (dec193/20261016041600 now calls
   `platform_private.cms_detached_tree_block_rules(jsonb,jsonb)` from `block-rules/20261022080100`). The helper is resolved at call time, so the later timestamp
   (080100 > 041600) is harmless on a reset; promote block-rules in the same promotion as dec193.
4. R1-010 runbook: every scope file has a timestamp earlier than the promoted `20261020203606`; a database that already applied it needs `--include-all`.
   Per evidence the promoted permissive producer `20261014110300` never ran against a shared database (all migrations from `20261013300000` are untracked, absent from
   origin/main which ends at `20261005016200`), so no data migration or guard was added.
5. Promotion-ready: new `dec193/20261017044705`, `fix-dec193/20261022090000`, `fix-dec193/20261022090100`; in-place edited `dec193/20261016041500`, `042200`, `044700`.
