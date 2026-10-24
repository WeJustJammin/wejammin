-- DEC-193: pure canonical-snapshot representation for internal resolution.
-- No store lookup, registry decision, public diff-read cap or row-path cap.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_pattern_snapshot_expanded(p_tree jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $body$
declare
  result jsonb := '[]'::jsonb;
  node jsonb;
  addresses text[] := '{}'::text[];
  address text;
  root_address text;
  relative_address text;
  node_index integer := 0;
  parent_index integer;
begin
  -- Explicit target removal is JSONB null. SQL NULL is never an empty tree.
  if p_tree = 'null'::jsonb then
    return result;
  end if;
  if platform_private.cms_detached_tree_valid(p_tree) is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  for node in
    select item.value from pg_catalog.jsonb_array_elements(p_tree->'nodes')
      with ordinality item(value, ordinal) order by item.ordinal
  loop
    select pg_catalog.string_agg(item.value, '/' order by item.ordinal)
      into relative_address
      from pg_catalog.jsonb_array_elements_text(node->'keySegments')
        with ordinality item(value, ordinal);
    if node_index = 0 then
      address := '/' || relative_address;
      root_address := address;
    else
      parent_index := (node->>'parent')::numeric::integer;
      address := addresses[parent_index + 1] || '/' || relative_address;
      result := pg_catalog.jsonb_set(result, array[parent_index::text, 'children'],
        (result->parent_index->'children') || pg_catalog.jsonb_build_array(address), false);
    end if;
    addresses := pg_catalog.array_append(addresses, address);
    result := result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'chain', address, 'root', root_address, 'isRoot', node_index = 0,
      'node', node, 'children', '[]'::jsonb));
    node_index := node_index + 1;
  end loop;
  return result;
end;
$body$;

comment on function platform_private.cms_pattern_snapshot_expanded(jsonb) is
  'DEC-193 private pure representation: validated preorder snapshot to ordered expanded {chain,root,isRoot,node,children}; node retains exact canonical fields/props, children contains direct block addresses. JSONB null is absent target; SQL NULL is invalid. No aggregate read or stored-address cap.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_snapshot_expanded(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_snapshot_expanded(jsonb)
  from public, anon, authenticated, service_role;

commit;
