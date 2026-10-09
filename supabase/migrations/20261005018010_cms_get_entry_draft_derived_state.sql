-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085): the CMS-03B-11 authorized draft read answers the DERIVED
-- EntryRevisionState of the entry's current draft revision.
--
-- `EntryDraftDetailResource.state` was copied from the physical
-- cms_entry_revisions.state, which is the constant `draft` (20261005018090).  It is
-- now platform_private.cms_revision_effective_state of the revision the read
-- returns: `submitted` while a review is open, `approved`, `rejected`, `scheduled`,
-- `published`, and `draft` for a revision with no review or whose latest review
-- was invalidated.  Nothing else changes: the body below is the 20261005010200
-- definition with that one projection replaced (CREATE OR REPLACE keeps the
-- owner, the search_path, the grants and the comment of the function).
-- Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_get_entry_draft(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  unavailable_blocked boolean;
  open_conflict jsonb;
  fields jsonb;
  relations jsonb;
  stored_values jsonb;
  stored_hash text;
  projected_values jsonb;
  projected_hash text;
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
     and p_request->>'locale' is distinct from resolved_locale then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Fail-closed schema typing: the draft's pinned schema version must still
  -- resolve to the entry's own content type and owner, be active, and be backed
  -- by its compiled artifact whose hash is the version definition hash (the same
  -- lineage the revision write verifies).  Without a resolvable active schema
  -- the stored values cannot be schema-typed, so the read refuses rather than
  -- serving an untyped envelope.  Resolving the active schema registry is a
  -- read dependency, hence the dependency token.
  select * into schema_version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.id = revision_row.schema_version_id
    and candidate.content_type_id = entry_row.content_type_id
    and candidate.owner_id = entry_row.owner_id
    and candidate.state = 'active';
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from platform_private.cms_schema_artifacts artifact
    where artifact.id = schema_version_row.schema_artifact_id
      and artifact.content_type_version_id = schema_version_row.id
      and artifact.owner_id = schema_version_row.owner_id
      and artifact.state::text = 'compiled'
      and artifact.artifact_hash = schema_version_row.definition_hash
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select count(*)::integer into field_count
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = revision_row.id
    and field_value.locale = resolved_locale;
  if field_count > 128 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Producer integrity, in two distinct classes.
  --
  -- 1. Absent declaration: every stored value must be bound to the definition
  --    row that declares it on THIS schema version (definition id, stable field
  --    id, version and owner all agreeing).  A value with no such row -- no
  --    definition at all, a stable field id its definition does not declare, or
  --    a definition of another version/owner -- is corrupt storage and refuses.
  --    This is deliberately NOT conditioned on the definition existing, so an
  --    undeclared value can never slip past the check by being undeclared.
  if exists (
       select 1
       from platform_private.cms_entry_field_values field_value
       where field_value.revision_id = revision_row.id
         and field_value.locale = resolved_locale
         and (
           field_value.owner_id is distinct from entry_row.owner_id
           or not exists (
             select 1
             from platform_private.cms_field_definition_versions field
             where field.id = field_value.field_definition_id
               and field.stable_field_id = field_value.field_id
               and field.content_type_version_id = schema_version_row.id
               and field.owner_id = entry_row.owner_id
           )
         )
     ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 2. Declared and active: the value that will be projected must be bounded,
  --    valid for its declared field kind and carry the hash of its own value.
  --    A value whose declaring definition is retired or deprecated is NOT a
  --    corrupt-storage failure: it is intentionally omitted from the projection
  --    below and never typed against a definition that no longer governs it.
  --    A null value is legal only as an explicit null/missing provenance
  --    marker, so the byte bound applies to non-null values only.
  if exists (
       select 1
       from platform_private.cms_entry_field_values field_value
       join platform_private.cms_field_definition_versions field
         on field.id = field_value.field_definition_id
        and field.stable_field_id = field_value.field_id
        and field.content_type_version_id = schema_version_row.id
        and field.state = 'active'
       where field_value.revision_id = revision_row.id
         and field_value.locale = resolved_locale
         and (
           (field_value.value is not null and not platform_private.cms_json_bounded(
              field_value.value, 262144, 8, 128, 128
            ))
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

  -- Frozen-revision integrity.  The revision's payload hash is the JCS digest
  -- of EVERY value stored for the revision and locale, retired definitions
  -- included, so it is verified against the complete stored set.  A retired
  -- definition never explains a mismatch: a stored hash that disagrees with its
  -- own stored values is producer corruption either way.
  select coalesce(
           pg_catalog.jsonb_object_agg(
             field_value.field_id::text, field_value.value
           ), '{}'::jsonb)
  into stored_values
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = revision_row.id
    and field_value.locale = resolved_locale;
  stored_hash := platform_private.cms_jcs_sha256(stored_values);
  if pg_catalog.btrim(revision_row.payload_hash::text) is distinct from stored_hash then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Projection: only values whose declaring definition is active on the
  -- resolved schema version are returned.  A value whose definition is retired
  -- or deprecated is intentionally omitted, never projected with stale typing.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fieldId', field_value.field_id,
      'fieldDefinitionId', field_value.field_definition_id,
      'locale', field_value.locale,
      'value', field_value.value,
      'provenance', field_value.provenance::text,
      'valueHash', nullif(pg_catalog.btrim(field_value.value_hash::text), '')
    ) order by field_value.field_id, field_value.locale
  ), '[]'::jsonb),
  coalesce(
    pg_catalog.jsonb_object_agg(field_value.field_id::text, field_value.value),
    '{}'::jsonb)
  into fields, projected_values
  from platform_private.cms_entry_field_values field_value
  join platform_private.cms_field_definition_versions definition_row
    on definition_row.id = field_value.field_definition_id
   and definition_row.stable_field_id = field_value.field_id
   and definition_row.content_type_version_id = schema_version_row.id
   and definition_row.state = 'active'
  where field_value.revision_id = revision_row.id
    and field_value.locale = resolved_locale;

  -- Representation integrity: the returned contentHash is the digest of the
  -- RETURNED projection, so a consumer that recomputes it over the returned
  -- fields always matches.  With no omission it is the verified stored digest.
  if projected_values = stored_values then
    projected_hash := stored_hash;
  else
    projected_hash := platform_private.cms_jcs_sha256(projected_values);
  end if;

  select count(*)::integer into relation_count
  from platform_private.cms_entry_relations relation
  where relation.revision_id = revision_row.id;
  if relation_count > 512 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Relation integrity follows the same two classes as stored values.  Only
  -- the revision payload hash is verified over values; relations are normalized
  -- rows beside the revision (every write path hashes the field value map
  -- only), so a relation can neither enter nor change contentHash.
  --
  -- 1. Absent declaration: every stored relation must be bound to the field
  --    definition that declares it on THIS schema version and owner, and that
  --    definition must be a relation field carrying its immutable 03a
  --    RelationDefinition.  A matching stable field ID is insufficient, and
  --    stored target kind and unavailable policy are evidence, never caller
  --    authority: they must equal the immutable definition.  This holds
  --    whether or not the declaring definition is still active, so retirement
  --    never excuses a relation that no definition declares.
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
           )
         )
     ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 2. Declared and active: the registry projection the active definition
  --    names must still resolve.  A declared relation whose field definition
  --    is retired or deprecated is NOT corrupt storage: it is intentionally
  --    omitted from the projection below, exactly like a value, and its
  --    projection registry entry is not consulted.
  if exists (
       select 1
       from platform_private.cms_entry_relations relation
       join platform_private.cms_field_definition_versions field
         on field.id = relation.field_definition_id
        and field.stable_field_id = relation.field_id
        and field.content_type_version_id = schema_version_row.id
        and field.state = 'active'
       join platform_private.cms_relation_definitions definition
         on definition.field_definition_id = field.id
       where relation.revision_id = revision_row.id
         and not platform_private.cms_projection_registry_valid(
           definition.target_kind,
           definition.target_type,
           definition.projection_key
         )
     ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Enforce the immutable per-field upper bound before applying `omit`.
  -- Otherwise concealed surplus targets could make corrupt stored evidence
  -- look like a valid one-to-one or bounded-many relation in the response.
  -- The bound is a structural invariant of the stored rows, so it holds for
  -- every declared relation regardless of its definition's lifecycle state.
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
  -- concealed, or stale target follows the registry's immutable unavailable
  -- policy: `omit` disappears entirely, `block` refuses the whole read with the
  -- generic unavailable outcome, and `placeholder` is the one fixed opaque
  -- object {status:'unavailable', reason:'unavailable'}.  A placeholder entry
  -- copies nothing of the target (no id, kind, version, key, title or data):
  -- only the field binding, the position and the policy, so an absent,
  -- concealed, stale, retyped or unauthorized target is indistinguishable.  No
  -- target ID enters an error.
  select coalesce(jsonb_agg(
    case when resolved.visible then
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
      )
    else
      jsonb_build_object(
        'fieldId', relation.field_id,
        'fieldDefinitionId', relation.field_definition_id,
        'position', relation.position,
        'onUnavailable', 'placeholder',
        'unavailable', jsonb_build_object('status', 'unavailable', 'reason', 'unavailable')
      )
    end
    order by relation.position, relation.field_id,
      case when resolved.visible then relation.target_id end, relation.id
  ) filter (where resolved.visible or relation.on_unavailable = 'placeholder'), '[]'::jsonb),
  coalesce(bool_or(
    not resolved.visible and relation.on_unavailable = 'block'
  ), false)
  into relations, unavailable_blocked
  from platform_private.cms_entry_relations relation
  join platform_private.cms_field_definition_versions declaring_field
    on declaring_field.id = relation.field_definition_id
   and declaring_field.stable_field_id = relation.field_id
   and declaring_field.content_type_version_id = schema_version_row.id
   and declaring_field.state = 'active'
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

  if unavailable_blocked then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- CMS-03B-02 conflict-discovery seam.  The read surfaces only the bounded
  -- identity of the entry's currently open conflict -- its opaque id, its CAS
  -- version and its conflict hash -- so an authorized reader can bind the
  -- resolution target after a moved-base 409.  The proposed values, the
  -- resolver and every ownership identifier stay in the private record and are
  -- never projected.  No open conflict is an explicit JSON null, never a
  -- fabricated object.
  select jsonb_build_object(
    'conflictId', conflict.id,
    'version', conflict.version::text,
    'conflictHash', pg_catalog.btrim(conflict.conflict_hash::text)
  )
  into open_conflict
  from platform_private.cms_conflict_records conflict
  where conflict.entry_id = entry_row.id
    and conflict.owner_id = entry_row.owner_id
    and conflict.state = 'open'
  order by conflict.created_at desc, conflict.id
  limit 1;

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
    'state', platform_private.cms_revision_effective_state(revision_row.id),
    'locale', revision_row.locale,
    'revisionNumber', revision_row.revision_number::text,
    'schemaVersionId', revision_row.schema_version_id::text,
    'contentHash', projected_hash,
    'validationState', revision_row.validation_state::text,
    'openConflict', coalesce(open_conflict, 'null'::jsonb),
    'fields', fields,
    'relations', relations
  );
end;
$function$;

commit;
