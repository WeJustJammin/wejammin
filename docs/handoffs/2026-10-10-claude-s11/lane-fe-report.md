# Slice 11 lane "fe" report (2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. Started at HEAD
`9b9b588e`; HEAD read `352c397a` at the end (moved by the orchestrator; nothing of this lane is committed).
Nothing outside the assigned ownership was edited. No git write command was run.

Logs: `docs/handoffs/2026-10-10-claude-s11/lane-fe-logs/` (`00` baseline 312/312, `01`-`03` first runs, `04` RED, `05` GREEN,
`06`/`08` full-lane GREEN, `07` tsc, `M1`..`M12` mutation runs).

## Verification summary

- Final lane run (`08-final-lane-GREEN.log`): `pnpm exec vitest run apps/web/src/components/cms-editorial-workflow apps/web/src/lib
  workflow-route.test review-detail-route.test review-queue-route.test revision-history-route.test
  tests/accessibility/route-heading-focus.test.ts` = 44 files, 444 tests passed. Baseline before my change: 28 files, 312 tests.
- `tsc -p apps/web/tsconfig.json --noEmit` exit 0 (`07-tsc-web.log`); eslint `--max-warnings=0` exit 0 and prettier `--check` clean on
  every file I touched.

## Item 1 - AC-037, AC-040, AC-043, AC-054, AC-060, AC-072: negative focus rules

Result: the code already obeys every rule; I found no defect. Method note: these tests were GREEN on first run, so the RED proof is
mutation, not an absent feature. Twelve mutations, each applied to production code, each run, each reverted (git shows the production
files untouched), each killed by named tests:

| Mutation (log) | Killed by |
|---|---|
| M1 `CmsWorkflowCommandFrame` focuses its heading while pending | 28 of 31 tests across the forms file and both islands |
| M2 `onDone` before the read lands (Submit form) | forms "moves focus only to its named result heading..." (Submit); island "keeps focus on the activated control until the read lands..." |
| M3 `useCanonicalResource` refetch focuses `workflow-actions-title` | island AC-054 reconcile test; AC-037 refusal-alert test; AC-043 preview-then-refetch test |
| M4 AssignmentCreate names `review-decisions-title` | AC-072 assign (island) and forms "Assign a reviewer moves focus only..." |
| M5 Submit button `disabled` instead of `aria-disabled` | forms "Submit for review keeps focus on the activated control while its command is in flight" |
| M6 Preview focuses form heading, not `preview-token-title` | island AC-043 preview test; forms "Create a preview moves focus only..." |
| M7 schedule resolution change focuses a heading | `CmsEditorialScheduleForm.focus.test.tsx` AC-040 |
| M8 Publish names `workflow-schedules-title` | island AC-043 publish test; forms "Confirm publication moves focus only..." |
| M9 `installRouteHeadingFocus` without the initial-load skip | 5 tests in `route-heading-focus-install.test.ts` |
| M10 ignores the fragment | "keeps the browser fragment target..." |
| M11 `focus()` without `preventScroll` | "focuses the heading, without scrolling..." |
| M12 only the first navigation focuses | same test |

Added files (all new): `cms-workflow-focus.test-support.ts` (deferred reads, hanging/lost/answering fetchers, `focusOn`, `openDetails`),
`cms-workflow-focus-harness.test-support.tsx` (one row per command form), `cms-workflow-island-mount.test-support.tsx` (shared island
mounts; `CmsEditorialWorkflowIsland.test.tsx` and `CmsEditorialReviewDetailIsland.test.tsx` now import it instead of each defining
`mount`/`ok`/`formTitles`, no assertion or title changed), and the test files below.

New test titles (none replaces an existing title):

- `cms-workflow-focus-forms.test.tsx`: for each of Submit for review, Record your decision, Schedule publication, Create a preview,
  Confirm publication, Assign a reviewer, Revoke an assignment (21 tests): `[P2-S11-AC-037|040|043|072] <form> keeps focus on the
  activated control while its command is in flight` / `... keeps focus through an unknown outcome and a reconciling read that is not
  verified` / `... moves focus only to its named result heading once the canonical read has landed`.
- `CmsEditorialWorkflowIsland.focus.test.tsx`: `[P2-S11-AC-054] keeps focus where the person put it through a reconciling refetch,
  verified and then degraded`; `[P2-S11-AC-037] keeps focus on the refusal alert while the refetch it triggered lands`; `[P2-S11-AC-037]
  keeps focus on the activated control until the read lands, then moves it to the review heading only`; `[P2-S11-AC-043] leaves focus
  where the person moved it after the preview token took it, through the refetch`; `[P2-S11-AC-043] keeps focus on Confirm publish
  until the read lands, then moves it to the publications heading only`; `[P2-S11-AC-040] keeps focus on Schedule until the read lands,
  then moves it to the schedules heading only`.
- `CmsEditorialReviewDetailIsland.focus.test.tsx`: `[P2-S11-AC-072] returns focus to the assignments heading after an assign commits and
  the review is refetched`; `... after a revoke commits ...`; `[P2-S11-AC-037] keeps focus on Record approval until the read lands, then
  moves it to the decisions heading only`; `[P2-S11-AC-060] keeps focus where the person put it through a reconciling refetch, verified
  and then degraded` (this is the AC-054 test the ledger asked for on `CmsEditorialReviewDetailIsland`).
