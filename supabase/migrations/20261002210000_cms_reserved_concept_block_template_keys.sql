-- Slice 09 (re-audit AC017): BE03a "reject CMS types, fields, relations, templates and blocks
-- that impersonate reserved identity, rights, money, entitlement, credential, evidence,
-- institution or authority concepts".  Types and fields were already checked against the
-- reserved-concept registry; a block key and a template key were not, so a block named `user`
-- or a template named `payments` registered.  Both validators now refuse a reserved key with
-- the typed 422.  Bodies are otherwise identical to the previous definitions (regenerated from
-- the live functions); grants are unchanged.  Forward-only.
begin;

create or replace function platform_private.cms_valid_block_request(p_request jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  snapshot jsonb := p_request->'propsSchemaSnapshot';
  attestation jsonb := p_request->'propsSnapshotAttestation';
  accessibility jsonb := coalesce(p_request->'accessibility', p_request->'accessibilityContract');
  compatibility jsonb := coalesce(p_request->'compatibility', p_request->'compatibilityRange');
begin
  if not platform_private.cms_exact_keys(
    p_request,
    array['blockKey','blockVersion','propsSchemaRef','propsSchemaHash','propsSchemaSnapshot','propsSnapshotHash','propsSnapshotAttestation','rendererRef','allowedChildren','slotRules','dataSourcePermissions','accessibility','compatibility','lifecycle','releaseDigest']::text[],
    array['blockKey','blockVersion','propsSchemaRef','propsSchemaHash','propsSchemaSnapshot','propsSnapshotHash','propsSnapshotAttestation','rendererRef','allowedChildren','slotRules','dataSourcePermissions','accessibility','accessibilityContract','compatibility','compatibilityRange','lifecycle','releaseDigest','idempotencyKey','context','correlationId','releaseKeyId','releaseNonce','releaseIssuedAt','releaseRawBodyHash','releaseSignature','releaseSignatureHash','releaseVerifiedAt']::text[]
  ) then return false; end if;
  if p_request->>'blockKey' !~ '^[a-z][a-z0-9._-]{0,95}$'
     or platform_private.cms_reserved_key(p_request->>'blockKey')
     or p_request->>'blockVersion' !~ '^[1-9][0-9]*$'
     or (p_request->>'blockVersion')::numeric > 2147483647
     or p_request->>'propsSchemaRef' !~ '^[a-z][a-z0-9._/-]{0,255}$'
     or position('..' in p_request->>'propsSchemaRef') > 0
     or position('//' in p_request->>'propsSchemaRef') > 0
     or not platform_private.cms_schema_ref_registry_valid(p_request->>'propsSchemaRef')
     or not platform_private.cms_valid_hash(p_request->>'propsSchemaHash')
     or not platform_private.cms_valid_hash(p_request->>'propsSnapshotHash')
     or not platform_private.cms_json_bounded(snapshot, 65536, 8, 128, 128)
     or platform_private.cms_jcs_sha256(snapshot) <> p_request->>'propsSnapshotHash'
     or p_request->>'lifecycle' <> 'supported'
     or not platform_private.cms_valid_hash(p_request->>'releaseDigest') then return false; end if;
  if pg_catalog.jsonb_typeof(snapshot) <> 'object'
     or not platform_private.cms_exact_keys(snapshot, array['schemaVersion','fields','additionalProperties']::text[], array['schemaVersion','fields','additionalProperties']::text[])
     or snapshot->>'schemaVersion' is null
     or pg_catalog.length(snapshot->>'schemaVersion') not between 1 and 32
     or pg_catalog.jsonb_typeof(snapshot->'fields') <> 'array'
     or pg_catalog.jsonb_array_length(snapshot->'fields') > 128
     or pg_catalog.jsonb_typeof(snapshot->'additionalProperties') <> 'boolean'
     or snapshot->>'additionalProperties' <> 'false' then return false; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(snapshot->'fields') field_entry
    where not platform_private.cms_exact_keys(field_entry, array['name','kind','required']::text[], array['name','kind','required','constraints']::text[])
      or field_entry->>'name' !~ '^[a-z][a-z0-9_]{1,63}$'
      or pg_catalog.length(field_entry->>'kind') not between 1 and 64
      or pg_catalog.jsonb_typeof(field_entry->'required') <> 'boolean'
      or (field_entry ? 'constraints' and (
        pg_catalog.jsonb_typeof(field_entry->'constraints') <> 'object'
        or not platform_private.cms_json_bounded(field_entry->'constraints', 8192, 4, 64, 128)
      ))) then return false; end if;
  if not platform_private.cms_exact_keys(attestation, array['algorithm','keyId','signature']::text[], array['algorithm','keyId','signature']::text[])
     or attestation->>'algorithm' <> 'Ed25519'
     or attestation->>'keyId' !~ '^[a-z][a-z0-9_.-]{1,95}$'
     or not platform_private.cms_valid_base64(attestation->>'signature') then return false; end if;
  if p_request->>'rendererRef' !~ '^[a-z][a-z0-9._/-]{0,159}$'
     or position('..' in p_request->>'rendererRef') > 0
     or position('//' in p_request->>'rendererRef') > 0
     or not platform_private.cms_renderer_registry_valid(p_request->>'rendererRef')
     or pg_catalog.jsonb_typeof(p_request->'allowedChildren') <> 'array'
     or pg_catalog.jsonb_array_length(p_request->'allowedChildren') > 32 then return false; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_request->'allowedChildren') child_entry
    where pg_catalog.jsonb_typeof(child_entry) <> 'string'
      or child_entry #>> '{}' !~ '^[a-z][a-z0-9._-]{0,95}$'
      or not platform_private.cms_block_key_registry_valid(child_entry #>> '{}', p_request->>'blockKey')) then return false; end if;
  if not platform_private.cms_exact_keys(p_request->'slotRules', array['maxDepth','maxNodes']::text[], array['maxDepth','maxNodes']::text[])
     or p_request->'slotRules'->>'maxDepth' !~ '^[1-9][0-9]*$'
     or p_request->'slotRules'->>'maxNodes' !~ '^[1-9][0-9]*$'
     or (p_request->'slotRules'->>'maxDepth')::integer not between 1 and 16
     or (p_request->'slotRules'->>'maxNodes')::integer not between 1 and 512 then return false; end if;
  if pg_catalog.jsonb_typeof(p_request->'dataSourcePermissions') <> 'array'
     or pg_catalog.jsonb_array_length(p_request->'dataSourcePermissions') > 32 then return false; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_request->'dataSourcePermissions') source_entry
    where pg_catalog.jsonb_typeof(source_entry) <> 'string'
      or source_entry #>> '{}' !~ '^[a-z][a-z0-9._-]{0,127}$'
      or not platform_private.cms_data_source_registry_valid(source_entry #>> '{}')) then return false; end if;
  if not platform_private.cms_exact_keys(accessibility, array['nameRequired','keyboard','focusOrder','statusAnnouncement']::text[], array['nameRequired','keyboard','focusOrder','statusAnnouncement']::text[])
     or pg_catalog.jsonb_typeof(accessibility->'nameRequired') <> 'boolean'
     or accessibility->>'keyboard' <> 'true'
     or accessibility->>'focusOrder' not in ('document','managed')
     or pg_catalog.jsonb_typeof(accessibility->'statusAnnouncement') <> 'boolean' then return false; end if;
  if not platform_private.cms_exact_keys(compatibility, array['minSchemaCompiler','maxSchemaCompiler']::text[], array['minSchemaCompiler','maxSchemaCompiler']::text[])
     or pg_catalog.length(compatibility->>'minSchemaCompiler') not between 1 and 32
     or pg_catalog.length(compatibility->>'maxSchemaCompiler') not between 1 and 32
     or not platform_private.cms_compiler_registry_valid(compatibility->>'minSchemaCompiler')
     or not platform_private.cms_compiler_registry_valid(compatibility->>'maxSchemaCompiler') then return false; end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
  return false;
end;
$function$;

create or replace function platform_private.cms_template_manifest_valid(p_definition jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$
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
     or platform_private.cms_reserved_key(p_definition->>'templateKey')
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
       or pg_catalog.lower(type_id #>> '{}') = any(seen_types) then return false; end if;
    seen_types := pg_catalog.array_append(seen_types, pg_catalog.lower(type_id #>> '{}'));
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
$function$;

commit;
