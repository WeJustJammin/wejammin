-- Slice 10 gap resolution DEC-144 (P2-S10-AC-078/AC-080, audit D-7): the closed
-- per-kind object-property constraint vocabulary, enforced identically by
-- PostgreSQL and TypeScript.
--
-- 20261005010100 admitted any JSON record as an object property's `constraints`
-- (BE03b typed it Record<string, Json>), so {"minimum": 8, "maximum": 1} was a
-- valid structure and no value was ever checked against a declared bound.
-- AC-078 requires strict kind-specific constraints, so the vocabulary is closed
-- by mirroring the field-level members per property kind:
--
--   scalar    minLength / maxLength (string values), minimum / maximum (number
--             values);
--   enum      required nonempty enumValues (1..256 strings of at most 160
--             characters) plus optional minLength / maxLength;
--   rich_text minLength / maxLength over the total NFC text.
--
-- Unknown members, members of another kind, wrong types, a length member that
-- is not an integer in 0..100000, and min > max are refused by the structure
-- predicate; the value predicate checks every value against the constraints its
-- property declares (lengths count Unicode characters, BE03a).  A boolean value
-- is constrained by neither family.  No new vocabulary is invented.
--
-- platform_private.cms_object_property_constraints_valid is the one place the
-- vocabulary lives; cms_object_structure_valid and cms_object_value_valid are
-- the 20261005010100 definitions with only that delegation and the value checks
-- added.  Signatures, volatility, search_path and grants are unchanged (CREATE
-- OR REPLACE); the new helper is revoked from every API role and executable by
-- the definer role only.  The preflight keeps a stored definition from being
-- silently invalidated.  The shared corpus is
-- supabase/tests/phase_02_slice_10_object_property_constraints.sql, parsed by
-- the TypeScript parity test.  Forward-only.
begin;

