# Review V15 report (claude_s12_review_v15)

Independent adversarial review of the `bundle-headroom` lane: the entry editor's deferred field validators, the on-demand
`CmsTaxonomyTermAction`, the `CmsLoadingRegion` wiring into three components, and the test corrections. The reviewer did not author any
of it. Read-only except this file. Brief: `docs/handoffs/2026-10-22-claude-s12/briefs/review-v15-bundle-headroom.md`. Rules:
`docs/handoffs/2026-10-14-claude-s12/lane-rules.md` (its HEAD text says b16edb54; the worktree is at cd89d54c, noted only).

## Status

COMPLETE. Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`cd89d54cc84403e32699666c8d3710f45bbffce0`. Review window 2026-10-28 00:37 to about 01:10 EDT.
Lane report `lane-bundle-headroom-report.md` SHA-256 `9b264aae4c138317f4d7d5fc30c012e4fcd961af633c2ddf49f40d6bdb3824b2` (matches the brief).
All 44 files in its "Files" table matched their listed SHA-256 at the start and again at the end (no drift while I worked).
Scratch (logs, experiments): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review-v15/`.

## Verdict: ACCEPT-WITH-CONDITIONS

The code does what the lane says. Every bundle number reproduces, no budget moved, the new on-demand entry meets the gate's own rules, the
validators really leave the entry editor's cold load, nothing the client stopped at HEAD now reaches the server, and every focused Vitest
file I ran passes (109 files / 1,297 tests, and a larger overlapping set of 412 files / 4,373 tests). Two things are not acceptable as they
stand: the panel's loading state is only half of AC-271 (V15-01), and none of the lane's browser-only claims has a Chrome test (V15-02).

Conditions:

- C1 (before commit) fix V15-01: the panel's submit control must stay blocked while the subject re-read runs (about 6 lines plus one test).
- C2 (before commit) V15-05: the lane cannot be committed alone. It imports uncommitted files of three other lanes; commit them in the same
  range (list below). Also fix the dangling spec name in `term-action-view.test.tsx:34` (V15-02, part d).
- C3 (before any evidence claim for P2-S11-AC-106 / P2-S12-AC-271 on these routes, and before `pnpm validate`) V15-02: add and run the Chrome
  tests listed under "Real-route specs root must run". They need the DB stack, which I may not use.
- Recommended, not blocking: V15-03 (focus steal on arrival), V15-04 (focus lost after a failed retry), and the NITs.

### Counts

11 findings: 0 BLOCKER, 2 MAJOR, 3 MINOR, 6 NIT. Plus five observations outside the brief (O-1 to O-5), none a finding against this lane.
Test corrections: 2 listed by the lane (plus 2 unlisted files carrying the same one-line edit), all ACCEPT.

Severity scale used here: BLOCKER = must not be committed as is (wrong behavior, data loss, security, broken build);
MAJOR = a spec-required behavior or the evidence for an acceptance claim is missing, so the claim would be false as written;
MINOR = a deviation with a small blast radius; NIT = polish or test shape.

## Method and runs

I read the brief, the lane rules, the lane report, every changed file (diffs against HEAD for tracked files, whole files for new ones), the
FE03 spec sites (lines cited below), AC-106, AC-271, the Slice 10 ACs for the editor, the bundle gate (`scripts/verify-bundle-budget.mjs`)
and its tests, the existing real-route specs, and the production code the lane's code leans on (editor controller, save flow, outcomes,
workflow command controller, `retryable-import`, `cms-retryable-lazy`). I built the production output and read the emitted chunks.
Because jsdom hides exactly the things at stake, I also ran five throw-away experiments (A, B, C, D, D2) out of tree (scratch dir, no file written in the
worktree) against the real components in a clean module graph.

| # | When (EDT) | What | Result | Evidence |
|---|---|---|---|---|
| R1 | 00:39 | `pnpm build && pnpm bundle:check` (pinned toolchain, Node 22.23.1) | build 0, check 0, `passed: true`; every number in the lane's "after lane" column reproduces exactly | `build.log` `e4d959fb7c0ca7b7a1be9455fdbd2583e44e094f11920fdd021a015f7ee99411`; `bundle-check.log` `9221c98d42b94b2b4dc70f671ba57e0ff34f320e7c3e4a365783011dba64ee48`; `bundle-check.json` `ef11c99161596bdd646f776430d6a7f4c9fd0b6d5422c49cd6717aeb7218c0c0` |
| R2 | 00:43 | Vitest, 109 files: `cms-editorial-fields`, island tests, `cms-on-demand-editor.proof`, `cms-taxonomy-terms`, conflict panel, `cms-governed-review`, `cms-on-demand-taxonomy-locale.proof`, `CmsLoadingRegion`, `cms-retryable-lazy`, `retryable-import`, `tests/performance` | 109 files, 1,297 tests, all pass | `vitest1.log` `0779839214687b6c5312a586df601e7307322296abddf094120afc5dc0282dc3` |
| R3 | 00:48 | Vitest, 412 files: all `apps/web/src/components/cms-*`, `pages/app/cms-content-modeling`, `cms-island-static-closure`, `cms-lazy-forms-closure*`, `client-chunk*`, `browser-validator-import-boundaries` | 412 files, 4,373 tests, all pass | `vitest2.log` `bf9b95eff7b3f4ed0d21482c4d6b6bf524d4ecdf0ca8741dd981a270fd286318` |
| R4 | 00:58 | `prettier --check` and `eslint --max-warnings=0` on the lane's 45 files (44 listed plus the `leave` test) | both clean | `eslint.log` `a8c7ec7b5a497c0719e091a4af46ecadb093ce17e69cfd88947169fc6ca50c19` |
| R5 | 00:56-01:00 | Experiments A, B, C, D, D2 (scratch, Vitest with the repo config, nothing preloaded) | results quoted in the findings | `exp/exp-run.log` `4c7edb65019f978fa208eabf8fef4570d14449d6e2481533b574bb196546f407`; experiment sources in `exp/*.exp.test.tsx` |
| R6 | 00:5x | Static checks: import cycles in the closures of the lane's files (116 modules), TODO/any/ts-ignore/eslint-disable scan | no cycles; none found | script output only |

Not run (rules): database, race modules, Playwright, `pnpm validate`. Note: my `pnpm build` rewrote `apps/web/dist` (gitignored) at 00:39;
another process rewrote it again at 00:52 as a staging/development build, and `bundle:check` now fails closed on it by design. Rebuild
before the next `bundle:check`. My numbers are from my 00:39 build.

## Answers to the five checks

### 1. Client validation timing (security-first.md; FE03 and the Slice 10 editor rules)

Spec lines that bind: `.claude/rules/security-first.md` ("Every form validates client-side with Zod AND server-side with the same schema");
FE03:1263 (Form contract, "Validation timing: Syntax and safe local constraints on blur; cross-field on review/submit; server remains
authoritative"); FE03:1772 (Form controls, "Blur validation where safe, authoritative submit validation"); FE03:577 (`CmsEditorialEntryDraft`:
"Per-field labels and linked error summary; autosave is advisory (3 s idle, 30 s hard maximum) and never steals focus; unsent values are
retained and focus restored on refusal"); P2-S10-AC-105 ("revalidate on submit and preserve server authority") and P2-S10-AC-052 ("retain
unsent input, focus summary/field"). HEAD behavior is pinned by `CmsEditorialEntryEditorIsland.test.tsx:118-136` (local refusal after the
3 s autosave tick or on Save draft, nothing sent).

What the person sees, measured (experiments D2, clean module graph, nothing preloaded, scripted fetcher with zero responses so any request
would throw; same result for the autosave tick and for an explicit Save draft):

| moment | validators registered | `aria-invalid` | field message | summary | status line | requests sent |
|---|---|---|---|---|---|---|
| mounted | no | none | none | none | empty | 0 |
| typed `11` into Rating | no | none | none | none | "Unsaved changes. Autosave runs shortly." | 0 |
| after blur of Rating | no | none | none | none | unchanged | 0 |
| first save attempt (autosave at 3 s, or Save draft) | yes | `true` | "Enter 10 or less." | present, field linked | "Fix the highlighted fields before saving. Your edits are kept." | 0 |

Conclusion: identical to HEAD. At HEAD the validators also ran only at save time and the island showed them only for `refusedFieldIds`
(read from the HEAD diff of the island, and pinned by the HEAD tests, which still pass; I did not re-run the experiments on HEAD). The
mechanics, all verified:

- Local validation runs inside the save flow before any request is built, for autosave and explicit save alike
  (`cms-editorial-entry-editor-save.ts:228-246`), and returns `invalid` with nothing sent. The save flow is the only writer of
  `refusedFieldIds` (`cms-editorial-entry-editor-save.ts:73,241`; `refusalPatch` at `cms-editorial-entry-editor-outcomes.ts:86` is called
  only from `cms-editorial-entry-editor-save.ts:166`), so the island can ask for local issues only after the save module ran.
- That module statically imports `cms-field-value` (`cms-editorial-entry-editor-save.ts:5`), whose last statement registers the validators (`cms-field-value.ts:103`).
  ES module order guarantees the registration ran before `createCmsEditorialSaveFlow`. In the build, the save chunk's preload list holds
  `cms-field-value.B_h7s1gL.js` (fetched in parallel with the save chunk, so no extra round trip), `cms-field-value` ends with `s(I)`
  (the registration call), and the registry lives in the shared `cms-field-basics.Dgs31sNe.js` chunk that the island also imports, so there
  is exactly one registry instance (read from the emitted files, not inferred).
- If the save chunk or `cms-field-value` cannot be fetched, the dynamic import rejects as one unit and `guarded` reports "nothing was sent"
  (`cms-editorial-entry-editor-controller.ts:83-93`); no unvalidated value is sent.
- The Zod side (request schemas) is unchanged: it loads with the runtime chunk on the first save.

Nothing FE specifies for the editor is missing before the first save compared with HEAD, and no invalid value is sent that the client stopped
before. The server message fallback in the island (`CmsEditorialEntryEditorIsland.tsx:79-91`) is unreachable in production.

Observation O-1 (pre-existing, not this lane): the entry editor has no blur validation at all. `CmsEditorialEntryFields.tsx:36-48` passes
no `onBlur`, so FE03:1263 / :1772 ("safe local checks on blur") are not met by the editor at HEAD either. The Slice 10 ACs only require
revalidation on submit, so this may be an accepted reading, but it is worth a root decision: with the validators now outside the cold load,
adding blur validation later needs the validators loaded on first focus (an intent preload, like `cms-lazy-intent.ts`) instead of at first save.

### 2. The on-demand term action (`CmsTaxonomyTermAction`)

Genuinely on demand: yes.

- `term.form` starts `null` (`use-term-form.ts`, `useState<TermFormState | null>(null)`) and is set only by `open()`, which has exactly
  two callers, both button `onClick`s (`CmsTaxonomyTermForm.tsx:163` Create a term; `CmsTaxonomyTermTable.tsx:51` via `CmsTaxonomyTermForm.tsx:201`, the row actions). The lazy
  view is rendered only while `term.form !== null` (`CmsTaxonomyTermForm.tsx:168-169`), so a hydration, a scroll or time cannot import it.
- The only dynamic import is `term-action-view.tsx:19-21`; in the build it sits inside `P={view:i(()=>r(()=>import("./CmsTaxonomyTermAction.wniFN6UL.js"),…))}`
  of the island chunk, called by `React.lazy` on first render of the view.
- `bundle:check`: the chunk is in `lazyAssets` and not in `initialAssets` of "CMS taxonomy edit"; every dependency in its preload list is
  already in the initial set, so opening fetches exactly one new file (12 KB raw).
- Gate rules (`verify-bundle-budget.mjs:818-838`): `trigger` is a person's own press; `importedBy` lists the one site and
  `cms-editorial-bundle-budget-mounted.test.ts` "is imported dynamically from exactly the declared sites" passes; `proof` names a test whose
  title starts with the stem (`cms-on-demand-taxonomy-locale.proof.test.tsx:168`), which mounts the real form, idles 120 s of fake time
  with a scroll event, asserts `asked` empty and no `.cms-term-action`, then presses a row action and waits for the request and the form.
  No test-support file that preloads is imported by the proof (checked: only the ten form tests import the preload).

Focus on open: no FE03 sentence pins the term form's focus. The established behavior (hook effect, `CmsTaxonomyTermForm.focus.test.tsx`) is
heading focus on open and trigger focus on close, which matches the nearest written rule, the dialog/drawer row of FE03:1774 ("Initial heading focus … return focus"), and
the accessibility rule FE03:1452 ("Refresh never steals focus", WCAG 2.4.3). The hook's focus effect
(`use-term-form.ts:150-157`) runs before the chunk exists, so the lane added a mount effect (`CmsTaxonomyTermAction.tsx:86-89`). It works
(proof test asserts the heading has focus) but it fires on arrival, whatever the person did meanwhile: V15-03. Return of focus on close is
unchanged (`close` focuses the stored trigger).

Failed load and retry (PAT-031): composition checked in source and in the build. `retryable()` (`lib/retryable-import.ts`) records the URL
from the browser's error and imports it again under `?wj_retry=N`; `retryableLazy` (`cms-retryable-lazy.tsx`) creates a fresh `React.lazy`
on the person's retry, which calls `termActionImporters.view()` again, i.e. the same `retryable`. jsdom cannot model the module map, so
Chrome is the only real test (see the specs list). Experiment C (stubbed importer that fails twice, then succeeds):

| step | focus |
|---|---|
| after the first failure (alert + "Try loading this form again" shown) | stays on the Create a term button |
| press the retry, it fails again (alert shown again) | **BODY** (the pressed button was unmounted) |
| press the retry, it succeeds | the form heading `#cms-term-form-heading` |

Details in V15-04. A failure of a transitive static dependency cannot be retried in the page (O-3).

Leave guard: the guard's `active` is `term.dirty`, computed by the always-loaded hook from the form state (`use-term-form.ts:110-126,312`),
not by the lazy chunk. While the chunk loads, or after it failed, the form equals its initial state, so nothing is "unsent" and leaving is
free; once loaded and edited, the other lane's guard applies. No interplay defect found. Keyboard path: native button, Enter/Space opens,
focus moves to the heading on arrival, Tab enters the first field; the failure alert and its button follow the trigger in DOM order and are
reachable by Tab; Escape/Cancel behavior is unchanged.

### 3. Loading region (FE03:46, :912-913, :1046; P2-S12-AC-271)

- Timing: `useLoadingDelay` arms a 250 ms timer while `active`; the lane's three tests assert nothing at 249 ms and the region at 250 ms,
  nothing for a read answered earlier, and removal on answer. The region is `<p role="status">` (implicitly polite) over a fixed-height bar.
  Labels: "Checking the current state…" (panel), "Checking the latest version…" (conflict panel), "Loading terms…" (term choice), and
  "Loading the term form…" (on-demand view).
- Existing states, component by component, are intact: panel degraded/unverified path and result-heading focus are unchanged, and the
  `finally` clears `refreshing` even if `readSubject` rejects (`CmsGovernedReviewPanel.tsx:75-88`); the conflict panel keeps its disabled
  check button and its failed alert; the term choice drops the immediate "Loading terms…" line for the delayed region (the AC asks for
  exactly that) and keeps `aria-disabled` on the paging button and the restarted/failed lines.
- Gap: AC-271 / FE03:1046 say a loading read shows a skeleton after 250 ms **and the submit controls stay disabled**. The conflict panel
  disables its check button while checking. The term choice keeps its paging button `aria-disabled` and, by its documented design, leaves
  the form's submit enabled (a chosen parent id does not depend on further pages); I did not count that. The governed panel did not
  withhold its submit control (V15-01, reproduced).

### 4. Numbers, budgets, the `CMS_ON_DEMAND_CHUNKS` entry

My R1 equals the lane's table row for row. Initial-route gzip bytes (budget 92,160) and headroom:

| route | lane "after" | mine | headroom |
|---|---|---|---|
| CMS entry editor | 90,512 | 90,512 | 1,648 |
| CMS taxonomy edit | 90,735 | 90,735 | 1,425 |
| CMS entry create | 89,802 | 89,802 | 2,358 |
| CMS locale variant | 88,925 | 88,925 | 3,235 |
| CMS conflict resolve | 90,931 | 90,931 | 1,229 |
| CMS taxonomy create | 75,832 | 75,832 | 16,328 |
| CMS template edit | 80,615 | 80,615 | 11,545 |
| CMS pattern edit | 90,152 | 90,152 | 2,008 |
| content schema registry | 91,665 | 91,665 | 495 |

The "HEAD clean" column also matches the canonical snapshot `.lane-logs/canonical/bundle-check.json` (sourceRevision b16edb54: entry editor
92,081, taxonomy edit 90,630, entry create 89,580, locale variant 88,703, conflict resolve 90,698). Per-island budgets (35,840) pass (entry
editor island 31,260; term form island 18,946). `git diff HEAD -- scripts/verify-bundle-budget.mjs tests/performance` shows one added
`CMS_ON_DEMAND_CHUNKS` entry (+12 lines) and one added stem in the pinned list (+1 line); `BUNDLE_BUDGETS` (35*1024, 90*1024, 80*1024)
is untouched. The entry is justified by the gate's own three rules (trigger, importedBy, proof), by the built graph, and by the saving it
buys (taxonomy edit 92,043 to 90,735 on the lane's measurement, 1,425 B headroom). Headroom is thin on several routes (registry 495,
conflict resolve 1,229, taxonomy edit 1,425): the next lane that touches them needs a plan; the fixes proposed below add only a few bytes each.

### 5. The test corrections

`tests/performance/cms-editorial-bundle-budget-mounted.test.ts:243` gains `'CmsTaxonomyTermAction'` in the pinned list: additive, and the
list exists to force review of exactly this. ACCEPT. The ten `CmsTaxonomyTermForm*.test.tsx` files carry `import './term-action-preload.test-support';`
(line 2; eight tracked files show `+1` line each; `leave` and `retry` are untracked files of another lane that carry the same line; see
V15-05 for the inventory). No assertion changed. ACCEPT. The preload makes `termActionImporters.view()` resolve in a `beforeAll`, so in
those files the form is "already loaded" and their assertions are about the opened form.

Does the real async path remain tested? In jsdom, yes, in three places that never import the preload: `term-action-view.test.tsx`
(slow load 249/250 ms, fast load, failed load then retry, over an injected loader), the proof test (real importer called by the open and
not before; the form mounts; heading focused), and `cms-retryable-lazy.test.tsx`/`retryable-import.test.ts` for the two halves. What
jsdom cannot test, and nothing tests today: the failed-module-map behavior of `retryable` through `retryableLazy` for this chunk, the
chunk not being fetched by Chrome at cold load, the fetch on press, the focus move on a real arrival, and the loading region on a slow
real fetch. The Chrome specs that must cover it are listed below; the home for the term action is
`phase-02-slice-12-governed-review-real-route.spec.ts` (it already holds the taxonomy page cast and the abort-a-chunk pattern in T5).

## Findings

### V15-01 MAJOR: the panel's loading state leaves the submit control enabled while the subject is re-read (half of AC-271)

Where: `apps/web/src/components/cms-governed-review/CmsGovernedReviewPanel.tsx:65,75-88,107,120-123,143-151`;
`CmsGovernedSubmitForm.tsx:61,96`; `cms-editorial-workflow/cms-workflow-form-state.ts:10-16,37-40`;
`cms-editorial-workflow/cms-workflow-command-controller.ts:239-246`; `cms-governed-review/governed-review-refusal.ts:39-45`.

Spec: FE03:1046 (Slice 12 definition governance states, `loading` row; the `latestReadState` column names `cmsTaxonomyVersionsRead`,
`cmsTemplateLatestRead`, `cmsPatternLatestRead`): "Skeleton after 250 ms; the submit controls stay disabled". P2-S12-AC-271: "`loading` (a
skeleton after 250 ms and only the commit control disabled)".

Evidence: after a 409 `subject_not_submittable` (a refusal with `refetch: true`), the command controller sets phase `refused` and then
awaits the panel's `refetch` (controller `:239-246`). `refused` is not a blocking phase (`cms-workflow-form-state.ts:10-16`) and the panel
builds `reason = disabledReason ?? (degraded ? UNVERIFIED : null)` (`panel:107`), which ignores `refreshing`, so `blocked` is false and the
button renders `aria-disabled="false"` (`CmsGovernedSubmitForm.tsx:96`). Experiment A (real panel and command controller, held
`readSubject`, two queued 409 answers):

    EXP-A {"before":{"readCalls":1,"fetchCalls":1},
           "state":{"region":"Checking the current state…","ariaDisabled":"false","alert":"This version can no longer be submitted. …"},
           "after":{"readCalls":2,"fetchCalls":2}}

The region is on screen, the control is enabled, and pressing it sends a second POST and starts a second re-read. The lane's
`CmsGovernedReviewPanel.loading.test.tsx` only drives the commit-then-reread path and never asserts the control. The conflict panel meets
the rule (check button disabled while checking); the term choice keeps its paging button `aria-disabled` and, by documented design, its
form's submit enabled (a chosen parent does not depend on further pages), which I did not count.
Impact: the server stays authoritative and refuses a stale submit, so no data is at risk, but the panel displays the loading state the AC
defines and then allows the one action the AC says it must withhold, with a subject it already knows is stale.

Fix: add `busy?: boolean` to `CmsGovernedSubmitForm` props (the lazy view's props are `ComponentProps<typeof CmsGovernedSubmitForm>`, so
`governed-panel-form-views.ts` needs no change), pass `busy={refreshing}` from the panel (`:143-151`), and compute
`const blocked = isCommitBlocked(state, disabledReason) || busy === true;` (`CmsGovernedSubmitForm.tsx:61`). Keep `aria-disabled` (the repo
rule: never natively disable a focused button). No new sentence: the region already says why. Test: experiment A as a test in
`CmsGovernedReviewPanel.loading.test.tsx` (after the 409, re-read held: `aria-disabled="true"`, a press sends nothing; after the answer the
control follows the new subject). Cost: a few bytes in a chunk of three routes (taxonomy edit has 1,425 B headroom); rebuild and re-check.

### V15-02 MAJOR: none of the lane's browser-only claims has a Chrome test; the specs it names do not hold them; one comment cites a spec that does not exist

Where: lane report "Specs for root"; `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts:44` (`ENTRY_PAGE` is the workflow route);
`tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts`; `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts:326-383` (T4, T5);
`apps/web/src/components/cms-taxonomy-terms/term-action-view.test.tsx:33-34`.

Evidence:
(a) The entry editor route, which lost its validators and has 1,648 B headroom, is measured in Chrome nowhere. Only three e2e files read
`BUNDLE_BUDGETS`/`gzipSync` (registry layout, the slice-11 spec on the workflow route, T4), none of them loads `/entries/:id`.
(b) No real-route spec covers the edit form's local refusal: the string "Check these fields before saving again" does not occur in
`tests/e2e`; the lane asks root to "run" an invalid-rating test that has to be written.
(c) The taxonomy edit cold load is covered by T4 ("curator panel", two viewports) but only on a draft vocabulary and only by byte total:
it would notice a 4 KB chunk fetched at load (headroom 1,425 B) but never names `CmsTaxonomyTermAction`. No spec opens "Create a term"
(term actions exist only against an `active` version, FE03:1071), checks focus on arrival, the loading state on a slow fetch, or the
abort-once retry of this chunk (T5 does the abort for the governed transport chunk only).
(d) `term-action-view.test.tsx:33-34` says the retry "proves it in Chrome" through `phase-02-slice-12-bundle-budget-real-route.spec.ts (named for
root)`. That file does not exist (`tests/e2e` has only the slice-11 spec of that kind) and the lane report names a different file.

Why MAJOR: `verify-bundle-budget.mjs:818-838` exists so that "the gate and the browser stay in step"; a chunk exempted from the cold-load
charge (and validators removed from the tightest editor route) with no browser-side counterpart is how a later change passes `bundle:check`
and every Vitest file yet fetches the chunk at load. PAT-031 and the "E2E mock masked production defect" lesson are about this exact gap.

Fix: write and run the tests under "Real-route specs root must run"; change the comment at `term-action-view.test.tsx:33-34` to the file
that will hold them; register any new spec file in `playwright.s09-real.config.ts` (`testMatch`) and `playwright.config.ts` (`testIgnore`),
as every other real-route spec is.

### V15-03 MINOR: the new mount effect moves focus on arrival even if the person has moved on

Where: `CmsTaxonomyTermAction.tsx:86-89` (with `use-term-form.ts:150-157`).

Evidence: experiment B (real form, importer held). Press "Rename term guitar" (focus on it); while the chunk is loading move focus to
"Create a term"; release the chunk:

    EXP-B {"afterPress":"BUTTON [Rename term guitar]","movedTo":"BUTTON [Create a term]",
           "afterArrival":"H3#cms-term-form-heading [Rename: guitar]","formShown":true}

At HEAD the form rendered in the same commit as the press, so the hook's effect ran before the person could move; with a chunk the same
effect fires arbitrarily late. Prior art in the same directory does it correctly: `CmsTaxonomyTermChoice.tsx:30-32,43-48` moves focus "only if
focus fell to the page … a person who moved on to another field keeps it there (WCAG 2.4.3)", and guards it with
`document.activeElement === document.body`. FE03:1452: "Refresh never steals focus".
(The experiment's "control" run is not a valid control: the module-level lazy view was already resolved by the first test, so the form
rendered at once; the first run is the one that matters.)

Fix: take focus on mount only while focus is where the press left it: `document.activeElement` is `document.body`, `null` or the trigger
(expose the trigger from `useTermForm`, or pass a `shouldTakeFocus()` callback to the form). Test: experiment B as a test (focus stays on
"Create a term"), plus the existing proof assertion that the untouched case still lands on the heading.

### V15-04 MINOR (inherited, newly reachable): a failed retry drops focus to the page body

Where: `apps/web/src/components/cms-editorial-workflow/cms-retryable-lazy.tsx:30-33,36-44` (unchanged by the lane; first used on a
person-initiated path that carries focus).

Evidence: experiment C. Pressing "Try loading this form again" clears `failed`, which unmounts that button; the fallback is empty for the
first 250 ms; if the second load fails the alert returns but `document.activeElement` is `BODY`:

    EXP-C {"afterFailure":{"focus":"BUTTON [Create a term]","alert":"This form could not be loaded. … Try loading this form again"},
           "afterFailedRetry":{"focus":"BODY","alertAgain":true},
           "afterGoodRetry":{"focus":"H3#cms-term-form-heading [Create a term]","calls":["fail","fail","ok"]}}

The governed forms (same boundary) behave the same at HEAD. `CmsTaxonomyTermChoice.tsx:27-29` states the repo rule for this: the button
"stays mounted … so keyboard focus never falls to the page (FE03 :898, WCAG 2.4.3)".

Fix, once in `retryableLazy` (it serves the governed forms too): keep the alert and the button mounted while the retry loads (button
`aria-disabled`, label "Trying again…"), or focus the alert after a retry that failed. Test: the experiment C sequence.

### V15-05 MINOR: the lane cannot be committed alone, and its file inventory is incomplete

(a) The lane's files import uncommitted files of other lanes (found by resolving every relative import of the 45 files against `git status`):
`cms-editorial-workflow/CmsLoadingRegion.tsx` and `cms-loading-region.css` (untracked; `CmsLoadingRegion.test.tsx` and the
`use-cms-workflow-canonical.ts` change belong with them) for `cms-on-demand-view.tsx`, `CmsGovernedReviewPanel.tsx`,
`CmsTaxonomyConflictPanel.tsx`, `CmsTaxonomyTermChoice.tsx`; `cms-governed-review/CmsGovernedLifecycleIcon.tsx` (untracked) and
`governed-state-labels.ts` (modified) for `CmsGovernedReviewPanel.tsx`; `cms-taxonomy-terms/CmsTaxonomyTermLeaveConfirm.tsx` (untracked)
and `use-term-form.ts` (modified: `dirty`, `isTermFormDirty`) for `CmsTaxonomyTermForm.tsx`, the proof test and the form tests. A commit of
the lane's 44 files alone does not build.
(b) Two files carry the lane's `import './term-action-preload.test-support';` but are absent from the report's "Files" table:
`CmsTaxonomyTermForm.leave.test.tsx` (SHA-256 `c6c4acca5e4e1de8d3944af5c47b1ca49cb4513df50f985eb8ea4db6241ba223`; in the prose only) and
`CmsTaxonomyTermForm.retry.test.tsx` (`f3c9dfe8f0f8f65d060dc4111fe322112e378c63b6589f9412a66e2413f8d96b`; not mentioned). The report says
"ten" files plus `leave`; the true count with the import is ten in total (eight tracked, these two untracked).
Fix: commit in one range with the three other lanes; add the two hashes to the lane record.

### NITs

- V15-06: `CmsEditorialEntryEditorIsland.tsx` is 202 lines (HEAD 198; `extensibility.md` caps components at 200); the lane added 4. Move
  `issuesFor` (`:72-91`) into a small helper next to `CmsEditorialEntryFields`. Not enforced by eslint and many components already exceed 200
  (`ContentSchemaRegistryList.tsx` 289); `CmsTaxonomyTermForm.tsx` is now 212, mostly the other lane's leave guard.
- V15-07: first-open waterfall. `useTermActionChoices` reads the parent/survivor page only after the chunk arrives, so the first open pays
  the chunk fetch and then the read in sequence. A chunk preload on pointer-over/focus of the Create button (the `cms-lazy-intent.ts`
  mechanism) removes it without touching the cold load.
- V15-08: the loading region is inserted at 250 ms and removed on the answer, so content below it moves twice; `cms-loading-region.css:2-3`
  claims the stable bar height prevents a shift "when the read answers", which the unmount contradicts (FE03:46 says layout-stable). The
  lane puts it above the "Load more terms" button, the review summary and the form. File is another lane's; the wiring is this lane's.
  Render the container always and toggle its content, or drop the claim.
- V15-09: near-duplicate copy: the disabled check button says "Checking latest version…" (`CmsTaxonomyConflictPanel.tsx:43-45`) and the new
  region says "Checking the latest version…" (`:47-50`). One string, one announcement.
- V15-10: test shape. (a) `CmsEditorialEntryEditorIsland.validators.test.tsx:25` imports `cms-field-value` statically and every other island
  test preloads the save chunk in `beforeAll` (`cms-editorial-lazy-transports.test-support.ts`), so no committed test exercises the
  production order (registry empty at mount, filled by the first save). Experiment D does (`exp/island-order.exp.test.tsx`): adopt it.
  (b) The second test of that file unregisters the validators after a save loaded them, a state no real sequence produces; say so.
  (c) `cms-field-validation.test.ts:38` is titled "… and by nothing else" but asserts only the first half. (d) The header comments of
  `CmsTaxonomyConflictPanel.loading.test.tsx:24` ("The check button keeps its own label") and `CmsTaxonomyTermChoice.loading.test.tsx:24`
  ("The paging button keeps its label and does nothing while a page loads") claim assertions the files do not make.
- V15-11: the proof test depends on file order (`cms-on-demand-taxonomy-locale.proof.test.tsx:167`, "the first term form of the file"): the
  module-level lazy view stays resolved after the first open. A test added above it makes the proof fail loudly, not pass falsely, so it
  is safe but surprising; resetting modules and importing the form inside the test makes it order-free.

## Real-route specs root must run

Project `real-route-chrome` (`playwright.s09-real.config.ts`); local loopback only. The first block must be written (V15-02), the second
block is regression for the shared chunks the lane changed.

Write and run:

1. `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts`, new T7 "term action" on an **active** vocabulary with at least one term
   (drive one through T6's assign, decide, activate flow, or the API helpers in `support/s12-governed-world.ts`). Reuse `coldLoad`, `hold`
   and the abort pattern of T5.
   a. Cold load of that page as the curator at 1280x720 and 1280x1000: no script matching `/\/CmsTaxonomyTermAction\.[\w-]+\.m?js$/`, no
      `contracts.*`/`validators.*`, total at most `BUNDLE_BUDGETS.initialRouteGzipBytes`.
   b. Press "Create a term": exactly one response for that chunk, at most `lazyChunkGzipBytes`, `#cms-term-form-heading` focused; open a
      row action next: no further script fetched.
   c. Slow chunk (hold it past 250 ms): "Loading the term form…" visible as `role=status`; release: form shown, heading focused. After V15-03,
      also move focus to another control before releasing and assert it stays there.
   d. Chunk aborted once (`/\/_astro\/CmsTaxonomyTermAction[^/]*\.js(\?.*)?$/`): alert "This form could not be loaded."; unroute; press "Try
      loading this form again": a request carrying `wj_retry=1`, form shown, heading focused. Variant: keep it aborted under every marker for two
      retries, unroute, third retry succeeds (V15-04: assert where focus is after each failed retry).
   e. Keyboard only: Tab to Create a term, Enter, Tab into the term key, type, activate an in-app link: inline leave confirmation appears and
      `beforeunload` is armed only after typing; Escape on a merge review returns to the edit step.
   f. Zero serious axe findings with the form open and with the failure alert showing.
2. Same file, T8 "panel re-read": hold the subject re-read after a 409 `subject_not_submittable`; at 250 ms "Checking the current state…" is
   visible and "Submit for review" is `aria-disabled="true"` (after V15-01); release: the fixed refusal copy and the new lifecycle.
3. `tests/e2e/phase-02-slice-11-bundle-budget-real-route.spec.ts`: add the entry editor (author, an existing entry). Cold load: no
   `/_astro/cms-field-value.*.js`, no `/_astro/cms-editorial-entry-editor-save.*.js`, no `contracts.*`, total at most 92,160 (this is the
   first Chrome measurement of that route; headroom is 1,648 B). First save with an invalid value: both chunks fetched once, within
   `lazyChunkGzipBytes` together, zero POSTs to `/api/v1/cms/entries/:id/revisions`.
4. `tests/e2e/phase-02-slice-10-authoring-real-route.spec.ts`: add the edit-route local refusal. Rating 11, wait out the 3 s idle: summary
   "Check these fields before saving again", field message "Enter 10 or less." (the validators', not the fallback "Fix the highlighted fields
   before saving. Your edits are kept."), `aria-invalid="true"`, zero POSTs; set 10: exactly one POST. Also assert that blur alone shows
   nothing (pins O-1 so a future change is deliberate).

Run as regression: `phase-02-slice-10-rich-text-real-route.spec.ts`, `phase-02-slice-10-draft-detail-real-route.spec.ts`,
`phase-02-slice-10-keyboard-real-route.spec.ts` (editors now import `cms-field-basics`: datetime, object, relation, taxonomy, rich text);
`phase-02-slice-11-workflow-real-route.spec.ts` and the three existing tests of `phase-02-slice-11-bundle-budget-real-route.spec.ts`
(workflow route 88,729, shared chunks changed by several lanes); T1 to T6 of the governed spec (the panel, conflict panel and
`CmsLoadingRegion` are on those pages). Register any new spec in both Playwright configs.

## Test corrections: verdicts

| Change | Lane's reason | Verdict |
|---|---|---|
| `tests/performance/cms-editorial-bundle-budget-mounted.test.ts:243` adds `'CmsTaxonomyTermAction'` to the pinned on-demand list | the list is the review gate for a new `CMS_ON_DEMAND_CHUNKS` entry | ACCEPT: additive, no assertion weakened, the entry meets the gate's three rules |
| `import './term-action-preload.test-support';` (line 2) in eight tracked `CmsTaxonomyTermForm*.test.tsx` files | the form now loads on first open (async) | ACCEPT: one added line each, assertions unchanged, `// @vitest-environment jsdom` stays first; the async path is covered elsewhere in jsdom (check 5) |
| same line in `CmsTaxonomyTermForm.leave.test.tsx` and `.retry.test.tsx` (untracked, other lane's files) | same | ACCEPT; missing from the lane's file table (V15-05) |
| `cms-on-demand-taxonomy-locale.proof.test.tsx` +28 lines (seam wrap and the new first test of the term-form block) | proof for the new entry | ACCEPT: additive; see V15-11 |

## Checked and found correct

- The moved helpers (`isJsonRecord`, `CMS_EMPTY_RICH_TEXT`, both datetime conversions) are the same code, re-exported by the old modules;
  `cms-field-basics.test.ts` pins that the old names are the same references, so no other importer changes.
- One registry instance in the build: registry code in the shared `cms-field-basics` chunk, imported by the island and by the lazily loaded
  `cms-field-value` chunk; the registration call survives bundling (`s(I)` ends that chunk).
- Entry editor cold load: `cms-field-value.*` and `cms-editorial-entry-editor-save.*` are lazy, `cms-field-basics.*` is initial; the island's
  static source closure reaches none of the four validator modules (`cms-field-validators-cold-load.test.ts`, and the build agrees).
- The routes that still import the validators statically (entry create, conflict resolve, locale variant) each grew about 220 B for a
  registry nobody reads there; all keep at least 1,229 B headroom.
- No import cycle in the closures of the lane's files (116 modules walked); no TODO, `any`, `@ts-ignore` or `eslint-disable` in them;
  `README.md` additions in the three directories match the code.
- `.cms-loading-region` CSS is inlined in the route styles of the pages that render the region (taxonomy edit and new, pattern, template,
  composition, workflow, definition-review detail), so the bar is drawn on every page that mounts it.
- Server rendering: the lazy view is only rendered after a press, never on the server; `isOnDemandAsset` matches `name.startsWith(stem + '.')`,
  so only a chunk with that exact stem is exempt.

## Observations outside the brief (not findings against this lane)

- O-1: the entry editor has no blur validation (pre-existing), see check 1. Root decision: accept the Slice 10 reading (revalidate on
  submit/autosave) in writing, or schedule blur validation and keep the validators reachable at first focus.
- O-2: AC-271 is not complete across the web. `CmsTaxonomyFieldConnected.tsx:41,60-61` (the entry editor's taxonomy selector, CMS-03C-17,
  `selectorState`) still shows "Loading terms…" immediately instead of after 250 ms. HEAD behavior; not wired by this lane.
- O-3: PAT-031 recovery covers the chunk the browser's error names. A static dependency of that chunk that failed sits in the module map
  as failed, and retrying the entry chunk under `?wj_retry=N` cannot revive it; only a reload does. Same at HEAD; the lane adds one
  dependency (`cms-field-value`) to the save chunk and the term action's shared chunks are in the same position.
- O-4: `apps/web/dist` is shared and was rewritten by another process at 00:52 as a staging/development build; `bundle:check` fails closed on it.
- O-5: in my 00:39 build the route manifest lists routes for tracked `README.md` and `*.test` files under
  `src/pages/app/cms-content-modeling/**` (for example `/app/cms-content-modeling/taxonomies/README` and `.../taxonomy-pages.test`). They are
  tracked at HEAD and unrelated to this lane; I did not test whether they are reachable. A one-line check by root is cheap.

## Requests to root

1. Fix V15-01 (C1) and re-run `pnpm build && pnpm bundle:check` plus the panel tests; the touched chunk is in three routes' initial sets.
2. Commit the lane with the three other lanes it depends on (V15-05, C2); fix the comment at `term-action-view.test.tsx:33-34`.
3. Write and run the real-route tests above (C3) before claiming P2-S11-AC-106 or P2-S12-AC-271 evidence for the entry editor and taxonomy
   edit routes; the entry editor Chrome total is the number that matters (headroom 1,648 B).
4. Decide V15-03 and V15-04 (recommended; V15-04 is a one-place fix in `retryableLazy`) and O-1 (blur validation, in writing).
5. Rebuild production output before the next `bundle:check` (O-4).

## Evidence index

- Lane report: `docs/handoffs/2026-10-22-claude-s12/lane-bundle-headroom-report.md`, SHA-256 `9b264aae4c138317f4d7d5fc30c012e4fcd961af633c2ddf49f40d6bdb3824b2`.
- Logs (scratch dir above; the scratch directory was wiped between sessions, so these files no longer exist and the hashes are the record
  of what was run): `build.log`, `bundle-check.log`, `bundle-check.json`, `vitest1.log`, `vitest2.log`, `eslint.log`, `exp/exp-run.log`;
  hashes in the Runs table. Experiment sources (`exp/*.exp.test.tsx`, run with a Vitest root in the scratch dir that imports the worktree's
  modules; nothing was written in the worktree): `panel-reread` `2594dd62881184b676d4e6456bac88f4c81c273f2010521e0e723fab11330e8a` (A),
  `term-focus` `14a0c8ed61802989b98d075a2cf824a3db41be57cfb8abc2f8ad865df7576215` (B), `term-retry-focus`
  `9a33ad60aac71e94d92ee14115751d6bf8bc403ebdd9dec33e5ec24724386e58` (C), `island-order`
  `98c0e97df650e630ea110b23669a65cf21f12759b151a24ba928356230bfd8d0` (D), `autosave` `c05ddfb997d758efbc7693fb42b39db14f4ded4cd7258e9a08f105e1953018f9`
  and `explicit` `0aa31b560b83fce221ad3fbb4294d014cbce2eae60110008fb5a57e4fc1b3b4b` (D2).
- Built files read (00:39 build): `cms-field-basics.Dgs31sNe.js`, `cms-field-value.B_h7s1gL.js`, `CmsEditorialEntryEditorIsland.M3HMf_xz.js`,
  `cms-editorial-entry-editor-save.Bf562Sy-.js`, `CmsTaxonomyTermAction.wniFN6UL.js`, `CmsTaxonomyTermForm.DxyJtXFN.js`, `CmsLoadingRegion.DS44xGab.js`.

## Verification

Verifier pass requested by root after the lane's follow-ups. Input: `lane-bundle-headroom-report.md`, section `## V15 follow-ups`, SHA-256
`c388818444bcb1c3228586d1be9a79a833ab54bf2e2b00b2ecc2f54b92d806e9` (equals root's `c3888184…`). HEAD still
`cd89d54cc84403e32699666c8d3710f45bbffce0`. Pass window 2026-10-28 19:44 to about 20:10 EDT. Read-only again: nothing written in the worktree
except this section (and the gitignored build output of W1); no database, race or Playwright; no sub-agents. The scratch directory of the first pass was wiped between sessions
(so the log files named in the first Evidence index no longer exist; their hashes stay as the record); this pass works in
`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/review-v15/verify/`.

### Verdict: ACCEPT-WITH-CONDITIONS

The product changes of C1, V15-03 and V15-04 are correct in the current bytes and each is killed by a mutant; the C2 inventory is complete and
its hashes match. Every bundle number reproduces. The Chrome specs (C3) are written and mostly aim at the right claims, but five defects in them (V15-13) make T7, T8 and the
authoring test fail or hang for test-authoring reasons, so none of the browser-only claims is proven yet. The product code can be committed;
no Chrome evidence may be claimed until V15-13 is fixed and the specs are green.

Remaining conditions: C3 (fix V15-13 a to e, then run the specs). Recommended: V15-14. Optional: the NITs.

### Status per finding

| finding | status | evidence (current bytes) |
|---|---|---|
| V15-01 MAJOR panel submit blocked while the subject is re-read | **CLOSED** | `CmsGovernedSubmitForm.tsx:31,48,64` (`busy?: boolean`, default false, `blocked = isCommitBlocked(...) \|\| busy`); `CmsGovernedReviewPanel.tsx:150` (`busy={refreshing}`); new third test of `CmsGovernedReviewPanel.loading.test.tsx` passes. Mutant M1 (panel drops `busy={refreshing}`) and M2 (form ignores `busy`): each fails exactly the new test (`expected 'false' to be 'true'`), the other two pass. Experiment A re-run: `{"before":{"readCalls":1,"fetchCalls":1},"state":{"region":"Checking the current state…","ariaDisabled":"true"},"after":{"readCalls":1,"fetchCalls":1},"afterAnswerAriaDisabled":"false"}` (was `"false"`, two POSTs, two reads) |
| V15-02 MAJOR no Chrome tests | **OPEN**, carried by V15-13 | part (d) CLOSED: `term-action-view.test.tsx:32-34` now cites `tests/e2e/phase-02-slice-12-governed-review-real-route.spec.ts (T7)`, T7 exists at `:617`, no reference to the missing file remains anywhere (grep over `apps`, `tests`, the lane report). Parts (a) to (c): the specs now exist, but see V15-13 |
| V15-03 MINOR arrival steals focus | **CLOSED** | `use-term-form.ts:182-190` `focusIsAtTrigger` (focus is `null`, `body` or the opening control), `CmsTaxonomyTermForm.tsx:186` passes it as `shouldTakeFocus`, `CmsTaxonomyTermAction.tsx:92-96` asks once at mount (default: take focus). `CmsTaxonomyTermForm.arrival-focus.test.tsx` 2/2. Mutants: M3a (guard ignored) and M3c (always true) each fail test 1. M3b (always false) is killed by the proof test, not by this file (V15-15). Experiment B re-run: pressed "Rename term guitar", moved to "Create a term", chunk released: `afterArrival` is `BUTTON [Create a term]` (was the form heading) |
| V15-04 MINOR failed retry drops focus | **CLOSED** (guard untested: V15-14) | `cms-retryable-lazy.tsx:30-46,51-56` (`retried` flag, alert `tabIndex=-1`, ref callback focuses the alert only after a retry). `retryableLazy focus` test passes. Mutants: M4a (no `focus()`) and M4c (no `tabIndex`) each fail that test. Experiment C re-run: first failure leaves focus on the trigger (`focusIsAlert:false`); a retry that fails again puts focus on the alert `P` (`focusIsAlert:true`); the good retry lands on `#cms-term-form-heading` |
| V15-05 MINOR commit set and inventory | **CLOSED** | all 10 other-lane files named in the follow-ups match their listed SHA-256; recomputing the relative-import closure of the 67-file union (lane files plus these 10) against `git status` finds no dirty file outside the union, so the inventory is complete; `leave` and `retry` hashes are now recorded and equal mine (`c6c4acca…`, `f3c9dfe8…`). The five files of the original 44-file table whose bytes changed (`CmsGovernedReviewPanel.tsx`, its `.loading.test.tsx`, `CmsTaxonomyTermAction.tsx`, `CmsTaxonomyTermForm.tsx`, `term-action-view.test.tsx`) are exactly the ones the follow-up table lists with new hashes; all 14 listed follow-up hashes match; no unexplained drift. Root still has to commit them in one range |
| V15-06 to V15-11 NITs | **OPEN**, unchanged, non-blocking | island still 202 lines; no preload on intent (`V15-07`); `cms-loading-region.css:2-3` claim unchanged; conflict panel copy at `:44` and `:49` unchanged; the island validators test still imports `cms-field-value` statically (`:23`), `cms-field-validation.test.ts:38` title unchanged, both loading-test header comments unchanged; the proof test file hash equals the original (`668c7e84…`). The lane's follow-up section does not claim any of them |

### What I ran

| # | What | Result |
|---|---|---|
| W1 | `pnpm build && pnpm bundle:check` (pinned toolchain) at 19:48 EDT; the build rewrites the gitignored `apps/web/dist` with a production build | build 0, check 0, `passed: true`, budgets 35,840 / 92,160 / 81,920 unchanged. Entry editor 90,512 (1,648 headroom), taxonomy edit 90,870 (1,290), conflict resolve 90,931 (1,229), pattern edit 90,230 (1,930), template edit 80,686 (11,474), registry 91,665 (495): every row equals the lane's table. `build.log` `3fd70f4e9bf3b4a33d25da90883d6466eda00d89e06fe81987015ec62869f9ce`, `bundle-check.log` `d294a1fa72363bb4768cbce95fc65158c74801f6d3f9bdca90d9f54648bedef7`, `bundle-check.json` `ee0ea9b39770a46b9aea70d1bcea62386fec50c0c2e91e1ba73a5b68fff1f77d` |
| W2 | Vitest, 427 files: all `apps/web/src/components/cms-*`, `pages/app/cms-content-modeling`, `cms-island-static-closure`, `cms-lazy-forms-closure*`, `client-chunk*`, `browser-validator-import-boundaries`, `lib/retryable-import`, `tests/performance` | 427 files, 4,576 tests, all pass (I did not run the lane's full `apps/web` suite of 724 files). `vitest.log` `a778421e28049b70f5d5d17765596dfe0d94d4730db07881506641e436447b64` |
| W3 | `prettier --check` and `eslint --max-warnings=0` on the 14 follow-up files | both clean (eslint exit 0, empty output) |
| W4 | Mutants and experiments through an out-of-tree Vitest root that applies one source substitution on load (never written to disk; it throws if the text is absent, so a mutant cannot be a silent no-op); each lane test file in its own entry file so file-level hooks do not leak. Baseline 16/16 pass; M1, M2, M3a, M3c, M4a, M4c killed; M3b survives `arrival-focus` but is killed by the proof test; **M4b survives** (V15-14) | `mutants-and-experiments.log` `b6a31b8eff79620515714533c4f34df52f05cefe791217602108a20e0d0a5fa4`; harness `exp/vitest.config.mts` `9214717f…`, runner `mut.sh` `898e38f6…` |
| W5 | Isolated `tsc --noEmit` of the three changed specs | no error inside the spec logic; only environment errors (no `@types/node` resolution, a `.mjs` without declarations). Note: no tsconfig covers `tests/e2e`, so the lane's `tsc --build` never checked these files |

### C3: the Chrome specs, judged one by one (read, not run)

Each row asks: if it runs, does it assert the browser-only claim it is meant to prove?

| spec / step | claim | asserts it? | verdict |
|---|---|---|---|
| governed T7 (a) cold load of an active vocabulary, two viewports | no `CmsTaxonomyTermAction` before an action opens | yes: by name (the spec's regexes were tested against the 19:48 build: `TERM_ACTION_CHUNK`, `FIELD_VALIDATORS`, `EDITOR_SAVE`, `CONTRACT_SCHEMAS` each match exactly one emitted file, `CmsTaxonomyTermAction.CujmhSpw.js`, `cms-field-value.B_h7s1gL.js`, `cms-editorial-entry-editor-save.Bf562Sy-.js`, `contracts.CT3qflGu.js`; the route regex and the `hold` glob match the chunk, with and without `?wj_retry=2`), no zod/validators chunk, total at most 92,160. Premise holds: `use-term-list.ts` has no mount effect and no `import()` | **sound** |
| T7 (b) first open | one fetch on open, within the lazy budget, heading focused, a second open fetches no script | yes: `chunks` toHaveLength(1) after the heading is focused, gzip size poll, `recordedScripts` around the second open. Blocked at `:665` by V15-13(c) | claim asserted; step defective |
| T7 (c) held chunk | loading state after more than 250 ms, focus the person moved stays | yes (`hold` + 400 ms, role `status` text, `renameRow` stays focused). Does not assert absence before 250 ms (the lane says so) | **sound** |
| T7 (c2) untouched | arrived form takes focus | yes | **sound** |
| T7 (d) aborted chunk | alert, retry under `wj_retry`, focus on the alert through two failed retries, recovery with heading focus | yes (`request` listener for `wj_retry=\d+`, `toBeFocused` on the alert, third retry after `unroute`); the route regex matches every marker and `unroute` receives the same object | **sound** |
| T7 (e) keyboard | Tab/Enter opens; `beforeunload` armed only after typing | yes (synthetic cancelable `beforeunload`, `defaultPrevented`). Risk V15-13(f) | claim asserted; budget risk |
| T7 closing line | no browser errors | will fail: V15-13(d) | **defective** |
| governed T8 | loading state during the re-read, submit withheld, a press sends nothing | **no as written**: V15-13(a) and (b) | **defective** |
| slice-11 test 1 (entry editor cold load) | no validators, no save flow, no contract chunk; at most 92,160 | yes: island chunk present, three regexes empty, `gzipTotal`. First Chrome measurement of that route. `seedEntry`, `cast.authorSession`, `cast.author` exist and have these shapes | **sound** |
| slice-11 test 2 (first save of an invalid value) | validators and save flow fetched once each, within the lazy budget, the validators' own message, nothing sent | yes: clears the required Title (`world.fields.title` is required), explicit Save draft, waits for "This field is required." (the validators' text; the fallback would be "Fix the highlighted fields…"), exactly one `cms-field-value.*` and one `cms-editorial-entry-editor-save.*` response, zero POSTs to `/revisions` | **sound** |
| slice-10 authoring (edit local refusal) | message after the idle window, blur alone shows nothing, sending resumes | mostly: summary heading, `aria-invalid`, validators' message, zero POSTs, then one 201 after a valid value. One assertion is wrong: V15-13(e) | claim asserted; step defective |

### New findings

#### V15-13 MAJOR (reopens V15-02): five defects make the new Chrome specs fail, hang, or fail to observe their claim

(a) T8 holds the wrong request. `phase-02-slice-12-governed-review-real-route.spec.ts:798` routes `'**/api/v1/cms/taxonomies/versions**'`. The
panel's re-read is `GET /api/v1/cms/taxonomies/${taxonomyId}/versions` (`taxonomy-versions-read.ts:201`, reached through
`CmsGovernedTaxonomyPanel.tsx:73`). That glob does not match it (the id sits between `taxonomies/` and `versions`); it matches the create
route `POST /api/v1/cms/taxonomies/versions` (`TAXONOMY_VERSIONS_API`, `s12-governed-world.ts:20`), which the handler lets through. The
re-read is never held, finishes at once, and "Checking the current state…" (shown only after 250 ms of reading) is never observed, so `:808-810`
times out. Fix: hold ``**/api/v1/cms/taxonomies/${subject.taxonomyId}/versions**``.

