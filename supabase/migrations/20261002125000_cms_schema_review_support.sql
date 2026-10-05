-- DEC-108 shared review authority: stable identity projection, binding-bound
-- step-up, owner derivation, reviewer eligibility, strictest-of policy
-- resolution, the approval digest and the safe resource projections of the
-- dry-run, review, decision and assignment records.  Every function is a
-- pinned-search_path private helper with no browser grant.  Forward-only.
begin;

-- Idempotency reservation whose request-hash mismatch is the contract 409.
create or replace function platform_private.cms_reserve_conflict(
  p_request jsonb, p_actor_id uuid, p_operation text
)
returns platform_private.idempotency_records
language plpgsql
security definer
set search_path = ''
as $body$
begin
  return platform_private.cms_reserve(p_request, p_actor_id, p_operation);
exception when raise_exception then
  if sqlerrm = 'IDEMPOTENCY_MISMATCH' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  raise;
end;
$body$;

-- A person's current effective CMS capability in an organization: confirmed,
-- unended membership and an active grant whose UTC-date window contains today.
create or replace function platform_private.cms_person_holds_capability(
  p_organization_id uuid, p_person_id uuid, p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select exists (
    select 1
      from identity_private.membership_tenure tenure
      join identity_private.organization_actor_grant actor_grant
        on actor_grant.organization_id = tenure.organization_id
       and actor_grant.person_id = tenure.person_id
     where tenure.organization_id = p_organization_id
       and tenure.person_id = p_person_id
       and tenure.state = 'confirmed'
       and (tenure.ends_on is null or tenure.ends_on >= current_date)
       and actor_grant.capability_code = p_capability
       and actor_grant.active
       and actor_grant.valid_from <= current_date
       and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  )
$body$;

-- The stable private identity projection of a review/decision/assignment
-- authority: actor, person, acting party and private binding only.  Request,
-- correlation, session and transport timestamps never enter it.
create or replace function platform_private.cms_review_context_hash(
  p_actor_id uuid, p_person_id uuid, p_acting_party_id uuid, p_binding_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'version', 1,
    'actorId', p_actor_id,
    'personId', p_person_id,
    'actingPartyId', p_acting_party_id,
    'bindingId', p_binding_id
  ))
$body$;

