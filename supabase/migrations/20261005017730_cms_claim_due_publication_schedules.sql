-- Slice 11 lane S11-3b, CMS-03B-20 claim (BE03b "Schedule execution (CMS-03B-20)", "Internal service
-- operations", DEC-156, DEC-157; tracker P2-S11-AC-079 .. AC-084): the schedule state helpers shared by the
-- claim and the executor, and platform_private.cms_claim_due_publication_schedules(p_request jsonb) returns
-- jsonb with the platform_api wrapper the Worker `scheduled` sweep calls (service_role only; never a browser
-- route).
--
--   cms_schedule_correlation(schedule, lease)   the deterministic correlation id of one claimed execution
--       (the claim returns it, the executor re-derives it: the Worker passes only the lease)
--   cms_schedule_retry_delay(failure number)    the retry ladder: 15 s, 60 s, 300 s after the first, second and
--       third consecutive retryable failure; NULL beyond (the fourth failure blocks)
--   cms_schedule_record_failure(schedule, version, correlation)
--       an `executing` schedule failed retryably: attempt_count + 1 and next_attempt_at = now + ladder, or, when
--       three attempts are already spent, `blocked` with reason retries_exhausted; the lease is released; one
--       audit record; answers 'failed_retryable' | 'blocked'
--   cms_schedule_block(schedule, version, reason, correlation)
--       an `executing` schedule ends `blocked` with a closed reason code; the lease is released; one audit record
--   cms_schedule_completed_result / cms_schedule_blocked_result / cms_schedule_retry_result
--       the strict ScheduleExecutionResult of the already_completed, blocked and failed_retryable outcomes
--
-- The claim, in one transaction (request { batch: integer 1..100 }; at most batch ClaimedSchedule records):
--   1. every `executing` schedule whose lease expired (lease_until <= now) is first returned to failed_retryable
--      with attempt_count + 1 (or blocked retries_exhausted at the fourth failure), oldest lease first, FOR UPDATE
--      SKIP LOCKED, at most 100 per call;
--   2. the due `pending` schedules (resolved_at_utc <= now) and `failed_retryable` schedules
--      (next_attempt_at <= now), ordered by (resolved_at_utc, id), are locked FOR UPDATE SKIP LOCKED (two
--      sweepers never take the same row), moved to `executing` under the version CAS (version + 1) with a new
--      lease_id and lease_until = now + 5 minutes, and bound once to a job id;
--   3. each is answered as a strict ClaimedSchedule: identifiers, versions and hashes only, never content.
-- The claim takes position 6 of the global lock order only and acquires nothing earlier after claiming.
-- Private; forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_schedule_correlation(p_schedule_id uuid, p_lease_id uuid)
returns uuid
language sql
immutable
set search_path = ''
as $body$
  select (pg_catalog.substr(digest.hex, 1, 8) || '-' || pg_catalog.substr(digest.hex, 9, 4) || '-4'
          || pg_catalog.substr(digest.hex, 13, 3) || '-8' || pg_catalog.substr(digest.hex, 16, 3) || '-'
          || pg_catalog.substr(digest.hex, 19, 12))::uuid
    from (select pg_catalog.md5(
                   'cms.publication.schedule:' || p_schedule_id::text || ':' || p_lease_id::text) as hex) digest
$body$;

comment on function platform_private.cms_schedule_correlation(uuid, uuid) is
  'BE03b CMS-03B-20: the deterministic correlation id (a version-4 shaped UUID derived from the schedule and its lease) of one claimed execution. Private; IMMUTABLE.';

create or replace function platform_private.cms_schedule_retry_delay(p_failure_number integer)
returns interval
language sql
immutable
set search_path = ''
as $body$
  select case p_failure_number
           when 1 then interval '15 seconds'
           when 2 then interval '60 seconds'
           when 3 then interval '300 seconds'
         end
$body$;

comment on function platform_private.cms_schedule_retry_delay(integer) is
  'BE03b Retry ladder: the delay before the retry that follows the Nth consecutive retryable failure (15 s, 60 s, 300 s for N = 1, 2, 3); NULL beyond, where the fourth failure blocks the schedule. Private; IMMUTABLE.';

create or replace function platform_private.cms_schedule_record_failure(
  p_schedule_id uuid,
  p_expected_version bigint,
  p_correlation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  schedule_row platform_private.cms_publication_schedules%rowtype;
  failure_number integer;
  stamp timestamptz := pg_catalog.clock_timestamp();
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select schedule_item.* into schedule_row
    from platform_private.cms_publication_schedules schedule_item
   where schedule_item.id = p_schedule_id
     for update;
  if not found or schedule_row.state <> 'executing' or schedule_row.version <> p_expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  failure_number := schedule_row.attempt_count + 1;
  if failure_number > 3 then
    update platform_private.cms_publication_schedules schedule_item
       set state = 'blocked', reason_code = 'retries_exhausted', lease_id = null, lease_until = null,
           next_attempt_at = null, version = schedule_item.version + 1, updated_at = stamp
     where schedule_item.id = schedule_row.id;
    perform platform_private.cms_record_audit(
      'cms.publication.schedule.block', null, schedule_row.owner_id, 'cms_publication_schedule',
      schedule_row.id, 'CMS_PUBLICATION_SCHEDULE_BLOCKED', p_correlation_id);
    return 'blocked';
  end if;
  update platform_private.cms_publication_schedules schedule_item
     set state = 'failed_retryable', attempt_count = failure_number,
         next_attempt_at = stamp + platform_private.cms_schedule_retry_delay(failure_number),
         lease_id = null, lease_until = null, version = schedule_item.version + 1, updated_at = stamp
   where schedule_item.id = schedule_row.id;
  perform platform_private.cms_record_audit(
    'cms.publication.schedule.retry', null, schedule_row.owner_id, 'cms_publication_schedule',
    schedule_row.id, 'CMS_PUBLICATION_SCHEDULE_RETRY', p_correlation_id);
  return 'failed_retryable';
end;
$body$;

comment on function platform_private.cms_schedule_record_failure(uuid, bigint, uuid) is
  'BE03b Retry ladder: an executing schedule failed retryably. Releases the lease and either schedules the retry (attempt_count + 1, next_attempt_at = now + 15 s / 60 s / 300 s) or, when three attempts are spent, blocks it with retries_exhausted. One audit record. Answers failed_retryable or blocked. Private.';

create or replace function platform_private.cms_schedule_block(
  p_schedule_id uuid,
  p_expected_version bigint,
  p_reason_code text,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  schedule_row platform_private.cms_publication_schedules%rowtype;
  stamp timestamptz := pg_catalog.clock_timestamp();
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_reason_code not in ('approval_invalidated', 'preflight_failed', 'publisher_authority_ended',
                           'publication_not_active', 'retries_exhausted') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select schedule_item.* into schedule_row
    from platform_private.cms_publication_schedules schedule_item
   where schedule_item.id = p_schedule_id
     for update;
  if not found or schedule_row.state <> 'executing' or schedule_row.version <> p_expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_publication_schedules schedule_item
     set state = 'blocked', reason_code = p_reason_code, lease_id = null, lease_until = null,
         next_attempt_at = null, version = schedule_item.version + 1, updated_at = stamp
   where schedule_item.id = schedule_row.id;
  perform platform_private.cms_record_audit(
    'cms.publication.schedule.block', null, schedule_row.owner_id, 'cms_publication_schedule',
    schedule_row.id, 'CMS_PUBLICATION_SCHEDULE_BLOCKED', p_correlation_id);
end;
$body$;

comment on function platform_private.cms_schedule_block(uuid, bigint, text, uuid) is
  'BE03b Schedule execution: an executing schedule ends blocked with a closed reason code (approval_invalidated, preflight_failed, publisher_authority_ended, publication_not_active or retries_exhausted); releases the lease; one audit record. Private.';

create or replace function platform_private.cms_schedule_completed_result(p_schedule_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
           'scheduleId', schedule_item.id, 'outcome', 'already_completed', 'reasonCode', null,
           'publicationVersionId', (select row_item.id
                                      from platform_private.cms_publication_versions row_item
                                     where row_item.schedule_id = schedule_item.id
                                     order by row_item.version desc limit 1),
           'actualUtc', platform_private.auth_iso_time(schedule_item.actual_at_utc),
           'deviationSeconds', schedule_item.deviation_seconds)
    from platform_private.cms_publication_schedules schedule_item
   where schedule_item.id = p_schedule_id
$body$;

comment on function platform_private.cms_schedule_completed_result(uuid) is
  'BE03b CMS-03B-20: the already_completed ScheduleExecutionResult of a completed schedule (the lineage row it appended, its actual instant and its deviation); a repeated execution has no other effect. Private; STABLE.';

create or replace function platform_private.cms_schedule_blocked_result(
  p_schedule platform_private.cms_publication_schedules,
  p_reason_code text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_schedule_block(p_schedule.id, p_schedule.version, p_reason_code, p_correlation_id);
  return pg_catalog.jsonb_build_object(
    'scheduleId', p_schedule.id, 'outcome', 'blocked', 'reasonCode', p_reason_code,
    'publicationVersionId', null, 'actualUtc', null, 'deviationSeconds', null);
end;
$body$;

comment on function platform_private.cms_schedule_blocked_result(platform_private.cms_publication_schedules, text, uuid) is
  'BE03b CMS-03B-20: blocks the executing schedule with a closed reason code and answers the blocked ScheduleExecutionResult (the prior publication stays intact). Private.';

create or replace function platform_private.cms_schedule_retry_result(
  p_schedule platform_private.cms_publication_schedules,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if platform_private.cms_schedule_record_failure(p_schedule.id, p_schedule.version, p_correlation_id) = 'blocked' then
    return pg_catalog.jsonb_build_object(
      'scheduleId', p_schedule.id, 'outcome', 'blocked', 'reasonCode', 'retries_exhausted',
      'publicationVersionId', null, 'actualUtc', null, 'deviationSeconds', null);
  end if;
  return pg_catalog.jsonb_build_object(
    'scheduleId', p_schedule.id, 'outcome', 'failed_retryable', 'reasonCode', null,
    'publicationVersionId', null, 'actualUtc', null, 'deviationSeconds', null);
end;
$body$;

comment on function platform_private.cms_schedule_retry_result(platform_private.cms_publication_schedules, uuid) is
  'BE03b CMS-03B-20 retry ladder: records a retryable failure of the executing schedule and answers failed_retryable, or blocked retries_exhausted when three attempts are spent. Private.';

create or replace function platform_private.cms_claim_due_publication_schedules(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  batch_size integer;
  expired record;
  claimed jsonb;
  stamp timestamptz;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(p_request, array['batch']::text[], array['batch']::text[])
     or pg_catalog.jsonb_typeof(p_request->'batch') is distinct from 'number'
     or p_request->>'batch' !~ '^[1-9][0-9]{0,2}$'
     or (p_request->>'batch')::integer > 100 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  batch_size := (p_request->>'batch')::integer;

  -- 1. expired leases first: failed_retryable with attempt_count + 1, or blocked at the fourth failure
  for expired in
    select schedule_item.id, schedule_item.version, schedule_item.lease_id
      from platform_private.cms_publication_schedules schedule_item
     where schedule_item.state = 'executing'
       and schedule_item.lease_until <= pg_catalog.clock_timestamp()
     order by schedule_item.lease_until, schedule_item.id
     limit 100
       for update skip locked
  loop
    perform platform_private.cms_schedule_record_failure(
      expired.id, expired.version, platform_private.cms_schedule_correlation(expired.id, expired.lease_id));
  end loop;

  -- 2. claim the due schedules under SKIP LOCKED and the version CAS
  stamp := pg_catalog.clock_timestamp();
  with due as (
    select schedule_item.id
      from platform_private.cms_publication_schedules schedule_item
     where (schedule_item.state = 'pending' and schedule_item.resolved_at_utc <= stamp)
        or (schedule_item.state = 'failed_retryable' and schedule_item.next_attempt_at <= stamp)
     order by schedule_item.resolved_at_utc, schedule_item.id
     limit batch_size
       for update skip locked
  ), moved as (
    update platform_private.cms_publication_schedules schedule_item
       set state = 'executing', version = schedule_item.version + 1,
           lease_id = extensions.gen_random_uuid(), lease_until = stamp + interval '5 minutes',
           next_attempt_at = null, job_id = coalesce(schedule_item.job_id, extensions.gen_random_uuid()),
           updated_at = stamp
      from due
     where schedule_item.id = due.id
    returning schedule_item.id, schedule_item.revision_id, schedule_item.version, schedule_item.expected_version,
              schedule_item.lease_id, schedule_item.dependency_hash, schedule_item.activation_evidence_hash,
              schedule_item.resolved_at_utc
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'scheduleId', moved.id,
           'revisionId', moved.revision_id,
           'scheduleVersion', moved.version::text,
           'expectedVersion', moved.expected_version::text,
           'leaseId', moved.lease_id,
           'dependencyHash', moved.dependency_hash,
           'activationEvidenceHash', moved.activation_evidence_hash,
           'correlationId', platform_private.cms_schedule_correlation(moved.id, moved.lease_id)
         ) order by moved.resolved_at_utc, moved.id), '[]'::jsonb)
    into claimed
    from moved;
  return claimed;
end;
$body$;

comment on function platform_private.cms_claim_due_publication_schedules(jsonb) is
  'CMS-03B-20 claim: returns expired leases to failed_retryable (attempt_count + 1, or blocked retries_exhausted), then moves up to batch due pending / failed_retryable schedules to executing under FOR UPDATE SKIP LOCKED and the version CAS with a new five-minute lease, answering strict ClaimedSchedule records (identifiers, versions, hashes only). Private; the Worker scheduled sweep calls the platform_api wrapper.';

create or replace function platform_api.cms_claim_due_publication_schedules(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_claim_due_publication_schedules(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: what the helpers and the claim read and write, held by the definer role only.
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_schedule_correlation(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_retry_delay(integer) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_record_failure(uuid, bigint, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_block(uuid, bigint, text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_completed_result(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_blocked_result(platform_private.cms_publication_schedules, text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_retry_result(platform_private.cms_publication_schedules, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_claim_due_publication_schedules(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_claim_due_publication_schedules(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function
  platform_private.cms_schedule_correlation(uuid, uuid),
  platform_private.cms_schedule_retry_delay(integer),
  platform_private.cms_schedule_record_failure(uuid, bigint, uuid),
  platform_private.cms_schedule_block(uuid, bigint, text, uuid),
  platform_private.cms_schedule_completed_result(uuid),
  platform_private.cms_schedule_blocked_result(platform_private.cms_publication_schedules, text, uuid),
  platform_private.cms_schedule_retry_result(platform_private.cms_publication_schedules, uuid),
  platform_private.cms_claim_due_publication_schedules(jsonb),
  platform_api.cms_claim_due_publication_schedules(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_claim_due_publication_schedules(jsonb) to service_role;

commit;
