# Lane brief — `claude_s12_locale` (staged-runner lane `locale`)

Complete, test-first, the backend of CMS-03C-04 (POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants)
and build CMS-03C-20 (`platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)`
plus the registered preflight provider `cms.locale.no_fallback_gate`). Web form is a separate lane.

## Your files (exclusive)
- `supabase/migrations-wip/locale/` — forward migrations ONLY in 20261014050000–20261014059999.
- New pgTAP suites `supabase/tests/phase_02_slice_12_locale_variant.sql` + dir and
  `supabase/tests/phase_02_slice_12_locale_resolution.sql` + dir. Existing locale suites: add cases only.
- Worker: `apps/worker/src/cms-composition/locale-routes*.ts`, `apps/worker/src/cms-composition-production-locale*.ts`
  and their tests (only if the SQL boundary changes or a route clause is missing).
- Report `docs/handoffs/2026-10-14-claude-s12/lane-locale-report.md`.

## Criteria you serve (read each in `.memory/pipeline/progress/slices/phase-02-slice-12.md`)
AC054–058 (CMS-03C-04 per-operation rows; AC058 is the Web form — out of scope, note it), AC148–152
(CMS-03C-20), receiving criteria AC051–052 (DEC-121: `no_fallback` is never resolved through
`fallbackChains`; a stale fallback-permitted field keeps serving its last approved translation), and any
AC189–285 cascade rows that name locale resolution or fan-out (grep the tracker).
Gap analysis as of 2026-10-12: `docs/handoffs/2026-10-12-claude-s12/ledger-gap-001-071.md` (AC054–058) and
`ledger-gap-143-213.md` (AC148–152); re-verify — commit 32faf5fd fixed 502/504 mapping since.

## Read before designing
BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: route row CMS-03C-04 (~162), internal
op CMS-03C-20 (~189), validation matrix rows for 04 (~366–410, incl. the 32-variant fan-out and
`LOCALE_VERSION_CONFLICT` `locale_limit_reached`, per-variant aggregate version and the
`cms.localization.changed.v1` dedupe key), "Locale field resolution (DEC-121, DEC-138) and fan-out (D12)"
(~1387), "Preflight providers registered by Slice 12" (~1397), schema/grants, events (~1546), error
catalog, testing strategy. Contracts (frozen): `locale-variant.ts`, `locale-resolution.ts`,
`preflight-providers.ts`. DEC-121/122/138 in `.memory/wiki/decisions.md`. Existing SQL:
`20260927310000_cms_locale_related_authority.sql`, `20260927440000_cms_locale_author_rpc.sql`,
`20261002167000_cms_locale_author_active_configuration.sql`, `20261013100400_cms_locale_variant_stale_field_ids.sql`.
How other preflight providers are registered: search `supabase/migrations` for `preflight` provider
registries from Slices 10–11.

## Done
Every server-side clause of the criteria above implemented and covered by non-vacuous pgTAP (and Worker
tests where touched), real fixtures only, GREEN in a staged run; report lists per-criterion evidence
(test file:assertion numbers), migrations (path/lines/SHA-256), runs, BOUNDARY items, requests to root.