(b) T8 clicks a control it has just asserted is `aria-disabled`: `:811` then `:813` `await submit.click()`. In the installed Playwright 1.62.1
the "enabled" actionability state is `!getAriaDisabled(element)` and `aria-disabled="true"` on a `button` counts (`coreBundle.js`:
`elementState`, `hasExplicitAriaDisabled`, `kAriaDisabledRoles` includes `button`). `click()` therefore waits for the button to become
enabled, which only happens at `release()` (`:819`), after the click: it hangs until the 240 s test timeout. Fix:
`await submit.click({ force: true })`, or focus the button and press Enter (what a keyboard user does).

(c) T7 step b: `page.getByLabel('Label 1')` (`:665`) resolves to two elements, the text input and the "Remove" button whose `aria-label` is
"Remove label 1" (`CmsTaxonomyLabelRows.tsx:95`; rendered, only `disabled` when there is one row). `getByLabel` is a case-insensitive substring
match over `aria-label` as well as `<label>` text (`internal:label` and `getElementLabels` in Playwright 1.62.1), so `fill` throws a
strict-mode violation. Fix: `getByLabel('Label 1', { exact: true })`.

(d) T7 ends with `expect(curator.browserErrors).toEqual([])` (`:767`), and T8 ends with the same (`:824`) on the same shared `curator`. Step d
of T7 makes React 19.2.8 log each caught chunk failure with `console.error(error)` (`react-dom-client.production.js`,
`defaultOnCaughtError`), and `collectBrowserErrors` (`s10-real-browser.ts:33-46`) skips only "Failed to load resource:" and "net::ERR_"
lines, so "TypeError: Failed to fetch dynamically imported module: …" lands in the array. T7 fails at its last line, and T8 fails too
because the array is never cleared. Fix: in T7 assert that exactly those messages appeared (at least one, all matching the failure text),
then clear the array (`curator.browserErrors.length = 0`) before the next test.

