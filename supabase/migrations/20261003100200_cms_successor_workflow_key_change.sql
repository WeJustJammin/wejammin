-- Slice 09 (AC390; R12 holdover, orchestrator ruling "Integrator-v3 holdover
-- rulings"): CMS-03A-09 can change the workflow policy member of a successor.
-- The successor request gains the optional pair workflowKey / workflowVersion
-- with the pair semantics of the locale and template members: both null (or
-- absent) keeps the source member, both present replaces it with a seeded member
-- of the code-owned workflow registry (an unseeded key or version, a wrong type
-- or one member without the other is 422 VALIDATION_FAILED before any row is
-- read).  The definition hash already composes workflowKey and workflowVersion,
-- so the change is frozen into the candidate, its artifact and the review
-- evidence, and CMS-03A-11 reviews the successor under the strictest of the
-- source member and the new member (a protected to ordinary change keeps the
-- protected decision count and specialist slot).  Nothing else changes: the
-- signature and grants are unchanged.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_create_schema_successor(p_request jsonb)
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
  source_row platform_private.cms_content_type_versions%rowtype;
  expected_version bigint;
  new_version_id uuid := extensions.gen_random_uuid();
  new_artifact_id uuid := extensions.gen_random_uuid();
  next_version_no integer;
  type_key text;
  response jsonb;
  supported_present boolean;
  chains_present boolean;
  locale_issues jsonb;
  new_supported jsonb;
  new_chains jsonb;
  template_default_present boolean;
  template_bindings_present boolean;
  template_entry record;
  template_ids uuid[];
  new_default_template uuid;
  workflow_key_present boolean;
  workflow_version_present boolean;
  new_workflow_key text;
  new_workflow_version bigint;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-09');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return platform_private.cms_type_version_resource((reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion']::text[],
    array['contentTypeId','versionId','expectedVersion','supportedLocales','fallbackChains',
          'defaultTemplateVersionId','templateBindings','workflowKey','workflowVersion',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  supported_present := coalesce(pg_catalog.jsonb_typeof(p_request->'supportedLocales'), 'null') <> 'null';
  chains_present := coalesce(pg_catalog.jsonb_typeof(p_request->'fallbackChains'), 'null') <> 'null';
  if supported_present <> chains_present then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = platform_private.cms_locale_violation_detail(pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('fallbackChains'),
          'message', 'supportedLocales and fallbackChains must be both null or both present')));
  end if;
  -- AC390: the workflow members follow the same pair rule.  Both null (or absent)
  -- keeps the source workflow policy member; both present replaces it with a
  -- member of the code-owned registry.  The shape and the registry membership are
  -- checked before any row is read (the registry is global and discloses nothing
  -- about the caller's scope).  The strictest-of review rule of CMS-03A-11 then
  -- applies to the pair of the source and the new member, so replacing a protected
  -- member with an ordinary one never lowers the review the successor needs.
  workflow_key_present :=
    coalesce(pg_catalog.jsonb_typeof(p_request->'workflowKey'), 'null') <> 'null';
  workflow_version_present :=
    coalesce(pg_catalog.jsonb_typeof(p_request->'workflowVersion'), 'null') <> 'null';
  if workflow_key_present <> workflow_version_present then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = platform_private.cms_locale_violation_detail(pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('workflowVersion'),
          'message', 'workflowKey and workflowVersion must be both null or both present')));
  end if;
  if workflow_key_present then
    if pg_catalog.jsonb_typeof(p_request->'workflowKey') <> 'string'
       or pg_catalog.jsonb_typeof(p_request->'workflowVersion') <> 'string'
       or p_request->>'workflowKey' !~ '^[a-z][a-z0-9._-]{0,127}$'
       or not platform_private.cms_valid_version(p_request->>'workflowVersion')
       or not platform_private.cms_workflow_registry_valid(
         p_request->>'workflowKey', (p_request->>'workflowVersion')::bigint) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    new_workflow_key := p_request->>'workflowKey';
    new_workflow_version := (p_request->>'workflowVersion')::bigint;
  end if;
  -- DEC-123: the template members follow the same pair rule.  Both null (or
  -- absent) clones the source default template and bindings; both present
  -- replaces them.  The shape, bounds and uniqueness are checked here, before
  -- any row is read; the compatibility of each template is decided later by
  -- the BE03c resolver against the exact candidate.
  template_default_present :=
    coalesce(pg_catalog.jsonb_typeof(p_request->'defaultTemplateVersionId'), 'null') <> 'null';
  template_bindings_present :=
    coalesce(pg_catalog.jsonb_typeof(p_request->'templateBindings'), 'null') <> 'null';
  if template_default_present <> template_bindings_present then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = platform_private.cms_locale_violation_detail(pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('templateBindings'),
          'message', 'defaultTemplateVersionId and templateBindings must be both null or both present')));
  end if;
  if template_default_present then
    if pg_catalog.jsonb_typeof(p_request->'defaultTemplateVersionId') <> 'string'
       or not platform_private.cms_valid_uuid(p_request->>'defaultTemplateVersionId')
       or pg_catalog.jsonb_typeof(p_request->'templateBindings') <> 'array'
       or pg_catalog.jsonb_array_length(p_request->'templateBindings') > 32 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    for template_entry in
      select entry.value, entry.ordinality
        from pg_catalog.jsonb_array_elements(p_request->'templateBindings')
             with ordinality entry(value, ordinality)
    loop
      if pg_catalog.jsonb_typeof(template_entry.value) <> 'object'
         or not platform_private.cms_exact_keys(
           template_entry.value, array['templateVersionId']::text[], array['templateVersionId']::text[])
         or pg_catalog.jsonb_typeof(template_entry.value->'templateVersionId') <> 'string'
         or not platform_private.cms_valid_uuid(template_entry.value->>'templateVersionId') then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
    end loop;
    select pg_catalog.array_agg((entry.value->>'templateVersionId')::uuid order by entry.ordinality)
      into template_ids
      from pg_catalog.jsonb_array_elements(p_request->'templateBindings')
           with ordinality entry(value, ordinality);
    template_ids := coalesce(template_ids, array[]::uuid[]);
    select entry.ordinality into template_entry
      from (
        select bound.ordinality,
               pg_catalog.count(*) over (partition by bound.template_id) as occurrences,
               pg_catalog.row_number() over (partition by bound.template_id order by bound.ordinality) as occurrence
          from pg_catalog.unnest(template_ids) with ordinality bound(template_id, ordinality)
      ) entry
     where entry.occurrence > 1
     order by entry.ordinality
     limit 1;
    if found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = platform_private.cms_locale_violation_detail(pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'path', pg_catalog.jsonb_build_array('templateBindings', template_entry.ordinality - 1, 'templateVersionId'),
            'message', 'templateBindings must be unique')));
    end if;
    new_default_template := (p_request->>'defaultTemplateVersionId')::uuid;
  end if;
  select * into source_row
    from platform_private.cms_content_type_versions version_row
   where version_row.id = (p_request->>'versionId')::uuid
     and version_row.content_type_id = (p_request->>'contentTypeId')::uuid
     and version_row.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(source_row.id);
  if source_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, source_row.version);
  end if;
  if source_row.state <> 'active'::platform_private.cms_definition_state
     or source_row.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- The locale configuration: both null clones the source; both present
  -- replaces it under the inherited, immutable source and default locale.
  if supported_present then
    if not platform_private.cms_locale_config_shape_valid(
         p_request->'supportedLocales', p_request->'fallbackChains') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    locale_issues := platform_api.cms_validate_locale_config(
      source_row.source_locale, source_row.default_locale,
      p_request->'supportedLocales', p_request->'fallbackChains');
    if pg_catalog.jsonb_array_length(locale_issues) > 0 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = platform_private.cms_locale_violation_detail(locale_issues);
    end if;
    new_supported := platform_private.cms_locale_sorted(p_request->'supportedLocales');
    new_chains := p_request->'fallbackChains';
  else
    new_supported := source_row.supported_locales;
    new_chains := source_row.fallback_chains;
  end if;
  -- One live successor draft per type: a draft, review or approved candidate
  -- of the same type already exists.
  if exists (
    select 1 from platform_private.cms_content_type_versions live
     where live.content_type_id = source_row.content_type_id
       and live.state in (
         'draft'::platform_private.cms_definition_state,
         'review'::platform_private.cms_definition_state,
         'approved'::platform_private.cms_definition_state
       )
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select max(version_row.version_no) + 1 into next_version_no
    from platform_private.cms_content_type_versions version_row
   where version_row.content_type_id = source_row.content_type_id;
  select type_row.type_key into type_key
    from platform_private.cms_content_types type_row
   where type_row.id = source_row.content_type_id;
  insert into platform_private.cms_content_type_versions(
    id, owner_id, state, version, content_type_id, version_no, labels,
    workflow_key, workflow_version, source_locale, default_locale,
    supported_locales, fallback_chains, locale_config_hash,
    default_template_version_id, schema_artifact_id, definition_hash,
    compatibility, supersedes_id, dry_run_id, created_by
  ) values (
    new_version_id, source_row.owner_id, 'draft', 1, source_row.content_type_id,
    next_version_no, source_row.labels, coalesce(new_workflow_key, source_row.workflow_key),
    coalesce(new_workflow_version, source_row.workflow_version), source_row.source_locale, source_row.default_locale,
    new_supported, new_chains,
    platform_private.cms_locale_config_hash(
      source_row.source_locale, source_row.default_locale, new_supported, new_chains),
    source_row.default_template_version_id, new_artifact_id,
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      'successor-placeholder:' || new_version_id::text, 'utf8'), 'sha256'), 'hex'),
    'unknown', source_row.id, null, actor_id
  );
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, state, version, content_type_version_id, compiler_version,
    zod_contract_ref, editor_manifest, renderer_manifest, artifact_hash, compiled_at
  ) values (
    new_artifact_id, source_row.owner_id, 'compiled', 1, new_version_id, '1',
    platform_private.cms_artifact_contract_ref(type_key, next_version_no),
    '{"schema":{},"fields":[]}'::jsonb,
    '{"relations":[],"templateBindings":[],"capabilityBindings":[]}'::jsonb,
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      'artifact-placeholder:' || new_artifact_id::text, 'utf8'), 'sha256'), 'hex'),
    pg_catalog.clock_timestamp()
  );
  -- Fields and their relations are cloned in one statement so each relation is
  -- remapped to its own new field row while stable ids and keys are preserved.
  with source_fields as materialized (
    select field.*, extensions.gen_random_uuid() as clone_id
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = source_row.id
  ), cloned_fields as (
    insert into platform_private.cms_field_definition_versions(
      id, owner_id, state, version, content_type_version_id, stable_field_id,
      field_key, kind, constraints, validator_key, validator_version, required,
      default_mode, default_value, localization_mode, editor_config, created_by
    )
    select source_fields.clone_id, source_fields.owner_id, source_fields.state, 1,
           new_version_id, source_fields.stable_field_id, source_fields.field_key,
           source_fields.kind, source_fields.constraints, source_fields.validator_key,
           source_fields.validator_version, source_fields.required,
           source_fields.default_mode, source_fields.default_value,
           source_fields.localization_mode, source_fields.editor_config, actor_id
      from source_fields
    returning id
  )
  insert into platform_private.cms_relation_definitions(
    owner_id, state, version, field_definition_id, target_kind, target_type,
    projection_key, cardinality, min_count, max_count, ordered, on_unavailable, created_by
  )
  select relation.owner_id, 'draft', 1, source_fields.clone_id, relation.target_kind,
         relation.target_type, relation.projection_key, relation.cardinality,
         relation.min_count, relation.max_count, relation.ordered,
         relation.on_unavailable, actor_id
    from platform_private.cms_relation_definitions relation
    join source_fields on source_fields.id = relation.field_definition_id
   where (select count(*) from cloned_fields) >= 0;
  if template_default_present then
    -- DEC-123: the replacement.  Each template is resolved against this exact
    -- candidate (the default first, then each binding in request order); the
    -- first failure aborts the whole command, so nothing is committed.
    perform platform_private.cms_successor_template_gate(
      actor_id, acting_party_id, new_default_template, source_row.content_type_id,
      new_version_id, pg_catalog.jsonb_build_array('defaultTemplateVersionId'));
    for template_entry in
      select entry.value, entry.ordinality
        from pg_catalog.jsonb_array_elements(p_request->'templateBindings')
             with ordinality entry(value, ordinality)
    loop
      perform platform_private.cms_successor_template_gate(
        actor_id, acting_party_id, (template_entry.value->>'templateVersionId')::uuid,
        source_row.content_type_id, new_version_id,
        pg_catalog.jsonb_build_array('templateBindings', template_entry.ordinality - 1, 'templateVersionId'));
      insert into platform_private.cms_content_type_template_bindings(
        owner_id, state, version, content_type_version_id, template_version_id, position
      ) values (
        source_row.owner_id, 'draft', 1, new_version_id,
        (template_entry.value->>'templateVersionId')::uuid, (template_entry.ordinality - 1)::integer
      );
    end loop;
    update platform_private.cms_content_type_versions version_update
       set default_template_version_id = new_default_template,
           updated_at = pg_catalog.clock_timestamp()
     where version_update.id = new_version_id;
  else
    insert into platform_private.cms_content_type_template_bindings(
      owner_id, state, version, content_type_version_id, template_version_id, position
    )
    select binding.owner_id, 'draft', 1, new_version_id, binding.template_version_id, binding.position
      from platform_private.cms_content_type_template_bindings binding
     where binding.content_type_version_id = source_row.id;
  end if;
  insert into platform_private.cms_content_type_capability_bindings(
    owner_id, state, version, content_type_version_id, capability_key, capability_version
  )
  select binding.owner_id, 'draft', 1, new_version_id, binding.capability_key, binding.capability_version
    from platform_private.cms_content_type_capability_bindings binding
   where binding.content_type_version_id = source_row.id;
  perform platform_private.cms_compile_candidate(new_version_id);
  perform platform_private.cms_emit_event(
    'cms.schema.successor.create', actor_id, acting_party_id, 'cms_content_type_version',
    new_version_id, 'CMS_SCHEMA_SUCCESSOR_CREATED', 'cms.schema.draft.created.v1',
    'cms_content_type_version', new_version_id, 1,
    jsonb_build_object(
      'contentTypeId', source_row.content_type_id, 'schemaVersionId', new_version_id,
      'typeKey', type_key, 'version', next_version_no::text,
      'supersedesVersionId', source_row.id
    ), correlation_id
  );
  response := platform_private.cms_type_version_resource(new_version_id);
  perform platform_private.cms_complete(reservation.id, new_version_id, 201, response);
  return response;
end;
$function$;

commit;
