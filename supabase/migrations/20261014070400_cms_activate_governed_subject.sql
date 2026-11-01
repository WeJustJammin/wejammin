-- Slice 12 lane governed-b, CMS-03C-09 (BE03c Route Registry 171, Governed activation, retirement and scheduled activation (DEC-113, OD-6),
-- Slice 12 lock order, Event schemas; BE03b "Time authority (E8)" and "Recent MFA (E6)"; DEC-157, DEC-159, DEC-180, DEC-188; tracker
-- P2-S12-AC-082 .. AC-087, AC-142 .. AC-145): platform_private.cms_activate_governed_subject(p_request jsonb) returns jsonb (the platform_api
-- wrapper is 20261014070410).  `activate` answers the 200 GovernedActivationResource, `schedule` the 202 one; `retire` is HELD.
--
-- Order of the evaluation (a refusal is a P0001 whose whole message is the token; DETAIL only where shown; nothing a refusal does is committed
-- except the review invalidation of step 8, answered as a committed refusal envelope):
--   1. structure (cms_governed_activation_request); 2. the unconditional step-up proof, before the review is read and before the reservation;
--   3. concealment (NOT_FOUND: another owner or no read scope) and the subject kind's owner capability (403 capability_missing);
--   4. position 1: the activator's authority rows FOR SHARE, the capability re-proved under the lock, then the idempotency reservation (an exact
--      replay returns the stored response, a committed refusal included);
--   5. position 3: the subject row FOR UPDATE, for `activate` the lineage's current active version row FOR UPDATE, then the dependency graph and the
--      bound content types (positions 3-4); position 5: the review row FOR UPDATE;
--   6. the review CAS (VERSION_MISMATCH {expectedVersion, currentVersion}) and `approved` (else subject_not_activatable); for `schedule` a live
--      schedule is schedule_exists; the subject must be approved or blocked (else subject_not_activatable);
--   7. `schedule` only: the 03b time rules the database can check (tzdb_version_mismatch {pinnedVersion}, resolved_utc_mismatch,
--      schedule_out_of_horizon {minUtc, maxUtc}) and the activator's grant day (authority_ends_before_schedule);
--   8. the recheck (cms_governed_activation_verdict): a taxonomy domain without a provider is 422 canonical_source_unavailable {domain}; a changed
--      dependency COMMITS the invalidation (dependency_changed) and a dead approval commits reviewer_authority_changed; both are answered as the
--      committed refusal envelope { kind: 'refusal', reasonCode, details } stored with status 409;
--   9. the lineage advisory lock LAST for `activate` and `schedule` (BE03c 1326, 1348; one helper, the CMS-03C-19 key).  activate: the lineage's
--      active version re-read under it WITHOUT a row lock (BE03c 1338; a difference is 409 activation_conflict, nothing commits), then
--      cms_governed_apply_activation (supersession, activation, one audit record, exactly one event) and 200; schedule: the pending schedule
--      row, the subject approved|blocked -> scheduled, one audit record, NO event, and 202.
--      Deadlock freedom: activate, schedule and the executor (CMS-03C-19) are the only takers of the advisory lock, each AFTER every row lock of
--      its command (positions 1, 3, 3-4, 5 and, for the executor, 6).  After it they touch only rows they already hold (the subject, the review, the
--      executor's schedule row, the superseded active row locked at step 5) plus inserts (audit, outbox, the schedule's own new row, whose unique
--      index contends only with the same subject's schedule rows, which the subject row lock already serializes).  So an advisory holder never
--      waits on a row held by an advisory waiter, and the claim only ever SKIP LOCKEDs.
-- Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_activate_governed_subject(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_person uuid;
  v_correlation uuid;
  v_req jsonb;
  v_action text;
  v_expected bigint;
  v_capability text;
  v_reservation platform_private.idempotency_records;
  v_review platform_private.cms_governed_reviews%rowtype;
  v_subject jsonb;
  v_verdict text;
  v_active uuid;
  v_accepted timestamptz;
  v_local timestamp;
  v_resolved timestamptz;
  v_grant_end date;
  v_at timestamptz;
  v_applied jsonb;
  v_outcome jsonb;
  v_schedule_id uuid := extensions.gen_random_uuid();
  v_response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  v_correlation := platform_private.cms_correlation(p_request);

  -- 1. structure   2. the step-up proof
  v_req := platform_private.cms_governed_activation_request(p_request);
  v_action := v_req->>'action';
  v_expected := (v_req->>'expectedVersion')::bigint;
  perform platform_private.cms_editorial_step_up_instant(p_request);

  -- 3. concealment and the owner capability
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = (v_req->>'reviewId')::uuid;
  if not found or v_review.owner_id is distinct from v_party_id
     or pg_catalog.cardinality(platform_private.cms_governed_review_scopes(v_review.id, v_actor_id, v_party_id)) = 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_person := platform_private.identity_actor_person(v_actor_id);
  v_capability := platform_private.cms_governed_owner_capability(v_review.subject_kind);

  -- 4. position 1, the capability re-proved under the lock, the idempotency reservation
  perform platform_private.cms_lock_governed_authority(v_actor_id, v_party_id, v_capability);
  if not platform_private.cms_person_holds_capability(v_review.owner_id, v_person, v_capability) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  v_reservation := platform_private.cms_reserve(p_request, v_actor_id, 'CMS-03C-09');
  if v_reservation.state = 'completed'::platform_private.idempotency_state then
    if v_reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config('response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return v_reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 5. positions 3-5
  v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_action = 'activate' then
    v_active := platform_private.cms_governed_lock_lineage_active(v_review.subject_kind, v_review.lineage_id, v_review.subject_id);
  end if;
  perform platform_private.cms_governed_lock_graph(v_review.subject_kind, v_review.owner_id, v_subject);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = v_review.id for update;

  -- 6. the CAS, the approved review, the live schedule, the subject state
  if v_review.version <> v_expected then
    perform platform_private.cms_raise_version_mismatch(v_expected, v_review.version);
  end if;
  if v_review.state <> 'approved' then
    raise exception 'subject_not_activatable' using errcode = 'P0001';
  end if;
  if v_action = 'schedule' and exists (
       select 1 from platform_private.cms_governed_activation_schedules live
        where live.subject_kind = v_review.subject_kind and live.subject_id = v_review.subject_id
          and live.state in ('pending', 'executing', 'failed_retryable')) then
    raise exception 'schedule_exists' using errcode = 'P0001';
  end if;
  if v_subject->>'state' not in ('approved', 'blocked') then
    raise exception 'subject_not_activatable' using errcode = 'P0001';
  end if;

  -- 7. the time rules and the activator's grant day (schedule)
  if v_action = 'schedule' then
    v_accepted := pg_catalog.clock_timestamp();
    v_local := (v_req->>'local')::timestamp;
    v_resolved := (v_req->>'resolved')::timestamptz;
    if v_req->>'tzdb' <> platform_private.cms_tzdb_version() then
      raise exception 'tzdb_version_mismatch' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_object('pinnedVersion', platform_private.cms_tzdb_version())::text;
    end if;
    if (v_local - (v_resolved at time zone 'UTC')) not between interval '-12 hours' and interval '14 hours' then
      raise exception 'resolved_utc_mismatch' using errcode = 'P0001';
    end if;
    if v_resolved < v_accepted + interval '60 seconds' or v_resolved > v_accepted + interval '366 days' then
      raise exception 'schedule_out_of_horizon' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_object(
          'minUtc', platform_private.auth_iso_time(v_accepted + interval '60 seconds'),
          'maxUtc', platform_private.auth_iso_time(v_accepted + interval '366 days'))::text;
    end if;
    select actor_grant.valid_through into v_grant_end
      from identity_private.organization_actor_grant actor_grant
     where actor_grant.organization_id = v_party_id and actor_grant.person_id = v_person
       and actor_grant.capability_code = v_capability and actor_grant.active;
    if v_grant_end is not null and v_grant_end < (v_resolved at time zone 'UTC')::date then
      raise exception 'authority_ends_before_schedule' using errcode = 'P0001';
    end if;
  end if;

  -- 8. the recheck: a difference commits the invalidation
  v_verdict := platform_private.cms_governed_activation_verdict(v_review.id);
  if v_verdict = 'canonical_source_unavailable' then
    raise exception 'canonical_source_unavailable' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object('domain', platform_private.cms_governed_first_unbuilt_domain(v_subject))::text;
  elsif v_verdict <> 'current' then
    perform platform_private.cms_governed_invalidate_approved_review(
      v_review.id, case v_verdict when 'dependency_changed' then 'dependency_changed' else 'reviewer_authority_changed' end,
      v_actor_id, v_party_id, v_correlation);
    v_outcome := pg_catalog.jsonb_build_object(
      'kind', 'refusal', 'details', '{}'::jsonb,
      'reasonCode', case v_verdict when 'dependency_changed' then 'dependency_changed' else 'review_not_open' end);
    perform platform_private.cms_complete(v_reservation.id, v_review.id, 409, v_outcome);
    return v_outcome;
  end if;

  -- 9. the lineage advisory lock LAST for both actions (BE03c 1326, 1348: racing switchers of one lineage serialize here), then the switch or the schedule
  perform platform_private.cms_governed_take_lineage_advisory(v_review.subject_kind, v_review.lineage_id);
  if v_action = 'activate' then
    -- the re-read takes no row lock (BE03c 1338): under the advisory lock no writer of the lineage's active row is in flight
    if platform_private.cms_governed_read_lineage_active(
         v_review.subject_kind, v_review.lineage_id, v_review.subject_id) is distinct from v_active then
      raise exception 'activation_conflict' using errcode = 'P0001';
    end if;
    v_at := pg_catalog.clock_timestamp();
    v_applied := platform_private.cms_governed_apply_activation(v_review.id, v_actor_id, v_party_id, v_correlation, v_at);
    v_response := pg_catalog.jsonb_build_object(
      'reviewId', v_review.id, 'reviewVersion', v_applied->>'reviewVersion', 'subjectKind', v_review.subject_kind,
      'subjectId', v_review.subject_id, 'lineageId', v_review.lineage_id, 'subjectVersion', v_review.subject_version,
      'action', 'activate', 'subjectState', 'active', 'activatedAt', platform_private.auth_iso_time(v_at),
      'scheduledForUtc', null, 'eventType', v_applied->>'eventType');
    perform platform_private.cms_complete(v_reservation.id, v_review.subject_id, 200, v_response);
    return v_response;
  end if;
  begin
    insert into platform_private.cms_governed_activation_schedules(
      id, owner_id, state, version, review_id, subject_kind, subject_id, local_datetime, timezone, resolved_at_utc,
      tzdb_version, disambiguation, expected_version, attempt_count, created_by)
    values (
      v_schedule_id, v_review.owner_id, 'pending', 1, v_review.id, v_review.subject_kind, v_review.subject_id, v_local,
      v_req->>'zone', v_resolved, v_req->>'tzdb', v_req->>'disambiguation', v_review.version, 0, v_person);
  exception when unique_violation then
    raise exception 'schedule_exists' using errcode = 'P0001';
  end;
  perform platform_private.cms_governed_move_subject(v_review.subject_kind, v_review.subject_id, 'scheduled');
  perform platform_private.cms_record_audit(
    'cms.governed.schedule', v_actor_id, v_party_id, case v_review.subject_kind
      when 'template_version' then 'cms_template_version' when 'pattern_version' then 'cms_pattern_version'
      else 'cms_taxonomy_version' end, v_review.subject_id, 'CMS_GOVERNED_ACTIVATION_SCHEDULED', v_correlation);
  v_response := pg_catalog.jsonb_build_object(
    'reviewId', v_review.id, 'reviewVersion', v_review.version::text, 'subjectKind', v_review.subject_kind,
    'subjectId', v_review.subject_id, 'lineageId', v_review.lineage_id, 'subjectVersion', v_review.subject_version,
    'action', 'schedule', 'subjectState', 'scheduled', 'activatedAt', null,
    'scheduledForUtc', platform_private.auth_iso_time(v_resolved), 'eventType', null);
  perform platform_private.cms_complete(v_reservation.id, v_schedule_id, 202, v_response);
  return v_response;
end;
$body$;

comment on function platform_private.cms_activate_governed_subject(jsonb) is
  'CMS-03C-09: the subject owner activates (200) or schedules (202) an approved governed review under unconditional step-up, the BE03c lock order (authority rows, subject, lineage active row, dependency graph, review), the review CAS and a full recheck (a changed dependency or a dead approval commits the invalidation and answers the committed refusal envelope). activate supersedes the previous active version and commits one audit record and exactly one activation event; schedule commits a pending schedule and no event. retire is HELD. Private; the Worker calls the platform_api wrapper.';

grant select, insert, update on table platform_private.cms_governed_activation_schedules to wejammin_cms_definer;
grant select, update on table platform_private.cms_governed_reviews to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_activate_governed_subject(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_activate_governed_subject(jsonb)
  from public, anon, authenticated, service_role;

commit;
