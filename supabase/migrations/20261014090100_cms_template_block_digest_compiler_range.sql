-- Slice 12 lane block-compat (root ruling B, review-blockcompat.md).  Replaces the block compatibility rule of
-- platform_private.cms_template_block_digest (applied in 20260927240000, comment-only origin 20260927200000:268).
--
-- WHAT CHANGES (and only this): for each distinct allowed block and each compatibleTypeIds member, the type's
-- active schema artifact no longer has to list the block in `renderer_manifest->'blocks'|'blockDefinitions'`.
-- The compiler never writes such a member (20260902080000:704-715, BE03a 2246-2255, P2-S09-AC-007), so every real
-- block-bearing template was unsatisfiable.  The rule is now the spec's (BE03a 1098-1101, 2761; BE03c 209, 321,
-- 1567; IA03 44-45, 65-66; IA deep dive 227, 400): the block is registered and currently supported (unchanged),
-- and its registered compatibility {minSchemaCompiler, maxSchemaCompiler} covers the compiler_version of that
-- type's active artifact, dotted-numerically over the closed compiler registry, failing closed
-- (cms_block_range_covers, 20261014090000).  Refusals are unchanged: unregistered or out-of-range VALIDATION_FAILED,
-- not supported CONFLICT.
--
-- WHAT DOES NOT CHANGE: the signature, language, volatility, SECURITY DEFINER, empty search_path, owner and ACL
-- (CREATE OR REPLACE keeps them), the per-block FOR SHARE lock, the lifecycle resolution, the ordering, and the
-- tuple { blockKey, blockVersion, releaseDigest, propsSchemaHash, rendererRef, lifecycle } and its JCS hash: every
-- digest the function could return before is byte-identical after it.  The comment at 20261013300400:133
-- ("renderer-manifest compatibility included") is stale and cannot be edited; the governed recompute delegates its
-- template branch to this function, so it follows the new rule automatically.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
    current_lifecycle := coalesce(current_lifecycle, 'supported');
    if current_lifecycle <> 'supported' then
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
           and platform_private.cms_block_range_covers(
             block_row.compatibility_range, artifact.compiler_version)
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

comment on function platform_private.cms_template_block_digest(jsonb, jsonb, uuid) is
  'CMS-03C-01 block registry digest: each allowed block is resolved FOR SHARE from the 03a registry (unregistered VALIDATION_FAILED, not supported CONFLICT), its registered schema-compiler range must cover the compiler_version of every compatible type active artifact (VALIDATION_FAILED), and the sorted deduplicated safe tuples are JCS-hashed. Private.';

revoke all on function platform_private.cms_template_block_digest(jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role;

commit;
