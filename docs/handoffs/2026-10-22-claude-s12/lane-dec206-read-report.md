# Lane report: claude_s12_dec206_read (DEC-206 protected composition-instance list read, full stack)

## Status
GREEN (2026-10-22, HEAD b16edb54a7a1b698ed8ca15b6085046d4270626e). All five layers done. pgTAP  246/246 (run 4); contracts, Worker and Web suites green; the only red items elsewhere are listed under Open items and are not caused by this lane. Acceptance criteria are NOT ticked (root owns tracking); affected criteria are listed under Requests to root.

## Scope
Operation `cmsCompositionInstancesRead` (`GET /api/v1/cms/entries/{entryId}/compositions` -> `CompositionInstancePage { revisionId | null, items: CompositionInstanceResource[] <=100, nextCursor | null }`), authorized as CMS-03C-02 (edit authority on the entry; 404 hidden/absent, 403 visible without edit). Brief `briefs/dec206-read.md`; spec rows listed under Spec citations.

## Design decisions (implementation tier)
1. Ordering: the read orders the newest-per-path heads (`cms_revision_effective_composition`, DEC-193) by exactly the render plan's composition key (template slot ordinal, 0 without a template and 100000 for an undeclared slot; `position`; `path` bytewise; `id`). It does NOT call `cms_revision_render_plan` per page: that function also expands every instance's pattern snapshot and the field values (heavy for a Tier-1 p95 <750 ms read, and it can fail for an unresolvable pin). The expression is the plan's own and the pgTAP suite proves equality with the plan's block order (`s12ci_plan_paths`) for an untemplated entry, a two-slot templated entry with an undeclared slot, and the head/state cases. Position is unique per path across versions, so (rank, position, path) is a total order over heads and `id` never breaks a tie.
2. Cursor: base64(JCS({h, i})); h = SHA-256 of JCS({entryId, revisionId}); i = id of the last row answered. Unsigned on purpose: BE03c says a cursor not issued for the entry and draft revision is 400, while the DEC-140 signed cursors answer 409 and exist to hide concealed candidates (this read has none). A forged cursor can only reposition within the caller's authorized result set. The cursor is positional (rank/position/path of row i, which is stable across all versions of a path), so a newer version of the last returned path neither repeats nor skips a row. Binding is judged AFTER authority (a stranger gets 403/404, never a cursor oracle); structural faults are 400 before any concealment (BE00).
3. Entry lifecycle is not constrained (a read has no lifecycle answer); the revision is `cms_content_entries.current_draft_revision_id` whatever its derived state (no draft revision = empty page with null `revisionId`; a cursor with no revision is 400).
4. No entity tag: BE03c names none for this read (13/14 do). The Worker accepts the page without an ETag (new `NO_ETAG` marker in `pattern-update-response.ts`).
5. Rate class `cms-composition-instances-read` (300/600 per minute, 8,000 ms, Tier 1, no-store), operation id `cmsCompositionInstancesRead`.
6. Worker home: the existing pattern-update family (`CmsPatternUpdateDependencies`, route `registerCmsPatternUpdateRoutes`) already carries the BE00 flow, quota, preflight and the production RPC adapter; the read joins it (one new dependency member `readInstances`) so it is wired by the existing `cmsPatternUpdate` bundle with no change to `worker-types.ts`, `production-worker-runtime*.ts` or `worker-route-composition.ts`. This edits existing (untracked, earlier-lane) pattern-update files beyond the literal brief claim; see Requests to root.

