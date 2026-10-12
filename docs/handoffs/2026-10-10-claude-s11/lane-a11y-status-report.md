# Slice 11 lane "a11y-status" report (2026-10-11)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. Started at HEAD `1e2f03be`; HEAD read `c1541794` at
the end (moved by the orchestrator; nothing of this lane is committed). No git write command was run. Logs: `docs/handoffs/2026-10-10-claude-s11/lane-a11y-status-logs/`.
Every heavy command ran under `flock -s /tmp/wejammin-quiet.lock`; browser runs went through `lane-e2e.sh` (CI lock, reset to the snapshot's migrations).

## Defect

After a command succeeds, the form's polite confirmation ("Decision recorded." etc.) lived in `CmsWorkflowCommandFrame`'s own `role="status"` line. The
canonical refetch that follows removes the form (the decision, submit, publish and schedule forms leave `permittedNextActions`), so the line existed for
20 to 40 ms. FE03 CMS-08/09/13 rows require "announce status", "focus ... named result heading", "server after success".

## Fix (product)

The island owns one persistent polite atomic status line (`<p role="status" aria-live="polite" aria-atomic="true" data-cms-workflow-status="island">`),
rendered under the "Actions" heading, mounted empty with the island (registered before the first message), outside every form.

- A committed form hands its sentence to the island line (effect in `useCommittedAnnouncement`) and its own line stays empty: exactly one live region
  says it (no duplicate). A form mounted alone (no island) keeps its own line, unchanged.
- The sentence stays through the refetch and through the form's removal. It is withdrawn when any form in the island starts its next command (phase
  `pending`), or when the form that produced it starts over (`startOver`: "Hide token and create another", "Assign another reviewer"; owner-scoped, so
  it never clears a later form's sentence), or on navigation (island unmount). Unmounting the producing form does NOT withdraw it.
- Unchanged: focus (the line never takes it; `onDone` still focuses the named heading after the read; refetch never moves it), retain-input, step-up
  restore, unknown-outcome reconcile-then-retry (nothing reaches the island line until a retry commits), refusal alert. When the island ends (session
  over, record gone) the line goes with the protected data (`CmsWorkflowClosedState`).
- Component sizes: `CmsWorkflowCommandFrame` was 253 lines; I moved its alert block into `CmsWorkflowRefusalAlert` (pure extraction, same focus
  effect) so it is now 186. Islands 156 and 112, new components 28 and 100, hook module 78.

## Files

Changed (production): `apps/web/src/components/cms-editorial-workflow/` `CmsWorkflowCommandFrame.tsx`, `CmsEditorialWorkflowIsland.tsx`, `CmsEditorialReviewDetailIsland.tsx`.
New (production): `use-cms-workflow-status.ts` (context, `useIslandConfirmation`, `useCommittedAnnouncement`), `CmsWorkflowStatusRegion.tsx`, `CmsWorkflowRefusalAlert.tsx`.
New (tests): `CmsEditorialReviewDetailIsland.status.test.tsx` (314), `CmsEditorialWorkflowIsland.status.test.tsx` (276), `use-cms-workflow-status.test.tsx` (158), `cms-workflow-status.test-support.ts` (35).
Changed (tests): `CmsEditorialWorkflowIsland.focus.test.tsx` (two assertions, below), `tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts` (plain assertions, below).
Docs: `apps/web/src/components/cms-editorial-workflow/README.md` (module map, new "Confirmations" section).
Lane scripts/logs: `lane-a11y-status-logs/` (`a11y-snapshot.sh`, logs 00 to 14, `M-*` mutation logs, snapshot tree-state files). The snapshot copy outside the repo was deleted.
No SQL, worker, contract, recorder or ledger file touched.

## RED (before any production edit)

`01-RED.log`: the two new island files, 13 tests, 10 failed. The defect itself:
`CmsEditorialReviewDetailIsland.status.test.tsx:179` `[P2-S11-AC-037] still reads "Decision recorded." after the refetch removed the decision form, announced once`
`AssertionError: expected [] to have a length of 1 but got +0` (no status region reads the confirmation after the refetch landed and the form was gone).
Also failing for the right reason: no persistent line exists before any command; the confirmation is in the form (not in a surviving region) while the refetch is in flight;
the assign/revoke, submit, publish, schedule and preview confirmations are likewise absent after the refetch or duplicated in the form.
Browser RED (`08-e2e-RED.log`, snapshot = HEAD product + new spec, `snapshot-red-tree-state.txt`): `[S11-RR-05]` fails at the plain assertion
`Locator: [data-cms-workflow-status="island"] ... Expected: "Review submitted. It is open for decisions." ... element(s) not found` (the recorder assertion before it passes:
the text was announced, then gone); RR-06/07/09 did not run (serial describe).

## GREEN

- `02-status-first-run.log`: the 13 new island tests pass on the first run after the fix.
- `03-dir-after-fix-before-test-updates.log`: the directory run showed exactly two old assertions pinning the old location (below), nothing else.
- Final `13-final-dir-and-routes-GREEN.log`: `apps/web/src/components/cms-editorial-workflow` + `apps/web/src/pages/app/cms-content-modeling` = 47 files, 435 tests, all passed
  (baseline of the directory before the lane `00-baseline.log` 35 files / 369 tests; the directory now is 38 files / 388 tests: +3 files, +19 tests; the pages add 9 files / 47 tests).
- `06-tsc-web.log` `tsc -p apps/web/tsconfig.json --noEmit` exit 0; `07-eslint.log` eslint `--max-warnings=0` on the directory and the spec exit 0; prettier `--check` clean.
- Browser, snapshot = HEAD `1e2f03be` + this lane's files (`snapshot-green-tree-state.txt`, sha256 identical to the worktree):
  `09-e2e-GREEN.log` whole `phase-02-slice-11-workflow-real-route.spec.ts`: 6 passed (22 s), exit 0. The recorder assertions (`expectStatusAnnounced`) still pass in RR-05/06/07/09.
  `11-e2e-GREEN-repeat10-second.log` RR-05/06/07/09 x10: 40 passed (1.5 min).
  `10-e2e-GREEN-repeat10.log` (same command, first attempt): 36 passed, then the launcher's web Worker died (`[WebServer] ✘ [ERROR]` ... `S09 web server exited before teardown (code=1)`, restarting 1/20;
  wrangler `ProxyController.emitErrorEvent`, `/home/rob/.wrangler/logs/wrangler-2026-10-12_03-28-50_203.log`) while RR-05 round 10 was clicking, so that click hit a dead server and the recorder timed out;
  its page snapshot shows "Review: Not submitted". The remaining 3 tests did not run (serial). It is a miniflare/wrangler crash, not a product or spec assertion, and did not recur in the 40 + 6 other executions; reported, not hidden.