-- Verifies the service-role envelope's private binding.  p_recent requires the
-- binding heartbeat (the recorded MFA observation) to be at most ten minutes
-- old and raises STEP_UP_REQUIRED; otherwise only an active, unexpired binding
-- of the actor's own acting context is required and a failure is
-- UNAUTHENTICATED.  Returns the binding id and its MFA observation time.
create or replace function platform_private.cms_review_binding(
  p_request jsonb, p_actor_id uuid, p_acting_party_id uuid, p_recent boolean
)
returns table (binding_id uuid, mfa_verified_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $body$
declare
  failure text := case when p_recent then 'STEP_UP_REQUIRED' else 'UNAUTHENTICATED' end;
  validation_at timestamptz := pg_catalog.clock_timestamp();
begin
  if not platform_private.cms_exact_keys(
       p_request->'context',
       array['actingContextId']::text[],
       array['actingContextId','authUserId','sessionId','actorPersonId','actingPartyId',
             'stepUpVerified','stepUpAt','requestId','correlationId']::text[]
     )
     or not platform_private.cms_valid_uuid(p_request->'context'->>'actingContextId') then
    raise exception '%', failure using errcode = 'P0001';
  end if;
  select context_binding.id, context_binding.last_seen_at
    into binding_id, mfa_verified_at
    from platform_private.acting_context_binding context_binding
   where context_binding.id = (p_request->'context'->>'actingContextId')::uuid
     and context_binding.person_id = platform_private.identity_actor_person(p_actor_id)
     and context_binding.acting_party_id = p_acting_party_id
     and context_binding.state = 'active'
     and context_binding.expires_at > validation_at
     and (not p_recent or context_binding.last_seen_at >= validation_at - interval '10 minutes');
  if binding_id is null then
    raise exception '%', failure using errcode = 'P0001';
  end if;
  return next;
end;
$body$;

-- Owner derivation: the immutable initialization receipt identity acting in
-- the receipt organization AND the owner's currently valid cms.schema_designer
-- grant.  Returns the grantor authority end (the end of the grant's
-- valid_through UTC day, infinity for an open-ended grant), else FORBIDDEN.
create or replace function platform_private.cms_review_owner_authority_end(
  p_actor_id uuid, p_acting_party_id uuid
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  owner_person uuid;
  grant_through date;
begin
  owner_person := platform_private.identity_actor_person(p_actor_id);
  if not exists (
    select 1 from platform_private.cms_owner_initialization receipt
     where receipt.auth_user_id = p_actor_id
       and receipt.person_id = owner_person
       and receipt.organization_id = p_acting_party_id
  ) or not platform_private.cms_person_holds_capability(
    p_acting_party_id, owner_person, 'cms.schema_designer'
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select actor_grant.valid_through into grant_through
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = p_acting_party_id
     and actor_grant.person_id = owner_person
     and actor_grant.capability_code = 'cms.schema_designer';
  if grant_through is null then
    return 'infinity'::timestamptz;
  end if;
  return ((grant_through + 1)::timestamp at time zone 'UTC');
end;
$body$;

create or replace function platform_private.cms_review_is_owner(
  p_actor_id uuid, p_acting_party_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_review_owner_authority_end(p_actor_id, p_acting_party_id);
  return true;
exception when raise_exception then
  return false;
end;
$body$;

-- A real, claimed or active, non-banned human.
create or replace function platform_private.cms_review_person_eligible(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select exists (
    select 1
      from platform_private.person_party person
      join auth.users auth_user on auth_user.id = person.auth_user_id
     where person.party_id = p_person_id
       and person.account_state in (
         'claimed'::platform_private.person_account_state,
         'active'::platform_private.person_account_state
       )
       and auth_user.deleted_at is null
       and (auth_user.banned_until is null or auth_user.banned_until <= pg_catalog.clock_timestamp())
  )
$body$;

create or replace function platform_private.cms_review_assignment_effective(
  p_state text, p_starts_at timestamptz, p_ends_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select p_state = 'active'
     and p_starts_at <= pg_catalog.clock_timestamp()
     and pg_catalog.clock_timestamp() < p_ends_at
$body$;

-- Strictest-of resolution (BE03a "Workflow policy registry"): the candidate's
-- own bound member, and for a successor also the source version's bound
-- member.  Missing, ambiguous or hash-mismatched members fail closed.
create or replace function platform_private.cms_resolve_review_policy(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate platform_private.cms_content_type_versions%rowtype;
  source_version platform_private.cms_content_type_versions%rowtype;
  own_member jsonb;
  source_member jsonb;
  effective_capabilities jsonb;
  effective_count integer;
  effective_risk text;
begin
  select * into candidate from platform_private.cms_content_type_versions where id = p_version_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  own_member := platform_private.cms_workflow_policy_member(candidate.workflow_key, candidate.workflow_version);
  if own_member is null then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if candidate.supersedes_id is not null then
    select * into source_version from platform_private.cms_content_type_versions
     where id = candidate.supersedes_id;
    source_member := platform_private.cms_workflow_policy_member(
      source_version.workflow_key, source_version.workflow_version);
    if source_member is null then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;
  effective_risk := case when own_member->>'riskClass' = 'protected'
                           or coalesce(source_member->>'riskClass', 'ordinary') = 'protected'
                         then 'protected' else 'ordinary' end;
  effective_count := greatest(
    (own_member->>'requiredDecisionCount')::integer,
    coalesce((source_member->>'requiredDecisionCount')::integer, 0));
  -- Base reviewer slot first, then the source's specialist slots, then the
  -- candidate's specialist slots not already present (at most sixteen).
  select pg_catalog.jsonb_agg(slot.capability order by slot.position)
    into effective_capabilities
    from (
      select all_slots.capability, min(all_slots.position) as position
        from (
          select (own_member->'requiredCapabilities'->>0) as capability, 0::bigint as position
          union all
          select element.value, 1000 + element.ordinality
            from pg_catalog.jsonb_array_elements_text(
              coalesce(source_member->'requiredCapabilities', '[]'::jsonb)
            ) with ordinality element(value, ordinality)
           where element.ordinality > 1
          union all
          select element.value, 2000 + element.ordinality
            from pg_catalog.jsonb_array_elements_text(own_member->'requiredCapabilities')
              with ordinality element(value, ordinality)
           where element.ordinality > 1
        ) all_slots
       group by all_slots.capability
    ) slot;
  if pg_catalog.jsonb_array_length(effective_capabilities) > 16 then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'policyKey', own_member->>'key',
    'policyVersion', (own_member->>'version')::bigint,
    'policyHash', own_member->>'policyHash',
    'sourcePolicyKey', source_member->>'key',
    'sourcePolicyVersion', (source_member->>'version')::bigint,
    'sourcePolicyHash', source_member->>'policyHash',
    'riskClass', effective_risk,
    'requiredDecisionCount', effective_count,
    'requiredCapabilities', effective_capabilities
  );
end;
$body$;

-- The approval digest binds the review, its frozen definition, the policy and
-- the approve decisions (identity, assignment, capability, reviewed hash)
-- without any timestamp or reviewer identity, so it is stable evidence.
create or replace function platform_private.cms_schema_review_approval_digest(p_review_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'version', 1,
    'reviewId', review.id,
    'definitionHash', review.definition_hash,
    'policyHash', review.policy_hash,
    'decisions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', decision.id,
        'assignmentId', decision.assignment_id,
        'capability', decision.capability_key,
        'reviewedHash', decision.reviewed_hash
      ) order by decision.id)
        from platform_private.cms_schema_review_decisions decision
       where decision.review_id = review.id and decision.decision = 'approve'
    ), '[]'::jsonb)
  ))
  from platform_private.cms_schema_reviews review
  where review.id = p_review_id
$body$;

-- Distinct humans whose approve decision still qualifies: an effective
-- assignment and a still-eligible person.
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
   where decision.review_id = p_review_id
     and decision.decision = 'approve'
     and platform_private.cms_review_assignment_effective(
       assignment.state, assignment.starts_at, assignment.ends_at)
     and platform_private.cms_review_person_eligible(decision.reviewer_person_ref)
$body$;

-- Review scope of an actor: the owner's schema-design scope, or an effective
-- review-only assignment, else NULL (concealed).
create or replace function platform_private.cms_review_scope(
  p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid
)
returns text
language plpgsql
stable
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
       and assignment.reviewer_person_ref = person
       and platform_private.cms_review_assignment_effective(
         assignment.state, assignment.starts_at, assignment.ends_at)
  ) then
    return 'assigned';
  end if;
  return null;
