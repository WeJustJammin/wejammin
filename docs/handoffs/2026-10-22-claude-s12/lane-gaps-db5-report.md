# Lane claude_s12_gaps_db5 report (DEC-240)

## Status
GREEN. Fix round 2 (V16-15) done: 55 files, 3680 tests, 0 failed on the final bytes; closeout vitest 11/11.

## Scope
DEC-240 / BE03c Receiving obligations item 3 (line 1593) and changelog row 2026-10-29: restore records exactly one current active
id per vocabulary with a carried assignment (ascending bytewise); a source-recorded version of a vocabulary with no carried assignment
is not carried. Current owner of the behaviour: `platform_private.cms_restore_term_plan` (20261024100700; the only later references are
the caller 20261024100800 and tests). The unresolvable-recorded-version refusal (pin check in cms_restore_revision) is unchanged.

## Files (SHA-256)
- supabase/tests/phase_02_slice_12_gaps_db5_restore_versions.sql (NEW) 9eeaf8454796d846910f5c6215321cdb1d6ef2733e717435359db1b0e85dfcd7
- supabase/migrations-wip/gaps-db5/20261029130000_cms_restore_records_carried_vocabularies.sql (NEW) 6acc8551c85eca47cf58e29f07bc7750246c4556013d89e6f312324fefdb059a
  Anchored 3-fragment patch (declarations, lineages assignment, the keep-recorded tail loop); unique-old and unique-new anchor checks,
  byte-for-byte inverse check, pg_proc attribute-equality check (owner, ACL, comment, volatility), lock_timeout 5s, statement_timeout 30s,
  typed 55000 refusals; no data touched (safe on a populated DB). Comment cites DEC-240; the word BOUNDARY does not appear.
- supabase/migrations-wip/gaps-db5/README.md (NEW) 031b95559c171a55dc6363c33751f85ecf4fc7ce58c039d3f449352a375d1ed9
- tests/contracts/phase-02-slice-12-closeout.test.ts (EDIT, untracked file; original tar /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_gaps_db5/orig-closeout.tar sha 4d57f9ac...7344) 5676a0d70057d9eccdcd2c015f5e1163ddea62dbef07990f86e95496fb6deddd
- supabase/tests/phase_02_slice_12_taxonomy_integrity/050-restore.sqlinc (EDIT; original tar /tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_gaps_db5/orig-050.tar) c4a6652c91c12050af5f86d27aeef50bda7dafda8af9ceb836c1342d1d04a72b

