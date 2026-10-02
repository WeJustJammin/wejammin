-- BE03a OD-4: the schema review freezes the candidate's localeConfigHash
-- (CMS-03A-11), exposes it in the review's frozen evidence (CMS-03A-13), and
-- both switch paths recompute it from the candidate row and refuse with
-- CONFLICT when it differs from the review's frozen value.  The activation
-- resource and the cms.schema.activated.v1 payload carry localeConfigHash.
-- Existing reviews are backfilled from the version they froze (the locale
-- configuration of a version is immutable, so the value is exact).
-- Forward-only.
begin;

alter table platform_private.cms_schema_reviews add column locale_config_hash char(64);
select pg_catalog.set_config('app.cms_rpc', 'true', true);
alter table platform_private.cms_schema_reviews disable trigger user;
update platform_private.cms_schema_reviews review
   set locale_config_hash = version_row.locale_config_hash
  from platform_private.cms_content_type_versions version_row
 where version_row.id = review.content_type_version_id;
alter table platform_private.cms_schema_reviews enable trigger user;
alter table platform_private.cms_schema_reviews
  alter column locale_config_hash set not null,
  add constraint cms_schema_reviews_locale_config_hash_check check (
    locale_config_hash ~ '^[a-f0-9]{64}$'
  );

create or replace function platform_private.cms_schema_review_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at
     or new.content_type_id is distinct from old.content_type_id
     or new.content_type_version_id is distinct from old.content_type_version_id
     or new.candidate_version_no is distinct from old.candidate_version_no
     or new.definition_hash is distinct from old.definition_hash
     or new.schema_artifact_id is distinct from old.schema_artifact_id
     or new.compiler_version is distinct from old.compiler_version
     or new.dependency_manifest_hash is distinct from old.dependency_manifest_hash
     or new.dry_run_id is distinct from old.dry_run_id
     or new.dry_run_report_hash is distinct from old.dry_run_report_hash
     or new.policy_key is distinct from old.policy_key
     or new.policy_version is distinct from old.policy_version
     or new.policy_hash is distinct from old.policy_hash
     or new.source_policy_key is distinct from old.source_policy_key
     or new.source_policy_version is distinct from old.source_policy_version
     or new.source_policy_hash is distinct from old.source_policy_hash
     or new.risk_class is distinct from old.risk_class
     or new.required_decision_count is distinct from old.required_decision_count
     or new.required_capabilities is distinct from old.required_capabilities
     or new.context_hash is distinct from old.context_hash
     or new.locale_config_hash is distinct from old.locale_config_hash
     or new.submitter_person_ref is distinct from old.submitter_person_ref
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.version < old.version then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if old.state = 'open' then
    if new.state not in ('open', 'approved', 'rejected', 'invalidated') then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
  elsif old.state = 'approved' then
    if new.state not in ('approved', 'invalidated')
       or new.decided_at is distinct from old.decided_at
       or new.approval_evidence_hash is distinct from old.approval_evidence_hash then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
  elsif new.state is distinct from old.state
        or new.decided_at is distinct from old.decided_at
        or new.approval_evidence_hash is distinct from old.approval_evidence_hash then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
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
    context_hash, submitter_person_ref, locale_config_hash
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
    person_id, candidate.locale_config_hash
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

