-- Slice 12 perf lane (claude_s12_gaps_perf): the database share of the template latency targets at the 64-slot bound.
--
--   cmsTemplateContextRead  Tier 2 p95 < 1,200 ms                P2-S12-AC-162   active content types and registered blocks of the owner
--   cmsTemplateLatestRead   Tier 2 p95 < 1,200 ms, RPC < 300 ms  P2-S12-AC-168, AC-279   latest version of a 64-slot template
--   CMS-03C-01 define       RPC < 300 ms                         P2-S12-AC-279   a new lineage with 64 slots (the manifest bound)
-- The RPC share is necessary, not sufficient, for the API p95 (DEC-226); the end-to-end measurement is
-- tests/postgrest/phase-02-slice-12-latency.apispec.ts (root runs it).  Real command, real owner, no row inserted by hand.
-- Stage lane `none`: promoted migrations only.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '2', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_gaps_perf_common/000-timing.sqlinc

create or replace function pg_temp.g12pt_ctx() returns jsonb language sql volatile as $body$
  select pg_temp.s09d_context('owner', true) $body$;
create or replace function pg_temp.g12pt_slots() returns jsonb language sql immutable as $body$
  select jsonb_agg(jsonb_build_object('key', 'slot' || lpad(n::text, 2, '0'), 'required', false,
    'allowedBlocks', '[]'::jsonb, 'maxCount', 8) order by n)
    from generate_series(1, 64) n $body$;
create or replace function pg_temp.g12pt_define(p_key text, p_slots jsonb) returns text language sql volatile as $body$
  select pg_temp.g12p_call('tmpl_define_64', 'platform_api.cms_define_template', 'owner', jsonb_build_object(
    'templateKey', p_key, 'compatibleTypeIds', jsonb_build_array((select id from s12pd_types where ordinal = 1)),
    'slots', p_slots, 'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
    'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
    'idempotencyKey', 's12gp-' || p_key), pg_temp.g12pt_ctx()) $body$;

-- A probe that the slot shape is accepted before 24 samples are taken (a refused shape would be a fixture defect, not a measurement).
select pg_temp.g12pt_define('gp-tpl-probe', pg_temp.g12pt_slots());
select is(pg_temp.g12p_out('tmpl_define_64#1'), 'ok', 'fixture: a template with 64 slots is accepted by the real CMS-03C-01 command [P2-S12-AC-279]');
select is((select jsonb_array_length(slots) from platform_private.cms_template_versions where id = (pg_temp.g12p_body('tmpl_define_64#1')->>'id')::uuid), 64,
  'fixture: the stored template carries 64 slots [P2-S12-AC-279]');

do $bench$
declare v_i integer; v_run integer;
begin
  for v_i in 1..24 loop
    perform pg_temp.g12pt_define('gp-tpl-' || lpad(v_i::text, 2, '0'), pg_temp.g12pt_slots());
  end loop;
  for v_run in 1..30 loop
    perform pg_temp.g12p_call('tmpl_context', 'platform_api.cms_template_context', 'owner', '{}'::jsonb, pg_temp.g12pt_ctx());
    perform pg_temp.g12p_call('tmpl_latest_64', 'platform_api.cms_template_latest', 'owner',
      jsonb_build_object('templateKey', 'gp-tpl-01'), pg_temp.g12pt_ctx());
  end loop;
end;
$bench$;
select ok(pg_temp.g12p_out('tmpl_context#1') = 'ok' and jsonb_array_length(pg_temp.g12p_body('tmpl_context#1')->'contentTypes') >= 2,
  'the context read returns the owner''s active content types [P2-S12-AC-162]');
select ok(pg_temp.g12p_out('tmpl_latest_64#1') = 'ok' and jsonb_array_length(pg_temp.g12p_body('tmpl_latest_64#1')->'slots') = 64,
  'the latest read returns the 64-slot template [P2-S12-AC-168]');

select diag(op || ' n=' || count(*) || ' p50=' || round((percentile_cont(0.5) within group (order by ms))::numeric, 1) || 'ms p95='
            || round((percentile_cont(0.95) within group (order by ms))::numeric, 1) || 'ms max=' || round(max(ms), 1) || 'ms')
  from g12p_timing group by op order by op;
select ok(pg_temp.g12p_all_ok('tmpl_context', 30) and pg_temp.g12p_p95('tmpl_context') < 1200,
  'cmsTemplateContextRead: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-162]');
select ok(pg_temp.g12p_all_ok('tmpl_latest_64', 30) and pg_temp.g12p_p95('tmpl_latest_64') < 1200,
  'cmsTemplateLatestRead of a 64-slot template: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-168]');
select ok(pg_temp.g12p_p95('tmpl_latest_64') < 300,
  'cmsTemplateLatestRead of a 64-slot template meets the RPC < 300 ms target (p95 of 30) [P2-S12-AC-279]');
select ok(pg_temp.g12p_all_ok('tmpl_define_64', 25) and pg_temp.g12p_p95('tmpl_define_64') < 300,
  'CMS-03C-01 define of a 64-slot template meets the RPC < 300 ms target (p95 of 25) [P2-S12-AC-279]');
select ok(pg_temp.g12p_all_service_role(), 'every measured template call ran under the real service_role transport role [P2-S12-AC-168]');

select * from finish();
rollback;
