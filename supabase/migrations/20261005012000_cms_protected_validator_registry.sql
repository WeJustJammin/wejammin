-- Slice 10 gap resolution DEC-146 (P2-S10-AC-085, audit D-12): the protected
-- immutable `rich_text.v1`@1 validator is a concrete registry entry that is
-- frozen into the compiled schema artifact and revalidated before every editorial
-- transition.
--
-- BE03a "Protected Validator Registry": rich_text.v1 version 1 is the only member
-- of the code-owned protected validator registry, and the compile rule freezes
-- the validator identity into the artifact and the definition hash.  The first
-- registry migration (20261005010000) named the member (cms_protected_validator_ref)
-- but its header claimed an "artifact reference and its code-owned SHA-256 hash"
-- frozen into that migration; no such constants existed, so a compiled artifact
-- named nothing.  That claim is corrected here (the older file is unreleased and
-- its comment is left as the historical record of what was intended): the entry
-- is now concrete.
--
--   * cms_protected_validator_descriptor_body(text, bigint) is the canonical
--     immutable grammar descriptor of the member (ASCII and integers only), and
--     cms_protected_validator_descriptor(text, bigint) is the registry entry
--     { key, version (number), artifactRef, artifactHash } whose artifactHash is
--     always the RECOMPUTED JCS SHA-256 of that descriptor, referenced as
--     `cms/validators/rich_text.v1/v1`.  The TypeScript registry
--     (packages/contracts/src/content-schema-registry/protected-validators.ts)
--     holds the same descriptor and hash, pinned by its own parity test.
--   * Compile.  cms_compiled_editor_manifest appends
--     `validators: [ descriptor ]` to the editor manifest ONLY when the definition
--     uses the grammar (a rich_text field, an explicit rich_text.v1 pair, or an
--     object field with a rich_text property), so an artifact that does not use it
--     keeps its hash.  The entry is inside the editor manifest and so inside the
--     artifact hash and the definition hash.
--   * Activation.  cms_activation_references_valid refuses an artifact whose frozen
--     validators differ from the registry's descriptors for its definition.
--   * Editorial transitions.  cms_validators_frozen_current(version) is the
--     predicate cms_create_entry, cms_create_revision, cms_resolve_conflict and
--     cms_restore_revision call (20261005012300 / 20261005012400): missing, extra
--     or stale frozen validators are DEPENDENCY_UNAVAILABLE and nothing is written.
--
-- Preflight.  A compiled artifact is immutable, so a legacy artifact whose
-- definition uses the grammar but froze nothing can never be repaired in place; it
-- would silently become unwritable.  The migration therefore refuses to run while
-- such an artifact exists (fail closed): the owner replaces it with a successor
-- schema version, which compiles with the freeze.  A fresh database has none.
-- Forward-only.
begin;

create or replace function platform_private.cms_protected_validator_descriptor_body(
  p_key text,
  p_version bigint
)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  select case when (p_key, p_version) = ('rich_text.v1', 1::bigint)
    then '{"blockTypes":["heading","list_item","paragraph","quote"],"bounds":{"blocks":128,"containerDepth":7,"httpsHrefCharacters":2048,"internalRouteCharacters":2048,"mailtoAddressMaxCharacters":254,"mailtoAddressMinCharacters":3,"marksPerSpan":3,"spanTextCharacters":10000,"spansPerBlock":128},"canonical":{"allowedControlCharacters":["U+000A"],"linkAbsentNotNull":true,"mergedAdjacentSpans":true,"normalization":"NFC","uniqueOrderedMarks":true},"format":"rich_text.v1","grammarVersion":1,"headingLevels":[2,3,4],"linkKinds":["https","internal","mailto"],"listDepths":[1,2,3],"listKinds":["bulleted","numbered"],"marks":["bold","italic","code"],"unit":"unicode_character"}'::jsonb
  end
$body$;

comment on function platform_private.cms_protected_validator_descriptor_body(text, bigint) is
  'The canonical immutable grammar descriptor of a protected validator registry member (rich_text.v1 version 1 only): ASCII keys and integers, so its JCS SHA-256 is byte-stable across implementations. NULL for an unregistered member.';

