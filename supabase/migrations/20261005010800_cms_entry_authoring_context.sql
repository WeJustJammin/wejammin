-- Slice 10 WP-S10-3 (CMS-03B-14, decision D2): protected authoring-context
-- preparation read.
--
-- The read is the author-safe preparation projection the CMS-05 create form
-- hydrates from.  Without a query version it returns the acting party's own
-- creatable active compiled types with no selection and no fields; with
-- contentTypeVersionId it returns exactly that one active compiled version as
-- the selected type plus its bounded author-safe field-definition projection.
--
-- Precedence is literal and fail-closed: the selector is validated as a UUID
-- before any comparison (a non-UUID segment is a structural refusal, never an
-- entry id), the selection requires the query version, the fields require the
-- selection, and the selected version must equal the requested one.  Scope is
-- the caller's own acting party and author/editor grant; the read never grants
-- cms.schema_registry.read, conceals an off-registry or foreign version as
-- NOT_FOUND, refuses any authority alongside the query version, and writes no
-- audit or outbox evidence.  The named worker wrapper restores the
-- transaction-local RPC-context flag.
--
-- The entry-point RPC pair is named platform_api/platform_private
-- cms_get_entry_authoring_context: the operation name BE03b CMS-03B-14 binds and
-- the Worker route registry calls.  The two projection helpers
-- (cms_authoring_context_type, cms_authoring_context_field) are private
-- implementation seams and keep their names.
-- Forward-only.

begin;

-- One AuthoringContextType: the create evidence CMS-03B-10 compares against
-- (schemaArtifact, validatorRefs, workflowPolicy, activationEvidence) plus the
-- locale envelope.  No owner id and no registry-wide capability graph is ever
-- projected, so the read cannot stand in for a schema-registry read.
create or replace function platform_private.cms_authoring_context_type(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'contentTypeId', version_row.content_type_id,
    'contentTypeVersionId', version_row.id,
    'label', coalesce(version_row.labels->>'label', type_row.type_key),
    'sourceLocale', version_row.source_locale,
    'defaultLocale', version_row.default_locale,
    'supportedLocales', coalesce(version_row.supported_locales, '[]'::jsonb),
    'schemaArtifact', (
      select pg_catalog.jsonb_build_object(
        'id', artifact.id,
        'contentTypeVersionId', artifact.content_type_version_id,
        'artifactHash', pg_catalog.btrim(artifact.artifact_hash::text),
        'compilerVersion', artifact.compiler_version,
        'zodContractRef', artifact.zod_contract_ref
      )
      from platform_private.cms_schema_artifacts artifact
      where artifact.id = version_row.schema_artifact_id
        and artifact.content_type_version_id = version_row.id
        and artifact.owner_id = version_row.owner_id
        and artifact.artifact_hash = version_row.definition_hash
        and artifact.state::text = 'compiled'
    ),
    'validatorRefs', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'key', ref.validator_key,
          'version', ref.validator_version::text
        )
        order by ref.validator_key
      )
      from (
        select distinct field.validator_key, field.validator_version
        from platform_private.cms_field_definition_versions field
        where field.content_type_version_id = version_row.id
          and field.state = 'active'
          and field.validator_key is not null
      ) ref
    ), '[]'::jsonb),
    'workflowPolicy', platform_private.cms_editorial_workflow_policy_evidence(version_row.id),
    'activationEvidence', platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
  )
  from platform_private.cms_content_type_versions version_row
  join platform_private.cms_content_types type_row on type_row.id = version_row.content_type_id
  join platform_private.cms_schema_artifacts artifact
    on artifact.id = version_row.schema_artifact_id
   and artifact.content_type_version_id = version_row.id
   and artifact.owner_id = version_row.owner_id
   and artifact.artifact_hash = version_row.definition_hash
   and artifact.state::text = 'compiled'
  where version_row.id = p_version_id
$body$;

comment on function platform_private.cms_authoring_context_type(uuid) is
  'Author-safe AuthoringContextType projection: locale envelope plus the create evidence (schemaArtifact, validatorRefs, workflowPolicy, activationEvidence). Never projects ownerId or a registry-wide capability graph.';

