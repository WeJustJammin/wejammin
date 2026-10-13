\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

-- Slice 11 read plan stability (queue-perf lane; P2-S11-AC-052 / AC-058 / AC-064): the three safe reads under the planner
-- statistics a LONG gate run leaves behind.
--
-- WHY THIS FILE EXISTS.  The first canonical gate that ran phase_02_slice_11_reads_bench128.sql sat in one statement
-- (the CMS-03B-17 queue page) for 63 minutes until it was terminated, although the same file measured a 23 ms p95 on a
-- fresh database.  Cause: the reader joined cms_editorial_reviews TWICE and its planner estimates were one row per
-- table.  After a few minutes of the suite, autovacuum has ANALYZEd the tables behind the reads while every fixture of
-- every earlier file was rolled back: pg_class says "pages, no live rows" (relpages > 0, reltuples = 0), the planner
-- believes every table holds one row, and every join order, nested loop and unparameterized index scan looks free.  It
-- chose review(503) x [assignment(201) x review(503)]: 27 million tuples and 65 s PER CALL, with every tuple passing the
-- row-level-security quals.  The relationship policies of 20261010170200 are not the cause (dropped, the same plan takes
-- 62.6 s against 65.0 s); the query shape was.  20261010171000 bounds the reader's work.
--
-- WHAT IT DOES.  Phase 1 builds the bench world and rolls it back, then ANALYZEs the seven tables: exactly the pg_class
-- state above, reproduced on demand instead of waiting for autovacuum.  Phase 2 builds the same world again and asserts
--   * the stale statistics are really in place (otherwise this file would pass without exercising anything);
--   * the CMS-03B-17 queue page reads a BOUNDED number of tuples from the review and assignment tables.  The tuples read
--     are the planner-independent measure of the plan: unlike milliseconds they do not depend on the host, so the bound
--     is a hard assertion even on a loaded machine (the pathological plan read 27 million, a join-order regression to a
--     nested loop 53 thousand, the linear plan about 200);
--   * the five reads still meet their declared latency tier under those statistics.
-- Every statement runs under a statement_timeout, so a regression FAILS here; it does not hold the gate for an hour.
-- Autovacuum is switched off for the seven tables for the duration (and restored), so it cannot repair the statistics
-- between phase 1 and the assertions.  Run it on a quiet host like the bench.

-- The tables behind the three reads.
alter table platform_private.cms_editorial_reviews set (autovacuum_enabled = false);
alter table platform_private.cms_editorial_review_assignments set (autovacuum_enabled = false);
alter table platform_private.cms_editorial_decisions set (autovacuum_enabled = false);
alter table platform_private.cms_entry_revisions set (autovacuum_enabled = false);
alter table platform_private.cms_content_entries set (autovacuum_enabled = false);
alter table platform_private.cms_content_types set (autovacuum_enabled = false);
alter table platform_private.cms_content_type_versions set (autovacuum_enabled = false);

-- ------------------------------------------------------------------------------------------------ phase 1 --
-- The world is built and discarded; its output is not part of this file's plan.
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_11_reads_bench128/010-fixtures.sqlinc
rollback;
\o

-- Pages without live rows: what autovacuum's ANALYZE records once every earlier file has rolled its fixtures back.
analyze platform_private.cms_editorial_reviews, platform_private.cms_editorial_review_assignments,
  platform_private.cms_editorial_decisions, platform_private.cms_entry_revisions, platform_private.cms_content_entries,
  platform_private.cms_content_types, platform_private.cms_content_type_versions;

-- ------------------------------------------------------------------------------------------------ phase 2 --
begin;
select no_plan();
\ir phase_02_slice_11_reads_bench128/010-fixtures.sqlinc

-- A regression must fail here, not hang: each top-level statement below is cancelled after 60 seconds.
set local statement_timeout = '60s';

create temp table qp_calls(
  op text not null, n integer not null, status text not null, ms numeric not null,
  reviews_read bigint not null, assignments_read bigint not null, response jsonb
) on commit drop;

