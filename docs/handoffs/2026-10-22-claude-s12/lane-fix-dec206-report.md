# Lane report: claude_s12_fix_dec206 (F4a) — DEC-206 read: signed BE00 cursor, limit 1-50 default 25, loader without a silent cap

## Status
GREEN (follow-up complete; HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e). pgTAP `phase_02_slice_12_composition_instances_read.sql` 333/333 (run 11, standard stack with `block-rules,fix-dec193`) after V1-04 (RED run 10 then fix) and V1-06; earlier: 77-file regression (run 9) classified under Runs, Vitest contracts 440 / Worker 3,324 / Web 539 green, OpenAPI `--check` exit 0, TS and SQL mutants killed. Migration `20261022050000` now `7c5b313c...`.

## Scope
R3-01 (sealed cursor), R3-02 (limit 1-50 default 25, items <=50), R3-04 (no invented 2,000-row cap; loader follows nextCursor until exhausted with a fail-closed guard and explicit degraded state), plus R3-03/R3-18 comment fixes that touch dec206 files. BE03c rows 182, 409, 1188-1196, 1415, 1648, changelog 1877 are the spec.

## Plan
1. pgTAP RED (dec206 suite): limit param, signed cursor (shared `cms_signed_cursor_open/seal_page`, domain finally `cms-03c-instances`, not the planned `cms-03c-02r`), payload {queryHash, lastInstanceId, expiresAt}, 400 for tamper/expiry/cross-context, no Vault key = DEPENDENCY_UNAVAILABLE.
2. Migration edits in place (`supabase/migrations-wip/dec206/*`).
3. Contracts, OpenAPI (generated), Worker, Web proxy, loader; FE03 rows stating 100/2,000.

