# Lane brief — `claude_s12_web_related_f1` (Web related-content fix pass; review VERDICT BLOCK)

Review `review-web-related.md` (SHA `4bad083d…`). Fix, RED first:
1. BLOCKER (root ruling): while the saved-rule read BOUNDARY (SG-S12-03) stands, the page must NOT save: render the
   form read-only with fixed copy that saving is unavailable until the current rule can be shown, no commit control
   enabled, no request ever sent (assert no fetch). Complete the boundary stub per `.claude/rules/boundary-not-placeholder.md`:
   a typed read seam (`readSavedRelatedRule(entryId): Promise<BoundaryResult>`) whose stub returns a structured
   boundary value (safe default = no write possible), the `BOUNDARY:` comment naming the missing spec ("BE03c author
   read of the saved RelatedContentRule"), `TRACKING:` "pending owner authorization to open a GitHub issue", and the
   sentinel test. The conflict "keep my choices" path is also unreachable while the boundary stands.
2. MAJOR: proxy 422 relay — `apps/web/src/server/cms-composition-platform-related.ts` `safeErrorDetails` must relay
   the CMS-03C-05 typed 422 (`related_target_ineligible`, `derived_rule_unknown` per the contract list) with its
   bounded pointers (`/pins/{n}`, `/exclusions/{n}`, ≤16), exactly as the Worker produces them (read the Worker
   related relay to match). Replace the proxy test that pins the defect (Test corrections, cite BE03c :385 and the
   contract list); add a composed proxy→form test so the offending row is marked from a real relay.
3. MAJOR: page-level 403 for a reader without edit authority (FE03 :1072, :1601). Investigate whether an EXISTING read
   proves edit authority before any write (e.g. CMS-03B-11 draft detail requires the editing assignment? CMS-03B-15
   `permittedNextActions`?) — cite BE03b lines. If one does, gate the page on it (403 page) with tests. If none does,
   record BOUNDARY SG-S12-04 (missing spec: an edit-capability signal for the related-content page) with the same
   stub discipline, and do not invent a read.
4. MAJOR: the candidate "Load more" read follows FE03 "Network and retry contract": reuse `retryingSafeRead` /
   `apps/web/src/lib/safe-read-retry.ts` (250/750 ms on retryable 502/503/504; 429 waits for `Retry-After`, announces
   the wait, preserves input); fake-timer tests.
5. Minors: candidate-list sign-in link returns to THIS page; a 201 the proxy cannot verify returns the unknown-outcome
   marker (precedent: other Slice 12 proxies) instead of a plain 502; align component props with FE03 :1473 or record
   why not. Correct the report's mutant counts (29 survivors, 22 re-runs).
FE03 :1601 "step-up gates the commits" conflicts with BE03c 216 (no step-up for CMS-03C-05): keep following BE03c;
root handles the FE03 wording. Files: the lane's own files + `apps/web/src/server/cms-composition-platform-related.ts`
and its tests + the entries page link only. Report: append `## Fix pass 1` to `lane-web-related-report.md`.
Gates: focused + full `apps/web` Vitest, `astro check`, eslint `--max-warnings=0` + prettier; mutation checks on
scratch copies where feasible (if in place, SHA-restore and record) under `<scratchpad>/claude_s12_web_related_f1/`;
under `flock -s /tmp/wejammin-quiet.lock`.
