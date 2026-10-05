-- BE03a CMS-03A-07 detail (AC-963, AC-1039): activationPreparation.dryRunRef
-- carries the sealed dry-run counts and hashes for a completed sealed report
-- only, as one all-or-none group (sourceCount, targetCount, rowErrorCount,
-- sourceHash, targetHash, reportHash).  Queued, running and failed attempts
-- emit none of the six.  compiler_hash, migrated_count and failed_count are not
-- caller-facing and are never projected.  The rest of the projection is
-- byte-identical to 20261002134000.  Forward-only.
begin;

create or replace function platform_private.cms_activation_preparation(
  p_version_id uuid, p_actor_id uuid, p_acting_party_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  report_row platform_private.cms_schema_dry_run_reports%rowtype;
  review_row platform_private.cms_schema_reviews%rowtype;
  job_row platform_private.jobs%rowtype;
  person uuid := platform_private.identity_actor_person(p_actor_id);
  designer boolean;
  owner boolean;
  actions jsonb := '[]'::jsonb;
  dry_run jsonb := 'null'::jsonb;
  job jsonb := 'null'::jsonb;
  review jsonb := 'null'::jsonb;
  template_id uuid;
  compatibility jsonb;
  result jsonb;
begin
  select * into version_row from platform_private.cms_content_type_versions where id = p_version_id;
  designer := platform_private.cms_person_holds_capability(
    version_row.owner_id, person, 'cms.schema_designer');
  owner := designer and platform_private.cms_review_is_owner(p_actor_id, p_acting_party_id);
  select * into report_row from platform_private.cms_schema_dry_run_reports report
   where report.target_version_id = version_row.id
   order by report.attempt_no desc limit 1;
  if found then
    dry_run := pg_catalog.jsonb_build_object(
      'id', report_row.id,
      'state', report_row.state,
      'result', case report_row.result when 'pass' then 'passed' when 'fail' then 'failed' end,
      'jobId', report_row.job_id,
      'failureCode', report_row.failure_code
    );
    -- Sealed evidence (AC-963/AC-1039): all six members or none, only for a
    -- completed sealed report; the report hash uses the same derivation as the
    -- frozen review evidence (cms_jcs_sha256 of the sealed report document).
    if report_row.state = 'completed' and report_row.sealed_at is not null
       and report_row.source_count is not null and report_row.target_count is not null
       and report_row.row_error_count is not null and report_row.source_hash is not null
       and report_row.target_hash is not null and report_row.report is not null then
      dry_run := dry_run || pg_catalog.jsonb_build_object(
        'sourceCount', report_row.source_count,
        'targetCount', report_row.target_count,
        'rowErrorCount', report_row.row_error_count,
        'sourceHash', report_row.source_hash,
        'targetHash', report_row.target_hash,
        'reportHash', platform_private.cms_jcs_sha256(report_row.report));
    end if;
    select * into job_row from platform_private.jobs where id = report_row.job_id;
    if found then
      job := pg_catalog.jsonb_build_object('id', job_row.id, 'state', job_row.state::text);
    end if;
  end if;
  select * into review_row from platform_private.cms_schema_reviews review
   where review.content_type_version_id = version_row.id
   order by review.submitted_at desc, review.id desc limit 1;
  if found then
    review := pg_catalog.jsonb_build_object('id', review_row.id, 'state', review_row.state);
  end if;
  if version_row.state = 'draft'::platform_private.cms_definition_state and designer then
    actions := actions || pg_catalog.jsonb_build_array('start_dry_run');
    if report_row.id is not null and report_row.id = version_row.dry_run_id
       and report_row.state = 'completed' and report_row.result = 'pass'
       and platform_private.cms_candidate_compiled_current(version_row.id) then
      actions := actions || pg_catalog.jsonb_build_array('submit_review');
    end if;
  elsif version_row.state = 'review'::platform_private.cms_definition_state
        and review_row.state = 'open' then
    if owner then
      actions := actions || pg_catalog.jsonb_build_array('assign_reviewer');
    end if;
    if exists (
         select 1 from platform_private.cms_schema_review_assignments assignment
          where assignment.review_id = review_row.id
            and assignment.reviewer_person_ref = person
            and platform_private.cms_review_assignment_effective(
              assignment.state, assignment.starts_at, assignment.ends_at)
       ) and not exists (
         select 1 from platform_private.cms_schema_review_decisions decision
          where decision.review_id = review_row.id and decision.reviewer_person_ref = person
       ) then
      actions := actions || pg_catalog.jsonb_build_array('record_decision');
    end if;
  elsif version_row.state = 'approved'::platform_private.cms_definition_state and designer
        and review_row.state = 'approved' then
    actions := actions || pg_catalog.jsonb_build_array('activate');
  elsif version_row.state = 'active'::platform_private.cms_definition_state and designer
        and not exists (
          select 1 from platform_private.cms_content_type_versions live
           where live.content_type_id = version_row.content_type_id
             and live.state in (
               'draft'::platform_private.cms_definition_state,
               'review'::platform_private.cms_definition_state,
               'approved'::platform_private.cms_definition_state)
        ) then
    actions := actions || pg_catalog.jsonb_build_array('create_successor');
  end if;
  result := pg_catalog.jsonb_build_object(
    'dryRunRef', dry_run, 'jobRef', job, 'reviewRef', review,
    'permittedNextActions', actions
  );
  template_id := coalesce(version_row.default_template_version_id, (
    select binding.template_version_id
      from platform_private.cms_content_type_template_bindings binding
     where binding.content_type_version_id = version_row.id
     order by binding.position, binding.id limit 1));
  if template_id is not null then
    begin
      compatibility := platform_private.cms_resolve_template_compatibility(
        pg_catalog.jsonb_build_object(
          'templateVersionId', template_id,
          'contentTypeId', version_row.content_type_id,
          'contentTypeVersionId', version_row.id,
          'context', pg_catalog.jsonb_build_object(
            'authUserId', p_actor_id, 'actingPartyId', p_acting_party_id)));
      result := result || pg_catalog.jsonb_build_object('templateCompatibility', compatibility);
    exception when others then
      null;
    end;
  end if;
  return result;
end;
$body$;

commit;
