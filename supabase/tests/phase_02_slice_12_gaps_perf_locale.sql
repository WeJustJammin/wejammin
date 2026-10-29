-- Slice 12 perf lane (claude_s12_gaps_perf), P2-S12-AC-056 clause 6 (database share): the CMS-03C-04 write meets the Tier 2 p95 < 1,200 ms
-- and RPC < 300 ms targets at the 128-locale-field bound, measured as a p95 over 24 sequential writes (the existing
-- phase_02_slice_12_locale_perf.sql asserts a median of five for the write).  The world and the request builder are that suite's
-- (128 localized/no_fallback fields, the real cms_create_type_draft / cms_create_entry, the real cms_author_locale_variant); only the
-- sample count and the asserted statistic differ.  The end-to-end p95 is tests/postgrest/phase-02-slice-12-latency-locale.apispec.ts
-- (root runs it).  Stage lane `none`: promoted migrations only.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc
\ir phase_02_slice_12_gaps_perf_common/000-timing.sqlinc
\ir phase_02_slice_12_locale_perf/001-bench.sqlinc

do $bench$
declare
  started timestamptz; response jsonb; n integer;
begin
  for n in 1..24 loop
    started := clock_timestamp();
    response := platform_api.cms_author_locale_variant(pg_temp.l12b_request('g12p-write-' || lpad(n::text, 3, '0')));
    insert into g12p_timing(op, n, ms, outcome)
    values ('locale_write128', n, extract(epoch from (clock_timestamp() - started)) * 1000,
            case when response is not null then 'ok' else 'empty' end);
    perform set_config('app.cms_rpc', 'true', true);
  end loop;
end;
$bench$;
select diag('locale_write128 n=' || count(*) || ' p50=' || round((percentile_cont(0.5) within group (order by ms))::numeric, 1) || 'ms p95='
            || round((percentile_cont(0.95) within group (order by ms))::numeric, 1) || 'ms max=' || round(max(ms), 1) || 'ms')
  from g12p_timing where op = 'locale_write128';
select is((select count(*)::integer from platform_private.cms_locale_variants where entry_id = pg_temp.l12_entry() and locale = 'fr-FR'), 29,
  'bench: 5 + 24 = 29 128-field translations were committed through the real RPC (under the fan-out of 32) [P2-S12-AC-056]');
select ok(pg_temp.g12p_all_ok('locale_write128', 24) and pg_temp.g12p_p95('locale_write128') < 1200,
  'CMS-03C-04 write of 128 locale fields over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-056]');
select ok(pg_temp.g12p_p95('locale_write128') < 300,
  'CMS-03C-04 write of 128 locale fields meets the RPC < 300 ms target (p95 of 24) [P2-S12-AC-056]');

select * from finish();
rollback;
