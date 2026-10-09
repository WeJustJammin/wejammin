-- Slice 11 lane S11-3b: platform_api.cms_claim_due_publication_schedules / platform_private (CMS-03B-20 claim,
-- DEC-156, DEC-157; tracker P2-S11-AC-079 .. AC-084).  The Worker scheduled sweep claims at most `batch`
-- (1..100) due schedules: expired leases are first returned to failed_retryable (attempt_count + 1, the
-- 15 s / 60 s / 300 s ladder, or blocked retries_exhausted at the fourth failure), then due `pending` and
-- `failed_retryable` schedules move to `executing` under FOR UPDATE SKIP LOCKED and the version CAS with a
-- new five-minute lease, answered as strict ClaimedSchedule records (identifiers, versions, hashes only).
-- The multi-worker SKIP LOCKED proof is the race runner supabase/tests/phase_02_slice_11_races/013-*.mjs.
-- RED before 20261005017730.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(27);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_publication/000-world.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- One approved review and one schedule per state under test.
select pg_temp.p11_approved(tag) from (values ('cl-due'), ('cl-future'), ('cl-retry-due'), ('cl-retry-wait'), ('cl-done'),
  ('cl-blocked'), ('cl-live'), ('cl-exp-0'), ('cl-exp-1'), ('cl-exp-2'), ('cl-exp-3')) as t(tag);
select pg_temp.p11_schedule_row('s-due', 'cl-due');
select pg_temp.p11_schedule_row('s-future', 'cl-future', jsonb_build_object(
  'local_datetime', (date_trunc('second', clock_timestamp()) + interval '1 hour') at time zone 'UTC',
  'resolved_at_utc', date_trunc('second', clock_timestamp()) + interval '1 hour'));
select pg_temp.p11_schedule_row('s-retry-due', 'cl-retry-due');
select pg_temp.p11_schedule_row('s-retry-wait', 'cl-retry-wait');
select pg_temp.p11_schedule_row('s-done', 'cl-done');
select pg_temp.p11_schedule_row('s-blocked', 'cl-blocked');
select pg_temp.p11_schedule_row('s-live', 'cl-live');
select pg_temp.p11_schedule_row('s-exp-0', 'cl-exp-0');
select pg_temp.p11_schedule_row('s-exp-1', 'cl-exp-1');
select pg_temp.p11_schedule_row('s-exp-2', 'cl-exp-2');
select pg_temp.p11_schedule_row('s-exp-3', 'cl-exp-3');
-- The states a claim must leave alone or recover (the guards are bypassed to seed them; the CHECKs still apply).
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set state = 'failed_retryable', attempt_count = 1, version = 2,
      next_attempt_at = clock_timestamp() - interval '1 second' where id = %L$$, pg_temp.s11_id('s-retry-due')));
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set state = 'failed_retryable', attempt_count = 1, version = 2,
      next_attempt_at = clock_timestamp() + interval '1 minute' where id = %L$$, pg_temp.s11_id('s-retry-wait')));
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set state = 'completed', version = 3,
      actual_at_utc = clock_timestamp(), deviation_seconds = 0 where id = %L$$, pg_temp.s11_id('s-done')));
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set state = 'blocked', reason_code = 'preflight_failed', version = 3
      where id = %L$$, pg_temp.s11_id('s-blocked')));
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set state = 'executing', version = 2, lease_id = extensions.gen_random_uuid(),
      lease_until = clock_timestamp() + interval '4 minutes' where id = %L$$, pg_temp.s11_id('s-live')));
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set state = 'executing', version = 2, attempt_count = %s,
      lease_id = extensions.gen_random_uuid(), lease_until = clock_timestamp() - interval '1 minute' where id = %L$$,
  split_part(key, '-', 3), pg_temp.s11_id(key)))
  from (values ('s-exp-0'), ('s-exp-1'), ('s-exp-2'), ('s-exp-3')) as t(key);

