-- Forward-only correction of the platform_private.cms_activate_schema
-- internal acting-context gate.  Verified server actor fields (authUserId,
-- sessionId, actorPersonId, actingPartyId, stepUpVerified, stepUpAt,
-- requestId, correlationId) are admitted alongside the mandatory private
-- actingContextId binding id so the service-role Worker context can reach the
-- existing MFA/heartbeat and approval checks.
--
-- Unchanged: trusted actor resolution (platform_private.cfg_actor), the
-- service-role trust model, capability requirement, binding owner/person/
-- party/active/expiry/recent-MFA re-check, and every approval, policy, and
-- evidence computation.  actingContextId stays a required key: absent or
-- malformed bindings still fail closed with STEP_UP_REQUIRED, and any other
-- unknown nested key still fails closed.

create or replace function platform_private.cms_activate_schema(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
<<activation_block>>
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  candidate platform_private.cms_content_type_versions%rowtype;
  current_active platform_private.cms_content_type_versions%rowtype;
  expected_version bigint;
  approval_count integer;
  required_decision_count integer;
  approval_evidence_count integer;
  distinct_approver_count integer;
  resolved_review_count integer;
  approval_ids uuid[];
  required_capabilities jsonb;
  mfa_context_id uuid;
  validation_at timestamptz;
  policy_hash text;
  approval_hash text;
  activation_evidence_hash text;
  risk_class text;
  migration_plan_id uuid;
  event_id uuid;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-04:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('state', 'active', 'contentTypeVersionId', (reservation.response_ref->>'resourceRef')::uuid, 'eventType', 'cms.schema.activated.v1');
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId']::text[],
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId','expectedActivationEvidenceHash','idempotencyKey','ifMatch','context','correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or not platform_private.cms_valid_uuid(p_request->>'dryRunId')
     or pg_catalog.jsonb_typeof(p_request->'approvalIds') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'approvalIds') not between 1 and 8 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into candidate from platform_private.cms_content_type_versions
  where id = (p_request->>'versionId')::uuid
    and content_type_id = (p_request->>'contentTypeId')::uuid
    and owner_id = acting_party_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  risk_class := platform_private.cms_activation_risk_class(candidate.workflow_key);
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.state <> 'approved' or candidate.version <> expected_version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  if candidate.dry_run_id is distinct from (p_request->>'dryRunId')::uuid then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from platform_private.cms_schema_artifacts artifact
    where artifact.id = candidate.schema_artifact_id
      and artifact.content_type_version_id = candidate.id
      and artifact.artifact_hash = candidate.definition_hash
      and artifact.state = 'compiled'
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  current_active := null;
  select * into current_active
  from platform_private.cms_content_type_versions active_version
  where active_version.content_type_id = candidate.content_type_id
    and active_version.owner_id = candidate.owner_id
    and active_version.state = 'active'
    and active_version.id <> candidate.id
  order by active_version.id
  for update;
  if exists (
    select 1 from jsonb_array_elements_text(p_request->'approvalIds') a
    where not platform_private.cms_valid_uuid(a)
  ) or (select count(distinct value) from jsonb_array_elements_text(p_request->'approvalIds') value) <> jsonb_array_length(p_request->'approvalIds') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if candidate.compatibility in ('conditional', 'breaking') and nullif(p_request->>'migrationPlanId', '') is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->'migrationPlanId' <> 'null'::jsonb then
    if not platform_private.cms_valid_uuid(p_request->>'migrationPlanId') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if not platform_private.cms_migration_plan_ready(
      (p_request->>'migrationPlanId')::uuid,
      candidate.content_type_id,
      candidate.id
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end if;
  select array_agg(value::uuid order by value::uuid) into approval_ids
  from jsonb_array_elements_text(p_request->'approvalIds') as approval(value);
  required_decision_count := coalesce(
    candidate.activation_required_decision_count::integer,
    case when candidate.workflow_key in ('protected', 'high-risk', 'high_risk') then 2 else 1 end
  );
  required_capabilities := coalesce(
    candidate.activation_required_capabilities,
    jsonb_build_array('cms.schema_designer')
  );
  policy_hash := coalesce(
    candidate.activation_workflow_policy_hash,
    encode(extensions.digest(convert_to('cms.schema.activate:1', 'utf8'), 'sha256'), 'hex')
  );
  if required_decision_count not between 1 and 8
     or pg_catalog.jsonb_typeof(required_capabilities) <> 'array'
     or pg_catalog.jsonb_array_length(required_capabilities) not between 1 and 16
     or policy_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- The request carries only opaque review IDs.  Approval, capability, and
  -- recent-MFA evidence is resolved from the immutable configuration review
  -- authority; caller-supplied step-up booleans/timestamps are ignored.
  -- The activation context is the Worker's server-verified envelope, not a
  -- caller-authored selector.  The service-role path already resolves the
  -- verified actor through cfg_actor; requiring a binding-only object made the
  -- production path unreachable because cfg_actor could then no longer see
  -- authUserId.  The private acting-context binding id remains mandatory, and
  -- its owner, person, acting party, active/expiry state, and recent-MFA
  -- heartbeat are re-checked below against the persisted binding row.
  if not platform_private.cms_exact_keys(
    p_request->'context',
    array['actingContextId']::text[],
    array[
      'actingContextId','authUserId','sessionId','actorPersonId',
      'actingPartyId','stepUpVerified','stepUpAt','requestId','correlationId'
    ]::text[]
  ) or not platform_private.cms_valid_uuid(p_request->'context'->>'actingContextId') then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
  mfa_context_id := (p_request->'context'->>'actingContextId')::uuid;
  perform platform_private.cms_lock_activation_authority(
    candidate.id, actor_id, mfa_context_id
  );
  validation_at := pg_catalog.clock_timestamp();
  if not exists (
    select 1
    from platform_private.acting_context_binding context_binding
    where context_binding.id = mfa_context_id
      and context_binding.person_id = platform_private.identity_actor_person(actor_id)
      and context_binding.acting_party_id = candidate.owner_id
      and context_binding.state = 'active'
      and context_binding.expires_at > validation_at
      and context_binding.last_seen_at >= validation_at - interval '10 minutes'
  ) then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
  select coalesce(max(review.required_approvals), 1) into required_decision_count
  from platform_private.cfg_config_change_reviews review
  where review.id = any(approval_ids)
    and review.candidate_type = 'setting_value'
    and review.candidate_id = candidate.id
    and review.candidate_version = candidate.version
    and review.frozen_hash = candidate.definition_hash
    and review.state = 'approved'
    and review.risk_class in ('high', 'emergency')
    and review.submitted_by = actor_id
    and review.effective_context_hash = platform_private.cfg_hash_json(p_request->'context')
    and review.submitted_at >= validation_at - interval '10 minutes'
    and review.submitted_at <= validation_at;
  required_capabilities := jsonb_build_array('cms.schema_designer');
  policy_hash := encode(extensions.digest(convert_to(
    'cms.schema.activate:1:' || required_decision_count || ':' || required_capabilities::text,
    'utf8'
  ), 'sha256'), 'hex');
  if risk_class = 'protected' and required_decision_count < 2 then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end if;
  -- Resolve the supplied opaque review IDs through the same evidence set used
  -- for the count and digest.  An unknown, extra, or otherwise ineligible ID
  -- must not disappear from the request while the remaining approvals pass.
  select count(*), count(distinct approval.reviewer_person_id),
         count(distinct approval.review_id)
    into approval_evidence_count, distinct_approver_count, resolved_review_count
  from platform_private.cfg_config_approvals approval
  join platform_private.cfg_config_change_reviews review on review.id = approval.review_id
  where approval.review_id = any(approval_ids)
    and approval.decision = 'approve'
    and approval.reviewed_hash = candidate.definition_hash
    and approval.capability = any(select jsonb_array_elements_text(required_capabilities))
    and approval.decided_at <= validation_at
    and approval.decided_at >= validation_at - interval '10 minutes'
    and approval.reviewer_person_id <> actor_id
    and approval.review_version = review.version_no
    and review.candidate_type = 'setting_value'
    and review.candidate_id = candidate.id
    and review.candidate_version = candidate.version
    and review.frozen_hash = candidate.definition_hash
    and review.state = 'approved'
    and review.risk_class in ('high', 'emergency')
    and review.submitted_by = actor_id
    and review.effective_context_hash = platform_private.cfg_hash_json(p_request->'context')
    and review.submitted_at >= validation_at - interval '10 minutes'
    and review.submitted_at <= validation_at
    and exists (
      select 1
      from platform_private.acting_context_binding context_binding
      where context_binding.id = mfa_context_id
        and context_binding.person_id = platform_private.identity_actor_person(actor_id)
        and context_binding.acting_party_id = candidate.owner_id
        and context_binding.state = 'active'
        and context_binding.expires_at > validation_at
        and context_binding.last_seen_at >= validation_at - interval '10 minutes'
    )
    and exists (
      select 1
      from identity_private.membership_tenure tenure
      join identity_private.organization_actor_grant actor_grant
        on actor_grant.organization_id = tenure.organization_id
       and actor_grant.person_id = tenure.person_id
      where tenure.organization_id = candidate.owner_id
        and tenure.person_id = platform_private.identity_actor_person(approval.reviewer_person_id)
        and tenure.state = 'confirmed'
        and (tenure.ends_on is null or tenure.ends_on >= current_date)
        and actor_grant.capability_code = approval.capability
        and actor_grant.active
        and actor_grant.valid_from <= current_date
        and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
    );
  if resolved_review_count <> cardinality(approval_ids)
     or distinct_approver_count <> approval_evidence_count
     or approval_evidence_count < required_decision_count then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end if;
  select encode(extensions.digest(convert_to(
    coalesce(jsonb_agg(jsonb_build_object(
      'reviewId', approval.review_id,
      'reviewerAuthUserId', approval.reviewer_person_id,
      'capability', approval.capability,
      'reviewedHash', approval.reviewed_hash,
      'reviewVersion', approval.review_version,
      'decidedAt', approval.decided_at
    ) order by approval.review_id, approval.reviewer_person_id)::text, '[]'), 'utf8'),
    'sha256'
  ), 'hex') into approval_hash
  from platform_private.cfg_config_approvals approval
  join platform_private.cfg_config_change_reviews review
    on review.id = approval.review_id
  where approval.review_id = any(approval_ids)
    and approval.decision = 'approve'
    and approval.reviewed_hash = candidate.definition_hash
    and approval.capability = any(select jsonb_array_elements_text(required_capabilities))
    and approval.decided_at <= validation_at
    and approval.decided_at >= validation_at - interval '10 minutes'
    and approval.reviewer_person_id <> actor_id
    and approval.review_version = review.version_no
    and review.candidate_type = 'setting_value'
    and review.candidate_id = candidate.id
    and review.candidate_version = candidate.version
    and review.frozen_hash = candidate.definition_hash
    and review.state = 'approved'
    and review.risk_class in ('high', 'emergency')
    and review.submitted_by = actor_id
    and review.effective_context_hash = platform_private.cfg_hash_json(p_request->'context')
    and review.submitted_at >= validation_at - interval '10 minutes'
    and review.submitted_at <= validation_at
    and exists (
      select 1
      from platform_private.acting_context_binding context_binding
      where context_binding.id = mfa_context_id
        and context_binding.person_id = platform_private.identity_actor_person(actor_id)
        and context_binding.acting_party_id = candidate.owner_id
        and context_binding.state = 'active'
        and context_binding.expires_at > validation_at
        and context_binding.last_seen_at >= validation_at - interval '10 minutes'
    )
    and exists (
      select 1
      from identity_private.membership_tenure tenure
      join identity_private.organization_actor_grant actor_grant
        on actor_grant.organization_id = tenure.organization_id
       and actor_grant.person_id = tenure.person_id
      where tenure.organization_id = candidate.owner_id
        and tenure.person_id = platform_private.identity_actor_person(approval.reviewer_person_id)
        and tenure.state = 'confirmed'
        and (tenure.ends_on is null or tenure.ends_on >= current_date)
        and actor_grant.capability_code = approval.capability
        and actor_grant.active
        and actor_grant.valid_from <= current_date
        and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
    );
  approval_count := required_decision_count;
  activation_evidence_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'key', 'cms.schema.activate', 'version', '1', 'policyHash', policy_hash,
    'riskClass', risk_class,
    'requiredDecisionCount', approval_count,
    'requiredCapabilities', jsonb_build_array('cms.schema_designer'),
    'approvalEvidenceHash', approval_hash
  )::text, 'utf8'), 'sha256'), 'hex');
  if p_request ? 'expectedActivationEvidenceHash'
     and p_request->'expectedActivationEvidenceHash' <> 'null'::jsonb
     and p_request->>'expectedActivationEvidenceHash' <> activation_evidence_hash then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- Re-read the active pointer after the approval checks.  This closes the
  -- gap where another activation can supersede the row observed at the start
  -- of this transaction while this candidate is being reviewed.
  current_active := null;
  select * into current_active
  from platform_private.cms_content_type_versions active_version
  where active_version.content_type_id = candidate.content_type_id
    and active_version.owner_id = candidate.owner_id
    and active_version.state = 'active'
    and active_version.id <> candidate.id
  order by active_version.id
  for update;
  if not platform_private.cms_activation_references_valid(candidate.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  migration_plan_id := platform_private.cms_prepare_activation_migration(
    candidate.id,
    current_active.id,
    case when p_request->'migrationPlanId' = 'null'::jsonb
      then null else (p_request->>'migrationPlanId')::uuid end,
    (p_request->>'dryRunId')::uuid
  );
  update platform_private.cms_content_type_versions
  set state = 'active', version = version + 1, updated_at = now(), approved_at = coalesce(approved_at, now()),
      dry_run_id = (p_request->>'dryRunId')::uuid,
      activation_workflow_policy_key = 'cms.schema.activate',
      activation_workflow_policy_version = 1,
      activation_workflow_policy_hash = policy_hash,
      activation_required_decision_count = approval_count,
      activation_required_capabilities = jsonb_build_array('cms.schema_designer'),
      -- Store the same outer policy/evidence envelope that the worker
      -- validator recomputes, not the inner approval-set digest.
      activation_approval_evidence_hash = activation_evidence_hash
  where id = candidate.id and version = expected_version;
  if not found then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  if current_active.id is not null then
    update platform_private.cms_content_type_versions set state = 'superseded', updated_at = now(), version = version + 1 where id = current_active.id;
  end if;
  update platform_private.cms_content_types set state = 'active', version = version + 1, updated_at = now() where id = candidate.content_type_id;
  event_id := platform_private.cms_emit_event(
    'cms.schema.activate', actor_id, acting_party_id, 'cms_content_type_version', candidate.id,
    'CMS_SCHEMA_ACTIVATED', 'cms.schema.activated.v1', 'cms_content_type_version', candidate.id,
    expected_version + 1,
    jsonb_build_object(
      'contentTypeId', candidate.content_type_id,
      'schemaVersionId', candidate.id,
      'migrationPlanId', migration_plan_id,
      'activationEvidence', jsonb_build_object(
        'key', 'cms.schema.activate', 'version', '1', 'policyHash', policy_hash,
        'riskClass', risk_class,
        'requiredDecisionCount', approval_count,
        'requiredCapabilities', jsonb_build_array('cms.schema_designer'),
        'approvalEvidenceHash', activation_evidence_hash
      )
    ), correlation_id
  );
  response := jsonb_build_object(
    'id', candidate.id, 'version', (expected_version + 1)::text, 'contentTypeVersionId', candidate.id,
    'state', 'active', 'activatedAt', now(), 'migrationPlanId', migration_plan_id,
    'activationEvidence', jsonb_build_object(
      'key', 'cms.schema.activate', 'version', '1', 'policyHash', policy_hash,
      'riskClass', risk_class, 'requiredDecisionCount', approval_count,
      'requiredCapabilities', jsonb_build_array('cms.schema_designer'),
      'approvalEvidenceHash', activation_evidence_hash
    ), 'jobId', null, 'eventType', 'cms.schema.activated.v1', 'eventId', event_id
  );
  perform platform_private.cms_complete(reservation.id, candidate.id, 202, response);
  return response;
end;
$body$;
