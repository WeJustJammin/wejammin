-- Slice 10 round 5 (lane H, Codex final review MEDIUM): cms_create_entry requires the caller's
-- SchemaArtifact evidence (P2-S10-AC-079 / DEC-133) when a member is JSON null.
--
-- The exact-key validation passes a `schemaArtifact` whose members are JSON null; `->>` yields
-- SQL NULL, every `<>` comparison with the stored artifact is NULL, and PL/pgSQL does not enter
-- an IF whose condition is NULL, so a valid artifact `id` with null `contentTypeVersionId`,
-- `artifactHash`, `compilerVersion` and `zodContractRef` created an entry without the evidence
-- the command must carry.  The members must now be JSON strings (explicit jsonb_typeof checks),
-- the exact-key and uuid predicates are tested with IS NOT TRUE, and every comparison with the
-- stored artifact is IS DISTINCT FROM: anything else is the 422 VALIDATION_FAILED at
-- /schemaArtifact and nothing is written.  Signature, attributes, owner and grants unchanged
-- (CREATE OR REPLACE).  Proof: ../tests/phase_02_slice_10_create_artifact_evidence_nulls.sql.
-- Forward-only.
begin;

create or replace function platform_private.cms_create_entry(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  author_person_id uuid;
  proven_capability text;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  activation_evidence jsonb;
  editorial_policy jsonb;
  entry_id uuid := extensions.gen_random_uuid();
  revision_id uuid := extensions.gen_random_uuid();
  snapshot_time timestamptz := pg_catalog.now();
  payload_hash text;
  value_key text;
  value_input jsonb;
  path_input text;
  path_index integer;
  path_pointer text;
  field_row platform_private.cms_field_definition_versions%rowtype;
  field_values jsonb := '{}'::jsonb;
  relation_fields jsonb := '{}'::jsonb;
  relation_spec jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  -- The capability the actor PROVED (cms.author or cms.editor, in the policy order) is the
  -- one the creator's initial assignment carries: authority on an existing entry needs an
  -- active grant AND an assignment of the same capability.
  proven_capability := platform_private.cms_require_entry_capability_locked(
    actor_id, acting_party_id, array['cms.author', 'cms.editor']::text[], null
  );
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-10');
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

  if not platform_private.cms_exact_keys(
    p_request,
    array[
      'contentTypeId', 'contentTypeVersionId', 'locale', 'changedPaths',
      'values', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
      'activationEvidence'
    ]::text[],
    array[
      'contentTypeId', 'contentTypeVersionId', 'locale', 'changedPaths',
      'values', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
      'activationEvidence', 'idempotencyKey', 'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  if not platform_private.cms_valid_uuid(p_request->>'contentTypeId') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/contentTypeId"]';
  end if;
  if not platform_private.cms_valid_uuid(p_request->>'contentTypeVersionId') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/contentTypeVersionId"]';
  end if;
  if coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/locale"]';
  end if;

  -- The pair must resolve to the same version row, owned by the acting party
  -- and active.  A hidden or version-less pair conceals as NOT_FOUND.
  select * into version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.id = (p_request->>'contentTypeVersionId')::uuid
    and candidate.content_type_id = (p_request->>'contentTypeId')::uuid
    and candidate.owner_id = acting_party_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if version_row.state::text <> 'active' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/contentTypeVersionId"]';
  end if;
  -- BE03b "Entry and revision writes serialize with schema activation": lock the
  -- target version row FOR SHARE before any schema evidence is read or written and
  -- recheck it is still active (the 03a switch takes the conflicting lock).
  perform platform_private.cms_lock_schema_version_shared(version_row.id);
  -- The active schema locale set is the active version's supportedLocales (BE03a OD-4):
  -- an entry in a locale outside it is a 422 and nothing is written.
  if not (version_row.supported_locales ? (p_request->>'locale')) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/locale"]';
  end if;

  -- schemaArtifact is the immutable compiled artifact, addressed by artifact
  -- id, not by the content-type id.
  -- Codex final review (MEDIUM): a JSON null member passed the exact-key check and made every
  -- `<>` comparison below NULL, which PL/pgSQL treats as not-true, so the caller's artifact
  -- evidence (AC-079) was never required.  Every member must be a JSON string and each
  -- comparison is null-safe (IS DISTINCT FROM).
  if platform_private.cms_exact_keys(
    p_request->'schemaArtifact',
    array['id', 'contentTypeVersionId', 'artifactHash', 'compilerVersion', 'zodContractRef']::text[],
    array['id', 'contentTypeVersionId', 'artifactHash', 'compilerVersion', 'zodContractRef']::text[]
  ) is not true
     or pg_catalog.jsonb_typeof(p_request->'schemaArtifact'->'id') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'schemaArtifact'->'contentTypeVersionId') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'schemaArtifact'->'artifactHash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'schemaArtifact'->'compilerVersion') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'schemaArtifact'->'zodContractRef') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->'schemaArtifact'->>'id') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/schemaArtifact"]';
  end if;
  select * into artifact_row
  from platform_private.cms_schema_artifacts candidate
  where candidate.id = (p_request->'schemaArtifact'->>'id')::uuid
    and candidate.content_type_version_id = version_row.id
    and candidate.state::text = 'compiled';
  if not found then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/schemaArtifact"]';
  end if;
  if p_request->'schemaArtifact'->>'contentTypeVersionId' is distinct from version_row.id::text
     or p_request->'schemaArtifact'->>'artifactHash' is distinct from pg_catalog.btrim(artifact_row.artifact_hash::text)
     or p_request->'schemaArtifact'->>'compilerVersion' is distinct from artifact_row.compiler_version
     or p_request->'schemaArtifact'->>'zodContractRef' is distinct from artifact_row.zod_contract_ref then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/schemaArtifact"]';
  end if;
  -- P2-S10-AC-079 (DEC-133): every consumer binds the same SchemaArtifact bytes.  The request
  -- was compared with the stored artifact above; the stored artifact itself must still be the
  -- version's own compiled artifact and its hash must BE the version definition hash.  A
  -- request that merely echoes a drifted stored hash is not evidence (the stored binding, not
  -- the request, decides): append, conflict resolution, restore, the draft read and the
  -- authoring context already refuse the same drift, and so does the create.
  if artifact_row.id is distinct from version_row.schema_artifact_id
     or artifact_row.artifact_hash is distinct from version_row.definition_hash
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

  -- changedPaths must be JSON Pointers that address a stable field id carried
  -- by this exact version, not a display key.
  if pg_catalog.jsonb_typeof(p_request->'changedPaths') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'changedPaths') not between 1 and 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/changedPaths"]';
  end if;
  if (
    select count(distinct path) <> count(*)
    from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') as path
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/changedPaths"]';
  end if;
  for path_input, path_index in
    select item.value, item.ordinality - 1
    from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths')
      with ordinality as item(value, ordinality)
  loop
    if path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/changedPaths/' || path_index::text)::text;
    end if;
    path_pointer := pg_catalog.substr(path_input, 9);
    if not exists (
      select 1 from platform_private.cms_field_definition_versions field
      where field.stable_field_id = path_pointer::uuid
        and field.content_type_version_id = version_row.id
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/changedPaths/' || path_index::text)::text;
    end if;
  end loop;

  -- jsonb_object_keys raises on a non-object, so the type gate is a separate
  -- statement rather than an OR branch: a scalar or array body must still fail
  -- closed with the contract token instead of leaking a 22023.
  if pg_catalog.jsonb_typeof(p_request->'values') is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/values"]';
  end if;
  if (
       select count(*)
       from pg_catalog.jsonb_object_keys(p_request->'values')
     ) > 128
     or not platform_private.cms_json_bounded(p_request->'values', 262144, 8, 128, 128) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/values"]';
  end if;
  for value_key in select key from pg_catalog.jsonb_object_keys(p_request->'values') as key loop
    if not platform_private.cms_valid_uuid(value_key)
       or not exists (
         select 1 from platform_private.cms_field_definition_versions field
         where field.stable_field_id = value_key::uuid
           and field.content_type_version_id = version_row.id
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = case when platform_private.cms_valid_uuid(value_key)
          then pg_catalog.jsonb_build_array('/fields/' || value_key)::text
          else '["/values"]' end;
    end if;
    value_input := p_request->'values'->value_key;
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.stable_field_id = value_key::uuid
      and field.content_type_version_id = version_row.id;
    -- BE03b typed reasons: a refused value raises its Worker-readable reason
    -- (rich_text_not_canonical, object_kind_unspecified, object_property_invalid)
    -- or the bare VALIDATION_FAILED.
    perform platform_private.cms_require_draft_value_valid(
      version_row.id, value_key::uuid, value_input, 'authored'
    );
    if field_row.kind = 'relation' then
      -- A relation is written to normalized EntryRelation rows resolved against
      -- its immutable RelationDefinition, never stored as a field value
      -- (BE03b:1049, P2-S10-AC-031).
      relation_fields := relation_fields || pg_catalog.jsonb_build_object(
        value_key,
        platform_private.cms_resolve_relation_targets(
          actor_id, acting_party_id, null, null, field_row.id, value_input
        )
      );
    else
      field_values := field_values || pg_catalog.jsonb_build_object(value_key, value_input);
      -- BE03b "Value encodings by field kind": a well-formed NON-EMPTY taxonomy or
      -- media value has no producer yet and fails closed with its typed reason
      -- before any row is written; a malformed one was already refused above.
      perform platform_private.cms_require_value_source_available(
        version_row.id, value_key::uuid, value_input
      );
    end if;
  end loop;

  -- Every validator ref must be registered, and every validator the active
  -- schema declares must be covered by the request.
  if pg_catalog.jsonb_typeof(p_request->'validatorRefs') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'validatorRefs') > 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/validatorRefs"]';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_request->'validatorRefs') as ref
    where not platform_private.cms_exact_keys(
            ref, array['key', 'version']::text[], array['key', 'version']::text[])
       or not platform_private.cms_valid_version(ref->>'version')
       or not (platform_private.cms_validator_registry_valid(
                 ref->>'key', (ref->>'version')::bigint)
               or platform_private.cms_protected_validator_ref(
                 ref->>'key', (ref->>'version')::bigint))
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/validatorRefs"]';
  end if;
  if exists (
    select 1 from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.validator_key is not null
      and not exists (
        select 1 from pg_catalog.jsonb_array_elements(p_request->'validatorRefs') as ref
        where ref->>'key' = field.validator_key
          and (field.validator_version is null
               or ref->>'version' = field.validator_version::text)
      )
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/validatorRefs"]';
  end if;

  -- activationEvidence must equal the stored 03a activation envelope exactly.
  activation_evidence := platform_private.cms_type_version_resource(version_row.id)->'activationEvidence';
  if activation_evidence is null
     or activation_evidence = 'null'::jsonb
     or p_request->'activationEvidence' is distinct from activation_evidence then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/activationEvidence"]';
  end if;

  -- Editorial workflow-policy evidence: distinct from the activation envelope
  -- and read from the registry projection, never from the request.  With no
  -- owner-approved projection the dependency is unavailable and the create
  -- stops here, before any row is written.
  editorial_policy := platform_private.cms_editorial_workflow_policy_evidence(version_row.id);
  if editorial_policy is null
     or editorial_policy = 'null'::jsonb
     or p_request->'workflowPolicy' is distinct from editorial_policy then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into platform_private.cms_content_entries(
    id, owner_id, content_type_id, owner_party_id, lifecycle,
    current_draft_revision_id, version, created_by, created_at, updated_at
  ) values (
    entry_id, acting_party_id, version_row.content_type_id, acting_party_id,
    'active', null, 1, actor_id, snapshot_time, snapshot_time
  );

  -- Relations are normalized rows outside the payload hash (BE03b:1217).
  payload_hash := platform_private.cms_jcs_sha256(field_values);
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    revision_id, acting_party_id, entry_id, 1, version_row.id,
    null, '[]'::jsonb, '[]'::jsonb, p_request->>'locale',
    payload_hash::char(64), author_person_id, acting_party_id, 'draft', 1,
    'valid', '{}'::jsonb, snapshot_time, snapshot_time
  );

  update platform_private.cms_content_entries
  set current_draft_revision_id = revision_id
  where id = entry_id;

  for value_key in select key from pg_catalog.jsonb_object_keys(field_values) as key loop
    value_input := field_values->value_key;
    -- Write-path audit (P2-S10-AC-061): the stable field id is resolved to the
    -- definition row of THIS (active) version, like the relation branch below.  On
    -- a successor version the definition rows are new rows, and binding the value
    -- to the stable id pointed it at the superseded version's row.
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.stable_field_id = value_key::uuid
      and field.content_type_version_id = version_row.id;
    insert into platform_private.cms_entry_field_values(
      owner_id, state, version, revision_id, field_id, field_definition_id,
      locale, value, provenance, value_hash, created_at, updated_at
    ) values (
      acting_party_id, 'active', 1, revision_id, value_key::uuid, field_row.id,
      p_request->>'locale', value_input, 'authored',
      case when value_input is null then null
        else platform_private.cms_jcs_sha256(value_input)::char(64) end,
      snapshot_time, snapshot_time
    );
  end loop;

  -- The resolved relation rows of the first revision: targetKind and
  -- onUnavailable come only from the immutable RelationDefinition, position is the
  -- request index.
  for value_key in select key from pg_catalog.jsonb_object_keys(relation_fields) as key loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.stable_field_id = value_key::uuid
      and field.content_type_version_id = version_row.id;
    for relation_spec in
      select spec.value from pg_catalog.jsonb_array_elements(relation_fields->value_key) spec(value)
    loop
      insert into platform_private.cms_entry_relations(
        owner_id, state, version, revision_id, field_id, field_definition_id,
        target_kind, target_id, expected_target_version, position, on_unavailable,
        created_at, updated_at
      ) values (
        acting_party_id, 'active', 1, revision_id, value_key::uuid, field_row.id,
        relation_spec->>'targetKind', (relation_spec->>'targetId')::uuid,
        (relation_spec->>'expectedTargetVersion')::bigint,
        (relation_spec->>'position')::integer, relation_spec->>'onUnavailable',
        snapshot_time, snapshot_time
      );
    end loop;
  end loop;

  -- The creator assignment is keyed to the canonical person party, never to
  -- the acting/org alias.
  insert into platform_private.cms_entry_assignments(
    owner_id, entry_id, assignee_person_id, capability_key, state, version,
    created_at, updated_at
  ) values (
    acting_party_id, entry_id, author_person_id, proven_capability, 'active', 1,
    snapshot_time, snapshot_time
  );

  perform platform_private.cms_emit_event(
    'cms.entry.revision.create', actor_id, acting_party_id,
    'cms_content_entry', entry_id, 'CMS_ENTRY_REVISION_CREATED',
    'cms.entry.revision-created.v1', 'cms_content_entry', entry_id, 1,
    jsonb_build_object('entryId', entry_id, 'revisionId', revision_id),
    correlation_id
  );

  response := jsonb_build_object(
    'entry', jsonb_build_object(
      'id', entry_id,
      'version', '1',
      'createdAt', platform_private.auth_iso_time(snapshot_time),
      'updatedAt', platform_private.auth_iso_time(snapshot_time)
    ),
    'revision', jsonb_build_object(
      'id', revision_id,
      'version', '1',
      'createdAt', platform_private.auth_iso_time(snapshot_time),
      'updatedAt', platform_private.auth_iso_time(snapshot_time)
    ),
    'revisionNumber', '1',
    'lifecycle', 'active',
    'state', 'draft',
    'locale', p_request->>'locale',
    'contentHash', payload_hash,
    'validationState', 'valid'
  );
  perform platform_private.cms_complete(reservation.id, entry_id, 201, response);
  return response;
end;
$function$;

commit;
