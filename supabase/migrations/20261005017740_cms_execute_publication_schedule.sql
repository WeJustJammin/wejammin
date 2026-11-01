-- Slice 11 lane S11-3b, CMS-03B-20 execute (BE03b "Schedule execution (CMS-03B-20)", DEC-120, DEC-157,
-- DEC-158(c)(d), DEC-159; tracker P2-S11-AC-079 .. AC-084): platform_private.cms_execute_publication_schedule(
-- p_request jsonb) returns jsonb, with the platform_api wrapper the Worker `scheduled` sweep calls
-- (service_role only; never a browser route).
--
-- Request { scheduleId, expectedVersion (the version the CLAIM produced), leaseId, evidence }, where
-- `evidence` is the Worker-verified accessibility PreflightEvidence or null (no proof: accessibility is
-- unavailable / checker_failed, never a pass).  Answer: a strict ScheduleExecutionResult
-- { scheduleId, outcome, reasonCode, publicationVersionId, actualUtc, deviationSeconds } whose outcome is
-- completed | blocked | failed_retryable | already_completed (cancellation happens only in the
-- review-invalidation transaction, DEC-158(d)).  Order, in one transaction:
--   0. structure (exact keys; INVALID_REQUEST); an absent schedule is NOT_FOUND;
--   1. idempotency: a `completed` schedule is answered `already_completed` with no effect; a schedule that is
--      not `executing`, or whose lease no longer matches, or whose version is not the claim's, is REFUSED with
--      no effect (CONFLICT / VERSION_MISMATCH): the lease and the version CAS are the fence;
--   2. global lock order (DEC-157): the entry row FOR SHARE (0), the schedule creator's authority rows (1), the
--      content-type version (4) and the schedule's review FOR UPDATE (5), then the schedule row FOR UPDATE (6)
--      with the lease and version rechecked, and the lineage advisory lock (7) inside the lineage append;
--   2'. the approved review is re-read: `approved`, its version equal to the schedule's expected_version and its
--      dependency hash and activation evidence hash equal to the schedule's; the frozen manifest must still be
--      current (a stale one invalidates the review dependency_changed).  Otherwise the schedule is `blocked` with
--      approval_invalidated;
--   3. authority (DEC-120): the schedule creator's cms.publisher grant must be unrevoked and not ended at the
--      fire instant, else `blocked` publisher_authority_ended; MFA freshness is never rechecked;
--   4. the execute-phase preflight (all 17 categories) with the verified proof: a failed category blocks
--      (preflight_failed), an unavailable one makes the schedule failed_retryable; stale or mis-bound proof
--      (DEC-158(c)) is retried the same way, never accepted;
--   5. the action is applied under the lineage rules (E3): publish appends the `active` head, unpublish / expire /
--      archive append a `revoked` tombstone; an absent `active` head blocks with publication_not_active; the
--      schedule becomes `completed` with actual_at_utc = now and deviation_seconds = round(actual - resolved): a
--      late run executes and records its deviation, it never skips the action;
--   6. the one cms.publication.changed.v1, the audit record and the schedule CAS commit together; whichever way a
--      verified proof ends the execution (completed, blocked or retried), its accessibility summary is recorded
--      with it (DEC-159 (5); a fresh effect id stands for the event of a blocked or retried outcome).
-- A retryable failure sets attempt_count + 1 and next_attempt_at = now + 15 s / 60 s / 300 s; the fourth
-- consecutive one blocks with retries_exhausted.  Private; forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_schedule_lock_review(p_review_id uuid, p_revision_id uuid)
returns platform_private.cms_editorial_reviews
language plpgsql
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  locked platform_private.cms_editorial_reviews%rowtype;
begin
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Position 4 (DEC-157): the content-type version before the review row.
  perform 1
    from platform_private.cms_content_type_versions version_item
   where version_item.id = revision_row.schema_version_id
     for share;
  -- Position 5: the schedule's own review (a newer review of the revision does not replace it).
  select review_item.* into locked
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = p_review_id
     and review_item.revision_id = p_revision_id
     for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return locked;
end;
$body$;

comment on function platform_private.cms_schedule_lock_review(uuid, uuid) is
  'BE03b global lock order positions 4-5 for the schedule executor: the revision''s content-type version FOR SHARE, then the schedule''s own review FOR UPDATE. Returns the locked row. Private.';

