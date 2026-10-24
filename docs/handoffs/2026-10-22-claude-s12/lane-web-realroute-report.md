# lane claude_s12_web_realroute report (round 3, 2026-10-23)

## Status

READY-FOR-ROOT-RUN, with one caveat stated first: the new governed real-route spec (`tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts`) was written without a running stack, so it type-checks and lints but has never executed. Everything else in review V11 is done and verified here (pinned Node 22.23.1, fresh production build).

- `pnpm bundle:check` exits 0 on a fresh production build under the pinned Node; all 20 measured CMS routes are under 92,160 gzip bytes with the STRICT gate (tightest: CMS entry editor 91,828, headroom 332; CMS review detail 91,417, headroom 743). No budget or threshold was touched.
- Whole-web vitest: 706 files, 8,369 tests (V11 base: 688 files, 8,216 tests); the last full run had 3 stale source-regex expectations in `cms-lazy-forms-closure-answer.test.ts`, which I corrected (33 of 33 now pass). `pnpm type-check`, `pnpm format:check` and `pnpm lint` exit 0.
- Not run by me (rules): real-route Playwright, supabase, docker, db commands.

## Scope: what each V11 finding became

| finding | outcome |
|---|---|
| H1 failed chunk fetch wedges a form | Every dynamic import I introduced now fails into the surface's own "nothing was sent" or degraded state, leaves the form usable, retries on the next action and never caches a rejection. Tests reject once, then load, on every surface: workflow and governed commands, canonical reads, editor save flow, taxonomy / term / locale writes and the locale source refresh, restore shell, and every lazily loaded view (`cms-retryable-lazy.tsx`: an alert and a button that imports again). The reader of the post-command result is no longer a dynamic import at all (see M4). |
| H2 `contracts` / `validators` load at mount | The reviewer-options read of both assignment forms waits for the first pointer, touch, focus or key in the assignment region (`use-reviewer-options.ts`, `whenRegionTouched`). FE03 cites: "Performance budgets and loading strategy" (lazy modules "load on explicit entry"), the `CmsEditorialReviewAssignmentForm` / `CmsGovernedAssignmentForm` rows (they name the source of the options, not a moment), :1172 (the 429 re-read still works). Tests: hook-level (8) and both real forms (4), plus a mutation run (below). |
| M1 visibility-armed forms | There is no visibility arming left: forms and the reads they make load on pointer / touch / focus / key / change in their region only, never on scroll, time, viewport size. The harness proves it in real Chrome at 400, 700 and 1200 px viewport heights. The gate text and READMEs no longer say "scrolls into view". |
| M2 pre-hydration lock | Deleted (`RegionLockContext`, `LOCK_ATTRIBUTE`, `useServerRegionLock`, `textLock`, `disabledLock`). Controls are native and enabled before hydration; the last value of every control of an unhydrated region is recorded and the field primitives start their state from it. Real Chrome: typed text survives and is what is sent, Tab order is the native one, Playwright `fill` does not deadlock. |
| M3 replay dedupe untested | `cms-lazy-intent.test.tsx` "replays a form held several times once, with the submitter of the first press". Mutation: removing `replayed.has(form)` fails exactly that test. |
| M4 landing over budget | The result reader (`cms-editorial-result-take.ts`) and the panel are part of the editor island; the producers load only `cms-editorial-result-save.ts`. The gate no longer exempts `cms-editorial-result-handoff` or `CmsEditorialResultPanel`. The editor route is 91,828 including them. Cost I accepted: an ordinary editor load now fetches the reader and `step-up-draft` (about 1.4 KB gzip) it used to fetch only when a result was waiting; the alternative (keeping it lazy) left the route 37 to 574 bytes over, and a lazy landing chunk is charged to the route either way. |
| L1 Node version / non-production dist | `bundle:check` refuses any Node but the one `.node-version` pins, refuses a dist whose `server/wrangler.json` has a `targetEnvironment`, one carrying `jsx-dev-runtime`, and one with no server build; the evidence JSON records `measuredWith.node`. Verified: the same dist under `/usr/bin/node` v26.11.1 exits 1 with a message naming both versions (it measured 660 to 801 bytes more per route). |
| Area 6 governed real-route spec | Written (T1 to T6), see "Requests to root". |

### Other changes this round (needed to fit the strict gate)

- The page-actions script (create type selector, restore review, restore confirmation; about 2 KB gzip) is no longer loaded by every CMS route. `CmsEditorialDocument.astro` takes a `pageActions` prop and renders `CmsEditorialPageActions.astro` only for `entries/new` and `entries/[entryId]/revisions`. `tests/performance/cms-page-actions-routes.test.ts` follows each page's imports and fails when a page renders a form the script serves without the prop, or passes it without one (RED first: it named exactly those two pages). The gate lists `pageActions: true` on those two routes and charges the script there. Savings: 2.0 KB on every other route (entry list and queues: 4,399 to 1,954).
- The editor save controller no longer goes through `importModule` (the shared helper is a 272-byte chunk of its own that the editor route needed for nothing else); it throws a private sentinel when its chunk cannot be fetched. Same behaviour, same tests.
- `restoreActionImporters` seam added beside `restoreDraftImporters` (page-actions dom helper) so the proof test can count the request.

## The gate (scripts/verify-bundle-budget.mjs), strict version

A route is charged for its static closure plus every dynamic edge of that closure not named in `CMS_ON_DEMAND_CHUNKS`, followed transitively. An entry is allowed only with:

- `trigger`: the person's own event (never visibility, scroll, time, viewport, page arrival or a mount effect);
- `importedBy`: every source file holding a dynamic `import()` of it (or `specifier` for a package entry). A test fails on any other call site;
- `proof`: a test with the stem in its title that mounts the real surface, sees nothing requested by the mount, a scroll or two minutes of fake time, and sees the trigger request it. The meta test checks that the file exists and holds `it('<stem>: ...`;
- `chargedOn`: routes where it loads without a trigger (only `cms-editorial-restore-draft`, on `CMS revision history`, where the page looks for its restore form at load).

