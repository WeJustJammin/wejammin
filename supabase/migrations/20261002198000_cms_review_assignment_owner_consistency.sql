-- Slice 09 R8 (Codex f3c0736e, high): a reviewer assignment is only authority
-- when it belongs to the same organization as its review.  Nothing enforced
-- assignment.owner_id = review.owner_id: the SECURITY DEFINER decision RPC
-- selected an effective assignment by (review, reviewer) alone, so an assignment
-- row stamped with another organization's owner_id authorized that reviewer to
-- approve or reject a review of an organization that never assigned them.
--
-- The invariant now holds at four layers.  Forward-only; no existing row is
-- rewritten (assignments and decisions are immutable records):
--   1. database write guard: an assignment INSERT whose owner_id differs from
--      the owner of its review is refused CONFLICT (DETAIL assignment_owner_mismatch);
--   2. database append guard: a decision may only cite an assignment of the
--      review's own owner (DETAIL decision_assignment_owner_mismatch);
--   3. the decision lookup, the review-scope helper and the qualifying-approver
--      set all require assignment.owner_id = review.owner_id, so a legacy
--      mismatched row is inert (it grants no read, no decision, and counts for
--      no approval) rather than needing a data rewrite;
--   4. the denial branch of the decision RPC therefore answers a concealed 404
--      to the holder of a cross-owner assignment, exactly as for any unrelated
--      human.
begin;

-- SECURITY DEFINER so the owner comparison reads the review whatever row-level
-- visibility the writing session has: an out-of-scope writer is still refused by
-- the session-scope policy, and an in-scope one is refused here when the owners
-- differ.
create or replace function platform_private.cms_schema_review_assignment_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $guard$
declare
  review_owner uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    select review.owner_id into review_owner
      from platform_private.cms_schema_reviews review
     where review.id = new.review_id;
    if not found or review_owner is distinct from new.owner_id then
      raise exception 'CONFLICT' using errcode = 'P0001', detail = 'assignment_owner_mismatch';
    end if;
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.review_id is distinct from old.review_id
     or new.reviewer_person_ref is distinct from old.reviewer_person_ref
     or new.grantor_person_ref is distinct from old.grantor_person_ref
     or new.capability_key is distinct from old.capability_key
     or new.actions is distinct from old.actions
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.created_at is distinct from old.created_at
     or (old.state = 'revoked' and new.state is distinct from old.state)
     or new.version < old.version then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$guard$;

drop trigger cms_schema_review_assignments_z_state_guard
  on platform_private.cms_schema_review_assignments;
create trigger cms_schema_review_assignments_z_state_guard
before insert or update or delete on platform_private.cms_schema_review_assignments
for each row execute function platform_private.cms_schema_review_assignment_guard();

create or replace function platform_private.cms_schema_review_decision_guard()
returns trigger
language plpgsql
set search_path = ''
as $guard$
declare
  review_row platform_private.cms_schema_reviews%rowtype;
  assignment_owner uuid;
begin
  if tg_op <> 'INSERT' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = new.review_id;
  if not found
     or review_row.state <> 'open'
     or review_row.owner_id <> new.owner_id
     or review_row.submitter_person_ref = new.reviewer_person_ref then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select assignment.owner_id into assignment_owner
    from platform_private.cms_schema_review_assignments assignment
   where assignment.id = new.assignment_id and assignment.review_id = new.review_id;
  if not found or assignment_owner is distinct from review_row.owner_id then
    raise exception 'CONFLICT' using errcode = 'P0001', detail = 'decision_assignment_owner_mismatch';
  end if;
  return new;
end;
$guard$;

