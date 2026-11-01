# Lane brief — `claude_s12_web_patterns` fix pass

Read `docs/handoffs/2026-10-14-claude-s12/review-web-patterns.md` fully. Fix test-first:
1. Major 1: after a conflict, show a "Review changes" comparison of the newer version (tree and
   `compatibleTypeIds`) beside the user's draft before "Keep my edits" (FE03 :1216; mirror the template
   designer's review-changes view).
2. Major 2: a successor whose read version names a content type that is no longer active must still be
   saveable: render the stale type so it can be removed (with an explanation), and make the reload message
   actionable. Fix the SAME defect in the template designer (`apps/web/src/components/cms-composition/CmsTemplate*.tsx`
   and its helpers), test-first there too.
3. Minors: reconcile an unknown outcome against the server (latest read) before any retry so a committed
   create is not duplicated; check the conflict compares the same pattern lineage; import `isCmsVersion`
   (browser-safe) from contracts instead of four copies; make the node-key/block-key grammar and JSON-size
   drift guards exhaustive; correct the report's edit-mode data claim and line counts; commit the mutation
   script used for the battery (or drop the claim).
Files: your existing claim plus the template designer components/helpers and their tests. Do not touch
`apps/web/src/components/cms-governed-review/**` (another lane). Append `## Fix pass` to your report.
