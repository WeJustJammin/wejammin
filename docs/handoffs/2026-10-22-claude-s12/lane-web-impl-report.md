# Lane claude_s12_web_impl report

## Status
PARTIAL. HEAD cd89d54c on claude/phase2-slice12. Items 2, 3, 4 and the web-class rows of item 5 are done (RED then GREEN).
Item 1 (nested picker) is BLOCKED by a missing upstream read (see Open items).

## Scope / claims (named before editing)
- Item 1 `apps/web/src/components/cms-pattern-designer/CmsPatternNestedPicker.tsx` (+ its README/test if touched).
  FINDING: the DEC-196 designer-only nested-pattern read has NO spec row (BE03c), contract, SQL, Worker route or web
  proxy anywhere in the tree (grep nestable / patterns/nest: nothing). The picker cannot be built over a read that does
  not exist; see Open items. Only the stale BOUNDARY comment is corrected (it names CMS-03C-13, which DEC-196 says the
  picker is NOT).
- Item 2 NEW `supabase/migrations-wip/node-pointers/` (20261024140000-149999), NEW
  `supabase/tests/phase_02_slice_12_gaps_node_pointers.sql`; Worker relay + designer files (named below once read).
- Item 3 `apps/web/src/components/cms-composition-instances/use-composition-insert.ts` (+ new test).
- Item 4 shared async-state helper for Slice 12 islands (location decided below).



## Scope as delivered
1. **AC-105 nested picker: BLOCKED (not implemented).** DEC-196 (decisions.md, raw record dec-196) chose a designer-only read.
   Verified by grep over BE03c, FE03, IA03, packages/contracts, supabase/migrations, apps/worker, apps/web: that read has no BE03c
   row or resource, no contract, no SQL read, no Worker route and no first-party proxy. CMS-03C-13 (`CmsPatternSelector`)
   is author/editor and single-type, so a designer cannot call it (the inventory row suggesting "wire CmsPatternSelector" predates
   DEC-196). Per the boundary rule I did not invent the read. Only the stale BOUNDARY note of `CmsPatternNestedPicker.tsx` was
   corrected (it blamed an unbuilt CMS-03C-13 route); it still starts `BOUNDARY:` and names no tracking issue, so
   `tests/contracts/phase-02-slice-12-closeout.test.ts` still passes unchanged. **No closeout expectation was changed.**
2. **AC-105 / DEC-228 node pointers: done across the whole chain.** SQL (two WIP migrations), Worker relay and wire projection,
   first-party proxy, designer (child indices, summary link, inline error at the node, tree fallback when the pointer names a
   node not on screen).
3. **AC-110 cursor conflict: done.** A 409 on the selector read (BE03c 1414 "cursor/context mismatch") drops the cursor,
   reads page one once, replaces the list, says so politely, clears a choice the first page no longer lists.
4. **AC-271 skeleton after 250 ms: done in one place** (`apps/web/src/components/cms-editorial-workflow/CmsLoadingRegion.tsx`: `useLoadingDelay`, `CmsLoadingRegion`), and
   `useCanonicalResource().loading` for the canonical refetch helper. Wired into: governed review detail island (skeleton +
   commit off with reason), composition diff read, pattern selector further-page read (insert submit off while it runs),
   template latest check, pattern latest check. Fake-timer tests at 249/250 ms for each.
5. **Web rows of the inventory touching these components:** AC-045 (unknown placement outcome reconciles with an entry read before
   the retry is offered, same key and request; unsaved-changes guard: beforeunload only while dirty, inline leave
   confirmation, no stored draft), AC-117 (a held diff is dropped when its re-read is degraded; test only, behavior existed),
   AC-271 (above). Root's two additions: AC-069 #6 copy ("Needs an independent reviewer's approval" in
   `governed-state-labels.ts`).

