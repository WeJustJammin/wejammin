# Lane brief — `claude_s12_web_related_f2` (related-content minors after the CLEAR re-review)

Re-review `review-web-related-f1.md` (CLEAR, SHA `8896fade…`). RED first:
1. Unknown outcome parity: a transport loss or relayed 5xx (≥500) on CMS-03C-05 is marked unknown outcome as in
   `apps/web/src/server/cms-taxonomy-platform-write.ts:114-126` (FE03 :1174 "reconcile status first", BE00 :172).
2. Split the related proxy test file (541 lines) under the 400-line cap; counts before = after.
3. The proxy relays 400 and untyped-422 violations exactly as the Worker relay does (or document precisely why not).
4. Read-only page: a failed entry-list read must not turn the read-only page into an error page; render the entry
   facts and the boundary copy with the candidate area in its degraded state.
5. Correct the citations/wordings named in the review ("BE03c 1323: at most 16", "BE03c 1502", "CMS-03B-15 carries no
   capability member").
Report: append `## Fix pass 2` to `lane-web-related-report.md`. Files: the lane's own files + the related proxy and
its tests. Gates: focused + full `apps/web` Vitest, `astro check`, eslint + prettier, mutation checks on scratch
copies under `<scratchpad>/claude_s12_web_related_f2/`; under `flock -s /tmp/wejammin-quiet.lock`.
