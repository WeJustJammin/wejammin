-- Slice 12 CMS-03C-20 locale field resolver (BE03c 189, Locale field resolution (DEC-121,
-- DEC-138) 1387-1389).  Criteria: P2-S12-AC-148..152 and the receiving criteria AC-051,
-- AC-052.  RED before the 20261014050xxx locale migrations, GREEN after.
--
-- Fixture: the Slice 10 RPC world plus an active `loc12doc` type created by the real
-- cms_create_type_draft with localized, no_fallback and none fields, an entry saved by the
-- real cms_create_entry, variants authored by the real cms_author_locale_variant, and source
-- revisions appended as phase_02_slice_12_locale_source_stale.sql appends them.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(41);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc
\ir phase_02_slice_12_locale_resolution/001-world.sqlinc
\ir phase_02_slice_12_locale_resolution/002-resolver.sqlinc

select * from finish();
rollback;
