-- Slice 10 WP-S10-2a (BE03b "Value encodings by field kind"; DEC-112
-- rich_text.v1; DEC-133 object): every field kind is a typed encoding, never a
-- stringly-typed pass-through.  This forward migration lands the
-- cms_field_kind_encodings.sql half of the value-encoding contract:
--
--   * the DEC-133 typed depth-1 object structure (<= 32 properties) is admitted
--     into field constraints and every object value is validated against it;
--   * the fail-closed enum choice guard (nonempty immutable enumValues) is
--     kept: an enum value must come from a nonempty choice set, and an enum
--     definition without one admits no value and no literal default;
--   * relation is the ordered { targets: [ { targetId, expectedTargetVersion } ] }
--     shape and list is an array of its declared scalar/enum itemKind, so both
--     stop being untyped JSON containers;
--   * platform_private.cms_field_kind_value_shape is the ONE kind-specific
--     encoding and 03a-constraint gate.  The pinned-schema draft value gate
--     (cms_draft_field_value_valid) and the definition-time literal default
--     check (cms_valid_field_input) both delegate to it, so a default can
--     never be a looser encoding than the field it declares and the two gates
--     can no longer drift apart.
--
-- The canonical rich_text.v1 grammar already exists in the forward migration
-- 20261005010000_cms_rich_text_v1_validator.sql and is reused unchanged through
-- platform_private.cms_rich_text_v1_valid(jsonb).  That migration deliberately
-- does not redefine the draft value gate: this migration owns
-- cms_draft_field_value_valid (and admits the grammar through it), so the
-- function has exactly one definition after the 20260927540000 refusal.  This
-- migration replaces only private validators and one storage CHECK; no policy,
-- choice value, or grant is synthesized.  Forward-only.
begin;

