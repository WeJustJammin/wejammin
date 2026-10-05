-- Slice 10 CMS editorial entry authority RPCs (BE03b CMS-03B-10 / CMS-03B-11).
--
-- Forward-only migration.  It owns no tables: the five entries-revision tables
-- live in 20260926090000_cms_entry_revision_authority.sql and the six editorial
-- support tables plus the conflict record live in the 20260927* lane owned by
-- /root/s10_db_tables.  This file adds the capability registry widening, the
-- fail-closed entry authority helpers, and the two protected RPCs with their
-- service-role-only wrappers.
--
-- Authority model (owner-approved plan 1):
--   * authority is derived server-side from the resolved actor (auth user) and
--     the resolved acting party, plus a live registered capability grant and,
--     for reads/edits of an existing entry, an active entry assignment row.
--   * nothing in the request may assert authority.  A caller presenting a
--     capability key is never sufficient: the registry, the confirmed
--     membership tenure, the active organization grant, and (for an existing
--     entry) the active assignment must all be proven or the helper returns
--     null and the RPC fails closed.
--   * no grant, binding, or identity row is seeded here.  Fixtures seed those
--     inside rollback-safe pgTAP transactions only.

begin;

-- ---------------------------------------------------------------------------
-- 1. Closed capability registry: add the two BE03b editorial keys at v1.
--    The pre-existing five keys are preserved verbatim so the 03a surface is
--    unchanged.  cms_require_read() is intentionally NOT modified: it stays
--    scoped to the 03a registry capabilities and this migration adds a
--    separate, narrowly scoped entry helper instead.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_capability_registry_valid(p_key text, p_version bigint default null)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select exists (
    select 1
    from (values
      ('cms.schema_designer', 1::bigint),
      ('cms.schema_registry.read', 1::bigint),
      ('cms.public_content.read', 1::bigint),
      ('cms.content.article', 1::bigint),
      ('cms.article.card', 1::bigint),
      ('cms.author', 1::bigint),
      ('cms.editor', 1::bigint),
      ('cms.reviewer', 1::bigint)
    ) as registry(key, version)
    where registry.key = p_key
      and (p_version is null or registry.version = p_version)
  )
$body$;

comment on function platform_private.cms_capability_registry_valid(text, bigint) is
  'Closed capability registry. BE03b Slice 10 adds cms.author/cms.editor/cms.reviewer at v1; membership is still a closed allowlist, never caller input.';

