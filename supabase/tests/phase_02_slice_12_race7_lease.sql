-- Slice 12 race7: CMS-03C-19 worker lease expiry under REAL concurrency (lane claude_s12_race7; BE03c "Scheduled activation (OD-6)" 1475: a claimed schedule carries a five-minute lease,
-- an expired lease is recovered by the next claim (failed_retryable, attempt_count + 1, the 15 s ladder), the execute re-proves the lease under the schedule row lock; the claim
-- row "FOR UPDATE SKIP LOCKED"; tracker P2-S12-AC-277 "worker lease expiry").  This file REALLY WAITS (about 6.5 minutes): three REAL scheduled activations are claimed, the
-- file waits for their five-minute leases to expire (no clock is forged), and then two deterministic outcomes are driven through independent sessions:
--   LE1  a worker whose lease expired but who is STILL EXECUTING (held at the lineage advisory lock, owning its schedule row) is skipped by the expiry sweep: the claim returns at
--        once, recovers only the other expired leases, and the in-flight worker then completes with the activation;
--   LE2  a worker that presents a lease the sweep already replaced is refused P0001:CONFLICT and changes nothing, while the new lease holder completes.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race7/020-sys.sqlinc

create or replace function pg_temp.r7_sched(p_id text) returns text language sql stable as $b$
  select state::text || ':' || version::text || ':' || attempt_count::text from platform_private.cms_governed_activation_schedules where id = p_id::uuid $b$;
create or replace function pg_temp.r7_lease(p_id text) returns text language sql stable as $b$
  select coalesce(lease_id::text, 'none') from platform_private.cms_governed_activation_schedules where id = p_id::uuid $b$;
create or replace function pg_temp.r7_subject_state(p_subject uuid) returns text language sql stable as $b$
  select state::text from platform_private.cms_template_versions where id = p_subject $b$;
