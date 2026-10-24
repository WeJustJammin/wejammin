-- Slice 12 lane governed-b, CMS-03C-19 claim (BE03c Internal service operations, "Scheduled activation (OD-6)", Slice 12 lock order; mirrors
-- CMS-03B-20 / 20261005017730; tracker P2-S12-AC-142, AC-149): platform_private.cms_claim_due_governed_activations(p_request jsonb) returns jsonb
-- (the platform_api wrapper is 20261014070510).  Request { batch: integer 1..100 }; answer: at most `batch` ClaimedGovernedActivation records
-- { scheduleId, reviewId, subjectKind, subjectId, scheduleVersion, expectedVersion, leaseId, correlationId } (identifiers and versions only).
--   1. every `executing` schedule whose lease expired (lease_until <= now) is first returned to failed_retryable with attempt_count + 1 (or blocked
--      retries_exhausted at the fourth failure, the scheduled subject then blocked), oldest lease first, FOR UPDATE SKIP LOCKED, at most 100 per call.
--      A schedule that would exhaust is recovered only if its subject row (position 3) can be taken without waiting: the claim holds a schedule
--      row (position 6) and never waits on an earlier position (an unavailable subject leaves the schedule for the next claim).  This subject
--      take deviates from the BE03c lock-order row "schedule rows only" and is a root-ratified implementation decision: without it a lease
--      that exhausts the ladder at the claim would strand the subject in `scheduled` with no live schedule;
--   2. the due `pending` schedules (resolved_at_utc <= now) and `failed_retryable` schedules (next_attempt_at <= now), ordered by
--      (resolved_at_utc, id), are locked FOR UPDATE SKIP LOCKED and moved to `executing` under the version CAS (version + 1) with a new
--      lease_id and lease_until = now + 5 minutes.
-- Private; forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_claim_due_governed_activations(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_batch integer;
  v_expired record;
  v_claimed jsonb;
  v_stamp timestamptz;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(p_request, array['batch']::text[], array['batch']::text[])
     or pg_catalog.jsonb_typeof(p_request->'batch') is distinct from 'number'
     or p_request->>'batch' !~ '^[1-9][0-9]{0,2}$'
     or (p_request->>'batch')::integer > 100 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_batch := (p_request->>'batch')::integer;

  -- 1. expired leases first
  for v_expired in
    select schedule_item.id, schedule_item.version, schedule_item.lease_id, schedule_item.attempt_count,
           schedule_item.subject_kind, schedule_item.subject_id
      from platform_private.cms_governed_activation_schedules schedule_item
     where schedule_item.state = 'executing' and schedule_item.lease_until <= pg_catalog.clock_timestamp()
     order by schedule_item.lease_until, schedule_item.id
     limit 100
       for update skip locked
  loop
    if v_expired.attempt_count >= 3 then
      if not platform_private.cms_governed_try_lock_subject(v_expired.subject_kind, v_expired.subject_id) then
        continue;
      end if;
      if platform_private.cms_governed_schedule_record_failure(
           v_expired.id, v_expired.version,
           platform_private.cms_schedule_correlation(v_expired.id, v_expired.lease_id)) = 'blocked' then
        perform platform_private.cms_governed_block_scheduled_subject(v_expired.subject_kind, v_expired.subject_id);
      end if;
    else
      perform platform_private.cms_governed_schedule_record_failure(
        v_expired.id, v_expired.version,
        platform_private.cms_schedule_correlation(v_expired.id, v_expired.lease_id));
    end if;
  end loop;

  -- 2. claim the due schedules under SKIP LOCKED and the version CAS
  v_stamp := pg_catalog.clock_timestamp();
  with due as (
    select schedule_item.id
      from platform_private.cms_governed_activation_schedules schedule_item
     where (schedule_item.state = 'pending' and schedule_item.resolved_at_utc <= v_stamp)
        or (schedule_item.state = 'failed_retryable' and schedule_item.next_attempt_at <= v_stamp)
     order by schedule_item.resolved_at_utc, schedule_item.id
     limit v_batch
       for update skip locked
  ), moved as (
    update platform_private.cms_governed_activation_schedules schedule_item
       set state = 'executing', version = schedule_item.version + 1,
           lease_id = extensions.gen_random_uuid(), lease_until = v_stamp + interval '5 minutes',
           next_attempt_at = null, updated_at = v_stamp
      from due
     where schedule_item.id = due.id
    returning schedule_item.id, schedule_item.review_id, schedule_item.subject_kind, schedule_item.subject_id,
              schedule_item.version, schedule_item.expected_version, schedule_item.lease_id, schedule_item.resolved_at_utc
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'scheduleId', moved.id,
           'reviewId', moved.review_id,
           'subjectKind', moved.subject_kind,
           'subjectId', moved.subject_id,
           'scheduleVersion', moved.version::text,
           'expectedVersion', moved.expected_version::text,
           'leaseId', moved.lease_id,
           'correlationId', platform_private.cms_schedule_correlation(moved.id, moved.lease_id)
         ) order by moved.resolved_at_utc, moved.id), '[]'::jsonb)
    into v_claimed
    from moved;
  return v_claimed;
end;
$body$;

comment on function platform_private.cms_claim_due_governed_activations(jsonb) is
  'CMS-03C-19 claim: returns expired leases to failed_retryable (attempt_count + 1, or blocked retries_exhausted and the subject blocked), then moves up to batch due pending / failed_retryable schedules to executing under FOR UPDATE SKIP LOCKED and the version CAS with a new five-minute lease, answering strict ClaimedGovernedActivation records (identifiers and versions only). Private; the Worker scheduled sweep calls the platform_api wrapper.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_claim_due_governed_activations(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_claim_due_governed_activations(jsonb)
  from public, anon, authenticated, service_role;

commit;
