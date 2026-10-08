-- Slice 10 gap resolution (P2-S10-AC-005/AC-031/AC-073/AC-074/AC-078, audit WP-A1
-- and WP-A2): the shared helpers of relation authoring and of the typed 422
-- reasons.  The three write commands that use them (cms_create_entry,
-- cms_create_revision, cms_resolve_conflict) are redefined in
-- 20261005011700; the conflict-detail relation sides in 20261005011800.
--
-- Typed reasons.  The reason token is the WHOLE P0001 message
-- (`raise exception '<token>' using errcode = 'P0001'`), the convention lanes
-- B, D and F already use (comparison_too_large, migration_chain_mismatch,
-- taxonomy_source_unavailable).  cms_draft_value_refusal classifies a value the
-- pinned-schema draft gate refused:
--   rich_text_not_canonical   a rich_text value that is not a canonical
--                             rich_text.v1 document (BE03b:1154); a canonical
--                             document that merely violates minLength/maxLength
--                             stays VALIDATION_FAILED;
--   object_kind_unspecified   an object field with no typed structure (BE03b:1053);
--   object_property_invalid   an object value that does not satisfy its declared
--                             structure or property constraints (BE03b:1053);
--   VALIDATION_FAILED         every other refusal, including a JSON null.
-- cms_require_draft_value_valid raises the result.
--
-- Relation authoring.  A relation value is
--   { targets: [ { targetId, expectedTargetVersion | null } ] }
-- (BE03b:1049).  Relations are normalized EntryRelation rows outside the revision
-- payload hash: a relation is never an EntryFieldValue and never enters
-- contentHash.  cms_resolve_relation_targets resolves one field value against
-- its immutable 03a RelationDefinition and returns the rows to insert
-- (targetKind, onUnavailable and the field definition come only from the
-- definition): the count is bounded by min_count/max_count and 512, targets are
-- unique, a non-empty DOMAIN-kind value fails closed with
-- `relation_target_unavailable` (no domain projection provider resolves targets
-- yet), and a content target must be readable by the caller exactly as the draft
-- read requires (active entry of the owning party, active declared target type,
-- caller author/editor authority over it); anything else, including a stale
-- expectedTargetVersion pin, is the uniform VALIDATION_FAILED so a write is never
-- an existence oracle.  A pin on the entry itself is re-pinned to the version
-- being committed (the carry-forward rule of 20261005011000).
-- cms_relation_value_canonical, cms_revision_relation_values and
-- cms_relation_value_visible give conflict detection and conflict detail one
-- canonical comparable relation value (self pins normalised to null).
-- cms_authored_value_kind_supported now admits relation, so all fourteen kinds
-- are writable.
--
-- Editorial workflow-policy evidence (audit WP-A3, lane D unresolved).  BE03b:546
-- re-fetches the editorial workflow-policy evidence before save, review, restore,
-- preview, schedule execution and publication.  cms_create_revision carried the
-- whole validation inline and cms_restore_revision carried none, so a restore
-- never proved the policy projection.  cms_editorial_workflow_policy_valid is
-- that validation as one predicate (the projection must exist and be exactly the
-- seven-key evidence with a registered key, a 1..19-digit version, 64-hex hashes,
-- an ordinary/protected risk class, 1..8 decisions, at most 16 registered
-- capabilities, and a protected policy needs two decisions and a capability):
-- cms_create_revision (20261005011700) now calls it instead of the inline copy
-- and cms_restore_revision (20261005011900) calls it too.  Forward-only.
begin;

