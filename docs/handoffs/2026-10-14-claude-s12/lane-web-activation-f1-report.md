# Lane report: claude_s12_web_activation_f1 (Web fix pass F1-F3, nits 7-8, README)

## Status
GREEN with one non-lane failure in the full suite (see Runs). 2026-10-15 09:07 UTC, worktree HEAD b16edb54. Web only; nothing under
`apps/worker/**`, `supabase/**` or `packages/contracts/**` touched.

## Scope
Brief `briefs/web-activation-f1.md`, from `review-web-activation.md` (VERDICT CLEAR, F1-F3 minors). Every fix RED first.
- F1 (FE03 :882, :902): `activationLocalErrors` adds, for a schedule whose resolution is not `resolved` (non-empty, unparseable local
  value such as a five-digit year), the error "Enter a valid local date and time." on the local field. `confirmationSentence` is now an
  exhaustive `switch` on the action and returns `string | null` (null for no action and for an unresolved schedule); the activate
  sentence is no longer a fallback; the form renders the confirmation only for a non-null sentence.
- F2 (FE03 :1118, :1216): `send` no longer clears the confirmation; an effect clears it when the command leaves `pending`. While pending
  the step stays mounted, the same commit button keeps focus, label and width, is `aria-disabled="true"` and `aria-busy="true"`, and is
  `aria-describedby` a visible pending sentence ("Activating…" / "Scheduling…" / "Retiring…"). Cancel is `aria-disabled` and a no-op while
  pending, as is Escape. The commit label is preserved (FE03 :1216 "preserve width/label, expose pending text"); the pending words are
  exposed beside it and in the frame's polite status, not by renaming the button.
- F3 (FE03 :1048): the island shows fixed owner copy "Only the owner of this version can retire it." when `subjectState === 'active'` and
  `retire` is not in `permittedNextActions`. The copy lives with its sibling in `governed-review-labels.ts` (`DISABLED_ACTION_COPY.retire`);
  that file is outside the brief's literal list but is the existing home of `activate`'s copy (see Requests to root 1).
- Nit 7: describe title now "versioned commands (CMS-03C-07, CMS-03C-08, CMS-03C-09)".
- Nit 8 (Danger): NOT applied, see Open items.
- README: `apps/web/src/pages/api/v1/cms/README.md` gained one line naming `governed-reviews/[reviewId]/activation.ts` (CMS-03C-09).

## Files (path under apps/web/src, lines, SHA-256)
| components/cms-governed-review/governed-activation-model.ts (edited) | 300 | 67e4635d6f24f96d9dc45dbb209ee74859b94f76548c5998a949d99e3f42025b |
| components/cms-governed-review/governed-activation-model.test.ts (new) | 84 | bd0492022f19b322f724972d917e1fe1e8df141001f1aab6becd2f8d6153d97e |
| components/cms-governed-review/use-governed-activation-form.ts (edited) | 211 | a0e202dbdc33856cdf9875e7a283071933d95f086c99c17dc054d70107ff5ff3 |
| components/cms-governed-review/CmsGovernedActivationConfirm.tsx (edited) | 86 | 2969892375fe6473fc5a98547a5ce4033b7e3c908f183b08362ddfda087cfd4f |
| components/cms-governed-review/CmsGovernedActivationForm.tsx (edited) | 124 | ad773332a8a1c0892abdf152dd6ec7535df71eaf7adb09173dd7f43cbc233dbb |
| components/cms-governed-review/CmsGovernedActivationForm.pending.test.tsx (new) | 110 | 44186f9618af241dc212b1404dc3d0f130a110cead54e1b9bdd3c2fe5acc0a18 |
| components/cms-governed-review/CmsGovernedActivationForm.schedule.test.tsx (edited) | 295 | e49a009ba08c70e7706f09d261b55e72522bda43fcd413d4e322427dbfe66716 |
| components/cms-governed-review/CmsGovernedReviewDetailIsland.tsx (edited) | 127 | a3a0e89aaddaf0c34bc225e41a437507ceca9099a4bde1bf8caeefb91efdb489 |
| components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx (edited) | 234 | d9fa34b557dabcb2d0521dcd14190f0e012aca923e369f5d6b606d278062e1a3 |
| components/cms-governed-review/governed-review-labels.ts (edited) | 105 | 5883abf197b75a734b4b1140625ca38c5ceb68159421ab86d1652c842efb8092 |
| server/cms-governed-review-platform-command-specifics.test.ts (edited, title only) | 245 | 97c63a9dd1af137eeaef9054b3ef3004e8001d38a002803d58f4262948a9a000 |
| pages/api/v1/cms/README.md (edited, one line) | 61 | 57e5b0aaa3a8d2cce786a6ff369427f541ffdea6ac1d712ea9917bc952fac3ae |
Limits: components <= 200, libs <= 300 (the model is at exactly 300), tests <= 400. Pre-edit copies are in the scratchpad lane directory.

