-- Slice 09 (re-audit AC124/AC127/AC128/AC135/AC140/AC145): the protected registry reads.
--  * CMS-03A-06 allowed only its eight query members, but the Worker always sends the
--    verified server `context` (and a correlation id) with every RPC, so a production call
--    was refused with INVALID_REQUEST; the two server members are now admitted and every
--    other member (idempotency key, precondition, body) is still refused.
--  * The lifecycle and state unions are checked per resource kind: content_type admits
--    active|retired, field_definition_version active|deprecated|retired, a block record
--    supported|deprecated|withdrawn, a schema artifact only the state compiled; any other
--    value is a 422 instead of an empty page.
--  * Block registry records belong to the code-owned platform registry (their owner is the
--    release principal, never a tenant), so the owner-scope predicate hid every block from
--    every reader; CMS-03A-06 and the CMS-03A-07 blockDefinitions now project every
--    registered block to an authorized reader as the safe BlockDefinitionRegistryRecord.
--  * CMS-03A-07 refuses members beyond the two path identifiers and the server context.
-- Bodies are otherwise identical to the previous definitions (regenerated from the live
-- functions); grants are unchanged.  Forward-only.
begin;

create or replace function platform_private.cms_list_content_types(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  scope_id uuid;
  resource_kind text := nullif(p_request->>'resourceKind', '');
  key_prefix text := nullif(p_request->>'keyPrefix', '');
  lifecycle_filter text := nullif(p_request->>'lifecycle', '');
  state_filter text := nullif(p_request->>'state', '');
  sort_value text := coalesce(nullif(p_request->>'sort', ''), 'key');
  direction_value text := coalesce(nullif(p_request->>'direction', ''), 'asc');
  cursor_text text := nullif(p_request->>'cursor', '');
  cursor_value jsonb;
  query_hash text;
  cursor_hash text;
  cursor_id uuid;
  cursor_key text;
  cursor_created_at timestamptz;
  cursor_updated_at timestamptz;
  cursor_version bigint;
  item jsonb;
  items jsonb := '[]'::jsonb;
  limit_value integer;
  returned_count integer := 0;
  has_more boolean := false;
  next_cursor text;
  last_id uuid;
  last_key text;
  last_created_at timestamptz;
  last_updated_at timestamptz;
  last_version bigint;
  row_record record;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if not platform_private.cms_exact_keys(
    p_request,
    array[]::text[],
    array[
      'resourceKind','keyPrefix','lifecycle','state','limit','cursor','sort',
      'direction','context','correlationId'
    ]::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    limit_value := coalesce(nullif(p_request->>'limit', '')::integer, 25);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end;
  actor_id := platform_private.cms_actor(p_request);
  scope_id := platform_private.cms_acting_party(p_request, actor_id);
  if limit_value not between 1 and 100
     or (resource_kind is not null and resource_kind not in (
       'content_type','content_type_version','field_definition_version',
       'relation_definition','schema_artifact','block_definition_registry_record',
       'template_binding','capability_binding'
     ))
     or (key_prefix is not null and key_prefix !~ '^[a-z][a-z0-9._-]{0,63}$')
     or (lifecycle_filter is not null and lifecycle_filter not in (
       'active','retired','deprecated','supported','withdrawn'
     ))
     or (state_filter is not null and state_filter not in (
       'draft','review','approved','scheduled','active','superseded','retired',
       'blocked','compiled'
     ))
     or sort_value not in ('key','createdAt','updatedAt','version')
     or direction_value not in ('asc','desc')
     or (cursor_text is not null and pg_catalog.octet_length(cursor_text) not between 1 and 512)
     or (lifecycle_filter is not null and state_filter is not null) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if resource_kind in (
       'content_type_version','relation_definition','schema_artifact',
       'template_binding','capability_binding'
     ) and lifecycle_filter is not null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if resource_kind in ('content_type','field_definition_version','block_definition_registry_record')
     and state_filter is not null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- The lifecycle and state unions are closed per resource kind: a value that is not
  -- one of the selected kind's own values is a validation failure, not an empty page.
  if (resource_kind = 'content_type' and lifecycle_filter is not null
        and lifecycle_filter not in ('active','retired'))
     or (resource_kind = 'field_definition_version' and lifecycle_filter is not null
        and lifecycle_filter not in ('active','deprecated','retired'))
     or (resource_kind = 'block_definition_registry_record' and lifecycle_filter is not null
        and lifecycle_filter not in ('supported','deprecated','withdrawn'))
     or (resource_kind = 'schema_artifact' and state_filter is not null
        and state_filter <> 'compiled')
     or (resource_kind in ('content_type_version','relation_definition','template_binding','capability_binding')
        and state_filter = 'compiled') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_read(actor_id, scope_id);
  query_hash := platform_private.cms_jcs_sha256(jsonb_build_object(
    'actorId', actor_id, 'scopeId', scope_id, 'resourceKind', resource_kind,
    'keyPrefix', key_prefix, 'lifecycle', lifecycle_filter, 'state', state_filter,
    'limit', limit_value, 'sort', sort_value, 'direction', direction_value
  ));
  if cursor_text is not null then
    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(cursor_text, 'base64'), 'utf8'
      )::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if not platform_private.cms_exact_keys(
      cursor_value,
      array['queryHash','lastId','lastKey','lastCreatedAt','lastUpdatedAt','lastVersion']::text[],
      array['queryHash','lastId','lastKey','lastCreatedAt','lastUpdatedAt','lastVersion']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    cursor_hash := cursor_value->>'queryHash';
    if not platform_private.cms_valid_hash(cursor_hash)
       or cursor_hash is distinct from query_hash
       or not platform_private.cms_valid_uuid(cursor_value->>'lastId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    cursor_id := (cursor_value->>'lastId')::uuid;
    cursor_key := cursor_value->>'lastKey';
    begin
      cursor_created_at := (cursor_value->>'lastCreatedAt')::timestamptz;
      cursor_updated_at := (cursor_value->>'lastUpdatedAt')::timestamptz;
      cursor_version := (cursor_value->>'lastVersion')::bigint;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
  end if;
  for row_record in
    select registry_row.*
    from (
      select 'content_type'::text as kind, type_row.id,
        type_row.type_key as sort_key, type_row.created_at, type_row.updated_at,
        type_row.version as sort_version, type_row.state as lifecycle_value,
        null::text as state_value,
        jsonb_build_object(
          'resourceKind', 'content_type', 'id', type_row.id,
          'version', type_row.version::text, 'typeKey', type_row.type_key,
          'builtIn', type_row.built_in, 'lifecycle', type_row.state,
          'createdAt', type_row.created_at, 'updatedAt', type_row.updated_at
        ) as item
      from platform_private.cms_content_types type_row
      where type_row.owner_id = scope_id
      union all
      select 'content_type_version', version_row.id, type_row.type_key,
        version_row.created_at, version_row.updated_at, version_row.version,
        null, version_row.state::text, platform_private.cms_type_version_resource(version_row.id)
      from platform_private.cms_content_type_versions version_row
      join platform_private.cms_content_types type_row
        on type_row.id = version_row.content_type_id
      where version_row.owner_id = scope_id
      union all
      select 'field_definition_version', field_row.id, field_row.field_key,
        field_row.created_at, field_row.updated_at, field_row.version,
        field_row.state, null,
        jsonb_build_object(
          'resourceKind', 'field_definition_version', 'id', field_row.id,
          'version', field_row.version::text,
          'contentHash', encode(extensions.digest(convert_to(field_row::text, 'utf8'), 'sha256'), 'hex'),
          'createdAt', field_row.created_at, 'updatedAt', field_row.updated_at,
          'contentTypeVersionId', field_row.content_type_version_id,
          'stableFieldId', field_row.stable_field_id, 'key', field_row.field_key,
          'kind', field_row.kind, 'required', field_row.required,
          'validatorKey', field_row.validator_key,
          'validatorVersion', field_row.validator_version::text,
          'defaultMode', field_row.default_mode,
          'localizationMode', field_row.localization_mode,
          'lifecycle', field_row.state, 'migrationPlanId', null
        )
      from platform_private.cms_field_definition_versions field_row
      where field_row.owner_id = scope_id
      union all
      select 'relation_definition', relation_row.id, relation_row.projection_key,
        relation_row.created_at, relation_row.updated_at, relation_row.version,
        null, relation_row.state::text,
        jsonb_build_object(
          'resourceKind', 'relation_definition', 'id', relation_row.id,
          'version', relation_row.version::text,
          'contentHash', encode(extensions.digest(convert_to(relation_row::text, 'utf8'), 'sha256'), 'hex'),
          'createdAt', relation_row.created_at, 'updatedAt', relation_row.updated_at,
          'state', relation_row.state::text,
          'contentTypeVersionId', field_row.content_type_version_id,
          'fieldId', relation_row.field_definition_id, 'targetKind', relation_row.target_kind,
          'targetType', relation_row.target_type, 'projectionKey', relation_row.projection_key,
          'cardinality', relation_row.cardinality, 'min', relation_row.min_count,
          'max', relation_row.max_count, 'ordered', relation_row.ordered,
          'onUnavailable', relation_row.on_unavailable
        )
      from platform_private.cms_relation_definitions relation_row
      join platform_private.cms_field_definition_versions field_row
        on field_row.id = relation_row.field_definition_id
      where relation_row.owner_id = scope_id
      union all
      select 'schema_artifact', artifact.id, artifact.zod_contract_ref,
        artifact.created_at, artifact.updated_at, artifact.version,
        null, artifact.state,
        jsonb_build_object(
          'resourceKind', 'schema_artifact', 'id', artifact.id,
          'version', artifact.version::text, 'state', artifact.state,
          'contentTypeVersionId', artifact.content_type_version_id,
          'compilerVersion', artifact.compiler_version,
          'zodContractRef', artifact.zod_contract_ref,
          'artifactHash', artifact.artifact_hash, 'createdAt', artifact.created_at,
          'updatedAt', artifact.updated_at, 'compiledAt', artifact.compiled_at
        )
      from platform_private.cms_schema_artifacts artifact
      where artifact.owner_id = scope_id
      union all
      select 'block_definition_registry_record', block_row.id, block_row.block_key,
        block_row.created_at, block_row.updated_at, block_row.block_version::bigint,
        coalesce(lifecycle_row.to_lifecycle, 'supported'), null,
        jsonb_build_object(
          'resourceKind', 'block_definition_registry_record', 'id', block_row.id,
          'version', block_row.version::text, 'blockKey', block_row.block_key,
          'blockVersion', block_row.block_version, 'propsSchemaRef', block_row.props_schema_ref,
          'propsSchemaHash', block_row.props_schema_hash, 'rendererRef', block_row.renderer_ref,
          'releaseDigest', block_row.release_digest,
          'lifecycle', coalesce(lifecycle_row.to_lifecycle, 'supported')
        )
      from platform_private.cms_block_definition_versions block_row
      left join lateral (
        select event_row.to_lifecycle
        from platform_private.cms_block_definition_lifecycle_events event_row
        where event_row.block_definition_version_id = block_row.id
        order by event_row.created_at desc, event_row.id desc
        limit 1
      ) lifecycle_row on true
      where block_row.state = 'registered'
      union all
      select 'template_binding', template_row.id, template_row.template_version_id::text,
        template_row.created_at, template_row.updated_at, template_row.version,
        null, template_row.state::text,
        jsonb_build_object(
          'resourceKind', 'template_binding', 'id', template_row.id,
          'contentTypeVersionId', template_row.content_type_version_id,
          'templateVersionId', template_row.template_version_id,
          'position', template_row.position, 'version', template_row.version::text,
          'state', template_row.state::text
        )
      from platform_private.cms_content_type_template_bindings template_row
      where template_row.owner_id = scope_id
      union all
      select 'capability_binding', capability_row.id, capability_row.capability_key,
        capability_row.created_at, capability_row.updated_at, capability_row.version,
        null, capability_row.state::text,
        jsonb_build_object(
          'resourceKind', 'capability_binding', 'id', capability_row.id,
          'contentTypeVersionId', capability_row.content_type_version_id,
          'capabilityKey', capability_row.capability_key,
          'capabilityVersion', capability_row.capability_version::text,
          'version', capability_row.version::text, 'state', capability_row.state::text
        )
      from platform_private.cms_content_type_capability_bindings capability_row
      where capability_row.owner_id = scope_id
    ) registry_row
    where (resource_kind is null or registry_row.kind = resource_kind)
      and (key_prefix is null or registry_row.sort_key like key_prefix || '%')
      and (
        (lifecycle_filter is null and state_filter is null)
        or (lifecycle_filter is not null and registry_row.lifecycle_value = lifecycle_filter)
        or (state_filter is not null and registry_row.state_value = state_filter)
      )
    order by
      case when sort_value = 'key' and direction_value = 'asc' then registry_row.sort_key end asc,
      case when sort_value = 'key' and direction_value = 'desc' then registry_row.sort_key end desc,
      case when sort_value = 'createdAt' and direction_value = 'asc' then registry_row.created_at end asc,
      case when sort_value = 'createdAt' and direction_value = 'desc' then registry_row.created_at end desc,
      case when sort_value = 'updatedAt' and direction_value = 'asc' then registry_row.updated_at end asc,
      case when sort_value = 'updatedAt' and direction_value = 'desc' then registry_row.updated_at end desc,
      case when sort_value = 'version' and direction_value = 'asc' then registry_row.sort_version end asc,
      case when sort_value = 'version' and direction_value = 'desc' then registry_row.sort_version end desc,
      case when direction_value = 'asc' then registry_row.id end asc,
      case when direction_value = 'desc' then registry_row.id end desc
  loop
    if cursor_value is not null then
      if sort_value = 'key' and direction_value = 'asc'
         and not (row_record.sort_key > cursor_key
           or (row_record.sort_key = cursor_key and row_record.id > cursor_id)) then continue; end if;
      if sort_value = 'key' and direction_value = 'desc'
         and not (row_record.sort_key < cursor_key
           or (row_record.sort_key = cursor_key and row_record.id < cursor_id)) then continue; end if;
      if sort_value = 'createdAt' and direction_value = 'asc'
         and not (row_record.created_at > cursor_created_at
           or (row_record.created_at = cursor_created_at and row_record.id > cursor_id)) then continue; end if;
      if sort_value = 'createdAt' and direction_value = 'desc'
         and not (row_record.created_at < cursor_created_at
           or (row_record.created_at = cursor_created_at and row_record.id < cursor_id)) then continue; end if;
      if sort_value = 'updatedAt' and direction_value = 'asc'
         and not (row_record.updated_at > cursor_updated_at
           or (row_record.updated_at = cursor_updated_at and row_record.id > cursor_id)) then continue; end if;
      if sort_value = 'updatedAt' and direction_value = 'desc'
         and not (row_record.updated_at < cursor_updated_at
           or (row_record.updated_at = cursor_updated_at and row_record.id < cursor_id)) then continue; end if;
      if sort_value = 'version' and direction_value = 'asc'
         and not (row_record.sort_version > cursor_version
           or (row_record.sort_version = cursor_version and row_record.id > cursor_id)) then continue; end if;
      if sort_value = 'version' and direction_value = 'desc'
         and not (row_record.sort_version < cursor_version
           or (row_record.sort_version = cursor_version and row_record.id < cursor_id)) then continue; end if;
    end if;
    if returned_count >= limit_value then
      has_more := true;
      exit;
    end if;
    item := row_record.item;
    items := items || jsonb_build_array(item);
    returned_count := returned_count + 1;
    last_id := row_record.id;
    last_key := row_record.sort_key;
    last_created_at := row_record.created_at;
    last_updated_at := row_record.updated_at;
    last_version := row_record.sort_version;
  end loop;
  if has_more then
    next_cursor := replace(pg_catalog.encode(
      pg_catalog.convert_to(platform_private.cms_jcs(jsonb_build_object(
        'queryHash', query_hash, 'lastId', last_id, 'lastKey', last_key,
        'lastCreatedAt', last_created_at, 'lastUpdatedAt', last_updated_at,
        'lastVersion', last_version
      )), 'utf8'),
      'base64'
    ), E'\n', '');
  end if;
  return jsonb_build_object('items', items, 'nextCursor', next_cursor);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'INVALID_REQUEST' using errcode = 'P0001';
end;
$function$;

create or replace function platform_private.cms_get_content_type_version(p_request jsonb)
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
  -- The detail takes the two path identifiers and the server context only: no query,
  -- body, idempotency key or precondition member is part of this read.
  if not platform_private.cms_exact_keys(
    p_request, array['contentTypeId','versionId']::text[],
    array['contentTypeId','versionId','context','correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
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

commit;
