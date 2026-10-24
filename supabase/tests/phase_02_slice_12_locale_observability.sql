-- Slice 12 database-side locale observability (owner decision DEC-208, mechanism DEC-213; BE03c Observability
-- `Database-side locale observability (DEC-208)`, `Fan-out bound and event key (D12)`; tracker P2-S12-AC-052, AC-263,
-- AC-264).  RED before the 202610221xxxxx dec208 migrations, GREEN after.
--
-- The internal Worker read platform_api.cms_locale_observability_read(p_window_start, p_window_end): a closed-open
-- one-minute window of source-change fan-out (rows and stale fields appended) plus the point-in-time count of stale
-- no_fallback fields on every entry's current locale variant.  Service-role only, no write, no lock.
--
-- World: the CMS-03C-20 resolver suite world (phase_02_slice_12_locale_resolution/001-world.sqlinc): the active
-- `loc12doc` type (title/summary/nick localized, legal/terms no_fallback, slug none), one entry saved by the real
-- cms_create_entry, variants authored by the real CMS-03C-04 command, the source edited the way every revision
-- writer edits it (the fan-out trigger appends the stale rows).  Row instants are then pinned to known minutes.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc
\ir phase_02_slice_12_locale_resolution/001-world.sqlinc
\ir phase_02_slice_12_locale_observability/000-helpers.sqlinc
\ir phase_02_slice_12_locale_observability/001-shape-and-grants.sqlinc
\ir phase_02_slice_12_locale_observability/002-refusals.sqlinc
\ir phase_02_slice_12_locale_observability/003-window.sqlinc
\ir phase_02_slice_12_locale_observability/004-rpc-context.sqlinc
\ir phase_02_slice_12_locale_observability/005-gauge.sqlinc
\ir phase_02_slice_12_locale_observability/006-cases.sqlinc
\ir phase_02_slice_12_locale_observability/007-volume.sqlinc
\ir phase_02_slice_12_locale_observability/008-closing.sqlinc

select * from finish();
rollback;