create or replace function platform_private.cms_authored_value_kind_supported(p_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select coalesce(p_kind in (
    'short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
    'date', 'datetime', 'enum', 'relation', 'taxonomy', 'media', 'object', 'list'
  ), false)
$body$;

comment on function platform_private.cms_authored_value_kind_supported(text) is
  'Kinds the append and conflict-resolution commands may store: every field kind (relation joined once its binding and target resolution exist; its value is written to EntryRelation rows, never to EntryFieldValue). An unknown or null kind is never writable. Pure predicate.';

-- ---------------------------------------------------------------------------
-- Typed reasons.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_draft_value_refusal(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_provenance text
)
returns text
language plpgsql
stable
set search_path = ''
as $body$
declare
  field_row platform_private.cms_field_definition_versions%rowtype;
begin
  if platform_private.cms_draft_field_value_valid(
    p_schema_version_id, p_field_id, p_value, p_provenance
  ) then
    return null;
  end if;
  -- A null or missing value is decided by provenance, never by a grammar.
  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then
    return 'VALIDATION_FAILED';
  end if;
  select * into field_row
  from platform_private.cms_field_definition_versions field
  where field.stable_field_id = p_field_id
    and field.content_type_version_id = p_schema_version_id;
  if not found then
    return 'VALIDATION_FAILED';
  end if;
  if field_row.kind = 'rich_text' then
    if not coalesce(platform_private.cms_rich_text_v1_valid(p_value), false) then
      return 'rich_text_not_canonical';
    end if;
    return 'VALIDATION_FAILED';
  end if;
  if field_row.kind = 'object' then
    if field_row.constraints->'objectStructure' is null
       or pg_catalog.jsonb_typeof(field_row.constraints->'objectStructure') = 'null' then
      return 'object_kind_unspecified';
    end if;
    if not coalesce(
         platform_private.cms_object_value_valid(
           field_row.constraints->'objectStructure', p_value
         ), false
       ) then
      return 'object_property_invalid';
    end if;
    return 'VALIDATION_FAILED';
  end if;
  return 'VALIDATION_FAILED';
end;
$body$;

comment on function platform_private.cms_draft_value_refusal(uuid, uuid, jsonb, text) is
  'Classifies a value the pinned-schema draft gate refuses into its Worker-readable reason: rich_text_not_canonical (a rich_text value that is not a canonical rich_text.v1 document), object_kind_unspecified (an object field with no typed structure), object_property_invalid (an object value that violates the declared structure or its property constraints), otherwise VALIDATION_FAILED. NULL when the value is valid.';

create or replace function platform_private.cms_require_draft_value_valid(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_provenance text
)
returns void
language plpgsql
stable
set search_path = ''
as $body$
declare
  refusal text;
begin
  refusal := platform_private.cms_draft_value_refusal(
    p_schema_version_id, p_field_id, p_value, p_provenance
  );
  if refusal is not null then
    raise exception '%', refusal using errcode = 'P0001';
  end if;
end;
$body$;

comment on function platform_private.cms_require_draft_value_valid(uuid, uuid, jsonb, text) is
  'Write-time draft value gate: raises the typed contract error (P0001, the reason token as the message) when the pinned-schema draft gate refuses the value; returns nothing when it is valid.';

-- ---------------------------------------------------------------------------
-- Relation helpers.
-- ---------------------------------------------------------------------------
-- The canonical comparable form of one relation value: every target as
-- { targetId (lower-case UUID), expectedTargetVersion (string or null) }, in
-- request order; a pin on the entry itself is system-managed and normalised to
-- null so a carried self relation never looks like an author edit.  The input
-- must already satisfy the relation shape.
create or replace function platform_private.cms_relation_value_canonical(
  p_value jsonb,
  p_entry_id uuid
)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object('targets', coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'targetId', ((target.value->>'targetId')::uuid)::text,
        'expectedTargetVersion',
          case
            when p_entry_id is not null
                 and (target.value->>'targetId')::uuid = p_entry_id
              then 'null'::jsonb
            when pg_catalog.jsonb_typeof(target.value->'expectedTargetVersion') = 'string'
              then target.value->'expectedTargetVersion'
            else 'null'::jsonb
          end
      ) order by target.ordinality
    )
    from pg_catalog.jsonb_array_elements(p_value->'targets')
      with ordinality as target(value, ordinality)
  ), '[]'::jsonb))
$body$;

comment on function platform_private.cms_relation_value_canonical(jsonb, uuid) is
  'Canonical comparable relation value { targets: [ { targetId, expectedTargetVersion } ] } in request order with a pin on the entry itself normalised to null. Pure.';

-- Canonical relation values of one revision keyed by stable field id, read from
-- its EntryRelation rows in position order (a field with no row is absent).
create or replace function platform_private.cms_revision_relation_values(p_revision_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $body$
  select coalesce(pg_catalog.jsonb_object_agg(grouped.field_id, grouped.value), '{}'::jsonb)
  from (
    select relation.field_id::text as field_id,
           pg_catalog.jsonb_build_object('targets', pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'targetId', relation.target_id::text,
               'expectedTargetVersion',
                 case
                   when relation.expected_target_version is null
                        or relation.target_id = revision.entry_id
                     then 'null'::jsonb
                   else pg_catalog.to_jsonb(relation.expected_target_version::text)
                 end
             ) order by relation.position, relation.id
           )) as value
    from platform_private.cms_entry_relations relation
    join platform_private.cms_entry_revisions revision
      on revision.id = relation.revision_id
    where relation.revision_id = p_revision_id
    group by relation.field_id
  ) grouped
