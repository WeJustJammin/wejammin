# Lane brief — `claude_s12_worker_hygiene_1` (test-quality follow-ups from two CLEAR reviews)

Test-only or comment-only unless stated. Each new assertion must be shown able to fail (mutate a scratch copy under
`<scratchpad>/claude_s12_worker_hygiene_1/`, never the worktree; save the mutant outputs). Report
`docs/handoffs/2026-10-14-claude-s12/lane-worker-hygiene-1-report.md`.

From `review-worker-pattern-updates.md` (CLEAR, SHA `923d5c76…`):
1. F1: the CMS-03C-15 pointer allowlist `UPDATE_POINTER` test uses `toMatchObject({details: {}})`; assert the exact
   relayed details so an out-of-grammar 422 pointer is dropped (mutant: widen the allowlist → test fails).
2. F2: the "version pair only" 409 test must start from a payload that HAS `instanceId` (and other extra members)
   and assert they are stripped.
3. F3: test the RPC layer's narrowing of its deadline to the registry deadline (independently of the route's own
   deadline).
4. F4: `it.each` titles that print "is NaN": give them real titles.
5. F5: the pattern-update context verifier duplicates the pattern-definition verifier: extract a shared helper ONLY
   if it is a pure refactor with identical behaviour and all tests unchanged; otherwise record why not.
From `review-worker-taxonomy-terms-f2.md` (CLEAR, SHA `b7e96037…`):
6. m-f2a: test that, in production composition (no injected logger), a dispatcher-guard failure logs through the
   Worker-environment logger (`production-job-effect-dispatcher.ts` ~:198 `context?.env`); mutant dropping
   `context?.env` must fail.
7. Nits: "only a later merge" wording also names a still-running chain of the same acting party (comment
   `cms-taxonomy-merge-converge-names.ts` + runbook + its pinned wording test); AC-226 citation → current tracker
   line; mark the f1 n-f2 carry-over in `lane-worker-taxonomy-terms-report.md` as superseded.
Files: the pattern-update Worker test files and `pattern-update-*.ts` only for F5, the dispatcher test files,
`cms-taxonomy-merge-converge-names.ts`, the runbook, the two reports' carry-over lines. NOT `taxonomy-term-details.ts`
or `taxonomy-safe-details.ts` (hardening-5 is active), NOT `governed-review-*` (DEC-191 phase 2), NOT capability /
template / locale / related files (hardening-5), no SQL/contracts/Web. Gates: focused + full `apps/worker` Vitest,
worker `tsc --noEmit`, eslint `--max-warnings=0` + prettier on touched files, under `flock -s /tmp/wejammin-quiet.lock`.
