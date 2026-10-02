-- DEC-108 defect C: the artifact compiler addresses a content-type version by
-- its real reference cms/content-type/{typeKey}/v{versionNo} (never a fixed
-- first-version reference) and the deterministic artifact hash composes that
-- versioned reference, the compiler version and the compiled editor/renderer
-- manifests with no random salt.  CMS-03A-01 no longer self-certifies a passing
-- dry run: only CMS-03A-10 produces a report, plan and job.  A draft candidate
-- is recompiled from its persisted definition graph by the dry-run command.
-- Forward-only.
begin;

create or replace function platform_private.cms_artifact_contract_ref(
  p_type_key text, p_version_no integer
)
returns text
language sql
immutable
set search_path = ''
as $body$
  select 'cms/content-type/' || p_type_key || '/v' || p_version_no::text
$body$;

-- The versioned composition.  The one-argument form is the first-version
-- composition kept for callers that hash a draft-creation request.
create or replace function platform_private.cms_definition_artifact_hash(
  p_request jsonb, p_version_no integer
)
returns text
language sql
stable
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(jsonb_build_object(
    'compilerVersion', '1',
    'zodContractRef', platform_private.cms_artifact_contract_ref(p_request->>'typeKey', p_version_no),
    'editorManifest', platform_private.cms_compiled_editor_manifest(p_request),
    'rendererManifest', platform_private.cms_compiled_renderer_manifest(p_request)
  ))
$body$;

create or replace function platform_private.cms_definition_artifact_hash(p_request jsonb)
returns text
language sql
stable
set search_path = ''
as $body$
  select platform_private.cms_definition_artifact_hash(p_request, 1)
$body$;

-- The canonical definition request of a persisted candidate, rebuilt from its
-- stored field, relation, template-binding and capability-binding rows in the
-- exact shape the activation reference check compares against the manifest.
create or replace function platform_private.cms_candidate_definition_request(p_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  type_row platform_private.cms_content_types%rowtype;
  fields jsonb;
  relations jsonb;
  templates jsonb;
  capabilities jsonb;
begin
  select * into version_row from platform_private.cms_content_type_versions where id = p_version_id;
  if not found then
    return null;
  end if;
  select * into type_row from platform_private.cms_content_types where id = version_row.content_type_id;
  select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.value->>'stableFieldId', entry.value->>'key'), '[]'::jsonb)
    into fields
    from (
      select pg_catalog.jsonb_build_object(
               'stableFieldId', field.stable_field_id,
               'key', field.field_key,
               'kind', field.kind,
               'constraints', field.constraints,
               'required', field.required,
               'validatorKey', field.validator_key,
               'validatorVersion', field.validator_version::text,
               'defaultMode', field.default_mode,
               'localizationMode', field.localization_mode,
               'editorConfig', field.editor_config,
               'lifecycle', field.state
             ) || case when field.default_value is not null
                       then pg_catalog.jsonb_build_object('defaultValue', field.default_value)
                       else '{}'::jsonb end as value
        from platform_private.cms_field_definition_versions field
       where field.content_type_version_id = version_row.id
    ) entry;
  select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.value->>'fieldId', entry.value->>'projectionKey'), '[]'::jsonb)
    into relations
    from (
      select pg_catalog.jsonb_build_object(
               'fieldId', relation.field_definition_id,
               'targetKind', relation.target_kind,
               'targetType', relation.target_type,
               'projectionKey', relation.projection_key,
               'cardinality', relation.cardinality,
               'min', relation.min_count,
               'max', relation.max_count,
               'ordered', relation.ordered,
               'onUnavailable', relation.on_unavailable
             ) as value
        from platform_private.cms_relation_definitions relation
        join platform_private.cms_field_definition_versions field
          on field.id = relation.field_definition_id
       where field.content_type_version_id = version_row.id
    ) entry;
  select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.value->>'templateVersionId'), '[]'::jsonb)
    into templates
    from (
      select pg_catalog.jsonb_build_object('templateVersionId', binding.template_version_id) as value
        from platform_private.cms_content_type_template_bindings binding
       where binding.content_type_version_id = version_row.id
    ) entry;
  select coalesce(pg_catalog.jsonb_agg(entry.value order by entry.value->>'capabilityKey', entry.value->>'capabilityVersion'), '[]'::jsonb)
    into capabilities
    from (
      select pg_catalog.jsonb_build_object(
               'capabilityKey', binding.capability_key,
               'capabilityVersion', binding.capability_version::text
             ) as value
        from platform_private.cms_content_type_capability_bindings binding
       where binding.content_type_version_id = version_row.id
    ) entry;
  return pg_catalog.jsonb_build_object(
    'typeKey', type_row.type_key,
    'label', version_row.labels->>'label',
    'ownerCapability', type_row.owner_capability,
    'sourceLocale', version_row.source_locale,
    'defaultLocale', version_row.default_locale,
    'workflowKey', version_row.workflow_key,
    'workflowVersion', version_row.workflow_version::text,
    'defaultTemplateVersionId', coalesce(pg_catalog.to_jsonb(version_row.default_template_version_id), 'null'::jsonb),
    'fields', fields,
    'relations', relations,
    'templateBindings', templates,
    'capabilityBindings', capabilities
  );