## Runs (pinned PATH, Vitest/astro/eslint under `flock -s /tmp/wejammin-quiet.lock`)
- RED 08:50 UTC: 4 files, 29 tests, 6 failed / 23 passed; all genuine missing features: F1 model (`[]` instead of the error; activate sentence for
  an unresolved schedule), F1 form (five-digit year `12345-10-20T10:00` produced no alert, the silent no-op), F2 (confirmation unmounted
  while pending; no Cancel in the DOM), F3 (no retire reason). Output `claude_s12_web_activation_f1/red1.txt` in the scratchpad.
- GREEN `components/cms-governed-review`: 28 files, 352 tests pass.
- Final bytes, focused (`components/cms-governed-review`, `server/cms-governed-review*`, `pages/api/v1/cms/governed-reviews`,
  `cms-island-static-closure.test.ts`): 35 files, 562/562 pass, exit 0.
- Full `apps/web`: 499 files, 6016 / 6017 pass. The one failure is `components/step-up-required.inventory.test.ts`: it reports six
  unclassified files that all belong to the Web taxonomies lane (`components/cms-taxonomy-designer/{CmsTaxonomyStatus.tsx,
  taxonomy-transport.ts,taxonomy-versions-read.ts,taxonomy-vocabulary.ts,use-taxonomy-conflict.ts}`, `server/cms-taxonomy-platform-details.ts`);
  none of this lane's files. The brief withholds that test file, so it is left for that lane and root.
- `astro check` (apps/web): 1878 files, 0 errors, 0 warnings, 175 hints. eslint `--max-warnings=0` clean on every touched TS/TSX file;
  prettier `--check` clean on all twelve files.
- Mutation checks on a scratch mirror only (`<scratchpad>/claude_s12_web_activation_f1/mirror`, vitest config, a copy of `apps/web/src`,
  symlinked node_modules and packages; scripts `mutate_f1.py`, `mutate_f1_r2.py`; the worktree was never mutated):
  23 mutants run, 20 killed, 3 survived, all analysed. Killed: F1 drop error, wrong message, wrong field, unresolved-schedule and
  no-action activate fallbacks; F2 clear on send, never clear on settle, no aria-describedby, no aria-busy, Cancel not aria-disabled,
  pending text absent, commit label renamed, Cancel and Escape working while pending (after the guard moved into the Confirm component);
  F3 copy not rendered, shown to the owner, shown to any non-active reader, wrong copy. Survivors:
  (a) form ignores a null sentence (`&& sentence !== null`): unreachable at runtime since F1 stops the confirmation, and removing it is
  a compile error that `astro check` catches; (b) the `!blocked` guard in the Confirm click and (c) the same guard with the hook's `blocked`
  guard: equivalent, the controller itself refuses a submit while pending (`cms-workflow-command-controller.ts:277`).
- Not run: `pnpm bundle:check` (needs a build), browser E2E (no local stack).

## Test corrections
None. All additions; no existing assertion changed. (Nit 7 renames a describe title only.)

## Spec citations
FE03 :882, :902 (F1 named confirmation, ConfirmationStep); :1118, :1216 (F2 focus stays, disable only the commit action, preserve
width/label, expose pending text); :1048 (F3 disabled reason names the missing `permittedNextActions` entry). BE03c row 171 for the
README line. DESIGN.md Buttons (line 187) for the Danger question.