-- One AuthoringContextField: the stable field projection the editor builds
-- controls from, including the immutable 03a RelationDefinition summary for a
-- relation field and nothing identity-bearing.
create or replace function platform_private.cms_authoring_context_field(p_field_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'stableFieldId', field.stable_field_id,
    'key', field.field_key,
    'kind', field.kind,
    'constraints', field.constraints,
    'required', field.required,
    'defaultMode', field.default_mode,
    'defaultValue', field.default_value,
    'localizationMode', field.localization_mode,
    'editorConfig', field.editor_config,
    'relationDefinition', case
      when relation.id is null then null
      else pg_catalog.jsonb_build_object(
        'fieldId', relation.field_definition_id,
        'targetKind', relation.target_kind,
        'targetType', relation.target_type,
        'projectionKey', relation.projection_key,
        'cardinality', relation.cardinality,
        'min', relation.min_count,
        'max', relation.max_count,
        'ordered', relation.ordered,
        'onUnavailable', relation.on_unavailable
      )
    end
  )
  from platform_private.cms_field_definition_versions field
  left join platform_private.cms_relation_definitions relation
    on relation.field_definition_id = field.id
  where field.id = p_field_id
    and field.state = 'active'
$body$;

comment on function platform_private.cms_authoring_context_field(uuid) is
  'Author-safe AuthoringContextField projection for one field-definition version, with the immutable 03a RelationDefinition summary for relation fields.';

create or replace function platform_private.cms_get_entry_authoring_context(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_auth_user_id uuid;
  acting_party_id uuid;
  version_text text;
  version_id uuid;
  version_row platform_private.cms_content_type_versions%rowtype;
  creatable jsonb;
  creatable_count integer;
  selected jsonb := null;
  fields jsonb := '[]'::jsonb;
  field_count integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- Request shape: exactly the optional content-type version selector, with
  -- only the transport control fields.  Any other key -- schemaVersionId,
  -- workflowPolicy, ownership, a capability claim -- has no slot and is refused
  -- before any lookup, so an authority cannot be smuggled beside the version.
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array[]::text[],
       array['contentTypeVersionId', 'context', 'correlationId']::text[]
     ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  actor_auth_user_id := platform_private.cms_actor(p_request);

  -- The literal authoring-context route segment must resolve before the UUID
  -- entry path, so a non-UUID selector is a structural refusal here rather
  -- than an id that reaches an existence check.
  if p_request ? 'contentTypeVersionId' then
    if pg_catalog.jsonb_typeof(p_request->'contentTypeVersionId') <> 'string' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    version_text := p_request->>'contentTypeVersionId';
    if not platform_private.cms_valid_uuid(version_text) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    version_id := version_text::uuid;
  end if;

  acting_party_id := platform_private.cms_acting_party(p_request, actor_auth_user_id);

  -- Reaching scope: a confirmed membership plus an active cms.author or
  -- cms.editor grant in the acting party.  This is deliberately NOT the
  -- cms.schema_registry.read gate; the read never confers it.
  if not exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = acting_party_id
      and tenure.person_id = platform_private.identity_actor_person(actor_auth_user_id)
      and tenure.state = 'confirmed'
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code in ('cms.author', 'cms.editor')
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- Creatable active types: exactly the acting party's own active versions
  -- that still resolve to a compiled artifact.  Count before aggregating so an
  -- oversized projection fails closed rather than silently dropping rows.
  select count(*)::integer into creatable_count
  from platform_private.cms_content_type_versions version_candidate
  where version_candidate.owner_id = acting_party_id
    and version_candidate.state::text = 'active'
    and exists (
      select 1
      from platform_private.cms_schema_artifacts artifact
      where artifact.id = version_candidate.schema_artifact_id
        and artifact.content_type_version_id = version_candidate.id
        and artifact.owner_id = version_candidate.owner_id
        and artifact.artifact_hash = version_candidate.definition_hash
        and artifact.state::text = 'compiled'
    );

  if creatable_count > 32 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      platform_private.cms_authoring_context_type(candidate.id)
      order by candidate.created_at desc, candidate.id desc
    ),
    '[]'::jsonb
  )
  into creatable
  from (
    select version_candidate.id, version_candidate.created_at
    from platform_private.cms_content_type_versions version_candidate
    where version_candidate.owner_id = acting_party_id
      and version_candidate.state::text = 'active'
      and exists (
        select 1
        from platform_private.cms_schema_artifacts artifact
        where artifact.id = version_candidate.schema_artifact_id
          and artifact.content_type_version_id = version_candidate.id
          and artifact.owner_id = version_candidate.owner_id
          and artifact.artifact_hash = version_candidate.definition_hash
          and artifact.state::text = 'compiled'
      )
    order by version_candidate.created_at desc, version_candidate.id desc
  ) candidate;

  -- With the query version: the selection requires it and must equal it.  An
  -- off-registry or foreign version is concealed as NOT_FOUND, never resolved
  -- to an arbitrary creatable type.
  if version_id is not null then
    select * into version_row
    from platform_private.cms_content_type_versions candidate
    where candidate.id = version_id
      and candidate.owner_id = acting_party_id
      and candidate.state::text = 'active';
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if not exists (
      select 1
      from platform_private.cms_schema_artifacts artifact
      where artifact.id = version_row.schema_artifact_id
        and artifact.content_type_version_id = version_row.id
        and artifact.owner_id = version_row.owner_id
        and artifact.artifact_hash = version_row.definition_hash
        and artifact.state::text = 'compiled'
    ) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;

    selected := platform_private.cms_authoring_context_type(version_row.id);
    if selected is null then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;

    -- Fields require the selection: the projection is exactly this version's
    -- declared fields, bounded at 128.
    select count(*)::integer into field_count
    from platform_private.cms_field_definition_versions field_candidate
    where field_candidate.content_type_version_id = version_row.id
      and field_candidate.owner_id = version_row.owner_id
      and field_candidate.state = 'active';

    if field_count > 128 then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;

    select coalesce(
      pg_catalog.jsonb_agg(
        platform_private.cms_authoring_context_field(field.id)
        order by field.field_key, field.stable_field_id
      ),
      '[]'::jsonb
    )
    into fields
    from (
      select field_candidate.id, field_candidate.field_key,
             field_candidate.stable_field_id
      from platform_private.cms_field_definition_versions field_candidate
      where field_candidate.content_type_version_id = version_row.id
        and field_candidate.owner_id = version_row.owner_id
        and field_candidate.state = 'active'
      order by field_candidate.field_key, field_candidate.stable_field_id
    ) field;
  end if;

  return pg_catalog.jsonb_build_object(
    'creatableTypes', creatable,
    'selectedType', selected,
    'fields', fields
  );
