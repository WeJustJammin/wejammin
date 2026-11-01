# Review V17 — lane web7's product changes (FE03 state table) before commit

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. READ-ONLY except
your report `docs/handoffs/2026-10-22-claude-s12/review-v17-report.md`. Focused Vitest and `tsc --noEmit` only; never Playwright,
db, supabase, docker, races or `pnpm build`.

Input: `docs/handoffs/2026-10-22-claude-s12/lane-web7-report.md` — every product file (83 under apps/web), every test correction
(~45, incl. the pinned rows rewritten), the new files and the three refactors. Spec: FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`
state tables (incl. the 2026-10-29 DEC-242 amendment of the queue degraded cell), DEC-241/242 in `.memory/raw/events/2026-10-29.jsonl`.

Check: each fix matches its FE03 cell exactly (D1 selector submit after a failed Load more, D2 250 ms skeleton, G-A1 degraded
detail, A1 403 CapabilityGate in every island named, L1-L8 latest-read loading/degraded, A5/A7/B1/B2/B4, A6 `key_reserved` at the
field, AC-042 c5 provenance); no regression of the earlier fixes (unit5 leave guard and late edits, web6 commit-only disabling and
result heading, pwfix6 redirects); each rewritten pinned row now asserts the FE03 cell and would fail with the fix reverted
(revert-check the key ones); every test correction is justified by a spec line, never weakened; the refactors preserve behaviour;
components ≤ 200 lines; coverage 100% of touched modules; no `any`.

Output: findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence and a proposed fix; verdict ACCEPT / ACCEPT-WITH-CONDITIONS
/ REJECT; the real-route specs root must run. Final message to root: verdict, report path + SHA-256, counts, top findings.
