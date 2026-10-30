-- Slice 12 race7: CMS-03C-19 claim under REAL concurrency (lane claude_s12_race7; BE03c "Scheduled activation (OD-6)" 1475 and the Slice 12 lock order row
-- "the claim RPC of CMS-03C-19: schedule rows only (FOR UPDATE SKIP LOCKED), committed before execution starts"; tracker P2-S12-AC-145).
-- Three REAL scheduled activations (accepted by the real CMS-03C-09 producer 62 .. 66 s ahead; the file waits for them to fall due, no clock is forged) are
-- claimed by independent sessions through the real platform_api.cms_claim_due_governed_activations under the real service_role:
--   C1  session A claims one due schedule and stays OPEN (it holds that schedule row FOR UPDATE); session B claims the next one: B returns WITHOUT WAITING
--       and WITHOUT A's schedule (the two claims never return the same schedule);
--   C2  a holder owns the only remaining due schedule row; a claim returns the EMPTY claim at once (SKIP LOCKED does not wait) and leaves the row pending;
--       after the holder releases, the next claim returns it.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race7/020-sys.sqlinc

create or replace function pg_temp.r7_ids(p_claim text) returns text language sql stable as $b$
  select coalesce((select string_agg(e->>'scheduleId', ',' order by e->>'scheduleId')
                     from jsonb_array_elements(case when p_claim like 'ok:%' then substr(p_claim, 4)::jsonb else '[]'::jsonb end) e), '') $b$;
create or replace function pg_temp.r7_sched(p_id text) returns text language sql stable as $b$
  select state::text || ':' || version::text from platform_private.cms_governed_activation_schedules where id = p_id::uuid $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race7/010-governed-world.sqlinc