select is(
  (select string_agg(key || '=' || pg_temp.p11_sched(key), ';' order by key)
     from (values ('s-due'), ('s-future'), ('s-retry-due'), ('s-retry-wait'), ('s-done'), ('s-blocked'), ('s-live'),
                  ('s-exp-0'), ('s-exp-1'), ('s-exp-2'), ('s-exp-3')) as t(key)),
  's-blocked=blocked/3/0/preflight_failed/-;s-done=completed/3/0/-/-;s-due=pending/1/0/-/-;s-exp-0=executing/2/0/-/lease;'
  || 's-exp-1=executing/2/1/-/lease;s-exp-2=executing/2/2/-/lease;s-exp-3=executing/2/3/-/lease;s-future=pending/1/0/-/-;'
  || 's-live=executing/2/0/-/lease;s-retry-due=failed_retryable/2/1/-/-;s-retry-wait=failed_retryable/2/1/-/-',
  'control: eleven schedules sit in the states a claim must leave alone, recover or take');

-- ---------------------------------------------------------------------------
-- Shape, privileges and structure.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_private', 'cms_claim_due_publication_schedules(jsonb)'),
  'cms_claim_due_publication_schedules is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-081]');
select ok(pg_temp.r11_posture('platform_api', 'cms_claim_due_publication_schedules(jsonb)'),
  'the platform_api wrapper is executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-081]');
insert into r11_snap(label, effects) values ('before-structure', pg_temp.p11_effects());
select pg_temp.r11_try('b-zero', $$select platform_api.cms_claim_due_publication_schedules('{"batch":0}'::jsonb)$$, false);
select pg_temp.r11_try('b-big', $$select platform_api.cms_claim_due_publication_schedules('{"batch":101}'::jsonb)$$, false);
select pg_temp.r11_try('b-string', $$select platform_api.cms_claim_due_publication_schedules('{"batch":"5"}'::jsonb)$$, false);
select pg_temp.r11_try('b-fraction', $$select platform_api.cms_claim_due_publication_schedules('{"batch":1.5}'::jsonb)$$, false);
select pg_temp.r11_try('b-missing', $$select platform_api.cms_claim_due_publication_schedules('{}'::jsonb)$$, false);
select pg_temp.r11_try('b-extra', $$select platform_api.cms_claim_due_publication_schedules('{"batch":5,"scheduleId":"x"}'::jsonb)$$, false);
select pg_temp.r11_try('b-array', $$select platform_api.cms_claim_due_publication_schedules('[5]'::jsonb)$$, false);
select ok(
  (select bool_and(pg_temp.r11_out(label) = 'P0001:INVALID_REQUEST')
     from (values ('b-zero'), ('b-big'), ('b-string'), ('b-fraction'), ('b-missing'), ('b-extra'), ('b-array')) as t(label))
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'before-structure'),
  'a batch outside 1..100, a non-integer, a missing batch, an extra key and a non-object are INVALID_REQUEST and change nothing [P2-S11-AC-079]');

-- ---------------------------------------------------------------------------
-- One claim: recovery of expired leases, then the due schedules.
-- ---------------------------------------------------------------------------
select pg_temp.p11_claim('c1');
select ok(pg_temp.r11_out('c1') = '00000:' and jsonb_typeof(pg_temp.r11_resp('c1')) = 'array',
  'the claim answers a JSON array of ClaimedSchedule records [P2-S11-AC-079]');
select is(
  (select string_agg(item->>'scheduleId', ',' order by item->>'scheduleId')
     from jsonb_array_elements(pg_temp.r11_resp('c1')) item),
  (select string_agg(pg_temp.s11_id(key)::text, ',' order by pg_temp.s11_id(key)::text) from (values ('s-due'), ('s-retry-due')) as t(key)),
  'exactly the due pending schedule and the due failed_retryable schedule are claimed: not the future one, the waiting retry, the completed, blocked and leased ones, nor the schedules whose lease just expired [P2-S11-AC-080]');
