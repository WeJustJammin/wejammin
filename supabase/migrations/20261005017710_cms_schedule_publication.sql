-- Slice 11 lane S11-3b, CMS-03B-07 (BE03b "Time authority (E8)", "Recent MFA (E6)", "Separation of duties
-- (E11)", "Publication preflight registry (D19)", DEC-157 lock order, DEC-159; tracker P2-S11-AC-017 ..
-- AC-022, AC-038, AC-047, AC-103 .. AC-107, AC-122): platform_private.cms_schedule_publication(p_request
-- jsonb) returns jsonb, with the platform_api wrapper the Worker calls (service_role only).
--
-- An owner-party publisher schedules ONE action (publish, unpublish, expire, archive) of a revision whose
-- LATEST review is approved.  The Worker has already verified E8 steps 1-8 over the pinned tz snapshot; the
-- RPC re-checks only what needs no tz rules.  Order of the evaluation (a refusal is a P0001 whose whole
-- message is the token; structured members ride in a JSON-OBJECT DETAIL; nothing a refusal does is committed
-- except the review invalidation of step 8):
--   1. structure: exact keys (a caller entryId, riskClass or owner is an unknown key), a UUID revision, the
--      field pointers (VALIDATION_FAILED at /action, /localDateTime, /timezone, /resolvedUtc, /tzdbVersion,
--      /disambiguation, /audience, /expectedVersion, /ifMatch, all reported together);
--   2. the step-up proof (STEP_UP_REQUIRED) before anything is read and before the reservation;
--   3. concealment and authority: a revision outside the caller's workflow scope is NOT_FOUND, a visible one
--      without the owner-party cms.publisher grant is capability_missing, the author of a revision they
--      publish is separation_of_duties;
--   4. global lock order: the entry row FOR SHARE (0), the authority rows of the publisher and of every
--      decider of the latest review (1), the capability re-proved under the locks, then the idempotency
--      reservation (an exact replay returns the stored resource, even with freshly evaluated proof: the
--      proof is server-built and is not part of the command identity);
--   5. the content-type version FOR SHARE (4) and the latest review FOR UPDATE (5); its version is the CAS
--      operand (VERSION_MISMATCH) and it must be approved (CONFLICT);
--   6. the time rules the RPC can check (E8): tzdbVersion = cms_tzdb_version() (tzdb_version_mismatch
--      {pinnedVersion}), localDateTime read as UTC minus resolvedUtc within -12 h .. +14 h
--      (resolved_utc_mismatch), resolvedUtc 60 s .. 366 days after acceptance (schedule_out_of_horizon
--      {minUtc, maxUtc});
--   7. the publisher's grant covers the resolved UTC day (authority_ends_before_schedule);
--   8. the frozen manifest is rebuilt and every frozen identity must be current: otherwise the review
--      invalidation (dependency_changed) COMMITS and the committed-refusal envelope is returned and stored;
--   9. the schedule-phase preflight (17 categories, no short circuit) with the Worker's accessibility proof
--      (preflight_failed {preflight}, DEPENDENCY_UNAVAILABLE {dependencyClass}, preflight_evidence_stale,
--      dependency_changed {dependencyHash});
--  10. the pending schedule (version 1, bound to the approved review, its version, dependency hash and
--      activation evidence hash), one audit record, the accessibility summary of the proof (DEC-159 (5)) and
--      the completed idempotency record (202) commit; NO event exists until execution.  A second schedule of the same identity (entry, revision, action,
--      local time, timezone, audience) is CONFLICT.
-- The resource echoes the accepted time fields exactly as submitted (the Worker compares them verbatim);
-- fractions are limited to microseconds, the precision of the stored timestamp.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_schedule_publication(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  violations jsonb := '[]'::jsonb;
  requested_revision uuid;
  action_value text;
  local_text text;
  zone_text text;
  resolved_text text;
  tzdb_text text;
  disambiguation_value text;
  audience_value text;
  expected_version bigint;
  local_value timestamp;
  resolved_value timestamptz;
  evidence jsonb;
  target jsonb;
  publisher_person uuid;
  v_entry_id uuid;
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_editorial_reviews%rowtype;
  accepted_at timestamptz;
  grant_ends date;
  schedule_id uuid := extensions.gen_random_uuid();
  stamp timestamptz;
  refusal jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1. structure
  if not platform_private.cms_exact_keys(
    p_request,
    array['revisionId', 'action', 'localDateTime', 'timezone', 'resolvedUtc', 'tzdbVersion', 'disambiguation',
          'audience', 'expectedVersion', 'ifMatch', 'idempotencyKey']::text[],
    array['revisionId', 'action', 'localDateTime', 'timezone', 'resolvedUtc', 'tzdbVersion', 'disambiguation',
          'audience', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'evidence', 'context',
          'correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  evidence := p_request->'evidence';
  if pg_catalog.jsonb_typeof(evidence) = 'null' then
    evidence := null;
  elsif evidence is not null and pg_catalog.jsonb_typeof(evidence) <> 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_revision := (p_request->>'revisionId')::uuid;
  action_value := p_request->>'action';
  local_text := p_request->>'localDateTime';
  zone_text := p_request->>'timezone';
  resolved_text := p_request->>'resolvedUtc';
  tzdb_text := p_request->>'tzdbVersion';
  disambiguation_value := p_request->>'disambiguation';
  audience_value := p_request->>'audience';

  if pg_catalog.jsonb_typeof(p_request->'action') is distinct from 'string'
     or action_value not in ('publish', 'unpublish', 'expire', 'archive') then
    violations := violations || '["/action"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'localDateTime') is distinct from 'string'
     or local_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?$' then
    violations := violations || '["/localDateTime"]'::jsonb;
  else
    begin
      local_value := local_text::timestamp;
    exception when others then
      violations := violations || '["/localDateTime"]'::jsonb;
    end;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'timezone') is distinct from 'string'
     or pg_catalog.char_length(zone_text) not between 1 and 64
     or zone_text !~ '^[A-Za-z][A-Za-z0-9_+.-]*(/[A-Za-z0-9_+.-]+){0,2}$'
     or zone_text ~ '(^|/)\.{1,2}(/|$)' then
    violations := violations || '["/timezone"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'resolvedUtc') is distinct from 'string'
     or resolved_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?(Z|[+-]([01][0-9]|2[0-3])(:?[0-5][0-9])?)$' then
    violations := violations || '["/resolvedUtc"]'::jsonb;
  else
    begin
      resolved_value := resolved_text::timestamptz;
    exception when others then
      violations := violations || '["/resolvedUtc"]'::jsonb;
    end;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'tzdbVersion') is distinct from 'string'
     or tzdb_text !~ '^[A-Za-z0-9._-]{1,32}$' then
    violations := violations || '["/tzdbVersion"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'disambiguation') is distinct from 'string'
     or disambiguation_value not in ('none', 'earlier', 'later') then
    violations := violations || '["/disambiguation"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'audience') is distinct from 'string'
     or audience_value !~ '^[a-z0-9_-]{1,48}$' then
    violations := violations || '["/audience"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    violations := violations || '["/expectedVersion"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    violations := violations || '["/ifMatch"]'::jsonb;
  end if;
  if pg_catalog.jsonb_array_length(violations) > 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = violations::text;
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := (p_request->>'expectedVersion')::bigint;

  -- 2. the step-up proof (E6): before the review is read and before the reservation
  perform platform_private.cms_editorial_step_up_instant(p_request);

  -- 3. concealment (404) and authority (403)
  target := platform_private.cms_publication_target(actor_id, acting_party_id, requested_revision, null, action_value);
  publisher_person := (target->>'personId')::uuid;
  v_entry_id := (target->>'entryId')::uuid;

  -- 4. global lock order positions 0-1, the capability re-proved under the locks, then the reservation
  perform platform_private.cms_publication_lock_authority(v_entry_id, acting_party_id, publisher_person, requested_revision);
  if not platform_private.cms_person_holds_capability(acting_party_id, publisher_person, 'cms.publisher') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  reservation := platform_private.cms_reserve(p_request - 'evidence', actor_id, 'CMS-03B-07');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config(
        'response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 5. positions 4-5: the approved review and its CAS operand
  review_row := platform_private.cms_publication_lock_review(requested_revision);
  perform platform_private.cms_publication_review_operand(review_row, expected_version);

  -- 6. the time rules that need no tz database (E8)
  accepted_at := pg_catalog.clock_timestamp();
  if tzdb_text <> platform_private.cms_tzdb_version() then
    raise exception 'tzdb_version_mismatch' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object('pinnedVersion', platform_private.cms_tzdb_version())::text;
  end if;
  if (local_value - (resolved_value at time zone 'UTC'))
       not between interval '-12 hours' and interval '14 hours' then
    raise exception 'resolved_utc_mismatch' using errcode = 'P0001';
  end if;
  if resolved_value < accepted_at + interval '60 seconds'
     or resolved_value > accepted_at + interval '366 days' then
    raise exception 'schedule_out_of_horizon' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object(
        'minUtc', platform_private.auth_iso_time(accepted_at + interval '60 seconds'),
        'maxUtc', platform_private.auth_iso_time(accepted_at + interval '366 days'))::text;
  end if;

  -- 7. the publisher's grant must cover the day the action takes effect
  select actor_grant.valid_through into grant_ends
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = acting_party_id
     and actor_grant.person_id = publisher_person
     and actor_grant.capability_code = 'cms.publisher'
     and actor_grant.active;
  if grant_ends is not null and grant_ends < (resolved_value at time zone 'UTC')::date then
    raise exception 'authority_ends_before_schedule' using errcode = 'P0001';
  end if;

  -- 8. every frozen identity must still be current: otherwise the invalidation COMMITS
  if platform_private.cms_frozen_dependencies_status(review_row.revision_id, review_row.dependency_manifest)
     is distinct from 'current' then
    refusal := platform_private.cms_publication_stale_refusal(review_row.id, actor_id, correlation_id);
    perform platform_private.cms_complete(reservation.id, review_row.id, 409, refusal);
    return refusal;
  end if;

  -- 9. the schedule-phase preflight registry
  perform platform_private.cms_publication_preflight_verdict(
    'schedule', review_row, acting_party_id, publisher_person, resolved_value, evidence);

  -- 10. the pending schedule, its audit record and the completed reservation
  stamp := pg_catalog.clock_timestamp();
  begin
    insert into platform_private.cms_publication_schedules(
      id, owner_id, entry_id, revision_id, dependency_hash, activation_evidence_hash, action,
      local_datetime, timezone, resolved_at_utc, tzdb_version, disambiguation, state, job_id,
      review_id, audience, expected_version, attempt_count, next_attempt_at, lease_id, lease_until,
      reason_code, actual_at_utc, deviation_seconds, version, created_by, created_at, updated_at
    ) values (
      schedule_id, review_row.owner_id, v_entry_id, review_row.revision_id, review_row.dependency_hash,
      platform_private.cms_activation_evidence_hash(review_row.id), action_value, local_value, zone_text,
      resolved_value, tzdb_text, disambiguation_value, 'pending', null, review_row.id, audience_value,
      review_row.version, 0, null, null, null, null, null, null, 1, publisher_person, stamp, stamp
    );
  exception
    when unique_violation then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform platform_private.cms_record_audit(
    'cms.publication.schedule', actor_id, acting_party_id, 'cms_publication_schedule', schedule_id,
    'CMS_PUBLICATION_SCHEDULED', correlation_id);
  -- DEC-159 (5): the Worker's proof is summarized (no event exists until execution: a fresh effect id).
  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-07', schedule_id, review_row.revision_id, extensions.gen_random_uuid(), correlation_id, evidence);
  response := pg_catalog.jsonb_build_object(
    'id', schedule_id,
    'version', '1',
    'createdAt', platform_private.auth_iso_time(stamp),
    'updatedAt', platform_private.auth_iso_time(stamp),
    'state', 'pending',
    'entryId', v_entry_id,
    'revisionId', review_row.revision_id,
    'action', action_value,
    'localDateTime', local_text,
    'timezone', zone_text,
    'resolvedUtc', resolved_text,
    'tzdbVersion', tzdb_text,
    'disambiguation', disambiguation_value,
    'audience', audience_value,
    'jobId', null,
    'actualUtc', null,
    'deviationSeconds', null,
    'reasonCode', null,
    'attemptCount', 0
  );
  perform platform_private.cms_complete(reservation.id, schedule_id, 202, response);
  return response;
end;
$body$;

comment on function platform_private.cms_schedule_publication(jsonb) is
  'CMS-03B-07: an owner-party publisher schedules one action of a revision whose latest review is approved: step-up, workflow-scope concealment, the DEC-157 lock order, the approved review''s version as the CAS operand, the re-checked time rules, the publisher''s grant end, frozen-dependency currency (a stale manifest commits the invalidation and answers the committed refusal), the schedule-phase preflight, then the pending schedule, its audit record and the idempotency record. No event until execution. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_schedule_publication(p_request jsonb)
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
    rpc_result := platform_private.cms_schedule_publication(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: what the command reads and writes, held by the definer role only.
grant insert, select, update on table platform_private.cms_publication_schedules to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_schedule_publication(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_schedule_publication(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_schedule_publication(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_schedule_publication(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_schedule_publication(jsonb) to service_role;

commit;
