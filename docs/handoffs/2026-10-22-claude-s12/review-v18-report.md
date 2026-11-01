# Review V18 report: DEC-243 block-owner WIP migration and its test corrections

Reviewer: independent population (did not author the work). Worktree HEAD `4f643787fa5ab300d953cd4b4ddbc2b6152d01a3`, branch
`claude/phase2-slice12`. Read-only except this file. No sub-agent. No process killed. Review time 2026-10-29 14:10Z to about 14:37Z.

## Verdict

**PROMOTE-WITH-CONDITIONS.**

Counts: BLOCKER 0, MAJOR 1, MINOR 9, NIT 5.

The migration is correct, minimal and safe: it changes exactly two lines of the installed function body and nothing else, all
12 pgTAP files (357 assertions) pass with it applied, and I found no behaviour test that asserts the old owner-scoped list.
Promote `20261029150000_cms_template_context_platform_blocks.sql` byte for byte. The conditions are about the change set that
must travel with it (the Slice 12 evidence ledger, receipts and the AC-159 text; the lane's re-point list is incomplete, see
MAJOR-1) and a few one-line hygiene fixes. None of them requires changing the migration.

## Inputs fixed at review start (SHA-256)

| Path | SHA-256 |
|---|---|
| supabase/migrations-wip/block-owner/20261029150000_cms_template_context_platform_blocks.sql (70 lines) | 77057575a7408cc872858f15359ffe2364a226eec16dac89cb4c273be235876a |
| supabase/migrations-wip/block-owner/README.md | e490e3472a47c39b7e3f1ad119521610b97b906f88d9bb37f46b27e08e9a255e |
| supabase/tests/phase_02_slice_12_block_owner_red.sql (149 lines) | 5e09607d493c4c0fcdc42ffdf2c92844734f0520f482de8d71195a417be894ea |
| supabase/tests/phase_02_slice_12_gaps_db1_template.sql (167 lines) | 7b0496c42bfad9968d337a2171ec72856942d6f663b6ebe8413a118b0bcbc4b4 |
| git HEAD version of the db1 file == lane's saved original (`<scratchpad>/claude_s12_block_owner/db1_template.orig.sql`) | 067f64b79d74680a0d2dc89f7606ae4b51f6d0f91e21be8fa128b5697bfb77bc |

All four lane hashes in `lane-block-owner-report.md` match the files. The lane's two TAPs match their recorded hashes:
`.lane-logs/alt-staged-none-100342-4158467.tap` cf63b5ec784463c96a1f64b65d0edd54e0c546e85860c70d9c29a0e7948d9d0a (run 2, lane
`none`, 569 promoted + 0 WIP, 28 ok / 3 not ok: 22, 23, 25) and `.lane-logs/alt-staged-block-owner-100855-4179341.tap`
dc767ab31d2d81147fc0dfaeefb04f7f28b455df55505628a33df1afa62effaf (run 4, 569 + 1 WIP, 304 ok, 0 not ok). The four input
files were re-hashed after my run: unchanged.

## My run (one run, as the brief allows)

| Item | Value |
|---|---|
| Runner | `docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh`, lane `block-owner` (the WIP lane), background, no `timeout` |
| Start / reset ok / end (local EDT) | 10:18:02 / 10:18:39 / ~10:19 (14:18Z); no queue wait |
| Stage | 569 promoted + 1 WIP (`20261029150000`, SHA 77057575… in the manifest, line 571) |
| Targets (12) | the lane's 11 (block_owner_red 31, gaps_db1_template 25, gaps_db1_template_context 17, template_context 9, fix_template_reads_rpc_context 14, gaps_perf_templates 20, template_authority 70, r8_api_surface 14, sec2_all_schema_definer_rls 33, sec2_definer_rls 54, gaps_db1_acl 17) plus `phase_02_slice_09_p240_reads_detail.sql` (53; the Slice 09 precedent oracle P2-S09-AC-145) |
| Result | `Files=12, Tests=357`, **PASS**, 357 ok, 0 not ok, no skip/todo; reset log: "Applying migration 20261029150000_cms_template_context_platform_blocks.sql" then "Finished supabase db reset", no error |
| TAP | `.lane-logs/alt-staged-block-owner-101802-17337.tap` SHA-256 74ab014d4f158bba601132cd751d406863be5a0d6d5c5c02eca8ad9446dd36c4 |
| Manifest | `.lane-logs/alt-staged-block-owner-101802-17337.manifest` SHA-256 ab14b56570f83d7cd5f3d19e62f18977f0cb2f2559658d7d0ca9566ba14a9a00 |
| After | ALT `supabase/migrations` link points back at the promoted dir; no `/tmp/wejammin-alt-stage-*` left |
| Titles | no duplicate pgTAP title in any of the 12 files |