Removed as false: `cms-editorial-result-handoff`, `CmsEditorialResultPanel` (landing-dependent). Reworded as true: the four governed forms (intent only, no visibility), `cms-workflow-refusal` and `governed-review-refusal` (also warmed on focus), the Time authority pair (opening the schedule form, or returning to it from the person's own step-up). 27 entries remain; 27 proof tests, one per stem, in four files:

| proof file | stems |
|---|---|
| `cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx` | contracts, validators, contracts-time-authority, time-authority, cms-workflow-command-transport, cms-workflow-refusal, cms-workflow-canonical-read |
| `cms-governed-review/cms-on-demand-governed.proof.test.tsx` | CmsGovernedSubmitForm, CmsGovernedDecisionForm, CmsGovernedAssignmentForm, CmsGovernedActivationForm, governed-review-command-transport, governed-review-refusal, governed-review-canonical-read |
| `cms-editorial/cms-on-demand-editor.proof.test.tsx` | cms-editorial-entry-editor-save, cms-editorial-runtime, cms-editorial-entry-draft-detail-transport, cms-editorial-entry-create-submit, cms-editorial-conflict-resolve, cms-editorial-conflict-detail-transport, cms-editorial-page-actions-restore, cms-editorial-restore-draft |
| `cms-on-demand-taxonomy-locale.proof.test.tsx` | taxonomy-designer-submit, taxonomy-outcome-reconcile, term-action-submit, locale-variant-submit, locale-source-refresh |

`contracts` has no call site by design: it is reached only through the static edge of `validators`, which the static closure guards (`cms-island-static-closure.test.ts`) keep out of every island.

Mutation runs (scratch, reverted, file hashes restored): removing the replay dedupe fails 1 test; making the editorial assignment form read at mount again (dropping the region argument) fails 2 tests (`contracts` proof and the real-form test); both RED before the change and green after. Gate fixtures were written RED first (27 proof/meta tests failed until the proofs existed; the page-actions and landing tests failed until the gate changed).

## Per-route gzip bytes (pinned Node 22.23.1, fresh production build, `pnpm bundle:check`)

"round 2" is the state V11 reviewed with the lenient gate. "V11 strict" is V11's own charged variant where it gave one. "now" is the strict gate on the current tree.

| route | round 2 (lenient gate) | V11 strict | now (strict) | headroom to 92,160 |
|---|---:|---:|---:|---:|
| CMS capability grants | 83,641 | - | 83,641 | 8,519 |
| CMS entry list | 4,399 | - | 1,954 | 90,206 |
| CMS entry create | 87,832 | - | 89,284 | 2,876 |
| CMS entry editor | 91,787 | 94,455 | 91,828 | 332 |
| CMS revision history | 4,399 | - | 6,107 | 86,053 |
| CMS entry workflow | 88,525 | - | 87,594 | 4,566 |
| CMS related content | 78,158 | - | 76,466 | 15,694 |
| CMS composition | 81,259 | - | 78,814 | 13,346 |
| CMS locale variant | 89,654 | - | 88,349 | 3,811 |
| CMS conflict resolve | 90,788 | 92,615 | 90,406 | 1,754 |
| CMS review queue | 4,399 | - | 1,954 | 90,206 |
| CMS review detail | 91,743 | 146,667 | 91,417 | 743 |
| CMS definition review queue | 4,399 | - | 1,954 | 90,206 |
| CMS definition review detail | 73,193 | 100,910 | 73,867 | 18,293 |
| CMS pattern create | 83,804 | - | 81,359 | 10,801 |
| CMS pattern edit | 87,528 | 100,446 | 86,215 | 5,945 |
| CMS taxonomy create | 76,311 | - | 75,114 | 17,046 |
| CMS taxonomy edit | 90,944 | 103,862 | 90,218 | 1,942 |
| CMS template create | 71,604 | - | 71,604 | 20,556 |
| CMS template edit | 78,815 | 91,662 | 79,194 | 12,966 |

Content schema registry 91,671 (untouched; V11 saw 92,385 only under Node 26), workbench routes unchanged. Evidence: `gate-final.json` SHA-256 `af7cd3ce07ba80b4e754d2ed01d0366021b5984d4fd84031ce3d47a2d431c1dd` (scratch), `measuredWith: { node: v22.23.1, pinnedNode: 22.23.1 }`.

Margins: the editor route has 332 bytes and review detail 743. Moving a kilobyte of code between chunks shifts a route by up to about 0.5 KB, so a future change to the editor route should expect to cut elsewhere in it.

## How the gate guards against measuring the wrong thing (L1)

`main()` checks, before it measures: Node equals `.node-version` (`pinnedNodeFailure`), `dist/server/wrangler.json` exists and has no `targetEnvironment`, and no client asset contains `jsx-dev-runtime` (`distProvenanceFailures`). A dev-mode staging dist like the 13:52 one now fails with "built for the staging environment ... run a fresh production build" instead of failing every route on bytes. The guards live in `main()` only: the exported measurement functions (used by the fixture tests under whatever Node runs vitest) are unchanged. The evidence consumers (`verify-performance-evidence.ts`) read named fields, so the added `measuredWith` is ignored by them. Tests: `tests/performance/bundle-provenance.test.ts` (10).

## Files

`docs/handoffs/2026-10-22-claude-s12/lane-web-realroute-files.md` (path, lines, SHA-256, git state). Untracked files belong to this or other lanes. Tar backups of everything edited in place are under `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_web_realroute/backup/` (this round: `round3-gate-*.tgz`, `handoff-split-*.tgz`, `astro.config.mjs.round3`, plus single-file copies `*.orig.*` for the mutation and experiment restores).

## Runs

| run | result |
|---|---|
| `pnpm --filter web exec tsc --noEmit`, `pnpm type-check` | exit 0 |
| `pnpm format:check`, `pnpm lint` (`--max-warnings=0`) | exit 0 |
| `./node_modules/.bin/vitest run apps/web tests/performance tests/chrome-only-browser-gate.test.ts tests/validation-toolchain.test.ts` | 706 files, 8,369 tests; 3 stale regex expectations fixed afterwards (33/33 in that file) |
| `pnpm --filter web build` then `pnpm --silent bundle:check` (Node 22.23.1) | exit 0 |
| same gate under `/usr/bin/node` v26.11.1 | exit 1, "must run under the pinned Node 22.23.1" |
| real Chrome harness (`harness/drive.mjs`, esbuild bundle of the real frame, intent module and field primitives) | 15 of 15 checks; output SHA-256 `1422a9f4cb2f6cae3c6b23a190964d1ead67ff3f7b58d4bdf9b3e514f8f567d6` |

The first harness run showed 3 submissions where 1 was expected; the cause was the harness resetting its artificial chunk delay before the clicks (the chunk then loaded at once and the later clicks were ordinary), not the product. Fixed in the harness; recorded here so it is not rediscovered.

New or rewritten test files this round: `cms-retryable-lazy.test.tsx` (4), `use-reviewer-options.intent.test.tsx` (8), `assignment-reviewer-read-intent.test.tsx` (4), four `*.proof.test.tsx` files (27 proofs), `cms-page-actions-routes.test.ts` (19), `bundle-provenance.test.ts` (10), `cms-lazy-intent.test.tsx` (29), `CmsWorkflowFields.seed.test.tsx` (5), the failure-path files (`*load-failure*`), plus `cms-editorial-bundle-budget-mounted.test.ts`, now 76 tests (three per exempt stem for trigger and proof file, call sites and fixture routes, plus the landing, per-route and page-actions cases).

## Test corrections (none weakens an assertion)

- `cms-lazy-view.test.tsx`: two tests asserted `$$typeof === react.lazy`; the view is now a retryable lazy view, so they assert the same fact (nothing loads until intent, then the chunk loads once) by mounting it.
- Reviewer-options tests (`CmsEditorialAssignmentCreate.rate-limit`, `CmsGovernedAssignmentForm.rate-limit`, both `*AssignmentForm.test.tsx`, `CmsEditorialReviewDetailIsland.focus/status`, `cms-workflow-focus-forms`, `cms-workflow-privacy`): the read now starts on first intent in the region, so their mount helpers dispatch one `pointerover` (`mountWithIntent`, `showIntent` in `cms-editor-dom.test-support.tsx`). Every assertion they made about the loaded options, the 429 wait and the privacy of the person id is unchanged.
- `cms-lazy-forms-closure-editor.test.ts`: the "result reader stays out of the editor closure" test became "the reader and panel are in the island, the writer is not" (M4 decision); the restore-recovery test looks for the import where the seam now lives.
- `cms-lazy-forms-closure-answer.test.ts`: three source-regex expectations now name the failure-aware wrappers instead of the old `await loadX()` text.
- `use-cms-editorial-result.test.tsx`: rewritten against real storage (no module mock) now that the reader is static; the load-failure test for it was deleted with the dynamic import.
- `revision-history-route.test.tsx`: the shell-script assertion moved to the new `CmsEditorialPageActions.astro`.

## Spec citations

FE03 "Performance budgets and loading strategy" (lazy modules load on explicit entry; budgets are hard criteria: no raised number); FE03 :1172 and :1173 (429 wait and safe-read retry, kept); the `CmsEditorialReviewAssignmentForm` and `CmsGovernedAssignmentForm` rows (reviewer options come from the owner-only grant list; no moment is stated, so reading on first intent is allowed); "Completion" :1219 (the result is stated by the landing page); P2-S11-AC-106 (everything fetched until idle counts); P2-S12-AC-273 (two-person journey, keyboard and 200% zoom).

## Open items

1. Governed real-route spec never ran. Selectors follow the component sources; T6 names several buttons by pattern (the activation and retire confirmation wording and the "retry after a lost answer" control are not asserted from source). Expect to adjust labels on the first run.
2. The real-route API Worker did not serve the governed review routes at all: `content-schema-registry-api.ts` wired only the editorial dependency over the stack, and the template and locale dependencies as in-memory fixtures. I added the production `cmsGovernedReview` and `cmsTaxonomyDefinition` compositions (`support/s12-real-governed.ts`, spread into `appFor`). The template and locale fixtures are untouched, so the existing Slice 12 real-route specs should behave as before; confirm with the commands below.
3. The spec's subject is a vocabulary version (least to set up). The same commands review template and pattern versions; T6 as V11 wrote it covers all three kinds, mine covers one. The "protected" decision class (DEC-110 specialist reviewers) and the step-up round trip are not driven; T6 covers an ordinary approval across a lost answer with key reuse.
4. Not covered by any spec: a click on a `type="button"` action before hydration is dropped, not replayed (L2, left as V11 rated it Low; the region arms on the first pointer move).
5. Taxonomy fields cost about 4.2 KB gzip on the editor route (measured by stubbing the connected field). That is where the next kilobyte has to come from if the editor route grows.
6. The `loading reviewers` sentence shows until the first pointer, touch, focus or key in the assignment region. A screen-reader user in browse mode who never focuses anything sees it unchanged; reaching the select by Tab or forms mode arms it.

## Addendum: root run `pw-realroute4-20261023T194528Z` (bundle-budget 3/3, template, rich-text, toolbar, draft-detail, authoring, locale PASS)

1. S11-RR-06 failed because the radio was checked before the lazily loaded editorial decision form hydrated; that choice never reached the form's state, so the commit control stayed "Record decision" and "Record approval" never appeared. The form was not intent-loaded: it loads with the page, but hydrates after its server markup is visible, and my round 2 had left that window unprotected for every form that does not load on intent. Fix: every command frame is now a region (its own heading id unless it names one), so what a person chose, typed or pressed before hydration is recorded, carried into state and replayed once, for ALL command forms (editorial and governed), not only the intent-loaded ones. RED first: `workflow-lazy-hydration.test.tsx` (2) reproduced "Record decision" and "no request" on the real editorial decision form behind a late lazy; both pass now. The intent-loaded governed forms were already covered by `governed-lazy-hydration.test.tsx` and the Chrome harness (15 of 15, including a press before the chunk arrived); the only forms outside the frame (taxonomy, term, locale designers) hydrate with their island and never had a separate chunk. Two frame tests that asserted "no region without lazyRegion" were updated to the new contract.
2. Governed spec T1: `taxonomyKey` must match `^[a-z][a-z0-9-]{1,63}$` (`CmsTaxonomyKeySchema`, key-grammar.ts); my fixture used underscores. Now `s12-gov-<8 hex>`. I also parsed every body the fixture sends (taxonomy version, governed submission, assignment, decision) against the contract schemas in a scratch test: all four are valid. T2 to T6 still await their first run.
3. Verification after both fixes: fresh production build, `pnpm --silent bundle:check` exit 0 (editor 91,828, review detail 91,414, taxonomy edit 90,219; the rest unchanged); `pnpm type-check`, `format:check`, `lint` exit 0; 254 files / 2,575 tests of the workflow, governed, editor, pages, closure and performance suites pass.

Rerun for root (the two specs, then the governed one, each after a reset):

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
for spec in phase-02-slice-11-workflow-real-route phase-02-slice-12-governed-review-real-route; do
  node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/$spec.spec.ts
done
```

## Addendum 2: root rerun `pw-realroute4-20261023T200421Z` (8 of 9 pass; governed T1 failed)

T1 timed out waiting for `button /Record approval/` in the governed decision region. Verdict: (b), a spec assumption, not a product defect. The log has no page snapshot (the error context is empty), so the cause is read from the source: the governed decision button's accessible name comes from the form's state (`CONSEQUENCE[decision]`: "Record decision" until a choice is in state, then "Record approval"), and the server markup cannot know the choice. In T1 the test checks Approve and presses the control while the chunk is held, so the only control on the page is named "Record decision". The seeding I added keeps the choice and renames the control as soon as the form hydrates (that part is the component RED/GREEN already in `governed-lazy-hydration.test.tsx` and `workflow-lazy-hydration.test.tsx`). Fix in the spec: T1 presses `/Record (?:decision|approval)/`; T3 waits for the control to read "Record approval" after the chunk is released before it tabs to it. No product or shared-frame code changed in this round, so the workflow spec does not need a rerun for it. T2 to T6 have still never run.

Rerun for root:

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts
```

## Addendum 3: root run `pw-realroute-governed-20261023T201743Z` (T1 to T4 pass, T5 fails, T6 not run)

Root's hypothesis is confirmed in real Chrome: a browser keeps a FAILED dynamic import in its module map, so importing the same URL again rejects without any request, even after the network is back. jsdom and Vitest never model this, which is why every failure-path test I wrote (one rejection, then success) passed while T5 could not. Proof (scratch harness `retry/`, output SHA-256 `5d63f5a5edc71628d9322a50bc39faafd8b264d1c2679eebb84bf9136e0efa97`): with the chunk answering 503 once, a plain `import()` retry after the server recovered failed with 0 requests; the same chunk imported with a marker (`chunk.js?wj_retry=1`) succeeded.

Fix: `apps/web/src/lib/retryable-import.ts`, `retryable(() => import('./x'))`. On failure it reads the failed URL out of the browser's message (Chrome "Failed to fetch dynamically imported module: URL", Firefox "error loading dynamically imported module: URL") and retries that URL with `wj_retry=1`, then `2` if that fails too. It remembers the module once it loaded, because the plain specifier would still fail from the map, and it shares one in-flight attempt. A failure that names no URL (Safari) is retried with the same specifier: nothing better exists, the caller's own "nothing was sent" state stands.

Consequence for a second module instance: a chunk that failed never ran, so there is no state to duplicate; its static imports keep their plain URLs and their single instance; two loaders that retry the same chunk use the same marked URL, so they share one instance (proved: `instances=1`). One thing it does not share: a second loader of the same chunk that has not tried yet hits the cached failure once, then succeeds on its next action. No chunk has two loaders on one page today.

Applied to every dynamic import with a failure path: the workflow and governed answer machinery (transport, refusal, canonical read), the editor save flow, its runtime, the draft-detail transport (editor and conflict page), the conflict detail transport and resolve, the entry create submit, the taxonomy submit and reconcile, term action, locale save and source refresh, the restore command and restore draft store, the contract validators loader (its own "retried by the next caller" comment was equally untrue in a browser), the Time authority, and every lazily loaded view (`selectView` wraps its loader, so the four governed forms, the editorial decision and assignment forms and `retryableLazy` retry correctly). `tests/performance/cms-editorial-bundle-budget-mounted.test.ts` now fails on any exempt chunk whose call site is not wrapped (mutation: an unwrapped `loadResolve` fails exactly that test). Unit tests: `retryable-import.test.ts` (7).

Byte cost and the offsets: `retryable-import` is a 425-byte chunk the entry editor and review detail routes now load. To stay under budget I (a) simplified the editor save controller (the helper now owns the retry, so its own cache and sentinel are gone) and (b) removed the editor's "is a result waiting" peek: the reader already does nothing for an empty tab store (`hasPendingCmsEditorialResult` and its tests are replaced by a test that the writer's scope is what the reader finds). Result: CMS entry editor 92,081 (79 bytes of headroom, was 332) and CMS review detail 92,080 (80), the other routes unchanged within a few bytes; `pnpm --silent bundle:check` exit 0 on a fresh production build. The editor margin is now thin; the next kilobyte there has to come from the taxonomy field (open item 5).