CREATE OR REPLACE FUNCTION platform_private.cms_schema_review_resource(p_review_id uuid, p_viewer_person_id uuid, p_designer boolean, p_owner boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  review_row platform_private.cms_schema_reviews%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  decisions jsonb;
  recorded_count integer;
  distinct_count integer;
  actions jsonb := '[]'::jsonb;
  assignments jsonb;
  resource jsonb;
begin
  select * into review_row from platform_private.cms_schema_reviews where id = p_review_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into version_row from platform_private.cms_content_type_versions
   where id = review_row.content_type_version_id;
  select * into artifact_row from platform_private.cms_schema_artifacts
   where id = review_row.schema_artifact_id
     and content_type_version_id = review_row.content_type_version_id;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', decision.id, 'decision', decision.decision,
           'capability', decision.capability_key, 'decidedAt', decision.decided_at
         ) order by decision.decided_at, decision.id), '[]'::jsonb),
         count(*)::integer
    into decisions, recorded_count
    from platform_private.cms_schema_review_decisions decision
   where decision.review_id = review_row.id;
  if review_row.state = 'approved' then
    select count(distinct decision.reviewer_person_ref)::integer into distinct_count
      from platform_private.cms_schema_review_decisions decision
     where decision.review_id = review_row.id and decision.decision = 'approve';
  else
    distinct_count := pg_catalog.cardinality(
      platform_private.cms_review_qualifying_approvers(review_row.id));
  end if;
  if review_row.state = 'open' then
    if p_owner then
      actions := actions || pg_catalog.jsonb_build_array('assign_reviewer');
    end if;
    if exists (
         select 1 from platform_private.cms_schema_review_assignments assignment
          where assignment.review_id = review_row.id
            and assignment.reviewer_person_ref = p_viewer_person_id
            and platform_private.cms_review_assignment_effective(
              assignment.state, assignment.starts_at, assignment.ends_at)
       )
       and not exists (
         select 1 from platform_private.cms_schema_review_decisions decision
          where decision.review_id = review_row.id
            and decision.reviewer_person_ref = p_viewer_person_id
       ) then
      actions := actions || pg_catalog.jsonb_build_array('record_decision');
    end if;
  elsif review_row.state = 'approved' and p_designer
        and version_row.state = 'approved'::platform_private.cms_definition_state then
    actions := actions || pg_catalog.jsonb_build_array('activate');
  end if;
  resource := pg_catalog.jsonb_build_object(
    'resourceKind', 'schema_review',
    'id', review_row.id,
    'version', review_row.version::text,
    'createdAt', review_row.created_at,
    'updatedAt', review_row.updated_at,
    'state', review_row.state,
    'contentTypeId', review_row.content_type_id,
    'contentTypeVersionId', review_row.content_type_version_id,
    'contentTypeVersionNo', review_row.candidate_version_no::text,
    'riskClass', review_row.risk_class,
    'requiredDecisionCount', review_row.required_decision_count,
    'requiredCapabilities', review_row.required_capabilities,
    'distinctApprovalCount', distinct_count,
    'recordedDecisionCount', recorded_count,
    'frozenEvidence', pg_catalog.jsonb_build_object(
      'contentTypeVersionId', review_row.content_type_version_id,
      'contentTypeVersionNo', review_row.candidate_version_no::text,
      'definitionHash', review_row.definition_hash,
      'localeConfigHash', review_row.locale_config_hash,
      'schemaArtifact', pg_catalog.jsonb_build_object(
        'id', artifact_row.id,
        'state', artifact_row.state,
        'compilerVersion', review_row.compiler_version,
        'zodContractRef', artifact_row.zod_contract_ref,
        'artifactHash', review_row.definition_hash
      ),
      'dependencyManifestHash', review_row.dependency_manifest_hash,
      'dryRun', pg_catalog.jsonb_build_object(
        'id', review_row.dry_run_id,
        'state', 'completed',
        'result', 'passed',
        'reportHash', review_row.dry_run_report_hash
      )
    ),
    'dryRunId', review_row.dry_run_id,
    'policyKey', review_row.policy_key,
    'policyVersion', review_row.policy_version::text,
    'policyHash', review_row.policy_hash,
    'approvalEvidenceHash', case when review_row.state = 'approved' then review_row.approval_evidence_hash end,
    'submittedAt', review_row.submitted_at,
    'decidedAt', case when review_row.state = 'approved' then review_row.decided_at end,
    'decisions', decisions,
    'permittedNextActions', actions
  );
  if p_owner then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'assignmentId', labelled.id,
             'version', labelled.version::text,
             'state', labelled.state,
             'startsAt', labelled.starts_at,
             'endsAt', labelled.ends_at,
             'reviewerLabel', 'Reviewer ' || labelled.ordinal::text
           ) order by labelled.created_at, labelled.id), '[]'::jsonb)
      into assignments
      from (
        select assignment.*,
               dense_rank() over (order by min_created.first_created, assignment.reviewer_person_ref) as ordinal
          from platform_private.cms_schema_review_assignments assignment
          join lateral (
            select min(other.created_at) as first_created
              from platform_private.cms_schema_review_assignments other
             where other.review_id = assignment.review_id
               and other.reviewer_person_ref = assignment.reviewer_person_ref
          ) min_created on true
         where assignment.review_id = review_row.id
      ) labelled;
    resource := resource || pg_catalog.jsonb_build_object('assignments', assignments);
  else
    resource := resource || pg_catalog.jsonb_build_object('assignments', '[]'::jsonb);
  end if;
  return platform_private.cms_with_content_hash(resource);
end;
$function$;

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
  -- The review froze the candidate's locale configuration hash; the candidate
  -- row must still recompute to exactly that value.
  if review_row.locale_config_hash is distinct from platform_private.cms_locale_config_hash(
       candidate.source_locale, candidate.default_locale,
       candidate.supported_locales, candidate.fallback_chains) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
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
      'localeConfigHash', review_row.locale_config_hash,
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
    'localeConfigHash', review_row.locale_config_hash,
    'jobId', null, 'eventType', 'cms.schema.activated.v1'
  ));
  perform platform_private.cms_complete(reservation.id, candidate.id, 202, response);
  return response;
end;
$body$;

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


commit;
