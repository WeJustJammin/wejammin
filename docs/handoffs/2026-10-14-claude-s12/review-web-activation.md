# Independent review: claude_s12_web_activation (CMS-03C-09 Web form + proxy)

Reviewer: independent, adversarial; did not author this work. Worktree HEAD `b16edb54`, 2026-10-15. Read-only except this file.
Target report `lane-web-activation-report.md` SHA-256 `4e2bd94b67d3264c400f823a00fa97de38ab9b334d8dce9f3f0b10f95c462430` (matches).
Template item 5 (re-hash files) skipped as instructed; line counts spot-checked and match the report.

## Status
Complete. No blocker, no major. Three minors (one a reachable confirmation-copy defect), one process minor, four nits.

## Route-registry clauses (BE03c row 171, as cascaded by DEC-190)
| Clause | Implemented | Tested |
|---|---|---|
| `POST …/{reviewId}/activation`, POST only, not prerendered | `pages/api/v1/cms/governed-reviews/[reviewId]/activation.ts` | `governed-reviews-routes.test.ts:74-93,199` |
| 200 activate/retire, 202 schedule | `cms-governed-review-platform-command-specs.ts:163`; browser `governed-activation-command-spec.ts:122` | table suite `…platform-command.test.ts:17,130`; transport `:148,190` ("activation answered 202", "schedule answered 200") |
| 404/403 relay, capability 403 → CapabilityGate copy | Worker; proxy `error-details.ts:224-226`; shared `classify403` | `…platform-activation.test.ts` 403/404 case; `.recovery.test.tsx:282` |
| CSRF double-submit, same-origin, query refused, 415, 256 KiB bound, strict body, catalog-only errors, no-store | shared `forward()` `…platform-command.ts:84-121` | table suite `:47,68,95,110` run for the three -09 cases; no-store `:23` |
| Unconditional step-up (401 STEP_UP_REQUIRED, details projected) | `STEP_UP_OPERATIONS` `error-details.ts:43-47` | `…command-specifics.test.ts:89` (loop covers -09); browser `.recovery.test.tsx:124-230` |
| Key + exact strong If-Match = review `version` | `expectedVersion` spec `:161`; browser `versionOk` transport `:188-198` | specifics `:73` (null, `"3"`, `W/"2"`, `2`); transport `:121` |
| Pinned-tzdb Time authority for schedule | `resolveScheduleInput` + `CMS_TZDB_VERSION` (`governed-activation-model.ts:264-279`), identical to `CmsEditorialScheduleForm.tsx:115-125` / `cms-workflow-schedule-form-model.ts:108-118` | `.schedule.test.tsx:64-249`; drift `governed-activation-contract-drift.test.ts:62` |
| Answer binding: same review/action; activate+retire at expected+1; schedule unchanged + instant ±1 ms; ETag = `reviewVersion`; Location = review | `cms-governed-review-binding.ts:98-120`, `etagVersion` `:167`, `location` `:168`; browser `governed-activation-command-spec.ts:123-146` | `…platform-activation.test.ts:102-190`; transport `:190-287` (16 negative cases) |
| Typed refusals (5×409, 8 time 422, `canonical_source_unavailable` + domain) | `typedRefusal` `error-details.ts:147-176`; browser `governed-review-reasons.ts:35-51` | proxy `…platform-activation.test.ts:192-337`; drift `governed-review-reasons.test.ts:21`; transport `:304-370` |
Matches the Worker (`apps/worker/src/cms-composition/governed-review-validate.ts:102-127`, `governed-activation-routes.ts:100-107`).

