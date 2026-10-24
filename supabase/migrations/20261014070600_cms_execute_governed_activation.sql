-- Slice 12 lane governed-b, CMS-03C-19 execute (BE03c Internal service operations, "Scheduled activation (OD-6)", Slice 12 lock order, DEC-120,
-- DEC-157; mirrors CMS-03B-20 / 20261005017740; tracker P2-S12-AC-143, AC-146, AC-150 .. AC-153): platform_private.cms_execute_governed_activation(
-- p_request jsonb) returns jsonb (the platform_api wrapper is 20261014070610).  Request { scheduleId, expectedVersion, leaseId } where
-- expectedVersion is the APPROVED REVIEW version the schedule relied on (the claim's expectedVersion; NOT 03b's scheduleVersion); the executing
-- state, the claim's lease id (re-proved under the schedule row lock) and the schedule row's own version CAS are the fence.  Answer: a strict GovernedActivationExecutionResult
-- { scheduleId, outcome, reasonCode, actualUtc, deviationSeconds } with outcome completed | blocked | failed_retryable | already_completed.
--   0. structure (INVALID_REQUEST); an absent schedule is NOT_FOUND; a `completed` schedule answers already_completed with no effect;
--   1. a schedule that is not executing or whose lease is not the presented one is CONFLICT (an expired but unrecovered lease still matches:
--      as in CMS-03B-20 the schedule row lock, re-proved below, is the fence and the claim's recovery skips a row the executor holds);
--      a review version that is not the one the schedule relied on is VERSION_MISMATCH;
--   2. locks (BE03c order): the schedule creator's authority rows FOR SHARE (1), the subject row (3) and the lineage's current active row, the
--      dependency graph and bound content types (3-4), the review row (5), the schedule row (6, the lease re-proved) and last the lineage advisory lock;
--   3. terminal blocks (schedule blocked, subject scheduled -> blocked, the review untouched): approval_invalidated (the review is no longer
--      approved at the relied-on version, the subject no longer scheduled or its hash changed, or the live approvals fell short),
--      activation_authority_ended (the creator's designer or curator grant, DEC-120; MFA is not rechecked), canonical_source_unavailable and
--      dependency_changed (the recheck); a NULL workflow-policy evidence (DEPENDENCY_UNAVAILABLE) and an activation_conflict on the lineage are
--      retryable: attempt_count + 1 and the 15 s / 60 s / 300 s ladder, the fourth consecutive failure blocks retries_exhausted;
--   4. otherwise the activation switch (cms_governed_apply_activation: supersession, activation, one audit record, exactly one event) and the
--      schedule completes with actual_at_utc and the signed deviation in seconds (a late run activates and records it).
-- Private; forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_schedule_result(
  p_schedule_id uuid, p_outcome text, p_reason text, p_actual timestamptz, p_deviation bigint
)
returns jsonb
language sql
stable
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'scheduleId', p_schedule_id, 'outcome', p_outcome, 'reasonCode', p_reason,
    'actualUtc', case when p_actual is null then null else platform_private.auth_iso_time(p_actual) end,
    'deviationSeconds', p_deviation)
$body$;

create or replace function platform_private.cms_governed_schedule_blocked_result(
  p_schedule platform_private.cms_governed_activation_schedules, p_reason text, p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_governed_schedule_block(p_schedule.id, p_schedule.version, p_reason, p_correlation_id);
  perform platform_private.cms_governed_block_scheduled_subject(p_schedule.subject_kind, p_schedule.subject_id);
  return platform_private.cms_governed_schedule_result(p_schedule.id, 'blocked', p_reason, null, null);
end;
$body$;

create or replace function platform_private.cms_governed_schedule_retry_result(
  p_schedule platform_private.cms_governed_activation_schedules, p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
begin
  if platform_private.cms_governed_schedule_record_failure(p_schedule.id, p_schedule.version, p_correlation_id) = 'blocked' then
    perform platform_private.cms_governed_block_scheduled_subject(p_schedule.subject_kind, p_schedule.subject_id);
    return platform_private.cms_governed_schedule_result(p_schedule.id, 'blocked', 'retries_exhausted', null, null);
  end if;
  return platform_private.cms_governed_schedule_result(p_schedule.id, 'failed_retryable', null, null, null);
end;
$body$;

create or replace function platform_private.cms_execute_governed_activation(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_schedule_id uuid;
  v_expected bigint;
  v_lease uuid;
  v_schedule platform_private.cms_governed_activation_schedules%rowtype;
  v_review platform_private.cms_governed_reviews%rowtype;
  v_subject jsonb;
  v_capability text;
  v_correlation uuid;
  v_verdict text;
  v_active uuid;
  v_actual timestamptz;
  v_deviation bigint;
  v_retry boolean := false;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- 0. structure
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['scheduleId', 'expectedVersion', 'leaseId']::text[], array['scheduleId', 'expectedVersion', 'leaseId']::text[])
     or pg_catalog.jsonb_typeof(p_request->'scheduleId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'scheduleId') is not true
     or pg_catalog.jsonb_typeof(p_request->'leaseId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'leaseId') is not true
     or pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19 and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_schedule_id := (p_request->>'scheduleId')::uuid;
  v_lease := (p_request->>'leaseId')::uuid;
  v_expected := (p_request->>'expectedVersion')::bigint;

  -- 1. idempotency and the fence (unlocked first look; rechecked under the lock)
  select schedule_item.* into v_schedule from platform_private.cms_governed_activation_schedules schedule_item
   where schedule_item.id = v_schedule_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_schedule.state = 'completed' then
    return platform_private.cms_governed_schedule_result(
      v_schedule.id, 'already_completed', null, v_schedule.actual_at_utc, v_schedule.deviation_seconds);
  end if;
  if v_schedule.state <> 'executing' or v_schedule.lease_id is distinct from v_lease then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if v_schedule.expected_version <> v_expected then
    perform platform_private.cms_raise_version_mismatch(v_expected, v_schedule.expected_version);
  end if;

  -- 2. locks: creator's authority (1), subject and lineage active row (3), graph (3-4), review (5), schedule (6), advisory lock last
  v_capability := platform_private.cms_governed_owner_capability(v_schedule.subject_kind);
  perform platform_private.cms_lock_person_authority(
    v_schedule.owner_id, array[v_schedule.created_by]::uuid[], array[v_capability]::text[]);
  v_subject := platform_private.cms_governed_subject_resolve(v_schedule.subject_kind, v_schedule.subject_id, true);
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_active := platform_private.cms_governed_lock_lineage_active(
    v_schedule.subject_kind, (v_subject->>'lineageId')::uuid, v_schedule.subject_id);
  perform platform_private.cms_governed_lock_graph(v_schedule.subject_kind, v_schedule.owner_id, v_subject);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = v_schedule.review_id for update;
  select schedule_item.* into v_schedule from platform_private.cms_governed_activation_schedules schedule_item
   where schedule_item.id = v_schedule_id for update;
  if v_schedule.state = 'completed' then
    return platform_private.cms_governed_schedule_result(
      v_schedule.id, 'already_completed', null, v_schedule.actual_at_utc, v_schedule.deviation_seconds);
  end if;
  if v_schedule.state <> 'executing' or v_schedule.lease_id is distinct from v_lease then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  v_correlation := platform_private.cms_schedule_correlation(v_schedule.id, v_schedule.lease_id);

  -- 3. terminal blocks and the retryable class
  if v_review.state <> 'approved' or v_review.version <> v_schedule.expected_version
     or v_subject->>'state' <> 'scheduled' or v_subject->>'contentHash' is distinct from v_review.subject_hash::text then
    return platform_private.cms_governed_schedule_blocked_result(v_schedule, 'approval_invalidated', v_correlation);
  end if;
  if not platform_private.cms_person_holds_capability(v_schedule.owner_id, v_schedule.created_by, v_capability) then
    return platform_private.cms_governed_schedule_blocked_result(v_schedule, 'activation_authority_ended', v_correlation);
  end if;
  begin
    v_verdict := platform_private.cms_governed_activation_verdict(v_review.id);
  exception when raise_exception then
    if sqlerrm = 'DEPENDENCY_UNAVAILABLE' then
      v_retry := true;
    else
      raise;
    end if;
  end;
  if v_retry then
    return platform_private.cms_governed_schedule_retry_result(v_schedule, v_correlation);
  end if;
  if v_verdict <> 'current' then
    return platform_private.cms_governed_schedule_blocked_result(v_schedule, v_verdict, v_correlation);
  end if;

  -- 4. the lineage advisory lock last, the re-read without a row lock (BE03c 1338), then the switch and the schedule CAS
  perform platform_private.cms_governed_take_lineage_advisory(v_schedule.subject_kind, v_review.lineage_id);
  if platform_private.cms_governed_read_lineage_active(
       v_schedule.subject_kind, v_review.lineage_id, v_schedule.subject_id) is distinct from v_active then
    return platform_private.cms_governed_schedule_retry_result(v_schedule, v_correlation);
  end if;
  v_actual := pg_catalog.clock_timestamp();
  begin
    perform platform_private.cms_governed_apply_activation(v_review.id, null, v_review.owner_id, v_correlation, v_actual);
  exception when raise_exception then
    if sqlerrm = 'activation_conflict' then
      v_retry := true;
    else
      raise;
    end if;
  end;
  if v_retry then
    return platform_private.cms_governed_schedule_retry_result(v_schedule, v_correlation);
  end if;
  v_deviation := pg_catalog.round(pg_catalog.date_part('epoch', v_actual - v_schedule.resolved_at_utc))::bigint;
  update platform_private.cms_governed_activation_schedules schedule_item
     set state = 'completed', actual_at_utc = v_actual, deviation_seconds = v_deviation,
         lease_id = null, lease_until = null, next_attempt_at = null,
         version = schedule_item.version + 1, updated_at = v_actual
   where schedule_item.id = v_schedule.id and schedule_item.version = v_schedule.version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  return platform_private.cms_governed_schedule_result(v_schedule.id, 'completed', null, v_actual, v_deviation);
end;
$body$;

comment on function platform_private.cms_execute_governed_activation(jsonb) is
  'CMS-03C-19 execute: re-reads the approved review (at the version the schedule relied on), the scheduled subject and every frozen identity, rechecks the creator''s designer or curator grant (DEC-120, no MFA recheck), then applies the activation switch (one event) and completes the schedule with its actual instant and signed deviation, or blocks it (closed reason, the subject blocked) or retries it (15 s / 60 s / 300 s, then retries_exhausted). Idempotent: a completed schedule answers already_completed. Private; the Worker scheduled sweep calls the platform_api wrapper.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_schedule_result(uuid, text, text, timestamptz, bigint) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_schedule_blocked_result(platform_private.cms_governed_activation_schedules, text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_schedule_retry_result(platform_private.cms_governed_activation_schedules, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_execute_governed_activation(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_schedule_result(uuid, text, text, timestamptz, bigint),
  platform_private.cms_governed_schedule_blocked_result(platform_private.cms_governed_activation_schedules, text, uuid),
  platform_private.cms_governed_schedule_retry_result(platform_private.cms_governed_activation_schedules, uuid),
  platform_private.cms_execute_governed_activation(jsonb)
  from public, anon, authenticated, service_role;

commit;
