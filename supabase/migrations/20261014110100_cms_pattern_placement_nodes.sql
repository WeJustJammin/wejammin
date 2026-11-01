-- Slice 12 lane placement (BE03c Pattern versions and linked updates 1365; DEC-175, DEC-181, DEC-186; tracker
-- P2-S12-AC-218): the expansion of a pinned pattern forest into the nodes a placement addresses.
--
--   platform_private.cms_pattern_placement_nodes(owner, forest, visited) returns, in forest order, every BLOCK node of
--   the forest with its key chain: `node_chain` is the `/`-joined keys from the placement root to the node and
--   `root_chain` the chain of the block root the node lies under.  A top-level nested pattern reference has no block
--   of its own: it is replaced in place by the nested pinned version's own forest, recursively (DEC-181), and its key
--   leads the chain of every root it expands to (`/shared/a`, DEC-186).  A reference below a block root stays inside
--   that root (its nodes are chains under the root, never rows).  A reference node itself is never returned, so a
--   key that stops at a reference names no node and lies under no row (DEC-186).
--   `is_root` marks the block roots: these are the rows a placement writes.
-- Every nested pinned version must exist in the owner scope and be `active` (nested_pattern_not_active, 422) and its
-- lineage must not recur on the chain (pattern_cycle, 409); the nesting depth is bounded at 128 levels
-- (pattern_depth_exceeded, 422; a runaway guard, see the lane report).
-- Private; STABLE SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_placement_nodes(
  p_owner_id uuid, p_forest jsonb, p_visited uuid[], p_prefix text default '', p_root_chain text default null,
  p_depth integer default 1)
returns table(node_chain text, root_chain text, is_root boolean, node jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  item record;
  nested platform_private.cms_pattern_versions%rowtype;
  chain text;
  under_root text;
begin
  -- runaway guard: stored versions are bounded at definition (8 block levels per tree, 9 nesting levels), so the bound
  -- of 128 is never reached by a stored pattern; the empty child list of the deepest allowed node is not a level
  if p_depth > 128 and pg_catalog.jsonb_array_length(p_forest) > 0 then
    raise exception 'pattern_depth_exceeded' using errcode = 'P0001', detail = '["/patternId"]';
  end if;
  for item in
    select element.value as value
      from pg_catalog.jsonb_array_elements(p_forest) with ordinality element(value, ordinality)
     order by element.ordinality
  loop
    chain := p_prefix || '/' || (item.value->>'key');
    if item.value->>'kind' = 'block' then
      under_root := coalesce(p_root_chain, chain);
      node_chain := chain;
      root_chain := under_root;
      is_root := p_root_chain is null;
      node := item.value;
      return next;
      return query select * from platform_private.cms_pattern_placement_nodes(
        p_owner_id, item.value->'children', p_visited, chain, under_root, p_depth + 1);
    else
      select * into nested
        from platform_private.cms_pattern_versions candidate
       where candidate.owner_id = p_owner_id
         and candidate.pattern_id = (item.value->>'patternId')::uuid
         and candidate.version = (item.value->>'patternVersion')::integer;
      if not found or nested.state <> 'active' then
        raise exception 'nested_pattern_not_active' using errcode = 'P0001', detail = '["/patternId"]';
      end if;
      if nested.pattern_id = any(p_visited) then
        raise exception 'pattern_cycle' using errcode = 'P0001', detail = '["/patternId"]';
      end if;
      return query select * from platform_private.cms_pattern_placement_nodes(
        p_owner_id, nested.block_tree, p_visited || nested.pattern_id, chain, p_root_chain, p_depth + 1);
    end if;
  end loop;
end;
$body$;

comment on function platform_private.cms_pattern_placement_nodes(uuid, jsonb, uuid[], text, text, integer) is
  'CMS-03C-02 (DEC-175, DEC-181, DEC-186): every block node of a pinned pattern forest in forest order with its key chain and the chain of the block root it lies under; a top-level nested pattern reference is replaced in place by the nested pinned forest, so its key leads the chain; reference nodes are never returned. Nested versions must be active, lineages acyclic. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_placement_nodes(uuid, jsonb, uuid[], text, text, integer)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_placement_nodes(uuid, jsonb, uuid[], text, text, integer)
  from public, anon, authenticated, service_role;

commit;
