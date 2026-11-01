# Lane claude_s12_web8b report

## Status

GREEN for the brief (2026-10-30), subject to the readings in "Open items". Related-content, composition and governed islands now follow the FE03 409 / unknown-outcome / success-refetch cells; `reviewer_not_eligible` refetches; V17 N1, N5 and N7 are closed. Nothing is marked done in any ledger. No Playwright, db, supabase, docker, race or git-writing command was run; no sub-agent was spawned. Shared hooks edited: none (every hook I changed lives in my three directories; `createWorkflowCommandController`, `cms-workflow-refusal.ts` and `useCanonicalResource` were read, not edited).

## Scope

Brief `briefs/gaps-wave8.md` section web8b, lane rules, DEC-241/242 and the M1 reading (a control that starts another command is disabled while one is in flight; inputs stay editable; values typed meanwhile survive). Claim: `cms-related-content/`, `cms-composition-instances/`, `cms-governed-review/` and their tests.

## Per-cell table

| Cell | Island | Result | RED seen |
| --- | --- | --- | --- |
| A2 409 refetched automatically, values kept and compared | related content form | FIXED: the 409 starts the draft-then-rule read by itself (`use-related-content-form.ts`: `conflict.review()` after `requireReview()`); Review changes remains to read again after a failed or limited read | yes (`CmsRelatedContentForm.auto-refetch.test.tsx`, 1 of 2 409 rows failed before the fix) |
| A3 unknown outcome reconciled by a read BEFORE any retry | related content form | FIXED: pending label "Checking whether the save went through…", Save off; recorded -> shown as saved; not recorded -> "Save not recorded" and the identical retry (same key); read failed -> Save off, Check again (429 holds both) | yes (3 rows failed before the fix) |
| A4 success refetch | related content form | FIXED under a reading (below): a verified save reads the saved rule once more and takes its entry token as the next version; an unverifiable refetch keeps the verified save | yes |
| B5 instance list refetched after a verified command and after a 409 | composition: insert, accept, detach, new blocks, bulk | FIXED: a browser read of the DEC-206 list exists as a proxy (`apps/web/src/pages/api/v1/cms/entries/[entryId]/compositions.ts`, GET, lines 1-14), so nothing was missing from the platform; new `composition-instance-list.ts` walks the signed cursor (budget 20 s, repeated-cursor guard, strict structural page check, zod-free) and `refreshList` replaces the rows with the server's render order; a list that cannot be read keeps the rows held | yes (6 of 9 `list-refetch` rows failed before the fix) |
| B7 unknown outcome of accept / detach / new blocks / bulk | composition | FIXED: same pending label, entry AND list read (`reconcileUnknown`, entry read is only shown so the retry is the byte-identical request under its key), then "Result not known" with the sentence the read supports; retry only afterwards. The insert already did this for the entry; it now shares the session helper | yes (5 `reconcile` rows failed with the old branches restored) |
| B8 bulk 409 | composition bulk | FIXED: refetches the entry, the list and the unapplied diffs (a diff is never kept), keeps the selection, says how many requests applied; a diff that cannot be re-read says so and no stale diff stays | yes (same 5 rows) |
| `reviewer_not_eligible` | governed assignment | FIXED: the one uniform sentence at the reviewer field plus a refetch of the review (`governed-review-refusal.ts` + a once-per-refused-state effect in `use-governed-review-command.ts`, because the shared controller refetches on the SHARED classification) | yes (unit + 2 component rows failed) |
| Decision / assignment / activation 409, unknown outcome, success refetch | governed forms | ALREADY MET by `createWorkflowCommandController` (409 reasons of the shared table refetch; an unknown outcome reconciles by refetch and offers the retry only when `reconciled`; success refetches the review and moves focus). No change needed; evidence rows already exist (`*.states.test.tsx` 409 / degraded / success rows) | n/a |
| V17 N1 selection toggled during a command | composition | FIXED: functional `setSelected` in `prune` and `runSequence`; only applied ids leave the selection | yes (2 rows, old code restored) |
| V17 N7 focus after "Read the review again" | governed detail | FIXED: the control stays mounted (`aria-disabled`, same label) while the read runs, the notice says "Reading the review again…", a verified read the person started moves focus to the restored summary heading and announces "The review was read again."; a 429 auto-read moves nothing (`use-governed-reread.ts`) | yes (2 rows failed) |
| V17 N5 two over-claiming rows | composition in-flight | RETITLED to what they assert (below) | n/a |

## Readings and decisions for root (small)

