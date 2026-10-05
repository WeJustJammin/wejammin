-- Slice 09 P240 (AC081 / AC203): "Relation reads recheck current target
-- visibility and apply omit, block, or the exact opaque placeholder without
-- copying target authority or private fields", and "placeholder fallback is
-- exactly {status: unavailable, reason: unavailable} with no target identifier,
-- type, key, title, data, or existence distinction".
--
-- cms_get_entry_draft (CMS-03B-11) refused a placeholder-policy relation whose
-- target was unavailable with DEPENDENCY_UNAVAILABLE, so the opaque response the
-- registry promises was unproducible.  The unavailable placeholder policy now
-- returns, in the unavailable target's place, one relation carrying only
-- fieldId, fieldDefinitionId, position, onUnavailable 'placeholder' and the
-- fixed unavailable object; `omit` still disappears and `block` still refuses
-- the whole read.  The body is otherwise identical to its previous definition;
-- the signature, grants and every other branch are unchanged.  Forward-only.
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
$function$;

commit;
