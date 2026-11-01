-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085): the CMS-03B-02 conflict resolution response takes its `state` from the
-- ONE derivation instead of a literal.
--
-- "No other code computes or stores a revision state."  The response used to carry
-- the literal 'draft'; it now carries
-- platform_private.cms_revision_effective_state of the revision this command
-- created.  A revision created in the same transaction has no review, schedule or
-- publication evidence, so the derived value is `draft` and the contract is
-- unchanged -- but the value now comes from the helper, so a future workflow stage
-- added to it (the single place E2 names) reaches the write responses with no
-- edit here.  The helper runs after every lock of the command (BE03b global lock
-- order, DEC-157) and is a plain STABLE read, so it takes no lock of its own.
--
-- Nothing else changes: the body below is the 20261005012300 definition
-- with that one projection replaced (CREATE OR REPLACE keeps the owner, the
-- search_path, the grants and the comment of the function).  The physical-state
-- checks of the append commands (the current draft is `draft`) are NOT derived on
-- purpose: BE03b appends a revision to a submitted, approved or scheduled draft and
-- invalidates its live review (revision_superseded), so deriving them would forbid
-- exactly that; after 20261005018090 the physical column is the constant `draft`
-- and those checks hold trivially.  Forward-only.
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
  choice_index integer;
  choice_value jsonb;
  choice_source text;
  overlap boolean;
  parent_ids jsonb;
  relation_field_ids text[];
  empty_relations jsonb;
  base_rel jsonb;
  theirs_rel jsonb;
  yours_rel jsonb;
  proposed_rel jsonb;
  base_all jsonb;
  theirs_all jsonb;
  yours_all jsonb;
  next_all jsonb;
  relation_changed jsonb := '{}'::jsonb;
  relation_key text;
  relation_spec jsonb;
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
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/entryId"]';
  end if;
  if platform_private.cms_valid_uuid(p_request->>'conflictId') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/conflictId"]';
  end if;
  if platform_private.cms_valid_version(p_request->>'baseRevision') is not true
     or pg_catalog.length(p_request->>'baseRevision') > 19
     or (pg_catalog.length(p_request->>'baseRevision') = 19
         and p_request->>'baseRevision' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/baseRevision"]';
  end if;
  if platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expectedVersion"]';
  end if;
  if platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/ifMatch"]';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'choices') is distinct from 'array' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/choices"]';
  end if;
  -- A choice value may itself be eight levels deep. The outer choices array
  -- and choice object add two envelope levels, checked separately from each
  -- explicit value's depth-eight bound below.
  if pg_catalog.jsonb_array_length(p_request->'choices') not between 1 and 128
     or not platform_private.cms_json_bounded(p_request->'choices', 262144, 10, 128, 128) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/choices"]';
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
  perform platform_private.cms_require_entry_capability_locked(
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
      -- Lane I (NOTES): an exact-key replay is marked with the PostgREST response
      -- header the Worker counts; the body is the first response, unchanged.
      perform pg_catalog.set_config(
        'response.headers', '[{"x-cms-idempotent-replay": "true"}]', true
      );
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
  -- BE03b "Entry and revision writes serialize with schema activation": lock the
  -- target version row FOR SHARE before any schema evidence is read or written and
  -- recheck it is still active (the 03a switch takes the conflicting lock).
  perform platform_private.cms_lock_schema_version_shared(version_row.id);
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
  -- DEC-146 (P2-S10-AC-085): the compiled artifact must have frozen exactly the
  -- protected validator descriptors the registry names for this schema; a missing,
  -- extra or stale freeze is a dependency outage and nothing is written.
  if not platform_private.cms_validators_frozen_current(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.validator_key is not null
      and not (platform_private.cms_validator_registry_valid(
                 field.validator_key, field.validator_version)
               or platform_private.cms_protected_validator_ref(
                 field.validator_key, field.validator_version))
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
  -- Relations are normalized rows outside the payload hash.  For the conflict
  -- they are compared in the canonical relation form, where a relation with no
  -- rows equals an empty one, so a relation field is detected, shown and resolved
  -- like any value (P2-S10-AC-074).
  select coalesce(array_agg(field.stable_field_id::text), array[]::text[]),
         coalesce(
           pg_catalog.jsonb_object_agg(field.stable_field_id::text, '{"targets":[]}'::jsonb),
           '{}'::jsonb
         )
    into relation_field_ids, empty_relations
  from platform_private.cms_field_definition_versions field
  where field.content_type_version_id = version_row.id
    and field.kind = 'relation'
    and field.state = 'active';
  base_rel := platform_private.cms_revision_relation_values(base_row.id);
  theirs_rel := platform_private.cms_revision_relation_values(theirs_row.id);
  if conflict_row.yours_source = 'proposed' then
    select coalesce(
             pg_catalog.jsonb_object_agg(
               proposed.key,
               platform_private.cms_relation_value_canonical(proposed.value, entry_row.id)
             ),
             '{}'::jsonb
           )
      into proposed_rel
    from pg_catalog.jsonb_each(conflict_row.proposed_values) proposed(key, value)
    where proposed.key = any(relation_field_ids);
    yours_rel := base_rel || proposed_rel;
  else
    yours_rel := platform_private.cms_revision_relation_values(yours_row.id);
  end if;
  base_all := empty_relations || base_values || base_rel;
  theirs_all := empty_relations || theirs_values || theirs_rel;
  yours_all := empty_relations || yours_values || yours_rel;

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
           or definition.kind = 'relation'
           or not platform_private.cms_authored_value_kind_supported(definition.kind)
           or platform_private.cms_draft_field_value_valid(
             version_row.id, old.field_id, old.value, old.provenance
           ) is not true)
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  -- A record's changed paths are immutable authority, not a caller assertion.
  -- Auto-merge a non-overlapping proposed field; a genuinely divergent field
  -- has no default and must have one explicit user choice.
  next_all := theirs_all;
  for path_input in
    select value from pg_catalog.jsonb_array_elements_text(conflict_row.changed_paths) value
  loop
    if path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256 then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    field_id_text := pg_catalog.substr(path_input, 9);
    overlap := base_all->field_id_text is distinct from theirs_all->field_id_text
      and yours_all->field_id_text is distinct from theirs_all->field_id_text;
    if overlap and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_request->'choices') item(value)
      where item.value->>'path' = path_input
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_array('/fields/' || field_id_text)::text;
    end if;
    if not overlap and base_all->field_id_text is not distinct from
        theirs_all->field_id_text then
      if yours_all ? field_id_text then
        next_all := pg_catalog.jsonb_set(
          next_all, array[field_id_text], yours_all->field_id_text, true
        );
      else
        next_all := next_all - field_id_text;
      end if;
      source_map := source_map || pg_catalog.jsonb_build_object(field_id_text, 'yours');
    end if;
  end loop;

  for choice_item, choice_index in
    select item.value, item.ordinality - 1
    from pg_catalog.jsonb_array_elements(p_request->'choices')
      with ordinality as item(value, ordinality)
  loop
    if pg_catalog.jsonb_typeof(choice_item) is distinct from 'object'
       or not platform_private.cms_exact_keys(
         choice_item, array['path', 'choice']::text[],
         array['path', 'choice', 'value']::text[]
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/choices/' || choice_index::text)::text;
    end if;
    path_input := choice_item->>'path';
    choice_source := choice_item->>'choice';
    if path_input is null or path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256
       or not conflict_row.changed_paths ? path_input
       or choice_source not in ('base', 'theirs', 'yours', 'explicit')
       or (choice_source = 'explicit') is distinct from (choice_item ? 'value') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/choices/' || choice_index::text)::text;
    end if;
    field_id_text := pg_catalog.substr(path_input, 9);
    if source_map ? field_id_text and exists (
      select 1 from pg_catalog.jsonb_array_elements(p_request->'choices') other(value)
      where other.value->>'path' = path_input
      group by other.value->>'path' having count(*) > 1
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/choices/' || choice_index::text)::text;
    end if;
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = field_id_text::uuid
      and field.state = 'active';
    if not found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/choices/' || choice_index::text)::text;
    end if;
    if not platform_private.cms_authored_value_kind_supported(field_row.kind) then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    choice_value := case choice_source
      when 'base' then base_all->field_id_text
      when 'theirs' then theirs_all->field_id_text
      when 'yours' then yours_all->field_id_text
      else choice_item->'value' end;
    if choice_source = 'explicit' then
      if not platform_private.cms_json_bounded(choice_value, 262144, 8, 128, 128) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/choices/' || choice_index::text)::text;
      end if;
      -- Typed reasons (BE03b): an explicit value that fails its field's gate
      -- raises rich_text_not_canonical / object_property_invalid /
      -- object_kind_unspecified or the bare VALIDATION_FAILED.  A relation is
      -- never a JSON null (an empty targets array clears it).
      perform platform_private.cms_require_draft_value_valid(
        version_row.id, field_id_text::uuid, choice_value,
        case when field_row.kind <> 'relation' and choice_value = 'null'::jsonb
          then 'explicit_null' else 'authored' end
      );
      if field_row.kind = 'relation' then
        choice_value := platform_private.cms_relation_value_canonical(
          choice_value, entry_row.id
        );
      end if;
    end if;
    if choice_value is null then
      next_all := next_all - field_id_text;
    else
      next_all := pg_catalog.jsonb_set(
        next_all, array[field_id_text], choice_value, true
      );
    end if;
    source_map := source_map || pg_catalog.jsonb_build_object(field_id_text, choice_source);
  end loop;
  if (select count(distinct item.value->>'path')
      from pg_catalog.jsonb_array_elements(p_request->'choices') item(value))
     <> pg_catalog.jsonb_array_length(p_request->'choices') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/choices"]';
  end if;
  -- The new snapshot's field values exclude every relation (normalized rows
  -- outside the payload hash); a relation field whose resolved value differs from
  -- the current draft is resolved against its RelationDefinition and rewritten,
  -- every other relation is carried from theirs.
  next_values := next_all - relation_field_ids;
  for relation_key in
    select key from pg_catalog.jsonb_object_keys(source_map) key
    where key = any(relation_field_ids)
  loop
    if next_all->relation_key is distinct from theirs_all->relation_key then
      select * into field_row
      from platform_private.cms_field_definition_versions field
      where field.content_type_version_id = version_row.id
        and field.stable_field_id = relation_key::uuid
        and field.state = 'active';
      relation_changed := relation_changed || pg_catalog.jsonb_build_object(
        relation_key,
        platform_private.cms_resolve_relation_targets(
          actor_id, acting_party_id, entry_row.id, requested_entry_version,
          field_row.id, next_all->relation_key
        )
      );
    end if;
  end loop;
  if not platform_private.cms_json_bounded(next_values, 262144, 8, 128, 128)
     or (select count(*) from pg_catalog.jsonb_object_keys(next_values)) > 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/choices"]';
  end if;
  for field_id_text in
    select key from pg_catalog.jsonb_object_keys(next_values) key
  loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = field_id_text::uuid
      and field.state = 'active';
    if not found
       or not platform_private.cms_authored_value_kind_supported(field_row.kind) then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    perform platform_private.cms_require_draft_value_valid(
      version_row.id, field_id_text::uuid, next_values->field_id_text,
      case when next_values->field_id_text = 'null'::jsonb
        then 'explicit_null' else 'authored' end
    );
    -- BE03b: the resolved snapshot may not carry a well-formed NON-EMPTY
    -- taxonomy or media value either; it fails closed with its typed reason and
    -- the conflict stays open.
    perform platform_private.cms_require_value_source_available(
      version_row.id, field_id_text::uuid, next_values->field_id_text
    );
  end loop;

  -- Preserve normalized relations from the current parent; a relation this
  -- resolution rewrites was resolved above and is written fresh below.
  -- Codex review H3: the external content targets of the relations this
  -- resolution carries from the current draft are locked FOR SHARE (ascending id,
  -- held to commit) before the guards below re-check them; the relations it
  -- rewrites were locked by cms_resolve_relation_targets.
  perform platform_private.cms_lock_entry_rows_shared(array(
    select relation.target_id
    from platform_private.cms_entry_relations relation
    where relation.revision_id = theirs_row.id
      and not (relation_changed ? relation.field_id::text)
      and relation.target_kind = 'content'
      and relation.target_id <> entry_row.id
  ));
  if exists (
    select 1 from platform_private.cms_entry_relations relation
    left join platform_private.cms_relation_definitions definition
      on definition.field_definition_id = relation.field_definition_id
    where relation.revision_id = theirs_row.id
      and not (relation_changed ? relation.field_id::text)
      and (definition.id is null
        or definition.target_kind <> relation.target_kind
        or definition.on_unavailable <> relation.on_unavailable)
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
  if exists (
    select 1 from platform_private.cms_entry_relations relation
    left join platform_private.cms_content_entries target
      on relation.target_kind = 'content' and target.id = relation.target_id
    where relation.revision_id = theirs_row.id
      and not (relation_changed ? relation.field_id::text)
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
  where old.revision_id = theirs_row.id
    and not (relation_changed ? old.field_id::text);
  for relation_key in
    select key from pg_catalog.jsonb_object_keys(relation_changed) key
  loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = relation_key::uuid;
    for relation_spec in
      select spec.value
      from pg_catalog.jsonb_array_elements(relation_changed->relation_key) spec(value)
    loop
      insert into platform_private.cms_entry_relations(
        owner_id, state, version, revision_id, field_id, field_definition_id,
        target_kind, target_id, expected_target_version, position, on_unavailable,
        created_at, updated_at
      ) values (
        entry_row.owner_id, 'active', 1, new_revision_id, relation_key::uuid,
        field_row.id, relation_spec->>'targetKind', (relation_spec->>'targetId')::uuid,
        (relation_spec->>'expectedTargetVersion')::bigint,
        (relation_spec->>'position')::integer, relation_spec->>'onUnavailable',
        snapshot_time, snapshot_time
      );
    end loop;
  end loop;

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
    'state', platform_private.cms_revision_effective_state(new_revision_id),
    'entryId', entry_row.id,
    'revisionNumber', (theirs_row.revision_number + 1)::text,
    'schemaVersionId', version_row.id,
    'templateVersionId', theirs_row.template_version_id,
    'taxonomyVersionIds', theirs_row.taxonomy_version_ids,
    'locale', theirs_row.locale,
    'contentHash', platform_private.cms_jcs_sha256(next_values),
    'parentRevisionIds', parent_ids,
    'validationState', 'valid', 'conflictId', conflict_row.id,
    -- DEC-145 (lane G): the committed entry aggregate version (the next If-Match).
    'entryVersion', (requested_entry_version + 1)::text
  );
  perform platform_private.cms_complete(reservation.id, new_revision_id, 201, response);
  return response;
end;
$body$;

commit;