## Spec checks requested by root
- Gating on server `permittedNextActions`, owner-only: `offeredActivationActions` (model `:35-38`) filters the server list; fields/confirm render only under `{permitted ? … : null}` (`CmsGovernedActivationForm.tsx:92`), so a readable phase after the re-read never exposes controls (the defect found in the definition-reviews revoke list is absent here). SQL producer `20261013300500…support.sql:252-257` emits activate/schedule for approved|blocked and retire for active, only with the `capability` scope. Tested island `:77-114`.
- Confirmation step: inline, heading focus, Escape/Cancel/any input or version change withdraws it (signature `use-governed-activation-form.ts:132-141`); nothing sent before confirm; Enter only reaches the confirmation. Tested `CmsGovernedActivationForm.test.tsx:103-199`. See F1, F2.
- DEC-111: draft stores choice + text, never an instant; original key reused once; version change opens SyncConflict; `sms`-only → degraded. Tested.
- `canonical_source_unavailable` names the domain (`governed-activation-refusal.ts:93-99`); proxy drops a domain-less answer. Tested.
- Outcome copy: 200 "Activated, not published: …", 202 "Scheduled, not active: …", retire names the consequence. The word "published" appears only negated, as in the precedent "Scheduled, not published" (`CmsEditorialScheduleForm.tsx:163`); it never reads as published (FE03 :882, :2662). Accepted.
- Next If-Match after retire: the proxy and browser bind retire at expected + 1 and require `ETag "<reviewVersion>"`; the next `expectedVersion` comes from the canonical re-read (`onCommitted` → `refetch`), and a failed re-read disables the form (UNVERIFIED). After retire the producer offers no further action. Correct and safer than reusing the 200 body.
- BOUNDARY 1 (superseded number) and 2 (blocked/cancelled schedule reason): verified genuinely absent — `GovernedActivationResourceSchema` has no superseded member; `GovernedReviewDetailResourceSchema` (`governed-review-read.ts:64-100`) has no schedule/blocked-reason member; no template/pattern lineage read carries an active-version pointer. No stub, no TODO; the UI omits the number with a neutral sentence. See F4.
- Panel: old copy removed everywhere (`grep` finds it only in absence assertions); notes per state; summary links to the review (`CmsGovernedPanelReviewSummary.tsx:24`).

## Security
Proxy ordering (binding → method → origin → path UUID → query → CSRF → media → headers → bounded body → strict schema → If-Match) unchanged and shared; the -09 entry adds no new path. Error details rebuilt from closed vocabularies; attacker `message`/unknown pointers dropped (`…platform-activation.test.ts:236-278`). No PII in copy, URL or storage (draft holds action/time/zone/reason only). Browser stays zod-free (`cms-island-static-closure.test.ts` passes; reason schema loaded lazily via `withCmsValidators`).

## Tests and test corrections
All four corrections are additive or brief-ordered and non-weakening: routes 4→5 modules with the new method row; panel copy replaced plus an absence assertion; reasons drift now includes -09; table suites gained -09 cases (status union widened to 202). Fixtures parse through the real contract (`cms-governed-review-fixtures.test-support.ts:187-230`). Negative oracles are non-vacuous (each case differs from the accepted fixture in exactly one property). Mutation script `scratchpad/web-activation/mutate-web-activation.py` read: 38 targeted mutants with credible kills; see F5 for one kill on a non-load-bearing value. The route test was written after the route (disclosed; S9 covers it).

## Claims re-verified (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`)
- Focused Vitest: `components/cms-governed-review`, `server/cms-governed-review*`, `pages/api/v1/cms/governed-reviews`, `step-up-required.inventory.test.ts`, `cms-island-static-closure.test.ts` → 34 files, 556/556 pass, exit 0 (04:42).
- `astro check` (apps/web) → 1817 files, 0 errors, 0 warnings, 175 hints, exit 0. Matches the report.
- Full web suite not re-run (outside allowance); lane's `web-final.txt` shows 483 files / 5608 pass at 04:21.
- No `any`, TODO, `.skip`/`.only` in lane files; component files ≤200 (Fields 148, Form 122, Confirm 69, Island 121, Panel 191), libs ≤300 (model 283, hook 204), tests ≤400 (max 380). No leftover mutation backups in the worktree.