-- Tuples read from a table in THIS transaction so far: rows its sequential scans returned plus heap rows its index and
-- bitmap scans fetched (the index-side counters are attributed to the index, which is why the view is summed).
create or replace function pg_temp.qp_read(p_table regclass)
returns bigint
language sql
as $body$
  select coalesce(sum(x.seq_tup_read + x.idx_tup_fetch), 0)::bigint
    from pg_catalog.pg_stat_xact_user_tables x where x.relid = p_table
$body$;

-- p_n calls of platform_api.<p_function>(p_request) as the current session actor; one row per call with its wall time and
-- the tuples read from the review and assignment tables.  A cancelled call (statement_timeout) is recorded as 'timeout'
-- and ends the loop (the timer fires once per top-level statement).
create or replace function pg_temp.qp_measure(p_op text, p_function text, p_request jsonb, p_n integer)
returns void
language plpgsql
as $body$
declare
  started timestamptz;
  reviews_before bigint;
  assignments_before bigint;
  answer jsonb;
  i integer;
begin
  for i in 1..p_n loop
    started := clock_timestamp();
    reviews_before := pg_temp.qp_read('platform_private.cms_editorial_reviews'::regclass);
    assignments_before := pg_temp.qp_read('platform_private.cms_editorial_review_assignments'::regclass);
    begin
      execute format('select platform_api.%I($1)', p_function) into answer using p_request;
      insert into qp_calls values (p_op, i, 'ok', extract(epoch from clock_timestamp() - started) * 1000,
        pg_temp.qp_read('platform_private.cms_editorial_reviews'::regclass) - reviews_before,
        pg_temp.qp_read('platform_private.cms_editorial_review_assignments'::regclass) - assignments_before, answer);
    exception when query_canceled then
      insert into qp_calls values (p_op, i, 'timeout', extract(epoch from clock_timestamp() - started) * 1000,
        pg_temp.qp_read('platform_private.cms_editorial_reviews'::regclass) - reviews_before,
        pg_temp.qp_read('platform_private.cms_editorial_review_assignments'::regclass) - assignments_before, null);
      return;
    end;
  end loop;
end;
$body$;

create or replace function pg_temp.qp_p95(p_op text)
returns numeric language sql as $body$
  select case when bool_and(status = 'ok') and count(*) > 0
              then percentile_cont(0.95) within group (order by ms)::numeric else 1e9 end
    from qp_calls where op = p_op
$body$;

-- ----------------------------------------------------------------------------------------- the precondition --
select ok(
  (select bool_and(c.relpages > 0 and c.reltuples = 0)
     from pg_class c
    where c.oid in ('platform_private.cms_editorial_reviews'::regclass,
                    'platform_private.cms_editorial_review_assignments'::regclass,
                    'platform_private.cms_editorial_decisions'::regclass)),
  'precondition: the planner holds the stale statistics a long gate run leaves (pages but no live rows: relpages > 0, reltuples = 0) for the review, assignment and decision tables [P2-S11-AC-064]');

-- ------------------------------------------------------------------------------------------ the queue reads --
select pg_temp.r11_session('rvA');
select pg_temp.qp_measure('queue_page1', 'cms_list_editorial_reviews', pg_temp.b11_queue_rq(null), 10);
select ok((select status = 'ok' and jsonb_array_length(response->'items') = 50 and response->>'nextCursor' is not null
             from qp_calls where op = 'queue_page1' and n = 1),
  'CMS-03B-17 under stale planner statistics returns the maximum page of 50 items and a next cursor within the statement timeout [P2-S11-AC-064]');
select pg_temp.qp_measure('queue_page2', 'cms_list_editorial_reviews',
  pg_temp.b11_queue_rq((select response->>'nextCursor' from qp_calls where op = 'queue_page1' and n = 1)), 10);
select ok((select status = 'ok' and jsonb_array_length(response->'items') = 50
             from qp_calls where op = 'queue_page2' and n = 1),
  'CMS-03B-17 cursor page under stale planner statistics returns its 50 items within the statement timeout [P2-S11-AC-064]');