## Bundle (production build, `pnpm build && pnpm bundle:check`; initial route gzip bytes; budget 92160)
Baseline = HEAD plus the other lanes' working tree at lane start (it already FAILED): CMS entry editor 92386.
| route | before | after |
|---|---|---|
| CMS entry editor | 92386 (FAIL, pre-existing) | 92386 (FAIL, unchanged; not touched by this lane) |
| CMS taxonomy edit | 92048 | 92041 |
| CMS composition | 79058 | 80862 |
| CMS pattern create / edit | 81602 / 87221 | 82214 / 87826 |
| CMS template create / edit | 71959 / 79983 | 71959 / 80341 |
| CMS review detail | 88681 | 89140 |
| CMS entry workflow | 88267 | 88723 |
| every other route | unchanged | unchanged |
Island budgets (workbench 35840) and lazy chunks (81920) all pass. **Budget-forced exclusion:** the taxonomy edit route has 112 B
of headroom at baseline; the 250 ms helper costs ~330 B there, so the loading helper is NOT wired into
`CmsGovernedReviewPanel` (its subject re-read), `CmsTaxonomyConflictPanel` (vocabulary latest check) or
`CmsTaxonomyTermChoice` (term read). A first attempt that wired them put taxonomy edit at 92779/92605/92322 (fail); moving the
module into an existing chunk did not fit either. Those three keep their pre-lane behavior (immediate text / no region).

## Runs
| what | result |
|---|---|
| pgTAP ALT staged, lane node-pointers, `phase_02_slice_12_gaps_node_pointers.sql` | see table below |
| vitest apps/web apps/worker packages/contracts tests/contracts | 1872 files passed, 6 failed; the 6 are evidence-ledger / receipt guards and DEC-203 observers (stale receipts of files other lanes edited, ledger inventory byte fidelity); none touches this lane (see Foreign failures) |
| vitest apps/worker/src/cms-composition | 171 files, 3834 tests passed (after the Worker change) |
| tsc --build tsconfig.json | exit 0 |
| eslint --max-warnings=0 on every file below | clean |
| prettier --write on every file below | clean |

### pgTAP runs (file phase_02_slice_12_gaps_node_pointers.sql; lane node-pointers)
| stamp | result | classification |
|---|---|---|
| 072843 | abort at line 48 after 11 tests | harness: direct call of a not-yet-existing function aborted the script |
| 073130 | abort at line 84 after 26 tests, 5 not ok | harness: helper `s12pd_activate` lives in 050-nested.sqlinc, not included; the 5 failures were already genuine RED |
| 073353 | plan 122, 11 not ok (every pointer assertion; have `["/blockTree"]`) | genuine RED; TAP sha256 9c6025c14ac7bad69699b34598330cfefebda43da09e5213c5ebaadae180f8e0 |
| 073604 | plan 122, 0 not ok, PASS, with the two WIP migrations | GREEN; TAP `.lane-logs/alt-staged-node-pointers-073604-2338452.tap` sha256 29ed177e8a13956e61612ca53e9375bf33113aa82f7ed632489126687c269109 |
Each of the four runs was one deliberate change. No migration file was edited after the green run.

