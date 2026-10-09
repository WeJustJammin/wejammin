-- Slice 11 shared helper: platform_private.cms_tzdb_version (BE03b "Time authority
-- (E8)", DEC-153 pin; tracker P2-S11-AC-103, AC-105).  RED before 20261005017595,
-- GREEN after.
--
-- Neither PostgreSQL nor the Workers Intl API exposes a tz database release, so the
-- schedule time rules are owned by the Worker over ONE pinned IANA snapshot whose
-- release tag is the code constant CMS_TZDB_VERSION (2026e, recorded by lane S11-1 as
-- raw decision dec-153-pin).  cms_tzdb_version() returns the same tag; the RPC
-- compares a request's tzdbVersion with it.  Advancing the pin is code plus a forward
-- migration; stored schedules keep the tag they were accepted with.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(9);

\ir phase_02_slice_11_helpers/000-helpers.sqlinc

select ok(pg_temp.h11_private_definer('cms_tzdb_version()'),
  'cms_tzdb_version is a private SECURITY DEFINER function of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-103]');
select is(pg_temp.h11_volatility('cms_tzdb_version()'), 'i', 'cms_tzdb_version is IMMUTABLE (a code constant) [P2-S11-AC-103]');
select is(pg_temp.h11_rettype('cms_tzdb_version()'), 'text', 'it returns text [P2-S11-AC-103]');
select is(pg_temp.h11_text('select platform_private.cms_tzdb_version()'), '2026e',
  'it returns the pinned IANA release tag (DEC-153: 2026e) [P2-S11-AC-103]');
select ok(pg_temp.h11_text('select platform_private.cms_tzdb_version()') ~ '^[A-Za-z0-9._-]{1,32}$',
  'the tag satisfies the CMS_TZDB_VERSION grammar ^[A-Za-z0-9._-]{1,32}$ [P2-S11-AC-103]');
select is(pg_temp.h11_text('select platform_private.cms_tzdb_version() = platform_private.cms_tzdb_version()'), 'true',
  'it is stable across calls [P2-S11-AC-103]');
select is(
  (select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private' and p.proname = 'cms_tzdb_version'),
  1, 'exactly one cms_tzdb_version overload exists [P2-S11-AC-103]');
select ok(
  pg_catalog.obj_description(to_regprocedure('platform_private.cms_tzdb_version()'), 'pg_proc') like '%CMS_TZDB_VERSION%',
  'the function comment names the TypeScript constant it mirrors, for the parity test [P2-S11-AC-103]');
select is(
  (select pg_get_functiondef(to_regprocedure('platform_private.cms_tzdb_version()')) ~ $re$select '2026e'::text$re$),
  true, 'the tag is a literal in the function body so a parity test can read it from the migration [P2-S11-AC-103]');

select * from finish();
rollback;
