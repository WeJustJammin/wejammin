\connect postgres supabase_admin
\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
-- Run as the Supabase superuser so that pg_stat_statements can track nested statements; the fixtures and every command
-- run as `postgres` (the owner-bootstrap fixture requires current_user = 'postgres').
set pg_stat_statements.track = 'all';
-- Per-command statement profile of the bench chain (create, dry run, submit, assign, decide, activate) on 128-field definitions.
create temp table cp_acc(op text, toplevel boolean, query text, calls bigint, ms numeric, rows bigint, hit bigint, blks_read bigint) on commit drop;
create temp table cp_time(op text, ms numeric) on commit drop;
grant all on pg_temp.cp_acc, pg_temp.cp_time to public;
create or replace function pg_temp.cp_ns() returns text language sql as $b$
  select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_stat_statements' $b$;
create or replace function pg_temp.cp_reset() returns void language plpgsql security definer as $b$
begin execute format('select %I.pg_stat_statements_reset()', pg_temp.cp_ns()); end $b$;
create or replace function pg_temp.cp_grab(p_op text) returns void language plpgsql security definer as $b$
begin
  execute format($q$insert into cp_acc select %L, toplevel, left(regexp_replace(query, '\s+', ' ', 'g'), 150), calls, total_exec_time, rows, shared_blks_hit, shared_blks_read
      from %I.pg_stat_statements where dbid = (select oid from pg_database where datname = current_database())$q$, p_op, pg_temp.cp_ns());
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
select diag(format('STMT %s %s per-iter ms=%s calls=%s hit=%s read=%s rows=%s | %s', s.op, case when s.toplevel then 'TOP' else 'sub' end,
    round(s.ms / 10, 2), round(s.calls / 10.0, 1), s.hit / 10, s.blks_read / 10, s.rows / 10, s.query))
  from (select op, toplevel, query, sum(ms) ms, sum(calls) calls, sum(hit) hit, sum(blks_read) blks_read, sum(rows) rows,
               row_number() over (partition by op order by sum(ms) desc) rn
          from cp_acc group by op, toplevel, query) s
 where s.rn <= 14 order by s.op, s.rn;
select * from finish();
rollback;
