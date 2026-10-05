-- BE03a worker switch: the risk class a worker activation reports in its
-- response, its already-active replay and the cms.schema.activated.v1 payload
-- must describe the policy the candidate was REVIEWED under, never whatever
-- registry version of the key is newest when the worker runs.
-- cms_activation_frozen_risk_class resolves it from the approved review
-- snapshot (the strictest-of class frozen at submit, bound to the exact policy
-- key, version and hash the candidate carries), else from the exact frozen
-- registry member, else (versions activated before the review producer existed)
-- from the legacy workflow-key default.  Forward-only.
begin;

create or replace function platform_private.cms_activation_frozen_risk_class(p_candidate_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(
    (select review.risk_class
       from platform_private.cms_content_type_versions version_row
       join platform_private.cms_schema_reviews review
         on review.content_type_version_id = version_row.id
        and review.state = 'approved'
        and review.policy_key = version_row.activation_workflow_policy_key
        and review.policy_version = version_row.activation_workflow_policy_version
        and review.policy_hash = version_row.activation_workflow_policy_hash
      where version_row.id = p_candidate_id
      order by review.decided_at desc nulls last, review.id desc
      limit 1),
    (select policy.risk_class
       from platform_private.cms_content_type_versions version_row
       join platform_private.cms_workflow_policies policy
         on policy.policy_key = version_row.activation_workflow_policy_key
        and policy.policy_version = version_row.activation_workflow_policy_version
        and policy.policy_hash = version_row.activation_workflow_policy_hash
      where version_row.id = p_candidate_id),
    (select platform_private.cms_activation_risk_class(version_row.workflow_key)
       from platform_private.cms_content_type_versions version_row
      where version_row.id = p_candidate_id)
  )
$body$;

revoke all on function platform_private.cms_activation_frozen_risk_class(uuid)
  from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION platform_private.cms_worker_activate_schema(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  plan_id uuid;
  request_content_type_id uuid;
  schema_version_id uuid;
  expected_active_version_id uuid;
  expected_version bigint;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  candidate platform_private.cms_content_type_versions%rowtype;
  current_active platform_private.cms_content_type_versions%rowtype;
  actor_id uuid;
  reservation platform_private.idempotency_records;
  response jsonb;
  event_id uuid;
  risk_class text;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array[
      'migrationPlanId', 'contentTypeId', 'schemaVersionId', 'expectedVersion',
      'expectedActiveVersionId', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash', 'idempotencyKey',
      'switchOnlyOnce'
    ]::text[],
    array[
      'migrationPlanId', 'contentTypeId', 'schemaVersionId', 'expectedVersion',
      'expectedActiveVersionId', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash', 'idempotencyKey',
      'switchOnlyOnce'
    ]::text[]
  );
  if p_request->'switchOnlyOnce' is distinct from 'true'::jsonb then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  request_content_type_id := platform_private.cms_worker_uuid(p_request->>'contentTypeId');
  schema_version_id := platform_private.cms_worker_uuid(p_request->>'schemaVersionId');
  expected_active_version_id := platform_private.cms_worker_uuid(p_request->>'expectedActiveVersionId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  -- Read the plan only to discover the candidate owner.  Do not hold the
  -- plan lock yet: human activation takes candidate/graph/active locks first,
  -- so taking plan -> candidate here would deadlock a concurrent switch.
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.content_type_id <> request_content_type_id
     or plan_row.to_version_id <> schema_version_id
     or plan_row.from_version_id <> expected_active_version_id
     or plan_row.version <> expected_version
     or plan_row.state <> 'completed' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select * into candidate
    from platform_private.cms_content_type_versions version_row
   where version_row.id = schema_version_id
     and version_row.content_type_id = request_content_type_id
     and version_row.owner_id = plan_row.owner_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  actor_id := coalesce(candidate.created_by, plan_row.created_by, plan_id);
  -- The class is the FROZEN one (strictest-of review snapshot, or the exact frozen
  -- registry member): a newer version of the same policy key never changes it.
  risk_class := platform_private.cms_activation_frozen_risk_class(candidate.id);
  -- Keep the worker's lock order identical to human activation:
  -- candidate -> dependency graph -> current active -> authority/review /
  -- context -> migration plan.  The initial plan read above is unlocked;
  -- this order prevents a human switch (which reaches the plan after its
  -- source row) from deadlocking against a worker holding plan first.
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.state = 'active'::platform_private.cms_definition_state then
    -- An active replay has no source row or fresh human decision to acquire;
    -- it still rechecks the immutable dependency graph below.
    null;
  else
    if candidate.state <> 'approved'::platform_private.cms_definition_state then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select * into current_active
      from platform_private.cms_content_type_versions version_row
     where version_row.id = expected_active_version_id
       and version_row.content_type_id = request_content_type_id
       and version_row.owner_id = plan_row.owner_id
       and version_row.state = 'active'::platform_private.cms_definition_state
     for update;
    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if not platform_private.cms_worker_human_approval_valid(candidate.id) then
      raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
    end if;
    if (select review.locale_config_hash
          from platform_private.cms_schema_reviews review
         where review.content_type_version_id = candidate.id
           and review.state = 'approved'
         order by review.decided_at desc, review.id desc
         limit 1) is distinct from platform_private.cms_locale_config_hash(
           candidate.source_locale, candidate.default_locale,
           candidate.supported_locales, candidate.fallback_chains) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if not platform_private.cms_activation_references_valid(candidate.id) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end if;
  -- The plan lock is acquired only after the same graph/source/authority
  -- locks as the human path.  Revalidate every unlocked snapshot before use.
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.content_type_id <> request_content_type_id
     or plan_row.to_version_id <> schema_version_id
     or plan_row.from_version_id <> expected_active_version_id
     or plan_row.version <> expected_version
     or plan_row.state <> 'completed' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  if not platform_private.cms_migration_plan_ready(
    plan_id, request_content_type_id, schema_version_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if candidate.state <> 'active'::platform_private.cms_definition_state
     and not platform_private.cms_migration_source_unchanged(plan_row) then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  reservation := platform_private.cms_reserve(
    p_request, actor_id, 'CMS-03A-WORKER-ACTIVATE:' || plan_id::text
  );
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if candidate.state = 'active'::platform_private.cms_definition_state then
    -- A replay/status call must not turn an already-active row into a blind
    -- bypass of the immutable artifact/reference boundary.  Human approval
    -- is intentionally not recomputed here: the active row's server-owned
    -- activation evidence is the replay authority, while the first switch
    -- below requires the fresh review path.
    if not platform_private.cms_activation_references_valid(candidate.id) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if candidate.activation_workflow_policy_key is null
       or candidate.activation_workflow_policy_version is null
       or candidate.activation_workflow_policy_hash is null
       or candidate.activation_required_decision_count is null
       or candidate.activation_required_capabilities is null
       or candidate.activation_approval_evidence_hash is null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select event.id into event_id
      from platform_private.outbox_events event
     where event.event_type = 'cms.schema.activated.v1'
       and event.aggregate_id = candidate.id
     order by event.occurred_at desc, event.id desc
     limit 1;
    response := jsonb_build_object(
      'activated', false,
      'status', 'already_active',
      'migrationPlanId', plan_id,
      'schemaVersionId', candidate.id,
      'eventId', event_id,
      'activationEvidence', jsonb_build_object(
        'key', candidate.activation_workflow_policy_key,
        'version', candidate.activation_workflow_policy_version::text,
        'policyHash', candidate.activation_workflow_policy_hash,
        'riskClass', risk_class,
        'requiredDecisionCount', candidate.activation_required_decision_count,
        'requiredCapabilities', candidate.activation_required_capabilities,
        'approvalEvidenceHash', candidate.activation_approval_evidence_hash
      )
    );
    perform platform_private.cms_complete(reservation.id, candidate.id, 200, response);
    return response;
  end if;
  update platform_private.cms_content_type_versions
     set state = 'superseded', version = version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where id = current_active.id;
  update platform_private.cms_content_type_versions
     set state = 'active',
         version = version + 1,
         updated_at = pg_catalog.clock_timestamp(),
         approved_at = coalesce(approved_at, pg_catalog.clock_timestamp())
   where id = candidate.id;
  update platform_private.cms_content_types
     set state = 'active', version = version + 1,
         updated_at = pg_catalog.clock_timestamp()
     where id = request_content_type_id;
  event_id := platform_private.cms_emit_event(
    'cms.schema.activate.worker', actor_id, plan_row.owner_id,
    'cms_content_type_version', candidate.id, 'CMS_SCHEMA_ACTIVATED',
    'cms.schema.activated.v1', 'cms_content_type_version', candidate.id,
    candidate.version + 1,
    jsonb_build_object(
      'contentTypeId', request_content_type_id,
      'schemaVersionId', candidate.id,
      'migrationPlanId', plan_id,
      'localeConfigHash', candidate.locale_config_hash,
      'activationEvidence', jsonb_build_object(
        'key', candidate.activation_workflow_policy_key,
        'version', candidate.activation_workflow_policy_version::text,
        'policyHash', candidate.activation_workflow_policy_hash,
        'riskClass', risk_class,
        'requiredDecisionCount', candidate.activation_required_decision_count,
        'requiredCapabilities', candidate.activation_required_capabilities,
        'approvalEvidenceHash', candidate.activation_approval_evidence_hash
      )
    ),
    plan_id
  );
  response := jsonb_build_object(
    'activated', true,
    'status', 'activated',
    'migrationPlanId', plan_id,
    'schemaVersionId', candidate.id,
    'eventId', event_id,
    'activationEvidence', jsonb_build_object(
      'key', candidate.activation_workflow_policy_key,
      'version', candidate.activation_workflow_policy_version::text,
      'policyHash', candidate.activation_workflow_policy_hash,
      'riskClass', risk_class,
      'requiredDecisionCount', candidate.activation_required_decision_count,
      'requiredCapabilities', candidate.activation_required_capabilities,
      'approvalEvidenceHash', candidate.activation_approval_evidence_hash
    )
  );
  perform platform_private.cms_complete(reservation.id, candidate.id, 202, response);
  return response;
end;
$function$;

revoke all on function platform_private.cms_worker_activate_schema(jsonb)
  from public, anon, authenticated, service_role;

commit;
