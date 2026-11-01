# Lane claude_s12_bundle_headroom report

## Status
GREEN. `pnpm build && pnpm bundle:check` exit 0 (registry route 91,665 B unchanged). Entry editor 90,512 B (1,648 B headroom),
taxonomy edit 90,735 B (1,425 B headroom). `CmsLoadingRegion` wired into the three excluded components. Not run by me (rules):
real-route Playwright, db, race modules; `pnpm validate`.

## Scope
Restore initial-route headroom for the CMS entry editor and CMS taxonomy edit routes (budget 92,160 B untouched); then wire the
AC-271 loading region into `CmsGovernedReviewPanel` (subject re-read), `CmsTaxonomyConflictPanel`, `CmsTaxonomyTermChoice`.

## Measurements (initial-route gzip bytes; scratch baseline = `git archive HEAD` built in the lane scratch dir)
| route | HEAD cd89d54c clean | working tree before lane | after lane | headroom after |
|---|---|---|---|---|
| CMS entry editor | 92,081 | 92,387 (FAIL) | 90,512 | 1,648 |
| CMS taxonomy edit | 90,630 | 92,043 | 90,735 | 1,425 |
| CMS entry create | 89,580 | 89,580 | 89,802 | 2,358 |
| CMS locale variant | 88,703 | 88,703 | 88,925 | 3,235 |
| CMS conflict resolve | 90,698 | 90,698 | 90,931 | 1,229 |
| CMS taxonomy create | 75,462 | 75,462 | 75,832 | 16,328 |
| CMS template edit | 80,341 | 80,536 | 80,615 | 11,545 |
| every other route | unchanged except pattern edit (90,073 -> 90,152, from the other lanes' working tree; 2,008 headroom) | | | |
Content schema registry route 91,665 -> 91,665; workbench islands pass.

## What grew (diffing the module lists, HEAD vs working tree)
- Entry editor +306 B: the term form's leave guard made `use-cms-editorial-leave-guard` a shared chunk (+651 B) while the island shrank 350 B.
  Even at HEAD the editor had 79 B headroom.
- Taxonomy edit +1,413 B: `CmsTaxonomyTermForm` +374, `CmsGovernedReviewPanel` +395, the shared guard chunk +651.

## Changes
1. Taxonomy edit: the term action form (`CmsTaxonomyTermAction` and all that only it renders; client state that exists only after
   the person presses Create a term or a table action) is an on-demand chunk. `term-action-view.tsx` (`termActionImporters`,
   `createLazyTermAction`) + generic `cms-editorial-workflow/cms-on-demand-view.tsx` (`createOnDemandView`: one lazy component per
   island, loading state after 250 ms, `retryableLazy` for an unreachable chunk). The form takes focus itself on mount (the hook's
   focus effect ran before the chunk arrived). Listed as `CmsTaxonomyTermAction` in `CMS_ON_DEMAND_CHUNKS` (trigger: open a term
   action; importedBy `term-action-view.tsx`; proof: `cms-on-demand-taxonomy-locale.proof.test.tsx`, first test of the term-form describe).
   Budgets are not touched; the pinned list in `tests/performance/cms-editorial-bundle-budget-mounted.test.ts` gained the stem (see Test corrections).
2. Entry editor: the value validators are out of the cold load. New `cms-field-basics.ts` (isJsonRecord, CMS_EMPTY_RICH_TEXT, datetime
   conversions; the validator modules re-export them so no other importer changes) and `cms-field-validation.ts` (registry:
   `cms-field-value.ts` registers `validateCmsFieldValue` when evaluated; the island reads a refused field's local issues through
   `validateLoadedCmsFieldValue`, falling back to the server message when not loaded). The save chunk (`cms-editorial-entry-editor-save`,
   already listed on demand) imports `cms-field-value`, so a refused save always has the validators. Editors (`CmsFieldEditor`,
   `CmsObjectEditor`, `CmsScalarControl`, `CmsRelationEditor`, `CmsTaxonomyFieldEditor`, `CmsFieldValueView`) import the basics.
3. Loading region (AC-271, 250 ms; tests at 249/250 ms): `CmsGovernedReviewPanel` subject re-read ("Checking the current state…"),
   `CmsTaxonomyConflictPanel` ("Checking the latest version…"), `CmsTaxonomyTermChoice` page read (replaced the immediate
   "Loading terms…" status line; no existing test asserted it).
4. READMEs: cms-editorial-workflow, cms-taxonomy-terms, cms-editorial-fields.

## Rejected experiments (measured in the scratch tree)
- Lazy leave confirmation / sync-conflict alert / link form for the editor: the lazy machinery (`CmsLoadingRegion` 327 + view 291 +
  `retryableLazy` 452 gz as three shared chunks) cost ~1,070 B on the route against ~370 B saved. Reverted entirely.
- Rolldown chunk groups for tiny shared chunks (`client-chunk-boundaries.mjs`): saved ~1,000 B on the editor, but every variant pushed the
  content-schema-registry route over 92,160 B (+500 to +2,400 B) because groups pull in dependencies. Not applied; no config touched.

## Files (path, SHA-256)
- `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.tsx` 3a6347ad0889f66f4923868863206fb8d4a9a135deebb1e6c80c1edaf8358c90
- `apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.validators.test.tsx` cd93b8493cb8dd57170276533a83446f52cb25b00a36dd9e5a94255c3f800413
- `apps/web/src/components/cms-editorial-fields/cms-field-basics.test.ts` 4222c363b81be9a0aca4c9ea4df7e8197848419998cfe1cb941a85034178b8c2
- `apps/web/src/components/cms-editorial-fields/cms-field-basics.ts` 3636e028680c3f42a74cb3e65750586d9fcc8baf2cbabc50dad9ab6031d0a016
- `apps/web/src/components/cms-editorial-fields/CmsFieldEditor.tsx` f14ceca6b5df15de24c3c74d9980394f7816354e741625626054b4c17a8d9745
- `apps/web/src/components/cms-editorial-fields/cms-field-taxonomy-value.ts` f4044acc22d383e63f77ade26fa2530c7db0c5bab5a2b7405b5b203c355165e7
- `apps/web/src/components/cms-editorial-fields/cms-field-validation.test.ts` f4e6faa7be5cee97b4da1798434b4b0b9d7807d427b3894025726f1f7d639cfb
- `apps/web/src/components/cms-editorial-fields/cms-field-validation.ts` 1ea651baf9aa37719003129a79dd78575c7271ddf3efd77ecb9a1f407fdd7144
- `apps/web/src/components/cms-editorial-fields/cms-field-validators-cold-load.test.ts` 3eb1d20370c571e22cf6b9375db3f4a15730f225a769964e096b2dc74d48b5cb
- `apps/web/src/components/cms-editorial-fields/cms-field-value-scalar.ts` 1d678af14b045fe4c03ada7d534df91c8830abe6a8dd7e99a457cf45db9f0ec7
- `apps/web/src/components/cms-editorial-fields/cms-field-value-structured.ts` 8aebccddeb3edea070d501140ab9124d54a5ccb2669def23d7ddb32321a251fd
- `apps/web/src/components/cms-editorial-fields/cms-field-value.ts` 300013d657fc352ac19290de3f89d8c4a4a9ccde082c3e99e6f8390668813e0c
- `apps/web/src/components/cms-editorial-fields/CmsFieldValueView.tsx` 7ffc8e933318e66c14ff887eabbd5de12c56a7e7856abeef8ead1376458f9527
- `apps/web/src/components/cms-editorial-fields/CmsObjectEditor.tsx` f4e4c57015223d1c44056ea7f04657b28d649f15b1e8d6074966909ce7089588
- `apps/web/src/components/cms-editorial-fields/CmsRelationEditor.tsx` c810803363fe995cb2a18e8a623891ee392fbbc7045dcee045c22a2b1ffe5af4
- `apps/web/src/components/cms-editorial-fields/CmsScalarControl.tsx` b8fd1199e2c9af7daf92274cadbe162e65cd92965416e2a9f44c279adba72b5e
- `apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.tsx` 4b536033bafc0b454b4d165b9e8d9d3f3a72180b68687f269d18863a1b9758cf
- `apps/web/src/components/cms-editorial-fields/README.md` e8b15a427d04397da64fb729b1be4d7ab5c4c10596a25b458a9e2ab806692954
- `apps/web/src/components/cms-editorial-fields/static-files.test-support.ts` 5c15392f3fb8ff4e63e24c676f7c1457497eb4ad274edbc1d3d149835f81db7f
- `apps/web/src/components/cms-editorial-workflow/cms-on-demand-view.tsx` 2a18728229593272615f5fb1a3cdb7d0ddc56483b11e82f1f6cc8c1949a86fcc
- `apps/web/src/components/cms-editorial-workflow/README.md` facc7259334f9bb23e94f5c27bfe371564c248ff003e27a8d02f0ec779ea3ab5
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.loading.test.tsx` 64b8062768faa3863d713e563323cc63601eaa2ba5f70b387fcbe7a612a7b144
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.tsx` f99cb98be771e7a95998b752281fe9b64b5b6b89d11eca201c2a3cbbfc369058
- `apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx` 668c7e841650deb2ed663cedc3b20107916e846e41d8c7319a3fd7305073da95
- `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyConflictPanel.loading.test.tsx` 93b26a2eecfe966ce88fe944d0beaddf1d537901cc65d2146b7253fe0ed661e2
- `apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyConflictPanel.tsx` c226109946631a50d35abe3ea4a0595535fc886d05abb41dfcfc5fffdfcbe712
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` be68945a7ad6cac6cb8e2cdc7ab0e1ada67db66783e5d9b400e6dcd2080df189
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermChoice.loading.test.tsx` 1fa386a9f585f7c9502ea095726a258af39e4db750afdda19f9a5c0dfa603c35
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermChoice.tsx` f77a2d31d17d46ff982992b28933be7d56afd016cc951b86e579818289fe3791
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.actions.test.tsx` 0d992c5074b50813f45cadf19c29d4b8b56999228d428f6c3ff2c06cd2ce34ce
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.active.test.tsx` c9f764a34c87a3c75404ddfd92fda22e54a36951d7fed172c0a5b197a1cedc3d
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.choices.test.tsx` ff5307472ce1b1b2b7c1a30d3068581f5a54dce124ab11976494c8873f755f87
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.focus.test.tsx` de9d16ea43344ecc77c667569c92644627396b904030504e73528d7ff0486f62
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.load-failure.test.tsx` 055534657fdafa6605e13a6ab419fcf52fd3c316a1175a541a3974d5a805b070
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.parent.test.tsx` 2101137b1d3704f52c54b2df366af83e3f8e2620a2427e82dd0d47d77360cb65
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.refusals.test.tsx` 5df488af546eb32806f27948c1bb019604ab45cbbb29c1df7b54b50a77f81348
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.test.tsx` 7162993677640a84b710a1af3ec3971606c8036ead5ab349dfce1e6a561ef379
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx` eee368c03447daa76101c434a043fa22a2c190afd11a614ff7aac3a62d218647
- `apps/web/src/components/cms-taxonomy-terms/README.md` 653d67fe7d21e06b07bd41c0cb954ec83c2950e6faa5600ea34ff894c8cf8797
- `apps/web/src/components/cms-taxonomy-terms/term-action-preload.test-support.ts` 31d2e5d067210c0dde67ae6e222e3da241be0ce6a7a0ff6103bbcbb1b0ffb87d
- `apps/web/src/components/cms-taxonomy-terms/term-action-view.test.tsx` 9223812d03d3dab9c1f47905a1a821f1fa17e62e328cdc860587a4a2de5422fb
- `apps/web/src/components/cms-taxonomy-terms/term-action-view.tsx` 214d00bd3fef2f196d5737b12aca6af485ce2897c8116cc655502505be8176d6
- `scripts/verify-bundle-budget.mjs` f14b8ee7a8c6b5aed412dabe6448b717185d9c4acee178bc88b44aba15b63d19
- `tests/performance/cms-editorial-bundle-budget-mounted.test.ts` bf65cbd33974143ac764e5e6e7dd4fec24467648d848fdd681238f1d8371553a

New files: `cms-on-demand-view.tsx`, `term-action-view.tsx`, `term-action-view.test.tsx`, `term-action-preload.test-support.ts`,
`cms-field-basics.ts`(+test), `cms-field-validation.ts`(+test), `cms-field-validators-cold-load.test.ts`, `static-files.test-support.ts`,
`CmsEditorialEntryEditorIsland.validators.test.tsx`, three `*.loading.test.tsx`. Also edited: `CmsTaxonomyTermForm.leave.test.tsx`
(one side-effect import line, same as the other form tests). Other lanes' uncommitted edits in `CmsTaxonomyTermForm.tsx`,
`CmsGovernedReviewPanel.tsx`, `cms-taxonomy-terms/README.md` were built on, not reverted. `scripts/verify-bundle-budget.mjs`: only the
new `CMS_ON_DEMAND_CHUNKS` entry (no budget touched).

## Runs
| what | result |
|---|---|
| pnpm build + bundle:check, before edits | check FAIL, entry editor 92,387 |
| pnpm build + bundle:check, final | build 0, check 0 (table above) |
| vitest apps/web + tests/performance | 736 files; 1 failed (pinned on-demand list, fixed below), rest 8,625 tests passed; tests/performance re-run 13 files / 192 tests green |
| vitest cms-taxonomy-terms, designer, governed-review, cms-editorial, fields, locale | green after each change |
| tsc --build tsconfig.json | exit 0, no output |
| eslint --max-warnings=0 on all changed files | clean |

## Test corrections
- `tests/performance/cms-editorial-bundle-budget-mounted.test.ts`: the pinned list of on-demand stems gained `'CmsTaxonomyTermAction'`
  (one line, between `CmsGovernedSubmitForm` and `cms-editorial-conflict-detail-transport`). Deliberate: the list is the review gate for a
  new `CMS_ON_DEMAND_CHUNKS` entry. No assertion weakened.
- The ten `CmsTaxonomyTermForm*.test.tsx` files gained `import './term-action-preload.test-support';` because the action form now loads
  on the first open (async). The assertions are unchanged.

## Spec citations
FE03 "Performance budgets and loading strategy" (cold load vs on-demand), FE03 46 and 912 and P2-S12-AC-271 (skeleton after 250 ms),
P2-S11-AC-106 (a chunk is on demand only for the person's own event).

## Open items / BOUNDARY
none. Judgement calls: (1) the registry in `cms-field-validation.ts` is module state set by evaluating `cms-field-value.ts`; the stated
invariant (a refused field exists only after a save loaded the validators) is tested, and the fallback is the server message.
(2) The term-form leave guard still ships as a shared chunk (651 B) on both routes; removing it needs the guard to be inlined or
chunk-grouped (rejected above).

## Specs for root (real-route, Chrome; jsdom does not model the module cache, PAT-031)
- `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts` (charges chunks Chrome fetches): add/confirm the taxonomy edit route
  does not fetch `CmsTaxonomyTermAction.*.js` until a term action opens, and the entry editor fetches no `cms-field-value.*.js` until a save.
- `tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts`: invalid rating -> autosave refusal shows the field message and summary (the
  save chunk loads `cms-field-value`); `phase-02-slice-10-rich-text-real-route.spec.ts` and `phase-02-slice-10-draft-detail-real-route.spec.ts`
  for the datetime/rich-text controls now fed by `cms-field-basics`.
- `phase-02-slice-12-governed-review-real-route.spec.ts`: term action open (failed-chunk retry button "Try loading this form again"),
  the subject re-read loading state.
- Failed-import retry: `term-action-view.test.tsx` proves a second `view()` call on the retry (jsdom); the real URL retry is
  `lib/retryable-import.ts`, which a real-route spec must exercise with the chunk blocked once.

## Requests to root
- Run the canonical `pnpm validate` / real-route specs above; decide whether to keep the 651 B shared leave-guard chunk.

## V15 follow-ups (2026-10-28, after review V15 ACCEPT-WITH-CONDITIONS)

Status: GREEN for C1, C2, V15-03, V15-04 (RED first for each). C3 specs are written and parse (`playwright test --list`); root RUNS them.

### Bundle numbers after the follow-ups (`pnpm build && pnpm bundle:check` exit 0, registry 91,665 unchanged)
| route | bytes | headroom |
|---|---|---|
| CMS entry editor | 90,512 | 1,648 |
| CMS taxonomy edit | 90,870 (was 90,735: +135 for `busy`, the arrival-focus guard and the retry alert focus) | 1,290 |
| CMS conflict resolve | 90,931 | 1,229 |
| CMS pattern edit (other lanes' tree) | 90,230 | 1,930 |
| CMS template edit | 80,686 | 11,474 |

### C1 / V15-01 (MAJOR): the panel's submit control stays blocked while the subject is re-read
RED: `CmsGovernedReviewPanel.loading.test.tsx` new test (409 `subject_not_submittable`, `readSubject` held): `aria-disabled` was `"false"`. GREEN:
`CmsGovernedSubmitForm` takes `busy?: boolean`, `blocked = isCommitBlocked(state, disabledReason) || busy`; the panel passes `busy={refreshing}`.
The test also presses the control during the re-read (no second POST, no second read) and checks it is released with the answer.

### C2 / V15-05: dangling spec name and inventory
- `term-action-view.test.tsx` now cites `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts` (T7).
- Files of OTHER lanes that this lane imports, to commit in the same range (SHA-256 at report time):
  - `cms-editorial-workflow/CmsLoadingRegion.tsx` (untracked) c63769e574fdea486b8279fbd904a25e986e023134c06ef544956c41b6814cb7
  - `cms-editorial-workflow/cms-loading-region.css` (untracked) 3a8bdd062a322a72e05fefa947c160b5cd82dfd6c36683195d8af3b97322c32f
  - `cms-editorial-workflow/CmsLoadingRegion.test.tsx` (untracked) f904e1ccfa7fa81b509ae8aa7c5b08739a1d29c781653804012668c16392933f
  - `cms-editorial-workflow/use-cms-workflow-canonical.ts` (modified) 8ed09356919626d0851805e81f6a19b56a4401d3b536cc089a0a43e82097462b
  - `cms-governed-review/CmsGovernedLifecycleIcon.tsx` (untracked) b530f9fbfb64a804698cb1d010bb51a5fe382d038a52e332f92856ca1a73965f
  - `cms-governed-review/governed-state-labels.ts` (modified) fa5038b8bf34c8987b444122b3193876243c205aa33e1aa12df6e569af56146f
  - `cms-taxonomy-terms/CmsTaxonomyTermLeaveConfirm.tsx` (untracked) 231c107529936363911c1fc14fb8a938e6f7405c4201911fa03687602ccfba25
  - `cms-taxonomy-terms/use-term-form.ts` (modified; the leave-guard lane's `dirty`/`isTermFormDirty` plus this lane's `focusIsAtTrigger`) see hash below
  - `cms-taxonomy-terms/CmsTaxonomyTermForm.leave.test.tsx` (untracked) c6c4acca5e4e1de8d3944af5c47b1ca49cb4513df50f985eb8ea4db6241ba223
  - `cms-taxonomy-terms/CmsTaxonomyTermForm.retry.test.tsx` (untracked) f3c9dfe8f0f8f65d060dc4111fe322112e378c63b6589f9412a66e2413f8d96b
  Both `leave` and `retry` carry this lane's one-line `import './term-action-preload.test-support';` (ten form test files in all).
- Scratch note: the lane scratch directory (baseline tree, logs) was wiped between sessions; the numbers in this report were measured before that.

### V15-03: arrival must not steal focus
RED: `CmsTaxonomyTermForm.arrival-focus.test.tsx` (chunk held, focus moved to "Create a term", chunk released): focus moved to the heading. GREEN:
`useTermForm.focusIsAtTrigger()` (focus is on the page, nothing, or the opening control) is passed to the form as `shouldTakeFocus`; the mount effect
asks it once. The untouched case still lands on the heading (second test, and the proof test).

### V15-04: focus after a failed retry
RED: `cms-retryable-lazy.test.tsx` "retryableLazy focus": after a retry that fails again `document.activeElement` was `BODY`. GREEN: `retryableLazy`
marks a retry and the new alert (`tabIndex=-1`) takes focus through a ref callback; a first failure (no retry) steals nothing. Serves the governed forms too.

### C3 / V15-02: Chrome real-route specs (written; root runs; project `real-route-chrome`)
All four files are already registered in `playwright.s09-real.config.ts` (`testMatch`) and `playwright.config.ts` (`testIgnore`); no new spec file was added.
`playwright test --config playwright.s09-real.config.ts --list` parses all of them (164 tests, 30 files).
1. `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts`
   - `[T7] the term action form: not part of the cold load, fetched once when an action opens, loading state, focus, and a failed chunk that can be tried again`
     steps: (a) cold load of an ACTIVE vocabulary at 1280x720 and 1280x1000: no `CmsTaxonomyTermAction`, no contracts/validators, within the initial budget;
     (b) first open: one response for the chunk within `lazyChunkGzipBytes`, heading focused, a created term, a row action fetches no script;
     (c) held chunk: "Loading the term form…" `role=status` after 400 ms, focus moved to the row button stays there on release;
     (c2) untouched: heading focused; (d) aborted chunk: alert, two failed retries each leave focus on the alert, unroute, third retry shows the form with
     heading focus and a `wj_retry` request, axe on the alert and on the open form; (e) keyboard: Tab to Create a term, Enter, `beforeunload` armed only after typing.
   - `[T8] the panel re-read after a refusal shows the loading state and withholds only the submit control until it answers`
2. `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts`
   - `[P2-S11-AC-106] a cold load of the production entry editor fetches no validators and no save flow, and stays within the initial-route threshold`
   - `[P2-S11-AC-106] the first save of an invalid value fetches the validators and the save flow once, within the lazy threshold, and sends nothing`
3. `tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts`
   - `edit: a required field cleared is refused locally with the validators' own message after the idle window, blur alone shows nothing, and sending resumes once it is valid`
New helpers in `tests/e2e/support/s12-governed-world.ts`: `approveGovernedViaApi` (CMS-03C-07), `activateGovernedViaApi` (CMS-03C-09); the active vocabulary is taken
through the routes (define, submit, assign, approve, activate). Written without a stack, like T1 to T6: the first run may need an exact label or a refusal wording adjusted
(T8 relies on a second submission of the same draft answering a 409 with `refetch`; the entry-editor refusal uses the required Title field because the suite world has no rating field).
Not covered by Chrome (jsdom only): Escape on a merge review returns to the edit step (needs two terms), an in-app link click showing the inline leave confirmation (the
vocabulary page has no in-app link inside the terms section on one page of results), the 249/250 ms boundary (fake timers; Chrome checks "after 400 ms" only).

### Files changed by the follow-ups (SHA-256)
- `apps/web/src/components/cms-governed-review/CmsGovernedSubmitForm.tsx` eb55395b24a05490a92b36eab0fd5a9403c03a6f4d09264360601f123f53b33c
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.tsx` bb1095f17f2eb41420d4d016101ae6ef042cd7edeab399b21a673dc476a8d46f
- `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.loading.test.tsx` 6aa437c38d4c5fd0ede332762a175611fdeb267ccd6a8890c850fc1c59577351
- `apps/web/src/components/cms-taxonomy-terms/use-term-form.ts` abe304b0f14d9d165ab4df31cbb5032ca9af092e6c7858fb6667aae2209e50fa
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` 2cece61fd5e11b774e59a528d3915c9455e3bd120977e959f62f0b13f512f1d3
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx` 6f2135e5f3dc3ae9b3f5843cd9199593be0788ce069ed77c5bcbcb7ac837d29b
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.arrival-focus.test.tsx` ec977b65327a9344a8e48fdc7ec9d79af5a6bbadba345a43054444287f63f7fd
- `apps/web/src/components/cms-taxonomy-terms/term-action-view.test.tsx` 0e9f90021c6ef472835b8e48e76b85a8636913f5ca38ae2593ef4bee4a1f3d9f
- `apps/web/src/components/cms-editorial-workflow/cms-retryable-lazy.tsx` 476177be27c2696a4508db72919996784bf2a2a7ddc4b74b9007d5ecbfd1b4a2
- `apps/web/src/components/cms-editorial-workflow/cms-retryable-lazy.test.tsx` 9816dc2cd931182a86a9369518924d9d99eb1a1af285847ccc00adb85d8ce592
- `tests/e2e/support/s12-governed-world.ts` 905a665a49fc79fabe4501f72f5441b2af703756e64d29600917beb721660d23
- `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts` 6b046bc5a219abc017dac9054c2ec6dd0042ecb5c93a2ef31dd703b7bbce5bc0
- `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts` 693b19f5f67d64457a2bb4ccfcebde07ae905ecc61105a10bcafcb10a2973340
- `tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts` 3475ebdf9c8a51cbb3740a16e24a72f17948a757feb699658e453f66e97ec62d

### Runs of the follow-ups
| what | result |
|---|---|
| vitest (RED) `CmsGovernedReviewPanel.loading`, `CmsTaxonomyTermForm.arrival-focus`, `cms-retryable-lazy` focus | each failed for the stated reason before the fix |
| vitest governed-review, taxonomy-terms, taxonomy-designer, editorial-workflow, proof test, tests/performance | 154 files, 1,653 tests green |
| vitest `apps/web` (full) | 724 files, 8,438 tests green |
| `pnpm build && pnpm bundle:check` | exit 0 (numbers above) |
| eslint --max-warnings=0 on the changed web and e2e files; `tsc --build tsconfig.json` | clean |
| `playwright test --config playwright.s09-real.config.ts --list` | parses; T7, T8 and the four new titles listed |

## V15 verification follow-ups (2026-10-28, V15-13 to V15-16)

Status: GREEN. No Chrome evidence is claimed: root runs the specs. `playwright test --config playwright.s09-real.config.ts --list` parses all of them
(164 tests, 30 files; default config 123 tests, 25 files). `pnpm build && pnpm bundle:check` exit 0: entry editor 90,512 (1,648 headroom), taxonomy edit
90,895 (1,265; +25 for the arrival status), conflict resolve 90,931 (1,229), registry 91,665 unchanged.

| finding | fix |
|---|---|
| V15-13(a) | T8 holds ``**/api/v1/cms/taxonomies/${subject.taxonomyId}/versions**`` (GET only), the panel's re-read, not the create route |
| V15-13(b) | T8's press during the re-read is `submit.click({ force: true })` (an `aria-disabled` button is not actionable), then asserts no POST |
| V15-13(c) | T7 `getByLabel('Label 1', { exact: true })` |
| V15-13(d) | T7 ends with `expectOnlyInducedChunkErrors(curator.browserErrors, 'CmsTaxonomyTermAction')` (at least one line; every line must be "Failed to fetch dynamically imported module" naming the chunk; nothing else), then clears the shared array; T8 clears it at its start and keeps its own empty assertion |
| V15-13(e) | authoring test: the title's `#field-<id>-errors` has text exactly "This field is required."; the status line "Fix the highlighted fields before saving." is asserted PRESENT (the page-wide negative is gone) |
| V15-13(f) | T7(e) `tabTo(page, /Create a term/u, 150)` |
| V15-14 | `cms-retryable-lazy.test.tsx`: a first failure leaves focus alone (Suspense test and hydration test), and a new test "after a successful retry … a later render error of the loaded view" keeps focus; `retryableLazy` clears `retried` when the retried load succeeds. Mutants: dropping `!this.retried` fails 3 tests; dropping the clear fails the new test |
| V15-15 | `CmsTaxonomyTermForm.arrival-focus.test.tsx` rebuilt order-free: each test resets the module graph and imports React, the form and the support from it, with the chunk held in both tests. Mutant M3b (`focusIsAtTrigger` always false) now fails the file's second test |
| V15-16 | a form that arrives while the person is elsewhere renders a polite status "The term form is ready." (asserted in the arrival-focus test, absent when focus moved to the form; T7 step c asserts it in Chrome) |

### Final spec titles for root (all in files registered in both Playwright configs)
- `phase-02-slice-12-governed-review-real-route.spec.ts`: `[T7] the term action form: not part of the cold load, fetched once when an action opens, loading state, focus, and a failed chunk that can be tried again`; `[T8] the panel re-read after a refusal shows the loading state and withholds only the submit control until it answers`
- `phase-02-slice-11-bundle-budget-real-route.spec.ts`: `[P2-S11-AC-106] a cold load of the production entry editor fetches no validators and no save flow, and stays within the initial-route threshold`; `[P2-S11-AC-106] the first save of an invalid value fetches the validators and the save flow once, within the lazy threshold, and sends nothing`
- `phase-02-slice-10-authoring-real-route.spec.ts`: `edit: a required field cleared is refused locally with the validators’ own message after the idle window, blur alone shows nothing, and sending resumes once it is valid`

### Runs
| what | result |
|---|---|
| vitest governed-review, taxonomy-terms, designer, editorial-workflow, editorial, editorial-fields, proof test, tests/performance | 259 files, 2,740 tests green |
| eslint --max-warnings=0 on changed specs and web dirs; `tsc --build tsconfig.json` | clean |

### Files changed in this round (SHA-256)
- `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts` e794e692a1b7b9dc02a548b1661030083a91cfa927a078c8a58feb2080ae5b89
- `tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts` d64d61e967e438f21b7e3622eb10ed576d3b4c0fc70a30fd2ef9371bcf6c8847
- `apps/web/src/components/cms-editorial-workflow/cms-retryable-lazy.tsx` a657cbde539605ca4a94b58c8baa0c73a63fa2ab0daee6895c1e52f0cb4360bc
- `apps/web/src/components/cms-editorial-workflow/cms-retryable-lazy.test.tsx` 80d065d3bd02b427a0b7435e116d219834e0ef2ad61a8768d717009afa6d3c09
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermForm.arrival-focus.test.tsx` 8491cb353e77c62bd7ee47f96a72b961e0f4b858caa89010b9d20ca7740b6779
- `apps/web/src/components/cms-taxonomy-terms/CmsTaxonomyTermAction.tsx` d564efcd86046b31f24c2688e794e2f07fc1a4dc1419e693004200d426a6cf02
