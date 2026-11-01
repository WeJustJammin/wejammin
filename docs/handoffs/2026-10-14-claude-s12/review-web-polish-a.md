# Review: claude_s12_web_polish_a (independent, adversarial; reviewer 2)

Status: COMPLETE (2026-10-15T16:45Z). Reviewer 2 replaced a predecessor killed by a usage limit; its checkpoint drafts were
re-derived independently and its scratch probe logs are cited where used. Read-only; only this file was written.

## Scope and inputs
Target `lane-web-polish-a-report.md` SHA-256 `2c01e8c704aa18d4f0ed0ea2b047acac15b92896bf77648bf828624cb438fada` (verified); brief
`briefs/web-polish-a.md`; FE03 :1171-1175, :1223, :1043/:974/:898/:1257, :1736-1745; BE00 :172; DESIGN.md :14, :187.

## Claims re-verified
- Files table: 51 rows; 50 match bytes and line counts. `cms-editorial-workflow/use-reviewer-options.ts` changed after the report
  (mtime 14:00:51Z, 40 -> 43 lines, new `enabled` param; another lane). Also post-report and not polish A's: new
  `CmsReviewerOptionsNotice.tsx` (duplicates the assignment form's inline notice); held rows 9-11 (template reconcile, governed
  canonical, related candidates) now call `retryingSafeRead` (other lanes); Request 1 already applied
  (`cms-governed-review/CmsGovernedActivationForm.tsx:39-42` focuses `${FRAME_HEADING_ID}-check`).
- My runs (pinned PATH, `flock -s /tmp/wejammin-quiet.lock`): focused Vitest, the 17 files in the report, 235/235 passed
  (16:36Z); island static-closure tests, 2 files, 21/21 (16:41Z); `astro check` (apps/web, 2017 files) 0 errors (16:37-16:39Z;
  the lane's 3 related-lane errors are gone).
- Lane logs (scratch `claude_s12_web_polish_a/`): full-web-1 557/557, 6813/6813; full-web-2 1 failure in the held
  `CmsGovernedReviewDetail.test.tsx`; astro-check-2 3 errors. Both match the report.
- Mutation claim: battery-1/2/3 have 25+28+19 = 72 mutants, 66 KILLED (all by real assertion failures, "Failed Tests N"), 6
  SURVIVED. These match the report. `battery4.sh` (the 3 re-runs) has no saved log, so "re-run, 3/3" cannot be checked;
  the matching tests exist (form-contract :144, :300, :310). Predecessor's independent sample of 10 mutants (scratch
  `review_web_polish_a/battery.log`) killed 9; the 10th is F3.
- Test correction 2 (support extraction): the 94 removed lines reappear in `...conflict-controller.test-support.ts` with only an
  `export` added; no assertion changed. Test correction 1: see F2.

## Retry contract check (FE03 :1173 and :1172) of the 10 paths changed
`lib/safe-read-retry.ts:25-57`: it retries only 502/503/504 whose body has `details.retryable === true`, after [250, 750] ms,
at most twice, and returns the last answer. A network throw, 429, 500 and 4xx are not retried. Tests use fake timers and step
past both 249/1 and 749/1 boundaries; the 500, 429, non-declared 503 and `retryable:false` cases are covered. The cms-editorial
Worker declares `retryable` only for 503/504 (`apps/worker/src/cms-editorial/route-errors.ts:141-144`), so the report's 502
statement holds for rows 1-5. Per path: draft detail, conflict detail, workflow and review canonical, reviewer options, grant
list and pattern latest all wrap the GET in `retryingSafeRead` (the client-binding header is re-added on each attempt), and the
429 seconds come from `rateLimitWaitSeconds`. No command module calls the helper. The only automatic command re-send is F1.

## Inventory completeness — 13/13, no missed path
Grepped every fetch site in `components/cms-*`, `content-schema-registry`, `lib`, CMS pages: every browser CMS GET maps to rows
1-13. `cms-editorial-pages/*`, `governed-review-page-reads.ts`, `load-governed-subject-review.ts`, `load-pattern-designer-page.ts`
are server loaders (`.astro` only); taxonomy-transport/restore/entry-create/workflow commands are POSTs; reconcile reads go
through rows 3, 4, 6; `CmsPatternNestedPicker` has no fetch (documented boundary).

## Findings
F1 `components/cms-editorial/cms-editorial-entry-editor-stale-base.ts:29-45` — **major**. On a 429 to the draft re-read after
a 409, the timer calls `resend()`, which is `attempt()` (`cms-editorial-entry-editor-save.ts:61`). That POSTs a *new* revision
command (fresh idempotency key) with the same stale `expectedVersion`/`baseRevision`, because no read succeeded. The server must
answer 409 again, which triggers another read, so 409 -> 429 -> wait -> POST repeats. The loop is not counted toward the M2
rebase bound (`ctx.rebases`, :98-111), so it is unbounded while reads keep answering 429 (one stale write every 5 s when no
Retry-After is stated). The copy `waitingMessage` ("Too many saves. Retrying in N seconds") blames saves for a read 429. The
test `cms-editorial-entry-editor-rate-limit.test.ts:32-52` answers the re-sent stale request with 201 `revisionCreated`, a
reply the server cannot give for a stale base, so the oracle encodes an impossible sequence and hides the extra write.
Why it matters: the brief and FE03 :1173 forbid adding command retries; this also bypasses M2's explicit bound. Fix: when
the wait elapses, re-run the read (`handleConflict(request)`), not the command, and bound it (count toward `rebases` or end in
`sync-conflict`). Say that the *read* is rate-limited. Make the third test response a draft-detail 200 and assert one write
before the rebase.