end;
$body$;

comment on function platform_private.cms_get_entry_authoring_context(jsonb) is
  'CMS-03B-14 author-safe authoring-context preparation read. Server-derives the acting party and author/editor scope, returns up to 32 of the party''s active compiled creatable types, and with contentTypeVersionId returns exactly that party-owned active compiled version as selectedType plus its bounded (<=128) field projection; a non-UUID selector is a structural refusal, an off-registry/foreign version is concealed as NOT_FOUND, a caller-supplied schema identity is refused, and the read grants no cms.schema_registry.read and emits no audit/outbox row.';

-- The browser-facing named RPC stays service-role only; the wrapper restores
-- the transaction-local RPC-context flag so the read cannot leak the write gate
-- into the rest of the transaction.
create or replace function platform_api.cms_get_entry_authoring_context(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_get_entry_authoring_context(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: the private readers name forced-RLS tables, so the owning read is
-- owned by the non-BYPASSRLS definer role and the forced policies apply to
-- every statement it runs.  ALTER FUNCTION ... OWNER TO requires CREATE on the
-- function's schema for the new owner, granted for this transaction only.  The
-- authoring-context reach check reads identity_private.membership_tenure and
-- identity_private.organization_actor_grant under those forced policies; the
-- verified subject branch of the session-scope policy admits the confirmed
-- member who owns the acting party, while the grant branch holds at row level,
-- so the existing SELECT grant and the policies suffice.  (The two pure
-- projection helpers read no forced table and stay under the platform owner.)
grant create on schema platform_private to wejammin_cms_definer;

alter function platform_private.cms_get_entry_authoring_context(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_authoring_context_type(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_authoring_context_field(uuid)
  owner to wejammin_cms_definer;

revoke create on schema platform_private from wejammin_cms_definer;

-- Worker-only surface: the named read is service_role only and is never
-- reachable from a browser role, and the private worker functions stay
-- unreachable from every role.  The revokes run after the ownership move so the
-- recreated wrapper's CREATE-time PUBLIC EXECUTE default cannot survive.
revoke all on function platform_api.cms_get_entry_authoring_context(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_get_entry_authoring_context(jsonb) to service_role;

revoke all on function platform_private.cms_get_entry_authoring_context(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_authoring_context_type(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_authoring_context_field(uuid)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_authoring_context_type(uuid)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_authoring_context_field(uuid)
  to wejammin_cms_definer;

commit;
