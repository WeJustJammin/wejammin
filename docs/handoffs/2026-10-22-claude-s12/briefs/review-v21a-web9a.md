# Review V21a — lane web9a's product changes (both rounds), before checkpoint 3

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. READ-ONLY except
your report `docs/handoffs/2026-10-22-claude-s12/review-v21a-report.md` (write early, keep `## Status` current). Focused Vitest,
`tsc --noEmit`, eslint; ONE build + bundle gate of your own under the shared lock
(`flock /tmp/wejammin-web-build.lock sh -c 'pnpm build > <scratch>/build.log 2>&1 && cp -r apps/web/dist <scratch>/dist && node scripts/verify-bundle-budget.mjs <scratch>/dist'`);
revert checks only in a scratch COPY or a single-file change restored immediately. Run everything in the FOREGROUND. Never
Playwright, db, supabase, docker or races. Do not spawn sub-agents. Reviewer V21b is reviewing web9b's files at the same time.

Input: `lane-claude_s12_web9a-report.md` (both rounds, SHA `cac90e63…`; changed files with SHA-256, test corrections, per-route
bundle table), `review-v20-report.md` (B1, M1, m1, m2, m4, m7, m8, n1, n3), `review-refute8b-report.md` (locale 422 row, selector
page-then-503), root DEC-241..249 (`.memory/raw/events/2026-10-29.jsonl`..`2026-10-31.jsonl`). Spec: FE03 state tables and
"Network and retry contract"; BE00 idempotency.

Check: each V20 fix real and swept to siblings (state N/N); `lib/read-within-deadline.ts` (a fetch that ignores abort is stopped —
no late answer applied after expiry, no leaked timer/listener, abort vs expiry told apart) and every read that now uses it, incl.
the on-demand `pattern-latest-fetch.ts` and `taxonomy-terms-fetch.ts` (failed-chunk path, preload in tests not masking a product
race — the B1 lesson); the dead post-await abort checks web9a removed — were they really unreachable?; the digest-409 copy (no
"Reload", values kept, shorter); the always-mounted live region (announces once per change); `cms-template-page-outcome.ts` and
the two `.astro` pages that now call it (AC-164: 401 redirect, 403, 404, 429 with/without a believed Retry-After, 5xx, malformed
bodies) — does each page render the outcome FE03 names, and is any branch of the old inline logic lost?; the closing-words tests
(would each fail with `cache` changed or an optimistic render added?); size limits, changed-line coverage, import cycles,
READMEs; bundle per CMS route (web9a: pattern edit 92,051, 109 B margin).

Output: findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence, proposed fix; per V20 item FIXED / PARTIAL / NOT FIXED;
verdict ACCEPT / ACCEPT-WITH-CONDITIONS / REJECT; real-route specs root must run. Final message to root: verdict, report path +
SHA-256, counts, top findings.