select ok(
  pg_temp.r11_keys(pg_temp.p11_claimed('c1', 's-due')) = 'activationEvidenceHash,correlationId,dependencyHash,expectedVersion,leaseId,revisionId,scheduleId,scheduleVersion'
    and pg_temp.p11_claimed('c1', 's-due')->>'scheduleVersion' = '2' and pg_temp.p11_claimed('c1', 's-due')->>'expectedVersion' = '2'
    and pg_temp.p11_claimed('c1', 's-due')->>'revisionId' = pg_temp.h11w_uuid('cl-due:revision')::text
    and pg_temp.p11_claimed('c1', 's-due')->>'dependencyHash' = (pg_temp.p11_review('cl-due')).dependency_hash
    and pg_temp.p11_claimed('c1', 's-due')->>'activationEvidenceHash' = platform_private.cms_jcs_sha256((pg_temp.p11_review('cl-due')).activation_evidence)
    and pg_temp.p11_claimed('c1', 's-due')->>'leaseId' = (select lease_id::text from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-due'))
    and pg_temp.p11_claimed('c1', 's-due')->>'correlationId' = platform_private.cms_schedule_correlation(
          pg_temp.s11_id('s-due'), (pg_temp.p11_claimed('c1', 's-due')->>'leaseId')::uuid)::text,
  'a ClaimedSchedule is exactly the eight identifier / version / hash members: the claim''s schedule version (the CAS operand), the approved review version, the lease and the derived correlation [P2-S11-AC-079]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('c1'), array[
    pg_temp.s11_id('pub')::text, pg_temp.s11_id('creator')::text, pg_temp.s11_id('org')::text,
    (select auth_user_id::text from r11_actor where key = 'pub'), 'Title of cl-due', 'Body of']),
  'a claim carries no publisher, author, party, account, title or content [P2-S11-AC-081]');
