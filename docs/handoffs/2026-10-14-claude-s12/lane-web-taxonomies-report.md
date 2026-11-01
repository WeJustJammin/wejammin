# Lane report: claude_s12_web_taxonomies (Web surface, FE03 vocabulary pages)

## Status
GREEN (final, 2026-10-15 12:05Z). Resumed after a usage-limit kill; found the term form already written and re-verified it, then finished the loader, pages, governed panel, nav, CSS, READMEs, step-up inventory, closure/mount guards, mutation battery and the file-size cap splits. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, HEAD `b16edb54`. Nothing outside the brief's claim was touched except the two items root handed over (step-up inventory, `server/README.md`).

## Scope
Brief `briefs/web-taxonomies.md`: `/app/cms-content-modeling/taxonomies/new` and `/taxonomies/:taxonomyId`, `CmsTaxonomyVersionDesigner`, `CmsTaxonomyTermForm`, governed submit mount, same-origin proxies for CMS-03C-16, `cmsTaxonomyVersionsRead`, CMS-03C-03, `cmsTaxonomyTermsRead`, CMS-03C-17, nav entry, step-up inventory entries. `CmsTaxonomyFieldEditor` out of scope.

## Facts from other lanes (handled)
1. Step-up inventory: ten unclassified 401-reading files (nine components plus `server/cms-taxonomy-platform-details.ts`, plus the new loader) classified `NO_STEP_UP_ROW`: BE03c 216 says CMS-03C-06, the create (-16, -03), selector, diff and term commands require no recent MFA, and the catalog row 1314 lists no `STEP_UP_REQUIRED` for CMS-03C-16/-03/-17 or the reads. Guard green (5/5).
2. `apps/web/src/server/README.md`: stale "insertion RPC is not yet implemented" fixed (`cms_insert_pattern_instance` promoted in `20261014110300`); added `cms-composition-platform-capability.ts` (hardening-4 03c 403 filter), the CMS-03C-09 activation proxy (`cms-governed-review-platform-command*.ts`, ACTIVATE spec, route `governed-reviews/[reviewId]/activation.ts`), and the three vocabulary proxy modules.
3. 403 relays: `projectTaxonomyErrorDetails` publishes a 403 only as the operation's own `capability_missing` (`typedRefusal` over `CMS_SLICE_12_OPERATION_REASONS`); `cms-taxonomy-platform-errors.test.ts` drops `CAPABILITY_REQUIRED`, `separation_of_duties` and untyped 403s. Existing, verified, unchanged.

