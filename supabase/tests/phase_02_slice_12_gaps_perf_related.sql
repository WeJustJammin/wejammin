-- Slice 12 perf lane (claude_s12_gaps_perf), P2-S12-AC-061 clause 6 (database share): the CMS-03C-05 write meets the Tier 2 p95 < 1,200 ms
-- and RPC < 300 ms targets with 64 related targets (32 pins + 32 exclusions + the bounded derived rule), as a p95 over 24 writes
-- (phase_02_slice_12_related_perf.sql takes the p95 of ten).  The world is that suite's: 124 published, assigned entries and a
-- published source made by the same producers as the functional suites.  The end-to-end p95 is a BOUNDARY (the report): the 64 eligible
-- targets need the Slice 11 publication chain over HTTP.  Stage lane `none`: promoted migrations only.

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
\ir phase_02_slice_11_helpers/004-lineage.sqlinc
\ir phase_02_slice_12_related_content/000-helpers.sqlinc
\ir phase_02_slice_12_related_content/001-world.sqlinc
\ir phase_02_slice_12_gaps_perf_common/000-timing.sqlinc

do $bench$
declare
  n integer;
begin
  for n in 1..124 loop
    perform pg_temp.r12_make('b' || lpad(n::text, 3, '0'));
    perform pg_temp.r12_assign('b' || lpad(n::text, 3, '0'));
    perform pg_temp.r12_publish('b' || lpad(n::text, 3, '0'));
  end loop;
end;
$bench$;
select is((select coalesce(string_agg(step, ', '), '') from pg_temp.r12_world_errors where step ~ ' b[0-9]{3}( |$)'), '', 'bench: all 124 extra publications succeeded [P2-S12-AC-061]');
create or replace function pg_temp.r12_bnames(p_from integer, p_to integer) returns text[] language sql stable as $body$
  select array_agg('b' || lpad(n::text, 3, '0') order by n) from generate_series(p_from, p_to) n $body$;
select pg_temp.r12_publish('srcK');
select is((select coalesce(string_agg(step, ', '), '') from pg_temp.r12_world_errors where step like '%srcK%'), '', 'bench fixture: srcK published [P2-S12-AC-061]');
select pg_temp.s10_rpc_as('a9100000-0000-4000-8000-000000000001'::uuid, (select value::uuid from s10_ids where key = 'organization'));
select set_config('app.cms_rpc', 'true', true);

do $bench$
declare
  started timestamptz; request jsonb; result jsonb; run integer;
begin
  for run in 1..24 loop
    request := pg_temp.r12_req('srcK', pg_temp.r12_bnames(1, 32), pg_temp.r12_bnames(33, 64),
      pg_temp.r12_rule('shared-terms', case when run % 2 = 1 then 63 else 64 end), 'r12-srcK-gap-w' || lpad(run::text, 4, '0'));
    started := clock_timestamp();
    result := pg_temp.r12_curate(request);
    insert into g12p_timing(op, n, ms, outcome)
    values ('related_write64', run, extract(epoch from (clock_timestamp() - started)) * 1000,
            case when not (result ? '__error') then 'ok' else 'error' end);
    perform set_config('app.cms_rpc', 'true', true);
  end loop;
end;
$bench$;
select diag('related_write64 n=' || count(*) || ' p50=' || round((percentile_cont(0.5) within group (order by ms))::numeric, 1) || 'ms p95='
            || round((percentile_cont(0.95) within group (order by ms))::numeric, 1) || 'ms max=' || round(max(ms), 1) || 'ms')
  from g12p_timing where op = 'related_write64';
select ok(pg_temp.g12p_all_ok('related_write64', 24) and pg_temp.g12p_p95('related_write64') < 1200,
  'CMS-03C-05 write of 64 related targets over 24 real curations: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-061]');
select ok(pg_temp.g12p_p95('related_write64') < 300,
  'CMS-03C-05 write of 64 related targets meets the RPC < 300 ms target (p95 of 24) [P2-S12-AC-061]');

select * from finish();
rollback;
