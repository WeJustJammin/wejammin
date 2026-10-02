-- DEC-108 review state fixes.  An approved review that later drifts becomes
-- invalidated while keeping its immutable approval stamp, so the stamp checks
-- bind only the approved state (an open or rejected review carries none), and
-- the safe review projection serializes the approval digest and decision time
-- only while the review is approved (G26).  Forward-only.
begin;

alter table platform_private.cms_schema_reviews
  drop constraint cms_schema_reviews_approved_evidence_check,
  drop constraint cms_schema_reviews_approved_decided_check,
  add constraint cms_schema_reviews_approved_evidence_check check (
    (state = 'approved' and approval_evidence_hash is not null)
    or state = 'invalidated'
    or (state in ('open', 'rejected') and approval_evidence_hash is null)
  ),
  add constraint cms_schema_reviews_approved_decided_check check (
    (state = 'approved' and decided_at is not null)
    or state = 'invalidated'
    or (state in ('open', 'rejected') and decided_at is null)
  );

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


revoke all on function platform_private.cms_schema_review_resource(uuid, uuid, boolean, boolean)
  from public, anon, authenticated, service_role;

commit;