## Files
Created (path, lines, SHA-256) unless marked modified:

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx` | 151 | `2ffdb9de1c81cd2dd708d6babd7d8647184835d7061c7688d0de26802123a744` |
| `apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.tsx` | 77 | `842702884e94fa81ecd234f22765ea3dca86fe92aab8fbb746df71d4cd65e943` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyBasics.tsx` | 90 | `d163413592e22f51cb6b6c60bc904270edeaadcc76abdede30666ea53309964e` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyConflictPanel.tsx` | 98 | `8f62fa34672ac0723b7bf1d0346ca900451c0f065f22f60d1e46215899e6ec5d` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyDomains.tsx` | 86 | `2b58095a3af87bc79b17c343ebe263a2ea62cafe84ce516460f34d610131887c` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyStatus.tsx` | 170 | `b1f3436c15b1c67f72513473158a50202b3f52f5fc2cb6c97bdc0044c7c35784` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyTagList.tsx` | 143 | `1d0106d106eea9f395bc24ff9bf4aac88b4ef747994412b8f1bed37e192b4a1d` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.conflict.test.tsx` | 292 | `c6f99294315ed0d4e2b89878e370b0932ab3ac6c2c5cd496d44eace5848b742b` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.refusals.test.tsx` | 87 | `da706a929e87ea2e565713b086d75d5f0a0d910827ab5dff454aa6039fe7082d` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx` | 301 | `2edb4c6f92013205f649bc8ef1c1557c472118bf3a8bd9032560642aa32e2a89` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx` | 163 | `6ecfa2aa2d3a0cfc39969b115197cb4aad91aed1420172f84405ad5bea628bd6` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionFacts.tsx` | 59 | `557c8eeafc9d43da0f9e8dd942fe35a5be4034b362b7d0f6fb26aa24c5ee6cda` |
| `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionList.tsx` | 65 | `1568710ed621c26ab34a1d20d6f589498858038b864e688a5e4cfb3990549f64` |
| `apps/web/src/components/cms-taxonomy-designer/README.md` | 63 | `8e19483c15f2e513b0f6cf93a1501741050bd20386b2f036e12e06d5e76a49c2` |
| `apps/web/src/components/cms-taxonomy-designer/cms-taxonomy.css` | 177 | `f90de879a0c68ef89094579dd5b2a649b8f2cdfb82c06d9a70735112b157a56b` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-copy.ts` | 57 | `9711b3448408e657ecec3a42749dee0e29a0231706596812c70bcbd49679eb92` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-form.test-support.tsx` | 54 | `68a6f69b5bf510fd661724d376040c219f9f95e03725353381b493b14f587d43` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-ids.ts` | 29 | `561587f022d2acc3cb420bdbf9a8d590e76e282322427176649c3a5f0ead1d61` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts` | 142 | `9e2b42a616ea87ba1aa66e41a3218b0b89a9615105e9def14995ab2271720411` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.ts` | 114 | `74032a50b8d6a70852c0ff75300ec094353756fb58c5fb2abf01c512d5df0ef4` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-status.ts` | 26 | `808879817cbbd159ee915d24af598168674159824fe74d4fe1d02f5bd6a97434` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-submit.test.ts` | 182 | `a8156e1dd801ee3ecee8d2613d1c18a4ff4ba97885696419eb77dd9bbd87c518` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-submit.ts` | 90 | `fc310ad229dbcd357be808e6c5577ac1f0a9cab449de7898b17f8cffc478c338` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-designer.test-support.ts` | 71 | `cfbdc4c4c2c989872bf7f1d1f0261886bb482adb07834dcb74cec910552ea286` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-outcome-reconcile.test.ts` | 129 | `8638324dfc049d24c27815753c6c661eb324e4b6291804712dec685e316d7cee` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-outcome-reconcile.ts` | 86 | `500b312aaed05d2a20e50d4a129112eb1f9ce30e096fb80e8dc9c32487f3da98` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-review-outline.test.ts` | 84 | `03df29c0e3d70f3a540d06ed0aa301bd66b83ddf5fb4a44747dbf6979667e8e6` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-review-outline.ts` | 92 | `914beb3f05629071059549b5fca7b08f8256ff1383bf3b22f63797afab584ccb` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-tags.test.ts` | 90 | `1860191ec987f5a712fc8c664d87e7ab1de8aaa62341c663d8a5939fd005cffb` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-tags.ts` | 55 | `6b25a6696354f57f573c705c56d867019aefda60a93afe33bcb16414b1916c92` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-transport.test.ts` | 276 | `d54749f2e1b88a75f4b0b1c5a43f1022babb5cd79cbedd4f0fa194ec27aa4ca2` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-transport.ts` | 184 | `5ddbdf3b0f69ab1efd0bce95a248c531912439a5dea84d8c9449d0d639c891b7` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.test.ts` | 190 | `fe06a1662d3fb8a36d81d6ec91704a7e24f4d8a18d0825a99aac2a5aafc376e1` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.ts` | 221 | `1957f8a6ec74d6d1a991d2e954cdcd8ae2a49d5b2d62b48f84ce47960950c668` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-vocabulary.test.ts` | 159 | `04fd77b8154ba89e3364d8e51d784f6763cc782f109b846c790d979d5d9c97f5` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-vocabulary.ts` | 130 | `7c8205c795dc55c02a44bffa77f6a43af92489e1bd39b991f9d1eb4e9137d603` |
| `apps/web/src/components/cms-taxonomy-designer/use-taxonomy-conflict.ts` | 84 | `218a3e4186cad2e54c005cd9a31e88cd0011e5862e8185808e21619a6d214d50` |
| `apps/web/src/components/cms-taxonomy-designer/use-taxonomy-designer.ts` | 203 | `015a231bf4a50a5850e578850b6afaaa574ee5cb77e37537f2ea2fdb3898aeb4` |
| `apps/web/src/components/cms-taxonomy-pages/README.md` | 39 | `d787b6183b7cbc087c95e17877aa512b2ae6ccb2fc7376c4020930f2737cdc4d` |
| `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` | 330 | `f5d9f537a288fcd4dcc97ee734bf67582d07f2b8a8e916acf1a4afa9ca417a6b` |
| `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.ts` | 278 | `e43615f43ee24b1a85d149b3e8a091cce0c7aa6fd15c567c0c10f659471da738` |
| `apps/web/src/components/cms-taxonomy-pages/taxonomy-page-reads.ts` | 50 | `bbc00311686515437751adb9bdf78c85f6e8c10a9e4d082b052d986b5a584715` |
| `apps/web/src/components/cms-taxonomy-pages/taxonomy-static-closure.test.ts` | 54 | `91fe210b69bd071e5ed348894ceae1d1cdd5719ae153408c7c00eb4274ecdacc` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyAliasList.tsx` | 90 | `720f3a9d5b5de13feb66d32d5f0039903b1e3ff6cc80908fd36189087e740653` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyCanonicalId.tsx` | 31 | `299a3ec977019cf307cee1df7f5ba2a59592bad21c3b569c52700a520230d777` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyLabelRows.tsx` | 120 | `ca2f35ed23210d83e8c96a64cfe6bbd82301faf6fde17a34ce8aa46aff10968b` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` | 174 | `96adc6b4272d49bd1e526bce74b776ac1ade87738df74607620454c53e33232a` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermConfirm.tsx` | 59 | `dd2f4bfbfceee5a4b6160cb2bdfd12d15e89c3fea6d2bd0d4b6a449cc2fe5e9b` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermFields.tsx` | 92 | `0147d1626aeb81bf936937c1f4d7d02b2a256cf20718d9ed812341cf8b43e766` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.actions.test.tsx` | 258 | `17f526cc46ecc8a01c86ea815cce0ff99fd097878a6869cdfc681db84d25e410` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx` | 310 | `e0a980531c04ae76297a64e85b068691b54246498e826d1866bef3b30480041d` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx` | 199 | `c7ac9aec4bd68ca6dadcc663e104eff556bcb505b93744fcc6ed632faa44bb92` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermStatus.tsx` | 147 | `ba4a95c6f736ca0db698b946ef972c0421bd55bc2400d30a0ffe3bdc9e562391` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermTable.tsx` | 120 | `cb01ca48b0df28b42ec48c85aedc5d024104bac23e691fd38881b8cc83c0f61d` |
| `apps/web/src/components/cms-taxonomy-terms/README.md` | 54 | `a2592084308266baad1865d734b5e6433ee8683e4bfbed51e50c4908b05ca551` |
| `apps/web/src/components/cms-taxonomy-terms/taxonomy-terms-read.test.ts` | 245 | `9730179161832b6bbf4b5007b6e87a42b7037b0082d7c9c2fe3f95ca4e61fc36` |
| `apps/web/src/components/cms-taxonomy-terms/taxonomy-terms-read.ts` | 222 | `6eeb57560029b19020b8e08a007d79009d38b258f9c7e76ed7b51708b6f46c0e` |
| `apps/web/src/components/cms-taxonomy-terms/term-action-request.test.ts` | 280 | `fde7e23651c620ed44744766bcaa415563bc8461480d8ada3e57d3ebbbb4c097` |
| `apps/web/src/components/cms-taxonomy-terms/term-action-request.ts` | 183 | `27fcb3681936658b65e64ff9a0dbe12a2509dd0031e179b3a78e0bb18ed3fc41` |
| `apps/web/src/components/cms-taxonomy-terms/term-action-submit.test.ts` | 224 | `6bf672b1f5f1b8addadc8951c93045734df7e50dfe0d91461cbb1bf5a516587c` |
| `apps/web/src/components/cms-taxonomy-terms/term-action-submit.ts` | 110 | `af9fa55a86d4100edbeeb34dafda7b8c277e26247570878c09731cb22879953a` |
| `apps/web/src/components/cms-taxonomy-terms/term-copy.ts` | 66 | `2c45c640bc547bbb8c503364de377b63e38e2f805762a65510b49149cda62d65` |
| `apps/web/src/components/cms-taxonomy-terms/term-form.test-support.ts` | 136 | `e0a01760b95445de0ed671759e117618c69259ff5389e59e13320b7f5432cc37` |
| `apps/web/src/components/cms-taxonomy-terms/term-names.ts` | 22 | `f5d76f6a26d0ce7cb9dde8f86717d816a17062887007a187ee3323d343801c80` |
| `apps/web/src/components/cms-taxonomy-terms/term-rules.test.ts` | 122 | `dac13e2d0e0701498409a88f95e3ad53c85e62919c5261739d024633cff21901` |
| `apps/web/src/components/cms-taxonomy-terms/term-rules.ts` | 23 | `5e84cf9ab5a4f07d6fe5e7b735a1d916fc1abee26815fb4b19bd35d67f34a283` |
| `apps/web/src/components/cms-taxonomy-terms/term-status-copy.ts` | 66 | `62288671244bd5de6eae8c20116ccb566b53e4d6b205c4c76da6f05f948fbabf` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-form.ts` | 260 | `d8abc289c9a84a2cf952e5d711e07470c0d353f855b18582ddbd89e138332ae8` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-list.ts` | 101 | `01165f483241c88131326752dc435b4bf9b604400036eb69d36e7660ca626385` |
| `apps/web/src/pages/api/v1/cms/taxonomies/README.md` | 40 | `3dd74cc859991f6c4c2a4a6fa2956d9c967d076682921db1e7aafc1d90ec078c` |
| `apps/web/src/pages/api/v1/cms/taxonomies/[taxonomyId]/terms.ts` | 10 | `d6b716059b8a50da6fd4103791534911ac97157277db2cdfb4be3b66c4705639` |
| `apps/web/src/pages/api/v1/cms/taxonomies/[taxonomyId]/terms/actions.ts` | 10 | `cd698bca32297bab9eaab82b6ab3fbd9e2bc9bb8968fd0a0860f4b3f1315518f` |
| `apps/web/src/pages/api/v1/cms/taxonomies/[taxonomyId]/versions.ts` | 10 | `dd59e4b18a7f6378107a5ff36d70d7fc1e490871576057ba5250be783af4ecc3` |
| `apps/web/src/pages/api/v1/cms/taxonomies/selector.ts` | 10 | `feb792d4792b61edb626f9adbc53df9d03a3f7f8aad693cf3a33249847068701` |
| `apps/web/src/pages/api/v1/cms/taxonomies/taxonomies-routes.test.ts` | 181 | `5ab17fa053ea4718152de3f25ed83a6628b2a1912e72fb6e789c058d35d8d36e` |
| `apps/web/src/pages/api/v1/cms/taxonomies/versions.ts` | 10 | `f91bd248ef7207fe5e6767def3db446dee72454840f55d029aeca6662009ede6` |
| `apps/web/src/pages/app/cms-content-modeling/taxonomies/README.md` | 34 | `2a9e2bccbeaa142d331b6e5538f28870a8e8e2c36cec6abd6b53786545748351` |
| `apps/web/src/pages/app/cms-content-modeling/taxonomies/[taxonomyId].astro` | 99 | `ac093d7c61dc87fd2a0218fe891e4e8ae506ad2d55564b9947ba0af47f3465a5` |
| `apps/web/src/pages/app/cms-content-modeling/taxonomies/new.astro` | 57 | `e25fd890879bb7530f6b22581b1b408b9d1b9fd4a3477f54e7771d73b221bceb` |
| `apps/web/src/pages/app/cms-content-modeling/taxonomies/taxonomy-pages.test.ts` | 93 | `f14f23f22e98bcbaf7ada5b3bbfc69da0eace214e7422f46b06c6b5ce04e9498` |
| `apps/web/src/server/cms-taxonomy-platform-details.ts` | 229 | `50ff85b115198bb9391b7a184b4a217c74365da6e9fad994c038ff77a2bb5a9b` |
| `apps/web/src/server/cms-taxonomy-platform-errors-details.test.ts` | 241 | `3fe8d6594de56098fe071da22fcb0d346876b7bfc7d3130634627470cf54f656` |
| `apps/web/src/server/cms-taxonomy-platform-errors.test.ts` | 249 | `75b5f96259f9dbaf3611b4263b8fc79a20757cd6951a0ef48092eaca18e9b346` |
| `apps/web/src/server/cms-taxonomy-platform-errors.ts` | 106 | `cce257af724e14e79dd30054e40a4d8d8f041977bc1da17aa0bed5080aeefc57` |
| `apps/web/src/server/cms-taxonomy-platform-read-selector.test.ts` | 196 | `b48f1233d77942e5a881585a730204ca1dca6237043fa9c61f3bb5dc47c07c5d` |
| `apps/web/src/server/cms-taxonomy-platform-read-terms.test.ts` | 189 | `6044421f120e9a5bdc11094faa2009f00c3732d8635f71b822901abe178f416a` |
| `apps/web/src/server/cms-taxonomy-platform-read-versions.test.ts` | 215 | `57004d66b0dc21fb47469253f12f1f1e3e41c03525aea2dce9ff0296448afcd2` |
| `apps/web/src/server/cms-taxonomy-platform-read.ts` | 265 | `b89b9f0df16ef80fe98bdf234afe26ebcdd42547a06d2f685174268fa14ffbbf` |
| `apps/web/src/server/cms-taxonomy-platform-term-action-upstream.test.ts` | 247 | `a262eadb4ff6243e892d86dd632a445363b5237bd5ebc42bd140fd957067608a` |
| `apps/web/src/server/cms-taxonomy-platform-term-action.test.ts` | 244 | `6294880cdbd5fbe745a64179acd098f4d11a923514f21938f1c3c0329bbf797c` |
| `apps/web/src/server/cms-taxonomy-platform-term-action.ts` | 163 | `61633f1873925f40f2319bc1a8737f8edc5dc9f5db7ebf1c5df77b0511b2bd26` |
| `apps/web/src/server/cms-taxonomy-platform-write.test.ts` | 397 | `52396a4e122d94e1471f5e9039945cdcb6d4d9bf9c10508538153cf3c19dedb3` |
| `apps/web/src/server/cms-taxonomy-platform-write.ts` | 145 | `ef581d972973bb9eb5b15e1627cff187bc5dbb3ff04f83b742925616a57d8daa` |
| `apps/web/src/server/cms-taxonomy-platform.test-support.ts` | 284 | `00b6a7e6b8a16b4ca34b611b7e4698f72cf7711f7b4fb7e03bf650c57efb356d` |

Modified (shared files, minimal edits): `apps/web/src/components/step-up-required.inventory.test.ts` (10 `NO_STEP_UP_ROW` entries; prettier also re-wrapped one other lane's entry line), `apps/web/src/components/cms-governed-review/governed-review-mounts.test.ts` (vocabulary nav and panel mount guards), `apps/web/src/pages/app/cms-content-modeling/index.astro` (one nav link, "Vocabularies"), `apps/web/src/server/README.md`.

| Modified path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/step-up-required.inventory.test.ts` | 201 | `ef742e0d84283a6a6d10c2c3802a95e8a299f81c6fb9bbe94ce3463654598823` |
| `apps/web/src/components/cms-governed-review/governed-review-mounts.test.ts` | 196 | `5e0eb149b086da84827484cacc0f86d1fcda5daa20a04451215b2afcdf2b03f4` |
| `apps/web/src/pages/app/cms-content-modeling/index.astro` | 172 | `5f05519eb32b3e6b2a49aae433fa444e75c00216f8e1c7b90b0acd69a0c5713e` |
| `apps/web/src/server/README.md` | 246 | `d60b15e97e3b3b8295a8fd92a62f33aaec3e626d78e3ba5b6390b062205d15d1` |

