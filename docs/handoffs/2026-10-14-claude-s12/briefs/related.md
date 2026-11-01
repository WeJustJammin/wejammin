# Lane brief — `claude_s12_related` (staged-runner lane `related`)

Build, test-first, the backend of CMS-03C-05 (POST /api/v1/cms/entries/{entryId}/related-content) and
CMS-03C-21 (`platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text,
p_audience text)` → ordered `RelatedPublicTarget[]`, at most 128). Web form is a separate lane.

## Your files (exclusive)
- `supabase/migrations-wip/related/` — forward migrations ONLY in 20261014060000–20261014069999.
- New pgTAP suites `supabase/tests/phase_02_slice_12_related_content.sql` + dir and
  `supabase/tests/phase_02_slice_12_related_public_targets.sql` + dir.
- Worker: `apps/worker/src/cms-composition/related-content-*.ts`,
  `apps/worker/src/cms-composition-production-related*.ts` and tests (the production port currently
  answers unavailable; wire it to your RPC, matching the frozen route and contract).
- Report `docs/handoffs/2026-10-14-claude-s12/lane-related-report.md`.

## Criteria you serve
AC059–063 (CMS-03C-05; AC063 is the Web form — out of scope, note it), AC153–158 (CMS-03C-21), and any
AC022–053 / AC189–285 rows naming related content, exclusions, derived rules or eligibility (grep the
tracker). Gap analysis (2026-10-12): `ledger-gap-001-071.md` (AC059–063), `ledger-gap-143-213.md` (AC153–158);
re-verify.

## Read before designing
BE03c: route row CMS-03C-05 (~163; If-Match = entry aggregate version; unique pin/exclusion target; target
projection recheck; `cms.publication.changed.v1` consumed for invalidation, no event emitted until
publication), internal op CMS-03C-21 (~190; read-only, recomputed at every projection/preview/publication,
never stored), validation rows for 05 (~385–387: pins ≤32 ordered unique, exclusions ≤64, exclusions win,
uniform 422 at `/pins/{n}`/`/exclusions/{n}` for ineligible/hidden/absent, derived rule registry
`shared-terms`/`same-type-recent` with version, reasonCode equality, maxCandidates 1–128),
"Related-content eligibility and derived rules (D11, OD-5)" (~1379), Slice 12 lock order, schema/grants,
error catalog, testing strategy. Contracts (frozen): `related-content.ts`, `related-public-target.ts`.
DEC references in that section. Existing table: `20260927310000_cms_locale_related_authority.sql:50`.
Recommendations never grant access; exclusions always win.

## Done
As in the locale brief: every server-side clause implemented and covered by non-vacuous tests, real
fixtures, GREEN staged run; Worker port wired with tests; report with per-criterion evidence.