### Mutation evidence (each applied to production code, run, reverted; `M-*.log`)

M1 frame also keeps the sentence (duplicate live regions): 7 tests fail. M2 a new command does not withdraw: 2 fail. M3 unmounting the producing form withdraws (the original defect re-created): 8 fail.
M4 starting over does not withdraw: 3 fail. M5 start-over withdraws another form's sentence: 1 fails. Production files verified identical to the originals afterwards.

## Test titles

New, describe `CmsEditorialReviewDetailIsland confirmation` (7): "[P2-S11-AC-037] keeps one polite status line mounted outside every form before any command"; "[P2-S11-AC-037] still reads \"Decision recorded.\" after the refetch removed the decision form, announced once"
(also asserts the line was written once, by MutationObserver, and the refetch rewrote nothing); "[P2-S11-AC-037] keeps the confirmation in the island line while the refetch is in flight, not in the form as well";
"[P2-S11-AC-037] says nothing in the island line while the outcome is unknown, then confirms once after the retry commits"; "[P2-S11-AC-072] keeps \"Reviewer assigned\" through the refetch and replaces it when the next command begins";
"[P2-S11-AC-072] withdraws \"Reviewer assigned\" when the person starts another assignment"; "[P2-S11-AC-037] leaves the island line empty when a decision is refused".
New, describe `CmsEditorialWorkflowIsland confirmation` (6): "[P2-S11-AC-037] keeps one polite status line mounted outside every form before any command"; "[P2-S11-AC-037] still reads the submit confirmation after the refetch removed the submit form, announced once";
"[P2-S11-AC-043] still reads the publication confirmation after the refetch removed the publish form"; "[P2-S11-AC-040] still reads \"Scheduled, not published\" after the refetch removed the schedule form";
"[P2-S11-AC-043] confirms the preview once in the island line and withdraws it when the token is hidden"; "[P2-S11-AC-037] is removed with the protected data when the session ends or the record is gone".
New, describe `the island confirmation line` (6, `use-cms-workflow-status.test.tsx`): "takes the sentence of a committed form, which then stops saying it"; "keeps the sentence when the form that committed it is removed"; "withdraws the sentence when any form begins its next command";
"withdraws only its own sentence when a form starts over"; "writes the line once for one commit, however often the island re-renders"; "hands nothing over when the form is mounted alone".

