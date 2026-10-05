-- Slice 09 (AC217; R12 holdover): CMS-03A-01 validates the 128-field aggregate
-- once and inserts every field row in one set-based statement instead of a
-- per-field plpgsql loop, and the canonical JSON helpers it leans on are
-- rewritten to run in a single pass (see the preceding migration).  The
-- request grammar, error mapping, signature and grants are unchanged.
-- Forward-only.
begin;

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
  relation_input jsonb;
  capability_input jsonb;
  response jsonb;
  definition_hash text;
  locale_issues jsonb := '[]'::jsonb;
  sorted_supported jsonb;
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
    array['typeKey','label','ownerCapability','sourceLocale','defaultLocale','supportedLocales','fallbackChains','workflowKey','workflowVersion','defaultTemplateVersionId','fields','relations','templateBindings','capabilityBindings']::text[],
    array['typeKey','label','ownerCapability','sourceLocale','defaultLocale','supportedLocales','fallbackChains','workflowKey','workflowVersion','defaultTemplateVersionId','fields','relations','templateBindings','capabilityBindings','idempotencyKey','context','correlationId']::text[]
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
  -- DEC-123: a brand-new type is created without a template.  A compatible
  -- template names the type id, which exists only after this command commits,
  -- so a default template or any template binding is refused outright (422),
  -- before any other lookup: the refusal never depends on, and so never
  -- discloses, whether a referenced template exists or is compatible.  The
  -- binding is added through a successor version (CMS-03A-09).
  if p_request->'defaultTemplateVersionId' is distinct from 'null'::jsonb
     or pg_catalog.jsonb_array_length(p_request->'templateBindings') <> 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- BE03a A01 failure mapping: a request that repeats a stable field identity,
  -- a field key, a relation target field, a template version or a capability
  -- reference is a malformed aggregate (422), never a raw unique-violation
  -- leak.  The check runs before any insert, so nothing is committed.
  if (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(field_entry->>'stableFieldId'))
        from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct field_entry->>'key')
        from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(relation_entry->>'fieldId'))
        from pg_catalog.jsonb_array_elements(p_request->'relations') relation_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(binding_entry->>'templateVersionId'))
        from pg_catalog.jsonb_array_elements(p_request->'templateBindings') binding_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct (capability_entry->>'capabilityKey') || '@' || (capability_entry->>'capabilityVersion'))
        from pg_catalog.jsonb_array_elements(p_request->'capabilityBindings') capability_entry) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not platform_private.cms_locale_config_shape_valid(
       p_request->'supportedLocales', p_request->'fallbackChains') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not platform_private.cms_locale_canonical_valid(p_request->>'sourceLocale') then
    locale_issues := locale_issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('sourceLocale'),
      'message', 'locale tag must be a canonical-case BCP 47 tag'));
  end if;
  if not platform_private.cms_locale_canonical_valid(p_request->>'defaultLocale') then
    locale_issues := locale_issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('defaultLocale'),
      'message', 'locale tag must be a canonical-case BCP 47 tag'));
  end if;
  locale_issues := locale_issues || platform_api.cms_validate_locale_config(
    p_request->>'sourceLocale', p_request->>'defaultLocale',
    p_request->'supportedLocales', p_request->'fallbackChains');
  if pg_catalog.jsonb_array_length(locale_issues) > 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = platform_private.cms_locale_violation_detail(locale_issues);
  end if;
  sorted_supported := platform_private.cms_locale_sorted(p_request->'supportedLocales');
  -- Competing creates of one key serialize on a transaction-scoped lock; the
  -- loser re-reads the committed key below and is refused with 409, never with
  -- a raw unique violation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cms.type_key:' || (p_request->>'typeKey'), 0));
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
    supported_locales, fallback_chains, locale_config_hash,
    default_template_version_id, schema_artifact_id, definition_hash,
    compatibility, dry_run_id, created_by
  ) values (
    version_id, acting_party_id, 'draft', 1, type_id, 1,
    jsonb_build_object('label', pg_catalog.normalize(p_request->>'label', 'NFC')),
    p_request->>'workflowKey', (p_request->>'workflowVersion')::bigint,
    p_request->>'sourceLocale', p_request->>'defaultLocale',
    sorted_supported, p_request->'fallbackChains',
    platform_private.cms_locale_config_hash(
      p_request->>'sourceLocale', p_request->>'defaultLocale',
      sorted_supported, p_request->'fallbackChains'),
    null, artifact_id,
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
  -- AC217: one validation pass and one set-based insert replace the
  -- per-field plpgsql loop.  Any invalid field raises the same 422 before a
  -- single field row exists; the row-level guards still fire for every row.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry(value)
    where not platform_private.cms_valid_field_input(field_entry.value, true)
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_field_definition_versions(
    id, owner_id, state, version, content_type_version_id, stable_field_id,
    field_key, kind, constraints, validator_key, validator_version, required,
    default_mode, default_value, localization_mode, editor_config, created_by
  )
  select (field_entry.value->>'stableFieldId')::uuid, acting_party_id,
    coalesce(nullif(field_entry.value->>'lifecycle', ''), 'active'), 1,
    version_id, (field_entry.value->>'stableFieldId')::uuid,
    field_entry.value->>'key', field_entry.value->>'kind',
    coalesce(field_entry.value->'constraints', '{}'::jsonb),
    nullif(field_entry.value->>'validatorKey', ''),
    nullif(field_entry.value->>'validatorVersion', '')::bigint,
    coalesce((field_entry.value->>'required')::boolean, false),
    coalesce(nullif(field_entry.value->>'defaultMode', ''), 'none'),
    field_entry.value->'defaultValue',
    coalesce(nullif(field_entry.value->>'localizationMode', ''), 'none'),
    coalesce(field_entry.value->'editorConfig', '{}'::jsonb), actor_id
  from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry(value);
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

commit;
