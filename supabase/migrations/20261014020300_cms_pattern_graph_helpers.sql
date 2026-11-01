-- Slice 12 lane pattern-def (BE03c "Pattern versions and linked updates" 1361, validation row 396, typed refusals
-- 1304; tracker P2-S12-AC-101, AC-104, AC-211): the stored-graph helpers of CMS-03C-12.
--
--   cms_pattern_nested_closure(owner, tree)   every nested pattern version a forest reaches, transitively, by the
--                                             PINNED (lineage, definition version) of each reference: the pinned row
--                                             id (NULL when no such row exists in the owner scope), its lineage, its
--                                             definition version and its chain depth (1 for a direct reference).
--                                             Bounded at depth 10, so it terminates even over hostile data.
--   cms_pattern_registry_digest(owner, tree)  the blockRegistryDigest of a forest: every reachable block (nested
--                                             patterns included) resolved from the 03a safe registry FOR SHARE in
--                                             block key/version order, deduplicated, folded in the same tuple form
--                                             and JCS hash as cms_template_block_digest and the governed recompute
--                                             (a missing or withdrawn block is VALIDATION_FAILED; a deprecated block is
--                                             admitted, BE03c 396 and 1361, and its tuple records `deprecated`)
--   cms_pattern_blocks_compatible(owner, tree, type ids)
--                                             true when every reachable block (nested patterns included) is listed in
--                                             the renderer manifest (`blocks` or `blockDefinitions`) of the ACTIVE
--                                             version of every type, the template rule of cms_template_block_digest
--   cms_pattern_resource(id)                  the exact safe PatternVersionResource projection of a stored row
-- Private; SECURITY DEFINER with an empty search_path, owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_nested_closure(p_owner_id uuid, p_tree jsonb)
returns table(nested_row_id uuid, nested_pattern_id uuid, nested_version integer, nested_depth integer)
language sql
stable
security definer
set search_path = ''
as $body$
  with recursive reach(row_id, lineage_id, def_version, depth) as (
    select pinned.id, ref.ref_pattern_id, ref.ref_pattern_version, 1
      from platform_private.cms_pattern_refs(p_tree) ref
      left join platform_private.cms_pattern_versions pinned
        on pinned.owner_id = p_owner_id
       and pinned.pattern_id = ref.ref_pattern_id
       and pinned.version = ref.ref_pattern_version
    union
    select pinned.id, ref.ref_pattern_id, ref.ref_pattern_version, reach.depth + 1
      from reach
      join platform_private.cms_pattern_versions parent on parent.id = reach.row_id
      cross join lateral platform_private.cms_pattern_refs(parent.block_tree) ref
      left join platform_private.cms_pattern_versions pinned
        on pinned.owner_id = p_owner_id
       and pinned.pattern_id = ref.ref_pattern_id
       and pinned.version = ref.ref_pattern_version
     where reach.depth < 10
  )
  select reach.row_id, reach.lineage_id, reach.def_version, reach.depth from reach
$body$;

comment on function platform_private.cms_pattern_nested_closure(uuid, jsonb) is
  'BE03c nested pattern graph: every pinned (lineage, definition version) reachable from a forest through nested references, scoped to one owner, with the chain depth; a reference with no pinned row has a NULL row id. Bounded at depth 10. Private.';

create or replace function platform_private.cms_pattern_registry_digest(p_owner_id uuid, p_tree jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  block_ref record;
  block_row platform_private.cms_block_definition_versions%rowtype;
  block_lifecycle text;
  tuples jsonb := '[]'::jsonb;
begin
  for block_ref in
    select reached.block_key, reached.block_version
      from (
        select distinct closure.block_key, closure.block_version
          from platform_private.cms_governed_pattern_closure(p_owner_id, p_tree) closure
         where closure.item_kind = 'block'
      ) reached
     order by reached.block_key collate "C", reached.block_version
  loop
    select * into block_row
      from platform_private.cms_block_definition_versions candidate
     where candidate.block_key = block_ref.block_key
       and candidate.block_version = block_ref.block_version
       and candidate.state = 'registered'
       for share;
    if not found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/blockTree"]';
    end if;
    select lifecycle_event.to_lifecycle into block_lifecycle
      from platform_private.cms_block_definition_lifecycle_events lifecycle_event
     where lifecycle_event.block_definition_version_id = block_row.id
     order by lifecycle_event.created_at desc, lifecycle_event.id desc
     limit 1;
    if coalesce(block_lifecycle, 'supported') = 'withdrawn' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/blockTree"]';
    end if;
    tuples := tuples || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'blockKey', block_row.block_key,
      'blockVersion', block_row.block_version,
      'releaseDigest', pg_catalog.btrim(block_row.release_digest::text),
      'propsSchemaHash', pg_catalog.btrim(block_row.props_schema_hash::text),
      'rendererRef', block_row.renderer_ref,
      'lifecycle', coalesce(block_lifecycle, 'supported')));
  end loop;
  return platform_private.cms_jcs_sha256(tuples);
