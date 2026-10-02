-- BE03a real migration scan: plan lifecycle (3/3).  Both switch paths (the
-- human activation's plan advance and the worker activation) refuse to switch
-- when the live source rows differ from the sealed dry-run evidence.
-- Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_advance_activation_plan(p_candidate_id uuid, p_source_id uuid, p_requested_plan_id uuid, p_dry_run_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  candidate platform_private.cms_content_type_versions%rowtype;
  report_row platform_private.cms_schema_dry_run_reports%rowtype;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  now_at timestamptz := pg_catalog.clock_timestamp();
  lease_expires_at timestamptz;
begin
  select * into candidate from platform_private.cms_content_type_versions
   where id = p_candidate_id;
  select * into report_row from platform_private.cms_schema_dry_run_reports report
   where report.id = p_dry_run_id and report.target_version_id = p_candidate_id
     and report.owner_id = candidate.owner_id;
  if not found
     or candidate.dry_run_id is distinct from report_row.id
     or report_row.state <> 'completed'
     or report_row.result is distinct from 'pass'
     or report_row.source_version_id is distinct from p_source_id
     or (p_requested_plan_id is not null and report_row.plan_id is distinct from p_requested_plan_id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select * into plan_row from platform_private.cms_schema_migration_plans plan
   where plan.id = report_row.plan_id for update;
  if not found
     or plan_row.owner_id is distinct from candidate.owner_id
     or plan_row.content_type_id is distinct from candidate.content_type_id
     or plan_row.to_version_id is distinct from candidate.id
     or plan_row.from_version_id is distinct from p_source_id
     or plan_row.classification is distinct from candidate.compatibility
     or not platform_private.cms_migration_plan_ready(
       plan_row.id, candidate.content_type_id, candidate.id
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- The switch rests on the scanned source: rows created or changed after the
  -- sealed dry run invalidate the plan (a fresh dry run is required).
  if not platform_private.cms_migration_source_unchanged(plan_row) then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  if plan_row.state = 'ready' then
    if plan_row.source_count <> 0 or plan_row.target_count <> 0
       or plan_row.row_error_count <> 0 or plan_row.migrated_count <> 0
       or plan_row.failed_count <> 0 or plan_row.cursor < plan_row.source_count then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    begin
      lease_expires_at := (plan_row.dry_run_report->'lease'->>'expiresAt')::timestamptz;
    exception when others then
      lease_expires_at := null;
    end;
    update platform_private.cms_schema_migration_plans plan
       set state = 'completed',
           version = plan.version + 1,
           updated_at = now_at,
           completed_at = now_at,
           dry_run_report = platform_private.cms_worker_set_report(
             plan.dry_run_report, 'completed', null, null,
             greatest(coalesce(lease_expires_at, now_at), now_at + interval '15 minutes'),
             plan.source_count, plan.target_count, plan.row_error_count,
             plan.migrated_count, plan.failed_count
           )
     where plan.id = plan_row.id and plan.version = plan_row.version;
    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;
  return plan_row.id;
end;
$function$;

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
  risk_class := platform_private.cms_activation_risk_class(candidate.workflow_key);
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

revoke all on function platform_private.cms_advance_activation_plan(uuid, uuid, uuid, uuid),
  platform_private.cms_worker_activate_schema(jsonb)
  from public, anon, authenticated, service_role;

commit;