## Open items / BOUNDARY
1. Danger treatment for the Retire commit control (review nit 8) not applied. DESIGN.md Buttons says "Destructive actions name the
   consequence and use Danger only when the action is genuinely destructive" and defines the `danger` color token, but no existing
   button style implements it for the CMS: `.destructive-action` exists only under `.platform-configuration-page`
   (`styles/platform-configuration.css:85`) and is scoped to that page; `--cms-danger` in `styles/cms-editorial.css` colors error rules
   and `aria-invalid` borders only, and no CMS button rule uses it. Applying it would mean writing a new global style, which the brief
   forbids. The control still names its consequence in words ("Retire this version", "Entries bound to this version can no longer publish.").
   Needs an owner decision plus a shared CMS destructive-button class.
2. A person editing the inputs while a command is in flight changes the confirmation signature, which withdraws the step mid-pending (the
   fields stay editable during pending, as in the precedent forms). A tiny, transient edge; a guard on `fields.set` while pending would
   close it. Not done: beyond the brief and shared with `CmsEditorialScheduleForm`.
3. The unparseable-value silent no-op also exists in the precedent `CmsEditorialScheduleForm` (pre-existing, noted by the review); not
   touched (outside the claim).
4. `components/cms-governed-review/README.md` (line 54) still describes the confirmation without the pending behavior; not edited, it is
   not in the brief's file list.

## Requests to root
1. `governed-review-labels.ts` was edited for the F3 copy (one entry); it is outside the brief's literal list. Confirm or have it moved.
2. `step-up-required.inventory.test.ts` fails on the Web taxonomies lane's six unclassified files (above); root or that lane must classify them.
3. Decide Open item 1 (a shared CMS destructive-button style) if Retire should carry Danger.

## Fix pass 2 (claude_s12_web_activation_f2)
Brief `briefs/web-activation-f2.md`, from `review-web-activation-f1.md` (PARTIAL). Web only; nothing under `apps/worker/**`,
`supabase/**` or `packages/contracts/**`, no file of another lane. Every behavioral fix RED first (output files saved in the scratchpad
directory `claude_s12_web_activation_f2/`, abbreviated `$S`).

### What changed
1. Finding 1 (FE03 :1048): `CmsGovernedReviewDetailIsland.tsx` `awaitingRetire` now also requires `review.state === 'approved'` (as
   `awaitingOwner`; producer `20261013300500_cms_governed_review_support.sql:253-257` emits `retire` for an approved review only). New island
   case: a rejected and an invalidated review whose subject is `active`, no capability, shows no "Only the owner of this version can retire it."
2. Finding 2 (FE03 :1118, :1223), two parts, in `use-governed-activation-form.ts` and `CmsGovernedActivationForm.tsx`:
   - Commit: the step is no longer cleared as the command settles (the clear-on-leaving-pending effect now skips `committed`). `onCommitted`
     clears it after the re-read resolved and `onDone` focused the summary heading. Focus stays on the commit control through the re-read.
   - Unknown: the step is cleared at settle as before, and an effect in the form focuses the frame's "Check the current state" button.
     The frame (shared, outside this claim) carries no id on that button, so the effect finds it inside this form's own `[data-cms-workflow-form]`
     section by its words; if the frame's copy changes the focus test fails.
3. Nit 5: the pending words follow the submitted action (`pendingAction` in the hook model: the action recorded at `send` while pending, else the
   live choice); used for the frame label and the step's pending sentence.
4. Nit 6: `components/cms-governed-review/README.md` activation paragraph now describes Escape/Cancel (inert while pending), focus through
   pending/commit/unknown, and the submitted-action pending words.
5. Nit 7: `governed-review-labels.test.ts` completeness loop covers `record_decision`, `assign_reviewer`, `activate` and `retire`.
6. Finding 3 / citation: see "Corrections to the previous report" below. One added test (below) for a step left open when the read degrades.

