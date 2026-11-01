# Lane claude_s12_squash report (DEC-215 history squash + Step 0 provider fix)

## Status

GREEN (2026-10-23T02:20Z). HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e.
- Step 0 GREEN: the `cms.pattern.active_digest` passing path answers exactly one row (RED run 1: BR-V05 #197 only; GREEN run 2: block_rules_legacy 198/198).
- Squash done for every pair of the brief. 13 WIP migrations deleted, 11 edited, none of `supabase/migrations/` touched. The only remaining digest pin
  (`dec193/20261017044800`) pins the immutable promoted-stack body of `cms_restore_revision`, not a WIP body (see Open items 1).
- Catalog snapshot equality PROVEN: baseline (run 3, pre-squash bytes) vs after (run 4, squashed bytes): 3656 objects each, 3655 identical hashes, 0 objects added or removed.
  The single differing object, `platform_private.cms_list_composition_instances(jsonb)`, is defined only by `dec206/20261022050000`, a file another lane changed between the
  two runs (stage manifests: SHA-256 42727530... -> 7c5b313c...). Nothing of mine touches it.
- Final wide run (run 4, same bytes as the after-snapshot): 256 files, 24,619 tests, 82 not ok, all pre-existing and outside this lane (Runs).
- Vitest (parity/ledger/documentation tests, 10 files, 73 tests): 0 fail. No Vitest file names a deleted migration.

## Scope

Brief `briefs/squash-dec215.md` (DEC-215, review R1-004; R1-003/R1-005 context). Step 0, snapshot, pair-by-pair squash, snapshot equality, final run.

## Files

### Step 0 (debug-by-test)

| File | Change | SHA-256 before -> after |
| --- | --- | --- |
| `supabase/tests/phase_02_slice_12_block_rules/070-provider.sqlinc` | RED test: `BR-V05` passing-pin assertion now compares the WHOLE row list to `array['passed::0']` (was: first row only plus a diag of the rows) | (not recorded before) -> 266e3d8114f62415c6d23e44df6e496e9777d6bb19760f01b1505e6c7d377961 |
| `supabase/migrations-wip/dec193/20261016044200_cms_pattern_active_digest.sql` | one `return;` after the passing `return query` (live body of the provider is defined here; `block-rules/080500` patches other text, none of its anchors contain this line) | db89e9880b7d4a2271cd7579f7f74ddc0abcf866aca60aea9c26e6704022b8d8 -> 0340c68b59361eb8862f8c76fba93d4df90c85245bb0c383b53308b87f8d92e2 |

### New

| File | Lines | SHA-256 |
| --- | --- | --- |
| `supabase/tests/phase_02_slice_12_squash_catalog_snapshot.sql` | 190 | 277a5099025ec58fb03c4d5ad55369d8ee3759e3451c5d6e9c44f9eba5e13050 |

pgTAP-free; read-only. One `ok N - <kind> <schema.name...>` per object plus `# sha256:<hash> <key>` (functions: `pg_get_functiondef`, owner, ACL, kind, comment;
relations: kind, owner, ACL, options, RLS flags, every column with type/null/default/identity/generated/collation/comment/column ACL, view or sequence definition;
constraints, indexes, policies, triggers, types, schemas with ACL and default privileges). No OID enters a hash. Run it FIRST in a staged run. Compare with
`cmp.py`-style by key (the `N` prefix shifts): `# sha256:<hash> <key>` lines of two TAPs.

### Edited (SHA-256 before = run-2/3 stage manifest; after = run-4 stage manifest)

| Path (under `supabase/migrations-wip/`) | Lines | Before | After |
| --- | --- | --- | --- |
| `dec193/20261016040300_cms_get_instance_update_diff_dec193.sql` | 109 -> 123 | ab38c5fae9445daa9ef8165c28a02cacedf38128f3df7509b035840f4a68f5ac | 44905939b9d0e3328d09ccd99064773049b18088c6380b744600724d408572cf |
| `dec193/20261016040700_cms_pattern_root_snapshot.sql` | 107 -> 108 | af5e6e2b6a3d1d7b853b308130b118f79eb62882f087cfa4eca06cb4f76e75c8 | 7b9299f5c533837033c7df8b68f23c552afed85ace7a48fb39df6f4207bfa52f |
| `dec193/20261016040800_cms_detached_tree_registry.sql` | 124 -> 109 | 348f294c75459b9d7602ddf91baf2cc60db06574e183d17c3f0c65a32421a46c | 2206505b5243b2174b9da3b569955ba7aa1dc51c75cec302fd213ba9d7e855e0 |
| `dec193/20261016041900_cms_revision_comparison_dec193.sql` | 157 -> 158 | c540dd5a1f9ecd04c0ee436c91ae41f94aee4f1cb06fc0be1cf223210f4eaa53 | 03980e153eff2fad61041d7b103df343da2fc5fedffad5b7cd1a07ec1f6d8c59 |
| `dec193/20261017044500_cms_restore_composition_plan.sql` | 296 -> 297 | a47bf25715d0753eb04e65abfd1fa930c5e9c3827889cdf1ba69ca39028a7aa4 | e5f211c18ec672c66b8a300e19946d00ea37e619366dfb3c04dfb04a2b135690 |
| `dec193/20261017044600_cms_restore_composition_registry.sql` | 275 -> 276 | 4d61d677cba37615708a01e4e62df04afc7e70c997e376c8277db733f394f408 | 115eb2f452d76471f05c5ade419ed8f8aa70d8fb951d3808c95d1b1b8e0a3854 |
| `pattern-updates/20261014140200_cms_pattern_update_plan.sql` | 201 -> 94 | 32773f926ac9691963cfb139290e94c2fafcb623b01c68494e4acb0f78abf914 | be1258c148702327d9d3df1992b4547411ad532f4679edbce944d969be00af74 |
| `pattern-updates/20261014140500_cms_pattern_update_check.sql` | 146 -> 147 | 885de34d8cbc19c571d3049cf9ad759317ee538b775ce16a3f8bce28a6ccf713 | 2138591264f0e5dbc839ccd143cb556af2b6baba3aa684736fd3e65864a4459b |
| `pattern-updates/20261014140550_cms_pattern_update_next_row.sql` | 81 -> 105 | e767b52fe96d740777e51d5eb305445904c429cc41088df9650e1e37ace956d5 | f2f89049bdc4a142240b4a442b52c8f59a8dbc09f9b7e7bfe48beeff14b7aa5f |
| `pattern-updates/20261014140600_cms_apply_pattern_update.sql` | 282 -> 298 | 1160f326cf4ba9541cdd579ccd4f6ea3b0f5c03caa0a869310c5fd3f5460b13d | 520eb425f57dd86991812b6b6f338a89f1911a99bd043f8f5cd717142f1771fa |
| `pattern-updates/20261014140605_cms_apply_pattern_update_closure.sql` | 39 -> 50 | 58339980aa933cb214f4c89eab9e6646b93713d4c47ccacf366eb6fc2c7ca4db | c8cdca02472c6b332f028e97df8b3532702f7348bac18bdab8361f964324cfa7 |

All stay under 300 lines (largest 298).

### Deleted (SHA-256 at deletion = run-2/3 stage manifest)

| Path (under `supabase/migrations-wip/`) | Lines | SHA-256 |
| --- | --- | --- |
| `dec193/20261016040900_cms_pattern_update_plan_dec193.sql` | 59 | c605b0f4beb660c89934d59285ba9cf4fdb329ac4ddb65cf859386bdb739e577 |
| `dec193/20261016041000_cms_pattern_update_next_row_dec193.sql` | 88 | 8b7b7d30155b6410b4efd85cf4ab38a5e017a2fae2fa3e9c9b2d8d0749ed134f |
| `dec193/20261016041100_cms_apply_pattern_update_dec193.sql` | 278 | c3f44ef01dedf794fa900807a58d943c7110808ee11467422907c0e1331933d4 |
| `dec193/20261016041400_cms_pattern_update_check_expanded.sql` | 150 | 2e216de635a067490ecbd7c6bdf0bb32b39f0962ec5c5580fca0fd3676d50acf |
| `dec193/20261016041500_cms_pattern_update_locked_target.sql` | 296 | 3be4cdba816be89bb419df53962428c4af021178bee37acd7ae11839eeb4abae |
| `dec193/20261016041600_cms_detached_tree_safe_props.sql` | 101 | f8fabf71cecc304a47a0b8d2d6984a387e77082ba8eb205d50ae8cc64a3dd7bc |
| `dec193/20261016041800_cms_pattern_root_snapshot_template_binding.sql` | 100 | c43b9b3a935791b1c791176079b7249e4f2293874c184892e1021c35d7029bde |
| `dec193/20261016042900_cms_revision_comparison_pending_dec198.sql` | 99 | d4eab7c4adbf2c5a53f25c78b7d06418c7c91955537ab538ddc11d7f13b97dfd |
| `dec193/20261017044710_cms_restore_composition_ref_qualification.sql` | 148 | 4a38cd2e91d96f155477ef08f594e4672ce75bbc75af819fd2a328fd1cc974ff |
| `dec193/20261017044720_cms_restore_composition_registry_qualification.sql` | 141 | 2f5b60666e04fbea1bd2fb3e0702289a3209cd01f06dc6cf952d1f83cdb7b992 |
| `pattern-updates/20261014140400_cms_get_instance_update_diff.sql` | 125 | 926c0a7d7d0e109ab40c4a6c440a96ab2a730496b0df7eb360829f97c54c24c6 |
| `fix-dec193/20261022090000_cms_pattern_update_next_row_carry_provenance.sql` | 64 | edd76d3b7921fa3059aeca5331c95741ad1f02cedbe0923c8df98b46b3682ef0 |
| `fix-dec193/20261022090100_cms_drop_dead_pattern_update_helpers.sql` | 38 | 703423a540eaec2311e8719cffee506b85f0db240cda4cd9ba34dedc0695ad6d |

`fix-dec193/` keeps only a README (the standard stack list names the lane; the runner refuses a stack lane whose directory is missing).

### Docs (my claim; no behaviour)

| File | SHA-256 |
| --- | --- |
| `supabase/migrations-wip/dec193/README.md` (table rows for folded files, DEC-215 section appended) | 02de443b7050c71f7df7c0d600e96b3d349c046559d47c49acd624d5a1724c1a |
| `supabase/migrations-wip/fix-dec193/README.md` (rewritten: emptied lane, where each fix now lives) | 7f4a1fc8141b9e6d6aee8a3bcbdc72dc1ea8ec766a95bcc47f3f9c19e73a7757 |
| `supabase/migrations-wip/block-rules/README.md` (writer paragraph points at `040800`) | 4f7a7de013c1ab11d8f8c462b2e4ff2ff7629d459ef7107cb611f057ca023c3e |

## Per-pair decisions (evidence)

Direction (a) = fold the final body into the EARLIER file and delete the superseding one. (b) = delete the earlier definition, the superseding file becomes sole.
Every final body is the byte-for-byte text of the former last definition (extracted programmatically, not retyped); every file that keeps a function keeps its
owner/ACL/comment statements, and the final comment is the one of the former last definition.

| Pair | Direction | Reason / evidence |
| --- | --- | --- |
| `040700` <- `041800` (root_snapshot, ambiguous `template_id`) | (a) into 040700, 041800 deleted | One plpgsql body, no create-time dependency; 040700 already owns owner/ACL/comment (comments identical). Body now uses `v_template_id`. |
| `040800` <- `041600` (detached_tree_registry; DEC-210 + executable-leaf) | (a) into 040800, 041600 deleted | Same; the former `041600` body (which calls `block-rules/080100` `cms_detached_tree_block_rules`, resolved at call time) is the body; 040800's comment unchanged by 041600. |
| `140600` + `041100` + `041500` (cms_apply_pattern_update) | (a) into pattern-updates `140600`, 041100 and 041500 deleted | The pattern-updates closure `140605` asserts the command's callees at its own timestamp (check/target/plan/next_row), and the apply body has no create-time dependency, so the final text can sit at 140600. `block-rules/080400` anchors on the UNCHANGED final text. Owner/ACL/table grants moved into `140605` so `140600` stays at 298 lines (<300). |
| `041900` <- `042900` (cms_list_revisions reader, two anchored replacements) | merged into 041900, 042900 deleted | Both patch the same promoted body. `anchor_new` of 041900 now carries the final `state in ('active','pending_diff')` predicates (exactly the global two-token substitution 042900 asserted: 2 occurrences). Single replacement from the promoted text to the final text. |
| `044500` <- `044710` (restore refs) | (a) into 044500, 044710 deleted | The qualification is a text transform (`template_id`->`restore_template_id` x6, five root_chain anchors). Applied offline: pre-state md5 419e2a3b.../7777 octets and post-state md5 ca0b5904.../7865 octets, sha256 ac9965f2..., all equal the values 044710 pinned. Pins disappear with the file. |
| `044600` <- `044720` (restore registry) | (a) into 044600, 044720 deleted | Same method: pre md5 010fb7fb.../10086, post md5 a1f71f4c.../10126, sha256 33406a4e..., equal the 044720 pins. |
| `044800` pin (27,517 octets, md5 b326ae0f..., sha256 a8e0b1e8...) | KEPT | Pins the body of `cms_restore_revision(jsonb)` as produced by the PROMOTED migrations alone (`20261014050310` is the last promoted amender; `grep` over all WIP shows no other WIP file touching it). It is the immutable baseline the migration amends, not a superseded WIP body; promoted files cannot change, so the pin cannot go stale. Removal is three lines if root rules otherwise (Requests 1). |
| `140200` (plan) <- `040900` | (a) into 140200, 040900 deleted | `140605` asserts `cms_pattern_update_plan` exists at 140605. Dead `cms_pattern_update_view` / `cms_pattern_update_effective_props` (R1-005) are simply not created, so `fix-dec193/090100` (the guarded drop) is deleted. `cms_pattern_update_target` (live) stays. |
| `140500` (check) <- `041400` | (a) into 140500, 041400 deleted | `140605` asserts it at 140605; 041400 was a "clone with two predicate literals changed" (reversing them reproduced 140500, README). |
| `140550` (next_row) <- `041000` + `fix-dec193/090000` | (a) into 140550, 041000 and 090000 deleted | `140605` asserts it. The R1-006 anchor (`v_row.carried_from_id := null;` after `v_row := p_head;`) is part of the single body; the 090000 guard (`carried_from_id` absent, one anchor) is no longer needed. |
| `140400` (diff reader) vs `040300` | (b) 140400 deleted, 040300 sole | `040300`'s closure asserts `cms_pattern_diff_plan` which exists only from 040200, so the final reader cannot move to 140400. 140400's table SELECT grants and its grant-if-missing privilege closure (callee list minus the unused `cms_pattern_update_plan`) moved into 040300 and still run; the wrapper `140410` closure is null-safe (`to_regprocedure` null -> no-op; the definer owns the function anyway) and unchanged. |
| `140410`, `140605`, `140610` | kept | Wrappers and closures; `140605` only gained the owner/ACL/table grants of the apply command (see above). |

Not squashed (not in the brief's pair list, no digest pin of any WIP body): the anchored amendment chains `dec193/040400` -> `043700` -> `block-rules/080300` (insert_pattern_instance),
`dec193/044200` -> `block-rules/080500`, apply body -> `block-rules/080400`, promoted `create_pattern_version` -> `080200`. See Open items 2.

## Runs

All on the standard stack `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,fix-dec193`.

| # | Local start | Stamp | Files | Result | Classification |
| --- | --- | --- | --- | --- | --- |
| 1 | 20:58 | 205829-3736902 | `block_rules_legacy` (Step 0 RED) | 198 tests, 1 not ok: #197 `BR-V05: a rule-satisfying pin answers exactly one row` have `{passed::0,failed::0}` want `{passed::0}`. TAP SHA-256 3b60317492dd283cb3e2ad69e7a114c2d22b98673e78b278931aebafdacf9f37 | genuine defect, right reason |
| 2 | 21:03 | 210327-3762305 | snapshot + `block_rules_legacy` | legacy 198/198 ok (Step 0 GREEN). Snapshot: `psql ERROR: function pg_catalog.acldefault(text, oid) does not exist` (0 tests) | HARNESS (my snapshot SQL; CASE needed a `"char"` cast). Its stage manifest is the authoritative list of the pre-squash bytes |
| 3 | 21:42 | 211637-3825685 | snapshot only (BASELINE, pre-squash bytes) | 3656 objects, pg_prove exit 0. TAP SHA-256 db6211fb42da95a9c44474c5bb452c71750ceb147399996e4898d00febea0c8d | baseline. Stage manifest identical (544 SHA-256s) to run 2 |
| 4 | 21:44 | 214227-3937275 | snapshot FIRST, then 255: every `phase_02_slice_12*.sql` (75), all `phase_02_slice_11*.sql` (96), all `phase_02_slice_10*.sql` (81), `phase_02_slice_09_r8_api_surface.sql`, `..._sec2_all_schema_definer_rls.sql`, `..._sec2_definer_rls.sql` | reset OK (461 promoted + 70 WIP, was 83). 256 files, 24,619 tests, 82 not ok, 1939 s. TAP SHA-256 3955ecf8df9ea8ed9e5ddc06153204681761482d43e69c73bbf538cae182f7a3 | AFTER snapshot + final wide run |

Run 4 failures (all pre-existing; none involves a function this lane changed):
- `phase_02_slice_12_locale_observability.sql` 78 of 111 (7-48, 51, 57-63, 65, 68-69, 72, 74, 76-77, 82-88, 93-102, 105-108): lane `dec208` (the private reader) is not in the standard stack. The same file failed 56 of 78 in F2's run 8 (195257-3453719) and in F4b's 195130-3442572.
- `phase_02_slice_09_r8_api_surface.sql` 3 (4, 13-14) and `phase_02_slice_09_sec2_all_schema_definer_rls.sql` 1 (6): S09 inventory pins reserved for root integration; identical failing test numbers in runs 202345-3587229, 205837-3737452 (before my edits) and F4b's 195130-3442572.
- The five files F2 saw failing at its 20:25 run (dec191, governed_activation, governed_decision, governed_recheck, governed_schedule) pass here: no governed-recheck WIP file differs between that run and mine (stage manifests), so the cause was F4b's then-in-progress test fixture, since fixed by F4b. `block_rules_legacy`, every `dec193_*`, `pattern_*`, `dec201_*`, `dec191_*` and all S10/S11 files pass.
- Compared with F1's final run 7 (183502-3089762): the same S12 files pass; its 69 failures (block_rules_legacy 38 F2, F4b fallout) are gone for the reasons above.

Snapshot compare (`snapshot-compare.txt` in the lane scratchpad): objects before 3656, after 3656, only-before 0, only-after 0, hash differs 1 (`function platform_private.cms_list_composition_instances(p_request jsonb)`, explained above). F3's `cms_taxonomy_merge_recoveries` rename and the F4b/dec208 changes did not occur in the stack between the two runs, so no exclusion was needed; the set of non-mine stage files that differ between run 3 and run 4 is exactly `dec206/20261022050000`.

Vitest (pinned toolchain): `tests/contracts/phase-02-slice-12-ledger-inventory.test.ts`, `phase-02-slice-12-pattern-updates-pending-parity.test.ts`, `phase-02-dec202-progress-denominator.test.ts`, `phase-02-slice-09-phase-completion-policy.test.ts` (4 files, 43 tests) and `tests/documentation-boundaries.test.ts`, the four `phase-02-slice-12-*-witness-parity.test.ts` (pattern-lineage, pattern-placement, taxonomy-lineage, taxonomy-terms), `phase-02-slice-10-process-record.test.ts` (6 files, 30 tests): all pass. A search of `apps/ packages/ tests/ infra/ scripts/` for every deleted file name and timestamp finds no hit.

## Incident (disclosed)

Run 2 staged at 21:08:52 (its manifest records the pre-squash bytes). I applied the squash right after it staged, before its snapshot SQL had failed, and I had taken no copy of the
pre-squash files (the WIP migrations are untracked in git). Lane F4b's run 3790157 (stamp 210911) staged at ~21:10 and therefore ran on my squashed stack (its reset succeeded). To obtain an honest
baseline I rebuilt the 24 original files (13 deleted, 11 edited) from the session transcripts of earlier lanes plus inverse transforms of my own text, accepting a file only when its SHA-256 equals
the SHA-256 in run 2's manifest (24/24 matched; the 044710/044720 pins and the restore md5/sha values independently confirmed the transformations), restored them, took the baseline (run 3, manifest identical to run 2), and re-applied the squash. The WIP tree was in the original
state for ~25 minutes (21:17-21:42); every other lane saw either the original or the final squashed state, never a mix. Lesson for root: copy untracked WIP before editing in place (`tar` into the scratchpad); the originals are kept in `claude_s12_squash/orig-backup.tar` (lane scratchpad) for rollback.

## Test corrections

None. Step 0 changed one assertion in `block-rules/070-provider.sqlinc` (BR-V05 passing pin: whole-list `array['passed::0']`); it tightens, it does not weaken.

## Spec citations

BE03c "Preflight providers registered by Slice 12" (line 1567-1569): `cms.pattern.active_digest` is a preflight provider whose answer per category is one (outcome, reason, count); the evaluator reads one row (`cms_evaluate_preflight` `SELECT ... INTO`, `cms_revision_manifest_identities_current` `SELECT ... INTO`). Two rows for a pass was an unreachable second row, wrong by emission order only. DEC-215 (history squash).

## Open items / BOUNDARY

1. 044800 digest pin kept (promoted baseline, see table). Brief said "find which and remove the pin with its subject": the subject is not a WIP file. Root decides; recommendation: keep (it guards an amendment of an immutable baseline).
2. Anchored amendment chains left as they are (each step's anchors are asserted, no digest of a WIP body is pinned): `dec193/040400` (full clone of insert_pattern_instance) -> `043700` (anchored) -> `block-rules/080300` (anchored); `dec193/044200` -> `block-rules/080500`; apply body -> `block-rules/080400`; promoted `create_pattern_version` -> `block-rules/080200`. They fall under the DEC-215 principle only if root considers the clone in `040400` or the pre-patch text an "intermediate body"; they were not in R1-004's list and F2's lane owns the block-rules patches. A follow-up squash of `040400`+`043700` into one definition is mechanical (same method) if wanted.
3. R1-008 pointer grammar / DEC-214, R1-001, R1-002 etc.: untouched by this lane.

## Requests to root

1. 044800 pin decision (Open items 1).
2. Stale references to deleted files outside my claim (history, not behaviour): `.memory/pipeline/progress/slices/phase-02-slice-12.md` (claim `files:` blocks, lines ~3718, 3834, 3880, 1725 name 040700..044710, 041500, 041800, 044710), `.memory/raw/events/2026-10-22.jsonl` (041600), `.memory/wiki/specs/audits/propagation-scan-2026-10-15-codex-dec193-choice.md` (140400), `supabase/tests/phase_02_slice_12_composition_instances_read/README.md:10` (says the detach writer is `dec193/20261016041600`; now `dec193/20261016040800`), and historical handoff docs. Vitest guards that read the tracker pass.
3. Promotion: `fix-dec193/` has no migration any more; drop the lane from the stack list at promotion. The folded files now hold DEC-193 text inside the `pattern-updates` timestamps (`2026101414xxxx`), so `pattern-updates` must be promoted together with `dec193` and `block-rules` (as before, now also for the apply/plan/check/next_row definitions).
4. Candidate memory item (not written by this lane): editing untracked WIP in place needs a copy first; see Incident.
5. No new `files:` blocks to claim; lane claim can be released (the lane is DONE).
