# Lane claude_s12_nestable_read report

## Status

GREEN (follow-up of 2026-10-28 included, see `## Follow-ups`). `cmsPatternNestableRead` (`GET /api/v1/cms/patterns/nestable`, DEC-196 / DEC-232) is built end to end and the designer's nested-pattern picker replaces the BOUNDARY placeholder.
HEAD cd89d54c on `claude/phase2-slice12`; nothing staged or committed. Final SQL run: see `## V14 follow-ups` (earlier: 191/191, then 207/207). 169 new TypeScript tests pass; the full contracts + worker + web + tests/contracts run is green except the failures listed under Open items (all outside this lane's behavior).

Scratch and tar backups (taken before editing): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_nestable_read/` (`orig-contracts-195031.tar`, `orig-worker-195330.tar`, `orig-web-195942.tar`, `orig-tests-202547.tar`).

## Scope

1. SQL (WIP `supabase/migrations-wip/nestable-read/`): private keyset reader, signed-cursor wrapper, `platform_api.cms_list_pattern_nestable`.
2. Contracts: `PatternNestableQuerySchema` / `PatternNestableApiRequestSchema` (answers the existing `PatternSelectorPage`), platform registry row, error catalog and refusal allowlist, generated OpenAPI, registry-parity fixture (now nine supporting reads).
3. Worker: query admission, route, designer-capability admission (operations table now names each operation's capabilities), production adapter, failure mapping.
4. Web: server proxy `readCmsPatternNestable`, Astro route, zod-free browser read, `useNestablePatterns`, `CmsPatternNestedPicker`, `newPatternNode`, designer wiring, tests, READMEs.

## Behavior chosen (spec lines are BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` unless named)

- Route, authority, page shape, order and limits: Route Registry row 184, interaction map 92, field matrix 413, schema 1192-1198, paragraph 1528, authority row 1665, RPC inventory 1633. FE03 `CmsPatternVersionDesigner` row and criterion P2-S12-AC-105 clause "nested pattern nodes from `CmsPatternNestedPicker` over the designer-only `cmsPatternNestableRead` (DEC-196)".
- Lists only `active` versions of the caller's owner whose `compatibleTypeIds` contain EVERY requested type (case-insensitive, exactly the comparison CMS-03C-12 makes for `nested_pattern_not_active`, `20261014020400` lines 186-205); order `(patternKey ASC bytewise, patternVersion DESC)`; does NOT exclude the lineage being edited (row 1528).
- Designer only: `cms.template_designer` in the owner party; author/editor/reviewer/schema-designer alone is 403 `capability_missing`. BE00 order as the CMS-03C-13 reader: authenticate, acting party, strict validation (400 / 422), concealment (404), capability (403), types (404 for the whole request when any one type is hidden or absent), cursor binding.
- Cursor: Vault-signed, domain `cms-03c-nestable`, bound to route, actor, acting party, the SET of types (sorted, so request order is irrelevant) and page size; tamper / expiry / cross-context / another operation's cursor are all 400 INVALID_REQUEST (row 184 "tamper, expiry or cross-context reuse 400", row 413, BE00 00-infrastructure line 491). `pageVersion` = high-water update instant (UTC microseconds) of the owner's versions listing every requested type in any state ("1" when none), the ETag.
- Quota 300/600 per minute, 8,000 ms, Tier 1, no-store (row 184).

## Files