-- ---------------------------------------------------------------------------
-- 2. Editorial workflow-policy evidence seam (fail-closed).
--
--    BE03b requires CMS-03B-10 to compare the request workflowPolicy against a
--    server-side editorial workflow-policy record (key, version, policyHash,
--    riskClass, requiredDecisionCount, requiredCapabilities,
--    approvalEvidenceHash) that is DISTINCT from the 03a activation envelope
--    stored on cms_content_type_versions.  No canonical source for that record
--    exists yet: 03a stores only activation_workflow_policy_*, and
--    cms_workflow_registry_valid() allowlists key/version with no hash, risk
--    class, or approval evidence.  This projection therefore returns NULL so
--    cms_create_entry fails closed instead of trusting a caller-supplied hash.
--    It is the single seam a forward owner-approved registry migration must
--    replace.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_editorial_workflow_policy_evidence(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select null::jsonb
  where p_version_id is not null
$body$;

comment on function platform_private.cms_editorial_workflow_policy_evidence(uuid) is
  'FAIL-CLOSED seam. Returns the server-side editorial workflow-policy evidence for a content-type version, or NULL when no owner-approved projection exists. NULL makes cms_create_entry raise DEPENDENCY_UNAVAILABLE; it never falls back to caller input.';

-- ---------------------------------------------------------------------------
-- 3. Server-derived entry authority helpers.
-- ---------------------------------------------------------------------------

-- Returns the proven authority origin for one capability key, or NULL when any
-- link in the chain is unproven.  Restricted to the two BE03b editorial keys so
-- it can never widen the 03a read surface.
create or replace function platform_private.cms_authority_origin(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_capability_key text,
  p_entry_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved_person_id uuid;
  grant_present boolean;
  assignment_present boolean;
begin
  if p_capability_key is null
     or p_capability_key not in ('cms.author', 'cms.editor', 'cms.reviewer')
     or not platform_private.cms_capability_registry_valid(p_capability_key, 1) then
    return null;
  end if;
  if p_actor_id is null or p_acting_party_id is null then
    return null;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    return null;
  end if;
  select exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = p_acting_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code = p_capability_key
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) into grant_present;
  if not grant_present then
    return null;
  end if;
  if p_entry_id is null then
    return 'grant';
  end if;
  select exists (
    select 1
    from platform_private.cms_entry_assignments assignment
    where assignment.entry_id = p_entry_id
      and assignment.assignee_person_id = resolved_person_id
      and assignment.capability_key = p_capability_key
      and assignment.state = 'active'
  ) into assignment_present;
  if not assignment_present then
    return null;
  end if;
  return 'assignment';
end;
$body$;

comment on function platform_private.cms_authority_origin(uuid, uuid, text, uuid) is
  'Fail-closed authority resolver: returns grant/assignment only when the registry key, confirmed tenure, active grant, and (for an existing entry) active assignment are all proven. Never honours a caller-presented key.';

-- Requires a proven origin for at least one of p_capabilities and returns the
-- capability key that matched; otherwise raises the exact FORBIDDEN token.
create or replace function platform_private.cms_require_entry_capability(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_capabilities text[],
  p_entry_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate text;
begin
  if p_capabilities is null or cardinality(p_capabilities) = 0 then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  foreach candidate in array p_capabilities loop
    if platform_private.cms_authority_origin(
      p_actor_id, p_acting_party_id, candidate, p_entry_id
    ) is not null then
      return candidate;
    end if;
  end loop;
  raise exception 'FORBIDDEN' using errcode = 'P0001';
end;
$body$;

comment on function platform_private.cms_require_entry_capability(uuid, uuid, text[], uuid) is
  'Raises FORBIDDEN unless a registered cms.author/cms.editor grant (plus an active entry assignment when p_entry_id is given) is proven for the server-resolved actor and acting party. Returns the matched capability key.';

-- True when the resolved actor holds a confirmed membership in p_owner_party_id.
-- Used only to choose between concealment (NOT_FOUND) and a visible-but-unscoped
-- refusal (FORBIDDEN); it grants nothing on its own.
create or replace function platform_private.cms_entry_tenant_visible(
  p_actor_id uuid,
  p_owner_party_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved_person_id uuid;
begin
  if p_actor_id is null or p_owner_party_id is null then
    return false;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    return false;
  end if;
  return exists (
    select 1
    from identity_private.membership_tenure tenure
    where tenure.organization_id = p_owner_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
  );
end;
$body$;

comment on function platform_private.cms_entry_tenant_visible(uuid, uuid) is
  'True when the server-resolved actor is a confirmed member of the entry-owning party. Selects concealment vs. refusal only; grants no capability.';

-- Types one stored draft field value against the active schema version.  The
-- value must be declared by that version and its JSON shape must match the 03a
-- field kind (short_text/long_text/rich_text/enum/taxonomy -> string, boolean,
-- integer -> integral number, decimal -> number, object/list -> their container,
-- media/relation -> a string, array, or object reference), with the declared
-- minLength/maxLength/minimum/maximum/enumValues constraints re-applied.  A SQL
-- NULL or JSON null is not a value: it is legal only as an explicit_null or
-- missing provenance marker for a declared field.  This is deliberately not the
-- 03a manifest validator, which types a field *definition* rather than an entry
-- *value*.  Both initial-entry creation and draft-detail reads use this gate:
-- an invalid value is rejected before a revision can be inserted or served.
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
  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then
    return p_provenance in ('explicit_null', 'missing')
      and exists (
        select 1
        from platform_private.cms_field_definition_versions field
        where field.stable_field_id = p_field_id
          and field.content_type_version_id = p_schema_version_id
      );
  end if;

  select * into field_row
  from platform_private.cms_field_definition_versions field
  where field.stable_field_id = p_field_id
    and field.content_type_version_id = p_schema_version_id;
  if not found then
    return false;
  end if;

  value_type := pg_catalog.jsonb_typeof(p_value);
  if field_row.kind in ('short_text', 'long_text', 'rich_text', 'enum', 'taxonomy')
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
  if field_row.kind = 'date'
     and (value_type <> 'string'
          or (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
    return false;
  end if;
  if field_row.kind = 'datetime'
     and (value_type <> 'string'
          or (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$') then
    return false;
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

comment on function platform_private.cms_draft_field_value_valid(uuid, uuid, jsonb, text) is
  'True when a draft value is declared by the pinned schema version and matches its 03a field kind plus declared length/numeric/enum constraints. Fail-closed typing gate for CMS-03B-10 create and CMS-03B-11 draft read.';

-- Recomputes the draft content hash from the stored locale-scoped values.  The
-- preimage is the RFC 8785/JCS canonical JSON of the value map keyed by stable
-- field id, which is the exact projection CMS-03B-10 writes at create.  The
-- draft read recomputes this and refuses to serve a revision whose frozen
-- payload_hash no longer matches its own values, so a drifted or tampered
-- revision can never be re-served under a plausible hash.
--
-- BE03a/BE03b do not freeze a byte-level preimage for the revision content hash
-- (the IA model names the column only), so this projection is a lane-defined
-- seam that must be ratified or replaced by an owner-approved definition when
-- one exists; it is deliberately identical to the create-time projection so the
-- two surfaces cannot disagree.
create or replace function platform_private.cms_draft_content_hash(
  p_revision_id uuid,
  p_locale text
)
returns text
language sql
stable
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(
    coalesce(projected.values, '{}'::jsonb)
  )
  from (
    select pg_catalog.jsonb_object_agg(
             field_value.field_id::text, field_value.value
           ) as values
    from platform_private.cms_entry_field_values field_value
    where field_value.revision_id = p_revision_id
      and field_value.locale = p_locale
  ) projected
$body$;

comment on function platform_private.cms_draft_content_hash(uuid, text) is
  'RFC 8785/JCS SHA-256 (lowercase hex) of the stable-field-id keyed value map for one revision locale. Same preimage projection CMS-03B-10 writes; used by CMS-03B-11 to verify the frozen content hash.';

-- ---------------------------------------------------------------------------
-- 4. CMS-03B-11 cms_get_entry_draft: authorized draft detail read.
--    Writes nothing and emits no audit or outbox row.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_get_entry_draft(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  entry_row platform_private.cms_content_entries%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  schema_version_row platform_private.cms_content_type_versions%rowtype;
  entry_id uuid;
  resolved_locale text;
  field_count integer;
  relation_count integer;
  unavailable_non_omit boolean;
  fields jsonb;
  relations jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId']::text[],
    array['entryId', 'locale', 'context', 'correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  if not platform_private.cms_valid_uuid(p_request->>'entryId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request ? 'locale'
     and p_request->'locale' <> 'null'::jsonb
     and coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  entry_id := (p_request->>'entryId')::uuid;

  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = entry_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Authority: a registered grant keyed to the acting party AND an active
  -- assignment on this entry.  A caller that presents the key without the
  -- grant/assignment is refused exactly like a caller that presents nothing.
  if platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.editor', entry_id
     ) is null
     and platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.author', entry_id
     ) is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if entry_row.current_draft_revision_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into revision_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = entry_row.current_draft_revision_id
    and candidate.entry_id = entry_row.id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- The draft detail is scoped to the draft revision's locale.  An explicitly
  -- requested locale that does not address this draft is absent, never
  -- fabricated by falling back to another locale's values.
  resolved_locale := revision_row.locale;
  if p_request ? 'locale'
     and p_request->'locale' <> 'null'::jsonb
     and p_request->>'locale' is distinct from resolved_locale then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Fail-closed schema typing: the draft's pinned schema version must still
  -- resolve to the entry's content type and be active.  Without a resolvable
  -- active schema the stored values cannot be schema-typed, so the read refuses
  -- rather than serving an untyped envelope.  Resolving the active schema
  -- registry is a read dependency, hence the dependency token.
  select * into schema_version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.id = revision_row.schema_version_id
    and candidate.content_type_id = entry_row.content_type_id
    and candidate.state = 'active';
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select count(*)::integer into field_count
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = revision_row.id
    and field_value.locale = resolved_locale;
  if field_count > 128 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Every stored value must still be declared by the active schema version and
  -- bounded, so an untyped row or an oversized document cannot be projected as
  -- contract output.  A null value is legal only as an explicit null/missing
  -- provenance marker, so the bound applies to non-null values only.
  if exists (
       select 1
       from platform_private.cms_entry_field_values field_value
       where field_value.revision_id = revision_row.id
         and field_value.locale = resolved_locale
         and (
           not exists (
             select 1
             from platform_private.cms_field_definition_versions field
             where field.id = field_value.field_definition_id
               and field.stable_field_id = field_value.field_id
               and field.content_type_version_id = schema_version_row.id
           )
           or (
             field_value.value is not null
             and not platform_private.cms_json_bounded(
               field_value.value, 262144, 8, 128, 128
             )
           )
           or not platform_private.cms_draft_field_value_valid(
             schema_version_row.id,
             field_value.field_id,
             field_value.value,
             field_value.provenance::text
           )
           or pg_catalog.btrim(field_value.value_hash::text) is distinct from
             case
               when field_value.value is null
                    or pg_catalog.jsonb_typeof(field_value.value) = 'null'
                 then null
               else platform_private.cms_jcs_sha256(field_value.value)
             end
         )
     ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  if pg_catalog.btrim(revision_row.payload_hash::text) is distinct from
     platform_private.cms_draft_content_hash(revision_row.id, resolved_locale) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fieldId', field_value.field_id,
      'fieldDefinitionId', field_value.field_definition_id,
      'locale', field_value.locale,
      'value', field_value.value,
      'provenance', field_value.provenance::text,
      'valueHash', nullif(pg_catalog.btrim(field_value.value_hash::text), '')
    ) order by field_value.field_id, field_value.locale
  ), '[]'::jsonb) into fields
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = revision_row.id
    and field_value.locale = resolved_locale;

  select count(*)::integer into relation_count
  from platform_private.cms_entry_relations relation
  where relation.revision_id = revision_row.id;
  if relation_count > 512 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Relation evidence is only meaningful against the active schema version.
  -- A matching stable field ID is insufficient: the field must actually be a
  -- relation and carry its immutable 03a RelationDefinition.  Stored target
  -- kind and unavailable policy are evidence, never caller authority.
  if exists (
       select 1
       from platform_private.cms_entry_relations relation
       where relation.revision_id = revision_row.id
         and (
           relation.owner_id is distinct from entry_row.owner_id
           or not exists (
           select 1
           from platform_private.cms_field_definition_versions field
           join platform_private.cms_relation_definitions definition
             on definition.field_definition_id = field.id
           where field.id = relation.field_definition_id
             and field.stable_field_id = relation.field_id
             and field.content_type_version_id = schema_version_row.id
             and field.kind = 'relation'
             and field.owner_id = entry_row.owner_id
             and definition.owner_id = entry_row.owner_id
             and definition.target_kind = relation.target_kind
             and definition.on_unavailable = relation.on_unavailable
             and platform_private.cms_projection_registry_valid(
               definition.target_kind,
               definition.target_type,
               definition.projection_key
             )
           )
         )
     ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Enforce the immutable per-field upper bound before applying `omit`.
  -- Otherwise concealed surplus targets could make corrupt stored evidence
  -- look like a valid one-to-one or bounded-many relation in the response.
  if exists (
       select 1
       from platform_private.cms_entry_relations relation
       join platform_private.cms_relation_definitions definition
         on definition.field_definition_id = relation.field_definition_id
       where relation.revision_id = revision_row.id
       group by relation.field_definition_id,
                definition.max_count,
                definition.cardinality
       having count(*) > definition.max_count
          or (definition.cardinality = 'one' and count(*) > 1)
     ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- A stored relation is evidence of an intended binding, not proof that its
  -- target is currently readable.  Resolve target type, tenant, lifecycle,
  -- version, and actor assignment before including its identity.  An absent,
  -- concealed, or stale target follows the registry's unavailable policy:
  -- `omit` disappears entirely; the other policies refuse generically until
  -- their opaque response contract is resolved.  No target ID enters an error.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fieldId', relation.field_id,
      'fieldDefinitionId', relation.field_definition_id,
      'targetKind', relation.target_kind,
      'targetId', relation.target_id,
      'expectedTargetVersion', case
        when relation.expected_target_version is null then null
        else relation.expected_target_version::text end,
      'position', relation.position,
      'onUnavailable', relation.on_unavailable,
      'unavailable', null
    ) order by relation.position, relation.field_id, relation.target_id
  ) filter (where resolved.visible), '[]'::jsonb),
  coalesce(bool_or(
    not resolved.visible and relation.on_unavailable <> 'omit'
  ), false)
  into relations, unavailable_non_omit
  from platform_private.cms_entry_relations relation
  join platform_private.cms_relation_definitions definition
    on definition.field_definition_id = relation.field_definition_id
  cross join lateral (
    select relation.target_kind = 'content'
      and exists (
        select 1
        from platform_private.cms_content_entries target
        join platform_private.cms_content_types target_type
          on target_type.id = target.content_type_id
        where target.id = relation.target_id
          and target.owner_id = entry_row.owner_id
          and target.owner_party_id = entry_row.owner_party_id
          and target.lifecycle = 'active'
          and (
            relation.expected_target_version is null
            or target.version = relation.expected_target_version
          )
          and target_type.owner_id = entry_row.owner_id
          and target_type.state = 'active'
          and target_type.type_key = definition.target_type
          and (
            platform_private.cms_authority_origin(
              actor_id, acting_party_id, 'cms.editor', target.id
            ) is not null
            or platform_private.cms_authority_origin(
              actor_id, acting_party_id, 'cms.author', target.id
            ) is not null
          )
      ) as visible
  ) resolved
  where relation.revision_id = revision_row.id;

  if unavailable_non_omit then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'entry', jsonb_build_object(
      'id', entry_row.id,
      'version', entry_row.version::text,
      'createdAt', platform_private.auth_iso_time(entry_row.created_at),
      'updatedAt', platform_private.auth_iso_time(entry_row.updated_at)
    ),
    'revision', jsonb_build_object(
      'id', revision_row.id,
      'version', revision_row.version::text,
      'createdAt', platform_private.auth_iso_time(revision_row.created_at),
      'updatedAt', platform_private.auth_iso_time(revision_row.updated_at)
    ),
    'lifecycle', entry_row.lifecycle::text,
    'state', revision_row.state::text,
    'locale', revision_row.locale,
    'contentHash', pg_catalog.btrim(revision_row.payload_hash::text),
    'validationState', revision_row.validation_state::text,
    'fields', fields,
    'relations', relations
  );
end;
$body$;

comment on function platform_private.cms_get_entry_draft(jsonb) is
  'CMS-03B-11 authorized draft detail read. Requires a server-derived cms.editor/cms.author grant plus an active entry assignment; writes nothing and emits no audit/outbox row.';

create or replace function platform_api.cms_get_entry_draft(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_get_entry_draft(p_request)
$body$;

-- ---------------------------------------------------------------------------
-- 5. CMS-03B-10 cms_create_entry: atomic entry + first draft + assignment.
--
--    Every evidence class is re-read from the registry and compared to the
--    request.  The one class that has no registry source yet -- the editorial
--    workflow-policy projection -- fails closed with DEPENDENCY_UNAVAILABLE
--    before any insert, so no partial entry can be minted from a caller-supplied
--    policy hash.  The transaction rollback also discards the idempotency
--    reservation taken for the attempt.
-- ---------------------------------------------------------------------------
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
    and candidate.content_type_id = (p_request->>'contentTypeId')::uuid;
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
  'CMS-03B-10 atomic entry + first draft + creator assignment. Server-derives owner/acting/assignee, requires a registered cms.author/cms.editor grant, re-reads every evidence class, and fails closed with DEPENDENCY_UNAVAILABLE while the editorial workflow-policy projection has no registry source.';

create or replace function platform_api.cms_create_entry(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_create_entry(p_request)
$body$;

-- ---------------------------------------------------------------------------
-- 6. Privileges.  The worker boundary is service_role only; the browser roles
--    and the private schema functions stay unreachable.  03a granted its
--    wrappers to authenticated as well, so this is a deliberate narrowing.
-- ---------------------------------------------------------------------------
revoke all on function platform_api.cms_create_entry(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_get_entry_draft(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_create_entry(jsonb) to service_role;
grant execute on function platform_api.cms_get_entry_draft(jsonb) to service_role;

revoke all on function platform_private.cms_create_entry(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_get_entry_draft(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_authority_origin(uuid, uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_require_entry_capability(uuid, uuid, text[], uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_entry_tenant_visible(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_editorial_workflow_policy_evidence(uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_draft_field_value_valid(uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_draft_content_hash(uuid, text) from public, anon, authenticated, service_role;

commit;