1. A4 for the related-content form: FE03 1047 says "the review, subject and lists are refetched"; the form's lists are local, so I read "subject" as the entry's saved rule and refetch it (draft then rule, the same read as a 409 review), adopting its entry token as the next version. If root reads A4 as already met by the verified 201 resource, remove `refreshAfterSave` in `use-related-outcomes.ts` (one call in `use-related-content-form.ts`).
2. 409 `IDEMPOTENCY_MISMATCH` in the shared table renders "invalid" with no refetch; FE03 says "409 reasons render fixed copy and refetch". It is not a reason of the cell, I left it; say if you want it refetched too.
3. Unknown-outcome retries never adopt the entry version the reconciling read saw (insert's existing rule, now shared): the retry stays the identical request. If the read shows the entry moved, the sentence says so and a retry may answer 409, which then refetches.
4. An unknown outcome whose reconciling read cannot verify keeps Save off and offers Check again in the related-content form (nothing in FE03 names this control; it is the only way to keep "reconciled before any retry" without a dead end).

## Test corrections (each rewrites a test that scripted the old behaviour; exact diff: `lane-web8b-test-corrections.diff`)

Spec: FE03 1047 (success refetch), 1049 (409 reasons refetch), 1050 (unknown outcome reconciled by a refetch before any retry), 884 (`reviewer_not_eligible` uniform copy), DEC-242 (409 / unknown-outcome stay defects until fixed per island group, `reviewer_not_eligible` refetches).

| File | Old test (claim) | New test |
| --- | --- | --- |
| `cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx` | "409 reviewer_not_eligible renders fixed copy at the reviewer field (no refetch is made)", `refetch` 0 times | "...renders the one uniform copy at the reviewer field and refetches the review (FE03 884, DEC-242)", `refetch` 1 time; same sentence and field link asserted |
| `cms-governed-review/CmsGovernedAssignmentForm.test.tsx` | "shows one fixed message for an ineligible reviewer and names the other refusals" with `reviewer_not_eligible` refetches 0 | retitled "...refetching the review like the other 409 reasons..."; 0 -> 1 |
| `cms-composition-instances/CmsCompositionPage.in-flight.test.tsx` (V17 N5) | "...Review stays disabled while an accept is in flight, the pending label holds and the open review survives the answer" | "...a click reads no diff, the pending label holds and Review is enabled again after the answer" (what it asserts) |
| same file (V17 N5) | "insert fields edited after dispatch survive the placement answer and keep the form dirty" | "...survive the placement answer" |
| `CmsPatternInsertForm.states.test.tsx` | "success (kept half) ... no refetch of the entry or list is made (C5)" | "success (test correction, FE03 1047) ... and the instance list refetched from the protected read"; asserts `lists` has 1 read, entry still not read |
| same | "409 %s ... refetches the entry and keeps the input" (2 rows) | "...refetches the entry and the instance list and keeps the input"; asserts the list read |
| `CmsPatternUpdateDiff.states.test.tsx` | "success (kept half) ... no refetch of the entry or list is made (C5)" | "success (test correction, FE03 1047) ... instance list refetched after each command"; 2 list reads |
| same | "degraded (kept half) ... no entry refetch precedes the retry (C7)" | "degraded (test correction, FE03 1050): pending label while the entry and the list are read, never a guessed result, only then the retry, same key" |
| same | "409 %s ... refetches the entry and the diff" (2 rows) | "...the entry, the instance list and the diff"; asserts the list read |
| `CmsBulkUpdatePanel.states.test.tsx` | "success (kept half) ... no refetch of the entry or list is made for a single request (C5)" | "success (test correction, FE03 1047) ... no entry read for a single request, and the instance list refetched" |
| same | "error (kept half): 409 %s ... the entry is not refetched (C8)" (2 rows) | "error (test correction, FE03 1049): 409 %s ... refetches the entry, the instance list and the unapplied diffs" (script gives the second entry, list and two diff reads; asserts 1 entry, 1 list, 4 diff reads, 2 selected) |
| same | "degraded (kept half): ... renders no pending state and makes no refetch before a retry (C7)" | "degraded (test correction, FE03 1050): pending label while entry and list are read, nothing assumed, selection kept, retry only then under the same key" |
| `CmsCompositionPage.bulk.test.tsx` | "stops at a failed request, says how many were applied and leaves the rest selected" (409 followed by the stale 8 diffs) | "[AC-271] commandState error (test correction, FE03 1049): stops at a 409 request ... refetches the entry, the list and the unapplied diffs, and leaves the rest selected" (script adds the 8 diff re-reads and the second entry read; asserts 2 entry reads, 1 list read, 48 diff reads) |
| `cms-composition-instances/use-composition-updates.completion.test.tsx` | `afterRefusal(answer, heading, keep)` | signature only: the sent entry version is a fourth argument (`'9'`); assertions unchanged |
| `cms-composition-instances/composition-page.test-support.tsx` | `scriptedFetch` records every request in `calls`; an unscripted one throws | instance-list reads (`GET /api/v1/cms/entries/{id}/compositions`) are recorded in `lists`, not `calls`, and an unscripted one answers 503 (the rows held are kept); every other request is unchanged. The suites that pin the command / entry / diff sequence keep their `calls` assertions; the list refetch is pinned in `lists` by the new suites and by the corrected rows above |
| `cms-related-content/CmsRelatedContentForm.conflict.test.tsx` (4 tests) | pressed Review changes after stubbing the wire | the wire is installed BEFORE the save (`conflicted(submit, wire)`); no press; assert the 409 read draft then rule by itself, Reapply offered, no further save, no mutation header; the failed-read, malformed-read, no-current-version and 429 rows run on the automatic read |
| same file (first row and 429 row) | "...offers Review changes" / "...disables Review changes until the 429 wait elapses" | retitled "[AC-271] test correction (DEC-242): ...", assertions kept (the button remains for a re-read) |
| `CmsRelatedContentForm.conflict-admission.test.tsx` (2 tests) | pressed Review changes to start each read | the 409 starts each read (`conflictedDraft(submit, wire)` in `related-conflict.test-support.tsx`); native submits stay blocked during both held reads; the second 409 starts a fresh two-stage review by itself; the final assertion counts the success refetch (3 reads) |
| `CmsRelatedContentForm.states.test.tsx` | "409 ... it is NOT refetched automatically (D2)", `fetch` never called | "...refetches the draft and the saved rule by itself and withholds the save until the person reapplies"; asserts the two reads and Reapply |
| same | "degraded (kept half): ... nothing is refetched before the retry (D3)", Save enabled at once | "degraded (test correction, FE03 1050, DEC-242): reconciled by a read of the saved rule before any retry; retry replays the same key"; asserts the reads, "Save not recorded" copy, Save enabled afterwards |
| `CmsRelatedContentForm.save.test.tsx` (2 idempotency rows) | second Save right after an unknown outcome | the reconciling read is stubbed to find nothing recorded; the second Save is the retry (same key / new key after an edit) |

Not converted, and why: `CmsRelatedContentForm.conflict-lifecycle.test.tsx` and `.conflict-bindings.test.tsx` press Review changes after a 409 whose automatic read failed at once (no wire); they pin the cancelable, deadline-bound read, which the press and the automatic start share (`useRelatedConflictReview.review`). They pass and assert nothing false.

## Runs

All vitest, no Playwright, db, supabase, docker, race or git-writing command. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin`.

| Run | Result |
| --- | --- |
| RED runs (before each fix, per cell; the failing rows are named in the table above) | governed: assignment form 2 failed, then 2 failed on the refusal change alone (the shared controller ignores the governed refetch), then green; N7 2 of 3 failed; composition `list-refetch` 6 of 9 failed; `reconcile` 5 of 5 and `selection` 2 of 2 failed with the old branches restored from a scratch copy (`scratchpad/claude_s12_web8b/good/`), green after restoring; related `auto-refetch` 5 of 7 failed |
| `vitest run` on `cms-related-content`, `cms-composition-instances`, `cms-governed-review` (final) | 122 files, 1,287 tests, all passed |
| `vitest run apps/web` (full) | 787 files, 8,957 tests, all passed (started before the `CmsGovernedDecisionList` extraction; the governed directory was rerun after it: 55 files, 597 tests, all passed) |
| Changed-line coverage (v8, statements and branches of every changed line of tracked files and of every line of the new source files, 24 files measured before the `CmsGovernedDecisionList` extraction, a verbatim move covered by the detail suites) | 0 uncovered; tracked files that I did not change (`use-governed-activation-form.ts`, `use-related-conflict-review.ts`) are ignored |
| `tsc --noEmit -p apps/web/tsconfig.json`, `eslint` on the three directories, `prettier --check` | clean |
| N8 resolver over `recite8/web8b-proposals.json` against the final passing run | 69 of 69 rows resolve |
| Size limits | every changed file is within its limit (components <= 200, hooks <= 300, tests <= 400); `use-composition-updates.ts` was split (`use-composition-new-roots.ts`), `use-related-content-form.ts` was split (`use-related-list-edits.ts`, `use-related-outcomes.ts`), `CmsGovernedReviewDetail.tsx` shed its decisions list (`CmsGovernedDecisionList.tsx`) |

## Files (path, lines, SHA-256 at the end of the lane)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-composition-instances/CmsBulkUpdatePanel.states.test.tsx` | 339 | 4eddf0cba3be927c7ea480d75d09f6bd962ef9cb631f0eeb0fec1c66f15c0c7e |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.bulk-edges.test.tsx` | 231 | 8cfb80a039957f006392c4d07bb4bb3dcf41cbba240c93e6a63e9823b0059f07 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.bulk.test.tsx` | 258 | 5e42ffc79ef2ed25f4288cf81596fb04cc9cfa7986cb0c8674f388fda79d9444 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.in-flight.test.tsx` | 263 | 2bd32ada84e9a468477039d688f87726bf75974e5f228bc86612cd48fc90e2db |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.list-refetch.test.tsx` | 213 | f7ec37980fc60f33c6503253ea3c2d4bbe98e37645bd2b32d8d287a3a7ca4e9c |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.reconcile-edges.test.tsx` | 249 | 5acfac9aa776b5aad15aa7b98549191afe8d825175a6ac38005e8ce93c29fcfd |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.reconcile.test.tsx` | 284 | 351a62785ef5e41a494462e5f4c44a69006748d4536e59d70482147bc49e74d4 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.selection.test.tsx` | 89 | deff83dabe055949bc4b4ed371caa389859baae159ddfe5be9ec876f26991b90 |
| `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.states.test.tsx` | 293 | 8c14c59fc324b4e387cd796a8dcfebb828f1e5ff16c7fe4a936ada942a35f68d |
| `apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.states.test.tsx` | 400 | 376052edfe6e0742bd1c8250c068c998e9d2df669ae6994ae9ea02047a4de6c3 |
| `apps/web/src/components/cms-composition-instances/composition-copy.ts` | 116 | 8c490feb3944b103036c7b1da3782f2ae018ecce20bbdd8ca110a4fb9cfb96bf |
| `apps/web/src/components/cms-composition-instances/composition-instance-list.test.ts` | 96 | c0ac6f5c8a009eca93c6517985c033e2f57ef00bce35f28235d31b4ac54dd866 |
| `apps/web/src/components/cms-composition-instances/composition-instance-list.ts` | 94 | c203df44b3265c7c260c22d45cf88ac4f8448e8f66c4574a18b36695323c54cb |
| `apps/web/src/components/cms-composition-instances/composition-page.test-support.tsx` | 152 | 41681d31ef4a7204c6b1c994ed1542f1f99686c1375bb2f77b7c383158a9a22c |
| `apps/web/src/components/cms-composition-instances/composition-refetch.test-support.ts` | 20 | 892eeb962aa601ac6836eae63a2aeb8e404897af1f91491853cc046c06e976e3 |
| `apps/web/src/components/cms-composition-instances/README.md` | 111 | 0145d9afd494f46a74a3af07e04640215861d4d97403f3fcfbb0e9d91f83e5e6 |
| `apps/web/src/components/cms-composition-instances/use-composition-bulk.ts` | 256 | 8c54515bd9523741fa959458c2ed786907a517c753f6727dd5bc60d72b3fb290 |
| `apps/web/src/components/cms-composition-instances/use-composition-insert.ts` | 244 | 3f067abf38716e7ab5ba47a9be1d28d44874ae4c0f373131c38675c236ac5318 |
| `apps/web/src/components/cms-composition-instances/use-composition-new-roots.test.tsx` | 120 | 3d1593be72dca57c353dd18bce358d708e87c5c9d9a61d8a8fb5d13c4d03a745 |
| `apps/web/src/components/cms-composition-instances/use-composition-new-roots.ts` | 101 | 6ae4b550f45c0b026811810bf009612846d44ee6913a5692fab332262335a710 |
| `apps/web/src/components/cms-composition-instances/use-composition-page.ts` | 90 | 448288c0030e709fb2576ad9d33f8ada3424d6266f6382f03255467e3c286568 |
| `apps/web/src/components/cms-composition-instances/use-composition-session.ts` | 208 | 799970cccb754ffa0841a652054bc0f6178c3f02e372264dd17976bb31946ec0 |
| `apps/web/src/components/cms-composition-instances/use-composition-updates.completion.test.tsx` | 84 | c5c9eabf5de20c2320c97ae19d7ad563ed51b142c4d1d5c720879f55ffbcfb68 |
| `apps/web/src/components/cms-composition-instances/use-composition-updates.ts` | 290 | 6bdb8ed3f263141d6d4c7cd195cf7fa6eb2eadeb138ef204d9d12936c25432ff |
| `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.states.test.tsx` | 327 | 5be4d5c4290259c042526df790ea9d5dc866295aff8edf4ea763f1edea4acbb0 |
| `apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx` | 399 | 751923566bbdbf822d2bcc2b72eba305b7409c5aa1ae77be7797b29fa4a950fb |
| `apps/web/src/components/cms-governed-review/CmsGovernedDecisionList.tsx` | 43 | 47c6a90c13a56bbdce40aaa6579c1f56812da13efc1117d91a8c525c20595b5f |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDegraded.tsx` | 38 | ffbbcfa176d3447b0d0e56a4c77423cfca9e005480c3f4fb75392520ff9d8029 |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.reread.test.tsx` | 247 | 9f23e397973cce9283ed25be4be69ed59507ffbf16ce49e22dd92100cbf36f73 |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.tsx` | 182 | 490d4d11cffd514e2857b3aac47b42e1bc3b9c359ea594d8ecf89ce4aa60ea68 |
| `apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.tsx` | 186 | f0e288cff4a3e63c9920128608ce50ced89eb8009749a8488233916b4242dbe9 |
| `apps/web/src/components/cms-governed-review/governed-review-refusal.test.ts` | 117 | f4f88944b935dc4a2e0e4c731c59370cb856d18ae2cfc79fa4168530dd7adaec |
| `apps/web/src/components/cms-governed-review/governed-review-refusal.ts` | 67 | 84c71a06aed8e7447b114fa4c3881d634f9bd1b2c359ccae2a0022d12b2fe2a7 |
| `apps/web/src/components/cms-governed-review/README.md` | 142 | 5fc1da545142b9501b49eb0cd2c77a37b9be2a19a959c08df133d82f1718ac52 |
| `apps/web/src/components/cms-governed-review/use-governed-reread.ts` | 48 | c7c4d69a563412313988fb13b49efd5e507e92ed00b70c19f90aecf891abc6c0 |
| `apps/web/src/components/cms-governed-review/use-governed-review-command.ts` | 128 | c1b11b8b136a6549967f36122c30cb5aff7e75df0fc71a7c50e9942378d84c57 |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.auto-refetch.test.tsx` | 258 | 09e8cfa8c734f0e79a366decc9d39220f2548e8cf396aad547dd3c4d385bfe71 |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict-admission.test.tsx` | 154 | c713a1b4a75fc6e19fc5d54a62d9babeba0443d9c7c658bd8b6e716007fc960a |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.conflict.test.tsx` | 272 | d84004c719bc46dffce44d55f21965214da86f4934c27becaa7c893393c5d5ce |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.save.test.tsx` | 309 | ebd8a219625fe7a11b00086e63252d483fb17fc0e3ccefe9d4b6f68d10f2d9e8 |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.states.test.tsx` | 336 | 208f6b3aefbf5084cc7fd66458834a327a62ef580fda9427de681ce8f525701c |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.tsx` | 155 | 28efb7a51ccaa48f701913a523745fa23a7b57af0e4a32d94c004b501798c173 |
| `apps/web/src/components/cms-related-content/CmsRelatedStatus.tsx` | 172 | 8500359164e6f5d4debef466410ab1f673050f4958382f8f9ca5eeb227a01196 |
| `apps/web/src/components/cms-related-content/README.md` | 111 | cdaafc486d9ece23bebd23f93e447d1c7551f06b7d0ed5237f607d2a9da4822e |
| `apps/web/src/components/cms-related-content/related-conflict.test-support.tsx` | 213 | 2e9cd5232ed0d5f99c930f15f260f1c85542da76a394193bd796aaff2d2bc16d |
| `apps/web/src/components/cms-related-content/related-reconcile.test.ts` | 169 | 566dfd04f935df509f8ef0fe45de94479f7a70566bdfac1df683e275058f3e80 |
| `apps/web/src/components/cms-related-content/related-reconcile.ts` | 83 | 604d67b7542492cb922cd9d2c394baeed1471cf2d66de1d5a86d954f40675a7e |
| `apps/web/src/components/cms-related-content/related-status-copy.ts` | 105 | f3fc99e96af3991adcdd6ac72d264eb7ccbc6c6b02692abd2fb910831eb4557d |
| `apps/web/src/components/cms-related-content/use-related-content-form.guards.test.tsx` | 121 | 5c8214163d9edf5e39a0ca4b4c994c707cc9715ad23f6ef6c2d01d4fcf4a8684 |
| `apps/web/src/components/cms-related-content/use-related-content-form.ts` | 271 | 17edb885bfdce4523ab4acd6e88a027761c5bc7929f9d5bcfd71e0027a643f37 |
| `apps/web/src/components/cms-related-content/use-related-list-edits.ts` | 93 | 5be2d61d80e31258ef162f933c5a814812cd01a235f6fbfc533d555ae2f02d09 |
| `apps/web/src/components/cms-related-content/use-related-outcomes.ts` | 102 | ff579e576a3f205220410647857738e5a98acb9f47ec766a86e8e403d5fb4c40 |

Also written: `docs/handoffs/2026-10-22-claude-s12/lane-web8b-test-corrections.diff` (the exact diff of every corrected test and test-support file) and `docs/handoffs/2026-10-22-claude-s12/recite8/web8b-proposals.json` (69 rows, AC-271 clause 0; `staleExisting` names the two N5 titles that moved).

## Defects found

- `useGovernedCommand` / `createWorkflowCommandController`: the controller refetches on the SHARED classification of a refusal (`classifyRefusalLazily`), while `classifyGovernedRefusal` only replaced the rendered copy. A governed classification that asks for a refetch the shared table does not could never act (`reviewer_not_eligible`; `subject_not_submittable` worked only because the generic 409 path refetches). Fixed in the hook by honouring the governed flag once per refused state; the shared controller is untouched.
- Before this lane the related-content form offered Save at once after an unknown outcome, i.e. before any reconciliation, and offered a 409 review only by press (FE03 1049, 1050).
- Before this lane an update command's unknown outcome (accept, detach, new blocks, bulk) said "Result not known" without any read, and a bulk 409 left stale diffs and an unrefreshed entry on screen (FE03 1049, 1050).

## Open items / BOUNDARY

- No BOUNDARY: every item of the brief had its spec line. The four readings above are the only judgement calls.
- Not touched (outside the brief): the `loading`/`degraded` parts of the web8a islands; AC-271 citation state (root's call per the "every island of that part" rule).
- The related-content form's 422 `related_target_ineligible` already links to the refused row; `derived_rule_unknown` names the rule; nothing changed.

## Requests to root

1. Run `pnpm build && pnpm bundle:check`. Bundle-relevant files: governed `CmsGovernedReviewDegraded.tsx`, `CmsGovernedReviewDetail.tsx` (now imports the new `CmsGovernedDecisionList.tsx`), `CmsGovernedReviewDetailIsland.tsx`, new `use-governed-reread.ts`, `use-governed-review-command.ts`, and `governed-review-refusal.ts` (it now imports `classifyWorkflowRefusal` from the shared `cms-workflow-refusal.ts`; check that the governed refusal chunk does not pull a second copy of the shared table, P2-S11-AC-106); composition `composition-copy.ts`, new `composition-instance-list.ts`, `use-composition-session.ts`, `use-composition-insert.ts`, `use-composition-updates.ts`, new `use-composition-new-roots.ts`, `use-composition-bulk.ts`, `use-composition-page.ts`; related `CmsRelatedStatus.tsx`, `CmsRelatedContentForm.tsx`, `related-status-copy.ts`, new `related-reconcile.ts`, `use-related-outcomes.ts`, `use-related-list-edits.ts`, `use-related-content-form.ts` (all but `related-reconcile.ts` and the status copy are tens to a few hundred bytes; the related closure stays zod-free: `related-content-static-closure.test.ts` passes).
2. Apply `recite8/web8b-proposals.json` after the refutation pass (AC-271, 69 rows); it also names the two N5 titles as `staleExisting`, and `recite7/web7-proposals.json` still carries those two OLD titles (`CmsCompositionPage.in-flight.test.tsx` rows "Review stays disabled ... open review survives the answer" and "insert fields edited after dispatch ... keep the form dirty"): refresh or drop them before applying that file, or the resolver reports 2 unresolved rows.
3. Real-route specs: no Playwright assertion in `tests/e2e` reads the related-content "Save not confirmed" copy, the governed re-read control or the composition unknown-outcome text (grep found only the locale spec, which is web8a's). A real-route run of the related-content 409 and the composition commands would now also issue the extra list/rule GETs.
4. Decide the four readings above if you disagree; each is a one-call revert.

## Fix round (root browser gate and `pnpm bundle:check`, 2026-10-30)

Status: GREEN. `pnpm build && pnpm bundle:check` passes (exit 0); "CMS taxonomy edit initial route exceeds 92160 gzip bytes: 92545" is gone (now 92,081, 79 bytes under; HEAD `85ab5ff0` measured 92,059). No budget was raised.

### Where the bytes were

Baseline built from `git archive 85ab5ff0` in a scratch copy (astro build and `scripts/verify-bundle-budget.mjs` only; I did not run `pnpm` there, which wanted to reinstall), compared chunk by chunk with the working tree for the taxonomy edit route (gzip of each initial asset):

| Chunk | HEAD | before fix | cause |
| --- | --- | --- | --- |
| `CmsTaxonomyVersionDesigner` | 7,671 | 7,965 (+294) | web8a: `useTaxonomyVersionRows` and the refresh calls, `useReconcileOnOutcome` call, the stale-list line |
| `use-reconcile-on-outcome` | none | 195 (new chunk) | web8a hook, a separate initial chunk |
| `CmsGovernedTaxonomyPanel` + `CmsGovernedReviewPanel` | 2,480 | 2,477 | MINE: net -3 (my governed changes add nothing measurable to this route; the `governed-review-refusal.ts` import of the shared classifier is lazy, as feared and refuted) |

So the +486 was web8a's designer, not my governed code. `CMS taxonomy create` (no governed panel) rose +489 for the same reason.

### Fix

`taxonomy-versions-read.ts` (1,325 gzip) was in the initial closure only because three islands import its `readTaxonomyVersions` as the DEFAULT of a `readVersions` seam, and every call of that seam is a re-read after a command, a lost answer or a 409, never the first paint. Moved behind the existing on-demand boundary:

- new `cms-taxonomy-designer/taxonomy-versions-on-demand.ts`: `readTaxonomyVersionsOnDemand` (`retryable` dynamic import through `importModule`, a chunk that cannot be fetched answers the `unavailable` result the callers already handle), the seam object `taxonomyVersionsImporters` for tests, and `TAXONOMY_VERSIONS_PAGE_MAX` (re-exported by `taxonomy-versions-read.ts`, so every importer is unchanged).
- the three default seams now use it, with `import type` for the types: `use-taxonomy-designer.ts` and `use-taxonomy-conflict.ts` (web8a's taxonomy-designer import site, as you allowed), `CmsGovernedTaxonomyPanel.tsx` (mine) and, outside what you allowed and only because the chunk stays initial while any one importer is static, `cms-taxonomy-terms/use-term-list.ts` (two import lines and one default; behaviour identical).
- the gate lists the chunk: `CMS_ON_DEMAND_CHUNKS` entry `taxonomy-versions-read` (trigger "refetch after a command", `importedBy` the new file, proof test) plus its stem in `tests/performance/cms-editorial-bundle-budget-mounted.test.ts`, and the proof `taxonomy-versions-read: not requested by the mount, a scroll or the passing of time; requested when a saved vocabulary version is read back` in `cms-on-demand-taxonomy-locale.proof.test.tsx`. A mount effect does not read it (the proof shows nothing requested by mount or idle time).
- `scripts/verify-bundle-budget.mjs`: the `locale-variant-submit` entry's `importedBy` named `use-locale-variant-form.ts`, but web8a moved that import to `locale-variant-submit-seam.ts`; two gate tests failed on it (`tests/performance`), corrected to the seam. Nothing else in the gate changed.

### Initial-route gzip bytes, every route `bundle:check` lists (HEAD `85ab5ff0` -> now; all pass, budget 92,160)

| Route | HEAD | Now | Delta | Gate |
| --- | --- | --- | --- | --- |
| CMS capability grants | 83988 | 83988 | +0 | pass |
| CMS entry list | 1954 | 1954 | +0 | pass |
| CMS entry create | 90184 | 90184 | +0 | pass |
| CMS entry editor | 90894 | 90894 | +0 | pass |
| CMS revision history | 6459 | 6459 | +0 | pass |
| CMS entry workflow | 89092 | 89112 | +20 | pass |
| CMS related content | 77240 | 78088 | +848 | pass |
| CMS composition | 81456 | 82340 | +884 | pass |
| CMS locale variant | 90113 | 90461 | +348 | pass |
| CMS conflict resolve | 91313 | 91313 | +0 | pass |
| CMS review queue | 1954 | 1954 | +0 | pass |
| CMS review detail | 89801 | 89822 | +21 | pass |
| CMS definition review queue | 1954 | 1954 | +0 | pass |
| CMS definition review detail | 75268 | 75576 | +308 | pass |
| CMS pattern create | 84696 | 84940 | +244 | pass |
| CMS pattern edit | 90703 | 90944 | +241 | pass |
| CMS taxonomy create | 76672 | 76168 | -504 | pass |
| CMS taxonomy edit | 92059 | 92081 | +22 | pass |
| CMS template create | 74383 | 77815 | +3432 | pass |
| CMS template edit | 83067 | 83297 | +230 | pass |

Notes: the real-route [T4] cold-load check for the curator panel measures the same taxonomy edit route and its bundle; I did not run Playwright. Routes still above HEAD are within budget and are the wave's own additions: composition +884 and related content +848 (mine: the list read and the reconcile code, both island-static), locale variant +348 and template create +3,432 (web8a; template create is 77,815 against 92,160), definition review detail +308 (mine). Say if you want any of those slimmed too.

### Runs

- `pnpm build && pnpm bundle:check`: pass.
- `vitest run apps/web tests/performance`: 800 files, 9,153 tests, all pass.
- `tsc --noEmit -p apps/web/tsconfig.json`, `eslint` (components, `scripts/verify-bundle-budget.mjs`, `tests/performance`), `prettier --check`: clean.

### Files changed in this round (path, lines, SHA-256)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-on-demand.ts` | 27 | bdb0ac4d05104e56aa4026da23b39785a0ac5dbd8bccf69729957ef20276baba |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.ts` | 230 | 7aa9ca3eb1363ec71bcd2a26111dc030070b9b9801eebd71b2587e14957bff58 |
| `apps/web/src/components/cms-taxonomy-designer/use-taxonomy-designer.ts` | 289 | 55a4a56cf401f51c580f97e87ce59643909d0cbf5b614b46f767ffff23bf5dc3 |
| `apps/web/src/components/cms-taxonomy-designer/use-taxonomy-conflict.ts` | 95 | 7f45435abf9580b7c55750f1d2844482e6cb6b3b77e6b14ed105faf9385ce267 |
| `apps/web/src/components/cms-taxonomy-designer/README.md` | 75 | 619a180367204a8e924bf545273e51df27510722872071765c9ae624c321e274 |
| `apps/web/src/components/cms-taxonomy-terms/use-term-list.ts` | 121 | d0dc3485f60e7145653d57bb0b388227924c6df99a1068b3c651442d2fd0520c |
| `apps/web/src/components/cms-governed-review/CmsGovernedTaxonomyPanel.tsx` | 78 | c3cc945b1ecf698d8c0d43adb0bfd8ce8cd2a33ee5a60dc3b0282f7a1bcd2952 |
| `apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx` | 272 | 183177881c63c631b8e81d8fc2b57f2e6e5e23d66f75840091b69be4105ae16d |
| `scripts/verify-bundle-budget.mjs` | 1905 | 4875c179f599f89a7e7ff0687e597319bd95aac855822251d11a53d8fce115a7 |
| `tests/performance/cms-editorial-bundle-budget-mounted.test.ts` | 379 | 6df04586cec024b50e3f976b72c2e97f39c32f88405eaf37239f326e5e1ccb58 |

## Fix round 2 (review V19 and root DEC-245(4), 2026-10-30)

Status: GREEN for everything assigned to web8b. `pnpm bundle:check` still FAILS on one route that is not mine: "CMS pattern edit initial route exceeds 92160 gzip bytes: 94697" (web8a's pattern designer; the chunk comparison against HEAD shows new initial chunks `contracts-client` 1,681, `pattern-tree-rules` 1,311, `use-registry-context` 2,630, `use-reconcile-on-outcome` 195 and `CmsPatternVersionDesigner` +170; my governed pattern panel is 431 -> 430). Every route I touch passes.

### What was done (RED first for each; see "Runs")

1. M3 (MAJOR). `session.hold` keeps a command, and every read that follows its answer, in flight; `page.busy` includes it, so every control that starts another command stays disabled until the 409 refetch, the post-success list refetch, the diff re-read and the bulk between-request entry reads have settled. Insert, accept, detach, new blocks, bulk accept and bulk detach are wrapped (`held(...)`). RED: 8 of 9 rows of `CmsCompositionPage.refetch-lock.test.tsx` failed (the ninth, the bulk between-request window, passed on the old code and stays as a guard); each row holds a read and presses the control again and asserts exactly one POST.
2. DEC-245(4). An unknown outcome whose reconciling read cannot read the entry offers no retry for insert, accept, detach, new blocks and bulk: commands stay off, the result region offers "Check again" (`session.recheck`), which stays mounted, focused and `aria-disabled` while it reads, says so again without moving focus while still unverified, and on a verified read moves focus to the result heading and states the entry version (`restated` changes the sentence and refocuses only on request). The retry afterwards is the identical request under its key. RED: 6 of 6 rows of `CmsCompositionPage.unverified-hold.test.tsx` failed. `reconciling` is replaced by `hold` + `unconfirmed`.
3. m6. The related-content "Check again" moved from inside the status region to the form (`RELATED_RECHECK_ID`), one element for the whole episode, `aria-disabled` while reading, status `reconciling` carries `again`; the heading-focus effect no longer takes focus from the control. RED/mutation: unmounting it while reading fails 3 rows (`CmsRelatedContentForm.recheck.test.tsx`).
4. m7. `refreshList` keeps the `retired` rows the island holds that the DEC-206 read does not list (`keepRetired`, placed after the row that preceded them; a listed path wins), and the list reads carry a per-call sequence next to the generation guard. Reading: DEC-193 detach of a removed block stays reachable after a refetch. Removing `keepRetired` fails the page row; removing the generation guard or the sequence guard each fails one row (`use-composition-session.refresh.test.tsx`).
5. m8. The harness keeps its `calls`/`lists` split but now ALSO records an unscripted list read in `unscriptedLists`, and `noListReads(page)` fails on any list read; `CmsCompositionPage.no-refetch.test.tsx` asserts it for 401, 403, 404, 422 and 429 on a detach, a placement, an accept and a bulk detach, for an opened and a refused diff, and one row proves the harness sees a 409's unscripted read; the 401/403/422 rows of the insert and bulk state suites assert it too. (A fully strict harness, where an unscripted list read fails every suite, broke 63 existing rows and was not kept.)
6. m10. `RelatedStatus` moved to `related-content-types.ts`; the form hook, `use-related-list-edits.ts` and `use-related-outcomes.ts` no longer import each other (an import-graph script over the five directories finds no cycle in the related, composition and taxonomy clusters).
7. V19 survivors, all killed now (revert checks in a scratch copy): R11 refreshList generation guard (1 row), the new sequence guard (1), R13 related `isCurrent` after `reconcileSave` (1: `use-related-content-form.guards.test.tsx`, a superseded check must not change the page while the newer one reads), R19 `keepOnEdit` (2: edits during the read and after a failed read, plus the not-recorded edit that clears), R26 the `>=` guard (2).
8. Bundle round follow-ups from root: the `taxonomy-versions-read` <-> `taxonomy-versions-on-demand` cycle is gone (`TAXONOMY_VERSIONS_PAGE_MAX` moved to the existing `taxonomy-vocabulary-core.ts`; the on-demand wrapper depends on the reader through a type only, the reader no longer imports the wrapper, `use-term-list.ts` imports the constant from the core module). In `scripts/verify-bundle-budget.mjs` the `locale-source-refresh` entry now says trigger `save` and that the source read loads after an accepted save, an unknown outcome and a 409 (text only).

### Retitles (old -> new) and ledger impact

Every renamed test of this lane is listed with its full old and new name in `recite8/web8b-proposals.json`, clause 0, key `retitled` (26 rows: the 24 renamed since HEAD plus the two renamed inside this lane: `CmsCompositionPage.reconcile` "when the entry moved ..." and `CmsRelatedContentForm.auto-refetch` "429 ... Check again"). Rows whose title is a `%s` template (three `it.each`) expand per case, so only their template is named. Any ledger citation that names an `oldTitle` is stale and must be re-pointed to `newTitle` or dropped. Renamed in THIS round: the three above plus "says the entry could not be checked when the read fails, and the retry is still offered" -> "[P2-S12-AC-271] test correction (FE03 1050, DEC-245(4)): ... offers no retry, only Check again" (`CmsCompositionPage.unsaved.test.tsx`).

### Runs

- RED: refetch-lock 8 of 9 failed, unverified-hold 6 of 6 failed, before the fix; the other new rows pass on the old code only where noted above.
- `vitest run apps/web tests/performance`: 812 files, 9,259 tests, all pass. `tsc`, `eslint` (components, `scripts/verify-bundle-budget.mjs`, `tests/performance`), `prettier --check` clean.
- Changed-line coverage over the related, composition and governed sources: 0 uncovered statements or branches after the last tests (two gaps found and closed: `recheck` with nothing unconfirmed / after unmount, and `restated` on a non-refusal status).
- `pnpm build && pnpm bundle:check`: every route passes except web8a's pattern edit (above).

### Initial-route gzip bytes (HEAD `85ab5ff0` -> now; budget 92,160)

| Route | HEAD | Now | Delta | Gate |
| --- | --- | --- | --- | --- |
| CMS capability grants | 83988 | 83988 | +0 | pass |
| CMS entry list | 1954 | 1954 | +0 | pass |
| CMS entry create | 90184 | 90188 | +4 | pass |
| CMS entry editor | 90894 | 90899 | +5 | pass |
| CMS revision history | 6459 | 6459 | +0 | pass |
| CMS entry workflow | 89092 | 89112 | +20 | pass |
| CMS related content | 77240 | 78160 | +920 | pass |
| CMS composition | 81456 | 82790 | +1334 | pass |
| CMS locale variant | 90113 | 90578 | +465 | pass |
| CMS conflict resolve | 91313 | 91318 | +5 | pass |
| CMS review queue | 1954 | 1954 | +0 | pass |
| CMS review detail | 89801 | 89822 | +21 | pass |
| CMS definition review queue | 1954 | 1954 | +0 | pass |
| CMS definition review detail | 75268 | 75576 | +308 | pass |
| CMS pattern create | 84696 | 88692 | +3996 | pass |
| CMS pattern edit | 90703 | 94697 | +3994 | FAIL (not mine) |
| CMS taxonomy create | 76672 | 76167 | -505 | pass |
| CMS taxonomy edit | 92059 | 92096 | +37 | pass |
| CMS template create | 74383 | 83040 | +8657 | pass |
| CMS template edit | 83067 | 88494 | +5427 | pass |

My routes: related content 78,160 (78,088 after fix round 1), composition 82,790 (82,340), taxonomy edit 92,096 (92,081; 64 under the budget). The +5 on entry create / editor / conflict resolve is the constant now living in `taxonomy-vocabulary-core.ts` (their routes are 90,188, 90,899, 91,318). The seam the lock and the recheck needed (session `hold`, `recheck`, `Check again`, `keepRetired`) is the composition growth.

### Files changed in this round (path, lines, SHA-256)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-composition-instances/composition-copy.ts` | 116 | dee663bd14a0cd61a534aa022e991fc0b3cb8b83843e579c26b7b40f98405697 |
| `apps/web/src/components/cms-composition-instances/composition-rows.ts` | 108 | 1d6fa33bd2555d9014ecee5124c771cf4bd7945518d76fc8d36f82eec505d53f |
| `apps/web/src/components/cms-composition-instances/composition-status.ts` | 70 | f52e4f7d373a1a9fa1d513cfac828226aa8a3f9fc611f30b9df420c92cb8cf3f |
| `apps/web/src/components/cms-composition-instances/CmsCompositionStatus.tsx` | 70 | 48f008ef918f02bfeaae7733d4941c872d21c0526d1141c7d86720a93114aa53 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.tsx` | 101 | 165ed9b5ec71f43894fecbde0804efa7eb50ce4bccb7553de5fb55990162eac5 |
| `apps/web/src/components/cms-composition-instances/use-composition-session.ts` | 272 | b8fcc94b24537d641d0f56eabce8025c6cb44dfdeca9a51a2922f0cdaf11987f |
| `apps/web/src/components/cms-composition-instances/use-composition-page.ts` | 91 | c351e8e6b5f10c3148aebf426fc5af21614ba3194140a73d9424e0277c5083e8 |
| `apps/web/src/components/cms-composition-instances/use-composition-insert.ts` | 245 | 43e590668ac1db56355da6a4decbea9d43bd715d5251f39e863d91529d48776d |
| `apps/web/src/components/cms-composition-instances/use-composition-updates.ts` | 291 | 9288b4871bc34c53dfb0c9251ff01ace227069fcb452b0b0f65ee415a4a518af |
| `apps/web/src/components/cms-composition-instances/use-composition-bulk.ts` | 260 | b600a677b9b8e28d711d0bfe3c6157216e767c385ea9740c4c6451d655f221fb |
| `apps/web/src/components/cms-composition-instances/composition-page.test-support.tsx` | 165 | 5f67015593f2e245636d0789f2e43cd8cd2961e8df9904f93fc4c6ae843bea87 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.refetch-lock.test.tsx` | 272 | 516303129419a88f463ce78485e270ae13c81d58760fcf012b26d59ac47fa2ea |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.unverified-hold.test.tsx` | 224 | 1e22d775f351b9dc870814a106cde45b21413a57d344b2e3aceff6727036aafc |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.no-refetch.test.tsx` | 148 | bed99cc6d8b65626c86a6cc2732207e29498f7c2f7053d69266c5c757bc2fc68 |
| `apps/web/src/components/cms-composition-instances/use-composition-session.refresh.test.tsx` | 146 | c229ee95ab3542aebf4065a9f3eff6a0b3b8fed2d1ad9dc38dab56f0b8fae3c0 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.list-refetch.test.tsx` | 236 | 70cdca9962e0c89e2a9f1bcd4dc51f04bf9242c9f90b9d1c91d77ec67cfa3f21 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.reconcile.test.tsx` | 285 | 448d5eed44694b2b9629b0f2cce6d0b98ef36b650a7ae01c791c7a9efff49aff |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.unsaved.test.tsx` | 253 | f2ff16e8d16b95344d9cbb6e91addace57913054a65669fe8c668dcd32c13248 |
| `apps/web/src/components/cms-composition-instances/CmsBulkUpdatePanel.states.test.tsx` | 343 | 2be58d2d829c5322810e960ba08f133142b9ddd044de6ca6c46411812d480470 |
| `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.states.test.tsx` | 297 | 35a63d2082caf3aebcef31595830e83c5670873f47a256afb52420400ceeb374 |
| `apps/web/src/components/cms-composition-instances/README.md` | 119 | a9f6bd14e4dd8e31e34c2128e7e4f696a8cc5fb0caf63a7d514c680b5b71357d |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.tsx` | 164 | b28e0e79b44230785719580cda64b1e5693cb65b8722d81abef3b3cbdb4466ea |
| `apps/web/src/components/cms-related-content/CmsRelatedStatus.tsx` | 158 | cf0f9f32222e30e5f4e5b33447c7f3fd97210166a8db00ef4c2aa98e12be66c7 |
| `apps/web/src/components/cms-related-content/related-content-types.ts` | 74 | 6840adc0683c3ea79d5ca5c767412d605b5b6847c4f9b6fcb8daf0ffd9425d63 |
| `apps/web/src/components/cms-related-content/use-related-content-form.ts` | 267 | 7657836c03d4bcab1a769fc2db6f5fc6435574fbdfd4f0030a7fecca91dd4b7b |
| `apps/web/src/components/cms-related-content/use-related-outcomes.ts` | 105 | 3412a6862ce7ac72930c17ef80c14dbab7b289d64cd74e29a001b056188398c1 |
| `apps/web/src/components/cms-related-content/use-related-list-edits.ts` | 93 | 870a27aebc38d4ddc1112fdcce46b62e15801b0b29f5a9e41c73f1966e650726 |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.recheck.test.tsx` | 200 | 9967996a247bcececb371bb97cc5610ab8259b1348c86f36006816ea581742e5 |
| `apps/web/src/components/cms-related-content/CmsRelatedContentForm.auto-refetch.test.tsx` | 260 | b91b3c6cedf0c51b73af5d491336ce6ebea5d65cfcf55698c799b4e5132b1b98 |
| `apps/web/src/components/cms-related-content/use-related-content-form.guards.test.tsx` | 162 | c708655d35b8e40e1c6cfac7dd48eb7ed6f55aed448b53468756fc3eab6e44f3 |
| `apps/web/src/components/cms-related-content/README.md` | 117 | bcf8d0d14fe0ba0bae56bd518e54486a2a4f1ccb1f24a4bf0138b66e846b38d6 |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-vocabulary-core.ts` | 13 | 0cc9635077b3fcd2452d39ef6ec5a8c68b9383b0a75de9dbfbb35841cfef6ee6 |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-on-demand.ts` | 24 | 15fc06dab9694672982eb636c5e305474180d98651dccbe0b3bd411d897768b1 |
| `apps/web/src/components/cms-taxonomy-designer/taxonomy-versions-read.ts` | 230 | 915f133bc4148d22b464c22aaf6a9f7c3ae52e06a7a3f42c6485144a44add0c5 |
| `apps/web/src/components/cms-taxonomy-designer/README.md` | 75 | c9d99514828819a50abff336b890a46bf6e7560bdfb2f57a02de6a0617447e89 |
| `apps/web/src/components/cms-taxonomy-terms/use-term-list.ts` | 119 | 070489c61adf9586764e366d37dba93e6b3dc0fffe4db3fc84538b1d6ddf4214 |
| `scripts/verify-bundle-budget.mjs` | 1905 | 17bca247d333ff3b748ab42bd696082cf8b9a9672e4ece3ba3ba39fcfc70b2a8 |
| `docs/handoffs/2026-10-22-claude-s12/recite8/web8b-proposals.json` | 1093 | c19c6240a11c6d6c151cf4d93cb805a019fb9528a75375e5c2fc6fcd790b5809 |
