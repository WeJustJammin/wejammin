# Lane claude_s12_repair_a report

## Status
PARTIAL (2026-10-22 14:30 EDT): every file of my claim is GREEN; the full 72-file Slice 12 run has exactly ONE failing assertion, in a file
outside my claim, a wall-clock perf bound that failed under host load (see Run 3 and Requests to root).  HEAD b16edb54. Lane stack:
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,repair-a`.

## Scope
Make all Slice 12 pgTAP files green on the full WIP stack; classify every failure.

## Files
Edited after run 1 (hashes recorded in the final report):
- supabase/tests/phase_02_slice_12_composition_authority.sql, _composition_instance_guards.sql, _composition_owner_integrity.sql (harness: `position`)
- supabase/tests/phase_02_slice_12_pattern_placement/{040-positive,050-refusals,060-big}.sqlinc (stale oracle: exact flat slot)
- supabase/tests/phase_02_slice_12_pattern_update_diff/{010-diff,020-states}.sqlinc (stale oracle: typed DEC-193 diff)
- supabase/tests/phase_02_slice_12_pattern_updates/{000-oracles,010-accept,020-detach,050-bulk,070-adoption,075-eligibility}.sqlinc (stale oracle: DEC-193 detach/choices)
No WIP SQL edited, no repair-a migration (supabase/migrations-wip/repair-a/ exists, empty): no genuine production defect was found.
All 8 touched dirs/files below are test-only; none is under supabase/migrations. Line counts / SHA-256 after the final edit (unchanged since run 2):
```
187 947ae2fd007208ff91eb0e8612308ec6468bd347fb68f80283a8385238ed4254 phase_02_slice_12_composition_authority.sql
135 03db48d6606a8c30badb331c69b2ffbde7e433189cc9c72de54d0c50560bc512 phase_02_slice_12_composition_instance_guards.sql
156 c28337c5d39811a91d64b412c3921bc592390587e2c62456bc9253f2f1e6243f phase_02_slice_12_composition_owner_integrity.sql
123 0a8696e93c8d6df0f02932efc67ce525c8d04b8cd79e40573831c3bfca230528 phase_02_slice_12_pattern_placement/040-positive.sqlinc
227 197bbf3b18a0f395e2bec24d95fa5e5917b8937ac7772fbcf0d5d2c3944914ad phase_02_slice_12_pattern_placement/050-refusals.sqlinc
 90 2c792b3b3a8e8ef19858bd41253c351f686b9be64139b29e073321291a066d6a phase_02_slice_12_pattern_placement/060-big.sqlinc
144 d3d4d5ff311688fab8b627bec56f05d16b902ef292f8554627eb428d9aa69e68 phase_02_slice_12_pattern_update_diff/010-diff.sqlinc
 60 e4d927b1952703df97f3d0d6618f3d22a4d776c9107c60229c4049aaf1fbca98 phase_02_slice_12_pattern_update_diff/020-states.sqlinc
139 70573da12a62366e4eaed3d18c617bb07729f9820f8a84e2e01951cc2171678e phase_02_slice_12_pattern_updates/000-oracles.sqlinc
 90 7d3abf36ea7b0f79c33b98945cf7467a01bc06f9080b774657bf6c98a03db344 phase_02_slice_12_pattern_updates/010-accept.sqlinc
 50 e432d0e950f811403fbfab2fd54a372b1ce937314150cc91fde31a378f992425 phase_02_slice_12_pattern_updates/020-detach.sqlinc
 68 270c84d0ae499181317bcbbf98b550f00efcdcc35957b8cb8a7f45f548187a39 phase_02_slice_12_pattern_updates/050-bulk.sqlinc
 51 e9fe3d573d843c09aa9f5c1c586dc1ddabeb5f49abebad93f158b6f86ec7b3db phase_02_slice_12_pattern_updates/070-adoption.sqlinc
 25 f6838d893ceef1ff7796ed72d1b327e94927c20b58184067c82413cd1a89e40d phase_02_slice_12_pattern_updates/075-eligibility.sqlinc