## Files
Files of the DEC-206 read as they stand (lines, SHA-256); the F4a changes sit in the migrations, contracts, Worker query/routes/answers, web proxy, loader, page loader, READMEs and the tests. Edited by this successor session: `apps/worker/src/cms-composition/composition-instances-routes.ts` (header comment: `limit`, no 100), `apps/web/src/server/cms-composition-instances-list.ts` (comment wrap), `apps/web/src/server/README.md` (the one dec206 bullet: signed cursor + `limit`, was "at most 100 rows"; a shared file, only that bullet), `apps/web/src/components/cms-composition-instances/load-composition-instances.test.ts` (budget case hardened). `.memory/wiki/specs/fe/03-cms-content-modeling.md` and BE03c are root's; the FE03 DEC-206 rows (887, 2900) already state limit 1-50 / 50 per page / no cap / `degraded`.

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `packages/contracts/src/cms-composition/composition-instances-read.ts` | 0 | 3289dbd74013099f41223a71a4fb59ece22883f5817f9d69e74b56398fbd66f8 |
| `packages/contracts/src/cms-composition/composition-instances-read.test.ts` | 0 | 8b494ed5d883be9031beef67beabf1a0889b57368671b470866cbb2bddd6048a |
| `packages/contracts/src/cms-composition/index.ts` | 0 | 56afd7ab7d746c104b7d2f0e8b7d20f0a114f1d9b27100cbfd442f3d8edd2fa4 |
| `packages/contracts/src/cms-composition/error-catalog.ts` | 0 | a45ac3c4c2735a53d267d35e9d80c0e73759573031589cc99df42e6b95670fe0 |
| `packages/contracts/src/cms-composition/error-catalog.test.ts` | 0 | 9cb67fa970846866ceba7c607040c66a4d50afd152a416dc678e9c6dd1ff068c |
| `packages/contracts/src/cms-composition/refusals.ts` | 0 | dac4a301568a0aeccc91d78f2e7174b5b94948d86fdc9d431eee4412b2b4ca42 |
| `packages/contracts/src/cms-composition/refusals-operations.test.ts` | 0 | 7a3c08f9ea2e90abe0f2c710eca7043712dcb9ee3e3567162bfabdc4ce58ed7e |
| `packages/contracts/src/cms-composition/README.md` | 0 | afaab9a55cfd8d299739f21d434face3b5026bfd2de186397bdca8ceb708b303 |
| `packages/contracts/src/platform-registries.ts` | 0 | b62cf06ec3afc33051f5cadca44b8a9e91dd508fa9197235142b7de994e6e56a |
| `packages/contracts/src/openapi.ts` | 0 | 10e460a2deab2418f72e09080a32913906de18c80778fed587a8b9e1131adb30 |
| `packages/contracts/src/registries.test.ts` | 0 | 8518a65f95d5cf041d92f5764c37d7a395005c8430505857019aa0a10aa1f30a |
| `packages/contracts/src/core-contracts.test.ts` | 0 | 6f29403f013e7a27ce63c88d3e81c25d974a8494209f75b3246c71a37b70b50d |
| `tests/contracts/phase-02-slice-12-composition-instances-openapi.test.ts` | 0 | 145178bb883d4381ba3c59a7d2eb949a02c2dbf26f9f9a791d46e39c2ec8643a |
| `infra/openapi-definitions-cms-composition.mjs` | 0 | 303710efd5eae71144964b653d9d54ab8fb068033e688d9d26b9fe4b0f0162ae |
| `apps/worker/src/cms-composition/composition-instances-routes.ts` | 0 | 29e56282a6f8db8b4db4b4ac1109c73d73af40673ac550173ecd6251b1e98737 |
| `apps/worker/src/cms-composition/composition-instances-query.ts` | 0 | d452a92da1db42b2d4e5f5a07a26e83944f6ce5db7aabed3f569cfb2d4edc324 |
| `apps/worker/src/cms-composition/composition-instances-answers.ts` | 0 | 718e973b3a126b5223c0b997be91ef132966ddc24f262d0296d476a8c59ef39c |
| `apps/worker/src/cms-composition/composition-instances.test-support.ts` | 0 | 6f6794f6002dc8fb35c6723ee79f346438871de8392107458f9cedadd4493a26 |
| `apps/worker/src/cms-composition/composition-instances-routes.test.ts` | 0 | 09b3001448cac71f7a41c1eda0ca0fee918ea78cba28f503427c8078c6f78703 |
| `apps/worker/src/cms-composition-production-pattern-update-instances.test.ts` | 0 | fb7905d27f991390b8da993e2f887772d13f35071d2f5d514b92c5e2676de84d |
| `apps/worker/src/cms-composition/pattern-update-operations.ts` | 0 | b8ef904387f024da56749c16b39ec1f6a445641e958eee50e15a664c0a3dbf70 |
| `apps/worker/src/cms-composition/pattern-update-ports.ts` | 0 | eeec256c0f5456dff12a740cab17ddd7965fd12de75ba61c07ad74c96c943b56 |
| `apps/worker/src/cms-composition/pattern-update-read.ts` | 0 | 4f24b9e89aea686d1191f208143e458c1ad2c5a5c85f0bcbe4bbe8424932f736 |
| `apps/worker/src/cms-composition/pattern-update-response.ts` | 0 | 31a3e746c236d5722b24c2324242e9b530c25b7a3de9cd4f0c1d842e37282f1a |
| `apps/worker/src/cms-composition/pattern-update-routes.ts` | 0 | 7e7b9fb2476ff6f22f75bbba112de53cf48817d0d6a72b11b80a1ef35ee7e0af |
| `apps/worker/src/cms-composition/pattern-update-routes.test-support.ts` | 0 | 74d38be907eca24436271c0e81b9fa901ca6b5c81a1f8bed13a15a53df8c94f5 |
| `apps/worker/src/cms-composition/pattern-update-order.test.ts` | 0 | 0f9c7d266ae9ad51426bb45375fec49ceaad44614cd91cad19e71ccddfcac477 |
| `apps/worker/src/production-worker-runtime-pattern-update.test.ts` | 0 | 1ddb0241bcf1aed2bf1346af93f793aa9eeb51dc1017fbe75bf943ef9d11b072 |
| `apps/worker/src/cms-composition-production-pattern-update.ts` | 0 | b912a98573ebe656fb82ee8927f8916df5c4cf35d79ae84f6a2cdb7938806269 |
| `apps/worker/src/cms-composition-production-pattern-update-failure.ts` | 0 | 07197d9c006258f6408c547936630b80a9c701205c690a4a61b2f5d7d47a7728 |
| `apps/worker/src/cms-editorial-production-boundary-types.ts` | 0 | 1ea5e0ac7aab066311956b3e0b5eb026051e9f172d3363d20a0d5e2efc83c6bb |
| `apps/web/src/server/cms-composition-instances-list.ts` | 0 | 089e159bcb008ff3bd2456ac5a060967e220484e0ca7ed20a8cb9d10effb2fec |
| `apps/web/src/server/cms-composition-instances-list.test.ts` | 0 | e2922692fa3159f267f603cb72f8cd129d9ba63496b2581402f533db9e81e0a4 |
| `apps/web/src/server/cms-composition-instances-errors.ts` | 0 | 250b8895ba2c3147dced7f2611720c9b195b413afe8a6f815ba7d2b29091db3d |
| `apps/web/src/server/cms-composition-instances.test-support.ts` | 0 | bcf26503a103d0a917e833e0212b58618c7a031523a0293f850b6968b2278381 |
| `apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.ts` | 0 | 678a3f9156e594e2e3e756be48d8aa8c3e795354871c7e715be08c12c7254438 |
| `apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.test.ts` | 0 | 2f9ebd6014efcf285e359148daf8090c364b4f4a60ba19ad787f6026bc713f34 |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx` | 0 | e9f4553d351154e2827f57bf0c303869b03fb9727ff9b12644cc15c5cb430850 |
| `apps/web/src/components/cms-composition-instances/load-composition-instances.ts` | 0 | 173b4428a5bcdc2a007e6148f04ee84921f6d53b7d8950dc3c385449dbe8bf06 |
| `apps/web/src/components/cms-composition-instances/load-composition-page.ts` | 0 | c20e409962b2c38f6a11facb8c0fffc6d96ff674e3f8501d1b7102c2eb47f0f6 |
| `apps/web/src/components/cms-composition-instances/load-composition-page.test.ts` | 0 | 9fe6082a7debe8c4325ed9a40bb09eabf041948ad0c42cd7d181f1602399c216 |
| `apps/web/src/components/cms-composition-instances/composition-page-reads.ts` | 0 | 384fbe9d0c489ead9d81d2da5e73b3f9db01e2a8a0f4850e4b563526b387bd3f |
| `apps/web/src/components/cms-composition-instances/composition-rows.ts` | 0 | 5d829f8985799b690cbf1864c9ecf3d398a8e9a847ae963aab13a861b7f00a46 |
| `apps/web/src/components/cms-composition-instances/composition-rows.test.ts` | 0 | e022eac6170fba58e3518f186b9ad8cfd6b2f698b4f9cbb49141d029a9b337ca |
| `apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.tsx` | 0 | f1b7e365dc1b83237733b6c7a4f76006306a06eeb89e7368dd4bc0aede9e8f54 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.test.tsx` | 0 | 7d4364e09c8f89ee8907de16386d10c97d0062ba18e3ffd8aab0a23cbff4d013 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.tsx` | 0 | 7e3b8d06ce49100e36be9bf8ffdc8e4610674bea9f958517a46a0c04cff2e809 |
| `apps/web/src/components/cms-composition-instances/composition-copy.ts` | 0 | dbb8675d9d02230e98b4de579c19e91c95ea2ed47c28fe44a7015d7921db519d |
| `apps/web/src/components/cms-composition-instances/use-composition-session.ts` | 0 | 5bb63c65f5478cd6c7fb406fa27deae0bfd5212adf087998c042027c52dcec13 |
| `apps/web/src/components/cms-composition-instances/README.md` | 0 | d0d4e1db7fa512b53ee5633e340c361b83fbf65d686324fd1be2384ea870009b |
| `supabase/migrations-wip/dec206/20261022050000_cms_list_composition_instances.sql` | 225 | 7c5b313c207bdde1add47563072559e7c44dba70f4e1e56eacbb5f9faa6f86fa |
| `supabase/migrations-wip/dec206/20261022050010_cms_list_composition_instances_public.sql` | 0 | 08c5b0fca322832d0f20cc1dccb3520168434deb214cfa65c29d86c5094253d2 |
| `supabase/tests/phase_02_slice_12_composition_instances_read.sql` | 0 | 8493b2ef4ddd508017770a7317915d769548092c0dbef3a92586819cb3e14683 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/000-helpers.sqlinc` | 2 | 79b9d87ae96eb7d54527366e544b8052f823482189352e04f794afd207c4f6cf |
| `supabase/tests/phase_02_slice_12_composition_instances_read/001-world.sqlinc` | 0 | 7d785db79a41720efd037a2598fdf76c196a89941139a39b65316f978347df46 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/002-shape-and-grants.sqlinc` | 0 | d4342c8036e8849e05f45d9aec6a0b3aae103012da951bd0506f52f2b804d96c |
| `supabase/tests/phase_02_slice_12_composition_instances_read/003-order-and-heads.sqlinc` | 0 | 84cf8ac241afd6e2732821ca8fa510df819e2103caa712900367acaf9f8e184c |
| `supabase/tests/phase_02_slice_12_composition_instances_read/004-paging.sqlinc` | 1 | 7326c3e528627a0dc589bb9cb638372bbfe64cd7a1537489e617c21350acdb7b |
| `supabase/tests/phase_02_slice_12_composition_instances_read/005-authority-and-grammar.sqlinc` | 65 | 893c9465cfcee4e070d0d5b9be45088b1346336ec8940e9a376f915cfe5e6efc |
| `supabase/tests/phase_02_slice_12_composition_instances_read/README.md` | 31 | 196bda6169eb7d4e8ec45822ad888a3dd1c372bff31d2113c76bdbc14773b962 |
| `supabase/tests/phase_02_slice_09_r8_api_surface.sql` | 0 | f928aabdb0417765e04f545ae98ad8015aa3c3d00d84ceec7e641f5ade064e93 |
| `.memory/wiki/specs/fe/03-cms-content-modeling.md` | 4 | d3739c152a92b70cfedc20f889b92859d37960082ccb6bcbf05c1272fd1115e6 |
| `apps/worker/src/cms-composition/README.md` | 0 | 06f748c065efa2fc4b71f5c7b690d20984c3c23b20de352050c57dab4a9c215b |
| `docs/openapi/openapi.json` | 0 | 7702f8b11ffe2b92a9cafeaa0c4972f69534d89968f6a2de53c1d8fba0eb843a |
| `apps/web/src/pages/api/v1/cms/entries/[entryId]/README.md` | 0 | 09684fc6995435dd202a461701d57a7df069af14dd1c21f10592bf898676266a |
| `apps/web/src/components/cms-composition-instances/load-composition-instances.test.ts` | 0 | 590cc07b1c98b2310506e89ae38d265a8f8f56689da99b64b3690f9b2e1dba14 |
| `apps/worker/src/cms-composition/composition-instances-limit.test.ts` | 0 | e7c71a7de34b71f19ede4fd46a9940ef0f1915590486fcaa1be0f26e13315021 |

## Runs
Stack (exact, brief): `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,fix-dec206` (`fix-dec206/` is an empty WIP dir), `promoted=461 wip=76`.
- Run 1 (RED) 15:44Z, stamp `154446-2345298`: 174 run, 154 ok, 20 not ok (#64 signed wrapper missing, #67 owner, #75 no-key gives a page, #106-125 paging/limit/signed envelope, #143-144), then psql ERROR INVALID_REQUEST at 004 line 96 (the test helper opens a cursor that is still unsigned: RED consequence, genuine missing feature, not harness). TAP SHA-256 `8d4fd36c35212a3f6e39e082209c4e9a8e78ecea9d29f2744ce8f823eda5d5e0`.
- Run 2 15:46Z, stamp `154617-2353295`, after the migration edit: 331 run, 1 not ok (#113 'the same cursor answers the same page'): HARNESS defect in my test (the re-issued next cursor carries a fresh `expiresAt`, so whole-body equality cannot hold). TAP SHA-256 `3887ffd560dcbd62d516e262ce011e6a9aea2c0aa5f6eedf7a85b7bac006dad5`.
- Run 3 (GREEN) 15:48Z, stamp `154817-2366349`: 332 tests, 332 ok, PASS. TAP SHA-256 `d0ecf9e61542346b6c260f5b9460efc771055acac1fcd9a1a1ab5f11b8918a70`.
Contracts/Worker/Web: RED observed first at each layer (contracts 6 failing, Worker 7 failing, Web 11 failing); now green: contracts `composition-instances-read.test.ts` 11/11, Worker `composition-instances-routes.test.ts` + `cms-composition-production-pattern-update-instances.test.ts` 76/76, Web composition-instances + server list + route + api 317/317.

Recovered from the disk (predecessor runs after checkpoint 2; stamps are local EDT = Z-4h):
- Run 4 (mutation witness) 19:51Z, stamp `155147-2387580`, `lane=...,dec205,governed-recheck,fix-dec206` (NO `dec206` in the stack; the mutated copies of the two dec206 migrations lived in the `fix-dec206` WIP dir with the same filenames, so the real dec206 files were never touched; manifest SHA-256 of the staged `20261022050000`/`050010` = `7abade48...` / `6733aae1...`, differing from the green-run `57dd1769...`/`08c5b0fc...`): 175 tests run, 166 ok, 9 not ok, first failing #75 ("without a valid Vault signing key the read fails closed"), then psql ERROR CONFLICT at 004 line 98 (the mutant lets a forged cursor through, so the test helper aborted: RED consequence of the mutant). Killed by #75, #106, #108, #112, #126, #161, #165, #169, #173 = the signing/unsigned-cursor mutant. Classification: mutation witness, killed. TAP SHA-256 `9217fc6aa2646383e3529b97eb8b811a7a84cc613997ba94414900a2d690ab26`.
- Run 5 (mutation witness) 19:54Z, stamp `155448-2404990`, same dec206-less stack, staged `050000` SHA `70d639a0...`, `050010` = `08c5b0fc...` (unchanged): 332 tests, 319 ok, 13 not ok, first failing #59 ("setup: the real CMS-03C-15 detach of /zeta succeeds"). Failures: #176-177 c-expired (expiry check), #234-235 x-other-actor (actor binding), #256-257, #260-261, #290 limit upper bound (limit 51/100 accepted) = the expiry/actor/limit mutant, killed. #59 and #97-99 (the detached-row fixture) are NOT explained by the mutant: the same suite was 332/332 at run 3 with a different `dec193` (the F1/F2 lanes edited `dec193/20261016041600` and `042200` in between, see the manifest). Classification: mutation witness killed; #59/97-99 = environment (another lane's concurrent WIP edit), to be re-checked by the full run below. TAP SHA-256 `a7da244b8b1484db5bd7c7dcf7da4abdae4b0162d8f13959f9e8791aa4d0c8f6`.
- Run 6 (regression attempt) 20:16Z, stamp `161631-2527687`, full stack incl. `dec206`, staged `050000` = `42727530...` (the current bytes): 0 tests, Files=0, "Cannot detect source of .../phase_02_slice_12_block_compatibility.sql s..." = HARNESS FAILURE: the whole file list was passed as ONE space-joined argument (zsh does not word-split). No feature information; the DB reset itself succeeded. TAP SHA-256 `3b7453a641568c9d11226361993c67dd338dd37811fdd20978a4ba7cc4c54fee`. Never rerun that invocation; pass each file as its own argument (bash array).

- TS mutation check (script `<scratchpad>/claude_s12_fix_dec206/mutate_ts.py`, each mutant applied, focused suites run, original restored byte for byte and SHA-256 asserted): 11 mutants, 11 killed: loader repeat-cursor guard off (M1), time budget off (M2), loader page size 25 (M3), revision binding off (M4), newest version loses (M5), Worker ignores `limit` (M6), contract `limit` max 100 (M7), contract default 50 (M8), web proxy limit ceiling 1000 (M9), web proxy drops `limit` (M10), contract page `items` max 100 (M11). M2 was killed only by an out-of-memory crash of the Vitest worker (the unbounded walk); I hardened `load-composition-instances.test.ts` (the budget case now ends a runaway walk with a 500 after 10 calls) so M2 now dies by assertion; M2 re-run with the hardened test: 1 failed / 9 passed. 
- Run 7 22:37Z queued, finished 23:06Z, stamp `183701-3101443`, brief stack `...,dec205,dec206,governed-recheck,fix-dec206` (no `block-rules`), dec206 suite on the current bytes (`050000` `42727530...`, `050010` `08c5b0fc...`): 332 tests, 328 ok, 4 not ok = #59 "setup: the real CMS-03C-15 detach of /zeta succeeds" (`have: 42883`, undefined_function) and its dependants #97, #98, #99 (the detached row). Classification: ENVIRONMENT / cross-lane stack dependency, not a defect of this lane: F2 edited `dec193/20261016041600` in place (19:53Z) so the detach writer now calls `platform_private.cms_detached_tree_block_rules`, defined in `block-rules/20261022080100`; a stack with `dec193` and without `block-rules` cannot detach (same four failures in mutation run 5, which began 1 minute after that edit; run 3 predates it). The other 328 tests, including every signed-cursor, limit, authority and order test, pass. Root confirmed the dependency (message 23:08Z): later stacks add `block-rules`. TAP SHA-256 `d5c6a57ff5ae3105d8397a5686c9a7f7a8af0fa0b19a3fd01e0481ed1e154940`.
- Run 9 (final regression) 23:08Z queued, started 23:13Z, finished 23:40Z, stamp `190808-3239262`, stack `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,fix-dec206` (`promoted=461 wip=82`), 77 files (all 74 `phase_02_slice_12*.sql` + `phase_02_slice_09_r8_api_surface.sql`, `sec2_all_schema_definer_rls.sql`, `sec2_definer_rls.sql`): Files=77, Tests=14209, Result FAIL; TAP `ok` 14240 / `not ok` 35. **`phase_02_slice_12_composition_instances_read.sql`: 332/332 ok, 0 not ok, PASS.** The other failures are not this lane's: `block_rules_legacy` (psql ERROR "more than one row returned by a subquery" at `block_rules/070-provider.sqlinc:34`, F2 in progress); `dec191`, `governed_activation`, `governed_decision`, `governed_recheck`, `governed_schedule` (each aborts after 9 tests with `ERROR: syntax error at or near "from"` at `governed_recheck/002-lapse-helpers.sqlinc:77`, F4b's in-progress fixture edit); `dec193_carry` #374 and `pattern_updates` #251 (F1's new R1-005/CV-PROV001 oracles, whose migration `fix-dec193` is not staged by this stack); `dec194_sweep` 29 tests (DEC-212 table rename, F3 not released); `r8_api_surface` #4, #13, #14 (names only `cms_apply_pattern_update`, `cms_get_instance_update_diff`, `cms_governed_recheck_resolve_event`, `cms_recheck_governed_reviews`, `cms_reconcile_taxonomy_merge_converge`; `cms_list_composition_instances` is classified and absent); `sec2_all_schema_definer_rls` #6 (extra table `platform_private.cms_taxonomy_merge_recoveries`, dec194). TAP SHA-256 `fb0c4d90a31c9d642a50ef86bb786ae3daf7063412041d173c8385160280c567`.
- Run 8 (SQL mutation witness) 23:08Z queued, ran 23:41Z, stamp `190818-3240219`, stack `...,dec205,governed-recheck,block-rules,fix-dec206-mut` (no `dec206`; the mutated copies lived in `fix-dec206-mut/`, deleted afterwards; staged mutants `883e21a6...`/`d3d6d134...`): 175 tests, 159 ok, 16 not ok, then psql ERROR CONFLICT at `004-paging.sqlinc:98` (the mutant leaks the helper's 409). Killed: default limit 100 (#106-108, 112, 115-119, 122), 24 h expiry made 7 days (#125-126), CONFLICT no longer mapped to 400 (#161, 165, 169, 173), page overflow (#117 "no page ever holds more than 50 items"). TAP SHA-256 `ea645d22a0ef7f8925e23a4f8a5e3750c46bbb9a6602ca095fc60062ad70e51f`. The hash-without-entry/revision mutant is behaviour-equivalent (see Open items 2).

Follow-up (root, review V1-04 and V1-06):
- Run 10 (RED) stamp `214211-3935850`, stack `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,fix-dec193`, dec206 suite with the new case `g-limit-scaled` (`limit` = `10.0`, a page of the 512-row entry): 333 tests, 332 ok, 1 not ok = #285 "limit 10.0 is accepted as a page of 10" (`have: 22P02:0`, `want: 00000:10`): the unmapped cast error V1-04 describes, genuine missing behaviour. TAP SHA-256 `6b1faa6eb6503a56943bf11107478b068f3a1177774387c7ffaf26ed475168cd`.
- Fix: `20261022050000` line 76 `(p_request->>'limit')::numeric::integer`. README of the suite now names the standard stack (V1-06). The promoted sibling `20261014140300` is untouched.
- Run 11 (GREEN) stamp `214400-3948147`, same stack, same file: 333 tests, 333 ok, PASS. TAP SHA-256 `f86be931159f69b59ffd369647eb6d9a4dfa78e1fa15a7fc058eedd62a53f0d1`.
- Migration `050010` unchanged (`08c5b0fc...`).

## Test corrections
No oracle outside this lane's own DEC-206 files was touched. Changes of the lane's own earlier oracles, all required by the BE03c 2026-10-22 "DEC-206 read aligned to BE00" rows (182, 409, 1188-1196, 1415, 1648, 1877) and FE03 changelog row 2900:
- `supabase/tests/phase_02_slice_12_composition_instances_read/*` : the unsigned `{h,i}` cursor, the fixed 100 page and the hand-built cursor helper (`s12ci_cursor_make`) are replaced by the signed envelope, `limit` 1-50 default 25, and 400-on-fault cases (tampered, expired, over-lived, cross-context actor, foreign domain, unknown key, no Vault key = DEPENDENCY_UNAVAILABLE). Strictly stronger.
- `apps/web/src/components/cms-composition-instances/load-composition-page.test.ts` / `load-composition-instances.test.ts`: the "20 pages = unverified" case (R3-04) is replaced by: no page-count cap (120 pages followed), repeated cursor = `degraded`, exhausted time budget = `degraded`, page size 50 asked. `degraded` is the FE03 read state; nothing is ever shown truncated.
- Contracts/Worker/Web tests: `limit` 1-50 default 25, items <=50 (were `.max(100)` and no `limit`).
- This session: `load-composition-instances.test.ts` budget case now ends a runaway walk with a 500 after 10 calls (hardening, found by mutation M2).

## Spec citations
BE03c 182, 409, 1188-1196, 1415, 1648, 1877; BE00 491; CMS-03C-13 precedent `20261014140300/310`; `20261005010400` shared helper.

## Open items / BOUNDARY
1. No BOUNDARY: the cursor is sealed by the shared CMS-03C-13 helpers (domain `cms-03c-instances`, payload `{queryHash, lastInstanceId, expiresAt}`), every fault 400 (BE03c 409), no Vault key = DEPENDENCY_UNAVAILABLE.
2. Equivalent mutant (not a gap): dropping `entryId`/`revisionId` from `queryHash` cannot be told apart by any request, because the cursor's `lastInstanceId` must be a row of the current draft revision, which fixes entry and revision anyway; the binding is kept as the spec states it (BE00:491, BE03c 409). Cross-actor reuse is a separate, tested binding (`x-other-actor`, killed in run 5).
3. R3-18 (shared rank helper): not done, by design; the finding says "when the plan is next touched". The header now cites the live body `20261016042500_cms_revision_render_plan_dec193.sql`, and `s12ci_plan_paths` guards parity for three shapes.
4. R3-03 (BE03c wording) is root's and already applied (rows 182, 409, 1412, changelog); R3-16 is a nit left as is.
5. A Playwright or real Worker/PostgREST run of the read, and the signed cursor under a real Vault key rotation, are outside this lane (pgTAP and Vitest only).
6. Cross-lane stack dependency (run 7): `dec193/20261016041600` needs `block-rules/20261022080100`; promote them together.

## Requests to root
1. Promote `supabase/migrations-wip/dec206/` (two files, `20261022050000` `42727530...`, `20261022050010` `08c5b0fc...`) after `dec193`, `pattern-updates` and `block-rules` (the staged stack dependency); rerun the suite and the canonical gates. The empty `supabase/migrations-wip/fix-dec206/` can be removed.
2. Everything in the DEC-206 read-lane requests (step-up inventory exemptions, tracker bookkeeping for P2-S12-AC-269, race modules) still stands; this lane adds none.
3. Note for the FE03 acceptance bookkeeping: the loader page size is 50, its guards are a repeated cursor and a 20 s budget (`INSTANCE_LOAD_BUDGET_MS`), both ending in the `degraded` read state.

