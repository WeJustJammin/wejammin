-- Slice 09 (re-audit AC077/AC080/AC083/AC195): CMS-03A-03 relation input.
--  * cms_valid_relation_input evaluated `NULL !~ regex` and `NULL NOT IN (...)` to
--    NULL for a JSON null min, max, targetKind, targetType, projectionKey,
--    cardinality or onUnavailable, so validation passed and the NOT NULL column
--    constraint leaked a raw 23502.  Every member is now null-safe: a null or absent
--    value is outside the closed grammar and refused with the typed 422.
--  * cms_bind_relation refuses a second relation for one field with a typed 409
--    CONFLICT (BE03a: "CONFLICT for stale version/duplicate relation") instead of the
--    raw unique-violation of cms_relation_definitions_field_unique.
-- Bodies are otherwise identical to the previous definitions (regenerated from the
-- live functions); grants are unchanged.  Forward-only.
begin;

create or replace function platform_private.cms_valid_relation_input(p_value jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  min_count integer;
  max_count integer;
begin
  if not platform_private.cms_exact_keys(
    p_value,
    array['fieldId','targetKind','targetType','projectionKey','cardinality','min','max','ordered','onUnavailable']::text[],
    array['fieldId','targetKind','targetType','projectionKey','cardinality','min','max','ordered','onUnavailable']::text[]
  ) or not platform_private.cms_valid_uuid(p_value->>'fieldId')
    or coalesce(p_value->>'targetKind', '') not in ('content','domain')
    or coalesce(p_value->>'targetType', '') !~ '^[a-z][a-z0-9._-]{0,95}$'
    or coalesce(p_value->>'projectionKey', '') !~ '^[a-z][a-z0-9._-]{0,127}$'
    or not platform_private.cms_projection_registry_valid(
      p_value->>'targetKind', p_value->>'targetType', p_value->>'projectionKey'
    )
    or coalesce(p_value->>'cardinality', '') not in ('one','many')
    or coalesce(p_value->>'min', '') !~ '^[0-9]+$'
    or coalesce(p_value->>'max', '') !~ '^[1-9][0-9]*$'
    or pg_catalog.jsonb_typeof(p_value->'ordered') is distinct from 'boolean'
    or coalesce(p_value->>'onUnavailable', '') not in ('omit','block','placeholder') then
    return false;
  end if;
  min_count := (p_value->>'min')::integer;
  max_count := (p_value->>'max')::integer;
  return min_count between 0 and 128
    and max_count between 1 and 128
    and min_count <= max_count
    and (
      (p_value->>'cardinality' = 'one' and max_count = 1 and min_count in (0,1))
      or p_value->>'cardinality' = 'many'
    );
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$function$;

create or replace function platform_private.cms_bind_relation(p_request jsonb)
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
  if type_version.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, type_version.version);
  end if;
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
  -- A field carries at most one relation definition: a second bind is the typed
  -- duplicate-relation refusal, never a raw unique-violation leak.
  if exists (select 1 from platform_private.cms_relation_definitions existing
              where existing.field_definition_id = field_row.id) then
    raise exception 'CONFLICT' using errcode = 'P0001';
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
