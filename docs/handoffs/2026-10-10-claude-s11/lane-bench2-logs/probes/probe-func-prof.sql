\connect postgres supabase_admin
\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
-- Run as the Supabase superuser so that track_functions can be enabled; the fixtures and every command
-- run as `postgres` (the owner-bootstrap fixture requires current_user = 'postgres').
set track_functions = 'all';
-- Function-level profile (pg_stat_xact_user_functions): snapshot before and after each command, aggregate the deltas.
create temp table cf_seq(n int) on commit drop;
insert into cf_seq values (0);
create temp table cf_snap(seq int, kind text, op text, funcid oid, funcname text, calls bigint, total_time double precision, self_time double precision) on commit drop;
create temp table cp_time(op text, ms numeric) on commit drop;
grant all on pg_temp.cf_seq, pg_temp.cf_snap, pg_temp.cp_time to public;
create or replace function pg_temp.cp_reset() returns void language plpgsql security definer as $b$
declare s int;
begin
  update cf_seq set n = n + 1 returning n into s;
  insert into cf_snap select s, 'b', null, funcid, schemaname || '.' || funcname, calls, total_time, self_time from pg_stat_xact_user_functions;
end $b$;
create or replace function pg_temp.cp_grab(p_op text) returns void language plpgsql security definer as $b$
declare s int;
begin
  select n into s from cf_seq;
  insert into cf_snap select s, 'a', p_op, funcid, schemaname || '.' || funcname, calls, total_time, self_time from pg_stat_xact_user_functions;
end $b$;
set role postgres;
\ir /w/supabase/tests/phase_02_slice_09_dec108/00-helpers.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/01-actors.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/02-chain.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.cp_ms(p_t0 timestamptz) returns numeric language sql as $b$
  select extract(epoch from clock_timestamp() - p_t0) * 1000 $b$;
create or replace function pg_temp.cp_run(p_n integer, p_prof boolean) returns void language plpgsql as $b$
declare tag text; t0 timestamptz; resource jsonb; i integer;
begin
  for i in 1..p_n loop
    tag := 'cp' || (case when p_prof then 'p' else 'w' end) || i;
    if p_prof then perform pg_temp.cp_reset(); end if;
    t0 := clock_timestamp();
    resource := pg_temp.s09d_rpc(tag || ':create', 'platform_api.cms_create_type_draft', 'owner',
      jsonb_build_object('typeKey', 'cpbench' || tag, 'label', 'Bench ' || tag, 'ownerCapability', 'cms.schema_designer',
        'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
        'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null,
        'fields', (select jsonb_agg(jsonb_build_object('stableFieldId', extensions.gen_random_uuid(), 'key', 'f' || lpad(g::text, 3, '0'),
            'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', g = 1, 'validatorKey', null, 'validatorVersion', null,
            'defaultMode', 'none', 'localizationMode', 'none',
            'editorConfig', jsonb_build_object('label', 'Field ' || g, 'order', g), 'lifecycle', 'active')) from generate_series(1, 128) g),
        'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb,
        'idempotencyKey', pg_temp.s09d_idem(tag, 'create')));
    if resource is null then raise exception 'create failed: %', pg_temp.s09d_outcome(tag || ':create'); end if;
    insert into cp_time values ('1 create128', pg_temp.cp_ms(t0));
    if p_prof then perform pg_temp.cp_grab('1 create128'); end if;
    perform pg_temp.s09d_remember(tag || ':type', (resource->>'contentTypeId')::uuid);
    perform pg_temp.s09d_remember(tag || ':version', (resource->>'id')::uuid);
    if p_prof then perform pg_temp.cp_reset(); end if;
    t0 := clock_timestamp(); perform pg_temp.s09d_dry_run(tag); insert into cp_time values ('2 dry_run', pg_temp.cp_ms(t0));
    if p_prof then perform pg_temp.cp_grab('2 dry_run'); end if;
    perform pg_temp.s09d_seal(tag);
    if p_prof then perform pg_temp.cp_reset(); end if;
    t0 := clock_timestamp(); perform pg_temp.s09d_submit(tag); insert into cp_time values ('3 submit', pg_temp.cp_ms(t0));
    if p_prof then perform pg_temp.cp_grab('3 submit'); perform pg_temp.cp_reset(); end if;
    t0 := clock_timestamp(); perform pg_temp.s09d_assign(tag, 'rev1'); insert into cp_time values ('4 assign', pg_temp.cp_ms(t0));
    if p_prof then perform pg_temp.cp_grab('4 assign'); perform pg_temp.cp_reset(); end if;
    t0 := clock_timestamp(); perform pg_temp.s09d_decide(tag, 'rev1'); insert into cp_time values ('5 decide', pg_temp.cp_ms(t0));
    if p_prof then perform pg_temp.cp_grab('5 decide'); perform pg_temp.cp_reset(); end if;
    t0 := clock_timestamp(); perform pg_temp.s09d_activate(tag); insert into cp_time values ('6 activate', pg_temp.cp_ms(t0));
    if p_prof then perform pg_temp.cp_grab('6 activate'); end if;
  end loop;
end $b$;
select pg_temp.cp_run(2, false);
truncate cp_time;
select pg_temp.cp_run(10, true);
select diag('CHAIN ' || op || ' p50=' || round(percentile_cont(0.5) within group (order by ms)::numeric, 1) || ' p95=' || round(percentile_cont(0.95) within group (order by ms)::numeric, 1)
  || ' max=' || round(max(ms), 1) || ' n=' || count(*)) from cp_time group by op order by op;
create temp table cf_delta on commit drop as
select a.op, a.funcname, sum(a.calls - coalesce(b.calls, 0)) calls, sum(a.total_time - coalesce(b.total_time, 0)) total_ms, sum(a.self_time - coalesce(b.self_time, 0)) self_ms
  from cf_snap a left join cf_snap b on b.seq = a.seq and b.kind = 'b' and b.funcid = a.funcid
 where a.kind = 'a' group by a.op, a.funcname;
select diag(format('FUNC %s per-iter total=%s self=%s calls=%s | %s', s.op, round((s.total_ms / 10)::numeric, 2), round((s.self_ms / 10)::numeric, 2), round(s.calls / 10.0, 1), s.funcname))
  from (select d.*, row_number() over (partition by d.op order by d.total_ms desc) rn from cf_delta d where d.calls > 0) s
 where s.rn <= 22 order by s.op, s.rn;
select diag(format('SELF %s per-iter self=%s total=%s calls=%s | %s', s.op, round((s.self_ms / 10)::numeric, 2), round((s.total_ms / 10)::numeric, 2), round(s.calls / 10.0, 1), s.funcname))
  from (select d.*, row_number() over (partition by d.op order by d.self_ms desc) rn from cf_delta d where d.calls > 0) s
 where s.rn <= 14 order by s.op, s.rn;
select * from finish();
rollback;
