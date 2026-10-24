# Independent review: claude_s12_web_activation_f1 (delta: F1-F3, nits 7-8)

Reviewer: independent, adversarial; did not author this work. Worktree HEAD `b16edb54`, 2026-10-15 11:40 UTC. Read-only except this file.
Target report `lane-web-activation-f1-report.md` SHA-256 `1ded5537…29f1`. Item 5 hash re-check skipped as instructed (predecessor
verified the report and all 12 file hashes/line counts). No lane file under `components/cms-governed-review` changed after the
lane's final run (only the taxonomies lane's new `CmsGovernedTaxonomyPanel{,.test}.tsx`, 11:36 UTC).

## Status
Complete. No blocker, no major. F1 closed. F2 closed with a narrower residual focus gap. F3 fixed for the reported case but shows
the copy in a reachable wrong case. One process minor on the mutation account. Five nits.

## Item verdicts
- F1 (FE03 :882, :902): closed. `activationLocalErrors` (`governed-activation-model.ts:190-191`) adds "Enter a valid local date and
  time." for any non-`resolved` kind after the empty/zone/status/gap/fold/refused branches; after those checks `empty` can only mean
  the local value failed `parseLocalDateTime` (`cms-workflow-schedule-resolution.ts:69-70`). `confirmationSentence` (`:207-225`) is a
  switch over all four values with return type `string | null` and no default, so a new action is TS2366 at compile time; no
  activate fallback. Form RED (`.schedule.test.tsx:143-157`) is non-vacuous: RED showed no alert element at all (`red1.txt`), so jsdom
  kept `12345-10-20T10:00` (a sanitised `''` would have produced the "Choose a local date and time." alert); it also asserts no
  confirmation, no "Activate Template" text, focus on the alert and no fetch. Copy style matches the sibling schedule errors.