create or replace function platform_private.cms_object_property_constraints_valid(
  p_kind text,
  p_constraints jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  allowed text[];
  member_name text;
  enum_values jsonb;
begin
  if p_kind is null
     or p_constraints is null
     or pg_catalog.jsonb_typeof(p_constraints) is distinct from 'object' then
    return false;
  end if;
  allowed := case p_kind
    when 'scalar' then array['minLength', 'maxLength', 'minimum', 'maximum']::text[]
    when 'enum' then array['enumValues', 'minLength', 'maxLength']::text[]
    when 'rich_text' then array['minLength', 'maxLength']::text[]
    else null
  end;
  if allowed is null then
    return false;
  end if;
  -- Closed vocabulary: an unknown member or a member of another kind is refused.
  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_constraints) as constraint_key
    where constraint_key <> all(allowed)
  ) then
    return false;
  end if;
  -- minLength / maxLength: a non-negative integer of at most 100000.
  foreach member_name in array array['minLength', 'maxLength']::text[] loop
    if p_constraints ? member_name
       and (
         pg_catalog.jsonb_typeof(p_constraints->member_name) is distinct from 'number'
         or (p_constraints->>member_name) !~ '^[0-9]+$'
         or (p_constraints->>member_name)::numeric > 100000
       ) then
      return false;
    end if;
  end loop;
  if p_constraints ? 'minLength' and p_constraints ? 'maxLength'
     and (p_constraints->>'minLength')::numeric
         > (p_constraints->>'maxLength')::numeric then
    return false;
  end if;
  -- minimum / maximum: JSON numbers, minimum <= maximum.
  foreach member_name in array array['minimum', 'maximum']::text[] loop
    if p_constraints ? member_name
       and pg_catalog.jsonb_typeof(p_constraints->member_name) is distinct from 'number' then
      return false;
    end if;
  end loop;
  if p_constraints ? 'minimum' and p_constraints ? 'maximum'
     and (p_constraints->>'minimum')::numeric
         > (p_constraints->>'maximum')::numeric then
    return false;
  end if;
  -- enum: a required nonempty immutable choice set of 1..256 strings of at most
  -- 160 characters (the field-level enumValues bound).
  if p_kind = 'enum' then
    enum_values := p_constraints->'enumValues';
    if pg_catalog.jsonb_typeof(enum_values) is distinct from 'array'
       or pg_catalog.jsonb_array_length(enum_values) not between 1 and 256
       or exists (
         select 1
         from pg_catalog.jsonb_array_elements(enum_values) enum_entry
         where pg_catalog.jsonb_typeof(enum_entry) <> 'string'
            or pg_catalog.length(enum_entry #>> '{}') > 160
       ) then
      return false;
    end if;
  end if;
  return true;
end;
$body$;

comment on function platform_private.cms_object_property_constraints_valid(text, jsonb) is
  'DEC-144 closed per-kind object-property constraint vocabulary: scalar minLength/maxLength/minimum/maximum; enum a required nonempty enumValues (1-256 strings of at most 160 characters) plus optional minLength/maxLength; rich_text minLength/maxLength. Unknown or other-kind members, wrong types, a length outside 0-100000 and min > max are refused. Pure predicate.';

revoke all on function platform_private.cms_object_property_constraints_valid(text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_object_property_constraints_valid(text, jsonb)
  to wejammin_cms_definer;

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
    -- DEC-144: the constraint vocabulary is closed per property kind.
    if not coalesce(
         platform_private.cms_object_property_constraints_valid(
           property_kind, property->'constraints'
         ), false
       ) then
      return false;
    end if;
  end loop;
  return true;
end;
$body$;

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
  property_constraints jsonb;
  value_text text;
  value_number numeric;
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
    property_constraints := property->'constraints';
    if property_kind = 'rich_text' then
      -- DEC-144: a rich_text property is a canonical rich_text.v1 document whose
      -- total NFC text length honours its minLength / maxLength.
      if not coalesce(platform_private.cms_rich_text_v1_valid(property_value), false)
         or not coalesce(
           platform_private.cms_rich_text_length_in_bounds(
             property_value, property_constraints
           ), false
         ) then
        return false;
      end if;
    elsif property_kind = 'enum' then
      if pg_catalog.jsonb_typeof(property_value) <> 'string'
         or not coalesce(
           property_constraints->'enumValues'
             @> pg_catalog.jsonb_build_array(property_value #>> '{}'),
           false
         ) then
        return false;
      end if;
      -- DEC-144: an enum value also honours its optional minLength / maxLength
      -- (Unicode characters, as the field-level encoding counts them).
      value_text := property_value #>> '{}';
      if property_constraints ? 'minLength'
         and pg_catalog.length(value_text)
             < (property_constraints->>'minLength')::numeric then
        return false;
      end if;
      if property_constraints ? 'maxLength'
         and pg_catalog.length(value_text)
             > (property_constraints->>'maxLength')::numeric then
        return false;
      end if;
    else
      -- scalar: a JSON primitive only (string, boolean or finite number); an
      -- authored JSON null is refused, as it is for every scalar field kind.
      if pg_catalog.jsonb_typeof(property_value)
           not in ('string', 'boolean', 'number') then
        return false;
      end if;
      -- DEC-144: a string value honours minLength / maxLength (Unicode
      -- characters) and a number value honours minimum / maximum; a boolean is
      -- constrained by neither, and a member of the other family never
      -- constrains a value of this type.
      if pg_catalog.jsonb_typeof(property_value) = 'string' then
        value_text := property_value #>> '{}';
        if property_constraints ? 'minLength'
           and pg_catalog.length(value_text)
               < (property_constraints->>'minLength')::numeric then
          return false;
        end if;
        if property_constraints ? 'maxLength'
           and pg_catalog.length(value_text)
               > (property_constraints->>'maxLength')::numeric then
          return false;
        end if;
      elsif pg_catalog.jsonb_typeof(property_value) = 'number' then
        value_number := (property_value #>> '{}')::numeric;
        if property_constraints ? 'minimum'
           and value_number < (property_constraints->>'minimum')::numeric then
          return false;
        end if;
        if property_constraints ? 'maximum'
           and value_number > (property_constraints->>'maximum')::numeric then
          return false;
        end if;
      end if;
    end if;
  end loop;
  return true;
end;
$body$;

-- No stored object field definition may carry a structure the closed vocabulary
-- refuses: a compiled definition must not be invalidated behind its artifact.
do $preflight$
begin
  if exists (
    select 1
    from platform_private.cms_field_definition_versions field_row
    where field_row.kind = 'object'
      and field_row.constraints ? 'objectStructure'
      and not coalesce(
        platform_private.cms_object_structure_valid(
          field_row.constraints->'objectStructure'
        ), false
      )
  ) then
    raise exception 'CMS object field definitions must satisfy the closed property constraint vocabulary (DEC-144)'
      using errcode = 'P0001';
  end if;
end;
$preflight$;

comment on function platform_private.cms_object_structure_valid(jsonb) is
  'DEC-133 typed depth-1 object structure (0-32 properties; strict key/kind/required/constraints members; unique stable keys; scalar/enum/rich_text kinds only) whose property constraints are the DEC-144 closed per-kind vocabulary (scalar min/max length and min/max; enum a nonempty enumValues set plus optional length bounds; rich_text length bounds). Null-safe: a missing or JSON-null member is refused, never skipped. Pure predicate: no reads, no writes, no evidence.';
comment on function platform_private.cms_object_value_valid(jsonb, jsonb) is
  'DEC-133 depth-1 object value against its declared structure. Closed keys, required presence, primitive scalars (string, boolean or finite number; a JSON null is not a scalar value) bounded by their minLength/maxLength (strings) or minimum/maximum (numbers), declared enum choices bounded by minLength/maxLength, and rich_text.v1 documents bounded by minLength/maxLength over the total NFC text (DEC-144); unknown or nested values are refused.';

commit;
