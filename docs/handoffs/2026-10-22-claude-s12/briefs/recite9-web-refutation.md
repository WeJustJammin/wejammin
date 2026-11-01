# Review `claude_s12_refute9w` — refute lane web9b's proposals and lane db9a's follow-up rows (separate population)

You did not write these tests or proposals; your job is to break them. Rules, checks and output schema: exactly those of
`briefs/recite3-refutation.md` and `briefs/recite8-refutation.md` (read both; `review-refute8b-report.md` for the AC-271 part
matrix and DROP classes; `review-refute9db-report.md` for the AC-294/AC-108/AC-190 rulings). READ-ONLY except your outputs; never
run supabase, docker, db, races or Playwright. You MAY run focused Vitest with `--reporter=json` into your scratch directory to
resolve titles and revert-check in a scratch COPY (never in the tree). Run everything in the foreground. Do not spawn sub-agents.
Lane web9a is still editing its own files (template/locale/pattern/taxonomy islands, `apps/web/src/lib/read-within-deadline.ts`,
`run-read-under-deadline.ts`) — do not judge web9a's rows; a later pass does.

Input: `recite9/web9b-proposals.json` (38 AC-271 rows, 2 retitles, 4 AC-069 rows) and `lane-claude_s12_web9b-report.md`;
`recite9/db9a-proposals.json` (SHA `890d1081…`; only the rows NEW since `recite9/refutation-db9.json` — the create-level and
helper-level lever rows, the retitled lever rows, U1, and `phase_02_slice_12_gaps_db9c_selector_owner_pair.sql`) and
`lane-claude_s12_db9a-report.md` (follow-up section), TAP `recite9/db9a-race9-final-run.tap`. Root decisions DEC-245..249
(`.memory/raw/events/2026-10-30.jsonl`, `2026-10-31.jsonl`): DEC-246(1) one 8,000 ms read deadline; DEC-248 the database rulings;
DEC-249 forged fixture rows may prove a READ filter only with a labelled forgery, a predicate-removal sensitivity arm and an owner
positive control. Root's own D1 fix (cache `no-store` on both governed command transports; `cms-workflow-command-transport.no-store.test.ts`;
the strengthened row in `CmsGovernedReview.closing-words.test.tsx`) — judge that row too. `recite8/apply8.mjs` (root) runs before
these rows: AC-294 c1 is split into five parts and AC-271 c10/c11 are uncited; propose against the post-apply8 indexes.

Specifics: AC-271 parts `error` (c4), `degraded` (c5) and the closing words (c7) — for web9b's islands, is every cell now proven
(rows named) or ruled N/A/BOUNDARY? (web9a's islands are judged later: say per part what is still needed from them.) AC-069: does
the chain-mount test prove "consumed by the protected `CmsGovernedReviewPanel` on the template, pattern" pages without rendering the
`.astro` page (DEC-241: a mount-only page test does not close "consumed at /app/…")? AC-284/285 the rewritten pins row. AC-294 part
"with no invisible/foreign definition lock lever" (create-level + helper-level rows), part "authority/" (U1). AC-108 c3 / AC-190 c2
under DEC-249.

Output: `docs/handoffs/2026-10-22-claude-s12/recite9/refutation-web9b-db9a.json` and
`docs/handoffs/2026-10-22-claude-s12/review-refute9w-report.md` (counts, DROP classes, part matrix, status changes, limitation
advice, findings, verdict). Final message to root: verdict, both paths + SHA-256, counts.
