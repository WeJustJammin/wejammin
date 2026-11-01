-- DEC-193 / BE03c 1563: private detached local-tree storage only.
-- No producer, registry lookup, render, digest or carry-over change. Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- One store-free predicate for the table CHECK and future snapshot producers.
-- Node order is retained, not sorted. Namespace prefixes participate in preorder
-- even though only block nodes have indices in the snapshot.
create function platform_private.cms_detached_tree_valid(p_tree jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $body$
declare
  node jsonb;
  segment jsonb;
  node_index integer := 0;
  version_number numeric;
  parent_number numeric;
  parent_index integer;
  parent_position integer;
  open_nodes integer[] := '{}'::integer[];
  node_addresses text[] := '{}'::text[];
  seen_prefixes text[] := '{}'::text[];
  active_prefixes text[] := '{}'::text[];
  next_prefixes text[];
  block_key_value text;
  segment_value text;
  node_address text;
  prefix text;
begin
  if pg_catalog.jsonb_typeof(p_tree) is distinct from 'object' then
    return false;
  end if;
  if not platform_private.cms_exact_keys(p_tree,
      array['format','nodes'], array['format','nodes'])
     or pg_catalog.jsonb_typeof(p_tree->'format') is distinct from 'string'
     or p_tree->>'format' <> 'cms.detached_tree.v1' then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_tree->'nodes') is distinct from 'array' then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(p_tree->'nodes') not between 1 and 512 then
    return false;
  end if;

  for node in
    select item.value from pg_catalog.jsonb_array_elements(p_tree->'nodes')
      with ordinality item(value, ordinal) order by item.ordinal
  loop
    if not platform_private.cms_exact_keys(node,
        array['parent','keySegments','blockKey','blockVersion','props'],
        array['parent','keySegments','blockKey','blockVersion','props']) then
      return false;
    end if;
    if pg_catalog.jsonb_typeof(node->'blockKey') is distinct from 'string'
       or pg_catalog.jsonb_typeof(node->'blockVersion') is distinct from 'number'
       or pg_catalog.jsonb_typeof(node->'keySegments') is distinct from 'array' then
      return false;
    end if;
    block_key_value := node->>'blockKey';
    -- The negated ASCII class also rejects a trailing newline; no regex end-anchor
    -- relaxation or non-ASCII collation range can admit an incomplete key.
    if pg_catalog.char_length(block_key_value) not between 1 and 96
       or pg_catalog.left(block_key_value, 1) collate "C" !~ '^[a-z]$'
       or block_key_value collate "C" ~ '[^a-z0-9._-]' then
      return false;
    end if;
    version_number := (node->>'blockVersion')::numeric;
    if version_number < 1 or version_number > 2147483647
       or version_number <> pg_catalog.trunc(version_number) then
      return false;
    end if;
    if pg_catalog.jsonb_array_length(node->'keySegments') = 0
       or platform_private.cms_json_bounded(node->'props', 262144, 8, 128, 128) is not true then
      return false;
    end if;

    if node_index = 0 then
      if node->'parent' is distinct from 'null'::jsonb then
        return false;
      end if;
      node_address := '';
    else
      if pg_catalog.jsonb_typeof(node->'parent') is distinct from 'number' then
        return false;
      end if;
      parent_number := (node->>'parent')::numeric;
      if parent_number < 0 or parent_number >= node_index
         or parent_number <> pg_catalog.trunc(parent_number) then
        return false;
      end if;
      parent_index := parent_number::integer;
      parent_position := pg_catalog.array_position(open_nodes, parent_index);
      if parent_position is null then
        return false;
      end if;
      open_nodes := open_nodes[1:parent_position];
      node_address := node_addresses[parent_index + 1];
    end if;

    for segment in
      select item.value from pg_catalog.jsonb_array_elements(node->'keySegments')
        with ordinality item(value, ordinal) order by item.ordinal
    loop
      if pg_catalog.jsonb_typeof(segment) is distinct from 'string' then
        return false;
      end if;
      segment_value := segment #>> '{}';
      if pg_catalog.char_length(segment_value) not between 1 and 64
         or pg_catalog.left(segment_value, 1) collate "C" !~ '^[a-z]$'
         or segment_value collate "C" ~ '[^a-z0-9_-]' then
        return false;
      end if;
      node_address := node_address || '/' || segment_value;
      -- A relative namespace may not pass through another block: that block
      -- would have to be the declared parent. This also rejects duplicate blocks.
      if node_address = any(node_addresses) then
        return false;
      end if;
    end loop;
    -- A namespace that already contributed descendants cannot become a block
    -- later: its descendants would precede it and their ancestry would change.
    if node_address = any(seen_prefixes) then
      return false;
    end if;

    prefix := '';
    next_prefixes := '{}'::text[];
    foreach segment_value in array pg_catalog.string_to_array(pg_catalog.substr(node_address, 2), '/') loop
      prefix := prefix || '/' || segment_value;
      if prefix = any(seen_prefixes) then
        if not (prefix = any(active_prefixes)) then
          return false;
        end if;
      else
        seen_prefixes := pg_catalog.array_append(seen_prefixes, prefix);
      end if;
      next_prefixes := pg_catalog.array_append(next_prefixes, prefix);
    end loop;
    active_prefixes := next_prefixes;
    node_addresses := pg_catalog.array_append(node_addresses, node_address);
    open_nodes := pg_catalog.array_append(open_nodes, node_index);
    node_index := node_index + 1;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then
  -- JSON numeric shape is checked before casts; malformed numeric input is a
  -- false predicate/CHECK violation, never a cast error exposed by the CHECK.
  return false;
end;
$body$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_detached_tree_valid(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_detached_tree_valid(jsonb)
  from public, anon, authenticated, service_role;

-- Existing pure-helper ACLs already serve the pattern CHECKs. Fail closed if
-- their private caller closure is absent; do not broaden any existing grant.
do $closure$
begin
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
      'platform_private.cms_exact_keys(jsonb,text[],text[])', 'EXECUTE')
     or not pg_catalog.has_function_privilege('wejammin_cms_definer',
      'platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)', 'EXECUTE') then
    raise exception 'detached tree validator requires existing private helper EXECUTE closure'
      using errcode = '55000';
  end if;
end;
$closure$;

-- Nullable, no default and no data rewrite/backfill: every legacy row stays NULL.
alter table platform_private.cms_composition_instances
  add column detached_tree jsonb,
  add constraint cms_composition_instances_detached_tree_check check (
    detached_tree is null or (
      platform_private.cms_detached_tree_valid(detached_tree) is true
      and link_mode = 'detached' and props = '{}'::jsonb
      and detached_tree->'nodes'->0->'blockKey' = pg_catalog.to_jsonb(block_key)
      and detached_tree->'nodes'->0->'blockVersion' = pg_catalog.to_jsonb(block_version)
    )
  );
comment on column platform_private.cms_composition_instances.detached_tree is
  'DEC-193: canonical private local tree; NULL retains legacy pinned behavior. Nonnull snapshots render independently of their provenance pin.';
comment on function platform_private.cms_detached_tree_valid(jsonb) is
  'DEC-193 / BE03c1563 pure shared snapshot grammar: 1-512 preorder blocks, closed namespaces, exact bounded effective values; no aggregate JSON or public-row address cap. No registry/permission lookup.';

commit;