## Findings
1. `components/cms-governed-review/governed-activation-model.ts:152-188, 198-208` — minor (fix before close) — a schedule
   whose local value is non-empty but unparseable (e.g. a five- or six-digit year, which a `datetime-local` control can
   hold; `LOCAL_PATTERN` in `packages/contracts/src/cms-editorial/time-authority/local-datetime.ts:69-70` needs `\d{4}`)
   resolves `{kind:'empty'}` (`cms-workflow-schedule-resolution.ts:69-70`). `activationLocalErrors` has no branch for it,
   so the confirmation opens titled "Confirm scheduled activation" with the sentence "Activate {subject} now." (fall-through
   at `:207`) and a "Schedule activation" button that does nothing (`activationSubmission` returns null,
   `use-governed-activation-form.ts:194-195`), with no error. Why: the named confirmation (FE03 :882, :902) misstates the
   action and the person is stuck silently. No false commit is possible. Fix: add a schedule error for any non-`resolved`
   resolution ("Enter a valid local date and time.") and make `confirmationSentence` exhaustive by action (never fall back
   to the activate sentence); add a RED test with an out-of-pattern local value. (The precedent schedule form has the
   same silent no-op, pre-existing, but not the wrong sentence.)
2. `components/cms-governed-review/use-governed-activation-form.ts:196`, `CmsGovernedActivationConfirm.tsx:18-57` — minor
   (a11y) — `send` clears the confirmation before the command settles, so the commit control unmounts and focus drops to
   `<body>` while pending; the confirm's `pending`/`aria-busy` props are dead. FE03 :1118 "focus stays until result
   heading", :1216 "Disable only commit action, preserve width/label, expose pending text". Refusal and commit later move
   focus, so the loss is transient. Fix: keep the step mounted while `phase === 'pending'` (clear on settle) with the
   commit control `aria-disabled` and the pending label; assert `document.activeElement` during pending.
3. `components/cms-governed-review/CmsGovernedReviewDetailIsland.tsx:77-81, 113-115` — minor — a disabled reason is given
   only for activate/schedule. A reader of an approved review whose subject is `active` and who is not offered `retire`
   sees no reason (FE03 :1048 "Reason names the missing `permittedNextActions` entry"). Fix: extend the guard to
   `subjectState === 'active' && !permitted.has('retire')` with fixed owner copy; add one island case.
4. `lane-web-activation-report.md` Open items 1-2 / Requests 2 — minor (process) — both BOUNDARY items are FE03↔BE03c
   contradictions (FE03 :882 and :1118 require announcing the superseded version; FE03 :882 requires a closed schedule
   reason; no contract carries either). Filing BOUNDARY 1 as "Optional" understates it: FE03 cannot be met as written.
   Fix: root records both as spec gaps (`/propagate-decision` or a BE03c amendment) and tracks them, not as optional.
5. `components/cms-governed-review/governed-activation-refusal.ts:89, 17-29` — nit — the governed classification's
   `refetch`/`rotateKey` are display-only; the controller refetches and rotates from
   `classifyWorkflowRefusal('CMS-03B-07')` (`cms-workflow-command-controller.ts:236-244`). Runtime behaviour is correct
   today (generic 409 branch refetches; 422 does not) and is proven at form level (`…Island.activation.test.tsx:165`,
   `.schedule.test.tsx:232`), but mutant B5 was killed by a unit assertion on a value with no runtime effect. Same
   pattern as the pre-existing `governed-review-refusal.ts`. No change required; note it in the mutation claim.
6. `server/cms-governed-review-platform-error-details.ts:162-175` — nit — time-token 422s drop the server's
   `alternatives`/window, unlike the precedent schedule form; the pinned local resolver catches gaps/folds before send,
   so only a tzdb skew loses them (copy then says reload). Accept.
7. `server/cms-governed-review-platform-command-specifics.test.ts:70` — nit — describe title "(CMS-03C-07, CMS-03C-08)"
   now also runs the three -09 cases; rename.
8. Retire control has no Danger styling and `server/README.md` / `pages/api/v1/cms/README.md` omit CMS-03C-09 — nit,
   both disclosed by the lane (outside its claim).

## Requests to root
1. Route F1-F3 to a small fix pass (one lane, Web only); F1 should be RED-first.
2. Record BOUNDARY 1 and 2 as FE03↔BE03c spec gaps with an owner (F4).
3. The lane's scratchpad incident (it executed another lane's Worker mutation script twice): no backup files remain in
   the worktree; the affected Worker-taxonomy lane's mutation results from 03:47-04:00 should be re-run, as the lane asked.

VERDICT: CLEAR