-- STABLE (not IMMUTABLE): the entry is looked up at execution time and never
-- folded into a cached plan, so registry drift against a frozen artifact is
-- detected by every later call in the same session.
create or replace function platform_private.cms_protected_validator_descriptor(
  p_key text,
  p_version bigint
)
returns jsonb
language sql
stable
set search_path = ''
as $body$
  select case when platform_private.cms_protected_validator_descriptor_body(p_key, p_version) is not null
    then pg_catalog.jsonb_build_object(
      'key', p_key,
      'version', p_version,
      'artifactRef', 'cms/validators/' || p_key || '/v' || p_version::text,
      'artifactHash', platform_private.cms_jcs_sha256(
        platform_private.cms_protected_validator_descriptor_body(p_key, p_version)
      )
    )
  end
$body$;

comment on function platform_private.cms_protected_validator_descriptor(text, bigint) is
  'The protected validator registry entry { key, version, artifactRef, artifactHash }: artifactHash is always the recomputed JCS SHA-256 of the canonical descriptor body. NULL for an unregistered key or version (including a NULL key).';

-- The registry descriptors a definition (a create-type request or a stored
-- schema, both carrying a `fields` array) requires frozen into its artifact:
-- exactly one entry when any field uses the rich_text.v1 grammar, otherwise [].
-- STABLE, not IMMUTABLE, like the registry entry it calls: a caller's cached plan
-- must never fold the descriptor hash into a constant, so a registry that no
-- longer matches a frozen artifact is always seen at the next call.
create or replace function platform_private.cms_required_protected_validators(
  p_definition jsonb
)
returns jsonb
language sql
stable
set search_path = ''
as $body$
  select case when exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(p_definition->'fields') = 'array'
        then p_definition->'fields' else '[]'::jsonb end
    ) field(value)
    where field.value->>'kind' = 'rich_text'
       or (field.value->>'validatorKey' = 'rich_text.v1'
           and field.value->>'validatorVersion' = '1')
       or (field.value->>'kind' = 'object'
           and exists (
             select 1
             from pg_catalog.jsonb_array_elements(
               case when pg_catalog.jsonb_typeof(
                      field.value #> '{constraints,objectStructure,properties}') = 'array'
                 then field.value #> '{constraints,objectStructure,properties}'
                 else '[]'::jsonb end
             ) property(value)
             where property.value->>'kind' = 'rich_text'
           ))
  ) then pg_catalog.jsonb_build_array(
    platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)
  ) else '[]'::jsonb end
$body$;

comment on function platform_private.cms_required_protected_validators(jsonb) is
  'The protected validator descriptors a definition must freeze: the rich_text.v1 registry entry when a field is rich_text, carries the explicit rich_text.v1 pair, or is an object with a rich_text property; [] otherwise. Read-only; stable because it calls the registry.';

-- The compile rule: the editor manifest freezes the protected validators the
-- definition uses (and only then, so definitions that do not use one keep their
-- artifact hash).
create or replace function platform_private.cms_compiled_editor_manifest(p_request jsonb)
returns jsonb
language sql
stable
strict
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'schema', platform_private.cms_canonical_type_definition(p_request),
    'fields', platform_private.cms_canonical_type_definition(p_request)->'fields'
  ) || case
    when platform_private.cms_required_protected_validators(
           platform_private.cms_canonical_type_definition(p_request)
         ) = '[]'::jsonb
      then '{}'::jsonb
    else pg_catalog.jsonb_build_object(
      'validators',
      platform_private.cms_required_protected_validators(
        platform_private.cms_canonical_type_definition(p_request)
      )
    )
  end
$body$;


-- Preflight (see header): no legacy compiled artifact may use the grammar without
-- having frozen it.
do $preflight$
declare
  legacy_count integer;
begin
  select count(*) into legacy_count
  from platform_private.cms_schema_artifacts artifact
  where artifact.state::text = 'compiled'
    and coalesce(artifact.editor_manifest->'validators', '[]'::jsonb)
        is distinct from platform_private.cms_required_protected_validators(
          artifact.editor_manifest->'schema'
        );
  if legacy_count > 0 then
    raise exception 'DEC-146 preflight: % compiled schema artifact(s) use the rich_text.v1 grammar without freezing its protected validator; supersede them with a successor schema version before this migration', legacy_count;
  end if;
