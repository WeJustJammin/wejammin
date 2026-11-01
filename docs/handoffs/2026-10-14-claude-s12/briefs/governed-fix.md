# Lane brief — `claude_s12_governed_fix_sql` (staged-runner lane `governed-fix`)

Fix, forward-only and test-first, four defects in applied governed SQL found by independent review.

## Your files (exclusive)
- `supabase/migrations-wip/governed-fix/` — contains root-moved `20261014030500_cms_submit_canonical_source_detail.sql`
  (an anchored body patch adding `details.domain`; independently reviewed as exact-single-anchor, all
  `pg_proc` attributes compared, idempotent). New migrations ONLY in 20261014040000–20261014049999.
  You own every change to `platform_private.cms_submit_governed_review` from now on: either keep 030500
  and add further migrations, or replace it with one full-body forward redefinition that includes all
  fixes — if you replace the full body, delete 030500 from your directory and say so in your report
  (a later full-body replacement would otherwise silently drop the 030500 patch).
- Governed-submit suite `supabase/tests/phase_02_slice_12_governed_submit.sql` + dir: ADD cases only;
  every existing assertion (60, independently verified) must stay byte-identical; plan grows.
- New suite if useful: `supabase/tests/phase_02_slice_12_governed_fix.sql` + dir.
- Report: `docs/handoffs/2026-10-14-claude-s12/lane-governed-fix-report.md`.

## Defects (read the cited review reports first)
1. `platform_private.cms_governed_current_digest` (applied in `20261013300400_cms_governed_frozen_status.sql`)
   raises 42P10 "for SELECT DISTINCT, ORDER BY expressions must appear in select list" on its pattern
   branch. Fix forward: DISTINCT in a subquery, then `order by block_key collate "C"` (keep the exact
   digest definition otherwise — same inputs, same canonical ordering, same hash for template/taxonomy
   branches; prove unchanged digests for the existing subject kinds). Source:
   `lane-pattern-def-report.md` (Requests 1) — its suite tests 50–52, 198, 243–244 hit this.
2. Submit raises `pattern_version_not_active` (`20261013300800`/`300820` ~SQL:159). Ruling
   (`review-governed-worker-p1.md`): that token is scoped to CMS-03C-02/12/15 by BE03c 1304 and DEC-180 R5;
   submit must raise `subject_not_submittable` (409).
3. `canonical_source_unavailable` without DETAIL (~SQL:151): must carry DETAIL `{"domain": "<domain>"}`
   (BE03c 1314/1375/1611, FE03 1115, contract). 030500 implements this — verify and keep/fold it.
4. Stored-hash mismatch (~SQL:127–130) raises 409 `subject_not_submittable`; BE03c 389/1259 and FE03 1115
   require 422 at `/subjectHash`: split the branch and raise the validation token the Worker mapper already
   maps (review says `VALIDATION_FAILED` with DETAIL `["/subjectHash"]` — confirm the exact token against
   `apps/worker/src/cms-composition-production-governed-review-rpc.ts` and the 300800 conventions).
No suite currently covers 2/3/4: add RED cases first (pattern subject with an inactive nested pattern —
needs pattern producers, so if pattern subjects cannot be minted in your staged run, cover 2 at the
helper level and record it; taxonomy subject with a declared unavailable domain — taxonomy producers
are WIP too, same rule; hash mismatch on a template subject), see them fail, then fix.

## Staged runs
Your lane's runs include only promoted migrations plus your directory. Pattern-def and taxonomy-def are
under review and not yet promoted; if a case needs them, ask root for a combined staged run in your
report rather than copying their files.

## Done
All four fixed with RED→GREEN evidence, governed-submit suite still passing every original assertion,
digest unchanged for template subjects, report with migrations (path/lines/SHA-256), runs, requests.