-- Stash the execute request of one claimed element (the claim's own scheduleVersion is not the operand: expectedVersion is the review version the schedule relied on).
create or replace function pg_temp.r7_stash_exec(p_key text, p_claimed jsonb) returns void language sql as $b$
  select pg_temp.r7_stash_sys(p_key, 'platform_api.cms_execute_governed_activation',
    jsonb_build_object('scheduleId', p_claimed->>'scheduleId', 'expectedVersion', p_claimed->>'expectedVersion', 'leaseId', p_claimed->>'leaseId')) $b$;
create or replace function pg_temp.r7_claimed_of(p_claim text, p_schedule text) returns jsonb language sql stable as $b$
  select e from jsonb_array_elements(case when p_claim like 'ok:%' then substr(p_claim, 4)::jsonb else '[]'::jsonb end) e where e->>'scheduleId' = p_schedule $b$;
create or replace function pg_temp.r7_ids(p_claim text) returns text language sql stable as $b$
  select coalesce((select string_agg(e->>'scheduleId', ',' order by e->>'scheduleId')
                     from jsonb_array_elements(case when p_claim like 'ok:%' then substr(p_claim, 4)::jsonb else '[]'::jsonb end) e), '') $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race7/010-governed-world.sqlinc
select pg_temp.s12gb_approved('l1');
select pg_temp.s12gb_approved('l2');
select pg_temp.s12gb_approved('l3');
select pg_temp.s12gb_act('sch-l1', 'owner', pg_temp.s12ga_review('l1'), 'schedule', p_after => interval '62 seconds');
select pg_temp.s12gb_act('sch-l2', 'owner', pg_temp.s12ga_review('l2'), 'schedule', p_after => interval '64 seconds');
select pg_temp.s12gb_act('sch-l3', 'owner', pg_temp.s12ga_review('l3'), 'schedule', p_after => interval '66 seconds');
select pg_temp.r7_note('sch_out', pg_temp.s12ga_out('sch-l1') || '|' || pg_temp.s12ga_out('sch-l2') || '|' || pg_temp.s12ga_out('sch-l3'));
select pg_temp.r7_note('s1', pg_temp.s12gb_sid('l1')::text);
select pg_temp.r7_note('s2', pg_temp.s12gb_sid('l2')::text);
select pg_temp.r7_note('s3', pg_temp.s12gb_sid('l3')::text);
select pg_temp.r7_stash_act('l1');
select pg_temp.r7_stash_act('l2');
select pg_temp.r7_stash_act('l3');
select pg_temp.r7_stash_sys('claim:10', 'platform_api.cms_claim_due_governed_activations', jsonb_build_object('batch', 10));
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  s1 text; s2 text; s3 text; waited integer := 0; c text; claim1 text; claim2 text; subject_l1 uuid; lineage_l1 uuid; lease1_old text; lease2_old text; lease2_new text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  s1 := pg_temp.r7_get('s1'); s2 := pg_temp.r7_get('s2'); s3 := pg_temp.r7_get('s3');
  subject_l1 := pg_temp.r7_get('subject:l1')::uuid; lineage_l1 := pg_temp.r7_get('lineage:l1')::uuid;
  while waited < 150 and (select max(resolved_at_utc) from platform_private.cms_governed_activation_schedules) > clock_timestamp() loop
    perform pg_catalog.pg_sleep(1); waited := waited + 1;
  end loop;
  perform pg_temp.r7_note('due', (waited < 150)::text);
  for c in select unnest(array['b', 'h', 'w', 'x']) loop perform pg_temp.r7_conn(c); end loop;

  -- the first claim: three leases of five minutes
  claim1 := pg_temp.r7_sql('b', pg_temp.r7_call_sql('claim:10'));
  perform pg_temp.r7_note('claim1', pg_temp.r7_ids(claim1));
  perform pg_temp.r7_note('claim1_states', pg_temp.r7_sched(s1) || ' ' || pg_temp.r7_sched(s2) || ' ' || pg_temp.r7_sched(s3));
  perform pg_temp.r7_note('claim1_leases', (select count(distinct lease_id)::text from platform_private.cms_governed_activation_schedules));
  perform pg_temp.r7_stash_exec('exec:old:1', pg_temp.r7_claimed_of(claim1, s1));
  perform pg_temp.r7_stash_exec('exec:old:2', pg_temp.r7_claimed_of(claim1, s2));
  lease1_old := pg_temp.r7_lease(s1); lease2_old := pg_temp.r7_lease(s2);
  -- the leases really expire (about five minutes after the claim)
  waited := 0;
  while waited < 400 and (select max(lease_until) from platform_private.cms_governed_activation_schedules) >= clock_timestamp() loop
    perform pg_catalog.pg_sleep(1); waited := waited + 1;
  end loop;
  perform pg_temp.r7_note('expired', (waited < 400)::text);

  -- LE1: the worker of l1 still executes (held at the lineage advisory lock); the expiry sweep skips its schedule row
  perform pg_temp.r7_note('le1_h', pg_temp.r7_hold_raw('h', format('perform pg_advisory_xact_lock(%s)', platform_private.cms_governed_lineage_lock_key('template_version', lineage_l1))));
  perform pg_temp.r7_send('w', 'exec:old:1');
  perform pg_temp.r7_note('le1_w_blocked_by_h', pg_temp.r7_blocked_by('w', 'h')::text);
  perform pg_temp.r7_note('le1_w_waits_for', pg_temp.r7_waiting_for('w'));
  perform pg_temp.r7_note('le1_claim', pg_temp.r7_sql('b', pg_temp.r7_call_sql('claim:10')));
  perform pg_temp.r7_note('le1_w_still_blocked', pg_temp.r7_blocked_by('w', 'h', 1)::text);
  perform pg_temp.r7_note('le1_states', pg_temp.r7_sched(s1) || ' ' || pg_temp.r7_sched(s2) || ' ' || pg_temp.r7_sched(s3));
  perform pg_temp.r7_note('le1_lease_l1_same', (pg_temp.r7_lease(s1) = lease1_old)::text);
  perform pg_temp.r7_note('le1_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('le1_w', pg_temp.r7_collect('w'));
  perform pg_temp.r7_note('le1_after', pg_temp.r7_sched(s1) || ' subject=' || pg_temp.r7_subject_state(subject_l1));

  -- LE2: after the retry delay the sweep re-leases l2 and l3; a worker with the replaced lease is refused
  perform pg_catalog.pg_sleep(16);
  claim2 := pg_temp.r7_sql('b', pg_temp.r7_call_sql('claim:10'));
  perform pg_temp.r7_note('claim2', pg_temp.r7_ids(claim2));
  lease2_new := pg_temp.r7_lease(s2);
  perform pg_temp.r7_note('le2_lease_replaced', (lease2_new <> lease2_old)::text);
  perform pg_temp.r7_stash_exec('exec:new:2', pg_temp.r7_claimed_of(claim2, s2));
  perform pg_temp.r7_note('le2_states_before', pg_temp.r7_sched(s2));
  perform pg_temp.r7_note('le2_old', pg_temp.r7_sql('x', pg_temp.r7_call_sql('exec:old:2')));
  perform pg_temp.r7_note('le2_states_after_old', pg_temp.r7_sched(s2) || ' lease_kept=' || (pg_temp.r7_lease(s2) = lease2_new)::text);
  perform pg_temp.r7_note('le2_new', pg_temp.r7_sql('x', pg_temp.r7_call_sql('exec:new:2')));
  perform pg_temp.r7_note('le2_after_new', pg_temp.r7_sched(s2));
  perform pg_temp.r7_cleanup(array['b', 'h', 'w', 'x']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h', 'w', 'x']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran the lease scenarios without an error of its own [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed governed world built with no failed fixture assertion [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('sch_out') = 'ok|ok|ok' and pg_temp.r7_get('due') = 'true', 'fixture: three real schedules were accepted by CMS-03C-09 and really fell due [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('claim1') = (select string_agg(x, ',' order by x) from unnest(array[pg_temp.r7_get('s1'), pg_temp.r7_get('s2'), pg_temp.r7_get('s3')]) x)
    and pg_temp.r7_get('claim1_states') = 'executing:2:0 executing:2:0 executing:2:0' and pg_temp.r7_get('claim1_leases') = '3',
  'fixture: the first claim moved all three schedules to executing with three distinct leases [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('expired'), 'true', 'the five-minute leases really expired (no clock was forged) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('le1_w_blocked_by_h'), 'true', 'the worker whose lease expired is still executing: it is observed blocked at the lineage advisory lock while it owns its schedule row [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('le1_w_waits_for'), 'advisory', 'the in-flight worker waits for the lineage advisory lock, the last position [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('le1_claim') = 'ok:[]' and pg_temp.r7_get('le1_w_still_blocked') = 'true',
  'the expiry sweep returns at once, without waiting for the in-flight worker, and claims nothing yet [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('le1_states') = 'executing:2:0 failed_retryable:3:1 failed_retryable:3:1' and pg_temp.r7_get('le1_lease_l1_same') = 'true',
  'the sweep recovered only the expired leases it could lock: the two idle schedules are failed_retryable at attempt 1, the in-flight schedule keeps its row and its lease [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('le1_w') like 'ok:%' and (substr(pg_temp.r7_get('le1_w'), 4)::jsonb)->>'outcome' = 'completed',
  'the in-flight worker then completes: no double execution and no lost activation [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('le1_after'), 'completed:3:0 subject=active', 'the schedule is completed and the subject is active exactly once [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('claim2') = (select string_agg(x, ',' order by x) from unnest(array[pg_temp.r7_get('s2'), pg_temp.r7_get('s3')]) x) and pg_temp.r7_get('le2_lease_replaced') = 'true',
  'after the retry delay the next claim re-leases the recovered schedules with new leases [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('le2_old') = 'P0001:CONFLICT' and pg_temp.r7_get('le2_states_after_old') = pg_temp.r7_get('le2_states_before') || ' lease_kept=true',
  'a worker presenting the replaced lease is refused P0001:CONFLICT and changes nothing: the schedule row and the new lease are untouched [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('le2_new') like 'ok:%' and (substr(pg_temp.r7_get('le2_new'), 4)::jsonb)->>'outcome' = 'completed',
  'the worker holding the new lease completes the activation [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-277]');
select * from pg_temp.r7_finish();