create or replace function platform_private.cms_review_scope(
  p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_schema_reviews%rowtype;
  person uuid;
begin
  select * into review_row from platform_private.cms_schema_reviews where id = p_review_id;
  if not found then
    return null;
  end if;
  person := platform_private.identity_actor_person(p_actor_id);
  if review_row.owner_id = p_acting_party_id
     and platform_private.cms_person_holds_capability(
       p_acting_party_id, person, 'cms.schema_designer') then
    return 'designer';
  end if;
  if exists (
    select 1 from platform_private.cms_schema_review_assignments assignment
     where assignment.review_id = review_row.id
       and assignment.owner_id = review_row.owner_id
       and assignment.reviewer_person_ref = person
       and platform_private.cms_review_assignment_effective(
         assignment.state, assignment.starts_at, assignment.ends_at)
  ) then
    return 'assigned';
  end if;
  return null;
end;
$body$;

create or replace function platform_private.cms_review_qualifying_approvers(p_review_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(pg_catalog.array_agg(distinct decision.reviewer_person_ref), '{}'::uuid[])
    from platform_private.cms_schema_review_decisions decision
    join platform_private.cms_schema_review_assignments assignment
      on assignment.id = decision.assignment_id
     and assignment.owner_id = decision.owner_id
   where decision.review_id = p_review_id
     and decision.decision = 'approve'
     and platform_private.cms_review_assignment_effective(
       assignment.state, assignment.starts_at, assignment.ends_at)
     and platform_private.cms_review_person_eligible(decision.reviewer_person_ref)
$body$;

create or replace function platform_private.cms_decide_schema_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_schema_reviews%rowtype;
  candidate platform_private.cms_content_type_versions%rowtype;
  assignment_row platform_private.cms_schema_review_assignments%rowtype;
  binding record;
  expected_version bigint;
  decision_value text;
  decision_id uuid := extensions.gen_random_uuid();
  decided_instant timestamptz := pg_catalog.clock_timestamp();
  recorded_count integer;
  approvers uuid[];
  missing_slots integer;
  approval_hash text;
  next_state text := 'open';
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-12:' || coalesce(p_request->>'reviewId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['reviewId','expectedVersion','decision']::text[],
    array['reviewId','expectedVersion','decision','idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'reviewId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  decision_value := p_request->>'decision';
  if pg_catalog.jsonb_typeof(p_request->'decision') <> 'string'
     or decision_value not in ('approve', 'reject') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  person_id := platform_private.identity_actor_person(actor_id);
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = (p_request->>'reviewId')::uuid;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Lock order matches edit invalidation and activation: candidate, then review.
  perform 1 from platform_private.cms_content_type_versions version_row
   where version_row.id = review_row.content_type_version_id for update;
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = review_row.id for update;
  -- Only an effective assignment authorizes a decision.  A caller to whom the
  -- review is readable (the owning party's schema designer or owner) but who
  -- holds no effective assignment is refused 403 FORBIDDEN; every caller to
  -- whom the review is not readable (another organization, an expired or
  -- revoked assignment, an unrelated human) is told the review does not exist.
  select * into assignment_row
    from platform_private.cms_schema_review_assignments assignment
   where assignment.review_id = review_row.id
     and assignment.owner_id = review_row.owner_id
     and assignment.reviewer_person_ref = person_id
     and platform_private.cms_review_assignment_effective(
       assignment.state, assignment.starts_at, assignment.ends_at)
   order by assignment.created_at desc, assignment.id desc
   limit 1;
  if not found then
    if platform_private.cms_review_scope(review_row.id, actor_id, acting_party_id) is null then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into binding from platform_private.cms_review_binding(
    p_request, actor_id, acting_party_id, true);
  if review_row.version <> expected_version
     or review_row.state <> 'open'
     or review_row.submitter_person_ref = person_id
     or exists (
       select 1 from platform_private.cms_schema_review_decisions earlier
        where earlier.review_id = review_row.id and earlier.reviewer_person_ref = person_id
     )
     or not platform_private.cms_review_person_eligible(person_id) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select * into candidate from platform_private.cms_content_type_versions
   where id = review_row.content_type_version_id;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  -- Frozen-evidence recheck: the candidate must still be exactly what was
  -- frozen into the review.
  if candidate.state <> 'review'::platform_private.cms_definition_state
     or candidate.definition_hash is distinct from review_row.definition_hash
     or candidate.schema_artifact_id is distinct from review_row.schema_artifact_id
     or candidate.dry_run_id is distinct from review_row.dry_run_id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select count(*)::integer into recorded_count
    from platform_private.cms_schema_review_decisions decision
   where decision.review_id = review_row.id;
  -- recordedDecisionCount never exceeds the policy requiredDecisionCount.
  if recorded_count >= review_row.required_decision_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if decision_value = 'approve' then
    -- An approval is refused when the decisions still unrecorded afterwards
    -- are fewer than the specialist slots no counted approver would hold.
    missing_slots := platform_private.cms_review_unsatisfied_slots(review_row.id, person_id);
    if review_row.required_decision_count - (recorded_count + 1) < missing_slots then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;
  insert into platform_private.cms_schema_review_decisions(
    id, owner_id, version, created_at, updated_at, review_id, assignment_id,
    assignment_version, reviewer_person_ref, binding_context_hash, capability_key,
    capability_version, decision, decided_at, reviewed_hash, mfa_verified_at
  ) values (
    decision_id, review_row.owner_id, 1, decided_instant, decided_instant, review_row.id,
    assignment_row.id, assignment_row.version, person_id,
    platform_private.cms_review_context_hash(actor_id, person_id, acting_party_id, binding.binding_id),
    'cms.schema_review', 1, decision_value, decided_instant, review_row.definition_hash,
    binding.mfa_verified_at
  );
  if decision_value = 'reject' then
    next_state := 'rejected';
  else
    approvers := platform_private.cms_review_qualifying_approvers(review_row.id);
    if pg_catalog.cardinality(approvers) = review_row.required_decision_count
       and platform_private.cms_review_unsatisfied_slots(review_row.id, null) = 0 then
      next_state := 'approved';
    end if;
  end if;
  if next_state = 'approved' then
    approval_hash := platform_private.cms_schema_review_approval_digest(review_row.id);
    update platform_private.cms_schema_reviews review
       set state = 'approved', decided_at = decided_instant,
           approval_evidence_hash = approval_hash,
           version = review.version + 1, updated_at = decided_instant
     where review.id = review_row.id;
    update platform_private.cms_content_type_versions version_row
       set state = 'approved'::platform_private.cms_definition_state,
           version = version_row.version + 1,
           updated_at = decided_instant,
           approved_at = decided_instant,
           activation_workflow_policy_key = review_row.policy_key,
           activation_workflow_policy_version = review_row.policy_version,
           activation_workflow_policy_hash = review_row.policy_hash,
           activation_required_decision_count = review_row.required_decision_count,
           activation_required_capabilities = review_row.required_capabilities,
           activation_approval_evidence_hash = approval_hash
     where version_row.id = candidate.id;
  elsif next_state = 'rejected' then
    update platform_private.cms_schema_reviews review
       set state = 'rejected', version = review.version + 1, updated_at = decided_instant
     where review.id = review_row.id;
    update platform_private.cms_content_type_versions version_row
       set state = 'draft'::platform_private.cms_definition_state,
           version = version_row.version + 1,
           updated_at = decided_instant
     where version_row.id = candidate.id;
  else
    update platform_private.cms_schema_reviews review
       set version = review.version + 1, updated_at = decided_instant
     where review.id = review_row.id;
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.review.decide', actor_id, acting_party_id, 'cms_schema_review_decision',
    decision_id, 'CMS_SCHEMA_REVIEW_DECIDED', 'cms.schema.review.decided.v1',
    'cms_schema_review', review_row.id, review_row.version + 1,
    pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'decisionId', decision_id, 'schemaVersionId', candidate.id,
      'decision', decision_value, 'state', next_state
    ), correlation_id
  );
  response := platform_private.cms_schema_review_decision_resource(decision_id);
  perform platform_private.cms_complete(reservation.id, decision_id, 201, response);
  return response;
end;
$body$;

commit;
