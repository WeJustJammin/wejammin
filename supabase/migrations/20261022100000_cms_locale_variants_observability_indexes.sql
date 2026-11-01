-- Slice 12 lane dec208 (owner decision DEC-208, mechanism DEC-213; BE03c Observability `Database-side locale observability
-- (DEC-208)`; tracker P2-S12-AC-052, AC-263): the two indexes the locale observability read needs so that neither of its
-- queries scans platform_private.cms_locale_variants.
--   (state, created_at)                                       the fan-out window: rows in state `stale` created in [start, end)
--   (entry_id, lower(locale), version DESC, created_at DESC, id DESC)
--                                                              the current-row rule (the cmsLocaleVariantRead ordering): the
--                                                              newest row per entry and case-insensitive locale
-- DEC-219 (found by the lane's plan diagnostic, see the lane report): under FORCE ROW LEVEL SECURITY the owner's policy qual is
-- evaluated first and a user qual may become an INDEX condition only if every function in it is leakproof.  lower() is not
-- leakproof (text '=' / '>' and uuid '=' are), so on the lower(locale) index above the gauge's skip-scan probes degrade to
-- filters and read the whole entry.  Hence the third index, on the plain column:
--   (entry_id, locale, version DESC, created_at DESC, id DESC)   the gauge's skip scan and head probes (leakproof qualifiers only)
-- The gauge takes the head of each raw locale and keeps the newest per (entry, lower(locale)), the same current-row rule.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '2min';

create index cms_locale_variants_state_created_at_idx
  on platform_private.cms_locale_variants (state, created_at);

create index cms_locale_variants_current_row_idx
  on platform_private.cms_locale_variants
  (entry_id, pg_catalog.lower(locale), version desc, created_at desc, id desc);

create index cms_locale_variants_entry_locale_head_idx
  on platform_private.cms_locale_variants (entry_id, locale, version desc, created_at desc, id desc);

commit;
