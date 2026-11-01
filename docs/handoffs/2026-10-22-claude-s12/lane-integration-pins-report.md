# Lane claude_s12_integration_pins report

## Status
GREEN. Final run 014741-884281: 118 files (every `phase_02_slice_09_*.sql` + `phase_02_slice_12_block_rules*.sql`), 6,412 tests, all PASS, on the exact 14-lane stack
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,dec208,governed-v4,linked-scan` (80 WIP migrations).

## Scope
Brief `briefs/integration-pins.md`. Files changed (all claimed): S09 `r8_api_surface`, S09 `sec2_all_schema_definer_rls`, `phase_02_slice_12_block_rules/070-provider.sqlinc` + its README,
`apps/worker/src/cms-composition/README.md`. No other S09 file needed a change (named here before editing: none beyond the two). No migration edited. Transient mutant dir
`supabase/migrations-wip/integration-pins-mutant/` was created and deleted by me (verified gone).

## Files (path, lines, SHA-256 before -> after)
- supabase/tests/phase_02_slice_09_r8_api_surface.sql  238 -> 260  f928aabd... -> b3a2e5d481b351de65ba2e77ae1445d4cbc284beb834c6449f6f8561bbbf7062
- supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql  300 -> 310  8a69a9d5... -> 7e9efcf3bdb9e4710f6017605c14fd23568c26815c073652195d2f7ff37900c9
- supabase/tests/phase_02_slice_12_block_rules/070-provider.sqlinc  65 -> 192  64c2b3dc... -> 7824c941100f79f7a1029e435152defddd420b5f82c3b8a4f4a80ef79f479f7d
- supabase/tests/phase_02_slice_12_block_rules/README.md  1b20418c... -> 18655e231a8fd6fc349cd0bed9f57443362268e07351b11e37bd233833bed02d
- apps/worker/src/cms-composition/README.md  ea580b4e... -> d6aabd85044e278151b20907d5f906b60eec2c83f4b9396f017c6f7b512fbf68
Full before hashes: ea580b4e5b102821e8556168457b11e4eeab72ac7d1443079c88444fbc3b99b2 (worker README), f928aabdb0417765e04f545ae98ad8015aa3c3d00d84ceec7e641f5ade064e93 (r8),
8a69a9d580ab16ebf19bc7e2d71455b073bb4fe6eea1a1f7ddb6d00e3a1621f8 (sec2_all), 64c2b3dc5a50ec6ce94f0d9f746c0f372027e3cefb11d179d09406ef0ba87487 (070), 1b20418ce95ba69b15f206d6581337905f0b235bb9456272f62f120d58bba2a1 (block_rules README).
Tar backup of all originals (pre-edit): /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_integration_pins/orig-053951.tar

## Names added per pin
r8_api_surface `r8a_supporting` (service-role-only, Worker-called; each on its own line with lane, DEC/AC and migration; every grant is `to service_role` only):
- cms_get_instance_update_diff (pattern-updates, CMS-03C-14, 20261014140410)
- cms_apply_pattern_update (pattern-updates, CMS-03C-15, 20261014140610)
- cms_reconcile_taxonomy_merge_converge (dec194, DEC-194, 20261014190010)
- cms_recheck_governed_reviews (governed-recheck, AC-202/203, 20261022030100)
- cms_governed_recheck_resolve_event (governed-recheck, 20261022030300)
- cms_locale_observability_read (dec208, DEC-208/213, 20261022100020)
- cms_scan_linked_pattern_updates (linked-scan, DEC-222, AC-212/213, 20261022110200)
- cms_linked_scan_resolve_event (linked-scan, 20261022110300)
Totals: not typed. The last assertion's description is now built with format() from the three sets (8 + 10 + 84 = 102; the old hand-typed "74" was already stale: the supporting set was 76 before this pass).
Header comment gained a paragraph naming the eight.
sec2_all_schema_definer_rls test 6 (exact forced-table set): one name added on its own line with a comment: platform_private.taxonomy_merge_recoveries (dec194, DEC-194/DEC-212,
created 20261014190020, named by cms_reconcile_taxonomy_merge_converge 20261014190050, owned by wejammin_cms_definer). The existing 85-name literal is untouched and unioned with the new
name; the expectation is sorted with collate "C" (the catalog sorts names in C: a default-collation sort misordered identity.* vs identity_private.*).
No new SECURITY DEFINER function appears in the pinned definer list of sec2_all: test 4 (33 Slice 09 definers) and tests 7-20 (roles, privileges, search_path, policies) all pass on the final set.
Note on the S09 definers: the final stack adds no definer whose body names a forced table other than through the existing pinned tables plus taxonomy_merge_recoveries (baseline diff vs catalog was exactly that one table).

## Provider precedence (070-provider.sqlinc)
The V2-04(b) BOUNDARY comment is replaced by 12 real cases BR-M1a..BR-M6b: every ordered pair of the four reasons, each in both pin orders (/p1 then /p2 and reversed; the lo and hi patterns
of a reason differ only in their root key), asserting the reported reason is the higher-precedence one and blocking_count = 2 (one unit per failing pin), through the real manifest builder,
frozen status check and 17-category evaluator (s12pc_check). Failures are real state: pattern_not_active = successor activated after placement; nested_pattern_not_active = superseded nested
pattern; pattern_block_rules_violated = pre-rule tree placed with the plan enforcement a no-op (restored + pg_proc image asserted, as in 040); pattern_digest_changed = the frozen manifest with
one pinned pattern's recorded hash zeroed (technique of PA-A06/A07). BR-M00 asserts the successors really superseded and every other pinned root still active.
Mutation: a forward migration swapping BR/DC and NA/NN in the provider chain killed exactly BR-M1a, BR-M1b, BR-M6a, BR-M6b (run3).

## Worker README
`apps/worker/src/cms-composition/README.md`: the sentence about unemitted metrics now says the linked-scan job emits cms_pattern_linked_update_pending_total (P2-S12-AC-212) and that
CMS_SLICE_12_UNEMITTED_METRICS is currently empty (matches observability-registry.ts).

## Runs (all on the 14-lane stack; manifest in .lane-logs next to each TAP)
- run0 baseline, unmodified, r8 + sec2_all: 47 tests, 4 fail: r8 #4/#13/#14 (the 8 names above; 102 have vs 94 want) and sec2_all #6 (only difference: taxonomy_merge_recoveries). TAP ...-014003-845781.tap sha 9195815f48b4ae1a28628c9b315eec5b6b54268abcc1fd8df196b5144baad2bd
- run1 after r8 + sec2_all edits: 47 tests; r8 14/14 PASS; sec2_all #6 still failed, ordering only (default-collation sort); fixed with collate "C". TAP ...-014157-855539.tap sha 79c756b5624a91f05bc465e02de961dfe5a19e66f6beb0f8fd6ae4da65cc3125
- run2 all edits (r8, sec2_all, block_rules_legacy): 3 files, 606 tests, ALL PASS (includes the 12 new cases). TAP ...-014519-870913.tap sha 1fa89edf8fdd946fc7574bf8e6f8c50231382114800e4729583e57aa2207b820
- run3 MUTANT (+ transient integration-pins-mutant lane, legacy file only): 559 tests, exactly 4 intended failures (BR-M1a/1b/6a/6b). TAP ...+integration-pins-mutant-014646-878694.tap sha f7d73f16526a4dac09bab53aea759102985754cc39bd52e7f7acdaf974811310
- run4 FINAL, no mutant: 118 files / 6,412 tests, PASS (exit 0). TAP ...-014741-884281.tap sha f08e90942d3dc43ab2895cbbd420853dbf81e08190330fa20e3e5738eedeb4f2 (files list: /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_integration_pins/final-files.txt)

## Test corrections
Only the two inventory pins (additions to reviewed lists, root-delegated). No oracle weakened. The one assertion-text change: the r8 count description is computed.

## Spec citations
BE03c "Permission, RLS and grants" named-RPC bullet (root cascade R2-02/R3-10/V4-12, AC-261); BE03c "Preflight providers registered by Slice 12" reason precedence (~1573, P2-S12-AC-238).

## Open items / BOUNDARY
none. `database.types.ts` and PostgREST allowlists for the eight names are root's (not in this claim).

## Requests to root
- The pins are green only on the full stack (batch 1 + linked-scan); r8 #4/#13/#14 will be red on a stack that lacks linked-scan until batch 2 is promoted (r8 pins both linked-scan names). Promote linked-scan with batch 1 or accept a transient red.
- `apps/worker/src/cms-composition/README.md` is a tracked, uncommitted-modified file shared with earlier lanes; only the one sentence was changed by me.
