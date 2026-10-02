-- CMS-03B-02 calendar conflict resolution. Forward-only replacement of the
-- private resolver: active date and datetime definitions use the same complete
-- schema-backed value validation as revision creation. No old conflict or
-- immutable revision is rewritten.
begin;

create or replace function platform_private.cms_resolve_conflict(p_request jsonb)
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
  conflict_row platform_private.cms_conflict_records%rowtype;
  base_row platform_private.cms_entry_revisions%rowtype;
  theirs_row platform_private.cms_entry_revisions%rowtype;
  yours_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  source_field platform_private.cms_entry_field_values%rowtype;
  requested_entry_id uuid;
  requested_conflict_id uuid;
  requested_entry_version bigint;
  requested_base_number bigint;
  active_version_count integer;
  new_revision_id uuid := extensions.gen_random_uuid();
  snapshot_time timestamptz := pg_catalog.now();
  base_values jsonb;
  theirs_values jsonb;
  yours_values jsonb;
  next_values jsonb;
  source_map jsonb := '{}'::jsonb;
  selected_source text;
  selected_value jsonb;
  path_input text;
  field_id_text text;
  choice_item jsonb;
  choice_value jsonb;
  choice_source text;
  overlap boolean;
  parent_ids jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  if not platform_private.cms_exact_keys(
    p_request,
    array[
      'entryId', 'conflictId', 'baseRevision', 'choices',
      'expectedVersion', 'ifMatch', 'idempotencyKey'
    ]::text[],
    array[
      'entryId', 'conflictId', 'baseRevision', 'choices',
      'expectedVersion', 'ifMatch', 'idempotencyKey', 'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or platform_private.cms_valid_uuid(p_request->>'conflictId') is not true
     or platform_private.cms_valid_version(p_request->>'baseRevision') is not true
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'baseRevision') > 19
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'baseRevision') = 19
       and p_request->>'baseRevision' > '9223372036854775807')
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
       and p_request->>'expectedVersion' > '9223372036854775807')
     or (pg_catalog.length(p_request->>'ifMatch') = 19
       and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'choices') is distinct from 'array' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- A choice value may itself be eight levels deep. The outer choices array
  -- and choice object add two envelope levels, checked separately from each
  -- explicit value's depth-eight bound below.
  if pg_catalog.jsonb_array_length(p_request->'choices') not between 1 and 128
     or not platform_private.cms_json_bounded(p_request->'choices', 262144, 10, 128, 128) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_conflict_id := (p_request->>'conflictId')::uuid;
  requested_entry_version := (p_request->>'expectedVersion')::bigint;
  requested_base_number := (p_request->>'baseRevision')::bigint;

  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = requested_entry_id
  for update;
  if not found or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id)
     or entry_row.owner_party_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_entry_capability(
    actor_id, acting_party_id, array['cms.author', 'cms.editor']::text[], entry_row.id
  );
  if entry_row.lifecycle <> 'active' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  -- The conflict is loaded by its opaque id only after entry visibility and
  -- assignment. A missing or foreign conflict is concealed as NOT_FOUND.
  select * into conflict_row
  from platform_private.cms_conflict_records candidate
  where candidate.id = requested_conflict_id
    and candidate.entry_id = entry_row.id
    and candidate.owner_id = entry_row.owner_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-02');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if conflict_row.state <> 'open' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if entry_row.version <> requested_entry_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  select * into base_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = conflict_row.base_revision_id
    and candidate.entry_id = entry_row.id
  for share;
  if not found or base_row.revision_number <> requested_base_number then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  select * into theirs_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = conflict_row.theirs_revision_id
    and candidate.entry_id = entry_row.id
  for share;
  if not found or theirs_row.id is distinct from entry_row.current_draft_revision_id
     or theirs_row.state <> 'draft'
     or theirs_row.locale is distinct from base_row.locale then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  if conflict_row.yours_source = 'revision' then
    select * into yours_row
    from platform_private.cms_entry_revisions candidate
    where candidate.id = conflict_row.yours_revision_id
      and candidate.entry_id = entry_row.id
    for share;
    if not found or yours_row.locale is distinct from base_row.locale
       or yours_row.schema_version_id is distinct from base_row.schema_version_id then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  elsif conflict_row.yours_source <> 'proposed' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if base_row.id = theirs_row.id
     or (conflict_row.yours_source = 'revision'
       and yours_row.id in (base_row.id, theirs_row.id))
     or base_row.owner_id is distinct from entry_row.owner_id
     or theirs_row.owner_id is distinct from entry_row.owner_id
     or (conflict_row.yours_source = 'revision'
       and yours_row.owner_id is distinct from entry_row.owner_id) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select count(*) into active_version_count
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  if active_version_count <> 1 then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  if version_row.id is distinct from base_row.schema_version_id
     or version_row.id is distinct from theirs_row.schema_version_id
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
       is null
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
       = 'null'::jsonb
     or not platform_private.cms_resolution_policy_complete(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into artifact_row
  from platform_private.cms_schema_artifacts candidate
  where candidate.id = version_row.schema_artifact_id
    and candidate.content_type_version_id = version_row.id
    and candidate.state::text = 'compiled';
  if not found or artifact_row.artifact_hash is distinct from version_row.definition_hash
     or artifact_row.compiler_version is null
     or artifact_row.zod_contract_ref is null then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.validator_key is not null
      and not platform_private.cms_validator_registry_valid(
        field.validator_key, field.validator_version
      )
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into base_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = base_row.id and field.locale = base_row.locale;
  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into theirs_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = theirs_row.id and field.locale = theirs_row.locale;
  if platform_private.cms_jcs_sha256(base_values) <> base_row.payload_hash::text
     or platform_private.cms_jcs_sha256(theirs_values) <> theirs_row.payload_hash::text
     or conflict_row.base_hash is distinct from base_row.payload_hash
     or conflict_row.theirs_hash is distinct from theirs_row.payload_hash then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if conflict_row.yours_source = 'proposed' then
    if not platform_private.cms_json_bounded(
      conflict_row.proposed_values, 262144, 8, 128, 128
    ) or conflict_row.proposed_values_hash::text is distinct from
      platform_private.cms_jcs_sha256(conflict_row.proposed_values)
    then raise exception 'INTERNAL_ERROR' using errcode = 'P0001'; end if;
    yours_values := base_values || conflict_row.proposed_values;
  else
    select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
      into yours_values
    from platform_private.cms_entry_field_values field
    where field.revision_id = yours_row.id and field.locale = yours_row.locale;
    if platform_private.cms_jcs_sha256(yours_values) <> yours_row.payload_hash::text
       or conflict_row.yours_hash is distinct from yours_row.payload_hash then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  end if;
  if platform_private.cms_jcs_sha256(yours_values) <> conflict_row.yours_hash::text
     or pg_catalog.jsonb_typeof(conflict_row.changed_paths) is distinct from 'array'
     or pg_catalog.jsonb_array_length(conflict_row.changed_paths) not between 1 and 128 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from platform_private.cms_entry_field_values old
    left join platform_private.cms_field_definition_versions definition
      on definition.id = old.field_definition_id
     and definition.content_type_version_id = version_row.id
     and definition.stable_field_id = old.field_id
    where old.revision_id in (base_row.id, theirs_row.id, yours_row.id)
      and (definition.id is null
           or definition.state <> 'active'
           or definition.kind not in (
             'short_text', 'long_text', 'boolean', 'integer', 'decimal', 'date', 'datetime'
           )
           or platform_private.cms_draft_field_value_valid(
             version_row.id, old.field_id, old.value, old.provenance
           ) is not true)
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  -- A record's changed paths are immutable authority, not a caller assertion.
  -- Auto-merge a non-overlapping proposed field; a genuinely divergent field
  -- has no default and must have one explicit user choice.
  next_values := theirs_values;
  for path_input in
    select value from pg_catalog.jsonb_array_elements_text(conflict_row.changed_paths) value
  loop
    if path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256 then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    field_id_text := pg_catalog.substr(path_input, 9);
    overlap := base_values->field_id_text is distinct from theirs_values->field_id_text
      and yours_values->field_id_text is distinct from theirs_values->field_id_text;
    if overlap and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_request->'choices') item(value)
      where item.value->>'path' = path_input
    ) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
    if not overlap and base_values->field_id_text is not distinct from
        theirs_values->field_id_text then
      if yours_values ? field_id_text then
        next_values := pg_catalog.jsonb_set(
          next_values, array[field_id_text], yours_values->field_id_text, true
        );
      else
        next_values := next_values - field_id_text;
      end if;
      source_map := source_map || pg_catalog.jsonb_build_object(field_id_text, 'yours');
    end if;
  end loop;

  for choice_item in
    select value from pg_catalog.jsonb_array_elements(p_request->'choices') value
  loop
    if pg_catalog.jsonb_typeof(choice_item) is distinct from 'object'
       or not platform_private.cms_exact_keys(
         choice_item, array['path', 'choice']::text[],
         array['path', 'choice', 'value']::text[]
       ) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
    path_input := choice_item->>'path';
    choice_source := choice_item->>'choice';
    if path_input is null or path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256
       or not conflict_row.changed_paths ? path_input
       or choice_source not in ('base', 'theirs', 'yours', 'explicit')
       or (choice_source = 'explicit') is distinct from (choice_item ? 'value') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    field_id_text := pg_catalog.substr(path_input, 9);
    if source_map ? field_id_text and exists (
      select 1 from pg_catalog.jsonb_array_elements(p_request->'choices') other(value)
      where other.value->>'path' = path_input
      group by other.value->>'path' having count(*) > 1
    ) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = field_id_text::uuid
      and field.state = 'active';
    if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
    if field_row.kind not in (
      'short_text', 'long_text', 'boolean', 'integer', 'decimal', 'date', 'datetime'
    ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
    choice_value := case choice_source
      when 'base' then base_values->field_id_text
      when 'theirs' then theirs_values->field_id_text
      when 'yours' then yours_values->field_id_text
      else choice_item->'value' end;
    if choice_source = 'explicit' and (
      not platform_private.cms_json_bounded(choice_value, 262144, 8, 128, 128)
      or platform_private.cms_draft_field_value_valid(
        version_row.id, field_id_text::uuid, choice_value,
        case when choice_value = 'null'::jsonb then 'explicit_null' else 'authored' end
      ) is not true
    ) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
    if choice_value is null then
      next_values := next_values - field_id_text;
    else
      next_values := pg_catalog.jsonb_set(
        next_values, array[field_id_text], choice_value, true
      );
    end if;
    source_map := source_map || pg_catalog.jsonb_build_object(field_id_text, choice_source);
  end loop;
  if (select count(distinct item.value->>'path')
      from pg_catalog.jsonb_array_elements(p_request->'choices') item(value))
     <> pg_catalog.jsonb_array_length(p_request->'choices') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not platform_private.cms_json_bounded(next_values, 262144, 8, 128, 128)
     or (select count(*) from pg_catalog.jsonb_object_keys(next_values)) > 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  for field_id_text in
    select key from pg_catalog.jsonb_object_keys(next_values) key
  loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = field_id_text::uuid
      and field.state = 'active';
    if not found or field_row.kind not in (
      'short_text', 'long_text', 'boolean', 'integer', 'decimal', 'date', 'datetime'
    ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
    if platform_private.cms_draft_field_value_valid(
      version_row.id, field_id_text::uuid, next_values->field_id_text,
      case when next_values->field_id_text = 'null'::jsonb
        then 'explicit_null' else 'authored' end
    ) is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  -- Preserve normalized relations from the current parent; changed relation
  -- paths remain fenced until their active target-value encoding is approved.
  if exists (
    select 1 from platform_private.cms_entry_relations relation
    left join platform_private.cms_relation_definitions definition
      on definition.field_definition_id = relation.field_definition_id
    where relation.revision_id = theirs_row.id
      and (definition.id is null
        or definition.target_kind <> relation.target_kind
        or definition.on_unavailable <> relation.on_unavailable)
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
  if exists (
    select 1 from platform_private.cms_entry_relations relation
    left join platform_private.cms_content_entries target
      on relation.target_kind = 'content' and target.id = relation.target_id
    where relation.revision_id = theirs_row.id
      and (relation.target_kind <> 'content'
        or target.id is null
        or target.owner_party_id is distinct from entry_row.owner_party_id
        or target.lifecycle <> 'active'
        or (relation.expected_target_version is not null
          and target.id <> entry_row.id
          and target.version <> relation.expected_target_version))
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  parent_ids := case when conflict_row.yours_source = 'revision'
    then pg_catalog.jsonb_build_array(theirs_row.id, yours_row.id)
    else pg_catalog.jsonb_build_array(theirs_row.id, base_row.id) end;
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    new_revision_id, entry_row.owner_id, entry_row.id,
    theirs_row.revision_number + 1, version_row.id,
    theirs_row.template_version_id, theirs_row.taxonomy_version_ids,
    parent_ids, theirs_row.locale,
    platform_private.cms_jcs_sha256(next_values)::char(64),
    author_person_id, acting_party_id, 'draft', 1,
    'valid', '{}'::jsonb, snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, old.field_id,
    old.field_definition_id, old.locale, old.value, old.provenance,
    old.value_hash, snapshot_time, snapshot_time
  from platform_private.cms_entry_field_values old
  where old.revision_id = theirs_row.id
    and old.locale = theirs_row.locale
    and not (source_map ? old.field_id::text);
  for field_id_text in
    select key from pg_catalog.jsonb_object_keys(source_map) key
  loop
    if not (next_values ? field_id_text) then continue; end if;
    selected_source := source_map->>field_id_text;
    selected_value := next_values->field_id_text;
    source_field := null;
    if selected_source in ('base', 'theirs')
       or (selected_source = 'yours' and conflict_row.yours_source = 'revision') then
      select * into source_field
      from platform_private.cms_entry_field_values field
      where field.revision_id = case selected_source
        when 'base' then base_row.id
        when 'theirs' then theirs_row.id
        else yours_row.id end
        and field.locale = theirs_row.locale
        and field.field_id = field_id_text::uuid;
      if not found or source_field.value is distinct from selected_value then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;
    end if;
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = field_id_text::uuid;
    insert into platform_private.cms_entry_field_values(
      owner_id, state, version, revision_id, field_id, field_definition_id,
      locale, value, provenance, value_hash, created_at, updated_at
    ) values (
      entry_row.owner_id, 'active', 1, new_revision_id, field_id_text::uuid,
      field_row.id, theirs_row.locale, selected_value,
      case when source_field.id is not null then source_field.provenance
        when selected_value = 'null'::jsonb then 'explicit_null' else 'authored' end,
      case when selected_value = 'null'::jsonb then null
        else platform_private.cms_jcs_sha256(selected_value)::char(64) end,
      snapshot_time, snapshot_time
    );
  end loop;
  insert into platform_private.cms_entry_relations(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    target_kind, target_id, expected_target_version, position, on_unavailable,
    created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, old.field_id,
    old.field_definition_id, old.target_kind, old.target_id,
    case when old.target_kind = 'content' and old.target_id = entry_row.id
      then requested_entry_version + 1 else old.expected_target_version end,
    old.position, old.on_unavailable, snapshot_time, snapshot_time
  from platform_private.cms_entry_relations old
  where old.revision_id = theirs_row.id;

  update platform_private.cms_content_entries
  set current_draft_revision_id = new_revision_id,
      version = version + 1,
      updated_at = snapshot_time
  where id = entry_row.id and version = requested_entry_version;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;
  update platform_private.cms_conflict_records
  set state = 'resolved', version = version + 1,
      resolved_revision_id = new_revision_id,
      resolved_by_person_id = author_person_id,
      resolved_acting_party_id = acting_party_id,
      resolved_at = snapshot_time,
      updated_at = snapshot_time
  where id = conflict_row.id and state = 'open' and version = conflict_row.version;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;

  perform platform_private.cms_emit_event(
    'cms.entry.conflict.resolve', actor_id, acting_party_id,
    'cms_content_entry', entry_row.id, 'CMS_ENTRY_CONFLICT_RESOLVED',
    'cms.entry.revision-created.v1', 'cms_content_entry', entry_row.id,
    requested_entry_version + 1,
    pg_catalog.jsonb_build_object('entryId', entry_row.id, 'revisionId', new_revision_id),
    correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'id', new_revision_id, 'version', '1',
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', 'draft', 'entryId', entry_row.id,
    'revisionNumber', (theirs_row.revision_number + 1)::text,
    'schemaVersionId', version_row.id,
    'templateVersionId', theirs_row.template_version_id,
    'taxonomyVersionIds', theirs_row.taxonomy_version_ids,
    'locale', theirs_row.locale,
    'contentHash', platform_private.cms_jcs_sha256(next_values),
    'parentRevisionIds', parent_ids,
    'validationState', 'valid', 'conflictId', conflict_row.id
  );
  perform platform_private.cms_complete(reservation.id, new_revision_id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_resolve_conflict(jsonb) is
  'CMS-03B-02 authorized explicit conflict choice with active primitive and calendar-field validation, immutable two-parent draft, entry and conflict CAS, exact-key replay, and atomic audit/outbox. Other unsupported field kinds remain unavailable.';

revoke all on function platform_private.cms_resolve_conflict(jsonb)
  from public, anon, authenticated, service_role;

commit;
