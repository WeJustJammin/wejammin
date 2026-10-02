-- Fix the Slice 12 digest helper's DISTINCT/ORDER BY alias resolution.
-- The helper was introduced in 20260927200000 and may already be deployed,
-- so preserve migration history and advance it forward only.
begin;

create or replace function platform_private.cms_template_block_digest(
  p_slots jsonb, p_type_ids jsonb, p_owner_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  reference record;
  block_row platform_private.cms_block_definition_versions%rowtype;
  current_lifecycle text;
  type_id jsonb;
  compatible boolean;
  tuples jsonb := '[]'::jsonb;
begin
  for reference in
    select blocks.block_key, blocks.block_version
    from (
      select distinct
        block_ref.value->>'blockKey' as block_key,
        (block_ref.value->>'blockVersion')::integer as block_version
      from pg_catalog.jsonb_array_elements(p_slots) as slot(value)
      cross join lateral pg_catalog.jsonb_array_elements(
        slot.value->'allowedBlocks'
      ) as block_ref(value)
    ) blocks
    order by blocks.block_key collate "C", blocks.block_version
  loop
    select * into block_row
      from platform_private.cms_block_definition_versions candidate
     where candidate.block_key = reference.block_key
       and candidate.block_version = reference.block_version
       and candidate.state = 'registered'
     for share;
    if not found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select lifecycle_event.to_lifecycle into current_lifecycle
      from platform_private.cms_block_definition_lifecycle_events lifecycle_event
     where lifecycle_event.block_definition_version_id = block_row.id
     order by lifecycle_event.created_at desc, lifecycle_event.id desc
     limit 1;
    if coalesce(current_lifecycle, 'supported') <> 'supported' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    for type_id in select value from pg_catalog.jsonb_array_elements(p_type_ids) as value loop
      select exists (
        select 1
          from platform_private.cms_content_types content_type
          join platform_private.cms_content_type_versions version_row
            on version_row.content_type_id = content_type.id
          join platform_private.cms_schema_artifacts artifact
            on artifact.id = version_row.schema_artifact_id
           and artifact.content_type_version_id = version_row.id
         where content_type.id = (type_id #>> '{}')::uuid
           and content_type.owner_id = p_owner_id
           and content_type.state = 'active'
           and version_row.state = 'active'
           and exists (
             select 1 from (
               select value from pg_catalog.jsonb_array_elements(
                 coalesce(artifact.renderer_manifest->'blocks','[]'::jsonb)
               ) as value
               union all
               select value from pg_catalog.jsonb_array_elements(
                 coalesce(artifact.renderer_manifest->'blockDefinitions','[]'::jsonb)
               ) as value
             ) manifest_block
             where manifest_block.value->>'blockKey' = reference.block_key
               and manifest_block.value->>'blockVersion' = reference.block_version::text
           )
      ) into compatible;
      if not compatible then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
    end loop;
    tuples := tuples || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'blockKey', block_row.block_key,
      'blockVersion', block_row.block_version,
      'releaseDigest', pg_catalog.btrim(block_row.release_digest::text),
      'propsSchemaHash', pg_catalog.btrim(block_row.props_schema_hash::text),
      'rendererRef', block_row.renderer_ref,
      'lifecycle', current_lifecycle
    ));
  end loop;
  return platform_private.cms_jcs_sha256(tuples);
end;
$body$;

revoke all on function platform_private.cms_template_block_digest(jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role;

commit;