end;
$preflight$;

-- The frozen-validator predicate every editorial transition calls: the version's
-- compiled artifact froze exactly the registry's descriptors for its own
-- (immutable) schema.  An unknown version, a version without a compiled artifact,
-- a missing, extra or stale frozen validator is false.
create or replace function platform_private.cms_validators_frozen_current(
  p_version_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
begin
  if p_version_id is null then
    return false;
  end if;
  select candidate.* into version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.id = p_version_id;
  if not found then
    return false;
  end if;
  select artifact.* into artifact_row
  from platform_private.cms_schema_artifacts artifact
  where artifact.id = version_row.schema_artifact_id
    and artifact.content_type_version_id = version_row.id
    and artifact.state::text = 'compiled';
  if not found then
    return false;
  end if;
  return coalesce(artifact_row.editor_manifest->'validators', '[]'::jsonb)
    is not distinct from platform_private.cms_required_protected_validators(
      artifact_row.editor_manifest->'schema'
    );
end;
$body$;

comment on function platform_private.cms_validators_frozen_current(uuid) is
  'True when the version''s compiled artifact froze exactly the protected validator descriptors the registry currently names for its schema (missing, extra and stale are false). Called by every editorial transition; read-only.';

-- Privileges.  The pure registry helpers stay with the migration owner and grant
-- EXECUTE to the CMS definer (the callers run as that role); the predicate reads
-- forced tables, so it is owned by the dedicated NOLOGIN definer role (SEC-2).
revoke all on function platform_private.cms_protected_validator_descriptor_body(text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_protected_validator_descriptor(text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_required_protected_validators(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_validators_frozen_current(uuid)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_protected_validator_descriptor_body(text, bigint)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_protected_validator_descriptor(text, bigint)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_required_protected_validators(jsonb)
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_validators_frozen_current(uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

-- cms_activation_references_valid (SECURITY DEFINER, owned by the CMS definer):
-- the DEC-146 revision of the 20260902080000 body.  CREATE OR REPLACE keeps its
-- owner and grants.

create or replace function platform_private.cms_activation_references_valid(
  p_version_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  type_row platform_private.cms_content_types%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  field_row record;
  relation_row record;
  template_row record;
  capability_row record;
  manifest_entry jsonb;
  schema_value jsonb;
  field_value jsonb;
  relation_value jsonb;
begin
  if p_version_id is null then
    return false;
  end if;
  select version_row_candidate.* into version_row
  from platform_private.cms_content_type_versions version_row_candidate
  where version_row_candidate.id = p_version_id;
  if not found then
    return false;
  end if;
  select type_row_candidate.* into type_row
  from platform_private.cms_content_types type_row_candidate
  where type_row_candidate.id = version_row.content_type_id;
  if not found
     or type_row.owner_id is distinct from version_row.owner_id
     or not platform_private.cms_capability_registry_valid(
       type_row.owner_capability, null
     ) then
    return false;
  end if;
  if not platform_private.cms_workflow_registry_valid(
    version_row.workflow_key, version_row.workflow_version
  ) then
    return false;
  end if;
  if version_row.default_template_version_id is not null
     and not platform_private.cms_template_registry_valid(
       version_row.default_template_version_id
     ) then
    return false;
  end if;
  select artifact.* into artifact_row
  from platform_private.cms_schema_artifacts artifact
  where artifact.id = version_row.schema_artifact_id
    and artifact.content_type_version_id = version_row.id
    and artifact.owner_id = version_row.owner_id
    and artifact.state = 'compiled';
  if not found
     or artifact_row.artifact_hash is distinct from version_row.definition_hash
     or not platform_private.cms_compiler_registry_valid(
       artifact_row.compiler_version
     )
     or artifact_row.zod_contract_ref !~ (
       '^cms/content-type/' || type_row.type_key || '/v[1-9][0-9]*$'
     )
     or not platform_private.cms_valid_hash(artifact_row.artifact_hash) then
    return false;
  end if;

  schema_value := artifact_row.editor_manifest->'schema';
  -- DEC-146 (P2-S10-AC-085): the editor manifest may carry the frozen protected
  -- validator descriptors (`validators`), and when the definition uses a
  -- protected grammar it MUST carry exactly the registry's descriptors: an
  -- artifact that froze nothing, froze a stale or foreign descriptor, or froze a
  -- validator its definition does not use is not activatable.
  if not platform_private.cms_exact_keys(
    artifact_row.editor_manifest,
    array['schema','fields']::text[],
    array['schema','fields','validators']::text[]
  ) or not platform_private.cms_exact_keys(
    schema_value,
    array[
      'typeKey','label','ownerCapability','sourceLocale','defaultLocale',
      'workflowKey','workflowVersion','defaultTemplateVersionId','fields',
      'relations','templateBindings','capabilityBindings'
    ]::text[],
    array[
      'typeKey','label','ownerCapability','sourceLocale','defaultLocale',
      'workflowKey','workflowVersion','defaultTemplateVersionId','fields',
      'relations','templateBindings','capabilityBindings'
    ]::text[]
  ) then
    return false;
  end if;
  if schema_value->>'typeKey' is distinct from type_row.type_key
     or schema_value->>'ownerCapability' is distinct from type_row.owner_capability
     or schema_value->>'label' is distinct from version_row.labels->>'label'
     or schema_value->>'workflowKey' is distinct from version_row.workflow_key
     or schema_value->>'workflowVersion' is distinct from version_row.workflow_version::text
     or schema_value->>'sourceLocale' is distinct from version_row.source_locale
     or schema_value->>'defaultLocale' is distinct from version_row.default_locale
     or pg_catalog.jsonb_typeof(schema_value->'fields') <> 'array'
     or pg_catalog.jsonb_typeof(schema_value->'relations') <> 'array'
     or pg_catalog.jsonb_typeof(schema_value->'templateBindings') <> 'array'
     or pg_catalog.jsonb_typeof(schema_value->'capabilityBindings') <> 'array'
     or not platform_private.cms_capability_registry_valid(
       schema_value->>'ownerCapability', null
     )
     or not platform_private.cms_workflow_registry_valid(
       schema_value->>'workflowKey',
       case when platform_private.cms_valid_version(schema_value->>'workflowVersion')
         then (schema_value->>'workflowVersion')::bigint else null end
    ) then
    return false;
  end if;
  if coalesce(artifact_row.editor_manifest->'validators', '[]'::jsonb)
       is distinct from platform_private.cms_required_protected_validators(schema_value)
     or (artifact_row.editor_manifest ? 'validators'
         and artifact_row.editor_manifest->'validators' = '[]'::jsonb) then
    return false;
  end if;
  -- The artifact is a complete-set snapshot, not a lower-bound allowlist.
  -- Count and distinct-identity checks reject both extra persisted children and
  -- duplicate manifest entries that could otherwise hide a missing row.
  if (select count(*) from platform_private.cms_field_definition_versions field
      where field.content_type_version_id = version_row.id)
       <> pg_catalog.jsonb_array_length(schema_value->'fields')
     or (select count(distinct field_entry.value->>'stableFieldId')
         from pg_catalog.jsonb_array_elements(schema_value->'fields') field_entry(value))
       <> pg_catalog.jsonb_array_length(schema_value->'fields')
     or (select count(*)
         from platform_private.cms_relation_definitions relation
         join platform_private.cms_field_definition_versions field
           on field.id = relation.field_definition_id
         where field.content_type_version_id = version_row.id)
       <> pg_catalog.jsonb_array_length(schema_value->'relations')
     or (select count(distinct relation_entry.value->>'fieldId')
         from pg_catalog.jsonb_array_elements(schema_value->'relations') relation_entry(value))
       <> pg_catalog.jsonb_array_length(schema_value->'relations')
     or (select count(*)
         from platform_private.cms_content_type_template_bindings binding
         where binding.content_type_version_id = version_row.id)
       <> pg_catalog.jsonb_array_length(schema_value->'templateBindings')
     or (select count(distinct template_entry.value->>'templateVersionId')
         from pg_catalog.jsonb_array_elements(schema_value->'templateBindings') template_entry(value))
       <> pg_catalog.jsonb_array_length(schema_value->'templateBindings')
     or (select count(*)
         from platform_private.cms_content_type_capability_bindings binding
         where binding.content_type_version_id = version_row.id)
       <> pg_catalog.jsonb_array_length(schema_value->'capabilityBindings')
     or (select count(distinct (capability_entry.value->>'capabilityKey')
                                   || ':' || (capability_entry.value->>'capabilityVersion'))
         from pg_catalog.jsonb_array_elements(schema_value->'capabilityBindings') capability_entry(value))
       <> pg_catalog.jsonb_array_length(schema_value->'capabilityBindings') then
    return false;
  end if;
  if artifact_row.editor_manifest->'fields' is distinct from schema_value->'fields'
     or artifact_row.renderer_manifest->'relations' is distinct from schema_value->'relations'
     or artifact_row.renderer_manifest->'templateBindings' is distinct from schema_value->'templateBindings'
     or artifact_row.renderer_manifest->'capabilityBindings' is distinct from schema_value->'capabilityBindings' then
    return false;
  end if;
  if schema_value->'defaultTemplateVersionId' <> 'null'::jsonb
     and (
       not platform_private.cms_valid_uuid(
         schema_value->>'defaultTemplateVersionId'
       )
       or not platform_private.cms_template_registry_valid(
         (schema_value->>'defaultTemplateVersionId')::uuid
       )
     ) then
    return false;
  end if;
  if schema_value->'defaultTemplateVersionId' is distinct from coalesce(
       pg_catalog.to_jsonb(version_row.default_template_version_id),
       'null'::jsonb
     ) then
    return false;
  end if;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(schema_value->'fields') as value
  loop
    if not platform_private.cms_valid_field_input(manifest_entry, true)
       then
      return false;
    end if;
    select field.* into field_row
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = version_row.id
       and field.stable_field_id = (manifest_entry->>'stableFieldId')::uuid;
    if not found then
      return false;
    end if;
    field_value := jsonb_build_object(
      'stableFieldId', field_row.stable_field_id,
      'key', field_row.field_key,
      'kind', field_row.kind,
      'constraints', field_row.constraints,
      'required', field_row.required,
      'validatorKey', field_row.validator_key,
      'validatorVersion', field_row.validator_version::text,
      'defaultMode', field_row.default_mode,
      'localizationMode', field_row.localization_mode,
      'editorConfig', field_row.editor_config,
      'lifecycle', field_row.state
    );
    if field_row.default_value is not null then
      field_value := field_value
        || jsonb_build_object('defaultValue', field_row.default_value);
    end if;
    if field_value is distinct from manifest_entry then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(schema_value->'relations') as value
  loop
    if not platform_private.cms_valid_relation_input(manifest_entry)
       then
      return false;
    end if;
    select relation.*, field.kind as field_kind, field.owner_id as field_owner_id
      into relation_row
      from platform_private.cms_relation_definitions relation
      join platform_private.cms_field_definition_versions field
        on field.id = relation.field_definition_id
     where field.content_type_version_id = version_row.id
       and field.id = (manifest_entry->>'fieldId')::uuid
       and field.kind = 'relation';
    if not found then
      return false;
    end if;
    relation_value := jsonb_build_object(
      'fieldId', relation_row.field_definition_id,
      'targetKind', relation_row.target_kind,
      'targetType', relation_row.target_type,
      'projectionKey', relation_row.projection_key,
      'cardinality', relation_row.cardinality,
      'min', relation_row.min_count,
      'max', relation_row.max_count,
      'ordered', relation_row.ordered,
      'onUnavailable', relation_row.on_unavailable
    );
    if relation_value is distinct from manifest_entry then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(schema_value->'templateBindings') as value
  loop
    if not platform_private.cms_exact_keys(
      manifest_entry,
      array['templateVersionId']::text[],
      array['templateVersionId']::text[]
    ) or not platform_private.cms_valid_uuid(manifest_entry->>'templateVersionId')
      or not platform_private.cms_template_registry_valid(
        (manifest_entry->>'templateVersionId')::uuid
      ) or not exists (
        select 1
        from platform_private.cms_content_type_template_bindings binding
        where binding.content_type_version_id = version_row.id
          and binding.template_version_id = (manifest_entry->>'templateVersionId')::uuid
      ) then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(schema_value->'capabilityBindings') as value
  loop
    if not platform_private.cms_exact_keys(
      manifest_entry,
      array['capabilityKey','capabilityVersion']::text[],
      array['capabilityKey','capabilityVersion']::text[]
    ) or not platform_private.cms_valid_version(manifest_entry->>'capabilityVersion')
      or not platform_private.cms_capability_registry_valid(
        manifest_entry->>'capabilityKey',
        (manifest_entry->>'capabilityVersion')::bigint
      ) or not exists (
        select 1
        from platform_private.cms_content_type_capability_bindings binding
        where binding.content_type_version_id = version_row.id
          and binding.capability_key = manifest_entry->>'capabilityKey'
          and binding.capability_version = (manifest_entry->>'capabilityVersion')::bigint
      ) then
      return false;
    end if;
  end loop;

  for field_row in
    select *
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
    order by field.id
  loop
    if field_row.owner_id is distinct from version_row.owner_id then
      return false;
    end if;
    field_value := jsonb_build_object(
      'stableFieldId', field_row.stable_field_id,
      'key', field_row.field_key,
      'kind', field_row.kind,
      'constraints', field_row.constraints,
      'required', field_row.required,
      'validatorKey', field_row.validator_key,
      'validatorVersion', field_row.validator_version::text,
      'defaultMode', field_row.default_mode,
      'localizationMode', field_row.localization_mode,
      'editorConfig', field_row.editor_config,
      'lifecycle', field_row.state
    );
    if field_row.default_value is not null then
      field_value := field_value
        || jsonb_build_object('defaultValue', field_row.default_value);
    end if;
    if not platform_private.cms_valid_field_input(field_value, true) then
      return false;
    end if;
    if field_row.kind = 'relation' then
      if (select count(*) from platform_private.cms_relation_definitions relation
          where relation.field_definition_id = field_row.id) <> 1 then
        return false;
      end if;
    elsif exists (
      select 1 from platform_private.cms_relation_definitions relation
      where relation.field_definition_id = field_row.id
    ) then
      return false;
    end if;
  end loop;
  for relation_row in
    select relation.*, field.kind as field_kind, field.owner_id as field_owner_id
    from platform_private.cms_relation_definitions relation
    join platform_private.cms_field_definition_versions field
      on field.id = relation.field_definition_id
    where field.content_type_version_id = version_row.id
    order by relation.id
  loop
    relation_value := jsonb_build_object(
      'fieldId', relation_row.field_definition_id,
      'targetKind', relation_row.target_kind,
      'targetType', relation_row.target_type,
      'projectionKey', relation_row.projection_key,
      'cardinality', relation_row.cardinality,
      'min', relation_row.min_count,
      'max', relation_row.max_count,
      'ordered', relation_row.ordered,
      'onUnavailable', relation_row.on_unavailable
    );
    if relation_row.owner_id is distinct from version_row.owner_id
       or relation_row.field_owner_id is distinct from version_row.owner_id
       or relation_row.field_kind <> 'relation'
       or not platform_private.cms_valid_relation_input(relation_value) then
      return false;
    end if;
  end loop;
  for template_row in
    select *
    from platform_private.cms_content_type_template_bindings binding
    where binding.content_type_version_id = version_row.id
    order by binding.position, binding.id
  loop
    if template_row.owner_id is distinct from version_row.owner_id
       or not platform_private.cms_template_registry_valid(
         template_row.template_version_id
       ) then
      return false;
    end if;
  end loop;
  for capability_row in
    select *
    from platform_private.cms_content_type_capability_bindings binding
    where binding.content_type_version_id = version_row.id
    order by binding.capability_key, binding.capability_version
  loop
    if capability_row.owner_id is distinct from version_row.owner_id
       or not platform_private.cms_capability_registry_valid(
         capability_row.capability_key, capability_row.capability_version
       ) then
      return false;
    end if;
  end loop;

  if not platform_private.cms_exact_keys(
    artifact_row.renderer_manifest,
    array['relations','templateBindings','capabilityBindings']::text[],
    array[
      'relations','templateBindings','capabilityBindings','blocks',
      'blockDefinitions','rendererRefs','schemaRefs','dataSourcePermissions'
    ]::text[]
  ) or pg_catalog.jsonb_typeof(artifact_row.renderer_manifest->'relations') <> 'array'
    or pg_catalog.jsonb_typeof(artifact_row.renderer_manifest->'templateBindings') <> 'array'
    or pg_catalog.jsonb_typeof(artifact_row.renderer_manifest->'capabilityBindings') <> 'array' then
    return false;
  end if;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(
      artifact_row.renderer_manifest->'relations'
    ) as value
  loop
    if not platform_private.cms_valid_relation_input(manifest_entry)
       or not exists (
         select 1
         from platform_private.cms_field_definition_versions field
         where field.content_type_version_id = version_row.id
           and field.id = (manifest_entry->>'fieldId')::uuid
           and field.kind = 'relation'
       ) then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(
      artifact_row.renderer_manifest->'templateBindings'
    ) as value
  loop
    if not platform_private.cms_exact_keys(
      manifest_entry,
      array['templateVersionId']::text[],
      array['templateVersionId']::text[]
    ) or not platform_private.cms_valid_uuid(manifest_entry->>'templateVersionId')
      or not platform_private.cms_template_registry_valid(
        (manifest_entry->>'templateVersionId')::uuid
      ) then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(
      artifact_row.renderer_manifest->'capabilityBindings'
    ) as value
  loop
    if not platform_private.cms_exact_keys(
      manifest_entry,
      array['capabilityKey','capabilityVersion']::text[],
      array['capabilityKey','capabilityVersion']::text[]
    ) or not platform_private.cms_valid_version(manifest_entry->>'capabilityVersion')
      or not platform_private.cms_capability_registry_valid(
        manifest_entry->>'capabilityKey',
        (manifest_entry->>'capabilityVersion')::bigint
      ) then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(
      coalesce(artifact_row.renderer_manifest->'rendererRefs', '[]'::jsonb)
    ) as value
  loop
    if pg_catalog.jsonb_typeof(manifest_entry) <> 'string'
       or not platform_private.cms_renderer_registry_valid(manifest_entry #>> '{}') then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(
      coalesce(artifact_row.renderer_manifest->'schemaRefs', '[]'::jsonb)
    ) as value
  loop
    if pg_catalog.jsonb_typeof(manifest_entry) <> 'string'
       or not platform_private.cms_schema_ref_registry_valid(manifest_entry #>> '{}') then
      return false;
    end if;
  end loop;
  for manifest_entry in
    select value from pg_catalog.jsonb_array_elements(
      coalesce(artifact_row.renderer_manifest->'dataSourcePermissions', '[]'::jsonb)
    ) as value
  loop
    if pg_catalog.jsonb_typeof(manifest_entry) <> 'string'
       or not platform_private.cms_data_source_registry_valid(manifest_entry #>> '{}') then
      return false;
    end if;
  end loop;
  if (
       artifact_row.renderer_manifest ? 'blocks'
       and pg_catalog.jsonb_typeof(artifact_row.renderer_manifest->'blocks') <> 'array'
     ) or (
       artifact_row.renderer_manifest ? 'blockDefinitions'
       and pg_catalog.jsonb_typeof(artifact_row.renderer_manifest->'blockDefinitions') <> 'array'
     ) then
    return false;
  end if;
  for manifest_entry in
    select value
    from pg_catalog.jsonb_array_elements(
      coalesce(artifact_row.renderer_manifest->'blocks', '[]'::jsonb)
    ) as value
    union all
    select value
    from pg_catalog.jsonb_array_elements(
      coalesce(artifact_row.renderer_manifest->'blockDefinitions', '[]'::jsonb)
    ) as value
  loop
    if not platform_private.cms_block_reference_valid(manifest_entry) then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$body$;

commit;