## Brief checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Patch removes ONLY the owner predicate | PASS | Offline model of the DO block run on the exact bytes of the installed body (the `$body$` text of `platform_private.cms_template_context` in `20261013100500_cms_template_context_rpc_flag.sql`, 3128 bytes, SHA a38667f7…): `anchor_old` occurs once, `anchor_new` zero times; new body 3206 bytes (SHA 556cbca3…); the only difference is body lines 61-62: `where block_row.owner_id = acting_party_id` / `and block_row.state = 'registered'` become one `-- DEC-243 ...` comment line plus `where block_row.state = 'registered'`; prefix and suffix are byte-identical. `state = 'registered'`, the latest-lifecycle `coalesce(..., 'supported') = 'supported'`, `order by ... collate "C"`, `limit 128`, `set_config('app.cms_rpc','true',true)`, `cms_template_designer_authorized` and the `{blockKey, blockVersion}` select list are present in both. In the database the same guards passed on the real chain (anchor once, new absent, inverse equals source, definition contains source once, every `pg_proc` column except `prosrc` and the function comment equal before and after: owner, SECURITY DEFINER, search_path, ACL, volatility). The file runs one `execute` against the private function only; the `platform_api` wrapper is untouched. |
| 2 | Inverse check really restores the installed source | PASS | Offline: `replace(new, anchor_new, anchor_old) === old` is true on the real bytes (`model-anchor.mjs`). In-DB: migration lines 47-53 raise `DEC-243 non-anchored change` otherwise and did not. See NIT-3 (the guard is implied by the two conditions before it). |
| 3 | Populated-DB safety | PASS by construction | The migration reads and writes no table and validates no constraint; it replaces one function source. Nothing depends on row data, so a populated database and a fresh one behave identically. Failure modes are loud and atomic: SQLSTATE 55000 with a named token, whole file in `begin`/`commit`, `lock_timeout 5s`, `statement_timeout 30s`. A second application refuses with `DEC-243 unexpected anchor` (forward-only, as DEC-232). Neither source migration was ever edited after its single commit (`git log`: 32faf5fd for `20261013100500`, 3cdded35 for `20260927320000`), so no environment can hold a drifted source. No populated witness is needed. Limit: I could not run `migration up` on a seeded database (no ad-hoc DB access is allowed to me). |
| 4 | Context read still never returns owner ids, renderer refs or manifests (BE03c 206) | PASS | Select list unchanged (`block_key`, `block_version` only). `phase_02_slice_12_gaps_db1_template.sql:164` asserts every selector is exactly `{blockKey, blockVersion}` over the 128-item list that now includes the foreign-owner row; it passes. The Worker/contract layer is strict (`packages/contracts/src/cms-composition/template.ts:45` `.max(128)`; `template.test.ts:81-82` refuses `rendererRef`; `apps/worker/src/cms-composition-production-context.test.ts:156` refuses a leaked `ownerId`). |
| 5 | No other block reader affected | PASS | The only changed object is `platform_private.cms_template_context(jsonb)`; its sole caller is the unchanged wrapper (`20261013100500:131`). A static model of the latest textual definition of 1160 functions (`latest-block-readers.mjs`) finds 26 that read `cms_block_definition_versions`; apart from the context read none filters a block by owner except CMS-03A-08 `cms_advance_block_lifecycle` (`20261003130400:185-188`, `owner_id = actor_id`, the release principal, consistent with registration at `20261003130600:34,67-77`). The validators read by key and version with no owner predicate (`20261014090100:53-58`, `20261014020300:77-83`, `20261014020400:240-246`, `20261014090200`). The only other textual `block_row.owner_id` hits are superseded definitions (`20260902080000:5502,5661`, `20261002134000:181`, `20260927320000:68`), replaced by `20261002209000`. Anchored-replacement migrations are not modelled; a grep for block-alias `.owner_id` over all migrations finds nothing else. |
| 6 | Each test correction follows from DEC-243; none weakens an unrelated assertion | PASS | See the table below. |
| 7 | RED file's relabelled controls are honest | PASS with MINOR-1 | Assertion-by-assertion comparison of the 31 titles of the RED run (run 2) against my run: exactly tests 30 and 31 differ, as the report says. 30 keeps its predicate (an organization-owned copy is listed) and says it no longer distinguishes the filter. 31's predicate is inverted (`bo_listed(released)`), and the title discloses that it asserted absence before. Test 25 was NOT updated and its title is now false (MINOR-1). Tests 22/23/25 failed in run 2 for the stated reason (`have: []`, want the four released blocks). |
| 8 | Sweep missed no Worker/web/contract test asserting the owner-scoped list | PASS for behaviour tests, FAIL for evidence artifacts | I swept `registeredBlocks`, `cms_template_context`, `templates/context`, `TemplateContext`, `cmsTemplateContext` across apps, packages, tests, supabase/tests and infra: every Worker, web, contract, postgrest and e2e hit is a mock, a bounds/shape check, a 403 path, or selects a run-unique block; none asserts that another owner's block is absent. The artifacts that DO still encode owner scoping are listed in MAJOR-1, MINOR-9 and NIT-1. |
| 9 | Suites run once with the WIP applied | PASS | 12 files, 357 tests, 0 failures (above). |
| 10 | Decision record and spec amendment | PASS with MINOR-8, NIT-5 | `.memory/raw/events/2026-10-29.jsonl` line 10 is `dec-243`: valid JSON, the standard keys, `metadata.canonicalId` DEC-243, and the five body sections (Problem, Options considered, Decision, Downstream, Reversibility); `decisions.md` is not compiled (none of DEC-240..243 is in it), which is root's step, not a finding. BE03c:203-207 is amended and a changelog row exists at :1930; FE03:1129 is amended. The migration header's citations were checked against the files: `20261003130600:34,67-77` (owner = `cms_release_actor`), `20260927320000:68` and `20261013100500:100` (the old predicate), `20261002209000:10-13` (the Slice 09 ruling, quoted nearly verbatim; the lane report and migration header cite it without line numbers or as 8-11), `phase_02_slice_09_p240_reads_detail.sql:112` (AC-145). |

