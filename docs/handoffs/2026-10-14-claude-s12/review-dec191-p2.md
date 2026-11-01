# Review: DEC-191 phase 2 + Web activation fix pass 2 (independent, adversarial)

Reviewer did not author either target; read-only except this file. Worktree HEAD `b16edb54`, 2026-10-15 13:45-14:00 UTC.
A: `lane-dec191-report.md` `## Phase 2` (dispatch SHA-256 `51170d0a…dd9c4c`). Disk is now `d2cb71d7…5a11`: fix pass 1 (13:48Z) edited
phase-1 sections and appended `## Fix pass 1`; the Phase 2 section (lines 172-268) is unchanged in substance and every claim below
was checked against disk, not the hash. B: `lane-web-activation-f1-report.md` `## Fix pass 2` (SHA-256 `9539751f…8e2` = disk).

## Status
Complete. No blocker, no major. A: one factual copy error and one duplicated vocabulary (both minor, small fixes), one tracking item
for root. B: Findings 1-3 and nits 5-7 closed; mutation account reconciles.

## Verification done
- Hashes: 33/33 phase-2 files match the report's SHA-256 and line counts. Fix pass 2: 4/7 match (hook, Form, pending test, Island);
  the activation island test, labels test and README were later edited by DEC-191 phase 2 and equal the phase-2 table.