## Runs
- run 1 RED 2026-10-29 02:05 ET, lane none, new file: 20 tests, 5 not ok (10, 11, 15, 17, 19) = genuine missing feature (restored revision
  records uncarried vocabulary's id: have [A,B] want [A]; no-assignment source have [A] want []). Controls pass.
  TAP .lane-logs/alt-staged-none-020432-1980142.tap sha256 3fbf1ddedc7f907c328fc81fe30b79a56636850f25aa7ec0889905ed1be3cbd4.
- run 2 02:06 ET, lane gaps-db5: reset failed, HARNESS (my migration's inverse check used non-unique new anchors, SQLSTATE 55000). No TAP.
  Fixed (new anchors carry following context; uniqueness check on every new anchor; verified offline by replaying the 100700 body).
- run 3 GREEN 02:07 ET, lane gaps-db5 (1 WIP migration), 11 files: new file; taxonomy_integrity, _acl, _lock_order, _concurrency, _provider;
  restore_relation_visibility; dec201_restore_template_gate; slice_10_restore_chain, _restore_evidence; gaps_lock_conversion.
  pg_prove exit 0, Files=11, Tests=535, 0 failed.
  TAP .lane-logs/alt-staged-gaps-db5-020714-1993633.tap sha256 8311b6bf55e520344dd2bd763e6c6d74e4e868174fbf103f3401d4cfa68338b5.
- vitest tests/contracts/phase-02-slice-12-closeout.test.ts: 11/11 (RED before edit: expected 2 markers, received 3 incl. 20261024100700).

## Test corrections
1. supabase/tests/phase_02_slice_12_taxonomy_integrity/050-restore.sqlinc (spec: BE03c 1593 + changelog 2026-10-29, DEC-240):
   - comment: "keeps its recorded id (BOUNDARY)" -> "is not carried (DEC-240, BE03c item 3)".
   - assertion: expected '00000:/["<rs7>"]' -> '00000:/[]'; title "keeps its recorded id (still resolvable in the owner scope)" ->
     "is not carried: it still resolves in the owner scope, so the restore succeeds and records none (DEC-240)".
   The adjacent "recorded version no longer resolves -> migration_chain_incomplete" assertion is unchanged and still passes. No title is cited elsewhere in the repo.
2. tests/contracts/phase-02-slice-12-closeout.test.ts: the SQL-marker closed-set test now expects three files (adds 20261024100700, the
   superseded restore comment) and a new test asserts the DEC-240 migration exists (in supabase/migrations or migrations-wip/gaps-db5, exactly one),
   names DEC-240 and cms_restore_term_plan, holds no BOUNDARY: marker and sorts after 20261024100700. Closed set kept for every other file; 100700 not edited.

## Spec citations
BE03c line 1593 (item 3) and changelog row 2026-10-29; AC-244 (restore), AC-246 (writer rule); DEC-229 (assignment row keeps the term's write-version); DEC-240.

## Pin suites
Swept supabase/tests for cms_restore_term_plan and prosrc/md5 pins: no suite pins its body hash (references are ACL/ownership in
taxonomy_integrity_acl, a static lock-order oracle that checks the caller helper, and direct calls in 029 and concurrency; all green in run 3).
cms_restore_revision, which pin suites do cover, is not patched. No pin changed.

## Fixture note
The uncarried-vocabulary source is built as 050-restore.sqlinc builds its own (labelled h11_raw_exec write of taxonomy_version_ids on the source
revision row only, since no current writer produces that legacy shape); I disabled no trigger of mine, forged no approvals, and every restore/assignment/
activation goes through the real commands. If root reads the brief's "never by disabling triggers" as excluding h11_raw_exec, the alternative has no producer path.

## Open items / BOUNDARY
none. Promotion: root moves the WIP migration into supabase/migrations/ (the closeout test accepts either location) and removes gaps-db5.

## Requests to root
Promote 20261029130000; the 100700 header comment keeps the word BOUNDARY (promoted file, untouched by design).

## Fix round 2 (review V16, finding V16-15 BLOCKER)
Root keeps DEC-240. The round-1 sweep missed assertions about the ids a restore records; this round swept every pgTAP entry that reaches the restore path.

### Sweep
Entries: every top-level supabase/tests/*.sql whose include closure names cms_restore_revision (47) united with those whose closure names any file mentioning
cms_restore_term_plan or other cms_restore_* helpers (54), plus taxonomy_integrity_provider = 55 entry files (list: scratchpad claude_s12_gaps_db5/final_files.txt).
This is a superset of V16's 26. Static read of every taxonomyVersionIds/taxonomy_version_ids hit in the closure: the only assertion of kept-id behaviour was
phase_02_slice_10_ev_ea_lineage.sql test 9; the other hits are fixture INSERT columns (restore_transform/000, locale_variant/000, dec193_carry/000, e7_settings/*) and a race helper
(phase_02_slice_10_races/010, a .mjs: root runs races). Proven by run, not only reading: run 4 below had exactly one failure.

### Test correction (DEC-240; BE03c 1593 item 3 and changelog 2026-10-29)
supabase/tests/phase_02_slice_10_ev_ea_lineage.sql (tracked-file original: tar $SC/orig-ev_ea_lineage.tar). Exact diff:
```
7,8c7,10
< -- migration_chain_incomplete and the restore of a resolvable pin carries the pinned taxonomy
< -- version ids onto the new draft unchanged.
---
> -- migration_chain_incomplete.  A resolvable pin lets the restore proceed, but the new draft
> -- records only the current active version of each vocabulary with a carried term assignment
> -- (BE03c Receiving obligations item 3, DEC-240): a pinned version whose vocabulary the source
> -- holds no assignment for is not carried.
108,109c110,111
<   jsonb_build_array('a9140000-0000-4000-8000-0000000000f3'),
<   'the restored draft records exactly the taxonomy version ids of its source revision'
---
>   '[]'::jsonb,
>   'the restored draft records no taxonomy version id of a vocabulary its source holds no assignment for: the pin resolves, the restore proceeds and DEC-240 does not carry it'
```
Old title (pgTAP test 9, exact): the restored draft records exactly the taxonomy version ids of its source revision
New title (exact): the restored draft records no taxonomy version id of a vocabulary its source holds no assignment for: the pin resolves, the restore proceeds and DEC-240 does not carry it
S10-AC-002's text still holds: the pin check still refuses an unresolvable/foreign pin (tests 7-8 unchanged and green); only the ids a restore records change.
Root re-points: tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts:225 and tests/contracts/phase-02-slice-10-receipts.generated.jsonl:124 (old title only there; historical TAPs under docs/handoffs keep it).
The 050-restore.sqlinc correction from round 1 stands unchanged. No other test needed correction.

### Runs
- run 4 (RED discovery) 03:06 ET, lane gaps-db5, 55 files, ev_ea_lineage uncorrected: Tests=3680, 1 not ok = ev_ea_lineage test 9 (have [] want [f3]), the genuine DEC-240 consequence.
  TAP .lane-logs/alt-staged-gaps-db5-030602-2183073.tap sha256 7decc35ca4e2a2156a9d95143adfa5b86eb261015c5409d246ca8df78b17b74c.
- run 5 (GREEN, final bytes) 03:07 ET, lane gaps-db5, 55 files: pg_prove exit 0, Files=55, Tests=3680, 0 failed, Result PASS.
  TAP .lane-logs/alt-staged-gaps-db5-030757-2190519.tap sha256 e42d1bd0bb3d88337eedea5d4bfc9db9228446012aa1c16547de338a3fef7967.
- vitest tests/contracts/phase-02-slice-12-closeout.test.ts: 11/11 on the final bytes.

### Files changed this round (SHA-256)
- supabase/tests/phase_02_slice_10_ev_ea_lineage.sql ec1c90caeb2d9820bd2251b46d2e760b60e6afd36ab672e80847d5f272939055
Unchanged since round 1: gaps_db5_restore_versions.sql 9eeaf845..., WIP migration 6acc8551..., closeout test 5676a0d7..., 050-restore.sqlinc c4a6652c....
Not promoted. Races (.mjs) not run by me.
