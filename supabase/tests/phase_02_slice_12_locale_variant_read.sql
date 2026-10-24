-- Slice 12 cmsLocaleVariantRead, the protected read of one entry's locale variant (DEC-205; BE03c route registry,
-- validation row `cmsLocaleVariantRead | entryId/locale`, error matrix, catalog `cms.03c.locale.v1`, authority row,
-- `LocaleVariantRead` schema, CMS-03C-20 consumers).  RED before the 20261022020xxx dec205 migrations, GREEN after.
-- The Worker route, the first-party proxy and the locale page (replacing SG-S12-05/06/07) belong to the same lane.
--
-- World: the CMS-03C-20 resolver suite world (phase_02_slice_12_locale_resolution/001-world.sqlinc): the active
-- `loc12doc` type (title/summary/nick localized, legal/terms no_fallback, slug none; en-US default, de-DE and fr-FR chain
-- to en-US, fr-CA to fr-FR then en-US), one entry saved by the real cms_create_entry, variants authored by the real
-- CMS-03C-04 command, source revisions appended the way every revision writer appends them.

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
\ir phase_02_slice_12_locale_variant_read/000-helpers.sqlinc
\ir phase_02_slice_12_locale_variant_read/001-shape-and-grants.sqlinc
\ir phase_02_slice_12_locale_variant_read/002-read.sqlinc
\ir phase_02_slice_12_locale_variant_read/003-authority.sqlinc

select * from finish();
rollback;