- `CmsEditorialScheduleForm.focus.test.tsx`: `[P2-S11-AC-040] keeps focus on the control the person is in while the zone data loads and
  the resolution changes`; `[P2-S11-AC-040] moves focus to the local-error summary only on a refused submit, and typing afterwards does
  not pull it back`.
- `apps/web/src/lib/route-heading-focus-install.test.ts` (8 tests, `[P2-S11-AC-060]`): first load leaves focus alone; focus with
  `preventScroll` on every later navigation; fragment read at navigation time; no heading is a no-op; per-document first-load
  isolation; module wiring on the real document (first load kept, later navigation focuses); ordinary initial load never focuses, with or
  without a fragment; `?tab=`/`?selected=`/commit mark focus once.

Note for the ledger: `installRouteHeadingFocus` is not untested "anywhere": the Phase 1 contract test
`tests/accessibility/route-heading-focus.test.ts` covers first load / fragment / navigation with a fake document (I ran it green). My
file adds real-DOM focus, `preventScroll`, per-document isolation and import-time wiring.

Observations, not changed: `onCommitted` runs `refetch().then(() => onDone(heading))`, so `onDone` also fires when the refetch is
degraded/gone/signed-out (focus then moves to a heading of the stale panel, or no-ops when the data is gone). FE03 does not say which is
right; I did not pin either, and the AC-054 test uses the reconcile path, which never calls `onDone`.

## Item 2 - SQL finding 12: author sees an invalid Publish option/default

RED (`04-schedule-choices-RED.log`, 5 failed / 4 passed), all for the right reason:
- `withholds Publish from an author...`: `expected [ 'publish', 'unpublish', ... ] to deeply equal [ 'unpublish', 'expire', 'archive' ]`
- `schedules the default non-publish action for an author without touching the select`: body still `action: 'publish'`
- `leaves a Publish choice behind when a refetch withdraws the permission`, `does not restore a stored Publish choice...` (restored
  `publish` stays), island `keeps the schedule form for an author whose permittedNextActions has schedule but not publish` (same
  four-option list).

Fix: new `cms-workflow-schedule-actions.ts` (`scheduleActionChoices(publishPermitted)`, `effectiveScheduleAction`); the schedule form
takes a required `publishPermitted: boolean`, offers `unpublish/expire/archive` (default `unpublish`, the first) when false, adds the
fixed hint `SCHEDULE_PUBLISH_WITHHELD_COPY` (in `cms-workflow-labels.ts`) on the Action select, and replaces any typed, stored
(step-up draft) or earlier `publish` with the default. The island passes `publishPermitted={permitted.has('publish')}`, the workflow
read's hint, and keeps the schedule form for an author. GREEN (`05-schedule-choices-GREEN.log`): 3 files, 29 tests; the full lane is green.

Tests: `CmsEditorialScheduleForm.choices.test.tsx` (9, titles `[P2-S11-AC-040] ...`), `cms-workflow-schedule-actions.test.ts` (5).
Existing `CmsEditorialScheduleForm.test.tsx`: one prop added to its `mount` (`publishPermitted`); no title or assertion changed.

Spec reconciliation: satisfies BE03b:268-270 (and BE03b:195, E11: only the human who schedules a `publish` is barred) and
`cms_publication_target` (`p_action = 'publish' and author = person` -> `separation_of_duties`). **FE03:1097 conflicts**: its
precondition for CMS-03B-07 reads "CMS publisher in the entry's owner party who is not the revision author", a blanket exclusion; per
BE03b it should read "... and, for action `publish`, not the revision author". Not edited, per instruction. FE03's other
`separation_of_duties` mentions (1043, 1105, 2578-2579) are consistent.

## Item 3 - AC-106 part (b): three-segment zones

`cms-workflow-schedule-resolution.test.ts` gains `three-segment IANA zones` (4 tests): `resolve('2026-12-01T09:00',
'America/Argentina/Buenos_Aires')` = `2026-12-01T12:00:00Z`, offset -10800, `UTC-03:00`; spring-forward gap and fall-back fold of
`America/Indiana/Knox` (alternatives asserted); suggestions include three-segment names and a fourth segment is `unknown_timezone`.
`CmsEditorialScheduleForm.choices.test.tsx` adds `[P2-S11-AC-106] resolves, shows and sends America/Argentina/Buenos_Aires`. These pass
on the existing resolver (no defect); part (a), bundle budget, is not touched.

## Other file touched

`apps/web/src/components/cms-editorial-workflow/README.md`: documents the focus rules and the schedule-action rule.

## Open items

1. FE03:1097 wording (above) needs the owner/spec lane.
2. pgTAP gap the new FE depends on: no database test asserts that an owner-party publisher who is the revision author gets
   `permittedNextActions = ["schedule"]` (no `publish`) from `cms_get_editorial_review` / `cms_get_entry_workflow`
   (`supabase/tests/phase_02_slice_11_rpc_reads_review.sql:186-194` covers only the non-author publisher). Not my files.
3. AC-060 part (2): source assertions that `reviews/[reviewId].astro` and the queue page use the shell that includes
   `route-heading-focus.ts` belong in `review-detail-route.test.tsx` / `review-queue-route.test.tsx` (outside my ownership).
4. `CmsEditorialScheduleForm.tsx` is 308 lines (limit 200; was 291 before this lane). Splitting it is a separate change.
5. The `workflow-route.test.tsx` path has regex brackets: use the basename filter (`workflow-route.test`) to run it.
