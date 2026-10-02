-- CMS-03C-04: an assigned editor authors an immutable target-locale revision.
-- Forward-only: previously emitted revisions, audit, and outbox evidence must
-- never be erased by a rollback. A correction requires another reviewed migration.
begin;

create or replace function platform_private.cms_author_locale_variant(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  author_person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  entry_row platform_private.cms_content_entries%rowtype;
  source_row platform_private.cms_entry_revisions%rowtype;
  previous_row platform_private.cms_locale_variants%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  field_item jsonb;
  fallback_item text;
  no_fallback_item text;
  values_by_field jsonb := '{}'::jsonb;
  field_id uuid;
  value_input jsonb;
  requested_entry_id uuid;
  requested_source_id uuid;
  requested_version bigint;
  target_locale text;
  source_hash text;
  next_variant_version bigint;
  next_revision_number bigint;
  new_revision_id uuid := extensions.gen_random_uuid();
  new_variant_id uuid := extensions.gen_random_uuid();
  parent_ids jsonb;
  payload_hash text;
  snapshot_time timestamptz := pg_catalog.now();
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId','locale','sourceRevisionId','fields','fallbackChain',
          'noFallbackFieldIds','sourceHash','expectedVersion','ifMatch',
          'idempotencyKey']::text[],
    array['entryId','locale','sourceRevisionId','fields','fallbackChain',
          'noFallbackFieldIds','sourceHash','expectedVersion','ifMatch',
          'idempotencyKey','context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or platform_private.cms_valid_uuid(p_request->>'sourceRevisionId') is not true
     or coalesce(p_request->>'locale','') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
     or coalesce(p_request->>'sourceHash','') !~ '^[a-f0-9]{64}$'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807')
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->>'ifMatch' <> p_request->>'expectedVersion' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if platform_private.cms_json_bounded(p_request, 262144, 8, 128, 128) is not true
     or pg_catalog.jsonb_typeof(p_request->'fields') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_request->'fallbackChain') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_request->'noFallbackFieldIds') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'fields') not between 1 and 128
     or pg_catalog.jsonb_array_length(p_request->'fallbackChain') > 16
     or pg_catalog.jsonb_array_length(p_request->'noFallbackFieldIds') > 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_source_id := (p_request->>'sourceRevisionId')::uuid;
  requested_version := (p_request->>'expectedVersion')::bigint;
  target_locale := p_request->>'locale';
  source_hash := p_request->>'sourceHash';

  select * into entry_row from platform_private.cms_content_entries entry
  where entry.id = requested_entry_id for update;
  if not found or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id)
     or entry_row.owner_party_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_entry_capability(
    actor_id, acting_party_id, array['cms.author','cms.editor']::text[], entry_row.id
  );
  if entry_row.lifecycle <> 'active' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03C-04');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if entry_row.version <> requested_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  select * into source_row from platform_private.cms_entry_revisions revision
  where revision.id = requested_source_id and revision.entry_id = entry_row.id
  for share;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if pg_catalog.lower(source_row.locale) = pg_catalog.lower(target_locale)
     or source_row.payload_hash::text <> source_hash
     or exists (
       select 1 from platform_private.cms_entry_revisions newer
       where newer.entry_id = entry_row.id
         and pg_catalog.lower(newer.locale) = pg_catalog.lower(source_row.locale)
         and newer.revision_number > source_row.revision_number
     ) then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  if platform_private.cms_jcs_sha256(
    (select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
     from platform_private.cms_entry_field_values field
     where field.revision_id = source_row.id and field.locale = source_row.locale)
  ) <> source_hash then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into version_row from platform_private.cms_content_type_versions version
  where version.id = source_row.schema_version_id
    and version.content_type_id = entry_row.content_type_id
    and version.state::text = 'active';
  if not found or not exists (
    select 1 from platform_private.cms_schema_artifacts artifact
    where artifact.id = version_row.schema_artifact_id
      and artifact.content_type_version_id = version_row.id
      and artifact.state::text = 'compiled'
      and artifact.artifact_hash = version_row.definition_hash
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  for fallback_item in
    select item.value from pg_catalog.jsonb_array_elements_text(p_request->'fallbackChain') item(value)
  loop
    if fallback_item !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
       or pg_catalog.lower(fallback_item) = pg_catalog.lower(target_locale) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;
  if (select count(*) <> count(distinct pg_catalog.lower(item.value))
      from pg_catalog.jsonb_array_elements_text(p_request->'fallbackChain') item(value)) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  for no_fallback_item in
    select item.value from pg_catalog.jsonb_array_elements_text(p_request->'noFallbackFieldIds') item(value)
  loop
    if platform_private.cms_valid_uuid(no_fallback_item) is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from platform_private.cms_field_definition_versions definition
      where definition.content_type_version_id = version_row.id
        and definition.stable_field_id = no_fallback_item::uuid
        and definition.state = 'active'
        and definition.localization_mode in ('localized','no_fallback')
    ) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
  end loop;
  if (select count(*) <> count(distinct pg_catalog.lower(item.value))
      from pg_catalog.jsonb_array_elements_text(p_request->'noFallbackFieldIds') item(value))
     or exists (
       select 1 from platform_private.cms_field_definition_versions definition
       where definition.content_type_version_id = version_row.id
         and definition.state = 'active'
         and definition.localization_mode = 'no_fallback'
         and not (p_request->'noFallbackFieldIds' ? definition.stable_field_id::text)
     ) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;

  for field_item in
    select item.value from pg_catalog.jsonb_array_elements(p_request->'fields') item(value)
  loop
    if platform_private.cms_exact_keys(
         field_item, array['fieldId','value']::text[],
         array['fieldId','value']::text[]
       ) is not true
       or platform_private.cms_valid_uuid(field_item->>'fieldId') is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    field_id := (field_item->>'fieldId')::uuid;
    if values_by_field ? field_id::text then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select * into field_row from platform_private.cms_field_definition_versions definition
    where definition.content_type_version_id = version_row.id
      and definition.stable_field_id = field_id
      and definition.state = 'active';
    if not found or field_row.localization_mode not in ('localized','no_fallback') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    -- Complex field kinds require their registered validator and projection
    -- adapter. The scalar validator is the only complete authority today.
    if field_row.kind not in ('short_text','long_text','boolean','integer','decimal') then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    value_input := field_item->'value';
    if platform_private.cms_draft_field_value_valid(
         version_row.id, field_id, value_input,
         case when value_input = 'null'::jsonb then 'explicit_null' else 'authored' end
       ) is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    values_by_field := values_by_field || pg_catalog.jsonb_build_object(field_id::text, value_input);
  end loop;

  select * into previous_row from platform_private.cms_locale_variants variant
  where variant.entry_id = entry_row.id
    and pg_catalog.lower(variant.locale) = pg_catalog.lower(target_locale)
  order by variant.version desc, variant.created_at desc, variant.id desc
  limit 1;
  select coalesce(pg_catalog.max(variant.version), 0) + 1 into next_variant_version
  from platform_private.cms_locale_variants variant
  where variant.entry_id = entry_row.id
    and pg_catalog.lower(variant.locale) = pg_catalog.lower(target_locale);
  select coalesce(pg_catalog.max(revision.revision_number), 0) + 1 into next_revision_number
  from platform_private.cms_entry_revisions revision
  where revision.entry_id = entry_row.id
    and pg_catalog.lower(revision.locale) = pg_catalog.lower(target_locale);
  parent_ids := case when previous_row.id is null
    then pg_catalog.jsonb_build_array(source_row.id)
    else pg_catalog.jsonb_build_array(previous_row.revision_id, source_row.id) end;
  payload_hash := platform_private.cms_jcs_sha256(values_by_field);

  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    new_revision_id, entry_row.owner_id, entry_row.id, next_revision_number,
    version_row.id, source_row.template_version_id, source_row.taxonomy_version_ids,
    parent_ids, target_locale, payload_hash::char(64), author_person_id,
    acting_party_id, 'draft', 1, 'unknown', '{}'::jsonb,
    snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id,
         (item.key)::uuid, definition.id, target_locale, item.value,
         case when item.value = 'null'::jsonb then 'explicit_null' else 'authored' end,
         case when item.value = 'null'::jsonb then null
           else platform_private.cms_jcs_sha256(item.value)::char(64) end,
         snapshot_time, snapshot_time
  from pg_catalog.jsonb_each(values_by_field) item(key, value)
  join platform_private.cms_field_definition_versions definition
    on definition.content_type_version_id = version_row.id
   and definition.stable_field_id = (item.key)::uuid;
  insert into platform_private.cms_locale_variants(
    id, owner_id, state, version, created_at, updated_at,
    entry_id, revision_id, source_revision_id, locale, source_locale,
    source_hash, fallback_chain, no_fallback_field_ids, created_by
  ) values (
    new_variant_id, entry_row.owner_id, 'draft', next_variant_version,
    snapshot_time, snapshot_time, entry_row.id, new_revision_id, source_row.id,
    target_locale, source_row.locale, source_hash::char(64),
    p_request->'fallbackChain', p_request->'noFallbackFieldIds', actor_id
  );
  update platform_private.cms_content_entries
  set version = version + 1, updated_at = snapshot_time
  where id = entry_row.id and version = requested_version;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;

  perform platform_private.cms_emit_event(
    'cms.locale.variant.author', actor_id, acting_party_id,
    'cms_locale_variant', new_variant_id, 'CMS_LOCALE_VARIANT_AUTHORED',
    'cms.localization.changed.v1', 'cms_content_entry', entry_row.id,
    requested_version + 1,
    pg_catalog.jsonb_build_object(
      'entryId', entry_row.id, 'locale', target_locale, 'revisionId', new_revision_id
    ), correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'id', new_variant_id, 'version', next_variant_version::text,
    'contentHash', payload_hash,
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', 'draft', 'entryId', entry_row.id,
    'revisionId', new_revision_id, 'locale', target_locale,
    'sourceRevisionId', source_row.id,
    'fallbackChain', p_request->'fallbackChain',
    'noFallbackFieldIds', p_request->'noFallbackFieldIds'
  );
  perform platform_private.cms_complete(reservation.id, new_variant_id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_author_locale_variant(jsonb) is
  'CMS-03C-04 assigned-author append of an immutable target-locale revision and variant, source hash and aggregate CAS, active 03a field-localization checks, server-enforced no_fallback, idempotency, audit and outbox. Unsupported complex field kinds fail closed.';

create or replace function platform_api.cms_author_locale_variant(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_author_locale_variant(p_request)
$body$;

revoke all on function platform_private.cms_author_locale_variant(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_author_locale_variant(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_author_locale_variant(jsonb) to service_role;

commit;