(e) The authoring test asserts `page.getByText('Fix the highlighted fields before saving.')` has count 0
(`phase-02-slice-10-authoring-real-route.spec.ts:328`). That sentence is the status line the editor prints after every local refusal
("Fix the highlighted fields before saving. Your edits are kept.", `SAVE_COPY.invalidLocal`, rendered by `CmsEditorialStatus.tsx` in
`[data-cms-editorial-status]`; experiment D2 of the first pass recorded it next to the validators' message). The assertion fails when the
editor works. The negative is meant for the field's own message: assert that the title's `aria-describedby` target (its `…-errors`
element) has text exactly "This field is required." and drop the page-wide negative.

(f) Risk, not a certain failure: T7 step e calls `tabTo(page, /Create a term/u)` with the default budget of 40 key presses
(`s10-real-browser.ts:145`), but `taxonomies/[taxonomyId].astro:70-91` renders the designer and the governed panel before the term form,
behind the app shell. Pass a larger budget (for example 120); a failure prints the visited path.

After (a) to (e) are fixed I expect S11 test 1, S11 test 2, T7 and the authoring test to exercise their claims; T8 additionally depends on the
server answering the second submit with 409 `subject_not_submittable` (BE03c:401: "the subject state is `draft` with no live review, else 409
`subject_not_submittable`"), which holds for a version another session has already submitted.

#### V15-14 MINOR: nothing tests that a first failure leaves focus alone (mutant M4b survives)

`cms-retryable-lazy.tsx:37` (`if (alert === null || !this.retried) return;`) is the line that keeps a failed chunk at hydration or at a first open
from moving focus. Deleting `!this.retried` leaves all five tests of `cms-retryable-lazy.test.tsx` green (M4b). Add `expect(document.activeElement)
.not.toBe(alert)` after the first failure in "says the form could not be loaded…" and in the hydration test "replaces the server markup…".
Related, from reading: `retried` is cleared only when an alert mounts, so after a successful retry a later render error from the loaded child
would be shown as a retry and take focus; clear it when the load succeeds.

#### V15-15 NIT: the second arrival-focus test cannot catch an always-false `focusIsAtTrigger`

`CmsTaxonomyTermForm.arrival-focus.test.tsx` test 2 runs after test 1 has resolved the module-level lazy view, so the form mounts in the press's own
commit and the hook's focus effect (not the new guard) focuses the heading; mutant M3b survives that file and is killed only by the proof test.
Same order dependence as V15-11; reset modules and import the form inside the test.

#### V15-16 NIT: a form that arrives without taking focus is silent

When `shouldTakeFocus()` is false the loading region disappears and nothing announces that the form is now there. A polite status ("The term form
is ready") would tell a person who moved on. Product decision, low priority.

### Open items

1. **V15-13 (MAJOR)**: fix (a) to (e), consider (f), then run: governed T7 and T8, the two slice-11 entry-editor tests, the slice-10 authoring edit
   test, plus the regression specs listed in "Real-route specs root must run". Until they are green, no Chrome evidence for P2-S11-AC-106 or
   P2-S12-AC-271 on the entry editor and taxonomy edit routes.
2. **V15-14 (MINOR)**: add the first-failure assertions (and clear `retried` on success).
3. NITs V15-06 to V15-11, V15-15, V15-16: optional.
4. Commit the lane in one range with the ten other-lane files listed in the follow-ups (V15-05 is closed on the inventory; the commit itself is root's).
5. Headroom after the follow-ups: taxonomy edit 1,290 B, conflict resolve 1,229 B, registry 495 B.

### Counts after verification

Original findings: 11 (0 BLOCKER, 2 MAJOR, 3 MINOR, 6 NIT). Closed: V15-01, V15-03, V15-04, V15-05 (and V15-02 part d). Still open: V15-02, now
carried by V15-13, and the six NITs. New: 1 MAJOR (V15-13), 1 MINOR (V15-14), 2 NIT (V15-15, V15-16). Open in total: 1 MAJOR (V15-13, which carries
V15-02), 1 MINOR (V15-14), 8 NIT (V15-06 to V15-11, V15-15, V15-16).
