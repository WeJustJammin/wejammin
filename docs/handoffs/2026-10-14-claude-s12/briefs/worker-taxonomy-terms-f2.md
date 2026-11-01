# Lane brief — `claude_s12_worker_taxonomy_terms_f2` (merge-convergence follow-ups + mutation re-run)

Review `review-worker-taxonomy-terms-f1.md` (VERDICT CLEAR, SHA `7b1df021…`) left minors; your first pass's
mutation results from 03:47-04:00 local are contaminated (another lane executed your mutation script twice from
the shared scratchpad). Report: append `## Fix pass 2` to `lane-worker-taxonomy-terms-report.md`.

1. m-f1: correct the comment `cms-taxonomy-merge-converge-names.ts:20-21` and runbook
   `docs/runbooks/platform/cms-taxonomy-merge-converge.md:71-72` to the true fact: only a later merge of the same
   acting party above 5,000 assignments requests a job (which drains all of the party's merged-term work); nothing
   guarantees one.
2. m-f2: BE00 550 ("15s, 60s, and 300s with bounded jitter") and BE03c 1302 ("with jitter"): add bounded jitter
   to the in-invocation pauses through an injectable random seam, test-first (assert the range; worst case with
   upper edges stays under the 200 s heartbeat point and the 240 s budget). Pick the jitter bound from BE00 if it
   states one; if it does not, use +0-10 % and record it as an implementation decision with the reason.
3. n-f1: dispatcher-guard failures (effect not wired, effect threw, `MERGE_CONVERGE_OUTCOME_UNMAPPED`,
   `production-job-effect-dispatcher.ts:181-192`) must emit the same `cms_taxonomy_merge_converge.settled` log
   event and `outcome="failed"` metric as the effect's own failures, so the runbook alert sees them. RED first.
4. BE03c now registers the eight codes (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`,
   "Merge convergence Job disposition"). Extend the runbook sync test so the BE03c table, the runbook table and
   `TAXONOMY_MERGE_JOB_ERROR` must agree (parse the BE03c errorCode column); the runbook should cite the BE03c
   section as the registry.
5. Re-run your full mutation battery from a scratch directory that only you use
   (`<scratchpad>/claude_s12_worker_taxonomy_terms_f2/`), on copies, restoring and SHA-verifying every file;
   record each mutant and the killing test.
6. m-f3 (report only): state that P2-S12-AC-226 ("re-points every active TermAssignment") depends on the
   recovery BOUNDARY, and list "open a tracking issue for the recovery BOUNDARY" as a numbered request to root.

## Files
`apps/worker/src/cms-taxonomy-merge-converge-*.ts` (+tests), `apps/worker/src/production-job-effect-dispatcher.ts`
(+test, guard telemetry only), `cms-taxonomy-merge-converge-runbook.test.ts`,
`docs/runbooks/platform/cms-taxonomy-merge-converge.md`, your report. NOT `taxonomy-safe-details.ts` or
`taxonomy-term-details.test.ts` (lane hardening-4), NOT shared wiring files (Worker pattern-updates lane), no
spec edits, no SQL, no contracts.

## Gates
Focused Vitest RED→GREEN; full `apps/worker` Vitest; worker `tsc --noEmit`; eslint `--max-warnings=0` + prettier
on touched files. All under `flock -s /tmp/wejammin-quiet.lock`.
