# Review V21b — lane web9b's product changes and root's D1 fix, before checkpoint 3

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. READ-ONLY except
your report `docs/handoffs/2026-10-22-claude-s12/review-v21b-report.md` (write early, keep `## Status` current). Focused Vitest,
`tsc --noEmit`, eslint; revert checks only in a scratch COPY or with a single-file change restored immediately. Run everything in
the FOREGROUND. Never Playwright, db, supabase, docker, races or `pnpm build` (lane web9a is building under a lock and editing
`apps/web/src/lib/read-within-deadline.ts`, `run-read-under-deadline.ts` and the template/locale/pattern/taxonomy islands — do not
review those; V21a does). Do not spawn sub-agents.

Input: `lane-claude_s12_web9b-report.md` (65 files with SHA-256, test corrections, the n4 server model and afterEach registry),
`review-v20-report.md` (the findings web9b answers: m3, m5, m6, m9, m10, n4), `review-refute8b-report.md` (AC-284/285 pins row,
governed submit 401, queue degraded retitles, BLIND and PROOFGAP rows); root's D1 fix (LANES.md last entries: cache `no-store` in
`cms-editorial-workflow/cms-workflow-command-transport.ts` and `cms-governed-review/governed-review-command-transport.ts`, new
`cms-workflow-command-transport.no-store.test.ts`, the strengthened `CmsGovernedReview.closing-words.test.tsx` row). Spec: FE03
state tables and "Network and retry contract"; root DEC-241..246 (`.memory/raw/events/2026-10-29.jsonl`..`2026-10-31.jsonl`).

Check: each V20 fix is real and swept to sibling sites (state N/N); the read deadline ends every hold (no frozen send after expiry,
no late answer applied after expiry, no timer or listener leak); `keepRetired` by revision; the "(attempt N)" sentence is announced
(polite region rewritten, not duplicated); the m9 selector re-read cannot loop or send a stale digest; the n4 server model cannot
hide a refetch (does any test pass on a read the registry does not check?); the queue 200-not-strict-page Retry fix; the AC-069
chain-mount test — what it proves and what it cannot (the `.astro` page itself); the D1 fix covers every CMS command transport
(grep all POST/PUT/DELETE fetches under `apps/web/src/components/cms-*` — state N/N with `cache: 'no-store'`); size limits,
changed-line coverage, 0 new import cycles, READMEs.

Output: findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence, proposed fix; per V20 item FIXED / PARTIAL / NOT FIXED;
verdict ACCEPT / ACCEPT-WITH-CONDITIONS / REJECT; real-route specs root must run. Final message to root: verdict, report path +
SHA-256, counts, top findings.