## Files
Path, lines, SHA-256 (final bytes). NEW = created by this lane; the rest are additive, line-local edits of shared or earlier-lane files, each named here.

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `packages/contracts/src/cms-composition/composition-instances-read.ts` | 120 | d5a4560d88620d770e71779f80be61c5256b500f7e886a35410e13becd39716c |
| `packages/contracts/src/cms-composition/composition-instances-read.test.ts` | 205 | 8c2ca246845bf06c543ae2c835d2667dca81ec7712cd2f8e1529c7d481b6ec24 |
| `packages/contracts/src/cms-composition/index.ts` | 30 | fc7921c221b8f323ddbb1135408f033a31919b3c2cc2f3a3ca1310f9990d2d56 |
| `packages/contracts/src/cms-composition/error-catalog.ts` | 150 | a45ac3c4c2735a53d267d35e9d80c0e73759573031589cc99df42e6b95670fe0 |
| `packages/contracts/src/cms-composition/error-catalog.test.ts` | 183 | 9cb67fa970846866ceba7c607040c66a4d50afd152a416dc678e9c6dd1ff068c |
| `packages/contracts/src/cms-composition/refusals.ts` | 305 | ea7d404db0580831f46013cf6a7eaff611665e0be6af14e521542ffa9d665071 |
| `packages/contracts/src/cms-composition/refusals-operations.test.ts` | 152 | df4f24920e0b7ebf4240282dc17f46793e97f5c8f0e37ce2d520bb0facf003e4 |
| `packages/contracts/src/cms-composition/README.md` | 108 | ebc5415c4bb39dae066b0a3db56aeed2659b4e01e6d9882ae755bc4e9ee4686b |
| `packages/contracts/src/platform-registries.ts` | 2460 | b62cf06ec3afc33051f5cadca44b8a9e91dd508fa9197235142b7de994e6e56a |
| `packages/contracts/src/openapi.ts` | 619 | 10e460a2deab2418f72e09080a32913906de18c80778fed587a8b9e1131adb30 |
| `packages/contracts/src/registries.test.ts` | 407 | 8518a65f95d5cf041d92f5764c37d7a395005c8430505857019aa0a10aa1f30a |
| `packages/contracts/src/core-contracts.test.ts` | 351 | 6f29403f013e7a27ce63c88d3e81c25d974a8494209f75b3246c71a37b70b50d |
| `tests/contracts/phase-02-slice-12-composition-instances-openapi.test.ts` | 62 | ea8fbc7e3814bb9b970009e056b8109324874a96d44c8d8e5f349b8a1b1f0919 |
| `infra/openapi-definitions-cms-composition.mjs` | 283 | 106233c294f8b934dbda544a2ecd387363f5fe811d79032233a1c792a667a790 |
| `apps/worker/src/cms-composition/composition-instances-routes.ts` | 84 | 2ca00227971aba35646e2a511f62ef34f12c4a74a78dac88d762619a2a34a7ee |
| `apps/worker/src/cms-composition/composition-instances-query.ts` | 51 | 16ef904d8116a75b255297a3ddec5611a136382fe2a75a60a0a93697d1d798e5 |
| `apps/worker/src/cms-composition/composition-instances-answers.ts` | 21 | db41532d48b9dd68e71b7c837c98c7918832740334939a7e314e974cd49dfe63 |
| `apps/worker/src/cms-composition/composition-instances.test-support.ts` | 51 | a39eab8be5d4d298dc694d2ff82cbe5126e772f0224ab32b9d7eeea757036cea |
| `apps/worker/src/cms-composition/composition-instances-routes.test.ts` | 327 | c580153deaaca6f150f08fc653d8a503e5d24144b3e08479a398b5f667c9ddef |
| `apps/worker/src/cms-composition-production-pattern-update-instances.test.ts` | 190 | db7f2825861fdfcfc987920b622ccda14b52ef2d9c1e6c433ea0282cb25f7212 |
| `apps/worker/src/cms-composition/pattern-update-operations.ts` | 74 | b8ef904387f024da56749c16b39ec1f6a445641e958eee50e15a664c0a3dbf70 |
| `apps/worker/src/cms-composition/pattern-update-ports.ts` | 208 | 8ce03a8bf6f8bdc3d6de941253bb8147e273d10c1ee96f1b8e2c02380977342e |
| `apps/worker/src/cms-composition/pattern-update-read.ts` | 114 | 4f24b9e89aea686d1191f208143e458c1ad2c5a5c85f0bcbe4bbe8424932f736 |
| `apps/worker/src/cms-composition/pattern-update-response.ts` | 206 | ef88440f15858e70de7d2153bcc18ced58118438ce40d3cbb5982c42113ea217 |
| `apps/worker/src/cms-composition/pattern-update-routes.ts` | 154 | 7963a15cbb0ea498646f1823884908d6190a09ab63d1785b215bf3759a43eaf9 |
| `apps/worker/src/cms-composition/pattern-update-routes.test-support.ts` | 96 | 74d38be907eca24436271c0e81b9fa901ca6b5c81a1f8bed13a15a53df8c94f5 |
| `apps/worker/src/cms-composition/pattern-update-order.test.ts` | 164 | 0f9c7d266ae9ad51426bb45375fec49ceaad44614cd91cad19e71ccddfcac477 |
| `apps/worker/src/production-worker-runtime-pattern-update.test.ts` | 226 | 1ddb0241bcf1aed2bf1346af93f793aa9eeb51dc1017fbe75bf943ef9d11b072 |
| `apps/worker/src/cms-composition-production-pattern-update.ts` | 197 | 44faea47507e350abd4dff7d40f182b63c3fc064381e3b1e57da24f885471b59 |
| `apps/worker/src/cms-composition-production-pattern-update-failure.ts` | 128 | d8858d1acf18119b15d2a6c41d2ef9b13b7668c4a78e73a07358f3f47cadca74 |
| `apps/worker/src/cms-editorial-production-boundary-types.ts` | 106 | 1ea5e0ac7aab066311956b3e0b5eb026051e9f172d3363d20a0d5e2efc83c6bb |
| `apps/web/src/server/cms-composition-instances-list.ts` | 123 | 108a11ef8f9eb515e8cc9b6461e436d00826958e649c2aee8d2afaecc4150152 |
| `apps/web/src/server/cms-composition-instances-list.test.ts` | 210 | d2f246f5d7ad4ddf250811688c3e3e415c45d1a80afa1223860c8e1dd4eaff86 |
| `apps/web/src/server/cms-composition-instances-errors.ts` | 169 | f5f2f210fefd3b409c80513d4474dd25805f9ee6048767e4bd5fe3cf03f6f9d0 |
| `apps/web/src/server/cms-composition-instances.test-support.ts` | 189 | bcf26503a103d0a917e833e0212b58618c7a031523a0293f850b6968b2278381 |
| `apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.ts` | 13 | 678a3f9156e594e2e3e756be48d8aa8c3e795354871c7e715be08c12c7254438 |
| `apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.test.ts` | 53 | 2f9ebd6014efcf285e359148daf8090c364b4f4a60ba19ad787f6026bc713f34 |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx` | 288 | 0c44a378f103c1b4c58b1d4aebdd709ab9631046a550618865ce1eae90f948d2 |
| `apps/web/src/components/cms-composition-instances/load-composition-instances.ts` | 75 | e7b678aa8c454b1c3830d7446d9fa955050c4f71d74743c6d7d96c1b05bd3cad |
| `apps/web/src/components/cms-composition-instances/load-composition-page.ts` | 170 | 60195a38e9e3461c38278ebac724270c3902f714f65b8a51d95314f4cb24364a |
| `apps/web/src/components/cms-composition-instances/load-composition-page.test.ts` | 387 | 499106ca33f62f37779087c311f9f310c40b19cb4d78b63a01cdc74f15821ebb |
| `apps/web/src/components/cms-composition-instances/composition-page-reads.ts` | 94 | fc8183052fd714d640392f50c9e7faa317c9df2570ab309f3c6830ca179124a0 |
| `apps/web/src/components/cms-composition-instances/composition-rows.ts` | 82 | 5d829f8985799b690cbf1864c9ecf3d398a8e9a847ae963aab13a861b7f00a46 |
| `apps/web/src/components/cms-composition-instances/composition-rows.test.ts` | 160 | e022eac6170fba58e3518f186b9ad8cfd6b2f698b4f9cbb49141d029a9b337ca |
| `apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.tsx` | 120 | f1b7e365dc1b83237733b6c7a4f76006306a06eeb89e7368dd4bc0aede9e8f54 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.test.tsx` | 225 | 7d4364e09c8f89ee8907de16386d10c97d0062ba18e3ffd8aab0a23cbff4d013 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.tsx` | 87 | 7e3b8d06ce49100e36be9bf8ffdc8e4610674bea9f958517a46a0c04cff2e809 |
| `apps/web/src/components/cms-composition-instances/composition-copy.ts` | 88 | 8d6dd0c47072042d719546c4d6b94190aef12f0100bc0370185a2b579ef02ebc |
| `apps/web/src/components/cms-composition-instances/use-composition-session.ts` | 150 | 5bb63c65f5478cd6c7fb406fa27deae0bfd5212adf087998c042027c52dcec13 |
| `apps/web/src/components/cms-composition-instances/README.md` | 82 | 0360d5af8287373d6ff00c92226be4e55f4d009bbec5bf2f385dd58215f12994 |
| `supabase/migrations-wip/dec206/20261022050000_cms_list_composition_instances.sql` | 201 | 2f088d52d744110985a33c30350e27d3119e054bacd0bb02f0ebb3e26709c0e0 |
| `supabase/migrations-wip/dec206/20261022050010_cms_list_composition_instances_public.sql` | 43 | 88fb1a9c5e1ce31c03697c432255dfbf76165938858e444f581e9610bf305be7 |
| `supabase/tests/phase_02_slice_12_composition_instances_read.sql` | 36 | 8493b2ef4ddd508017770a7317915d769548092c0dbef3a92586819cb3e14683 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/000-helpers.sqlinc` | 127 | 066782d7a4722fbc91e478474530f988f01699e25b82d04ac4dbd9a25febb545 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/001-world.sqlinc` | 79 | 7d785db79a41720efd037a2598fdf76c196a89941139a39b65316f978347df46 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/002-shape-and-grants.sqlinc` | 37 | e98df8c2ad3c897e559414207e110d688d6181cb3c8ade18aada07fa67b7dce0 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/003-order-and-heads.sqlinc` | 72 | 84cf8ac241afd6e2732821ca8fa510df819e2103caa712900367acaf9f8e184c |
| `supabase/tests/phase_02_slice_12_composition_instances_read/004-paging.sqlinc` | 93 | 8e07870591860853796e391ec4d1752524e33f1f2b329bcc8e3c62558e7a6114 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/005-authority-and-grammar.sqlinc` | 46 | b081d2337d906472b94aa628b98e8f25f42c9263012716c494e1e1998e69f097 |
| `supabase/tests/phase_02_slice_12_composition_instances_read/README.md` | 27 | 99752da30ec4710d60caa516c53b1691493c6e80e6b38a22067402eec2a676d5 |
| `supabase/tests/phase_02_slice_09_r8_api_surface.sql` | 238 | f928aabdb0417765e04f545ae98ad8015aa3c3d00d84ceec7e641f5ade064e93 |
| `.memory/wiki/specs/fe/03-cms-content-modeling.md` | 2928 | 52416f727eb501b803827ab3ae296dccc32db87ab1aed4d4998ad5a66f064144 |
| `apps/worker/src/cms-composition/README.md` | 191 | 6ae84ba3db3c5cc0e26a067fdbbcb3e779faa837813e29e3e9eec55061c12ef3 |
| `docs/openapi/openapi.json` | 63060 | 65626a161354254b66e569aa832dc5eff3c708e987c7bd8d4c6a1fbcdd699c97 |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx` | 288 | 0c44a378f103c1b4c58b1d4aebdd709ab9631046a550618865ce1eae90f948d2 |
| `apps/web/src/pages/api/v1/cms/entries/[entryId]/README.md` | 43 | 03d930568df23d91a3a8130968d56b617781509082d49ce935cd3f168df0d90e |

Shared edits made (all additive): contracts `index.ts`, `error-catalog.ts`, `refusals.ts`, `platform-registries.ts` (between CMS-03C-14 and CMS-03C-15), `openapi.ts`, `README.md`, `registries.test.ts`, `error-catalog.test.ts`, `refusals-operations.test.ts`, `core-contracts.test.ts`, `infra/openapi-definitions-cms-composition.mjs`; Worker `pattern-update-{operations,ports,read,response,routes}.ts`, `cms-composition-production-pattern-update{,-failure}.ts`, `cms-editorial-production-boundary-types.ts`, `README.md`, test support, order and runtime tests (one-line `readInstances`); `supabase/tests/phase_02_slice_09_r8_api_surface.sql` (+1 classification row); Web `composition-rows`, `CmsCompositionInstanceList`, `CmsCompositionPage`, `composition-copy`, `use-composition-session`, `load-composition-page`, `composition-page-reads`, their tests and README; FE03. DELETED: `apps/web/src/components/cms-composition-instances/composition-instances-source.ts` (the session-only port). Contracts also gained `compositionInstancesPageHonours` (shared by the Worker and the proxy).

## Runs
All shell runs from the worktree with the pinned toolchain; pgTAP only through the staged ALT runner, lanes `pattern-updates,dec193,dec206`.

SQL (suite `supabase/tests/phase_02_slice_12_composition_instances_read.sql`):
- Run 1 (RED) 03:16Z, stamp `030654-3379539`, manifest `wip=54` (my WIP withheld so the RED is honest): 111 tests run, 73 ok, 38 not ok, first failing #62 (private function missing). Genuine missing feature; the world (#1-61) built through the real producers and passed. The file aborted at 004 line 46 (psql `:'cj'` unset because the page read failed: a RED consequence). TAP SHA-256 `4754d6f7d788479e48da7b40c97a188e3409c36bb362d4869f1b822f81dca2ba`.
- Run 2 03:19Z, stamp `031710-3435670`, `wip=56`: 176 run, 157 ok, 19 not ok, first failing #80. Harness defects only: expected member list in locale order not bytewise; the render-plan helper ran without the `app.cms_rpc` flag (forced RLS read nothing); `pg_exception_detail` is '' not NULL; a paren typo in the labelled revision-flip fixture aborted the file. TAP SHA-256 `49171ff90464f4c3ec31f5e69c99da18ebdd11efca7fed252c85640f59d241fe`.
- Run 3 03:45Z, stamp `032014-3456770`, `wip=56`: 181 run, 0 failed, then psql ERROR `DIRECT_CMS_TABLE_WRITE` at 004 line 92 (the fixture's flip-back UPDATE ran after a read that clears `app.cms_rpc`): harness. TAP SHA-256 `c8308e433e3b56fc4f4c30926da395db7862ed0b5353ca10b9a520893e9874bb`.
- Run 4 (GREEN) 03:46Z, stamp `034556-3577587`, `wip=56`: 246 tests, 246 ok, PASS ("All tests successful"). TAP `.lane-logs/alt-staged-pattern-updates+dec193+dec206-034556-3577587.tap` SHA-256 `3470fcaef617a7add70b5008854f755f846a1f834e23775ce6e1f085e1805a5d`.
- Run 5 (mutation, identical suite, three deliberate mutants of the migration at once, restored byte for byte afterwards and checked with cmp): order by path before position; cursor binding hash check disabled; authority check disabled. 30 of 246 failed, covering all three (ordering and paging tests #75-97, 103-105, 109, 173; `c-bad-hash` #133-134; `a-no-edit`, `a-revoked`, `g-noedit-foreign-cursor` #183-184, 199-200, 240-241). TAP SHA-256 `39f43c62b3fc7d50a8834a355210f742f431bd484017951bc96b8ed9b481b4f2`.
- Run 6-7 (regression, stamps `034846-3595007` and `035042-3606901`): `phase_02_slice_09_r8_api_surface.sql` needed `cms_list_composition_instances` classified (done, +1 row; Test corrections). With it my function is not among the remaining r8 findings; the three remaining r8 failures (#4, #5, #13) are other lanes' unpromoted functions (`cms_apply_pattern_update`, `cms_get_instance_update_diff` unclassified; `cms_get_locale_variant`, `cms_get_related_content` classified but not staged). `phase_02_slice_09_sec2_all_schema_definer_rls.sql` passes. `phase_02_slice_12_pattern_update_diff.sql` has 47 failing assertions of 527 with and WITHOUT my lane (baseline run 8, stamp from `run8-baseline`, lanes `pattern-updates,dec193`): pre-existing (the old CMS-03C-14 oracle versus the dec193 diff resource), not caused by dec206.

Contracts: `composition-instances-read.test.ts` 10/10; `tests/contracts/phase-02-slice-12-composition-instances-openapi.test.ts` 4/4 (RED observed first: 8 failing for the missing schemas/registry rows); full `packages/contracts` + `tests/contracts`: 413 files, 402 pass, 11 fail, 13 tests, all in slice 09/10/11 evidence/ledger/receipt guards (tracker bookkeeping the dirty tree breaks; none cites a dec206 file). OpenAPI: `node infra/generate-openapi.mjs --check` reported drift before generation (expected); regenerated `docs/openapi/openapi.json`: sha256 before `8ba13e765b43fa81869cfd1ddc7303acdb18700e5211bdb453d95f205eb0209c`, after `65626a161354254b66e569aa832dc5eff3c708e987c7bd8d4c6a1fbcdd699c97`; additions only (457 lines, 0 removed): the GET `cmsCompositionInstancesRead` operation (263 lines at 32279) and the components `CompositionInstancePage`, `CompositionInstancesReadApiRequest` (195 lines at 50698); `--check` exits 0 at the end of the lane.

Worker: RED observed (both new files failed before production code). 59 new tests (`composition-instances-routes.test.ts`, `cms-composition-production-pattern-update-instances.test.ts`); full `apps/worker`: 695 files, 12,313 tests pass, 1 file / 4 tests fail (`production-async-entrypoint-taxonomy-merge.test.ts`, async job delivery: another lane's area, unrelated); `tsc --noEmit` (apps/worker) clean.

Web: RED observed (loader, rows, list, route). Focused 63 files / 607 tests; full `apps/web`: 662 files, 7,976 of 7,977 tests pass, the one failure is `step-up-required.inventory.test.ts` (see Open items 2). `tsc --noEmit` (apps/web) and `astro check`: no error in this lane's files (2 errors remain, both in dec205's `cms-locale/load-locale-variant-page.read.test.ts` and `server/cms-composition-platform-locale-read.test.ts`). eslint `--max-warnings=0` and prettier clean on every lane file; component files <= 200 lines, test files <= 400, migration 201 lines (<300).

Combined final focused run (contracts cms-composition, worker cms-composition + production + runtime, web composition-instances + server + pages, the openapi test, registries): 238 files / 4,134 tests green.

Mutation checks (code mutated, focused suites must fail, original restored; script `<scratchpad>/claude_s12_dec206_read/mutate.py`): 21 mutants over query admission, answer binding, 409/422 folding, ETag, route registration, RPC name, cursor pass-through, proxy admission/relay, loader revision/cap/newest/cursor/403, rows ordering, list ordering, contract state and page binding: 20 killed on the first run; 1 survivor, W1 (the Worker query parser accepting a `limit` key) is an equivalent mutant: the strict transport schema `CompositionInstancesReadApiRequestSchema` still refuses it (defence in depth), so no test can distinguish it.

## Test corrections
No existing assertion was weakened or changed in meaning. Mechanical additions to existing tests so they keep compiling/counting with the new member:
- `apps/worker/src/cms-composition/pattern-update-order.test.ts`: `readInstances: vi.fn(),` added to the dependency literal.
- `apps/worker/src/production-worker-runtime-pattern-update.test.ts`: `readInstances: vi.fn(),` added to two dependency literals.
- `apps/worker/src/cms-composition/pattern-update-routes.test-support.ts`: `readInstances` spy (default answer `ciPage()`).
- Oracle changes caused by DEC-206 (cite: BE03c route registry row "in render order", FE03 887): `apps/web/.../CmsCompositionInstanceList.test.tsx` the list now shows rows as given (the old case fed unsorted rows and expected position order; its input is now the order the read answers and a new case proves no re-sort); `apps/web/.../composition-rows.test.ts` kept both `mergeRows` cases unchanged and added three; `apps/web/.../load-composition-page.test.ts` the BOUNDARY sentinel (`session_only`) is replaced by behavioural tests and every default `reads` now includes `instances`; `apps/web/src/pages/.../composition-route.test.tsx` the binding now answers the list path, the "three reads" title and path list became four reads, and a 403-from-the-list case was added.
- `supabase/tests/phase_02_slice_09_r8_api_surface.sql`: +1 classification row for `cms_list_composition_instances`.
- `error-catalog.test.ts` 23 -> 24 operations; `refusals-operations.test.ts` title 23 -> 24 plus marker/reasons rows; `registries.test.ts` order list; `core-contracts.test.ts` component names (all required by design when an operation is added).

## Spec citations
BE03c lines 75, 91 (epic and interaction map), 182 (route registry row), 409 (validation row), 1188-1196 (schemas), 1412 (error matrix), 1440 (catalog), 1643 (authority), 1869 (changelog); DEC-185 (position/order), DEC-193 (newest-per-path, pending_diff), DEC-195 and CMS-03C-13 precedents; tracker marker P2-S12-AC-269.

## Incident
While editing `composition-route.test.tsx` I wrote `open(p,'w').write(open(p).read())` in a script: the open for write truncated the file before the read, leaving it empty. The file is an untracked earlier-lane file (no git copy). I rewrote it from the full text I had read minutes earlier and verified the reconstruction byte for byte against the SHA-256 recorded in `lane-web-composition-report.md` (`b0c025509efbedf018a2a97b2c50b8a35dbcc2299358bc8fb57d59cbac227888`, 215 lines): identical, before any further edit. Lesson recorded in the lane method: read, then write.

## Open items / BOUNDARY
1. Not a BOUNDARY, a design note for root: the client cannot know a template slot ordinal (not a row member), so rows placed during a session follow the listed rows by position then path (exact for an untemplated entry); a reload shows the exact render order. The page never re-sorts server-ordered rows.
2. `apps/web/src/components/step-up-required.inventory.test.ts` fails today for files that belong to other lanes' claims or earlier lanes (`cms-composition-instances/composition-copy.ts`, `composition-transport.ts`, `server/cms-composition-instances-errors.ts`, `cms-locale/*`, two `cms-editorial-fields/*`): it needs exemption rows (reason NO_STEP_UP_ROW). Pre-existing relative to my edits (none of those mappers is new in this lane); shared root file.
3. Playwright coverage and a real Worker/PostgREST run of the new read are outside this lane (Vitest and pgTAP only).
4. Pre-existing reds not caused by this lane: slice 09/10/11 evidence guards in `tests/contracts`; `production-async-entrypoint-taxonomy-merge.test.ts`; 47 assertions of `phase_02_slice_12_pattern_update_diff.sql` (fail identically without dec206).
5. Design choices to ratify (BE03c silent): unsigned cursor (400 on every fault, per BE03c), no ETag, entry lifecycle unconstrained, a page cap of 20 pages (2,000 rows) in the loader.

## Requests to root
0. Add the exemption rows above to `step-up-required.inventory.test.ts`.
1. Ratify the Worker claim extension: the read joins the existing pattern-update family (files listed under Files / Worker (existing, edited)); alternative would have been a second dependency bundle wired through `worker-types.ts`, `production-worker-runtime.ts`, `production-worker-runtime-cms.ts` and `worker-route-composition.ts`.
2. Tracker mapping: I used marker P2-S12-AC-269 (composition page) in the new tests and no tracker edit. Criteria affected by DEC-206 (text unchanged): P2-S12-AC-045, AC-111, AC-117, AC-123, AC-269 (the web page and list), the CMS-03C-02 authority criteria for the new read, and new contract/Worker/SQL criteria for `cmsCompositionInstancesRead` if root wants them tracked. The BOUNDARY issue named in `lane-web-composition-report.md` ("BE03c: add cmsCompositionInstancesRead") is satisfied: the port and its sentinel are removed.
3. Promote `supabase/migrations-wip/dec206/` (two files, ts 20261022050000 and 050010) after `dec193` and `pattern-updates` (it depends on `cms_revision_effective_composition`, `pending_diff` and `cms_composition_instance_resource` from those) and rerun the suite plus the race/canonical gates.
4. Add the `FE03` acceptance bookkeeping for the new rows; add the three new Web server README bullets (`cms-composition-instances-list.ts`) to `apps/web/src/server/README.md` (shared; not edited here).