$body$;

comment on function platform_private.cms_revision_relation_values(uuid) is
  'Canonical relation values of one revision keyed by stable field id, from its EntryRelation rows in position order; a pin on the entry itself is normalised to null. Read-only.';

-- True when p_target_id is a readable content target for the caller: an active
-- entry of the acting party whose content type is the active declared target type
-- and over which the caller holds author or editor authority (the draft read
-- predicate).
create or replace function platform_private.cms_relation_target_visible(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_target_id uuid,
  p_target_type text
)
returns boolean
language sql
set search_path = ''
as $body$
  select exists (
    select 1
    from platform_private.cms_content_entries target
    join platform_private.cms_content_types target_type
      on target_type.id = target.content_type_id
    where target.id = p_target_id
      and target.owner_id = p_acting_party_id
      and target.owner_party_id = p_acting_party_id
      and target.lifecycle = 'active'
      and target_type.owner_id = p_acting_party_id
      and target_type.state::text = 'active'
      and target_type.type_key = p_target_type
      and (
        platform_private.cms_authority_origin(
          p_actor_id, p_acting_party_id, 'cms.editor', target.id
        ) is not null
        or platform_private.cms_authority_origin(
          p_actor_id, p_acting_party_id, 'cms.author', target.id
        ) is not null
      )
  )
$body$;

comment on function platform_private.cms_relation_target_visible(uuid, uuid, uuid, text) is
  'Relation target readability for the caller: an active entry of the acting party whose content type is the active declared target type and over which the caller holds cms.author or cms.editor authority. Mirrors the draft-read predicate; never an existence oracle for a hidden target.';

