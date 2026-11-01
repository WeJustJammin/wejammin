-- Slice 12 gap lane claude_s12_gaps_db1: P2-S12-AC-148 clause 2 / AC-150 / AC-152.  CMS-03C-20 is "the one resolver used by the
-- 03b `locale` preflight provider": the gate verdict and the resolver answer for the same revision and no_fallback field are
-- the same fact.  The world and the 60 gate assertions are those of phase_02_slice_12_locale_gate.sql (included, not edited);
-- the cases below are added after them.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc
\ir phase_02_slice_12_locale_gate/001-gate.sqlinc

-- The resolver's reason code for the no_fallback `legal` field of the newest fr-FR revision of the entry.
create or replace function pg_temp.gl_resolver_reason() returns text language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  return coalesce(platform_private.cms_resolve_locale_field(pg_temp.l12_entry(), 'fr-FR', pg_temp.h11w_fid('legal'))->>'reasonCode', '-');
end;
$body$;
create or replace function pg_temp.gl_gate_reason(p_revision uuid) returns text language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  return (select coalesce(gate.reason_code, '-') from platform_private.cms_locale_no_fallback_gate(p_revision, 'submit') gate);
end;
$body$;

select pg_temp.l12_source_edit(jsonb_build_object(
  pg_temp.h11w_fid('title')::text, 'Title gap', pg_temp.h11w_fid('legal')::text, 'Legal gap one'));
select set_config('app.cms_rpc', 'true', true);
create temp table gl_missing on commit drop as select pg_temp.l12g_variant(pg_temp.l12g_title('Titre gap'), 'gap-gate-0001') as id;
select is(pg_temp.gl_gate_reason((select id from gl_missing)), 'no_fallback_missing',
  'control: the gate blocks a translation that omits the no_fallback field with no_fallback_missing [P2-S12-AC-148]');
select is(pg_temp.gl_resolver_reason(), pg_temp.gl_gate_reason((select id from gl_missing)),
  'the CMS-03C-20 resolver answers the same reason code as the gate for the missing no_fallback field [P2-S12-AC-148]');
create temp table gl_ok on commit drop as
  select pg_temp.l12g_variant(pg_temp.l12g_title_legal('Titre gap deux', 'Mentions gap'), 'gap-gate-0002') as id;
select is(pg_temp.gl_gate_reason((select id from gl_ok)), '-', 'control: the gate passes the translation that holds its no_fallback value [P2-S12-AC-148]');
select is(pg_temp.gl_resolver_reason(), pg_temp.gl_gate_reason((select id from gl_ok)),
  'the resolver reports no blocking reason for the same value: gate verdict and resolver agree [P2-S12-AC-148]');
-- the source value of the no_fallback field changes after the translation: stale in both
select pg_temp.l12_source_edit(jsonb_build_object(
  pg_temp.h11w_fid('title')::text, 'Title gap', pg_temp.h11w_fid('legal')::text, 'Legal gap two'));
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.gl_gate_reason((select id from gl_ok)), 'no_fallback_stale',
  'control: after the source value changed the gate blocks the translation with no_fallback_stale [P2-S12-AC-148]');
select is(pg_temp.gl_resolver_reason(), pg_temp.gl_gate_reason((select id from gl_ok)),
  'the resolver answers no_fallback_stale for the same field: one resolver behind the gate and the delivery-side call [P2-S12-AC-148]');

select finish();
rollback;
