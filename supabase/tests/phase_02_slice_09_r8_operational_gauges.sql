commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (r8-worker-cms ND-4, AC208): the DB-resident operational gauges of
-- the protected snapshot (platform_api.cms_get_operational_state_snapshot) are
-- activationBlockedMs (the oldest blocked migration plan) and outboxAgeMs (the
-- oldest undispatched, undead-lettered outbox event).  The review age has its
-- own suite (operational_review_age).  Retry, DLQ and allowlist-reject counters
-- are request- and queue-boundary events the Worker derives from its structured
-- telemetry, never from these tables.  Every row below is produced by the real
-- CMS commands; the only shortcut is shifting a stored instant or state of a
-- real row.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.r8g_snapshot(p_at timestamptz default null) returns jsonb language sql as $body$
  select platform_api.cms_get_operational_state_snapshot(
    jsonb_build_object('observedAt', coalesce(p_at, clock_timestamp()))) $body$;

-- ---- outbox age ------------------------------------------------------------
select pg_temp.s09d_create_type('a', 'r8gauge');
select ok(exists (select 1 from platform_private.outbox_events where dispatched_at is null and dead_lettered_at is null),
  'fixture: the real create command left an undispatched outbox event [P2-S09-AC-208]');
select ok((pg_temp.r8g_snapshot()->>'outboxAgeMs')::numeric between 0 and 60000
    and jsonb_typeof(pg_temp.r8g_snapshot()->'outboxAgeMs') = 'number',
  'a fresh undispatched event is a small non-negative age in milliseconds [P2-S09-AC-208]');
select ok(pg_temp.s09d_timewarp('outbox_events', $q$update platform_private.outbox_events
   set occurred_at = occurred_at - interval '2 hours' where dispatched_at is null and dead_lettered_at is null$q$),
  'fixture: every undispatched event is aged two hours');
select ok((pg_temp.r8g_snapshot()->>'outboxAgeMs')::numeric between 7200000 and 7200000 + 60000,
  'the snapshot reports the oldest undispatched event: about 7,200,000 ms [P2-S09-AC-208]');
select ok(not (pg_temp.r8g_snapshot(clock_timestamp() - interval '3 hours') ? 'outboxAgeMs'),
  'an event that occurred after the observation instant is not counted [P2-S09-AC-208]');
select ok(pg_temp.s09d_timewarp('outbox_events', $q$update platform_private.outbox_events
   set dispatched_at = clock_timestamp(), dispatch_attempt_count = 1 where dispatched_at is null and dead_lettered_at is null$q$),
  'fixture: every aged event is marked dispatched');
select ok(not (pg_temp.r8g_snapshot() ? 'outboxAgeMs'),
  'dispatched events no longer count: with none left the snapshot carries no outboxAgeMs [P2-S09-AC-208]');
select ok(pg_temp.s09d_timewarp('outbox_events', $q$update platform_private.outbox_events
   set dispatched_at = clock_timestamp(), dead_lettered_at = clock_timestamp(), dead_letter_reason = 'r8 gauge test',
       occurred_at = occurred_at - interval '1 day'$q$),
  'fixture: every event is dead-lettered a day further back');
select ok(not (pg_temp.r8g_snapshot() ? 'outboxAgeMs'),
  'dead-lettered events are excluded from the lag gauge (they are the DLQ gauge) [P2-S09-AC-208]');

-- ---- activation blocked age --------------------------------------------------
select ok(not (pg_temp.r8g_snapshot() ? 'activationBlockedMs'),
  'with no blocked plan the snapshot carries no activationBlockedMs [P2-S09-AC-208]');
select pg_temp.s09d_dry_run('a');
select is(pg_temp.s09d_outcome('a:dryRun'), 'OK', 'fixture: a real dry run created a migration plan through CMS-03A-10');
select ok(not (pg_temp.r8g_snapshot() ? 'activationBlockedMs'),
  'a plan that is not blocked does not count [P2-S09-AC-208]');
select ok(pg_temp.s09d_timewarp('cms_schema_migration_plans', format($q$update platform_private.cms_schema_migration_plans
   set state = 'blocked', updated_at = clock_timestamp() - interval '3 hours' where id = %L$q$, pg_temp.s09d_id('a:plan'))),
  'fixture: the real plan is blocked three hours ago');
select ok((pg_temp.r8g_snapshot()->>'activationBlockedMs')::numeric between 10800000 and 10800000 + 60000
    and jsonb_typeof(pg_temp.r8g_snapshot()->'activationBlockedMs') = 'number',
  'the snapshot reports how long the oldest plan has been blocked: about 10,800,000 ms [P2-S09-AC-208]');
select ok(not (pg_temp.r8g_snapshot(clock_timestamp() - interval '4 hours') ? 'activationBlockedMs'),
  'a plan blocked after the observation instant is not counted [P2-S09-AC-208]');
select ok(pg_temp.s09d_timewarp('cms_schema_migration_plans', format($q$update platform_private.cms_schema_migration_plans
   set state = 'ready' where id = %L$q$, pg_temp.s09d_id('a:plan'))),
  'fixture: the plan is unblocked');
select ok(not (pg_temp.r8g_snapshot() ? 'activationBlockedMs'),
  'an unblocked plan stops counting [P2-S09-AC-208]');

-- ---- the snapshot discloses nothing else ----
select ok((select (select array_agg(k order by k) from jsonb_object_keys(pg_temp.r8g_snapshot()) k)
      <@ array['activationBlockedMs', 'outboxAgeMs', 'reviewOpenAgeMs']),
  'the snapshot carries only the three age gauges: no identifier of any plan, event, actor or party [P2-S09-AC-208]');

select * from finish();
rollback;