-- A relation value restricted to the targets the caller may read.  A domain
-- relation resolves no target yet, so it shows none.
create or replace function platform_private.cms_relation_value_visible(
  p_value jsonb,
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_field_definition_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $body$
declare
  definition platform_private.cms_relation_definitions%rowtype;
begin
  select * into definition
  from platform_private.cms_relation_definitions candidate
  where candidate.field_definition_id = p_field_definition_id;
  if not found or definition.target_kind <> 'content' then
    return pg_catalog.jsonb_build_object('targets', '[]'::jsonb);
  end if;
  return pg_catalog.jsonb_build_object('targets', coalesce((
    select pg_catalog.jsonb_agg(target.value order by target.ordinality)
    from pg_catalog.jsonb_array_elements(p_value->'targets')
      with ordinality as target(value, ordinality)
    where platform_private.cms_relation_target_visible(
      p_actor_id, p_acting_party_id, (target.value->>'targetId')::uuid,
      definition.target_type
    )
  ), '[]'::jsonb));
end;
$body$;

comment on function platform_private.cms_relation_value_visible(jsonb, uuid, uuid, uuid) is
  'A canonical relation value restricted to the content targets the caller may read (a hidden target is omitted, never placeholdered); a domain relation shows no target.';

-- Resolves one relation field value against its immutable RelationDefinition and
-- returns the rows to write as a jsonb array of
-- { targetId, targetKind, expectedTargetVersion, position, onUnavailable }.
-- p_entry_id is null while the entry is being created.
create or replace function platform_private.cms_resolve_relation_targets(
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_entry_id uuid,
  p_entry_version bigint,
  p_field_definition_id uuid,
  p_value jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $body$
declare
  definition platform_private.cms_relation_definitions%rowtype;
  targets jsonb;
  target_count integer;
  target_index integer;
  target jsonb;
  target_uuid uuid;
  pin_text text;
  pin bigint;
  target_version bigint;
  specs jsonb := '[]'::jsonb;
begin
  select * into definition
  from platform_private.cms_relation_definitions candidate
  where candidate.field_definition_id = p_field_definition_id;
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  targets := p_value->'targets';
  if pg_catalog.jsonb_typeof(targets) is distinct from 'array' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  target_count := pg_catalog.jsonb_array_length(targets);
  if target_count > 512
     or target_count < definition.min_count
     or target_count > definition.max_count then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if (
    select count(distinct (candidate.value->>'targetId')::uuid) <> count(*)
    from pg_catalog.jsonb_array_elements(targets) candidate(value)
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if target_count = 0 then
    return specs;
  end if;
  -- BE03b:1049: a domain-kind target resolves only through a registered domain
  -- projection provider; none is registered, so a non-empty value fails closed.
  if definition.target_kind <> 'content' then
    raise exception 'relation_target_unavailable' using errcode = 'P0001';
  end if;
  for target_index in 0 .. target_count - 1 loop
    target := targets->target_index;
    target_uuid := (target->>'targetId')::uuid;
    if not platform_private.cms_relation_target_visible(
      p_actor_id, p_acting_party_id, target_uuid, definition.target_type
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    pin := null;
    if pg_catalog.jsonb_typeof(target->'expectedTargetVersion') = 'string' then
      pin_text := target->>'expectedTargetVersion';
      if pg_catalog.length(pin_text) > 19
         or (pg_catalog.length(pin_text) = 19 and pin_text > '9223372036854775807') then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
      pin := pin_text::bigint;
    end if;
    if pin is not null then
      if p_entry_id is not null and target_uuid = p_entry_id then
        -- The entry's own version advances with this very commit.
        pin := p_entry_version + 1;
      else
        select candidate.version into target_version
        from platform_private.cms_content_entries candidate
        where candidate.id = target_uuid;
        if target_version is distinct from pin then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
        end if;
      end if;
    end if;
    specs := specs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'targetId', target_uuid,
      'targetKind', definition.target_kind,
      'expectedTargetVersion', pin,
      'position', target_index,
      'onUnavailable', definition.on_unavailable
    ));
  end loop;
  return specs;
end;
$body$;

comment on function platform_private.cms_resolve_relation_targets(uuid, uuid, uuid, bigint, uuid, jsonb) is
  'Resolves one relation field value against its immutable RelationDefinition: bounded by min/max and 512, unique targets, a non-empty domain value is relation_target_unavailable, every content target must be readable by the caller and an external pin must equal the current target version (uniform VALIDATION_FAILED otherwise); returns the rows to write (targetKind and onUnavailable from the definition, position = index).';

-- The editorial workflow-policy evidence validation, shared by append and restore.
-- False when the projection is absent (no owner-approved policy) or malformed.
create or replace function platform_private.cms_editorial_workflow_policy_valid(
  p_version_id uuid
)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  editorial_policy jsonb;
begin
  editorial_policy := platform_private.cms_editorial_workflow_policy_evidence(p_version_id);
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
    return false;
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
    return false;
  end if;
  return true;
end;
$body$;

comment on function platform_private.cms_editorial_workflow_policy_valid(uuid) is
  'The re-fetched editorial workflow-policy evidence of a content-type version is present and fully valid: exactly the seven BE03b keys with a registered key, a bounded version, 64-hex policy and approval hashes, an ordinary or protected risk class, 1-8 required decisions, at most 16 registered capabilities, and a protected policy carrying at least two decisions and one capability. False when no owner-approved projection exists. Shared by append and restore.';

-- SEC-2: every helper that reads a forced-RLS table is owned by the dedicated
-- NOLOGIN definer role, like the pinned-schema draft value gate they sit beside
-- (20261003120500).  ALTER FUNCTION ... OWNER TO needs CREATE on the schema, held
-- by the role for this transaction only.  The pure helpers stay with the
-- migration owner and grant EXECUTE to the definer.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_draft_value_refusal(uuid, uuid, jsonb, text)
  owner to wejammin_cms_definer;
alter function platform_private.cms_require_draft_value_valid(uuid, uuid, jsonb, text)
  owner to wejammin_cms_definer;
alter function platform_private.cms_editorial_workflow_policy_valid(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_revision_relation_values(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_relation_target_visible(uuid, uuid, uuid, text)
  owner to wejammin_cms_definer;
alter function platform_private.cms_relation_value_visible(jsonb, uuid, uuid, uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_resolve_relation_targets(uuid, uuid, uuid, bigint, uuid, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function platform_private.cms_draft_value_refusal(uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_require_draft_value_valid(uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_editorial_workflow_policy_valid(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_relation_value_canonical(jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_relation_values(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_relation_target_visible(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_relation_value_visible(jsonb, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_resolve_relation_targets(uuid, uuid, uuid, bigint, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_relation_value_canonical(jsonb, uuid)
  to wejammin_cms_definer;

commit;