-- ---------------------------------------------------------------------------
-- platform_private.cms_object_structure_valid(jsonb): the DEC-133 structure.
--
-- The object kind declares a typed depth-1 properties[] with 0..32 properties
-- (BE03a Zod: properties is max(32), AC-076: 0-32).  Each property is a strict
-- { key, kind, required, constraints }: a stable unique key, a scalar/enum/
-- rich_text kind, a boolean required flag, and a constraint record that is the
-- open JSON record BE03b types as Record<string, Json>, except that an enum
-- property must carry a nonempty immutable enumValues string set.  Pure
-- predicate: no reads, writes, or evidence.
--
-- Every comparison on a property member is null-safe.  SQL three-valued logic
-- turns `NULL not in (...)` and `NULL <> 'array'` into NULL, and an IF on NULL
-- is skipped, so a missing or JSON-null member would otherwise walk past its
-- check: a property whose kind is JSON null, or an enum property with no
-- enumValues at all, was admitted as a valid structure (and an enum property
-- with no choice set then accepted ANY string value, an untyped pass-through).
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_object_structure_valid(p_structure jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  properties jsonb;
  property jsonb;
  property_index integer;
  property_count integer;
  property_key text;
  property_kind text;
  enum_values jsonb;
  seen_keys text[] := array[]::text[];
begin
  if not platform_private.cms_exact_keys(
       p_structure,
       array['properties']::text[],
       array['properties']::text[]
     ) then
    return false;
  end if;
  properties := p_structure->'properties';
  if pg_catalog.jsonb_typeof(properties) is distinct from 'array' then
    return false;
  end if;
  property_count := pg_catalog.jsonb_array_length(properties);
  if property_count > 32 then
    return false;
  end if;
  for property_index in 0 .. property_count - 1 loop
    property := properties->property_index;
    if not platform_private.cms_exact_keys(
         property,
         array['key', 'kind', 'required', 'constraints']::text[],
         array['key', 'kind', 'required', 'constraints']::text[]
       ) then
      return false;
    end if;
    if pg_catalog.jsonb_typeof(property->'key') is distinct from 'string' then
      return false;
    end if;
    property_key := property->>'key';
    if property_key !~ '^[a-z][a-z0-9_]{1,63}$' then
      return false;
    end if;
    if property_key = any(seen_keys) then
      return false;
    end if;
    seen_keys := seen_keys || property_key;
    if pg_catalog.jsonb_typeof(property->'kind') is distinct from 'string' then
      return false;
    end if;
    property_kind := property->>'kind';
    if property_kind not in ('scalar', 'enum', 'rich_text') then
      return false;
    end if;
    if pg_catalog.jsonb_typeof(property->'required') is distinct from 'boolean' then
      return false;
    end if;
    if pg_catalog.jsonb_typeof(property->'constraints') is distinct from 'object' then
      return false;
    end if;
    if property_kind = 'enum' then
      enum_values := property->'constraints'->'enumValues';
      if pg_catalog.jsonb_typeof(enum_values) is distinct from 'array'
         or pg_catalog.jsonb_array_length(enum_values) not between 1 and 256
         or exists (
           select 1
           from pg_catalog.jsonb_array_elements(enum_values) enum_entry
           where pg_catalog.jsonb_typeof(enum_entry) <> 'string'
         ) then
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$body$;

-- ---------------------------------------------------------------------------
-- platform_private.cms_object_value_valid(jsonb, jsonb): the DEC-133 value.
--
-- A value is a plain object whose keys are a subset of the declared properties;
-- every required property is present; a scalar property holds a JSON primitive
-- (matching isObjectValueForStructure: string, boolean or finite number); an
-- enum property holds a declared choice; a rich_text property holds a
-- rich_text.v1 document.  Unknown or nested values are refused, so there is no
-- untyped pass-through.
--
-- A JSON null is not a scalar value (BE03a "Field kind structure": `scalar`
-- covers the scalar field kinds, none of which admits an authored null; an
-- absent value is the missing state and an explicit null is a field-level
-- provenance state, never a value shape).  `required` is the only presence
-- control, so a null can neither satisfy a required property nor stand in for an
-- optional one that is simply left out.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_object_value_valid(
  p_structure jsonb,
  p_value jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  properties jsonb;
  property jsonb;
  property_index integer;
  property_count integer;
  property_key text;
  property_kind text;
  property_value jsonb;
begin
  if not platform_private.cms_object_structure_valid(p_structure) then
    return false;
  end if;
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;
  properties := p_structure->'properties';
  property_count := pg_catalog.jsonb_array_length(properties);

  -- Closed keys: every value key must be a declared property, so an unknown key
  -- is refused rather than carried as untyped content.
  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_value) as value_key_name
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(properties) as declared(property)
      where declared.property->>'key' = value_key_name
    )
  ) then
    return false;
  end if;

  for property_index in 0 .. property_count - 1 loop
    property := properties->property_index;
    property_key := property->>'key';
    property_kind := property->>'kind';
    if not (p_value ? property_key) then
      if (property->>'required')::boolean then
        return false;
      end if;
      continue;
    end if;
    property_value := p_value->property_key;
    if property_kind = 'rich_text' then
      if not coalesce(platform_private.cms_rich_text_v1_valid(property_value), false) then
        return false;
      end if;
    elsif property_kind = 'enum' then
      if pg_catalog.jsonb_typeof(property_value) <> 'string'
         or not coalesce(
           property->'constraints'->'enumValues'
             @> pg_catalog.jsonb_build_array(property_value #>> '{}'),
           false
         ) then
        return false;
      end if;
    else
      -- scalar: a JSON primitive only (string, boolean or finite number); an
      -- authored JSON null is refused, as it is for every scalar field kind.
      if pg_catalog.jsonb_typeof(property_value)
           not in ('string', 'boolean', 'number') then
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$body$;

comment on function platform_private.cms_object_structure_valid(jsonb) is
  'DEC-133 typed depth-1 object structure (0-32 properties; strict key/kind/required/constraints members; unique stable keys; scalar/enum/rich_text kinds only; an enum property needs a nonempty immutable string choice set). Null-safe: a missing or JSON-null member is refused, never skipped. Pure predicate: no reads, no writes, no evidence.';
comment on function platform_private.cms_object_value_valid(jsonb, jsonb) is
  'DEC-133 depth-1 object value against its declared structure. Closed keys, required presence, primitive scalars (string, boolean or finite number; a JSON null is not a scalar value), declared enum choices and rich_text.v1 documents; unknown or nested values are refused.';

-- ---------------------------------------------------------------------------
-- platform_private.cms_list_item_kind_valid(text): the declared itemKind.
--
-- The declared itemKind must be a scalar kind or enum (DEC-133 / BE03b); a
-- nested list/object/relation/media/rich_text item is refused.  Pure predicate.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_list_item_kind_valid(
  p_item_kind text
)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select coalesce(p_item_kind in (
    'short_text', 'long_text', 'boolean', 'integer', 'decimal',
    'date', 'datetime', 'enum'
  ), false)
$body$;

comment on function platform_private.cms_list_item_kind_valid(text) is
  'DEC-133/BE03b list item kinds: scalar kinds and enum only; nested list, object, relation, media and rich_text items are refused at definition time.';

-- ---------------------------------------------------------------------------
-- platform_private.cms_list_item_value_valid(text, jsonb, jsonb): one list
-- item against its declared itemKind.
--
-- A text or enum item is bounded by the list's own minLength/maxLength (and an
-- enum item by the declared choice set); every other item kind is validated by
-- the shared cms_field_kind_value_shape with an empty constraint record, so a
-- list item is never a looser encoding than the scalar field of the same kind
-- (primitive encodings and real calendar date/datetime semantics included).
-- Pure predicate.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_list_item_value_valid(
  p_item_kind text,
  p_constraints jsonb,
  p_item jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  item_text text;
begin
  if p_item is null
     or p_item_kind is null
     or not platform_private.cms_list_item_kind_valid(p_item_kind) then
    return false;
  end if;
  if p_item_kind in ('short_text', 'long_text', 'enum') then
    if pg_catalog.jsonb_typeof(p_item) <> 'string' then
      return false;
    end if;
    item_text := p_item #>> '{}';
    if p_item_kind = 'enum'
       and (
         pg_catalog.jsonb_typeof(p_constraints->'enumValues') is distinct from 'array'
         or not (p_constraints->'enumValues' @> pg_catalog.jsonb_build_array(item_text))
       ) then
      return false;
    end if;
    if p_constraints ? 'minLength'
       and pg_catalog.length(item_text)
           < (p_constraints->>'minLength')::integer then
      return false;
    end if;
    if p_constraints ? 'maxLength'
       and pg_catalog.length(item_text)
           > (p_constraints->>'maxLength')::integer then
      return false;
    end if;
    return true;
  end if;
  return platform_private.cms_field_kind_value_shape(
    p_item_kind, '{}'::pg_catalog.jsonb, p_item
  );
end;
$body$;

comment on function platform_private.cms_list_item_value_valid(text, jsonb, jsonb) is
  'One list item against its declared scalar/enum itemKind: text and enum items honour the list minLength/maxLength and the declared immutable enum choice set; every other kind delegates to cms_field_kind_value_shape, so list items carry the same primitive and real date/datetime semantics as the scalar kinds.';

-- ---------------------------------------------------------------------------
-- platform_private.cms_media_reference_valid(jsonb): one BE03b media reference.
--
-- A strict { assetId: UUID, assetVersion: Version } object.  The version is the
-- canonical decimal string of a positive signed 64-bit integer (BE03a Version),
-- never a JSON number.  Pure predicate: no reads, writes, or evidence.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_media_reference_valid(p_reference jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  asset_version text;
begin
  if p_reference is null
     or pg_catalog.jsonb_typeof(p_reference) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_reference,
       array['assetId', 'assetVersion']::text[],
       array['assetId', 'assetVersion']::text[]
     ) then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_reference->'assetId') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_reference->'assetVersion') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_reference->>'assetId') then
    return false;
  end if;
  asset_version := p_reference->>'assetVersion';
  if not platform_private.cms_valid_version(asset_version)
     or pg_catalog.length(asset_version) > 19 then
    return false;
  end if;
  -- The signed 64-bit ceiling (the contract's CMS_MAX_VERSION).
  return asset_version::numeric <= 9223372036854775807::numeric;
end;
$body$;

comment on function platform_private.cms_media_reference_valid(jsonb) is
  'BE03b media reference: a strict { assetId: UUID, assetVersion: Version } object whose version is a canonical positive signed 64-bit decimal string. Pure predicate.';

-- ---------------------------------------------------------------------------
-- platform_private.cms_value_source_refusal(text, jsonb): the producer refusal.
--
-- BE03b "Value encodings by field kind": "A field whose kind has no available
-- producer refuses at write with a typed reason instead of storing an
-- unvalidated value."  A NON-EMPTY taxonomy value fails closed with the typed
-- reason `taxonomy_source_unavailable` until the taxonomy-version authority
-- exists, and a NON-EMPTY media value with `media_source_unavailable` until the
-- media provider exists.  An empty value ({ "termIds": [] } or []) names no
-- term and no asset, so it needs no producer and is stored; every other kind
-- (whose validator exists) and a JSON null (decided by provenance, never by a
-- value) are never refused here.
--
-- The input must already have passed cms_field_kind_value_shape, which decides
-- malformed encodings (the typed VALIDATION_FAILED refusal), so a malformed
-- value that reaches this predicate is simply not refused by it.  Returns the
-- reason token or NULL.  Pure predicate: no reads, writes, or evidence.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_value_source_refusal(
  p_kind text,
  p_value jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $body$
begin
  if p_kind is null or p_value is null then
    return null;
  end if;
  if p_kind = 'taxonomy' then
    if pg_catalog.jsonb_typeof(p_value) = 'object'
       and pg_catalog.jsonb_typeof(p_value->'termIds') = 'array' then
      if pg_catalog.jsonb_array_length(p_value->'termIds') > 0 then
        return 'taxonomy_source_unavailable';
      end if;
    end if;
    return null;
  end if;
  if p_kind = 'media' then
    if pg_catalog.jsonb_typeof(p_value) = 'object' then
      return 'media_source_unavailable';
    end if;
    if pg_catalog.jsonb_typeof(p_value) = 'array' then
      if pg_catalog.jsonb_array_length(p_value) > 0 then
        return 'media_source_unavailable';
      end if;
    end if;
    return null;
  end if;
  return null;
end;
$body$;

comment on function platform_private.cms_value_source_refusal(text, jsonb) is
  'BE03b producer refusal: a non-empty taxonomy value is taxonomy_source_unavailable and a non-empty media value is media_source_unavailable until their providers exist; an empty value, every other kind and a JSON null are never refused here. Returns the typed reason token or NULL. Pure predicate.';

-- ---------------------------------------------------------------------------
-- platform_private.cms_require_value_source_available(uuid, uuid, jsonb): the
-- write-time raise.  Looks up the field kind of the pinned schema and raises the
-- typed contract error (SQLSTATE P0001, the reason token as the message) when the
-- value needs a producer that does not exist yet.  Called by every command that
-- stores an authored value, AFTER the shared draft value gate has accepted the
-- encoding, so a malformed value stays a VALIDATION_FAILED and only a well-formed
-- non-empty taxonomy/media value reaches this refusal.  The raise aborts the
-- command, so nothing is committed.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_require_value_source_available(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $body$
declare
  field_kind text;
  refusal text;
begin
  select field.kind into field_kind
  from platform_private.cms_field_definition_versions field
  where field.stable_field_id = p_field_id
    and field.content_type_version_id = p_schema_version_id;
  refusal := platform_private.cms_value_source_refusal(field_kind, p_value);
  if refusal is not null then
    raise exception '%', refusal using errcode = 'P0001';
  end if;
end;
$body$;

comment on function platform_private.cms_require_value_source_available(uuid, uuid, jsonb) is
  'Write-time producer refusal: raises the typed taxonomy_source_unavailable / media_source_unavailable contract error (P0001, reason token as the message) for a well-formed non-empty taxonomy/media value of the pinned schema field. Call after cms_draft_field_value_valid.';

-- SEC-2: the body reads a forced Slice 09 table (cms_field_definition_versions), so
-- the function is owned by the dedicated NOLOGIN definer role exactly like the
-- pinned-schema draft value gate that reads the same table
-- (20261003120500_cms_definer_function_ownership.sql).  The role already holds the
-- table privilege its other owned functions need.  ALTER FUNCTION ... OWNER TO
-- requires CREATE on the function's schema for the new owner, so the role holds it
-- for the length of this transaction only (the least-privilege catalog guard
-- requires the dedicated roles hold no schema CREATE afterwards).
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_require_value_source_available(uuid, uuid, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

-- ---------------------------------------------------------------------------
-- platform_private.cms_field_kind_value_shape(text, jsonb, jsonb): the ONE
-- kind-specific value encoding and 03a-constraint gate.
--
-- It decides both a literal defaultValue at definition time
-- (cms_valid_field_input) and a draft value at write time
-- (cms_draft_field_value_valid), so a default can never be a looser encoding
-- than the field it declares.  Per kind:
--
--   short_text, long_text            a string, bounded by minLength/maxLength
--                                    (and by enumValues when declared)
--   enum                             a string from a nonempty immutable
--                                    enumValues set of 1..256 choices, bounded
--                                    by minLength/maxLength
--   boolean                          a JSON boolean
--   integer                          a JSON number with no fraction or
--                                    exponent, bounded by minimum/maximum
--   decimal                          a JSON number, bounded by minimum/maximum
--   date, datetime                   an ISO string that is a real calendar
--                                    day (datetime: and an ISO clock/offset),
--                                    with the generic string bounds above
--   rich_text                        a canonical rich_text.v1 document whose
--                                    total NFC text honours minLength/maxLength
--   relation                         the ordered { targets: [ { targetId,
--                                    expectedTargetVersion? } ] } shape, at
--                                    most 512 targets
--   taxonomy                         BE03b { termIds: UUID[] <= 128 }, a strict
--                                    object (the typed encoding; a non-empty
--                                    value additionally fails closed at write
--                                    through cms_value_source_refusal until the
--                                    taxonomy-version authority exists)
--   media                            BE03b { assetId: UUID, assetVersion:
--                                    Version } or an array of at most 128 such
--                                    references, the array bounded by the 03a
--                                    maxLength (the typed encoding; a non-empty
--                                    value additionally fails closed at write
--                                    through cms_value_source_refusal until the
--                                    media provider exists)
--   list                             an array (count <= 128) of its declared
--                                    scalar or enum itemKind
--   object                           the DEC-133 typed depth-1 structure
--
-- An authored null is never a shape: the explicit_null and missing provenance
-- rules belong to the callers, and a present literal JSON null default is
-- admitted by cms_valid_field_input itself, so an invalid authored null can
-- never reach here and pass.  The function always returns true or false, never
-- NULL (an IF on NULL is skipped, which would turn an unknown into a pass).
-- Schema identity, field provenance, the validator pairing and the pinned-
-- schema lookup stay in the callers.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_field_kind_value_shape(
  p_kind text,
  p_constraints jsonb,
  p_value jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  value_type text;
  text_value text;
  numeric_value numeric;
  enum_values jsonb;
  item_kind text;
  list_index integer;
  structure jsonb;
  targets jsonb;
  target jsonb;
  target_index integer;
  target_count integer;
  term_ids jsonb;
  term_index integer;
  term_count integer;
begin
  if p_kind is null
     or p_value is null
     or pg_catalog.jsonb_typeof(p_value) = 'null'
     or p_constraints is null
     or pg_catalog.jsonb_typeof(p_constraints) <> 'object' then
    return false;
  end if;
  value_type := pg_catalog.jsonb_typeof(p_value);

  -- Structured kinds carry their own grammar and return directly.
  if p_kind = 'rich_text' then
    if not coalesce(platform_private.cms_rich_text_v1_valid(p_value), false) then
      return false;
    end if;
    return coalesce(
      platform_private.cms_rich_text_length_in_bounds(p_value, p_constraints),
      false
    );
  end if;
  if p_kind = 'object' then
    structure := p_constraints->'objectStructure';
    return structure is not null
       and coalesce(
         platform_private.cms_object_value_valid(structure, p_value), false
       );
  end if;
  if p_kind = 'list' then
    if value_type <> 'array' then
      return false;
    end if;
    item_kind := p_constraints->>'itemKind';
    if not platform_private.cms_list_item_kind_valid(item_kind) then
      return false;
    end if;
    if pg_catalog.jsonb_array_length(p_value) > 128 then
      return false;
    end if;
    for list_index in 0 .. pg_catalog.jsonb_array_length(p_value) - 1 loop
      if not coalesce(platform_private.cms_list_item_value_valid(
        item_kind, p_constraints, p_value->list_index
      ), false) then
        return false;
      end if;
    end loop;
    return true;
  end if;
  if p_kind = 'relation' then
    -- The ordered targets shape.  Relation bounds (min/max/cardinality) and
    -- target resolution stay in the callers because they need the immutable
    -- relation binding, not the shape alone.
    if value_type <> 'object'
       or not platform_private.cms_exact_keys(
         p_value, array['targets']::text[], array['targets']::text[]
       ) then
      return false;
    end if;
    targets := p_value->'targets';
    if pg_catalog.jsonb_typeof(targets) is distinct from 'array' then
      return false;
    end if;
    target_count := pg_catalog.jsonb_array_length(targets);
    if target_count > 512 then
      return false;
    end if;
    for target_index in 0 .. target_count - 1 loop
      target := targets->target_index;
      if not platform_private.cms_exact_keys(
           target,
           array['targetId']::text[],
           array['targetId', 'expectedTargetVersion']::text[]
         )
         or pg_catalog.jsonb_typeof(target->'targetId') is distinct from 'string'
         or not platform_private.cms_valid_uuid(target->>'targetId') then
        return false;
      end if;
      if target ? 'expectedTargetVersion'
         and pg_catalog.jsonb_typeof(target->'expectedTargetVersion')
               not in ('null', 'string') then
        return false;
      end if;
      if pg_catalog.jsonb_typeof(target->'expectedTargetVersion') = 'string'
         and not platform_private.cms_valid_version(
           target->>'expectedTargetVersion'
         ) then
        return false;
      end if;
    end loop;
    return true;
  end if;

  if p_kind = 'taxonomy' then
    -- BE03b: { termIds: UUID[] <= 128 }.  A strict object, so an untyped
    -- string or array pass-through is not an encoding.  Whether a non-empty
    -- list may be stored at all is the producer refusal, not this shape.
    if value_type <> 'object'
       or not platform_private.cms_exact_keys(
         p_value, array['termIds']::text[], array['termIds']::text[]
       ) then
      return false;
    end if;
    term_ids := p_value->'termIds';
    if pg_catalog.jsonb_typeof(term_ids) is distinct from 'array' then
      return false;
    end if;
    term_count := pg_catalog.jsonb_array_length(term_ids);
    if term_count > 128 then
      return false;
    end if;
    for term_index in 0 .. term_count - 1 loop
      if pg_catalog.jsonb_typeof(term_ids->term_index) is distinct from 'string'
         or not platform_private.cms_valid_uuid(term_ids->>term_index) then
        return false;
      end if;
    end loop;
    return true;
  end if;
  if p_kind = 'media' then
    -- BE03b: { assetId: UUID, assetVersion: Version } or an array of them (the
    -- raw-body bound is arrays 128).  The array is also bounded by the 03a
    -- maxLength.  Whether a non-empty value may be stored at all is the
    -- producer refusal, not this shape.
    if value_type = 'object' then
      return platform_private.cms_media_reference_valid(p_value);
    end if;
    if value_type <> 'array' then
      return false;
    end if;
    target_count := pg_catalog.jsonb_array_length(p_value);
    if target_count > 128
       or (p_constraints ? 'maxLength'
           and target_count > (p_constraints->>'maxLength')::integer) then
      return false;
    end if;
    for target_index in 0 .. target_count - 1 loop
      if not platform_private.cms_media_reference_valid(p_value->target_index) then
        return false;
      end if;
    end loop;
    return true;
  end if;

  -- Primitive and calendar kinds: the kind fixes the JSON type, and the generic
  -- 03a bounds below then apply to the value's own type.
  if p_kind in ('short_text', 'long_text') then
    if value_type <> 'string' then
      return false;
    end if;
  elsif p_kind = 'enum' then
    enum_values := p_constraints->'enumValues';
    if value_type <> 'string'
       or pg_catalog.jsonb_typeof(enum_values) is distinct from 'array'
       or pg_catalog.jsonb_array_length(enum_values) not between 1 and 256 then
      return false;
    end if;
  elsif p_kind = 'boolean' then
    return value_type = 'boolean';
  elsif p_kind = 'integer' then
    if value_type <> 'number' or (p_value::text) !~ '^-?[0-9]+$' then
      return false;
    end if;
  elsif p_kind = 'decimal' then
    if value_type <> 'number' then
      return false;
    end if;
  elsif p_kind = 'date' then
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
  elsif p_kind = 'datetime' then
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
  else
    -- An unknown kind admits nothing.
    return false;
  end if;

  if value_type = 'string' then
    text_value := p_value #>> '{}';
    if p_constraints ? 'minLength'
       and pg_catalog.length(text_value)
           < (p_constraints->>'minLength')::integer then
      return false;
    end if;
    if p_constraints ? 'maxLength'
       and pg_catalog.length(text_value)
           > (p_constraints->>'maxLength')::integer then
      return false;
    end if;
    if p_constraints ? 'enumValues'
       and not coalesce(
         p_constraints->'enumValues'
           @> pg_catalog.jsonb_build_array(text_value),
         false
       ) then
      return false;
    end if;
  elsif value_type = 'number' then
    numeric_value := (p_value::text)::numeric;
    if p_constraints ? 'minimum'
       and numeric_value < (p_constraints->>'minimum')::numeric then
      return false;
    end if;
    if p_constraints ? 'maximum'
       and numeric_value > (p_constraints->>'maximum')::numeric then
      return false;
    end if;
  end if;
  return true;
end;
$body$;

comment on function platform_private.cms_field_kind_value_shape(text, jsonb, jsonb) is
  'BE03b value encoding by field kind, the single gate shared by the definition default check and the pinned-schema draft value gate: every kind (primitive, calendar, enum, taxonomy { termIds }, relation, media { assetId, assetVersion } or an array of them, list, object, rich_text) with its 03a minLength/maxLength/minimum/maximum/enumValues bounds. An authored null never passes; the result is always true or false, never NULL.';

-- ---------------------------------------------------------------------------
-- platform_private.cms_compiled_manifest_bounded(jsonb): the compiled artifact
-- aggregate bound.
--
-- The DEC-133 object structure nests deeper than the prior compiled-manifest
-- cap.  The editor manifest stores every field (carrying its full constraints
-- record, and therefore objectStructure -> properties -> property -> property
-- constraints at the leaf) once under schema.fields[] and again at the root
-- fields[] key, so a valid bounded object type reached
-- cms_schema_artifacts_editor_manifest_check and was refused with a 23514 after
-- field input and the object validator had both admitted it.  The aggregate
-- bound is raised from depth 8 to depth 12.  The deepest valid object manifest
-- is depth 10 (measured), and the constraints-column bound of 8 plus the two
-- manifest wrapper levels (schema -> fields[] -> field) already needs 10, so 12
-- leaves headroom while still refusing unbounded nesting.  A bounded object
-- field can therefore never fail the storage CHECK on valid input.  The
-- byte/key/array bounds are unchanged.
-- ---------------------------------------------------------------------------
create or replace function platform_private.cms_compiled_manifest_bounded(p_value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $body$
  select platform_private.cms_json_bounded(p_value, 524288, 12, 128, 128)
$body$;

comment on function platform_private.cms_compiled_manifest_bounded(jsonb) is
  'Compiled artifact aggregate bound (512 KiB, depth 12 to admit the DEC-133 object structure duplicated across the editor manifest, 128 keys, 128 array elements).';

-- The DEC-133 structure nests one level deeper than the prior constraint cap
-- (constraints -> objectStructure -> properties -> property -> property
-- constraints -> leaf is depth 5), so the storage bound is widened from depth 4
-- to depth 8 to match the generated FieldConstraintsSchema value bound.  The
-- byte/key/array bounds are unchanged.
alter table platform_private.cms_field_definition_versions
  drop constraint cms_field_definition_versions_constraints_check;
alter table platform_private.cms_field_definition_versions
  add constraint cms_field_definition_versions_constraints_check check (
    pg_catalog.jsonb_typeof(constraints) = 'object'
    and platform_private.cms_json_bounded(constraints, 8192, 8, 64, 256)
  );

-- Replace the field-input validator so kind/object-structure agreement is
-- enforced, objectStructure is within the closed constraint key set, and a
-- literal defaultValue satisfies the shared field-kind shape.  The mandatory
-- members are checked null-safely (a JSON-null key, kind or editor label used
-- to be skipped by SQL three-valued logic and surfaced later as an untyped
-- storage NOT NULL failure instead of the typed validation refusal).  Every
-- other rule is the prior definition
-- (20261003130300_cms_valid_field_input_literal_json_null.sql).
create or replace function platform_private.cms_valid_field_input(
  p_value jsonb,
  p_require_stable_id boolean default true
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  constraints jsonb;
  editor_config jsonb;
  kind text;
begin
  if not platform_private.cms_exact_keys(
    p_value,
    case when p_require_stable_id
      then array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::text[]
      else array['key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::text[]
    end,
    array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','defaultValue','localizationMode','editorConfig','lifecycle']::text[]
  ) then
    return false;
  end if;
  if p_require_stable_id and not platform_private.cms_valid_uuid(p_value->>'stableFieldId') then return false; end if;
  if not p_require_stable_id and p_value ? 'stableFieldId'
     and not platform_private.cms_valid_uuid(p_value->>'stableFieldId') then return false; end if;
  if pg_catalog.jsonb_typeof(p_value->'key') is distinct from 'string'
     or p_value->>'key' !~ '^[a-z][a-z0-9_]{1,63}$'
     or platform_private.cms_reserved_key(p_value->>'key') then return false; end if;
  if pg_catalog.jsonb_typeof(p_value->'kind') is distinct from 'string' then return false; end if;
  kind := p_value->>'kind';
  if kind not in (
    'short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
    'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list'
  ) then return false; end if;
  constraints := p_value->'constraints';
  if pg_catalog.jsonb_typeof(constraints) is distinct from 'object'
     or not platform_private.cms_json_bounded(constraints, 8192, 8, 64, 256)
     or exists (select 1 from pg_catalog.jsonb_object_keys(constraints) key_name
       where key_name not in ('minLength','maxLength','minimum','maximum','enumValues','itemKind','objectStructure')) then
    return false;
  end if;
  if constraints ? 'minLength' and (
       pg_catalog.jsonb_typeof(constraints->'minLength') <> 'number'
       or (constraints->>'minLength') !~ '^[0-9]+$'
       or (constraints->>'minLength')::numeric > 100000
     ) then return false; end if;
  if constraints ? 'maxLength' and (
       pg_catalog.jsonb_typeof(constraints->'maxLength') <> 'number'
       or (constraints->>'maxLength') !~ '^[0-9]+$'
       or (constraints->>'maxLength')::numeric > 100000
     ) then return false; end if;
  if constraints ? 'minLength' and constraints ? 'maxLength'
     and (constraints->>'minLength')::numeric > (constraints->>'maxLength')::numeric then return false; end if;
  if constraints ? 'minimum' and pg_catalog.jsonb_typeof(constraints->'minimum') <> 'number' then return false; end if;
  if constraints ? 'maximum' and pg_catalog.jsonb_typeof(constraints->'maximum') <> 'number' then return false; end if;
  if constraints ? 'minimum' and constraints ? 'maximum'
     and (constraints->>'minimum')::numeric > (constraints->>'maximum')::numeric then return false; end if;
  if constraints ? 'enumValues' then
    if pg_catalog.jsonb_typeof(constraints->'enumValues') <> 'array'
       or pg_catalog.jsonb_array_length(constraints->'enumValues') > 256
       or exists (select 1 from pg_catalog.jsonb_array_elements(constraints->'enumValues') enum_entry
         where pg_catalog.jsonb_typeof(enum_entry) <> 'string'
           or pg_catalog.length(enum_entry #>> '{}') > 160) then return false; end if;
  end if;
  if constraints ? 'itemKind' and (constraints->>'itemKind') not in (
    'short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
    'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list'
  ) then return false; end if;
  -- DEC-133: itemKind is a list-only constraint.  Carrying it on any other
  -- kind (including object, whose properties live in objectStructure) is
  -- refused so a definition can never declare two item encodings.
  if kind <> 'list' and constraints ? 'itemKind' then return false; end if;
  -- BE03a "Field kind structure" (DEC-133): a list field requires an itemKind
  -- that is a scalar kind or enum, so a nested list/object/relation/media/
  -- rich_text item (or a list with no usable itemKind) is refused at definition
  -- time, on the complete-definition and the incremental edit path alike.  A
  -- JSON-null or non-string itemKind reads as SQL NULL here and is refused too.
  if kind = 'list'
     and not platform_private.cms_list_item_kind_valid(constraints->>'itemKind') then
    return false;
  end if;
  -- DEC-133: a declared structure must be valid, and it may only appear on the
  -- object kind.  A complete type definition (p_require_stable_id, the
  -- create/activation field manifest) must also declare one for every object
  -- field; the incremental single-field edit path (p_require_stable_id false)
  -- keeps its legacy permissiveness, and its object values still fail closed at
  -- the value gate.
  if constraints ? 'objectStructure'
     and not platform_private.cms_object_structure_valid(constraints->'objectStructure') then
    return false;
  end if;
  if kind = 'object' and p_require_stable_id
     and not (constraints ? 'objectStructure') then
    return false;
  end if;
  if kind <> 'object' and constraints ? 'objectStructure' then return false; end if;
  if pg_catalog.jsonb_typeof(p_value->'required') <> 'boolean'
     or coalesce(p_value->>'defaultMode', '') not in ('none','literal','inherited')
     or coalesce(p_value->>'localizationMode', '') not in ('none','localized','no_fallback')
     or coalesce(p_value->>'lifecycle', '') not in ('active','deprecated','retired') then return false; end if;
  if (p_value->>'validatorKey' is null) <> (p_value->>'validatorVersion' is null) then return false; end if;
  if p_value->>'validatorKey' is not null
     and (p_value->>'validatorKey') !~ '^[a-z][a-z0-9._-]{0,127}$' then return false; end if;
  if p_value->>'validatorVersion' is not null
     and (
       not platform_private.cms_valid_version(p_value->>'validatorVersion')
       or not platform_private.cms_protected_validator_ref(
         p_value->>'validatorKey', (p_value->>'validatorVersion')::bigint
       )
     ) then return false; end if;
  -- BE03a kind/validator pairing: a present pair must name the registered
  -- rich_text.v1 v1 member (checked above), and a member pair is valid only on
  -- a rich_text field.  A member pair on another kind is refused so a
  -- definition can never bind a foreign grammar.
  if p_value->>'validatorKey' = 'rich_text.v1'
     and kind <> 'rich_text' then return false; end if;
  -- BE03a (Field definition: defaultValue is Json.nullable().optional(); a literal default needs
  -- the key present): an explicit JSON null is a literal default, only a missing key is not.
  if p_value->>'defaultMode' = 'literal' and not (p_value ? 'defaultValue') then return false; end if;
  if p_value->>'defaultMode' in ('none','inherited') and p_value ? 'defaultValue' then return false; end if;
  if p_value ? 'defaultValue'
     and not platform_private.cms_json_bounded(p_value->'defaultValue', 262144, 8, 128, 128) then return false; end if;
  -- BE03a: a literal defaultValue must satisfy the same encoding its field
  -- kind imposes on values, through the one shared cms_field_kind_value_shape:
  -- rich text is the canonical rich_text.v1 AST; a DEC-133 object satisfies its
  -- declared structure; a list is an array of its declared scalar/enum
  -- itemKind; every other kind is its primitive, choice-set or calendar
  -- encoding bounded by the 03a constraints.  The one exception is a present
  -- explicit JSON null: it is itself a valid literal default for every kind
  -- (defaultValue is Json.nullable()), while the shape helper keeps refusing an
  -- authored null so no invalid null can pass as a value.
  if p_value ? 'defaultValue'
     and pg_catalog.jsonb_typeof(p_value->'defaultValue') <> 'null'
     and not platform_private.cms_field_kind_value_shape(
       kind,
       constraints,
       p_value->'defaultValue'
     ) then
    return false;
  end if;
  editor_config := p_value->'editorConfig';
  if not platform_private.cms_exact_keys(
    editor_config,
    array['label','order']::text[],
    array['label','helpText','order']::text[]
  ) or pg_catalog.jsonb_typeof(editor_config->'label') is distinct from 'string'
    or pg_catalog.length(pg_catalog.normalize(editor_config->>'label', 'NFC')) not between 1 and 120
    or (editor_config ? 'helpText' and (
         pg_catalog.jsonb_typeof(editor_config->'helpText') is distinct from 'string'
         or pg_catalog.length(pg_catalog.normalize(editor_config->>'helpText', 'NFC')) > 500))
    or pg_catalog.jsonb_typeof(editor_config->'order') <> 'number'
    or (editor_config->>'order') !~ '^[0-9]+$'
    or (editor_config->>'order')::numeric > 10000 then return false; end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
  return false;
end;
$body$;

-- Replace the pinned-schema draft value gate.  An explicit null and a missing
-- value are decided by provenance; every authored value is decided by the one
-- shared cms_field_kind_value_shape (the kind encoding and the 03a bounds), so
-- the gate and the definition-time default check cannot drift apart.  Only the
-- field lookup and the validator pairing stay here, because they need the
-- stored definition row.  The behavior of every kind is that of the prior
-- definition (20261005010000 / 20260927540000 chain) with relation, list and
-- object carrying their typed encodings.
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
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then
    return coalesce(p_provenance in ('explicit_null', 'missing'), false)
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

  -- BE03a kind/validator pairing at the value gate: a present pair must name
  -- the registered rich_text.v1 v1 member and a member pair is valid only on a
  -- rich_text field, so a stored definition cannot bind a foreign grammar.
  if field_row.validator_key is not null
     and not platform_private.cms_protected_validator_ref(
       field_row.validator_key, field_row.validator_version
     ) then
    return false;
  end if;
  if field_row.validator_key = 'rich_text.v1'
     and field_row.kind <> 'rich_text' then
    return false;
  end if;

  -- BE03b: rich text is the canonical rich_text.v1 AST (total NFC text bound
  -- by minLength/maxLength); an enum value comes from a nonempty immutable 03a
  -- choice set, so an enum definition without one fails closed; relation is the
  -- ordered targets shape; list is an array of its declared itemKind; object is
  -- the DEC-133 typed depth-1 structure; every scalar and calendar kind is its
  -- primitive encoding bounded by the 03a constraints.  Raw strings and
  -- arbitrary JSON are refused.
  return platform_private.cms_field_kind_value_shape(
    field_row.kind, field_row.constraints, p_value
  );
end;
$body$;

comment on function platform_private.cms_valid_field_input(jsonb, boolean) is
  'BE03a field definition input. A DEC-133 object kind must declare a typed objectStructure and no other kind may carry one; itemKind is a list-only constraint and a list must declare a scalar or enum itemKind; a present validator pair must name the protected rich_text.v1 v1 member and only a rich_text field may carry it; a literal defaultValue (an explicit JSON null included) satisfies the same field-kind value shape the draft gate enforces; mandatory members are checked null-safely.';
comment on function platform_private.cms_draft_field_value_valid(uuid, uuid, jsonb, text) is
  'Pinned-schema draft value gate. An explicit null or missing value is decided by provenance; every authored value is decided by the shared cms_field_kind_value_shape: rich text only as the canonical rich_text.v1 AST with 03a minLength/maxLength over total NFC text; a present validator pair must name the protected rich_text.v1 v1 member on a rich_text field; enum requires a nonempty immutable choice set; relation is the ordered targets shape; list is an array of its declared itemKind with real calendar item semantics; object is the DEC-133 typed depth-1 structure. Raw strings and arbitrary JSON are refused.';

-- Least privilege: the DEC-133 structure/value predicates and the compiled
-- manifest bound are reached only from other SECURITY DEFINER command bodies, so
-- no API role may call them directly and the CREATE-time EXECUTE-to-PUBLIC
-- default is revoked.  The definer role that owns the draft value gate keeps
-- EXECUTE on the predicates its body reaches.
revoke all on function platform_private.cms_object_structure_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_object_value_valid(jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_compiled_manifest_bounded(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_protected_validator_ref(text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_list_item_kind_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_list_item_value_valid(text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_field_kind_value_shape(text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_media_reference_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_value_source_refusal(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_require_value_source_available(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_object_structure_valid(jsonb)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_object_value_valid(jsonb, jsonb)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_compiled_manifest_bounded(jsonb)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_protected_validator_ref(text, bigint)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_list_item_kind_valid(text)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_list_item_value_valid(text, jsonb, jsonb)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_field_kind_value_shape(text, jsonb, jsonb)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_media_reference_valid(jsonb)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_value_source_refusal(text, jsonb)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_require_value_source_available(uuid, uuid, jsonb)
  to wejammin_cms_definer;

commit;
