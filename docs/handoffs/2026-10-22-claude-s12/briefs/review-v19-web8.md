# Review V19 — wave-8 product changes (lanes web8a, web8b) before commit

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. READ-ONLY except
your report `docs/handoffs/2026-10-22-claude-s12/review-v19-report.md`. Focused Vitest and `tsc --noEmit` only; never Playwright,
db, supabase, docker, races or `pnpm build`. Do not spawn sub-agents.

Input: `lane-web8a-report.md` (52 files; new helper `cms-composition/use-reconcile-on-outcome.ts`; ~60 test corrections) and
`lane-web8b-report.md` (~50 files; `lane-web8b-test-corrections.diff`; the defect fix in `use-governed-review-command.ts`), every
product file and test correction they list. Spec: FE03 state tables; root DEC-241/242/244 and the M1 in-flight reading
(`.memory/raw/events/2026-10-29.jsonl`, `2026-10-30.jsonl`); BE00 idempotency (a retry is the identical request under its key).

Check: each cell matches FE03 (409 refetched automatically with the person's values kept and compared; unknown outcome reconciled
by a read BEFORE any retry is offered and the retry byte-identical; success refetch only where FE03 lists one; 422 at the field
where FE03 names it); no unbounded or racing reads (a 409 refetch loop, a read storm, a stale read overwriting a newer one, an
aborted read leaving a pending state); the in-flight rule and late-value survival from web7/unit5 still hold; each rewritten test
asserts the automatic behaviour and would fail with the fix reverted (revert-check the key ones), none weakened; focus and
announcements on every new state (FE03 focus rules); size limits; changed-line coverage; the bundle concern web8b raised
(`governed-review-refusal.ts` importing the shared refusal table — P2-S11-AC-106).

Output: findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence and a proposed fix; verdict per lane ACCEPT /
ACCEPT-WITH-CONDITIONS / REJECT; the real-route specs root must run. Final message to root: verdicts, report path + SHA-256,
counts, top findings.