select ok(
  pg_temp.p11_sched('s-due') = 'executing/2/0/-/lease' and pg_temp.p11_sched('s-retry-due') = 'executing/3/1/-/lease'
    and (select lease_until between clock_timestamp() + interval '299 seconds' and clock_timestamp() + interval '301 seconds'
                and job_id is not null and next_attempt_at is null and actual_at_utc is null
           from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-due'))
    and (select lease_id <> (select lease_id from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-retry-due'))
           from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-due')),
  'a claimed schedule is executing at version + 1 with a fresh five-minute lease, a job id and its attempt count intact (a retry keeps its attempts) [P2-S11-AC-082]');
select is(
  (select string_agg(key || '=' || pg_temp.p11_sched(key), ';' order by key)
     from (values ('s-future'), ('s-retry-wait'), ('s-done'), ('s-blocked'), ('s-live')) as t(key)),
  's-blocked=blocked/3/0/preflight_failed/-;s-done=completed/3/0/-/-;s-future=pending/1/0/-/-;s-live=executing/2/0/-/lease;s-retry-wait=failed_retryable/2/1/-/-',
  'a future schedule, a waiting retry, a completed, a blocked and a live-leased schedule are untouched [P2-S11-AC-080]');
select ok(
  pg_temp.p11_sched('s-exp-0') = 'failed_retryable/3/1/-/-' and pg_temp.p11_sched('s-exp-1') = 'failed_retryable/3/2/-/-'
    and pg_temp.p11_sched('s-exp-2') = 'failed_retryable/3/3/-/-' and pg_temp.p11_sched('s-exp-3') = 'blocked/3/3/retries_exhausted/-',
  'an expired lease returns the schedule to failed_retryable with attempt_count + 1 and releases the lease; the fourth consecutive failure blocks it with retries_exhausted [P2-S11-AC-083]');
select ok(
  (select bool_and(case key
            when 's-exp-0' then next_attempt_at between clock_timestamp() + interval '13 seconds' and clock_timestamp() + interval '16 seconds'
            when 's-exp-1' then next_attempt_at between clock_timestamp() + interval '58 seconds' and clock_timestamp() + interval '61 seconds'
            when 's-exp-2' then next_attempt_at between clock_timestamp() + interval '298 seconds' and clock_timestamp() + interval '301 seconds'
            else next_attempt_at is null end)
     from (values ('s-exp-0'), ('s-exp-1'), ('s-exp-2'), ('s-exp-3')) as t(key)
     join platform_private.cms_publication_schedules schedule on schedule.id = pg_temp.s11_id(t.key)),
  'the retry ladder sets next_attempt_at to now + 15 s, 60 s and 300 s after the first, second and third failure; a blocked schedule has none [P2-S11-AC-082]');
select ok(
  (select count(*) = 3 from audit_private.audit_events audit
    where audit.action = 'cms.publication.schedule.retry' and audit.reason_code = 'CMS_PUBLICATION_SCHEDULE_RETRY'
      and audit.actor_id is null and audit.target_id in (pg_temp.s11_id('s-exp-0'), pg_temp.s11_id('s-exp-1'), pg_temp.s11_id('s-exp-2')))
    and (select count(*) = 1 from audit_private.audit_events audit
          where audit.action = 'cms.publication.schedule.block' and audit.reason_code = 'CMS_PUBLICATION_SCHEDULE_BLOCKED'
            and audit.target_id = pg_temp.s11_id('s-exp-3')),
  'each lease recovery is audited without an actor: three retries and one retries_exhausted block [P2-S11-AC-083]');
select ok(
  (select count(*) = 0 from platform_private.outbox_events where event_type = 'cms.publication.changed.v1')
    and (select count(*) = 0 from platform_private.cms_publication_versions),
  'claiming and recovering emit no publication event and append no lineage row [P2-S11-AC-084]');
insert into r11_snap(label, effects) values ('after-c1', pg_temp.p11_effects());
select pg_temp.p11_claim('c2');
select ok(pg_temp.r11_out('c2') = '00000:' and pg_temp.r11_resp('c2') = '[]'::jsonb
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'after-c1'),
  'a second claim finds nothing due (the claimed ones hold their leases, the recovered ones wait for their next attempt) and changes nothing [P2-S11-AC-082]');

-- ---------------------------------------------------------------------------
-- Batch bound and order: oldest due first, never more than `batch`.
-- ---------------------------------------------------------------------------
select pg_temp.p11_approved(tag) from (values ('cl-b1'), ('cl-b2'), ('cl-b3')) as t(tag);
select pg_temp.p11_schedule_row('s-b1', 'cl-b1', jsonb_build_object('resolved_at_utc', date_trunc('second', clock_timestamp()) - interval '30 minutes',
  'local_datetime', (date_trunc('second', clock_timestamp()) - interval '30 minutes') at time zone 'UTC'));
select pg_temp.p11_schedule_row('s-b2', 'cl-b2', jsonb_build_object('resolved_at_utc', date_trunc('second', clock_timestamp()) - interval '20 minutes',
  'local_datetime', (date_trunc('second', clock_timestamp()) - interval '20 minutes') at time zone 'UTC'));
select pg_temp.p11_schedule_row('s-b3', 'cl-b3', jsonb_build_object('resolved_at_utc', date_trunc('second', clock_timestamp()) - interval '10 minutes',
  'local_datetime', (date_trunc('second', clock_timestamp()) - interval '10 minutes') at time zone 'UTC'));
select pg_temp.p11_claim('c3', '2'::jsonb);
select ok(
  jsonb_array_length(pg_temp.r11_resp('c3')) = 2
    and pg_temp.r11_resp('c3')->0->>'scheduleId' = pg_temp.s11_id('s-b1')::text
    and pg_temp.r11_resp('c3')->1->>'scheduleId' = pg_temp.s11_id('s-b2')::text
    and pg_temp.p11_sched('s-b3') = 'pending/1/0/-/-',
  'a batch of 2 claims the two OLDEST due schedules in (resolved instant, id) order and leaves the third pending [P2-S11-AC-082]');
select pg_temp.p11_claim('c4', '100'::jsonb);
select ok(jsonb_array_length(pg_temp.r11_resp('c4')) = 1 and pg_temp.r11_resp('c4')->0->>'scheduleId' = pg_temp.s11_id('s-b3')::text,
  'the next claim takes the remaining one; a claimed schedule is never claimed twice [P2-S11-AC-082]');

-- A recovered schedule becomes claimable once its next attempt is due.
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set next_attempt_at = clock_timestamp() - interval '1 second' where id = %L$$,
  pg_temp.s11_id('s-exp-1')));
select pg_temp.p11_claim('c5');
select ok(jsonb_array_length(pg_temp.r11_resp('c5')) = 1 and pg_temp.r11_resp('c5')->0->>'scheduleId' = pg_temp.s11_id('s-exp-1')::text
    and pg_temp.p11_sched('s-exp-1') = 'executing/4/2/-/lease',
  'a recovered schedule is claimed again once its next attempt is due, keeping its attempt count [P2-S11-AC-083]');

select * from finish();
rollback;
