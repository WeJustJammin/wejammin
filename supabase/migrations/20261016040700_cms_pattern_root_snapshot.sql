-- DEC-193 writer adapter: one real expanded block root, exact flat-slot binding. The local template identifier is
-- v_template_id so it cannot collide with cms_template_versions.template_id for template-bound entries.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_pattern_root_snapshot(
  p_row platform_private.cms_composition_instances,
  p_pattern platform_private.cms_pattern_versions, p_strict boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_template_id uuid;
  slot_path text;
  v_root_chain text;
  expanded record;
  nodes jsonb := '[]'::jsonb;
  tree jsonb;
  parents text[] := '{}'::text[];
  indexes integer[] := '{}'::integer[];
  parent_chain text;
  parent_index integer;
  node_index integer := 0;
begin
  if p_pattern.id is null or p_pattern.owner_id is distinct from p_row.owner_id
     or p_pattern.pattern_id is distinct from p_row.pattern_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select revision.template_version_id into v_template_id
    from platform_private.cms_entry_revisions revision
   where revision.id = p_row.revision_id and revision.owner_id = p_row.owner_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_template_id is null then
    v_root_chain := p_row.path;
  else
    select '/' || (slot.value->>'key') into slot_path
      from platform_private.cms_template_versions template_row
      cross join lateral pg_catalog.jsonb_array_elements(template_row.slots) slot(value)
     where template_row.id = v_template_id and template_row.owner_id = p_row.owner_id
       and slot.value->>'key' = p_row.slot_key;
    if not found or not pg_catalog.starts_with(p_row.path, slot_path || '/') then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    v_root_chain := pg_catalog.substr(p_row.path, pg_catalog.char_length(slot_path) + 1);
  end if;
  for expanded in
    select reached.* from platform_private.cms_pattern_update_nodes(
      p_row.owner_id, p_pattern.block_tree, array[p_pattern.pattern_id], p_strict)
      with ordinality reached(node_chain, root_chain, is_root, node, ordinal)
     where reached.root_chain = v_root_chain order by reached.ordinal
  loop
    if node_index = 0 then
      if not expanded.is_root or (p_pattern.version = p_row.pattern_version and
        (expanded.node->>'blockKey' is distinct from p_row.block_key or
         (expanded.node->>'blockVersion')::bigint is distinct from p_row.block_version)) then
        raise exception 'NOT_FOUND' using errcode = 'P0001';
      end if;
    end if;
    while pg_catalog.cardinality(parents) > 0 and not pg_catalog.starts_with(
      expanded.node_chain, parents[pg_catalog.cardinality(parents)] || '/') loop
      parents := parents[1:pg_catalog.cardinality(parents)-1];
      indexes := indexes[1:pg_catalog.cardinality(indexes)-1];
    end loop;
    if node_index > 0 and pg_catalog.cardinality(parents) = 0 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    parent_chain := coalesce(parents[pg_catalog.cardinality(parents)], '');
    parent_index := indexes[pg_catalog.cardinality(indexes)];
    nodes := nodes || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'parent', parent_index,
      'keySegments', pg_catalog.string_to_array(pg_catalog.substr(
        expanded.node_chain, pg_catalog.char_length(parent_chain) + 2), '/'),
      'blockKey', expanded.node->'blockKey', 'blockVersion', expanded.node->'blockVersion',
      'props', expanded.node->'props'));
    parents := pg_catalog.array_append(parents, expanded.node_chain);
    indexes := pg_catalog.array_append(indexes, node_index);
    node_index := node_index + 1;
  end loop;
  if node_index = 0 then
    if p_pattern.version = p_row.pattern_version then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    return 'null'::jsonb;
  end if;
  tree := pg_catalog.jsonb_build_object('format', 'cms.detached_tree.v1', 'nodes', nodes);
  if platform_private.cms_detached_tree_valid(tree) is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return tree;
end;
$body$;

comment on function platform_private.cms_pattern_root_snapshot(
  platform_private.cms_composition_instances, platform_private.cms_pattern_versions, boolean) is
  'DEC-193 private writer adapter: exact declared flat-slot/root chain, real ordered expansion with caller strictness, base root identity proof and canonical preorder relative namespaces. Absent newer-target root is JSONB null. No public diff-read or aggregate snapshot cap.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_root_snapshot(
  platform_private.cms_composition_instances, platform_private.cms_pattern_versions, boolean)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_root_snapshot(
  platform_private.cms_composition_instances, platform_private.cms_pattern_versions, boolean)
  from public, anon, authenticated, service_role;
commit;