end;
$body$;

-- Recompiles a draft candidate's immutable-by-contract artifact from its
-- persisted graph and rebinds the version's definition hash.  A candidate that
-- has left draft is never recompiled (the artifact guard rejects it).
create or replace function platform_private.cms_compile_candidate(p_version_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  request jsonb;
  compiled_hash text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select * into version_row from platform_private.cms_content_type_versions
   where id = p_version_id for update;
  if not found or version_row.state <> 'draft'::platform_private.cms_definition_state then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  request := platform_private.cms_candidate_definition_request(version_row.id);
  compiled_hash := platform_private.cms_definition_artifact_hash(request, version_row.version_no);
  perform pg_catalog.set_config('app.cms_compile', 'true', true);
  update platform_private.cms_schema_artifacts artifact
     set editor_manifest = platform_private.cms_compiled_editor_manifest(request),
         renderer_manifest = platform_private.cms_compiled_renderer_manifest(request),
         artifact_hash = compiled_hash,
         compiled_at = pg_catalog.clock_timestamp()
   where artifact.id = version_row.schema_artifact_id
     and artifact.content_type_version_id = version_row.id
     and artifact.artifact_hash is distinct from compiled_hash;
  perform pg_catalog.set_config('app.cms_compile', 'false', true);
  update platform_private.cms_content_type_versions version_update
     set definition_hash = compiled_hash,
         updated_at = pg_catalog.clock_timestamp()
   where version_update.id = version_row.id
     and version_update.definition_hash is distinct from compiled_hash;
  return compiled_hash;
end;
$body$;

CREATE OR REPLACE FUNCTION platform_private.cms_create_type_draft(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  type_id uuid := extensions.gen_random_uuid();
  version_id uuid := extensions.gen_random_uuid();
  artifact_id uuid := extensions.gen_random_uuid();
  field_input jsonb;
  relation_input jsonb;
  binding_input jsonb;
  capability_input jsonb;
  field_id uuid;
  response jsonb;
  definition_hash text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-01');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return platform_private.cms_type_version_resource((reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['typeKey','label','ownerCapability','sourceLocale','defaultLocale','workflowKey','workflowVersion','defaultTemplateVersionId','fields','relations','templateBindings','capabilityBindings']::text[],
    array['typeKey','label','ownerCapability','sourceLocale','defaultLocale','workflowKey','workflowVersion','defaultTemplateVersionId','fields','relations','templateBindings','capabilityBindings','idempotencyKey','context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if p_request->>'typeKey' !~ '^[a-z][a-z0-9_]{1,63}$'
     or platform_private.cms_reserved_key(p_request->>'typeKey')
     or p_request->>'label' is null
     or pg_catalog.length(pg_catalog.normalize(p_request->>'label', 'NFC')) not between 2 and 120
     or p_request->>'ownerCapability' !~ '^[a-z][a-z0-9._-]{0,127}$'
     or not platform_private.cms_capability_registry_valid(p_request->>'ownerCapability', null)
     or p_request->>'workflowKey' !~ '^[a-z][a-z0-9._-]{0,127}$'
     or not platform_private.cms_valid_version(p_request->>'workflowVersion')
     or not platform_private.cms_workflow_registry_valid(
       p_request->>'workflowKey',
       case when platform_private.cms_valid_version(p_request->>'workflowVersion')
         then (p_request->>'workflowVersion')::bigint else null end
     )
     or pg_catalog.jsonb_typeof(p_request->'fields') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'fields') > 128
     or pg_catalog.jsonb_typeof(p_request->'relations') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'relations') > 128
     or pg_catalog.jsonb_typeof(p_request->'templateBindings') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'templateBindings') > 32
     or pg_catalog.jsonb_typeof(p_request->'capabilityBindings') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'capabilityBindings') > 32 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request ? 'defaultTemplateVersionId'
     and p_request->'defaultTemplateVersionId' <> 'null'::jsonb
     and (
       not platform_private.cms_valid_uuid(p_request->>'defaultTemplateVersionId')
       or not platform_private.cms_template_registry_valid(
         (p_request->>'defaultTemplateVersionId')::uuid
       )
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if exists (select 1 from platform_private.cms_content_types where type_key = p_request->>'typeKey') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  definition_hash := platform_private.cms_definition_artifact_hash(p_request, 1);
  insert into platform_private.cms_content_types(
    id, owner_id, state, version, type_key, owner_capability, created_by
  ) values (type_id, acting_party_id, 'retired', 1, p_request->>'typeKey', p_request->>'ownerCapability', actor_id);
  insert into platform_private.cms_content_type_versions(
    id, owner_id, state, version, content_type_id, version_no, labels,
    workflow_key, workflow_version, source_locale, default_locale,
    default_template_version_id, schema_artifact_id, definition_hash,
    compatibility, dry_run_id, created_by
  ) values (
    version_id, acting_party_id, 'draft', 1, type_id, 1,
    jsonb_build_object('label', pg_catalog.normalize(p_request->>'label', 'NFC')),
    p_request->>'workflowKey', (p_request->>'workflowVersion')::bigint,
    p_request->>'sourceLocale', p_request->>'defaultLocale',
    nullif(p_request->>'defaultTemplateVersionId', '')::uuid, artifact_id,
    definition_hash, 'additive', null, actor_id
  );
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, state, version, content_type_version_id, compiler_version,
    zod_contract_ref, editor_manifest, renderer_manifest, artifact_hash, compiled_at
  ) values (
    artifact_id, acting_party_id, 'compiled', 1, version_id, '1',
    platform_private.cms_artifact_contract_ref(p_request->>'typeKey', 1),
    platform_private.cms_compiled_editor_manifest(p_request),
    platform_private.cms_compiled_renderer_manifest(p_request), definition_hash, now()
  );
  for field_input in select value from jsonb_array_elements(p_request->'fields') as value loop
    if not platform_private.cms_valid_field_input(field_input, true) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    field_id := (field_input->>'stableFieldId')::uuid;
    insert into platform_private.cms_field_definition_versions(
      id, owner_id, state, version, content_type_version_id, stable_field_id,
      field_key, kind, constraints, validator_key, validator_version, required,
      default_mode, default_value, localization_mode, editor_config, created_by
    ) values (
      field_id, acting_party_id, coalesce(nullif(field_input->>'lifecycle', ''), 'active'), 1,
      version_id, field_id, field_input->>'key', field_input->>'kind',
      coalesce(field_input->'constraints', '{}'::jsonb), nullif(field_input->>'validatorKey', '') ,
      nullif(field_input->>'validatorVersion', '')::bigint, coalesce((field_input->>'required')::boolean, false),
      coalesce(nullif(field_input->>'defaultMode', ''), 'none'), field_input->'defaultValue',
      coalesce(nullif(field_input->>'localizationMode', ''), 'none'),
      coalesce(field_input->'editorConfig', '{}'::jsonb), actor_id
    );
  end loop;
  for relation_input in select value from jsonb_array_elements(p_request->'relations') as value loop
    if not platform_private.cms_valid_relation_input(relation_input)
       or not exists (
         select 1
         from platform_private.cms_field_definition_versions field
         where field.id = (relation_input->>'fieldId')::uuid
           and field.content_type_version_id = version_id
           and field.kind = 'relation'
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    insert into platform_private.cms_relation_definitions(
      owner_id, state, version, field_definition_id,
      target_kind, target_type, projection_key, cardinality, min_count, max_count,
      ordered, on_unavailable, created_by
    )
    select acting_party_id, 'draft', 1, (relation_input->>'fieldId')::uuid,
      relation_input->>'targetKind', relation_input->>'targetType', relation_input->>'projectionKey',
      relation_input->>'cardinality', (relation_input->>'min')::integer, (relation_input->>'max')::integer,
      coalesce((relation_input->>'ordered')::boolean, false), relation_input->>'onUnavailable', actor_id;
  end loop;
  for binding_input in select value from jsonb_array_elements(p_request->'templateBindings') as value loop
    if not platform_private.cms_exact_keys(
      binding_input,
      array['templateVersionId']::text[],
      array['templateVersionId']::text[]
    ) or not platform_private.cms_valid_uuid(binding_input->>'templateVersionId')
      or not platform_private.cms_template_registry_valid(
        case when platform_private.cms_valid_uuid(binding_input->>'templateVersionId')
          then (binding_input->>'templateVersionId')::uuid else null end
      ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    insert into platform_private.cms_content_type_template_bindings(
      owner_id, state, version, content_type_version_id, template_version_id, position
    ) values (
      acting_party_id, 'draft', 1, version_id, (binding_input->>'templateVersionId')::uuid,
      coalesce((binding_input->>'position')::integer, 0)
    );
  end loop;
  for capability_input in select value from jsonb_array_elements(p_request->'capabilityBindings') as value loop
    if not platform_private.cms_exact_keys(
      capability_input,
      array['capabilityKey','capabilityVersion']::text[],
      array['capabilityKey','capabilityVersion']::text[]
    ) or capability_input->>'capabilityKey' !~ '^[a-z][a-z0-9._-]{0,127}$'
      or not platform_private.cms_capability_registry_valid(
        capability_input->>'capabilityKey',
        case when platform_private.cms_valid_version(capability_input->>'capabilityVersion')
          then (capability_input->>'capabilityVersion')::bigint else null end
      )
      or not platform_private.cms_valid_version(capability_input->>'capabilityVersion') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    insert into platform_private.cms_content_type_capability_bindings(
      owner_id, state, version, content_type_version_id, capability_key, capability_version
    ) values (
      acting_party_id, 'draft', 1, version_id, capability_input->>'capabilityKey',
      (capability_input->>'capabilityVersion')::bigint
    );
  end loop;
  -- The draft carries no dry-run evidence: CMS-03A-10 alone produces a report,
  -- plan and job, so a new draft never self-certifies a passing dry run.
  perform platform_private.cms_emit_event(
    'cms.schema.draft.create', actor_id, acting_party_id, 'cms_content_type_version',
    version_id, 'CMS_SCHEMA_DRAFT_CREATED', 'cms.schema.draft.created.v1',
    'cms_content_type_version', version_id, 1,
    jsonb_build_object(
      'contentTypeId', type_id, 'schemaVersionId', version_id,
      'typeKey', p_request->>'typeKey', 'version', '1'
    ), correlation_id
  );
  response := platform_private.cms_type_version_resource(version_id);
  perform platform_private.cms_complete(reservation.id, version_id, 201, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_type_version_resource(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'resourceKind', 'content_type_version',
    'id', version_row.id,
    'version', version_row.version::text,
    'contentHash', version_row.definition_hash,
    'createdAt', version_row.created_at,
    'updatedAt', version_row.updated_at,
    'state', version_row.state::text,
    'contentTypeId', version_row.content_type_id,
    'typeKey', type_row.type_key,
    'label', coalesce(version_row.labels->>'label', type_row.type_key),
    'ownerCapability', type_row.owner_capability,
    'sourceLocale', version_row.source_locale,
    'defaultLocale', version_row.default_locale,
    'workflowKey', version_row.workflow_key,
    'workflowVersion', version_row.workflow_version::text,
    'defaultTemplateVersionId', version_row.default_template_version_id,
    'schemaArtifactId', version_row.schema_artifact_id,
    'fieldCount', (select count(*) from platform_private.cms_field_definition_versions field where field.content_type_version_id = version_row.id),
    'relationCount', (select count(*) from platform_private.cms_relation_definitions relation where relation.field_definition_id in (select field.id from platform_private.cms_field_definition_versions field where field.content_type_version_id = version_row.id)),
    'capabilityBindingCount', (select count(*) from platform_private.cms_content_type_capability_bindings binding where binding.content_type_version_id = version_row.id),
    'compatibility', version_row.compatibility,
    'dryRunId', version_row.dry_run_id,
    'activationEvidence', case when version_row.activation_workflow_policy_key is null then null else jsonb_build_object(
      'key', version_row.activation_workflow_policy_key,
      'version', version_row.activation_workflow_policy_version::text,
      'policyHash', version_row.activation_workflow_policy_hash,
      'riskClass', case when version_row.activation_required_decision_count >= 2 then 'protected' else 'ordinary' end,
      'requiredDecisionCount', version_row.activation_required_decision_count,
      'requiredCapabilities', version_row.activation_required_capabilities,
      'approvalEvidenceHash', version_row.activation_approval_evidence_hash
    ) end
  )
  from platform_private.cms_content_type_versions version_row
  join platform_private.cms_content_types type_row on type_row.id = version_row.content_type_id
  where version_row.id = p_version_id
$function$;


revoke all on function platform_private.cms_artifact_contract_ref(text, integer),
  platform_private.cms_definition_artifact_hash(jsonb, integer),
  platform_private.cms_definition_artifact_hash(jsonb),
  platform_private.cms_candidate_definition_request(uuid),
  platform_private.cms_compile_candidate(uuid),
  platform_private.cms_create_type_draft(jsonb),
  platform_private.cms_type_version_resource(uuid)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_create_type_draft(jsonb) to service_role;

commit;
