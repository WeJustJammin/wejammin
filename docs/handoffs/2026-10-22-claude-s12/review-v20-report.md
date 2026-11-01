# Review V20 report — wave-8 fix rounds (web8a fix + bundle rounds, web8b fix round 2)

## Status

DONE for the brief (2026-10-31 21:35 UTC). Reviewer `claude_s12_v20`, a separate population from web8a, web8b and V19. Brief: `briefs/review-v20-web8-fixes.md`. Rules: `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`. Worktree HEAD `85ab5ff0eb7e0a06c0f2fca1fdc72a5c71b5126e` plus uncommitted lane work. Read-only except this file: no `git` write, no Playwright, db, supabase, docker or race command, no background command, no sub-agent. Scratch (probes, revert-check copy, build): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_v20/` (`ws/` is a copy of `apps/web/src` with its own vitest cache; every probe and every revert check ran there, the worktree was never edited).

Side effect to know about: my focused and full Vitest runs from the worktree root wrote `node_modules/.vite/vitest/da39a3ee…/results.json`, so Vitest now records `CmsTaxonomyVersionDesigner.latest-states.test.tsx` as failed and will run it FIRST (cold) in the next run of the worktree (finding B1). That is a cache file, not a source file.

## Verdict

| Lane  | Verdict                | Condition |
| ----- | ---------------------- | --------- |
| web8a | ACCEPT-WITH-CONDITIONS | Not committable until B1 is closed (one-line preload in a web8a-owned test whose cause is web8b's on-demand conversion) and M1 (the digest-409 fixed copy still tells the person to reload, which discards the values the new notice says are kept) is closed. The remaining web8a items (m1, m2, m4, m7, m8) are advisory. |
| web8b | ACCEPT-WITH-CONDITIONS | Not committable until B1 is closed (cause: `taxonomy-versions-on-demand.ts`). Advisory but recommended before the AC-271 rows are cited: m3 (`keepRetired` keeps retired rows of a previous draft revision), m9 (the placement digest 409 does not re-read the selector), m5 (a repeated failed "Check again" is silent), m6 (the failed-chunk path of the versions read has no test), m10 (V19 m11: composition reads still have no deadline, and the M3 hold now freezes the island on a hung read). |

Counts: BLOCKER 1, MAJOR 1, MINOR 10, NIT 7.

What held up under independent checking: tsc 0 errors; eslint 138 files 0 errors 0 warnings; prettier 145 files clean; `vitest run tests/performance` 13 files / 198 tests; **my own `astro build` reproduces the lanes' byte counts exactly** and `node scripts/verify-bundle-budget.mjs` exits 0 (table below); the locale M1 fix, the M3 hold for all six commands, the m6 focus fix and every V19 survivor are real: **37 of 38 revert checks fail the tests as they should**; no new import cycle (12 SCCs at HEAD, the same 12 now, none in a changed file set); every changed file is within its size limit; the on-demand chunks `cms-registry-read` and `taxonomy-versions-read` are in no route's initial assets in the real build.

## V19 findings, one by one

| V19 finding | Verdict | Evidence |
| ----------- | ------- | -------- |
| B1 registry name (`locale-variant-submit` importedBy) | FIXED | `scripts/verify-bundle-budget.mjs:1048` names `locale-variant-submit-seam.ts`; `vitest run tests/performance` 13 files / 198 tests green; the build gate passes. |
| M1 locale unknown outcome (web8a) | FIXED | `use-locale-save-reconcile.ts:56-61`: an unknown outcome never calls `hold()`, never touches `source`, reports `entryMoved`; retry is the same body, key and `expectedVersion`. Revert checks L1, L2, L4, L5 kill it (2 refetch rows each). Residual: m4. |
| M2 digest 409 (web8a) | **PARTIAL** | Real: context re-read through `GET /api/v1/cms/templates/context`, values kept, selectors named, send held while reading and after a failure, on-demand chunk, failed chunk holds the send (R1, R3-R9 killed). Not complete: M1 (copy contradiction), m1 (no deadline), m2 (successor hold unpinned, R2 survives). |
| M3 composition controls re-enabled (web8b) | FIXED | `session.hold` wraps insert, accept, detach, new blocks, bulk accept, bulk detach; `page.busy` includes it. Each wrapper removed alone fails its own `refetch-lock` row (B1-B5b), `holding` removed fails 14 to 19 rows (B6, B7). Residual: m10. |
| m1 StrictMode (web8a) | FIXED | `mounted.current = true` at `use-cms-template-create-reconcile.ts:73`; T1 killed by `strict-mode.test.tsx`. Sweep: 11 of 11 mounted/active refs re-arm in the effect (list in Sweeps). |
| m2 older version adopted (web8a) | FIXED | `use-locale-save-reconcile.ts:21-22` strictly newer by `BigInt`; L3 killed. |
| m3 type cycle `locale-variant-types` / `-request` (web8a) | FIXED | Import-graph script: no cycle in `cms-locale`. |
| m4 `locale-source-refresh` trigger text (root file) | FIXED | `verify-bundle-budget.mjs:1056-1058`: trigger `save`, reason names accepted save, unknown outcome and 409. |
| m5 create-reconcile supersede guard (web8a) | FIXED | `CmsTemplateDesigner.reconcile.test.tsx` row; T2 killed. |
| m6 related "Check again" focus (web8b) | FIXED | One element (`RELATED_RECHECK_ID`), `aria-disabled` while reading, focus effect skips it; B13, B14 killed. |
| m7 retired rows after refetch, stale-read guard (web8b) | **PARTIAL** | `keepRetired` and the per-call sequence exist and are pinned (B10, B11, B12 killed). But `keepRetired` keeps a retired row of the PREVIOUS draft revision after the entry moved to a new one (probe, finding m3). |
| m8 `noListReads` (web8b) | FIXED | Harness records unscripted list reads in `unscriptedLists`; `no-refetch.test.tsx` asserts zero list reads for 401, 403, 404, 422, 429 on four commands. 74 other tests still pass on a silently refused (503) unscripted list read, by design (finding n4). |
| m9 five surviving mutants (web8b) | FIXED | R11 = B12/B11, R13 = B15, R19 = B17, R25 = T2, R26 = B16: all killed. |
| m10 `RelatedStatus` cycle (web8b) | FIXED | No cycle in the related, composition or taxonomy clusters. |
| m11 composition reads have no deadline (web8b) | **NOT FIXED** | `composition-transport.ts:183-200` (`readJson`) passes no `AbortSignal` and sets no timer; `readInstanceList` checks its 20 s budget only between pages (`composition-instance-list.ts:63-66`). With the M3 hold a read that never settles keeps every control off (finding m10). |
| DEC-244 4 locale 422 copy | FIXED | `locale-variant-copy.ts:50`; L6 killed; the old sentence appears nowhere in product or tests. |
| DEC-245 4 composition retry hold | FIXED | `unconfirmed` in `page.busy`; B8, B9 killed (7 and 9 rows). |
| DEC-245 1 "the three pinned reads-nothing rows are rewritten" | **PARTIAL** | Two rewritten; the pattern row still carries the title "the registry-digest refusal reads nothing" (finding m7). |
| V19 NITs n1-n5 | NOT FIXED | n1 (`CmsGovernedDecisionList.tsx:30` repeats `Time`), n3 (`askedRef`), n4 (`use-composition-bulk.ts:189` second list read) unchanged; n2 and n5 unchanged and a new instance of n2 is finding m8. Not required by the brief. |

## Findings

### BLOCKER

**B1 (web8b bundle fix, in a web8a-owned test) — `CmsTaxonomyVersionDesigner.latest-states.test.tsx` fails 3 of 12 tests alone, with its directory, and in the full `vitest run apps/web`.**
- Reproduce: `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH pnpm exec vitest run apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.latest-states.test.tsx`.
- Evidence (focused Vitest on this tree): the file alone, twice: `Tests 3 failed | 9 passed (12)`; with its sibling `.conflict.test.tsx`: the same 3; the `cms-taxonomy-designer` + 7 other directories (137 files / 1,339 tests): 3 failed; the coverage run (263 files / 2,673 tests): 3 failed; `vitest run apps/web --maxWorkers=4` (801 files / 9,072 tests, the exact totals both lanes call green): `Test Files 1 failed | 800 passed`, `Tests 3 failed | 9069 passed`. Failing rows: `latestReadState loading` (`TypeError: undefined is not iterable` at test line 156, `fetcher.mock.calls[0]` is undefined), `latestReadState success` (`expected "vi.fn()" to be called 1 times, but got 0 times`, line 171), `latestReadState empty (not-disclosed)` (line 193). The siblings `.conflict`, `.states`, `.refetch`, `.late-edit` pass alone.
- Cause: web8b's bundle fix made the default `readVersions` an on-demand chunk (`taxonomy-versions-on-demand.ts:6-8`, `retryable(() => import('./taxonomy-versions-read'))`). This suite runs on `vi.useFakeTimers()` (line 65) and does not preload the chunk, so the 409's automatic read has not started when `settle()` returns: a real module load cannot progress under fake timers. It passes only when the Vite transform of `taxonomy-versions-read.ts` is already cached by an earlier file of the same run. V19 saw exactly these three fail mid-edit; both lane reports then call the full run green. Its siblings use real timers (and preload `taxonomy-outcome-reconcile`), and web8a's registry suites preload their chunk (`beforeAll(async () => { await import('./cms-registry-read'); })`).
- Fix verified in the scratch copy: adding `beforeAll(async () => { await import('./taxonomy-versions-read'); });` after line 63 makes the file pass 12 of 12 (alone, cold); the unmodified copy fails 3 of 12 in the same scratch workspace.
- Impact: `pnpm validate` runs this file in a full coverage run whose file order and transform-cache state are not fixed; three `[P2-S12-AC-271]` rows of `web8a-proposals.json` cite it.

### MAJOR

**M1 (web8a, V19 M2 follow-up) — the digest-409 fixed copy still tells the person to reload, while the new notice says the values are kept.**
- `pattern-designer-reasons.ts:52-53` (rendered for the pattern designer and, through `CmsTemplateStatus.tsx:46-47`, for the create and successor template designers): "The block registry changed while you were editing. Reload to refresh the block choices, then submit again. Nothing was saved." The new automatic read adds `cms-registry-read.ts:56`: "Your values are kept; check your block choices, then save again." Probes `probe-v20-digest-copy.test.tsx` (create designer) and `probe-v20-pattern-copy.test.tsx` (pattern designer): both sentences are in the DOM at once after the 409 and the read. A reload discards the unsent tree, which is the defect V19 M2 cited ("which discards the unsent tree").
- A second site: `pattern-designer-copy.ts:50` "This block is no longer registered. Reload to refresh the block choices." is shown for a node whose block the refreshed registry no longer lists; the choices were already refreshed.
- Fix: change both sentences to say the block choices were read again and what to do ("Check your block choices; your values are kept; then submit again"). They sit in the initial route of the pattern edit and taxonomy edit pages (margins 94 B and 64 B): a shorter sentence is safe, a longer one is not; run the gate after the edit.

### MINOR

- **m1 (web8a) The new context read has no deadline and no abort, and holds the send with no way out.** `cms-template-context-read.ts:100-108` passes no `signal`; `retryingSafeRead` has no timer. Probe `probe-v20-hung-read.test.tsx` (a context GET that never settles, one simulated hour on fake timers): the commit is still disabled, "Reading the block choices…" is the only state, there is no "Read the block choices again" control (it renders only for `failed`), and `signalOnRead=false`. Locale (`locale-source-refresh.ts:37`) and related (`related-conflict-read.ts:17`) use an 8 s deadline. Fix: `AbortSignal.timeout(8_000)` in `readTemplateContext`, mapping the abort to `unavailable`. The reader is in the lazy chunk, so it costs no initial-route bytes.
- **m2 (web8a, test strength) The successor's registry hold is unpinned: mutant R2 survives.** Removing `registry.holding` from `cannotSubmit` in `CmsTemplateEditDesigner.tsx:57-62` leaves 28 of 28 tests green. In `CmsTemplateDesigner.registry-context.test.tsx` the successor surface's parent read answers 503 (only the context URL is scripted, lines 59-71), and that failed parent read keeps the commit disabled by itself, masking the context hold. Probe `probe-v20-successor-hold.test.tsx` (parent read answers 200, context read fails): passes on the product and FAILS with R2 applied, so a discriminating test exists. Fix: script the parent read as 200 in the successor rows.
- **m3 (web8b, V19 m7 fix) `keepRetired` keeps a retired row of the previous draft revision.** `composition-rows.ts:90-108` ignores `row.revisionId`; `use-composition-session.ts:119` applies it to whatever list the revision-keyed read answers. Probe `probe-v20-stale-revision.test.tsx`: a 409 whose entry read answers a NEW draft revision and whose list read lists only the new revision still shows the old revision's retired row (`paths=["/main/row-1","/main/row-2"]`) with its Detach enabled; the request would carry an old-revision instance id. Fix: pass the listed revision id and keep only `row.revisionId === revisionId`.
- **m4 (web8a) The locale "entry moved" notice survives an edit and then promises something false.** `use-locale-variant-form.ts:119-130` (`edited`) clears the status but not `entryMoved` (`use-locale-save-reconcile.ts:39,91,97`). Probe `probe-v20-moved-edit.test.tsx`: after an unknown outcome with the entry at version 5, the person edits the title; the page still says "Sending again retries the same request and cannot save it twice." and the next send is a different request under a NEW key (`sameKey=false sameBody=false`). The If-Match still protects the entry, but the sentence is wrong. Fix: clear `entryMoved` in `edited` (or show it only while the body equals the attempt).
- **m5 (web8b) A repeated failed "Check again" changes nothing the screen reader can hear.** `composition-copy.ts:104-112` returns the same sentence for every unreadable entry and `restated` (`composition-status.ts:63-70`) keeps the nonce, so React writes no text. Probe `probe-v20-recheck-silent.test.tsx` (MutationObserver on `.cms-composition-status`): after the failed re-check the text is identical and the only mutations are two `aria-disabled` flips (`contentMutations=0`). The unverified-hold tests assert focus and disabled state but nothing that is announced. The report says it "says so again". Fix: change the sentence on a repeat (for example add the attempt number or the time) or give the control a polite status node it writes after commit, as `CmsTemplateLatestCheck.tsx:29-38,50-56` does.
- **m6 (web8b, coverage claim) The failed-chunk path of the versions read is untested.** Changed-line coverage (v8, 63 changed production files, 263 test files): 62 files have 0 uncovered changed statements, branches or functions; `taxonomy-versions-on-demand.ts:22` (`catch { return { kind: 'unavailable' } }`) is uncovered, against the report's "0 uncovered". `cms-on-demand-taxonomy-locale.proof.test.tsx:171-189` proves only "not requested by the mount; requested after a save". Fix: a proof row that rejects `taxonomyVersionsImporters.read` and asserts the islands' degraded handling, as `cms-on-demand-registry.proof.test.tsx` does for the registry.
- **m7 (web8a, ledger) A row title and its citation contradict DEC-245(1).** `CmsPatternVersionDesigner.states.test.tsx:213` is still titled "…the registry-digest refusal reads nothing (D2, DEC-242)" and asserts `readLatest` 0 times (the context read is pinned elsewhere); `recite8/web8a-proposals.json:306-313` cites it for the cell "registry-digest refusal re-reads the context". DEC-245(1): "the three pinned 'reads nothing' rows are rewritten, not kept". Revert check R4b (automatic read removed): the rewritten template rows fail (`CmsTemplateDesigner.reconcile` 1, `CmsTemplateDesigner.states` 2) and this pattern row stays green, so it pins nothing of the cell it is cited for. Fix: retitle the row to what it asserts and drop it from that cell.
- **m8 (web8a, accessibility) The registry notice's success list is a live region inserted with its content.** `CmsRegistryChangeNotice.tsx:30-36` renders `<ul role="status">` only when the read finished, and the whole section only when the state is not `none`. The repo's convention for a polite notice is an always-mounted empty node whose text is set after commit (`CmsTemplateLatestCheck.tsx:29-38,50-56`, README of `cms-composition`: "retain an initially empty polite node"). The "Reading…" line is a `CmsLoadingRegion`, which appears only after 250 ms, so a fast read announces nothing until the list appears. This is the V19 n2 pattern again in new code.
- **m9 (web8b, sibling of V19 M2) The composition placement has the same digest 409 and no refetch of what went stale.** `composition-commands.ts:66` sends the selector item's `blockRegistryDigest`; on `block_registry_digest_mismatch` the island refetches the entry and the list (`use-composition-insert.ts:192-195`) but not the pattern selector, and `composition-copy.ts:22-23` says "Reload the page and choose the pattern again", which discards the unsent overrides. The fix rounds did not touch this cell.
- **m10 (web8b, V19 m11 NOT FIXED) Composition reads still have no per-request deadline, and the M3 hold now makes that freeze the island.** `composition-transport.ts:183-200`, `composition-reads.ts:58-66`, `composition-instance-list.ts:63-66`. `hold()` releases in `finally`, but a fetch that never settles never reaches it, so every control and "Check again" stay off until reload. Same fix as m1 (a signal in `readJson`).

### NIT

- **n1** The READMEs do not name four new files: `cms-registry-read.ts`, `registry-read-on-demand.ts`, `registry-read-types.ts` (`cms-composition/README.md`) and `locale-variant-submit-seam.ts` (`cms-locale/README.md`); the README says the reader is `use-registry-context.ts`/`cms-template-context-read.ts` and does not tell a developer that it must stay behind the on-demand seam (initial-route margins 64 B and 94 B).
- **n2** The web8b fix-round-2 file table omits `use-composition-new-roots.ts` (disk `175f40e6…`, last listed SHA `6ae4b550…` from round 1); it was edited in round 2 (M3 wrapper). 146 of 147 listed SHA-256 values match.
- **n3** `cms-template-context-read.test.ts:86-91` is titled "is the pattern designer rule and the contract grammar" but compares only with `BLOCK_KEY_REGEX`; the contract comparison is transitive through `pattern-tree-rules.grammar.test.ts:69`. R9 (pattern rule changed) fails both files and R10 (local copy changed) fails the drift test, so the guard works. Exporting `CMS_BLOCK_KEY_PATTERN` from `packages/contracts/src/client.ts` would remove the duplicate.
- **n4** 74 tests (75 file/title pairs in `scratch/unscripted-list-reads.log`) pass while the instance-list refetch they trigger is an unscripted read answered 503: the success, 409 and unknown-outcome rows of `insert`, `update`, `bulk`, `in-flight`, `unsaved`, `selection`, `reconcile` and the `*.states` suites. The dedicated `list-refetch`, `refetch-lock` and `no-refetch` suites pin the refetch; the older rows never see a list that succeeds.
- **n5** V19 n1, n2, n3, n4, n5 are unchanged (table above).
- **n6** Initial-route margins are 64 B (CMS taxonomy edit) and 94 B (CMS pattern edit): any later edit to those two routes breaks `bundle:check`. The gate measures with the pinned Node 22.23.1 and my build matches the lanes' bytes.
- **n7** `tests/contracts/phase-02-slice-12-evidence-guard.test.ts` fails with 58 problems, all `stale receipt: the test file changed after the run`. Expected after wave-8 edits; root regenerates with `node scripts/evidence/run-slice-evidence.mjs --slice 12`. No problem is a missing or renamed cited test.

## Sweeps (N/N)

| Pattern | Sites | Result |
| ------- | ----- | ------ |
| Unknown outcome: the reconciling read must not become the retry (DEC-244 3) | locale, related, composition insert, accept, detach, new blocks, bulk, template create, template successor, pattern, vocabulary, term action, governed decision, assignment, activation = 15 | 11 of 15 read and confirmed: locale (after M1), related (`reconcile` adopts only a recorded rule), composition x5 (`reconcileUnknown` never calls `setEntry`; the retry rebuilds the same fingerprint and key), template create (key replayed only after a verified 404), vocabulary (`use-taxonomy-designer.ts:178-206`, a verdict `created`/`not-saved`, else held). Template successor and pattern (`use-template-unknown-attempt.ts:228-234`, `pattern-outcome-reconcile.ts:43-71`) hold the retry when the latest moved and offer an explicit rebase: V19 accepted that. Term action and the three governed forms (shared controller) were not re-read: unchanged by the fix rounds. |
| 409 `block_registry_digest_mismatch` refetch | template create, template successor, pattern, composition placement = 4 | 3 of 4 refetch the context; the placement does not (m9). |
| `mounted` ref re-armed under StrictMode | `use-registry-context`, `use-cms-template-create-reconcile`, `use-composition-session`, `use-locale-variant-form`, `use-pattern-conflict`, `use-pattern-unknown-outcome`, `use-related-content-form`, `use-related-conflict-review`, `use-related-outcomes`, `use-term-choices`, `use-template-unknown-attempt` = 11 | 11 of 11 set `.current = true` at the start of the effect. |
| Controls off through the post-answer read | composition x6 (fixed), related form, locale form, vocabulary designer, term action | Composition 6 of 6. Vocabulary designer: Save is blocked once created (`done`, `use-taxonomy-designer.ts:112-113`), so nothing can start during its versions refetch. Related and locale keep Save enabled during the success refetch (not in the M3 finding): `useLocaleSourceReview.read` drops a read a newer one superseded (probe `probe-v20-postsave-read`: a second save goes out with `expectedVersion` 5 and the late read adopts 9), and the related read is dropped by `isLatest`. Term action not re-read. |
| Strictly-newer adoption | locale, related | locale `>`, related `>=` (adopting an equal token is a no-op). |
| Per-request deadline on a new or changed read | registry context, instance list, entry facts, locale refresh, related conflict read | registry context, instance list, entry facts: none (m1, m10). Locale and related: 8 s. |
| Forbidden patterns | the 138 changed code files | no `any`, `TODO`, `FIXME`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `.skip` or `.only` (the one grep hit is the word "any" in a comment). |
| Import cycles | all of `apps/web/src` (1,943 files) | 12 SCCs at HEAD, the same 12 now; none new; the one in a touched directory (`CmsGovernedReviewPanel` / `CmsGovernedSubmitForm` / `governed-panel-form-views`) is identical at HEAD. |
| Size limits | 140 changed code files | 0 over among the `apps/web` files (the root script `verify-bundle-budget.mjs` is outside the table: 1,917 lines, 1,893 at HEAD); nearest: `CmsPatternUpdateDiff.states.test.tsx` 400/400, `CmsGovernedAssignmentForm.test.tsx` 399/400, `CmsTemplateEditDesigner.tsx` 196/200, `use-locale-variant-form.ts` 294/300. The OVER lines web8b printed (`load-related-content-page.test.ts` 449, `CmsGovernedDecisionForm.test.tsx` 470, `use-term-form.ts` 336) are untouched files, identical to HEAD. |

## Runs

| Run | Result |
| --- | ------ |
| `tsc --noEmit -p apps/web/tsconfig.json` | exit 0 (27 s) |
| `eslint --max-warnings=0` over the 138 changed code files (JSON report, via `xargs`) | 0 errors, 0 warnings |
| `prettier --check` over the 145 changed code and README files | clean |
| `vitest run` of `cms-composition`, `cms-locale`, `cms-pattern-designer`, `cms-taxonomy-designer`, `cms-taxonomy-terms`, both on-demand proofs, the step-up inventory | 137 files / 1,339 tests: **3 failed** (B1) |
| `vitest run apps/web --maxWorkers=4` | 801 files / 9,072 tests: **3 failed** (B1), 338 s |
| `vitest run tests/performance` | 13 files / 198 tests pass |
| `vitest run tests/contracts/phase-02-slice-12` | 29 files / 666 tests: 1 failed (n7, 58 stale receipts) |
| `vitest run` citation reconciliation + `tests/e2e/support` unit tests | 7 files / 61 tests pass |
| v8 changed-line coverage, 263 files / 2,673 tests | 62 of 63 changed production files with 0 uncovered changed lines; 1 gap (m6); the 3 B1 tests failed in that run too |
| `astro build --outDir <scratch>/dist` then `node scripts/verify-bundle-budget.mjs <scratch>/dist` | build 5 s, gate exit 0 |
| Revert checks, 38 mutants in the scratch copy (+ R4b, 3 rewritten digest rows) | 37 killed, 1 survives (R2, m2); R4b: 3 rewritten rows fail, the stale-titled pattern row does not (m7) |
| Probes (8, scratch) | all reproduce; SHA-256 below |

## Revert checks (scratch copy; each mutant run against its directory)

web8a (19): locale L1 unknown+moved calls `hold()` again (2 rows fail), L2 adopts the version in the unknown path (2), L3 adopts any different version (1), L4 moved keeps `unverified` (2), L5 no `entryMoved` (2), L6 old 422 copy (2), L7 confirmed save with a moved source does not hold (1); template T1 no StrictMode re-arm (1), T2 no supersede guard (1); registry R1 create send not held (2), **R2 successor send not held (0, survives)**, R3 pattern send not held (1), R4 no automatic read (21), R5 failed chunk not held (1), R6 context never replaced (5), R7 `holding` always false (6), R8 no added/removed (10), R9 pattern block-key grammar changed (3, drift test fails), R10 local grammar flags changed (1).
web8b (19): B1 insert not held (4), B2 accept (2), B3 detach (3), B4 new blocks (1), B5a bulk accept (3), B5b bulk detach (1), B6 `busy` ignores `holding` (14), B7 `holding` false (19), B8 `busy` ignores `unconfirmed` (7), B9 never unconfirmed (9), B10 `keepRetired` off (1), B11 list sequence guard off (1), B12 list generation guard off (1), B13 related "Check again" unmounts while reading (2), B14 focus effect steals from the control (1), B15 related stale reconcile applies (1), B16 related adopts any token (2), B17 an edit lifts `reconciling` (1), B18 `restated` always refocuses (6).

## Bundle (own build, pinned Node 22.23.1, source revision 85ab5ff0 plus working tree; budget 92,160 gzip)

| Route | Initial gzip | Margin | | Route | Initial gzip | Margin |
| ----- | -----------: | -----: | - | ----- | -----------: | -----: |
| CMS taxonomy edit | 92,096 | **64** | | CMS pattern create | 87,143 | 5,017 |
| CMS pattern edit | 92,066 | **94** | | CMS template edit | 84,417 | 7,743 |
| Content schema registry (entry) | 91,665 | 495 | | CMS capability grants | 83,988 | 8,172 |
| CMS conflict resolve | 91,318 | 842 | | CMS composition | 82,790 | 9,370 |
| CMS entry editor | 90,899 | 1,261 | | Infrastructure (workbench route) | 79,110 | 13,050 |
| CMS locale variant | 90,578 | 1,582 | | CMS template create | 78,963 | 13,197 |
| CMS entry create | 90,188 | 1,972 | | Platform configuration | 78,239 | 13,921 |
| CMS review detail | 89,822 | 2,338 | | CMS related content | 78,160 | 14,000 |
| CMS entry workflow | 89,112 | 3,048 | | CMS taxonomy create | 76,167 | 15,993 |
| CMS revision history | 6,459 | 85,701 | | CMS definition review detail | 75,576 | 16,584 |
| CMS entry list / review queue / definition review queue | 1,954 | 90,206 | | | | |

Every number equals the lanes' (web8a bundle round: pattern edit 92,066, taxonomy edit 92,096). `cms-registry-read.*.js` (2,921 B raw), `taxonomy-versions-read.*.js`, `locale-source-refresh.*.js` and `locale-variant-submit.*.js` exist as chunks and appear in no route's `initialAssets`. Grepping the build: the context path, the reader's sentences and the block-key regex are only in the `cms-registry-read` chunk (plus the shared grammar in `contracts-client-rules`); the pattern designer's old fixed copy (M1) is in `use-registry-context.*.js`, an initial chunk.

## Shared files

`scripts/verify-bundle-budget.mjs` (`92e36ccd…`) and `tests/performance/cms-editorial-bundle-budget-mounted.test.ts` (`8244c3c9…`): the diff against HEAD is five edits and they agree: `locale-variant-submit` `importedBy` names the seam, `locale-source-refresh` trigger/reason updated, new entries `cms-registry-read` (importedBy `registry-read-on-demand.ts`, proof `cms-on-demand-registry.proof.test.tsx`) and `taxonomy-versions-read` (importedBy `taxonomy-versions-on-demand.ts`, proof `cms-on-demand-taxonomy-locale.proof.test.tsx`), and the two stems in the test's expected list. The 13 registry tests pass.

## Real-route specs root must run

1. `tests/e2e/phase-02-slice-12-template-real-route.spec.ts` and `...template-uncertain-real-route.spec.ts` (root already edited both): the successor/create automatic reads; the digest 409 now also issues a context GET that no spec scripts.
2. `...template-states-real-route.spec.ts`, `...template-journey-real-route.spec.ts`, `...template-edit.spec.ts`.
3. `...page-operations-real-route.spec.ts`: AC-058 locale save (post-save source read, version adoption), AC-105 pattern create and successor, AC-111 composition placement (first run of the instance-list refetch through the real DEC-206 proxy and the strict `isRow` check against the real payload).
4. `...locale-related-journeys-real-route.spec.ts` J4 (two locale saves, the second carries the version after the refetch) and J5 (related success read).
5. `...definition-journeys-real-route.spec.ts` (vocabulary create then versions refetch; the lazy `taxonomy-versions-read` chunk is fetched), `...definition-pages-real-route.spec.ts`, `...locale-real-route.spec.ts`, `...term-merge-journey-real-route.spec.ts`.
6. `...governed-review-real-route.spec.ts` T1-T8 and `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts` (T4/T5 cold load of the taxonomy edit route, 64 B margin).
7. The new wave-9 composition journeys (`...linked-update-journey`, `...dependency-journey`, `...keyboard-journeys`, `...protected-journey`): every composition control now stays disabled through the refetch tail, so a journey must wait for the control to re-enable.
8. Gaps no spec covers (add before citing AC-271 rows): a locale unknown outcome with the entry version bumped (the replay of the identical request); an accept that retires a block followed by the real list refetch, and the same after a draft-revision change (m3); a real digest 409 loading the `cms-registry-read` chunk; a composition unknown outcome with "Check again" against a failing then a working entry read.

## Requests to root

1. Close B1 (preload) and M1 (two copy sentences) before the web group is committed; re-run `vitest run apps/web` after clearing the stale "failed" record, or simply after the preload.
2. Decide m3 (revision filter in `keepRetired`) and m10/m1 (a deadline for composition and registry reads); m5 (a changing sentence on a repeated failed re-check).
3. Retitle the pattern states row and drop it from the cited cell (m7); regenerate Slice 12 evidence (n7).
4. Keep AC-271 citations uncited for the rows B1, m2, m5 touch until they are fixed.
5. Run the real-route specs above. Neither lane could.

## Evidence files (scratch, `.../scratchpad/claude_s12_v20/`)

| File | SHA-256 |
| ---- | ------- |
| `probes/probe-v20-digest-copy.test.tsx` (M1, create) | `14d97ef0b7802bc1fe944510bee6cc35269217f0c1c52ae8cd03eaea9d18818d` |
| `probes/probe-v20-pattern-copy.test.tsx` (M1, pattern) | `293764243f12ba057d992aacc513eeeb80e8c1ad1f9b990d88c6ae9af5dcc7a7` |
| `probes/probe-v20-hung-read.test.tsx` (m1) | `39d2c3e4b5a4820d5b674a52da2ec1cc3c378cfcf4631adbc65ee5ed367cfe68` |
| `probes/probe-v20-successor-hold.test.tsx` (m2) | `f8fbada2d0e48ef088fcbd5804d48658d601aabfef1388e4d08fbdf19171af3c` |
| `probes/probe-v20-stale-revision.test.tsx` (m3) | `4dd696ce6c47dd9a3c90be16e3f968a39dcb9fb316c573adc0afeea62332a784` |
| `probes/probe-v20-moved-edit.test.tsx` (m4) | `377125f78e810011a090fbd41d9f2546b6976acdc1672888643373da957ef7fb` |
| `probes/probe-v20-recheck-silent.test.tsx` (m5) | `1fd4777b21f381b7a0281e0dc7d6a7cc77d2dfc9eb824b0b33a416cf61cffea5` |
| `probes/probe-v20-postsave-read.test.tsx` (sweep, locale post-save read) | `e64f2598b3ebb6c0544513856d5bbc4762707676d5df9b233a6658b25d5a3d60` |
| `revcheck.py` / `spec_a.json` / `spec_b.json` | `08d2fad7…6061` / `ad0ff1fd…1968` / `52d50aa4…4460` (full: `08d2fad7d7bb419c4c531c263be9e3fdea2420b8227f7f39a19951486520ed4b`, `ad0ff1fde9bc5108645cec46e62b1334d34f123c54149384ddbbb8f174031968`, `52d50aa4e8434dc467b4a9d601d95e904ea179439f99099704ab62b63514460c`) |
| `bundle.json` / `bundle-table.txt` | `d43111623eeeac86f51efd256f3cb3c7b869330ea2c9ebdeefa4cad797190789` / `33ef8e8b44529c8e8ed5312026c288a04f56380351a65a304fc723d5ccac1979` |
| `unscripted-list-reads.log` (n4) | `6bff7fe1ac2222276272d45f883e4128387a62d03e8bf26013f259e8bd109db1` |
| `cycles.mjs` / `sizes.mjs` / `shacheck.mjs` | `0e426a8c…5a54` / `c97446b8…a567` / `ab482311…1e66` |