### Files (path under apps/web/src/components/cms-governed-review, lines, SHA-256 at the end of the pass)
| use-governed-activation-form.ts (edited) | 224 | aecc7efa25c2b00bfa7e435640fdc5d9acc2c5fb965befeb6aae62cc730f3db8 |
| CmsGovernedActivationForm.tsx (edited) | 144 | efd4e0f31c8dbda9fdd558a90ea32350ac6b49f4e529f78494f0cf8e4d6f586a |
| CmsGovernedActivationForm.pending.test.tsx (edited) | 210 | 26f9b08adcd5590786848a6ca8fad734c543a31c597e374e3d17412a1d85f4a6 |
| CmsGovernedReviewDetailIsland.tsx (edited) | 129 | fb08fdccbdfe6ff4e7f029c85dd9d770fdbec04d6b75199293b7cb9d5253045b |
| CmsGovernedReviewDetailIsland.activation.test.tsx (edited) | 304 | 281a49ffb5fee870dc0ba80a78813a5be0a07fc528b1ee7090ee1c4e2ea62026 |
| governed-review-labels.test.ts (edited) | 78 | e2a13ff5fde65fce2368bb9f0a0cfbb9105c2367898038a609fc54a432dfcd46 |
| README.md (edited, the activation paragraph only) | 99 | 939c787b8dc86e004a879d3d676bfdc9e8b9d6b21cb3653e4a78589f4f933e47 |
Components <= 200, libs <= 300, tests <= 400. `CmsGovernedActivationConfirm.tsx` and `governed-review-labels.ts` were not edited. The README hash
is of the file at 12:15 UTC; the Web taxonomies lane may edit that README too, so re-hash before relying on it.

### New tests
- `CmsGovernedReviewDetailIsland.activation.test.tsx`: "never says the owner alone can retire a version on a review that did not approve it, even
  while that subject is active" (rejected and invalidated); "keeps focus on the commit control while the review is re-read, then moves it to the
  summary heading" (held `readReview`; asserts `document.activeElement` is the commit button during the re-read, then `#governed-summary-title`,
  and the step gone).
- `CmsGovernedActivationForm.pending.test.tsx`: commit focus with a held `refetch` (asserts the step is still mounted and focused before
  release, `onDone` called once with the step still mounted, focus on the summary heading after, step gone); unknown outcome focuses
  "Check the current state"; changing the radio mid-flight still says "Activating..."; a step left open when `disabledReason` appears cannot be
  committed (no fetch, `aria-disabled`).
- `governed-review-labels.test.ts`: loop extended (characterization: the entries already existed, so it cannot be RED; mutant N7a below).

### Runs (pinned PATH, root `vitest.config.ts`; Vitest/astro/eslint/prettier under `flock -s /tmp/wejammin-quiet.lock`)
- RED 11:43 UTC (`$S/red1.txt`, sha256 87b29b9d...): 4 failed / 17 passed in 3 files. Genuine missing behavior: commit focus (step unmounted at
  settle), unknown focus (`activeElement` was `<body>`), nit 5 ("Scheduling..." while an activation was in flight). Finding 1's case first
  failed as harness errors in my own new fixture (Zod: `distinctApprovalCount cannot exceed the approve decisions`, then `decidedAt exists exactly
  when the review is approved or rejected`; `$S/red1.txt`, `$S/red2.txt`), fixed with `distinctApprovalCount: 0` for the rejected review and
  `decidedAt: null` for the invalidated one; then the genuine RED (`$S/red3.txt`): `expected '...' not to contain 'Only the owner of this version can retire it.'`.