Changed (titles unchanged, so no ledger citation moves; the old assertion pinned the confirmation inside the form's `<details>`, which the island line replaces):
- `CmsEditorialWorkflowIsland.focus.test.tsx` "[P2-S11-AC-043] keeps focus on Confirm publish until the read lands, then moves it to the publications heading only":
  old `expect(publishDetails.textContent).toContain('Publication recorded')` -> new `expect(islandStatus(container)?.textContent).toContain('Publication recorded')`.
- same file "[P2-S11-AC-040] keeps focus on Schedule until the read lands, then moves it to the schedules heading only":
  old `expect(scheduleDetails.textContent).toContain('Scheduled, not published')` -> new `expect(islandStatus(container)?.textContent).toContain('Scheduled, not published')`.
  (Every focus expectation in both tests is unchanged. The standalone-form tests that read `[data-cms-workflow-status]`, e.g. "schedule (CMS-03B-07) sends the resolved request and states Scheduled, not published", are unchanged and pass: a form without an island keeps its own line.)
- `tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts`: no title changed. Added `expectConfirmationStays` (the island line reads the confirmation, is `role=status`, `aria-live=polite`, `aria-atomic=true`, and no form's own line holds text) after the canonical-page
  assertions in `[S11-RR-05]`, `[S11-RR-06]` (also asserts the decision form heading is gone), `[S11-RR-09]`, `[S11-RR-07]`; the recorder assertions are kept; stale comments ("lasts only until the canonical read") updated.

## Spec lines satisfied

FE03 Interaction Specification rows `CMS-08 / CMS-03B-05`, `CMS-03B-06`, `CMS-03B-18` ("announce review state", "announce exact decision/state", "focus stays until named result heading", "server after success"), `CMS-09 / CMS-03B-07`, `CMS-13 / CMS-03B-08`, `CMS-03B-09`
("announce only canonical outcome" stays true: the text is the same fixed sentence, a 202 is still "recorded"/"scheduled", never "published"); FE03 Slice 11 states table `commandState` success (form clears its draft; workflow, review and queue refetched);
P2-S11-AC-037, AC-040, AC-043, AC-072 ("announce status"). `.claude/rules/specificity-standards.md` (testable): one named region, exact attributes, exact withdraw rules.

## Open items

1. Evidence ledgers (`tests/contracts/phase-02-slice-11-evidence-ledger-*.ts`) were not touched; the 19 new titles above can be cited for AC-037/040/043/072 "announce status".
2. `tests/e2e/support/s11-status-recorder.ts` header comment (and `tests/e2e/support/README.md`) still say the confirmation exists only until the refetch. The recorder still works unchanged (the island line has `data-cms-workflow-status`), but the text is now stale; it belongs to the e2e lane and I left it.
3. UX consequence to be aware of: the committed sentence now appears under the "Actions" heading (top of the actions section), not inside the form that sent it; the form's own line stays empty after a commit when under an island.
4. Memory candidates for the orchestrator (nothing written by this lane): PAT, a confirmation that must be announced belongs to a surface that outlives the canonical refetch, never to the component the refetch removes (and a test on it must assert it after the refetch, not while it is in flight);
   DEC, island-owned single confirmation line with owner-scoped withdraw (new command or producing form starting over), not withdraw-on-unmount.
5. The first 10x browser repeat was cut short by a wrangler web-server crash (see GREEN). If the canonical gate sees it, it is the launcher, not this change; the launcher already restarts the server up to 20 times.