Verification: `vitest run apps/web tests/performance tests/chrome-only-browser-gate.test.ts tests/validation-toolchain.test.ts`: 708 files, 8,403 tests; `pnpm type-check`, `format:check`, `lint` exit 0. I changed no shared frame code this round (the frame change of addendum 1 was already in the workflow rerun that passed), but I did change shared lazy-view and answer machinery code, so rerun the workflow spec as well.

T6: I re-read it against the same T5-class assumption. It has no retry-after-failed-chunk step; its lost-answer step aborts a response, not a chunk. Its first run is still outstanding.

Rerun for root (fresh production build first, then the three):

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH && pnpm --filter web build && pnpm --silent bundle:check > /tmp/bundle-check.json; echo $?
for spec in phase-02-slice-12-governed-review-real-route phase-02-slice-11-workflow-real-route phase-02-slice-11-bundle-budget-real-route; do
  node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/$spec.spec.ts
done
```

## Addendum 4: T5 failed earlier (no "nothing was sent" alert on the first click)

Root's reading is right. A focus warms the transport (`warmCommandForm`), so by the time the click sends, the plain URL has already failed once and the send uses the marked URL `...js?wj_retry=1`. My route glob (`**/_astro/governed-review-command-transport*.js`) does not match a URL with a query, so the marked retry went through and the chunk was no longer "unfetchable". Spec fix only (product unchanged): the route is now one RegExp object that matches the chunk with or without any `?...` query (`/\/_astro\/governed-review-command-transport[^/]*\.js(?:\?.*)?$/u`), used for both `route` and `unroute`; the assertions are unchanged (first click: alert, 0 posts, Reason kept; after unroute: exactly 1 post and "Decision recorded.").

Product behaviour for a chunk that stays unavailable, proven in real Chrome (harness `retry/drive2.mjs`, output SHA-256 `3ea4206f2cbf260c336dbdbf6d5db622ac6dde20e4b10929b32895008aacb209`): with the server failing the plain URL and every marked URL, click 1 (plain) fails, click 2 (`wj_retry=1`) fails, click 3 (`wj_retry=2`) fails; after recovery the next click requests `wj_retry=3`, a URL no earlier click used, and succeeds. The counter lives in the per-chunk closure, so it survives across clicks and never re-asks a cached-failed URL (the requests were exactly `chunk.js`, `?wj_retry=1`, `?wj_retry=2`, `?wj_retry=3`, no repeats). No helper change was needed.

T6 still needs its first run. Rerun for root (governed spec only; no product code changed since addendum 3's workflow rerun):

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts
```