```
(supabase/tests/ prefix on all.)  Plus NEW `docs/handoffs/2026-10-22-claude-s12/lane-repair-a-corrections-pattern-updates.diff`
(ff85f459958b05f668d32e16be572e3604fd47da3720847b6fbf3265ab16769e).  The pattern_placement and pattern_update_diff `.sql` entry files are unchanged.

## Runs
Run 1 (13:37-13:40 EDT 2026-10-22, stamp 133731-1734717), six files, stack = lane list above (+ repair-a empty).
TAP `.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202+dec205+dec206+governed-recheck+repair-a-133731-1734717.tap`
SHA-256 98f3603cc35573c6f346474758ee12e14912c364ce29ae50e623be5f1f57f6b0. Files=6, Tests=2465, Result FAIL.
- composition_authority 16 / instance_guards 5(+) / owner_integrity: all GREEN after the harness fix below (the three files
  were edited minutes before pg_prove reached them; they will be re-proven in the final full run).
- pattern_placement 10 failed / 605 (177-178, 414-415, 424-425, 538-541)
- pattern_update_diff 47 failed / 527
- pattern_updates 30 failed / 1293 (425, 432-433, 449, 451-452, 582, 585, 611, 614, 634-641, 831, 834, 839, 842, 1244-1245, 1259, 1262, 1282-1285)

Run 2 (13:48-13:51 EDT, stamp 134756-1791740): pattern_placement + pattern_update_diff + pattern_updates after the test corrections.
TAP `.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202+dec205+dec206+governed-recheck+repair-a-134756-1791740.tap`
SHA-256 7726511a34e9609dc70a812e5c456e9d1107d49e037bd7221ad99c0e53ab6472. Files=3, Tests=2758, 0 not ok, Result PASS (exit 0).

Run 3 (13:51-14:28 EDT, stamp 135135-1815604): ALL 72 `supabase/tests/phase_02_slice_12*.sql` files, same 11-lane stack.
TAP `.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202+dec205+dec206+governed-recheck+repair-a-135135-1815604.tap`
SHA-256 6c5971eaa756c9572176067d885612011a81aece3132daa52edf38c546c7195d.  Files=72, Tests=13988, 1 not ok, Result FAIL (pg_prove exit 1):
`phase_02_slice_12_related_perf.sql` test 17 "projecting the 64-target rule set meets the RPC < 300 ms target (p95 of 20) [P2-S12-AC-279]":
`# p95 ms write/project: project=475.3, write=151.5`.  Classification: ENVIRONMENTAL TIMING, not a feature defect and not in my claim.  Evidence: the
same file measured project 191.2 / write 59.6 in root's all-WIP run (alt-staged-...-023928-3189723.tap:38740), 196.9/54.6, 256.6/95.4 and 113.2/39.7 in
earlier runs; this run's write bound (test 16) passed, but both numbers are ~2.5x slower than every prior measurement and `uptime` read load
average 13.63 (other lanes' gates running; run took 2132 s).  I did NOT rerun it (same bytes; lane rule).  All other 71 files, including all
69 files not in my claim and all 6 files of my claim, are fully green: 13987 ok.  The three composition files (aborted in run 1) are proven in run 3.

## Classification (run 1)
- composition_authority / instance_guards / owner_integrity: HARNESS. Fixture INSERTs into
  platform_private.cms_composition_instances omit `position`, NOT NULL since promoted migration
  20261014110000 (DEC-185). Abort 23502 (exit 3, no plan). Fix: add `position` to every fixture insert (5+4+1 inserts).
- pattern_placement: STALE ORACLE. Tests place into `/main/more`, `/main/<237 x>` etc. (slots nested under a template slot).
  The dec193 WIP `20261016040400_cms_pattern_slot_exact.sql` + BE03c:1511 ("the request slotPath must exist in the revision's template")
  + template slot key grammar `^[a-z][a-z0-9_-]{1,63}$` (packages/contracts/src/cms-composition/template.ts:25) make the slot flat and exact;
  phase_02_slice_12_dec193_slot_binding.sql asserts `/main/more` is 422 /slotPath. The promoted producer accepted a prefix.
- pattern_update_diff: STALE ORACLE. The CompositionUpdateDiffResource became typed by DEC-193 (slotPath, newRoots, base/theirs node
  values {blockKey, blockVersion, props, children}, collisionKind) - BE03c changelog 2026-10-15 and
  packages/contracts/src/cms-composition/pattern-update-diff.ts; the dec193_diff suite README says "do not reuse the legacy props-only s12pdf_check oracle".
- pattern_updates: STALE ORACLE (DEC-193): detach materializes `detached_tree` (props {}), structural/removed-root changes are collisions
  needing explicit choices, detach admits retired rows and has no 128-key bound.


## Test corrections
All are stale oracles or harness fixtures; none weakens an assertion (each rewritten expectation is hand-derived from the cited spec text and
is stronger: exact node values, children, collision kinds, slotPath, newRoots, detached trees, one added assertion per row that the tree is
null/expected).  The pattern_placement and pattern_update_diff trees are untracked in git (no baseline), so their old/new text is stated here.
The pattern_updates files (also untracked) have an exact unified diff against the pre-lane copy in
`docs/handoffs/2026-10-22-claude-s12/lane-repair-a-corrections-pattern-updates.diff`.

H1 HARNESS composition_authority / instance_guards / owner_integrity: every `insert into platform_private.cms_composition_instances(...)` gains
   `, position` in the column list and `, 0` (`, 1` for the child row with parent_instance_id) as last select item (10 inserts: 1 + 4 + 5).
   Cause: promoted migration 20261014110000 made `position integer NOT NULL` (DEC-185; BE03c Canonical records). Same fix the placement
   fixtures already use (`s12pl_row` passes p_position).

P1 pattern_placement/040-positive: p6b placed `pa` at `/main/more`; now places `pc` at `/main` -> rows `/main/a`,`/main/b`,`/main/c` at positions
   20,21,22; the slot-position array becomes `{7,12,...,22}` (was `...,20,21`). Cite BE03c:1511 ("the request slotPath must exist in the
   revision's template"), template slot key grammar template.ts:25, WIP 20261016040400_cms_pattern_slot_exact.sql, dec193_slot_binding.sql
   (`/main/more` is 422 /slotPath).  The test's own intent (a third placement into one slot never interleaves or shares a position) is kept.
P2 pattern_placement/050-refusals: path-248 / path-249 used slotPath `/main/<237|238 x>` (a nested slot that no longer exists). Replaced with a
   helper `s12pl_chain` that builds nested-reference chains: `/main` + three 60-char reference keys + a leaf key of 58+1 chars = exactly 248
   octets accepted (`ch248`), 249 octets refused 422 VALIDATION_FAILED /slotPath with zero rows written (`ch249`, one new assertion).  The two
   multi-byte controls (`/main/` + 118|119 x 'é') cannot be reproduced: slot keys and node keys are ASCII-only, so every reachable row path has
   octets = characters.  The 249-octet multi-byte refusal is kept as `multibyte-nested-slot` (refused because the slot does not exist); the
   "118 two-byte characters accepted at 247 octets" test is REMOVED as unreachable (see Open items O1).
P3 pattern_placement/060-big: big-worst used a quote-filled nested slotPath (`/main/` + 226 `"`) to maximize JSON escaping; unreachable now.
   Replaced by a real 512-row, 248-octet-path placement (32 top references -> two more 60-char reference levels -> 16 roots of 59 chars:
   5+61+61+61+60 = 248, 32*16 = 512) with the same four size/length assertions (1 MiB compact and padded); measured compact 412061 / padded 428445.

D1 pattern_update_diff/010-diff + 020-states: helper `s12pdf_check` asserts the typed key set (+ `newRoots`, `slotPath`) and compares `slotPath`,
   `newRoots`; `s12pdf_path` builds typed paths (`base`/`theirs` = {blockKey, blockVersion, props, children}, `collisionKind`). Expected values
   by hand from the world trees (pu-a hero children `/hero/title`,`/hero/note`; pu-a v2 adds root badge -> newRoots `[{rootPath:/badge,...}]`).
   Behavior corrections (BE03c Linked update): a collision-free newer target is bulk eligible even with `paths: []` (d-cta1, d-cta6,
   d-big-nested: false -> true); removal of the instance's own root is always a `removed_root` collision (d-gone: collision false -> true,
   count 1, bulk true -> false; d-gone2 kind removed_root); collisions with an override are kind `props`; the older-version no-update
   answer carries `slotPath` `/` and `newRoots` `[]`.
U1 pattern_updates/000-oracles: contentHash oracle adds `detachedTree` and nulls `patternRef` for a row with a nonnull detached_tree (BE03b
   receiving obligations 2026-10-15; BE03c Linked update; same image as dec193_consumers/010-comparison.sqlinc:98); `tree` expectation helper;
   retired rows assert no props (dec193_resolution/020: "Retirement fixes visibility/pin, not a new tombstone-props representation").
U2 010-accept: missing choice on a removed root is now asserted as 422 VALIDATION_FAILED /instances/0/choices (new test) and `theirs`
   retires pinned to version 1 (was 2: BE03c "the retired row ... keep the (pattern_id, pattern_version) of the row they follow"); u-rm2 pin 1;
   u-rm4 (`yours`) is an active detached copy pinned 1 with props {} and the resolved tree [gone, props G99].
U3 020-detach/050-bulk/075-eligibility: detach rows are props {} + exact `detached_tree` (preorder, parent index, relative key segments,
   effective props with overrides applied); d-retired and e-sp1-detach (refusals) become successful detaches ("detach admits any linked
   pattern-origin row, including a retired one", "the newest version of its path"); d-wide (156 nodes refused) becomes a full 156-node
   materialization ("no key-count refusal", node limit 512).
U4 070-adoption: u-bv1 (bulk accept of two roots whose block version changed) is a 409 diff_has_collisions (new refusal, changed block identity
   is a `structure` collision) followed by two single-instance accepts with `theirs` choices; the adopted-identity/digest assertions are unchanged.

## Spec citations
- BE03c:1511 CMS-03C-02 paragraph: "the request slotPath must exist in the revision's template (or be a root path when the entry has no template)";
  one row per block root; row path = slotPath joined with the key chain; 248-octet cap -> 422 at /slotPath; positions DEC-185.
- packages/contracts/src/cms-composition/template.ts:25 slot key `^[a-z][a-z0-9_-]{1,63}$`; key-grammar.ts:71 node key `^[a-z][a-z0-9_-]{0,63}$` (ASCII only).
- supabase/migrations-wip/dec193/20261016040400_cms_pattern_slot_exact.sql (header "DEC-193 / BE03c: a template-bound placement names one exact flat slot");
  supabase/tests/phase_02_slice_12_dec193_slot_binding.sql (`/main/more` refused 422 /slotPath).
- BE03c:1515 Linked update (DEC-193 + owner clarification "Honor each choice"): typed diff node value, collisionKind order (removed_root, structure,
  props), newRoots, slotPath, no-update answer, bulk eligibility of a newer collision-free target, choices (missing = 422, single-instance only),
  `theirs` on removed_root appends a retired row keeping the followed row's pin, `yours` appends a detached row with the resolved tree, detach admits any
  linked pattern-origin newest row incl. retired, detach materializes `detached_tree` (props {}, <=512 nodes, no key-count refusal), accept admits
  linked active/pending_diff only.  packages/contracts/src/cms-composition/pattern-update-diff.ts.
- BE03b:2292 receiving obligations 2026-10-15: D5 block side hash covers the detached content; dec193_consumers/010-comparison.sqlinc:98 independent image.
- DEC-185 (position NOT NULL; promoted migration 20261014110000), DEC-181/186 (expansion, row paths), DEC-189 (1 MiB ceiling), DEC-193, DEC-198..201 (not
  touched: carry/restore, covered by dec193_carry and dec201_* which pass).

## Open items / BOUNDARY
O1 Octet-vs-character coverage of the 248-octet row-path bound (DEC-186) is no longer reachable through CMS-03C-02: slot keys and pattern node keys
   are ASCII only and a template slot is flat, so no row path can contain a multi-byte character. The removed test ("118 two-byte characters ->
   247 octets accepted") cannot be rebuilt from a real producer. If root wants the property kept, it needs a direct unit test of the private length
   check; no spec text requires one. Not a BOUNDARY stub; flagged for independent review of the removal.
O2 The superseded-state detach (e-sp1-detach) is exercised only on the labelled fixture row (guarded insert under app.cms_rpc, as before).
O3 related_perf timing (above): needs a rerun on a quiet host by root before the canonical gate.

## Requests to root
1. Re-run `phase_02_slice_12_related_perf.sql` on a quiet host (it passed at 191/59 ms in your all-WIP run; failed at 475/151 under load 13.6 here). If
   it still fails when quiet, route to the related-content owner; it is outside repair-a's claim.
2. Independent review of the test corrections above, especially U1-U4 (hand-derived DEC-193 expectations) and the removal in O1.
3. The 11-lane stage for these files is the one listed in Status; nothing in `repair-a` needs promotion.
