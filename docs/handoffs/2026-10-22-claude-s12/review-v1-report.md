# Review V1 report (`claude_s12_review_v1`) - verification of fix lanes F3 (dec194) and F4a (dec206)

Status: FINAL. Reviewer: independent verification reviewer V1, read-only (model Sonnet 5.5). I did not author or previously review these
files. No SQL, docker, supabase, pgTAP, race module or staged runner was run. Read-only commands only: file reads, `diff`/`grep`/`sha256sum`,
TAP-log reads, `node infra/generate-openapi.mjs --check`, and focused Vitest with the pinned toolchain
(`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`). Scratch output lives only under
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/v1/`; the only repository file I created is this report.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
Spec bytes read: BE03c `01df2b247f55d8fcbb88eb220d61a750326b352df2af2968741f1742f1bc30e7`, BE00 `f11da5b7e1631d42637b48ab63493faef9412f173a258cb1ad4bbfd8305e02bc`,
FE03 `d3739c152a92b70cfedc20f889b92859d37960082ccb6bcbf05c1272fd1115e6` (root edits the specs while lanes run; line numbers below are for these hashes).

## Verdict per lane

| Lane | Migrations | Verdict | Why (one line) |
| --- | --- | --- | --- |
| dec194 (F3) | 5 (`190010`, `190020`, `190030`, `190040`, `190050`; `190000` squashed away) | **PROMOTE** | R2-01, R2-03, R2-04, R2-05, R2-09 are all resolved on disk; the rename reached every live reference; no new functional or security defect. Root-owned prerequisites remain (two S09 inventory pins, race modules, inventory JSON) and are listed below; they are not defects of the files. |
| dec206 (F4a) | 2 (`050000`, `050010`) | **PROMOTE** | R3-01, R3-02, R3-04 and R3-18 are resolved; R3-03 is PARTIAL (two BE03c wording items, root-owned, no code effect). The cursor is sealed by the same shared Vault helpers as CMS-03C-13 and binds what BE00:491 requires; the loader follows `nextCursor` to exhaustion with two fail-closed guards and an explicit degraded state. |

New findings by this review: **BLOCKER 0, MAJOR 0, MINOR 3, NIT 4** (table below). Resolution of the 10 original findings in scope:
**RESOLVED 9, PARTIAL 1 (R3-03), NOT RESOLVED 0**.

## Scope (files + SHA-256 of the bytes read)

All hashes were taken after the lane reports were written. dec194: 5/5 migrations, 15/15 sweep test files (entry file plus 14 fragments, including the unchanged ones) and the probe include equal the
"after" hashes in `lane-fix-dec194-report.md`; the runbook is root-edited and not in that table. dec206: 66/67 files equal `lane-fix-dec206-report.md`; the one difference is
`apps/worker/src/cms-composition/README.md` (now `34602b36...`, report `06f748c0...`), edited afterwards by another lane; its dec206 paragraph
(lines 145-151) is intact. The final ALT manifests record exactly these migration bytes: dec194 run 4 `...205837-3737452.manifest` lines 474-478
and run 2 `...194247-3392676.manifest` (190010 `ebc1d694`, 190020 `0ae9ed81`, 190030 `2fdb28a8`, 190040 `8a671555`, 190050 `07ebf623`), and
dec206 run 9 `...190808-3239262.manifest` lines 537-538 (`42727530`, `08c5b0fc`). No `190000` is staged (`wip=83`).

dec194 (migrations, pgTAP, probe, runbook):

```
ebc1d69495646b8dae392e184aaa02f91af071d20516c2b0094ff69dbb5c0afd  supabase/migrations-wip/dec194/20261014190010_cms_reconcile_taxonomy_merge_converge_public.sql (44)
0ae9ed81271fe70f2356832f49b37879df0e88494ab7701bb24fa9b560bfae78  supabase/migrations-wip/dec194/20261014190020_cms_taxonomy_merge_recovery_identity.sql (64)
2fdb28a80a7715e9639badd2afa35d691aecdb44b840c97fa534a83c3ffdae32  supabase/migrations-wip/dec194/20261014190030_cms_taxonomy_merge_request_serialized.sql (191)
8a67155582f1b874a93369e1babe39de000dfe7082b56596b2e4fe460d52be3d  supabase/migrations-wip/dec194/20261014190040_cms_taxonomy_merge_handler_serialized.sql (129)
07ebf6237d25e7368bee59c18149b685eef84150dbbd479196a85274b2960592  supabase/migrations-wip/dec194/20261014190050_cms_taxonomy_merge_recovery_serialized.sql (133)
053d91bd048706fcd7231d4826eb7201e4187a75aae6bd9f83ee6b8240362f45  supabase/tests/phase_02_slice_12_dec194_sweep.sql (41)
41a4333fe3a97d286ae5553994b22eb2d73b56e032bb01885c67134360ba3802  supabase/tests/phase_02_slice_12_dec194_sweep/000-helpers.sqlinc (378)
d6ac58712c328e451297a0893eae97cfcd593dec033039944fdd7900c79cf7c7  supabase/tests/phase_02_slice_12_dec194_sweep/001-support-helpers.sqlinc (28)
889c92b2a7908d7fd7867ce56cec5c258d087d5e4c4c43366e438e04d3bbbe8e  supabase/tests/phase_02_slice_12_dec194_sweep/010-surface.sqlinc (109)
2f21444ac774d9eae1956f56310acfb7c96add92382654f617abb694706d161e  supabase/tests/phase_02_slice_12_dec194_sweep/020-no-work.sqlinc (62)
ac68402fc81f828041be00f656c938a4d21ac557506aeb535ab954367eea0487  supabase/tests/phase_02_slice_12_dec194_sweep/030-gates.sqlinc (52)
03fcd7bf57fe6a84ef7f92bffc287d3875d9b4c536b455bce87dbea52c450a30  supabase/tests/phase_02_slice_12_dec194_sweep/040-request.sqlinc (66)
c50b0bef971b9341d3546fd22b9471639da5fe5ac6b6b19c38d31d86667e20b8  supabase/tests/phase_02_slice_12_dec194_sweep/050-generations.sqlinc (43)
b8a5c003e61900c62131d36b6ae1e6c69e085cf014f4d8953212f44e40506d67  supabase/tests/phase_02_slice_12_dec194_sweep/060-idempotency-expiry.sqlinc (167)
2728caba39155a3e6994a6a91f974847432f1b4d33f81b7f512001cd3f81d9b6  supabase/tests/phase_02_slice_12_dec194_sweep/070-atomicity.sqlinc (76)
70aee1b5c1deeff0ed14c10a2806d4bdc652170d3533019e13ad7c42cd85faab  supabase/tests/phase_02_slice_12_dec194_sweep/080-routing-prefilter.sqlinc (77)
26131d66cfdfbec1a77dfaeb7262773a42614c868449fa0883c44f861db2e383  supabase/tests/phase_02_slice_12_dec194_sweep/090-race-fixture.sqlinc (179)
7cf9c43ea560a2f4fe70325eb7419ed68336a0fc139bb883526b0773cba095ee  supabase/tests/phase_02_slice_12_dec194_sweep/091-race-session-kit.mjs (221)
bd45e54a90c11cc8670657ecdc0d1cf34167151ee50b02432ff12f4db35cf6ab  supabase/tests/phase_02_slice_12_dec194_sweep/095-race-readiness.sqlinc (17)
b9090542dff29b31c65181e2bafcc3b12332edfdcc4095a26a0d9c7682dd4cc4  supabase/tests/phase_02_slice_12_dec194_sweep/README.md (37)
219c5168ad92cfee624fd0d62f0c2c1cf8812d2cb4ad0ef05fd8602b40980b5f  tests/postgrest/support/phase-02-slice-12-dec194-isolation-probe.sqlinc (145)
d444d06b89f02d473b52f574e3bae4c1ba7264838940a60a306e69ca751ba4f4  docs/runbooks/platform/cms-taxonomy-merge-converge.md (112)
```

dec206 (migrations, pgTAP, contracts, Worker, Web, OpenAPI; the 67 files of the F4a report):

```
42727530892c4c54cdd6b5e5568567a6831eb03a900e94434d5c861a853489b9  supabase/migrations-wip/dec206/20261022050000_cms_list_composition_instances.sql (225)
08c5b0fca322832d0f20cc1dccb3520168434deb214cfa65c29d86c5094253d2  supabase/migrations-wip/dec206/20261022050010_cms_list_composition_instances_public.sql (77)
8493b2ef4ddd508017770a7317915d769548092c0dbef3a92586819cb3e14683  supabase/tests/phase_02_slice_12_composition_instances_read.sql (36)
79b9d87ae96eb7d54527366e544b8052f823482189352e04f794afd207c4f6cf  supabase/tests/phase_02_slice_12_composition_instances_read/000-helpers.sqlinc (147)
7d785db79a41720efd037a2598fdf76c196a89941139a39b65316f978347df46  .../001-world.sqlinc (79)
d4342c8036e8849e05f45d9aec6a0b3aae103012da951bd0506f52f2b804d96c  .../002-shape-and-grants.sqlinc (53)
84cf8ac241afd6e2732821ca8fa510df819e2103caa712900367acaf9f8e184c  .../003-order-and-heads.sqlinc (72)
7326c3e528627a0dc589bb9cb638372bbfe64cd7a1537489e617c21350acdb7b  .../004-paging.sqlinc (145)
0481c86db0062f71dcee528d6a59d37a5381a37348287c061acbc4b66d7ebf5c  .../005-authority-and-grammar.sqlinc (61)
98a6f5c74da8933c90cd872fbe585891535ce2501e59cf4e8a6601fedd893cc3  .../README.md (30)
3289dbd74013099f41223a71a4fb59ece22883f5817f9d69e74b56398fbd66f8  packages/contracts/src/cms-composition/composition-instances-read.ts (136)
8b494ed5d883be9031beef67beabf1a0889b57368671b470866cbb2bddd6048a  packages/contracts/src/cms-composition/composition-instances-read.test.ts (249)
29e56282a6f8db8b4db4b4ac1109c73d73af40673ac550173ecd6251b1e98737  apps/worker/src/cms-composition/composition-instances-routes.ts (85)
d452a92da1db42b2d4e5f5a07a26e83944f6ce5db7aabed3f569cfb2d4edc324  apps/worker/src/cms-composition/composition-instances-query.ts (61)
718e973b3a126b5223c0b997be91ef132966ddc24f262d0296d476a8c59ef39c  apps/worker/src/cms-composition/composition-instances-answers.ts (24)
09b3001448cac71f7a41c1eda0ca0fee918ea78cba28f503427c8078c6f78703  apps/worker/src/cms-composition/composition-instances-routes.test.ts (343)
e7c71a7de34b71f19ede4fd46a9940ef0f1915590486fcaa1be0f26e13315021  apps/worker/src/cms-composition/composition-instances-limit.test.ts (80)
b912a98573ebe656fb82ee8927f8916df5c4cf35d79ae84f6a2cdb7938806269  apps/worker/src/cms-composition-production-pattern-update.ts (194)
fb7905d27f991390b8da993e2f887772d13f35071d2f5d514b92c5e2676de84d  apps/worker/src/cms-composition-production-pattern-update-instances.test.ts (212)
089e159bcb008ff3bd2456ac5a060967e220484e0ca7ed20a8cb9d10effb2fec  apps/web/src/server/cms-composition-instances-list.ts (138)
e2922692fa3159f267f603cb72f8cd129d9ba63496b2581402f533db9e81e0a4  apps/web/src/server/cms-composition-instances-list.test.ts (266)
173b4428a5bcdc2a007e6148f04ee84921f6d53b7d8950dc3c385449dbe8bf06  apps/web/src/components/cms-composition-instances/load-composition-instances.ts (98)
590cc07b1c98b2310506e89ae38d265a8f8f56689da99b64b3690f9b2e1dba14  apps/web/src/components/cms-composition-instances/load-composition-instances.test.ts (127)
c20e409962b2c38f6a11facb8c0fffc6d96ff674e3f8501d1b7102c2eb47f0f6  apps/web/src/components/cms-composition-instances/load-composition-page.ts (188)
9fe6082a7debe8c4325ed9a40bb09eabf041948ad0c42cd7d181f1602399c216  apps/web/src/components/cms-composition-instances/load-composition-page.test.ts (400)
384fbe9d0c489ead9d81d2da5e73b3f9db01e2a8a0f4850e4b563526b387bd3f  apps/web/src/components/cms-composition-instances/composition-page-reads.ts (95)
303710efd5eae71144964b653d9d54ab8fb068033e688d9d26b9fe4b0f0162ae  infra/openapi-definitions-cms-composition.mjs (283)
7702f8b11ffe2b92a9cafeaa0c4972f69534d89968f6a2de53c1d8fba0eb843a  docs/openapi/openapi.json (63091)
56afd7ab7d746c104b7d2f0e8b7d20f0a114f1d9b27100cbfd442f3d8edd2fa4  packages/contracts/src/cms-composition/index.ts (31)
a45ac3c4c2735a53d267d35e9d80c0e73759573031589cc99df42e6b95670fe0  packages/contracts/src/cms-composition/error-catalog.ts (150)
9cb67fa970846866ceba7c607040c66a4d50afd152a416dc678e9c6dd1ff068c  packages/contracts/src/cms-composition/error-catalog.test.ts (183)
dac4a301568a0aeccc91d78f2e7174b5b94948d86fdc9d431eee4412b2b4ca42  packages/contracts/src/cms-composition/refusals.ts (318)
7a3c08f9ea2e90abe0f2c710eca7043712dcb9ee3e3567162bfabdc4ce58ed7e  packages/contracts/src/cms-composition/refusals-operations.test.ts (155)
afaab9a55cfd8d299739f21d434face3b5026bfd2de186397bdca8ceb708b303  packages/contracts/src/cms-composition/README.md (112)
b62cf06ec3afc33051f5cadca44b8a9e91dd508fa9197235142b7de994e6e56a  packages/contracts/src/platform-registries.ts (2460)
10e460a2deab2418f72e09080a32913906de18c80778fed587a8b9e1131adb30  packages/contracts/src/openapi.ts (619)
8518a65f95d5cf041d92f5764c37d7a395005c8430505857019aa0a10aa1f30a  packages/contracts/src/registries.test.ts (407)
6f29403f013e7a27ce63c88d3e81c25d974a8494209f75b3246c71a37b70b50d  packages/contracts/src/core-contracts.test.ts (351)
145178bb883d4381ba3c59a7d2eb949a02c2dbf26f9f9a791d46e39c2ec8643a  tests/contracts/phase-02-slice-12-composition-instances-openapi.test.ts (62)
6f6794f6002dc8fb35c6723ee79f346438871de8392107458f9cedadd4493a26  apps/worker/src/cms-composition/composition-instances.test-support.ts (52)
b8ef904387f024da56749c16b39ec1f6a445641e958eee50e15a664c0a3dbf70  apps/worker/src/cms-composition/pattern-update-operations.ts (74)
eeec256c0f5456dff12a740cab17ddd7965fd12de75ba61c07ad74c96c943b56  apps/worker/src/cms-composition/pattern-update-ports.ts (215)
4f24b9e89aea686d1191f208143e458c1ad2c5a5c85f0bcbe4bbe8424932f736  apps/worker/src/cms-composition/pattern-update-read.ts (114)
31a3e746c236d5722b24c2324242e9b530c25b7a3de9cd4f0c1d842e37282f1a  apps/worker/src/cms-composition/pattern-update-response.ts (216)
7e7b9fb2476ff6f22f75bbba112de53cf48817d0d6a72b11b80a1ef35ee7e0af  apps/worker/src/cms-composition/pattern-update-routes.ts (162)
74d38be907eca24436271c0e81b9fa901ca6b5c81a1f8bed13a15a53df8c94f5  apps/worker/src/cms-composition/pattern-update-routes.test-support.ts (96)
0f9c7d266ae9ad51426bb45375fec49ceaad44614cd91cad19e71ccddfcac477  apps/worker/src/cms-composition/pattern-update-order.test.ts (164)
1ddb0241bcf1aed2bf1346af93f793aa9eeb51dc1017fbe75bf943ef9d11b072  apps/worker/src/production-worker-runtime-pattern-update.test.ts (226)
07197d9c006258f6408c547936630b80a9c701205c690a4a61b2f5d7d47a7728  apps/worker/src/cms-composition-production-pattern-update-failure.ts (143)
1ea5e0ac7aab066311956b3e0b5eb026051e9f172d3363d20a0d5e2efc83c6bb  apps/worker/src/cms-editorial-production-boundary-types.ts (106)
250b8895ba2c3147dced7f2611720c9b195b413afe8a6f815ba7d2b29091db3d  apps/web/src/server/cms-composition-instances-errors.ts (174)
bcf26503a103d0a917e833e0212b58618c7a031523a0293f850b6968b2278381  apps/web/src/server/cms-composition-instances.test-support.ts (189)
678a3f9156e594e2e3e756be48d8aa8c3e795354871c7e715be08c12c7254438  apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.ts (13)
2f9ebd6014efcf285e359148daf8090c364b4f4a60ba19ad787f6026bc713f34  apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.test.ts (53)
e9f4553d351154e2827f57bf0c303869b03fb9727ff9b12644cc15c5cb430850  apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx (301)
5d829f8985799b690cbf1864c9ecf3d398a8e9a847ae963aab13a861b7f00a46  apps/web/src/components/cms-composition-instances/composition-rows.ts (82)
e022eac6170fba58e3518f186b9ad8cfd6b2f698b4f9cbb49141d029a9b337ca  apps/web/src/components/cms-composition-instances/composition-rows.test.ts (160)
f1b7e365dc1b83237733b6c7a4f76006306a06eeb89e7368dd4bc0aede9e8f54  apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.tsx (120)
7d4364e09c8f89ee8907de16386d10c97d0062ba18e3ffd8aab0a23cbff4d013  apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.test.tsx (225)
7e3b8d06ce49100e36be9bf8ffdc8e4610674bea9f958517a46a0c04cff2e809  apps/web/src/components/cms-composition-instances/CmsCompositionPage.tsx (87)
dbb8675d9d02230e98b4de579c19e91c95ea2ed47c28fe44a7015d7921db519d  apps/web/src/components/cms-composition-instances/composition-copy.ts (92)
5bb63c65f5478cd6c7fb406fa27deae0bfd5212adf087998c042027c52dcec13  apps/web/src/components/cms-composition-instances/use-composition-session.ts (150)
d0d4e1db7fa512b53ee5633e340c361b83fbf65d686324fd1be2384ea870009b  apps/web/src/components/cms-composition-instances/README.md (86)
f928aabdb0417765e04f545ae98ad8015aa3c3d00d84ceec7e641f5ade064e93  supabase/tests/phase_02_slice_09_r8_api_surface.sql (238)
34602b361fca4eba2a03d879f9dcdc0c5dfbf053688ffba1c58ba86106952cd1  apps/worker/src/cms-composition/README.md (217)
09684fc6995435dd202a461701d57a7df069af14dd1c21f10592bf898676266a  apps/web/src/pages/api/v1/cms/entries/[entryId]/README.md (45)
```

Reference bytes read: lane reports `lane-fix-dec194-report.md` `3a5fc25d7b54dfc8c7b747c2304b36bea10ea50025d84ce8330a6aba7964f8d9`,
`lane-fix-dec206-report.md` `c9c412f230faebf36223b75fc669fb846fd6848d46350bd5cc2d81ad3dc71795`; `review-r2-report.md`
`a8b728f6de6ab8e23a6e3fd540cf2480c34cdf99932bb7fd9e507c0ad4efb321`; `review-r3-report.md`
`870975ab70c808a6ec566230e25e0b9a45393e7cad278ef5440f7ec1fa056941`; brief `review-promotion.md` `4ead0bca252e0d3c77a45d21fa4ce9305d0ba0bf30b2aa5594b8094f1fc75057`;
raw decisions `.memory/raw/events/2026-10-22.jsonl` `a6547363fe9fb3f719ccdd86ba083cbc6efa2a1de4cd25dd15d1a9eec9614e10`; precedent
`supabase/migrations/20261014140310_cms_list_pattern_selector_public.sql` `aec26d0673a2119da33a0c147d76bbae9027c0e6a56a5c4d2d7d88c3eb27f023`; shared helpers
`supabase/migrations/20261005010400_cms_revision_comparison_domains.sql` `bb251ef40bdda419a6d301d9508518ce16d5cbe1910338ca8059d36d657b587f`.

## Method and evidence

1. **Before/after proof for dec194.** The lane kept the pre-fix bytes in its scratchpad (`claude_s12_fix_dec194/orig/`). Their SHA-256 equal the hashes R2
   reviewed (`8c9f94b1...` 190000, `724320cf...` 190010, `1f9ea516...` 190020, `e1e60a3a...` 190030, `8a671555...` 190040, `b1cb29a4...` 190050 and the test files), so
   the diffs below are exactly what F3 changed. 190010: header comment only. 190020: rename plus DEC-212 comments. 190030: header paragraph, two inline comments, two
   `comment on function` texts; both function bodies still equal the promoted `20261014120500` and `20261014120300` bodies plus only the R2-verified mutex lines
   (re-checked by a body diff: `cms_act_taxonomy_term` +5 lines at the former `:47`, `cms_request_taxonomy_merge_converge` +4 lines; attributes, owner and ACL statements carried over). 190040: byte-identical.
   190050: header (folded from 190000), rename, the R2-03 routing pre-filter, one comment text.
2. **Authenticity of lane evidence.** All 16 TAP SHA-256 values quoted in the two lane reports (7 in F3, 9 in F4a, including the harness-failure run 6) match, in full, the files in `.lane-logs/` (checked by `sha256sum`). Final dec194 run 4
   (`...205837-3737452.tap`): `phase_02_slice_12_dec194_sweep.sql` plan 1..160 with 160 `ok`, 0 `not ok`; the only 4 failures of the 13 files are S09 inventory pins
   (`sec2_all_schema` #6, `r8_api_surface` #4, #13, #14). I recomputed the #6 diff from the TAP `have`/`want` lines: 86 vs 85 elements, the single difference is
   `platform_private.taxonomy_merge_recoveries`. Final dec206 run 9 (`...190808-3239262.tap`): `phase_02_slice_12_composition_instances_read.sql` 332 `ok`, 0 `not ok`, plan 332; every file mtime of the dec206
   migrations and fragments precedes the run; the run's dependencies `dec193/042300`, `042500`, `041300` are unchanged since (hash-equal to the manifest).
3. **Vitest run by me, all green on the current bytes:** contracts + Worker focused set 9 files / 148 tests; Web dec206 set 23 files / 284 tests and the two bracket-path route tests 2 files / 16 tests;
   broader `packages/contracts` + `apps/worker/src/cms-composition` + the OpenAPI test 329 files / 5,796 tests; the merge-converge runbook test 9/9; `tests/postgrest/support/phase-02-slice-12-dec194-*` 2 files / 19 tests;
   `node infra/generate-openapi.mjs --check` exit 0 (operation `cmsCompositionInstancesRead`: `limit` integer 1-50 default 25, `cursor` string max 512 or null, no 409/422).
4. **Static repository checks.** Rename grep over the whole tree (excluding `.git`, `node_modules`, `.lane-logs`); timestamp uniqueness across 461 promoted + all WIP files (the only duplicates are
   `20261022030000..030300` between WIP dirs `governed-recheck` and `governed-recheck-red`, outside this scope); hygiene scan of the 7 migrations (LF only, no tabs, final newline, one `begin`/`commit`, balanced dollar quotes,
   no TODO/BOUNDARY, <=225 lines); definition search for every replaced or called function across promoted and WIP.

## Finding resolution (original id -> status)

| Original | Sev | Status | Evidence on disk |
| --- | --- | --- | --- |
| R2-01 (recovery table breaks four `cms_` pins) | MAJOR | **RESOLVED** (lane scope) | Option A taken (DEC-212, `.memory/raw/events/2026-10-22.jsonl:10`): `190020:15-34` creates `platform_private.taxonomy_merge_recoveries` with policies `taxonomy_merge_recoveries_select/_insert` and DEC-212 header `:5-10`; `190050:62,78,110` read and write the new name; `000-helpers.sqlinc:215-314` (dynamic accessors), `060`, `070`, `001-support-helpers.sqlinc:7,13`, `010-surface.sqlinc:61-109`, README and `tests/postgrest/support/phase-02-slice-12-dec194-isolation-probe.sqlinc:133`; BE03c `:1547,:1587,:1882` and runbook `:94-98` already use it. The old name survives only in the deliberate absence assertion `010-surface.sqlinc:63` and in historical handoff docs. Run 4 TAP: the three structural pins R2 named now pass - `p240_authority` #73 (AC-015 envelope, line 2630), `evidence_misc` #44 (AC-181 policy form, line 2741), `schema` #452 (AC-215 guard coverage, line 3409); the two root-owned inventories (`sec2_all_schema` #6, `r8_api_surface` #4/#13/#14) are the expected remaining edits. |
| R2-03 (sweep locks every party that ever failed) | MINOR | **RESOLVED** | `190050:53-69`: routing scan keeps a party only if its failed head (`distinct on`, `created_at desc, id desc`) is unmarked and the party has no queued or running job; ascending `order by head.acting_party_id`; post-lock re-selection unchanged as authority (`:71-90`). `080-routing-prefilter.sqlinc` pins five parties via `pg_locks` (11 assertions, TAP 150-160 green); mutants M1 (no marker predicate) fails exactly 155 and 159, M2 (no live-job predicate) fails exactly 156, M3 (any failed job instead of head) fails exactly 159 (`...194452`, `...194553`, `...195136` TAP). Ascending order itself is not pinned: V1-01. |
| R2-04 (undocumented mutex insertions) | MINOR | **RESOLVED** | `190030:24-31` delta paragraph, `:84-85` inline comment at the merge insertion, `:167-169` comment at the reentrant call, `:154` and `:182` extended `comment on function`; verified comment-only by diff (no statement changed). `190040` unchanged (already documented). |
| R2-05 (no posture assertions on mutex helper and table) | MINOR | **RESOLVED** | `010-surface.sqlinc:42-109` = 14 catalog assertions (TAP 26-39, all ok): helper exists / definer / empty `search_path` / no EXECUTE for any API role and PUBLIC / `service_role` refused 42501; table: no `cms_` twin, RLS enabled and forced, no API-role privilege, exact non-owner ACL `wejammin_cms_definer:INSERT,SELECT`, definer lacks UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, exactly two permissive definer-scoped policies with the RPC-context gate, exact column list, primary key `failed_job_id`, exactly one FK to `platform_private.jobs(id)` with `confdeltype = 'c'`, no user trigger. All are non-vacuous when the table is absent (they key on `s12dc_assoc_oid()` or `coalesce(..., false)`). Matches every item of the R2 list (1-3); item 4 stays in `060` x1/x2. |
| R2-09 (stale RED / CONDITIONAL / proposed wording) | NIT | **RESOLVED** | No `CONDITIONAL`, `proposed`, `selected design` or `current WIP` remains in the sweep folder or the entry file; the two remaining `RED` tokens (`060:3`, `070:4`) are accurate history ("first a RED witness ... GREEN since the durable table landed"). Condition and assertion SQL unchanged (diff shows descriptions and comments only). Slip: V1-05. |
| R3-01 (unauthenticated, non-expiring, unbound cursor) | MAJOR | **RESOLVED** | `050010:30-45`: `cms_signed_cursor_require_key`, `cms_signed_cursor_open('cms-03c-instances', ...)`, `cms_signed_cursor_seal_page(...)` - the same three shared helpers as CMS-03C-13 (`20261014140310:26-33`), domain label unique in the repo. Binding `050000:129-131`: route, sort, contract version, actor, acting party, entry, draft revision; payload `{queryHash, lastInstanceId, expiresAt}` (`:179-183`, sealed envelope 384 characters, <=512); expiry `+86400` at issue (`:182`), the shared helper caps an over-lived cursor and compares the MAC in constant time (`20261005010400:169-178`), the reader rejects an expired one (`050000:134`). Tamper, forgery, unknown key, over-lived, expired, cross-actor, foreign entry, foreign revision, foreign domain, structural faults: all `INVALID_REQUEST` (400) with no detail (`050010:36-41`; pgTAP `004-paging:79-114,131-143`, `005:19-23`; TAP green in run 9). Missing Vault key: `DEPENDENCY_UNAVAILABLE`, never an unsigned page (`002:48-53`). Spec: BE00 `:491`, BE03c `:409,:1879`. Decision trace gap: V1-02. |
| R3-02 (fixed page of 100, no `limit`) | MINOR | **RESOLVED** | SQL `v_limit` 1-50 default 25 (`050000:40,67-77`), reader returns `v_limit + 1` ids (`:169`); contract `limit` 1-50 default 25 and `items` max 50 (`composition-instances-read.ts:20-31,52-55`); Worker applies the default at the edge (`composition-instances-query.ts:27-61`); Web proxy allowlists `limit` 1-50 (`cms-composition-instances-list.ts:21-52`); OpenAPI regenerated and `--check` clean; BE03c `:409,:1188-1196,:1648`, FE03 `:1746`. No `c_page` or `100` remains in the dec206 SQL or sources. Tests: pgTAP `004:30-65`, `005:29-38`; Worker `composition-instances-limit.test.ts`, route test `:90-103`. |
| R3-03 (BE03c wording of row 182, matrix 1412, region, "issued by this read") | MINOR | **PARTIAL** | Resolved: matrix row `:1415` now reads 409 "not applicable" (correct, every cursor fault is 400); the unenforceable "issued by this read" is gone from `:409`. NOT applied: route-registry row `:182` carries none of the cursor discipline the sibling rows `:172,:178,:180,:185` state ("signed keyset cursor over (...); default limit 25, max 50"); `:1190` still reads "render-plan order: region, slot ordinal, `position`, `path` (bytewise) and `id`" although `region` never discriminates composition rows (the SQL header `050000:19-21` and the contract header correctly omit it). F4a report open item 4 ("already applied: rows 182, 409, 1412, changelog") overstates this. Finding V1-03. |
| R3-04 (invented 2,000-row loader cap) | MINOR | **RESOLVED** | `load-composition-instances.ts:10-18,63-97`: pages of 50, no page-count cap, guards = time budget (`:64`, 20 s) and a cursor offered twice (`:95-96`); both end in `{kind: 'degraded'}`, rendered as 503 "Composition list unavailable" with a reload link (`load-composition-page.ts:50-62,126`), nothing shown; FE03 `:887,:1616,:2900`. Tests: `load-composition-instances.test.ts:63-110` (120 pages followed, repeat degrades after 2 calls, budget degrades after 3, slow-but-ending walk succeeds) and page-level `load-composition-page.test.ts:233-243`. TS mutants M1-M11 all killed (see below). Open design point for root (not a finding): no BE rule bounds heads per revision, so a very large revision becomes a latency-dependent, permanent `degraded`. |
| R3-18 (copied rank expression, stale plan citation) | NIT | **RESOLVED** (comment); extraction conditional | `050000:19-22` now cites the live plan patch `20261016042500_cms_revision_render_plan_dec193.sql`; parity stays guarded by `003` (`s12ci_plan_paths`, three shapes). The finding's own wording defers the shared helper to "when the plan is next touched"; the plan migration is unchanged (mtime 2026-10-16, hash equal to run 9). |

## Findings (new in this review)

| Id | Sev | File:line | Evidence | Spec / rule | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| V1-01 | MINOR | `supabase/migrations-wip/dec194/20261014190050_...sql:68`; `supabase/tests/phase_02_slice_12_dec194_sweep/080-routing-prefilter.sqlinc` | The sweep's "parties in ascending id" lock order is not pinned by any test. `grep -i ascending` over the sweep folder and both race modules finds only comments; the race modules use one party; M1-M3 do not touch ordering. Dropping or reversing `order by head.acting_party_id` leaves 160/160 green. R2 verified two-sweep deadlock freedom on exactly this order. | BE03c `:1500` ("the sweep takes only that mutex, parties in ascending id (DEC-212)"); lane rule "tests ARE the spec" | Add one catalog pin to `080`: `select ok(pg_get_functiondef(to_regprocedure('platform_private.cms_reconcile_taxonomy_merge_converge()')) ~ 'order by head\.acting_party_id', ...)` (repo precedent: `dec206 002:36-39` function-source pins); test files are not immutable, so this may land after promotion. |
| V1-02 | MINOR | `.memory/raw/events/2026-10-22.jsonl:3` (DEC-206) | The DEC-206 record still states "cursor pages of at most 100 with an opaque nextCursor (PatternSelectorPage convention)" and "(region, slot ordinal, ...)". The alignment (limit 1-50 default 25, signed BE00 cursor, 400 for tamper/expiry/cross-context, loader guards, withdrawn 2,000-row bound) exists only as BE03c changelog `:1879` and FE03 `:2900`; none of records 1-14 of the file amends or supersedes DEC-206 (listed). R3-01 asked for the 409-versus-400 choice as "ONE recorded decision". | `.claude/rules/memory-capture.md` (non-trivial decision -> raw record via `flushEntry`); R3-01 proposed fix | Append an amendment raw record (or a new DEC) stating the 400 rule, `limit` 1-50/25, domain `cms-03c-instances`, loader guards and the withdrawn bound; compile at root's discretion. |
| V1-03 | MINOR | `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:182` and `:1190` | Residual of R3-03 (see resolution table): row 182 has no signed-cursor/limit statement unlike siblings `:172,:178,:180,:185`; `:1190` names `region`. | BE03c siblings `:172,:178,:180,:185`; BE00 `:491` | Root: add "signed keyset cursor over (slot ordinal, position, path, id) bound per `:409`; default limit 25, max 50; no entity tag" to row 182 and replace "region, slot ordinal" by "slot ordinal" at `:1190`. |
| V1-04 | NIT | `supabase/migrations-wip/dec206/20261022050000_cms_list_composition_instances.sql:72-76` | A JSON number with scale (for example `10.0`, rendered `10.0` by `->>`) passes the `floor`/range checks and then `(p_request->>'limit')::integer` raises 22P02, an unmapped SQLSTATE (Worker: scrubbed 500) instead of INVALID_REQUEST (PostgreSQL semantics, read from the code; not executed here). Unreachable through the Worker (JS serializes `10.0` as `10`; zod `.int()` already refused fractions) and identical to the sibling `20261014140300:69-75`; no pgTAP case covers it (`005:30-32` lists `2.5`, not `10.0`). | BE03c `:409` (`limit` 1-50 integer) | While the file is still editable: `v_limit := (p_request->>'limit')::numeric::integer;` and add `('scaled', '10.0'::jsonb)` as an accepted-page case (page of 10) to `005`. |
| V1-05 | NIT | `supabase/tests/phase_02_slice_12_dec194_sweep/060-idempotency-expiry.sqlinc:95-96`; `README.md:20-30` | The R2-09 reword left "so the" / "the sweep must associate" (duplicated word). README says "Labelled fixture forgeries (nothing else)" and then lists two sets, but the 080/001 forgeries (synthetic acting parties, marker rows inserted as test admin) are declared only in `001-support-helpers.sqlinc:8-9`, `080:9-10` and the table rows `README.md:10,18`. | `extensibility.md` directory documentation | Delete one "the" at `060:96`; add the two forgeries to the README forgery list. |
| V1-06 | NIT | `supabase/tests/phase_02_slice_12_composition_instances_read/README.md:7-9` | Names stack `pattern-updates,dec193,dec206` and a release-wave stack without `block-rules`/`fix-dec193`; run 7 (`...183701-3101443.tap`) shows #59 and #97-99 fail without `block-rules` (`dec193/20261016041600` calls `block-rules/20261022080100` when the fixture detaches). Moot after promotion. | lane report open item 6 | Update the stack sentence or drop it at promotion. |
| V1-07 | NIT | `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1547,:1587` and lock-order table | The support table is specified only as "failed Job id -> requested Job id, cascading with the failed Job row". The pinned columns (`recovery_job_id uuid not null` with deliberately no FK, `requested_at timestamptz not null default clock_timestamp()`) live in the migration comment and `010-surface.sqlinc:93-106`; the CMS-03C-03 row of the lock-order table lists positions 1, 3, 6 and omits the merge mutex (stated only in the `cms.taxonomy.merge_converge` row). | `specificity-standards.md` ("every entity has all fields typed with constraints") | Root: one sentence naming the three columns and the missing FK in "Database Schema"; one parenthesis on the CMS-03C-03 row pointing to the mutex. |

## Specific verifications requested

1. **Nothing still needs `190000`.** It created only the first, unserialized body of `platform_private.cms_reconcile_taxonomy_merge_converge()` plus the same owner/ACL statements that `190050:127-131`
   carries; `190050` is a `create or replace` of the same signature and is now the first definition. No file in any lane has a timestamp between `190000` and `190050` other than dec194's; the only references
   to `20261014190000` are historical handoff docs and the root inventory JSON (`docs/handoffs/2026-10-22-claude-phase2-s12-inventory.json:7507-7508`); no test, doc or manifest of the live stack names it. Final manifests stage 83 WIP files, no `190000`.
   The spec quotation and the three interpretation notes moved into the `190050` header (`:1-32`) verbatim.
2. **`190010` sorting before the body it calls is safe.** The wrapper is plpgsql (`190010:13-33`): `rpc_result := platform_private.cms_reconcile_taxonomy_merge_converge();` is bound at call time, creation validates syntax only, and
   a fresh reset applied this order (run 2 and run 4, `wip=83`, suite 160/160). Residual, not a finding: during an incremental deploy there is a window of seconds between the `190010` and `190050` transactions in which the
   `service_role`-executable wrapper exists without its body (a tick landing there fails with 42883, which the wrapper does not map, and the next scheduled tick succeeds). Optional hardening, not required: number the wrapper after `190050` before promotion.
3. **The rename reached every reference.** Whole-tree grep for `cms_taxonomy_merge_recoveries` (and for `merge_recoveries`): live hits are only the intentional assertion `010-surface.sqlinc:63` (asserts no `cms_` twin exists).
   Everything else is historical handoff text (`lane-codex-dec194-*`, R2 report, F3 report, the brief, DEC-212 record). Live users of the new name: migrations 190020/190050, `000`, `001`, `010`, `060`, `070`, `080`, README, the isolation probe
   (`:133`), BE03c, runbook. The Worker HTTP composite reads the table only through the probe snapshot (`phase-02-slice-12-dec194-isolation.apispec.ts` reads `associations`, not a table name); the race modules and `091/095` do not name it.
4. **Cursor seal = CMS-03C-13's shared helper; bindings; expiry; 400s.** Verified in code: the three helper calls and the unique domain label (`cms-03c-instances`; others in use: `cms-03c-11`, `-13`, `-17`, `-terms`); binding members at `050000:129-131`;
   <=24 h at issue (`:182`) and cap/expiry checks (helper + `:134`). Difference from the sibling, deliberate and spec-aligned: the CMS-03C-13 reader also hashes `limit` (`20261014140300:78`), this read does not bind the
   page size because BE03c `:409` lists only route, entry, draft revision, sort and user/acting context; pinned by `004:61-65` (a cursor issued at 50 continues at 10). Every fault is 400 (table in R3-01 row); the tests exercise each (see pgTAP lines above) and the signed wrapper is owned by the migration owner exactly as the precedent
   because only that role reaches the Vault helpers (asserted by `002:17-20`). Disclosure: signature verification precedes concealment, but a forged cursor is 400 for every caller and a validly signed one gets the ordinary 404/403 first
   (`005:50-51`), so no existence oracle is added.
5. **Loader.** Follows `nextCursor` until `null` (`load-composition-instances.ts:93-94`), page size 50, strict page and revision check per page, newest version per path with first place kept, repeated-cursor guard and time budget both end in
   `degraded` (503 notice with reload link), page-level 403 preserved, no sort, no truncation. A non-advancing read is caught on the second call within one clock second (identical sealed cursor) and otherwise by the 20 s budget (about 20 calls at >=1 s each).
6. **Claimed "behaviour-equivalent" unkilled cursor-hash mutant (drop `entryId`/`revisionId` from `queryHash`): the argument is correct.** After authority the reader looks the cursor row up with
   `cursor_instance.id = lastInstanceId and cursor_instance.revision_id = v_revision.id` (`050000:137-141`) and answers INVALID_REQUEST when absent; a composition row belongs to exactly one revision and a revision to exactly one entry, so a cursor issued for
   another entry or another draft revision is rejected at that lookup with the same token and no detail as the hash mismatch. The same holds for `actingPartyId` (the entry owner check precedes the hash and fixes the party); only `actorId` is behaviourally independent and
   it is killed (`005:19-23`). The binding is correctly kept as the spec states it; if the `revision_id` filter is ever relaxed the hash becomes load-bearing, so an optional source pin of the hash members would be cheap (not required).

TS mutation witnesses (script and output reviewed in the lane scratchpad): M1 repeat-cursor guard off, M2 time budget off, M3 loader page 25, M4 revision binding off, M5 newest version loses, M6 Worker ignores `limit`, M7 contract limit max 100, M8 contract default 50,
M9 Web ceiling 1000, M10 Web drops `limit`, M11 contract items max 100 - all killed. M2 was first "killed" only by an out-of-memory crash of the worker; the added 10-call runaway stop (`load-composition-instances.test.ts:85-99`) makes the unmutated test fail by assertion
(an unbounded walk would end in `{kind: 'response'}` instead of `{kind: 'degraded'}`). SQL mutants (runs 4, 5, 8) are confirmed in the TAP logs: unsigned/forged cursor accepted (9 tests), expiry removed (176-177), actor binding removed (234-235), limit ceiling relaxed (256-261, 290),
default 100, 24 h made 7 days (125-126), CONFLICT unmapped (161-173), page overflow (117).

## Test-correction verdicts

| Lane | Correction | Verdict | Reason |
| --- | --- | --- | --- |
| dec194 | Rename `cms_taxonomy_merge_recoveries` -> `taxonomy_merge_recoveries` in `000`, `060`, `070`, README, probe include | ACCEPT | Required by BE03c `:1547,:1587` and DEC-212; diff shows names and comments only; the assertions and conditions are untouched. |
| dec194 | R2-09 description rewording (`060` x1 labels, "expiry witness", `070` ten `CONDITIONAL` prefixes, header comments, entry-file line 1) | ACCEPT | Same assertions and conditions (diff verified). TAP descriptions changed, so any ledger citing them by text must re-cite (today only historical handoff docs do). Wording slip V1-05. |
| dec194 | Additions: `001-support-helpers.sqlinc`, `010` +14 posture assertions, `080` +11 routing assertions, entry includes, README rows (135 -> 160 tests) | ACCEPT | Strictly additive and non-vacuous; required by R2-03 and R2-05; mutants M1-M3 killed by the predicted tests. Fixtures: jobs and outcomes go through the real `accept_job_with_outbox`, `claim` and `apply_job_outcome`; the two forgeries (synthetic acting parties, marker rows inserted as test admin for "already recovered" heads) are labelled, bypass no authority and disable no trigger; real markers are produced by the real sweep in `060` x1 and `070`. Gap: ordering (V1-01). |
| dec206 | pgTAP rewrite: unsigned `{h,i}` cursor, fixed 100 page and `s12ci_cursor_make` replaced by the signed envelope, `limit` 1-50/25, 400-on-fault cases | ACCEPT | Required by BE03c `:409,:1188-1196,:1879` and BE00 `:491`. Coverage includes the cases R3 recorded for the old oracle (hand-built cursor -> `c-unsigned-legacy`, wrong binding hash -> `c-signed-other-hash`) and adds foreign entry and revision, tamper, expiry, over-lived, cross-actor, foreign-domain and unknown-key faults; the pre-fix dec206 files were not retained, so I could not diff the old suite itself. The labelled fixtures (`s12ci_next_row`, second revision flipped to current at `004:131-145`, `norev1`) are plain guarded writes under `app.cms_rpc` (the flipped revision is flipped back at `004:145`) and disable no trigger. |
| dec206 | Web loader tests: "20 pages = unverified" replaced by no cap (120 pages), repeat degrade, budget degrade, page size 50 | ACCEPT | Required by R3-04 and FE03 `:2900`. The fail-closed behaviour is preserved (degrade instead of refuse) and pinned by M1/M2. |
| dec206 | Contracts / Worker / Web tests: `limit` 1-50 default 25, items <=50, answer must honour the asked limit | ACCEPT | Required by BE03c `:1188-1196`; new `composition-instances-limit.test.ts` is non-vacuous (also asserts refusals 502 and the default of 25). |
| dec206 | `load-composition-instances.test.ts` budget case hardened (runaway ends with 500 after 10 calls) | ACCEPT | Found by mutation M2; strictly stronger. |

## Promotion prerequisites for root (not findings against the files)

1. S09 inventory pins: `supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql` test 6 add `platform_private.taxonomy_merge_recoveries` (verified single-element difference);
   `supabase/tests/phase_02_slice_09_r8_api_surface.sql` #4/#13/#14 classify `cms_reconcile_taxonomy_merge_converge` and the other lanes' RPCs (run 4: have 99, want 94; `cms_list_composition_instances` is already classified).
2. Run the two dec194 race modules and the Worker HTTP isolation composite on the new bytes (F3 and I did not run them; the probe include now reads the new name). The pre-filter does not change which eligible party is locked nor the producer-first wait by construction.
3. Promote exactly `190010 190020 190030 190040 190050` and the two dec206 files in timestamp order; dec206 needs dec193, pattern-updates (already earlier by timestamp) at promotion; update `docs/handoffs/2026-10-22-claude-phase2-s12-inventory.json` (still lists `190000`) and delete `supabase/migrations-wip/fix-dec206/` (empty).
4. After promotion: `pnpm db:types` (new RPCs), `supabase/migrations/README.md` sections, BE03c named-RPC list `:1617` and AC-261 refresh (DEC-212 defers it; `cms_reconcile_taxonomy_merge_converge` and `cms_get_related_content` are still absent from `:1617`).
5. Timestamp interleaving (R2-06): dec194 sorts before the promoted tip `20261020203606`; promote all lanes together and use `--include-all` for any database that already applied the tip.
6. Open design question for root (R3-04 residue): no BE rule bounds heads per revision; FE03 `:2900` now documents the 20 s budget as the guard. Decide whether BE03b/BE03c should bound heads per revision or accept the latency-dependent `degraded`.
7. Out-of-scope observation: WIP dirs `governed-recheck` and `governed-recheck-red` carry four identical timestamps (`20261022030000..030300`); promote only one set (V4's scope).

## Limits

Behaviour that depends on a running database (pgTAP results, lock waits, Vault key rotation, RLS at hosted roles, the dec194 race modules, the PostgREST isolation composite) rests on the TAP logs named above, whose hashes I verified, and on reading the bodies; I ran none of it.
I did not review the UI components of the composition page beyond the loader and read seam, the dec193/pattern-updates lanes (R1/V2) or governed-recheck (V4). Nothing here asserts hosted or production behaviour.