end;
$body$;

comment on function platform_private.cms_pattern_registry_digest(uuid, jsonb) is
  'BE03c digest invariants: the lowercase SHA-256 over the RFC 8785 JCS of the deduplicated reachable block tuples of a pattern forest (nested patterns included), sorted by UTF-8 block key then numeric version, each tuple resolved FOR SHARE from the 03a registry; a missing or withdrawn block raises VALIDATION_FAILED, a deprecated block is admitted and recorded as deprecated. Private.';

create or replace function platform_private.cms_pattern_blocks_compatible(
  p_owner_id uuid, p_tree jsonb, p_type_ids jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select not exists (
    select 1
      from (
        select distinct closure.block_key, closure.block_version
          from platform_private.cms_governed_pattern_closure(p_owner_id, p_tree) closure
         where closure.item_kind = 'block'
      ) reached
      cross join pg_catalog.jsonb_array_elements_text(p_type_ids) wanted(value)
     where not exists (
       select 1
         from platform_private.cms_content_types content_type
         join platform_private.cms_content_type_versions version_row
           on version_row.content_type_id = content_type.id
         join platform_private.cms_schema_artifacts artifact
           on artifact.id = version_row.schema_artifact_id
          and artifact.content_type_version_id = version_row.id
        where content_type.id = wanted.value::uuid
          and content_type.owner_id = p_owner_id
          and content_type.state = 'active'
          and version_row.state = 'active'
          and exists (
            select 1 from (
              select value from pg_catalog.jsonb_array_elements(
                coalesce(artifact.renderer_manifest->'blocks', '[]'::jsonb)) as value
              union all
              select value from pg_catalog.jsonb_array_elements(
                coalesce(artifact.renderer_manifest->'blockDefinitions', '[]'::jsonb)) as value
            ) manifest_block
            where manifest_block.value->>'blockKey' = reached.block_key
              and manifest_block.value->>'blockVersion' = reached.block_version::text))
  )
$body$;

comment on function platform_private.cms_pattern_blocks_compatible(uuid, jsonb, jsonb) is
  'BE03c 1361 (OD-2, mirroring templates): true when every distinct block a pattern forest reaches, nested patterns included, is listed in the renderer manifest (blocks or blockDefinitions) of the active version of every compatible content type of the owner. Private.';

create or replace function platform_private.cms_pattern_resource(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'id', version_row.id,
    'version', version_row.version::text,
    'contentHash', pg_catalog.btrim(version_row.content_hash::text),
    'createdAt', platform_private.auth_iso_time(version_row.created_at),
    'updatedAt', platform_private.auth_iso_time(version_row.updated_at),
    'state', version_row.state,
    'patternId', version_row.pattern_id,
    'patternKey', version_row.pattern_key,
    'patternVersion', version_row.version,
    'compatibleTypeIds', version_row.compatible_type_ids,
    'nodeCount', version_row.node_count,
    'blockRegistryDigest', pg_catalog.btrim(version_row.block_registry_digest::text)
  )
  from platform_private.cms_pattern_versions version_row
  where version_row.id = p_id
$body$;

comment on function platform_private.cms_pattern_resource(uuid) is
  'BE03c PatternVersionResource: the exact safe projection of a stored pattern version (no owner, creator, capability or lifecycle counter). The definition version is the public CAS version. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_nested_closure(uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_registry_digest(uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_blocks_compatible(uuid, jsonb, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_resource(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_pattern_nested_closure(uuid, jsonb),
  platform_private.cms_pattern_registry_digest(uuid, jsonb),
  platform_private.cms_pattern_blocks_compatible(uuid, jsonb, jsonb),
  platform_private.cms_pattern_resource(uuid)
  from public, anon, authenticated, service_role;

commit;
