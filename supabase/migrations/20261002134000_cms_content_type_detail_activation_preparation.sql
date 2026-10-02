-- BE03a CMS-03A-07 detail: the projection-only activationPreparation member.
-- It carries only the latest dry-run attempt reference (with its safe failure
-- code), the BE00 job reference, the latest review reference, the optional safe
-- template-compatibility projection and the resolved permittedNextActions, which
-- is the only readiness expression.  No actor, person, party, reviewer or
-- private binding identifier is ever serialized.  Forward-only.
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

CREATE OR REPLACE FUNCTION platform_private.cms_get_content_type_version(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  version_row platform_private.cms_content_type_versions%rowtype;
  response jsonb;
  fields jsonb := '[]'::jsonb;
  relations jsonb := '[]'::jsonb;
  templates jsonb := '[]'::jsonb;
  capabilities jsonb := '[]'::jsonb;
  blocks jsonb := '[]'::jsonb;
  item jsonb;
  row_record record;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_read(actor_id, acting_party_id);
  if not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into version_row from platform_private.cms_content_type_versions version_candidate
  where version_candidate.id = (p_request->>'versionId')::uuid
    and version_candidate.content_type_id = (p_request->>'contentTypeId')::uuid
    and version_candidate.owner_id = acting_party_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  for row_record in select * from platform_private.cms_field_definition_versions where content_type_version_id = version_row.id order by field_key loop
    item := jsonb_build_object('resourceKind', 'field_definition_version', 'id', row_record.id, 'version', row_record.version::text, 'contentHash', encode(extensions.digest(convert_to(row_record::text, 'utf8'), 'sha256'), 'hex'), 'createdAt', row_record.created_at, 'updatedAt', row_record.updated_at, 'contentTypeVersionId', row_record.content_type_version_id, 'stableFieldId', row_record.stable_field_id, 'key', row_record.field_key, 'kind', row_record.kind, 'required', row_record.required, 'validatorKey', row_record.validator_key, 'validatorVersion', row_record.validator_version::text, 'defaultMode', row_record.default_mode, 'localizationMode', row_record.localization_mode, 'lifecycle', row_record.state, 'migrationPlanId', null);
    fields := fields || jsonb_build_array(item);
  end loop;
  for row_record in select relation.* from platform_private.cms_relation_definitions relation join platform_private.cms_field_definition_versions field on field.id = relation.field_definition_id where field.content_type_version_id = version_row.id order by relation.id loop
    item := jsonb_build_object('resourceKind', 'relation_definition', 'id', row_record.id, 'version', row_record.version::text, 'contentHash', encode(extensions.digest(convert_to(row_record::text, 'utf8'), 'sha256'), 'hex'), 'createdAt', row_record.created_at, 'updatedAt', row_record.updated_at, 'contentTypeVersionId', version_row.id, 'fieldId', row_record.field_definition_id, 'targetKind', row_record.target_kind, 'targetType', row_record.target_type, 'projectionKey', row_record.projection_key, 'cardinality', row_record.cardinality, 'min', row_record.min_count, 'max', row_record.max_count, 'ordered', row_record.ordered, 'onUnavailable', row_record.on_unavailable);
    relations := relations || jsonb_build_array(item);
  end loop;
  for row_record in select * from platform_private.cms_content_type_template_bindings where content_type_version_id = version_row.id order by position, id loop
    templates := templates || jsonb_build_array(jsonb_build_object('resourceKind', 'template_binding', 'id', row_record.id, 'contentTypeVersionId', row_record.content_type_version_id, 'templateVersionId', row_record.template_version_id, 'position', row_record.position, 'version', row_record.version::text, 'state', row_record.state::text));
  end loop;
  for row_record in select * from platform_private.cms_content_type_capability_bindings where content_type_version_id = version_row.id order by capability_key loop
    capabilities := capabilities || jsonb_build_array(jsonb_build_object('resourceKind', 'capability_binding', 'id', row_record.id, 'contentTypeVersionId', row_record.content_type_version_id, 'capabilityKey', row_record.capability_key, 'capabilityVersion', row_record.capability_version::text, 'version', row_record.version::text, 'state', row_record.state::text));
  end loop;
  for row_record in
    select block_row.*, coalesce(lifecycle_row.to_lifecycle, 'supported') as lifecycle_value
    from platform_private.cms_block_definition_versions block_row
    left join lateral (
      select event_row.to_lifecycle
      from platform_private.cms_block_definition_lifecycle_events event_row
      where event_row.block_definition_version_id = block_row.id
      order by event_row.created_at desc, event_row.id desc
      limit 1
    ) lifecycle_row on true
    where block_row.state = 'registered'
      and block_row.owner_id = acting_party_id
    order by block_row.block_key, block_row.block_version
  loop
    blocks := blocks || jsonb_build_array(jsonb_build_object(
      'resourceKind', 'block_definition_registry_record', 'id', row_record.id,
      'version', row_record.version::text, 'blockKey', row_record.block_key,
      'blockVersion', row_record.block_version, 'propsSchemaRef', row_record.props_schema_ref,
      'propsSchemaHash', row_record.props_schema_hash, 'rendererRef', row_record.renderer_ref,
      'releaseDigest', row_record.release_digest, 'lifecycle', row_record.lifecycle_value
    ));
  end loop;
  response := jsonb_build_object(
    'resourceKind', 'content_type_version', 'resource', platform_private.cms_type_version_resource(version_row.id),
    'fields', fields, 'relations', relations,
    'schemaArtifact', (select jsonb_build_object('resourceKind', 'schema_artifact', 'id', artifact.id, 'version', artifact.version::text, 'state', artifact.state, 'contentTypeVersionId', artifact.content_type_version_id, 'compilerVersion', artifact.compiler_version, 'zodContractRef', artifact.zod_contract_ref, 'artifactHash', artifact.artifact_hash, 'createdAt', artifact.created_at, 'updatedAt', artifact.updated_at, 'compiledAt', artifact.compiled_at) from platform_private.cms_schema_artifacts artifact where artifact.id = version_row.schema_artifact_id),
    'templateBindings', templates, 'capabilityBindings', capabilities, 'blockDefinitions', blocks,
    'activationPreparation', platform_private.cms_activation_preparation(version_row.id, actor_id, acting_party_id)
  );
  return response;
end;
$function$;


revoke all on function platform_private.cms_activation_preparation(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
