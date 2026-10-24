-- Slice 12 lane placement (BE03c Pattern versions and linked updates 1365, validation row 377; DEC-175, DEC-181,
-- DEC-186; tracker P2-S12-AC-218): the placement plan and the CompositionInstanceResource projection.
--
--   platform_private.cms_pattern_placement_plan(owner, pinned version, slotPath, overrides) returns jsonb
--     the ordered array of { chain, root, isRoot, node } for every block node of the pinned forest after top-level nested
--     references are expanded (cms_pattern_placement_nodes), after the placement bounds hold:
--       * at most 512 block roots after expansion (pattern_nodes_exceeded, 422) and at least one;
--       * every row path (slotPath joined with `/` and the root's key chain; the root path `/` adds no separator) is at
--         most 248 octets (422 VALIDATION_FAILED at /slotPath, DEC-186);
--       * every override key names a block node of the pinned tree (422 VALIDATION_FAILED at /overrides); a key that
--         stops at a nested-reference node names no node (DEC-186).
--   platform_private.cms_composition_instance_resource(row) returns jsonb
--     the CompositionInstanceResource of a stored row.  contentHash is the D5 block comparison hash of
--     cms_compare_revisions (blockKey, blockVersion, digest, mode, patternRef, props, bindings): the position is not an
--     input, so a copy that keeps the path keeps the hash (DEC-185).  conflictState is `none` for a linked row and null
--     for a detached one.
-- Private; SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_placement_plan(
  p_owner_id uuid, p_pattern platform_private.cms_pattern_versions, p_slot_path text, p_overrides jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_nodes jsonb;
  v_roots integer;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'chain', expanded.node_chain, 'root', expanded.root_chain, 'isRoot', expanded.is_root,
           'node', expanded.node) order by expanded.ordinality), '[]'::jsonb)
    into v_nodes
    from platform_private.cms_pattern_placement_nodes(p_owner_id, p_pattern.block_tree, array[p_pattern.pattern_id])
           with ordinality expanded(node_chain, root_chain, is_root, node, ordinality);
  select pg_catalog.count(*)::integer into v_roots
    from pg_catalog.jsonb_array_elements(v_nodes) item(value) where (item.value->>'isRoot')::boolean;
  if v_roots > 512 then
    raise exception 'pattern_nodes_exceeded' using errcode = 'P0001', detail = '["/patternId"]';
  end if;
  if v_roots = 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/patternId"]';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_nodes) item(value)
     where (item.value->>'isRoot')::boolean
       and pg_catalog.octet_length(case when p_slot_path = '/' then item.value->>'root'
             else p_slot_path || (item.value->>'root') end) > 248
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_object_keys(p_overrides) override_key(value)
     where not exists (select 1 from pg_catalog.jsonb_array_elements(v_nodes) item(value)
                        where item.value->>'chain' = override_key.value)
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/overrides"]';
  end if;
  return v_nodes;
end;
$body$;

comment on function platform_private.cms_pattern_placement_plan(uuid, platform_private.cms_pattern_versions, text, jsonb) is
  'CMS-03C-02: the ordered block nodes of a pinned pattern forest after nested-reference expansion, with the 512-root, 248-octet row-path and override-key bounds enforced. Private.';

create or replace function platform_private.cms_composition_instance_resource(
  p_row platform_private.cms_composition_instances)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'id', p_row.id, 'version', p_row.version::text,
    'contentHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'blockKey', p_row.block_key, 'blockVersion', p_row.block_version,
      'blockRegistryDigest', pg_catalog.btrim(p_row.block_registry_digest::text), 'mode', p_row.link_mode,
      'patternRef', case when p_row.pattern_id is null then null
        else pg_catalog.jsonb_build_object('patternId', p_row.pattern_id, 'patternVersion', p_row.pattern_version) end,
      'props', p_row.props, 'bindings', p_row.bindings)),
    'createdAt', platform_private.auth_iso_time(p_row.created_at),
    'updatedAt', platform_private.auth_iso_time(p_row.updated_at),
    'state', p_row.state, 'revisionId', p_row.revision_id, 'path', p_row.path, 'position', p_row.position,
    'blockKey', p_row.block_key, 'blockVersion', p_row.block_version, 'patternId', p_row.pattern_id,
    'patternVersion', p_row.pattern_version, 'blockRegistryDigest', pg_catalog.btrim(p_row.block_registry_digest::text),
    'linkMode', p_row.link_mode, 'conflictState', case p_row.link_mode when 'linked' then 'none' else null end)
$body$;

comment on function platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances) is
  'The CompositionInstanceResource of a stored composition row (contentHash = the D5 block comparison hash, position not an input). Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_placement_plan(uuid, platform_private.cms_pattern_versions, text, jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_placement_plan(uuid, platform_private.cms_pattern_versions, text, jsonb),
  platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances)
  from public, anon, authenticated, service_role;

commit;
