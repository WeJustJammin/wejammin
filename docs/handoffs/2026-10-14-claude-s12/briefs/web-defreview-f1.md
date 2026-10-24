# Lane brief — `claude_s12_web_definition_reviews` fix pass

Read `docs/handoffs/2026-10-14-claude-s12/review-web-definition-reviews.md` fully. Fix test-first:
1. Major 1: `CmsGovernedAssignmentRevoke.tsx` must not render actionable revoke controls unless the server
   permits (mirror the create/decision `permitted` guard) — add an island test with assignments present.
2. Major 2: `CmsGovernedReviewPanel` must show the review summary per FE03 :877 and, after reload, link to
   the review itself (FE03 :1066 "the panel links to the governed review"), not the owned queue.
3. Minors: governed proxies relay the Worker's `retryable` (502/503/504 `DEPENDENCY_UNAVAILABLE` retryable
   true, BE00 172); make the two vacuous leak assertions discriminating; fix "activate" copy and raw enum
   tokens in the queue per FE03 copy rules; resolve `act()` warnings; fold the duplicated static-closure test
   into `cms-island-static-closure.test.ts`.
Files: your existing claim. Coordinate with the pattern-designer lane's mount edits (read its report
`lane-web-patterns-report.md`; extend, never revert). Append `## Fix pass` to your report.