| Path | Lines | SHA-256 |
|------|-------|---------|
| `apps/web/src/components/cms-pattern-designer/CmsPatternNestedPicker.test.tsx` | 295 | 81174727f06fa93f3898439076776d0d03ced1da274cf30c03fc9dd4f9326e4e |
| `apps/web/src/components/cms-pattern-designer/CmsPatternNestedPicker.tsx` | 157 | c9e5a2b4cecb771451e574ed43627a67c0226d5e9014372946eaaaf09f920eb7 |
| `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.nested-picker.test.tsx` | 161 | cddcc3a72a63d5d7f7bb846149a32b3605fe8cfb64b852a43a20611f0fe5a496 |
| `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx` | 365 | b227cf98c9e5019573f33a93eb9a36527083cc247904a3561ba398d96e225791 |
| `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.tsx` | 198 | c6e1c34110b8685cd7761690f6467e3ed56d68b24dcb3f0cad7894e0c5713694 |
| `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.uncertain-boundaries.test.tsx` | 290 | b6f33e9232c8eaf4b75b874c666747b45dfaba772163d319a8bf8f543394ff48 |
| `apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts` | 239 | 19a6a59660ff29ea7ed2e384f6fbb75c9ebcf6b5cff6a1d17da909491e4c9bae |
| `apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts` | 238 | e44c6829549aec2d69d4193839f49a8a8c50117ae1d66a5ebe770ddecf8e19ca |
| `apps/web/src/components/cms-pattern-designer/pattern-latest-read.cancellation.test.ts` | 105 | fa762d53c996f989459061ad7ec6b185b0f1fdceb9918a59d6870729e1bd106b |
| `apps/web/src/components/cms-pattern-designer/pattern-nestable-read.test.ts` | 294 | 6bacce8f5c55fe743631b379097fe18e8e50fad2e82f7756e4ceed172b57bf90 |
| `apps/web/src/components/cms-pattern-designer/pattern-nestable-read.ts` | 246 | 7c5ee2398c4714dcc70f7600acb4025788317ebfd324cdf8b9122ea164db3543 |
| `apps/web/src/components/cms-pattern-designer/pattern-tree-nested.test.ts` | 74 | 97bcfe9319c45fc1df13f878a87ca9018724f2f904d7428596ca1065a17fe056 |
| `apps/web/src/components/cms-pattern-designer/pattern-tree-nested.ts` | 35 | 2fb0b0b72dc3b732d91b33fbbdf9310b39edd5bbb253301704a79ec99d24afdc |
| `apps/web/src/components/cms-pattern-designer/pattern-tree-rules.ts` | 271 | 1899a2922e6111bae008f4a5ab612a20922bc8b14890ba236ce4aa7d158b6c2b |
| `apps/web/src/components/cms-pattern-designer/pattern-tree-state.ts` | 277 | 6b34a9cbdb5529fcdd33c4bd11b6f66ac62026a634409ff94362812c65800f14 |
| `apps/web/src/components/cms-pattern-designer/README.md` | 97 | d09ce4803387acd234321ee8713ed801fc3c714e37b3a6e82628e6dd1fe08612 |
| `apps/web/src/components/cms-pattern-designer/use-nestable-patterns.ts` | 129 | cc872cd2f7eb651da30832181408734a9f17f615699ac444b1af494e67999e33 |
| `apps/web/src/components/cms-pattern-designer/use-pattern-tree-editor.ts` | 166 | ae5eb4d7d340c934f3f0139f2900c7f7def577fb7855be4b6701664a4120f1ea |
| `apps/web/src/components/step-up-required.inventory.test.ts` | 224 | 9db5c1e92917d7f694771d0b20324389dba244f420de6125167e8593bde5c19f |
| `apps/web/src/pages/api/v1/cms/patterns/nestable.test.ts` | 51 | bfcdf4099aa3f64e3900e3752573543712ec74dda6d01c9d65830a111a53b24c |
| `apps/web/src/pages/api/v1/cms/patterns/nestable.ts` | 13 | 8b838e49360c2bb30e3c03bff2464e5014932882d9847495682363f77384fcce |
| `apps/web/src/pages/api/v1/cms/patterns/[patternKey].ts` | 14 | 93503213baad29d5d4bc3bf51f5e7b36f9e7b64691507010623680cc69b59d7c |
| `apps/web/src/pages/api/v1/cms/patterns/patterns-routes.test.ts` | 90 | 5ee80964d544f0167a501287b2c641b460b47409d286b2273221a583790cfef4 |
| `apps/web/src/pages/api/v1/cms/patterns/README.md` | 38 | 036ccab562d5b66838b5c9a743aff4edd0497ae4631c3e9c0af39de7130819c9 |
| `apps/web/src/pages/api/v1/cms/README.md` | 65 | 2c5fc1d9ddd84d7f663561457f46ba8af84dd71f89f1ddbdf07571ea7032306e |
| `apps/web/src/pages/app/cms-content-modeling/patterns/[patternKey].astro` | 86 | a1a2ac0b1e23444a936d6eff3ba7ba0251f419ee8600091330306288ea54934e |
| `apps/web/src/pages/app/cms-content-modeling/patterns/README.md` | 37 | 406843f376872c03b92cd0d76288526968d200d5c2ff26b9522e67feda9fc7cd |
| `apps/web/src/server/cms-composition-instances-errors.ts` | 178 | 331c5ed693de2a76fd8423e4875e6d98c7f08f2bd3ece7ba6ca0cf5c6ea46161 |
| `apps/web/src/server/cms-composition-instances-selector.ts` | 174 | 3370d0dce7095308509cec2617c217bffabe93d31db491f34a9ca457d50e3830 |
| `apps/web/src/server/cms-pattern-nestable.test.ts` | 257 | 6f89a375267d394a4d4cd1d5fc304e083483a9b634b3b979f8d5d261ef3ad17f |
| `apps/web/src/server/cms-pattern-nestable.ts` | 165 | b8efbd65d2332453b607e8ee28bd13be31d27ed16f301a7b89888972bece25ef |
| `apps/web/src/server/cms-pattern-platform-latest.test.ts` | 202 | 50211a26300dc47840a424535c595e1ad359398a02b06c3517003992634738dd |
| `apps/web/src/server/cms-pattern-platform-write.test.ts` | 331 | 5c2314fe4a4d449ae6dff441b5365bf074a1a99af88628dee1a139b97cf57708 |
| `apps/web/src/server/README.md` | 266 | 9b4bb0b0006ae70fbc6fbdd914a4403b17ca44f6e2139a3a903a87ec47ee78ef |
| `apps/worker/src/cms-composition/pattern-definition-latest.test.ts` | 296 | 787a8e695edbb9f7c894d9e2d9db268a2969fe2dc3562056d2d5af9151b65d20 |
| `apps/worker/src/cms-composition/pattern-definition-write.test.ts` | 297 | db4571743c75788b27b05816c6471b456aeebab3bb906593726f980a7ba1ab79 |
| `apps/worker/src/cms-composition/pattern-nestable-query.test.ts` | 98 | 5d874ab681f27d81e22698681330e8ca26b42b70dcde00a36b5ecb5bca5dc0c2 |
| `apps/worker/src/cms-composition/pattern-nestable-query.ts` | 73 | 57ca8d6bed1158dc24254e0123ea593ff3d5e735693b0ef94f44dc00d8abe9d1 |
| `apps/worker/src/cms-composition/pattern-nestable-routes.test.ts` | 266 | 7834421059923209e3bcd62b19a404436c0b26ab2eb4afeb5230877d350e7235 |
| `apps/worker/src/cms-composition/pattern-nestable-routes.ts` | 64 | c93ebb130267e93b505a0d806d53b303f49afdd742646a93eb2d9ecb123830b0 |
| `apps/worker/src/cms-composition/pattern-update-answers.ts` | 122 | 726a1a04eb51a0eed164061c68bbeab778912c76ca8b5cfc4de88e62285d332a |
| `apps/worker/src/cms-composition/pattern-update-operations.ts` | 100 | 2b3d2e7ea7c1e848a0fa22f1a3055078c9b9fbc84b4636617c19ce4b0f0b8a4d |
| `apps/worker/src/cms-composition/pattern-update-order.test.ts` | 165 | cffc9e8b120e0dc79753d4dce68231e020ecd9445e422e05fb095319889b5a60 |
| `apps/worker/src/cms-composition/pattern-update-ports.ts` | 226 | a43ab58ed0c798e74c0f413ceccca5795cd9b402d897b897c13ad04d9c30316f |
| `apps/worker/src/cms-composition/pattern-update-read.ts` | 118 | b24562820e4e20a073f60d3ceb663a2ae1224a12ca9168bf8de43df3c778b381 |
| `apps/worker/src/cms-composition/pattern-update-registry.test.ts` | 136 | 7c54afd90c4c9be29d6589b135e1e4be7ba761ce0ecf3210e0aba40ba5c0470b |
| `apps/worker/src/cms-composition/pattern-update-routes.test-support.ts` | 101 | 57a35e2576ee24b5a5988ba6bf583c9cf5baa98271b0732fc2747dec63dca399 |
| `apps/worker/src/cms-composition/pattern-update-routes.ts` | 167 | 701351b3eda70f082ba2a2d352bd55b8c87185dd64cb659a5385c6ff1d22c40a |
| `apps/worker/src/cms-composition-production-pattern-nestable.test.ts` | 248 | 755b35db3203784fc665da4e20dd2a16e048697db22cea8543e879edeced63c7 |
| `apps/worker/src/cms-composition-production-pattern-update-failure.ts` | 149 | 64843cd02b69263fcca08f77016d738573db5c2790f852e9fd056b72b2572a48 |
| `apps/worker/src/cms-composition-production-pattern-update-rpc.ts` | 191 | 5b0ca695ec763222b24419c13ae42100f6dca3f101521607c213242cb5521ba2 |
| `apps/worker/src/cms-composition-production-pattern-update.ts` | 231 | 60976e32952026c1885d1568885e50223ca0ef43c11f6635a7a89c3623ff5a9a |
| `apps/worker/src/cms-composition/README.md` | 224 | 06bf3f05f96a85eabda00e783d3b8971e4b1c61e23b3c5454cb8dcea8a0556a5 |
| `apps/worker/src/cms-editorial-production-boundary-types.ts` | 107 | ac8aa1ec239099cdbd98bad719c0891e69a2a741a7fb05a3176d97bd6870c5bb |
| `apps/worker/src/production-worker-runtime-pattern-update.test.ts` | 265 | 3a99439bcfd1958b5bb54c4a0668e2741614547ec2f8c3673bfe49a37e040593 |
| `docs/openapi/openapi.json` | 63445 | d10af9690696e1c35007ccf59c7d81b30732fd71e84c1dfa4eba800501a6de17 |
| `infra/openapi-definitions-cms-composition.mjs` | 301 | 01f02a70ffe71774977c214bac53b8d945a5c0d6f5a17456f9c8eeba904cca84 |
| `packages/contracts/src/cms-composition/error-catalog.test.ts` | 184 | 60ffa201a888e7d36a71d304f6c35b53e9c2d81d962100074853c7940d2c7667 |
| `packages/contracts/src/cms-composition/error-catalog.ts` | 152 | 366a40ed52d4c1e94ff5dbca5a2b05b3d7d26193fffe42c49298df585d0be9ae |
| `packages/contracts/src/cms-composition/index.ts` | 32 | c427c70579effcae9b4b0eda597eee7c35dfeab57891c12e5e5c692cf825fc51 |
| `packages/contracts/src/cms-composition/key-grammar.test.ts` | 151 | 7fdadcafba7053e4f3ae67628526c9359a05c81e4c9011e956005cb090e60517 |
| `packages/contracts/src/cms-composition/key-grammar.ts` | 112 | 147b56e2517e69dfd3d28d44653b479b5604511c4946a6de5c6c993998456b86 |
| `packages/contracts/src/cms-composition/pattern-nestable.test.ts` | 104 | 8d819c58af5c8f8736a45c53131ffa02843dd697e1039b1a216979df99e0642f |
| `packages/contracts/src/cms-composition/pattern-nestable.ts` | 37 | 12f9a07221d825fb53e423888b42456ec31a995fb2b9732bc6591816ad6968ce |
| `packages/contracts/src/cms-composition/pattern-version.test.ts` | 324 | 335863e1ab39742c34736c33b99d29cc4b2ca8f4a860b0a80fdcce5e21de2a03 |
| `packages/contracts/src/cms-composition/README.md` | 113 | 599983bc2328dd6e5f50592bfa581366b74f8b95f6521d31641540d07270ddf5 |
| `packages/contracts/src/cms-composition/refusals-operations.test.ts` | 158 | 1017aea6e3719c9f3d8ff5cbfd56e72d20fc26663ed2aedc62cb707ca3c49598 |
| `packages/contracts/src/cms-composition/refusals.ts` | 320 | 22d6b332d88e99efb395c314891e144681f391153f4bb33f085a89fbde19ab5e |
| `packages/contracts/src/core-contracts.test.ts` | 352 | fb70df144a0516c2fbc4574f17a94482bce8375b7f222daa647f23bc4d3c2508 |
| `packages/contracts/src/openapi.ts` | 622 | 407c2af23ea4663b5a9eebe5e25c70dd303b468c5d4be8cd821c439ede53e25d |
| `packages/contracts/src/platform-registries.ts` | 2478 | f7cff11f6e55d82160a60505aab71a2a1b7f1e8876d055bf64ce0fd71e5e7abf |
| `packages/contracts/src/registries.test.ts` | 408 | 42bdec5d9cc06e2559fc249310917d25137a1f5f23fe68b44187887351cf916f |
| `supabase/migrations-wip/nestable-read/20261027100000_cms_list_pattern_nestable.sql` | 236 | 0721dc1115c20746e78d7295a1c2e3245aded0fbf2215811ba456b997d01edee |
| `supabase/migrations-wip/nestable-read/20261027100010_cms_list_pattern_nestable_public.sql` | 77 | 284bb36552d602d34f439dfbedaf8bcc3e512b2ffa4fecc22e621a7f6fb826d0 |
| `supabase/migrations-wip/nestable-read/20261027100020_cms_pattern_key_reserved_nestable.sql` | 116 | 54ba1b2d277a7b4407c09e3f03fbf4296773af8bab35fb4ea02947e8f87ba01e |
| `supabase/migrations-wip/nestable-read/README.md` | 16 | 9a0f3540c1ea433825cb7bff26c4ccbbea896b253ddafcbb7948182d78bfe58b |
| `supabase/tests/phase_02_slice_09_r8_api_surface.sql` | 262 | 2f6ef5863920eb165d16a2a284204a6b060ed5fcbdfa8534ee8e1a99b9e52aa9 |
| `supabase/tests/phase_02_slice_12_gaps_rpc_inventory.sql` | 129 | 570066d3ec81107ea9d57106c16735bf8845fad8b79ac31602f8bae2c3f0a8e0 |
| `supabase/tests/phase_02_slice_12_nestable_read/000-helpers.sqlinc` | 91 | b01af5a442ffd6623825633d41e1a5e14dd95a18aee7670f279ef68bfbd6e021 |
| `supabase/tests/phase_02_slice_12_nestable_read/001-world.sqlinc` | 34 | 1e3eb63392059a2fce8fd0561116ba1c5c98b117287a3f0df3ae3d57aa87b49b |
| `supabase/tests/phase_02_slice_12_nestable_read/010-lists.sqlinc` | 95 | 9ebde7fa9b2926ff29ca3bca66383129e266fa8969b8d354bb91c6f86e515f5e |
| `supabase/tests/phase_02_slice_12_nestable_read/020-paging.sqlinc` | 77 | b151fbbd86cfe96034b431283ee779af48027bfa081b10e02f43ddda0379bb0d |
| `supabase/tests/phase_02_slice_12_nestable_read/030-grammar.sqlinc` | 76 | 29760a0c0598b02240a5e62777c330ff585847aa189e34b108bab4673c89e798 |
| `supabase/tests/phase_02_slice_12_nestable_read/040-authority.sqlinc` | 90 | 876fd4d44e1758a19cb41f39cfe6617f97786b38ad4a5f24d29a9e3533824005 |
| `supabase/tests/phase_02_slice_12_nestable_read/050-follows-data.sqlinc` | 47 | dd00ad58eaef85710f57ea960ddceae3dce26c95136f70f02b8ccac3cfe08d6c |
| `supabase/tests/phase_02_slice_12_nestable_read/060-reserved-key.sqlinc` | 46 | ba658b4d7d185ede40a0cc3f1eb8a042d73f08babf42ffb2d89dc8b1ed163765 |
| `supabase/tests/phase_02_slice_12_nestable_read_populated.sql` | 148 | 2a99a300437edb8dc3368f8e8d76e5e269bc4665fd6555aa0199523fc1cd2d94 |
| `supabase/tests/phase_02_slice_12_nestable_read/README.md` | 19 | bf2797ecd050984a731638e05ff6fc89d9b9d328e35e428175fde403a3465983 |
| `supabase/tests/phase_02_slice_12_nestable_read.sql` | 36 | 5a67823276dc82a64aa8711fda4c169e48969c9353aa47c3ea80e25262d88545 |
| `tests/contracts/phase-02-slice-12-closeout.test.ts` | 299 | 01c217b68ace88206c9e59877ea6c1e2508e2676b13bee878880c561ea835c94 |
| `tests/contracts/phase-02-slice-12-nestable-reserved-witness-parity.test.ts` | 70 | 50404fb481a6b9d7eed8c618d7db47de9e6206af3cbf85b3ab45225b99a9b785 |
| `tests/contracts/phase-02-slice-12-pattern-openapi.test.ts` | 318 | 7d056e8d4c528a85f36e3839d2e0f6f3155995adb3b94215ac2b383b7077b64b |
| `tests/contracts/phase-02-slice-12-registry-parity-fixture.ts` | 46 | 30f4fe91c0081f33d35f2cd7fa9c8fbeb18b83a803d1ef50b9f0ba4fcd97dc0d |
| `tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts` | 180 | 96a12f2b80f6a26526cd84678fcf2aa6f8f15121e4fa6088842275c8ccb3b381 |
| `tests/contracts/phase-02-slice-12-registry-parity-reads.ts` | 256 | c3f997f3dd8bbcebd1970eed8328c2f0e5e6e326c15094e82fde08982d579a7b |
| `tests/contracts/phase-02-slice-12-registry-parity.test.ts` | 224 | f20714706b40b9fedcf4bd931fe169e0c119f7b79388e8ef9a43a9d4d285efaa |
| `tests/contracts/phase-02-slice-12-registry-parity-worker-bodies.ts` | 189 | 48e9a96af975104e9e1bc763dbbd1845fbdbc2279e83b9d715f8adacc8c107a3 |
| `tests/postgrest/support/claim-gate-fixtures-composition.ts` | 159 | 226f00904f0094dcfbd0f9d3d5932a352e06b31d09a29d84248df6e032e3dc15 |
| `tests/postgrest/support/claim-gate-manifest.ts` | 354 | d15708d4baa1467c8cb06d880fad2a2dc5aa34235044f5d928b1b3f0f92c62e6 |

