# Lane brief — `claude_s12_web_polish_b` (polish A follow-ups in the files that were held)

Source: `lane-web-polish-a-report.md` (GREEN, SHA `2c01e8c7…`) Requests to root 1-4. Precedent: polish A's changes and
`apps/web/src/lib/safe-read-retry.ts` (`retryingSafeRead`, `rateLimitWaitSeconds`, `rateLimitMessage`). RED first.
1. `components/cms-governed-review/**`: FE03 "Network and retry contract" (250/750 ms retry of declared-retryable
   502/503/504; 429 waits Retry-After, announced, input kept) for the governed canonical read + its island and the
   governed assignment form's reads; switch `CmsGovernedActivationForm.tsx`'s unknown-outcome focus to
   `document.getElementById(`${FRAME_HEADING_ID}-check`)` (the frame now has that id); apply `cms-danger-action`
   (`apps/web/src/styles/cms-editorial.css`) to the Retire commit control (DESIGN.md Danger).
2. Template designer reconcile read: same retry/429 contract.
3. Bundle budgets (FE03 budget table): the governed review detail island is 38.9 KB vs 35 KB, its route 98.8 KB, the
   pattern page route 92,463 vs 92,160 bytes, the workflow route has 0.2 KB headroom. Bring each within budget by
   code-splitting/lazy-loading, NEVER by raising a budget; add the pattern, taxonomy, related-content and
   definition-review pages to `CMS_EDITORIAL_ROUTES` and fix the 2 failing cases of
   `tests/performance/cms-editorial-bundle-budget.test.ts` (the templates page hydrates two islands): if a budget
   genuinely cannot be met without a spec change, stop and report with numbers.
NOT taxonomy files (fix pass 3 running) or related-content files (fix pass running; it owns its retry). Report
`docs/handoffs/2026-10-14-claude-s12/lane-web-polish-b-report.md`. Gates: focused + full `apps/web` Vitest, the
bundle-budget test, `astro check`, eslint `--max-warnings=0` + prettier; mutation checks on scratch copies under
`<scratchpad>/claude_s12_web_polish_b/` (mutant batches under /bin/bash); under `flock -s /tmp/wejammin-quiet.lock`.