- F2 (FE03 :1118, :1223 — the lane's ":1216" is the `### Form contract` heading): closed for the pending phase. The step stays mounted
  (`use-governed-activation-form.ts:145-150` clears on leaving `pending`); the same commit button keeps its label, is
  `aria-disabled` (`pending` is in `BLOCKING_PHASES`, `cms-workflow-form-state.ts:10-16`) and `aria-busy`, and `aria-describedby`
  points at visible "Activating…"; `document.activeElement` is asserted during pending (`.pending.test.tsx:69,84`). Cancel/Escape
  are inert only while pending (`CmsGovernedActivationConfirm.tsx:55,78`).
- Stranding check: neither the controller (`cms-workflow-command-controller.ts:250-284`) nor the transport
  (`governed-review-command-transport.ts:200-222`) has a client deadline or abort; this is shared Slice 11 design, and FE03 :1173
  assigns it to the BE deadline (Worker 504 → `refused`/`unknown`, network failure → `unknown`; both settle and clear the step).
  A request that never settled was equally stuck before this pass (controller `submit` refuses while `pending`), so F2 adds no new
  strand; the person can still edit an input (withdraws the step) or reload. Not a finding.
- F3 (FE03 :1048): fixed for an approved review, but see Finding 1. The `governed-review-labels.ts` edit is one entry in the existing
  `DISABLED_ACTION_COPY` table beside `activate`; it is the convention's home for fixed copy and untouched by any other lane since.
  Recommend root ratify the scope deviation (lane Request 1).
- Mutants: (a) `&& sentence !== null` is runtime-redundant: `confirming` needs `confirmed === signature`, a schedule is confirmed
  only when resolved, and any later non-resolved kind changes the signature (`:138-140`); removing it is a type error. (b) the
  Confirm's `!blocked` guard is redundant: `send` re-checks `blocked` (`:203`). (c) see Finding 3.
- Regression: none found. All first-pass activation/schedule/retire/recovery/island/transport/proxy tests are unchanged and green.
  Nit 7 (title only) verified; nit 8 not applied, correctly (no CMS destructive button class exists).

## Reruns (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
- Focused Vitest (`components/cms-governed-review`, `server/cms-governed-review`, `pages/api/v1/cms/governed-reviews`,
  `cms-island-static-closure.test.ts`): 36 files, 570/570 pass, exit 0 (11:37 UTC). The lane's 35/562 plus the taxonomies lane's new
  `CmsGovernedTaxonomyPanel.test.tsx` (8 tests).
- `astro check` (apps/web): 1898 files, 0 errors, 0 warnings, 178 hints, exit 0 (11:39 UTC; file count grew with the concurrent lane).
- No `any`, TODO, `.skip`/`.only` in lane files; components ≤200 (Confirm 86, Form 124, Island 127); model exactly 300.

## Findings
1. `components/cms-governed-review/CmsGovernedReviewDetailIsland.tsx:83-84` — minor (fix before close) — `awaitingRetire` omits
   `review.state === 'approved'`, unlike its sibling `awaitingOwner` (`:77-81`) and the producer, which emits `retire` only for an
   `approved` review (`supabase/migrations/20261013300500_cms_governed_review_support.sql:253-257`). `subjectState` is the live
   subject state (`20261014010300_cms_get_governed_review.sql:129`), and BE03c :1337 returns a rejected/invalidated subject to
   `draft`, from which it can be resubmitted under a new review and activated. On the old rejected/invalidated review every reader,
   including the capability holder, then sees "Only the owner of this version can retire it." (beside "The version is back to draft"
   for an invalidation). Why: false reason copy (FE03 :1048), and it misdirects the owner. The prior review's fix direction omitted
   the guard too. Fix: add `review.state === 'approved' &&`; add a case with a rejected or invalidated review whose subject is
   `active`. The test at `.activation.test.tsx:115-133` does not cover it.
2. `use-governed-activation-form.ts:147-150`, `:101-103` — minor (follow-up, a11y) — on commit the step unmounts at settle, but focus
   moves to the summary heading only after `refetch()` resolves, so the focused commit control drops focus to `<body>` for the re-read
   latency; on `unknown` nothing takes focus at all (the frame's Check/Retry buttons, `CmsWorkflowCommandFrame.tsx:171-185`, are not
   focused). FE03 :1118 "focus stays until result heading". Narrower than the original F2 and not a regression (focus used to drop at
   send). Fix: clear the step after `onDone` focuses on commit, and focus "Check the current state" on `unknown`; assert both.
3. `lane-web-activation-f1-report.md` Runs, survivor (c) — minor (process) — no mutant in `mutate_f1.py` or `mutate_f1_r2.py`
   removes the hook's `blocked` guard; round 1's third survivor was F2e (Escape, superseded by a code change), and round 2's results
   were not saved (no output file; I agree from reading that F2c2/F2e2/F2a2 are killed by `.pending.test.tsx:77-85` and `:59-75`).
   The stated reason ("the controller refuses while pending") is incomplete: `blocked` also carries `disabledReason`, which the
   controller never checks. Removing both guards is runtime-equivalent only because no other refetch can degrade the read while a
   step is open (an approved/active review offers no decision or assignment command; the form's own refetch follows a settle that
   clears the step). Fix: correct the account; optionally add a test that a step open when the read degrades cannot commit.
4. `CmsGovernedActivationConfirm.tsx:74-80` — nit — Cancel `aria-disabled` while pending sits against FE03 :1043/:1223 "only the
   commit control disabled". Accepted: FE03 :902 limits Escape/Cancel to "before commit", and an enabled Cancel would imply withdrawal
   of a command it cannot abort.
5. `CmsGovernedActivationForm.tsx:87` — nit (pre-existing) — the frame's pending label follows the live radio, so changing the choice
   mid-flight reads "Scheduling…" while an activation is in flight. Tie it to the submitted action with lane Open item 2.
6. `components/cms-governed-review/README.md:54` — nit — still says Escape and Cancel withdraw the step (lane Open item 4).
7. `governed-review-labels.test.ts:68-71` — nit — the disabled-copy completeness loop still lists only `record_decision` and
   `assign_reviewer`; `activate`/`retire` are covered only by exact-text island assertions.

## Requests to root
1. Route Finding 1 (one guard + one island case, RED first) before close. Finding 2 can ride with it or be a tracked follow-up.
2. Ratify the `governed-review-labels.ts` scope deviation; have the lane correct the mutation account (Finding 3).
3. Lane Open item 1 (Danger style) needs an owner decision; I confirm no CMS destructive-button class exists to apply.

VERDICT: PARTIAL
