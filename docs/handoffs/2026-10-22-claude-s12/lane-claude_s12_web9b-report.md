# Lane claude_s12_web9b report (wave 9, web9b: related content, composition, governed)

## Status

**PARTIAL** (2026-10-31 22:52 UTC). Every item of the brief's web9b section is done and proven (RED first or revert-checked), and every
gate in my claim is green, with TWO exceptions that are not mine to close: (1) the bundle gate (`verify-bundle-budget.mjs`) FAILS on
CMS pattern edit (93,212 > 92,160) and CMS taxonomy edit (92,902 > 92,160); none of my touched chunks is in either initial route
(section "Bundle"); (2) the governed command POST of the shared `cms-workflow-command-transport.ts` sends no `cache: 'no-store'` (a file
outside my claim; DEFECT D1, Requests to root). Worktree HEAD `85ab5ff0` plus the uncommitted tree. No git write, no Playwright, db or
race command, no sub-agent, no background command (the tool backgrounded two over-120 s foreground commands on its own; neither
was touched again and both completed).

Backup before the first edit: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_web9b/orig-20261031T213812Z.tar` (the four claimed component directories, `read-deadline.ts`, the CMS pages);
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_web9b/orig-lib-20261031T220426Z.tar` (`read-deadline.ts`, `read-deadline.test.ts`). `read-deadline.ts` and its test are byte-identical to their
originals again (I added and then removed a helper once I saw web9a's `read-within-deadline.ts`; the removed text is in
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_web9b/removed-helper.txt`).

## Per-item table

| Item | Outcome |
| --- | --- |
| V20 m3 (ruling 2) | DONE. `keepRetired(listed, held, revisionId)` keeps only retired rows of the revision the read answered. RED: `use-composition-session.refresh.test.tsx` (unit) and `CmsCompositionPage.list-refetch.test.tsx` (V20's probe as a page test). Revert check M1: both fail. |
| V20 m5 (ruling 3) | DONE. `reconciliationLine(..., attempt)`; `unconfirmed.attempt`; a repeated failed "Check again" says "(attempt N)". RED: `CmsCompositionPage.unverified-hold.test.tsx` (MutationObserver on the live region, three distinct sentences). Revert check M2 fails it. |
| V20 m6 | DONE (test). `cms-taxonomy-designer/taxonomy-versions-on-demand.test.tsx`: failed chunk answers `unavailable`, requests nothing; the vocabulary designer keeps its table and says the list could not be refreshed. Line 22 now covered; revert check M7 (catch removed) fails 2 of 3. |
| V20 m9 (ruling 5) | DONE (product + tests). A placement digest refusal (`block_registry_digest_mismatch`, 409 per BE03c 388, and the 422 the old oracle uses) reads the selector's first page again (`composition-selector-reread.ts`, `use-composition-selector-reread.ts`), carries the chosen pattern over with its current digest (next POST sends it), clears a pattern the page no longer lists and says so; a failed read makes the selector `stale`: placement held, "Read the patterns again" is the way on (`CmsPatternSelector.tsx`, `CmsPatternInsertForm.tsx`, `ReadState` `stale`). The copy no longer says "Reload". 7 tests in `CmsCompositionPage.registry-digest.test.tsx` (RED 4/5 first); revert check M4 fails 5. |
| V20 m10 (ruling 1) | DONE. `readJson` runs under the shared 8,000 ms deadline (`runReadUnderDeadline`: `startReadDeadline` + web9a's `withinDeadline`), covers the retries and the body, starts no retry once ended; the M3 hold (`session.hold`) ends with it. `CmsCompositionPage.read-deadline.test.tsx` (5 page tests with fake timers + 6 `readJson` unit tests). Revert check M3 fails 9. Also moved to the same deadline: `related-conflict-read.ts` (local `READ_DEADLINE_MS` removed), `fetchCandidatePage`, `readCanonicalGovernedReview` (each with a deadline test; revert checks M12, M13). |
| V20 n4 | DONE. `composition-page.test-support.tsx`: a list read nobody scripted is answered 200 by `composition-list-model.test-support.ts` (the rows the page was given plus every mutation answer) instead of 503, and the registry fails (in `afterEach`) any test that left an unscripted list read without looking at `page.lists`. 62 tests (plus 4 of mine) now assert the refetch with `expectListRefetches(page, n)` (n GETs of `?limit=50`). Probe of the registry: a test that does not assert fails with the stated message. Revert check M9 (no refetch after a placement) fails 9. |
| refute8b AC-284/285 "keeps the ordered pins" | DONE by asserting, title unchanged (so the ledger identity holds): the review section lists the saved rule's pin and not the person's (`CmsRelatedContentForm.conflict.test.tsx`). |
| refute8b governed submit plain 401 | DONE (test only; behaviour already right). `CmsGovernedSubmitForm.states.test.tsx`: session-ended sentence, "Sign in again" link with `returnTo`, no step-up, no gate, one request. The guard lives in `cms-workflow-command-controller.ts` (outside my claim), so it was not mutated. |
| refute8b queue degraded rows | DONE. Retitled to what they assert (DEC-242(1)) and made complete: they now assert the Retry link at the same list position. The 200-not-the-strict-page row FAILED (no Retry): product fix in `load-governed-queue-page.ts` (RED first, revert check M10). |
| refute8b 6 BLIND rows | 5 of 6 are web8b's and are fixed (web8a idx 12 is web9a's). Root cause: a gone page still read the list. `refreshList` now makes no read when unmounted; the four `reconcile-edges` rows and the `refresh` recheck row assert 0 list reads and FAIL with the guard removed (revert checks M5 and M6, the latter = refute8b's MF: 5 fail each). Test corrections below. |
| refute8b PROOFGAP rows 91, 98, 104 | DONE (one assertion each that the read was attempted). |
| AC-271 closing words | DONE for composition (3 tests: every request `no-store` + same-origin, nothing changes before the answer, incl. the instance-list read), related content (candidate read and save, real transport) and governed (review read; command except the cache option, D1). Revert checks M8a/M8b (cache option changed) fail all 3 composition tests. |
| AC-069 | DONE with a stated limit. The plain Vitest config has no Astro plugin, so the page cannot be rendered. `governed-review-page-mounts.test.tsx` runs the chain each page's frontmatter runs with real code (`templateSuccessorPageOutcome`, `loadPatternDesignerPage`, `loadGovernedSubjectReview`, only the protected edge replaced) and mounts the panel the page renders for the result: lifecycle text, submit action, the version's review summary and link; a denied or degraded page renders no panel; a new pattern has none. The text guards stay. Real-route evidence remains the Playwright specs. |

## Scope

Brief `briefs/gaps-wave9-web.md`, section web9b; rules `2026-10-14-claude-s12/lane-rules.md`. Claim: `cms-related-content/`, `cms-composition-instances/`,
`cms-governed-review/`, `taxonomy-versions-on-demand*`. Shared files I touched, one block each: `apps/web/src/lib/run-read-under-deadline.ts` and its
test (NEW; composes `read-deadline.ts` and web9a's `read-within-deadline.ts`, which I did not edit), `apps/web/src/lib/README.md` (one bullet),
`apps/web/src/components/cms-taxonomy-designer/README.md` (one sentence naming my test). Not touched: `verify-bundle-budget.mjs`, the performance test, ledgers,
receipts, trackers, specs, migrations, Playwright specs, web9a's files.

## Files (path, lines, SHA-256)

| | path | lines | SHA-256 |
| --- | --- | --- | --- |
| MOD | `apps/web/src/components/cms-composition-instances/CmsBulkUpdatePanel.states.test.tsx` | 348 | `bf8daaf63c8c5e46ab92c108e3cbd9504897f882c0a07387fc04f6aff7319788` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.accessibility.test.tsx` | 195 | `d3d8276664aaed43f554e3063c6e81d49f1100e5ecb91104f8fa3fd2c23b9cb0` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.bulk-edges.test.tsx` | 239 | `c5e32d990fd8a53201475227fb95feb6e6387ed866aa1450a9f024595193f0ee` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.bulk.test.tsx` | 261 | `5813a36e5662e3ccc45421c5ba3037fc1243780b07c2ee4bbc700db8da4eb869` |
| NEW | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.closing-words.test.tsx` | 215 | `538b9c662d910a338e0205028d3fcddaa422bd0afbf6efaa8db6565edb339d23` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.degraded-diff.test.tsx` | 84 | `f7006392cb30697f90ec7761b4f1441065e777349370dd67cc1f55f21e58814b` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.diff-privacy.test.tsx` | 215 | `a11075665990e45bd632bdf358727072cc5dac35a28089c832fd3348e5c8f479` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.diff-states.test.tsx` | 223 | `0c7f5f11071520190a629e79a144451dfc192139d28b9a4aedf7ada1c556d7c9` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.in-flight.test.tsx` | 269 | `9d9e01b54fafab049c559409b6efaf96746ccadcfcb60fe353afc1a34b8580a8` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx` | 368 | `478a0bc25bdb81151870e64547f185a83999e762d22ae48077baef6a213dd22f` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.list-refetch.test.tsx` | 262 | `1e725e8d0d0e512abe04a7770c8a64e43b34fd72602afbfaac9ba17984dcf507` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.privacy.test.tsx` | 117 | `ac9dfa48b9fdc076adb34fb56082b944a352fe5e83f3f0594b17589fdc6aa097` |
| NEW | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.read-deadline.test.tsx` | 161 | `002cec6e139c310210523d20734516083df925531537ef3b7b6d70c6c25ce661` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.reconcile-edges.test.tsx` | 255 | `a97893502863a4785a309bf5ad8b119b525993c0ad2bc5cd9dc075b51e0f3746` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.reconcile.test.tsx` | 289 | `12ab36073eaecbe11023a69d227ab2616017e183237ea7db4d3157e2b9ce851d` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.refetch-lock.test.tsx` | 282 | `bd8ff9ad4b60746c6154acdfd05873b20e695f986826be1de38bbc8ea4e515d6` |
| NEW | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.registry-digest.test.tsx` | 246 | `7a70ffb1160c6107dc0fd22c96fca6cca8878684b1e4444568810e944c749f1d` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.selection.test.tsx` | 92 | `e83bf789bb6b75d17bf3159070568e7aee8ba5f9fa2d71fef4bd67aa707b1406` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx` | 257 | `19c010bfc12e704b072717ca0aad1ece2d4ed35763c37fe3a21216ce2017307e` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.unverified-hold.test.tsx` | 271 | `690f91d3b6bd03fc68f614990e63972eb778be5fe3134cae7768337fc44543cf` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx` | 391 | `e3759a91625d2ef9d7c0284c38abc95493d3f795a841f62593c20e6bc645b97a` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.states.test.tsx` | 309 | `2619bd4fdd5cd5132af88681c2f257915adbe93c7a80229d8fe99f9c8b347f13` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.tsx` | 198 | `482c5b802ed7644dea65294ec307d9915295af28b437651cf3d32b283df9fa12` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsPatternSelector.tsx` | 127 | `0eadc2e0ebfed88d3e0b02182ecbab52c6fa6280b6c2f2146f779883b8f5ed6a` |
| MOD | `apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.states.test.tsx` | 344 | `2931a2497f0463cca86e4125cf37f6155cc6d48baed0412e99198cc67ae5719b` |
| MOD | `apps/web/src/components/cms-composition-instances/README.md` | 139 | `c73ecf195953d87c5effb1dbac4116981aa7888a0ca191d0d4f318f184ea60b9` |
| MOD | `apps/web/src/components/cms-composition-instances/composition-copy.ts` | 133 | `bf83f49240e6dbb1ed1bda1f0651b62faad51c767df540e007903d65e820b318` |
| NEW | `apps/web/src/components/cms-composition-instances/composition-list-model.test-support.ts` | 46 | `0c795321b03ee28d6778449cb0b0b3c1bb1173e2b961121da0a09888b9160af8` |
| MOD | `apps/web/src/components/cms-composition-instances/composition-page.test-support.tsx` | 231 | `e2b308a7f1800164679bb00d704a98633919822c9648bfd04ccbb0f41f0119d4` |
| MOD | `apps/web/src/components/cms-composition-instances/composition-refetch.test-support.ts` | 40 | `7f710990eb8c9207eaebb576694156a2775fd2fb93fa8b655356070d771ec6b5` |
| MOD | `apps/web/src/components/cms-composition-instances/composition-rows.ts` | 116 | `62ecb11b1047ef772f66d4e48a6bbfe9aa0d3b2d4ff3d2bc5600133c40f02297` |
| NEW | `apps/web/src/components/cms-composition-instances/composition-selector-reread.ts` | 45 | `fbf2c434a642feacf99f01d631905f20cd3159ee57c0b9d64fa5031de79c3ac5` |
| MOD | `apps/web/src/components/cms-composition-instances/composition-transport.test.ts` | 323 | `16445c1874105036b7659164b9111bba0de857dbf381b78157ab746b76831190` |
| MOD | `apps/web/src/components/cms-composition-instances/composition-transport.ts` | 252 | `836910ad3ee85ad8044699e2c62eeaaf0a026c248a1fcb5d1bf1bdc09ac389ff` |
| MOD | `apps/web/src/components/cms-composition-instances/composition-types.ts` | 62 | `3e03b4db23abab8344c15a92d0fca50cc9c92a20afc35f012ec28884f391e0dc` |
| NEW | `apps/web/src/components/cms-composition-instances/composition-update-diff.test-support.tsx` | 94 | `6dbc99a93cb469c2a81deb8e6cb53465f7cdc0a919267311c657b0170f25c8e3` |
| NEW | `apps/web/src/components/cms-composition-instances/use-composition-insert.load-more.test.tsx` | 116 | `5b2a191f7e4d7a15ff9a3e6e68f2bd7368e5acd4e5591404121c958a8cf33850` |
| MOD | `apps/web/src/components/cms-composition-instances/use-composition-insert.ts` | 278 | `b4c61ee3f10415d981edd9c974119eb481b47b7db63568137bdfca52f6bd4250` |
| MOD | `apps/web/src/components/cms-composition-instances/use-composition-new-roots.test.tsx` | 120 | `409ccb7b661fc1a9fafa1bb061c277dfa7e77df35d3920be6bbb29baf51fc91d` |
| NEW | `apps/web/src/components/cms-composition-instances/use-composition-selector-reread.ts` | 48 | `3784b761c55cf9d4b5b02365d2c4f42eef343cd037f61f7bec54471bd0583aed` |
| MOD | `apps/web/src/components/cms-composition-instances/use-composition-session.refresh.test.tsx` | 165 | `ad8c6ccf29b78c4cd8256fec4ee7056502f7767c1e4259fd9ae06148e2e6ba85` |
| MOD | `apps/web/src/components/cms-composition-instances/use-composition-session.ts` | 285 | `322fd4d1a7120cdbd16c9e13f7c9a2b4d916d5081569ea19311008b427ed270d` |
| MOD | `apps/web/src/components/cms-composition-instances/use-composition-updates.completion.test.tsx` | 87 | `d70203e340dc95070db9111384080c96f993c24caa8a9af98c6fc3414247c9fd` |
| MOD | `apps/web/src/components/cms-related-content/CmsRelatedContentForm.auto-refetch.test.tsx` | 265 | `4e579b75436e3c8619ffc39cfa9baa7376ce04dd8d56a8f9f7a17abcefb2041e` |
| MOD | `apps/web/src/components/cms-related-content/CmsRelatedContentForm.candidates.test.tsx` | 206 | `a5d5418c4b11ec1564c4ae049faea0bd4897a23c3a96a3d394e7dfb209308d55` |
| NEW | `apps/web/src/components/cms-related-content/CmsRelatedContentForm.closing-words.test.tsx` | 140 | `b9a5fa9dbc059a99b4fe4dcb3c862bf7c0fc5cea985c27e8855be7266e0c25a0` |
| MOD | `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx` | 280 | `89bbc40a151047711b1db4550a8fb0a92654c3d27e32a85676692e5f7ca2379a` |
| MOD | `apps/web/src/components/cms-related-content/README.md` | 121 | `852ede73e181310bd14bc4a052eb6baf58818ba1e68857447bc030c819192724` |
| MOD | `apps/web/src/components/cms-related-content/related-candidates.test.ts` | 228 | `0976c064c87e93beffba682f5d51a7a838b431a0a91175b2a1a38b905da27963` |
| MOD | `apps/web/src/components/cms-related-content/related-candidates.ts` | 205 | `7c88e77c6f04e92d2b549f02a3b311d30104035925d6e7324909ab22d9cb3519` |
| MOD | `apps/web/src/components/cms-related-content/related-conflict-read.ts` | 225 | `1d6776e776f7c24640f0ffcb0cff36d5c53afa177c10d898391f6035e5e316d8` |
| NEW | `apps/web/src/components/cms-governed-review/CmsGovernedReview.closing-words.test.tsx` | 153 | `ad00155158a7f3ab8646f99a9a0af3855bc940652b1d5d0ecb6ae91935f79e46` |
| MOD | `apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.states.test.tsx` | 359 | `7bfca882630f72a42fe6715bf01f08f5d742d76320515f931cc7585f6e96af52` |
| MOD | `apps/web/src/components/cms-governed-review/CmsGovernedSubmitForm.states.test.tsx` | 272 | `b08036d9e19449060615823ffb485cd7a821cab7d6acf4d7e56ffac2201a9edc` |
| MOD | `apps/web/src/components/cms-governed-review/README.md` | 148 | `f2440c12e642739f5aa801f57ba57b70c903adca1aa84d822b9462d59f4db021` |
| MOD | `apps/web/src/components/cms-governed-review/governed-review-canonical-read.test.ts` | 181 | `ad1132c6bf851e7e2dc47a95a2671db92e424ac574bca458afc747fcc0624b69` |
| MOD | `apps/web/src/components/cms-governed-review/governed-review-canonical-read.ts` | 170 | `ae2dd5dfdbe5351680333ea70ff7d265c41377ea2c2b57fc303668718b14f8fb` |
| NEW | `apps/web/src/components/cms-governed-review/governed-review-page-mounts.test.tsx` | 280 | `1237d3f2e4abcc1228a46b2c65d90feb120d1aad5f87eaf175a4a2814a2b1d90` |
| MOD | `apps/web/src/components/cms-governed-review/load-governed-queue-page.ts` | 115 | `cdab172fa8f50c30c68b7611d93dc04d0288437940b2468cd3610b86b3e23aef` |
| NEW | `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-on-demand.test.tsx` | 87 | `cc3fa6d0e66e3b2e1bda72f34cc27448ae9d0c09c86aca694de32b9514ba42c4` |
| MOD(shared) | `apps/web/src/components/cms-taxonomy-designer/README.md` | 82 | `9aaeade6ae83f64d5ed017804926d4ddcc74172dda7fa241ce06ca1e9d1b1de7` |
| NEW | `apps/web/src/lib/run-read-under-deadline.ts` | 23 | `5acd10042eb3be38f624aa4be57afa5eef93ea80868a610a8f6d744e9d4001bb` |
| NEW | `apps/web/src/lib/run-read-under-deadline.test.ts` | 57 | `320ef2fa4b78c7f40a2602f36d0478bebcbdbf85cbad9c9dbfd995e0d02a16ef` |
| MOD(shared) | `apps/web/src/lib/README.md` | 91 | `784f0f190ecf3f3db94f437df36ddf1658fb0ae43e529783cdea958a42bb6ffe` |
| NEW | `docs/handoffs/2026-10-22-claude-s12/recite9/web9b-proposals.json` | 338 | `b1ee39d488c88bde3b39866b9d1f3d6d8e8a4d253ccc4029973bc85d298efb47` |

## Runs

All in the foreground, `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`, worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

| Run | Result |
| --- | --- |
| Cold `vitest run apps/web` (`node_modules/.vite/vitest` removed; the single command exceeded 570 s on a loaded host, so run in four chunks that together cover all 824 test files) | 824 files, 9,195 tests, 9,195 passed, 0 failed, 0 skipped (chunks 147/1,522 + 174/1,665 + 251/2,381 + 252/3,627). JSON in the scratchpad. After the last test additions: my directories + `lib` + `cms-taxonomy-designer` + `pages` + the proof and closure files, 216 files, 2,110 passed, 0 failed. |
| `vitest run tests/performance` | 13 files, 198 tests, 198 passed. |
| `tsc --noEmit -p apps/web/tsconfig.json` | exit 0, 0 errors (final run 22:48). |
| `eslint` on `cms-composition-instances`, `cms-related-content`, `cms-governed-review`, `taxonomy-versions-on-demand.test.tsx`, `lib` (`--max-warnings=0`) | exit 0. |
| `prettier --check` on the same directories, `cms-taxonomy-designer`, the pages and the READMEs | clean. |
| Changed-line coverage (v8, 149 files / 1,531 tests, changed lines = diff against the tar taken at my start) | 15 production files, 0 uncovered changed statements, branches or functions (script `changed-cov.py`; the first run reported 16 uncovered items, which I closed with tests; the script was checked to detect them). |
| Import cycles (Tarjan over the runtime relative imports of the four directories + `lib`, 348 files) | 0 SCCs. |
| Component/hook/test sizes | every file within 200 / 300 / 400 lines (largest: `CmsPatternInsertForm.tsx` 198, `use-composition-session.ts` 285, `CmsCompositionPage.update.test.tsx` 391). `CmsPatternUpdateDiff.states.test.tsx` had reached 406; its fixtures moved to `composition-update-diff.test-support.tsx` (no title or file of a cited test changed): now 356. |
| Mutation / revert checks (scratch script, file restored and SHA-verified after each) | M1 2 fail, M2 1, M3 9, M4 5, M5 5, M6 5, M7 2, M8a 3, M8b 3, M9 9, M10 1, M12 2, M13 1; all fail with the guard removed. |

### Bundle

`flock /tmp/wejammin-web-build.lock sh -c 'pnpm build ... && cp -r apps/web/dist <scratch>/dist && node scripts/verify-bundle-budget.mjs <scratch>/dist'`
at 22:42 UTC (the tree includes web9a's work at that time). **Gate exit 1**: `CMS pattern edit initial route exceeds 92160 gzip bytes: 93212`
and `CMS taxonomy edit initial route exceeds 92160 gzip bytes: 92902`. The other CMS routes pass: composition 83,875, related content 78,705,
definition review detail 75,618, definition review queue 1,954, template edit 84,831, template create 79,378, pattern create 88,288, taxonomy
create 76,188, locale 90,624, entry editor 90,895 (all of `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_web9b/bundle.json`). Attribution: the initial assets of the two failing routes contain
`read-within-deadline.*.js` (imported by web9a's `pattern-latest-fetch`, `pattern-latest-read`, `use-registry-context`, `taxonomy-terms-fetch`,
`taxonomy-terms-read`); none of the chunks I changed (`governed-review-canonical-read`, `run-read-under-deadline`, `composition-*`,
`related-candidates`, `related-conflict-read`, `load-governed-queue-page`) is in either initial route; they appear only in the lazy sets. I did not
run a counterfactual build (it would have meant editing files web9a builds from). No budget change; nothing new was added behind
`CMS_ON_DEMAND_CHUNKS` (nothing of mine is in an initial route).

## Test corrections (old to new; none weakens; each keeps its title and file unless stated)

1. `CmsCompositionPage.insert.test.tsx`, it.each "says what a typed 422 %s means": added `[SELECTOR]: [json(selectorPage([hero]), 200, '"7"')]` to the script. Reason: the digest refusal now reads the selector (DEC-246(5)); unscripted it answered 503 and the first `[role=alert]` was the selector's.
2. `CmsPatternInsertForm.states.test.tsx`, it.each "422 %s renders fixed copy": the digest row's sentence "...Reload the page and choose the pattern again." became "...The pattern list was read again and your input is kept; check it and place again."; the script gains the selector read. (BE03c 388 and DEC-246(5); the 422 status is kept because the oracle uses it.)
3. `CmsCompositionPage.reconcile-edges.test.tsx` (4 rows) and `use-composition-session.refresh.test.tsx` (1 row): `expect(page.lists).toHaveLength(1)` / `expectListRefetches(page, 1)` became 0 reads, plus (refresh) unconfirmed still true and rows unchanged. Reason: a page that has gone away reads no list (refute8b BLIND).
4. `CmsGovernedReviewQueue.states.test.tsx` degraded it.each: retitled from "(kept half of the cell, see DEFECT D1 ...)" to "(DEC-242(1), FE03 1018/1630) ... renders the closed notice with Retry at the same list position, ..." (retitle map in the proposals); now also asserts the Retry link.
5. `CmsRelatedContentForm.auto-refetch.test.tsx` (2 rows), `CmsRelatedContentForm.conflict.test.tsx` (2 rows): added assertions only (read attempted; review section shows the saved rule).
6. 62 composition tests: added `expectListRefetches(page, n)` (or `expectListRefetches(x, 0)` for the unmounted and unread cases); `composition-page.test-support.tsx` gained the list model, the registry, `cache`/`credentials` on `Call` and `allowUnscriptedLists`.
7. `CmsPatternUpdateDiff.states.test.tsx`: fixtures moved to `composition-update-diff.test-support.tsx` (size limit); no test body changed except the new assertions.

## Spec citations

FE03 1042 (closing words), 1046-1050 (state table), 1048, 1173 (network and retry), 1018/1630 (queue), 1224; BE03c 388 and DEC-186 (digest 409), 1414 (selector cursor); DEC-193, DEC-206, DEC-241 to DEC-245, DEC-246 (the five rulings; owner may override).

## Defects found

D1. `apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.ts:243`: the command POST sends `credentials: 'same-origin'` and `redirect: 'manual'` but no `cache: 'no-store'` (the reads of the same family send it). Outside my claim. The one-line fix is `cache: 'no-store'` after `credentials`; then add `cache: 'no-store'` to the `toMatchObject` in `CmsGovernedReview.closing-words.test.tsx` (comment in the test names it). A POST is not cached by a browser, so the closing words hold in effect.
D2. `load-governed-queue-page.ts`: a 200 queue page that is not the strict page offered no Retry (FE03 1018/1630, DEC-242(1)). Fixed.
D3. `refreshList` (and so the 409 and reconcile paths) read the instance list for a page that had gone away. Fixed.
D4. A stale-digest placement had no way to refresh the selector. Fixed (m9).

## Open items / BOUNDARY

- Not given a deadline (outside the claim or not a read of my islands): `cms-workflow-reviewer-options` and `cms-workflow-canonical-read` in `cms-editorial-workflow/`; `readTaxonomyVersions` and the term reads (web9a).
- AC-069: see above (Astro pages are not renderable under the plain config). A fully faithful page render needs an Astro-plugin Vitest project or a Playwright project; root's call.
- `read-within-deadline.ts` (web9a) rejects with `Error('read deadline')`; `runReadUnderDeadline` swallows it into the caller's failed value. If web9a changes that contract my wrapper changes with it (its test pins the behaviour).
- `Call` (the scripted wire's request record) gained `cache` and `credentials`; the full suites above are green, so no test depended on its exact shape.
- No raw memory records written (a lane may only write its report); candidates for root: "a hook-level guard that React makes unobservable (setState after unmount) is BLIND until the guard also gates a request"; "a registry that fails tests which ignore a refetch finds the ignore-503 class in bulk (74 tests)".

## Requests to root

1. Apply D1 (one line in the shared command transport) and add `cache: 'no-store'` to the assertion in `CmsGovernedReview.closing-words.test.tsx`, or rule that the POST option is not required.
2. Bundle: the two failing routes are over budget through web9a's modules; web9a/root to move their deadline code behind `CMS_ON_DEMAND_CHUNKS` or otherwise below 92,160. Re-measure under the lock after.
3. Apply `recite9/web9b-proposals.json` (38 AC-271 rows, 2 retitles, 4 AC-069 rows) once refuted; retitle map: the two queue degraded expansions. Ledger citations whose tests I changed keep file and title (the one retitled test is the queue degraded it.each).
4. `recite7/web7-proposals.json` still carries four dead titles (refute8b item); not mine.
