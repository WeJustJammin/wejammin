-- A candidate under review may still be edited: the edit is drift, so the
-- invalidation trigger moves the open review to invalidated and the candidate
-- back to an editable draft in the same transaction (BE03a "State machine and
-- concurrency"; the definition-child guard already admits draft or review
-- parents).  The edit commands therefore accept a draft or review parent and
-- no longer bump the parent with a stale version predicate after the trigger
-- has already advanced it.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_add_field_definition(p_request jsonb)
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
  type_version platform_private.cms_content_type_versions%rowtype;
  field_id uuid;
  field_input jsonb := p_request->'field';
  field_row platform_private.cms_field_definition_versions%rowtype;
  response jsonb;
  expected_version bigint;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-02:' || coalesce(p_request->>'contentTypeId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('resourceKind', 'field_definition_version', 'id', (reservation.response_ref->>'resourceRef')::uuid);
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','field','migrationPlanId','expectedVersion']::text[],
    array['contentTypeId','versionId','field','migrationPlanId','expectedVersion','ifMatch','idempotencyKey','context','correlationId']::text[]
  )
     or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or pg_catalog.jsonb_typeof(field_input) is distinct from 'object'
     or not (p_request ? 'migrationPlanId')
     or (p_request->'migrationPlanId' <> 'null'::jsonb and not platform_private.cms_valid_uuid(p_request->>'migrationPlanId')) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into type_version
  from platform_private.cms_content_type_versions
  where id = (p_request->>'versionId')::uuid
    and content_type_id = (p_request->>'contentTypeId')::uuid
    and owner_id = acting_party_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_request->'migrationPlanId' <> 'null'::jsonb
     and not platform_private.cms_migration_plan_ready(
       (p_request->>'migrationPlanId')::uuid,
       type_version.content_type_id,
       type_version.id
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if type_version.state not in ('draft'::platform_private.cms_definition_state, 'review'::platform_private.cms_definition_state)
     or type_version.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_valid_field_input(field_input, false) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  field_id := nullif(field_input->>'stableFieldId', '')::uuid;
  if field_id is null then
    field_id := extensions.gen_random_uuid();
    if exists (select 1 from platform_private.cms_field_definition_versions where content_type_version_id = type_version.id and field_key = field_input->>'key') then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    insert into platform_private.cms_field_definition_versions(
      id, owner_id, state, version, content_type_version_id, stable_field_id,
      field_key, kind, constraints, validator_key, validator_version, required,
      default_mode, default_value, localization_mode, editor_config, created_by
    ) values (
      field_id, type_version.owner_id, coalesce(nullif(field_input->>'lifecycle', ''), 'active'),
      1, type_version.id, field_id, field_input->>'key', field_input->>'kind',
      coalesce(field_input->'constraints', '{}'::jsonb), nullif(field_input->>'validatorKey', ''),
      nullif(field_input->>'validatorVersion', '')::bigint, coalesce((field_input->>'required')::boolean, false),
      coalesce(nullif(field_input->>'defaultMode', ''), 'none'), field_input->'defaultValue',
      coalesce(nullif(field_input->>'localizationMode', ''), 'none'), coalesce(field_input->'editorConfig', '{}'::jsonb), actor_id
    );
  else
    select * into field_row from platform_private.cms_field_definition_versions
    where content_type_version_id = type_version.id and stable_field_id = field_id for update;
    if not found or field_row.field_key is distinct from field_input->>'key' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if p_request->'migrationPlanId' = 'null'::jsonb
       and (
         field_row.kind is distinct from field_input->>'kind'
         or (not field_row.required and (field_input->>'required')::boolean)
         or field_row.constraints is distinct from field_input->'constraints'
         or field_row.default_mode is distinct from field_input->>'defaultMode'
         or field_row.localization_mode is distinct from field_input->>'localizationMode'
         or field_row.state is distinct from field_input->>'lifecycle'
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    update platform_private.cms_field_definition_versions
    set state = coalesce(nullif(field_input->>'lifecycle', ''), state),
        version = version + 1,
        updated_at = now(),
        kind = field_input->>'kind',
        constraints = coalesce(field_input->'constraints', '{}'::jsonb),
        validator_key = nullif(field_input->>'validatorKey', ''),
        validator_version = nullif(field_input->>'validatorVersion', '')::bigint,
        required = coalesce((field_input->>'required')::boolean, false),
        default_mode = coalesce(nullif(field_input->>'defaultMode', ''), 'none'),
        default_value = field_input->'defaultValue',
        localization_mode = coalesce(nullif(field_input->>'localizationMode', ''), 'none'),
        editor_config = coalesce(field_input->'editorConfig', '{}'::jsonb)
    where id = field_id;
  end if;
  update platform_private.cms_content_type_versions
  set version = version + 1, updated_at = now()
  where id = type_version.id;
  perform platform_private.cms_record_audit(
    'cms.schema.field.change', actor_id, acting_party_id, 'cms_field_definition_version',
    field_id, 'CMS_FIELD_SCHEMA_CHANGED', correlation_id
  );
  select jsonb_build_object(
    'resourceKind', 'field_definition_version', 'id', field.id, 'version', field.version::text,
    'contentHash', encode(extensions.digest(convert_to(field::text, 'utf8'), 'sha256'), 'hex'),
    'createdAt', field.created_at, 'updatedAt', field.updated_at,
    'contentTypeVersionId', field.content_type_version_id, 'stableFieldId', field.stable_field_id,
    'key', field.field_key, 'kind', field.kind, 'required', field.required,
    'validatorKey', field.validator_key, 'validatorVersion', field.validator_version::text,
    'defaultMode', field.default_mode, 'localizationMode', field.localization_mode,
    'lifecycle', field.state, 'migrationPlanId', nullif(p_request->>'migrationPlanId', '')::uuid
  ) into response from platform_private.cms_field_definition_versions field where field.id = field_id;
  perform platform_private.cms_complete(reservation.id, field_id, 201, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_bind_relation(p_request jsonb)
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
  type_version platform_private.cms_content_type_versions%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  relation_id uuid;
  expected_version bigint;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-03:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('resourceKind', 'relation_definition', 'id', (reservation.response_ref->>'resourceRef')::uuid);
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','fieldId','targetKind','targetType','projectionKey','cardinality','min','max','ordered','onUnavailable','expectedVersion']::text[],
    array['contentTypeId','versionId','fieldId','targetKind','targetType','projectionKey','cardinality','min','max','ordered','onUnavailable','expectedVersion','ifMatch','idempotencyKey','context','correlationId']::text[]
  )
     or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or not platform_private.cms_valid_relation_input(
       jsonb_build_object(
         'fieldId', p_request->>'fieldId',
         'targetKind', p_request->>'targetKind',
         'targetType', p_request->>'targetType',
         'projectionKey', p_request->>'projectionKey',
         'cardinality', p_request->>'cardinality',
         'min', p_request->>'min',
         'max', p_request->>'max',
         'ordered', p_request->'ordered',
         'onUnavailable', p_request->>'onUnavailable'
       )
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select * into type_version from platform_private.cms_content_type_versions
  where id = (p_request->>'versionId')::uuid
    and content_type_id = (p_request->>'contentTypeId')::uuid
    and owner_id = acting_party_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if type_version.state not in ('draft'::platform_private.cms_definition_state, 'review'::platform_private.cms_definition_state)
     or type_version.version <> expected_version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  select * into field_row from platform_private.cms_field_definition_versions
  where id = (p_request->>'fieldId')::uuid and content_type_version_id = type_version.id for update;
  if not found or field_row.kind <> 'relation' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
  if (p_request->>'min')::integer > (p_request->>'max')::integer
     or (p_request->>'min')::integer > 128 or (p_request->>'max')::integer > 128
     or (p_request->>'cardinality' = 'one' and ((p_request->>'max')::integer <> 1 or (p_request->>'min')::integer not in (0, 1))) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_relation_definitions(
    owner_id, state, version, field_definition_id, target_kind, target_type,
    projection_key, cardinality, min_count, max_count, ordered, on_unavailable, created_by
  ) values (
    type_version.owner_id, 'draft', 1, field_row.id, p_request->>'targetKind',
    p_request->>'targetType', p_request->>'projectionKey', p_request->>'cardinality',
    (p_request->>'min')::integer, (p_request->>'max')::integer,
    coalesce((p_request->>'ordered')::boolean, false), p_request->>'onUnavailable', actor_id
  ) returning id into relation_id;
  update platform_private.cms_content_type_versions set version = version + 1, updated_at = now()
  where id = type_version.id;
  if not found then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  perform platform_private.cms_record_audit(
    'cms.schema.relation.bind', actor_id, acting_party_id, 'cms_relation_definition',
    relation_id, 'CMS_RELATION_BOUND', correlation_id
  );
  select jsonb_build_object(
    'resourceKind', 'relation_definition', 'id', relation.id, 'version', relation.version::text,
    'contentHash', encode(extensions.digest(convert_to(relation::text, 'utf8'), 'sha256'), 'hex'),
    'createdAt', relation.created_at, 'updatedAt', relation.updated_at,
    'contentTypeVersionId', type_version.id, 'fieldId', relation.field_definition_id,
    'targetKind', relation.target_kind, 'targetType', relation.target_type,
    'projectionKey', relation.projection_key, 'cardinality', relation.cardinality,
    'min', relation.min_count, 'max', relation.max_count, 'ordered', relation.ordered,
    'onUnavailable', relation.on_unavailable
  ) into response from platform_private.cms_relation_definitions relation where relation.id = relation_id;
  perform platform_private.cms_complete(reservation.id, relation_id, 201, response);
  return response;
end;
$function$;


commit;
