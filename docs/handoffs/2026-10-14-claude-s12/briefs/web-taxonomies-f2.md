# Lane brief — `claude_s12_web_taxonomies_f2` (Web taxonomies fix pass 2)

Re-review `review-web-taxonomies-f1.md` (VERDICT PARTIAL, SHA `c71f2c23…`): the BLOCK is lifted; fix these, RED first:
1. MAJOR: "Load more terms" (and "Try again") drop keyboard focus to `<body>` because the button is removed while
   loading (WCAG 2.4.3, FE03 :898). Keep focus on a stable control (or move it to the first newly loaded option)
   on every page, not only the last; test over 3+ pages and the failure/"Try again" path with
   `document.activeElement` assertions.
2. MINOR: a survivor chosen from a loaded page must not silently disappear after a 409 cursor restart: keep the
   chosen survivor visible (or clear the choice and announce it); the merge confirm sentence "Merge X into Y" must
   always match the hidden value; test.
3. Nits: fix the comment and README that name the pre-split test file; the 503/429 tests assert typed input
   survives; define the retry delay constant once (note: `apps/web/src/lib/safe-read-retry.ts` was extended by the
   Web polish A lane at 13:03Z: re-read it and do not change its behaviour; import its constant).
Report: append `## Fix pass 2` to `lane-web-taxonomies-report.md`. Files: the lane's own `cms-taxonomy-*` files and
tests and READMEs only. Gates: focused + full `apps/web` Vitest, `astro check`, eslint `--max-warnings=0` + prettier;
mutation checks on scratch copies under `<scratchpad>/claude_s12_web_taxonomies_f2/`; under `flock -s /tmp/wejammin-quiet.lock`.
