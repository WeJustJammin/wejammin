-- CMS-03B-20 (BE03b "Schedule execution", DEC-159 (5); tracker P2-S11-AC-082, AC-083, AC-101): the schedule
-- failure helpers that answer the EXACT audit event they wrote.
--
-- The executor summarizes a verified accessibility proof whichever way an execution ends, and the summary is keyed
-- to the audit event of that outcome (cms_command_accessibility_evidence.audit_event_id).  A blocked or retried
-- execution writes its audit record inside cms_schedule_block / cms_schedule_record_failure, so those helpers (and
-- the *_result wrappers the executor calls) take an optional audit event id and write the record with
-- cms_record_audit_event.  The existing signatures stay and delegate with a fresh id, so the claim (which spends
-- a retry for an expired lease) and the early blocked returns of the executor are unchanged.
--
--   cms_schedule_record_failure(schedule, version, correlation, audit_event)   the ladder, one audit record
--   cms_schedule_block(schedule, version, reason, correlation, audit_event)    a closed-reason block, one audit record
--   cms_schedule_blocked_result(schedule, reason, correlation, audit_event)    the blocked ScheduleExecutionResult
--   cms_schedule_retry_result(schedule, correlation, audit_event)              the failed_retryable / retries_exhausted result
--
-- Private; the bodies are those of 20261005017730 with the audit write replaced.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_schedule_record_failure(
  p_schedule_id uuid,
  p_expected_version bigint,
  p_correlation_id uuid,
  p_audit_event_id uuid
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
    perform platform_private.cms_record_audit_event(
      'cms.publication.schedule.block', null, schedule_row.owner_id, 'cms_publication_schedule',
      schedule_row.id, 'CMS_PUBLICATION_SCHEDULE_BLOCKED', p_correlation_id, p_audit_event_id);
    return 'blocked';
  end if;
  update platform_private.cms_publication_schedules schedule_item
     set state = 'failed_retryable', attempt_count = failure_number,
         next_attempt_at = stamp + platform_private.cms_schedule_retry_delay(failure_number),
         lease_id = null, lease_until = null, version = schedule_item.version + 1, updated_at = stamp
   where schedule_item.id = schedule_row.id;
  perform platform_private.cms_record_audit_event(
    'cms.publication.schedule.retry', null, schedule_row.owner_id, 'cms_publication_schedule',
    schedule_row.id, 'CMS_PUBLICATION_SCHEDULE_RETRY', p_correlation_id, p_audit_event_id);
  return 'failed_retryable';
end;
$body$;

comment on function platform_private.cms_schedule_record_failure(uuid, bigint, uuid, uuid) is
  'BE03b Retry ladder: an executing schedule failed retryably. Releases the lease and either schedules the retry (attempt_count + 1, next_attempt_at = now + 15 s / 60 s / 300 s) or, when three attempts are spent, blocks it with retries_exhausted. One audit record, written with the caller-chosen id (NULL = a fresh one). Answers failed_retryable or blocked. Private.';

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
begin
  return platform_private.cms_schedule_record_failure(
    p_schedule_id, p_expected_version, p_correlation_id, null::uuid);
end;
$body$;

create or replace function platform_private.cms_schedule_block(
  p_schedule_id uuid,
  p_expected_version bigint,
  p_reason_code text,
  p_correlation_id uuid,
  p_audit_event_id uuid
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
  perform platform_private.cms_record_audit_event(
    'cms.publication.schedule.block', null, schedule_row.owner_id, 'cms_publication_schedule',
    schedule_row.id, 'CMS_PUBLICATION_SCHEDULE_BLOCKED', p_correlation_id, p_audit_event_id);
end;
$body$;

comment on function platform_private.cms_schedule_block(uuid, bigint, text, uuid, uuid) is
  'BE03b Schedule execution: an executing schedule ends blocked with a closed reason code (approval_invalidated, preflight_failed, publisher_authority_ended, publication_not_active or retries_exhausted); releases the lease; one audit record, written with the caller-chosen id (NULL = a fresh one). Private.';

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
begin
  perform platform_private.cms_schedule_block(
    p_schedule_id, p_expected_version, p_reason_code, p_correlation_id, null::uuid);
end;
$body$;

create or replace function platform_private.cms_schedule_blocked_result(
  p_schedule platform_private.cms_publication_schedules,
  p_reason_code text,
  p_correlation_id uuid,
  p_audit_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_schedule_block(
    p_schedule.id, p_schedule.version, p_reason_code, p_correlation_id, p_audit_event_id);
  return pg_catalog.jsonb_build_object(
    'scheduleId', p_schedule.id, 'outcome', 'blocked', 'reasonCode', p_reason_code,
    'publicationVersionId', null, 'actualUtc', null, 'deviationSeconds', null);
end;
$body$;

comment on function platform_private.cms_schedule_blocked_result(platform_private.cms_publication_schedules, text, uuid, uuid) is
  'BE03b CMS-03B-20: blocks the executing schedule with a closed reason code (its one audit record carries the caller-chosen id) and answers the blocked ScheduleExecutionResult (the prior publication stays intact). Private.';

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
  return platform_private.cms_schedule_blocked_result(
    p_schedule, p_reason_code, p_correlation_id, null::uuid);
end;
$body$;

create or replace function platform_private.cms_schedule_retry_result(
  p_schedule platform_private.cms_publication_schedules,
  p_correlation_id uuid,
  p_audit_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if platform_private.cms_schedule_record_failure(
       p_schedule.id, p_schedule.version, p_correlation_id, p_audit_event_id) = 'blocked' then
    return pg_catalog.jsonb_build_object(
      'scheduleId', p_schedule.id, 'outcome', 'blocked', 'reasonCode', 'retries_exhausted',
      'publicationVersionId', null, 'actualUtc', null, 'deviationSeconds', null);
  end if;
  return pg_catalog.jsonb_build_object(
    'scheduleId', p_schedule.id, 'outcome', 'failed_retryable', 'reasonCode', null,
    'publicationVersionId', null, 'actualUtc', null, 'deviationSeconds', null);
end;
$body$;

comment on function platform_private.cms_schedule_retry_result(platform_private.cms_publication_schedules, uuid, uuid) is
  'BE03b CMS-03B-20 retry ladder: records a retryable failure of the executing schedule (its one audit record carries the caller-chosen id) and answers failed_retryable, or blocked retries_exhausted when three attempts are spent. Private.';

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
  return platform_private.cms_schedule_retry_result(p_schedule, p_correlation_id, null::uuid);
end;
$body$;

-- SEC-2: new overloads are owned by the CMS definer with no API-role execute; the replaced wrappers keep theirs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_schedule_record_failure(uuid, bigint, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_block(uuid, bigint, text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_blocked_result(platform_private.cms_publication_schedules, text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_retry_result(platform_private.cms_publication_schedules, uuid, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function
  platform_private.cms_schedule_record_failure(uuid, bigint, uuid, uuid),
  platform_private.cms_schedule_block(uuid, bigint, text, uuid, uuid),
  platform_private.cms_schedule_blocked_result(platform_private.cms_publication_schedules, text, uuid, uuid),
  platform_private.cms_schedule_retry_result(platform_private.cms_publication_schedules, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
