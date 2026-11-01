# Slice 11 lane "e2e" report (2026-10-11, final)

Status: FINAL. One full `pnpm test:e2e` on a quiet host: **269 passed, 0 failed** (functional 121, real-route 148), exit 0.

Tree under test: HEAD `a3ee65ba` plus this lane's files (`c1-tree-state.txt`, sha256 of every owned file). HEAD has since moved to `53a735db`
(two docs files, no code). Runs came from a snapshot of the COMMITTED tree plus the lane's files, not from the worktree: the finisher lane had
uncommitted worker, contract and pgTAP edits in the worktree while the suites ran. All logs: `docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs/`
(`a1-*`, `b1-*`, `c1-*`, `d1-*` are this resume; unprefixed `win1-*`, `full-e2e-*`, `red-isolation-1.log` etc. are the earlier loaded-host attempt).
Scripts: `e2e-snapshot.sh` (HEAD export + owned files), `e2e-window.sh` (parts: units, s10red, rrred, probe, rrflake, fixed, targeted, full), run as
`flock -s /tmp/wejammin-quiet.lock lane-e2e.sh <snapshot> bash e2e-window.sh <tag> <parts>` (lane-e2e.sh holds the CI lock and resets the stack to the
snapshot's migrations first).

## Files changed (all test-side; no production code, SQL, migration or Slice 12 file)

- `tests/e2e/phase-02-slice-10-entry-list-real-route.spec.ts` (finding 1)
- `tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts` (findings 2 and 3; 329 lines)
- `tests/e2e/support/s11-status-recorder.ts` (new, 75 lines; findings 2 and 3)
- `tests/e2e/support/s11-real-world.ts` (finding 4: `grantDays`, default `S11_GRANT_DAYS` = 30)
- `tests/e2e/support/s11-dst-gap.ts` + `s11-dst-gap.test.ts` (new; finding 4)
- `tests/e2e/support/README.md` (documents the three new support pieces)
- `apps/worker/src/cms-editorial/a11y-structural/max-input.test.ts`: the previous agent's edit is REVERTED; the file is byte-identical to HEAD (finding 5).
- Lane scripts and logs under `docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs/`, plus this report.

No test title changed, so no evidence-ledger citation moves (S10 four tests, S11 `[S11-RR-05/06/07/09/18/PROBE]` keep their titles).

## Host state during the runs

Canonical gates absent (none held `/tmp/wejammin-quiet.lock` exclusively). Each part waited for a 1-minute load average below 1.5 (`[wait_quiet]`
lines). Full run: load 1.28 at start, 1.66 at end; vmstat over 123 samples: 77% idle, 15.7% user, 6.3% system, mean 1.9 runnable (`d1-vmstat.log`).
Other lanes took shared quiet locks (the finisher's API run held the CI lock until 23:00, so the full run started 23:00:52 after waiting 32 minutes).
The loaded-host history for contrast: the earlier failing runs were at load 4 to 8 (`units-final-1.log`, `win1-targeted.log`).

## Finding 1: S10 entry list, three tests (consistent, test defect)

Root cause: since Slice 11 each list row carries two links, the entry link ("Entry {id}") and "Review and publish" (`CmsEditorialEntryList.tsx`). The spec's
`listedEntryIds` read every `main ul > li > a`, so each row contributed a second entry named "Review and publish".

- RED `a1-s10red.log` (committed spec, quiet): 3 failed, 1 passed. `Expected length: 1, Received length: 2 ["…","Review and publish"]` (paginates, line 76); the
  same extra "Review and publish" x2 (typed filters, `toEqual`, line 110) and x1 (conceals other authors, line 227).
- Fix: `listedEntryIds` filters links to `{ hasText: /^Entry / }` (6 lines with a doc comment).
- GREEN: `a1-fixed.log` (S10 x3 repeats, 12/12), `c1-targeted.log`, `d1-full.log` (4/4 each).

## Finding 2: S11-RR-06 step-up decision (race in the test, not a product defect)

Root cause (measured, `b1-probe-browser.txt`, 5 attempts): after the decision POST commits, the form shows "Decision recorded." and then FE03 refetches the
review (Slice 11 states table: "the form clears its draft and the workflow, review and queue are refetched"). The review is no longer open, `record_decision`
leaves `permittedNextActions`, and the decision form with its status line is removed. "Decision recorded." is on the page **20 to 25 ms** (it appears at +63..+68 ms
after the click and leaves at +84..+93 ms). `await expect(getByText('Decision recorded.')).toBeVisible()` is a poll, so it passes only when a poll lands in that window.
It therefore depends on host speed: the committed spec failed 4 of 5 on this quiet host (`a1-rrred.log`, `Locator: getByText('Decision recorded.')`, 15 s timeout), failed
in the 2026-10-11 full runs (`.lane-logs/claude-validate-diag-20261011-102312/test-e2e.log`, 3 of 3) and passed 3 of 3 on a loaded host where the refetch was slower
(`win1-red-rr06.log`).

- Fix: `s11-status-recorder.ts` installs a MutationObserver that records every `[data-cms-workflow-status]` text from the click on, and the spec asserts the
  confirmation WAS announced (`expectStatusAnnounced`) and then asserts the canonical page that replaced it (`State: Approved`, `Your decision: approve`, and the API read).
  Neither assertion depends on timing. Nothing was weakened: the old assertion only checked a text that was already gone in the passing case.
- GREEN: RR-06 10/10 (`c1-rrflake.log`), 9/9 with the recorder alone (`b1-rrflake.log`), 3/3 in `a1-fixed.log`, then `c1-targeted.log` and `d1-full.log`.

## Finding 3: the same race in RR-05, RR-07 and RR-09 (found by the quiet re-runs)

The probe measured the confirmation lifetime of the other three command forms: RR-05 "Review submitted. It is open for decisions." 31 to 35 ms; RR-09 "Publication recorded as
version 1. …" 33 to 38 ms; RR-07 "Scheduled, not published: …" 33 to 34 ms. Each is removed or replaced by the canonical read. Observed failures of the old visibility check on a
quiet host: RR-09 1 of 13 (`a1-targeted.log`, `getByText('/^Publication recorded as version/u')`, the page snapshot shows the publication already listed; the other 12 passed in `a1-fixed.log` and `b1-rrflake.log`),
RR-05 1 of 10 (`b1-rrflake.log`, `getByText('Review submitted. It is open for decisions.')`); RR-07 0 of 12 on this resume (the same 33 ms window, passed by luck of polling).

- Fix: the same recorder in all three. RR-05 then asserts the Review region reads "Open. Risk class:"; RR-09 asserts the announced text says the publication is "not confirmed
  visible to readers", the Publications region says it too, and neither the main text nor any recorded status claims "now live|is live|publicly visible"; RR-07 asserts the Schedules
  region reads "Scheduled, not published". (The old RR-09 check read the page text right after the transient appeared; it now waits for the canonical region.)
- GREEN `c1-rrflake.log`: RR-05, RR-06, RR-07, RR-09 each 10/10 (40 passed, 1.6 min, tree = final).

## Finding 4: S11-RR-07 schedule (consistent, test defect)

Root cause: the publisher's grant ran 30 days (`current_date + 30`) and the spec scheduled 2027-03-15. A schedule is refused when the publisher's grant ends before the day it takes
effect. The page said so: "Your publisher access ends before this time. Choose an earlier time." (`b1-probe-browser.txt`, `PROBE-RR-07 status/alert texts`). RED `a1-rrred.log` (committed
spec): `getByText('/^Scheduled, not published:/u')` not found. The hard-coded date is also fragile: it is valid only while it lies 60 s to 366 days ahead (CMS-03B-07).

- Fix: `provisionMember(world, label, caps, grantDays = 30)` and the publisher holds 400 days (longer than the 366 day horizon); `nextSpringForwardGap(now)` (`s11-dst-gap.ts`) reads the
  host's tz data (Intl) and returns the next real gap in America/New_York or Australia/Sydney between 36 h and 330 d ahead, with a nonexistent wall time to type and a valid one to
  schedule. 5 unit tests (`s11-dst-gap.test.ts`, 5/5 in `c1-units-other.log`) pin it: the March 2027 New York gap from October 2026, the 36 h lead, the Sydney fallback when New York's next gap
  is 371 days away, a weekly six-year sweep that always lands in 36 h..330 d, and a refusal (no guess) when the zone list has no gap.
- GREEN: RR-07 10/10 (`c1-rrflake.log`), then `c1-targeted.log`, `d1-full.log`. The status reads "…at 2027-03-14T14:00:00Z" (10:00 EDT after the gap).

## Quiet re-runs of the intermittent specs (task 2): no failure, no code change

| Spec file | `a1-targeted` (quiet) | `c1-targeted` (quiet) | `d1-full` (quiet) |
| --- | --- | --- | --- |
| `phase-02-slice-09-web-vitals-real-route` (6: registry, schema-review, grants; mobile and desktop) | 6/6 | 6/6 | 6/6 |
| `phase-02-slice-09-capability-grants-real-route` (grants layout) | 22/22 | 22/22 | 22/22 |
| `phase-02-slice-09-review-layout-real-route` | 3/3 | 3/3 | 3/3 |
| `phase-02-slice-09-registry-layout-real-route` | 10/10 | 10/10 | 10/10 |
| `phase-02-slice-12-locale-real-route` | 1/1 | 1/1 | 1/1 |

The earlier failures (web-vitals desktop long-task and Event Timing budgets, registry-layout, grants layout, review layout, locale) all came from runs at load 4 to 8 with other lanes
active (`win1-targeted.log` at load 5.0, `intermittent-isolation-1.log`, the full runs of 2026-10-11). They are host-load flakes of timing budgets, not defects; the budgets stay as they are.

## Finding 5: max-input unit test (task 3): no defect, no change

Quiet re-run, 5 rounds each of HEAD's copy (`a1-units-maxinput-committed-*.log`) and the previous agent's edited copy (`a1-units-maxinput-lane-*.log`), then 5 rounds of the final file (`c1-units-maxinput-lane-*.log`):
all pass; the test takes 159 to 184 ms (237 ms once, round 1 of the last set) against the 2,000 ms budget. The probe splits the maximum gate (12,288 nodes, 4,069,568 JSON bytes): JSON parse 12 to 17 ms, zod 16 to 44 ms,
checker 44 to 96 ms, `gate.durationMs` 76 to 100 ms in 8 rounds (`b1-probe-max-input.txt`): roughly 20x headroom. The failures the earlier agent saw (gate 2.0 to 2.5 s) were at load 4.2 to 7.6 (`units-final-1.log`).
The previous agent's edit (build the JSON text before the gate opens its budget) changed nothing measurable on a quiet host (159 to 178 ms with it, 159 to 184 ms without) so it was reverted; `git diff` of the file is empty.
Bound derivation re-checked against the specs, not just the report: fields 0 to 128 (BE03a CMS-03A-01), object properties 0 to 32 (CMS-03A-01/02, DEC-133), template slots at most 64 (BE03c CMS-03C-01),
`maxCount` 1 to 128 (BE03c schema): 128 x 32 + 64 x 128 = 12,288 = `ACCESSIBILITY_NODES_MAX`. (Line numbers quoted in the integration report have drifted; the values hold.) The test is a 2,000 ms timing test and is valid
only on a quiet host, like the other budget suites.

## Full run (task 4): `d1-full.log`

`pnpm test:e2e` = `playwright test` (functional project, 1 worker) 121 passed in 1.7 min, then `run-s09-real-suite.mjs` (real-route-chrome) 148 passed in 8.5 min. 0 failed, 0 skipped, 0 flaky,
no "rerunning the complete real-route suite" retry. Exit 0, 23:00:52 to 23:11:06. Unit/static: `c1-units-other.log` 11 passed (6 sweep-deadline + 5 DST-gap); `static-checks-2.log` prettier and eslint
`--max-warnings=0` clean on every owned file (exit 0).

## Test titles

None changed or added to the Playwright suites. New vitest titles (`s11-dst-gap.test.ts`, describe `nextSpringForwardGap`): "finds the New York gap of March 2027 from October 2026", "skips a gap closer than 36 hours so the later
valid time stays in the future", "falls back to the Sydney gap when the next New York gap is beyond 330 days", "always yields a gap inside the schedule horizon, sampled weekly over six years", "refuses a zone list that has no gap
in the window instead of guessing".

## Spec lines satisfied

FE03 Slice 11 states table, `commandState` success (form clears, workflow/review/queue refetched; the specs now assert both the announcement and the refetched state); CMS-03B-07 (schedule 60 s to 366 days,
authority must outlast the effective day); AC-037 (focus moves to the decisions heading only after the read lands; unchanged, covered by its unit test).

## Open items

1. Product observation for the FE lane (not changed here): the polite status line that confirms a decision, submit, publish or schedule lives inside the form that the canonical read then removes, so it exists for
   20 to 40 ms on a quiet host. Whether assistive technology announces a live region that is inserted and removed within a frame is not guaranteed; focus does move to the section heading (AC-037), which carries the new state.
   If FE wants the confirmation to persist, that is a component change with its own RED test; the e2e specs would then still pass (they assert "announced" and the canonical page).
2. Memory candidates for the orchestrator (nothing written here): PAT, a visibility assertion on a transient confirmation is a race against the canonical refetch; record, then assert the page that replaced it.
   PAT, a verification snapshot is the committed tree plus the lane's files, never an rsync of a worktree other lanes are editing.
3. `/home/rob/.codex/worktrees/phase2-slice11/lane-e2e-snap` (1.9 GB, outside the repo) can be deleted once this is integrated. Older loaded-host logs in `lane-e2e-logs/` are kept as the history of the flakes.
4. The orchestrator's canonical gate should keep holding the quiet lock exclusively: three budget suites (max-input, web-vitals, Event Timing) are only meaningful on a quiet host.