### Test corrections (db1), checked against git diff

| # | Change (db1 lines) | Follows from DEC-243? | Unrelated assertion weakened? |
|---|---|---|---|
| 1 | header and fixture comments (1-8, 90-91) | yes, wording only | no |
| 2 | `129 owned ...` becomes `130 supported candidates (129 of the caller's organization plus one of another owner) are cut at exactly 128` (141) | yes: the foreign row is now a candidate; value 128 unchanged | no: the cap is asserted over 130 candidates, two over the cap instead of one, still fails if the cap changes or vanishes |
| 3 | first selector `gap.b000` becomes `gap.a001` (143-145) | yes: `gap.a001` (supported, other owner) is the lowest supported key; `gap.a000` (deprecated) and `gap.a002` (withdrawn) are still asserted absent in 5 | no: C-order position 0 still pinned |
| 4 | index 127 `gap.b127` becomes `gap.b126` (147-149) | yes: arithmetic checked (index 0 is a001, b000 is index 1, so index 127 is b126; b127 and b128 are cut) | no: the 128-key cut still pinned at both ends |
| 5 | excluded keys `a000, a001, a002, b128` become `a000, a002, b127, b128` (150-154) | yes: `a001` leaves the exclusion list, the two cut keys join | no: lifecycle exclusions (deprecated, withdrawn) are kept |
| 6 | NEW: `gap.a001` is a selector (155-160) | yes: the inverted owner-scoping assertion | n/a: it replaces what old assertion 5 encoded |