Also edited (not hashed above because other lanes hold uncommitted changes in them or they are untouched by content): none beyond the table. `packages/contracts/dist` and `apps/web/dist` were rebuilt by `pnpm build` (gitignored).

## Runs

| # | When (local) | What | Result |
|---|--------------|------|--------|
| run1 | 19:49-19:56 | staged ALT, lane nestable-read, no WIP migration yet | RED: 191 tests, 97 ok / 94 not ok; first failure test 68 "has a named platform API RPC"; every failure `42883 function platform_api.cms_list_pattern_nestable(jsonb) does not exist` = genuine missing feature, setup 1-67 all ok, no harness abort. TAP `.lane-logs/alt-staged-nestable-read-194938-216289.tap` sha256 `73c657f0aee4983c7cfdda6017e6357e8ce077c0f6f04d701fc862ac342c766d` |
| run2 | 19:57-19:58 | with the two WIP migrations | migration apply aborted: `syntax error at end of input` in `cms_list_pattern_nestable` = MY defect (`if case ... then` ends the IF at the CASE's `then`; parenthesised the CASE). Harness-level, not feature RED. Log `scratchpad/claude_s12_nestable_read/run2.log` |
| run3 | 19:58-20:10 | fixed migration | 190/191; one failure, test 164: my expectation was wrong (a member of another organization is 403 `capability_missing` in its own party before any type is looked at, exactly as the CMS-03C-13 suite's `a-other`); genuine test defect, corrected. TAP `.lane-logs/alt-staged-nestable-read-195856-240513.tap` sha256 `06c215f744f1ffd723ca7f3d7aaab7a3bdd326ed78b3f8123c866836a152c91d` |
| run4 | 20:11-20:34 | corrected test, same migrations | PASS: 191 tests, 0 failed, `pg_prove exit=0`. TAP `.lane-logs/alt-staged-nestable-read-201123-275237.tap` sha256 `f264da53f1a7913b707f8a0825609665eef857fd9156f38e661f900e1e2d3f4c` |

TypeScript (RED then GREEN per layer): contracts `pattern-nestable.test.ts` 5; registry-parity files RED (18 failing) then green once the registry row, OpenAPI and Worker route existed; Worker `pattern-nestable-query.test.ts` 25, `pattern-nestable-routes.test.ts` 29 (29/29 RED before the route), `cms-composition-production-pattern-nestable.test.ts` 17 (15/17 RED); web `cms-pattern-nestable.test.ts` 33, `nestable.test.ts` (route) 3, `pattern-nestable-read.test.ts` 32, `CmsPatternNestedPicker.test.tsx` 17, `pattern-tree-state.nested.test.ts` 4, `CmsPatternVersionDesigner.nested-picker.test.tsx` 4. Total new tests 169, 169 pass.
RED honesty: the module-missing RED was observed for every new module test; the Astro page-route test and the designer integration test were written together with the code they cover and were not separately run red.
Full run `vitest run packages/contracts apps/worker apps/web tests/contracts`: 27,625 pass, 5 fail, 41 skipped, 7 failed files; after the fixes below only the evidence guards and the DEC-203 observer files remain (Open items). `astro check` 0 errors, `tsc --noEmit` clean in worker and contracts, eslint `--max-warnings=0` clean and prettier clean on every file in the table, `node infra/generate-openapi.mjs --check` clean.

Bundle (`pnpm build && pnpm bundle:check`, gzip bytes; "before" = the dist of the 19:39 build of this worktree, `sourceRevision` cd89d54c, "after" = my build 20:27):

| Route | Workbench before -> after | Initial route before -> after | Budget |
|-------|---------------------------|-------------------------------|--------|
| CMS pattern create | 22,385 -> 24,446 (+2,061) | 82,214 -> 84,275 | 92,160 (7,885 headroom) |
| CMS pattern edit | 22,385 -> 24,446 (+2,061) | 87,826 -> 89,885 | 92,160 (2,275 headroom) |

Both routes stay `passed: true`. `bundle:check` exits 1 for `CMS entry editor initial route exceeds 92160 gzip bytes: 92386`; that figure is identical before and after (not this lane). The zod-free static closure of the designer (pattern-designer-static-closure test) still holds: the new browser modules import only `@wejammin/contracts/client`.

## Test corrections (each is the smallest change an added operation forces; none weakens an assertion)

1. `packages/contracts/src/cms-composition/error-catalog.test.ts`: `cmsPatternNestableRead` joins the composition-catalog list; operation count 24 -> 25.
2. `packages/contracts/src/cms-composition/refusals-operations.test.ts`: marker `cmsPatternNestableRead: 'P2-S12-AC-105'`, allowlist `['capability_missing']`, "24" -> "25 Slice 12 operations".
3. `packages/contracts/src/registries.test.ts`: route-order list gains `'cmsPatternNestableRead'` after `'CMS-03C-13'`.
4. `packages/contracts/src/core-contracts.test.ts`: exported-schema list gains `'PatternNestableApiRequest'`.
5. `tests/contracts/phase-02-slice-12-registry-parity-fixture.ts` / `-reads.ts` / `-worker-bodies.ts` and titles in `...-registry-parity.test.ts`, `...-registry-parity-openapi.test.ts`: the brief's "make it list nine": `SUPPORTING_READ_IDS` + a `read({ id: 'cmsPatternNestableRead', cite: 'BE03c L184', ... errors: ALL_ERRORS, params: ['query:contentTypeId*', ...PAGE_QUERY] })` operation (Tier 1, 300/600 from the matrix, designer capability), a quota-request query for it, "eight" -> "nine", "25" -> "26", "thirteen" -> "fourteen".
6. `apps/worker/src/cms-composition/pattern-update-registry.test.ts`: the "authors and editors only" assertion now compares `row.capabilities` to the operation table's own `capabilities` (author/editor for the four old operations, `cms.template_designer` for the nestable list); `capabilityMode` asserted for any multi-capability row; a new row test for the nestable registry row.
7. `apps/worker/src/cms-composition/pattern-update-order.test.ts`, `apps/worker/src/production-worker-runtime-pattern-update.test.ts`, `apps/worker/src/cms-composition/pattern-update-routes.test-support.ts`: `readNestable` added to the hand-built `CmsPatternUpdateDependencies` (required port, type completeness only).
8. `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx`: the new-pattern picker test expected "not available yet"; it now expects "Choose at least one compatible content type" (the picker still renders, disabled, with its stated reason).
9. `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.uncertain-boundaries.test.tsx` and `pattern-latest-read.cancellation.test.ts`: both stub the global `fetch` and count its calls to measure the latest-read retry; the picker now makes its own read, so each mount injects `readNestable` (an `unavailable` stub) and keeps measuring only the latest read.
10. `tests/contracts/phase-02-slice-12-closeout.test.ts`: the pinned "only BOUNDARY marker is the nested-picker placeholder" test (task: "update exactly the pinned expectations of `phase-02-slice-12-closeout.test.ts`") now asserts NO `BOUNDARY:` marker remains in the Slice 12 production sources; the `trackingIssues` import is dropped with it.
11. `apps/web/src/components/step-up-required.inventory.test.ts`: `CmsPatternNestedPicker.tsx` and `pattern-nestable-read.ts` read a 401 only as UNAUTHENTICATED; classified `NO_STEP_UP_ROW` (BE03c 184: step-up none).
12. `tests/contracts/phase-02-slice-12-pattern-openapi.test.ts`: the "fixed pattern routes" path list gains `/api/v1/cms/patterns/nestable`.

## Spec citations for the acceptance clauses my tests prove

- P2-S12-AC-105 (nested pattern nodes from `CmsPatternNestedPicker` over the designer-only read): SQL suite 010-lists / 020-paging / 030-grammar / 040-authority / 050-follows-data; contract tests; Worker route / query / production tests; web proxy; browser read; picker; designer integration (version types -> read, choose -> nested node -> saved request carries `{ kind: 'pattern', key, patternId, patternVersion }`).
- P2-S12-AC-275 (registry parity): the fixture lists nine supporting reads; method/path/rate/timeout/tier/CSRF/CORS/capabilities/ETag/params/error-matrix/OpenAPI/Hono/Worker-quota/Worker-deadline parity tests run for the new operation.
- P2-S12-AC-261 (RPC inventory): own pins for the three new functions (exist, SECURITY DEFINER, empty search_path, `service_role`-only transport, private bodies closed to every API role, owner and ACL identical to the CMS-03C-13 pair, not in `public_api`).
- Cited behavior proofs inside the SQL suite: every-type compatibility both ways (a version listing all requested types is listed incl. extra types; a version missing any is not; set not order), drafts / superseded / retired never listed, other-owner scope (owner predicate; a type of another organization is NOT_FOUND for the whole request), cursor binding (limit, type set, subset, actor, another operation's domain, tamper, expiry, malformed), bounds (64 / 65 types, limit 0 / 1 / 50 / 51), designer-only (author, editor, author+editor, schema-designer refused; control: the same actor reads CMS-03C-13), context-cleared real-role call with a sentinel and a negative control (PAT-031), revoked designer refused on the next call, activation widening a version and a governed retirement moving `pageVersion`.

## Open items / BOUNDARY

BOUNDARY items: none remain. The one `BOUNDARY:` marker in `CmsPatternNestedPicker.tsx` is gone and the closeout test now pins zero.

Spec questions found (I did not edit specs):
1. Cursor faults: row 184 and row 413 (and BE00 line 491) say tamper / expiry / cross-context reuse is 400; the error matrix row 1427 lists "409 cursor/context mismatch" for the same operation (it is a copy of the CMS-03C-13 row). I implemented 400 everywhere in SQL. The registry, OpenAPI and parity fixture declare 409 and 422 because the matrix does (the parity test reads the matrix); the Worker and proxy relay a 409 if a dependency ever emits one, but the SQL never does. If root wants 409, change the `CONFLICT -> INVALID_REQUEST` mapping in `20261027100010` and the reader's two `INVALID_REQUEST` cursor raises, and flip the cursor tests.
2. Row 413 gives the validation outcome "400 / policy-safe 404" while the matrix gives 422 "query bounds". I used 422 `VALIDATION_FAILED` for `limit` outside 1-50 (as CMS-03C-13 does) and for MORE than 64 types (pointer `/contentTypeId`); everything else malformed (not an array, empty, non-UUID member, duplicate, unknown key) is 400.
3. `nestable` is not a reserved pattern key (E13, lines 226, 407, 419 list `context`, `versions`, `selector`, `new`). A pattern whose key is `nestable` can be created by CMS-03C-12, but its latest-read `GET /api/v1/cms/patterns/nestable` is now the list route (static routes win in Hono and Astro). Needs the spec to add `nestable` to the reserved keys and then: `cms_create_pattern_version` / `cms_pattern_latest` (SQL), `key-grammar.ts`, `PATTERN_RESERVED_KEYS` in `pattern-tree-rules.ts`, the `[patternKey]` API route and page. Not in my claim.

Other:
- No debounce on the picker: toggling content types cancels the read in flight and starts the next (a stale answer is never shown). With 300 reads/minute/user this is inside the quota.
- The picker lists the lineage being edited if it matches (row 1528); the save's 409 `pattern_cycle` is the authority.
- Remaining full-suite failures are not caused by this lane: `phase-02-slice-10/11/12-evidence-guard` (stale receipts, 11 / 23 / 436 problems; the new and changed tests alter hashes, so S12 receipts need regeneration by root) and `phase-02-slice-11-dec203-test-observer-*` (DEC-203, held).
- No real-route Playwright spec exists for the pattern designer. Suggested spec for root: sign in as a `cms.template_designer`, open `/app/cms-content-modeling/patterns/new`, tick two content types, assert the request `GET /api/v1/cms/patterns/nestable?contentTypeId=..&contentTypeId=..` returns a page, choose a pattern, press "Add nested pattern", save, then expect the draft. I did not write or run it.

## Requests to root

1. Add `cms_list_pattern_nestable` to the classified supporting sets of `supabase/tests/phase_02_slice_09_r8_api_surface.sql` and the inventory of `supabase/tests/phase_02_slice_12_gaps_rpc_inventory.sql` (33 -> 34 wrappers, 35 -> 36 bodies, 68 -> 70 resolved functions) when promoting; otherwise both fail once the two migrations are in `supabase/migrations/`.
2. Promote `supabase/migrations-wip/nestable-read/*.sql` after review; add the lane section to `supabase/migrations/README.md`; remove the WIP directory; add the run-4 TAP to the evidence.
3. Decide spec questions 1-3 above (cursor 400 vs 409; 422 vs 400 for 65 types; reserve `nestable`).
4. Regenerate S12 evidence receipts and update the ledger / tracker for AC-105, AC-261 and AC-275 (the closeout and registry-parity files changed); I touched no tracker, ledger, receipt or spec.
5. Run any real-route Playwright and `pnpm db:verify` canonical gates; I ran neither.

## Follow-ups

Root decided the three spec conflicts (BE03c amended, "DEC-232 read consistency"): (1) every cursor fault is 400 and the matrix 409 cell is "not applicable"; (2) more than 64 types or a limit outside 1-50 is 422, other malformed members 400; (3) `nestable` is a RESERVED pattern key. Items 1 and 2 matched my implementation except for the now-undeclared 409, which is removed everywhere; item 3 is implemented below. The earlier sections above that still say "409 declared / relayed" or list the three conflicts as open are superseded by this section.

### (a) `nestable` is a reserved pattern key

RED first, then GREEN:
- Contracts: `CMS_RESERVED_PATTERN_KEYS` in `key-grammar.ts` (the set behind `CmsPatternKeySchema`, so CMS-03C-12 and `cmsPatternLatestRead` and the web proxies/pages inherit it) now lists `context, versions, selector, nestable, new`; the browser mirror `PATTERN_RESERVED_KEYS` in `pattern-tree-rules.ts` too (its drift test compares them). Tests extended: `key-grammar.test.ts` (list, template keys still free to use `nestable`, schema refusal), `pattern-version.test.ts`, web `cms-pattern-platform-write.test.ts` / `-latest.test.ts` / `patterns-routes.test.ts` / `load-pattern-designer-page.test.ts` / `pattern-designer-request.test.ts`, Worker `pattern-definition-write.test.ts` (typed `key_reserved` at `/patternKey`), `pattern-definition-latest.test.ts` (latest read refuses the path key 400, no RPC call), and `production-worker-runtime-pattern-update.test.ts` (the route `/patterns/nestable` still reaches the nestable read, never the latest-read route). RED: 10 failing before the constants changed; 4,400 tests of the touched dirs pass after.
- SQL, NEW WIP migration `supabase/migrations-wip/nestable-read/20261027100020_cms_pattern_key_reserved_nestable.sql`: two anchored one-line patches (`cms_create_pattern_version` `key_reserved`, `cms_pattern_latest` INVALID_REQUEST), each with the anchor-occurs-once check, the byte-for-byte inverse check and the "only the source changed" pg_proc/ACL/comment check (the DEC-210 `20261022080200` pattern), plus the storage check constraint `cms_pattern_versions_pattern_key_not_reserved` dropped and re-added with the five keys (catalog-verified before and after). pgTAP `060-reserved-key.sqlinc` in my suite: the save refuses each of the five keys as `P0001:key_reserved#["/patternKey"]` and writes nothing, `cmsPatternLatestRead` refuses each as INVALID_REQUEST, the constraint lists the five keys and is validated, no stored pattern holds `nestable`, both functions carry the five-key list with owner / SECURITY DEFINER / search_path unchanged.
- RED runs (migration withheld from the stage): run5 hit a harness defect (my `060` used `s12pd_latest_request`, which only the pattern_definition suite defines; replaced by an own `s12nr_latest`); run6 genuine RED: 207 tests, 6 failed (193 and 197 the save accepted `nestable`, 199 latest accepted it, 203 constraint, 205 a `nestable` row got stored, 206 function lists). TAP `.lane-logs/alt-staged-nestable-read-204354-355537.tap` sha256 `c061d4519f610e2a3ffbb16be391430c31ea6a0539d3b04eeea0eb9c74faf98f`.

### (b) Inventory pins

- `supabase/tests/phase_02_slice_09_r8_api_surface.sql`: `('cms_list_pattern_nestable')` in the supporting set on its own line with a DEC-196/DEC-232 comment (this file computes its counts from the sets).
- `supabase/tests/phase_02_slice_12_gaps_rpc_inventory.sql`: `('cms_list_pattern_nestable')` on its own line with a DEC-196/DEC-232 comment, in the platform-RPC group (it gets a wrapper row and a body row). The three typed totals (33 / 35 / 68) are replaced by catalog recounts: inventory rows of a schema must equal the functions of that schema whose names the inventory lists, and the resolved function count must equal the inventory row count. Counted from the file and the catalog: 32 names x 2 schemas + 2 wrapper-only + 4 private-only = 34 wrappers, 36 bodies, 70 functions.

### Test corrections added by the follow-up
13. The two inventory files above (names added; the gaps totals recounted from the catalog).
14. DEC-232 matrix amendment (409 not applicable): the parity fixture `-reads.ts` declares `errors: [400, 401, 403, 404, 415, 422, 429, 500, 502, 503, 504]` for `cmsPatternNestableRead` (the parity test reads the amended matrix, so it failed until then); `infra/openapi-definitions-cms-composition.mjs` declares the same statuses (`NESTABLE_STATUSES`) and `docs/openapi/openapi.json` was regenerated; Worker route folds a port 409 to the scrubbed 500 and the failure table has no CONFLICT row (token CONFLICT -> 500); the web proxy answers an upstream 409 with a local 502; the browser read/picker no longer know a 409. Tests changed accordingly: Worker routes + production adapter, web proxy, browser read.

### Runs (ALT, staged, lane nestable-read, 3 WIP migrations)
- run7 (final): `nestable_read.sql` + `phase_02_slice_09_r8_api_surface.sql` + `phase_02_slice_12_gaps_rpc_inventory.sql` + `phase_02_slice_12_pattern_definition.sql`: 4 files, 579 tests (207 + 14 + 15 + 343), 0 failed, `Result: PASS`. TAP `.lane-logs/alt-staged-nestable-read-205023-370028.tap` sha256 `5c9f7234fbb2a56f849e8472765d366a6c48031d6a7a36a394f4a1d459faa5da`. No file under `supabase/` changed after this run.
- TypeScript after the 409 change: contracts + worker + web + parity + openapi + closeout + step-up inventory files pass (9,067 tests in the touched dirs; earlier broad run 24,468 pass with the single 409 parity failure that this change fixed); `astro check` 0 errors, worker/contracts `tsc` clean, eslint and prettier clean on every file of the table, `node infra/generate-openapi.mjs --check` rc 0.

### Requests to root (updated)
Request 1 of the earlier list (inventory classification) is done in the tree. Remaining: promote the three WIP migrations after review (the third is an anchored in-place amendment of two promoted functions plus a constraint), add the lane section to `supabase/migrations/README.md`, regenerate S12 evidence receipts (the new and changed tests alter hashes), run the canonical gates and any real-route Playwright.

## V14 follow-ups

Review V14 (`review-v14-report.md`) verdict PROMOTE-WITH-CONDITIONS; root decisions DEC-234. The Claude Code process exited once mid-way; on resume every touched file was re-read, the interrupted ALT run was found complete (TAP below), and lint / type / test checks were re-run on the final bytes. Same final state; scratch logs under `scratchpad/claude_s12_nestable_read/followup/`.

| Finding | Closure |
|---------|---------|
| V14-01 MAJOR | `cms_list_pattern_nestable` registered in the SEC-1 claim-gate: `tests/postgrest/support/claim-gate-manifest.ts` (`CLAIM_GATED_API_FUNCTIONS` `'service-role'` and the `cfg-actor` family list, next to the selector) and a fixture `{ request: { contentTypeId: [id(1)] }, real: NOT_FOUND }` in `claim-gate-fixtures-composition.ts` (the reader resolves the actor first; a real caller without a person is concealed NOT_FOUND). Those suites need the canonical PostgREST stack (`db:api-test`), so I could not run them: root runs `claim-gate-manifest.apispec.ts` and `claim-gate-mutation.apispec.ts`. RED evidence: before the edit the name occurred 0 times in both files. |
| V14-02 MAJOR | New test in `cms-composition-production-pattern-nestable.test.ts`: a hand-built port input with another operation's id, and queries that break `PatternNestableQuerySchema` (65 types, duplicate, non-UUID, empty set, limit 0), each answers `{ ok: false, status: 400 }` with no fetch. `readNestable` and `readSelector` now share one helper `pagedRead(operationId, schema, rpc)` (V14-07 duplication). Narrow coverage over every Worker production file I touched (`vitest run apps/worker tests/contracts/phase-02-slice-12-registry-parity --coverage --coverage.all=false` with `--coverage.include` for pattern-nestable-query / -routes, pattern-update-operations / -ports / -read / -routes / -answers, cms-composition-production-pattern-update / -rpc / -failure): 752 files, 13,617 tests pass, Statements 100% (364/364), Branches 100% (308/308), Functions 100% (65/65), Lines 100% (312/312). Log sha256 `67d4ebb37c62f769e64a225624e2ca5a15c93b656f5c0eb8ee49968e6a28e7a5`. |
| V14-03 MAJOR | Test correction 13b is reverted: `phase_02_slice_12_gaps_rpc_inventory.sql` asserts typed totals 34 wrappers (5 original commands, 20 platform RPCs, 9 internal), 36 bodies, 70 functions (the count follows the final set of names; if another lane adds an inventoried name the totals move with it). The name addition (13a) stays; `phase_02_slice_09_r8_api_surface.sql` keeps its typed set entry. |
| V14-04 MAJOR | `20261027100020` now holds a marker region `-- BEGIN/END NESTABLE-RESERVED-DDL`: an explicit pre-check counts stored rows with key `nestable` and raises SQLSTATE 55000 `DEC-232 refused: N stored pattern version(s) hold the reserved key nestable; re-key or remove them before this migration` (never a bare 23514), asserts the installed constraint is the four-key shape, then drops and re-adds the CHECK; a post-check verifies it is validated and five-key. Populated-DB witness `supabase/tests/phase_02_slice_12_nestable_read_populated.sql` (27 tests) replays that region verbatim (byte parity pinned by `tests/contracts/phase-02-slice-12-nestable-reserved-witness-parity.test.ts`, 3 tests): it reverts the CHECK to four keys beside a real pattern, seeds one `nestable` row (accepted by the old CHECK), shows the refusal is 55000 naming 1 and leaves the old CHECK and all rows untouched, seeds a second owner's row and shows the count 2, removes both (lifecycle guard paused only for the delete, asserted enabled again), shows the DDL then succeeds on the STILL POPULATED table with a validated five-key CHECK, that a raw `nestable` insert is 23514 afterwards, and that the producer still works. RED honesty: the witness was written against the final migration (it replays the very region that holds the pre-check), so a mutation without the pre-check would fail it with 23514 instead of 55000; I did not run that mutation. |
| V14-05 MINOR | Root (spec lines 452 / 1611 and the raw record); accepted, done by root per DEC-234. |
| V14-06 MINOR | Accepted: the real-route Playwright spec stays a root request (no Playwright run in this lane); V14-01 gives the real-PostgREST gate coverage once root runs it. |
| V14-07 MINOR | Fixed: `NestedPatternChoice` / `newPatternNode` moved to `pattern-tree-nested.ts` (`pattern-tree-state.ts` back to 277 lines, test renamed `pattern-tree-nested.test.ts`); `readNestable` / `readSelector` share `pagedRead`. |
| V14-08 MINOR | Accepted: the edit-route headroom (about 2.1 KB of 92,160) is recorded for whoever next grows the designer island; nothing to change in this lane. |
| V14-09 MINOR | Accepted with reason: the benchmark file is `gaps_perf_patterns` (another lane's); I do not edit it. Expected bound: two sequential scans of the owner's pattern versions per request, no per-type index; root's canonical bench should add a first page, a cursor page and a 64-type request. |
| V14-10..V14-12 | Not this lane (placement-perf). |
| V14-13 NIT | Fixed: the cursor `queryHash` now also binds `'sort', 'patternKey:asc,patternVersion:desc'`. |
| V14-14 NIT | Fixed: the high-water instant is read before the page, so a concurrent activation can only leave the validator older than the items. |
| V14-15 NIT | Accepted: zod `.refine` uniqueness is not exportable to JSON Schema (`uniqueItems` absent) and the 200 `ETag` description is shared copy; uniqueness is enforced at every layer (contract, Worker, proxy, SQL) and tested. |
| V14-16 NIT | Fixed in this report: Status line points to the final run, and the nine existing oracle files extended for the reserved key are added to the corrections list below. |
| V14-17, V14-18 NIT | Not this lane (placement-perf). |

Test corrections added (V14-16, all additive, ACCEPTed by V14): the nine reserved-key oracle files `key-grammar.test.ts`, `pattern-version.test.ts`, `cms-pattern-platform-write.test.ts`, `cms-pattern-platform-latest.test.ts`, `patterns-routes.test.ts`, `load-pattern-designer-page.test.ts`, `pattern-designer-request.test.ts`, `pattern-definition-write.test.ts`, `pattern-definition-latest.test.ts` gained `nestable` cases; correction 13b is withdrawn (V14-03).

### Runs
- ALT run8 (final, WIP lane nestable-read with 3 migrations staged): `nestable_read.sql` 207 + `nestable_read_populated.sql` 27 + `phase_02_slice_09_r8_api_surface.sql` 14 + `phase_02_slice_12_gaps_rpc_inventory.sql` 15 + `phase_02_slice_12_pattern_definition.sql` 343 = 606 tests, 5 files, 0 failed, `Result: PASS` (`governed_schedule_ladder` not run). TAP `.lane-logs/alt-staged-nestable-read-005858-718689.tap` sha256 `e851740e33a3ccbb1a3b25f0de4b4cd61de67c5127b8b813c7b14ba9d567e244`. No file under `supabase/` changed after this run.
- TypeScript on the final bytes: 542 test files / 9,363 tests pass over contracts, Worker `cms-composition` + adapter + runtime, web server / designer / pages, registry parity, witness parity, closeout, pattern-openapi, step-up inventory; worker and contracts `tsc` clean, `astro check` 0 errors, `generate-openapi.mjs --check` rc 0, eslint `--max-warnings=0` clean and prettier clean on 73 files.

### Requests to root
1. Run the SEC-1 suites (`claim-gate-manifest.apispec.ts`, `claim-gate-mutation.apispec.ts`) in the canonical `db:api-test`; they cover `cms_list_pattern_nestable` now.
2. Promote the three WIP migrations; the third also needs the populated-DB check as a deploy precondition on staging and production: `select count(*) from platform_private.cms_pattern_versions where pattern_key = 'nestable'` must be 0 (the migration refuses otherwise, with that count).
3. Regenerate S12 evidence receipts; update `gaps_rpc_inventory` totals if another lane adds an inventoried name before promotion.
