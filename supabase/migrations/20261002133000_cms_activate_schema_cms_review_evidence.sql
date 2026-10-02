-- DEC-108 activation (CMS-03A-04): the only approval evidence is the private
-- CMS review chain.  Defect A: no CFG setting-value review or approval is read
-- or written.  Defect B: the review identity is the stable actor/person/party/
-- binding projection frozen on the review, never the whole transport context.
-- Defect D: no decision-age window; a reviewer's current assignment, person
-- eligibility and specialist capability are rechecked instead, and only the
-- activator's own binding-bound MFA is rechecked.  Activation advances the plan
-- that CMS-03A-10 bound to the dry-run and never creates one.  The strictest-of
-- policy snapshot frozen on the review is the activation evidence.
-- Forward-only.
begin;

-- Authority rows an activation (or the worker's second switch) must serialize
-- with: the activator's binding, the owner organization's membership and grant
-- rows, and the candidate's review, assignment and decision rows.
create or replace function platform_private.cms_lock_activation_authority(
  p_candidate_id uuid, p_actor_id uuid, p_context_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  owner_id uuid;
  actor_person_id uuid;
begin
  select version_row.owner_id into owner_id
    from platform_private.cms_content_type_versions version_row
   where version_row.id = p_candidate_id;
  if owner_id is null then
    return;
  end if;
  actor_person_id := platform_private.identity_actor_person(p_actor_id);
  if p_context_id is not null then
    perform 1
      from platform_private.acting_context_binding context_binding
     where context_binding.id = p_context_id
     order by context_binding.id
     for update;
  else
    perform 1
      from platform_private.acting_context_binding context_binding
     where context_binding.person_id = actor_person_id
       and context_binding.acting_party_id = owner_id
       and context_binding.state = 'active'
     order by context_binding.id
     for update;
  end if;
  perform 1
    from identity_private.membership_tenure tenure
   where tenure.organization_id = owner_id
   order by tenure.id
   for update;
  perform 1
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = owner_id
   order by actor_grant.organization_id, actor_grant.person_id,
            actor_grant.capability_code
   for update;
  perform 1
    from platform_private.cms_schema_reviews review
   where review.content_type_version_id = p_candidate_id
   order by review.id
   for update;
  perform 1
    from platform_private.cms_schema_review_assignments assignment
    join platform_private.cms_schema_reviews review on review.id = assignment.review_id
   where review.content_type_version_id = p_candidate_id
   order by assignment.id
   for update of assignment;
end;
$body$;

-- The one approved review whose frozen evidence, policy snapshot, approve
-- decisions and reviewers' current authority all still hold for the candidate;
-- else APPROVAL_INVALID.  p_decision_ids, when given, must be exactly the
-- approve-decision ids of that review (the review id itself, an unknown id or a
-- missing approval is refused).  The stored approval digest is verified
-- against the stored decision rows, never recomputed from mutable inputs.
create or replace function platform_private.cms_resolve_activation_review(
  p_candidate_id uuid, p_decision_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate platform_private.cms_content_type_versions%rowtype;
  review_row platform_private.cms_schema_reviews%rowtype;
  policy jsonb;
  approve_ids uuid[];
begin
  select * into candidate from platform_private.cms_content_type_versions
   where id = p_candidate_id;
  if not found then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end if;
  select * into review_row
    from platform_private.cms_schema_reviews review
   where review.content_type_version_id = candidate.id
     and review.state = 'approved'
   order by review.decided_at desc, review.id desc
   limit 1;
  if not found
     or review_row.definition_hash is distinct from candidate.definition_hash
     or review_row.schema_artifact_id is distinct from candidate.schema_artifact_id
     or review_row.dry_run_id is distinct from candidate.dry_run_id
     or review_row.approval_evidence_hash is distinct from candidate.activation_approval_evidence_hash
     or review_row.policy_key is distinct from candidate.activation_workflow_policy_key
     or review_row.policy_version is distinct from candidate.activation_workflow_policy_version
     or review_row.policy_hash is distinct from candidate.activation_workflow_policy_hash
     or review_row.required_decision_count::integer
          is distinct from candidate.activation_required_decision_count::integer
     or review_row.required_capabilities is distinct from candidate.activation_required_capabilities
     or review_row.approval_evidence_hash
          is distinct from platform_private.cms_schema_review_approval_digest(review_row.id) then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end if;
  begin
    policy := platform_private.cms_resolve_review_policy(candidate.id);
  exception when others then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end;
  if review_row.policy_key is distinct from policy->>'policyKey'
     or review_row.policy_version is distinct from (policy->>'policyVersion')::bigint
     or review_row.policy_hash is distinct from policy->>'policyHash'
     or review_row.source_policy_key is distinct from policy->>'sourcePolicyKey'
     or review_row.source_policy_version is distinct from (policy->>'sourcePolicyVersion')::bigint
     or review_row.source_policy_hash is distinct from policy->>'sourcePolicyHash'
     or review_row.risk_class is distinct from policy->>'riskClass'
     or review_row.required_decision_count::integer
          is distinct from (policy->>'requiredDecisionCount')::integer
     or review_row.required_capabilities is distinct from policy->'requiredCapabilities' then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.array_agg(decision.id order by decision.id), '{}'::uuid[])
    into approve_ids
    from platform_private.cms_schema_review_decisions decision
   where decision.review_id = review_row.id and decision.decision = 'approve';
  if p_decision_ids is not null
     and (select coalesce(pg_catalog.array_agg(distinct supplied.id order by supplied.id), '{}'::uuid[])
            from pg_catalog.unnest(p_decision_ids) supplied(id)) is distinct from approve_ids then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_schema_review_decisions decision
     where decision.review_id = review_row.id
       and decision.decision = 'approve'
       and decision.reviewed_hash is distinct from candidate.definition_hash
  ) or pg_catalog.cardinality(
         platform_private.cms_review_qualifying_approvers(review_row.id)
       ) <> review_row.required_decision_count
     or platform_private.cms_review_unsatisfied_slots(review_row.id, null) <> 0 then
    raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
  end if;
  return review_row.id;
end;
$body$;

-- Worker-side recheck of the same evidence for the second atomic switch.
create or replace function platform_private.cms_worker_human_approval_valid(p_candidate_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate platform_private.cms_content_type_versions%rowtype;
begin
  select * into candidate from platform_private.cms_content_type_versions
   where id = p_candidate_id for update;
  if not found then
    return false;
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  perform platform_private.cms_lock_activation_authority(candidate.id, candidate.created_by, null);
  perform platform_private.cms_resolve_activation_review(candidate.id, null);
  return true;
exception when others then
  return false;
end;
$body$;

-- Advances the migration plan CMS-03A-10 bound to the candidate's sealed dry
-- run to completed (zero-source hand-off); never creates a plan.
create or replace function platform_private.cms_advance_activation_plan(
  p_candidate_id uuid, p_source_id uuid, p_requested_plan_id uuid, p_dry_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
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
$body$;

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
  review_row platform_private.cms_schema_reviews%rowtype;
  binding record;
  expected_version bigint;
  approval_ids uuid[];
  review_id uuid;
  migration_plan_id uuid;
  evidence jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-04:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('state', 'active', 'contentTypeVersionId',
      (reservation.response_ref->>'resourceRef')::uuid, 'eventType', 'cms.schema.activated.v1');
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId']::text[],
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId',
          'expectedActivationEvidenceHash','idempotencyKey','ifMatch','context','correlationId']::text[]
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
  if exists (
    select 1 from jsonb_array_elements_text(p_request->'approvalIds') a
     where not platform_private.cms_valid_uuid(a)
  ) or (select count(distinct value) from jsonb_array_elements_text(p_request->'approvalIds') value)
         <> jsonb_array_length(p_request->'approvalIds') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select array_agg(value::uuid order by value::uuid) into approval_ids
    from jsonb_array_elements_text(p_request->'approvalIds') as approval(value);
  select * into candidate from platform_private.cms_content_type_versions
   where id = (p_request->>'versionId')::uuid
     and content_type_id = (p_request->>'contentTypeId')::uuid
     and owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.state <> 'approved' or candidate.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.dry_run_id is distinct from (p_request->>'dryRunId')::uuid then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from platform_private.cms_schema_artifacts artifact
     where artifact.id = candidate.schema_artifact_id
       and artifact.content_type_version_id = candidate.id
       and artifact.artifact_hash = candidate.definition_hash
       and artifact.state = 'compiled'
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  current_active := null;
  select * into current_active from platform_private.cms_content_type_versions active_version
   where active_version.content_type_id = candidate.content_type_id
     and active_version.owner_id = candidate.owner_id
     and active_version.state = 'active'
     and active_version.id <> candidate.id
   order by active_version.id
   for update;
  if candidate.supersedes_id is distinct from current_active.id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.compatibility in ('conditional', 'breaking')
     and nullif(p_request->>'migrationPlanId', '') is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->'migrationPlanId' <> 'null'::jsonb
     and not platform_private.cms_valid_uuid(p_request->>'migrationPlanId') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- Only the activator's own binding-bound MFA is rechecked; the server-verified
  -- envelope's step-up flags and timestamps are never authority.
  select * into binding from platform_private.cms_review_binding(
    p_request, actor_id, acting_party_id, true);
  perform platform_private.cms_lock_activation_authority(candidate.id, actor_id, binding.binding_id);
  review_id := platform_private.cms_resolve_activation_review(candidate.id, approval_ids);
  select * into review_row from platform_private.cms_schema_reviews where id = review_id;
  if not platform_private.cms_activation_references_valid(candidate.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  evidence := jsonb_build_object(
    'key', review_row.policy_key,
    'version', review_row.policy_version::text,
    'policyHash', review_row.policy_hash,
    'riskClass', review_row.risk_class,
    'requiredDecisionCount', review_row.required_decision_count,
    'requiredCapabilities', review_row.required_capabilities,
    'approvalEvidenceHash', review_row.approval_evidence_hash
  );
  if p_request ? 'expectedActivationEvidenceHash'
     and p_request->'expectedActivationEvidenceHash' <> 'null'::jsonb
     and p_request->>'expectedActivationEvidenceHash' <> review_row.approval_evidence_hash then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  migration_plan_id := platform_private.cms_advance_activation_plan(
    candidate.id, current_active.id,
    case when p_request->'migrationPlanId' = 'null'::jsonb
      then null else (p_request->>'migrationPlanId')::uuid end,
    (p_request->>'dryRunId')::uuid
  );
  -- The previous active version is superseded first: at most one version of a
  -- type may be active at any instant.
  if current_active.id is not null then
    update platform_private.cms_content_type_versions
       set state = 'superseded', updated_at = now(), version = version + 1
     where id = current_active.id;
  end if;
  update platform_private.cms_content_type_versions
     set state = 'active', version = version + 1, updated_at = now(),
         approved_at = coalesce(approved_at, now())
   where id = candidate.id and version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_content_types
     set state = 'active', version = version + 1, updated_at = now()
   where id = candidate.content_type_id;
  perform platform_private.cms_emit_event(
    'cms.schema.activate', actor_id, acting_party_id, 'cms_content_type_version', candidate.id,
    'CMS_SCHEMA_ACTIVATED', 'cms.schema.activated.v1', 'cms_content_type_version', candidate.id,
    expected_version + 1,
    jsonb_build_object(
      'contentTypeId', candidate.content_type_id,
      'schemaVersionId', candidate.id,
      'migrationPlanId', migration_plan_id,
      'activationEvidence', evidence
    ), correlation_id
  );
  -- The SchemaActivationResource: the common resource metadata plus the
  -- activation facts; the committed event id is never part of the resource.
  response := platform_private.cms_with_content_hash(jsonb_build_object(
    'id', candidate.id, 'version', (expected_version + 1)::text,
    'createdAt', candidate.created_at, 'updatedAt', pg_catalog.clock_timestamp(),
    'contentTypeVersionId', candidate.id, 'state', 'active',
    'activatedAt', pg_catalog.clock_timestamp(),
    'migrationPlanId', migration_plan_id, 'activationEvidence', evidence,
    'jobId', null, 'eventType', 'cms.schema.activated.v1'
  ));
  perform platform_private.cms_complete(reservation.id, candidate.id, 202, response);
  return response;
end;
$body$;

-- The plan-creating activation seam is removed (G1): CMS-03A-10 creates the plan
-- and activation only advances it through cms_advance_activation_plan.
drop function platform_private.cms_prepare_activation_migration(
  uuid, uuid, uuid, uuid, text, bigint, jsonb);

revoke all on function platform_private.cms_lock_activation_authority(uuid, uuid, uuid),
  platform_private.cms_resolve_activation_review(uuid, uuid[]),
  platform_private.cms_worker_human_approval_valid(uuid),
  platform_private.cms_advance_activation_plan(uuid, uuid, uuid, uuid),
  platform_private.cms_activate_schema(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_activate_schema(jsonb) to service_role;
-- The activation command is reachable only through the service-role Worker.
revoke all on function platform_api.cms_activate_schema(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_activate_schema(jsonb) to service_role;

commit;
