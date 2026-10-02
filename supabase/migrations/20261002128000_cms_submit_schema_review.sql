-- CMS-03A-11: freeze a sealed, passed dry-run into one private CMS review and
-- move the candidate draft -> review atomically (BE03a "Data Flow", DEC-108).
-- The review freezes the candidate hash, artifact, compiler, dependency
-- manifest, dry-run report hash, the code-owned strictest-of policy snapshot
-- and the stable actor/person/party/binding context hash; nothing about the
-- policy comes from the request.  Forward-only.
begin;

-- True when the persisted candidate graph still compiles to the stored
-- definition hash, i.e. the artifact the dry-run sealed still describes the
-- candidate (no field, relation or binding edit since).  Unresolved references
-- are an activation gate (CMS-03A-04), not a freeze gate.
create or replace function platform_private.cms_candidate_compiled_current(p_version_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
begin
  select * into version_row from platform_private.cms_content_type_versions
   where id = p_version_id;
  if not found then
    return false;
  end if;
  return platform_private.cms_definition_artifact_hash(
           platform_private.cms_candidate_definition_request(version_row.id),
           version_row.version_no
         ) = version_row.definition_hash
     and exists (
       select 1 from platform_private.cms_schema_artifacts artifact
        where artifact.id = version_row.schema_artifact_id
          and artifact.content_type_version_id = version_row.id
          and artifact.artifact_hash = version_row.definition_hash
     );
end;
$body$;

create or replace function platform_private.cms_submit_schema_review(p_request jsonb)
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
  candidate platform_private.cms_content_type_versions%rowtype;
  report_row platform_private.cms_schema_dry_run_reports%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  binding record;
  policy jsonb;
  expected_version bigint;
  review_id uuid := extensions.gen_random_uuid();
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-11:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','dryRunId']::text[],
    array['contentTypeId','versionId','expectedVersion','dryRunId',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or not platform_private.cms_valid_uuid(p_request->>'dryRunId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  person_id := platform_private.identity_actor_person(actor_id);
  select * into binding from platform_private.cms_review_binding(
    p_request, actor_id, acting_party_id, false);
  select * into candidate
    from platform_private.cms_content_type_versions version_row
   where version_row.id = (p_request->>'versionId')::uuid
     and version_row.content_type_id = (p_request->>'contentTypeId')::uuid
     and version_row.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.state <> 'draft'::platform_private.cms_definition_state
     or candidate.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- The evidence is exactly the candidate's own sealed, passed attempt.
  select * into report_row
    from platform_private.cms_schema_dry_run_reports report
   where report.id = (p_request->>'dryRunId')::uuid
     and report.target_version_id = candidate.id
     and report.owner_id = candidate.owner_id;
  if not found
     or candidate.dry_run_id is distinct from report_row.id
     or report_row.state <> 'completed'
     or report_row.result is distinct from 'pass'
     or report_row.row_error_count is distinct from 0
     or report_row.target_hash is distinct from candidate.definition_hash
     or report_row.classification is distinct from candidate.compatibility then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select * into plan_row from platform_private.cms_schema_migration_plans plan
   where plan.id = report_row.plan_id;
  if not found or plan_row.superseded_at is not null
     or plan_row.state not in ('ready', 'completed') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_candidate_compiled_current(candidate.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select * into artifact_row
    from platform_private.cms_schema_artifacts artifact
   where artifact.id = candidate.schema_artifact_id
     and artifact.content_type_version_id = candidate.id;
  if report_row.compiler_hash is distinct from artifact_row.artifact_hash
     or report_row.compiler_version is distinct from artifact_row.compiler_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_schema_reviews review
     where review.content_type_version_id = candidate.id
       and review.definition_hash = candidate.definition_hash
       and review.dry_run_id = report_row.id
       and review.state = 'open'
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  policy := platform_private.cms_resolve_review_policy(candidate.id);
  insert into platform_private.cms_schema_reviews(
    id, owner_id, state, version, content_type_id, content_type_version_id,
    candidate_version_no, definition_hash, schema_artifact_id, compiler_version,
    dependency_manifest_hash, dry_run_id, dry_run_report_hash, policy_key,
    policy_version, policy_hash, source_policy_key, source_policy_version,
    source_policy_hash, risk_class, required_decision_count, required_capabilities,
    context_hash, submitter_person_ref
  ) values (
    review_id, candidate.owner_id, 'open', 1, candidate.content_type_id, candidate.id,
    candidate.version_no, candidate.definition_hash, artifact_row.id,
    artifact_row.compiler_version,
    platform_private.cms_jcs_sha256(artifact_row.renderer_manifest), report_row.id,
    platform_private.cms_jcs_sha256(report_row.report),
    policy->>'policyKey', (policy->>'policyVersion')::bigint, policy->>'policyHash',
    policy->>'sourcePolicyKey', (policy->>'sourcePolicyVersion')::bigint,
    policy->>'sourcePolicyHash', policy->>'riskClass',
    (policy->>'requiredDecisionCount')::smallint, policy->'requiredCapabilities',
    platform_private.cms_review_context_hash(actor_id, person_id, acting_party_id, binding.binding_id),
    person_id
  );
  update platform_private.cms_content_type_versions version_row
     set state = 'review'::platform_private.cms_definition_state,
         version = version_row.version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where version_row.id = candidate.id and version_row.version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.review.submit', actor_id, acting_party_id, 'cms_schema_review', review_id,
    'CMS_SCHEMA_REVIEW_SUBMITTED', 'cms.schema.review.submitted.v1', 'cms_schema_review',
    review_id, 1,
    pg_catalog.jsonb_build_object(
      'reviewId', review_id, 'contentTypeId', candidate.content_type_id,
      'schemaVersionId', candidate.id, 'dryRunId', report_row.id
    ), correlation_id
  );
  response := platform_private.cms_schema_review_resource(
    review_id, person_id, true, platform_private.cms_review_is_owner(actor_id, acting_party_id));
  perform platform_private.cms_complete(reservation.id, review_id, 201, response);
  return response;
end;
$body$;

create or replace function platform_api.cms_submit_schema_review(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_submit_schema_review(p_request)
$body$;

revoke all on function platform_private.cms_candidate_compiled_current(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_submit_schema_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_submit_schema_review(jsonb) to service_role;
revoke all on function platform_api.cms_submit_schema_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_submit_schema_review(jsonb) to service_role;

commit;
