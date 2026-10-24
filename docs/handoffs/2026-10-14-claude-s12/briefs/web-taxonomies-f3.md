# Lane brief — `claude_s12_web_taxonomies_f3` (Web taxonomies fix pass 3)

Review `review-web-taxonomies-f2.md` (VERDICT PARTIAL, SHA `f52cd0e3…`). Fix, RED first (use the reviewer's exact
assertions where the report gives them):
1. MAJOR: on `rename`, an unloaded current parent shows "No parent" while the request sends the parent id; choosing
   "No parent" then fires no change event, so a move to the top level is silently lost. Render a held option for the
   current value (labelled as the current parent, not yet loaded), replaced by the named option once a page brings
   it; no new read. Tests per the report, including the explicit "No parent" choice reaching the request.
2. MINOR: a survivor merged away is still offered after a 409 when the page is incomplete (older picker read wins):
   treat `merged` as terminal from either source; repeat the existing test with a next page.
3. MINOR: focus moves to the select on the last page even when the person moved elsewhere: move focus only when it
   fell to the page body; test with focus moved to another field.
4. NIT: the confirm component's props type requires a survivor for a merge (no deprecate-sentence fallback).
Report: append `## Fix pass 3` to `lane-web-taxonomies-report.md`. Files: the lane's own `cms-taxonomy-*` files/tests
only. Gates: focused + full `apps/web` Vitest, `astro check`, eslint `--max-warnings=0` + prettier, mutation checks on
scratch copies under `<scratchpad>/claude_s12_web_taxonomies_f3/` (run mutant batches under /bin/bash, not zsh); all
under `flock -s /tmp/wejammin-quiet.lock`.