create or replace function platform_private.cms_execute_publication_schedule(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  requested_schedule uuid;
  expected_version bigint;
  requested_lease uuid;
  evidence jsonb;
  schedule_row platform_private.cms_publication_schedules%rowtype;
  review_row platform_private.cms_editorial_reviews%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  correlation_id uuid;
  fire_at timestamptz;
  report jsonb;
  failure_outcome text;
  lineage jsonb;
  version_set jsonb;
  published_id uuid;
  actual_at timestamptz;
  deviation bigint;
  event_ref uuid;
  result jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- 0. structure
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['scheduleId', 'expectedVersion', 'leaseId']::text[],
       array['scheduleId', 'expectedVersion', 'leaseId', 'evidence']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'scheduleId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'scheduleId') is not true
     or pg_catalog.jsonb_typeof(p_request->'leaseId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'leaseId') is not true
     or pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  evidence := p_request->'evidence';
  if pg_catalog.jsonb_typeof(evidence) = 'null' then
    evidence := null;
  elsif evidence is not null and pg_catalog.jsonb_typeof(evidence) <> 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_schedule := (p_request->>'scheduleId')::uuid;
  requested_lease := (p_request->>'leaseId')::uuid;
  expected_version := (p_request->>'expectedVersion')::bigint;

  -- 1. idempotency and the fence (unlocked first look; rechecked under the lock)
  select schedule_item.* into schedule_row
    from platform_private.cms_publication_schedules schedule_item
   where schedule_item.id = requested_schedule;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if schedule_row.state = 'completed' then
    return platform_private.cms_schedule_completed_result(schedule_row.id);
  end if;
  if schedule_row.state <> 'executing' or schedule_row.lease_id is distinct from requested_lease then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if schedule_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, schedule_row.version);
  end if;

  -- 2. global lock order: entry (0), the creator's authority (1), schema (4), review (5), schedule (6)
  perform 1
    from platform_private.cms_content_entries entry_item
   where entry_item.id = schedule_row.entry_id
     for share;
  perform platform_private.cms_lock_person_authority(
    schedule_row.owner_id, array[schedule_row.created_by]::uuid[], array['cms.publisher']::text[]);
  review_row := platform_private.cms_schedule_lock_review(schedule_row.review_id, schedule_row.revision_id);
  select schedule_item.* into schedule_row
    from platform_private.cms_publication_schedules schedule_item
   where schedule_item.id = requested_schedule
     for update;
  if schedule_row.state = 'completed' then
    return platform_private.cms_schedule_completed_result(schedule_row.id);
  end if;
  if schedule_row.state <> 'executing' or schedule_row.lease_id is distinct from requested_lease then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if schedule_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, schedule_row.version);
  end if;
  correlation_id := platform_private.cms_schedule_correlation(schedule_row.id, schedule_row.lease_id);
  fire_at := pg_catalog.clock_timestamp();
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = schedule_row.revision_id;

  -- 2'. the approved review, still exactly what the schedule relied on, with every frozen identity current
  if review_row.state <> 'approved' or review_row.version <> schedule_row.expected_version
     or review_row.dependency_hash <> schedule_row.dependency_hash
     or platform_private.cms_activation_evidence_hash(review_row.id) <> schedule_row.activation_evidence_hash
     or review_row.frozen_hash <> revision_row.payload_hash::text then
    return platform_private.cms_schedule_blocked_result(schedule_row, 'approval_invalidated', correlation_id);
  end if;
  if platform_private.cms_frozen_dependencies_status(review_row.revision_id, review_row.dependency_manifest)
     is distinct from 'current' then
    perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'reasonCode', 'dependency_changed', 'correlationId', correlation_id));
    return platform_private.cms_schedule_blocked_result(schedule_row, 'approval_invalidated', correlation_id);
  end if;

  -- 3. DEC-120: the creator's publisher grant at the fire instant (no MFA recheck)
  if not platform_private.cms_person_holds_capability(schedule_row.owner_id, schedule_row.created_by, 'cms.publisher') then
    return platform_private.cms_schedule_blocked_result(schedule_row, 'publisher_authority_ended', correlation_id);
  end if;

  -- 4. the execute-phase preflight registry with the verified proof
  begin
    report := platform_private.cms_evaluate_preflight(pg_catalog.jsonb_build_object(
      'phase', 'execute', 'revisionId', schedule_row.revision_id, 'actingPartyId', schedule_row.owner_id,
      'actorPersonId', schedule_row.created_by, 'effectiveAt', platform_private.auth_iso_time(fire_at),
      'reviewId', review_row.id, 'frozenManifest', review_row.dependency_manifest, 'evidence', evidence));
  exception
    when raise_exception then
      -- Stale or mis-bound proof (DEC-158(c)) is never accepted and never a pass: the schedule retries.
      if sqlerrm in ('preflight_evidence_stale', 'dependency_changed') then
        report := null;
      else
        raise;
      end if;
  end;
  if report is null then
    return platform_private.cms_schedule_retry_result(schedule_row, correlation_id);
  end if;

  -- From here the proof is verified: whichever way the execution ends, its summary is recorded (DEC-159 (5)).
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(report->'results') result_item(item)
     where result_item.item->>'outcome' = 'failed'
  ) then
    result := platform_private.cms_schedule_blocked_result(schedule_row, 'preflight_failed', correlation_id);
  elsif exists (
    select 1 from pg_catalog.jsonb_array_elements(report->'results') result_item(item)
     where result_item.item->>'outcome' = 'unavailable'
  ) then
    result := platform_private.cms_schedule_retry_result(schedule_row, correlation_id);
  else
    -- 5. the action under the lineage rules (E3)
    begin
      if schedule_row.action = 'publish' then
        version_set := platform_private.cms_revision_version_set(review_row.revision_id, review_row.dependency_manifest);
        lineage := platform_private.cms_append_publication_lineage(pg_catalog.jsonb_build_object(
          'entryId', schedule_row.entry_id, 'revisionId', schedule_row.revision_id,
          'locale', revision_row.locale, 'audience', schedule_row.audience, 'action', 'publish',
          'publisherPersonId', schedule_row.created_by, 'versionSet', version_set,
          'dependencyHash', schedule_row.dependency_hash,
          'activationEvidenceHash', schedule_row.activation_evidence_hash,
          'correlationId', correlation_id, 'scheduleId', schedule_row.id));
      else
        lineage := platform_private.cms_append_publication_lineage(pg_catalog.jsonb_build_object(
          'entryId', schedule_row.entry_id, 'locale', revision_row.locale, 'audience', schedule_row.audience,
          'action', schedule_row.action, 'publisherPersonId', schedule_row.created_by,
          'correlationId', correlation_id, 'scheduleId', schedule_row.id));
      end if;
    exception
      when raise_exception then
        lineage := null;
        if sqlerrm = 'publication_not_active' then
          result := platform_private.cms_schedule_blocked_result(schedule_row, 'publication_not_active', correlation_id);
        elsif sqlerrm = 'publication_conflict' then
          result := platform_private.cms_schedule_retry_result(schedule_row, correlation_id);
        elsif sqlerrm in ('entry_unavailable', 'CONFLICT') then
          result := platform_private.cms_schedule_blocked_result(schedule_row, 'approval_invalidated', correlation_id);
        else
          raise;
        end if;
    end;

    if lineage is not null then
      -- 6. the schedule CAS commits with the lineage row, its audit record and its event
      actual_at := pg_catalog.clock_timestamp();
      deviation := pg_catalog.round(pg_catalog.date_part('epoch', actual_at - schedule_row.resolved_at_utc))::bigint;
      published_id := (lineage->>'publicationVersionId')::uuid;
      update platform_private.cms_publication_schedules schedule_item
         set state = 'completed', actual_at_utc = actual_at, deviation_seconds = deviation,
             lease_id = null, lease_until = null, next_attempt_at = null,
             version = schedule_item.version + 1, updated_at = actual_at
       where schedule_item.id = schedule_row.id
         and schedule_item.version = schedule_row.version;
      if not found then
        raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
      end if;
      event_ref := (
        select event.id
          from platform_private.outbox_events event
         where event.event_type = 'cms.publication.changed.v1'
           and event.aggregate_id = (lineage->>'id')::uuid
           and event.aggregate_version = (lineage->>'version')::bigint);
      result := pg_catalog.jsonb_build_object(
        'scheduleId', schedule_row.id, 'outcome', 'completed', 'reasonCode', null,
        'publicationVersionId', published_id, 'actualUtc', platform_private.auth_iso_time(actual_at),
        'deviationSeconds', deviation
      );
    end if;
  end if;

  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-20', schedule_row.id, schedule_row.revision_id,
    coalesce(event_ref, extensions.gen_random_uuid()), correlation_id, evidence);
  return result;
end;
$body$;

comment on function platform_private.cms_execute_publication_schedule(jsonb) is
  'CMS-03B-20 execute: re-reads the approved review and every frozen identity, rechecks the creator''s publisher grant (DEC-120), runs the 17-category execute-phase preflight with the verified proof, applies the action under the lineage rules and completes the schedule with its actual instant and deviation, or blocks it (closed reason) or retries it (15 s / 60 s / 300 s, then retries_exhausted). Idempotent per (schedule, version, lease): a completed schedule answers already_completed. Private; the Worker scheduled sweep calls the platform_api wrapper.';

create or replace function platform_api.cms_execute_publication_schedule(p_request jsonb)
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
    rpc_result := platform_private.cms_execute_publication_schedule(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: what the executor reads and writes, held by the definer role only.
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_schedule_lock_review(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_execute_publication_schedule(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_execute_publication_schedule(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function
  platform_private.cms_schedule_lock_review(uuid, uuid),
  platform_private.cms_execute_publication_schedule(jsonb),
  platform_api.cms_execute_publication_schedule(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_execute_publication_schedule(jsonb) to service_role;

commit;