F2 `cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx:229-232` (test correction 1),
`...form-contract.test.tsx:239-249`, and `CmsPatternVersionDesigner.tsx:181-187` — **major**. The correction and the new
oracles (`textContent` is "Save successor draft"; mutant [5] `pending ? 'Saving…'` counted as KILLED) forbid a pending
label. The spec requires one: FE03 :1043 (Slice 12 `commandState`, CMS-03C-01..09, incl. pattern version create) "Stable
pending label; only the commit control disabled"; :898 `<ActionBar>` "stable pending label"; :974 (Granting/Renewing/Revoking);
:1257 ("Saving…"); DESIGN.md :187 "stable loading state that preserves its label width". Every sibling shows one: `CmsTaxonomyVersionDesigner.tsx:154`, `CmsRelatedContentForm.tsx:134`,
`CmsTaxonomyTermAction.tsx:178` and `CmsGovernedActivationForm.tsx:47` ("Activating…"). FE03 :1223 "preserve width/label" can
be read either way. The original oracle did not contradict the spec, and lane-rules say to stop and report a spec conflict
rather than choose. Fix: revert correction 1. Show "Saving…" while pending with the button width reserved (stacked labels or
`min-inline-size`), and keep `aria-busy` and the status text. Alternatively, escalate :1223 vs :1043 to root before changing
any oracle.

F3 `cms-pattern-designer/use-pattern-blur-validation.ts:44` — **minor**. The report calls the `visited.has(node key) -> true`
mutant equivalent ("a node key never left cannot be invalid"). That is false. Once any other control has been left, typing
"Bad Key" into a node key that has not been left yet shows an error before the visit. Only the `visited.size === 0` guard
(:77) hides this in the single test. The predecessor's probe confirms it: scratch `review_web_polish_a/probe-original.log`
19/19 pass, while `probe-mutant.log` fails "does not judge a node key being typed into before it was left, even after
another control was left". Fix: add that test. Production code is correct.

F4 `styles/cms-editorial.css:141-150` and `styles/cms-danger-action.test.ts:65-67` — **minor**. The report calls the class
"CMS-wide", but `#cms-editorial-main` exists only in `CmsEditorialDocument.astro:47`. 6 of 21 CMS pages do not use it, so the
class does nothing on: templates/new, templates/[templateKey] (`#cms-template-main`), capability-grants (Revoke),
schema-reviews/[reviewId], [contentTypeId]/versions/[versionId] and index. The "CMS-wide" test only asserts that a string is
absent, so it is vacuous. Retire is styled today, because it mounts only in the governed review detail island on
definition-reviews/[reviewId]. Fix: scope by a class or stylesheet that every CMS layout loads, and test page coverage.
Tokens, contrast math (OKLab -> linear sRGB, light theme only; no dark theme exists) and the 44px/focus/disabled preservation
are correct. `--cms-danger` (45% L) is darker than DESIGN.md :14 (55% L) and only its hue is pinned; the darker value is
needed to reach 4.5:1 on the panel colour, so it is acceptable.

F5 `cms-editorial/cms-editorial-conflict-controller.ts` — **minor**. It grew from 307 to 323 lines, past the 300-line cap for
lib/utility files, and it was already over the cap. Fix: extract the re-read and rate-limit branch.

F6 `cms-editorial-workflow/use-cms-workflow-canonical.ts:89-95` — **minor**. If a read is still in flight when the component
unmounts and it resolves with a 429, it arms a timer after the unmount cleanup (:60) has run. That timer refetches, and keeps
refetching while the answer is 429. Fix: bump `sequence` or set an unmounted flag in the cleanup.

F7 `CmsEditorialAssignmentCreate.tsx:170-176` and `CmsPatternConflictPanel.tsx:55` — **minor**. Both insert a `role="status"`
node that already holds its text, which screen readers often do not announce. The lane's own `CmsWorkflowRateLimitNotice`
mounts empty first to avoid exactly this. The manual paths (conflict form, editor "load current", assignment) state a static
number of seconds with no countdown and no gate. Fix: pre-mount the live regions and consider the existing `Countdown`.

F8 `lib/safe-read-retry.ts:62` — **minor**. Rows 1-2 used to parse with `cmsEditorialRetryAfterSecondsFrom`. The new
`/^[1-9]\d{0,4}$/` regex turns `Retry-After: 007` into null ("wait a moment"), although RFC 9110 delay-seconds allows leading
zeros. The impact is low. Fix: accept `^\d+$`, then range-check.

## Form contract (FE03 :1223), other clauses — conform
Blur: key/node key/props judged only after blur, then on each change; cross-field stays with submit. Only the commit button is
disabled while pending (fieldset only when `done`); duplicates ignored (`inFlightRef`). URL: `replaceState` with the encoded
server key on `created` and on an unknown outcome settled as saved (`use-pattern-designer.ts:146,165`; tests form-contract
:287-340). Residual: step-up `returnTo` (`CmsPatternVersionDesigner.tsx:61-63`) stays `/patterns/new` (harmless, form closed).

## Bundle findings
Not confirmable from saved outputs. `build.log` shows exit 0 at 13:56Z, but the `measure2.mjs` output was never written to a
file. `apps/web/dist` was removed and then rebuilt by another lane at 16:36Z (different bytes), and polish B is now editing
`scripts/verify-bundle-budget.mjs` and the budget tests. The findings (governed detail island > 35 KB; pattern page route
92463 B > 92160 B; missing routes in `CMS_EDITORIAL_ROUTES`) are plausible and were correctly routed to root. Root should
re-measure the workflow route: the lane reports 0.2 KB headroom and added its own notice and hook to that island.

## Requests to root
F1 and F2 need a fix lane (or an owner ruling on :1223 vs :1043 for F2) before acceptance; F3-F8 can ride along. Re-measure
bundles after polish B with a persisted log.

VERDICT: PARTIAL