select ok((select max(reviews_read) < 10000 and max(assignments_read) < 10000
             from qp_calls where op = 'queue_page1' and status = 'ok')
          and (select count(*) = 10 from qp_calls where op = 'queue_page1' and status = 'ok'),
  'CMS-03B-17 first page reads a bounded number of tuples from the review and assignment tables per call (under 10,000 of 503 reviews and 237 assignments; the pathological plan read 27 million) [P2-S11-AC-064]');
select ok((select max(reviews_read) < 10000 and max(assignments_read) < 10000
             from qp_calls where op = 'queue_page2' and status = 'ok')
          and (select count(*) = 10 from qp_calls where op = 'queue_page2' and status = 'ok'),
  'CMS-03B-17 cursor page reads a bounded number of tuples from the review and assignment tables per call (under 10,000) [P2-S11-AC-064]');
select diag('queue_page1 tuples read per call: reviews max ' || coalesce(max(reviews_read)::text, '-')
  || ', assignments max ' || coalesce(max(assignments_read)::text, '-') || ', status ' || string_agg(distinct status, ','))
  from qp_calls where op = 'queue_page1';

-- ---------------------------------------------------------------------------------------- the other reads --
select pg_temp.r11_session('owner');
select pg_temp.qp_measure('workflow_draft128', 'cms_get_entry_workflow', pg_temp.b11_workflow_rq('bw-draft'), 10);
select pg_temp.qp_measure('workflow_bounds', 'cms_get_entry_workflow', pg_temp.b11_workflow_rq('bw-bounds'), 10);
select pg_temp.qp_measure('review_detail', 'cms_get_editorial_review', pg_temp.b11_detail_rq('bd'), 10);

select diag(op || ' p95=' || round(pg_temp.qp_p95(op), 1) || 'ms max=' || round(max(ms), 1) || 'ms n=' || count(*) || ' status=' || string_agg(distinct status, ','))
  from qp_calls group by op order by op;

select ok(pg_temp.qp_p95('workflow_draft128') < 1200,
  'CMS-03B-15 on a 128-field draft under stale planner statistics: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]');
select ok(pg_temp.qp_p95('workflow_bounds') < 1200,
  'CMS-03B-15 on an entry at 16 schedules, 64 publications and an open review under stale planner statistics: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]');
select ok(pg_temp.qp_p95('review_detail') < 750,
  'CMS-03B-16 at 7 of 8 decisions and 32 assignment summaries under stale planner statistics: p95 under the Tier 1 target of 750 ms [P2-S11-AC-058]');
select ok(pg_temp.qp_p95('queue_page1') < 750,
  'CMS-03B-17 first page at the maximum limit of 50 under stale planner statistics: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]');
select ok(pg_temp.qp_p95('queue_page2') < 750,
  'CMS-03B-17 cursor page at the maximum limit of 50 under stale planner statistics: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]');
select ok((select count(*) = 50 and max(ms) < 8000 from qp_calls where status = 'ok'),
  'every call of the five measured reads completed within the exact 8,000 ms read deadline under stale planner statistics (50 calls) [P2-S11-AC-052]');

select * from finish();
rollback;

-- The statistics this file made are the ones a long run leaves anyway; hand the tables back with autovacuum on and the
-- dead fixtures vacuumed (this also truncates the pages, so the next file plans from a clean slate).
alter table platform_private.cms_editorial_reviews reset (autovacuum_enabled);
alter table platform_private.cms_editorial_review_assignments reset (autovacuum_enabled);
alter table platform_private.cms_editorial_decisions reset (autovacuum_enabled);
alter table platform_private.cms_entry_revisions reset (autovacuum_enabled);
alter table platform_private.cms_content_entries reset (autovacuum_enabled);
alter table platform_private.cms_content_types reset (autovacuum_enabled);
alter table platform_private.cms_content_type_versions reset (autovacuum_enabled);
vacuum platform_private.cms_editorial_reviews, platform_private.cms_editorial_review_assignments,
  platform_private.cms_editorial_decisions, platform_private.cms_entry_revisions, platform_private.cms_content_entries,
  platform_private.cms_content_types, platform_private.cms_content_type_versions;
