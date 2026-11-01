# Lane brief — `claude_s12_web_polish_a` (FE03 network/retry sweep + form contract on the pattern designer)

1. SWEEP (FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md` "Network and retry contract", ~:1172-1178):
   "502/503/504 retry at most twice after 250 ms and 750 ms only when BE declares safe". The Web taxonomies fix lane
   added `apps/web/src/lib/safe-read-retry.ts` and found no other shared helper. Inventory EVERY FE03 browser read
   path in `apps/web/src` (CMS content modeling: editorial S11 surfaces, governed review reads, pattern/template
   designers, taxonomy, composition/locale/related relays if they read) and record per path: retries per contract /
   missing. Fix every missing one by reusing `safe-read-retry.ts` (extend it only if a path needs a variant), test
   each with fake timers (no retry on 500, 429, non-retryable 502; exactly two retries; degraded after). Also check
   "429 waits for Retry-After, announces remaining wait, and preserves input" on the same inventory and fix gaps.
   State N/N in the report. Mutations (commands) keep reusing idempotency and reconcile first: do NOT add retries to
   commands.
2. Pattern designer form contract (FE03 :1223 "Form contract"; `review-web-patterns.md` m6): disable only the commit
   control while pending (preserve width/label, pending text), blur validation for syntax/safe local constraints
   (no pre-visit error), URL update after create (Completion row). RED tests first.
3. `CmsWorkflowCommandFrame.tsx`: give the "Check the current state" control a stable id/data hook and switch the
   governed activation unknown-outcome focus lookup to it ONLY IF `components/cms-governed-review/**` is free (the
   DEC-191 phase 2 lane edits it now): otherwise add the hook and report the one-line switch for root.
4. Danger: define the shared CMS destructive-button style from `DESIGN.md` (Buttons/Danger) as a reusable class/token
   in the CMS stylesheet scope (not scoped to `.platform-configuration-page`); do NOT apply it to Retire yet (DEC-191
   phase 2 owns those files); report the class name.
5. Bundle budget: check the CMS island bundle sizes against any budget in FE03/FE00 and report.
Files: `apps/web/src/lib/safe-read-retry.ts` (extend only), the read modules the sweep finds (EXCEPT
`components/cms-governed-review/**`, `components/cms-related-content/**`, `components/cms-taxonomy*/**` and the
template designer / template relay files, which other lanes hold now: list their status and leave them), pattern
designer files, `CmsWorkflowCommandFrame.tsx`, the CMS stylesheet. Gates: focused + full `apps/web` Vitest,
`astro check`, eslint `--max-warnings=0` + prettier; mutation checks on scratch copies under
`<scratchpad>/claude_s12_web_polish_a/`; all under `flock -s /tmp/wejammin-quiet.lock`. Report
`docs/handoffs/2026-10-14-claude-s12/lane-web-polish-a-report.md`.
