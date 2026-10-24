-- Slice 12 lane governed-a, CMS-03C-07 (BE03c Route Registry 172, Governed review machinery, Governed policy basis, Slice 12 lock
-- order, Per-operation authorization matrix; BE03b CMS-03B-06 applied with the governed substitutions; DEC-137, DEC-157, DEC-159,
-- DEC-180, DEC-188; tracker P2-S12-AC-070 .. AC-075): platform_private.cms_record_governed_decision(p_request jsonb) returns jsonb
-- (the platform_api wrapper is 20261014010210).
--
-- One assigned reviewer records ONE approve|reject on an open governed review.  The ten ordered CMS-03B-06 checks are an order of
-- checks, NOT of locks; the locks follow the BE03c order (authority rows 1, the subject row 3 and its dependency graph, the bound
-- content-type versions 4, then the review row 5).  A refusal is a P0001 whose whole message is the token and commits nothing:
--   1. structure (a body capability or stepUpAt is an unknown key); 2. the step-up proof, before the review is read and before the
--   reservation; 3. concealment (404) and the effective assignment (non-revoked, starts_at <= now < ends_at: else 403
--   capability_missing); 4. position 1 authority rows, the reservation (an exact replay returns the stored response, a committed
--   refusal included), review_not_open and the CAS operand; 5. the subject and the dependency graph, then the frozen status: a changed
--   dependency or policy basis COMMITS the invalidation (dependency_changed, the subject back to draft) and returns the refusal
--   envelope { kind: 'refusal', reasonCode, details } instead of raising; 6. the review row FOR UPDATE and the authoritative recheck;
--   7. separation of duties (the submitter or the subject creator), duplicate_decision, the standing cms.reviewer grant;
--   8. approve: the satisfied slot is the first UNFILLED specialist slot the reviewer holds, else the base slot; specialist_slot_
--   unsatisfiable when the approvals still possible fall short of the unfilled specialist slots; a review that can never reach its
--   count (a recorded approval that no longer counts) is invalidated reviewer_authority_changed and answers the committed refusal
--   review_not_open; 9. the decision row is appended BEFORE the review advances under CAS (version + 1): a reject is terminal and
--   returns the subject to draft, the last required approval makes the review and the subject approved; 10. one audit record commits
--   with the completed idempotency record.  No event.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_record_governed_decision(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_reviewer uuid;
  v_correlation uuid;
  v_review_id uuid;
  v_expected bigint;
  v_decision text;
  v_reason text;
  v_step_up_at timestamptz;
  v_decided_at timestamptz;
  v_scopes text[];
  v_reservation platform_private.idempotency_records;
  v_review platform_private.cms_governed_reviews%rowtype;
  v_assignment platform_private.cms_governed_review_assignments%rowtype;
  v_subject jsonb;
  v_decision_id uuid := extensions.gen_random_uuid();
  v_slot text := 'cms.reviewer';
  v_missing integer;
  v_distinct_now integer;
  v_distinct_final integer;
  v_required_slots integer;
  v_held_slots integer;
  v_next text;
  v_outcome jsonb;
  v_response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  v_correlation := platform_private.cms_correlation(p_request);

  -- 1. structure
  if not platform_private.cms_exact_keys(
    p_request,
    array['reviewId', 'decision', 'reason', 'expectedVersion', 'ifMatch', 'idempotencyKey']::text[],
    array['reviewId', 'decision', 'reason', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'context', 'correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'reviewId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_expected := platform_private.cms_governed_cas_operand(p_request);
  if pg_catalog.jsonb_typeof(p_request->'decision') is distinct from 'string'
     or p_request->>'decision' not in ('approve', 'reject') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/decision"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reason') is distinct from 'string'
     or not platform_private.cms_editorial_reason_valid(p_request->>'reason', 2000, true) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/reason"]';
  end if;
  v_review_id := (p_request->>'reviewId')::uuid;
  v_decision := p_request->>'decision';
  v_reason := p_request->>'reason';

  -- 2. the step-up proof (its instant is the decision's MFA instant)
  v_step_up_at := platform_private.cms_editorial_step_up_instant(p_request);

  -- 3. concealment (404) and the effective assignment (403)
  v_reviewer := platform_private.identity_actor_person(v_actor_id);
  select review_item.* into v_review
    from platform_private.cms_governed_reviews review_item
   where review_item.id = v_review_id;
  if not found or v_review.owner_id is distinct from v_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_scopes := platform_private.cms_governed_review_scopes(v_review.id, v_actor_id, v_party_id);
  if pg_catalog.cardinality(v_scopes) = 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from platform_private.cms_governed_review_assignments assignment_item
     where assignment_item.review_id = v_review.id and assignment_item.reviewer_person_id = v_reviewer
       and assignment_item.state = 'active'
       and assignment_item.starts_at <= pg_catalog.clock_timestamp()
       and pg_catalog.clock_timestamp() < assignment_item.ends_at
  ) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- 4. authority rows (position 1), the idempotency reservation, then the committed state check
  perform platform_private.cms_lock_person_authority(
    v_review.owner_id, array[v_reviewer]::uuid[],
    array(select slot.slot_key from pg_catalog.jsonb_array_elements_text(v_review.required_capabilities) slot(slot_key)
          union select 'cms.reviewer'));
  v_reservation := platform_private.cms_reserve(p_request, v_actor_id, 'CMS-03C-07');
  if v_reservation.state = 'completed'::platform_private.idempotency_state then
    if v_reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config('response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return v_reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item where review_item.id = v_review_id;
  if v_review.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  if v_review.version <> v_expected then
    perform platform_private.cms_raise_version_mismatch(v_expected, v_review.version);
  end if;

  -- 5. DEC-157: the subject (position 3) and its dependency graph and bound content types (position 4) BEFORE the review row
  v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_governed_lock_graph(v_review.subject_kind, v_review.owner_id, v_subject);
  if platform_private.cms_governed_frozen_status(v_review.id) is distinct from 'current' then
    select review_item.* into v_review from platform_private.cms_governed_reviews review_item
     where review_item.id = v_review_id for update;
    if v_review.state <> 'open' then
      raise exception 'review_not_open' using errcode = 'P0001';
    end if;
    perform platform_private.cms_governed_invalidate_open_review(
      v_review.id, 'dependency_changed', v_actor_id, v_party_id, v_correlation);
    v_outcome := pg_catalog.jsonb_build_object('kind', 'refusal', 'reasonCode', 'dependency_changed', 'details', '{}'::jsonb);
    perform platform_private.cms_complete(v_reservation.id, v_review.id, 409, v_outcome);
    return v_outcome;
  end if;

  -- 6. the review row (position 5) and the recheck
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = v_review_id for update;
  if v_review.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  if v_review.version <> v_expected then
    perform platform_private.cms_raise_version_mismatch(v_expected, v_review.version);
  end if;

  -- 7. separation of duties, the earlier decision, then the standing grant
  if v_reviewer = v_review.submitted_by or v_reviewer::text is not distinct from v_subject->>'creatorPerson' then
    raise exception 'separation_of_duties' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_governed_review_decisions earlier
     where earlier.review_id = v_review.id and earlier.reviewer_person_id = v_reviewer
  ) then
    raise exception 'duplicate_decision' using errcode = 'P0001';
  end if;
  if not platform_private.cms_person_holds_capability(v_review.owner_id, v_reviewer, 'cms.reviewer') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  v_decided_at := pg_catalog.clock_timestamp();
  select assignment_item.* into v_assignment
    from platform_private.cms_governed_review_assignments assignment_item
   where assignment_item.review_id = v_review.id and assignment_item.reviewer_person_id = v_reviewer
     and assignment_item.state = 'active' and assignment_item.starts_at <= v_decided_at
     and v_decided_at < assignment_item.ends_at;
  if not found then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- 8. the satisfied slot and the unsatisfiable-slot rule (approve only)
  if v_decision = 'approve' then
    v_distinct_now := platform_private.cms_governed_review_distinct_approvals(v_review.id);
    select slot.slot_key into v_slot
      from pg_catalog.jsonb_array_elements_text(v_review.required_capabilities) with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1
       and not exists (
         select 1 from platform_private.cms_governed_review_qualifying_decisions(v_review.id) counted
          where counted.capability = slot.slot_key)
       and platform_private.cms_person_holds_capability(v_review.owner_id, v_reviewer, slot.slot_key)
     order by slot.slot_no
     limit 1;
    v_slot := coalesce(v_slot, 'cms.reviewer');
    select pg_catalog.count(*)::integer into v_missing
      from pg_catalog.jsonb_array_elements_text(v_review.required_capabilities) with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1 and slot.slot_key <> v_slot
       and not exists (
         select 1 from platform_private.cms_governed_review_qualifying_decisions(v_review.id) counted
          where counted.capability = slot.slot_key);
    if v_review.required_decision_count - (v_distinct_now + 1) < v_missing then
      raise exception 'specialist_slot_unsatisfiable' using errcode = 'P0001';
    end if;
    if (v_distinct_now + 1) + (v_review.required_decision_count - (v_review.recorded_decision_count + 1))
       < v_review.required_decision_count then
      perform platform_private.cms_governed_invalidate_open_review(
        v_review.id, 'reviewer_authority_changed', v_actor_id, v_party_id, v_correlation);
      v_outcome := pg_catalog.jsonb_build_object('kind', 'refusal', 'reasonCode', 'review_not_open', 'details', '{}'::jsonb);
      perform platform_private.cms_complete(v_reservation.id, v_review.id, 409, v_outcome);
      return v_outcome;
    end if;
  end if;
  -- 9. append the decision, THEN advance the review under CAS
  insert into platform_private.cms_governed_review_decisions(
    id, owner_id, state, version, review_id, reviewer_person_id, acting_party_id, assignment_id, assignment_version,
    capability, decision, reason, comment_hash, reviewed_hash, step_up_at, decided_at, created_at, updated_at
  ) values (
    v_decision_id, v_review.owner_id, 'recorded', 1, v_review.id, v_reviewer, v_party_id, v_assignment.id, v_assignment.version,
    v_slot, v_decision, v_reason,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_reason, 'UTF8')), 'hex'),
    v_review.subject_hash, v_step_up_at, v_decided_at, v_decided_at, v_decided_at
  );
  v_next := 'open';
  if v_decision = 'reject' then
    v_next := 'rejected';
  else
    v_distinct_final := platform_private.cms_governed_review_distinct_approvals(v_review.id);
    select pg_catalog.count(*)::integer into v_required_slots
      from pg_catalog.jsonb_array_elements_text(v_review.required_capabilities) with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1;
    select pg_catalog.count(*)::integer into v_held_slots
      from pg_catalog.jsonb_array_elements_text(v_review.required_capabilities) with ordinality slot(slot_key, slot_no)
     where slot.slot_no > 1
       and exists (
         select 1 from platform_private.cms_governed_review_qualifying_decisions(v_review.id) counted
          where counted.capability = slot.slot_key);
    if v_distinct_final = v_review.required_decision_count and v_held_slots = v_required_slots then
      v_next := 'approved';
    end if;
  end if;
  update platform_private.cms_governed_reviews review_item
     set state = v_next,
         recorded_decision_count = review_item.recorded_decision_count + 1,
         decided_at = case when v_next in ('approved', 'rejected') then v_decided_at end,
         version = review_item.version + 1,
         updated_at = v_decided_at
   where review_item.id = v_review.id and review_item.version = v_review.version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  if v_next = 'rejected' then
    perform platform_private.cms_governed_move_subject(v_review.subject_kind, v_review.subject_id, 'draft');
  elsif v_next = 'approved' then
    perform platform_private.cms_governed_move_subject(v_review.subject_kind, v_review.subject_id, 'approved');
  end if;

  perform platform_private.cms_record_audit(
    'cms.governed.review.decide', v_actor_id, v_party_id,
    'cms_governed_decision', v_decision_id, 'CMS_GOVERNED_REVIEW_DECIDED', v_correlation);
  v_response := platform_private.cms_governed_review_resource(v_review.id);
  perform platform_private.cms_complete(v_reservation.id, v_decision_id, 200, v_response);
  return v_response;
end;
$body$;

comment on function platform_private.cms_record_governed_decision(jsonb) is
  'CMS-03C-07: an assigned reviewer records one approve|reject on an open governed review under step-up, the BE03c lock order (subject, dependency graph and content types before the review row), the frozen-dependency recheck (a changed dependency commits the invalidation and answers the committed refusal envelope), separation of duties, the specialist-slot rules and the review CAS; the last approval approves the subject, a rejection returns it to draft. Private; the Worker calls the platform_api wrapper.';

-- SEC-2: what the command reads and writes, held by the definer role only (idempotent restatements).
grant select, update on table platform_private.cms_governed_reviews to wejammin_cms_definer;
grant select on table platform_private.cms_governed_review_assignments to wejammin_cms_definer;
grant insert, select on table platform_private.cms_governed_review_decisions to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_record_governed_decision(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_record_governed_decision(jsonb)
  from public, anon, authenticated, service_role;

commit;
