# Review `claude_s12_refute9db` — refute the wave-9 SQL proposals of lanes db9a and db9b (separate population)

You did not write these tests or proposals; your job is to break them. Rules, checks and output schema: exactly those of
`briefs/recite3-refutation.md` and `briefs/recite8-refutation.md` (read both, and `review-refute8-report.md` for the DROP classes).
READ-ONLY except your two outputs; never run supabase, docker, db, races, Vitest suites or Playwright (you may replay TAP
identities against the `.sql` sources with node). Run everything in the foreground. Do not spawn sub-agents.

Input: `recite9/db9a-proposals.json`, `recite9/db9b-proposals.json`; the reports `lane-claude_s12_db9a-report.md` and
`lane-db9b-report.md`; every SQL file and fragment they list; the TAPs (`recite9/db9a-race9-final-run.tap`, and the db9b TAPs
named in its report under `.lane-logs/`); the CURRENT ledger (`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`); root
decisions DEC-245, DEC-246, DEC-247 (`.memory/raw/events/2026-10-30.jsonl`, `2026-10-31.jsonl`); `recite8/refutation.json` (the
AC-294 five-part split it requires and the AC-277 rows already KEEP). Note `recite8/apply8.mjs` (root) applies refute8 first:
AC-294 c1 becomes five parts (indexes 1-5 after the split); propose against THOSE part indexes.

Specifics:
- AC-294 (DEC-245(6), DEC-246(6)): db9a U1 (the real CMS-03A-17 revocation; the create waits at position 1, not 2) — which part
  does it prove? U2 (hand-held single-assignment revoke) is not citable (no production writer). The definition-lever rows (B's
  `cms_activate_schema` / `cms_submit_governed_review` naming A's held definitions): do they prove part 3 "with no
  invisible/foreign definition lock lever" for the AC-294 write path, or only for other commands? Check whether CMS-03B-10 itself
  can name another owner's content type or default template at all (BE03b request shape, owner-scoped key resolution); if it
  cannot, say what that means for the part.
- AC-277 c4 "related target unpublish,": db9a's production-path rows (schedule + claim + CMS-03B-20 execute vs CMS-03C-05, both
  orders, no wait) — sound? The no-wait proof (how is "no wait" observed, not assumed)? The FOR UPDATE control?
- db9b: AC-108 c3 and AC-190 c2 (foreign rows are the FIRST owner's real active rows, the caller the second organization — does
  that prove "other-owner version is never listed" with a positive control?), AC-146 c5 (prior active intact, five reason codes),
  AC-044 "deletion" (one deleting command; BOUNDARY for the rest — is the BOUNDARY true, with lines?), V18 MINOR-2 (which AC-159
  clause?), AC-211 (no adds while DEC-247 is unfixed; the RED tests are never cited).

Output: `docs/handoffs/2026-10-22-claude-s12/recite9/refutation-db9.json` (one entry per criterion, written as you go) and
`docs/handoffs/2026-10-22-claude-s12/review-refute9db-report.md` (counts, DROP classes, status changes, limitation advice per
criterion, findings, verdict). Final message to root: verdict, both paths + SHA-256, counts.
