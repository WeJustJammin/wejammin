-- BE03a CMS-03A-12 (P2-S09-AC-431): a decision by a caller to whom the review
-- is readable but who holds no effective assignment (the owning party's schema
-- designer or owner) is 403 FORBIDDEN; a review that is not readable to the
-- caller (another organization, an expired or revoked assignment, an unrelated
-- human) stays an indistinguishable 404 NOT_FOUND.  Only the denial branch of
-- the assignment lookup changes.  Forward-only.
begin;

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