## Addendum 5: root run `pw-realroute-governed-20261023T205820Z` (T1 to T5 pass, T6 fails at the reviewer select)

T6 `selectOption` waited 240 s for the reviewer option. Root's diagnosis stands as a UX defect whatever the read returned: the list sat empty (an enabled select with only "Choose a reviewer") with no sign of what was happening, and the spec acted faster than any state could show. I cannot tell from the log whether the read fired and answered empty or never fired, so the new states below make the next log say which.

Product change (RED first: `CmsReviewerChoice.test.tsx` failed to resolve the component; `use-reviewer-options.intent.test.tsx` retry test; a held-read test on both real forms):

1. Earliest intent: the read already started on a pointer, touch, focus or key ANYWHERE in the assignment region (document-level capture on `data-cms-lazy-region`), not only on the select; a real-form test now dispatches on the label next to the select and sees the read start. Both assignment frames (create and revoke) now share the region name, and the editorial assignment form chunk now loads on that intent too (below).
2. Pending state (`CmsReviewerChoice.tsx`, used by the editorial and the governed create forms): while the read is in flight the list is ONE disabled option "Loading reviewers…", `aria-busy="true"` on the select (the control stays enabled, so opening it is itself intent), and a polite status "Loading reviewers…" (`data-cms-reviewers-status`). The choices replace the placeholder and the status says "Reviewer choices loaded."; a failed read (not a 429) shows one disabled option "Reviewer choices could not be loaded", the polite sentence and a button "Try loading reviewers again" that reads again (the list goes back to loading); a 429 keeps its announced wait and its own repeat ("Reviewer choices could not be loaded yet", no manual button). The old "Reload the page" instruction is gone from the reviewer lists. FE03 citations: "Loading" (:46 and :1214, a read exposes its loading state), :1125 to :1131 (a picker whose options are missing or degraded says so and offers the retry; the model row of CMS-11's picker), :1172 (429 wait).
3. Other deferred option reads: the reviewer list is the only deferred read that fills a native list. The schedule form's Time authority fills a `<datalist>` suggestion list of a free-text field (typing is never blocked and a failure says "The time zone data could not be loaded."); the taxonomy field and the template picker read at mount and already say "Loading terms…" / disable submission. No other empty-dropdown case.
4. Bytes: the new states cost about 400 bytes on the review detail route, which was at 80 bytes of headroom. The editorial assignment forms are owner-only and not needed to read the page, so they now load on intent like the governed ones (`cms-review-form-views.ts`, region `review-assignment`; new exempt stem `CmsEditorialReviewAssignmentForm`, with trigger, call site and proof test). CMS review detail is now 88,667 (3,493 bytes of headroom, was 80); CMS entry editor 92,081 (79) is unchanged.
5. Spec: T6 now hovers the assignment form, waits for "Reviewer choices loaded." and for the select to stop being busy, then selects. If the read comes back unavailable or empty, the failure now reads "Reviewer choices could not be loaded" or "No reviewer has an active cms.reviewer grant" on the page instead of a silent timeout; a grant-list authorization problem (the list route is the owner-only CMS-03A-18, `authClass cms_owner`) would show up there.

Verification: `vitest run apps/web/src tests/performance`: 707 files, 8,404 tests; `pnpm type-check`, `format:check`, `lint` exit 0; fresh production build and `pnpm --silent bundle:check` exit 0. Product code shared with the workflow spec changed (the assignment forms and the lazy view of the editorial review page), so rerun both.

Rerun for root:

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH && pnpm --filter web build && pnpm --silent bundle:check > /tmp/bundle-check.json; echo $?
for spec in phase-02-slice-12-governed-review-real-route phase-02-slice-11-workflow-real-route; do
  node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/$spec.spec.ts
done
```

## Addendum 6: T6 snapshot shows "Reviewer choices could not be loaded." for the owner

Verdict: (a) harness, not product, not fixture. Evidence, in order:

1. The page snapshot (`error-context.md` lines 83 to 92) shows the failure state my addendum-5 states made visible: status "Reviewer choices could not be loaded.", the retry button, and the disabled failure option. So the read ran and did not return a grant page (a 429 would have shown its own wait).
2. The read is `GET /api/v1/cms/capability-grants?capability=cms.reviewer&state=active&limit=100` (CMS-03A-18, `authClass cms_owner`, `stepUp none`). In the real-route launcher (`tests/e2e/support/content-schema-registry-api.ts`) the registry routes are served by test-owned ports: `dispatchRegistryPorts` (`s09-lane-api.ts`) sends a request to the lane port when the cookie is a lane session and otherwise to the legacy fixture port; the legacy fixture has NO `listCapabilityGrants`, so the merged port is the lane port, whose first line is `const lane = laneContext(input); if (lane === null) return unavailable();` (`s09-lane-grants.ts:140`). The owner of the governed spec carries a Slice 11/12 session, not a lane one, so `laneContext` is null and the answer is `503 DEPENDENCY_UNAVAILABLE`. That is exactly the "could not be loaded" state, with no network call to the database at all.
3. Not product: the same component, route and database authority serve the production Worker (`createProductionContentSchemaRegistryDependencies` maps `listCapabilityGrants` to `cms_list_capability_grants`); the governed page calls the read with the owner session and no step-up is required (`stepUp none`). Not fixture: the owner needs no extra grant for the list (the database resolves the receipt owner), and `provisionMember` already gave the reviewer an active `cms.reviewer` grant.

Fix (harness): `createS12RealRegistry` in `tests/e2e/support/s12-real-governed.ts`, wired in `appFor`. For a request that carries the Slice 11/12 claims (party, person, capabilities) the registry session and the `listCapabilityGrants` port are the PRODUCTION registry composition over the local stack (same seams as the governed dependency: the signed cookie names the actor); every other request, lane sessions included, keeps its previous port byte for byte, so the Slice 09 capability-grant specs are untouched. `pnpm type-check`, eslint and prettier pass; it cannot execute here.

The captured response, as asked: T6 now records every response to `/api/v1/cms/capability-grants` on the owner page (URL, status, first 600 characters of the body) with `console.log("[T6 reviewer-options read] ...")` and as a test attachment `reviewer-options-read`. Please send that line from the next log even if T6 passes: it is the evidence for item 2 (expected before the fix: 503 DEPENDENCY_UNAVAILABLE; after: 200 with the reviewer's grant). If the list now answers something else (a 403 or an empty page), that answer names the next cause (an owner receipt problem in the world would show as 403/404; a missing `cms.reviewer` grant as an empty page).

No product code changed in this addendum, so the workflow spec does not need a rerun. Rerun for root:

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts
```
(Also run the capability-grants real-route specs once, since the launcher's registry dependency is now wrapped: `phase-02-slice-09-capability-grants-real-route` and `phase-02-slice-09-capability-grant-personas-real-route`.)

## Addendum 7: the owner's grant read answers 401 UNAUTHENTICATED (`pw-realroute-gov2-20261023T214734Z`)

Captured by the probe: `GET /api/v1/cms/capability-grants?capability=cms.reviewer&state=active&limit=100` answered `401 {"code":"UNAUTHENTICATED","details":{"recoveryAction":"reauthenticate"},"message":"The authentication session is invalid."}`. S09 capability-grants (22) and personas (7) pass: the wrapper broke nothing.

Which resolver answered: not the lane port (that is the 503 of addendum 6) and not the launcher's fallback resolver (its refusal carries no `recoveryAction`; `route-response-details.ts:125` only emits one when the result's details carry it). The request reached the production registry composition (addendum 6 did put it on the path) and the 401 is the database's: `platform_private.cms_list_capability_grants` calls `cms_review_binding(p_request, actor, acting_party, false)` (`supabase/migrations/20261002144000_cms_list_capability_grants.sql:46`), which requires `context.actingContextId` to name an ACTIVE `acting_context_binding` row of that person and party (`20261002188000_cms_review_binding_step_up_proof.sql:22-75`), and raises `UNAUTHENTICATED` otherwise (`failure := case when p_recent then 'STEP_UP_REQUIRED' else 'UNAUTHENTICATED' end`). The Worker forwards `actingContextId` only for the private-binding operations, CMS-03A-18 among them (`production-context.ts:52-79`), and only if the session names one (`result.value.actingContextId`). The owner's test session named none: the signed claims carry party, person, capabilities and step-up, no binding.

Verdict: harness (the world), not product. A production owner always has one: signing in and selecting the organization runs `identity_context_bind`, and the authentication session projection then reads `actingContextId` back (`tests/postgrest/support/phase-02-slice-11-session.ts:122-209` is the same production flow in the real-API suites, and asserts `resolved.value.actingContextId === bindingId`). The product refusing a signed-in owner with no binding is the designed behaviour, so there is no product defect to report.

Fix, mirroring that production composition: the world now creates the binding through the real producer (`bindActingContext` in `s12-governed-world.ts`: `identity_context_bind` as the owner over PostgREST, with the owner's JWT, the organization as the context and a client-binding id); the owner's session claims carry it (`wj_acting_context`, `S12_ACTING_CONTEXT_CLAIM`, kept by `signInS11` and `completeStepUp` through `S11Actor.actingContextId` and `s11Session`); and the launcher's session resolver (`s12-real-governed.ts`) returns it as `actingContextId`, exactly as `auth.resolveSession` does in production. Sessions without the claim are unchanged. Type-check, eslint, prettier pass; it cannot execute here.

The probe is kept. Expect `200` with the reviewer's grant now. If it still answers 401, the next suspects are an `identity_context_bind` that refuses the owner (the world throws with its status and body) or a binding for another party; either message names itself.

Rerun for root (governed spec and the two capability-grants specs; no product code changed):

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
for spec in phase-02-slice-12-governed-review-real-route phase-02-slice-09-capability-grants-real-route phase-02-slice-09-capability-grant-personas-real-route; do
  node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/$spec.spec.ts
done
```

## Addendum 8: the owner's grant list is empty (`pw-realroute-gov2-20261023T215726Z`)

Probe: `GET /api/v1/cms/capability-grants?capability=cms.reviewer&state=active&limit=100` answered `200 {"items":[],"nextCursor":null}`: the binding fix worked and the list is empty.

Diagnosis (c), fixture. `platform_private.cms_list_capability_grants` selects from `platform_private.cms_capability_grants` where `owner_id = acting_party_id` (`supabase/migrations/20261002144000_cms_list_capability_grants.sql`, the `from platform_private.cms_capability_grants grant_row where grant_row.owner_id = acting_party_id` query). That table holds the grant AGGREGATES, which exist only because the owner issued them: `cms_grant_capability` (CMS-03A-15) inserts the aggregate and then projects it into the identity actor-grant table (`20261002141000_cms_grant_capability.sql`: insert into `cms_capability_grants`, then `cms_capability_grant_project(...)`). `provisionMember` (the world helper from Slice 11) does the reverse: it inserts straight into `identity_private.organization_actor_grant`, which gives the person the authority a session resolves capabilities from but creates no aggregate, so the owner's list can never show it. Right party and wrong table, not a product defect: the read lists what the owner granted, and the reviewer had been given authority behind the owner's back.

Fix (real producer, as the S09 grant specs do): T6 now has the owner issue the reviewer's grant through `POST /api/v1/cms/capability-grants` (`grantReviewerViaApi`, CMS-03A-15) after a fresh step-up, expecting 201; the aggregate is owner-scoped, valid for 60 days (the producer allows at most 89) and projects into the actor-grant table as the producer always does. For that the launcher's production registry wrapper now routes the whole grant console (list, grant, renew, revoke) for sessions that carry the Slice 11/12 claims; other sessions keep their ports.

Probe kept and sharpened: it now records the item count, and T6 asserts it before selecting ("the owner's grant list (CMS-03A-18) must hold the reviewer's cms.reviewer grant: -1 means no 200 answer, 0 an empty list"), so an empty list fails with that message instead of a 240 s timeout. Type-check, eslint, prettier pass; it cannot execute here.

Rerun for root:

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
for spec in phase-02-slice-12-governed-review-real-route phase-02-slice-09-capability-grants-real-route phase-02-slice-09-capability-grant-personas-real-route; do
  node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/$spec.spec.ts
done
```

## Addendum 9: T6 fails after the lost answer (`pw-realroute-gov2-20261023T220922Z`)

The grant fix worked (probe `200`, `items 1`; S09 grants 22 and personas 7 pass; T1 to T5 pass). T6 sent the first decision POST, its answer was lost, and `region.getByRole('alert')` was never found.

Verdict: spec assumed the wrong role; the product is right. A lost answer is an UNKNOWN outcome (`CmsWorkflowCommandFrame.tsx`, `workflowStatusText`): the frame keeps the entries, shows the polite status "The result could not be confirmed. Checking the current state before you retry.", reads the current state by itself (`controller.reconcile` through the form's `refetch`), changes the status to "The current state is loaded. You can retry the same request." and enables "Retry the same request" (aria-disabled until then), with "Check the current state" beside it. The `alert` role belongs to refusals (`refused`, `step-up-unavailable`, `signed-out`), never to an unknown outcome, which FE03 reconciles and does not guess (Slice 12 governed review reconciliation, DEC-113 and DEC-137: an unknown outcome renders pending, reconciled against a canonical refetch of the review and the subject).

Product check, component test first (it would have been RED if the product showed nothing or an alert): `CmsGovernedDecisionForm.test.tsx` "shows a polite status, not an alert, and offers the same key again when the answer is lost on the wire": the fetcher REJECTS (the browser's view of a reset connection), and the form shows no `alert`, refetches once, shows the "current state is loaded" status, keeps the typed reason, and the retry sends the same `Idempotency-Key`. It passed on the first run: no product change. (The existing test covered a 504; this one covers the reset that T6 produces.)

Spec fix: T6 now waits for the "current state is loaded" status in the decision region, checks the reason is still there, presses "Retry the same request", and keeps the assertions that the second POST reuses the first POST's key and that the database holds exactly one decision. At this step a failure now keeps evidence: `keepRegionEvidence` writes the region's accessible snapshot and text to `test-results-governed-evidence/lost-answer-decision-region-<time>.txt` (a directory of its own, git-ignored, which later specs do not wipe), prints it with the `[governed evidence]` prefix, and attaches it to the test.

No product code changed, so the workflow spec does not need a rerun.

Rerun for root:

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts
```

## Addendum 10: T6 fails at the Reason field after the status wait (`pw-realroute-gov2-` rerun after addendum 9)

Evidence. The status wait passed, then `region.getByLabel('Reason')` was not found. The evidence directory was empty because only the status step was wrapped. Reading the code gives the cause (and the component test below reproduces it): the aborted POST was fetched with `route.fetch()` first, so the server committed the decision. The reconcile read then shows the review `approved` with the reviewer's own decision, `permittedNextActions` no longer holds `record_decision`, and the decision form (`permitted ? <form> : null`) is removed. The frame stays (an `unknown` phase is readable), still reading "The current state is loaded. You can retry the same request." with a "Retry the same request" button.

Decision: (a), a product defect. The decision was recorded, so the page must show that and must not invite the same request. FE03 (governed reconciliation, DEC-113 and DEC-137: an unknown outcome is reconciled against a canonical read, never guessed) says the read settles it; BE03c CMS-03C-07 and the idempotency rule ("a lost response after commit replays by idempotency/status") make the replay an API fact, not a thing a form must offer.

RED first. `CmsGovernedDecisionForm.test.tsx` gained two tests (`when the answer is lost after the server recorded the decision`): the fetch rejects, then the refetch re-renders the form with a review that carries the caller's own decision (`mine: true`, not permitted). Before the fix both failed with "expected ... to be 'Decision recorded.'" and the received status "The current state is loaded. You can retry the same request." The second test covers a review closed by someone else (no `mine` decision).

Fix. `CmsWorkflowCommandFrame` takes an optional `settled` sentence; once a lost answer has been reconciled and a form supplies it, the status shows it and the check and retry buttons are not drawn. `CmsGovernedDecisionForm` supplies it only when the server no longer permits the decision: "Decision recorded." when the review holds a decision of the caller's own, else "The current state is loaded. This review no longer takes your decision." A form that supplies nothing keeps the retry offer unchanged (every other frame). Other governed forms (assignment, activation) were not changed: nothing in this request shows their reconciled read can tell a recorded result from a refusal, and I will not guess.

Spec change (T6). Every step after the lost answer now runs under `step(...)`, which keeps the region's snapshot and text (`lost-answer-<step>-<time>.txt`) on failure. Steps: status reads "Decision recorded."; no "Retry the same request" button, no Reason field and no alert in the region; the page shows "Your decision:" and the canonical read says `approved`; then idempotency is proved through the API, not a form: the same key, body and If-Match as the first POST are replayed by the reviewer's client, the answer is 200 with state `approved`, and `governedEffects(...).decisions` is exactly 1. The browser POST count is asserted as 1 (no second browser request exists any more).

Checks run (pinned toolchain, worktree): vitest on `cms-governed-review` and `cms-editorial-workflow` 99 files, 1034 tests pass; `pnpm type-check` and `astro check` 0 errors; eslint on the touched directories and the spec clean; `pnpm format:check` clean; fresh `pnpm --filter web build` and `pnpm --silent bundle:check` exit 0 under Node 22.23.1 (initial-route budget 92,160 and lazy budget 81,920 unchanged; entry editor still 79 bytes under).

Rerun for root (product code changed, so the workflow spec runs too):

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
for spec in phase-02-slice-11-workflow-real-route phase-02-slice-12-governed-review-real-route; do
  node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/$spec.spec.ts
done
```

## Addendum 11: T6 times out at "Activate now" (`pw-realroute4-*` full rerun)

Result of that run: build OK, `bundle:check` exit 0, 8 of 9 suites pass (the workflow spec 6 of 6 with the frame change); T6 passed the decision steps (addendum 10 holds) and failed at the owner's activation with a test timeout.

Diagnosis (spec defect, not a product defect). The surviving `error-context.md` shows the taxonomy edit page ("Govern a vocabulary"). T6 declares no `page` fixture and uses pages from contexts created in `beforeAll`, so Playwright's failure snapshot is of a page left over from an earlier test (T5 opens `TAXONOMY_PAGE` on the curator page at spec line 244); it is not the owner's page. That is my reading, not something the log proves, which is why the new evidence records the URL. The real cause is in the component: CMS-03C-09 is not three buttons. `CmsGovernedActivationFields` offers the permitted actions (`offeredActivationActions` over `permittedNextActions`) as native radios ("Activate now", "Schedule activation", "Retire this version"), names the consequence, and a "Continue" button opens the inline confirmation (`CmsGovernedActivationConfirm`, heading "Confirm activation"), whose commit button is "Activate this version" (for retire the commit button is "Retire this version", styled as the danger action). The route is right (`/app/cms-content-modeling/definition-reviews/{id}` hosts region `governed-activation`; FE03 and `CmsGovernedReviewDetailIsland` both put activation on the review detail page, gated by `permittedNextActions`). The spec looked for a button named "Activate now", which never exists, and waited the full test timeout. `CmsGovernedReviewDetailIsland.activation.test.tsx` (lines 170 to 185 and 270 to 310) already drives the real flow: choose radio, Continue, commit button.

Spec fix. The activation and retire steps now follow that flow: radio "Activate now", button "Continue", button "Activate this version", then the status "Activated, not published"; after a reload, radio "Retire this version", "Continue", button "Retire this version", then "Retired:". Each runs under `ownerStep(...)`, which wraps the shared `evidenceStep` helper: on failure it keeps the page URL, the region count, the region's accessible snapshot and text, and the `main` landmark snapshot (so a region that is missing from the page still leaves evidence) in `test-results-governed-evidence/owner-<step>-<time>.txt`. Every wait carries a 30 s timeout, so a step fails with evidence long before the 240 s test timeout. `keepRegionEvidence` also bounds its own reads to 5 s. The decision-section `step(...)` now uses the same `evidenceStep`.

No product code changed in this round. Checks: eslint on the spec clean, `pnpm type-check` 0 errors, `pnpm format:check` clean. Not run here: the real-route spec (root runs it). Unverified until root runs it: that the server offers `activate` for this taxonomy review (the review is approved, the taxonomy declares no canonical domains, and the owner holds the receipt), and that retire's preflight accepts a taxonomy. If either is refused the owner-step evidence will say so.

Rerun for root (spec only, no product change):

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts
```

## Requests to root

1. Fresh production build, then the gate, both under the pinned toolchain:

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH && pnpm --filter web build && pnpm --silent bundle:check > /tmp/bundle-check.json; echo $?
```

2. The eight real-route specs (each after a database reset), then the new governed one:

```
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin && export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
for spec in phase-02-slice-11-bundle-budget-real-route phase-02-slice-11-workflow-real-route phase-02-slice-12-template-real-route phase-02-slice-10-rich-text-real-route phase-02-slice-10-rich-text-toolbar-real-route phase-02-slice-10-draft-detail-real-route phase-02-slice-10-authoring-real-route phase-02-slice-12-locale-real-route phase-02-slice-12-governed-review-real-route; do
  node infra/reset-local-database.mjs && pnpm exec playwright test --config=playwright.s09-real.config.ts tests/e2e/$spec.spec.ts
done
```

3. If the governed spec fails, send me the newest `.lane-logs/canonical/pw-realroute-*.log`: the first failures are most likely labels in T6 or the launcher wiring (item 2 above), not product defects.
4. Decision for you: the editor route has 332 bytes of headroom after moving the result reader into the island. If you prefer the reader lazy again, the route is 37 bytes over; the only other source of a kilobyte I found is the taxonomy field (item 5).
