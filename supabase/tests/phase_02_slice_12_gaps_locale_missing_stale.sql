-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-240 clause 1 (BE03c Locale preflight provider 1566, DEC-192): "a missing
-- no_fallback value outranks a stale one which outranks the approval check".  The existing cases show missing alone and stale alone
-- each outrank the approval check; here ONE locale revision holds both a missing and a stale no_fallback field.  `title` is made a
-- second no_fallback field in the rolled-back transaction (the precedent of the gate suite, which makes it localized the same way).
-- The world and the 60 gate assertions are those of phase_02_slice_12_locale_gate.sql (included, not edited).
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

-- two no_fallback fields: legal (already) and title
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions',
  $$update platform_private.cms_field_definition_versions set localization_mode = 'no_fallback' where field_key = 'title'$$);
select set_config('app.cms_rpc', 'true', true);
select is((select count(*)::integer from platform_private.cms_field_definition_versions
      where field_key in ('title', 'legal') and localization_mode = 'no_fallback' and state = 'active'
        and content_type_version_id = (select schema_version_id from platform_private.cms_entry_revisions
          where id = (select (response#>>'{revision,id}')::uuid from h11w_smoke_saved))),
  2, 'fixture: the schema of the entry now has two active no_fallback fields, title and legal [P2-S12-AC-240]');

create or replace function pg_temp.g2l_variant(p_fields jsonb, p_key text) returns uuid language plpgsql as $body$
declare response jsonb;
begin
  response := pg_temp.l12_author(pg_temp.l12_req('fr-FR', p_fields, p_key, jsonb_build_object(
    'noFallbackFieldIds', jsonb_build_array(pg_temp.h11w_fid('legal'), pg_temp.h11w_fid('title')))));
  perform set_config('app.cms_rpc', 'true', true);
  return (response->>'revisionId')::uuid;
end;
$body$;
create or replace function pg_temp.g2l_legal_only(p_value text) returns jsonb language sql as $body$
  select jsonb_build_array(jsonb_build_object('fieldId', pg_temp.h11w_fid('legal'), 'value', to_jsonb(p_value))) $body$;

select pg_temp.l12_source_edit(jsonb_build_object(
  pg_temp.h11w_fid('title')::text, 'Title gap two', pg_temp.h11w_fid('legal')::text, 'Legal gap two'));
select set_config('app.cms_rpc', 'true', true);
-- A: legal only (title is missing); B: title and legal (complete)
create temp table g2l_resp(label text primary key, response jsonb) on commit drop;
insert into g2l_resp select 'a', pg_temp.l12_author(pg_temp.l12_req('fr-FR', pg_temp.g2l_legal_only('Mentions A'), 'g2l-a-key-0001',
  jsonb_build_object('noFallbackFieldIds', jsonb_build_array(pg_temp.h11w_fid('legal'), pg_temp.h11w_fid('title')))));
select set_config('app.cms_rpc', 'true', true);
insert into g2l_resp select 'b', pg_temp.l12_author(pg_temp.l12_req('fr-FR', pg_temp.l12g_title_legal('Titre B', 'Mentions B'), 'g2l-b-key-0001',
  jsonb_build_object('noFallbackFieldIds', jsonb_build_array(pg_temp.h11w_fid('legal'), pg_temp.h11w_fid('title')))));
select set_config('app.cms_rpc', 'true', true);
create temp table g2l_a on commit drop as select (response->>'revisionId')::uuid as id from g2l_resp where label = 'a';
create temp table g2l_b on commit drop as select (response->>'revisionId')::uuid as id from g2l_resp where label = 'b';
select is(pg_temp.l12g_gate((select id from g2l_a), 'submit'), 'failed/no_fallback_missing/1',
  'control: a revision that omits one of two no_fallback fields reports no_fallback_missing for that one field [P2-S12-AC-240]');
select is(pg_temp.l12g_gate((select id from g2l_b), 'submit'), 'passed/-/0',
  'control: a revision holding both no_fallback values against the current source passes [P2-S12-AC-240]');

-- the source changes ONLY the legal value: legal goes stale in A and B
select pg_temp.l12_source_edit(jsonb_build_object(
  pg_temp.h11w_fid('title')::text, 'Title gap two', pg_temp.h11w_fid('legal')::text, 'Legal gap three'));
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.l12g_gate((select id from g2l_b), 'submit'), 'failed/no_fallback_stale/1',
  'control: B, whose legal value was translated against an older source, is blocked no_fallback_stale alone [P2-S12-AC-240]');
select is(pg_temp.l12g_gate((select id from g2l_a), 'submit'), 'failed/no_fallback_missing/2',
  'a revision with a MISSING title and a STALE legal value reports no_fallback_missing (not stale) and counts both blocking fields [P2-S12-AC-240]');
select is(pg_temp.l12g_gate((select id from g2l_a), 'publish'), 'failed/no_fallback_missing/2',
  'missing outranks stale and the approval check at publication [P2-S12-AC-240]');
select is(pg_temp.l12g_gate((select id from g2l_a), 'execute'), 'failed/no_fallback_missing/2',
  'missing outranks stale and the approval check at scheduled execution [P2-S12-AC-240]');
select is(pg_temp.l12g_locale_result(pg_temp.l12g_eval((select id from g2l_a), 'submit')),
  'failed/no_fallback_missing/2/cms.locale.no_fallback_gate@1',
  'the deployed evaluator reports the same missing-over-stale verdict through the registered provider [P2-S12-AC-240]');

select * from finish();
rollback;
