# Lane pattern-def - CMS-03C-12 SQL producers (`cms_create_pattern_version`, `cms_pattern_latest`)

- Date: 2026-10-14
- Lane: `claude_s12_pattern_def_sql` (staged-runner lane `pattern-def`), model Sonnet 5.5
- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`

## Status

PARTIAL. Final run 4: complete plan 1..325 (prior RED plan 249; grown by 76), **285 pass / 40 fail**, zero harness aborts.
Every one of the 40 remaining failures is blocked on two things outside this lane (classified below with TAP evidence):
(a) a genuine DEFECT in the frozen governed helper `platform_private.cms_governed_current_digest` (SQLSTATE 42P10), and
(b) governed CMS-03C-07/08/09 not present in this lane's staged run (`blocked-on-governed-07/08/09`). Nothing was faked.
Every assertion not blocked on (a)/(b) passes, including ACL 42501 for anon/authenticated (#120, #123-124, latest-read
equivalents), replay, CAS, atomicity under an injected fault, storage/guard witnesses and the latest read.

## Scope

Forward migrations only under `supabase/migrations-wip/pattern-def/`, timestamps 20261014020000-020500. Suite
`supabase/tests/phase_02_slice_12_pattern_definition.sql` + directory: cases added, no oracle weakened. Worker TypeScript untouched.

## Files (path, lines, SHA-256)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations-wip/pattern-def/20261014020000_cms_pattern_forest_validators.sql | 267 | 48e802800bfce90879822749143c92b021fc0055a9f927f67b5db37c97916e09 |
| supabase/migrations-wip/pattern-def/20261014020100_cms_pattern_storage_lineage.sql | 178 | 513e5e495870a852206c5c802128f9745c5a97d3a326571e878dbc10cb119cd8 |
| supabase/migrations-wip/pattern-def/20261014020200_cms_pattern_lineage_guard.sql | 68 | e7e7dfffb6c55e06896b5e6e57c49714c6d74906f018337f076722efff534cd9 |
| supabase/migrations-wip/pattern-def/20261014020300_cms_pattern_graph_helpers.sql | 144 | 5d8acb54079147b6468aa86a03aba41224aa802673878f4c49677e1d7f8297bb |
| supabase/migrations-wip/pattern-def/20261014020400_cms_create_pattern_version.sql | 289 | a8a3bb7d1863f0bf259ff28c39b0fdaefe353fe3e93a7562be84bce5a2598790 |
| supabase/migrations-wip/pattern-def/20261014020500_cms_pattern_transport.sql | 177 | b07f956ac49068fc73958c8ae0ae1058629b90a9206d087f8c8470fce4533153 |
| supabase/tests/phase_02_slice_12_pattern_definition.sql | 64 | 7df8b1207af487dd6b2b530821345e8ec14fcf76793c66e801438b3e06a738e1 |
| .../pattern_definition/010-oracles.sqlinc (additive: `latest` operation, `p_operation` arg) | 120 | 816d0cb8b74de710665b20058b813651e4f43541ff50f97fd0ba102f620f4e1b |
| .../025-agreement.sqlinc (new) | 29 | e2b80bcba70348a6f86c410034f5d727ac33aec12046c3b81901581a286fb348 |
| .../055-nested-agreement.sqlinc (new) | 6 | f590278ea3466cce44fbd7e88964612604e72c33c103070e269499b32f15d9e2 |
| .../070-storage.sqlinc (new) | 159 | fbdb55519e3cb3dfd04ef7a8fcf25ce487effc75d47f106e391a8d186b1686ae |
| .../080-latest-read.sqlinc (new) | 64 | a0ec25a8ccee0a750725b2a5855510ead67177ca1c9143ed99f53f44ef97c101 |
| .../090-atomicity.sqlinc (new) | 26 | f3b9caeaefd36ef34dea4e7ec8b3b0546b5af7f084a37cbd10f78c113a45a1e5 |
| .../README.md | 30 | 4bb8bc894a55936b6623cc7dc60857671feb0246856dfafb1d6c38a7ca6f031f |

Unchanged existing includes: 000, 020, 030, 040, 045, 050, 060 (hashes as in the 2026-10-12 manifest). Main file edit: `\ir` lines for
the new includes; `090` is ordered BEFORE `060` because 060 withdraws the only supported block.

Design: 020000 pure validators (`cms_pattern_forest_check/_nodes/_node_shape_valid/_type_ids_valid/_refs/_props_valid`);
020100 storage (columns, lineage backfill, CHECKs, E13/E14, lineage FK); 020200 lineage rules folded into the existing
`cms_pattern_versions_lifecycle_guard` (no new trigger); 020300 nested closure, registry digest, resource projection;
020400 the producer; 020500 latest read, `platform_api` wrappers (service_role only), privilege closure.

## Runs (staged runner, lane `pattern-def`, 2026-10-14 EDT)

| # | Time | WIP | Plan | Pass/Fail | First failure | TAP | SHA-256 |
| - | ---- | --- | ---- | --------- | ------------- | --- | ------- |
| 1 | 02:14 | 020000-020200 + new tests | 253 (aborted) | 23/230 | #10 producer missing (42883); #25 frozen digest defect; 070 aborted on `like` (HARNESS, my include; pgTAP name is `alike`) | alt-staged-pattern-def-021456-2093103.tap | 7b2077eb0304a7e8ce3d27eb1e3c42d0ac695f2fbde6298f97697141221fc59b |
| 2 | 02:16 | all six | 317 | 271/46 | #50 frozen digest defect (42P10) | alt-staged-pattern-def-021614-2101658.tap | e52193cc136c892693b0913c2d34929e11443a2d5da745f4383b03459403ddbf |
| 3 | 02:18 | all six (+latest-read capability fixture fix, 090 reordered, closure witness) | 325 | 285/40 | #52 frozen digest defect | alt-staged-pattern-def-021838-2116082.tap | b4fa70977b39ef54c6f6cdeb89481f5ddb180d2f3614e94996824e4e5ec0d6d1 |
| R1 | 02:21 | all six; 13 regression suites (pattern/composition/trigger/definer catalogs, S11 fixtures) | 829 | see below | | alt-staged-pattern-def-022133-2134198.tap | b06ddc9be38bf6fd8acb8eb6cd0f3ab80baf07972d657e81fc168789062e06df |
| R0 | 02:22 | baseline, lane `none`, same 13 files | 829 | see below | | alt-staged-none-022220-2139019.tap | 8134e5d7de448c4ea391fa7e268fff2172fb40bb94101a3a89dcbbf33e65fb9c |
| 4 | 02:24 | all six (+ FK keeps name `..._pattern_owner_fkey`); suite + 3 composition suites | 365 (suite 325) | suite 285/40; the 3 composition suites 40/40 | #52 frozen digest defect | alt-staged-pattern-def-022419-2150281.tap | be82fa0b1c4b15e325ef79bda563e7a6d5acfe4c15c429d68c032d8fcdd0c343 |

Regression comparison R1 vs R0 (identical failure diagnostics except one): pre-existing, independent of this lane (identical in baseline):
`phase_02_slice_09_schema` #448 (trigger inventory), `sec2_all_schema_definer_rls` #6/#12 and `sec2_definer_rls` #11 (pinned forced-table
set / least privilege now fails for governed tables, e.g. `cms_governed_activation_schedules`), and `phase_02_slice_11_helpers_manifest`
and `phase_02_slice_11_recheck_run` abort at `003-registry.sqlinc:55` with `null value in column "lifecycle_version"` (the fixture's raw
insert predates the NOT NULL column of 20261013300000). The one difference, `composition_owner_integrity` #2 (a frozen assertion of the
FK NAME `cms_composition_instances_pattern_owner_fkey`), was MY regression; fixed by keeping that constraint name (run 4: all three
composition suites pass).

### Classification of the 40 remaining failures of run 4 (TAP 325 plan)

- Frozen-helper DEFECT, SQLSTATE 42P10 `for SELECT DISTINCT, ORDER BY expressions must appear in select list`, #50, #51, #52, #243, #244
  (recompute `cms_governed_current_digest('pattern_version', ...)` of a stored row) and #198 (governed submit of `child`, `have: 42P10`).
  Cause: `20261013300400_cms_governed_frozen_status.sql` pattern branch `select distinct closure.block_key, closure.block_version ... order by
  closure.block_key collate "C", closure.block_version`; the ORDER BY expression carries a COLLATE that is not the select-list expression.
  The producer deliberately does NOT call that function (it uses `cms_pattern_registry_digest`, the same tuple/JCS fold with the DISTINCT
  in a subquery), so create itself is unaffected; #25/#52 are the agreement witnesses that will pass once the helper is fixed forward.
  Proposed forward fix (root/governed lane; I did not touch it): wrap as `select reached.* from (select distinct ...) reached order by
  reached.block_key collate "C", reached.block_version`.
- blocked-on-governed-07/08/09 (assign 42883 / decide 42883 / activate 42883 at TAP #201, #202, #205...): #198-#208 (child), #225-#236 (nested)
  prerequisite chains; downstream of a nested pattern that cannot become `active` without them: #210-#213, #218-#221, #223-#224,
  #238-#239, #241-#242 (positives of nested expansion, 32x16=512, 513, self/indirect cycle, pinned parent unchanged). No active row was forged.

## Test corrections

None to an existing oracle. Additive helper changes in `010-oracles.sqlinc` (no assertion weakened): `s12pd_run` operation allowlist gains
`'latest' -> select platform_api.cms_pattern_latest($1)`; `s12pd_refused` gains a trailing `p_operation text default 'create'` passed to the run.

## Hazard dispositions

1. Legacy object-tree vs ordered-forest CHECK: both admitted by `cms_pattern_versions_block_tree_valid` (object -> old bounded key check; array ->
   `cms_pattern_forest_check`). Legacy `{"nodes":[...]}` rows are grandfathered, never rewritten (their nodes lack kind/key/blockVersion/props, so a
   rewrite would invent data); they keep `compatible_type_ids='[]'` and `node_count=0` (defaults), so they can never be nested, and the latest read
   serves forest rows only. Witnessed by #250-#253 and the four frozen fixture suites (run 4).
2. Semantic depth/props: forest depth is NODE depth (<=8) computed by a level-capped walk (JSON nesting would give 16+), props <=64 keys and depth 8
   via `cms_json_bounded`; hostile depth cannot recurse the walk (levels > 10 are not expanded). Reachable digest/cycle compatibility: nested
   pins are resolved by `(owner, lineage, definition version)` exactly as `cms_governed_pattern_row/closure` do; a chain deeper than the governed
   closure's nine levels is refused `pattern_depth_exceeded` rather than silently truncating the digest.
3. Version-row FK vs stable lineage: `cms_composition_instances_pattern_owner_fkey` now references `(pattern_id, version, owner_id)` (new unique
   key), NOT VALID then validated only when clean. Downstream: `20261005017560_cms_dependency_manifest.sql:234,703` and
   `20261010164100_cms_dependency_recheck.sql:82-83` still join `pattern.id = instance.pattern_id`, which is a version-row id; they are correct
   only for version 1 and must join `(pattern_id, version)` when CMS-03C-02 lands (request to root).
4. Ambiguous populated-legacy backfill: MIGRATE deterministically (not refuse): lineage = `(owner_id, pattern_key)`, `pattern_id` = id of the
   lowest-version row (version 1 normally), `supersedes_id` = the row at version-1 when it exists else NULL; self-checks abort the deploy only on a
   cross-owner/key lineage. Why: (owner,key,version) was already unique, no producer ever wrote a row, so no input is ambiguous.
5. Immutable guarded definition fields: the existing lifecycle guard is replaced (not a new trigger) keeping the governed-lifecycle early return;
   `070` proves hash, lineage id and type list are immutable in place and lineage rules on INSERT.
6. Definer/trigger/callee privilege closure: functions owned by `wejammin_cms_definer`; every direct callee of the producers, the CHECKs
   (`cms_pattern_tree_keys_valid` was missing for the definer) and the guard is verified in a DO block that grants only a missing EXECUTE
   (non-grantable); INSERT on `cms_pattern_versions` granted; no API-role grant widened (wrappers service_role only). Runtime witnessed: the
   producer ran as definer through every path.
7. Concurrent CAS/replay and atomicity: parent row FOR UPDATE + fresh-statement re-check of newer versions + `unique_violation -> CONFLICT`;
   replay returns the stored resource after the capability proof; conflicting replay is `IDEMPOTENCY_MISMATCH`; injected audit fault (#307-312 equivalents)
   leaves every captured full row unchanged and the same key/request then succeeds. True multi-session races cannot run in single-transaction pgTAP
   (race modules are excluded by the lane rules): UNPROVEN at runtime, analysed above.

## Spec citations

BE03c:165,174 (routes), 192-221 (invariants, E13, E14, lineage), 395-397,405 (validation rows), 687-728,936-950,1162-1165 (contracts), 1294-1304 (errors,
typed refusals), 1338-1362 (lock order, pattern versions), 1417-1426 (schema), 1447-1450 (grants), 1473,1479 (authorization); DEC-186 (digest
status), DEC-188 (definition vs lifecycle version), DEC-181 (nested expansion count: a reference contributes the nested `node_count`).

## Open items / BOUNDARY

- BOUNDARY: block `props` field-kind vocabulary is not closed by BE03a (`kind` is a free 1-64 char string; fixtures use `string`). Implemented as
  content field kinds via `cms_field_kind_value_shape` with `string` read as `short_text`; unknown kind fails closed. Spec owner should close it.
- BOUNDARY: BE03c does not say whether `allowedChildren`/`slotRules` of the registered block constrain a pattern tree, nor how a `deprecated` block is
  treated ("fixed compatibility policy" unnamed). Not enforced (allowedChildren/slotRules); a non-supported block (deprecated or withdrawn) is
  VALIDATION_FAILED because the governed recompute treats anything but `supported` as a hard error.
- BOUNDARY: renderer-manifest compatibility of blocks with the compatible content types is enforced for templates (`cms_template_block_digest`) but
  not for patterns by the frozen governed digest; not enforced here (the suite's types carry no block manifest).
- Reserved-key / malformed key on the latest read answers `INVALID_REQUEST`; a key whose newest rows are all legacy answers `NOT_FOUND`.
- Multi-session CAS race unproven (see hazard 7). Nested positives, cycles and expansion counts unproven end-to-end (blocked); their SQL was
  reviewed statically and the closure walk is witnessed over legitimate draft rows (#closure witnesses in 070).

## Requests to root

1. Fix forward `cms_governed_current_digest` (42P10, see classification). That unblocks #50-#52/#243-#244 and the governed submit of any pattern draft.
2. Provide governed 07/08/09 in a staged run for the nested positives (#198-#244); re-run this suite unchanged.
3. Populated-DB migration witness for `20261014020100_cms_pattern_storage_lineage.sql` (DDL between `-- BEGIN/END PATTERN-LINEAGE-DDL` markers), with
   rows in every lifecycle state, a version gap, and a composition instance pinned to a non-root version row (FK must stay NOT VALID).
4. `pnpm db:types` refresh after promotion: new columns `pattern_id, compatible_type_ids, node_count, supersedes_id`; new RPCs
   `platform_api.cms_create_pattern_version`, `platform_api.cms_pattern_latest`.
5. Frozen fixtures that raw-insert (triggers disabled) into `cms_pattern_versions` need `pattern_id`, `compatible_type_ids`, `node_count` (and the already
   missing `lifecycle_version`): `phase_02_slice_11_helpers/003-registry.sqlinc:50,56`, `phase_02_slice_11_recheck_run.sql:297,303`,
   `phase_02_slice_11_helpers_manifest.sql` (via the same helper). They already abort at baseline on `lifecycle_version`.
6. No Worker mismatch found: request keys, `ifMatch` operand, error tokens and the resource keys match `apps/worker/src/cms-composition/*` and the contracts.
7. Promotion order: the six files in timestamp order; promotion is safe only after (3).

## Fix pass

Started 2026-10-14 (brief `briefs/pattern-def-f1.md`). Checkpoint 1: files read; no edits yet. Plan: (1) 020100 55000 pre-check + remove grandfathering (F4/F6), (2) populated witness + parity test (F5), (3) deprecated admitted (F2), (4) renderer-manifest compatibility (F3), (5) align governed calls to promoted 07/08 boundary, (6) report F1 digest defects.

Decisions taken before editing (checkpoint 2):
- 020100: every pre-migration row is a legacy object-tree row with no kinds, keys, blockVersions or compatible types, so NO row can be converted deterministically. The DDL refuses (55000) a non-1..n lineage, more than one active per lineage, and any remaining row; on an empty table it adds NOT NULL columns without defaults, applies every CHECK to every row (no grandfathering, no NOT VALID), and re-points the composition FK validly. The in-DDL backfill, trigger pause and `app.cms_rpc` set are removed (dead code over an empty table).
- F3: block compatibility per `cms_template_block_digest` (active type version's artifact renderer manifest `blocks`/`blockDefinitions` must list the block). The real type compiler never writes `blocks`, so fixtures need manifest-bearing types built the way the reviewed template suite does (raw rows under `app.cms_rpc`, fresh rows, no trigger disabled).

Run F0 (07:00, lane `governed-fix,pattern-def`, old migrations + new tests = RED): suite plan 341, 54 failures: #195-204 incompatible block admitted (RED F3), #265-267 deprecated refused (RED F2), #272-275 legacy row accepted (RED F6), witness #13-14/16-19 no 55000 (RED F4/F5); #51-53 `VALIDATION_FAILED` from the governed recompute (HARNESS: the test ran the frozen helper without `app.cms_rpc`, the flag every governed command sets itself); #215+ child decide P0001 (HARNESS: rev1 acts in its own party, governed-a suites seat reviewers in the owner organization); #218+ activate 42883 (blocked on governed-b). TAP `.lane-logs/alt-staged-governed-fix+pattern-def-070019-3230149.tap`.

### Fix pass result (final)

Status: PARTIAL (blocked only on governed CMS-03C-09 activation, absent: `governed-b` has no WIP yet).
Final run F4 (lane `governed-fix,pattern-def`, 07:04, main suite + populated witness): suite plan 341 -> **310 pass / 31 fail**; witness **36/36 pass**;
zero harness aborts. TAP `.lane-logs/alt-staged-governed-fix+pattern-def-070452-3255784.tap`, SHA-256 `d0ab65bc5a974c771de5e33ef2bf05d1880415274ee3fb5667d9be423c07fd75`.
Plan grew 325 -> 341 (never shrank); 4 legacy-grandfathering assertions in 070 were replaced by 4 refusing assertions (same count).

Runs this pass (every one recorded; one per deliberate change):

| # | Time | What | Result |
| - | ---- | ---- | ------ |
| F0 | 07:00 | old migrations + new tests (RED) | 54 fail of 341, witness 7 fail/20 then abort: RED = #195-204 (incompatible block admitted), #265-267 (deprecated refused), #272-275 (legacy row accepted), witness #13-14,16-19 (no 55000). HARNESS: #51-53 (digest recompute without `app.cms_rpc`), #215+ (rev1 in its own party) |
| F1 | 07:02 | new migrations + tests | HARNESS abort at 000-fixtures:142 (`cms_content_type_versions_activation_state_evidence_check`): my `rev1` party update ran before the CMS-03A type chains, which seat rev1 as schema reviewer, so types never activated |
| F2 | 07:03 | rev1 update moved after the chains | 35 fail: #188-189,193-194 (block `s12pd.props` not in the fixture manifest = fixture, fixed) + the activation cluster |
| F3 | 07:05 | manifest lists both fixture blocks; + 12 regression files | suite 31 fail (activation cluster only), witness 36/36; regression file list was word-split-broken under zsh (HARNESS, my invocation) |
| F4 | 07:04-07:08 | `governed-fix,pattern-def` (F3 bytes, final) and regression files via bash | see above; regression R1 `.lane-logs/alt-staged-governed-fix+pattern-def-070551-3262040.tap` (SHA `6223af07...05aab`), baseline R0 lane `none` `.lane-logs/alt-staged-none-070811-3273654.tap` (SHA `5d268c40...cb4de`) |

(F3 and the staged main-suite run above are the same bytes; the runs were launched back to back and the regression-file run was repeated in bash.)

Remaining 31 failures, all `blocked-on-governed-09` (TAP evidence: activation step `have: 42883`, function `platform_api.cms_activate_governed_subject` absent):
#218,219,221 (child activate); #223-226 (nested over the never-active child, `nested_pattern_not_active`/null body); #231-234, #236-237 (cycle, 512, 513 tokens read `nested_pattern_not_active` because the child is not active);
#238-249 (nested chain: its submit now fails `INVALID_REQUEST` because the nested draft never existed); #251-252, #254-257. #220, #222, #253 pass only because the blocked chain never moved (not evidence).
Everything else passes: governed submit (#211-214), assign (#214) and decide (#215-217) now run against the PROMOTED CMS-03C-06/08/07 boundary.

#### Findings dispositions
- F1 (digest defects): the applied, immutable `supabase/migrations/20261013300400_cms_governed_frozen_status.sql` pattern branch of `cms_governed_current_digest` has TWO defects: (1) `select distinct closure.block_key, closure.block_version ... order by closure.block_key collate "C", closure.block_version` raises 42P10 ("for SELECT DISTINCT, ORDER BY expressions must appear in select list") for every pattern tree; (2) a registered block with no lifecycle event has `current_lifecycle = NULL` in the loop, so the tuple hashes `"lifecycle": null`, whereas this lane's `cms_pattern_registry_digest` and the template digest fold `coalesce(..., 'supported')`. Governed-fix `supabase/migrations-wip/governed-fix/20261014040000_cms_governed_digest_pattern_order.sql` patches both anchors. With it staged the agreement assertions #50-#53 (plain/successor) pass, confirming the fold equality. (Earlier request 1 named only the ORDER BY defect; superseded.)
- F2 (deprecated blocks): admitted, withdrawn refused (BE03c :396, :1361). `cms_pattern_registry_digest` now refuses only `withdrawn`; the tuple records the real lifecycle (`deprecated`). RED -> GREEN: #265-267. **CONFLICT to root:** the frozen governed recompute (`300400` pattern branch: `if coalesce(current_lifecycle,'supported') <> 'supported' then raise exception 'CONFLICT'`, unchanged by governed-fix) refuses a deprecated block, so a draft over a deprecated block is created but its governed submit/recheck will conflict (and the tuple's `lifecycle` differs). I did not edit the frozen helper. Root decision: patch `cms_governed_current_digest` (fix forward) to admit `deprecated` for the pattern branch, or rule that BE03c :1514-1515 "fixed compatibility policy" refuses deprecated at governed time.
- F3 (incompatible block): new `cms_pattern_blocks_compatible(owner, tree, type_ids)` in `020300`, called by the producer after the digest and before props (VALIDATION_FAILED at `/blockTree`), mirrors `cms_template_block_digest` (active type version's artifact `renderer_manifest->blocks|blockDefinitions` must list each distinct reachable block, nested included, for every type). RED -> GREEN: #195-206 (chain type without manifest refused; one-of-two refused; wrong block version refused; `blockDefinitions` member accepted; two compatible types accepted). **Consequence to root:** the 03a type compiler (`cms_compiled_renderer_manifest`) never writes `blocks`, so under real chains EVERY block-bearing pattern is refused (same as templates with allowedBlocks today) until a compiler/registry path populates it; fixtures build manifest-bearing types the way the reviewed template suite does (raw rows under `app.cms_rpc`, cloned from chain type 1, no trigger disabled).
- F4/F5 (backfill + witness): `020100` rewritten (138 lines): 55000 pre-checks (lineage not exactly 1..n; >1 active; any remaining row, message names the count), then NOT NULL columns without defaults, CHECKs on every row, valid composition FK; the in-DDL backfill, trigger pause, `app.cms_rpc` set and NOT VALID dance are gone (all dead over an empty table). Why refuse rather than convert: every row that can exist before this migration is a legacy `{"nodes":[...]}` object tree with no kind/key/blockVersion/props and no compatible types, so no valid PatternVersion can be derived without inventing data. Witness `supabase/tests/phase_02_slice_12_pattern_definition/populated-lineage.sql` (reverts table + composition FKs to the pre-migration shape with the lifecycle trigger paused only for the stand-in, adds 7 legacy rows across three lineages, asserts 55000 for gap, two-active and a clean 1..n legacy chain with the table untouched, deletes rows, replays the DDL successfully, asserts columns/constraints/FK validity/trigger enabled and that the producer creates a first version and successor); parity test `tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts` (3/3; drift check verified by mutating one byte, then restored; prettier clean).
- F6 (no grandfathering): all CHECKs apply to every row; `cms_pattern_latest` no longer filters `jsonb_typeof = 'array'`. 070 legacy assertions replaced by refusals (#272-275 GREEN).
- F7: kept (precedent `cms_composition_instances.props`); F8: no change until root fixes the reading of "depth after expansion"; F9: README labels 090 accurately; F10: obsolete (the migration no longer disables a trigger; the witness pauses it only to stand the legacy table in, documented and re-enabled/asserted); F11: reclassified. Genuine BOUNDARY items remain only (props field-kind vocabulary; `allowedChildren`/`slotRules` applicability); deprecated and incompatible are decided (above). No GitHub issue was created (no network actions in this lane); tracking issues requested below. F12: unchanged (flagged to root).

#### Test corrections (oracle changes, for independent review)
1. `000-fixtures.sqlinc`: the 65 chain types are kept as `s12pd_chain_types` (their three setup assertions retargeted, descriptions unchanged except "all 65" -> "all"); `s12pd_types` is now a parallel set of manifest-bearing types (BE03c :1361; the fixture types otherwise could never be compatible with a block). GUC `s12pd.type_count` (default 65). `rev1` is seated in the owner party AFTER the type chains, as `phase_02_slice_12_governed_decision/010-setup.sqlinc` does for its reviewers (promoted CMS-03C-07/08 boundary: `docs/handoffs/2026-10-14-claude-s12/lane-governed-a-report.md` `## RPC boundary`). The request key shapes of `050-nested` assign/decide already matched that boundary; no key change was needed.
2. `025-agreement.sqlinc`: `s12pd_governed_digest` sets `app.cms_rpc` before calling the frozen helper (every governed command sets it itself; the wrapper that created the row restored it).
3. `050-nested.sqlinc`: additive `s12pd_why` TAP diagnostics for refused governed steps.
4. `070-storage.sqlinc`: four legacy-grandfathering assertions replaced by four refusing assertions (F6).
5. `060`, `047`: additive cases. `README`, main file (`\ir 047`): documentation/wiring.
No assertion was weakened.

#### Fix-pass files (path, lines, SHA-256)
| Path | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations-wip/pattern-def/20261014020000_cms_pattern_forest_validators.sql | 267 | 48e802800bfce90879822749143c92b021fc0055a9f927f67b5db37c97916e09 (unchanged) |
| .../20261014020100_cms_pattern_storage_lineage.sql | 138 | 6c356384d1894327acdb2f3caa04ce125a6274319dbe448d0029958088a73671 |
| .../20261014020200_cms_pattern_lineage_guard.sql | 68 | e7e7dfffb6c55e06896b5e6e57c49714c6d74906f018337f076722efff534cd9 (unchanged) |
| .../20261014020300_cms_pattern_graph_helpers.sql | 195 | a14dcc2ff1859ae6ca24f038138cbd71ca505c6d5acfa2756e7a2134f554c965 |
| .../20261014020400_cms_create_pattern_version.sql | 293 | eb548000b71e83d32c45ff61f99c9a76ad2ccf488edbc37d55c3f992a007764b |
| .../20261014020500_cms_pattern_transport.sql | 176 | 39bd3bc7371de2013d8dacf1496b679baee0684cbc387f246dc498788dfb6c86 |
| supabase/tests/phase_02_slice_12_pattern_definition.sql | 65 | 1e4ae5f362fc7a4bbc7958a56a694af6063aa95f786de69a02f8d51eae287534 |
| .../pattern_definition/000-fixtures.sqlinc | 200 | d1c1c073c29bb48601cba1fea3ccdf730cc910a22013cfc95ba9e15030a61500 |
| .../025-agreement.sqlinc | 35 | f5c0c809c269004c58d608f85a79881f6a4d96a0c9530bf932325e528e33b20d |
| .../047-block-compat.sqlinc (new) | 34 | 7bb97d04e38a5d0c98bc5dfca9dda03856854f4486e6e3580b96a1ad2baee110 |
| .../050-nested.sqlinc | 125 | 8a68e2a20ba3629bc8da3c466030e926bccfb7a4af94ab50b8cfd0dc6a067b4c |
| .../060-block-lifecycle.sqlinc | 24 | a1b4ec6b59b4819a5593b146836f1a5e18ae8432383f3ef9e0e67ccbcf1c2a55 |
| .../070-storage.sqlinc | 174 | 4e3e40839959c015a1c716f18dfb85ee08a3b322c6dce54620cc65b39241a346 |
| .../populated-lineage.sql (new) | 287 | 507471b1851ea88b31c8f52008b17953a795cbac9a00c65063ab08e0015832b8 |
| .../README.md | 37 | cfe5c32278cb20fcc06a6147caf3fb98dad6dfa89d34b04d325bc00e4ce1e292 |
| tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts (new) | 74 | 2c9ea0d2d1c4b854de985b3cbef736457563c27e1f59a9a3336565453bfaf892 |

#### Regression (R1 with my WIP vs R0 baseline `none`, 12 files)
Identical to baseline: `phase_02_slice_09_schema` #448, `sec2_all_schema_definer_rls` #6/#12, `sec2_definer_rls` #11 fail; `phase_02_slice_11_helpers_manifest` and `recheck_run` abort at `003-registry.sqlinc:55` (missing `lifecycle_version`). Newly aborting because of the no-grandfathering ruling (F6): see requests.

## Requests to root
1. Frozen fixture suites that raw-insert legacy pattern shapes (all now fail NOT NULL `compatible_type_ids` / CHECK; baseline-repair lane to update to a forest `block_tree`, `compatible_type_ids` (1-64 UUIDs), `node_count` (1-512), and `lifecycle_version`):
   - `supabase/tests/phase_02_slice_11_helpers_references.sql:89` (aborts at :96)
   - `supabase/tests/phase_02_slice_12_composition_authority.sql:142` (aborts at :150)
   - `supabase/tests/phase_02_slice_12_composition_instance_guards.sql:27` (aborts at :35)
   - `supabase/tests/phase_02_slice_12_composition_owner_integrity.sql:51` (aborts at :59)
   - `supabase/tests/phase_02_slice_11_helpers/003-registry.sqlinc:50` and `:56` (used by `phase_02_slice_11_helpers_manifest.sql`; already aborting at baseline on `lifecycle_version`)
   - `supabase/tests/phase_02_slice_11_recheck_run.sql:297` (raw insert) and `:303` (raw update)
   Also `phase_02_slice_12_composition_authority.sql` #11 calls `cms_pattern_tree_keys_valid` on an object (still valid; the function is unchanged).
2. Decide the F2 conflict: governed recompute refuses `deprecated` (CONFLICT) while CMS-03C-12 now admits it.
3. Decide the F3 consequence: no compiled type manifest ever lists blocks, so no real pattern with a block can be created until the 03a compiler (or a registry binding) populates `renderer_manifest.blocks|blockDefinitions`; templates share the gap.
4. Run `governed-fix,governed-b,pattern-def` once governed-b's activation exists; the 31 blocked assertions (#218-#257) should then be re-run unchanged. Nested positives pass only through that real chain.
5. Promotion order: 020000..020500 (020100 now refuses a populated table with 55000; real databases hold no pattern row). Populated witness + parity test are ready. Populate `pnpm db:types` after promotion (new columns `pattern_id, compatible_type_ids, node_count, supersedes_id`; RPCs `platform_api.cms_create_pattern_version`, `platform_api.cms_pattern_latest`).
6. Open tracking issues for the two genuine BOUNDARY items (props field-kind vocabulary; `allowedChildren`/`slotRules` applicability) and ask root to fix the reading of F8 (depth after nested expansion). I cannot create issues from this lane.
7. `20261005017560_cms_dependency_manifest.sql:234,703` and `20261010164100_cms_dependency_recheck.sql:82-83` still join `pattern.id = instance.pattern_id` (lineage id vs row id) and need `(pattern_id, version)` when CMS-03C-02 lands (F12).
8. No Worker mismatch found; Worker TypeScript untouched.