select pg_temp.s12gb_approved('c1');
select pg_temp.s12gb_approved('c2');
select pg_temp.s12gb_approved('c3');
select pg_temp.s12gb_act('sch-c1', 'owner', pg_temp.s12ga_review('c1'), 'schedule', p_after => interval '62 seconds');
select pg_temp.s12gb_act('sch-c2', 'owner', pg_temp.s12ga_review('c2'), 'schedule', p_after => interval '64 seconds');
select pg_temp.s12gb_act('sch-c3', 'owner', pg_temp.s12ga_review('c3'), 'schedule', p_after => interval '66 seconds');
select pg_temp.r7_note('sch_out', pg_temp.s12ga_out('sch-c1') || '|' || pg_temp.s12ga_out('sch-c2') || '|' || pg_temp.s12ga_out('sch-c3'));
select pg_temp.r7_note('s1', pg_temp.s12gb_sid('c1')::text);
select pg_temp.r7_note('s2', pg_temp.s12gb_sid('c2')::text);
select pg_temp.r7_note('s3', pg_temp.s12gb_sid('c3')::text);
select pg_temp.r7_stash_sys('claim:1', 'platform_api.cms_claim_due_governed_activations', jsonb_build_object('batch', 1));
select pg_temp.r7_stash_sys('claim:10', 'platform_api.cms_claim_due_governed_activations', jsonb_build_object('batch', 10));
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare s1 text; s2 text; s3 text; waited integer := 0; c text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  s1 := pg_temp.r7_get('s1'); s2 := pg_temp.r7_get('s2'); s3 := pg_temp.r7_get('s3');
  perform pg_temp.r7_note('pending_before', pg_temp.r7_sched(s1) || ' ' || pg_temp.r7_sched(s2) || ' ' || pg_temp.r7_sched(s3));
  -- the schedules really fall due (62 .. 66 s after acceptance)
  while waited < 150 and (select max(resolved_at_utc) from platform_private.cms_governed_activation_schedules) > clock_timestamp() loop
    perform pg_catalog.pg_sleep(1); waited := waited + 1;
  end loop;
  perform pg_temp.r7_note('waited_for_due', (waited < 150)::text);
  for c in select unnest(array['a', 'b', 'h', 'p']) loop perform pg_temp.r7_conn(c); end loop;

  -- C1: A claims the oldest due schedule and stays open; B claims the next one
  perform pg_temp.r7_note('c1_a', pg_temp.r7_hold('a', 'claim:1'));
  perform pg_temp.r7_send('b', 'claim:1');
  perform pg_temp.r7_note('c1_b', pg_temp.r7_collect('b', 10));
  perform pg_temp.r7_note('c1_b_blocked_by_a', (pg_temp.r7_pid('a') = any(pg_catalog.pg_blocking_pids(pg_temp.r7_pid('b'))))::text);
  perform pg_temp.r7_note('c1_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('c1_states', pg_temp.r7_sched(s1) || ' ' || pg_temp.r7_sched(s2) || ' ' || pg_temp.r7_sched(s3));
  perform pg_temp.r7_note('c1_leases', (select count(distinct lease_id)::text from platform_private.cms_governed_activation_schedules where id in (s1::uuid, s2::uuid)));

  -- C2: a holder owns the only remaining due schedule row
  perform pg_temp.r7_note('c2_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_governed_activation_schedules where id = %L::uuid for update', s3)));
  perform pg_temp.r7_send('b', 'claim:10');
  perform pg_temp.r7_note('c2_b', pg_temp.r7_collect('b', 10));
  perform pg_temp.r7_note('c2_state_while_held', pg_temp.r7_sched(s3));
  perform pg_temp.r7_note('c2_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('c2_next', pg_temp.r7_sql('b', pg_temp.r7_call_sql('claim:10')));
  perform pg_temp.r7_note('c2_states', pg_temp.r7_sched(s1) || ' ' || pg_temp.r7_sched(s2) || ' ' || pg_temp.r7_sched(s3));
  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_before=' || coalesce(pg_temp.r7_get('missing_before'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every claim scenario without an error of its own [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed governed world built with no failed fixture assertion [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('sch_out'), 'ok|ok|ok', 'fixture: three schedules were accepted by the real CMS-03C-09 producer [P2-S12-AC-145]');
select pg_temp.r7_ok(pg_temp.r7_get('pending_before') = 'pending:1 pending:1 pending:1' and pg_temp.r7_get('waited_for_due') = 'true',
  'fixture: all three schedules are real pending rows and really fall due before the first claim [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_ids(pg_temp.r7_get('c1_a')), pg_temp.r7_get('s1'),
  'session A claims exactly the oldest due schedule (batch 1) and its transaction stays open, holding that schedule row FOR UPDATE [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_ids(pg_temp.r7_get('c1_b')), pg_temp.r7_get('s2'),
  'a concurrent claim returns WITHOUT WAITING for the row session A holds and without that schedule: it claims the next due schedule (FOR UPDATE SKIP LOCKED) [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('c1_b_blocked_by_a'), 'false',
  'the concurrent claim was not blocked by the open claim of session A [P2-S12-AC-145]');
select pg_temp.r7_ok(pg_temp.r7_ids(pg_temp.r7_get('c1_a')) <> pg_temp.r7_ids(pg_temp.r7_get('c1_b'))
    and pg_temp.r7_get('c1_states') = 'executing:2 executing:2 pending:1' and pg_temp.r7_get('c1_leases') = '2',
  'two concurrent claims never return the same schedule: both claimed rows are executing at version 2 with distinct leases and the third stays pending [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('c2_b'), 'ok:[]',
  'a claim while a holder owns the only due schedule row returns the empty claim at once instead of waiting [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('c2_state_while_held'), 'pending:1',
  'the schedule row a claim skipped is untouched: still pending at version 1 [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_ids(pg_temp.r7_get('c2_next')), pg_temp.r7_get('s3'),
  'once the holder releases the row, the next claim returns that schedule [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('c2_states'), 'executing:2 executing:2 executing:2', 'every schedule ends executing at version 2 under its own claim [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-145]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-145]');
select * from pg_temp.r7_finish();