## Test corrections (independent review please)
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx`: the `review` row of the lifecycle table expected
  "An independent reviewer must approve it"; now expects "Needs an independent reviewer's approval" (FE03 879 quotes that exact
  sentence; root instruction AC-069 #6). Matching production change in `governed-state-labels.ts` (the note lost its second clause).
- `apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx` (test "reuses the Idempotency-Key ..."):
  scripts the entry read that FE03 1048 now requires after an unknown outcome (`[ENTRY]: [entryDetail('9')]`) and reads the keys
  from the POST calls only (the GET between them has no key). Assertions on the keys are unchanged.
- No other existing oracle changed. `tests/contracts/phase-02-slice-12-closeout.test.ts` is unchanged and passes.

## Spec citations
BE03c field matrix CMS-03C-12 `blockTree` row and 1525 (DEC-228); BE03c 1414 (CMS-03C-13 cursor/context mismatch 409);
FE03 885 (pattern designer node path), 879 (review panel copy), 927 (unsaved changes), 1042 to 1048 (Slice 12 states: loading,
degraded, 409 cursor restart), 912 and 46 (250 ms), 1115 (insert form); decisions DEC-196, DEC-210, DEC-228.

## DEC-228 interpretation to confirm (root)
Node count weighs a block node 1 and a nested pattern node its stored `node_count`, running in preorder; the literal-forest
check (`cms_pattern_forest_check`, weight 1 each) is named with the same function so both refusals agree. Depth through nested
patterns (the closure bound of nine pattern levels, a different limit from block level 9) names the first request pattern node whose
own chain reaches nine levels. Cycle names the first request pattern node whose closure reaches the lineage being defined.
`block_rules_violated` already carried its pointer (DEC-210) but the designer still does not link it to the node; not changed (FE03 885 lists only cycle, depth, node count).

## Files (path, lines, SHA-256)
| path | lines | sha256 |
|---|---|---|
| `apps/web/src/components/cms-composition/CmsLatestReadLoading.test.tsx` | 95 | 3fd63da9ce30c81df93e65f5c0ad934c2756751026306d02734ba8cdb6138671 |
| `apps/web/src/components/cms-composition/CmsTemplateLatestCheck.tsx` | 60 | f81230c2335450e2d852a78b31b338ca91f9fa3b220060587b715709f50f31f5 |
| `apps/web/src/components/cms-composition-instances/cms-composition-instances.css` | 191 | e277c83a4938e34e5410b5fb7ae665c9b07001d3ce33c0c729e34bb8b6505039 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionLeaveConfirm.tsx` | 31 | 096a9e289261798039f0fab2cbf321dc4593cc64b86cb282e42c99dab4b6786c |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.degraded-diff.test.tsx` | 82 | 8b980fb7af824a34a1d4dfd685b033767af59cb30efc7138a062c6c9a2b5acc2 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx` | 359 | 00bc4cd4f9b9bb4e9737e1bf5f38de267b4a90a566cf3574f96231be8e1b3be7 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.loading.test.tsx` | 132 | 8fe25970a82108a11b0903743c94d707eb4bedb6e7697376d13be6ea7fea43fa |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.selector-restart.test.tsx` | 132 | 25fb5db5eeecfee8720d758b887437595b2b4e0b7da76e46a59ff236ce694288 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.tsx` | 97 | 46260f33e20204c6e9ebf6bbb627e0e9fa4235d864112b7f478d65346e1a7dab |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx` | 252 | bccc2d2a17d53dacf049f7faf8ccfa9eac0d5b3f86239dd4d5db3d857369c19a |
| `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.tsx` | 191 | f81e698cab915988ca428fbfc32ffe5e7f6b147dee8e419224939b9115083f75 |
| `apps/web/src/components/cms-composition-instances/CmsPatternSelector.tsx` | 123 | a8340e5469968700c1b93f0c637a633b1c05900896dadd35c1ae3faf901c1333 |
| `apps/web/src/components/cms-composition-instances/composition-types.ts` | 51 | 520b1f88499ceffe503f3ef7b071d17fa962687939ed64ff0dc34fb662d78281 |
| `apps/web/src/components/cms-composition-instances/README.md` | 94 | 4a7b4481593380a0587b5eb4091f9cb8a1baa5a73e6a48057e3bd08031bbc515 |
| `apps/web/src/components/cms-composition-instances/use-composition-insert.ts` | 235 | 4751576fb6c34863377273b4932a99eeafd07d1ac64033a0698deaf55a0bfa67 |
| `apps/web/src/components/cms-composition-instances/use-composition-page.ts` | 90 | ca87c0f9734d3770554b45ff0af6b8992a92544c32de0fc7883191ca0e055465 |
| `apps/web/src/components/cms-editorial-workflow/cms-loading-region.css` | 28 | 3a8bdd062a322a72e05fefa947c160b5cd82dfd6c36683195d8af3b97322c32f |
| `apps/web/src/components/cms-editorial-workflow/CmsLoadingRegion.test.tsx` | 161 | f904e1ccfa7fa81b509ae8aa7c5b08739a1d29c781653804012668c16392933f |
| `apps/web/src/components/cms-editorial-workflow/CmsLoadingRegion.tsx` | 43 | c63769e574fdea486b8279fbd904a25e986e023134c06ef544956c41b6814cb7 |
| `apps/web/src/components/cms-editorial-workflow/README.md` | 200 | 4d30167d60ca05b3a42dc68c1ce4ca0004bf5a3f8ab44faf7c9edca3e4ead187 |
| `apps/web/src/components/cms-editorial-workflow/use-cms-workflow-canonical.ts` | 126 | 8ed09356919626d0851805e81f6a19b56a4401d3b536cc089a0a43e82097462b |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.loading.test.tsx` | 141 | c9f22548ef99cb274321c58379f74a7d7f61ce2870512acd6702044025da71c3 |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.tsx` | 167 | c201868b795a91c5ebbeb1f4ef92b830f81495423a47131d9d7c14746357c905 |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.test.tsx` | 359 | 4251bfeee0ac86e17a5dd074bbcc7301946fb28e7e9dc4d766226f139a8712d7 |
| `apps/web/src/components/cms-governed-review/governed-state-labels.ts` | 49 | fa5038b8bf34c8987b444122b3193876243c205aa33e1aa12df6e569af56146f |
| `apps/web/src/components/cms-pattern-designer/CmsPatternConflictPanel.tsx` | 115 | 9c94a71790eba790904d13c69070a0305ed270ab42113eb5d73a9ca4fe939e3c |
| `apps/web/src/components/cms-pattern-designer/CmsPatternNestedPicker.tsx` | 37 | a292b18eac0877a361beae15619955dc31a98b67be47aa26cc1d8b660a85050f |
| `apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.node-pointer.test.tsx` | 98 | e85564af880b3b61a9c804bde90797f1fb7a13750b814ae46325df7e62df60e3 |
| `apps/web/src/components/cms-pattern-designer/pattern-designer-copy.ts` | 65 | ad794fe2ed937db6f843398d6727b722053508884d22ebec801ea15759247b14 |
| `apps/web/src/components/cms-pattern-designer/pattern-designer-node-pointer.test.ts` | 144 | 55d4ab17ccd2e301e5a3f77000b4ba9067bbe4ace736758c7c6c6ccccb8140b4 |
| `apps/web/src/components/cms-pattern-designer/pattern-designer-node-pointer.ts` | 44 | 03dc1961aef8f8c940cbb7f317e1cee64675aa5e2e13cf7606ab6520d0b6592b |
| `apps/web/src/components/cms-pattern-designer/pattern-designer-refusal-items.ts` | 62 | e83edd21e7a8b743c215066cd175c555dc97b9475ffb72384da2758d411a4e49 |
| `apps/web/src/components/cms-pattern-designer/pattern-designer-submit.ts` | 216 | fa437f0dfbdefaf2edb028ca53da4a82c1c2b1c57531eb48807629694cf3a5ca |
| `apps/web/src/components/cms-pattern-designer/README.md` | 93 | 950157521414fde19673c93f0755e9afe5091b8d44fb2c22c245cf1366c0ac18 |
| `apps/web/src/server/cms-pattern-node-pointer.ts` | 42 | 04edd1a3688b96fcee97ad58257aabfda2df89775e0f7e59fa7d5272235643d9 |
| `apps/web/src/server/cms-pattern-platform-details.ts` | 193 | 5194467908dce7af78681393f87a96e6565388776349e6d762f6b9b52144ae72 |
| `apps/web/src/server/cms-pattern-platform-node-pointers.test.ts` | 71 | 1dbf0a889ae77aa1d0a57b75ad8c68fa91ba934fb343789e0dc68fac7ba8a4c6 |
| `apps/worker/src/cms-composition/node-pointer-refusal.ts` | 67 | 929cc9b11f29cd592fea6c26ebcea1bd52636a607ef7ca766ee63f0a9a6f14d4 |
| `apps/worker/src/cms-composition/pattern-definition-node-pointers.test.ts` | 93 | ca5f1696ea3da20070c78562fa7cb6029eb4eff32e08226a9df02b90dc8db935 |
| `apps/worker/src/cms-composition/pattern-definition-response.ts` | 289 | 9cf34abf204c514ee9e0913d98ef1b400f45f0c8e73cb98aab0dc268fbb2c138 |
| `apps/worker/src/cms-composition-production-pattern-definition-latest.ts` | 234 | f66a7284636fd307c2a6a20b822e36532a2648a7e9c153070eb8f0ed0bf68257 |
| `supabase/migrations-wip/node-pointers/20261024140000_cms_pattern_node_pointer_helpers.sql` | 142 | 36b3db2f79d845c8d6752cd61f70dcbd7febc6e32887f9a7763f54bb711316aa |
| `supabase/migrations-wip/node-pointers/20261024140100_cms_create_pattern_version_node_pointers.sql` | 97 | d6b778aff8e08b87a4409bf36a9018bf56be84decbb86c923b3ece66976e1801 |
| `supabase/migrations-wip/node-pointers/README.md` | 15 | d8f3163a3a808824fb3afd43e569217b9ee2aafc89ae5699b6a27f820704959e |
| `supabase/tests/phase_02_slice_12_gaps_node_pointers.sql` | 202 | 9c754d69ca09e5dd6f2d584277bf48cf6ae95f82f8d0d1b934ae28491658c1f2 |

Scratch copy of the original WIP files: none needed (all WIP files are new in this lane). Test files created by this lane are
the `*.test.ts(x)` and `phase_02_slice_12_gaps_node_pointers.sql` rows above.

## Playwright specs for root (none added; none run by this lane)
No real-route spec exists for the pattern designer or the composition page. Re-run for regressions of touched shared UI:
`tests/e2e/phase-02-slice-12-template-real-route.spec.ts`, `...-template-edit.spec.ts`, `...-template-uncertain-real-route.spec.ts`
(template latest check now renders a status line after 250 ms) and `...-governed-review-real-route.spec.ts` (review detail
island loading region; panel copy). Suggested new specs (not written): pattern designer cycle refusal at a node;
composition leave confirmation.

## Open items / BOUNDARY
- **AC-105 nested picker (BLOCKED):** needs the DEC-196 cascade first: BE03c route row + resource (and field matrix), FE03
  designer row, contract (query + page schema), SQL read for `cms.template_designer`, platform_api wrapper, Worker route, web
  proxy; then the picker can be built over `CmsPatternSelector`'s select/list pattern. Missing spec named: BE03c row for the DEC-196 read.
  When implemented, update `phase-02-slice-12-closeout.test.ts` (the pinned BOUNDARY marker and `trackingIssues` expectation) and
  remove `NESTED_PICKER_DISABLED_REASON`.
- **Budget:** taxonomy edit route (112 B headroom) excludes the 250 ms skeleton in three components (above). CMS entry editor
  initial route is 92386 > 92160 independent of this lane.
- Skeleton not wired into: locale source review, related candidates, Slice 10 workflow islands (outside the Slice 12 table).
- The vocabulary-version latest check and term read ("Loading terms…" immediate status) keep immediate text.
- Foreign failures seen in the full run (not this lane): `cms-workflow-labels.test.ts` "has copy for every registered reason"
  (taxonomy-integrity lane's new reason `term_merged_unconverged` has no copy yet); evidence-guard receipts stale because other
  lanes edited `apps/worker/src/cms-editorial-production-error-tokens.test.ts`; ledger-inventory fidelity; DEC-203 observer tests.

## Requests to root
1. Run the DEC-196 spec cascade (or tell me to write the BE03c/FE03 rows) so item 1 can be built; owner-approved cascade per decision.
2. Promote `supabase/migrations-wip/node-pointers/` after review (2 files, 20261024140000 and 140100); add a section to
   `supabase/migrations/README.md`.
3. Decide the taxonomy-edit budget (raise it, or split the term form from the route) if the 250 ms skeleton should reach the
   governed panel, vocabulary latest check and term read.
4. Entry editor budget (92386) fails at baseline; the editor chunk needs a trim by someone owning it.
5. Consolidate the pointer-grammar helper (worker `node-pointer-refusal.ts`, web `cms-pattern-node-pointer.ts`, designer
   `pattern-designer-node-pointer.ts`) into contracts next to `CMS_BLOCK_RULES_POINTERS` (contracts were frozen for this lane).
6. Re-record Slice 12 evidence receipts for the touched tests.