- GREEN after the fixes: `components/cms-governed-review` 29 files, 369 tests pass (11:44 UTC, `$S/green1.txt`).
- Mutation checks, scratch mirror only (`$S/mirror`, refreshed from the worktree before each script; the worktree was never mutated). Scripts
  `$S/mutate_f2.py`, `$S/mutate_f2_r2.py`; outputs `$S/mut-*.txt`, `$S/mut-summary.txt`, `$S/mut-summary-r2.txt` (all saved). 7 test files per run.
  - Round 1 (15 mutants): 11 killed, 3 survived, 1 not applied (my search string did not match after prettier reformatted the line).
    Killed: F1a (guard removed), F1b (excludes only rejected), F1c (excludes only invalidated), F2a (clear at settle again), F2c (never clear
    after commit), F2d (clear before the re-read), F2f (focus Retry instead of Check), N5a (label follows the live radio), N5b (ignores the
    submitted action), N5c (submitted never recorded), N7a (activate copy blank; killed by the island test and the extended loop).
  - Round 2 (2 mutants): F2e (no focus on unknown, search string corrected) KILLED; F3ab (both `blocked` guards removed together) KILLED by the
    new "cannot be committed until the read is verified again" test.
  - Survivors, all analysed: F2b (setConfirmed(null) before onDone): equivalent. React batches both state updates made in the same async
    callback, so the DOM still holds the step when `onDone` runs and the unmount happens after both in one render; the observable focus order is
    identical. I kept the order "focus, then clear" because it is correct under any scheduler. F3a (the hook's `blocked` guard alone) and F3b
    (the Confirm click's `!blocked` guard alone): each is redundant while the other stands (defense in depth on the same path); the pair is
    covered, as F3ab shows.
- Final bytes (12:05-12:06 UTC): focused (`components/cms-governed-review`, `server/cms-governed-review`, `pages/api/v1/cms/governed-reviews`,
  `cms-island-static-closure.test.ts`) 36 files, 581/581 pass, exit 0 (`$S/focused-final.txt`).
- `astro check` (apps/web) 12:03-12:05 UTC on the final bytes: 1910 files, 0 errors, 0 warnings, 176 hints, exit 0 (`$S/astro2.txt`). An earlier
  run (12:01) reported 1 error in my new test (`document.body.append(heading)` typed against the wrong overload); fixed with `appendChild`,
  as other tests do (`$S/astro.txt`).
- eslint `--max-warnings=0` and prettier `--check` clean on every touched TS/TSX file; prettier clean on the README.
- Full `apps/web` Vitest on the final bytes (12:06-12:16 UTC, `$S/web-full.txt`): 516 files, 6223/6223 pass, exit 0. An earlier full run at
  11:52-12:01 UTC (before the test-only `appendChild` change) showed 2 failures, both in other lanes' in-flight untracked files
  (`server/cms-composition-platform-capability-missing.test.ts`, `server/cms-taxonomy-platform-read.test.ts` vanished mid-run); both gone on rerun.
- Not run: `pnpm bundle:check`, browser E2E (no local stack).

### Corrections to the previous report (Finding 3 and the FE03 citation)
- Survivor (c) was misdescribed. I wrote that (c) was "the same guard with the hook's `blocked` guard" and that it was equivalent because
  "the controller itself refuses a submit while pending (`cms-workflow-command-controller.ts:277`)". No mutant in `mutate_f1.py` or
  `mutate_f1_r2.py` removed the hook's `blocked` guard: round 1's third survivor was F2e (Escape while pending), superseded by a code change
  that moved the guard into the Confirm component, and round 2's output was not saved, so its kills (F2c2, F2e2, F2a2) were reported without
  an artifact. The stated reason was also incomplete: `blocked` is `disabledReason !== null || BLOCKING_PHASES.has(phase)`; the controller
  (`cms-workflow-command-controller.ts:277-284`) refuses a second submit in `pending`/`committed`/`unknown`/`conflict`/`step-up-leaving`, but never
  looks at `disabledReason`. Removing both guards is therefore not equivalent in general: it would let a step that was open when the read
  stopped being verified commit. It happens to be unreachable only because the island offers no activation command while degraded, which the
  new test (a step left open when `disabledReason` appears) now checks directly; mutant F3ab is killed by it.
- FE03 citation: "the clause is :1223", not ":1216". Line 1216 is the `### Form contract` heading; the Submission row ("Disable only commit action,
  preserve width/label, expose pending text, ... ignore duplicate activation") is line 1223. The first-pass sections above cite ":1216" in
  several places (Scope F2 bullet, Spec citations); read those as :1223. The focus clause "focus stays until result heading" is :1118.
- All mutation outputs for this pass are saved (see Runs). The f1 pass's mutation outputs: `claude_s12_web_activation_f1/mut1.txt` only.

### Test corrections
None. All additions; no existing assertion changed or weakened.

### Open items / BOUNDARY
1. Danger treatment for Retire: still an owner decision (Open item 1 above); unchanged.
2. Editing the inputs while a command is in flight still withdraws the step mid-pending (Open item 2 above); the pending words now stay
   correct (nit 5) but the step can disappear. A guard on `fields.set` while pending would close it; not done (beyond this brief; shared with
   `CmsEditorialScheduleForm`).
3. The unknown-outcome focus finds the frame's button by its words because the shared frame (`cms-editorial-workflow/CmsWorkflowCommandFrame.tsx`,
   outside this claim) gives the button no id. If root accepts a one-line edit there (an id on that button), the lookup becomes `getElementById`.

### Requests to root
1. Ratify the `governed-review-labels.ts` scope change from pass 1 (already confirmed by the review as one entry in the existing copy table;
   untouched in this pass).
2. Optional: give the frame's "Check the current state" button an id (open item 3).
3. Decide Open item 1 (Danger).

Final status: GREEN. Written 2026-10-15 12:16 UTC.