## Runs
No DB runner used. All Vitest runs under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH.
- 11:32Z re-verify predecessor work: 21 files, 483 tests green (proxies, routes, designer, term form).
- Loader RED (module missing) then GREEN 31 tests; panel RED then GREEN 8 tests.
- 11:56Z full `vitest run apps/web`: 511 files, 6215 tests, all green (before the size splits).
- After splits: designer 11 files / 179 tests; server taxonomy tests 62 + 42 + 43 (identical counts before and after splitting read, errors and term-action tests).
- 12:05Z final: 71 files / 1002 tests green (taxonomy dirs, governed-review, step-up inventory, taxonomy server tests, API routes, all content-modeling pages, static closure). Prettier check clean; eslint `--max-warnings=0` clean on every lane file.
- `astro check`: 0 errors in lane files (1 error in `CmsGovernedActivationForm.pending.test.tsx:120`, not this lane, introduced by another lane after my first check which was 0 errors).
- Mutation battery (in-place, restored and SHA-verified each time, script in scratchpad `claude_s12_web_taxonomies/`): 36 mutants over the loader, panel and both pages; 35 killed, 1 equivalent (`versionsResponse.status === 401 || termsResponse.status === 401` without the terms half: a terms 401 reaches `failureOutcome` which redirects to the same sign-in path). Three initial survivors (review prop, dead-code term form mount, nil-probe sign-in path) led to a stronger mount test regex and a mounts-test run; all then killed.

## Test corrections
none. (Predecessor-written unused imports removed from `CmsTaxonomyTermForm.test.tsx`; no assertion changed. Test files over the 400-line cap were split with identical test counts and a shared `taxonomy-designer-form.test-support.tsx`.)

## Spec citations
FE03 :886, :887, :1068 (route, title `Vocabulary`, description `Govern a vocabulary and its terms.`), :1036-1050 (409 cursor restarts from the first page: 303 to the first page with the filter kept), :1046, :1179, :1736, :1749, :2668; BE03c CMS-03C-03/-16/-17, 216 (recent MFA), 1304 (403 token), 1312-1314.

