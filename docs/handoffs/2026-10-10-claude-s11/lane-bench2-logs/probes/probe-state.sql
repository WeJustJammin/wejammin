\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
select diag('STATE version=' || version());
select diag('STATE preload=' || current_setting('shared_preload_libraries', true) || ' jit=' || current_setting('jit'));
select diag('STATE ' || name || '=' || setting || coalesce(unit, '')) from pg_settings
 where name in ('shared_buffers','work_mem','effective_cache_size','random_page_cost','seq_page_cost','autovacuum','autovacuum_naptime',
   'autovacuum_vacuum_scale_factor','autovacuum_analyze_scale_factor','autovacuum_vacuum_threshold','autovacuum_analyze_threshold',
   'autovacuum_vacuum_cost_delay','track_io_timing','max_parallel_workers_per_gather','synchronous_commit','fsync','checkpoint_timeout',
   'max_wal_size','pg_stat_statements.track','plan_cache_mode','default_statistics_target') order by name;
select diag('STATE database size=' || pg_size_pretty(pg_database_size(current_database())) || ' backends=' || (select count(*) from pg_stat_activity where datname = current_database()));
select diag('STATE autovacuum workers running now=' || count(*)) from pg_stat_activity where backend_type = 'autovacuum worker';
select diag('STATE xact_commit=' || xact_commit || ' xact_rollback=' || xact_rollback || ' blks_read=' || blks_read || ' blks_hit=' || blks_hit || ' temp_files=' || temp_files)
  from pg_stat_database where datname = current_database();
select diag('STATE tables total=' || count(*) || ' dead_tuples_total=' || sum(n_dead_tup) || ' live_tuples_total=' || sum(n_live_tup) || ' autovac_runs=' || sum(autovacuum_count) || ' autoanalyze_runs=' || sum(autoanalyze_count))
  from pg_stat_user_tables;
select diag('STATE TOP-DEAD ' || format('%s.%s live=%s dead=%s ins=%s upd=%s del=%s relpages=%s reltuples=%s total_size=%s vac=%s autovac=%s analyze=%s autoanalyze=%s avc=%s aac=%s',
  s.schemaname, s.relname, s.n_live_tup, s.n_dead_tup, s.n_tup_ins, s.n_tup_upd, s.n_tup_del, c.relpages, c.reltuples, pg_size_pretty(pg_total_relation_size(s.relid)),
  to_char(s.last_vacuum, 'HH24:MI:SS'), to_char(s.last_autovacuum, 'HH24:MI:SS'), to_char(s.last_analyze, 'HH24:MI:SS'), to_char(s.last_autoanalyze, 'HH24:MI:SS'),
  s.autovacuum_count, s.autoanalyze_count))
  from pg_stat_user_tables s join pg_class c on c.oid = s.relid
 order by s.n_dead_tup desc limit 40;
select diag('STATE TOP-SIZE ' || format('%s.%s total_size=%s heap=%s live=%s dead=%s relpages=%s reltuples=%s',
  s.schemaname, s.relname, pg_size_pretty(pg_total_relation_size(s.relid)), pg_size_pretty(pg_relation_size(s.relid)), s.n_live_tup, s.n_dead_tup, c.relpages, c.reltuples))
  from pg_stat_user_tables s join pg_class c on c.oid = s.relid
 order by pg_total_relation_size(s.relid) desc limit 25;
-- Actual committed row counts of the tables the create path touches (the bench rolls back, so these are the suite's leftovers).
create temp table st_counts(rel text, n bigint) on commit drop;
do $do$
declare r record; n bigint;
begin
  for r in select s.schemaname, s.relname from pg_stat_user_tables s
            where s.schemaname in ('platform_private','audit_private','identity_private','content_private')
              and (s.relname like 'cms\_%' or s.relname like '%outbox%' or s.relname like '%audit%' or s.relname like '%idempot%' or s.relname like '%event%' or s.relname like '%rate%')
            order by 1, 2 loop
    execute format('select count(*) from %I.%I', r.schemaname, r.relname) into n;
    insert into st_counts values (r.schemaname || '.' || r.relname, n);
  end loop;
end $do$;
select diag('STATE COUNT ' || rel || '=' || n) from st_counts where n > 0 order by n desc, rel limit 60;
select diag('STATE non-empty tables counted=' || count(*) filter (where n > 0) || ' of ' || count(*)) from st_counts;
select * from finish();
rollback;
