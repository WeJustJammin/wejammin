-- Slice 11 lane S11-3a, CMS-03B-06 (BE03b "Review scopes, reviewer assignment and decision
-- evaluation (DEC-136)" steps 1-10, DEC-157 lock order, DEC-158(a); tracker P2-S11-AC-011 ..
-- AC-016, AC-046, AC-108 .. AC-110, AC-121): platform_private.cms_record_review_decision(p_request
-- jsonb) returns jsonb, with the platform_api wrapper the Worker calls (service_role only).
--
-- One assigned reviewer records ONE approve|reject on an open review.  Order of the evaluation
-- (AC-108; a refusal is a P0001 whose whole message is the token and commits nothing):
--   1. structure: exact keys (a caller `capability` or `stepUpAt` is an unknown key), UUID,
--      positive decimal versions that agree, decision, and the reason: 1..2000 code points,
--      already NFC, no control / line-paragraph-separator / bidirectional-formatting character
--      and none of < > { } (VALIDATION_FAILED at the member pointer);
--   2. the step-up proof (STEP_UP_REQUIRED) before the review is read and before the reservation;
--   3. concealment: an absent, cross-owner or scope-less review is NOT_FOUND; a readable review
--      without an EFFECTIVE assignment (non-revoked, starts_at <= now < ends_at) is
--      403 capability_missing;
--   4. the reviewer's authority rows FOR SHARE (global order position 1), then the idempotency
--      reservation (an exact replay returns the stored response, including a stored committed
--      refusal), then review_not_open and the CAS operand (VERSION_MISMATCH) on the committed row;
--   5. DEC-157: the content-type version row of the revision FOR SHARE (position 4) BEFORE the
--      review row, then the dependency rebuild.  A stale or unbuildable frozen manifest COMMITS
--      the invalidation (cms_invalidate_editorial_review, reason dependency_changed) and returns the
--      committed-refusal envelope { kind: 'refusal', reasonCode: 'dependency_changed', details:
--      { dependencyHash } } (details {} when the current manifest cannot be rebuilt; DEC-159 (2))
--      instead of raising; the decision is not recorded;
--   6. the review row FOR UPDATE (position 5) and the authoritative state / version recheck;
--   7. separation: the reviewer is neither the submitter nor the revision author
--      (403 separation_of_duties) and has no earlier decision (409 duplicate_decision), then the
--      standing cms.reviewer grant (403 capability_missing);
--   8. approve: the satisfied slot is the first UNFILLED specialist slot (in requiredCapabilities
--      order) whose capability the reviewer holds, else the base slot cms.reviewer; refused 409
--      specialist_slot_unsatisfiable when required - distinct qualifying approvers after this
--      decision < the specialist slots no counted approver would hold (a reject never is).  If a
--      recorded approve no longer counts (its decider's standing grant lapsed or was revoked, its
--      assignment was revoked) and the approvals still possible can no longer reach the required
--      count, the review can never be approved: the invalidation `reviewer_authority_changed` is
--      committed and the committed refusal { kind: 'refusal', reasonCode: 'review_not_open', details: {} }
--      is returned (recordedDecisionCount may never exceed requiredDecisionCount, so the alternative is
--      a review stuck open forever);
--   9. the decision row is appended (BEFORE the review count advances, the S11-2 insert guard) with the
--      server-derived reviewer, capability (the satisfied slot; cms.reviewer for a reject), the
--      verified MFA instant, reviewed_hash = the review's frozen hash, reason and comment_hash =
--      SHA-256 of the reason's UTF-8 bytes; the review then advances under CAS (version + 1): a reject
--      sets `rejected` terminally, an approve sets `approved` exactly when the distinct qualifying
--      approvers equal requiredDecisionCount and every specialist slot is held by a counted approver;
--  10. one audit record and one cms.entry.review-changed.v1 {reviewId, revisionId} commit with the
--      completed idempotency record.  The response is the EditorialReviewResource.
-- Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_record_review_decision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  reviewer_person uuid;
  correlation_id uuid;
  requested_review uuid;
  expected_version bigint;
  decision_value text;
  reason_text text;
  step_up_at timestamptz;
  decided_instant timestamptz;
  scopes text[];
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_editorial_reviews%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  assignment_row platform_private.cms_editorial_review_assignments%rowtype;
  decision_id uuid := extensions.gen_random_uuid();
  satisfied_slot text := 'cms.reviewer';
  missing_slots integer;
  distinct_now integer;
  distinct_final integer;
  held_slots integer;
  required_slots integer;
  next_state text;
  current_hash text;
  current_manifest jsonb;
  drift_reason text;
  outcome jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1. structure
  if not platform_private.cms_exact_keys(
    p_request,
    array['reviewId', 'decision', 'reason', 'expectedVersion', 'ifMatch', 'idempotencyKey']::text[],
    array['reviewId', 'decision', 'reason', 'expectedVersion', 'ifMatch', 'idempotencyKey',
          'context', 'correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'reviewId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expectedVersion"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/ifMatch"]';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'decision') is distinct from 'string'
     or p_request->>'decision' not in ('approve', 'reject') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/decision"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reason') is distinct from 'string'
     or not platform_private.cms_editorial_reason_valid(p_request->>'reason', 2000, true) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/reason"]';
  end if;
  requested_review := (p_request->>'reviewId')::uuid;
  expected_version := (p_request->>'expectedVersion')::bigint;
  decision_value := p_request->>'decision';
  reason_text := p_request->>'reason';

  -- 2. the step-up proof; its instant is the decision's binding MFA instant
  step_up_at := platform_private.cms_editorial_step_up_instant(p_request);

  -- 3. concealment (404) and the effective assignment (403)
  reviewer_person := platform_private.identity_actor_person(actor_id);
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = requested_review;
  if not found or review_row.owner_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  scopes := platform_private.cms_editorial_review_scopes(review_row.id, actor_id, acting_party_id);
  if pg_catalog.cardinality(scopes) = 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from platform_private.cms_editorial_review_assignments assignment_item
     where assignment_item.review_id = review_row.id
       and assignment_item.reviewer_person_id = reviewer_person
       and assignment_item.state = 'active'
       and assignment_item.starts_at <= pg_catalog.clock_timestamp()
       and pg_catalog.clock_timestamp() < assignment_item.ends_at
  ) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- 4. authority rows (position 1), the idempotency reservation, then the committed state check
  perform platform_private.cms_lock_person_authority(
    review_row.owner_id, array[reviewer_person]::uuid[],
    array(select slot.slot_key
            from pg_catalog.jsonb_array_elements_text(review_row.required_capabilities) slot(slot_key)
          union select 'cms.reviewer')
  );
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-06');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config(
        'response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = requested_review;
  if review_row.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  if review_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, review_row.version);
  end if;

  -- 5. DEC-157: the schema position, then the dependency rebuild, BEFORE the review row.
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = review_row.revision_id;
  perform 1
    from platform_private.cms_content_type_versions version_item
   where version_item.id = revision_row.schema_version_id
     for share;
  if platform_private.cms_frozen_dependencies_status(review_row.revision_id, review_row.dependency_manifest)
     is distinct from 'current' then
    begin
      current_manifest := platform_private.cms_build_dependency_manifest(review_row.revision_id);
      current_hash := platform_private.cms_jcs_sha256(current_manifest);
    exception when others then
      current_hash := null;
    end;
    perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'reasonCode', 'dependency_changed',
      'correlationId', correlation_id, 'actorId', actor_id));
    drift_reason := 'dependency_changed';
  end if;

  -- 6. the review row (position 5) and the authoritative recheck
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = requested_review
     for update;
  if drift_reason is not null then
    if review_row.state <> 'invalidated' then
      -- A concurrent decision ended the review first: nothing was invalidated by this call.
      raise exception 'review_not_open' using errcode = 'P0001';
    end if;
    outcome := pg_catalog.jsonb_build_object(
      'kind', 'refusal', 'reasonCode', drift_reason,
      'details', case when current_hash is null then '{}'::jsonb
                      else pg_catalog.jsonb_build_object('dependencyHash', current_hash) end);
    perform platform_private.cms_complete(reservation.id, review_row.id, 409, outcome);
    return outcome;
  end if;
  if review_row.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  if review_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, review_row.version);
  end if;

  -- 7. separation of duties, then the standing grant
  if reviewer_person = review_row.submitted_by or reviewer_person = revision_row.author_person_id then
    raise exception 'separation_of_duties' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_editorial_decisions earlier
     where earlier.review_id = review_row.id and earlier.reviewer_person_id = reviewer_person
  ) then
    raise exception 'duplicate_decision' using errcode = 'P0001';
  end if;
  if not platform_private.cms_person_holds_capability(review_row.owner_id, reviewer_person, 'cms.reviewer') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  -- The assignment is re-read under the review lock (assignment changes serialize on it).
  decided_instant := pg_catalog.clock_timestamp();
  select assignment_item.* into assignment_row
    from platform_private.cms_editorial_review_assignments assignment_item
   where assignment_item.review_id = review_row.id
     and assignment_item.reviewer_person_id = reviewer_person
     and assignment_item.state = 'active'
     and assignment_item.starts_at <= decided_instant
     and decided_instant < assignment_item.ends_at;
  if not found then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- 8. the satisfied slot and the unsatisfiable-slot rule (approve only)
  if decision_value = 'approve' then
    distinct_now := platform_private.cms_editorial_review_distinct_approvals(review_row.id);
    select slot.slot_key into satisfied_slot
      from pg_catalog.jsonb_array_elements_text(review_row.required_capabilities)
             with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1
       and not exists (
         select 1 from platform_private.cms_editorial_review_qualifying_decisions(review_row.id) counted
          where counted.capability = slot.slot_key)
       and platform_private.cms_person_holds_capability(review_row.owner_id, reviewer_person, slot.slot_key)
     order by slot.slot_no
     limit 1;
    satisfied_slot := coalesce(satisfied_slot, 'cms.reviewer');
    select pg_catalog.count(*)::integer into missing_slots
      from pg_catalog.jsonb_array_elements_text(review_row.required_capabilities)
             with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1
       and slot.slot_key <> satisfied_slot
       and not exists (
         select 1 from platform_private.cms_editorial_review_qualifying_decisions(review_row.id) counted
          where counted.capability = slot.slot_key);
    if review_row.required_decision_count - (distinct_now + 1) < missing_slots then
      raise exception 'specialist_slot_unsatisfiable' using errcode = 'P0001';
    end if;
    -- A recorded approve that no longer counts and cannot be replaced: the review is dead.
    if (distinct_now + 1) + (review_row.required_decision_count - (review_row.recorded_decision_count + 1))
       < review_row.required_decision_count then
      perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
        'reviewId', review_row.id, 'reasonCode', 'reviewer_authority_changed',
        'correlationId', correlation_id, 'actorId', actor_id));
      -- CMS-03B-06 registers no token for reviewer_authority_changed: the committed refusal names
      -- the state the caller meets, review_not_open (DEC-159 (2)).
      outcome := pg_catalog.jsonb_build_object(
        'kind', 'refusal', 'reasonCode', 'review_not_open', 'details', '{}'::jsonb);
      perform platform_private.cms_complete(reservation.id, review_row.id, 409, outcome);
      return outcome;
    end if;
  end if;

  -- 9. append the decision, THEN advance the review under CAS
  insert into platform_private.cms_editorial_decisions(
    id, owner_id, state, version, review_id, reviewer_person_id, acting_party_id, capability,
    assignment_id, assignment_version, decision, reason, comment_hash, reviewed_hash,
    step_up_at, decided_at, created_at, updated_at
  ) values (
    decision_id, review_row.owner_id, 'recorded', 1, review_row.id, reviewer_person,
    acting_party_id, satisfied_slot, assignment_row.id, assignment_row.version, decision_value,
    reason_text,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(reason_text, 'UTF8')), 'hex'),
    review_row.frozen_hash, step_up_at, decided_instant, decided_instant, decided_instant
  );
  next_state := 'open';
  if decision_value = 'reject' then
    next_state := 'rejected';
  else
    distinct_final := platform_private.cms_editorial_review_distinct_approvals(review_row.id);
    select pg_catalog.count(*)::integer into required_slots
      from pg_catalog.jsonb_array_elements_text(review_row.required_capabilities)
             with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1;
    select pg_catalog.count(*)::integer into held_slots
      from pg_catalog.jsonb_array_elements_text(review_row.required_capabilities)
             with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1
       and exists (
         select 1 from platform_private.cms_editorial_review_qualifying_decisions(review_row.id) counted
          where counted.capability = slot.slot_key);
    if distinct_final = review_row.required_decision_count and held_slots = required_slots then
      next_state := 'approved';
    end if;
  end if;
  update platform_private.cms_editorial_reviews review_item
     set state = next_state,
         recorded_decision_count = review_item.recorded_decision_count + 1,
         decided_at = case when next_state in ('approved', 'rejected') then decided_instant end,
         version = review_item.version + 1,
         updated_at = decided_instant
   where review_item.id = review_row.id
     and review_item.version = review_row.version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  perform platform_private.cms_emit_event(
    'cms.editorial.review.decide', actor_id, acting_party_id,
    'cms_editorial_decision', decision_id, 'CMS_EDITORIAL_REVIEW_DECIDED',
    'cms.entry.review-changed.v1', 'cms_editorial_review', review_row.id, review_row.version + 1,
    pg_catalog.jsonb_build_object('reviewId', review_row.id, 'revisionId', review_row.revision_id),
    correlation_id
  );
  response := platform_private.cms_editorial_review_resource(review_row.id);
  perform platform_private.cms_complete(reservation.id, decision_id, 200, response);
  return response;
end;
$body$;

comment on function platform_private.cms_record_review_decision(jsonb) is
  'CMS-03B-06: an assigned reviewer records one approve|reject on an open editorial review under step-up, the DEC-157 lock order, the frozen-dependency recheck (a stale manifest commits the invalidation and answers the committed refusal envelope), separation of duties, the specialist-slot rules and the review CAS. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_record_review_decision(p_request jsonb)
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
    rpc_result := platform_private.cms_record_review_decision(p_request);
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
grant select, update on table platform_private.cms_editorial_reviews to wejammin_cms_definer;
grant insert, select on table platform_private.cms_editorial_decisions to wejammin_cms_definer;
grant select on table platform_private.cms_editorial_review_assignments to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_record_review_decision(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_record_review_decision(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_record_review_decision(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_record_review_decision(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_record_review_decision(jsonb) to service_role;

commit;
