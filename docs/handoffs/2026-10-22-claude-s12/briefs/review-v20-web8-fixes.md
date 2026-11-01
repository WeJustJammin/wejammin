# Review V20 — verify the wave-8 fix rounds (web8a fix + bundle rounds, web8b fix round 2) before checkpoint 3

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. READ-ONLY except
your report `docs/handoffs/2026-10-22-claude-s12/review-v20-report.md` (write it early, keep `## Status` current). Focused Vitest,
`tsc --noEmit`, eslint and `node scripts/verify-bundle-budget.mjs <dist>` on a dist you build into your own scratch directory are
allowed; run every command in the FOREGROUND (no background monitors). Never Playwright, db, supabase, docker or races. Do not
spawn sub-agents.

Input: `review-v19-report.md` (the findings these rounds answer), `lane-web8a-report.md` (sections "Fix round" and "Bundle round";
SHA `439214f8…`), `lane-web8b-report.md` (fix round 2; SHA `0d143562…`), every product file and test correction they list. Spec:
FE03 state tables; root DEC-241/242/244/245 and the M1 in-flight reading (`.memory/raw/events/2026-10-29.jsonl`,
`2026-10-30.jsonl`); BE00 idempotency (a retry is the identical request under its key and If-Match).

Check, per V19 finding, that the fix is real and complete — not only at the site V19 named but at every sibling site of the same
pattern (sweep, state N/N):
- web8a M1 (locale unknown-outcome retry byte-identical; a moved version is reported, never adopted into the retry), M2 (digest
  409 re-reads the existing browser context route, keeps values, names added/removed selectors; now an on-demand chunk — check the
  failed-chunk path holds the send and that nothing in the initial route imports the chunk statically), m1 StrictMode, m2
  strictly-newer adoption, m3 cycle, B1 registry name, the locale 422 copy (DEC-230/244), and the bundle round's local block-key
  grammar with its drift test (would the test fail if the pattern rule's grammar changed?).
- web8b M3 (controls disabled through every post-answer read; one POST per press), DEC-245(4) composition retry hold, m6 focus,
  m7 retired rows kept + per-call sequence guard (no stale read overwriting a newer one), m8 `noListReads` (unscripted list reads
  recorded — does any suite now pass only because a read is silently ignored?), m10 and the taxonomy-versions cycle break.
- Both lanes: no unbounded or racing reads, aborted reads never leave a pending state, the in-flight rule and late-value survival
  still hold, focus and announcements on every new state, size limits (components 200, hooks/utilities 300, tests 400 — web8b
  printed OVER lines for `load-related-content-page.test.ts` 449 and a governed form; check each), changed-line coverage, import
  cycles (0 in the touched directories), and the two shared files both lanes edited (`scripts/verify-bundle-budget.mjs`,
  `tests/performance/cms-editorial-bundle-budget-mounted.test.ts`) are consistent with each other.
- Revert-check the key rewritten tests (revert the product hunk in a scratch COPY or with `git stash` of a single file restored
  immediately after; never leave the tree changed): each must fail with its fix reverted.
- Bundle: build once into scratch (`pnpm --filter ./apps/web build` with outDir redirected, or copy `apps/web/dist` after a
  build, restoring nothing else) and run the budget gate; report every CMS route's gzip and margin. Pattern edit margin is 94 B.

Output: findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence and a proposed fix; per V19 finding FIXED / PARTIAL /
NOT FIXED; verdict per lane ACCEPT / ACCEPT-WITH-CONDITIONS / REJECT; the real-route specs root must run. Final message to root:
verdicts, report path + SHA-256, counts, top findings.