- Reruns (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`): contracts `governed-activation`, `governed-review-read*`,
  `core-contracts` + Worker `cms-composition/governed-*`: 32 files, 917/917 (13:48-13:49Z). Web `components/cms-governed-review`,
  `server/cms-governed-review*`, `pages/api/v1/cms/governed-reviews`, `cms-island-static-closure.test.ts`: 38 files, 660/660
  (13:49-13:50Z). `node infra/generate-openapi.mjs --check` exit 0; `openapi.json` SHA-256 `72399c50…a925` = root's; diff +61/-1 is
  exactly `supersededVersion` (+required) and `activationSchedule` (+required). contracts `tsc --noEmit` 0, worker `tsc --noEmit` 0.
  `astro check`: 0 errors in target files (one other-lane mid-edit error; Runs addendum).
- RED evidence files exist and match: contracts 15 failed/26, Worker 23/23 (2 files, contract RED through fixtures, as stated),
  Web 56 failed/433. Mutants: all 8x3 contract/Worker/Web-server and 18 Web outputs exist; per-mutant failure counts equal the
  report (m1-m8: 2,1,1,1,1,1,1,1 / 1,2,2,1,3,1,1,1 / 1,1,1,2,3,1,1,1; w1-w18: 18,4,4,2,6,6,6,8,4,2,5,12,6,8,2,1,1,1). Sampled
  failure names are the intended tests (m5: the reason/state relation tests in all three suites; w8: per-reason copy; w16: the
  "member beyond state and reasonCode" degrade row). Mirror configs alias the mutated copies, not the worktree.
- No `any`, TODO, `.skip`/`.only` in the 33 files; Detail 188, model 299, largest test 363 lines.

## A. Spec conformance (DEC-191, BE03c :1054-1068, :1106-1108, :1473; FE03 :882, :1118)
- `GovernedActivationResourceSchema.supersededVersion` = BE03c `z.number().int().positive().nullable()`, required key. Matches.
- `activationSchedule` = BE03c strict `{state: 6-enum, reasonCode: 5-enum nullable}` nullable, required. Enums equal BE03c and the
  table CHECK (:1473). The contract correctly does not add "cancelled implies approval_invalidated" (prose :1347 only).
- "null unless activate": not in the DEC-191 decision text; it is the BE03c schema comment :1106-1107 ("null for schedule, retire and
  a lineage's first activation") and the brief, made executable. Consistent with SQL: `migrations-wip/dec191/20261014170100` emits
  `cms_governed_definition_version(kind, v_active)` for activate (r1) and literal `null` for schedule (r2) and retire (r3). The
  reason/state refinement likewise restates the BE03c comment :1054-1055 and the table CHECK. Neither is an invented rule.
- Web: result line "Activated, not published: …is now the active version. Version N is now superseded." (FE03 :882); null adds
  nothing; review detail shows one fixed sentence per state plus one per closed reason (FE03 :882 state column). Placed on the
  review detail (DEC-191 puts the member on `GovernedReviewDetailResource`), so every reader sees it, not only the form owner.

## A. Joint landing (confirmed by reading both directions)
- SQL not promoted, phase 2 landed: `validGovernedActivation` (`apps/worker/src/cms-composition/governed-review-validate.ts:107`)
  fails the required key, so `cms-composition-production-governed-review-ports.ts:143-149` answers 502 `DEPENDENCY_UNAVAILABLE`
  (retryable) AFTER the RPC committed: every activate/retire 200 and schedule 202 becomes an unknown outcome in the Web. CMS-03C-10
  `readReview` (`:160-162`) and the read route's `accept` (`governed-review-read-routes.ts:203-204`) fail the same way: the detail page is down.
  The Web server proxies (`cms-governed-review-platform-reads.ts`, command specs) and the browser guards repeat the refusal.
- SQL promoted, phase 2 not landed: the old strict objects refuse the unknown keys: identical 502s. Two-way break confirmed.
- Third leg: the corrected pgTAP oracles (phase 1 Test corrections) already sit in promoted test directories and require both
  members, so promoted-only DB runs fail `governed_activation` (8) + `governed_reads` (1) today (tracker 13:07Z). SQL + pgTAP +
  contracts/Worker/Web must land in one step.
- Other consumers (grep of both schema and type names over apps, packages, tests): only the governed contracts/Worker/Web files,
  `core-contracts.test.ts` (registry names), `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` (checks `$ref`
  names, not members: unaffected), the evidence ledger texts (Finding A3) and gitignored `packages/contracts/dist` (rebuilt
  08:35 local, already carries the member). No Playwright/PostgREST/e2e consumer; the CMS-03C-19 sweep parses
  `GovernedActivationExecutionResult`, untouched. Nothing else breaks.

## A. Copy
- No activation sentence says "published" except the negation "Activated, not published"; schedule states never claim publication.
- Fixed per closed value: `Record<enum, string>` tables (TS exhaustiveness) plus drift-test key equality with the contract enums.
- Unworded value degrades safely: browser `scheduleSound` (`governed-review-canonical-read.ts:61-74`) degrades on absent, wrong
  type, unknown state or reason, relation mismatch or an extra member, keeping the last verified review; server path is strict zod
  (502). The renderer can only see contract-closed values.
- One sentence is false: Finding A1.

## A. Test correction
`cms-governed-review-platform-activation.test.ts:181` `supersededVersion: 1` -> `unknownMember: 1`: non-weakening. The probe's
purpose is "an unknown member is refused"; `supersededVersion` became a valid member (the old probe would now be a valid resource
and a false failure); the oracle (502, outcome unknown) is unchanged and `:191-213` add the member's own refusals.

## B. Web activation fix pass 2 (against `review-web-activation-f1.md`)
- Finding 1 closed: `CmsGovernedReviewDetailIsland.tsx:83-86` adds `review.state === 'approved'`; island case covers a rejected and
  an invalidated review with an active subject; F1a/F1b/F1c killed (outputs saved).
- Finding 2 closed. Commit: `use-governed-activation-form.ts:105-110` re-reads, then `onDone` focuses the summary heading, then
  clears the step; the settle effect `:155-159` skips `committed`. The held-refetch test asserts focus on the commit control during
  the re-read, `stepWhenDone === [true]`, then heading focus and no step. `refetch` never rejects (`use-cms-workflow-canonical.ts:62-99`;
  the read catches fetch/JSON errors), so the `.then` always runs; on `gone`/`signed-out` the heading is absent and focus is a
  no-op (acceptable). While the re-read runs a second click is refused by the controller in `committed`.
  Unknown: `CmsGovernedActivationForm.tsx:42-51, 95-97` finds "Check the current state" by its words inside its own frame. Fragile
  but acceptable: the test fails on a copy change and F2e/F2f are killed; `restore` never yields `unknown`, so no focus theft on load.
  Note: the shared frame now carries `id={headingId}-check` (uncommitted Web polish A edit, 09:10 local); switching to
  `getElementById('governed-activation-title-check')` is root's queued 3e item.
- Nit 5 closed: `pendingAction` (`:190`) follows `submitted`, set in `send`; N5a/b/c killed. Nits 6/7 closed (README paragraph;
  labels loop covers `activate`/`retire`, N7a killed).
- Mutation account (`mut-summary.txt`, `mut-summary-r2.txt`): 17 attempts = 15 (one not applied) + 2; 16 applied, 13 killed, 3
  survived. F2b equivalent: agreed (React 18 batches `setConfirmed` inside the `.then`; `onDone` focuses synchronously before the
  render that unmounts the step). F3a/F3b each redundant, the pair killed as F3ab by the new degraded-read test. The tracker phrase
  "17 mutants, 13 killed, 1 equivalent, 2 redundant, 1 corrected and killed" counts F2e twice (nit, wording only).
- Residual (lane open item 2, disclosed): editing an input while pending withdraws the step; not in this pass's scope.

## Findings
1. `apps/web/src/components/cms-governed-review/governed-review-labels.ts:130` (and `CmsGovernedReviewDetail.test.tsx:203`) — minor
   (fix before close) — `retries_exhausted` reads "It stopped after three failed attempts." The producer blocks at the FOURTH
   consecutive failure: `cms_governed_schedule_record_failure` blocks when `attempt_count + 1 > 3`
   (`supabase/migrations/20261014070100_cms_governed_schedule_state.sql:38-41`; `20261014070600…:17` "the fourth consecutive failure
   blocks"; `20261014070500…:6`; 03b `internal-rpc.ts:138`). Why: a fixed sentence states a false fact to the owner. Fix: number-free
   wording, e.g. "It stopped after its retries ran out." (Slice 11 precedent `cms-workflow-labels.ts:146` "The schedule failed after
   all retries."); update the pinned test row.
2. `packages/contracts/src/cms-composition/governed-review-read.ts:74-80` — minor — `GovernedActivationScheduleReasonSchema`
   re-lists the five reasons already exported as `CMS_GOVERNED_SCHEDULE_BLOCK_REASONS` (`governed-activation-job.ts:55-61`).
   Why: extensibility rule (no copy-paste); two closed lists of one vocabulary can drift, and the Web drift test pins copy to the new
   list only. Fix: `z.enum(CMS_GOVERNED_SCHEDULE_BLOCK_REASONS)` (no cycle: the job module imports only primitives and
   `governed-review.ts`).
3. `.memory/wiki/specs/phases/phase-2.md:3181, :3187`; progress `:2093, :2099`; `tests/contracts/phase-02-slice-12-evidence-ledger-072-142.ts:342,
   :349, :516, :523` — minor (root, tracking) — AC-082/AC-088 enumerate the resource members without DEC-191's, while the new
   tests are tagged `[P2-S12-AC-082]`/`[P2-S12-AC-088]`. Why: ledger claims that list members are now incomplete; a marker audit
   sees tests asserting behavior the AC does not state. Fix: root cascades DEC-191 into both AC texts and the ledger (or retags).
4. `governed-review-canonical-read.test.ts` / `governed-activation-contract-drift.test.ts:255-270` — nit — CMS-03C-10 has no
   browser-vs-zod comparison on shared candidates (CMS-03C-09 has); only copy keys and member presence are pinned, so the
   relation rule exists twice without a cross-check. Optional: feed the degraded candidates through the contract too.
5. Report — nit — the dispatch SHA no longer equals disk (fix pass 1 edited phase-1 lines); root should cite the new hash.

## Requests to root
1. Route A1 (one copy row + its test) and A2 (one-line import) before joint promotion; A4 optional.
2. Cascade DEC-191 into AC-082/AC-088 text and the evidence ledger (A3).
3. Promote `20261014170000`-`170200` only together with phase 2 (contracts/Worker/Web) and the already-corrected pgTAP oracles.

## Runs addendum
`astro check` (apps/web, 13:51-13:53Z): 1994 files, 1 error, none in a target file: `cms-related-content/CmsRelatedContentForm.readonly.test.tsx:115`
(TS2339), another lane's untracked file written at 13:53:06Z, during the run (mid-edit). The lane's own final 0-error run is not contradicted.

Verdict A (DEC-191 phase 2): PARTIAL — conformant, joint landing confirmed; fix A1 (false copy) and A2 before close.
Verdict B (Web activation fix pass 2): CLEAR — Findings 1-3 and nits 5-7 closed; mutation account reconciles.
VERDICT: PARTIAL