## Open items / BOUNDARY
- DECISION (implementation, root may veto; corrected in fix pass 1, see below): `/taxonomies/new` must be a 303 for a missing session and a 403 gate for a missing `cms.taxonomy_curator` (FE03 :1068) but has no vocabulary id to read. The loader reads `cmsTaxonomyVersionsRead` once for a reserved lineage (`TAXONOMY_PROBE_ID`, `00000000-0000-4000-8000-000000000000`; the first pass used the nil id, which the SQL producer's `cms_valid_uuid` refuses as 400, review B1). BE00 order (`taxonomy-definition-shared.ts` `quota`, authority before the port) answers 401 / 403 before the lookup and 404 for an absent lineage, so 404 proves session and curator. No spec names a dedicated capability read; if root prefers one (review Option B, a `cmsTaxonomyContextRead`), change `loadNew` only. Costs one read from the versions-read budget of 60/min per user and 60/min per party (BE03c 166), shared with every `/:taxonomyId` view and in-page versions re-read; the terms read is 120/240.
- `CmsTaxonomyFieldEditor` (FE03 :888) out of scope per brief. CMS-03C-17 selector proxy exists; its browser consumer is that lane.
- `taxonomy-static-closure.test.ts` imports `staticPackages` from `cms-pattern-designer/static-closure.test-support.ts` (untracked, created by an earlier lane); both must be committed together.
- Browser (Playwright) E2E and screenshots not run (no hosted/staging services, lane rules).

## Requests to root
- Commit the governed-review lane's `CmsGovernedActivationForm.pending.test.tsx:120` type error fix (not mine) before the canonical `type-check`.
- Review the nil-lineage probe decision above.

## Fix pass 1

Status: GREEN (fix pass 1, 2026-10-15 12:57Z). Brief `briefs/web-taxonomies-f1.md`, review `review-web-taxonomies.md` (VERDICT BLOCK, SHA `7879d828...`). All eight findings fixed, each behavioural one RED first (the failing run seen, then the fix). Web only: no Worker, SQL, contracts, `components/cms-governed-review/` (apart from the one unused import the brief names), related-content or server-relay file touched.

### Findings

1. BLOCKER `/taxonomies/new` curator gate: DONE. `TAXONOMY_PROBE_ID` is now `00000000-0000-4000-8000-000000000000` with a comment citing FE03 :1068 / BE03c (no curator read without an id; BE00 checks session and capability before lookup). RED: the guard test reads the `cms_valid_uuid` regex from `supabase/migrations/20260902080000_content_schema_registry_authority.sql` (function body, `p_value ~ '...'`) and asserted the probe id matches: failed for the old nil id; the composed test with a producer-faithful stub (`curatorProducer`: grammar match gives 404, otherwise 400 INVALID_REQUEST) returned a notice, not a view. The literal pin (`expect(TAXONOMY_PROBE_ID).toBe('0000...')`) is deleted. The old `failure(404)` stub remains only for the response-shape tests; the classification tests now cover 400 and 500 (`it.each([400, 500])`, notice not view), 401, 403, 429, 503 and 200. Added: the id also satisfies `CmsLineageIdSchema` (the Web proxy and Worker contract). A Worker-level 404 test is a Worker file and was not touched (review Option A suggested it; root decides).
2. MAJOR "All terms": DONE. `termListQuery` treats `lifecycle=` (empty) as absent; a repeated empty lifecycle is still 400. RED: the new composed test `taxonomy-filter-roundtrip.test.tsx` mounts `CmsTaxonomyTermForm`, chooses each option, serializes the real form (`FormData` of the GET form, as a browser does) and runs the address through `loadTaxonomyPage`: "all terms" gave the 400 notice. Also loader tests for `?lifecycle=&cursor=...` (forwards only `?cursor=...`) and the 409 restart.
3. MAJOR test gap: DONE. `CmsTaxonomyTermForm.refusals.test.tsx` (12 tests): `refused` x4 (canonical_overlap with domain, copyable canonical id in `<code>` and no link, copy success and clipboard failure; without canonical id no copy control; taxonomy_not_active linking the governed review; canonical_source_unavailable; capability_missing), `conflict`, `uncertain`, 401 (sign-in link with `returnTo`), 429 with and without `Retry-After`, 503. `term-status-copy.test.ts` (24 tests) pins every `failureCopy` string exactly (all six domains, every rejected status) and every `failureHeading`. Mutation proof (scratch config, below): deleting the canonical-id render (`canonicalId !== undefined` forced false, and the id replaced), pointing the review link elsewhere, and 15 copy mutants are all killed.
4. Terms 409 without a cursor: DONE. Redirect only when `query.cursor !== null`; otherwise the failure notice (status 409). RED: `never redirects a 409 to its own address` for `''`, `?lifecycle=merged`, `?lifecycle=` returned `redirect`. The cursor cases still redirect (with and without the filter, and `?lifecycle=&cursor=x`).
5. Merge survivor picker: DONE, and extended to the parent picker (the same defect: a parent could only be chosen from the loaded page). `use-term-choices.ts` reads the vocabulary through `readTaxonomyTerms` (the same-origin terms proxy), first page unfiltered with `limit=50`, further pages by `cursor` through a named, native "Load more terms" button (keyboard operable; focus returns to the select when the last page loads); a stale cursor (409) restarts from the first page and says so; a failed read keeps what is loaded and offers "Try again". Nothing is read when the loaded page already holds the whole vocabulary (no filter, no cursor, no next page), so the existing tests' read counts are unchanged. `CmsTaxonomyTermChoice.tsx` wraps the select; `CmsTaxonomyTermFilter.tsx` was extracted so the form stays under 200 lines. 11 RED tests (`CmsTaxonomyTermForm.choices.test.tsx`) failed first for the missing feature; they cover the complete page (no read), a partial page, paging by cursor and merging into a term from the last page (request body asserted), merged and the term itself excluded, a repeated term listed once, 409 restart, failure and retry (first and later page), a cursor-reached page, a filtered page, the parent picker and a flat vocabulary (no read). The terms read budget is 120/min/user, 240/min/party; opening a picker over an incomplete page costs one read, each "Load more" one.
6. FE03 :1173 retry: DONE. No shared helper existed in `apps/web/src` (the content-schema registry and infrastructure surfaces each carry a private 250/750 copy keyed on a response header). New `apps/web/src/lib/safe-read-retry.ts` (`retryingSafeRead`, `SAFE_READ_RETRY_DELAYS_MS = [250, 750]`, README line in `lib/README.md`): retries a 502/503/504 only when the ApiError declares `details.retryable: true` (BE00 172; the taxonomy proxies send it), at most twice, then returns the last answer for the degraded state; a 429, other 4xx, 500, an undeclared 5xx and a network failure are not retried. Wired into `readTaxonomyTerms` and `readTaxonomyVersions`. Fake-timer tests: `lib/safe-read-retry.test.ts` (16) and `cms-taxonomy-pages/taxonomy-read-retry.test.ts` (10: 249 ms still one call, 250 ms second call, 750 ms third call, degraded after the second retry, no retry for 404/429/undeclared). RED first (the reads made one call). The pattern and template designers lack this retry too (not edited; reported). Spec note: BE03c 1314 states a 3-retry 15s/60s/300s policy for upstream 502/503/504; that is the server's, FE03 :1173 states the browser's 250/750; both stand, the Web proxy relays rather than retries.
7. Newest-50 bound: DONE. `TAXONOMY_VERSIONS_PAGE_MAX = 50` (BE03c 406) is exported and used by the verifier. The loader sets `vocabulary.versionsBounded` when a full 50 hold no `active` version; `useTermList` recomputes it after every refresh; the term form then says "No active version was found among the newest 50 versions of this vocabulary. Older versions are not searched, so its terms are listed read-only." (still read-only, still linking the review), else the plain sentence. README cites BE03c 406. Tests: loader (50 none active true, 49 false, active inside 50 false) and `CmsTaxonomyTermForm.active.test.tsx` (initial and after a refresh).
8. Minors: DONE. Quota corrected in this report (versions read 60/user and 60/party, BE03c 166; terms read 120/240) and in `cms-taxonomy-pages/README.md`, which now also states the probe's 404 correctly (verified curator = 404 for an absent lineage; SQL can also give 404 for a non-visible tenant, the CMS-03C-16 write still authorizes) and that a producer 400 is never a pass. Unused `React` import removed from `CmsGovernedTaxonomyPanel.test.tsx` (the one edit in `components/cms-governed-review/`, named by the brief; re-read just before). My new TSX tests do not import React either.

### Files

Created in fix pass 1:

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.new.test.ts` | 135 | `151dced4d17671d40dfe4569c8d4daea744ffcf31de4338877d98521a3fe733c` |
| `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test-support.ts` | 41 | `7613d8da668b14fb19ae57a8fd928d586b098bda51ff70e46c8d528568b9a694` |
| `apps/web/src/components/cms-taxonomy-pages/taxonomy-filter-roundtrip.test.tsx` | 95 | `6ae55bc9f0a733472238c80ef3cc081acdced7ba079cbaa8b6b52bb59acb8dca` |
| `apps/web/src/components/cms-taxonomy-pages/taxonomy-read-retry.test.ts` | 118 | `abbf94750154b5b3df83d27704fa31cc31233b054a0b1873576b9db1268a78bd` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermChoice.tsx` | 66 | `115e8ffca50fa4e7af2dbf535a13cd2d3e3d70501fcaf02b7c1f232c4b5ffd8d` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermFilter.tsx` | 43 | `18d8d95f125173cdbb207e39b7bd6fb566adf5f862a853533a17faac6fa9ed7a` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.active.test.tsx` | 93 | `4dbea36b6deb1c39c3e09a67987054462da23e29eb1a315203df0c65c2a494d3` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.choices.test.tsx` | 304 | `4a0621f5fbd25602b8cabdeee47fd4750a6c14bfd8450dcbf926e162c15c29f4` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx` | 190 | `de6ff0f808c3d557a2cf0b7bd70325738127ae4316471d335fa67a2cd06eb3a9` |
| `apps/web/src/components/cms-taxonomy-terms/term-status-copy.test.ts` | 136 | `ac0896532f9290b4196c9c2953a7b93035e987ce2aae4a3f7297dc5b82f50e53` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-choices.ts` | 134 | `13d06543acd999e7e095ccb96b73f2db88f7bc2b522c965ceced8a7435f0bebf` |
| `apps/web/src/lib/safe-read-retry.ts` | 53 | `b39dfa0e2a355f0c14e4d41dc184ba2e0b421b4c24cd0529bdcf695a1fb9989d` |
| `apps/web/src/lib/safe-read-retry.test.ts` | 122 | `79023e525adaccb6831400eeb1e56b2546839be50326c06b08fc6ae5b8f623be` |

Modified in fix pass 1 (lines and SHA-256 now):

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.ts` | 296 | `8ced1b0b59677350dac67d24a0f0b399e6576854b50752bf823da148a8ea3f19` |
| `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.test.ts` | 325 | `3f05a0fd9cfacf9d84057b4c704717aa7284fc5cc83bfdfda452dc2f70dc1bbc` |
| `apps/web/src/components/cms-taxonomy-pages/README.md` | 60 | `4bf5d65936f65c2bed0ba1577bc8aa0527c2f3089049c0b54367014b07245448` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` | 193 | `27d05f313efe84e51bac062cd0af02496140c6d75976896e72f108690cb0987b` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx` | 185 | `7cafff541092ceabdf41ee51a411b22036cd2d07199dca0b52d1114b1e61af1f` |
| `apps/web/src/components/cms-taxonomy-terms/README.md` | 61 | `1033602c06763aa9cb0e604e39b3bfa93afc0153439d2a8a6edc57c5337bcb9b` |
| `apps/web/src/components/cms-taxonomy-terms/taxonomy-terms-read.ts` | 225 | `94ad396d9d8fc6ff9b3399fbc447a8e62df4234ba6fe06b6859ef01e028f7d22` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-list.ts` | 118 | `096e88e504841247644cb82bf367617ae31556186e5697f9cb53b9f8532daa88` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.ts` | 230 | `baa578bf399097c83541fb1fe8001b18c2d21b3f444c26be226817dc63b0a738` |
| `apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.test.tsx` | 150 | `43d8588bd21c1ffaf0c982b37ceda319ae77169766da6312548788e67d7f1d26` |
| `apps/web/src/lib/README.md` | 78 | `480421f1b803960737a5240c9c07b08aa8127cfe3272c769d962d82cfe0be27f` |

`load-taxonomy-page.test.ts` was split (474 lines was over the 400 cap) into `.test.ts` (33 tests), `.new.test.ts` (11) and `.test-support.ts`: 44 tests before and after.

### Runs

No DB runner used. Vitest under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH, from the worktree.
- RED runs seen before each fix (right reason each time): probe grammar guard and composed `/new` (2 failed: nil id fails `cms_valid_uuid`); empty lifecycle composed test (1 failed: 400 notice); loader 409 and bound tests (6 failed); picker tests (9 failed: no "Load more terms"); active-bound tests (2 failed); retry reads (4 failed: one call) and `safe-read-retry` (module missing). The refusal and copy tests characterize existing behaviour (green at once); their strength is shown by mutation.
- Mutation battery (scratch config `<scratchpad>/claude_s12_web_taxonomies_f1/vitest.mut.config.ts` serves one mutated source file from the scratchpad through a Vite `load` hook; the worktree is never modified; script `mutate.py`): loader 8 (7 killed, 1 equivalent: replacing the probe id with another valid-grammar id), status/copy 16 (all killed after tightening the copy table to exact strings: the first copy run left `Nothing was saved.`, the conflict refresh sentence and the idempotency sentence unkilled), picker hook 14 (all killed after adding the cursor-reached and repeated-term tests; two invalid mutants that did not parse were redone), choice component 3, TermForm 4 (the `list.cursor === null` clause survived until a test was added), retry helper 6, read wiring 2 (removing `retryingSafeRead` from either read). Survivors fixed with tests, the equivalent one noted.
- 12:55Z focused: 87 files, 1243 tests green (taxonomy dirs, governed-review, step-up inventory, server taxonomy, API routes, content-modeling pages, `lib`, island static closure).
- Full `vitest run apps/web` (started 12:41Z, before the loader test split; the split re-run in the focused set above): 539 files, 6602 tests, 6600 passed, 2 failed, both in `components/cms-related-content/` (`related-candidates.test.ts` "refuses more than 50 items", `related-content-submit.test.ts` "unknown outcome for a non-JSON body"): the related-content lane's RED tests, not this lane.
- `astro check` (apps/web, 12:51Z): 1 error, `components/cms-related-content/related-content-page-reads.test.ts:25` (not this lane); 0 errors and 0 hints in lane files.
- eslint `--max-warnings=0` and prettier `--check` clean on all 107 lane files.
- Zero zod in the islands: `taxonomy-static-closure.test.ts` green with the new `use-term-choices.ts`, `CmsTaxonomyTermChoice.tsx`, `CmsTaxonomyTermFilter.tsx` and `lib/safe-read-retry.ts` in the import closure.

### Test corrections

One existing assertion was extended, none weakened: `load-taxonomy-page.test.ts` "serves the newest version as the edit preimage..." now also expects `versionsBounded: false` in `vocabulary` (a new member of the loader's view, fix 7). The literal pin of the probe id is deleted by the brief (fix 1). Help texts of the two pickers changed (they no longer say "on this page"); no test pinned them.

### Spec citations

FE03 :887 (term copy, merge, canonical overlap), :1068 (route gate, URL state), :1173 (250/750 retry); BE03c 166 (versions read 60/60), 167 and 407 (terms read 120/240, limit 1-50), 406 (at most 50 versions), 1314 (catalog), 216; BE00 172 (retryable).

### Open items / BOUNDARY

- Option B (a BE03c `cmsTaxonomyContextRead`, curator-gated, no id) remains an owner/root decision; `loadNew` is the only function to change.
- The probe 404 for a verified curator is proved against a producer-faithful stub and the SQL grammar, not against a real Worker/PostgREST composition (no hosted services here); a Worker-level test (review Option A) is Worker scope.
- The pattern and template designers lack the FE03 :1173 retry; `lib/safe-read-retry.ts` is ready for them.
- The picker pages 50 terms at a time with a button; a vocabulary of thousands needs many presses. A type-ahead search is not specified in FE03/BE03c, so none was invented.

### Requests to root

- Nothing blocks. The two failing `cms-related-content` tests and the `related-content-page-reads.test.ts:25` type error belong to the related-content lane.

## Fix pass 2

Status: GREEN (fix pass 2, 2026-10-15 13:45Z). Brief `briefs/web-taxonomies-f2.md`, re-review `review-web-taxonomies-f1.md` (VERDICT PARTIAL). Web only; nothing outside the lane's `cms-taxonomy-*` files, tests and READMEs was edited. `lib/safe-read-retry.ts` (Web polish A's file) was re-read, its behaviour untouched (SHA-256 now `9c8c7bf4...`).

### Findings

1. MAJOR focus drop on "Load more terms" / "Try again": DONE. Cause: `CmsTaxonomyTermChoice` unmounted the button while loading and swapped it for a different "Try again" element. Now ONE native `type=button` stays mounted while `more || retry`: `aria-disabled="true"` (not `disabled`) and an unchanged label while a page loads (a press while loading is ignored by the hook's one-read-at-a-time guard), and the same node turns into "Try again" after a failure (new hook field `retry`: true from a failed read until a read succeeds, so the label does not flip during the retry itself). Focus moves to the select only when the button leaves (last page loaded, also after a failed first read). RED first (`CmsTaxonomyTermForm.focus.test.tsx`, 4 of 4 focus tests failed for the right reason: no button while loading, a different node for "Try again"): 3+ pages with `document.activeElement` asserted after every page; failure then "Try again" (failed, loading, failed again, loading, success, last page); very first read failing then "Try again" to a middle page and (separate test) to the last page; the 409 restart in flight. FE03 :898 ("stable pending label ... focus returns to trigger").
2. MINOR chosen survivor vanishing after a 409 restart: DONE, two layers. (a) `useTermChoices` takes `chosenIds`; a restart from the first page keeps those previously read terms that are chosen, appended after the first page. (b) `useTermActionChoices` (new, extracted so `CmsTaxonomyTermAction.tsx` stays under 200 lines) clears a merge survivor that is no longer offered (a refresh found it merged away; reachable after a 409 version conflict) and sets `survivorLost`; the form says "The term you chose to merge into is no longer available. Choose a term again." (`role=status`), returns to the edit step, and `CmsTaxonomyTermAction` never renders the review for a merge without a resolved survivor, so the sentence "Merge X into Y" always matches the value sent. Choosing again or re-opening another form clears the note (`survivorLost` is form state, reset by `initialFields`). RED first: the restart test lost the option (`['', TUBA]` instead of `['', TUBA, FLUTE]`), the lost-survivor test found no note. Tests: `CmsTaxonomyTermForm.focus.test.tsx` (restart keeps the choice and the confirm sentence and the request body match; lost survivor after conflict; note not carried to another term) and `CmsTaxonomyTermAction.test.tsx` (the review is never rendered for an unoffered survivor and onChange clears it).
   Not changed on purpose: a parent chosen but not offered is not cleared, because for `rename` the initial parent is the current one and clearing it would silently move the term to the top level. That latent mismatch (a current parent absent from the picker's pages) is outside this brief; noted below.
3. Nits: DONE. Loader comment and `cms-taxonomy-pages/README.md` now name `load-taxonomy-page.new.test.ts`. The 503, 429 (with and without a wait) refusal tests assert the typed term key and label are still in the form (`typed` in the helper). The retry delays are defined once: `taxonomy-read-retry.test.ts` derives its 249/250/749/750 steps from the imported `SAFE_READ_RETRY_DELAYS_MS`, the read modules' doc comments and the README refer to the constant instead of repeating 250/750 (`lib/safe-read-retry.test.ts` remains the one place the values are pinned; the `job-polling.ts` duplicate is another surface's and not touched).

### Files

Created in fix pass 2:

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.focus.test.tsx` | 313 | `330ffe21cd30b08a653723dc73133211035e5bc6d22558b9ddcba37ccaf3c947` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.test.tsx` | 69 | `83f01f7b705b32de28b5ac6323d5f1f121411202800ebd7c7d5b8123bdc9aa23` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-action-choices.ts` | 75 | `146c0d1d65ce566fdb5bcc7e510c8abc67d58baa2fde720c66a3302255261bd3` |

Modified in fix pass 2:

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-taxonomy-terms/term-form.test-support.ts` | 160 | `ef2121ba9468bc0ed3f95e3f5ba3d650fc4dcf1f22f532fff6cedad4ce633942` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-choices.ts` | 161 | `0c3a1137055a742ae4ae2480224bfa4e41f718e60657be2f90582bd18d8e5be3` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-form.ts` | 263 | `afd38b1e9bf8800688d465b4844e7444d50f2730eadaa66f46c5abe35f03246d` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermChoice.tsx` | 68 | `a4e79f30cdd3d344a5a9b690d899f4671bb98f1d4fc525c70afa11b607edc76b` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` | 197 | `f6df587f5a59737a2d21ca9e5efebbadcc63812649a7d974fd3005bf059b1eb1` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx` | 198 | `58844a0e0b5ef59274586680c6ead4b339a548929e06ceb1689c7365d7d617f5` |
| `apps/web/src/components/cms-taxonomy-terms/README.md` | 65 | `71600bf118dd28dc2fc0b5d3722d69ae2d06639d49ba471b9236537e17729a2e` |
| `apps/web/src/components/cms-taxonomy-terms/taxonomy-terms-read.ts` | 225 | `8ee876343a0ae2a3031b1189866677a9a8e60c2016eda0c2afa127ee1f5f6e5d` |
| `apps/web/src/components/cms-taxonomy-pages/README.md` | 60 | `003c425aecd56a2daaf9ec7369928da09f3777f03362dfb10e2b3982d1f662aa` |
| `apps/web/src/components/cms-taxonomy-pages/load-taxonomy-page.ts` | 296 | `32c94ac2c96c4e1649cdf15112ebb22b9f472f493f830500131757aa419df0c0` |
| `apps/web/src/components/cms-taxonomy-pages/taxonomy-read-retry.test.ts` | 122 | `6d57ada654bd211e2d23c3fe90b393446a25419fb2eeefc867bac5c388f3d65f` |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.ts` | 230 | `955d15725de7b90d14026f43402b947af8f8580fa641dc1c8e56f9529976ae01` |

### Runs

No DB runner used. Vitest under `flock -s /tmp/wejammin-quiet.lock`, pinned PATH, from the worktree.
- RED (13:12Z): `CmsTaxonomyTermForm.focus.test.tsx` 6 failed / 6, each for the right reason (see findings 1, 2). GREEN after the fix: 154 tests across `cms-taxonomy-terms` at that point.
- Mutation battery (scratch config and script in `<scratchpad>/claude_s12_web_taxonomies_f2/`; the worktree is never modified). Note: my first runs passed the test list as one zsh-unsplit word, so every mutant "died" on "no test files"; discarded, redone under bash (`run1.sh`..`run4.sh`). Real results: Choice component 6, 5 killed at once and one (`hadButton = more`) survived until the "Try again brings the last page" test was added, then killed; `use-term-choices` 7 killed (busy guard, both `setRetry`, the `retry` field, retention filter, `chosen` ref, 409 branch); Action/hook 13: all killed after adding `CmsTaxonomyTermAction.test.tsx`, the unoffered-survivor sequence test and the other-term test (earlier survivors: review guard, stale note, `step: 'edit'`, `survivorLost` reset); form-closing mutant for the refusal tests killed. Survivors remaining: dropping `action === 'merge'` from `lost` (equivalent: `survivorId` is only ever set in a merge form) and an earlier `onClick` gate (equivalent: the hook's `busy` guard, whose removal is killed).
- 13:25Z full `vitest run apps/web` (started 13:25:48Z, finished 13:37:16Z): 556 files, 6805 tests, all passed. This was before extracting `use-term-action-choices.ts` (a pure move of the Action's choice logic) and prettier; after it, final code: 13:43Z focused (`cms-taxonomy-terms`, `-pages`, `-designer`, `cms-governed-review`, `lib`) 66 files, 948 tests passed (includes the island static closure and `lib/safe-read-retry`).
- `astro check` (apps/web, 13:42Z, final code): 0 errors, 0 warnings, 178 hints (none in `cms-taxonomy-*`). An intermediate run at 13:41Z caught a real type error from the extraction (`PARENT_HELP[action]` lost its narrowing when `hasParent` came out of a hook); fixed by narrowing at the use site.
- eslint `--max-warnings=0` clean and prettier `--check` clean on all 81 `cms-taxonomy-*` files (13:44Z, final code). One lint error was fixed on the way: `react-hooks/set-state-in-effect` on a `useState` for the note; the note is now form state set through `onChange`.

### Test corrections

none. The 503 and 429 tests gained assertions (nothing weakened); `taxonomy-read-retry.test.ts` now computes its timings from the exported constant (same values 250/750, same assertions).

### Spec citations

FE03 :898 (`<ActionBar>`: stable pending label, focus returns to trigger), :887 (merge consequence, "Merge X into Y"), :1173 (retry 250/750), :28 (WCAG 2.2 AA baseline); WCAG 2.4.3 Focus Order.

### Open items / BOUNDARY

- A `rename` whose current parent is on none of the pages the picker has read (current parent not in the unfiltered first 50 and the page lists a different slice) shows "No parent" in the select while the form still holds the parent id. Pre-existing, not part of the re-review, and clearing it would move the term; a fix needs a product choice (read the parent by id, or show it as a read-only option). Not changed.
- `SAFE_READ_RETRY_DELAYS_MS` is still also exported by `infrastructure/jobs/job-polling.ts:19` (reviewer nit; other surface).

### Requests to root

- Nothing blocks. `astro check` is at 0 errors on the current worktree.

## Fix pass 3

Status: GREEN (17:02Z, after resuming from a usage-limit stop at ~14:20Z). Lane `claude_s12_web_taxonomies_f3`, brief `briefs/web-taxonomies-f3.md`, re-review `review-web-taxonomies-f2.md` (PARTIAL: F1 major held parent, F2 merged survivor with an incomplete page, F3 focus only when it fell to body, F4 confirm props). Plan: RED tests first (held option, merged-from-either-source with a next page, focus kept on another field, type-level merge-needs-survivor), then fixes in `CmsTaxonomyTermFields.tsx`, `CmsTaxonomyTermChoice.tsx`, `use-term-choices.ts`, `use-term-action-choices.ts`, `CmsTaxonomyTermConfirm.tsx`, `CmsTaxonomyTermAction.tsx`. No DB runner.

### Resume checkpoint (16:32Z, successor lane after a usage-limit stop)

The first lane stopped at about 14:20Z after writing code without recording it. Recovered from file mtimes (mtimes are EDT, so 09:58 EDT = 13:58Z) and the f3 scratch dir. Code it wrote after 13:58Z (all in `apps/web/src/components/cms-taxonomy-terms/`): `term-names.ts` (new `HeldChoice`), `term-review.tsx` (new, review step extracted), `CmsTaxonomyTermFields.tsx` (held option in `TermSelect`), `use-term-choices.ts` (`eligibleTerms`: merged from either source), `use-term-action-choices.ts` (`heldParent`, `HELD_PARENT_LABEL`), `CmsTaxonomyTermChoice.tsx` (focus only when it fell to body), `CmsTaxonomyTermConfirm.tsx` (discriminated-union props), `CmsTaxonomyTermAction.tsx`, README, and tests `CmsTaxonomyTermForm.parent.test.tsx` (new, 8), `CmsTaxonomyTermConfirm.test.tsx` (new), `CmsTaxonomyTermForm.focus.test.tsx`, `CmsTaxonomyTermForm.choices.test.tsx`, `term-form.test-support.ts`.

RED evidence recorded by the first lane: `<scratchpad>/claude_s12_web_taxonomies_f3/red1.log` (10:01:56 EDT = 14:01Z, before the fixes): 5 failed of 171 (focus x2: focus jumped to the select from the label input; merged-away survivor still offered with an incomplete page; parent x3: held parent absent, `select.value === ''`, option order). F4 is a type-level change (no runtime RED); its test is a `@ts-expect-error`, enforced by `astro check`. GREEN: `green2.log` 14 files 172 tests. Its mutation batch (`mut1.log`, `mut2.log`) was only partly analysed (survivors listed below); this lane finishes it.

### Findings

1. MAJOR held parent on `rename`: DONE. `use-term-action-choices.ts` computes `heldParent` (a rename's current parent when no offered term is it): labelled "Current parent (not among the terms loaded yet)" while no read lists it; once a page lists the term the named option replaces it (`strings (Strings)`), and a listed-but-merged parent is held under its own name ("strings (Strings) (current parent, merged)", named from the picker's read or the page). `TermSelect` renders the held option (`HeldChoice` in `term-names.ts`); it stays on offer after another parent is chosen so the choice can be undone. No new read (BE03c 407 has no by-id read). RED (`red1.log`, 14:01Z): `CmsTaxonomyTermForm.parent.test.tsx` 3 failed (`select.value === ''`; held option absent; option order). Tests (8 then 9): one selected option labelled as held; unchanged submit sends `parentId`; choosing "No parent" sends `parentId: null`; held option stays after choosing another parent and the old one can be re-chosen; replaced by the named option after "Load more terms", still selected; merged parent from the page or from the picker read; no held option when the page lists the parent, for a top-level term, or on create.
2. MINOR merged survivor with an incomplete page: DONE. `eligibleTerms` excludes an id that either source (picker read or page) reports as `merged` (BE03c 1396). RED: `also clears a survivor merged away when the picker holds an older read of an incomplete list` (`nextCursor: 'page.2'`) offered `organ` still. The survivor is cleared with the existing note and the review is guarded.
3. MINOR focus: DONE. `CmsTaxonomyTermChoice` moves focus to the select only when `document.activeElement === document.body` (focus fell with the button). RED: `leaves focus where the person moved it while the last page was loading` (label input to select). The positive case stays tested (`moves focus to the choice when the focused button leaves and focus fell to the page`) and a component-level `CmsTaxonomyTermChoice.test.tsx`.
4. NIT confirm props: DONE. `CmsTaxonomyTermConfirm` props are a discriminated union (`deprecate` without a survivor; `merge` requires a `TermFacts` survivor), so a merge cannot render the deprecate sentence. `term-review.tsx` (new) chooses the review and returns null for a merge without an offered survivor. RED (type level, a `@ts-expect-error` test that `astro check` enforces): scratch `f4/old.ts` with the pre-fix props (survivor optional) gives TS2578 "Unused '@ts-expect-error' directive" (exit 2); `f4/new.ts` with the union passes (exit 0).

### Files (fix pass 3; all under `apps/web/src/components/cms-taxonomy-terms/`, listed by full path)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-taxonomy-terms/term-names.ts` | 31 | `a431328755c488ac6c27a16b4b25493d6cf74db783eedf7359a8266a074c41e0` |
| `apps/web/src/components/cms-taxonomy-terms/term-review.tsx` | 52 | `03b890a1f47de33151f050a0bbeaeec5d83be0af09e0d952044a12b85baddbff` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermFields.tsx` | 98 | `439f59ea378f6c43c5daeb92d73f3384f3ac76a678f52ed154754fd111532754` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-choices.ts` | 168 | `de096a5873dc0454b861bf8ba0e2c6ae987cb22672b3a94fa4860906ba1cf951` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-action-choices.ts` | 99 | `c0b1df2f640d4f69f217cbc26ecd1d8ace8469005eb2523d97674d9b845e5b1e` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermChoice.tsx` | 74 | `67ed0ca949accc2c6d79deecdb98eb83bdf89a8a869347e080244f8cec535f73` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermConfirm.tsx` | 65 | `b0a39a36d55fb487017d58256c86531131e04239a8a470c7cdaeed8d74bc3c07` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` | 189 | `3311393798d506c240e42776321adbad1787dad2e8e029dfeec15d16a21f1646` |
| `apps/web/src/components/cms-taxonomy-terms/README.md` | 71 | `9446fe1a3d9a7ce9312519496b696a4077ad82024799d25f78f01089706ef5c7` |
| `apps/web/src/components/cms-taxonomy-terms/term-form.test-support.ts` | 185 | `bf6345a28ba78cb06f410632bf6b075f57f6aa86bfbc41e6e9a34cf264438f82` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.parent.test.tsx` | 203 | `fc949b87c5736886d642cf22c9895b58bc5b7f5e1233ce018298ac7017254c93` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.focus.test.tsx` | 389 | `c4176c7a213cfb75859e7f7d2fdc6743a4eb522aa05f2dda7d151b680932f1bb` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.choices.test.tsx` | 325 | `74964a8fd66b707d0867213cc0cece37d11bece6895042a7caa9bcd7f4064765` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermConfirm.test.tsx` | 51 | `5690c1d88532c8047c7e24d3dedb4444edda499df0afa31bf957e1a86b9529e1` |
| `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermChoice.test.tsx` | 66 | `573dcbf608a43dc41d382c9397831838c15e3efae19821f8cb658b9c9a1fb562` |
| `apps/web/src/components/cms-taxonomy-terms/term-review.test.tsx` | 78 | `867eca609ecf44824b316ab069b317737f3ead22bf4c5812ad77930686135322` |
| `apps/web/src/components/cms-taxonomy-terms/use-term-action-choices.test.tsx` | 117 | `0cf2b45d3d61877b5430f5cfeaccf359cf468164e035d9028d4dc228f470e9a1` |

Created in this pass: `term-review.tsx`, `CmsTaxonomyTermForm.parent.test.tsx`, `CmsTaxonomyTermConfirm.test.tsx`, `CmsTaxonomyTermChoice.test.tsx`, `term-review.test.tsx`, `use-term-action-choices.test.tsx`. Others are edits (`term-names.ts` gained `HeldChoice`). No file outside `cms-taxonomy-*` and this report was touched.

### Runs

- RED 14:01Z (first lane, recorded in `red1.log`): 5 failed of 171 (focus 1, survivor 1, parent 3). F4 RED at type level (above).
- GREEN: `cms-taxonomy-terms` dir, 17 files, 196 tests passed (16:45Z, after the extra tests below).
- Mutation battery (scratch Vite `load` hook, `mutate.py`; the worktree is never modified; batches under /bin/bash; each mutant runs the 10 test files of the picker/confirm/action/form flows; logs `mut1.log`..`mut5.log`, scripts `run1.sh`..`run5.sh` in `<scratchpad>/claude_s12_web_taxonomies_f3/`): final code, 31 mutants over Fields (3), Choice (5), `use-term-choices` (6), `use-term-action-choices` (9), Action (1), `term-review` (4), Confirm (3): all killed. Survivors on the way, each fixed with a test and re-killed: Choice `hadButton.current && !paging` → `!paging` (new `CmsTaxonomyTermChoice.test.tsx`: no focus taken without a paging button; focus taken when the button leaves; focus left on another field); `term-review` `action === 'deprecate'` → `!== 'merge'` (new `term-review.test.tsx`); `heldParent` without the `hasParent` guard (hook test: no held parent for merge/deprecate/alias, flat or top-level); dropping `loader.terms` from the name lookup (new parent test: a merged parent named by the picker read); `kept` chosen-from-page filter → `[]` (new focus test: a survivor chosen from the page while the picker read, which does not list it, is in flight stays); `lost` without `action === 'merge'` (hook test: a stale survivor id on another action is not "lost"); Confirm heading strings (heading asserted for both actions). The earlier lane's survivors in the older Choice (`active === null` in a version later simplified) no longer exist in the code.
- 16:48Z `eslint --max-warnings=0` clean and `prettier --check` clean on the 87 `cms-taxonomy-*` files under `components/` (script `lint.sh`).
- 16:49-16:50Z `astro check` (apps/web): 0 errors, 0 warnings, 182 hints (none in `cms-taxonomy-*`).
- Full `vitest run apps/web` (16:49:59Z-17:02:25Z, quiet lock): 575 files, 6995 tests, 6991 passed, 4 failed. All 4 are in `apps/web/src/styles/cms-danger-action.test.ts` (untracked, another lane's, written 12:53:57 EDT): `ReferenceError: document is not defined`, a missing `// @vitest-environment jsdom` pragma; nothing in this lane's files. No other file failed; the taxonomy, governed-review, lib and island static closure suites pass.

### Test corrections

none (no existing assertion changed or weakened; the only edits to existing tests are added tests and, in `CmsTaxonomyTermForm.focus.test.tsx`, the three new cases).

### Spec citations

FE03 :28 (WCAG 2.2 AA baseline; WCAG 4.1.2 the select exposes the held value), :887 (merge consequence and "Merge X into Y"; the sentence matches the id sent), :898 (focus returns, stable pending label), WCAG 2.4.3 Focus Order; BE03c 407 (terms read has no by-id read, so no read is added), 1396 (`merged` is terminal), 20261014120400 term-action apply (rename applies `parentId`, so "No parent" must reach the request).

### Open items / BOUNDARY

- The held parent label for an unloaded parent is generic ("Current parent (not among the terms loaded yet)"): the term's name is unknown without a by-id read, which BE03c 407 does not offer. A by-id terms read would need a Worker/contract change (root decision).
- The failing `styles/cms-danger-action.test.ts` needs `// @vitest-environment jsdom` (its owner).
- `use-term-form.ts` is 263 lines (utility limit 300; it is a hook with the form and submit state), unchanged in size by this pass.

### Requests to root

- Nothing blocks this lane. Tell the owner of `apps/web/src/styles/cms-danger-action.test.ts` about the missing jsdom pragma before the canonical full run.
