-- Slice 12 nonempty block manifests must use the same validator as empty ones.
-- Repair the already-applied immutable validator forward-only; SQL operator
-- precedence previously sent a text value to ->> and the exception handler
-- then rejected every template containing an allowed block.
begin;

create or replace function platform_private.cms_template_manifest_valid(
  p_definition jsonb
)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $body$
declare
  type_id jsonb;
  slot jsonb;
  block_ref jsonb;
  binding record;
  region jsonb;
  seen_types text[] := array[]::text[];
  seen_slots text[] := array[]::text[];
  seen_regions text[] := array[]::text[];
  seen_blocks text[];
  block_identity text;
begin
  if not platform_private.cms_exact_keys(
    p_definition,
    array['templateKey','compatibleTypeIds','slots','reservedRegions',
      'bindings','locale','audience']::text[],
    array['templateKey','compatibleTypeIds','slots','reservedRegions',
      'bindings','locale','audience']::text[]
  ) or not platform_private.cms_json_bounded(p_definition, 262144, 8, 128, 128)
     or coalesce(p_definition->>'templateKey','') !~ '^[a-z][a-z0-9-]{1,63}$'
     or coalesce(p_definition->>'locale','') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
     or pg_catalog.jsonb_typeof(p_definition->'audience') <> 'string'
     or pg_catalog.octet_length(p_definition->>'audience') not between 1 and 64
     or p_definition->>'audience' ~ '[<>{}]'
     or pg_catalog.jsonb_typeof(p_definition->'compatibleTypeIds') <> 'array'
     or pg_catalog.jsonb_array_length(p_definition->'compatibleTypeIds') not between 1 and 64
     or pg_catalog.jsonb_typeof(p_definition->'slots') <> 'array'
     or pg_catalog.jsonb_array_length(p_definition->'slots') > 64
     or pg_catalog.jsonb_typeof(p_definition->'reservedRegions') <> 'array'
     or pg_catalog.jsonb_array_length(p_definition->'reservedRegions') not between 5 and 32
     or pg_catalog.jsonb_typeof(p_definition->'bindings') <> 'object' then
    return false;
  end if;

  for type_id in select value from pg_catalog.jsonb_array_elements(p_definition->'compatibleTypeIds') as value loop
    if pg_catalog.jsonb_typeof(type_id) <> 'string'
       or (type_id #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or (type_id #>> '{}') = any(seen_types) then return false; end if;
    seen_types := pg_catalog.array_append(seen_types, type_id #>> '{}');
  end loop;

  if p_definition->'reservedRegions'->>0 <> 'header'
     or p_definition->'reservedRegions'->>1 <> 'now'
     or p_definition->'reservedRegions'->>2 <> 'record'
     or p_definition->'reservedRegions'->>3 <> 'detail'
     or p_definition->'reservedRegions'->>4 <> 'provenance' then return false; end if;
  for region in select value from pg_catalog.jsonb_array_elements(p_definition->'reservedRegions') as value loop
    if pg_catalog.jsonb_typeof(region) <> 'string'
       or (region #>> '{}') !~ '^[a-z][a-z0-9_-]{1,63}$'
       or (region #>> '{}') = any(seen_regions) then return false; end if;
    seen_regions := pg_catalog.array_append(seen_regions, region #>> '{}');
  end loop;

  for slot in select value from pg_catalog.jsonb_array_elements(p_definition->'slots') as value loop
    if not platform_private.cms_exact_keys(
      slot, array['key','required','allowedBlocks','maxCount']::text[],
      array['key','required','allowedBlocks','maxCount']::text[]
    ) or coalesce(slot->>'key','') !~ '^[a-z][a-z0-9_-]{1,63}$'
       or slot->>'key' = any(seen_slots)
       or pg_catalog.jsonb_typeof(slot->'required') <> 'boolean'
       or pg_catalog.jsonb_typeof(slot->'allowedBlocks') <> 'array'
       or pg_catalog.jsonb_array_length(slot->'allowedBlocks') > 32
       or pg_catalog.jsonb_typeof(slot->'maxCount') <> 'number'
       or coalesce(slot->>'maxCount','') !~ '^[1-9][0-9]{0,2}$'
       or (slot->>'maxCount')::integer > 128 then return false; end if;
    seen_slots := pg_catalog.array_append(seen_slots, slot->>'key');
    seen_blocks := array[]::text[];
    for block_ref in select value from pg_catalog.jsonb_array_elements(slot->'allowedBlocks') as value loop
      if not platform_private.cms_exact_keys(
        block_ref, array['blockKey','blockVersion']::text[],
        array['blockKey','blockVersion']::text[]
      ) or coalesce(block_ref->>'blockKey','') !~ '^[a-z][a-z0-9._-]{0,95}$'
         or pg_catalog.jsonb_typeof(block_ref->'blockVersion') <> 'number'
         or coalesce(block_ref->>'blockVersion','') !~ '^[1-9][0-9]{0,9}$'
         or (block_ref->>'blockVersion')::bigint > 2147483647 then return false; end if;
      block_identity := (block_ref->>'blockKey') || ':' || (block_ref->>'blockVersion');
      if block_identity = any(seen_blocks) then return false; end if;
      seen_blocks := pg_catalog.array_append(seen_blocks, block_identity);
    end loop;
  end loop;

  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_definition->'bindings')) > 128 then
    return false;
  end if;
  for binding in select key, value from pg_catalog.jsonb_each(p_definition->'bindings') loop
    if pg_catalog.octet_length(binding.key) not between 1 and 128
       or binding.key ~ '[<>{}]'
       or not platform_private.cms_exact_keys(
         binding.value, array['projection','required']::text[],
         array['projection','required']::text[]
       ) or coalesce(binding.value->>'projection','') !~ '^[a-z][a-z0-9._-]{0,127}$'
       or pg_catalog.jsonb_typeof(binding.value->'required') <> 'boolean' then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$body$;

-- The grant and membership authority helper calls a volatile actor resolver.
alter function platform_private.cms_template_designer_authorized(uuid, uuid)
  volatile;
revoke all on function platform_private.cms_template_manifest_valid(jsonb)
  from public, anon, authenticated, service_role;

commit;