The content-type owner exclusion ("an active compiled type of ANOTHER owner is excluded") and the shape assertion (164) are
untouched. Only owner-scoping of blocks flipped; cap, C-order, lifecycle and shape are all retained.

## Findings

### MAJOR

**MAJOR-1. The lane's re-point list is incomplete; promoted as listed, the Slice 12 evidence guard stays red and the ratified
AC-159 text keeps contradicting the tests that cite it.** The migration is not at fault; the change set is. The guard
(`scripts/evidence/ledger-guard-lib.mjs`: `receiptProblems` at 366-394, `clauseProblems` at 130-165) requires a fresh receipt
(file SHA and title) for every cited test and requires every clause text to be a verbatim part of the entry text, which must be
the tracker text. Root must do all of the following in one change set (line numbers as read at ~14:21Z; the ledger file is
being edited by another actor, last write 10:15 local):
1. Ledger titles: the lane says three titles (items 2, 3, 5, "lines 1899-1911"). There are **four**: add the omitted
   `the cut keeps the first 128 keys in C-collation order, dropping gap.b128 [P2-S12-AC-159]`. Current lines in
   `tests/contracts/phase-02-slice-12-evidence-ledger-143-213.ts`: 1929, 1935, 1941, 1947. The new titles are in db1 lines 141,
   145, 149, 154 and 160 (`another owner's supported block is a selector ...` is new and could be cited).
2. Receipts: all **13** receipts for the db1 file in `tests/contracts/phase-02-slice-12-receipts.generated.jsonl` carry
   `fileSha256 067f64b7…` (the HEAD file); the file is now `7b0496c4…`, so every ledger citation of this file is stale (10
   citations in `ledger-143-213.ts`, all AC-159, and 4 in `ledger-001-071.ts` at 2920-2966, all AC-023, which the lane never mentions).
   Lines 390, 392, 401, 402 carry the old titles. Regenerate with `node scripts/evidence/run-slice-evidence.mjs --slice 12`.
3. AC-159 text: the ratified criterion still reads "at most 128 owned registered, currently supported block selectors" in
   `.memory/pipeline/progress/slices/phase-02-slice-12.md:4079`, `.memory/wiki/specs/phases/phase-2.md:3263` and
   `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md:186`. The ledger entry text
   (`ledger-143-213.ts:1794`) and clause (`:1923`) copy it verbatim and cannot be reworded alone. If it stays, the clause
   "owned" is cited to tests proving another owner's block IS a selector. DEC-243's Downstream list says only "the S12 ledger
   text"; the criterion itself needs the same amendment (root, owner may override).
4. Gap inventories quote it: `gaps/inventory.json:864,872`, `gaps/inventory-20261029.json:848,856`.
Fix: amend the three AC texts, then the ledger text and clause, re-point the four titles, regenerate receipts, rerun the guard.

### MINOR

