begin;

-- CMS-03B-10: a globally resolving active schema version is not visible to
-- an author acting for another organization. Check the owner at the lookup,
-- before artifact, activation, or editorial-policy evidence can distinguish
-- a foreign version from a nonexistent one.

create or replace function platform_private.cms_create_entry(p_request jsonb)
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
  path_pointer text;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_entry_capability(
    actor_id, acting_party_id, array['cms.author', 'cms.editor']::text[], null
  );
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-10');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
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

  if not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'contentTypeVersionId')
     or coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
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
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  -- schemaArtifact is the immutable compiled artifact, addressed by artifact
  -- id, not by the content-type id.
  if not platform_private.cms_exact_keys(
    p_request->'schemaArtifact',
    array['id', 'contentTypeVersionId', 'artifactHash', 'compilerVersion', 'zodContractRef']::text[],
    array['id', 'contentTypeVersionId', 'artifactHash', 'compilerVersion', 'zodContractRef']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->'schemaArtifact'->>'id') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select * into artifact_row
  from platform_private.cms_schema_artifacts candidate
  where candidate.id = (p_request->'schemaArtifact'->>'id')::uuid
    and candidate.content_type_version_id = version_row.id
    and candidate.state::text = 'compiled';
  if not found then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->'schemaArtifact'->>'contentTypeVersionId' <> version_row.id::text
     or pg_catalog.btrim(artifact_row.artifact_hash::text) <> p_request->'schemaArtifact'->>'artifactHash'
     or artifact_row.compiler_version <> p_request->'schemaArtifact'->>'compilerVersion'
     or artifact_row.zod_contract_ref <> p_request->'schemaArtifact'->>'zodContractRef' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  -- changedPaths must be JSON Pointers that address a stable field id carried
  -- by this exact version, not a display key.
  if pg_catalog.jsonb_typeof(p_request->'changedPaths') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'changedPaths') not between 1 and 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if (
    select count(distinct path) <> count(*)
    from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') as path
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  for path_input in select value from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') as value loop
    if path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    path_pointer := pg_catalog.substr(path_input, 9);
    if not exists (
      select 1 from platform_private.cms_field_definition_versions field
      where field.stable_field_id = path_pointer::uuid
        and field.content_type_version_id = version_row.id
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  -- jsonb_object_keys raises on a non-object, so the type gate is a separate
  -- statement rather than an OR branch: a scalar or array body must still fail
  -- closed with the contract token instead of leaking a 22023.
  if pg_catalog.jsonb_typeof(p_request->'values') is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if (
       select count(*)
       from pg_catalog.jsonb_object_keys(p_request->'values')
     ) > 128
     or not platform_private.cms_json_bounded(p_request->'values', 262144, 8, 128, 128) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  for value_key in select key from pg_catalog.jsonb_object_keys(p_request->'values') as key loop
    if not platform_private.cms_valid_uuid(value_key)
       or not exists (
         select 1 from platform_private.cms_field_definition_versions field
         where field.stable_field_id = value_key::uuid
           and field.content_type_version_id = version_row.id
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    value_input := p_request->'values'->value_key;
    if not platform_private.cms_draft_field_value_valid(
      version_row.id, value_key::uuid, value_input, 'authored'
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  -- Every validator ref must be registered, and every validator the active
  -- schema declares must be covered by the request.
  if pg_catalog.jsonb_typeof(p_request->'validatorRefs') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'validatorRefs') > 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_request->'validatorRefs') as ref
    where not platform_private.cms_exact_keys(
            ref, array['key', 'version']::text[], array['key', 'version']::text[])
       or not platform_private.cms_valid_version(ref->>'version')
       or not platform_private.cms_validator_registry_valid(
            ref->>'key', (ref->>'version')::bigint)
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
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
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  -- activationEvidence must equal the stored 03a activation envelope exactly.
  activation_evidence := platform_private.cms_type_version_resource(version_row.id)->'activationEvidence';
  if activation_evidence is null
     or activation_evidence = 'null'::jsonb
     or p_request->'activationEvidence' is distinct from activation_evidence then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
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

  payload_hash := platform_private.cms_jcs_sha256(p_request->'values');
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

  for value_key in select key from pg_catalog.jsonb_object_keys(p_request->'values') as key loop
    value_input := p_request->'values'->value_key;
    insert into platform_private.cms_entry_field_values(
      owner_id, state, version, revision_id, field_id, field_definition_id,
      locale, value, provenance, value_hash, created_at, updated_at
    ) values (
      acting_party_id, 'active', 1, revision_id, value_key::uuid, value_key::uuid,
      p_request->>'locale', value_input, 'authored',
      case when value_input is null then null
        else platform_private.cms_jcs_sha256(value_input)::char(64) end,
      snapshot_time, snapshot_time
    );
  end loop;

  -- The creator assignment is keyed to the canonical person party, never to
  -- the acting/org alias.  BE03b EntryCreateRequest carries no relations, so no
  -- relation row is written by create.
  insert into platform_private.cms_entry_assignments(
    owner_id, entry_id, assignee_person_id, capability_key, state, version,
    created_at, updated_at
  ) values (
    acting_party_id, entry_id, author_person_id, 'cms.author', 'active', 1,
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
$body$;

comment on function platform_private.cms_create_entry(jsonb) is
  'CMS-03B-10 atomic first draft and assignment; content-type version lookup is owner-bound before evidence checks, so foreign and absent versions both return NOT_FOUND.';

revoke all on function platform_private.cms_create_entry(jsonb) from public, anon, authenticated, service_role;

commit;
