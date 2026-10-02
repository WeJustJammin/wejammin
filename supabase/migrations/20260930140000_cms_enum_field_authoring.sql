-- CMS-05/06: admit only registry-bounded enum choices across initial create,
-- protected draft read, immutable revision append, and explicit conflict
-- resolution. Keep richer field kinds fail-closed until their validators exist.
-- This migration only replaces private functions; no policy or choice values
-- are synthesized, and existing direct grants remain closed.
begin;

create or replace function platform_private.cms_draft_field_value_valid(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_provenance text
)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  field_row platform_private.cms_field_definition_versions%rowtype;
  value_type text;
  numeric_value numeric;
begin
  select * into field_row
  from platform_private.cms_field_definition_versions field
  where field.stable_field_id = p_field_id
    and field.content_type_version_id = p_schema_version_id;
  if not found then
    return false;
  end if;

  -- Enum values must come from a nonempty immutable 03a choice set. An enum
  -- definition without one cannot be treated as arbitrary free-form text.
  if field_row.kind = 'enum' then
    if pg_catalog.jsonb_typeof(field_row.constraints->'enumValues')
         is distinct from 'array' then
      return false;
    end if;
    if pg_catalog.jsonb_array_length(field_row.constraints->'enumValues')
         not between 1 and 256 then
      return false;
    end if;
  end if;

  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then
    return p_provenance in ('explicit_null', 'missing');
  end if;

  value_type := pg_catalog.jsonb_typeof(p_value);
  -- BE03b permits only an approved structured AST. No executable rich-text
  -- validator is registered yet; admitting a scalar or arbitrary JSON would
  -- make the protected write and read boundaries claim false schema proof.
  if field_row.kind = 'rich_text' then
    return false;
  end if;
  if field_row.kind in ('short_text', 'long_text', 'enum', 'taxonomy')
     and value_type <> 'string' then
    return false;
  end if;
  if field_row.kind = 'boolean' and value_type <> 'boolean' then
    return false;
  end if;
  if field_row.kind = 'integer'
     and (value_type <> 'number' or (p_value::text) !~ '^-?[0-9]+$') then
    return false;
  end if;
  if field_row.kind = 'decimal' and value_type <> 'number' then
    return false;
  end if;
  if field_row.kind = 'date' then
    if value_type <> 'string'
       or (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      return false;
    end if;
    begin
      perform (p_value #>> '{}')::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        return false;
    end;
  end if;
  if field_row.kind = 'datetime' then
    if value_type <> 'string'
       or (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
      return false;
    end if;
    begin
      -- PostgreSQL rejects offsets above 15:59, while the declared ISO
      -- contract accepts offsets up to 23:59.  The regex validates clock and
      -- offset components; cast only the calendar portion for real dates.
      perform pg_catalog.left(p_value #>> '{}', 10)::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        return false;
    end;
  end if;
  if field_row.kind = 'object' and value_type <> 'object' then
    return false;
  end if;
  if field_row.kind = 'list' and value_type <> 'array' then
    return false;
  end if;
  if field_row.kind in ('media', 'relation')
     and value_type not in ('string', 'array', 'object') then
    return false;
  end if;

  if value_type = 'string' then
    if field_row.constraints ? 'minLength'
       and pg_catalog.length(p_value #>> '{}')
           < (field_row.constraints->>'minLength')::integer then
      return false;
    end if;
    if field_row.constraints ? 'maxLength'
       and pg_catalog.length(p_value #>> '{}')
           > (field_row.constraints->>'maxLength')::integer then
      return false;
    end if;
    if field_row.constraints ? 'enumValues'
       and not (field_row.constraints->'enumValues'
                @> pg_catalog.jsonb_build_array(p_value #>> '{}')) then
      return false;
    end if;
  end if;
  if value_type = 'number' then
    numeric_value := (p_value::text)::numeric;
    if field_row.constraints ? 'minimum'
       and numeric_value < (field_row.constraints->>'minimum')::numeric then
      return false;
    end if;
    if field_row.constraints ? 'maximum'
       and numeric_value > (field_row.constraints->>'maximum')::numeric then
      return false;
    end if;
  end if;
  if value_type = 'array'
     and field_row.constraints ? 'maxLength'
     and pg_catalog.jsonb_array_length(p_value)
         > (field_row.constraints->>'maxLength')::integer then
    return false;
  end if;
  return true;
end;
$body$;

create or replace function platform_private.cms_create_revision(p_request jsonb)
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
  base_row platform_private.cms_entry_revisions%rowtype;
  current_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  open_conflict platform_private.cms_conflict_records%rowtype;
  editorial_policy jsonb;
  active_version_count integer;
  requested_entry_id uuid;
  requested_base_number bigint;
  requested_entry_version bigint;
  new_revision_id uuid := extensions.gen_random_uuid();
  conflict_id uuid;
  snapshot_time timestamptz := pg_catalog.now();
  base_values jsonb;
  current_values jsonb;
  next_values jsonb;
  path_input text;
  value_field_id_text text;
  value_input jsonb;
  payload_hash text;
  candidate_hash text;
  conflict_hash text;
  changed_overlaps boolean := false;
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
      'entryId', 'baseRevision', 'changedPaths', 'values', 'locale',
      'expectedVersion', 'ifMatch', 'idempotencyKey'
    ]::text[],
    array[
      'entryId', 'baseRevision', 'changedPaths', 'values', 'locale',
      'expectedVersion', 'ifMatch', 'idempotencyKey', 'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
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
  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_base_number := (p_request->>'baseRevision')::bigint;
  requested_entry_version := (p_request->>'expectedVersion')::bigint;

  -- Establish tenant visibility before probing assignment or reserving a key.
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

  -- A replay must return the exact first outcome even when the parent has
  -- since advanced.  Reservation therefore precedes the entry-version CAS.
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-01');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if entry_row.version <> requested_entry_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  select * into current_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = entry_row.current_draft_revision_id
    and candidate.entry_id = entry_row.id
    and candidate.locale = p_request->>'locale'
  for share;
  if not found or current_row.state <> 'draft' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  select * into base_row
  from platform_private.cms_entry_revisions candidate
  where candidate.entry_id = entry_row.id
    and candidate.revision_number = requested_base_number
    and candidate.locale = p_request->>'locale'
  for share;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A schema migration needs its own immutable chain.  The write must not
  -- silently reinterpret an older revision against a newer active schema.
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
  if version_row.id is distinct from current_row.schema_version_id
     or version_row.id is distinct from base_row.schema_version_id
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
        is null
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
        = 'null'::jsonb then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  editorial_policy := platform_private.cms_editorial_workflow_policy_evidence(version_row.id);
  if platform_private.cms_exact_keys(
       editorial_policy,
       array[
         'key', 'version', 'policyHash', 'riskClass',
         'requiredDecisionCount', 'requiredCapabilities', 'approvalEvidenceHash'
       ]::text[],
       array[
         'key', 'version', 'policyHash', 'riskClass',
         'requiredDecisionCount', 'requiredCapabilities', 'approvalEvidenceHash'
       ]::text[]
     ) is not true
     or pg_catalog.jsonb_typeof(editorial_policy->'key') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'version') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'policyHash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'riskClass') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'requiredDecisionCount')
        is distinct from 'number'
     or pg_catalog.jsonb_typeof(editorial_policy->'approvalEvidenceHash')
        is distinct from 'string'
     or coalesce(editorial_policy->>'key', '') !~ '^[a-z][a-z0-9._-]{0,127}$'
     or platform_private.cms_valid_version(editorial_policy->>'version') is not true
     or pg_catalog.length(editorial_policy->>'version') > 19
     or (pg_catalog.length(editorial_policy->>'version') = 19
         and editorial_policy->>'version' > '9223372036854775807')
     or coalesce(editorial_policy->>'policyHash', '') !~ '^[a-f0-9]{64}$'
     or coalesce(editorial_policy->>'approvalEvidenceHash', '') !~ '^[a-f0-9]{64}$'
     or coalesce(editorial_policy->>'riskClass', '') not in ('ordinary', 'protected')
     or coalesce(editorial_policy->>'requiredDecisionCount', '') !~ '^[1-8]$'
     or pg_catalog.jsonb_typeof(editorial_policy->'requiredCapabilities')
        is distinct from 'array' then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_array_length(editorial_policy->'requiredCapabilities') > 16
     or (editorial_policy->>'riskClass' = 'protected'
         and ((editorial_policy->>'requiredDecisionCount')::integer < 2
              or pg_catalog.jsonb_array_length(editorial_policy->'requiredCapabilities') = 0))
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(editorial_policy->'requiredCapabilities') cap(value)
       where pg_catalog.jsonb_typeof(cap.value) <> 'string'
          or platform_private.cms_capability_registry_valid(cap.value #>> '{}', null)
             is not true
     ) then
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
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'changedPaths') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_request->'values') is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_array_length(p_request->'changedPaths') not between 1 and 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not platform_private.cms_json_bounded(p_request->'values', 262144, 8, 128, 128)
     or (select count(*) from pg_catalog.jsonb_object_keys(p_request->'values')) > 128
     or (select count(distinct path) <> count(*)
         from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') path) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- A revision request is a patch over the immutable current snapshot.  A
  -- changed path must have exactly one matching stable-field value, and no
  -- unmentioned value may be silently ignored or accepted as a hidden edit.
  if (select count(*) from pg_catalog.jsonb_object_keys(p_request->'values'))
     <> pg_catalog.jsonb_array_length(p_request->'changedPaths') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  for path_input in
    select value from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') value
  loop
    if path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    value_field_id_text := pg_catalog.substr(path_input, 9);
    if not (p_request->'values' ? value_field_id_text) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = value_field_id_text::uuid;
    if not found or field_row.state <> 'active' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    -- The draft helper proves scalar, calendar, and bounded enum constraints for admitted kinds.
    -- Other kinds need their active-schema value or target validator before
    -- this RPC may persist them; a broad JSON container check is insufficient.
    if field_row.kind not in (
      'short_text', 'long_text', 'boolean', 'integer', 'decimal',
      'date', 'datetime', 'enum'
    ) then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    value_input := p_request->'values'->value_field_id_text;
    if not platform_private.cms_draft_field_value_valid(
      version_row.id, value_field_id_text::uuid, value_input,
      case when value_input = 'null'::jsonb then 'explicit_null' else 'authored' end
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into base_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = base_row.id and field.locale = base_row.locale;
  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into current_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = current_row.id and field.locale = current_row.locale;
  if platform_private.cms_jcs_sha256(base_values) <> base_row.payload_hash::text
     or platform_private.cms_jcs_sha256(current_values) <> current_row.payload_hash::text then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from platform_private.cms_entry_field_values old
    left join platform_private.cms_field_definition_versions definition
      on definition.id = old.field_definition_id
     and definition.content_type_version_id = version_row.id
     and definition.stable_field_id = old.field_id
    where old.revision_id in (base_row.id, current_row.id)
      and (definition.id is null
           or definition.state <> 'active'
           or definition.kind not in (
             'short_text', 'long_text', 'boolean', 'integer', 'decimal',
      'date', 'datetime', 'enum'
           )
           or platform_private.cms_draft_field_value_valid(
             version_row.id, old.field_id, old.value, old.provenance
           ) is not true)
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(p_request->'values') item(key)
  loop
    if base_values->value_field_id_text is distinct from current_values->value_field_id_text
       and p_request->'values'->value_field_id_text is distinct from current_values->value_field_id_text then
      changed_overlaps := true;
    end if;
  end loop;
  if changed_overlaps then
    -- The unsuccessful candidate is never represented as a committed revision.
    -- Return a successful *private* disposition so the conflict INSERT and
    -- idempotency result commit; the Worker maps it to a public BE00 409.
    candidate_hash := platform_private.cms_jcs_sha256(base_values || (p_request->'values'));
    select * into open_conflict
    from platform_private.cms_conflict_records conflict
    where conflict.entry_id = entry_row.id and conflict.state = 'open'
    for update;
    if found then
      conflict_id := open_conflict.id;
      conflict_hash := open_conflict.conflict_hash::text;
    else
      conflict_hash := platform_private.cms_jcs_sha256(
        pg_catalog.jsonb_build_object(
          'entryId', entry_row.id, 'baseRevisionId', base_row.id,
          'theirsRevisionId', current_row.id, 'yoursHash', candidate_hash,
          'changedPaths', p_request->'changedPaths'
        )
      );
      insert into platform_private.cms_conflict_records(
        owner_id, entry_id, base_revision_id, theirs_revision_id,
        yours_source, proposed_values, proposed_values_hash, changed_paths,
        base_hash, theirs_hash, yours_hash, conflict_hash, state,
        version, created_at, updated_at
      ) values (
        entry_row.owner_id, entry_row.id, base_row.id, current_row.id,
        'proposed', p_request->'values',
        platform_private.cms_jcs_sha256(p_request->'values')::char(64),
        p_request->'changedPaths', base_row.payload_hash,
        current_row.payload_hash, candidate_hash::char(64),
        conflict_hash::char(64), 'open', 1, snapshot_time, snapshot_time
      ) returning id into conflict_id;
    end if;
    response := pg_catalog.jsonb_build_object(
      'kind', 'conflict', 'code', 'VERSION_MISMATCH',
      'details', pg_catalog.jsonb_build_object(
        'expectedVersion', requested_entry_version::text,
        'currentVersion', entry_row.version::text,
        'conflictHash', conflict_hash
      )
    );
    perform platform_private.cms_complete(reservation.id, conflict_id, 409, response);
    return response;
  end if;

  -- Preserve unaffected normalized relations on this new immutable snapshot.
  -- A self-reference is pinned to the entry version being committed, so an
  -- ordinary subsequent edit cannot strand the author behind its own stale
  -- expected-target version; an external target still requires exact match.
  -- No relation value from this request reaches this branch: changed relation
  -- paths are fenced above until their typed encoding is owner-approved.
  if exists (
    select 1
    from platform_private.cms_entry_relations relation
    left join platform_private.cms_relation_definitions definition
      on definition.field_definition_id = relation.field_definition_id
    where relation.revision_id = current_row.id
      and (definition.id is null
           or definition.target_kind <> relation.target_kind
           or definition.on_unavailable <> relation.on_unavailable)
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
  if exists (
    select 1
    from platform_private.cms_entry_relations relation
    left join platform_private.cms_content_entries target
      on relation.target_kind = 'content' and target.id = relation.target_id
    where relation.revision_id = current_row.id
      and (relation.target_kind <> 'content'
           or target.id is null
           or target.owner_party_id is distinct from entry_row.owner_party_id
           or target.lifecycle <> 'active'
           or (relation.expected_target_version is not null
               and target.id <> entry_row.id
               and target.version <> relation.expected_target_version))
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  next_values := current_values || (p_request->'values');
  payload_hash := platform_private.cms_jcs_sha256(next_values);
  parent_ids := case when base_row.id = current_row.id
    then pg_catalog.jsonb_build_array(current_row.id)
    else pg_catalog.jsonb_build_array(current_row.id, base_row.id) end;

  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    new_revision_id, entry_row.owner_id, entry_row.id,
    current_row.revision_number + 1, version_row.id,
    current_row.template_version_id, current_row.taxonomy_version_ids,
    parent_ids, p_request->>'locale', payload_hash::char(64),
    author_person_id, acting_party_id, 'draft', 1, 'valid', '{}'::jsonb,
    snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, old.field_id,
         old.field_definition_id, old.locale, old.value, old.provenance,
         old.value_hash, snapshot_time, snapshot_time
  from platform_private.cms_entry_field_values old
  where old.revision_id = current_row.id
    and old.locale = current_row.locale
    and not (p_request->'values' ? old.field_id::text);
  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(p_request->'values') item(key)
  loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = value_field_id_text::uuid;
    value_input := p_request->'values'->value_field_id_text;
    insert into platform_private.cms_entry_field_values(
      owner_id, state, version, revision_id, field_id, field_definition_id,
      locale, value, provenance, value_hash, created_at, updated_at
    ) values (
      entry_row.owner_id, 'active', 1, new_revision_id, value_field_id_text::uuid,
      field_row.id, p_request->>'locale', value_input,
      case when value_input = 'null'::jsonb then 'explicit_null' else 'authored' end,
      case when value_input = 'null'::jsonb then null
        else platform_private.cms_jcs_sha256(value_input)::char(64) end,
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
         case
           when old.target_kind = 'content' and old.target_id = entry_row.id
             then requested_entry_version + 1
           else old.expected_target_version
         end,
         old.position, old.on_unavailable,
         snapshot_time, snapshot_time
  from platform_private.cms_entry_relations old
  where old.revision_id = current_row.id;

  update platform_private.cms_content_entries
  set current_draft_revision_id = new_revision_id,
      version = version + 1,
      updated_at = snapshot_time
  where id = entry_row.id and version = requested_entry_version;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;

  perform platform_private.cms_emit_event(
    'cms.entry.revision.create', actor_id, acting_party_id,
    'cms_content_entry', entry_row.id, 'CMS_ENTRY_REVISION_CREATED',
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
    'revisionNumber', (current_row.revision_number + 1)::text,
    'schemaVersionId', version_row.id,
    'templateVersionId', current_row.template_version_id,
    'taxonomyVersionIds', current_row.taxonomy_version_ids,
    'locale', p_request->>'locale', 'contentHash', payload_hash,
    'parentRevisionIds', parent_ids, 'validationState', 'valid',
    'conflictId', null
  );
  perform platform_private.cms_complete(reservation.id, new_revision_id, 201, response);
  return response;
end;
$body$;

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
             'short_text', 'long_text', 'boolean', 'integer', 'decimal', 'date', 'datetime', 'enum'
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
      'short_text', 'long_text', 'boolean', 'integer', 'decimal', 'date', 'datetime', 'enum'
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
      'short_text', 'long_text', 'boolean', 'integer', 'decimal', 'date', 'datetime', 'enum'
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

commit;