**MINOR-1. RED test 25's title is false.** `supabase/tests/phase_02_slice_12_block_owner_red.sql:105-106` is
`ok(bo_listed('ctx:leaked','bo.released'), '[RED] the leaked-flag read does not list the released block either: the owner predicate, not RLS, hides it')`.
The assertion passes when the block IS listed; TAP now prints `ok 25 - [RED] ... does not list ...`. The lane relabelled 30 and
31 but said 22/23/25 are "unchanged". Reword to the positive (for example "the leaked-flag read lists the released block as
well: before DEC-243 the owner predicate, not RLS, hid it").

**MINOR-2. No assertion that a designer of a second organization receives the same selectors.** DEC-243's claim and its
Slice 09 analogue (`phase_02_slice_09_p240_reads_detail.sql:112`, "visible to an authorized reader of any organization") are
cross-organization, but the only evidence here is one production-shaped read as one organization (RED 93-98) and one forged
row with an arbitrary owner uuid (`db1:118`, `...09ff`). Add a read as a second organization designer (grant it
`cms.template_designer` through CMS-03A-15) and assert the same list.

**MINOR-3. The 128 cap is now platform-wide and truncates silently; the web treats "absent from the list" as unavailable.**
`apps/web/src/components/cms-composition/cms-template-designer-request.ts:113-127` refuses a save with "One or more block
choices are no longer available. Reload." when a slot names a block missing from `registeredBlocks`, and
`apps/web/src/components/cms-pattern-designer/CmsPatternNode.tsx:52-55` marks such a node retired. Once the registry holds
more than 128 supported (key, version) pairs, a valid supported block ranked past 128 in C-order can neither be chosen nor
re-saved by an existing template or pattern. This is spec-bound (BE03c:206, BE03a:1963 `max(128)`), not a patch defect, and
it is strictly better than the previous always-empty list; record it as an open item with a tracking issue (pagination or
search before the registry nears 128 selectors), and say in the BE03c amendment that the cap is platform-wide.

**MINOR-4. BE03a still leaves a block row's `owner_id` undefined.** `.memory/wiki/specs/be/03a-content-schema-registry.md:2134`
states `owner_id uuid NOT NULL` with no meaning; that ambiguity produced this defect (twice: `20260927320000:68` and
`20261002134000:181`). The lane recorded it as a BOUNDARY; DEC-243's Downstream list omits BE03a. Add one sentence: `owner_id`
of a block version is the signed release principal id (`cfg_release_principals.principal_id`), never a party, and registry
reads are not owner-scoped.

**MINOR-5. The WIP README fails `prettier --check`.** `supabase/migrations-wip/block-owner/README.md:3-4` (table column
alignment); `format:check` covers `supabase/**/*.md`. It disappears when root removes the lane directory at promotion, but any
commit that includes the directory first fails `pnpm format:check`.

**MINOR-6. Lane-rule breach: an untracked file was edited in place with no tar backup.** The RED file (untracked, 146 to 149
lines, SHA be748d57… to 5e09607d…) was rewritten in the fix round; lane-rules "Never" requires
`tar -cf <scratch>/<lane>/orig-<stamp>.tar` first and the path in the report. The lane scratch directory holds the tracked db1
original, a scan script and run logs, and no tar. Effect: tests 30/31 and the header are verified by the run-2 TAP titles, but the pre-edit bodies of tests 1-29 are not
recoverable for a byte comparison (their titles are identical in both runs).

**MINOR-7. Lane-rule breach: pattern kill.** The report discloses `pkill -n -f phase_09_dummy` during run 3. I checked the
aftermath: the ALT link, locks and stage dir were clean and my run staged normally. Benign, disclosed, recorded.

**MINOR-8. FE03 was amended without a changelog row.** `.memory/wiki/specs/fe/03-cms-content-modeling.md:1129` now says
"platform-wide supported block (DEC-243)", but the FE03 changelog (ends with the DEC-242 row near line 2906) has no DEC-243
row; BE03c has one (`be/03c-...md:1930`).

**MINOR-9. The security-facing route label is stale.** `packages/contracts/src/platform-registries.ts:1803` and the generated
`docs/openapi/openapi.json:26262` (`x-bola-test`): "caller sees only owned active type and supported block selectors" reads as
owner-scoped blocks. Only non-emptiness is tested (`route-registry-contract.ts:46`, `registry-parity.test.ts:180`), so a
reworded string (for example "caller sees only owned active types; blocks are platform registry records") plus an OpenAPI
regeneration is safe.

### NIT

**NIT-1. Stale comments.** RED header lines 5-9 and 12 still describe the defect in the present tense and say the forged
control "shows the filter"; RED lines 2-3 name the WIP path, which dangles after promotion;
`supabase/tests/phase_02_slice_12_gaps_perf_templates.sql:3` ("registered blocks of the owner"; the bench now measures a
non-empty list, which is more honest than before); `tests/e2e/phase-02-slice-12-page-operations-real-route.spec.ts:59,157`
("lists only blocks the acting party registered"); `tests/e2e/support/s12-pw7-block.ts:2` ("REGISTERED BY THE WORLD OWNER, so
... chooser lists it": the block is registered by a fresh release principal). The lane's Request 2 (stale postgrest and
pw7 header comments) was already done by someone else.

**NIT-2. A permanent regression guard is named and tagged RED.** `phase_02_slice_12_block_owner_red.sql` and `[RED]` titles
(94, 98, 106) will read as temporary; consider a neutral name and tags at promotion (rename only before any ledger citation).

**NIT-3. The DO-block inverse check is implied.** Migration 47-53: with `anchor_old` present once and `anchor_new` absent before
and present once after, `replace(new, anchor_new, anchor_old) = old` follows. Harmless and consistent with DEC-232; I confirmed
it holds.

**NIT-4. Two tests now assume an empty registry.** RED test 23 (exact four-key list) and db1 index 0 / 127 (143-149) hold only
when no other block is committed. True under `db:test`: my approximate scan (`begin`/`commit`/`rollback` tracking with `\ir` expansion) of 500 top-level pgTAP
files found no block registered outside a transaction, and `db:verify` runs pgTAP right after the reset and before the API tests. Fragile if pgTAP is
rerun after API or e2e stages without a reset.

**NIT-5. Spec wording.** BE03c:206-207 has two adjacent parentheticals before the field list; the changelog row at
`be/03c-...md:1930` names the section "Route Registry (cmsTemplateContextRead)" though the change is under
"### Registry invariants" (200-207); FE03:1129 reads "platform-wide supported block (DEC-243) selectors".

## Conditions for promotion

Required:
1. Promote the migration unchanged as `supabase/migrations/20261029150000_cms_template_context_platform_blocks.sql`; remove
   `supabase/migrations-wip/block-owner/`; add the `supabase/migrations/README.md` section (the lane asked for it).
2. Land MAJOR-1 in the same change set (AC-159 texts, ledger text/clause, four titles, regenerated receipts, guard green).
3. Reword the title of RED test 25 (MINOR-1), which changes the RED file hash; do this before any receipt or ledger citation
   of that file.

Recommended in the same change set: MINOR-2 (cross-organization assertion), MINOR-4 (BE03a sentence), MINOR-8 (FE03 changelog
row), MINOR-9 (label plus OpenAPI regeneration), MINOR-3 (open item and issue), NIT-1.

## Not verified

- No negative-path execution of the DO block (a mutated anchor, a second application) and no populated `migration up`: I may
  not run ad-hoc SQL or add files to `supabase/tests`. Coverage is the offline model on the real bytes plus the in-DB guards that
  passed on the real chain.
- I did not run the evidence guard or any vitest/Playwright suite: the tree carries concurrent uncommitted ledger, web and e2e
  edits by other lanes, so a red result would not be attributable. The stale-receipt conclusion rests on the receipt hashes
  versus the current file hash and on the guard source.
- Worker, web, contract, postgrest and e2e tests were checked by reading, not running (they mock the database).
- The correctness of DEC-243 itself (an owner decision) was checked only against the specs: no IA03, BE03a, BE03c or FE03 line
  makes a block or release principal organization-owned.

## Process notes

- Three read-only grep scripts (`sweep1.sh`..`sweep3.sh`) were first written in the shared scratchpad root, contrary to the
  lane-rules scratch rule; I moved them into `<scratchpad>/claude_s12_review_v18/` within minutes. Nothing else touched.
- My scratch (reproducible): `<scratchpad>/claude_s12_review_v18/` holds `model-anchor.mjs`, `latest-block-readers.mjs`,
  `commit-scan.mjs`, `body-old.txt`, `body-new.txt`, `inputs-before-run.sha256`, `run1.out`, `sweep*.sh`.
- No git add, commit, stash, checkout, reset, restore or push; no edit of any file other than this report.