end;
$body$;

-- ------------------------------------------------------------ resources ----
create or replace function platform_private.cms_with_content_hash(p_resource jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  select p_resource || pg_catalog.jsonb_build_object(
    'contentHash', platform_private.cms_jcs_sha256(p_resource))
$body$;

create or replace function platform_private.cms_schema_dry_run_resource(p_report_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_with_content_hash(pg_catalog.jsonb_build_object(
    'resourceKind', 'schema_dry_run',
    'id', report.id,
    'version', report.version::text,
    'createdAt', report.created_at,
    'updatedAt', report.updated_at,
    'state', report.state,
    'contentTypeVersionId', report.target_version_id,
    'classification', report.classification,
    'attemptId', report.id,
    'jobId', report.job_id,
    'migrationPlanId', report.plan_id,
    'compilerVersion', report.compiler_version,
    'transformKey', report.transform_key,
    'transformVersion', report.transform_version::text,
    'result', case report.result when 'pass' then 'passed' when 'fail' then 'failed' end,
    'failureCode', report.failure_code,
    'sourceCount', report.source_count,
    'targetCount', report.target_count,
    'rowErrorCount', report.row_error_count,
    'sourceHash', report.source_hash,
    'targetHash', report.target_hash,
    'reportHash', case when report.report is null then null
                       else platform_private.cms_jcs_sha256(report.report) end
  ))
  from platform_private.cms_schema_dry_run_reports report
  where report.id = p_report_id
$body$;

create or replace function platform_private.cms_schema_review_decision_resource(p_decision_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_with_content_hash(pg_catalog.jsonb_build_object(
    'resourceKind', 'schema_review_decision',
    'id', decision.id,
    'version', decision.version::text,
    'createdAt', decision.created_at,
    'updatedAt', decision.updated_at,
    'reviewId', decision.review_id,
    'decision', decision.decision,
    'capability', decision.capability_key,
    'decidedAt', decision.decided_at
  ))
  from platform_private.cms_schema_review_decisions decision
  where decision.id = p_decision_id
$body$;

create or replace function platform_private.cms_schema_review_assignment_resource(p_assignment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_with_content_hash(pg_catalog.jsonb_build_object(
    'resourceKind', 'schema_review_assignment',
    'id', assignment.id,
    'version', assignment.version::text,
    'createdAt', assignment.created_at,
    'updatedAt', assignment.updated_at,
    'reviewId', assignment.review_id,
    'state', assignment.state,
    'capability', assignment.capability_key,
    'actions', pg_catalog.to_jsonb(assignment.actions),
    'startsAt', assignment.starts_at,
    'expiresAt', assignment.ends_at,
    'reason', assignment.reason
  ))
  from platform_private.cms_schema_review_assignments assignment
  where assignment.id = p_assignment_id
$body$;

-- The capability-safe review projection for one viewer.  No actor, person,
-- party, reviewer, grantor or private binding identifier is serialized.
create or replace function platform_private.cms_schema_review_resource(
  p_review_id uuid, p_viewer_person_id uuid, p_designer boolean, p_owner boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
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
    'approvalEvidenceHash', review_row.approval_evidence_hash,
    'submittedAt', review_row.submitted_at,
    'decidedAt', review_row.decided_at,
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
$body$;

revoke all on function
  platform_private.cms_reserve_conflict(jsonb, uuid, text),
  platform_private.cms_person_holds_capability(uuid, uuid, text),
  platform_private.cms_review_context_hash(uuid, uuid, uuid, uuid),
  platform_private.cms_review_binding(jsonb, uuid, uuid, boolean),
  platform_private.cms_review_owner_authority_end(uuid, uuid),
  platform_private.cms_review_is_owner(uuid, uuid),
  platform_private.cms_review_person_eligible(uuid),
  platform_private.cms_review_assignment_effective(text, timestamptz, timestamptz),
  platform_private.cms_resolve_review_policy(uuid),
  platform_private.cms_schema_review_approval_digest(uuid),
  platform_private.cms_review_qualifying_approvers(uuid),
  platform_private.cms_review_scope(uuid, uuid, uuid),
  platform_private.cms_with_content_hash(jsonb),
  platform_private.cms_schema_dry_run_resource(uuid),
  platform_private.cms_schema_review_decision_resource(uuid),
  platform_private.cms_schema_review_assignment_resource(uuid),
  platform_private.cms_schema_review_resource(uuid, uuid, boolean, boolean)
  from public, anon, authenticated, service_role;

commit;
